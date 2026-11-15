// Pure matching: which bonus product a recipe line asks for. No Deno or network
// in here, so it runs under node and deno test alike.

// Words that say nothing about which product it is.
const STOP = new Set([
  'vers', 'verse', 'biologisch', 'biologische', 'light', 'mager', 'magere', 'extra', 'fijn', 'fijne', 'grof', 'grove',
  'gesneden', 'gemalen', 'stuks', 'stuk', 'pak', 'fles', 'zak', 'doos', 'blik', 'grote', 'kleine', 'halve', 'hele',
  'rode', 'groene', 'gele', 'witte', 'zwarte', 'jonge', 'oude', 'keuze', 'voordeelverpakking', 'family', 'pack',
  'naturel', 'gekookt', 'gekookte', 'gebakken', 'stukjes', 'blokjes', 'reepjes', 'plakjes', 'gram', 'kilo', 'liter',
]);

// Beer, crisps and sweets share words with real ingredients ("Radler citroen", "chips paprika").
export const TREAT_CATEGORY = /borrel|chips|snack|snoep|chocolade|koek|tussendoortje|bier|wijn|aperitie|frisdrank|sappen|water|koffie|thee/i;
const TREAT_WORD = /\b(bier|wijn|chips|koek|koekjes|chocolade|frisdrank|cola|sap|koffie|thee|snoep|borrel)\b/i;
// Soap and pet food are never an ingredient, whatever word they share ("vaatwascapsules citroen").
export const NON_FOOD_CATEGORY = /huishouden|drogisterij|baby|huisdier|koken|tafelen|vrije tijd|bloem, plant/i;
// Ready-made meals only count when the recipe asks for one.
const MEAL_CATEGORY = /maaltijd|salade|pizza/i;
const MEAL_WORD = /\b(maaltijd|salade|pizza)\b/i;

// Meat and fish, so a vegetarian dish never gets a steak skewer offered because
// the product happens to say "black garlic". Dutch and English, because half the
// recipes people paste in are English.
const MEAT_FISH = /\b(kip|kipfilet|kippen\w*|gehakt|rund|rundvlees|biefstuk|biefstuk\w*|varken\w*|spek|spekjes|worst|rookworst|ham|bacon|lam|lams\w*|kalkoen|kalfs\w*|shoarma|speklap\w*|chorizo|salami|schnitzel|burger|hamburger|saucijs\w*|slavink|frikandel|kroket|spies\w*|vlees\w*|zalm|zalmfilet|tonijn|garnaal|garnalen|kabeljauw|mossel\w*|makreel|haring|forel|scampi|inktvis|ansjovis|vis|visfilet|beef|steak|chicken|pork|bacon|salmon|tuna|shrimp|prawn\w*|fish)\b/i;

// Meal kits are a whole dinner, not an ingredient: "AH Groene curry verspakket"
// is not the curry paste your recipe asks for.
const KIT_WORD = /\b(verspakket\w*|maaltijdpakket\w*|maaltijdbox\w*|kookpakket\w*|maaltijdsalade\w*|wokpakket\w*)\b/i;

// A recipe asks for one pack, not a tray of six. AH's bulk deals ("6-pack",
// "2 stuks", "5% volume voordeel") are a reason to stock up, not a week's bonus,
// and their headline savings drown out the real offers.
export const BULK_TITLE = /(\b\d+\s*-?\s*pack\b|\b\d+\s*stuks?\b|\bvoordeel(?:pak|verpakking)\w*|\bmultipack\w*|\bgrootverpakking\w*|\bfamiliepak\w*)/i;
export const BULK_MECHANISM = /volume\s*voordeel/i;

