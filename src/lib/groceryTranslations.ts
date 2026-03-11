// Common English grocery terms → Dutch translations for AH search
const translations: Record<string, string> = {
  // Proteins
  'chicken': 'kip',
  'chicken breast': 'kipfilet',
  'chicken thigh': 'kippendij',
  'ground chicken': 'kipgehakt',
  'beef': 'rundvlees',
  'ground beef': 'rundergehakt',
  'minced meat': 'gehakt',
  'pork': 'varkensvlees',
  'bacon': 'spek',
  'sausage': 'worst',
  'salmon': 'zalm',
  'shrimp': 'garnalen',
  'tuna': 'tonijn',
  'cod': 'kabeljauw',
  'eggs': 'eieren',
  'egg': 'ei',
  'tofu': 'tofu',

  // Dairy
  'milk': 'melk',
  'buttermilk': 'karnemelk',
  'cream': 'room',
  'heavy cream': 'slagroom',
  'sour cream': 'zure room',
  'butter': 'boter',
  'cheese': 'kaas',
  'cream cheese': 'roomkaas',
  'yogurt': 'yoghurt',
  'greek yogurt': 'griekse yoghurt',
  'whipped cream': 'slagroom',

  // Vegetables
  'onion': 'ui',
  'onions': 'uien',
  'garlic': 'knoflook',
  'tomato': 'tomaat',
  'tomatoes': 'tomaten',
  'potato': 'aardappel',
  'potatoes': 'aardappelen',
  'carrot': 'wortel',
  'carrots': 'wortelen',
  'bell pepper': 'paprika',
  'cucumber': 'komkommer',
  'lettuce': 'sla',
  'spinach': 'spinazie',
  'broccoli': 'broccoli',
  'mushroom': 'champignon',
  'mushrooms': 'champignons',
  'zucchini': 'courgette',
  'corn': 'mais',
  'peas': 'doperwten',
  'beans': 'bonen',
  'green beans': 'sperziebonen',
  'cabbage': 'kool',
  'cauliflower': 'bloemkool',
  'celery': 'selderij',
  'leek': 'prei',
  'eggplant': 'aubergine',
  'sweet potato': 'zoete aardappel',
  'ginger': 'gember',
  'avocado': 'avocado',

  // Fruits
  'apple': 'appel',
  'apples': 'appels',
  'banana': 'banaan',
  'bananas': 'bananen',
  'orange': 'sinaasappel',
  'oranges': 'sinaasappelen',
  'lemon': 'citroen',
  'lime': 'limoen',
  'strawberry': 'aardbei',
  'strawberries': 'aardbeien',
  'blueberries': 'blauwe bessen',
  'grapes': 'druiven',
  'pear': 'peer',
  'mango': 'mango',
  'pineapple': 'ananas',
  'watermelon': 'watermeloen',
  'peach': 'perzik',
  'cherry': 'kers',
  'cherries': 'kersen',
  'raspberry': 'framboos',
  'raspberries': 'frambozen',

  // Pantry
  'flour': 'bloem',
  'sugar': 'suiker',
  'salt': 'zout',
  'pepper': 'peper',
  'oil': 'olie',
  'olive oil': 'olijfolie',
  'vegetable oil': 'zonnebloemolie',
  'vinegar': 'azijn',
  'soy sauce': 'sojasaus',
  'rice': 'rijst',
  'pasta': 'pasta',
  'noodles': 'noedels',
  'bread': 'brood',
  'breadcrumbs': 'paneermeel',
  'honey': 'honing',
  'mustard': 'mosterd',
  'ketchup': 'ketchup',
  'mayonnaise': 'mayonaise',
  'tomato paste': 'tomatenpuree',
  'tomato sauce': 'tomatensaus',
  'coconut milk': 'kokosmelk',
  'peanut butter': 'pindakaas',
  'jam': 'jam',
  'cinnamon': 'kaneel',
  'cumin': 'komijn',
  'paprika': 'paprikapoeder',
  'oregano': 'oregano',
  'basil': 'basilicum',
  'parsley': 'peterselie',
  'cilantro': 'koriander',
  'thyme': 'tijm',
  'rosemary': 'rozemarijn',
  'bay leaves': 'laurierblaadjes',
  'chili flakes': 'chilivlokken',
  'baking powder': 'bakpoeder',
  'baking soda': 'zuiveringszout',
  'yeast': 'gist',
  'vanilla': 'vanille',
  'chocolate': 'chocolade',
  'cocoa powder': 'cacaopoeder',
  'cornstarch': 'maizena',
  'oats': 'havermout',
  'cereal': 'ontbijtgranen',
  'nuts': 'noten',
  'almonds': 'amandelen',
  'walnuts': 'walnoten',
  'peanuts': 'pinda\'s',

  // Drinks
  'water': 'water',
  'juice': 'sap',
  'orange juice': 'sinaasappelsap',
  'apple juice': 'appelsap',
  'coffee': 'koffie',
  'tea': 'thee',
  'beer': 'bier',
  'wine': 'wijn',

  // Other
  'ice cream': 'ijs',
  'frozen vegetables': 'diepvriesgroenten',
  'chips': 'chips',
  'crackers': 'crackers',
  'soup': 'soep',
  'wrap': 'wraps',
  'wraps': 'wraps',
  'tortilla': 'tortilla',
  'pizza': 'pizza',
};

/**
 * Translates an English grocery item name to Dutch for AH search.
 * Tries longest match first, then individual words.
 * Returns original if no translation found (assumes already Dutch).
 */
export function translateForSearch(name: string): string {
  const lower = name.toLowerCase().trim();

  // Try exact match first
  if (translations[lower]) return translations[lower];

  // Try matching the full phrase (without quantity)
  const stripped = lower.replace(/^\d+(?:[.,]\d+)?\s+/, '');
  if (translations[stripped]) return translations[stripped];

  // Try translating individual words
  const words = stripped.split(/\s+/);
  const translated = words.map(w => translations[w] || w);
  const result = translated.join(' ');

  // If nothing changed, return original
  return result;
}
