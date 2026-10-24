import type { GroceryItem } from '@/types';
import type { AhAlternative, AhMatch } from '@/services/ahApi';
import { ahProductUrl } from '@/services/ahApi';
import { countParts } from '@/lib/itemCount';
import { zelfdeWinkel, zonderWinkel } from '@/lib/winkels';

/**
 * Wat je bij AH haalt maar nog geen AH-product heeft: die koppelen we zelf,
 * zodat je de foto, de prijs en de link naar ah.nl krijgt. Een regel die al
 * gezocht is (priceCheckedAt) proberen we niet opnieuw.
 */
export const teKoppelen = (items: GroceryItem[]): GroceryItem[] =>
  items.filter((i) => !i.checked && !i.ahProduct && !i.priceCheckedAt && zelfdeWinkel(i.store, 'AH'));

/** De zoekvraag: de naam zoals getypt (met merk), zonder aantal en zonder "AH" erachter. */
export const zoekNaam = (item: Pick<GroceryItem, 'name' | 'store'>): string =>
  zonderWinkel(countParts(item.name).rest, item.store);

/** Het beste AH-product als match voor deze regel, met het aantal uit de naam. */
export const alsMatch = (item: Pick<GroceryItem, 'id' | 'name'>, product: AhAlternative): AhMatch => {
  const quantity = Math.max(1, countParts(item.name).count);
  return {
    itemId: item.id,
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
    productUrl: ahProductUrl(product.productId),
    category: product.category,
  };
};