// English ingredients against Dutch shelf labels. Only the words that actually
// turn up in recipes; a wrong translation here costs a wrong match.
const DUTCH: Record<string, string[]> = {
  garlic: ['knoflook'], onion: ['ui', 'uien'], ginger: ['gember'], chicken: ['kip', 'kipfilet'],
  beef: ['rundvlees'], pork: ['varkensvlees'], salmon: ['zalm'], tuna: ['tonijn'], shrimp: ['garnalen'],
  rice: ['rijst'], noodles: ['noedels', 'mie'], pasta: ['pasta'], spaghetti: ['spaghetti'],
  potato: ['aardappel', 'aardappelen'], potatoes: ['aardappelen'], tomato: ['tomaat', 'tomaten'],
  tomatoes: ['tomaten'], mushroom: ['champignons'], mushrooms: ['champignons'], spinach: ['spinazie'],
  carrot: ['wortel'], carrots: ['wortel'], broccoli: ['broccoli'], cauliflower: ['bloemkool'],
  cucumber: ['komkommer'], lettuce: ['sla'], courgette: ['courgette'], zucchini: ['courgette'],
  aubergine: ['aubergine'], eggplant: ['aubergine'], leek: ['prei'], cabbage: ['kool'],
  cheese: ['kaas'], milk: ['melk'], butter: ['boter'], cream: ['room'], yoghurt: ['yoghurt'],
  yogurt: ['yoghurt'], egg: ['eieren'], eggs: ['eieren'], bread: ['brood'], flour: ['bloem'],
  honey: ['honing'], lemon: ['citroen'], lime: ['limoen'], orange: ['sinaasappel'], apple: ['appel'],
  banana: ['banaan'], avocado: ['avocado'], beans: ['bonen'], chickpeas: ['kikkererwten'],
  lentils: ['linzen'], tofu: ['tofu'], coconut: ['kokos'], 'coconut milk': ['kokosmelk'],
  peanut: ['pinda'], 'peanut butter': ['pindakaas'], 'soy sauce': ['sojasaus'], soy: ['soja'],
  'curry paste': ['currypasta'], curry: ['currypasta', 'kerrie'], 'sweet potato': ['zoete aardappel'],
  'maple syrup': ['ahornsiroop'], 'rice vinegar': ['rijstazijn'], sesame: ['sesam'],
  'spring onion': ['bosui'], scallion: ['bosui'], parsley: ['peterselie'], basil: ['basilicum'],
  coriander: ['koriander'], cilantro: ['koriander'], pepper: [], pesto: ['pesto'], olives: ['olijven'],
  // Phrases first: "coconut oil" is oil, not a coconut drink; "red onion" is an onion.
  'coconut oil': ['kokosolie'], 'olive oil': ['olijfolie'], 'sesame oil': ['sesamolie'], 'sesame seeds': ['sesamzaad'],
  'fish sauce': ['vissaus'], 'oyster sauce': ['oestersaus'], 'stir fry sauce': ['woksaus', 'roerbaksaus'],
  'stir-fry sauce': ['woksaus', 'roerbaksaus'], 'red onion': ['rode ui'], 'spring onions': ['bosui'],
  'bell pepper': ['paprika'], 'red pepper': ['paprika'], 'chili pepper': ['rode peper'], 'chilli pepper': ['rode peper'],
  'cherry tomatoes': ['cherrytomaten'], 'greek yoghurt': ['griekse yoghurt'], 'greek yogurt': ['griekse yoghurt'],
  'cream cheese': ['roomkaas'], 'sour cream': ['zure room'], 'baking powder': ['bakpoeder'], 'brown sugar': ['bruine suiker'],
  'tomato paste': ['tomatenpuree'], 'tomato puree': ['tomatenpuree'], 'chopped tomatoes': ['tomatenblokjes'],
  'kidney beans': ['kidneybonen'], 'black beans': ['zwarte bonen'], 'green beans': ['sperziebonen'],
  'sweet corn': ['mais'], sweetcorn: ['mais'], corn: ['mais'], vinegar: ['azijn'], oil: ['olie'], sauce: ['saus'],
  chili: ['rode peper', 'chilipeper'], chilli: ['rode peper', 'chilipeper'], mince: ['gehakt'], minced: ['gehakt'],
  turkey: ['kalkoen'], lamb: ['lamsvlees'], bacon: ['spek'], sausage: ['worst'], sausages: ['worst'],
  cod: ['kabeljauw'], prawns: ['garnalen'], mussels: ['mosselen'], feta: ['feta'], mozzarella: ['mozzarella'],
  parmesan: ['parmezaan', 'parmigiano'], cheddar: ['cheddar'], halloumi: ['halloumi'], paneer: ['paneer'],
  quinoa: ['quinoa'], couscous: ['couscous'], bulgur: ['bulgur'], oats: ['havermout'], granola: ['granola'],
  almonds: ['amandelen'], walnuts: ['walnoten'], cashews: ['cashewnoten'], peanuts: ['pindas'], raisins: ['rozijnen'],
  dates: ['dadels'], mango: ['mango'], pineapple: ['ananas'], strawberries: ['aardbeien'], blueberries: ['blauwe bessen'],
  raspberries: ['frambozen'], grapes: ['druiven'], pear: ['peer'], peach: ['perzik'], plum: ['pruim'], kiwi: ['kiwi'],
  celery: ['bleekselderij'], fennel: ['venkel'], beetroot: ['bieten'], radish: ['radijs'], asparagus: ['asperges'],
  peas: ['doperwten'], edamame: ['edamame'], kale: ['boerenkool'], rocket: ['rucola'], arugula: ['rucola'],
  thyme: ['tijm'], rosemary: ['rozemarijn'], mint: ['munt'], dill: ['dille'], chives: ['bieslook'], sage: ['salie'],
  oregano: ['oregano'], cumin: ['komijn'], paprika: ['paprikapoeder'], turmeric: ['kurkuma'], cinnamon: ['kaneel'],
  nutmeg: ['nootmuskaat'], vanilla: ['vanille'], cocoa: ['cacao'], chocolate: ['chocolade'], sugar: ['suiker'],
  water: [], stock: ['bouillon'], broth: ['bouillon'], wine: ['wijn'], beer: ['bier'], juice: ['sap'],
  tortilla: ['tortilla'], tortillas: ['tortillas', 'wraps'], wraps: ['wraps'], naan: ['naan'], pita: ['pita'],
  crackers: ['crackers'], chips: ['chips'], nachos: ['nachos', 'tortillachips'],
  // Phrases whose last word is not the thing to buy: butter beans are beans, flakes are chilli.
  'butter beans': ['boterbonen'], 'butter bean': ['boterbonen'], 'lima beans': ['boterbonen'],
  'red pepper flakes': ['chilivlokken'], 'pepper flakes': ['chilivlokken'], 'chili flakes': ['chilivlokken'],
  'chilli flakes': ['chilivlokken'], 'garlic powder': ['knoflookpoeder'], 'onion powder': ['uienpoeder'],
  'almond butter': ['amandelpasta'],
};

