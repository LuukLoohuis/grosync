import { useState } from 'react';
import { Camera, ExternalLink, Link2, Loader2, ShoppingBasket } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import PlusAanbod from '@/components/PlusAanbod';
import { PlusMerk } from '@/components/PlusMerk';
import { useAppContext } from '@/contexts/AppContext';
import { FREE_LIMIT, type MeteredFeature } from '@/hooks/useEntitlements';
import { BetalenUitError, openPortal, PLUS_VANAF } from '@/services/plusApi';
import { locale, t } from '@/lib/i18n';

interface UsageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METERS: { feature: MeteredFeature; label: string; icon: typeof Camera }[] = [
  { feature: 'recept', label: t('Recepten ophalen'), icon: Link2 },
  { feature: 'kastfoto', label: t('Kast scannen'), icon: Camera },
  { feature: 'mandje', label: t('Prijzen zoeken bij AH'), icon: ShoppingBasket },
];

const resetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
};

/** What you have used this month, and what is left. */
const UsageSheet = ({ open, onOpenChange }: UsageSheetProps) => {
  const { plus, remaining } = useAppContext();
  const [bezig, setBezig] = useState(false);

  const beheren = async () => {
    setBezig(true);
    try {
      await openPortal();
    } catch (error) {
      if (error instanceof BetalenUitError) {
        toast(t("Je Plus is met de hand gegeven"), { description: t("Er staat geen abonnement bij Stripe om te beheren.") });
      } else {
        console.error('Klantportaal mislukt:', error);
        toast.error(t("Het klantportaal openen lukte niet."));
      }
      setBezig(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          {!plus && <PlusMerk maat="lg" className="mb-2" />}
          <SheetTitle className="font-display text-xl">{plus ? t("Je tegoed") : t("CoupleCart Plus")}</SheetTitle>
          <SheetDescription>
            {plus
              ? t("Je hebt Plus: alles onbeperkt.")
              : t("Alles onbeperkt en slimme hulp in de keuken. Vanaf {0} per maand.", [PLUS_VANAF])}
          </SheetDescription>
        </SheetHeader>

        {!plus && (
          <div className="mt-5">
            <PlusAanbod />
          </div>
        )}

        {!plus && (
          <section className="mt-6" aria-labelledby="tegoed-kop">
            <h3 id="tegoed-kop" className="text-sm font-semibold text-foreground">{t("Gratis deze maand")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("{0} van elk, voor de hele Cart Club samen. Op {1} weer vol.", [FREE_LIMIT, resetDate()])}
            </p>
            <ul className="mt-3 divide-y divide-border rounded-[14px] border border-border bg-card">
              {METERS.map(({ feature, label, icon: Icon }) => {
                const left = remaining(feature);
                return (
                  <li key={feature} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm text-foreground">{label}</span>
                      <span className={`text-sm font-semibold tabular-nums ${left === 0 ? 'text-accent-ink' : 'text-foreground'}`}>
                        {left === 0 ? t('op') : t('nog {0}', [left])}
                      </span>
                    </div>
                    {/* De balk toont wat er over is, net als het getal ernaast. */}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-smooth"
                        style={{ width: `${(left / FREE_LIMIT) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {plus && (
          <Button variant="outline" className="mt-4 min-h-12 w-full gap-2" onClick={beheren} disabled={bezig}>
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {t("Beheer je abonnement")}
          </Button>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("Hulp nodig?")}{' '}
          <a className="font-medium text-primary hover:underline" href="mailto:info.couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
            info.couplecart@gmail.com
          </a>
        </p>

        <Button variant={plus ? 'default' : 'outline'} className="mt-3 min-h-12 w-full" onClick={() => onOpenChange(false)}>
          {plus ? t("Klaar") : t("Nu even niet")}
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default UsageSheet;
