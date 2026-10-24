import { useEffect, useRef, useState } from 'react';
import type { GroceryItem } from '@/types';
import { fetchAhAlternatives, type AhMatch } from '@/services/ahApi';
import { alsMatch, teKoppelen, zoekNaam } from '@/lib/ahKoppeling';

/**
 * Koppelt boodschappen met winkel AH vanzelf aan een AH-product, één tegelijk
 * op de achtergrond. Kiezen telt niet mee voor de gratis karretjes; het is
 * dezelfde zoekopdracht als "Kies een ander product".
 */
export const useAhKoppeling = (
  items: GroceryItem[],
  applyAhMatches: (matches: AhMatch[], unmatchedIds?: string[]) => Promise<void>,
) => {
  // Per sessie één poging per regel, ook als het netwerk faalde.
  const geprobeerd = useRef(new Set<string>());
  const bezig = useRef(false);
  // Na elke poging weer kijken, ook als de lijst zelf niet veranderde (mislukt).
  const [beurt, setBeurt] = useState(0);

  useEffect(() => {
    if (bezig.current) return;
    const item = teKoppelen(items).find((i) => !geprobeerd.current.has(i.id));
    if (!item) return;
    geprobeerd.current.add(item.id);
    bezig.current = true;
    const naam = zoekNaam(item);
    // De naam ook als "merk": zo zoekt AH op wat je precies typte ("Mutti passata").
    fetchAhAlternatives({ id: item.id, name: naam, note: item.note || naam })
      .then((producten) => (producten[0] ? applyAhMatches([alsMatch(item, producten[0])]) : applyAhMatches([], [item.id])))
      .catch((e) => console.warn('AH-koppeling mislukt:', e))
      .finally(() => {
        bezig.current = false;
        setBeurt((n) => n + 1);
      });
  }, [items, applyAhMatches, beurt]);
};
