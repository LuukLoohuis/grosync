import { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '@/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const GroceryList = () => {
  const [newItem, setNewItem] = useState('');
  const { groceryItems, addGroceryItem, toggleGroceryItem, removeGroceryItem, clearCheckedItems, clearAllItems } = useStore();

  const handleAdd = () => {
    if (newItem.trim()) {
      addGroceryItem(newItem.trim());
      setNewItem('');
    }
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);

  return (
    <div className="space-y-6">
      {/* Add item */}
      <div className="flex gap-2">
        <Input
          placeholder="Add an item..."
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
      {groceryItems.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={clearAllItems}
            className="text-xs text-destructive hover:underline flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Clear entire cart
          </button>
        </div>
      )}

      {/* Unchecked items */}
      {unchecked.length === 0 && checked.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-display">Your list is empty</p>
          <p className="text-sm mt-1">Add items above or pick a recipe!</p>
        </div>
      )}

      <div className="space-y-2">
        {unchecked.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-soft animate-fade-in group"
          >
            <button
              onClick={() => toggleGroceryItem(item.id)}
              className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center hover:bg-primary/10 transition-colors"
            />
            <div className="flex-1 min-w-0">
              <span className="font-body">{item.name}</span>
              {item.fromRecipe && (
                <span className="text-xs text-muted-foreground ml-2">
                  from {item.fromRecipe}
                </span>
              )}
            </div>
            <button
              onClick={() => removeGroceryItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">
              Checked ({checked.length})
            </span>
            <button
              onClick={clearCheckedItems}
              className="text-xs text-destructive hover:underline flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          {checked.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
            >
              <button
                onClick={() => toggleGroceryItem(item.id)}
                className="h-5 w-5 rounded-full bg-primary shrink-0 flex items-center justify-center animate-check-bounce"
              >
                <Check className="h-3 w-3 text-primary-foreground" />
              </button>
              <span className="font-body line-through text-muted-foreground flex-1">
                {item.name}
              </span>
              <button
                onClick={() => removeGroceryItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroceryList;
