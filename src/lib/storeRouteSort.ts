import { t } from '@/lib/i18n';
/**
 * Sorteer boodschappen per afdeling, in de volgorde waarin je door een AH loopt.
 * Heeft een boodschap een AH-product, dan telt de afdeling die AH zelf opgeeft;
 * anders zoeken we op trefwoorden in de naam.
 */

export type Department =
  | 'groente_fruit'
  | 'brood'
  | 'vlees_vis'
  | 'zuivel'
  | 'maaltijden'
  | 'pasta_rijst'
  | 'houdbaar'
  | 'drinken'
  | 'huishouden'
  | 'diepvries';

const DEPARTMENT_ORDER: Department[] = [
  'groente_fruit',
  'brood',
  'vlees_vis',
  'zuivel',
  'maaltijden',
  'pasta_rijst',
  'houdbaar',
  'drinken',
  'huishouden',
  'diepvries',
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  groente_fruit: t('Groente & fruit'),
  brood: t('Brood & bakkerij'),
  vlees_vis: t('Vlees & vis'),
  zuivel: t('Zuivel & eieren'),
  maaltijden: t('Maaltijden & salades'),
  pasta_rijst: t('Pasta, rijst & wereld'),
  houdbaar: t('Houdbaar'),
  drinken: t('Drinken'),
  huishouden: t('Huishouden'),
  diepvries: t('Diepvries'),
};

// AH's own main categories, such as "Zuivel, eieren" or "Soepen, sauzen, kruiden".
// The first rule that matches wins, so "Fruit, verse sappen" stays with fruit.
// A mixed category such as "Kaas, vleeswaren, tapas" says nothing on its own; the name decides.
const AH_CATEGORY_RULES: [RegExp, Department | 'by-name'][] = [
  [/kaas.*vleeswaren|vleeswaren.*kaas/i, 'by-name'],
  [/diepvries/i, 'diepvries'],
  [/groente|fruit|aardappel/i, 'groente_fruit'],
  [/bakkerij|brood/i, 'brood'],
  [/vlees|\bvis\b|vegetarisch|vegan|plantaardig/i, 'vlees_vis'],
  [/zuivel|eieren|kaas/i, 'zuivel'],
  [/maaltijd|salade|pizza/i, 'maaltijden'],
  [/pasta|rijst|wereld/i, 'pasta_rijst'],
  [/frisdrank|sappen|water|koffie|thee|bier|wijn|aperitie/i, 'drinken'],
  [/drogisterij|huishoud|baby|huisdier|tafelen/i, 'huishouden'],
  [/soep|saus|kruiden|ontbijt|beleg|snoep|chocolade|koek|chips|snack|borrel|tussendoor|conserven|bakken/i, 'houdbaar'],
];

