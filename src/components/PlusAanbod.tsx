import { useState } from 'react';
import { Camera, Check, Link2, Loader2, ShoppingBasket, Sparkles, Tag, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import AccountSheet from '@/components/AccountSheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { isGast } from '@/lib/accountUpgrade';
import { BetalenUitError, PLUS_PRIJS, startCheckout, type PlusPlan } from '@/services/plusApi';
import { locale, t } from '@/lib/i18n';

const euro = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' });
// Het jaarplan per maand, en wat dat per maand scheelt: het enige label, en het klopt altijd.
const JAAR_PER_MAAND = PLUS_PRIJS.jaar.cent / 12 / 100;
const SCHEELT_PER_MAAND = PLUS_PRIJS.maand.cent / 100 - JAAR_PER_MAAND;

const PERKS = [
  { icon: Link2, text: t('Onbeperkt recepten ophalen uit een link of video') },
  { icon: Camera, text: t('Onbeperkt je kast scannen met een foto') },
  { icon: ShoppingBasket, text: t('Onbeperkt prijzen zoeken en vergelijken') },
  { icon: Sparkles, text: t('Bonuschef, receptsuggesties en voedingswaarden') },
  { icon: Tag, text: t('Eén keer voor de hele Cart Club') },
];

/** What Plus gives and the two prices; a guest first makes an account, so Plus survives logging out. */
const PlusAanbod = () => {
  const { session } = useAuth();
  const gast = isGast(session?.user);
  const [bezig, setBezig] = useState<PlusPlan | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const afrekenen = async (plan: PlusPlan) => {
    setBezig(plan);
    try {
      await startCheckout(plan);
    } catch (error) {
      if (error instanceof BetalenUitError) {
        toast(t("Plus is er bijna"), { description: t('Betalen staat nog niet aan. Mail info.couplecart@gmail.com als je het eerder wil.') });
      } else {
        console.error('Afrekenen mislukt:', error);
        toast.error(t("Afrekenen lukte niet. Probeer het zo nog eens."));
      }
      setBezig(null);
    }
  };

  return (
    <div className="rounded-[14px] border border-border bg-accent-soft p-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
        <Sparkles className="h-4 w-4 text-accent-ink" /> {t("CoupleCart Plus")}
      </p>
      <ul className="mt-3 space-y-2">
        {PERKS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-sm text-foreground">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
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
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(['maand', 'jaar'] as PlusPlan[]).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => afrekenen(plan)}
                disabled={bezig !== null}
                aria-label={plan === 'jaar'
                  ? t('{0} per jaar, {1} per maand, scheelt {2} per maand', [PLUS_PRIJS.jaar.bedrag, euro.format(JAAR_PER_MAAND), euro.format(SCHEELT_PER_MAAND)])
                  : t('{0} per maand', [PLUS_PRIJS.maand.bedrag])}
                className={`relative flex min-h-18 flex-col items-center justify-center rounded-[12px] px-2 pb-2.5 pt-4 text-center transition-transform duration-150 ease-smooth active:scale-[.98] disabled:opacity-60 ${
                  plan === 'jaar' ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-border-strong bg-card text-foreground'
                }`}
              >
                {plan === 'jaar' && (
                  <span aria-hidden="true" className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-accent-ink ring-1 ring-border">
                    {t('Scheelt {0}/mnd', [euro.format(SCHEELT_PER_MAAND)])}
                  </span>
                )}
                {bezig === plan ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span className="font-display text-lg font-bold tabular-nums">{PLUS_PRIJS[plan].bedrag}</span>
                    <span className="text-xs opacity-80">{PLUS_PRIJS[plan].label.toLowerCase()}</span>
                    {plan === 'jaar' && (
                      <span className="mt-0.5 text-[0.6875rem] tabular-nums text-primary-muted">
                        {t('dat is {0} per maand', [euro.format(JAAR_PER_MAAND)])}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> {t("Opzeggen wanneer je wil, bij Stripe zelf")}
          </p>
        </>
      )}
    </div>
  );
};

export default PlusAanbod;
