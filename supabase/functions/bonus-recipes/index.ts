const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Enough offers to choose from without sending the whole week to the model.
const MAX_OFFERS = 70;
const NON_FOOD_CATEGORY = /huishouden|drogisterij|baby|huisdier|koken|tafelen|vrije tijd|bloem, plant/i;
const TREAT_CATEGORY = /borrel|chips|snack|snoep|chocolade|koek|tussendoortje|bier|wijn|aperitie|frisdrank|koffie|thee/i;

// Tekstmodel: standaard OpenAI, maar zet DEEPSEEK_API_KEY en alles wat tekst is
// loopt via DeepSeek (dezelfde API-vorm, een stuk goedkoper). Beelden kan DeepSeek
// niet lezen; die blijven bij OpenAI of Gemini.
const textApi = (settings = { provider: '', textModel: '' }) => {
  const deepseek = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  const openai = Deno.env.get('OPENAI_API_KEY') ?? '';
  // De keuze in Beheer wint; zonder keuze beslist de sleutel die er ligt.
  const wantsDeepseek = settings.provider ? settings.provider === 'deepseek' : Boolean(deepseek);

  if (wantsDeepseek && deepseek) {
    return {
      key: deepseek,
      endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.deepseek.com/v1') + '/chat/completions',
      model: settings.textModel || Deno.env.get('TEXT_MODEL') || 'deepseek-chat',
    };
  }
  return {
    key: openai,
    endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.openai.com/v1') + '/chat/completions',
    model: settings.textModel || Deno.env.get('TEXT_MODEL') || 'gpt-4o-mini',
  };
};

/** Instellingen uit de database; leeg betekent: val terug op de omgeving. */
async function aiSettings(): Promise<{ provider: string; textModel: string; scanModel: string }> {
  const leeg = { provider: '', textModel: '', scanModel: '' };
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return leeg;
  try {
    const response = await fetch(`${url}/rest/v1/app_settings?key=eq.ai&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return leeg;
    const rows = await response.json();
    const value = rows?.[0]?.value ?? {};
    return {
      provider: String(value.provider ?? ''),
      textModel: String(value.text_model ?? ''),
      scanModel: String(value.scan_model ?? ''),
    };
  } catch (error) {
    console.error('Instellingen lezen mislukt:', error);
    return leeg;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

async function isSignedIn(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

type Offer = { title: string; category: string | null; price: number | null; price_before: number | null; mechanism: string | null };

async function storedOffers(): Promise<Offer[]> {
  const response = await fetch(
    `${env('SUPABASE_URL')}/rest/v1/bonus_products?select=title,category,price,price_before,mechanism&order=category.asc`,
    { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` } },
  );
  if (!response.ok) {
    console.error('Reading bonus failed:', response.status, (await response.text()).slice(0, 160));
    return [];
  }
  return await response.json();
}

