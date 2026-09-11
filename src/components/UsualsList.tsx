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
    toast.success(`“${name}” op je lijst gezet`);
  };

  return (
    <div className="space-y-6">
      {/* Add usual */}
      <div className="flex gap-2">
        <Input
          placeholder="Wat koop je vaak?"
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
          <p className="text-lg font-display">Nog geen favorieten</p>
          <p className="text-sm mt-1">Zet hier wat je elke week koopt. Eén tik en het staat op je lijst.</p>
        </div>
      )}

      {/* Usuals grid */}
      <div className="flex flex-wrap gap-2">
        {usuals.map((item) => (
          <div
            key={item.id}
            className="flex items-center bg-card rounded-full pl-3 shadow-soft animate-fade-in group"
          >
            <button
              onClick={() => handleAddToList(item.name)}
              className="flex items-center gap-1.5 min-h-11 pr-1 hover:text-primary transition-colors"
              aria-label={`Zet ${item.name} op je lijst`}
            >
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-sm">{item.name}</span>
            </button>
            <button
              onClick={() => removeUsual(item.id)}
              aria-label={`Verwijder ${item.name}`}
              className="h-11 w-11 flex items-center justify-center text-destructive rounded-full hover:bg-destructive/10 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsualsList;
