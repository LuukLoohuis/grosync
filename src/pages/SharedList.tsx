import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Plus, Trash2, X, Link2 } from 'lucide-react';
import groveraLogo from '@/assets/grovera-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SharedItem {
  id: string;
  name: string;
  checked: boolean;
  from_recipe: string | null;
  list_id: string;
  created_at: string;
}

const SharedList = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [listId, setListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const [items, setItems] = useState<SharedItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Load list and items
  useEffect(() => {
    if (!shareCode) return;

    const loadList = async () => {
      const { data: list, error } = await supabase
        .from('shared_lists')
        .select('*')
        .eq('share_code', shareCode)
        .maybeSingle();

      if (error || !list) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setListId(list.id);
      setListName(list.name);

      const { data: itemsData } = await supabase
        .from('shared_grocery_items')
        .select('*')
        .eq('list_id', list.id)
        .order('created_at', { ascending: true });

      setItems(itemsData || []);
      setLoading(false);
    };

    loadList();
  }, [shareCode]);

  // Real-time subscription
  useEffect(() => {
    if (!listId) return;

    const channel = supabase
      .channel(`shared-list-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_grocery_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => {
              if (prev.find((i) => i.id === (payload.new as SharedItem).id)) return prev;
              return [...prev, payload.new as SharedItem];
            });
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((i) => (i.id === (payload.new as SharedItem).id ? (payload.new as SharedItem) : i))
            );
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  const handleAdd = async () => {
    if (!newItem.trim() || !listId) return;
    const { error } = await supabase.from('shared_grocery_items').insert({
      list_id: listId,
      name: newItem.trim(),
    });
    if (!error) setNewItem('');
  };

  const toggleItem = async (id: string, checked: boolean) => {
    await supabase.from('shared_grocery_items').update({ checked: !checked }).eq('id', id);
  };

  const removeItem = async (id: string) => {
    await supabase.from('shared_grocery_items').delete().eq('id', id);
  };

  const clearAll = async () => {
    if (!listId) return;
    await supabase.from('shared_grocery_items').delete().eq('list_id', listId);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link gekopieerd!');
  };

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

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={groveraLogo} alt="Grovera" className="h-12 w-12" />
            <div>
              <h1 className="font-display text-xl text-foreground">{listName}</h1>
              <p className="text-xs text-muted-foreground">Gedeeld lijstje 🛒</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={copyLink} title="Kopieer link">
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Add item */}
        <div className="flex gap-2">
          <Input
            placeholder="Item toevoegen..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="bg-card border-border font-body"
          />
          <Button onClick={handleAdd} size="icon" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Clear all */}
        {items.length > 0 && (
          <div className="flex justify-end">
            <button onClick={clearAll} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Alles wissen
            </button>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-display">Het lijstje is leeg</p>
            <p className="text-sm mt-1">Voeg hierboven items toe!</p>
          </div>
        )}

        {/* Unchecked */}
        <div className="space-y-2">
          {unchecked.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-soft animate-fade-in group">
              <button
                onClick={() => toggleItem(item.id, item.checked)}
                className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center hover:bg-primary/10 transition-colors"
              />
              <div className="flex-1 min-w-0">
                <span className="font-body">{item.name}</span>
                {item.from_recipe && <span className="text-xs text-muted-foreground ml-2">from {item.from_recipe}</span>}
              </div>
              <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Checked */}
        {checked.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground font-medium">Afgevinkt ({checked.length})</span>
            {checked.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
                <button
                  onClick={() => toggleItem(item.id, item.checked)}
                  className="h-5 w-5 rounded-full bg-primary shrink-0 flex items-center justify-center animate-check-bounce"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </button>
                <span className="font-body line-through text-muted-foreground flex-1">{item.name}</span>
                <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedList;
