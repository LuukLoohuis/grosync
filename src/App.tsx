import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { PENDING_IMPORT_KEY } from "@/lib/recipeImport";
import { useAuth } from "@/hooks/useAuth";
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
  if (loading) return null;
  if (!session) {
    // Keep a link shared into the app (iOS shortcut, Android share) across the login screen.
    const pending = new URLSearchParams(location.search).get("import");
    if (pending) sessionStorage.setItem(PENDING_IMPORT_KEY, pending);
    return <Navigate to="/auth" replace />;
  }
  return (
    <AppProvider userId={session.user.id}>
      {children}
    </AppProvider>
  );
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
        <HashRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/shared/:shareCode" element={<SharedList />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/info/:deel" element={<Legal />} />
            <Route path="/info" element={<Legal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
