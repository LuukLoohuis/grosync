import type { Recipe } from '@/types';
import { fetchRecipeImage } from '@/services/recipeApi';

type RepairableRecipe = Pick<Recipe, 'id' | 'imageUrl' | 'sourceUrl'>;

/** Bewaart de nieuwe foto bij het recept; de app geeft hier updateRecipeImage door. */
type Save = (id: string, imageUrl: string) => Promise<void>;

interface RepairOptions {
  /** Haalt een verse foto op voor de bronlink; null als er geen te vinden is. */
  fetchImage: (sourceUrl: string) => Promise<string | null>;
  /** Hoeveel recepten tegelijk aan de beurt zijn. */
  maxParallel?: number;
}

/**
 * Een foto die niet meer laadt, is bijna altijd een verlopen Instagram- of
 * TikTok-link. De server haalt dan de foto achter de bronlink opnieuw op en
 * bewaart hem in onze eigen bucket; hier hoeft alleen de nieuwe link opgeslagen.
 *
 * Eén poging per recept per sessie en een paar tegelijk: een pagina vol
 * verlopen foto's herstelt zichzelf zonder dat de server een stormloop krijgt.
 */
export function createImageRepair({ fetchImage, maxParallel = 2 }: RepairOptions) {
  const attempted = new Set<string>();
  const queue: Array<() => Promise<void>> = [];
  let running = 0;

  const pump = () => {
    while (running < maxParallel && queue.length > 0) {
      const job = queue.shift()!;
      running += 1;
      job()
        .catch((error) => console.error('Recipe image repair failed:', error))
        .finally(() => {
          running -= 1;
          pump();
        });
    }
  };

  return (recipe: RepairableRecipe, save: Save): void => {
    if (!recipe.sourceUrl || attempted.has(recipe.id)) return;
    attempted.add(recipe.id);
    const { id, imageUrl, sourceUrl } = recipe;
    queue.push(async () => {
      const fresh = await fetchImage(sourceUrl);
      if (fresh && fresh !== imageUrl) await save(id, fresh);
    });
    pump();
  };
}

/** Meld dat de foto van dit recept niet laadt; de app-brede wachtrij doet de rest. */
export const repairRecipeImage = createImageRepair({
  fetchImage: async (sourceUrl) => (await fetchRecipeImage(sourceUrl)).imageUrl ?? null,
});
