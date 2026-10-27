import { searchDirk, searchJumbo, STORES, storeName, type Store } from './winkels.ts';
import { eenheidsprijsVan, kiesGoedkoopste, totalen, vasteWeglaat, deeltWoord, type Keuze } from './vergelijk.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// AH has no public API; this is the anonymous flow of its own app.
const AH_HEADERS = { 'User-Agent': 'Appie/8.22.3', 'x-application': 'AHWEBSHOP', 'Content-Type': 'application/json' };
const MAX_ITEMS = 40;
// Comparing searches every line at all three stores; Jumbo and Dirk take 2.5–4.5 s a search.
const MAX_COMPARE_ITEMS = 25;
// One filter call per line and store: up to 75 small calls, ten at a time per store.
const FILTER_CONCURRENCY = 10;
const SEARCH_CONCURRENCY = 5;

type Item = { id: string; name: string };

type SearchTerm = { query: string; amount: string; fallback: string };

type Candidate = {
  webshopId: number;
  title: string;
  unitSize: string;
  price: number;
  /** Prijs zonder bonus, alleen als die hoger is dan wat je nu betaalt. */
  priceBefore: number | null;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  category: string;
  /** The product page at the store. */
  url: string;
};

type Match = {
  itemId: string;
  productId: number;
  title: string;
  unitSize: string;
  unitPrice: number;
  quantity: number;
  price: number;
  priceBefore: number | null;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  productUrl: string;
  category: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

// Only signed-in users (guests included) may use this, otherwise the public key
// turns it into a free AH proxy running on our OpenAI account.
async function signedInUser(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id } : null;
}

type Quota = { allowed: boolean; used: number; quota: number; plus: boolean };

const rpc = (fn: string, args: unknown) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

/** Counts this use and says whether it was within the monthly allowance. */
async function consumeAi(userId: string, feature: string, limit: number): Promise<Quota> {
  const response = await rpc('consume_ai', { _user: userId, _feature: feature, _limit: limit });
  if (!response.ok) {
    console.error('consume_ai failed:', response.status, (await response.text()).slice(0, 200));
    // A broken meter must not lock people out of what they paid for.
    return { allowed: true, used: 0, quota: limit, plus: false };
  }
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { allowed: row?.allowed !== false, used: row?.used ?? 0, quota: row?.quota ?? limit, plus: row?.plus === true };
}

/** Gives the use back when the work itself failed; with three a month every one counts. */
async function releaseAi(userId: string, feature: string) {
  const response = await rpc('release_ai', { _user: userId, _feature: feature }).catch(() => null);
  if (!response?.ok) console.error('release_ai failed:', response?.status);
}

/** Free gets three a month of each thing that costs real money, per household; Plus gets everything. */
const FREE_LIMIT = 3;

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

function toCandidates(products: any[], keep = 10): Candidate[] {
  return products
    .filter((p) => !p.isSponsored && p.isOrderable)
    .map((p) => ({
      webshopId: p.webshopId,
      title: p.title || '',
      unitSize: p.salesUnitSize || '',
      price: p.currentPrice ?? p.priceBeforeBonus,
      // Wat het zonder bonus zou kosten; alleen ingevuld als dat echt hoger ligt.
      priceBefore: typeof p.priceBeforeBonus === 'number' && p.priceBeforeBonus > (p.currentPrice ?? p.priceBeforeBonus)
        ? p.priceBeforeBonus
        : null,
      isBonus: Boolean(p.isBonus),
      bonusMechanism: p.bonusMechanism || null,
      imageUrl: p.images?.[0]?.url || null,
      category: p.mainCategory || '',
      url: `https://www.ah.nl/producten/product/wi${p.webshopId}`,
    }))
    .filter((c) => typeof c.webshopId === 'number' && typeof c.price === 'number')
    .slice(0, keep);
}

async function searchAh(query: string, size = 15, keep = 10): Promise<Candidate[]> {
  const params = new URLSearchParams({ query, size: String(size), page: '0', sortOn: 'RELEVANCE' });
  const search = async () => fetch(`https://api.ah.nl/mobile-services/product/search/v2?${params}`, {
    headers: { ...AH_HEADERS, Authorization: `Bearer ${await ahToken()}` },
  });
  try {
    let response = await search();
    if (response.status === 401) {
      cachedToken = null;
      response = await search();
    }
    if (!response.ok) {
      console.error('AH search failed:', query, response.status);
      return [];
    }
    return toCandidates((await response.json()).products || [], keep);
  } catch (e) {
    console.error('AH search error:', query, e);
    return [];
  }
}

