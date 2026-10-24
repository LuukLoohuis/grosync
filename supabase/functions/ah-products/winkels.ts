// Product search at supermarkets other than AH. Neither has an API; both render their
// search page on the server and put the results in Nuxt's payload, so we read that.
// Findings and risks: docs/supermarkt-koppeling.md.

export type Store = 'AH' | 'Jumbo' | 'Dirk';

export const STORES: Store[] = ['AH', 'Jumbo', 'Dirk'];

export const storeName: Record<Store, string> = { AH: 'Albert Heijn', Jumbo: 'Jumbo', Dirk: 'Dirk van den Broek' };

/** Same shape as the AH candidates in index.ts, plus the product page. */
export type ShopCandidate = {
  webshopId: number;
  title: string;
  unitSize: string;
  price: number;
  priceBefore: number | null;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  category: string;
  url: string;
};

const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'nl-NL',
};

// Wrappers Nuxt puts around reactive state; the value itself is the next element.
const NUXT_WRAPPERS = new Set(['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'EmptyRef', 'NuxtError', 'Date']);

/**
 * Reads `<script id="__NUXT_DATA__">`: a flat array in devalue format, where every
 * object and array holds indexes into that same array instead of values.
 */
export function nuxtData(html: string): any {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  const flat: unknown[] = JSON.parse(match[1]);
  const done = new Map<number, unknown>();
  const revive = (index: unknown): unknown => {
    if (typeof index !== 'number' || index < 0) return undefined;
    if (done.has(index)) return done.get(index);
    const value = flat[index];
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string' && NUXT_WRAPPERS.has(value[0])) {
        const inner = revive(value[1]);
        done.set(index, inner);
        return inner;
      }
      if (value[0] === 'Set' || value[0] === 'Map') {
        const items = value.slice(1).map(revive);
        done.set(index, items);
        return items;
      }
      const out: unknown[] = [];
      done.set(index, out);
      for (const item of value) out.push(revive(item));
      return out;
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      done.set(index, out);
      for (const [key, item] of Object.entries(value)) out[key] = revive(item);
      return out;
    }
    return value;
  };
  return revive(0);
}

async function page(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: PAGE_HEADERS });
    if (!response.ok) {
      console.error('Store search failed:', url, response.status);
      return null;
    }
    return await response.text();
  } catch (e) {
    console.error('Store search error:', url, e);
    return null;
  }
}

const cents = (value: unknown) => (typeof value === 'number' ? Math.round(value) / 100 : null);

/** "723887PAK" → 723887: the article number, without the packaging code. */
export const jumboNumber = (sku: unknown) => Number(String(sku ?? '').match(/^\d+/)?.[0] ?? NaN);

export function jumboCandidates(products: any[], keep = 10): ShopCandidate[] {
  return (Array.isArray(products) ? products : [])
    .filter((p) => p && !p.sponsored && p.availability?.isAvailable !== false)
    .map((p) => {
      const normal = cents(p.price?.price);
      const promo = cents(p.price?.promoPrice);
      const price = promo ?? normal;
      const tag = p.promotions?.[0]?.tags?.[0]?.text;
      return {
        webshopId: jumboNumber(p.id),
        title: p.title || '',
        unitSize: p.subtitle || '',
        price: price as number,
        priceBefore: promo != null && normal != null && normal > promo ? normal : null,
        isBonus: Boolean(tag) || promo != null,
        bonusMechanism: typeof tag === 'string' ? tag : null,
        imageUrl: p.image || null,
        category: p.category || '',
        url: typeof p.link === 'string' ? `https://www.jumbo.com${p.link}` : '',
      };
    })
    .filter((c) => Number.isFinite(c.webshopId) && typeof c.price === 'number' && c.url)
    .slice(0, keep);
}

export function dirkCandidates(products: any[], keep = 10): ShopCandidate[] {
  return (Array.isArray(products) ? products : [])
    .filter((p) => p && typeof p.productId === 'number')
    .map((p) => {
      const normal = typeof p.price?.normalPrice === 'number' ? p.price.normalPrice : null;
      const price = typeof p.price?.priceToShow === 'number' ? p.price.priceToShow : normal;
      return {
        webshopId: p.productId,
        title: [p.brand && !String(p.headerText || '').startsWith(p.brand) ? p.brand : '', p.headerText || ''].filter(Boolean).join(' '),
        unitSize: p.packaging || '',
        price: price as number,
        priceBefore: p.price?.isOffer && normal != null && price != null && normal > price ? normal : null,
        isBonus: Boolean(p.price?.isOffer),
        bonusMechanism: p.price?.isOffer ? (p.price?.textPriceSign || 'Aanbieding') : null,
        imageUrl: p.image || null,
        category: p.department || '',
        url: `https://www.dirk.nl/boodschappen/x/x/x/${p.productId}`,
      };
    })
    .filter((c) => typeof c.price === 'number')
    .slice(0, keep);
}

export async function searchJumbo(query: string, keep = 10): Promise<ShopCandidate[]> {
  const html = await page(`https://www.jumbo.com/producten/?searchType=keyword&searchTerms=${encodeURIComponent(query)}`);
  if (!html) return [];
  try {
    return jumboCandidates(nuxtData(html)?.pinia?.productStore?.products, keep);
  } catch (e) {
    console.error('Jumbo page changed?', query, e);
    return [];
  }
}

export async function searchDirk(query: string, keep = 10): Promise<ShopCandidate[]> {
  // The term goes in the path; "?query=" shows an empty search page.
  const html = await page(`https://www.dirk.nl/zoeken/producten/${encodeURIComponent(query)}`);
  if (!html) return [];
  try {
    const data = nuxtData(html)?.data ?? {};
    const key = Object.keys(data).find((k) => k.startsWith('search-'));
    return dirkCandidates(key ? data[key] : [], keep);
  } catch (e) {
    console.error('Dirk page changed?', query, e);
    return [];
  }
}
