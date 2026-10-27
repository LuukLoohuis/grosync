import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { authFoutmelding } from '@/lib/authFout';
import { t } from '@/lib/i18n';
import { nieuwWachtwoordGekozen } from '@/lib/wachtwoordHerstel';

/**
 * The link from "Wachtwoord vergeten?" signs you in; until you have chosen a new password, this
 * screen takes the place of the app (see ProtectedRoute and wachtwoordHerstel). Cancelling signs
 * you out on this device, so the link never leaves you signed in without a password you know.
 */
const NieuwWachtwoord = ({ email }: { email?: string }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bezig, setBezig] = useState<'opslaan' | 'annuleren' | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const opslaan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBezig('opslaan');
    setFout(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBezig(null);
    if (error) {
      console.warn('Password update failed:', error);
      setFout(t(authFoutmelding(error, 'nieuw-wachtwoord')));
      return;
    }
    toast.success(t('Je nieuwe wachtwoord is opgeslagen.'));
    nieuwWachtwoordGekozen();
  };

  const annuleren = async () => {
    setBezig('annuleren');
    setFout(null);
    // Only this device: elsewhere you may still be signed in, with Google or the old password.
    // Once signed out, wachtwoordHerstel forgets the reset and ProtectedRoute shows the login.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      setBezig(null);
      setFout(t(authFoutmelding(error, 'nieuw-wachtwoord')));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo className="h-auto w-[min(16rem,70vw)]" />
        </div>

        <div className="mt-7 space-y-3">
          <div className="text-left">
            <h1 className="font-display text-xl font-bold text-foreground">{t('Kies een nieuw wachtwoord')}</h1>
            <p className="mt-1 text-sm leading-[1.45] text-muted-foreground">
              {email ? t('Voor {0}. Hiermee log je voortaan in.', [email]) : t('Hiermee log je voortaan in.')}
            </p>
          </div>

          <form onSubmit={opslaan} className="space-y-2.5 text-left">
            {/* Tells password managers which account the new password belongs to. */}
            <input type="email" autoComplete="username" value={email ?? ''} readOnly hidden />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('Nieuw wachtwoord')}
                aria-label={t('Nieuw wachtwoord')}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
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
              <KeyRound className="h-4 w-4" />
              {bezig === 'opslaan' ? t('Even geduld…') : t('Wachtwoord opslaan')}
            </Button>
          </form>

          {fout && (
            <p role="alert" className="rounded-[12px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-left text-sm text-destructive">
              {fout}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={annuleren}
          disabled={bezig !== null}
          className="mt-6 min-h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {bezig === 'annuleren' ? t('Even geduld…') : t('Annuleren en uitloggen')}
        </button>
      </div>
    </div>
  );
};

export default NieuwWachtwoord;
