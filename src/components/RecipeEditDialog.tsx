import { useState, useEffect } from 'react';
import { Pencil, Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Recipe } from '@/types';
import { normalizeSteps } from '@/lib/recipeSteps';
import CategoryPicker from '@/components/CategoryPicker';
import { t } from '@/lib/i18n';

interface RecipeEditDialogProps {
  recipe: Recipe;
  /** Leave out for the button; pass these to open it from somewhere else. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const RecipeEditDialog = ({ recipe, open: openProp, onOpenChange }: RecipeEditDialogProps) => {
  const { updateRecipe, updateRecipeImage } = useAppContext();
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : ownOpen;
  const setOpen = (next: boolean) => { if (controlled) onOpenChange?.(next); else setOwnOpen(next); };
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [servings, setServings] = useState<number>(4);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(recipe.name);
      setDescription(recipe.description);
      setIngredientText(recipe.ingredients.join('\n'));
      // Oude recepten staan als één lap tekst opgeslagen; zo zie je de stappen.
      setInstructions(normalizeSteps(recipe.instructions));
      setSourceUrl(recipe.sourceUrl || '');
      setServings(recipe.servings || 4);
      setCategories(recipe.categories ?? []);
    }
  }, [open, recipe]);

  const handleSave = async () => {
    if (!name.trim() || !ingredientText.trim()) return;
    const trimmedUrl = sourceUrl.trim() || undefined;
    const urlChanged = trimmedUrl !== recipe.sourceUrl;

    await updateRecipe(recipe.id, {
      name: name.trim(),
      description: description.trim(),
      ingredients: ingredientText.split('\n').map((l) => l.trim()).filter(Boolean),
      instructions: normalizeSteps(instructions) || undefined,
      sourceUrl: trimmedUrl,
      servings: servings,
      categories,
    });

    if (urlChanged && trimmedUrl) {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-url-meta', { body: { url: trimmedUrl } });
        if (!error && data?.imageUrl) updateRecipeImage(recipe.id, data.imageUrl);
      } catch (e) { console.error('Failed to fetch image:', e); }
    }

    setOpen(false);
    toast.success(t("Recept opgeslagen"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full h-auto min-h-11 flex-col gap-1 px-1 py-2 text-[11px] font-medium leading-tight whitespace-normal">
            <Pencil className="h-4 w-4" />
            {t("Bewerken")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("Recept bewerken")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder={t("Naam recept")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={t("Korte beschrijving")} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Link className="h-3.5 w-3.5" /> {t("Recept URL (optioneel)")}
            </label>
            <Input type="url" placeholder="https://example.com/recipe" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("Ingrediënten (één per regel)")}</label>
            <Textarea placeholder={t("Kipfilet (500g)\nRijst (300g)")} value={ingredientText} onChange={(e) => setIngredientText(e.target.value)} rows={6} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("Aantal personen")}</label>
            <Input type="number" min={1} max={100} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 4)} />
          </div>
          <CategoryPicker value={categories} onChange={setCategories} />
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("Instructies")}</label>
            <Textarea placeholder={t("1. Verwarm de oven voor...")} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} className="min-h-[200px]" />
          </div>
          <Button onClick={handleSave} className="w-full">{t("Wijzigingen opslaan")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeEditDialog;
