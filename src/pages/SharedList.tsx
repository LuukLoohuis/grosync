import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, ChefHat, Link2, Star } from 'lucide-react';
import couplecartLogo from '@/assets/couplecart-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AppProvider } from '@/contexts/AppContext';
import GroceryList from '@/components/GroceryList';
import RecipeList from '@/components/RecipeList';
import UsualsList from '@/components/UsualsList';

const SharedListContent = () => {
  const [tab, setTab] = useState<'list' | 'usuals' | 'recipes'>('list');

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link gekopieerd!');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={couplecartLogo} alt="CoupleCart" className="h-16 w-auto" />
            <div>
              <h1 className="font-display text-xl text-foreground">CoupleCart</h1>
              <p className="text-xs text-muted-foreground">Gedeeld lijstje 🛒</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={copyLink} title="Kopieer link">
            <Link2 className="h-4 w-4" />
          </Button>
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
            <ShoppingCart className="h-4 w-4" /> Boodschappen
          </button>
          <button
            onClick={() => setTab('usuals')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === 'usuals' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-4 w-4" /> Usuals
          </button>
          <button
            onClick={() => setTab('recipes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === 'recipes' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChefHat className="h-4 w-4" /> Recepten
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

const SharedList = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareCode) return;

    const loadList = async () => {
      const { data: lists, error } = await supabase
        .rpc('get_shared_list_by_code', { _share_code: shareCode });
      const list = lists?.[0] ?? null;

      if (error || !list || !list.user_id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setUserId(list.user_id);
      setLoading(false);
    };

    loadList();
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-display text-foreground">Lijstje niet gevonden</p>
          <p className="text-muted-foreground mt-2">Controleer de link en probeer opnieuw.</p>
        </div>
      </div>
    );
  }

  return (
    <AppProvider userId={userId}>
      <SharedListContent />
    </AppProvider>
  );
};

export default SharedList;