// Salt, pepper and oil stand in almost every recipe, so they would match crisps ("Mini crackers zout")
// or tuna in olive oil. Basics never drive a match; the ingredient only counts on its own words.
const PANTRY = new Set([
  'zout', 'zeezout', 'keukenzout', 'salt', 'peper', 'pepers', 'peperkorrels', 'pepper',
  'olie', 'olijfolie', 'zonnebloemolie', 'bakolie', 'plantaardige', 'boter', 'roomboter',
  'water', 'butter', 'suiker', 'kristalsuiker', 'rietsuiker', 'basterdsuiker', 'sugar',
  'bloem', 'tarwebloem', 'patentbloem', 'flour', 'azijn', 'maizena',
]);

// Twee letters die toch een product zijn.
const ALLOW = new Set(['ui', 'ei']);

const wordsOf = (text: string) =>
  new Set(
    text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter((word) => (word.length >= 3 || ALLOW.has(word)) && !STOP.has(word) && !/^\d/.test(word)),
  );

// Words that say how much or how to prepare, never what to buy.
const NOISE = new Set([
  'ca', 'circa', 'ongeveer', 'about', 'approx', 'tsp', 'tbsp', 'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons',
  'cup', 'cups', 'gram', 'grams', 'kilo', 'liter', 'litre', 'ml', 'cl', 'dl', 'kg', 'stuk', 'stuks', 'stukje', 'stukjes',
  'eetlepel', 'eetlepels', 'theelepel', 'theelepels', 'el', 'tl', 'snufje', 'snuf', 'mespunt', 'scheutje', 'scheut',
  'handful', 'handje', 'handvol', 'pinch', 'clove', 'cloves', 'teentje', 'teentjes', 'teen', 'blik', 'blikje', 'blikken',
  'pak', 'pakje', 'pakken', 'zak', 'zakje', 'bos', 'bosje', 'takje', 'takjes', 'plak', 'plakken', 'plakje', 'plakjes',
  'fles', 'flesje', 'pot', 'potje', 'bakje', 'bol', 'bolletje', 'bolletjes', 'stengel', 'stengels', 'stronk',
  'fresh', 'vers', 'verse', 'large', 'small', 'medium', 'big', 'groot', 'grote', 'klein', 'kleine', 'halve', 'hele',
  'roughly', 'finely', 'chopped', 'diced', 'sliced', 'minced', 'peeled', 'grated', 'crushed', 'ground', 'cooked',
  'boiled', 'raw', 'ripe', 'halved', 'quartered', 'shredded', 'drained', 'rinsed', 'melted', 'softened', 'toasted',
  'optional', 'optioneel', 'eventueel', 'taste', 'garnish', 'serve', 'serving', 'extra', 'grof', 'fijn', 'fijne',
  'gesneden', 'fijngesneden', 'fijngehakt', 'gesnipperd', 'geraspt', 'geraspte', 'geperst', 'geschild', 'gekookt',
  'gemalen', 'gehalveerd', 'uitgelekt', 'gesmolten', 'geroosterd', 'rauw', 'rauwe', 'rijp', 'rijpe', 'smaak', 'garnering',
  'super', 'mager', 'magere', 'lekker', 'lekkere', 'goede', 'goed', 'beetje', 'wat', 'iets', 'zelfgemaakt',
  'bulb', 'bulbs', 'head', 'heads', 'vegan', 'unsalted', 'salted', 'dried', 'gedroogd', 'gedroogde',
]);