// The same search at another chain; see winkels.ts.
function searchStore(store: Store, query: string, size = 15, keep = 10): Promise<Candidate[]> {
  if (store === 'Jumbo') return searchJumbo(query, keep);
  if (store === 'Dirk') return searchDirk(query, keep);
  return searchAh(query, size, keep);
}

// Asked only when the store found nothing and the batch gave no second wording.
async function ahWording(query: string, store: Store = 'AH'): Promise<string> {
  const result = await askJson(
    `${storeName[store]}'s product search found nothing for this Dutch search. Give the word(s) a Dutch supermarket itself uses on such products, different from the search (e.g. "keukenrol" → "keukenpapier", "wc-papier" → "toiletpapier"). Return JSON {"query":"..."}, with "" if you know no other wording.`,
    JSON.stringify({ search: query }),
  );
  return typeof result.query === 'string' ? result.query.trim() : '';
}

// AH's search finds nothing for some everyday words ("keukenrol"). Then the second wording
// from the batch gets a turn, and if that is missing or empty too, a wording asked for
// this one line. The same search never runs twice.
async function searchWithFallback(
  term: SearchTerm | undefined,
  size?: number,
  keep?: number,
  store: Store = 'AH',
): Promise<{ candidates: Candidate[]; searchedAs: string }> {
  if (!term) return { candidates: [], searchedAs: '' };
  const tried = new Set<string>();
  const attempt = async (query: string): Promise<Candidate[]> => {
    const key = query.trim().toLowerCase();
    if (!key || tried.has(key)) return [];
    tried.add(key);
    return searchStore(store, query.trim(), size, keep);
  };
  const first = await attempt(term.query);
  if (first.length > 0) return { candidates: first, searchedAs: term.query };
  const second = await attempt(term.fallback);
  if (second.length > 0) return { candidates: second, searchedAs: term.fallback };
  const wording = await ahWording(term.query, store).catch(() => '');
  return { candidates: await attempt(wording), searchedAs: wording };
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

async function askJson(system: string, user: string): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  return JSON.parse((await response.json()).choices?.[0]?.message?.content || '{}');
}

async function searchTerms(items: Item[]): Promise<Map<string, SearchTerm>> {
  const result = await askJson(
    'You turn grocery list lines into Albert Heijn (Dutch supermarket) searches. For each line give "query": the Dutch word(s) a shopper types to find the plain base product, without brand, quantity or preparation, but keeping words that make it a different product, such as diepvries, gerookt, halfvolle or volkoren (e.g. "ca. 300g bread flour" → "tarwebloem", "2 large eggs" → "scharreleieren", "parmesan" → "parmigiano reggiano", "1 clove garlic, grated" → "knoflook", "diepvries spinazie" → "diepvries spinazie"), and "amount": the needed quantity as written, or "" if none, and "fallback": a second search in the words AH itself uses on its products, for when the first search finds nothing (e.g. "keukenrol" → "keukenpapier", "wc-papier" → "toiletpapier"), or "" when the query already is that wording. Return JSON {"items":[{"id":"...","query":"...","amount":"...","fallback":"..."}]} with every id.',
    JSON.stringify(items.map(({ id, name }) => ({ id, line: name }))),
  );
  const terms = new Map<string, SearchTerm>();
  for (const entry of result.items || []) {
    if (typeof entry?.id === 'string' && typeof entry?.query === 'string' && entry.query.trim()) {
      terms.set(entry.id, {
        query: entry.query.trim(),
        amount: String(entry.amount || ''),
        fallback: typeof entry.fallback === 'string' ? entry.fallback.trim() : '',
      });
    }
  }
  return terms;
}

// "3-pack" in an AH title means several packages sold as one, rarely what a list line means.
const isMultipack = (candidate: Candidate) => /\b\d+\s*-?\s*pack\b|multipack/i.test(candidate.title);

