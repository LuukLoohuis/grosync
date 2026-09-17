import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { productName } from '@/lib/itemAmount';
import { dotOf, findCategory, tintOf } from '@/lib/recipeCategories';
import type { Recipe, RecipeCategory } from '@/types';

interface RecipeTileProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  /** Hoe vaak dit gerecht in een week stond die geweest is. */
  cookCount?: number;
  /** Waarom dit recept in de zoekresultaten staat, als het niet de naam is. */
  reason?: string | null;
  /** Een breed vlak voor het gerecht dat jullie het vaakst maken. */
  wide?: boolean;
  onOpen: () => void;
  onAddToList: () => void;
}

/** De eerste paar ingrediënten, zonder hoeveelheid: waar het gerecht van gemaakt is. */
const wordsOf = (recipe: Recipe, hoeveel: number) =>
  recipe.ingredients.slice(0, hoeveel).map((line) => productName(line).toLowerCase()).filter(Boolean);

/**
 * Eén recept in het overzicht. Heeft het een foto, dan staat die bovenaan; heeft
 * het er geen, dan vertelt een vlak met de ingrediënten waar het over gaat — dat
 * zegt meer dan een beginletter, en de helft van wat je plakt heeft geen foto.
 */
const RecipeTile = ({ recipe, categories, cookCount = 0, reason = null, wide = false, onOpen, onAddToList }: RecipeTileProps) => {
  const labels = recipe.categories ?? [];
  const first = labels.length > 0 ? findCategory(categories, labels[0]) : null;
  const count = recipe.ingredients.length;
  const words = wordsOf(recipe, wide ? 4 : 3);
  // Een foto die het niet doet laat een gat achter; dan liever het woordvlak.
  const [broken, setBroken] = useState(false);

  return (
    <article className="group relative overflow-hidden rounded-[14px] border border-border bg-card transition-shadow duration-150 ease-smooth hover:shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {recipe.imageUrl && !broken ? (
          <img
            src={recipe.imageUrl}
            alt=""
            loading="lazy"
            className={`w-full bg-muted object-cover ${wide ? 'h-[7.5rem]' : 'h-24'}`}
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className={`flex items-end px-3 py-2.5 ${wide ? 'h-[7.5rem]' : 'h-24'} ${first ? tintOf(first.color) : 'bg-muted text-muted-foreground'}`}
          >
            <span className={`font-display font-semibold leading-[1.25] tracking-[-0.01em] ${wide ? 'text-[1rem]' : 'text-[0.84375rem]'}`}>
              {words.length > 0 ? words.join(' · ') : recipe.name.toLowerCase()}
            </span>
          </div>
        )}

        <div className="p-2.5">
          {reason && (
            <span className="mb-1 inline-block rounded-[5px] bg-accent-soft px-1.5 py-0.5 font-display text-[0.5625rem] font-bold uppercase tracking-[0.06em] text-accent-ink">
              {reason}
            </span>
          )}
          {cookCount > 0 && (
            <p className="mb-0.5 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${first ? dotOf(first.color) : 'bg-muted-foreground'}`} aria-hidden="true" />
              <span className="tabular-nums">{cookCount}×</span> gemaakt
            </p>
          )}
          <h3 className={`line-clamp-2 font-display font-bold leading-tight tracking-[-0.01em] text-foreground ${wide ? 'text-[1.0625rem]' : 'text-[0.9375rem]'}`}>
            {recipe.name}
          </h3>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {count} {count === 1 ? 'ingrediënt' : 'ingrediënten'}
            {recipe.servings ? ` · voor ${recipe.servings}` : ''}
            {first ? ` · ${first.name}` : ''}
          </p>
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
