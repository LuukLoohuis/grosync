import type { GroceryItem } from '@/types';

/** Wat je in de winkel moet zien: je eigen foto, anders het plaatje van het gekozen AH-product. */
export const itemThumb = (item: Pick<GroceryItem, 'photo' | 'ahProduct'>): string | null =>
  item.photo || item.ahProduct?.imageUrl || null;