// Keywords per afdeling (lowercase), for items without an AH product.
const DEPARTMENT_KEYWORDS: Record<Department, string[]> = {
  groente_fruit: [
    'appel', 'peer', 'banaan', 'banan', 'druif', 'druiven', 'aardbei', 'framboz',
    'blauwe bes', 'bosbes', 'citroen', 'limoen', 'sinaasappel', 'mandarijn', 'mango',
    'ananas', 'kiwi', 'meloen', 'watermeloen', 'perzik', 'nectarine', 'pruim', 'kers',
    'avocado', 'tomaat', 'tomat', 'komkommer', 'paprika', 'ui', 'uien', 'knoflook',
    'wortel', 'peen', 'broccoli', 'bloemkool', 'spinazie', 'sla', 'ijsbergsla', 'rucola',
    'andijvie', 'witlof', 'prei', 'courgette', 'aubergine', 'champignon', 'paddenstoel',
    'radijs', 'biet', 'bieten', 'mais', 'sperziebonen', 'snijbonen', 'boontjes',
    'groente', 'fruit', 'basilicum', 'peterselie', 'bieslook',
    'munt', 'gember', 'aardappel', 'aardappelen', 'zoete aardappel', 'krieltjes',
    'rode kool', 'witte kool', 'selderij', 'venkel', 'artisjok', 'asperge',
    'lente-ui', 'bosui', 'veldsla', 'spruiten', 'spruitjes', 'boerenkool',
    // English
    'apple', 'pear', 'banana', 'grape', 'grapes', 'strawberry', 'raspberry',
    'blueberry', 'lemon', 'lime', 'orange', 'tangerine', 'pineapple',
    'melon', 'watermelon', 'peach', 'plum', 'cherry', 'cherries',
    'tomato', 'tomatoes', 'cucumber', 'bell pepper', 'onion', 'onions', 'garlic',
    'carrot', 'carrots', 'cauliflower', 'spinach', 'lettuce', 'arugula',
    'leek', 'zucchini', 'eggplant', 'mushroom', 'mushrooms',
    'radish', 'beet', 'beets', 'corn', 'green beans',
    'vegetable', 'vegetables', 'herbs', 'basil', 'parsley', 'chives',
    'mint', 'ginger', 'potato', 'potatoes', 'sweet potato',
    'celery', 'fennel', 'artichoke', 'asparagus', 'cabbage',
    'spring onion', 'kale', 'brussels sprouts',
  ],
  brood: [
    'brood', 'boterham', 'pistolet', 'croissant', 'stokbrood', 'baguette',
    'tortilla', 'wrap', 'pitabrood', 'pita', 'naan', 'focaccia', 'bagel',
    'beschuit', 'knäckebröd', 'volkoren', 'witbrood', 'meergranen',
    'broodje', 'bol', 'bollen', 'roggebrood', 'pumpernickel', 'turks brood',
    'brioche', 'pannenkoek', 'wafel',
    // English
    'bread', 'sandwich', 'pancake', 'waffle', 'whole wheat', 'sourdough', 'rye bread', 'flatbread',
  ],
  vlees_vis: [
    'vlees', 'kip', 'kipfilet', 'kippenfilet', 'gehakt', 'biefstuk', 'steak', 'worst', 'rookworst',
    'spek', 'bacon', 'ham', 'salami', 'chorizo', 'filet americain', 'carpaccio',
    'vis', 'zalm', 'garnaal', 'garnalen', 'tonijn', 'haring', 'makreel',
    'kabeljauw', 'tilapia', 'pangasius', 'vleesvervanger', 'tofu', 'tempeh', 'kipstukjes',
    'drumstick', 'varkens', 'runder', 'lams', 'kalf', 'rosbief', 'leverworst', 'paté',
    'shoarma', 'gyros', 'burger', 'saucijs',
    // English
    'meat', 'chicken', 'chicken breast', 'ground beef', 'minced meat', 'sausage',
    'fish', 'salmon', 'shrimp', 'prawns', 'cod',
  ],
  zuivel: [
    'melk', 'kaas', 'yoghurt', 'kwark', 'boter', 'margarine', 'room', 'slagroom',
    'crème fraîche', 'creme fraiche', 'zuivel', 'ei', 'eieren', 'mozzarella', 'brie', 'camembert',
    'geitenkaas', 'oude kaas', 'jong belegen', 'plakken kaas', 'geraspte kaas',
    'cottage cheese', 'hummus', 'tzatziki',
    // English
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'whipped cream',
    'dairy', 'egg', 'eggs', 'goat cheese', 'grated cheese', 'sliced cheese',
  ],
  maaltijden: [
    'maaltijdsalade', 'salade', 'pizza', 'lasagne', 'kant-en-klaar', 'verse soep', 'wraps salade',
    // English
    'ready meal', 'salad',
  ],
  pasta_rijst: [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'macaroni', 'tagliatelle', 'lasagnebladen',
    'noodles', 'noedels', 'mie', 'rijst', 'basmati', 'couscous', 'bulgur', 'quinoa',
    'sojasaus', 'ketjap', 'sambal', 'sriracha', 'kokosmelk', 'currypasta', 'curry', 'taco', 'nasi', 'bami',
    // English
    'rice', 'soy sauce', 'coconut milk', 'curry paste',
  ],
  houdbaar: [
    'linzen', 'bonen', 'kikkererwten', 'olie', 'olijfolie', 'zonnebloemolie', 'azijn',
    'mosterd', 'ketchup', 'mayonaise', 'mayo',
    'saus', 'tomatensaus', 'passata', 'tomatenblokjes', 'blik tomaten',
    'soep', 'bouillon', 'kruiden', 'peper', 'zout', 'paprikapoeder', 'komijn',
    'kurkuma', 'kaneel', 'oregano', 'tijm', 'laurier', 'nootmuskaat',
    'suiker', 'meel', 'bloem', 'bakpoeder', 'gist', 'vanille', 'cacao',
    'chocolade', 'hagelslag', 'pindakaas', 'jam', 'honing', 'stroop',
    'cornflakes', 'muesli', 'granola', 'havermout', 'ontbijtgranen',
    'noten', 'pinda', 'cashew', 'amandel', 'walnoot', 'rozijnen', 'dadel',
    'chips', 'koek', 'koekjes', 'biscuit', 'snoep', 'drop', 'popcorn',
    'crackers', 'cracker', 'rijstwafel', 'tomatenpuree',
    'blikje', 'conserven', 'ingelegd', 'kappertjes', 'olijven',
    // English
    'lentils', 'beans', 'chickpeas', 'olive oil', 'vinegar',
    'mustard', 'sauce', 'tomato sauce', 'soup', 'broth', 'pepper', 'salt',
    'cumin', 'turmeric', 'cinnamon', 'sugar', 'flour', 'baking powder',
    'yeast', 'vanilla', 'cocoa', 'chocolate', 'peanut butter', 'honey',
    'cereal', 'oatmeal', 'oats', 'nuts', 'peanuts', 'almonds', 'walnuts',
    'raisins', 'cookies', 'candy', 'snacks', 'tomato paste',
    'canned', 'olives', 'capers',
  ],
  drinken: [
    'thee', 'koffie', 'espresso', 'sap', 'jus', 'limonade', 'water',
    'bier', 'wijn', 'fris', 'cola', 'ice tea', 'energy drink',
    // English
    'tea', 'coffee', 'juice', 'lemonade', 'beer', 'wine', 'soda',
  ],
  huishouden: [
    'zeep', 'shampoo', 'conditioner', 'douchegel', 'deodorant', 'tandpasta',
    'tandenborstel', 'floss', 'mondwater', 'tissues', 'toiletpapier', 'wc papier', 'wc-papier',
    'keukenpapier', 'keukenrol', 'vuilniszak', 'afvalzak', 'schoonmaak',
    'allesreiniger', 'afwasmiddel', 'vaatwasmiddel', 'wasmiddel', 'wasverzachter',
    'sponzen', 'spons', 'doekjes', 'handzeep', 'desinfecterend', 'bleek',
    'batterij', 'batterijen', 'lamp', 'kaars', 'kaarsen', 'aansteker',
    'lucifers', 'aluminiumfolie', 'bakpapier', 'huishoudfolie', 'clingfilm',
    'plastic zakjes', 'diepvrieszakjes', 'vershoudfolie', 'pleisters',
    'paracetamol', 'ibuprofen', 'vitamine', 'maandverband', 'tampons',
    'luiers', 'scheermesje', 'scheermes', 'wattenstaafje', 'wattenschijfje',
    'bodylotion', 'zonnebrand', 'insectenspray',
    // English
    'soap', 'shower gel', 'toothpaste', 'toothbrush', 'mouthwash',
    'toilet paper', 'paper towels', 'trash bags', 'cleaning',
    'dish soap', 'detergent', 'laundry', 'sponge', 'hand soap',
    'batteries', 'candle', 'candles', 'aluminum foil', 'parchment paper',
    'cling wrap', 'band-aids', 'vitamins', 'diapers', 'sunscreen',
  ],
  diepvries: [
    'diepvries', 'bevroren', 'ijsje', 'ijsjes', 'vriesvers',
    'frites', 'friet', 'patat', 'kroketten', 'bitterballen', 'frikandel',
    'loempia', 'visstick', 'kibbeling', 'roerbakgroente',
    // English
    'frozen', 'ice cream', 'fries', 'french fries', 'fish sticks',
  ],
};