// A head word that names a whole shelf: "kaas" alone would buy any cheese, so the
// rest of the line has to agree ("cheddar").
const GENERIC = new Set([
  'kaas', 'saus', 'olie', 'melk', 'rijst', 'vlees', 'kruiden', 'groente', 'groenten', 'bonen', 'noten', 'brood',
  'room', 'yoghurt', 'soep', 'bouillon', 'vis', 'meel', 'siroop', 'azijn', 'thee', 'koffie', 'sap', 'pasta', 'noedels',
  'sauce', 'oil', 'milk', 'rice', 'meat', 'herbs', 'vegetables', 'beans', 'nuts', 'bread', 'cream', 'soup', 'stock',
  'broth', 'fish', 'cheese', 'seeds', 'zaad', 'zaden', 'poeder', 'powder', 'filet', 'blokjes', 'reepjes',
]);

// Dutch shelf labels use the plural, recipes the singular.
const SYNONYMS: Record<string, string[]> = {
  ui: ['uien'], ei: ['eieren', 'ei'], tomaat: ['tomaten'], aardappel: ['aardappelen', 'aardappels'],
  wortel: ['wortelen', 'wortels', 'winterpeen'], champignon: ['champignons'], banaan: ['bananen'], appel: ['appels'],
  citroen: ['citroenen'], limoen: ['limoenen'], kip: ['kipfilet', 'kipdij', 'kippendij'], noedels: ['noodles', 'mie'],
  paprika: ['paprikas'], courgette: ['courgettes'], peer: ['peren'], sinaasappel: ['sinaasappels', 'sinaasappelen'],
  spekje: ['spekjes', 'spek'], garnaal: ['garnalen'], mossel: ['mosselen'], bosui: ['bosuitjes', 'lente-ui', 'lenteui'],
};

interface Term {
  word: string;
  /** Every one of these has to be in the title too: "zoete" for "zoete aardappel". */
  all: string[];
  /** At least one of these has to be in the title: "cheddar" next to a bare "kaas". */
  any: string[];
}

/** The line without its amounts, preparation and alternatives: what you would put in the cart. */
const productWords = (ingredient: string) => {
  let text = ingredient.toLowerCase().normalize('NFKD');
  text = text.replace(/\(.*?\)/g, ' ');
  text = text.split(/[,;:]/)[0];
  text = text.split(/\s+(?:and|or|en|of|for|to|voor)\s+/)[0];
  text = text.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/-/g, ' ');
  return text.split(/\s+/).filter((word) =>
    word && !/^\d/.test(word) && !NOISE.has(word) && !STOP.has(word) && (word.length >= 3 || ALLOW.has(word)));
};

/** The word itself, its Dutch, and its plural: every form a shelf label might use. */
const formsOf = (word: string) => {
  const forms = new Set<string>([word]);
  for (const dutch of DUTCH[word] ?? []) for (const part of dutch.split(' ')) forms.add(part);
  for (const form of [...forms]) for (const synonym of SYNONYMS[form] ?? []) forms.add(synonym);
  return [...forms].filter((form) => form.length >= 3 || ALLOW.has(form));
};

const termsFor = (word: string, others: string[]): Term[] => {
  const otherForms = others.flatMap(formsOf);
  return formsOf(word).map((form) => ({
    word: form,
    all: [],
    // A shelf name on its own is not a product; the rest of the line has to show up too.
    any: GENERIC.has(form) && otherForms.length > 0 ? otherForms : [],
  }));
};