async function chooseProducts(
  lines: { id: string; name: string; amount: string; searchedAs: string; candidates: Candidate[] }[],
): Promise<Map<string, { index: number; quantity: number }>> {
  const result = await askJson(
    'For each ingredient pick the one Albert Heijn product a home cook would buy for it. Respect what the line says about the product itself: "diepvries" or "frozen" means a frozen product (and without it prefer fresh), "gerookt" means smoked. Avoid candidates marked multipack unless the amount needs that many. The candidates come from an AH search ("search") that may use the name AH itself gives the same thing, such as keukenpapier for keukenrol or toiletpapier for wc-papier; such a product still is that ingredient. Prefer the plain product over snacks, ready meals, flavoured variants and multipacks; prefer the AH house brand when products are otherwise equal; pick the smallest package that covers the amount. "quantity" is the number of packages needed (1 when the amount is unknown or small). Use index -1 when no candidate is that ingredient. Return JSON {"choices":[{"id":"...","index":0,"quantity":1}]}.',
    JSON.stringify(lines.map((line) => ({
      id: line.id,
      ingredient: line.name,
      amount: line.amount,
      search: line.searchedAs,
      candidates: line.candidates.map((c, index) => ({ index, title: c.title, size: c.unitSize, price: c.price, category: c.category, multipack: isMultipack(c) })),
    }))),
  );
  const choices = new Map<string, { index: number; quantity: number }>();
  for (const choice of result.choices || []) {
    if (typeof choice?.id !== 'string' || !Number.isInteger(choice.index)) continue;
    const quantity = Math.min(Math.max(Math.round(Number(choice.quantity) || 1), 1), 20);
    choices.set(choice.id, { index: choice.index, quantity });
  }
  return choices;
}

// For the price comparison: which candidates are NOT this ingredient. Fixed words
// (vasteWeglaat) and products sharing no word with the line (deeltWoord) went out
// before this; the model only names what else must go and everything it does not
// name stays, because a forgotten plain product made a dearer one win. The cheapest of what is left is picked in code (kiesGoedkoopste).
async function notIngredient(
  line: { name: string; searchedAs: string; candidates: Candidate[] },
  store: Store,
): Promise<Set<number>> {
  const result = await askJson(
    `A shopper compares what the same grocery list costs at different supermarkets. These ${storeName[store]} candidates came from a search ("search") for one grocery list line. Name the candidates that are NOT that ingredient as an ordinary everyday product: products that merely contain it or share a word with it (dishes, salads, snacks, sauces, spreads, drinks, sandwiches), plant-based or vegan substitutes for an animal product, prepared or flavoured variants, and for bread rolls (broodjes), baguettes and specialty loaves. Brands, house brands and sizes do not matter, and the search may use the store's own word for the same thing. When in doubt, do not name it. Return JSON {"drop":[...]} with candidate indexes, empty when all are fine.`,
    JSON.stringify({
      ingredient: line.name,
      search: line.searchedAs,
      candidates: line.candidates.map((c, index) => ({ index, title: c.title, size: c.unitSize || null, category: c.category })),
    }),
  );
  return new Set(Array.isArray(result.drop) ? result.drop.filter((index: unknown) => Number.isInteger(index)) : []);
}

// Keeps the candidates that are the ingredient itself, best fit first, so "eieren"
// offers egg packs instead of egg salad, eierkoeken or yoghurt.
async function sameIngredient(line: string, candidates: Candidate[], store: Store = 'AH'): Promise<Candidate[]> {
  if (candidates.length === 0) return [];
  const result = await askJson(
    `A shopper wants a different ${storeName[store]} product for one grocery list line. From the candidates keep only products that ARE that ingredient: other brands, sizes, organic or free-range variants are fine. Drop dishes, salads, snacks, baked goods, spreads, drinks and other products that merely contain it or share a word with it. When the line has a note in parentheses (a brand or a description such as "Optimel, de blauwe"), put the products that match that note first. Otherwise order the kept ones for a home cook: the plain everyday version in a normal household size first, then other sizes, brands and organic or premium variants, and multipacks last. Return JSON {"indexes":[...]}.`,
    JSON.stringify({ line, candidates: candidates.map((c, index) => ({ index, title: c.title, size: c.unitSize, category: c.category })) }),
  );
  const kept: Candidate[] = [];
  for (const index of Array.isArray(result.indexes) ? result.indexes : []) {
    const candidate = Number.isInteger(index) ? candidates[index] : undefined;
    if (candidate && !kept.includes(candidate)) kept.push(candidate);
  }
  // The model does not reliably put multipacks last, so do it here.
  return [...kept.filter((c) => !isMultipack(c)), ...kept.filter(isMultipack)];
}

