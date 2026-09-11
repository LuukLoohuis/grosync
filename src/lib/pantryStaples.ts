export const DEFAULT_PANTRY_STAPLES = ['zout', 'peper', 'olijfolie', 'zonnebloemolie', 'suiker', 'bloem', 'water'];

// "rode peper" and friends are fresh chillies, not pepper from the mill.
const FRESH_PEPPER = /(rode|groene|gele|spaanse|verse)\s+pepers?\b/i;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the ingredient names a staple as a whole word: "snufje zout", but not "zoute boter" or "bloemkool". */
export function isPantryStaple(ingredient: string, staples: string[]): boolean {
  const text = ingredient.toLowerCase();
  return staples.some((staple) => {
    const word = staple.trim().toLowerCase();
    if (!word) return false;
    if (word === 'peper' && FRESH_PEPPER.test(text)) return false;
    return new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'u').test(text);
  });
}
