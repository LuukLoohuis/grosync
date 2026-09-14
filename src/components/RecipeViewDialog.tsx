import { useState, type ReactNode } from 'react';
import { Eye, ExternalLink, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Recipe } from '@/types';
import EstimateBadge from '@/components/EstimateBadge';
import { isEstimated, withoutEstimate } from '@/lib/recipeImport';
import { splitSteps } from '@/lib/recipeSteps';

interface RecipeViewDialogProps {
  recipe: Recipe;
  /** Opens the sheet where you choose servings and ingredients. */
  onAddToList: () => void;
  /** Replaces the "Bekijken" button that recipe cards use. */
  trigger?: ReactNode;
}

const RecipeViewDialog = ({ recipe, onAddToList, trigger }: RecipeViewDialogProps) => {
  const [open, setOpen] = useState(false);
  const servings = recipe.servings || 4;

  const addToList = () => {
    setOpen(false);
    onAddToList();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full h-auto min-h-11 flex-col gap-1 px-1 py-2 text-[11px] font-medium leading-tight whitespace-normal">
            <Eye className="h-4 w-4" />
            Bekijken
          </Button>
        )}
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
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> Voor {servings} {servings === 1 ? 'persoon' : 'personen'}
                </span>
              </div>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-foreground/90 flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{withoutEstimate(ing)}{isEstimated(ing) && <EstimateBadge />}</span>
                  </li>
                ))}
              </ul>
            </div>

            {recipe.instructions && (
              <>
                <Separator />
                <div>
                  <h3 className="font-display text-lg mb-3">Bereiding</h3>
                  <ol className="space-y-3">
                    {splitSteps(recipe.instructions).map((step, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xs font-bold tabular-nums text-primary" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="leading-relaxed text-foreground/90">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}

            <Separator />

            <Button className="w-full min-h-11 gap-2" onClick={addToList}>
              <ShoppingCart className="h-4 w-4" />
              Zet op je lijst
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeViewDialog;
