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

interface RecipeEditDialogProps {
  recipe: Recipe;
}

const RecipeEditDialog = ({ recipe }: RecipeEditDialogProps) => {
  const { updateRecipe, updateRecipeImage } = useAppContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  useEffect(() => {
    if (open) {
      setName(recipe.name);
      setDescription(recipe.description);
      setIngredientText(recipe.ingredients.join('\n'));
      setInstructions(recipe.instructions || '');
      setSourceUrl(recipe.sourceUrl || '');
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
      instructions: instructions.trim() || undefined,
      sourceUrl: trimmedUrl,
    });

    if (urlChanged && trimmedUrl) {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-url-meta', { body: { url: trimmedUrl } });
        if (!error && data?.imageUrl) updateRecipeImage(recipe.id, data.imageUrl);
      } catch (e) { console.error('Failed to fetch image:', e); }
    }

    setOpen(false);
    toast.success('Recipe updated!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 font-medium">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit Recipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Link className="h-3.5 w-3.5" /> Recipe URL (optional)
            </label>
            <Input type="url" placeholder="https://example.com/recipe" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ingredients (one per line)</label>
            <Textarea placeholder={"Chicken breast (500g)\nRice (300g)"} value={ingredientText} onChange={(e) => setIngredientText(e.target.value)} rows={6} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Instructions</label>
            <Textarea placeholder={"1. Preheat oven..."} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} className="min-h-[200px]" />
          </div>
          <Button onClick={handleSave} className="w-full">Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeEditDialog;
