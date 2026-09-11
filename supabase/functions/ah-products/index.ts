const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// AH has no public API; this is the anonymous flow of its own app.
const AH_HEADERS = { 'User-Agent': 'Appie/8.22.3', 'x-application': 'AHWEBSHOP', 'Content-Type': 'application/json' };
const MAX_ITEMS = 40;
const SEARCH_CONCURRENCY = 5;

type Item = { id: string; name: string };

type SearchTerm = { query: string; amount: string; fallback: string };

type Candidate = {
  webshopId: number;
  title: string;
  unitSize: string;
  price: number;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  category: string;
};

type Match = {
  itemId: string;
  productId: number;
  title: string;
  unitSize: string;
  unitPrice: number;
  quantity: number;
  price: number;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  productUrl: string;
  category: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Only signed-in users (guests included) may use this, otherwise the public key
// turns it into a free AH proxy running on our OpenAI account.
async function isSignedIn(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!token || !url || !anonKey) return false;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
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

function toCandidates(products: any[], keep = 10): Candidate[] {
  return products
    .filter((p) => !p.isSponsored && p.isOrderable)
    .map((p) => ({
      webshopId: p.webshopId,
      title: p.title || '',
      unitSize: p.salesUnitSize || '',
      price: p.currentPrice ?? p.priceBeforeBonus,
      isBonus: Boolean(p.isBonus),
      bonusMechanism: p.bonusMechanism || null,
      imageUrl: p.images?.[0]?.url || null,
      category: p.mainCategory || '',
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

// AH's search finds nothing for some everyday words ("keukenrol"), so the second wording gets a turn.
async function searchWithFallback(term: SearchTerm | undefined, size?: number, keep?: number): Promise<Candidate[]> {
  if (!term) return [];
  const first = await searchAh(term.query, size, keep);
  if (first.length > 0 || !term.fallback || term.fallback === term.query) return first;
  return searchAh(term.fallback, size, keep);
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
  lines: { id: string; name: string; amount: string; candidates: Candidate[] }[],
): Promise<Map<string, { index: number; quantity: number }>> {
  const result = await askJson(
    'For each ingredient pick the one Albert Heijn product a home cook would buy for it. Respect what the line says about the product itself: "diepvries" or "frozen" means a frozen product (and without it prefer fresh), "gerookt" means smoked. Avoid candidates marked multipack unless the amount needs that many. Prefer the plain product over snacks, ready meals, flavoured variants and multipacks; prefer the AH house brand when products are otherwise equal; pick the smallest package that covers the amount. "quantity" is the number of packages needed (1 when the amount is unknown or small). Use index -1 when no candidate is that ingredient. Return JSON {"choices":[{"id":"...","index":0,"quantity":1}]}.',
    JSON.stringify(lines.map((line) => ({
      id: line.id,
      ingredient: line.name,
      amount: line.amount,
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

// Keeps the candidates that are the ingredient itself, best fit first, so "eieren"
// offers egg packs instead of egg salad, eierkoeken or yoghurt.
async function sameIngredient(line: string, candidates: Candidate[]): Promise<Candidate[]> {
  if (candidates.length === 0) return [];
  const result = await askJson(
    'A shopper wants a different Albert Heijn product for one grocery list line. From the candidates keep only products that ARE that ingredient: other brands, sizes, organic or free-range variants are fine. Drop dishes, salads, snacks, baked goods, spreads, drinks and other products that merely contain it or share a word with it. Order the kept ones for a home cook: the plain everyday version in a normal household size first, then other sizes, brands and organic or premium variants, and multipacks last. Return JSON {"indexes":[...]}.',
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
    isBonus: candidate.isBonus,
    bonusMechanism: candidate.bonusMechanism,
    imageUrl: candidate.imageUrl,
    productUrl: `https://www.ah.nl/producten/product/wi${candidate.webshopId}`,
    category: candidate.category,
  };
}

function toAlternative(candidate: Candidate) {
  return {
    productId: candidate.webshopId,
    title: candidate.title,
    unitSize: candidate.unitSize,
    price: candidate.price,
    isBonus: candidate.isBonus,
    bonusMechanism: candidate.bonusMechanism,
    imageUrl: candidate.imageUrl,
    category: candidate.category,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!(await isSignedIn(req))) return json({ error: 'Sign in required' }, 401);

    const body = await req.json();

    // Other products from the same AH search, for "Kies een ander product".
    if (body?.alternativesFor) {
      const item = body.alternativesFor;
      if (typeof item?.id !== 'string' || typeof item?.name !== 'string' || !item.name.trim()) {
        return json({ error: 'alternativesFor needs id and name' }, 400);
      }
      const exclude = Number(body.exclude) || null;
      const terms = await searchTerms([{ id: item.id, name: item.name }]);
      const term = terms.get(item.id);
      const query = term?.query || '';
      const candidates = await searchWithFallback(term, 30, 20);
      const fitting = await sameIngredient(item.name, candidates.filter((c) => c.webshopId !== exclude));
      const alternatives = fitting.slice(0, 5).map(toAlternative);
      return json({ query, alternatives });
    }

    const { items } = body;
    const list: Item[] = (Array.isArray(items) ? items : [])
      .filter((item: any) => typeof item?.id === 'string' && typeof item?.name === 'string' && item.name.trim())
      .slice(0, MAX_ITEMS);
    if (list.length === 0) return json({ error: 'items is required' }, 400);

    const terms = await searchTerms(list);
    const lines = await mapWithConcurrency(list, SEARCH_CONCURRENCY, async (item) => {
      const term = terms.get(item.id);
      const found = await searchWithFallback(term);
      // The model kept picking "3-pack" boxes of eggs; offer single packages whenever AH has them.
      const singles = found.filter((c) => !isMultipack(c));
      const candidates = singles.length > 0 ? singles : found;
      return { id: item.id, name: item.name, amount: term?.amount || '', query: term?.query || '', candidates };
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
    return json({ matches, unmatched: list.filter((item) => !matched.has(item.id)).map((item) => item.id) });
  } catch (error) {
    console.error('ah-products failed:', error);
    return json({ error: 'Failed to match AH products' }, 500);
  }
});
