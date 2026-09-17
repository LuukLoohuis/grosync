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

// Words that say nothing about which product it is.
const STOP = new Set([
  'vers', 'verse', 'biologisch', 'biologische', 'light', 'mager', 'magere', 'extra', 'fijn', 'fijne', 'grof', 'grove',
  'gesneden', 'gemalen', 'stuks', 'stuk', 'pak', 'fles', 'zak', 'doos', 'blik', 'grote', 'kleine', 'halve', 'hele',
  'rode', 'groene', 'gele', 'witte', 'zwarte', 'jonge', 'oude', 'keuze', 'voordeelverpakking', 'family', 'pack',
  'naturel', 'gekookt', 'gekookte', 'gebakken', 'stukjes', 'blokjes', 'reepjes', 'plakjes', 'gram', 'kilo', 'liter',
]);

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

// Beer, crisps and sweets share words with real ingredients ("Radler citroen", "chips paprika").
const TREAT_CATEGORY = /borrel|chips|snack|snoep|chocolade|koek|tussendoortje|bier|wijn|aperitie|frisdrank|sappen|water|koffie|thee/i;
const TREAT_WORD = /\b(bier|wijn|chips|koek|koekjes|chocolade|frisdrank|cola|sap|koffie|thee|snoep|borrel)\b/i;
// Soap and pet food are never an ingredient, whatever word they share ("vaatwascapsules citroen").
const NON_FOOD_CATEGORY = /huishouden|drogisterij|baby|huisdier|koken|tafelen|vrije tijd|bloem, plant/i;
// Ready-made meals only count when the recipe asks for one.
const MEAL_CATEGORY = /maaltijd|salade|pizza/i;
const MEAL_WORD = /\b(maaltijd|salade|pizza)\b/i;

// Meat and fish, so a vegetarian dish never gets a steak skewer offered because
// the product happens to say "black garlic". Dutch and English, because half the
// recipes people paste in are English.
const MEAT_FISH = /\b(kip|kipfilet|kippen\w*|gehakt|rund|rundvlees|biefstuk|biefstuk\w*|varken\w*|spek|spekjes|worst|rookworst|ham|bacon|lam|lams\w*|kalkoen|kalfs\w*|shoarma|speklap\w*|chorizo|salami|schnitzel|burger|hamburger|saucijs\w*|slavink|frikandel|kroket|spies\w*|vlees\w*|zalm|zalmfilet|tonijn|garnaal|garnalen|kabeljauw|mossel\w*|makreel|haring|forel|scampi|inktvis|ansjovis|vis|visfilet|beef|steak|chicken|pork|bacon|salmon|tuna|shrimp|prawn\w*|fish)\b/i;

// Meal kits are a whole dinner, not an ingredient: "AH Groene curry verspakket"
// is not the curry paste your recipe asks for.
const KIT_WORD = /\b(verspakket\w*|maaltijdpakket\w*|maaltijdbox\w*|kookpakket\w*|maaltijdsalade\w*|wokpakket\w*)\b/i;

// A recipe asks for one pack, not a tray of six. AH's bulk deals ("6-pack",
// "2 stuks", "5% volume voordeel") are a reason to stock up, not a week's bonus,
// and their headline savings drown out the real offers.
const BULK_TITLE = /(\b\d+\s*-?\s*pack\b|\b\d+\s*stuks?\b|\bvoordeel(?:pak|verpakking)\w*|\bmultipack\w*|\bgrootverpakking\w*|\bfamiliepak\w*)/i;
const BULK_MECHANISM = /volume\s*voordeel/i;

