import type { Recipe, RecipeCategory } from '@/types';

/**
 * Recipe categories: a handful of ready-made ones ("Vega", "Vis"), plus whatever
 * you make up yourself. Every category carries one colour from the palette in
 * index.css. The tints are written out per colour because Tailwind only keeps
 * class names it can see in the source.
 */
export const CATEGORY_COLORS = [
  'groen', 'terracotta', 'blauw', 'amber', 'olijf', 'paars', 'teal', 'roze',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const TINTS: Record<CategoryColor, string> = {
  groen: 'bg-[hsl(var(--cat-groen)/0.14)] text-[hsl(var(--cat-groen))] dark:bg-[hsl(var(--cat-groen)/0.2)]',
  terracotta: 'bg-[hsl(var(--cat-terracotta)/0.14)] text-[hsl(var(--cat-terracotta))] dark:bg-[hsl(var(--cat-terracotta)/0.2)]',
  blauw: 'bg-[hsl(var(--cat-blauw)/0.14)] text-[hsl(var(--cat-blauw))] dark:bg-[hsl(var(--cat-blauw)/0.2)]',
  amber: 'bg-[hsl(var(--cat-amber)/0.14)] text-[hsl(var(--cat-amber))] dark:bg-[hsl(var(--cat-amber)/0.2)]',
  olijf: 'bg-[hsl(var(--cat-olijf)/0.14)] text-[hsl(var(--cat-olijf))] dark:bg-[hsl(var(--cat-olijf)/0.2)]',
  paars: 'bg-[hsl(var(--cat-paars)/0.14)] text-[hsl(var(--cat-paars))] dark:bg-[hsl(var(--cat-paars)/0.2)]',
  teal: 'bg-[hsl(var(--cat-teal)/0.14)] text-[hsl(var(--cat-teal))] dark:bg-[hsl(var(--cat-teal)/0.2)]',
  roze: 'bg-[hsl(var(--cat-roze)/0.14)] text-[hsl(var(--cat-roze))] dark:bg-[hsl(var(--cat-roze)/0.2)]',
};

const DOTS: Record<CategoryColor, string> = {
  groen: 'bg-[hsl(var(--cat-groen))]',
  terracotta: 'bg-[hsl(var(--cat-terracotta))]',
  blauw: 'bg-[hsl(var(--cat-blauw))]',
  amber: 'bg-[hsl(var(--cat-amber))]',
  olijf: 'bg-[hsl(var(--cat-olijf))]',
  paars: 'bg-[hsl(var(--cat-paars))]',
  teal: 'bg-[hsl(var(--cat-teal))]',
  roze: 'bg-[hsl(var(--cat-roze))]',
};

const isColor = (value: string): value is CategoryColor => (CATEGORY_COLORS as readonly string[]).includes(value);

export const tintOf = (color: string) => TINTS[isColor(color) ? color : 'groen'];
export const dotOf = (color: string) => DOTS[isColor(color) ? color : 'groen'];

/** Ready-made categories, offered the first time and whenever one is still missing. */
export const PRESETS: { name: string; color: CategoryColor }[] = [
  { name: 'Vega', color: 'groen' },
  { name: 'Vlees', color: 'terracotta' },
  { name: 'Vis', color: 'blauw' },
  { name: 'Pasta', color: 'amber' },
  { name: 'Snel', color: 'teal' },
  { name: 'Oven', color: 'paars' },
  { name: 'Soep', color: 'olijf' },
  { name: 'Zoet', color: 'roze' },
];

/** The next unused colour, so two categories rarely look alike. */
export const nextColor = (taken: string[]): CategoryColor =>
  CATEGORY_COLORS.find((color) => !taken.includes(color)) ?? CATEGORY_COLORS[taken.length % CATEGORY_COLORS.length];

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The category as it is known, or a plain fallback for a label without a row. */
export const findCategory = (categories: RecipeCategory[], name: string): RecipeCategory =>
  categories.find((c) => sameName(c.name, name))
  // Een label dat nog geen eigen categorie is, houdt wel de kleur die erbij hoort.
  ?? { id: name, name, color: PRESETS.find((preset) => sameName(preset.name, name))?.color ?? 'groen' };

const MEAT = /\b(kip|kipfilet|gehakt|rund|rundvlees|varken|varkens\w*|spek|spekjes|worst|rookworst|biefstuk|ham|bacon|lam|lams\w*|kalkoen|shoarma|speklap|chorizo|salami|beef|chicken|pork)\b/i;
const FISH = /\b(vis|zalm|zalmfilet|tonijn|garnalen|garnaal|kabeljauw|mossel|mosselen|makreel|haring|forel|scampi|inktvis|ansjovis|salmon|shrimp|tuna)\b/i;
const PASTA = /\b(pasta|spaghetti|penne|macaroni|lasagne|tagliatelle|fusilli|noodles?|mie|ravioli|farfalle)\b/i;
const SOUP = /\b(soep|bouillon|soup)\b/i;

/**
 * A first guess at where a recipe belongs, from its name and ingredients. Only
 * used to pre-fill the form: you see the label before it is saved.
 */
export const suggestCategories = (name: string, ingredients: string[]): string[] => {
  const text = [name, ...ingredients].join(' ').toLowerCase();
  const found: string[] = [];
  if (FISH.test(text)) found.push('Vis');
  else if (MEAT.test(text)) found.push('Vlees');
  else found.push('Vega');
  if (SOUP.test(text)) found.push('Soep');
  else if (PASTA.test(text)) found.push('Pasta');
  return found.slice(0, 2);
};

/** Every label in use, so a category made on an older phone still shows up. */
export const usedCategories = (recipes: Recipe[]) => {
  const names: string[] = [];
  for (const recipe of recipes) {
    for (const name of recipe.categories ?? []) {
      if (!names.some((known) => sameName(known, name))) names.push(name);
    }
  }
  return names;
};

export const countPerCategory = (recipes: Recipe[]) => {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const name of recipe.categories ?? []) {
      const key = name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};
