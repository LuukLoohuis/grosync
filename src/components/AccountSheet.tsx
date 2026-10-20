import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, MailCheck, RotateCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  accountFoutmelding, accountStap, isGast, markeerGoogleKoppeling, neemAuthTerugkeer, vergeetGoogleKoppeling,
} from '@/lib/accountUpgrade';
import { t } from '@/lib/i18n';

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Bezig = 'google' | 'email' | 'controle' | 'opnieuw' | null;

/** Na de bevestigingslink of Google komt de gebruiker terug op de start van de app. */
const terugUrl = () => `${window.location.origin}/`;

const GoogleLogo = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/** Bovenaan het ⋮-menu, alleen voor een gast. */
export const AccountMenuItem = ({ onSelect }: { onSelect: () => void }) => (
  <>
    <DropdownMenuItem className="min-h-11 cursor-pointer gap-2" onSelect={onSelect}>
      <UserPlus className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex flex-col">
        <span className="font-semibold">{t('Account aanmaken')}</span>
        <span className="text-xs opacity-70">{t('Houd je lijst, ook op andere toestellen')}</span>
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>
);

/**
 * Account maken als gast. Supabase koppelt een e-mailadres of Google-account
 * aan het bestaande anonieme id, dus lijst, recepten, kast en koppeling blijven.
 * E-mail: adres en wachtwoord gaan samen mee (Auth weigert een wachtwoord voor
 * een gast zonder adres); het account bestaat zodra de link in de mail open is.
 * Google: linkIdentity, waarvoor "manual linking" in Supabase aan moet staan.
 */
