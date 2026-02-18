import { useState } from 'react';
import { Eye, ExternalLink, Minus, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
 */
const scaleIngredient = (ingredient: string, multiplier: number): string => {
  if (multiplier === 1) return ingredient;

  // Match a leading number (int, decimal, or fraction like ½ ¼ ¾)
  const match = ingredient.match(/^(\d+(?:[.,]\d+)?)\s*(.*)/);
  if (match) {
    const qty = parseFloat(match[1].replace(',', '.'));
    const rest = match[2];
    const scaled = qty * multiplier;
    const display = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1).replace(/\.0$/, '');
    return `${display} ${rest}`;
  }

  // Handle unicode fractions
  const fractionMap: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1/3, '⅔': 2/3 };
  const fracMatch = ingredient.match(/^([½¼¾⅓⅔])\s*(.*)/);
  if (fracMatch) {
    const qty = fractionMap[fracMatch[1]] || 0.5;
    const rest = fracMatch[2];
    const scaled = qty * multiplier;
    const display = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1).replace(/\.0$/, '');
    return `${display} ${rest}`;
  }

  // No quantity found, return as-is
  return ingredient;
};

const RecipeViewDialog = ({ recipe }: RecipeViewDialogProps) => {
  const baseServings = recipe.servings || 4;
  const [currentServings, setCurrentServings] = useState(baseServings);
  const multiplier = currentServings / baseServings;

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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeViewDialog;
