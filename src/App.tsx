import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PENDING_IMPORT_KEY } from "@/lib/recipeImport";
import { readAuthReturn } from "@/lib/authReturn";
import { neemAuthTerugkeer } from "@/lib/accountUpgrade";
import { t } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { AppProvider } from "@/contexts/AppContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SharedList from "./pages/SharedList";
import Admin from "./pages/Admin";
import Legal from "./pages/Legal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  // Gekoppeld aan iemand? Dan draait de hele app op diens lijst, recepten en kast.
  const household = useHousehold(session?.user.id ?? null);
  if (loading || household.loading) return null;
  if (!session) {
    // Keep a link shared into the app (iOS shortcut, Android share) across the login screen.
    const pending = new URLSearchParams(location.search).get("import");
    if (pending) sessionStorage.setItem(PENDING_IMPORT_KEY, pending);
    return <Navigate to="/auth" replace />;
  }
  return (
    <AppProvider userId={household.ownerId ?? session.user.id} selfId={session.user.id} household={household}>
      {children}
    </AppProvider>
  );
};

const authReturnFailed = (errorCode: string | null) => {
  toast.error(errorCode === "otp_expired"
    ? t("Deze link is verlopen of al gebruikt. Log in met je e-mailadres en wachtwoord.")
    : t("Inloggen lukte niet. Probeer het nog eens."));
};

/**
 * Back from Google or from a confirmation mail (see readAuthReturn). Supabase reads the link
 * itself and, when it worked, clears it from the address bar, which lands on "/". Until then
 * this shows nothing instead of "Deze pagina bestaat niet"; when it failed, it says why.
 * An error Supabase sends along (#error=…) rarely gets here: main.tsx takes it out of the URL
 * before the first render (vangAuthTerugkeer) and AccountSheet or SignedOutAuthError reports it.
 */
const AuthReturn = ({ errorCode }: { errorCode: string | null }) => {
  const navigate = useNavigate();
  useEffect(() => {
    let gone = false;
    void (async () => {
      const { error } = await supabase.auth.initialize();
      const { data: { session } } = await supabase.auth.getSession();
      if (gone) return;
      if (error) authReturnFailed(errorCode);
      navigate(session ? "/" : "/auth", { replace: true });
    })();
    return () => { gone = true; };
  }, [errorCode, navigate]);
  return null;
};

/**
 * The error main.tsx took out of the URL. Signed in, AccountSheet reports it (in the sheet for a
 * guest); signed out there is no AccountSheet, so this says why the link or Google did not work.
 */
const SignedOutAuthError = () => {
  const { session, loading } = useAuth();
  const signedIn = Boolean(session);
  useEffect(() => {
    if (loading || signedIn) return;
    const back = neemAuthTerugkeer();
    if (back?.terugkeer.soort === "fout") authReturnFailed(back.terugkeer.code);
  }, [loading, signedIn]);
  return null;
};

const UnknownRoute = () => {
  const { pathname } = useLocation();
  const authReturn = readAuthReturn(pathname);
  return authReturn ? <AuthReturn errorCode={authReturn.errorCode} /> : <NotFound />;
};

// Follows the phone's light or dark setting unless you pick one under "Thema".
const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="couplecart-theme" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Keep toasts above the bottom tab bar and the iPhone home indicator. Sonner uses
            mobileOffset instead of offset below 600px, so both need the bottom value.
            GroceryList raises --toast-offset while its AH price bar is showing. */}
        <Sonner
          position="bottom-center"
          offset={{ bottom: 'var(--toast-offset, calc(5.5rem + env(safe-area-inset-bottom)))' }}
          mobileOffset={{ bottom: 'var(--toast-offset, calc(5.5rem + env(safe-area-inset-bottom)))' }}
        />
        <SignedOutAuthError />
        <HashRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/shared/:shareCode" element={<SharedList />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/info/:deel" element={<Legal />} />
            <Route path="/info" element={<Legal />} />
            <Route path="*" element={<UnknownRoute />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
