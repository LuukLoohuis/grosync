/**
 * Sorteer boodschappen op supermarkt-looproute.
 * Volgorde: Groente & fruit → Brood → Vers → Houdbaar → Non-food → Diepvries
 */

type RouteCategory =
  | 'groente_fruit'
  | 'brood'
  | 'vers'
  | 'houdbaar'
  | 'non_food'
  | 'diepvries';

const ROUTE_ORDER: RouteCategory[] = [
  'groente_fruit',
  'brood',
  'vers',
  'houdbaar',
  'non_food',
  'diepvries',
];

export const ROUTE_LABELS: Record<RouteCategory, string> = {
  groente_fruit: '🥬 Groente & Fruit',
  brood: '🍞 Brood',
  vers: '🥩 Vers',
  houdbaar: '🥫 Houdbaar',
  non_food: '🧴 Non-food',
  diepvries: '🧊 Diepvries',
};

// Keywords per categorie (lowercase)
const CATEGORY_KEYWORDS: Record<RouteCategory, string[]> = {
  groente_fruit: [
    'appel', 'peer', 'banaan', 'banan', 'druif', 'druiven', 'aardbei', 'framboz',
    'blauwe bes', 'bosbes', 'citroen', 'limoen', 'sinaasappel', 'mandarijn', 'mango',
    'ananas', 'kiwi', 'meloen', 'watermeloen', 'perzik', 'nectarine', 'pruim', 'kers',
    'avocado', 'tomaat', 'tomat', 'komkommer', 'paprika', 'ui', 'uien', 'knoflook',
    'wortel', 'peen', 'broccoli', 'bloemkool', 'spinazie', 'sla', 'ijsbergsla', 'rucola',
    'andijvie', 'witlof', 'prei', 'courgette', 'aubergine', 'champignon', 'paddenstoel',
    'radijs', 'biet', 'bieten', 'mais', 'sperziebonen', 'snijbonen', 'boontjes',
    'groente', 'fruit', 'salade', 'kruiden', 'basilicum', 'peterselie', 'bieslook',
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
    'radish', 'beet', 'beets', 'corn', 'green beans', 'beans',
    'vegetable', 'vegetables', 'herbs', 'basil', 'parsley', 'chives',
    'mint', 'ginger', 'potato', 'potatoes', 'sweet potato',
    'celery', 'fennel', 'artichoke', 'asparagus', 'cabbage',
    'spring onion', 'kale', 'brussels sprouts',
  ],
  brood: [
    'brood', 'boterham', 'pistolet', 'croissant', 'stokbrood', 'baguette',
    'tortilla', 'wrap', 'pitabrood', 'pita', 'naan', 'focaccia', 'bagel',
    'beschuit', 'cracker', 'knäckebröd', 'volkoren', 'witbrood', 'meergranen',
    'broodje', 'bol', 'bollen', 'roggebrood', 'pumpernickel', 'turks brood',
    'brioche', 'pannenkoek', 'wafel',
    // English
    'bread', 'sandwich', 'pancake', 'waffle', 'whole wheat', 'sourdough', 'rye bread', 'flatbread',
  ],
  vers: [
    'melk', 'kaas', 'yoghurt', 'kwark', 'boter', 'margarine', 'room', 'slagroom',
    'crème fraîche', 'creme fraiche', 'zuivel', 'ei', 'eieren', 'vlees', 'kip',
    'kipfilet', 'kippenfilet', 'gehakt', 'biefstuk', 'steak', 'worst', 'rookworst',
    'spek', 'bacon', 'ham', 'salami', 'chorizo', 'filet americain', 'carpaccio',
    'vis', 'zalm', 'garnaal', 'garnalen', 'tonijn vers', 'haring', 'makreel',
    'kabeljauw', 'tilapia', 'pangasius', 'mozzarella', 'brie', 'camembert',
    'geitenkaas', 'oude kaas', 'jong belegen', 'plakken kaas', 'geraspte kaas',
    'cottage cheese', 'hummus', 'tzatziki', 'pesto vers', 'pasta vers',
    'vleesvervangers', 'tofu', 'tempeh', 'kipstuckjes', 'drumstick', 'varkens',
    'runder', 'lams', 'kalf', 'rosbief', 'leverworst', 'paté', 'filet',
    'shoarma', 'gyros', 'burger', 'saucijs',
    // English
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'whipped cream',
    'dairy', 'egg', 'eggs', 'meat', 'chicken', 'chicken breast',
    'ground beef', 'minced meat', 'sausage', 'fish', 'salmon',
    'shrimp', 'prawns', 'cod', 'goat cheese', 'grated cheese', 'sliced cheese',
  ],
  houdbaar: [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'macaroni', 'noodles', 'noedels',
    'rijst', 'basmati', 'couscous', 'bulgur', 'quinoa', 'linzen', 'bonen',
    'kikkererwten', 'olie', 'olijfolie', 'zonnebloemolie', 'azijn', 'sojasaus',
    'ketjap', 'sambal', 'sriracha', 'mosterd', 'ketchup', 'mayonaise', 'mayo',
    'saus', 'tomatensaus', 'passata', 'tomatenblokjes', 'blik tomaten',
    'soep', 'bouillon', 'kruiden', 'peper', 'zout', 'paprikapoeder', 'komijn',
    'kurkuma', 'kaneel', 'oregano', 'tijm', 'laurier', 'nootmuskaat',
    'suiker', 'meel', 'bloem', 'bakpoeder', 'gist', 'vanille', 'cacao',
    'chocolade', 'hagelslag', 'pindakaas', 'jam', 'honing', 'stroop',
    'cornflakes', 'muesli', 'granola', 'havermout', 'ontbijtgranen',
    'thee', 'koffie', 'espresso', 'sap', 'jus', 'limonade', 'water',
    'bier', 'wijn', 'fris', 'cola', 'cola zero', 'ice tea', 'energy drink',
    'noten', 'pinda', 'cashew', 'amandel', 'walnoot', 'rozijnen', 'dadel',
    'chips', 'koek', 'koekjes', 'biscuit', 'snoep', 'drop', 'popcorn',
    'crackers', 'rijstwafel', 'tomatenpuree', 'kokosmelk',
    'blikje', 'conserven', 'ingelegd', 'kappertjes', 'olijven',
    // English
    'rice', 'lentils', 'chickpeas', 'olive oil', 'vinegar', 'soy sauce',
    'mustard', 'sauce', 'tomato sauce', 'soup', 'broth', 'pepper', 'salt',
    'cumin', 'turmeric', 'cinnamon', 'sugar', 'flour', 'baking powder',
    'yeast', 'vanilla', 'cocoa', 'chocolate', 'peanut butter', 'honey',
    'cereal', 'oatmeal', 'oats', 'tea', 'coffee', 'juice', 'lemonade',
    'beer', 'wine', 'soda', 'nuts', 'peanuts', 'almonds', 'walnuts',
    'raisins', 'cookies', 'candy', 'snacks', 'tomato paste', 'coconut milk',
    'canned', 'olives', 'capers',
  ],
  non_food: [
    'zeep', 'shampoo', 'conditioner', 'douchegel', 'deodorant', 'tandpasta',
    'tandenborstel', 'floss', 'mondwater', 'tissues', 'toiletpapier', 'wc papier',
    'keukenpapier', 'keukenrol', 'vuilniszak', 'afvalzak', 'schoonmaak',
    'allesreiniger', 'afwasmiddel', 'vaatwasmiddel', 'wasmiddel', 'wasverzachter',
    'sponzen', 'spons', 'doekjes', 'handzeep', 'desinfecterend', 'bleek',
    'batterij', 'batterijen', 'lamp', 'kaars', 'kaarsen', 'aansteker',
    'lucifers', 'aluminiumfolie', 'bakpapier', 'huishoudfolie', 'clingfilm',
    'plastic zakjes', 'diepvrieszakjes', 'vershoudfolie', 'pleisters',
    'paracetamol', 'ibuprofen', 'vitamine', 'maandverband', 'tampons',
    'luiers', 'scheermesje', 'scheermes', 'wattenstaafje', 'wattenschijfje',
    'crème', 'bodylotion', 'zonnebrand', 'insectenspray',
    // English
    'soap', 'shower gel', 'toothpaste', 'toothbrush', 'mouthwash',
    'toilet paper', 'paper towels', 'trash bags', 'cleaning',
    'dish soap', 'detergent', 'laundry', 'sponge', 'hand soap',
    'batteries', 'candle', 'candles', 'aluminum foil', 'parchment paper',
    'cling wrap', 'band-aids', 'vitamins', 'diapers', 'sunscreen',
  ],
  diepvries: [
    'diepvries', 'bevroren', 'ijsje', 'ijs', 'ijsjes', 'vriesvers',
    'diepvriespizza', 'pizza diepvries', 'diepvriesgroente', 'doperwten diepvries',
    'frites', 'friet', 'patat', 'kroketten', 'bitterballen', 'frikandel',
    'loempia', 'spring roll', 'diepvries vis', 'visstick', 'kibbeling',
    'spinazie diepvries', 'roerbakgroente', 'garnalen diepvries',
    // English
    'frozen', 'ice cream', 'fries', 'french fries', 'fish sticks',
    'frozen pizza', 'frozen vegetables', 'frozen fish',
  ],
};

function categorize(itemName: string): RouteCategory {
  const lower = itemName.toLowerCase().trim();

  // Remove leading quantity (e.g. "2 bananen" → "bananen")
  const withoutQty = lower.replace(/^\d+(?:[.,]\d+)?\s+/, '');

  for (const category of ROUTE_ORDER) {
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      if (withoutQty.includes(keyword) || keyword.includes(withoutQty)) {
        return category;
      }
    }
  }

  // Default: houdbaar (middle of the store)
  return 'houdbaar';
}

export interface CategorizedItem<T> {
  category: RouteCategory;
  label: string;
  items: T[];
}

export function sortByStoreRoute<T extends { name: string }>(items: T[]): CategorizedItem<T>[] {
  const grouped = new Map<RouteCategory, T[]>();

  for (const cat of ROUTE_ORDER) {
    grouped.set(cat, []);
  }

  for (const item of items) {
    const cat = categorize(item.name);
    grouped.get(cat)!.push(item);
  }

  return ROUTE_ORDER
    .filter((cat) => grouped.get(cat)!.length > 0)
    .map((cat) => ({
      category: cat,
      label: ROUTE_LABELS[cat],
      items: grouped.get(cat)!,
    }));
}
