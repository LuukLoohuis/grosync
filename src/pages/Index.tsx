import { useState } from 'react';
import { ShoppingCart, ChefHat, LogOut, Star } from 'lucide-react';
import GroceryList from '@/components/GroceryList';
import RecipeList from '@/components/RecipeList';
import UsualsList from '@/components/UsualsList';
import ShareButton from '@/components/ShareButton';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import grosyncLogo from '@/assets/grosync-logo.png';

const Index = () => {
  const [tab, setTab] = useState<'list' | 'usuals' | 'recipes'>('list');
  const { groceryItems } = useAppContext();
  const { signOut } = useAuth();
  const uncheckedCount = groceryItems.filter((i) => !i.checked).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col items-center">
            <img src={grosyncLogo} alt="GroSync" className="h-64 w-auto" />
            <p className="text-base font-bold text-muted-foreground -mt-16">Your shared grocery list 🛒</p>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => setTab('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === 'list' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="font-bold">List</span>
            {uncheckedCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {uncheckedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('usuals')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === 'usuals' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-4 w-4" />
            <span className="font-bold">Usuals</span>
          </button>
          <button
            onClick={() => setTab('recipes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === 'recipes' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChefHat className="h-4 w-4" />
            <span className="font-bold">Recipes</span>
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6">
        {tab === 'list' && <GroceryList />}
        {tab === 'usuals' && <UsualsList />}
        {tab === 'recipes' && <RecipeList />}
      </main>
    </div>
  );
};

export default Index;
