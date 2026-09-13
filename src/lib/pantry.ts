/** Counts, with "bijna op" as a separate flag: a half-empty jar still counts as one. */
export const MAX_QUANTITY = 99;

export const sameProduct = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Herbs and spices live in their own row of the cupboard, not among the pasta.
 * Matched on whole words, so "kaneelstokje" counts and "peperoni" does not.
 */
const HERBS = [
  // Nederlands
  'zout', 'zeezout', 'peper', 'peperkorrels', 'paprikapoeder', 'komijn', 'kaneel', 'kerrie', 'currypoeder',
  'kurkuma', 'gember', 'laurier', 'laurierblad', 'kruidnagel', 'nootmuskaat', 'chilipoeder', 'chilivlokken',
  'knoflookpoeder', 'uienpoeder', 'basilicum', 'oregano', 'tijm', 'rozemarijn', 'salie', 'dille', 'munt',
  'koriander', 'peterselie', 'bieslook', 'dragon', 'karwij', 'venkelzaad', 'mosterdzaad', 'sesamzaad',
  'saffraan', 'vanille', 'vanillestokje', 'kardemom', 'steranijs', 'anijs', 'piment', 'cayennepeper',
  'italiaanse kruiden', 'provencaalse kruiden', 'provençaalse kruiden', 'kruidenmix', 'bouillonpoeder',
  'tuinkruiden', 'specerijen', 'kruiden',
  // English, because half the recipes on the internet are
  'salt', 'sea salt', 'pepper', 'peppercorns', 'black pepper', 'paprika powder', 'smoked paprika', 'cumin',
  'cinnamon', 'curry powder', 'turmeric', 'ginger', 'bay leaf', 'bay leaves', 'cloves', 'nutmeg',
  'chili powder', 'chilli powder', 'chili flakes', 'garlic powder', 'onion powder', 'basil', 'oregano',
  'thyme', 'rosemary', 'sage', 'dill', 'mint', 'cilantro', 'coriander', 'parsley', 'chives', 'tarragon',
  'caraway', 'fennel seeds', 'mustard seeds', 'sesame seeds', 'saffron', 'vanilla', 'cardamom',
  'star anise', 'anise', 'allspice', 'cayenne', 'herbs', 'spices', 'italian herbs', 'mixed herbs',
];

// "kaneelstokjes" en "komijnzaad" tellen ook mee, "peperoni" en "zoutjes" niet.
const SUFFIXES = 'poeder|zaad|zaden|stokje|stokjes|blad|blaadje|blaadjes|bladeren|vlokken|korrel|korrels|mix|takje|takjes|powder|seeds|leaves|flakes|sticks|s|en';
const HERB_PATTERN = new RegExp(`(^|[^a-zà-ÿ])(${HERBS.join('|')})(${SUFFIXES})?([^a-zà-ÿ]|$)`, 'i');

export const isHerb = (name: string) => HERB_PATTERN.test(name.trim().toLowerCase());
