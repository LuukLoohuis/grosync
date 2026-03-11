import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useMealPlanner, MealType } from '@/hooks/useMealPlanner';
import { ChevronLeft, ChevronRight, Plus, X, Sparkles, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Recipe } from '@/types';

const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DAYS_FULL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const MEALS: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Ontbijt', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'dinner', label: 'Diner', emoji: '🌙' },
];

const MealPlanner = () => {
  const { userId, recipes, addRecipe, addRecipeToGroceryList } = useAppContext();
  const planner = useMealPlanner(userId, recipes);
  const [pickerOpen, setPickerOpen] = useState<{ day: number; meal: MealType } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const weekLabel = useMemo(() => {
    const start = new Date(planner.weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('nl-NL', { month: 'short' })}`;
    return `${fmt(start)} – ${fmt(end)}`;
  }, [planner.weekStart]);

  const handlePickRecipe = async (recipe: Recipe) => {
    if (!pickerOpen) return;
    await planner.setMeal(pickerOpen.day, pickerOpen.meal, recipe.id);
    setPickerOpen(null);
  };

  const handleAiSuggest = async () => {
    const emptySlots: { dayIndex: number; mealType: MealType }[] = [];
    for (let d = 0; d < 7; d++) {
      for (const m of MEALS) {
        if (!planner.getEntry(d, m.key)) {
          emptySlots.push({ dayIndex: d, mealType: m.key });
        }
      }
    }
    if (emptySlots.length === 0) {
      toast.info('Alle slots zijn al gevuld!');
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-meal-plan', {
        body: { existingRecipes: recipes, emptySlots },
      });

      if (error) throw error;

      const suggestions = data?.suggestions || [];
      for (const s of suggestions) {
        // Save as recipe first, then assign to slot
        const recipeId = await addRecipe({
          name: s.name,
          description: s.description,
          ingredients: s.ingredients,
          instructions: s.instructions,
          servings: s.servings || 4,
        });
        if (recipeId) {
          await planner.setMeal(s.dayIndex, s.mealType, recipeId);
        }
      }
      toast.success(`${suggestions.length} maaltijden ingevuld!`);
    } catch (e) {
      console.error('AI suggestion error:', e);
      toast.error('Kon geen suggesties ophalen');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddToGroceryList = async () => {
    const planned = planner.getPlannedIngredients();
    if (planned.length === 0) {
      toast.info('Geen recepten gepland met ingrediënten');
      return;
    }

    // Group by recipe
    const byRecipe = new Map<string, string[]>();
    for (const p of planned) {
      const existing = byRecipe.get(p.recipeName) || [];
      existing.push(p.ingredient);
      byRecipe.set(p.recipeName, existing);
    }

    for (const [recipeName, ingredients] of byRecipe) {
      await addRecipeToGroceryList(ingredients, recipeName);
    }
    toast.success(`${planned.length} ingrediënten toegevoegd aan boodschappenlijst!`);
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => planner.navigateWeek(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold text-foreground">{weekLabel}</h2>
        <Button variant="ghost" size="icon" onClick={() => planner.navigateWeek(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAiSuggest}
          disabled={aiLoading}
          className="flex-1"
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-1">AI invullen</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleAddToGroceryList} className="flex-1">
          <ShoppingCart className="h-4 w-4" />
          <span className="ml-1">Naar lijst</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={planner.clearWeek}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Week grid */}
      {planner.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div key={dayIdx} className="bg-card rounded-lg p-3 border border-border">
              <div className="text-sm font-bold text-foreground mb-2">{DAYS_FULL[dayIdx]}</div>
              <div className="grid grid-cols-3 gap-2">
                {MEALS.map((meal) => {
                  const entry = planner.getEntry(dayIdx, meal.key);
                  const recipe = entry?.recipe || (entry?.recipeId ? recipes.find(r => r.id === entry.recipeId) : undefined);
                  const displayName = recipe?.name || entry?.customMealName;

                  return (
                    <div key={meal.key} className="relative">
                      <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <span>{meal.emoji}</span>
                        <span>{meal.label}</span>
                      </div>
                      {displayName ? (
                        <div className="bg-primary/10 rounded-md p-1.5 text-xs text-foreground relative group min-h-[36px] flex items-center">
                          <span className="line-clamp-2 pr-4">{displayName}</span>
                          <button
                            onClick={() => planner.removeMeal(dayIdx, meal.key)}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickerOpen({ day: dayIdx, meal: meal.key })}
                          className="w-full border border-dashed border-muted-foreground/30 rounded-md p-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[36px] flex items-center justify-center"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipe picker dialog */}
      <Dialog open={!!pickerOpen} onOpenChange={(open) => !open && setPickerOpen(null)}>
        <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Kies recept – {pickerOpen && DAYS_FULL[pickerOpen.day]} {pickerOpen && MEALS.find(m => m.key === pickerOpen.meal)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nog geen recepten. Voeg eerst recepten toe in het Recepten-tabblad.
              </p>
            ) : (
              recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handlePickRecipe(recipe)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {recipe.imageUrl && (
                      <img src={recipe.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{recipe.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{recipe.description}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanner;