function toMatch(itemId: string, candidate: Candidate, quantity: number): Match {
  return {
    itemId,
    productId: candidate.webshopId,
    title: candidate.title,
    unitSize: candidate.unitSize,
    unitPrice: candidate.price,
    quantity,
    price: Math.round(candidate.price * quantity * 100) / 100,
    priceBefore: candidate.priceBefore != null
      ? Math.round(candidate.priceBefore * quantity * 100) / 100
      : null,
    isBonus: candidate.isBonus,
    bonusMechanism: candidate.bonusMechanism,
    imageUrl: candidate.imageUrl,
    productUrl: candidate.url,
    category: candidate.category,
  };
}

function toAlternative(candidate: Candidate) {
  return {
    productId: candidate.webshopId,
    title: candidate.title,
    unitSize: candidate.unitSize,
    price: candidate.price,
    priceBefore: candidate.priceBefore,
    isBonus: candidate.isBonus,
    bonusMechanism: candidate.bonusMechanism,
    imageUrl: candidate.imageUrl,
    category: candidate.category,
    productUrl: candidate.url,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Set once a fill of the basket has been counted, so a failure can give it back.
  let counted: { userId: string; plus: boolean } | null = null;

  try {
    const user = await signedInUser(req);
    if (!user) return json({ error: 'Sign in required' }, 401);

    const body = await req.json();

    // Other products from the same search, for "Kies een ander product" and the
    // automatic match. AH unless the app asks for another store.
    if (body?.alternativesFor) {
      const item = body.alternativesFor;
      if (typeof item?.id !== 'string' || typeof item?.name !== 'string' || !item.name.trim()) {
        return json({ error: 'alternativesFor needs id and name' }, 400);
      }
      const store: Store = body.store ?? 'AH';
      if (!STORES.includes(store)) return json({ error: `store must be one of ${STORES.join(', ')}` }, 400);
      const exclude = Number(body.exclude) || null;
      // "Dit merk" uit de app ("Optimel, de blauwe"). De gewone zoekterm laat
      // het merk weg, dus zoek ook op wat de notitie zelf noemt.
      const note = typeof item.note === 'string' ? item.note.trim().slice(0, 120) : '';
      const terms = await searchTerms([{ id: item.id, name: item.name }]);
      const term = terms.get(item.id);
      const query = term?.query || '';
      const [{ candidates }, byNote] = await Promise.all([
        searchWithFallback(term, 30, 20, store),
        note ? searchStore(store, note.split(',')[0].trim() || note, 15, 10) : Promise.resolve([] as Candidate[]),
      ]);
      const merged = [...byNote, ...candidates.filter((c) => !byNote.some((n) => n.webshopId === c.webshopId))];
      const fitting = await sameIngredient(note ? `${item.name} (${note})` : item.name, merged.filter((c) => c.webshopId !== exclude), store);
      const alternatives = fitting.slice(0, 5).map(toAlternative);
      return json({ store, query, alternatives });
    }

    // What the same list costs at AH, Jumbo and Dirk. Counts as one basket fill.
    if (body?.compare) {
      const list: Item[] = (Array.isArray(body.compare) ? body.compare : [])
        .filter((item: any) => typeof item?.id === 'string' && typeof item?.name === 'string' && item.name.trim())
        .slice(0, MAX_COMPARE_ITEMS);
      if (list.length === 0) return json({ error: 'compare needs items' }, 400);

      const quota = await consumeAi(user.id, 'mandje', FREE_LIMIT);
      if (!quota.allowed) {
        return json({ error: 'limiet', feature: 'mandje', used: quota.used, quota: quota.quota }, 402);
      }
      counted = { userId: user.id, plus: quota.plus };

      const terms = await searchTerms(list);
      const perStore = await Promise.all(STORES.map(async (store) => {
        const lines = await mapWithConcurrency(list, SEARCH_CONCURRENCY, async (item) => {
          const term = terms.get(item.id);
          const { candidates: found, searchedAs } = await searchWithFallback(term, 30, 20, store);
          const singles = found.filter((c) => !isMultipack(c));
          // Wider than the basket: the house brand often sits below the brands in the search.
          const candidates = (singles.length > 0 ? singles : found).slice(0, 20);
          return { id: item.id, name: item.name, searchedAs, candidates };
        });
        const searchable = lines
          .map((line) => ({
            ...line,
            candidates: line.candidates.filter((c) => !vasteWeglaat(line.name, c.title) && deeltWoord(line.name, line.searchedAs, c.title)),
          }))
          .filter((line) => line.candidates.length > 0);
        const drops = await mapWithConcurrency(searchable, FILTER_CONCURRENCY, (line) =>
          notIngredient(line, store).catch((e) => {
            console.error('Filter failed:', store, line.name, e);
            return null;
          }));
        const keuzes: Keuze[] = [];
        for (const [n, line] of searchable.entries()) {
          const drop = drops[n];
          const kept = drop ? line.candidates.filter((_, index) => !drop.has(index)) : [];
          // A search for "volkoren brood" always finds bread: when the model drops
          // everything or fails, the fixed words alone decide.
          const candidate = kiesGoedkoopste(kept.length > 0 ? kept : line.candidates);
          if (!candidate) continue;
          // One package: the comparison is per same amount anyway (gelijkeHoeveelheid).
          const match = toMatch(line.id, candidate, 1);
          keuzes.push({
            itemId: line.id,
            store,
            title: match.title,
            unitSize: match.unitSize,
            unitPrice: match.unitPrice,
            quantity: match.quantity,
            price: match.price,
            priceBefore: match.priceBefore,
            isBonus: match.isBonus,
            bonusMechanism: match.bonusMechanism,
            imageUrl: match.imageUrl,
            productUrl: match.productUrl,
            perEenheid: eenheidsprijsVan(candidate),
          });
        }
        return keuzes;
      }));

      const keuzes = perStore.flat();
      console.log('Compare:', list.length, 'items,', STORES.map((s, i) => `${s} ${perStore[i].length}`).join(', '));
      if (keuzes.length === 0 && !quota.plus) await releaseAi(user.id, 'mandje');
      return json({ items: list.map((item) => item.id), stores: totalen(list.map((item) => item.id), keuzes, STORES), keuzes });
    }

    const { items } = body;
    const list: Item[] = (Array.isArray(items) ? items : [])
      .filter((item: any) => typeof item?.id === 'string' && typeof item?.name === 'string' && item.name.trim())
      .slice(0, MAX_ITEMS);
    if (list.length === 0) return json({ error: 'items is required' }, 400);

    // Filling the basket counts; picking another product for one line does not.
    const quota = await consumeAi(user.id, 'mandje', FREE_LIMIT);
    if (!quota.allowed) {
      return json({ error: 'limiet', feature: 'mandje', used: quota.used, quota: quota.quota }, 402);
    }
    counted = { userId: user.id, plus: quota.plus };

    const terms = await searchTerms(list);
    const lines = await mapWithConcurrency(list, SEARCH_CONCURRENCY, async (item) => {
      const term = terms.get(item.id);
      // Search wide: for "eieren" AH lists egg salads and multipacks before the plain boxes.
      const { candidates: found, searchedAs } = await searchWithFallback(term, 30, 30);
      // The model kept picking "3-pack" boxes of eggs; offer single packages whenever AH has them.
      const singles = found.filter((c) => !isMultipack(c));
      const candidates = (singles.length > 0 ? singles : found).slice(0, 12);
      return { id: item.id, name: item.name, amount: term?.amount || '', query: term?.query || '', searchedAs, candidates };
    });

    const searchable = lines.filter((line) => line.candidates.length > 0);
    const choices = searchable.length ? await chooseProducts(searchable) : new Map();

    const matches: Match[] = [];
    for (const line of searchable) {
      const choice = choices.get(line.id);
      const candidate = choice && choice.index >= 0 ? line.candidates[choice.index] : undefined;
      if (candidate) matches.push(toMatch(line.id, candidate, choice.quantity));
    }

    const matched = new Set(matches.map((m) => m.itemId));
    console.log('AH matches:', matches.length, 'of', list.length);
    // Nothing found means nothing went in the basket; that fill does not count.
    if (matches.length === 0 && !quota.plus) await releaseAi(user.id, 'mandje');
    return json({ matches, unmatched: list.filter((item) => !matched.has(item.id)).map((item) => item.id) });
  } catch (error) {
    console.error('ah-products failed:', error);
    if (counted && !counted.plus) await releaseAi(counted.userId, 'mandje');
    return json({ error: 'Failed to match AH products' }, 500);
  }
});
