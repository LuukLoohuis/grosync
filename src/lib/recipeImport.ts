import type { FetchedRecipe } from '@/services/recipeApi';
import { t } from '@/lib/i18n';

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
  page: t('Van de website'),
  description: t('Uit de beschrijving'),
  'linked-page': t('Van de receptsite achter de link'),
  video: t('Uit de video · hoeveelheden nakijken'),
  none: t('Geen recept gevonden'),
  text: t('Uit geplakte tekst'),
};

/**
 * fetch-url-meta answers only when it is done, so these steps follow the elapsed
 * time rather than the real progress.
 */
export function progressLabel(elapsedMs: number, input: ImportInput): string {
  if (input.kind === 'text') return t('Recept zoeken…');
  if (elapsedMs < 3000) return t('Link lezen…');
  if (elapsedMs < 12000) return t('Recept zoeken…');
  return /youtu\.?be|instagram\.com/i.test(input.url) ? t('Nog even, we kijken de video…') : t('Nog even geduld…');
}

const ESTIMATE_PREFIX = /^ca\.\s*/i;

/** The video analysis in fetch-url-meta marks guessed quantities with "ca.". */
export const isEstimated = (ingredient: string) => ESTIMATE_PREFIX.test(ingredient.trim());
export const withoutEstimate = (ingredient: string) => ingredient.trim().replace(ESTIMATE_PREFIX, '');