/** Cooking ingredients only, spread over departments so the model does not get eight kinds of yoghurt. */
function pickOffers(offers: Offer[]): Offer[] {
  const usable = offers.filter((offer) => {
    const category = offer.category ?? '';
    return category && !NON_FOOD_CATEGORY.test(category) && !TREAT_CATEGORY.test(category);
  });
  const byCategory = new Map<string, Offer[]>();
  for (const offer of usable) {
    const list = byCategory.get(offer.category ?? '') ?? [];
    list.push(offer);
    byCategory.set(offer.category ?? '', list);
  }
  const picked: Offer[] = [];
  let round = 0;
  while (picked.length < MAX_OFFERS && round < 12) {
    let added = false;
    for (const list of byCategory.values()) {
      const offer = list[round];
      if (!offer) continue;
      picked.push(offer);
      added = true;
      if (picked.length >= MAX_OFFERS) break;
    }
    if (!added) break;
    round++;
  }
  return picked;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!(await isSignedIn(req))) return json({ error: 'Sign in required' }, 401);

    const ai = textApi(await aiSettings());
    if (!ai.key) return json({ error: 'Geen sleutel voor het taalmodel ingesteld' }, 500);

    const body = await req.json().catch(() => ({}));
    const staples: string[] = Array.isArray(body?.staples) ? body.staples.slice(0, 20) : [];
    const avoid: string[] = Array.isArray(body?.avoid) ? body.avoid.slice(0, 20) : [];
    const lang = body?.lang === 'en' ? 'en' : 'nl';

    // The client can pass the offers ah-bonus already fetched; otherwise read them here.
    const given: Offer[] = Array.isArray(body?.offers)
      ? body.offers.filter((offer: Record<string, unknown>) => typeof offer?.title === 'string').slice(0, 120)
      : [];
    const offers = pickOffers(given.length >= 10 ? given : await storedOffers());
    if (offers.length < 10) return json({ error: 'De bonus is nog niet opgehaald' }, 409);

    const menu = offers.map((offer) => {
      const price = offer.price != null ? `€${offer.price.toFixed(2)}` : offer.mechanism ?? '';
      return `${offer.title} (${offer.category}${price ? `, ${price}` : ''}${offer.mechanism && offer.price != null ? `, ${offer.mechanism}` : ''})`;
    });

    const response = await fetch(ai.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ai.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai.model,
        response_format: { type: 'json_object' },
        temperature: 0.6,
        messages: [
          {
            role: 'system',
            content:
              lang === 'en'
                ? 'You are a Dutch home cook who cooks cheap, tasty meals with this week’s supermarket offers. Answer in English and only as JSON.'
                : 'Je bent een Nederlandse kok die goedkoop en lekker kookt met de aanbiedingen van de week. Antwoord in het Nederlands en alleen als JSON.',
          },
          {
            role: 'user',
            content: `Dit zijn aanbiedingen van deze week bij Albert Heijn:\n${menu.join('\n')}\n\n` +
              `Verzin 3 verschillende avondmaaltijden voor 2 personen. Regels:\n` +
              `- Elk gerecht gebruikt minstens 3 producten uit de lijst hierboven als hoofdingrediënt.\n` +
              `- Daarnaast mag je basisproducten gebruiken die mensen in huis hebben: ${staples.join(', ') || 'zout, peper, olie, bloem, suiker'}.\n` +
              (avoid.length ? `- Gebruik niet: ${avoid.join(', ')}.\n` : '') +
              `- Houd het haalbaar op een doordeweekse avond, hoogstens 40 minuten.\n` +
              `- Schrijf hoeveelheden per ingrediënt. Zet "ca. " voor een hoeveelheid die je zelf schat.\n` +
              (lang === 'en' ? `- Write the name, description, ingredients and instructions in English; keep the product titles from the list as they are.\n` : '') + `\n` +
              `JSON: {"recipes":[{"name":"","description":"één zin","ingredients":["500 g kipfilet"],"instructions":"1. …\\n2. …","servings":2,"usedBonus":["exacte titel uit de lijst"],"minutes":30}]}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', response.status, (await response.text()).slice(0, 200));
      return json({ error: 'Recepten bedenken lukte niet' }, 502);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const recipes = (Array.isArray(parsed.recipes) ? parsed.recipes : [])
      .filter((recipe: Record<string, unknown>) => typeof recipe?.name === 'string' && Array.isArray(recipe?.ingredients))
      .slice(0, 3)
      .map((recipe: Record<string, any>) => ({
        name: String(recipe.name),
        description: String(recipe.description ?? ''),
        ingredients: recipe.ingredients.map(String),
        instructions: String(recipe.instructions ?? ''),
        servings: Number(recipe.servings) || 2,
        minutes: Number(recipe.minutes) || null,
        usedBonus: Array.isArray(recipe.usedBonus) ? recipe.usedBonus.map(String).slice(0, 8) : [],
      }));

    console.log('Bonus recipes:', recipes.length, 'from', offers.length, 'offers');
    return json({ recipes, offerCount: offers.length });
  } catch (error) {
    console.error('bonus-recipes failed:', error);
    return json({ error: 'Recepten bedenken lukte niet' }, 500);
  }
});
