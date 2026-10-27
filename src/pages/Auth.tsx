import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Mail, MailCheck, Eye, EyeOff, Loader2, RotateCw } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import InstallTip from '@/components/InstallTip';
import { authFoutmelding } from '@/lib/authFout';
import { t } from '@/lib/i18n';

const Auth = () => {
  const navigate = useNavigate();
  // Signing in, creating an account, or asking for a link to choose a new password.
  const [modus, setModus] = useState<'inloggen' | 'aanmaken' | 'vergeten'>('inloggen');
  const isSignUp = modus === 'aanmaken';
  const vergeten = modus === 'vergeten';
  // The address the last reset link went to, for "Check je mail".
  const [verstuurdNaar, setVerstuurdNaar] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // What went wrong last time, in Dutch under the form instead of Supabase's English message.
  // nietBevestigd: the address has no confirmed account yet, so offer the mail again.
  const [fout, setFout] = useState<{ tekst: string; nietBevestigd?: boolean } | null>(null);
  const [opnieuwBezig, setOpnieuwBezig] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/', { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // The link that opened the reset view is gone with it; put focus on the address instead.
  useEffect(() => {
    if (vergeten) emailRef.current?.focus();
  }, [vergeten]);

  const wisselModus = (nieuw: typeof modus) => {
    setModus(nieuw);
    setFout(null);
    setVerstuurdNaar(null);
  };

const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });

  if (error) {
    console.error('Login error:', error);
    toast.error(t("Google login mislukt"));
  }
};

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setFout(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // With email confirmation on, Supabase answers an address that already has an account
        // with a stand-in user without identities instead of an error, and sends no mail.
        if (data.user?.identities?.length === 0) {
          setFout({ tekst: t(authFoutmelding({ code: 'user_already_exists' }, 'aanmaken')) });
          return;
        }
        toast.success(t("Verificatie e-mail verstuurd! Check je inbox en spamfolder."), { duration: 8000 });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      console.warn('Email auth failed:', error);
      setFout({
        tekst: t(authFoutmelding(error as AuthError, isSignUp ? 'aanmaken' : 'inloggen')),
        nietBevestigd: (error as AuthError).code === 'email_not_confirmed',
      });
    } finally {
      setLoading(false);
    }
  };

  const stuurBevestigingOpnieuw = async () => {
    setOpnieuwBezig(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setOpnieuwBezig(false);
    if (error) {
      // Keep the button: after a rate limit, trying again a bit later is exactly what helps.
      setFout({ tekst: t(authFoutmelding(error, 'inloggen')), nietBevestigd: true });
      return;
    }
    setFout(null);
    toast.success(t('Nieuwe bevestigingsmail verstuurd. Kijk ook in je spamfolder.'), { duration: 8000 });
  };

  const stuurResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setFout(null);
    // The mail links back to this app (#access_token=…&type=recovery). Supabase does not say
    // whether the address has an account, so "Check je mail" does not either.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) {
      console.warn('Password reset mail failed:', error);
      setFout({ tekst: t(authFoutmelding(error, 'vergeten')) });
      return;
    }
    setVerstuurdNaar(email);
  };

  const knopTekst = loading
    ? t("Even geduld…")
    : vergeten
      ? verstuurdNaar === email ? t('Opnieuw sturen') : t('Stuur de link')
      : isSignUp ? t("Account aanmaken") : t("Inloggen");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo className="h-auto w-[min(16rem,70vw)]" />
        </div>

        <InstallTip className="mt-6" />

        <div className="mt-7 space-y-3">
          {vergeten ? (
            <div className="text-left">
              <h1 className="font-display text-xl font-bold text-foreground">{t('Wachtwoord vergeten?')}</h1>
              <p className="mt-1 text-sm leading-[1.45] text-muted-foreground">
                {t('Vul je e-mailadres in. Je krijgt een mail met een link om een nieuw wachtwoord te kiezen.')}
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border-[1.5px] border-border-strong bg-white text-[0.9375rem] font-semibold text-[#1F1F1F] shadow-flat transition-[background-color,box-shadow,transform] duration-150 ease-smooth hover:shadow-soft active:scale-[.99] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {t("Doorgaan met Google")}
              </button>

              <div className="flex items-center gap-3 py-1">
                <Separator className="flex-1" />
                <span className="text-xs font-medium text-muted-foreground">{t("of met e-mail")}</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <form onSubmit={vergeten ? stuurResetLink : handleEmailAuth} className="space-y-2.5 text-left">
            <Input
              ref={emailRef}
              type="email"
              placeholder={t("E-mailadres")}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {!vergeten && (
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t("Wachtwoord")}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("Verberg wachtwoord") : t("Toon wachtwoord")}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
            {modus === 'inloggen' && (
              <div className="-mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => wisselModus('vergeten')}
                  className="min-h-9 rounded-md px-1 text-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('Wachtwoord vergeten?')}
                </button>
              </div>
            )}
            <Button type="submit" className="min-h-12 w-full gap-2" disabled={loading}>
              <Mail className="h-4 w-4" />
              {knopTekst}
            </Button>
          </form>

          {fout && (
            <div className="space-y-2">
              <p role="alert" className="rounded-[12px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-left text-sm text-destructive">
                {fout.tekst}
              </p>
              {fout.nietBevestigd && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 w-full whitespace-normal py-2"
                  onClick={stuurBevestigingOpnieuw}
                  disabled={opnieuwBezig}
                >
                  {opnieuwBezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  {t('Stuur de bevestigingsmail opnieuw')}
                </Button>
              )}
            </div>
          )}

          {vergeten && verstuurdNaar && !fout && (
            <div role="status" className="rounded-[12px] bg-muted p-3 text-left text-sm leading-[1.45] text-muted-foreground">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <MailCheck className="h-4 w-4 shrink-0" /> {t('Check je mail')}
              </p>
              <p className="mt-1">
                {t('Hoort {0} bij een account, dan krijg je een mail met een link om een nieuw wachtwoord te kiezen.', [verstuurdNaar])}
              </p>
              <p className="mt-1">{t('Zie je niets? Kijk ook in je spamfolder.')}</p>
            </div>
          )}

          {isSignUp && (
            <p className="rounded-xl bg-muted p-3 text-left text-xs leading-[1.45] text-muted-foreground">
              {t('De verificatiemail kan in je spamfolder belanden.')}
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {vergeten ? (
              <button onClick={() => wisselModus('inloggen')} className="font-semibold text-primary hover:underline">
                {t('Terug naar inloggen')}
              </button>
            ) : (
              <>
                {isSignUp ? t("Al een account?") : t("Nog geen account?")}{' '}
                <button
                  onClick={() => wisselModus(isSignUp ? 'inloggen' : 'aanmaken')}
                  className="font-semibold text-primary hover:underline"
                >
                  {isSignUp ? t("Inloggen") : t("Account aanmaken")}
                </button>
              </>
            )}
          </p>
        </div>

        {!vergeten && (
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              const { error } = await supabase.auth.signInAnonymously();
              if (error) {
                toast.error(t("Er ging iets mis bij het starten als gast"));
                setLoading(false);
              }
            }}
            disabled={loading}
            className="mt-6 min-h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {loading ? t("Even geduld…") : t("Doorgaan zonder account")}
          </button>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a className="hover:underline" href="#/info/voorwaarden">{t("Voorwaarden")}</a>
          {' · '}
          <a className="hover:underline" href="#/info/privacy">{t("Privacy")}</a>
          {' · '}
          <a className="hover:underline" href="#/info/cookies">{t("Cookies")}</a>
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {t("Hulp nodig?")}{' '}
          <a className="font-medium text-primary hover:underline" href="mailto:info.couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
            info.couplecart@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default Auth;
