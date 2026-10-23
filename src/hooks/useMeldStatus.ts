import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type MeldStatus, meldStatus, zetMeldingenAan, zetMeldingenUit } from '@/lib/meldingen';
import { t } from '@/lib/i18n';

/** Of dit toestel meldingen krijgt, en aan- of uitzetten vanuit een tik. */
export const useMeldStatus = () => {
  const [status, setStatus] = useState<MeldStatus | null>(null);
  const [bezig, setBezig] = useState(false);

  const verfris = useCallback(async () => {
    setStatus(await meldStatus().catch((): MeldStatus => 'kan-niet'));
  }, []);

  useEffect(() => { void verfris(); }, [verfris]);

  const aan = useCallback(async () => {
    setBezig(true);
    try {
      const nieuw = await zetMeldingenAan();
      setStatus(nieuw);
      if (nieuw === 'aan') toast.success(t("Meldingen staan aan"));
      return nieuw;
    } catch (error) {
      console.error('Meldingen aanzetten mislukt:', error);
      toast.error(t("Meldingen aanzetten lukte niet. Probeer het opnieuw."));
      return null;
    } finally {
      setBezig(false);
    }
  }, []);

  const uit = useCallback(async () => {
    setBezig(true);
    try {
      await zetMeldingenUit();
      setStatus('uit');
    } catch (error) {
      console.error('Meldingen uitzetten mislukt:', error);
      toast.error(t("Uitzetten lukte niet. Probeer het opnieuw."));
    } finally {
      setBezig(false);
    }
  }, []);

  return { status, bezig, aan, uit, verfris };
};
