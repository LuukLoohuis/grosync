import { useState, type ReactNode } from 'react';
import { Lightbulb, Loader2, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAppContext } from '@/contexts/AppContext';
import { normalizeSteps, splitSteps } from '@/lib/recipeSteps';
import { suggestRecipes, RecipeSuggestion } from '@/services/recipeApi';
import { toast } from 'sonner';

const RecipeSuggestDialog = ({ trigger }: { trigger?: ReactNode } = {}) => {
  const { groceryItems, addRecipe, pantryStaples } = useAppContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);

  const handleSuggest = async () => {
    const ingredients = groceryItems
      .filter((i) => !i.checked)
      .map((i) => i.name);

    if (ingredients.length < 2) {
      toast.error('Voeg minstens 2 ingrediënten toe aan je boodschappenlijst');
      return;
    }

    try {
      setLoading(true);
      setSuggestions([]);
      const data = await suggestRecipes(ingredients, pantryStaples);
      setSuggestions(data.recipes || []);
      if (!data.recipes?.length) {
        toast.error('Geen suggesties gevonden');
      }
    } catch (e) {
      console.error('Suggest failed:', e);
      toast.error(`Kon geen suggesties ophalen: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipe = async (suggestion: RecipeSuggestion) => {
    await addRecipe({
      name: suggestion.name,
      description: suggestion.description,
      ingredients: suggestion.ingredients,
      instructions: normalizeSteps(suggestion.instructions),
      servings: suggestion.servings,
    });
    toast.success(`"${suggestion.name}" toegevoegd aan je recepten!`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSuggestions([]); }}>
      <DialogTrigger asChild onClick={() => { setOpen(true); void handleSuggest(); }}>
        {trigger ?? (
          <Button variant="outline" className="min-h-11 w-full gap-2 px-2">
            <Lightbulb className="h-4 w-4 shrink-0" /> <span className="truncate">Wat kun je koken?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Lightbulb className="h-5 w-5 text-primary" aria-hidden="true" /> Wat kun je koken?
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Even kijken wat er met je lijst te koken valt…</p>
          </div>
        )}

        {!loading && suggestions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Zet eerst wat op je lijst; daarna bedenken we er gerechten bij.</p>
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="space-y-4">
            {suggestions.map((recipe, idx) => (
              <div key={idx} className="space-y-2 rounded-[14px] border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">{recipe.name}</h3>
                    <p className="text-sm text-muted-foreground">{recipe.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Voor {recipe.servings} personen</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => handleAddRecipe(recipe)}>
                    <Plus className="h-3.5 w-3.5" /> Opslaan
                  </Button>
                </div>

                {recipe.extra_needed?.length > 0 && (
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Extra nodig:</p>
                    <p className="text-xs text-foreground/80">{recipe.extra_needed.join(', ')}</p>
                  </div>
                )}

                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer text-xs font-medium text-primary hover:underline">Ingrediënten en bereiding</summary>
                  <ul className="mt-2 space-y-0.5 mb-2">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="text-xs text-foreground/80">• {ing}</li>
                    ))}
                  </ul>
                  <ol className="space-y-1.5 text-xs text-foreground/80">
                    {splitSteps(recipe.instructions).map((step, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="font-semibold tabular-nums text-primary">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            ))}
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <Button variant="outline" className="w-full gap-2 mt-2" onClick={handleSuggest}>
            <Lightbulb className="h-4 w-4" /> Bedenk iets anders
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecipeSuggestDialog;
