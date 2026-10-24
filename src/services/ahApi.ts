import { supabase } from '@/integrations/supabase/client';
import { callFunction } from '@/services/functions';

/** Winkels waar de edge function producten kan zoeken; zie docs/supermarkt-koppeling.md. */
export type ProductStore = 'AH' | 'Jumbo' | 'Dirk';

export interface AhMatch {
  itemId: string;
  /** Waar dit product vandaan komt; leeg is AH. */
  store?: ProductStore;
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
}

export interface AhAlternative {
  productId: number;
  title: string;
  unitSize: string;
  price: number;
  priceBefore: number | null;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  category: string;
  /** De productpagina bij de winkel; oude versies van de functie gaven die niet. */
  productUrl?: string;
}

// The edge function accepts at most this many items per call.
export const AH_MAX_ITEMS = 40;

// Filling the basket counts against the monthly allowance; a 402 becomes a QuotaError.
export function matchAhProducts(items: { id: string; name: string }[]) {
  return callFunction<{ matches: AhMatch[]; unmatched: string[] }>('ah-products', { items });
}

// Other products from the same search at this store, without the one already chosen.
export async function fetchAlternatives(
  store: ProductStore,
  item: { id: string; name: string; note?: string | null },
  currentProductId?: number,
) {
  const { data, error } = await supabase.functions.invoke('ah-products', {
    // Zonder store zoekt de functie bij AH; zo blijft een oude functie werken voor AH.
    body: { alternativesFor: item, exclude: currentProductId, ...(store === 'AH' ? {} : { store }) },
  });
  if (error) throw error;
  return (data?.alternatives ?? []) as AhAlternative[];
}

export const fetchAhAlternatives = (item: { id: string; name: string; note?: string | null }, currentProductId?: number) =>
  fetchAlternatives('AH', item, currentProductId);


// AH's own add-multiple page puts every product in the basket once you are signed in on ah.nl.
export function ahBasketUrl(products: { id: number; quantity: number }[]) {
  const params = products.map((p) => `p=${p.id}:${Math.min(Math.max(p.quantity, 1), 99)}`).join('&');
  return `https://www.ah.nl/mijnlijst/add-multiple?${params}`;
}
