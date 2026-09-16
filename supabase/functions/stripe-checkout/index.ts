import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

/** De ingelogde gebruiker, met e-mail als die er is. */
async function signedInUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id, email: user.email ?? null } : null;
}

/** Het klantnummer dat we eerder voor deze gebruiker bewaarden, als dat er is. */
async function storedCustomer(userId: string): Promise<string | null> {
  const response = await fetch(
    `${env('SUPABASE_URL')}/rest/v1/plus_members?user_id=eq.${userId}&select=stripe_customer_id`,
    { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` } },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.stripe_customer_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = env('STRIPE_SECRET_KEY');
    // Zonder sleutel staat betalen simpelweg nog niet aan; dat is geen fout.
    if (!key) return json({ error: 'betalen-uit' }, 503);

    const user = await signedInUser(req);
    if (!user) return json({ error: 'Sign in required' }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan === 'jaar' ? 'jaar' : 'maand';
    const price = plan === 'jaar' ? env('STRIPE_PRICE_YEAR') : env('STRIPE_PRICE_MONTH');
    if (!price) return json({ error: 'betalen-uit' }, 503);

    const site = env('SITE_URL') || 'https://www.couplecart.nl';
    const stripe = new Stripe(key, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
    const customer = await storedCustomer(user.id);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      // Zo weet de webhook straks bij wie deze betaling hoort.
      client_reference_id: user.id,
      ...(customer ? { customer } : user.email ? { customer_email: user.email } : {}),
      customer_update: customer ? { address: 'auto' } : undefined,
      allow_promotion_codes: true,
      automatic_tax: { enabled: env('STRIPE_TAX') === 'aan' },
      subscription_data: { metadata: { user_id: user.id } },
      // Wettelijk verplicht bij een digitale dienst die meteen begint.
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message: `Ik ga akkoord met de [algemene voorwaarden](${site}/#/info/voorwaarden) en wil dat CoupleCart Plus meteen begint. Daarmee doe ik afstand van mijn bedenktijd van veertien dagen.`,
        },
      },
      success_url: `${site}/#/?plus=gelukt`,
      cancel_url: `${site}/#/?plus=afgebroken`,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('stripe-checkout failed:', error);
    return json({ error: 'Afrekenen lukte niet' }, 500);
  }
});
