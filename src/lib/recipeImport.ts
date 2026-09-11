import type { FetchedRecipe } from '@/services/recipeApi';

export type ImportInput = { kind: 'url'; url: string } | { kind: 'text'; text: string };

// A link shared into CoupleCart (iOS shortcut, Android share target) that has to
// survive the login screen.
export const PENDING_IMPORT_KEY = 'couplecart-pending-import';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/**
 * Decides whether pasted input is a link or recipe text. Share sheets often put a
 * few words around the link ("Check this out https://vm.tiktok.com/…"); that still
 * counts as a link. A caption that only contains a link counts as text, because
 * fetch-url-meta follows links inside text anyway.
 */
export function detectImportInput(value: string): ImportInput | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(URL_PATTERN);
  if (match && trimmed.replace(match[0], '').trim().length < 40) {
    return { kind: 'url', url: match[0].replace(/[.,!?)]+$/, '') };
  }
  return { kind: 'text', text: trimmed };
}

export type SourceKey = NonNullable<FetchedRecipe['extractedFrom']> | 'text';

export const SOURCE_LABELS: Record<SourceKey, string> = {
  page: 'Van de website',
  description: 'Uit de beschrijving',
  'linked-page': 'Van de receptsite achter de link',
  video: 'Uit de video · hoeveelheden nakijken',
  none: 'Geen recept gevonden',
  text: 'Uit geplakte tekst',
};

/**
 * fetch-url-meta answers only when it is done, so these steps follow the elapsed
 * time rather than the real progress.
 */
export function progressLabel(elapsedMs: number, input: ImportInput): string {
  if (input.kind === 'text') return 'Recept zoeken…';
  if (elapsedMs < 3000) return 'Link lezen…';
  if (elapsedMs < 12000) return 'Recept zoeken…';
  return /youtu\.?be|instagram\.com/i.test(input.url) ? 'Nog even, we kijken de video…' : 'Nog even geduld…';
}

const ESTIMATE_PREFIX = /^ca\.\s*/i;

/** The video analysis in fetch-url-meta marks guessed quantities with "ca.". */
export const isEstimated = (ingredient: string) => ESTIMATE_PREFIX.test(ingredient.trim());
export const withoutEstimate = (ingredient: string) => ingredient.trim().replace(ESTIMATE_PREFIX, '');
