import type { FetchedRecipe } from '@/services/recipeApi';
import { t } from '@/lib/i18n';
import type { Stap } from '@/lib/stappen';

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

const VIDEO_HOSTS = /youtu\.?be|instagram\.com|tiktok\.com|facebook\.com|fb\.watch/i;

/**
 * What fetch-url-meta does, as steps for StappenVoortgang. It answers only when
 * it is done, so the steps follow the elapsed time rather than the real progress.
 * Video links first try the caption and only then watch the video.
 */
export function importStappen(input: ImportInput): Stap[] {
  if (input.kind === 'text') {
    return [
      { label: t('Tekst lezen'), ms: 1500 },
      { label: t('Ingrediënten en bereiding ordenen'), ms: 6000 },
    ];
  }
  if (VIDEO_HOSTS.test(input.url)) {
    return [
      { label: t('Link openen'), ms: 2500 },
      { label: t('Beschrijving lezen, anders de video bekijken'), ms: 12000 },
      { label: t('Ingrediënten en bereiding uitschrijven'), ms: 8000 },
    ];
  }
  return [
    { label: t('Pagina openen'), ms: 2500 },
    { label: t('Recept op de pagina zoeken'), ms: 4000 },
    { label: t('Ingrediënten en bereiding ordenen'), ms: 6000 },
  ];
}

const ESTIMATE_PREFIX = /^ca\.\s*/i;

/** The video analysis in fetch-url-meta marks guessed quantities with "ca.". */
export const isEstimated = (ingredient: string) => ESTIMATE_PREFIX.test(ingredient.trim());
export const withoutEstimate = (ingredient: string) => ingredient.trim().replace(ESTIMATE_PREFIX, '');
