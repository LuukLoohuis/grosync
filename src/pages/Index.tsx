import { useState } from 'react';
import { ShoppingCart, ChefHat, Star, CalendarDays, type LucideIcon } from 'lucide-react';
import GroceryList from '@/components/GroceryList';
import RecipeList from '@/components/RecipeList';
import UsualsList from '@/components/UsualsList';
import MealPlanner from '@/components/MealPlanner';
import AppMenu from '@/components/AppMenu';
import { useAppContext } from '@/contexts/AppContext';

type AppTab = 'list' | 'recipes' | 'planner' | 'usuals';

const TABS: { key: AppTab; label: string; title: string; icon: LucideIcon }[] = [
  { key: 'list', label: 'Lijst', title: 'Boodschappen', icon: ShoppingCart },
  { key: 'recipes', label: 'Recepten', title: 'Recepten', icon: ChefHat },
  { key: 'planner', label: 'Plan', title: 'Weekplan', icon: CalendarDays },
  { key: 'usuals', label: 'Favorieten', title: 'Favorieten', icon: Star },
];

const Index = () => {
  const [tab, setTab] = useState<AppTab>('list');
  const { groceryItems } = useAppContext();
  const uncheckedCount = groceryItems.filter((i) => !i.checked).length;
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center gap-3">
          <img src="/favicon.png" alt="CoupleCart" className="h-9 w-9 shrink-0 rounded-lg" width={36} height={36} />
          <h1 className="font-display text-xl text-foreground flex-1 truncate">{current.title}</h1>
          <AppMenu />
        </div>
      </header>

      <nav className="hidden sm:block max-w-lg mx-auto px-4 pt-4" aria-label="Onderdelen">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 min-h-11 rounded-md text-sm font-bold transition-all ${
                tab === key ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === 'list' && uncheckedCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums">
                  {uncheckedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6">
        {tab === 'list' && <GroceryList onNavigate={setTab} />}
        {tab === 'recipes' && <RecipeList />}
        {tab === 'planner' && <MealPlanner />}
        {tab === 'usuals' && <UsualsList />}
      </main>

      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-20 bg-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Onderdelen"
      >
        <div className="grid grid-cols-4 h-16">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                tab === key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {key === 'list' && uncheckedCount > 0 && (
                  <span className="absolute -top-2 left-3 bg-primary text-primary-foreground text-[10px] leading-4 rounded-full px-1 min-w-4 text-center tabular-nums">
                    {uncheckedCount}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