/**
 * What to look for, in order of trust. "Rice vinegar" is vinegar, so the
 * translated phrase ("rijstazijn") goes first; only if the shelf has none of
 * that do the single words get a turn, the last word (the thing itself) before
 * the ones in front of it (what kind). A tier that finds something ends the search.
 */
const searchTiers = (ingredient: string): Term[][] => {
  const words = productWords(ingredient);
  if (words.length === 0) return [];
  const tiers: Term[][] = [];
  const phrase = words.join(' ');
  const consumed = new Set<string>();
  const phraseTier: Term[] = [];
  const phrases = Object.entries(DUTCH).filter(([english]) => english.includes(' ')).sort((a, b) => b[0].length - a[0].length);
  for (const [english, dutch] of phrases) {
    if (!new RegExp(`\\b${english}\\b`).test(phrase)) continue;
    // "red pepper flakes" took these words already; "red pepper" inside it is not paprika.
    if (english.split(' ').some((part) => consumed.has(part))) continue;
    for (const part of english.split(' ')) consumed.add(part);
    for (const translation of dutch) {
      const parts = translation.split(' ');
      const head = parts[parts.length - 1];
      phraseTier.push({ word: head, all: parts.slice(0, -1), any: [] });
      for (const synonym of SYNONYMS[head] ?? []) phraseTier.push({ word: synonym, all: parts.slice(0, -1), any: [] });
    }
  }
  if (phraseTier.length > 0) tiers.push(phraseTier);
  // Took the phrase the thing itself ("stir-fry sauce"), then what is left in
  // front of it ("mushroom vegetarian") only describes it and buys nothing.
  if (consumed.has(words[words.length - 1])) return tiers;
  const rest = words.filter((word) => !consumed.has(word));
  if (rest.length === 0) return tiers;
  const head = rest[rest.length - 1];
  const others = rest.slice(0, -1);
  tiers.push(termsFor(head, others));
  for (const word of others) tiers.push(termsFor(word, []));
  return tiers;
};

// Products that come in flavours. "Philadelphia knoflook" is cream cheese,
// "kwark citroen" is quark, "Peanut butter cup" is ice cream: the flavour word
// sits at the end of the title, but you only buy one when the recipe asks for
// the product itself.
const FLAVOUR_CARRIER = new Set([
  'kwark', 'yoghurt', 'skyr', 'vla', 'pudding', 'ijs', 'roomijs', 'sorbet', 'cup', 'cups', 'cone', 'magnum',
  'roomkaas', 'smeerkaas', 'philadelphia', 'boursin', 'hummus', 'dip', 'dips', 'dressing', 'tapenade', 'spread',
  'smeersel', 'mayonaise', 'chips', 'crackers', 'toast', 'koek', 'koekjes', 'reep', 'repen', 'muesli', 'granola',
  'drank', 'drink', 'limonade', 'siroop', 'smoothie', 'thee', 'snoep', 'kauwgom', 'bites', 'kruidenboter',
  'zuivelspread', 'tortillachips', 'zoutjes', 'borrelnoten', 'popcorn', 'wafels', 'cake', 'taart', 'muffin',
]);

type Row = {
  product_id: number;
  title: string;
  category: string | null;
  mechanism: string | null;
  price: number | null;
  price_before: number | null;
};

export interface BonusIndex<R extends Row> {
  byWord: Map<string, R[]>;
  titleWordCount: Map<number, number>;
  titleWords: Map<number, Set<string>>;
  tailWords: Map<number, Set<string>>;
}

/** One word list per product, so every ingredient only costs a set lookup. */
export function bouwIndex<R extends Row>(bonus: R[]): BonusIndex<R> {
  const byWord = new Map<string, R[]>();
  const titleWordCount = new Map<number, number>();
  const titleWords = new Map<number, Set<string>>();
  const tailWords = new Map<number, Set<string>>();
  for (const product of bonus) {
    const words = [...wordsOf(product.title)];
    titleWordCount.set(product.product_id, words.length);
    titleWords.set(product.product_id, new Set(words));
    // Whatever follows "met" or "in" is a flavour, not the product: "Kruidenboter
    // met knoflook" is butter, "Tonijnstukken in olijfolie" is tuna.
    const head = product.title.split(/\s+\b(?:met|in)\b\s+/i)[0];
    const headWords = [...wordsOf(head)];
    // What the product really is, stands at the end of an AH title: "AH Scharrel kipfilet".
    // "AH Pasta geraspte kaas" is cheese, not pasta, so only the last two words count.
    tailWords.set(product.product_id, new Set((headWords.length ? headWords : words).slice(-2)));
    for (const word of words) {
      const list = byWord.get(word) ?? [];
      list.push(product);
      byWord.set(word, list);
    }
  }
  return { byWord, titleWordCount, titleWords, tailWords };
}

