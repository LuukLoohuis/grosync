import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

// Stripe roept dit aan, niet de app: geen CORS, wel een handtekening.
const env = (name: string) => Deno.env.get(name) ?? '';

/**
 * Een sleutel of prijs-id die er echt is. Stripe geeft lange codes; alles wat
 * korter is komt uit een voorbeeld ("sk_test_JOUW") en telt niet mee.
 */
const echt = (waarde: string, prefix: string, minimaal: number) =>
  waarde.startsWith(prefix) && !waarde.includes('...') && waarde.length >= minimaal;


const rest = (pad: string, init: RequestInit = {}) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/${pad}`, {
    ...init,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

/** Eén keer verwerken: Stripe stuurt een gebeurtenis soms twee keer. */
async function alGezien(id: string, type: string): Promise<boolean> {
  const response = await rest('stripe_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id, type }),
  });
  // 409 betekent: deze stond er al.
  return response.status === 409;
}

/** Zet of haalt Plus, met de datum tot wanneer er betaald is. */
async function schrijfPlus(row: Record<string, unknown>) {
  const response = await rest('plus_members?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!response.ok) console.error('plus_members schrijven mislukt:', response.status, (await response.text()).slice(0, 200));
}

async function userIdVanKlant(customerId: string): Promise<string | null> {
  const response = await rest(`plus_members?stripe_customer_id=eq.${customerId}&select=user_id`);
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.user_id ?? null;
}

const tot = (seconden: number | null | undefined) =>
  typeof seconden === 'number' ? new Date(seconden * 1000).toISOString() : null;

/**
 * Tot wanneer er betaald is. Stripe zette dit eerst op het abonnement zelf, en
 * in nieuwere versies op de regels eronder; we kijken op allebei de plekken.
 */
function betaaldTot(subscription: Stripe.Subscription | null | undefined): string | null {
  if (!subscription) return null;
  const opAbonnement = (subscription as { current_period_end?: number }).current_period_end;
  if (typeof opAbonnement === 'number') return tot(opAbonnement);

  const einden = (subscription.items?.data ?? [])
    .map((regel) => (regel as { current_period_end?: number }).current_period_end)
    .filter((waarde): waarde is number => typeof waarde === 'number');
  // De regel die het verst vooruit loopt bepaalt tot wanneer je Plus houdt.
  return einden.length > 0 ? tot(Math.max(...einden)) : null;
}

Deno.serve(async (req) => {
  const key = env('STRIPE_SECRET_KEY');
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!echt(key, 'sk_', 30) || !echt(secret, 'whsec_', 25)) return new Response('Betalen staat uit', { status: 503 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Geen handtekening', { status: 400 });

  const stripe = new Stripe(key, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (error) {
    // Alles wat niet klopt komt niet van Stripe.
    console.error('Handtekening klopt niet:', error);
    return new Response('Handtekening klopt niet', { status: 400 });
  }

  try {
    if (await alGezien(event.id, event.type)) return new Response('ok (dubbel)', { status: 200 });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      if (userId && customerId) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
        const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        await schrijfPlus({
          user_id: userId,
          source: 'stripe',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription?.status ?? 'active',
          expires_at: betaaldTot(subscription),
          cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
        });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const userId = (subscription.metadata?.user_id as string | undefined) ?? await userIdVanKlant(customerId);

      if (userId) {
        const afgelopen = event.type === 'customer.subscription.deleted'
          || ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);
        await schrijfPlus({
          user_id: userId,
          source: 'stripe',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          // Opzeggen haalt Plus niet meteen weg: je hebt de periode betaald.
          expires_at: afgelopen ? new Date().toISOString() : betaaldTot(subscription),
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('stripe-webhook failed:', error);
    // Een 500 laat Stripe het later opnieuw proberen.
    return new Response('Verwerken mislukt', { status: 500 });
  }
});
