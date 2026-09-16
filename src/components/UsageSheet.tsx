import { useState } from 'react';
import { Camera, ExternalLink, Link2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { FREE_LIMIT, type MeteredFeature } from '@/hooks/useEntitlements';
import { BetalenUitError, openPortal } from '@/services/plusApi';

interface UsageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METERS: { feature: MeteredFeature; label: string; icon: typeof Camera }[] = [
  { feature: 'recept', label: 'Recepten ophalen', icon: Link2 },
  { feature: 'kastfoto', label: 'Kast scannen', icon: Camera },
];

const resetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
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
        toast('Je Plus is met de hand gegeven', { description: 'Er staat geen abonnement bij Stripe om te beheren.' });
      } else {
        console.error('Klantportaal mislukt:', error);
        toast.error('Het klantportaal openen lukte niet.');
      }
      setBezig(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">Je tegoed</SheetTitle>
          <SheetDescription>
            {plus
              ? 'Je hebt Plus: alles onbeperkt, voor jullie samen.'
              : `Elke maand vijf van allebei. Op ${resetDate()} staat de teller weer op nul.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {METERS.map(({ feature, label, icon: Icon }) => {
            const left = remaining(feature);
            const used = plus ? 0 : FREE_LIMIT - left;
            return (
              <div key={feature} className="rounded-[14px] border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-[0.9375rem] text-foreground">{label}</span>
                  <span className="font-display text-sm font-bold tabular-nums text-foreground">
                    {plus ? 'onbeperkt' : `${left} van ${FREE_LIMIT}`}
                  </span>
                </div>
                {!plus && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ease-smooth ${left === 0 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${(used / FREE_LIMIT) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!plus && (
          <div className="mt-4 rounded-[14px] border border-border bg-accent-soft p-4">
            <p className="flex items-center gap-2 font-display text-[0.9375rem] font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-accent-ink" /> CoupleCart Plus
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Onbeperkt recepten ophalen en scannen, voor het hele huishouden. Binnenkort te koop.
            </p>
          </div>
        )}

        {plus && (
          <Button variant="outline" className="mt-4 min-h-12 w-full gap-2" onClick={beheren} disabled={bezig}>
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Beheer je abonnement
          </Button>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Hulp nodig?{' '}
          <a className="font-medium text-primary hover:underline" href="mailto:couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
            couplecart@gmail.com
          </a>
        </p>

        <Button className="mt-3 min-h-12 w-full" onClick={() => onOpenChange(false)}>Klaar</Button>
      </SheetContent>
    </Sheet>
  );
};

export default UsageSheet;
