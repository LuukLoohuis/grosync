import { useState } from 'react';
import { Check, Plus, Trash2, X, Merge, Route } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sortByStoreRoute } from '@/lib/storeRouteSort';

const GroceryList = () => {
  const [newItem, setNewItem] = useState('');
  const [routeMode, setRouteMode] = useState(false);
  const { groceryItems, addGroceryItem, toggleGroceryItem, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems } = useAppContext();

  const handleAdd = () => {
    if (newItem.trim()) {
      addGroceryItem(newItem.trim());
      setNewItem('');
    }
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);
  const categorized = routeMode ? sortByStoreRoute(unchecked) : null;

  const renderItem = (item: typeof unchecked[0]) =>
  <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-soft animate-fade-in group">
      <button
      onClick={() => toggleGroceryItem(item.id)}
      className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center hover:bg-primary/10 transition-colors" />

      <div className="flex-1 min-w-0">
        <span className="font-body">{item.name}</span>
        {item.fromRecipe && <span className="text-xs text-muted-foreground ml-2">from {item.fromRecipe}</span>}
      </div>
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

        <Button onClick={handleAdd} size="icon" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions */}
      {groceryItems.length > 0 &&
      <div className="flex justify-between items-center gap-3">
          <button
          onClick={() => setRouteMode(!routeMode)}
          className={`text-base flex items-center gap-2 font-semibold py-1.5 px-3 rounded-md transition-colors ${
          routeMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
          }>

            <Route className="h-5 w-5" />
            {routeMode ? 'Looproute aan' : 'Looproute'}
          </button>
          <div className="flex gap-3">
            <button
            onClick={mergeDuplicateItems}
            className="text-primary hover:underline flex items-center gap-2 text-base font-semibold py-1.5 px-3 rounded-md hover:bg-primary/10 transition-colors">

              <Merge className="h-5 w-5" /> Dubbele samenvoegen
            </button>
            <button
            onClick={clearAllItems}
            className="text-destructive hover:underline flex items-center gap-2 text-base font-semibold py-1.5 px-3 rounded-md hover:bg-destructive/10 transition-colors">

              <Trash2 className="h-5 w-5" /> Clear entire cart
            </button>
          </div>
        </div>
      }

      {/* Empty state */}
      {unchecked.length === 0 && checked.length === 0 &&
      <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-display">Your list is empty</p>
          <p className="text-sm mt-1">Add items above or pick a recipe!</p>
        </div>
      }

      {/* Items - route mode (grouped by category) */}
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
            onClick={() => toggleGroceryItem(item.id)}
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
    </div>);

};

export default GroceryList;