// English ingredients against Dutch shelf labels. Only the words that actually
// turn up in recipes; a wrong translation here costs a wrong match.
const DUTCH: Record<string, string[]> = {
  garlic: ['knoflook'], onion: ['ui', 'uien'], ginger: ['gember'], chicken: ['kip', 'kipfilet'],
  beef: ['rundvlees'], pork: ['varkensvlees'], salmon: ['zalm'], tuna: ['tonijn'], shrimp: ['garnalen'],
  rice: ['rijst'], noodles: ['noedels', 'mie'], pasta: ['pasta'], spaghetti: ['spaghetti'],
  potato: ['aardappel', 'aardappelen'], potatoes: ['aardappelen'], tomato: ['tomaat', 'tomaten'],
  tomatoes: ['tomaten'], mushroom: ['champignons'], mushrooms: ['champignons'], spinach: ['spinazie'],
  carrot: ['wortel'], carrots: ['wortel'], broccoli: ['broccoli'], cauliflower: ['bloemkool'],
  cucumber: ['komkommer'], lettuce: ['sla'], courgette: ['courgette'], zucchini: ['courgette'],
  aubergine: ['aubergine'], eggplant: ['aubergine'], leek: ['prei'], cabbage: ['kool'],
  cheese: ['kaas'], milk: ['melk'], butter: ['boter'], cream: ['room'], yoghurt: ['yoghurt'],
  yogurt: ['yoghurt'], egg: ['eieren'], eggs: ['eieren'], bread: ['brood'], flour: ['bloem'],
  honey: ['honing'], lemon: ['citroen'], lime: ['limoen'], orange: ['sinaasappel'], apple: ['appel'],
  banana: ['banaan'], avocado: ['avocado'], beans: ['bonen'], chickpeas: ['kikkererwten'],
  lentils: ['linzen'], tofu: ['tofu'], coconut: ['kokos'], 'coconut milk': ['kokosmelk'],
  peanut: ['pinda'], 'peanut butter': ['pindakaas'], 'soy sauce': ['sojasaus'], soy: ['soja'],
  'curry paste': ['currypasta'], curry: ['currypasta', 'kerrie'], 'sweet potato': ['zoete aardappel'],
  'maple syrup': ['ahornsiroop'], 'rice vinegar': ['rijstazijn'], sesame: ['sesam'],
  'spring onion': ['bosui'], scallion: ['bosui'], parsley: ['peterselie'], basil: ['basilicum'],
  coriander: ['koriander'], cilantro: ['koriander'], pepper: [], pesto: ['pesto'], olives: ['olijven'],
};

// Salt, pepper and oil stand in almost every recipe, so they would match crisps ("Mini crackers zout")
// or tuna in olive oil. Basics never drive a match; the ingredient only counts on its own words.
const PANTRY = new Set([
  'zout', 'zeezout', 'keukenzout', 'salt', 'peper', 'pepers', 'peperkorrels', 'pepper',
  'olie', 'olijfolie', 'zonnebloemolie', 'bakolie', 'plantaardige', 'boter', 'roomboter',
  'water', 'suiker', 'kristalsuiker', 'rietsuiker', 'basterdsuiker', 'sugar',
  'bloem', 'tarwebloem', 'patentbloem', 'flour', 'azijn', 'maizena',
]);

const wordsOf = (text: string) =>
  new Set(
    text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter((word) => word.length >= 4 && !STOP.has(word) && !/^\d+$/.test(word)),
  );

