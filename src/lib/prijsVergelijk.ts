import type { VergelijkKeuze, WinkelTotaal } from '@/services/ahApi';

/** Hoeveel duurder dan de goedkoopste, per winkel; 0 voor de goedkoopste zelf. */
export const meerDanGoedkoopste = (stores: WinkelTotaal[]): Map<WinkelTotaal['store'], number> => {
  const laagste = Math.min(...stores.map((s) => s.eerlijkTotaal));
  return new Map(stores.map((s) => [s.store, Math.round((s.eerlijkTotaal - laagste) * 100) / 100]));
};

/**
 * Wat de goedkoopste scheelt met de duurste, of null als er niets te vergelijken
 * valt: geen regel die elke winkel heeft, of geen verschil van een cent.
 */
export const besparing = (stores: WinkelTotaal[]): { store: WinkelTotaal['store']; bedrag: number; tegen: WinkelTotaal['store'] } | null => {
  if (stores.length < 2) return null;
  const goedkoopst = stores[0];
  const duurst = stores[stores.length - 1];
  const bedrag = Math.round((duurst.eerlijkTotaal - goedkoopst.eerlijkTotaal) * 100) / 100;
  if (goedkoopst.eerlijkTotaal <= 0 || bedrag < 0.01) return null;
  return { store: goedkoopst.store, bedrag, tegen: duurst.store };
};

/** Hoeveel regels elke winkel heeft, en dus in het eerlijke totaal zitten. */
export const overalGevonden = (items: string[], stores: WinkelTotaal[]): number =>
  items.filter((id) => stores.every((s) => !s.ontbreekt.includes(id))).length;

/** De keuzes van één winkel in de volgorde van de lijst. */
export const keuzesVan = (store: WinkelTotaal['store'], items: string[], keuzes: VergelijkKeuze[]): VergelijkKeuze[] => {
  const bij = new Map(keuzes.filter((k) => k.store === store).map((k) => [k.itemId, k]));
  return items.flatMap((id) => (bij.has(id) ? [bij.get(id)!] : []));
};
