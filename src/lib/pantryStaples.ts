export const DEFAULT_PANTRY_STAPLES = ['zout', 'peper', 'olijfolie', 'zonnebloemolie', 'suiker', 'bloem', 'water'];

/**
 * Other words for the same staple, so an English recipe ("1 tsp salt") also counts as
 * something you already have. Only for the default staples; a staple you add yourself
 * is matched on the word you typed.
 */
const SYNONYMS: Record<string, string[]> = {
  zout: ['salt', 'zeezout', 'keukenzout', 'grof zout'],
  peper: ['pepper', 'zwarte peper', 'black pepper'],
  olijfolie: ['olive oil', 'olijf olie'],
  zonnebloemolie: ['sunflower oil', 'vegetable oil', 'plantaardige olie', 'bakolie', 'zonnebloem olie'],
  suiker: ['sugar', 'kristalsuiker', 'rietsuiker', 'basterdsuiker'],
  bloem: ['flour', 'tarwebloem', 'patentbloem'],
  water: ['water'],
};

// "rode peper" and "bell pepper" are fresh chillies and sweet peppers, not pepper from the mill.
const FRESH_PEPPER = /(rode|groene|gele|spaanse|verse|bell|red|green|yellow|chil[il]|jalapen|sweet)\s*-?\s*pepp?ers?\b|\bpeppers\b/i;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mentions = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'u').test(text);

/** True when the ingredient names a staple as a whole word: "snufje zout" or "1 tsp salt", but not "zoute boter" or "bloemkool". */
export function isPantryStaple(ingredient: string, staples: string[]): boolean {
  const text = ingredient.toLowerCase();
  return staples.some((staple) => {
    const word = staple.trim().toLowerCase();
    if (!word) return false;
    const words = [word, ...(SYNONYMS[word] ?? [])];
    if ((word === 'peper' || word === 'pepper') && FRESH_PEPPER.test(text)) return false;
    return words.some((candidate) => mentions(text, candidate));
  });
}
