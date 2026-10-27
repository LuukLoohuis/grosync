import { useState } from 'react';
import { Camera, Check, Link2, Loader2, ShoppingBasket, Sparkles, Tag, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import AccountSheet from '@/components/AccountSheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { isGast } from '@/lib/accountUpgrade';
import { BetalenUitError, PLUS_PRIJS, startCheckout, type PlusPlan } from '@/services/plusApi';
import { t } from '@/lib/i18n';

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
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['maand', 'jaar'] as PlusPlan[]).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => afrekenen(plan)}
                disabled={bezig !== null}
                className={`flex min-h-18 flex-col items-center justify-center rounded-[12px] px-2 text-center transition-transform duration-150 ease-smooth active:scale-[.98] disabled:opacity-60 ${
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
        </>
      )}
    </div>
  );
};

export default PlusAanbod;
