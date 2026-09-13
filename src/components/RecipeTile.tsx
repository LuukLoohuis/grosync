import { ShoppingCart } from 'lucide-react';
import CategoryChip from '@/components/CategoryChip';
import { findCategory, tintOf } from '@/lib/recipeCategories';
import type { Recipe, RecipeCategory } from '@/types';

interface RecipeTileProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  onOpen: () => void;
  onAddToList: () => void;
}

/**
 * One recipe at a glance: photo, name, and how much work it is. Everything else
 * waits in the detail sheet, so a screen full of recipes stays readable.
 */
const RecipeTile = ({ recipe, categories, onOpen, onAddToList }: RecipeTileProps) => {
  const labels = recipe.categories ?? [];
  const first = labels.length > 0 ? findCategory(categories, labels[0]) : null;
  const count = recipe.ingredients.length;

  return (
    <article className="group relative overflow-hidden rounded-[14px] border border-border bg-card transition-shadow duration-150 ease-smooth hover:shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget.style.display = 'none'); }}
            />
          ) : (
            /* No photo: the initial in the colour of its category, so the grid
               still reads as a set of distinct things. */
            <div className={`flex h-full w-full items-center justify-center ${first ? tintOf(first.color) : 'bg-muted text-muted-foreground'}`}>
              <span className="font-display text-[3.25rem] font-bold leading-none opacity-50" aria-hidden="true">
                {recipe.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="p-2.5">
          <h3 className="line-clamp-2 font-display text-[0.9375rem] font-bold leading-tight tracking-[-0.01em] text-foreground">
            {recipe.name}
          </h3>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {count} {count === 1 ? 'ingrediënt' : 'ingrediënten'}
            {recipe.servings ? ` · voor ${recipe.servings}` : ''}
          </p>
          {first && (
            <div className="mt-1.5">
              <CategoryChip name={first.name} color={first.color} />
              {labels.length > 1 && <span className="ml-1 text-[0.6875rem] text-muted-foreground">+{labels.length - 1}</span>}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onAddToList}
        aria-label={`Zet ${recipe.name} op je lijst`}
        className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-flat backdrop-blur transition-colors duration-150 ease-smooth hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ShoppingCart className="h-4 w-4" />
      </button>
    </article>
  );
};

export default RecipeTile;