/** The words to look for: what the recipe says, plus the Dutch for it. */
const searchWords = (ingredient: string) => {
  const lower = ingredient.toLowerCase();
  const words = new Set(wordsOf(ingredient));
  for (const [english, dutch] of Object.entries(DUTCH)) {
    if (!new RegExp(`\\b${english}\\b`, 'i').test(lower)) continue;
    for (const word of dutch) for (const part of word.split(' ')) if (part.length >= 4) words.add(part);
  }
  return words;
};

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

    // One word list per product, so every ingredient only costs a set lookup.
    const byWord = new Map<string, BonusRow[]>();
    const titleWordCount = new Map<number, number>();
    const tailWords = new Map<number, Set<string>>();
    for (const product of bonus) {
      const words = [...wordsOf(product.title)];
      titleWordCount.set(product.product_id, words.length);
      // Whatever follows "met" or "in" is a flavour, not the product: "Kruidenboter
      // met knoflook" is butter, "Tonijnstukken in olijfolie" is tuna.
      const head = product.title.split(/\s+\b(?:met|in)\b\s+/i)[0];
      const headWords = [...wordsOf(head)];
      // What the product really is, stands at the end of an AH title: "AH Scharrel kipfilet".
      // "AH Pasta geraspte kaas" is cheese, not pasta, so only the last two words count.
      tailWords.set(product.product_id, new Set((headWords.length ? headWords : words).slice(-2)));
      for (const word of words) {
        const list = byWord.get(word) ?? [];
        list.push(product);
        byWord.set(word, list);
      }
    }

    const matches = recipes.map((recipe) => {
      const seen = new Set<number>();
      const hits: { ingredient: string; product: BonusRow }[] = [];
      // A dish without meat or fish in it never gets meat or fish offered, whatever
      // word a product title happens to share ("BBQ biefstukspies black garlic").
      const wantsMeatFish = recipe.ingredients.some((line) => MEAT_FISH.test(line));

      for (const ingredient of recipe.ingredients) {
        const wantsTreat = TREAT_WORD.test(ingredient);
        const wantsMeal = MEAL_WORD.test(ingredient);
        const thisIsMeatFish = MEAT_FISH.test(ingredient);
        let best: BonusRow | undefined;
        for (const word of searchWords(ingredient)) {
          if (PANTRY.has(word)) continue;
          const candidates = byWord.get(word);
          if (!candidates) continue;
          for (const candidate of candidates) {
            if (seen.has(candidate.product_id)) continue;
            const category = candidate.category ?? '';
            // A recipe asking for lemon does not mean lemon beer or dishwasher tabs.
            if (NON_FOOD_CATEGORY.test(category)) continue;
            if (!wantsTreat && TREAT_CATEGORY.test(category)) continue;
            if (!wantsMeal && MEAL_CATEGORY.test(category)) continue;
            // A whole dinner in a box is not the ingredient you asked for.
            if (!wantsMeal && KIT_WORD.test(candidate.title)) continue;
            // Buying six of something is not this week's bonus on one of them.
            if (BULK_TITLE.test(candidate.title) || BULK_MECHANISM.test(candidate.mechanism ?? '')) continue;
            // Meat or fish only for a recipe that has meat or fish, and only on
            // the line that asks for it: garlic never buys a steak skewer.
            if (MEAT_FISH.test(candidate.title) && !(wantsMeatFish && thisIsMeatFish)) continue;
            const words = titleWordCount.get(candidate.product_id) ?? 9;
            // The word has to name the product, not describe what it goes with.
            if (!tailWords.get(candidate.product_id)?.has(word)) continue;
            // The plainest product wins: "AH Pasta" over "AH Pasta geraspte kaas".
            // Between equals, the biggest discount wins: "1 + 1 gratis" beats "2% volume voordeel".
            const bestWords = best ? titleWordCount.get(best.product_id) ?? 9 : 99;
            const cut = (row: BonusRow) => {
              const { price, price_before } = row;
              if (price == null || price_before == null || price_before <= 0) return 0;
              return Math.max(0, (price_before - price) / price_before);
            };
            if (!best || words < bestWords || (words === bestWords && cut(candidate) > cut(best))) best = candidate;
          }
        }
        if (best) {
          seen.add(best.product_id);
          hits.push({ ingredient, product: best });
        }
      }
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

    // Most offers end on the same Sunday; some run for months, so only look at the coming weeks.
    const horizon = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateCount = new Map<string, number>();
    for (const row of bonus) {
      if (row.end_date && row.end_date <= horizon) dateCount.set(row.end_date, (dateCount.get(row.end_date) ?? 0) + 1);
    }
    const endDate = [...dateCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return json({ matches, bonusCount: bonus.length, endDate, sample: sampleOffers(bonus) });
  } catch (error) {
    console.error('ah-bonus failed:', error);
    return json({ error: 'Bonus ophalen lukte niet' }, 500);
  }
});