const AccountSheet = ({ open, onOpenChange }: AccountSheetProps) => {
  const { session, loading } = useAuth();
  const user = session?.user ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bezig, setBezig] = useState<Bezig>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [anderAdres, setAnderAdres] = useState(false);

  const basisStap = accountStap(user);
  const stap = anderAdres && basisStap === 'mail-verstuurd' ? 'kiezen' : basisStap;

  // Terug van Google of van de bevestigingslink: een fout opent dit vel, gelukt geeft een melding.
  useEffect(() => {
    if (loading) return;
    const terug = neemAuthTerugkeer();
    if (!terug) return;
    const { terugkeer, viaGoogle } = terug;
    if (terugkeer.soort === 'fout') {
      const melding = t(accountFoutmelding(terugkeer.code, viaGoogle ? 'google' : 'email'));
      if (isGast(user)) {
        setFout(melding);
        onOpenChange(true);
      } else {
        toast.error(melding);
      }
    } else if ((terugkeer.soort === 'email-bevestigd' || viaGoogle) && user && !isGast(user)) {
      toast.success(t('Je account is klaar. Je lijst blijft gewoon van jou.'));
    }
  }, [loading, user, onOpenChange]);

  // Met "terug" van Google zet Safari de pagina uit zijn cache terug zoals hij was: met
  // een draaiende Google-knop en het merkteken nog in de tab.
  useEffect(() => {
    const terugUitCache = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      vergeetGoogleKoppeling();
      setBezig(null);
    };
    window.addEventListener('pageshow', terugUitCache);
    return () => window.removeEventListener('pageshow', terugUitCache);
  }, []);

  // Wacht er een bevestiging, dan kijken we bij openen en bij terugkomen in de app of de
  // link al open is — ook als dat op een ander toestel of in een andere browser gebeurde.
  useEffect(() => {
    if (!open || basisStap !== 'mail-verstuurd') return;
    const kijk = () => void supabase.auth.refreshSession();
    const opZicht = () => {
      if (document.visibilityState === 'visible') kijk();
    };
    kijk();
    document.addEventListener('visibilitychange', opZicht);
    return () => document.removeEventListener('visibilitychange', opZicht);
  }, [open, basisStap]);

  const wisselOpen = (nu: boolean) => {
    if (!nu) {
      setFout(null);
      setAnderAdres(false);
      setPassword('');
      setShowPassword(false);
    }
    onOpenChange(nu);
  };

  const maakMetGoogle = async () => {
    setFout(null);
    setBezig('google');
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: terugUrl(), skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      setBezig(null);
      setFout(t(accountFoutmelding(error?.code, 'google')));
      return;
    }
    markeerGoogleKoppeling();
    window.location.assign(data.url);
  };

  const maakMetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const adres = email.trim();
    if (!adres || !password) return;
    setFout(null);
    setBezig('email');
    const opties = { emailRedirectTo: terugUrl() };
    let { error } = await supabase.auth.updateUser({ email: adres, password }, opties);
    // Een ander adres na een typfout, met hetzelfde wachtwoord: dat staat er al.
    if (error?.code === 'same_password') ({ error } = await supabase.auth.updateUser({ email: adres }, opties));
    setBezig(null);
    if (error) {
      setFout(t(accountFoutmelding(error.code, 'email')));
      return;
    }
    setPassword('');
    setAnderAdres(false);
  };

  const controleer = async () => {
    setFout(null);
    setBezig('controle');
    const { data, error } = await supabase.auth.refreshSession();
    setBezig(null);
    if (error) setFout(t(accountFoutmelding(error.code, 'email')));
    else if (isGast(data.user)) setFout(t('Nog niet bevestigd. Open de link in de mail en probeer het daarna opnieuw.'));
  };

  const stuurOpnieuw = async () => {
    if (!user?.new_email) return;
    setFout(null);
    setBezig('opnieuw');
    const { error } = await supabase.auth.updateUser({ email: user.new_email }, { emailRedirectTo: terugUrl() });
    setBezig(null);
    if (error) setFout(t(accountFoutmelding(error.code, 'email')));
    else toast.success(t('Nieuwe mail verstuurd'));
  };

  const titel = stap === 'klaar' ? t('Je account is klaar') : stap === 'mail-verstuurd' ? t('Check je mail') : t('Maak je account');
  const uitleg = stap === 'klaar'
    ? t('Je lijst blijft gewoon van jou. Log voortaan in met {0}, ook in de app op je beginscherm.', [user?.email])
    : stap === 'mail-verstuurd'
      ? t('We stuurden een bevestigingslink naar {0}. Open die link, op dit toestel of een ander, en je account is klaar.', [user?.new_email])
      : t('Je bent nu gast: je lijst staat alleen in deze browser. Met een account blijft alles van jou en log je overal in, ook in de app op je beginscherm.');

  return (
    <Sheet open={open} onOpenChange={wisselOpen}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90vh] [@supports(height:100dvh)]:max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
        <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
          <SheetTitle className="font-display text-xl">{titel}</SheetTitle>
          <SheetDescription>{uitleg}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 pt-1">
          {fout && stap !== 'klaar' && (
            <p role="alert" className="rounded-[12px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {fout}
            </p>
          )}

          {stap === 'kiezen' && (
            <>
              <button
                type="button"
                onClick={maakMetGoogle}
                disabled={bezig !== null}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border-[1.5px] border-border-strong bg-white text-[0.9375rem] font-semibold text-[#1F1F1F] shadow-flat transition-[background-color,box-shadow,transform] duration-150 ease-smooth hover:shadow-soft active:scale-[.99] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {bezig === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
                {t('Doorgaan met Google')}
              </button>

              <div className="flex items-center gap-3 py-1">
                <Separator className="flex-1" />
                <span className="text-xs font-medium text-muted-foreground">{t('of met e-mail')}</span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={maakMetEmail} className="space-y-2.5">
                <Input
                  type="email"
                  placeholder={t('E-mailadres')}
                  aria-label={t('E-mailadres')}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('Kies een wachtwoord')}
                    aria-label={t('Wachtwoord')}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('Verberg wachtwoord') : t('Toon wachtwoord')}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="submit" className="min-h-12 w-full gap-2" disabled={bezig !== null}>
                  {bezig === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {t('Account aanmaken')}
                </Button>
              </form>

              <p className="text-xs leading-[1.45] text-muted-foreground">
                {t('Je lijst, recepten en kast blijven gewoon staan. Je krijgt een mail om je adres te bevestigen.')}
              </p>
            </>
          )}

          {stap === 'mail-verstuurd' && (
            <>
              <p className="flex items-start gap-2 rounded-[12px] bg-muted p-3 text-xs leading-[1.45] text-muted-foreground">
                <MailCheck className="mt-px h-4 w-4 shrink-0" /> {t('Zie je niets? Kijk ook in je spamfolder.')}
              </p>
              <Button className="min-h-12 w-full gap-2" onClick={controleer} disabled={bezig !== null}>
                {bezig === 'controle' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('Ik heb bevestigd')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-11 gap-2" onClick={stuurOpnieuw} disabled={bezig !== null}>
                  {bezig === 'opnieuw' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  {t('Opnieuw sturen')}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={bezig !== null}
                  onClick={() => {
                    setFout(null);
                    setEmail(user?.new_email ?? email);
                    setAnderAdres(true);
                  }}
                >
                  {t('Ander adres')}
                </Button>
              </div>
            </>
          )}

          {stap === 'klaar' && (
            <Button className="min-h-12 w-full" onClick={() => wisselOpen(false)}>{t('Klaar')}</Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AccountSheet;
