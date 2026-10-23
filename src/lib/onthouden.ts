import { countParts } from '@/lib/itemCount';

/** Wat jullie bij een product kozen: waar je het haalt en welke precies. */
export interface Herinnering {
  store: string | null;
  note: string | null;
  photo: string | null;
}

/** "2 Shampoo" en "shampoo" zijn hetzelfde product. */
export const sleutelVan = (naam: string) => countParts(naam).rest.trim().toLocaleLowerCase('nl').slice(0, 80);

export const isLeeg = (h: Herinnering) => !h.store && !h.note && !h.photo;
