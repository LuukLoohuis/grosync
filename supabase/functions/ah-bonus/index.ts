import { BULK_MECHANISM, BULK_TITLE, NON_FOOD_CATEGORY, TREAT_CATEGORY, bouwIndex, zoekTreffers } from './match.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// AH has no public API; this is the anonymous flow of its own app, the same one ah-products uses.
const AH_HEADERS = { 'User-Agent': 'Appie/8.22.3', 'x-application': 'AHWEBSHOP', 'Content-Type': 'application/json' };
const PAGE_SIZE = 100;
const MAX_PAGES = 30;
// One fetch serves everyone; the bonus changes weekly, so half a day is plenty.
const FRESH_MS = 12 * 60 * 60 * 1000;
const MAX_RECIPES = 60;
// Zoveel paren legt de keurmeester in één keer voor; de rest gaat ongekeurd door.
const MAX_KEURING = 240;
// Zoveel paren per vraag aan het taalmodel; de rondes lopen naast elkaar.
const RONDE = 40;

// Tekstmodel: standaard OpenAI, maar zet DEEPSEEK_API_KEY en alles wat tekst is
// loopt via DeepSeek. De keuze in Beheer wint.
const textApi = (settings = { provider: '', textModel: '' }) => {
  const deepseek = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  const openai = Deno.env.get('OPENAI_API_KEY') ?? '';
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
async function aiSettings(): Promise<{ provider: string; textModel: string }> {
  const leeg = { provider: '', textModel: '' };
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
    return { provider: String(value.provider ?? ''), textModel: String(value.text_model ?? '') };
  } catch (error) {
    console.error('Instellingen lezen mislukt:', error);
    return leeg;
  }
}

type Paar = { recept: string; ingredient: string; productId: number; titel: string };

// Wat eenmaal gekeurd is, blijft gekeurd zolang deze instantie leeft: de bonus
// wisselt woensdag, de recepten zelden.
const geheugen = new Map<string, boolean>();
const sleutelVan = (paar: Paar) => `${paar.ingredient.trim().toLowerCase()}|${paar.productId}`;

/**
 * De woordregels vinden kandidaten; of een kandidaat ook echt is wat het recept
 * vraagt, kan een woordregel niet zien. "Vanilla extract" deelt een woord met
 * vanilleyoghurt, en roomkaas bieslook is geen roomkaas. Dit legt elk paar aan
 * een taalmodel voor. Gaat dat mis, dan blijven de regels leidend — liever een
 * twijfelachtige treffer dan een lege Bonus-tab door een storing.
 */
async function keur(paren: Paar[]): Promise<{ goed: Set<string>; gekeurd: boolean }> {
  const goed = new Set<string>();
  const open: Paar[] = [];
  for (const paar of paren) {
    const eerder = geheugen.get(sleutelVan(paar));
    if (eerder === true) goed.add(sleutelVan(paar));
    else if (eerder === undefined) open.push(paar);
  }
  if (open.length === 0) return { goed, gekeurd: true };

  const ai = textApi(await aiSettings());
  if (!ai.key) {
    for (const paar of open) goed.add(sleutelVan(paar));
    return { goed, gekeurd: false };
  }
  // Kleine rondes naast elkaar: één grote vraag liep tegen de time-out aan, en
  // dan ging alles ongekeurd door ("garlic" → Philadelphia knoflook).
  const rondes: Paar[][] = [];
  for (let i = 0; i < Math.min(open.length, MAX_KEURING); i += RONDE) rondes.push(open.slice(i, i + RONDE));
  const uitslagen = await Promise.all(rondes.map((ronde) => keurRonde(ronde, ai)));
  let gekeurd = true;
  rondes.forEach((ronde, r) => {
    const ja = uitslagen[r];
    if (!ja) gekeurd = false;
    ronde.forEach((paar, i) => {
      // Een ronde die mislukte: de regels blijven leidend, maar we onthouden niets.
      const klopt = ja ? ja.has(i + 1) : true;
      if (ja) geheugen.set(sleutelVan(paar), klopt);
      if (klopt) goed.add(sleutelVan(paar));
    });
  });
  // Wat niet meer in de rondes paste, gaat ongekeurd door.
  for (const paar of open.slice(MAX_KEURING)) goed.add(sleutelVan(paar));
  return { goed, gekeurd };
}

