import { useState } from 'react';
import { Check, Plus, Trash2, X, Merge, Route, TrendingUp, Euro } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sortByStoreRoute } from '@/lib/storeRouteSort';

const GroceryList = () => {
  const [newItem, setNewItem] = useState('');
  const [routeMode, setRouteMode] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const { groceryItems, addGroceryItem, toggleGroceryItem, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems, frequentItems, trackPurchase, updateGroceryItemPrice } = useAppContext();

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

  const handlePriceChange = (id: string, value: string) => {
    const parsed = value === '' ? null : parseFloat(value.replace(',', '.'));
    if (value !== '' && (isNaN(parsed!) || parsed! < 0)) return;
    updateGroceryItemPrice(id, parsed);
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);
  const categorized = routeMode ? sortByStoreRoute(unchecked) : null;

  // Budget totals
  const uncheckedTotal = unchecked.reduce((sum, i) => sum + (i.price || 0), 0);
  const checkedTotal = checked.reduce((sum, i) => sum + (i.price || 0), 0);
  const grandTotal = uncheckedTotal + checkedTotal;

  // Filter suggestions
  const currentNames = groceryItems.map((i) => i.name.toLowerCase());
  const suggestions = frequentItems.filter((f) => !currentNames.includes(f.name));

  const renderItem = (item: typeof unchecked[0]) =>
    <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-soft animate-fade-in group">
      <button
        onClick={() => handleToggle(item.id)}
        className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center hover:bg-primary/10 transition-colors" />
      <div className="flex-1 min-w-0">
        <span className="font-body">{item.name}</span>
        {item.fromRecipe && <span className="text-xs text-muted-foreground ml-2">from {item.fromRecipe}</span>}
      </div>
      {showPrices && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={item.price != null ? String(item.price) : ''}
            onChange={(e) => handlePriceChange(item.id, e.target.value)}
            placeholder="0.00"
            className="w-16 text-right text-sm bg-muted/50 border border-border rounded px-1.5 py-0.5 font-body focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRouteMode(!routeMode)}
              className={`text-base flex items-center gap-2 font-semibold py-1.5 px-3 rounded-md transition-colors ${
                routeMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <Route className="h-5 w-5" />
              {routeMode ? 'Looproute aan' : 'Looproute'}
            </button>
            <button
              onClick={() => setShowPrices(!showPrices)}
              className={`text-base flex items-center gap-2 font-semibold py-1.5 px-3 rounded-md transition-colors ${
                showPrices ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <Euro className="h-5 w-5" />
              {showPrices ? 'Budget aan' : 'Budget'}
            </button>
          </div>
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

      {/* Budget summary */}
      {showPrices && groceryItems.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1">
          <div className="flex justify-between text-sm font-body">
            <span className="text-muted-foreground">Nog te kopen ({unchecked.length})</span>
            <span className="font-semibold">€{uncheckedTotal.toFixed(2)}</span>
          </div>
          {checked.length > 0 && (
            <div className="flex justify-between text-sm font-body">
              <span className="text-muted-foreground">Afgevinkt ({checked.length})</span>
              <span className="font-semibold">€{checkedTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-primary/20 pt-1 flex justify-between text-base font-display font-bold">
            <span>Totaal</span>
            <span className="text-primary">€{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

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
              {showPrices && item.price != null && (
                <span className="text-xs text-muted-foreground font-body">€{item.price.toFixed(2)}</span>
              )}
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
