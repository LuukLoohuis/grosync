import { useState } from 'react';
import { Plus, X, ShoppingCart } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const UsualsList = () => {
  const [newItem, setNewItem] = useState('');
  const { usuals, addUsual, removeUsual, addGroceryItem, groceryItems } = useAppContext();

  const handleAdd = () => {
    if (newItem.trim()) {
      addUsual(newItem.trim());
      setNewItem('');
    }
  };

  const handleAddToList = (name: string) => {
    addGroceryItem(name);
    toast.success(`"${name}" toegevoegd aan je lijstje`);
  };

  return (
    <div className="space-y-6">
      {/* Add usual */}
      <div className="flex gap-2">
        <Input
          placeholder="Nieuw standaard item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-card border-border font-body"
        />
        <Button onClick={handleAdd} size="icon" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Empty state */}
      {usuals.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-display">Nog geen vaste items</p>
          <p className="text-sm mt-1">Voeg items toe die je vaak koopt!</p>
        </div>
      )}

      {/* Usuals grid */}
      <div className="flex flex-wrap gap-2">
        {usuals.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1.5 bg-card rounded-full pl-3 pr-1.5 py-1.5 shadow-soft animate-fade-in group"
          >
            <button
              onClick={() => handleAddToList(item.name)}
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
              title="Toevoegen aan lijstje"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-sm">{item.name}</span>
            </button>
            <button
              onClick={() => removeUsual(item.id)}
              className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity p-0.5 rounded-full hover:bg-destructive/10"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsualsList;
