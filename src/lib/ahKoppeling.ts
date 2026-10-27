import type { GroceryItem } from '@/types';
import type { AhAlternative, AhMatch, ProductStore } from '@/services/ahApi';
import { countParts } from '@/lib/itemCount';
import { zelfdeWinkel, zonderWinkel } from '@/lib/winkels';

/**
 * Jumbo en Dirk koppelen pas als de kolommen product_store en product_url
 * bestaan (migratie 20261024120000_product_store.sql) en ah-products met de
 * store-parameter is uitgerold. Tot dan alleen AH.
 */
export const ANDERE_WINKELS_AAN = true;

/**
 * Prijsvergelijking per lijst (AH, Jumbo, Dirk), als beta: de keuze per winkel
 * is na acht testrondes betrouwbaar, maar nog niet op veel lijsten bekeken.
 */
export const PRIJSVERGELIJK_AAN = true;

export const KOPPELBAAR: readonly ProductStore[] = ANDERE_WINKELS_AAN ? ['AH', 'Jumbo', 'Dirk'] : ['AH'];

/** Waar je een product bekijkt: "Bekijk op jumbo.com". */
export const WINKEL_SITE: Record<ProductStore, string> = { AH: 'ah.nl', Jumbo: 'jumbo.com', Dirk: 'dirk.nl' };

export const ahProductUrl = (productId: number) => `https://www.ah.nl/producten/product/wi${productId}`;

/**
 * De link naar een product. AH en Dirk bouwen we uit het nummer; Jumbo heeft de
 * naam in de link nodig, die bewaren we (product_url).
 */
export const productUrl = (product: { id: number; store?: ProductStore | null; url?: string | null }): string | null => {
  if (product.url) return product.url;
  if (!product.store || product.store === 'AH') return ahProductUrl(product.id);
  if (product.store === 'Dirk') return `https://www.dirk.nl/boodschappen/x/x/x/${product.id}`;
  return null;
};

/** De winkel waar we voor deze regel een product zoeken, of null als dat daar niet kan. */
export const koppelWinkel = (store: string | null | undefined, winkels = KOPPELBAAR): ProductStore | null =>
  winkels.find((w) => zelfdeWinkel(store, w)) ?? null;

/** Bij welke winkel het gekozen product hoort; alles van voor Jumbo en Dirk is AH. */
export const productWinkel = (item: Pick<GroceryItem, 'ahProduct'>): ProductStore | null =>
  item.ahProduct ? item.ahProduct.store ?? 'AH' : null;

/**
 * Wat je bij AH (of Jumbo, Dirk) haalt maar nog geen product heeft: die koppelen
 * we zelf, zodat je de foto, de prijs en de link krijgt. Een regel die al gezocht
 * is (priceCheckedAt) proberen we niet opnieuw, tenzij je de winkel veranderde en
 * het product nog van de oude winkel is.
 */
export const teKoppelen = (items: GroceryItem[], winkels = KOPPELBAAR): GroceryItem[] =>
  items.filter((i) => {
    if (i.checked) return false;
    const winkel = koppelWinkel(i.store, winkels);
    if (!winkel) return false;
    if (i.ahProduct) return productWinkel(i) !== winkel;
    return !i.priceCheckedAt;
  });

/** De zoekvraag: de naam zoals getypt (met merk), zonder aantal en zonder "AH" erachter. */
export const zoekNaam = (item: Pick<GroceryItem, 'name' | 'store'>): string =>
  zonderWinkel(countParts(item.name).rest, item.store);

/** Het beste product als match voor deze regel, met het aantal uit de naam. */
export const alsMatch = (item: Pick<GroceryItem, 'id' | 'name'>, product: AhAlternative, store: ProductStore = 'AH'): AhMatch => {
  const quantity = Math.max(1, countParts(item.name).count);
  return {
    itemId: item.id,
    store,
    productId: product.productId,
    title: product.title,
    unitSize: product.unitSize,
    unitPrice: product.price,
    quantity,
    price: Math.round(product.price * quantity * 100) / 100,
    priceBefore: product.priceBefore != null ? Math.round(product.priceBefore * quantity * 100) / 100 : null,
    isBonus: product.isBonus,
    bonusMechanism: product.bonusMechanism,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl || productUrl({ id: product.productId, store }) || '',
    category: product.category,
  };
};
