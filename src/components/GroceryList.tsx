import { useState } from 'react';
import { Check, Plus, Trash2, X, Merge, Route, TrendingUp, ExternalLink, Loader2, ShoppingBasket, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { AH_MAX_ITEMS, ahBasketUrl, ahProductUrl, matchAhProducts } from '@/services/ahApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { translateForSearch } from '@/lib/groceryTranslations';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// Search links show on touch screens; on desktop they appear on hover.
const storeLinkClass = 'sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-0.5 text-xs font-semibold';

const GroceryList = () => {
  const [newItem, setNewItem] = useState('');
  const [routeMode, setRouteMode] = useState(false);
  const [pricing, setPricing] = useState(false);
  const { groceryItems, addGroceryItem, toggleGroceryItem, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems, applyAhMatches, frequentItems, trackPurchase } = useAppContext();

  const handleAdd = (name?: string) => {
    const item = (name || newItem).trim();
    if (item) {
      addGroceryItem(item);
      setNewItem('');
    }
  };

  const handleToggle = async (id: string) => {
    const item = groceryItems.find((i) => i.id === id);
    if (item && !item.checked) {
      trackPurchase(item.name);
    }
    toggleGroceryItem(id);
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);
  const pricedItems = unchecked.filter((i) => i.ahProduct);
  const ahTotal = pricedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);

  const fetchAhPrices = async () => {
    const batch = unchecked.slice(0, AH_MAX_ITEMS);
    if (batch.length === 0) return;
    setPricing(true);
    try {
      const { matches } = await matchAhProducts(batch.map(({ id, name }) => ({ id, name })));
      await applyAhMatches(matches);
      toast.success(matches.length === batch.length
        ? `Alle ${matches.length} boodschappen gevonden bij AH`
        : `${matches.length} van ${batch.length} boodschappen gevonden bij AH`);
    } catch (e) {
      console.error('AH prices failed:', e);
      toast.error('Kon geen AH-prijzen ophalen');
    } finally {
      setPricing(false);
    }
  };
  const categorized = routeMode ? sortByStoreRoute(unchecked) : null;

  // Filter suggestions
  const currentNames = groceryItems.map((i) => i.name.toLowerCase());
  const suggestions = frequentItems.filter((f) => !currentNames.includes(f.name));

  // Strip quantity prefix and translate for AH search
  const toSearchQuery = (name: string) => {
    const stripped = name.replace(/^\d+(?:[.,]\d+)?\s+/, '');
    const translated = translateForSearch(stripped);
    return encodeURIComponent(translated);
  };

  const renderItem = (item: typeof unchecked[0]) =>
    <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-soft animate-fade-in group">
      <button
        onClick={() => handleToggle(item.id)}
        className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center hover:bg-primary/10 transition-colors" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-body">{item.name}</span>
          {item.fromRecipe && <span className="text-xs text-muted-foreground">from {item.fromRecipe}</span>}
          <a
            href={`https://www.ah.nl/zoeken?query=${toSearchQuery(item.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Zoek op ah.nl"
            className={`${storeLinkClass} text-[#00811c] hover:text-[#006616]`}
          >
            AH <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={`https://www.jumbo.com/producten/?searchTerms=${toSearchQuery(item.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Zoek op jumbo.com"
            className={`${storeLinkClass} text-[#b58900] hover:text-[#8a6800]`}
          >
            Jumbo <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {item.ahProduct && (
          <a
            href={ahProductUrl(item.ahProduct.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">
              {item.ahProduct.quantity}× {item.ahProduct.title}{item.ahProduct.unitSize ? ` · ${item.ahProduct.unitSize}` : ''}
            </span>
            {item.ahProduct.isBonus && (
              <span className="shrink-0 rounded bg-[#ff7900]/15 px-1 font-semibold text-[#c25e00]">Bonus</span>
            )}
          </a>
        )}
      </div>
      {item.price != null && (
        <span className="text-sm font-medium tabular-nums shrink-0">{euro.format(item.price)}</span>
      )}
      <button onClick={() => removeGroceryItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>;

  return (
    <div className="space-y-6">
      {/* Add item */}
      <div className="flex gap-2">
        <Input
          placeholder="Add an item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-card border-border font-body" />
        <Button onClick={() => handleAdd()} size="icon" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Frequent item suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
          {suggestions.map((item) => (
            <button
              key={item.name}
              onClick={() => handleAdd(item.name)}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium capitalize"
            >
              + {item.name}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {groceryItems.length > 0 &&
        <div className="flex justify-between items-center gap-3">
          <button
            onClick={() => setRouteMode(!routeMode)}
            className={`text-base flex items-center gap-2 font-semibold py-1.5 px-3 rounded-md transition-colors ${
              routeMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <Route className="h-5 w-5" />
            {routeMode ? 'Looproute aan' : 'Looproute'}
          </button>
          <div className="flex gap-3">
            <button
              onClick={mergeDuplicateItems}
              className="text-primary hover:underline flex items-center gap-1 text-sm">
              <Merge className="h-3 w-3" /> Dubbele samenvoegen
            </button>
            <button
              onClick={clearAllItems}
              className="text-destructive hover:underline flex items-center gap-1 text-sm">
              <Trash2 className="h-3 w-3" /> Clear entire cart
            </button>
          </div>
        </div>
      }

      {/* AH prices and basket */}
      {unchecked.length > 0 &&
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Button type="button" variant="outline" size="sm" onClick={fetchAhPrices} disabled={pricing} className="gap-2">
            {pricing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Prijzen zoeken...</>
              : <><Tag className="h-4 w-4" /> {pricedItems.length ? 'AH-prijzen verversen' : 'AH-prijzen ophalen'}</>}
          </Button>
          {pricedItems.length > 0 &&
            <>
              <span className="text-sm">
                Totaal bij AH: <span className="font-semibold tabular-nums">{euro.format(ahTotal)}</span>
                {pricedItems.length < unchecked.length &&
                  <span className="text-muted-foreground"> ({pricedItems.length} van {unchecked.length})</span>}
              </span>
              <Button size="sm" asChild className="ml-auto gap-2 bg-[#00a0e2] text-white hover:bg-[#008cc6]">
                <a
                  href={ahBasketUrl(pricedItems.flatMap((i) => (i.ahProduct ? [{ id: i.ahProduct.id, quantity: i.ahProduct.quantity }] : [])))}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opent ah.nl; na inloggen staan de producten in je mandje"
                >
                  <ShoppingBasket className="h-4 w-4" /> Alles in AH-mandje
                </a>
              </Button>
            </>
          }
        </div>
      }

      {/* Empty state */}
      {unchecked.length === 0 && checked.length === 0 &&
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-display">Your list is empty</p>
          <p className="text-sm mt-1">Add items above or pick a recipe!</p>
        </div>
      }

      {/* Items - route mode */}
      {routeMode && categorized &&
        <div className="space-y-4">
          {categorized.map((group) =>
            <div key={group.category}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      }

      {/* Items - normal mode */}
      {!routeMode &&
        <div className="space-y-2">
          {unchecked.map(renderItem)}
        </div>
      }

      {/* Checked items */}
      {checked.length > 0 &&
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">Checked ({checked.length})</span>
            <button onClick={clearCheckedItems} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          {checked.map((item) =>
            <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
              <button
                onClick={() => handleToggle(item.id)}
                className="h-5 w-5 rounded-full bg-primary shrink-0 flex items-center justify-center animate-check-bounce">
                <Check className="h-3 w-3 text-primary-foreground" />
              </button>
              <span className="font-body line-through text-muted-foreground flex-1">{item.name}</span>
              <button onClick={() => removeGroceryItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      }
    </div>
  );
};

export default GroceryList;
