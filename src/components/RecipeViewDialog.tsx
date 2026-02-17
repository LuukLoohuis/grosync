import { Eye, Link, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Recipe } from '@/types';

interface RecipeViewDialogProps {
  recipe: Recipe;
}

const RecipeViewDialog = ({ recipe }: RecipeViewDialogProps) => {
  return (
    <Dialog>
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
              <h3 className="font-display text-lg mb-3">Ingrediënten</h3>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-foreground/90 flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{ing}</span>
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