const cut = (row: Row) => {
  const { price, price_before } = row;
  if (price == null || price_before == null || price_before <= 0) return 0;
  return Math.max(0, (price_before - price) / price_before);
};

/** The bonus product per recipe line, at most one, never the same product twice. */
export function zoekTreffers<R extends Row>(ingredients: string[], index: BonusIndex<R>) {
  const { byWord, titleWordCount, titleWords, tailWords } = index;
  const seen = new Set<number>();
  const hits: { ingredient: string; product: R }[] = [];
  // A dish without meat or fish in it never gets meat or fish offered, whatever
  // word a product title happens to share ("BBQ biefstukspies black garlic").
  const wantsMeatFish = ingredients.some((line) => MEAT_FISH.test(line));

  for (const ingredient of ingredients) {
    const wantsTreat = TREAT_WORD.test(ingredient);
    const wantsMeal = MEAL_WORD.test(ingredient);
    const thisIsMeatFish = MEAT_FISH.test(ingredient);
    const tiers = searchTiers(ingredient);
    // Everything the line could be asking for, so a flavour carrier only passes
    // when the recipe names it ("greek yoghurt" may buy yoghurt).
    const asked = new Set<string>(productWords(ingredient).flatMap(formsOf));
    for (const tier of tiers) for (const term of tier) {
      asked.add(term.word);
      for (const part of term.all) asked.add(part);
    }
    let best: R | undefined;
    for (const tier of tiers) {
      for (const term of tier) {
        const word = term.word;
        if (PANTRY.has(word)) continue;
        const candidates = byWord.get(word);
        if (!candidates) continue;
        for (const candidate of candidates) {
          if (seen.has(candidate.product_id)) continue;
          const inTitle = titleWords.get(candidate.product_id) ?? new Set<string>();
          // "Zoete aardappel" needs the "zoete"; a bare "kaas" needs the "cheddar" next to it.
          if (!term.all.every((part) => inTitle.has(part))) continue;
          if (term.any.length > 0 && !term.any.some((part) => inTitle.has(part))) continue;
          // Garlic is not garlic cream cheese, lemon is not lemon quark.
          if ([...inTitle].some((part) => FLAVOUR_CARRIER.has(part) && !asked.has(part))) continue;
          const category = candidate.category ?? '';
          // A recipe asking for lemon does not mean lemon beer or dishwasher tabs.
          if (NON_FOOD_CATEGORY.test(category)) continue;
          if (!wantsTreat && TREAT_CATEGORY.test(category)) continue;
          if (!wantsMeal && MEAL_CATEGORY.test(category)) continue;
          // A whole dinner in a box is not the ingredient you asked for.
          if (!wantsMeal && KIT_WORD.test(candidate.title)) continue;
          // Buying six of something is not this week's bonus on one of them.
          if (BULK_TITLE.test(candidate.title) || BULK_MECHANISM.test(candidate.mechanism ?? '')) continue;
          // Meat or fish only for a recipe that has meat or fish, and only on
          // the line that asks for it: garlic never buys a steak skewer.
          if (MEAT_FISH.test(candidate.title) && !(wantsMeatFish && thisIsMeatFish)) continue;
          const words = titleWordCount.get(candidate.product_id) ?? 9;
          // The word has to name the product, not describe what it goes with.
          if (!tailWords.get(candidate.product_id)?.has(word)) continue;
          // The plainest product wins: "AH Pasta" over "AH Pasta geraspte kaas".
          // Between equals, the biggest discount wins: "1 + 1 gratis" beats "2% volume voordeel".
          const bestWords = best ? titleWordCount.get(best.product_id) ?? 9 : 99;
          if (!best || words < bestWords || (words === bestWords && cut(candidate) > cut(best))) best = candidate;
        }
      }
      // A tier that found something settles it: "rijstazijn" never falls through to "rijst".
      if (best) break;
    }
    if (best) {
      seen.add(best.product_id);
      hits.push({ ingredient, product: best });
    }
  }
  return hits;
}