/** Eén ronde langs het taalmodel: de nummers die kloppen, of null als het misging. */
async function keurRonde(ronde: Paar[], ai: ReturnType<typeof textApi>): Promise<Set<number> | null> {
  const regels = ronde.map((paar, i) =>
    `${i + 1}. Recept «${paar.recept}» vraagt: «${paar.ingredient}» · product: «${paar.titel}»`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(ai.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${ai.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Je controleert of een supermarktproduct precies is wat een recept vraagt. Antwoord alleen als JSON.',
          },
          {
            role: 'user',
            content:
              'Per regel staat wat een recept vraagt en welk product bij Albert Heijn erbij gezocht is. ' +
              'Zeg per nummer of iemand die dit recept kookt dít product zou kopen voor dát ingrediënt.\n' +
              'JA als het hetzelfde product is, ook in een gewone variant: heel of gesneden, vers of instant, ' +
              'huismerk of A-merk, andere maat of verpakking. Voorbeelden van ja: ' +
              '"volkoren brood" → "AH Rond volkoren heel"; "noodles" → "instant noodles"; ' +
              '"zoete aardappel" → "zoete aardappel, gesneden"; "kipfilet" → "AH Scharrel kipfilet"; "eieren" → "scharreleieren".\n' +
              'NEE als het een ander product is dat toevallig een woord deelt, of een smaak of vorm heeft die het recept niet vraagt. ' +
              'Voorbeelden van nee: "vanilla extract" → "vanille yoghurt"; "cream cheese" → "roomkaas bieslook"; ' +
              '"garlic bulb" → "Philadelphia knoflook"; "lemon" → "kwark citroen"; "butter beans" → "Peanut butter cup"; ' +
              '"red pepper flakes" → "rauwkost paprika"; ' +
              '"melk" → "chocoladehagel melk"; "aardappel" → "chips"; "kokosmelk" → "kokos drink"; "groente" → "kant-en-klare maaltijd".\n\n' +
              regels.join('\n') +
              '\n\nJSON: {"ja":[nummers van de paren die kloppen]}',
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`keuring ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return new Set<number>(Array.isArray(parsed?.ja) ? parsed.ja.map((n: unknown) => Number(n)) : []);
  } catch (error) {
    console.error('Keuringsronde mislukt, regels blijven leidend:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type BonusRow = {
  product_id: number;
  title: string;
  unit_size: string | null;
  category: string | null;
  mechanism: string | null;
  price: number | null;
  price_before: number | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
};

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

let cachedToken: { value: string; expiresAt: number } | null = null;

async function ahToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch('https://api.ah.nl/mobile-auth/v1/auth/token/anonymous', {
    method: 'POST',
    headers: AH_HEADERS,
    body: JSON.stringify({ clientId: 'appie' }),
  });
  if (!response.ok) throw new Error(`AH token request failed: ${response.status}`);
  const data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

// "filters=bonus=true" is what makes the search return only products that are in the bonus.
async function fetchBonusPage(page: number): Promise<BonusRow[]> {
  const url = `https://api.ah.nl/mobile-services/product/search/v2?query=&size=${PAGE_SIZE}&page=${page}&sortOn=RELEVANCE&filters=${encodeURIComponent('bonus=true')}`;
  const response = await fetch(url, { headers: { ...AH_HEADERS, Authorization: `Bearer ${await ahToken()}` } });
  if (!response.ok) {
    console.error('AH bonus page failed:', page, response.status);
    return [];
  }
  const products = (await response.json()).products || [];
  return products
    .filter((p: Record<string, unknown>) => typeof p.webshopId === 'number' && p.isBonus)
    .map((p: Record<string, any>): BonusRow => ({
      product_id: p.webshopId,
      title: p.title || '',
      unit_size: p.salesUnitSize || null,
      category: p.mainCategory || null,
      mechanism: p.bonusMechanism || null,
      price: typeof p.currentPrice === 'number' ? p.currentPrice : null,
      price_before: typeof p.priceBeforeBonus === 'number' ? p.priceBeforeBonus : null,
      start_date: p.bonusStartDate || null,
      end_date: p.bonusEndDate || null,
      image_url: p.images?.[0]?.url || null,
    }));
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

// PostgREST geeft standaard hoogstens duizend rijen terug. De bonus is groter,
// dus lezen we hem per blok: anders legden we maar een derde langs je recepten.
const BLOK = 1000;

async function storedBonus(): Promise<BonusRow[] & { length: number }> {
  const rows: BonusRow[] = [];
  for (let start = 0; start < MAX_PAGES * PAGE_SIZE; start += BLOK) {
    const response = await rest('bonus_products?select=*&order=title.asc', {
      headers: { Range: `${start}-${start + BLOK - 1}`, 'Range-Unit': 'items' },
    });
    if (!response.ok) {
      console.error('Reading stored bonus failed:', response.status, await response.text());
      break;
    }
    const blok: BonusRow[] = await response.json();
    rows.push(...blok);
    if (blok.length < BLOK) break;
  }
  return rows as BonusRow[] & { length: number };
}

async function newestFetch(): Promise<number> {
  const response = await rest('bonus_products?select=fetched_at&order=fetched_at.desc&limit=1');
  if (!response.ok) return 0;
  const rows = await response.json();
  return rows[0]?.fetched_at ? new Date(rows[0].fetched_at).getTime() : 0;
}

async function refreshBonus(): Promise<BonusRow[]> {
  const rows: BonusRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const pageRows = await fetchBonusPage(page);
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  if (rows.length === 0) return [];

  const fetched_at = new Date().toISOString();
  const withTime = rows.map((row) => ({ ...row, fetched_at }));
  for (let i = 0; i < withTime.length; i += 500) {
    const response = await rest('bonus_products?on_conflict=product_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(withTime.slice(i, i + 500)),
    });
    if (!response.ok) console.error('Storing bonus failed:', response.status, (await response.text()).slice(0, 200));
  }
  // Offers that ended are no longer in the list AH returns.
  await rest(`bonus_products?fetched_at=lt.${encodeURIComponent(fetched_at)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  console.log('Bonus refreshed:', rows.length, 'products');
  return withTime;
}


// A handful of cooking ingredients, spread over departments, for "Maak een recept van de bonus".
// This travels with the answer so recipes also work before the bonus_products table exists.
const SAMPLE_SIZE = 70;

function sampleOffers(bonus: BonusRow[]) {
  const usable = bonus.filter((row) => {
    const category = row.category ?? '';
    if (!category || NON_FOOD_CATEGORY.test(category) || TREAT_CATEGORY.test(category)) return false;
    // Een tweepak met 3% volume voordeel is geen aanbieding om je week op te bouwen.
    return !BULK_TITLE.test(row.title) && !BULK_MECHANISM.test(row.mechanism ?? '');
  });
  const byCategory = new Map<string, BonusRow[]>();
  for (const row of usable) {
    const list = byCategory.get(row.category ?? '') ?? [];
    list.push(row);
    byCategory.set(row.category ?? '', list);
  }
  const picked: BonusRow[] = [];
  for (let round = 0; round < 12 && picked.length < SAMPLE_SIZE; round++) {
    let added = false;
    for (const list of byCategory.values()) {
      const row = list[round];
      if (!row) continue;
      picked.push(row);
      added = true;
      if (picked.length >= SAMPLE_SIZE) break;
    }
    if (!added) break;
  }
  return picked.map((row) => ({
    title: row.title,
    category: row.category,
    price: row.price,
    price_before: row.price_before,
    mechanism: row.mechanism,
    image_url: row.image_url,
  }));
}


type Recipe = { id: string; name: string; ingredients: string[] };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!(await isSignedIn(req))) return json({ error: 'Sign in required' }, 401);

    const body = await req.json().catch(() => ({}));
    const recipes: Recipe[] = (Array.isArray(body?.recipes) ? body.recipes : [])
      .filter((r: Record<string, unknown>) => typeof r?.id === 'string' && Array.isArray(r?.ingredients))
      .slice(0, MAX_RECIPES);

    let bonus = (await newestFetch()) > Date.now() - FRESH_MS ? await storedBonus() : await refreshBonus();
    if (bonus.length === 0) bonus = await storedBonus();
    if (bonus.length === 0) return json({ error: 'Geen bonus gevonden' }, 502);

    const index = bouwIndex(bonus);

    const ruw = recipes.map((recipe) => {
      const hits = zoekTreffers(recipe.ingredients, index);
      const saving = hits.reduce((sum, hit) => {
        const { price, price_before } = hit.product;
        return sum + (price != null && price_before != null && price_before > price ? price_before - price : 0);
      }, 0);
      return {
        recipeId: recipe.id,
        name: recipe.name,
        ingredientCount: recipe.ingredients.length,
        hits: hits.map((hit) => ({
          ingredient: hit.ingredient,
          title: hit.product.title,
          mechanism: hit.product.mechanism,
          price: hit.product.price,
          priceBefore: hit.product.price_before,
          productId: hit.product.product_id,
          imageUrl: hit.product.image_url,
          unitSize: hit.product.unit_size,
        })),
        saving: Math.round(saving * 100) / 100,
      };
    })
      .filter((match) => match.hits.length > 0)
      .sort((a, b) => b.hits.length - a.hits.length || b.saving - a.saving);

    // De regels vonden kandidaten; het taalmodel zegt welke echt kloppen.
    const paren: Paar[] = ruw.flatMap((match) =>
      match.hits.map((hit) => ({ recept: match.name, ingredient: hit.ingredient, productId: hit.productId, titel: hit.title })));
    const { goed, gekeurd } = await keur(paren);
    const afgekeurd: { ingredient: string; title: string }[] = [];
    const matches = ruw
      .map((match) => {
        const hits = match.hits.filter((hit) => {
          const klopt = goed.has(`${hit.ingredient.trim().toLowerCase()}|${hit.productId}`);
          if (!klopt) afgekeurd.push({ ingredient: hit.ingredient, title: hit.title });
          return klopt;
        });
        const saving = hits.reduce((sum, hit) =>
          sum + (hit.price != null && hit.priceBefore != null && hit.priceBefore > hit.price ? hit.priceBefore - hit.price : 0), 0);
        return { ...match, hits, saving: Math.round(saving * 100) / 100 };
      })
      .filter((match) => match.hits.length > 0)
      .sort((a, b) => b.hits.length - a.hits.length || b.saving - a.saving);

    // Most offers end on the same Sunday; some run for months, so only look at the coming weeks.
    const horizon = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateCount = new Map<string, number>();
    for (const row of bonus) {
      if (row.end_date && row.end_date <= horizon) dateCount.set(row.end_date, (dateCount.get(row.end_date) ?? 0) + 1);
    }
    const endDate = [...dateCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return json({ matches, bonusCount: bonus.length, endDate, sample: sampleOffers(bonus), gekeurd, afgekeurd });
  } catch (error) {
    console.error('ah-bonus failed:', error);
    return json({ error: 'Bonus ophalen lukte niet' }, 500);
  }
});
