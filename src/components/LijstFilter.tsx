import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { WinkelStip } from '@/components/WinkelLabel';
import { DEPARTMENT_CHIP, DEPARTMENT_DOT } from '@/components/DepartmentHeading';
import { huiskleur } from '@/lib/winkels';
import type { Department } from '@/lib/storeRouteSort';
import { t } from '@/lib/i18n';

export type ListOrder = 'department' | 'added';

interface Groep {
  category: Department;
  label: string;
  count: number;
}

interface LijstFilterProps {
  /** Winkels op de lijst met het aantal open boodschappen; null = alle winkels. */
  winkels: { winkel: string | null; aantal: number }[];
  actieveWinkel: string | null;
  onWinkel: (winkel: string | null) => void;
  /** Afdelingen in de gekozen winkel; leeg bij "op volgorde". */
  groepen: Groep[];
  afdeling: Department | null;
  onAfdeling: (afdeling: Department | null) => void;
  order: ListOrder;
  onOrder: (order: ListOrder) => void;
}

const korteAfdeling = (label: string) => label.split(' ')[0].replace(',', '');

const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold transition-colors duration-150 ease-smooth';
const uit = 'border border-border bg-card text-muted-foreground hover:text-foreground';
const aan = 'bg-foreground text-background';

/**
 * Winkel, afdeling en volgorde achter één knop: boven de lijst staat zo één
 * rij, en de boodschappen zelf komen in beeld. De knop zegt wat er gekozen is.
 */
const LijstFilter = ({ winkels, actieveWinkel, onWinkel, groepen, afdeling, onAfdeling, order, onOrder }: LijstFilterProps) => {
  const [open, setOpen] = useState(false);
  const afdelingLabel = groepen.find((g) => g.category === afdeling)?.label;
  const gekozen = [actieveWinkel, afdelingLabel && korteAfdeling(afdelingLabel)].filter(Boolean) as string[];
  const actief = gekozen.length > 0;

  return (
    <>
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={`inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 ease-smooth ${
            actief ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground'
          } ${actief ? 'rounded-r-none pr-2' : '-ml-3.5'}`}
        >
          {!actief && <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0" />}
          <span className="truncate">
            {actief ? gekozen.join(' · ') : order === 'department' ? t("Op afdeling") : t("Op volgorde")}
          </span>
        </button>
        {actief && (
          <button
            type="button"
            onClick={() => { onWinkel(null); onAfdeling(null); }}
            aria-label={t("Filter wissen")}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-r-full bg-primary-soft text-primary hover:bg-primary-soft/70"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="font-display text-xl">{t("Wat wil je zien?")}</SheetTitle>
            <SheetDescription>{t("De lijst past zich meteen aan.")}</SheetDescription>
          </SheetHeader>

          <div className="mt-2 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-foreground">{t("Volgorde")}</legend>
              <div role="radiogroup" aria-label={t("Volgorde")} className="grid grid-cols-2 gap-1 rounded-[14px] bg-muted p-1">
                {(['department', 'added'] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={order === o}
                    onClick={() => onOrder(o)}
                    className={`min-h-11 rounded-[10px] text-sm font-semibold transition-colors duration-150 ease-smooth ${
                      order === o ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {o === 'department' ? t("Op afdeling") : t("Zoals toegevoegd")}
                  </button>
                ))}
              </div>
            </fieldset>

            {winkels.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-foreground">{t("Winkel")}</legend>
                <div role="radiogroup" aria-label={t("Winkel")} className="flex flex-wrap gap-2">
                  {winkels.map(({ winkel: w, aantal }) => {
                    const kies = w === actieveWinkel;
                    return (
                      <button
                        key={w ?? ''}
                        type="button"
                        role="radio"
                        aria-checked={kies}
                        onClick={() => { onWinkel(w); onAfdeling(null); }}
                        className={`${chip} ${kies ? (huiskleur(w) ?? aan) : uit}`}
                      >
                        {!kies && <WinkelStip winkel={w} />}
                        {w ?? t("Alle winkels")}
                        <span className="tabular-nums opacity-70">{aantal}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {groepen.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-foreground">{t("Afdeling")}</legend>
                <div role="radiogroup" aria-label={t("Afdeling")} className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={afdeling === null}
                    onClick={() => onAfdeling(null)}
                    className={`${chip} ${afdeling === null ? aan : uit}`}
                  >
                    {t("Alles")}
                  </button>
                  {groepen.map((g) => {
                    const kies = afdeling === g.category;
                    return (
                      <button
                        key={g.category}
                        type="button"
                        role="radio"
                        aria-checked={kies}
                        onClick={() => onAfdeling(kies ? null : g.category)}
                        className={`${chip} ${kies ? `${DEPARTMENT_CHIP[g.category]} text-foreground ring-1 ring-current` : uit}`}
                      >
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DEPARTMENT_DOT[g.category]}`} />
                        {korteAfdeling(g.label)}
                        <span className="tabular-nums opacity-70">{g.count}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          <Button variant="outline" className="mt-6 min-h-12 w-full" onClick={() => setOpen(false)}>
            {t("Klaar")}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default LijstFilter;
