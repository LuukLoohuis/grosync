import { useState } from 'react';
import { Eye, ExternalLink, Minus, Plus, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Recipe } from '@/types';

interface RecipeViewDialogProps {
  recipe: Recipe;
}

/**
 * Scale an ingredient string by a multiplier.
 * Handles patterns like "500g kip", "2 eieren", "1.5 el olie", "½ cup flour"
 * Also handles numbers within parentheses or after descriptive words.
 */
const scaleIngredient = (ingredient: string, multiplier: number): string => {
  if (multiplier === 1) return ingredient;

  // Fraction map for unicode fractions
  const fractionMap: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1/3, '⅔': 2/3 };

  // Function to format a number for display
  const formatNumber = (num: number) => {
    return num % 1 === 0 ? num.toString() : num.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  };

  // 1. Check for unicode fractions
  let result = ingredient;
  for (const [char, val] of Object.entries(fractionMap)) {
    if (result.includes(char)) {
      const scaled = val * multiplier;
      result = result.replace(char, formatNumber(scaled));
    }
  }

  // 2. Match numbers (integers or decimals)
  // We use a regex that looks for numbers that are likely quantities.
  // This avoids scaling numbers that might be part of a brand name or instruction.
  // We target numbers at the start of the string or preceded by a space/parenthesis.
  return result.replace(/(\b\d+(?:[.,]\d+)?\b)/g, (match) => {
    // If it's a year or seems like part of a name (very high number), maybe don't scale?
    // But for recipes, usually any number is a quantity.
    const num = parseFloat(match.replace(',', '.'));
    if (isNaN(num)) return match;
    
    // Don't scale numbers that look like years or temperatures (heuristically)
    if (num > 1000 && !ingredient.toLowerCase().includes(' gram') && !ingredient.toLowerCase().includes(' ml')) {
      return match;
    }

    return formatNumber(num * multiplier);
  });
};

const RecipeViewDialog = ({ recipe }: RecipeViewDialogProps) => {
  const { addRecipeToGroceryList } = useAppContext();
  const baseServings = recipe.servings || 4;
  const [currentServings, setCurrentServings] = useState(baseServings);
  const multiplier = currentServings / baseServings;

  const handleCook = () => {
    const scaledIngredients = recipe.ingredients.map(ing => scaleIngredient(ing, multiplier));
    addRecipeToGroceryList(scaledIngredients, recipe.name);
    toast.success(`Ingrediënten voor "${recipe.name}" (${currentServings} pers.) toegevoegd aan je lijst!`);
  };

  return (
    <Dialog onOpenChange={() => setCurrentServings(baseServings)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="w-full" title="Bekijken">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background max-h-[90vh] sm:max-w-2xl p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          {recipe.imageUrl && (
            <div className="aspect-video w-full overflow-hidden bg-muted">
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="p-6 space-y-5">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-display text-2xl">{recipe.name}</DialogTitle>
              {recipe.description && (
                <p className="text-muted-foreground">{recipe.description}</p>
              )}
              {recipe.sourceUrl && (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Origineel recept bekijken
                </a>
              )}
            </DialogHeader>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg">Ingrediënten</h3>
                <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <button
                    onClick={() => setCurrentServings(Math.max(1, currentServings - 1))}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-background transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-bold text-sm min-w-[24px] text-center">{currentServings}</span>
                  <button
                    onClick={() => setCurrentServings(currentServings + 1)}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-background transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {multiplier !== 1 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Origineel: {baseServings} personen → Aangepast: {currentServings} personen (×{multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)})
                </p>
              )}
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-foreground/90 flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{scaleIngredient(ing, multiplier)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {recipe.instructions && (
              <>
                <Separator />
                <div>
                  <h3 className="font-display text-lg mb-3">Instructies</h3>
                  <div className="text-foreground/90 whitespace-pre-line leading-relaxed">
                    {recipe.instructions}
                  </div>
                </div>
              </>
            )}

            <Separator />
            
            <Button className="w-full gap-2" onClick={handleCook}>
              <ShoppingCart className="h-4 w-4" />
              Toevoegen aan lijst ({currentServings} pers.)
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeViewDialog;
