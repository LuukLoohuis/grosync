import { supabase } from '@/integrations/supabase/client';

export interface AhMatch {
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
}

// The edge function accepts at most this many items per call.
export const AH_MAX_ITEMS = 40;

export async function matchAhProducts(items: { id: string; name: string }[]) {
  const { data, error } = await supabase.functions.invoke('ah-products', { body: { items } });
  if (error) throw error;
  return data as { matches: AhMatch[]; unmatched: string[] };
}

// Other products from the same AH search, without the one already chosen.
export async function fetchAhAlternatives(item: { id: string; name: string }, currentProductId?: number) {
  const { data, error } = await supabase.functions.invoke('ah-products', {
    body: { alternativesFor: item, exclude: currentProductId },
  });
  if (error) throw error;
  return (data?.alternatives ?? []) as AhAlternative[];
}

export const ahProductUrl = (productId: number) => `https://www.ah.nl/producten/product/wi${productId}`;

// AH's own add-multiple page puts every product in the basket once you are signed in on ah.nl.
export function ahBasketUrl(products: { id: number; quantity: number }[]) {
  const params = products.map((p) => `p=${p.id}:${Math.min(Math.max(p.quantity, 1), 99)}`).join('&');
  return `https://www.ah.nl/mijnlijst/add-multiple?${params}`;
}
