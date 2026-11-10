import type { ClubLid } from '@/hooks/useRecipes';
import { t } from '@/lib/i18n';

/** Hoe een clublid in het receptenoverzicht heet. Een gast heeft geen naam. */
export const clubNaam = (leden: ClubLid[], userId: string | undefined) => {
  const lid = leden.find((l) => l.userId === userId);
  if (lid?.jij) return t('Jij');
  return lid?.naam || t('Clublid');
};
