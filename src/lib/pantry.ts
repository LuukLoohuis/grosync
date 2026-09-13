/** Three states instead of numbers: a photo cannot count jars, and neither will you. */
export type PantryLevel = 'ruim' | 'bijna' | 'op';

export const PANTRY_LEVELS: PantryLevel[] = ['ruim', 'bijna', 'op'];

export const LEVEL_LABEL: Record<PantryLevel, string> = {
  ruim: 'Ruim',
  bijna: 'Bijna op',
  op: 'Op',
};

export const LEVEL_TINT: Record<PantryLevel, string> = {
  ruim: 'bg-primary-soft text-primary',
  bijna: 'bg-accent-soft text-accent-ink',
  op: 'bg-destructive/10 text-destructive',
};

/** One tap walks through the three states. */
export const nextLevel = (level: PantryLevel): PantryLevel =>
  PANTRY_LEVELS[(PANTRY_LEVELS.indexOf(level) + 1) % PANTRY_LEVELS.length];

export const isLevel = (value: string): value is PantryLevel =>
  (PANTRY_LEVELS as string[]).includes(value);

export const sameProduct = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
