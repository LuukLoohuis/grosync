import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FEATURE_LABEL, FREE_LIMIT, type MeteredFeature } from '@/hooks/useEntitlements';
import PlusAanbod from '@/components/PlusAanbod';
import { locale, t } from '@/lib/i18n';

interface PlusSheetProps {
  /** The feature that ran out, or null when the sheet is closed. */
  feature: MeteredFeature | null;
  onClose: () => void;
}

/** The first day of next month, when the free allowance fills up again. */
const resetDate = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
};

const PlusSheet = ({ feature, onClose }: PlusSheetProps) => (
  <Sheet open={Boolean(feature)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-[20px]">
      <SheetHeader className="pr-10 text-left">
        <SheetTitle className="font-display text-xl">
          {t('Je {0} {1} van deze maand zijn op', [FREE_LIMIT, feature ? FEATURE_LABEL[feature] : ''])}
        </SheetTitle>
        <SheetDescription>
          {t('Op {0} staat je tegoed weer op {1}. Je lijst, je recepten en je voorraad blijven gewoon werken.', [resetDate(), FREE_LIMIT])}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5">
        <PlusAanbod />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("Hulp nodig?")}{' '}
        <a className="font-medium text-primary hover:underline" href="mailto:info.couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
          info.couplecart@gmail.com
        </a>
      </p>

      <Button variant="outline" className="mt-3 min-h-12 w-full" onClick={onClose}>{t("Nu even niet")}</Button>
    </SheetContent>
  </Sheet>
);

export default PlusSheet;
