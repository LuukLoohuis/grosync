import { useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import AccountSheet from '@/components/AccountSheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { isGast } from '@/lib/accountUpgrade';
import { BetalenUitError, PLUS_PRIJS, startCheckout, type PlusPlan } from '@/services/plusApi';
import { locale, t } from '@/lib/i18n';
import { PLUS_GROEPEN } from '@/lib/plusPerks';

const euro = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' });
// Het jaarplan per maand, en wat dat per maand scheelt: het enige label, en het klopt altijd.
const JAAR_PER_MAAND = PLUS_PRIJS.jaar.cent / 12 / 100;
const SCHEELT_PER_MAAND = PLUS_PRIJS.maand.cent / 100 - JAAR_PER_MAAND;

const PLANNEN: PlusPlan[] = ['jaar', 'maand'];

/** What Plus gives, a plan to pick and one button; a guest first makes an account, so Plus survives logging out. */
const PlusAanbod = () => {
  const { session } = useAuth();
  const gast = isGast(session?.user);
  const [plan, setPlan] = useState<PlusPlan>('jaar');
  const [bezig, setBezig] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const afrekenen = async () => {
    setBezig(true);
    try {
      await startCheckout(plan);
    } catch (error) {
      if (error instanceof BetalenUitError) {
        toast(t("Plus is er bijna"), { description: t('Betalen staat nog niet aan. Mail info.couplecart@gmail.com als je het eerder wil.') });
      } else {
        console.error('Afrekenen mislukt:', error);
        toast.error(t("Afrekenen lukte niet. Probeer het zo nog eens."));
      }
      setBezig(false);
    }
  };

  return (
    <div>
      <div className="space-y-4 rounded-[16px] border border-border bg-card p-4 shadow-flat">
        {PLUS_GROEPEN.map(({ kop, perks }) => (
          <div key={kop}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{kop}</p>
            <ul className="mt-1.5 space-y-1.5">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-foreground">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" strokeWidth={2} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {gast ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Maak eerst een account. Dan blijft je Plus van jou, ook als je uitlogt of een nieuwe telefoon neemt.")}
          </p>
          <Button className="mt-3 min-h-12 w-full gap-2" onClick={() => setAccountOpen(true)}>
            <UserPlus className="h-4 w-4" /> {t("Account maken")}
          </Button>
          <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
        </>
      ) : (
        <>
          <fieldset className="mt-4 space-y-2" disabled={bezig}>
            <legend className="sr-only">{t('Kies je plan')}</legend>
            {PLANNEN.map((optie) => (
              <label
                key={optie}
                className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-border-strong bg-card px-4 py-3 transition-[border-color,background-color,box-shadow] duration-150 ease-smooth has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:shadow-[0_0_0_1px_hsl(var(--primary))] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 ring-offset-background"
              >
                <input
                  type="radio"
                  name="plus-plan"
                  value={optie}
                  checked={plan === optie}
                  onChange={() => setPlan(optie)}
                  className="peer sr-only"
                />
                {/* Eigen bolletje: een gevuld rondje met vinkje als hij gekozen is. */}
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong text-primary-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary">
                  <Check className="h-3 w-3 opacity-0 transition-opacity group-has-[:checked]:opacity-100" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="whitespace-nowrap font-semibold text-foreground">{PLUS_PRIJS[optie].label}</span>
                    {optie === 'jaar' && (
                      <span className="whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-accent-ink">
                        {t('Scheelt {0}/mnd', [euro.format(SCHEELT_PER_MAAND)])}
                      </span>
                    )}
                  </span>
                  {optie === 'jaar' && (
                    <span className="block text-xs tabular-nums text-muted-foreground">{t('dat is {0} per maand', [euro.format(JAAR_PER_MAAND)])}</span>
                  )}
                </span>
                <span className="font-display text-lg font-bold tabular-nums text-foreground">{PLUS_PRIJS[optie].bedrag}</span>
              </label>
            ))}
          </fieldset>

          <Button className="mt-3 min-h-[52px] w-full gap-2 text-base" onClick={() => void afrekenen()} disabled={bezig}>
            {bezig
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : t('Plus nemen · {0} {1}', [PLUS_PRIJS[plan].bedrag, PLUS_PRIJS[plan].label.toLowerCase()])}
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> {t("Opzeggen wanneer je wil, bij Stripe zelf")}
          </p>
        </>
      )}
    </div>
  );
};

export default PlusAanbod;
