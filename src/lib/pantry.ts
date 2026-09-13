/** Counts, with "bijna op" as a separate flag: a half-empty jar still counts as one. */
export const MAX_QUANTITY = 99;

export const sameProduct = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Herbs and spices live in their own row of the cupboard, not among the pasta.
 * Matched on whole words, so "kaneelstokje" counts and "peperoni" does not.
 */
const HERBS = [
  'zout', 'zeezout', 'peper', 'peperkorrels', 'paprikapoeder', 'komijn', 'kaneel', 'kerrie', 'currypoeder',
  'kurkuma', 'gember', 'laurier', 'laurierblad', 'kruidnagel', 'nootmuskaat', 'chilipoeder', 'chilivlokken',
  'knoflookpoeder', 'uienpoeder', 'basilicum', 'oregano', 'tijm', 'rozemarijn', 'salie', 'dille', 'munt',
  'koriander', 'peterselie', 'bieslook', 'dragon', 'karwij', 'venkelzaad', 'mosterdzaad', 'sesamzaad',
  'saffraan', 'vanille', 'vanillestokje', 'kardemom', 'steranijs', 'anijs', 'piment', 'cayennepeper',
  'italiaanse kruiden', 'provencaalse kruiden', 'provençaalse kruiden', 'kruidenmix', 'bouillonpoeder',
  'oreganoblaadjes', 'tuinkruiden', 'specerijen', 'kruiden',
];

// "kaneelstokjes" en "komijnzaad" tellen ook mee, "peperoni" en "zoutjes" niet.
const SUFFIXES = 'poeder|zaad|zaden|stokje|stokjes|blad|blaadje|blaadjes|bladeren|vlokken|korrel|korrels|mix|takje|takjes|s|en';
const HERB_PATTERN = new RegExp(`(^|[^a-zà-ÿ])(${HERBS.join('|')})(${SUFFIXES})?([^a-zà-ÿ]|$)`, 'i');

export const isHerb = (name: string) => HERB_PATTERN.test(name.trim().toLowerCase());