// Words that put an item in the freezer whatever else its name says ("diepvries spinazie").
const FROZEN = /\b(diepvries|bevroren|frozen)\b/i;

function fromAhCategory(category: string | null | undefined): Department | null {
  if (!category) return null;
  const department = AH_CATEGORY_RULES.find(([pattern]) => pattern.test(category))?.[1];
  return department && department !== 'by-name' ? department : null;
}

// Words that hide another word: pindakaas is no cheese, kokosmelk no dairy,
// and a boterham belongs with the bread. These are checked before the keywords.
const COMPOUNDS: [RegExp, Department][] = [
  [/\bpinda ?kaas\b/, 'houdbaar'],
  [/\bkokos(melk|room|water)\b/, 'pasta_rijst'],
  [/\bmelkchocolade\b/, 'houdbaar'],
  [/\bboterham(men)?\b/, 'brood'],
  [/\bboterkoek\b/, 'brood'],
];

function fromKeywords(itemName: string): Department {
  const lower = itemName.toLowerCase().trim();
  if (FROZEN.test(lower)) return 'diepvries';

  const compound = COMPOUNDS.find(([pattern]) => pattern.test(lower));
  if (compound) return compound[1];

  // Remove leading quantity (e.g. "2 bananen" → "bananen")
  const withoutQty = lower.replace(/^\d+(?:[.,]\d+)?\s+/, '');

  for (const department of DEPARTMENT_ORDER) {
    for (const keyword of DEPARTMENT_KEYWORDS[department]) {
      // The reverse check lets "banaan" find "bananen", but only for longer names:
      // otherwise "cola" would land wherever a keyword happens to contain it.
      if (withoutQty.includes(keyword) || (withoutQty.length >= 5 && keyword.startsWith(withoutQty))) {
        return department;
      }
    }
  }

  // Default: houdbaar (middle of the store)
  return 'houdbaar';
}

export interface CategorizedItem<T> {
  category: Department;
  label: string;
  items: T[];
}

export function sortByStoreRoute<T extends { name: string; ahProduct?: { category?: string | null } | null }>(
  items: T[],
): CategorizedItem<T>[] {
  const grouped = new Map<Department, T[]>(DEPARTMENT_ORDER.map((department) => [department, []]));

  for (const item of items) {
    // AH files frozen spinach under "Groente, aardappelen"; the name you typed wins.
    const department = FROZEN.test(item.name)
      ? 'diepvries'
      : fromAhCategory(item.ahProduct?.category) ?? fromKeywords(item.name);
    grouped.get(department)!.push(item);
  }

  return DEPARTMENT_ORDER
    .filter((department) => grouped.get(department)!.length > 0)
    .map((department) => ({
      category: department,
      label: DEPARTMENT_LABELS[department],
      items: grouped.get(department)!,
    }));
}
