import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Eye, EyeOff } from 'lucide-react';
import couplecartLogo from '@/assets/couplecart-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });

  if (error) {
    console.error('Login error:', error);
    toast.error('Google login mislukt');
  }
};

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Verificatie e-mail verstuurd! Check je inbox en spamfolder.', { duration: 8000 });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error((error as Error).message || 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          {/* The artwork fills only the middle 29% of a square PNG; the negative
              margins crop the empty space so the logo itself can be big. */}
          <img
            src={couplecartLogo}
            alt="CoupleCart"
            className="-mb-[32%] -mt-[28%] w-[min(23rem,90vw)] max-w-full"
            width={1024}
            height={1024}
            fetchPriority="high"
          />
          <p className="font-display text-[1.375rem] font-bold tracking-[-0.01em] text-foreground">Two People. One Cart.</p>
        </div>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border-[1.5px] border-border-strong bg-white text-[0.9375rem] font-semibold text-[#1F1F1F] shadow-flat transition-[background-color,box-shadow,transform] duration-150 ease-smooth hover:shadow-soft active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Doorgaan met Google
          </button>

          <div className="flex items-center gap-3 py-1">
            <Separator className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground">of met e-mail</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-2.5 text-left">
            <Input
              type="email"
              placeholder="E-mailadres"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Wachtwoord"
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
                aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="min-h-12 w-full gap-2" disabled={loading}>
              <Mail className="h-4 w-4" />
              {loading ? 'Even geduld…' : isSignUp ? 'Account aanmaken' : 'Inloggen'}
            </Button>
          </form>

          {isSignUp && (
            <p className="rounded-xl bg-muted p-3 text-left text-xs leading-[1.45] text-muted-foreground">
              De verificatiemail kan in je <strong className="font-semibold text-foreground">spamfolder</strong> belanden.
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Al een account?' : 'Nog geen account?'}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-primary hover:underline">
              {isSignUp ? 'Inloggen' : 'Account aanmaken'}
            </button>
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            const { error } = await supabase.auth.signInAnonymously();
            if (error) {
              toast.error('Er ging iets mis bij het starten als gast');
              setLoading(false);
            }
          }}
          disabled={loading}
          className="mt-6 min-h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {loading ? 'Even geduld…' : 'Doorgaan zonder account'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
