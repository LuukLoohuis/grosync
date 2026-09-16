import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

/**
 * Een sleutel of prijs-id die er echt is. Stripe geeft lange codes; alles wat
 * korter is komt uit een voorbeeld ("sk_test_JOUW") en telt niet mee.
 */
const echt = (waarde: string, prefix: string, minimaal: number) =>
  waarde.startsWith(prefix) && !waarde.includes('...') && waarde.length >= minimaal;


async function signedInUserId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ?? null;
}

/**
 * Opzeggen, bonnetjes en een andere pas regelt Stripe zelf; wij sturen je er
 * alleen heen, met een adres dat alleen voor jouw klantnummer werkt.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = env('STRIPE_SECRET_KEY');
    if (!echt(key, 'sk_', 30)) return json({ error: 'betalen-uit' }, 503);

    const userId = await signedInUserId(req);
    if (!userId) return json({ error: 'Sign in required' }, 401);

    const response = await fetch(
      `${env('SUPABASE_URL')}/rest/v1/plus_members?user_id=eq.${userId}&select=stripe_customer_id`,
      { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` } },
    );
    const rows = response.ok ? await response.json() : [];
    const customer = rows?.[0]?.stripe_customer_id;
    if (!customer) return json({ error: 'geen-abonnement' }, 404);

    const stripe = new Stripe(key, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
    const site = env('SITE_URL') || 'https://www.couplecart.nl';
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${site}/#/`,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('stripe-portal failed:', error);
    return json({ error: 'Het klantportaal openen lukte niet' }, 500);
  }
});
