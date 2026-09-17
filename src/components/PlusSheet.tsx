import { useState } from 'react';
import { Camera, Check, Link2, Loader2, Sparkles, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FEATURE_LABEL, FREE_LIMIT, type MeteredFeature } from '@/hooks/useEntitlements';
import { BetalenUitError, PLUS_PRIJS, startCheckout, type PlusPlan } from '@/services/plusApi';
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

const PERKS = [
  { icon: Link2, text: t('Onbeperkt recepten ophalen uit een link of video') },
  { icon: Camera, text: t('Onbeperkt je kast scannen met een foto') },
  { icon: Sparkles, text: t('Bonuschef, receptsuggesties en voedingswaarden') },
  { icon: Tag, text: t('Eén keer voor jullie samen, ook voor je partner') },
];

const PlusSheet = ({ feature, onClose }: PlusSheetProps) => {
  const [bezig, setBezig] = useState<PlusPlan | null>(null);

  const afrekenen = async (plan: PlusPlan) => {
    setBezig(plan);
    try {
      await startCheckout(plan);
    } catch (error) {
      if (error instanceof BetalenUitError) {
        toast(t("Plus is er bijna"), { description: t('Betalen staat nog niet aan. Mail couplecart@gmail.com als je het eerder wil.') });
      } else {
        console.error('Afrekenen mislukt:', error);
        toast.error(t("Afrekenen lukte niet. Probeer het zo nog eens."));
      }
      setBezig(null);
    }
  };

  return (
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

      <div className="mt-5 rounded-[14px] border border-border bg-accent-soft p-4">
        <p className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">{t("CoupleCart Plus")}</p>
        <ul className="mt-3 space-y-2">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-foreground">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['maand', 'jaar'] as PlusPlan[]).map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => afrekenen(plan)}
              disabled={bezig !== null}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-[12px] px-2 text-center transition-transform duration-150 ease-smooth active:scale-[.98] disabled:opacity-60 ${
                plan === 'jaar' ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-border-strong bg-card text-foreground'
              }`}
            >
              {bezig === plan ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="font-display text-lg font-bold tabular-nums">{PLUS_PRIJS[plan].bedrag}</span>
                  <span className="text-[0.6875rem] opacity-80">{PLUS_PRIJS[plan].label.toLowerCase()}</span>
                  <span className={`mt-0.5 text-[0.625rem] ${plan === 'jaar' ? 'text-primary-muted' : 'text-muted-foreground'}`}>
                    {PLUS_PRIJS[plan].bij}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> {t("Opzeggen wanneer je wil, bij Stripe zelf")}
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("Hulp nodig?")}{' '}
        <a className="font-medium text-primary hover:underline" href="mailto:couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
          couplecart@gmail.com
        </a>
      </p>

      <Button variant="outline" className="mt-3 min-h-12 w-full" onClick={onClose}>{t("Nu even niet")}</Button>
    </SheetContent>
  </Sheet>
  );
};

export default PlusSheet;
