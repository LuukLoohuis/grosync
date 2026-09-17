import { useState } from 'react';
import { Plus, X, ShoppingCart } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

const UsualsList = () => {
  const [newItem, setNewItem] = useState('');
  const [newStaple, setNewStaple] = useState('');
  const { loading, usuals, addUsual, removeUsual, addGroceryItem, pantryStaples, savePantryStaples } = useAppContext();

  const handleAdd = () => {
    if (newItem.trim()) {
      addUsual(newItem.trim());
      setNewItem('');
    }
  };

  const handleAddStaple = () => {
    const name = newStaple.trim().toLowerCase();
    if (!name) return;
    setNewStaple('');
    if (!pantryStaples.includes(name)) savePantryStaples([...pantryStaples, name]);
  };

  const handleAddToList = (name: string) => {
    addGroceryItem(name);
    toast.success(t("“{0}” op je lijst gezet", [name]));
  };

  return (
    <div className="space-y-6">
      {/* Add usual */}
      <div className="flex gap-2">
        <Input
          placeholder={t("Wat koop je vaak?")}
          aria-label={t("Wat koop je vaak?")}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-card border-border font-body"
        />
        <Button onClick={handleAdd} size="icon" className="shrink-0 h-11 w-11" aria-label={t("Favoriet toevoegen")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {[96, 128, 80, 112].map((w) => <Skeleton key={w} className="h-11 rounded-full" style={{ width: w }} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && usuals.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-display text-foreground">{t("Nog geen favorieten")}</p>
          <p className="text-sm mt-1">{t("Zet hier wat je elke week koopt. Eén tik en het staat op je lijst.")}</p>
        </div>
      )}

      {/* Usuals grid */}
      <div className="flex flex-wrap gap-2">
        {usuals.map((item) => (
          <div
            key={item.id}
            className="group flex items-center rounded-full border border-border bg-card pl-3"
          >
            <button
              onClick={() => handleAddToList(item.name)}
              className="flex items-center gap-1.5 min-h-11 pr-1 hover:text-primary transition-colors"
              aria-label={t("Zet {0} op je lijst", [item.name])}
            >
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-sm">{item.name}</span>
            </button>
            <button
              onClick={() => removeUsual(item.id)}
              aria-label={t("Verwijder {0}", [item.name])}
              className="h-11 w-11 flex items-center justify-center text-destructive rounded-full hover:bg-destructive/10 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Pantry staples */}
      <section className="space-y-3 border-t border-border pt-6" aria-labelledby="pantry-heading">
        <div>
          <h2 id="pantry-heading" className="font-display text-lg text-foreground">{t("Dit heb ik altijd in huis")}</h2>
          <p className="text-sm text-muted-foreground">{t("Die staan uitgevinkt als je een recept op je lijst zet.")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("Bijvoorbeeld: sojasaus")}
            aria-label={t("Wat heb je altijd in huis?")}
            value={newStaple}
            onChange={(e) => setNewStaple(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStaple()}
            className="bg-card border-border font-body"
          />
          <Button onClick={handleAddStaple} size="icon" className="shrink-0 h-11 w-11" aria-label={t("Toevoegen aan altijd in huis")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {pantryStaples.map((staple) => (
            <span key={staple} className="flex items-center rounded-full bg-muted pl-3 text-sm text-foreground">
              {staple}
              <button
                onClick={() => savePantryStaples(pantryStaples.filter((s) => s !== staple))}
                aria-label={t("Haal {0} weg uit altijd in huis", [staple])}
                className="h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default UsualsList;
