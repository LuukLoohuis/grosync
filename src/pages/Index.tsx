import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, ChefHat, Boxes, Home, Tag, type LucideIcon } from 'lucide-react';
import GroceryList from '@/components/GroceryList';
import RecipeList from '@/components/RecipeList';
import PantryScreen from '@/components/PantryScreen';
import TodayScreen from '@/components/TodayScreen';
import BonusChef from '@/components/BonusChef';
import HeaderActions from '@/components/HeaderActions';
import OfflineBanner from '@/components/OfflineBanner';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { useIdleTabBar } from '@/hooks/useIdleTabBar';
import { PENDING_IMPORT_KEY } from '@/lib/recipeImport';
import { t } from '@/lib/i18n';

type AppTab = 'today' | 'list' | 'recipes' | 'bonus' | 'pantry';

const TABS: { key: AppTab; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: t('Vandaag'), icon: Home },
  { key: 'list', label: t('Lijst'), icon: ShoppingCart },
  { key: 'recipes', label: t('Recepten'), icon: ChefHat },
  { key: 'bonus', label: t('Bonus'), icon: Tag },
  { key: 'pantry', label: t('Voorraad'), icon: Boxes },
];

const Index = () => {
  const [tab, setTab] = useState<AppTab>('today');
  const { groceryItems, refreshEntitlements } = useAppContext();
  const uncheckedCount = groceryItems.filter((i) => !i.checked).length;
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const onToday = tab === 'today';
  const barVisible = useIdleTabBar();

  // Vegen tussen de tabs, met de volgorde van de balk. Begint de veeg in iets
  // dat zelf zijwaarts schuift (een rij chips), dan is het geen tabwissel.
  const veeg = useRef<{ x: number; y: number; laat: boolean } | null>(null);
  const veegStart = (e: TouchEvent<HTMLElement>) => {
    const vinger = e.touches[0];
    let el = e.target as HTMLElement | null;
    let laat = false;
    while (el && el !== e.currentTarget) {
      if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) { laat = true; break; }
      el = el.parentElement;
    }
    veeg.current = { x: vinger.clientX, y: vinger.clientY, laat };
  };
  const veegEind = (e: TouchEvent<HTMLElement>) => {
    const start = veeg.current;
    veeg.current = null;
    if (!start || start.laat) return;
    const vinger = e.changedTouches[0];
    const dx = vinger.clientX - start.x;
    const dy = vinger.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const i = TABS.findIndex((item) => item.key === tab);
    const volgende = TABS[i + (dx < 0 ? 1 : -1)];
    if (volgende) setTab(volgende.key);
  };

  // Terug van Stripe: #/?plus=gelukt of ?plus=afgebroken.
  useEffect(() => {
    const plus = searchParams.get('plus');
    if (!plus) return;
    setSearchParams({}, { replace: true });
    if (plus === 'gelukt') {
      toast.success(t("Welkom bij Plus"), { description: t("Alles staat voor jullie allebei open.") });
      // Stripe meldt het via de webhook; even later staat het er.
      window.setTimeout(() => { void refreshEntitlements(); }, 2500);
    } else {
      toast(t("Betaling afgebroken"), { description: t("Er is niets afgeschreven.") });
    }
  }, [searchParams, setSearchParams, refreshEntitlements]);

  // A link shared into CoupleCart arrives as #/?import=… (iOS shortcut, Android share target).
  useEffect(() => {
    const fromUrl = searchParams.get('import');
    const fromLogin = sessionStorage.getItem(PENDING_IMPORT_KEY);
    const value = fromUrl || fromLogin;
    if (!value) return;
    sessionStorage.removeItem(PENDING_IMPORT_KEY);
    if (fromUrl) setSearchParams({}, { replace: true });
    setTab('recipes');
    setPendingImport(value);
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      {/* "Vandaag" brings its own green header */}
      {!onToday && (
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
            <img src="/favicon.png" alt="" className="h-9 w-9 shrink-0 rounded-[10px]" width={36} height={36} />
            <h1 className="flex-1 truncate font-display text-xl font-bold tracking-[-0.01em] text-foreground">{t("CoupleCart")}</h1>
            <HeaderActions />
          </div>
        </header>
      )}

      <nav className="mx-auto hidden max-w-lg px-4 pt-4 sm:block" aria-label={t("Onderdelen")}>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tab === key ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} />
              {label}
              {key === 'list' && uncheckedCount > 0 && (
                <span className="min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[0.6875rem] font-bold leading-5 text-accent-foreground tabular-nums">
                  {uncheckedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main
        onTouchStart={veegStart}
        onTouchEnd={veegEind}
        className={`mx-auto min-h-[70vh] max-w-lg pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6 ${onToday ? 'sm:pt-4' : 'px-4 pt-4'}`}
      >
        {!onToday && <OfflineBanner className="mb-3" />}
        {onToday && <TodayScreen onNavigate={setTab} />}
        {tab === 'list' && <GroceryList onNavigate={setTab} />}
        {tab === 'recipes' && <RecipeList initialImport={pendingImport} onImportConsumed={() => setPendingImport(null)} onNavigate={setTab} />}
        {tab === 'bonus' && <BonusChef onNavigate={setTab} />}
        {tab === 'pantry' && <PantryScreen onNavigate={setTab} />}
      </main>

      <nav
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-smooth sm:hidden ${
          barVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-label={t("Onderdelen")}
      >
        <div className="grid h-16 grid-cols-5 px-1.5">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl text-[0.625rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`flex items-center justify-center rounded-[10px] px-3 py-1 transition-colors ${active ? 'bg-primary-soft' : ''}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                {label}
                {key === 'list' && uncheckedCount > 0 && (
                  <span className="absolute left-1/2 top-1 ml-2 min-w-[1.1rem] rounded-full bg-accent px-[5px] text-center text-[0.625rem] font-bold leading-4 text-accent-foreground tabular-nums">
                    {uncheckedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Index;
