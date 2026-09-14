import { useCallback, useEffect, useState } from 'react';
import { ChefHat, Loader2, Plus, RefreshCw, Sparkles, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddToListSheet from '@/components/AddToListSheet';
import EmptyState from '@/components/EmptyState';
import RecipeViewDialog from '@/components/RecipeViewDialog';
import BonusOfferCard from '@/components/BonusOfferCard';
import { useAppContext } from '@/contexts/AppContext';
import { normalizeSteps, splitSteps } from '@/lib/recipeSteps';
import { fetchBonusMatches, fetchBonusRecipes, type BonusRecipe, type BonusResult } from '@/services/bonusApi';
import type { Recipe } from '@/types';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const untilLabel = (endDate: string | null) => {
  if (!endDate) return null;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return null;
  const dagen = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const tot = `t/m ${date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`;
  if (dagen <= 0) return tot;
  return `${tot} · nog ${dagen === 1 ? '1 dag' : `${dagen} dagen`}`;
};

/** Bonuschef: which of your own recipes are in the bonus at Albert Heijn this week. */
const BonusChef = ({ onNavigate }: { onNavigate?: (tab: 'recipes' | 'list') => void }) => {
  const { recipes, addRecipe, pantryStaples, addGroceryItem } = useAppContext();
  const [result, setResult] = useState<BonusResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listRecipe, setListRecipe] = useState<Recipe | null>(null);
  const [ideas, setIdeas] = useState<BonusRecipe[]>([]);
  const [thinking, setThinking] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (recipes.length === 0) {
      setResult({ matches: [], bonusCount: 0, endDate: null });
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      setResult(await fetchBonusMatches(recipes));
      setStatus('ready');
    } catch (error) {
      console.error('Bonus matches failed:', error);
      setStatus('error');
    }
  }, [recipes]);

  useEffect(() => { void load(); }, [load]);

  const think = async () => {
    const offers = result?.sample ?? [];
    if (offers.length < 10) return;
    setThinking(true);
    try {
      setIdeas(await fetchBonusRecipes(offers, pantryStaples));
    } catch (error) {
      console.error('Bonus recipes failed:', error);
      toast.error('Recepten bedenken lukte niet. Probeer het zo nog eens.');
    } finally {
      setThinking(false);
    }
  };

  const keep = async (idea: BonusRecipe) => {
    await addRecipe({
      name: idea.name,
      description: idea.description,
      ingredients: idea.ingredients,
      instructions: normalizeSteps(idea.instructions),
      servings: idea.servings,
    });
    setSaved((previous) => [...previous, idea.name]);
    toast.success(`"${idea.name}" staat bij je recepten`);
  };

  // Het meeste voordeel bovenaan; daarna wat het meest compleet in de bonus ligt.
  const matches = [...(result?.matches ?? [])].sort((a, b) =>
    b.saving - a.saving || b.hits.length / b.ingredientCount - a.hits.length / a.ingredientCount);
  const until = untilLabel(result?.endDate ?? null);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-baseline gap-2">
          <h1 className="flex-1 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">Bonuschef</h1>
          {until && (
            <span className="shrink-0 rounded-full bg-[hsl(var(--ah-bonus))]/12 px-2 py-0.5 font-display text-[0.6875rem] font-bold text-accent-ink">
              {until}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Welke van jouw recepten deze week goedkoper zijn bij Albert Heijn.
          {result && result.bonusCount > 0 && ` ${result.bonusCount} aanbiedingen bekeken.`}
        </p>
      </header>

      {status === 'ready' && (result?.sample?.length ?? 0) >= 10 && (
        <section className="space-y-3 rounded-[14px] border border-accent/25 bg-accent-soft p-3.5">
          <div>
            <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Koken met de bonus</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drie avondmaaltijden uit de aanbiedingen van deze week, met jouw basisproducten erbij.
            </p>
          </div>
          <Button className="w-full gap-2" onClick={() => void think()} disabled={thinking}>
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {thinking ? 'Even koken…' : ideas.length > 0 ? 'Bedenk nieuwe gerechten' : 'Maak een recept van de bonus'}
          </Button>

          {ideas.map((idea) => (
            <article key={idea.name} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[0.9375rem] font-semibold text-foreground">{idea.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {idea.description}
                    {idea.minutes ? ` · ${idea.minutes} min` : ''} · voor {idea.servings}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  disabled={saved.includes(idea.name)}
                  onClick={() => void keep(idea)}
                >
                  <Plus className="h-3.5 w-3.5" /> {saved.includes(idea.name) ? 'Opgeslagen' : 'Opslaan'}
                </Button>
              </div>
              {idea.usedBonus.length > 0 && (
                <p className="text-xs text-accent-ink">Uit de bonus: {idea.usedBonus.join(' · ')}</p>
              )}
              <details className="text-xs text-muted-foreground">
                <summary className="min-h-11 cursor-pointer font-medium text-primary">Ingrediënten en bereiding</summary>
                <ul className="mt-1.5 space-y-0.5">
                  {idea.ingredients.map((ingredient) => <li key={ingredient}>• {ingredient}</li>)}
                </ul>
                <ol className="mt-2 space-y-1.5">
                  {splitSteps(idea.instructions).map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-semibold tabular-nums text-primary">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </section>
      )}

      {status === 'loading' && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[14px]" />)}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-[14px] border border-border bg-card p-4">
          <p className="text-sm text-foreground">De bonus ophalen lukte niet.</p>
          <Button variant="outline" className="mt-3 gap-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Opnieuw proberen
          </Button>
        </div>
      )}

      {status === 'ready' && recipes.length === 0 && (
        <EmptyState
          icon={ChefHat}
          title="Nog geen recepten"
          body="Plak een link van een recept. Daarna kijkt Bonuschef elke week welke je goedkoop kunt koken."
          action={onNavigate ? { label: 'Naar recepten', onClick: () => onNavigate('recipes') } : undefined}
        />
      )}

      {status === 'ready' && recipes.length > 0 && matches.length === 0 && (
        <EmptyState
          icon={Tag}
          title="Deze week zit er niets van jou in de bonus"
          body="Volgende week nieuwe aanbiedingen. Voeg meer recepten toe, dan is de kans groter."
          action={onNavigate ? { label: 'Naar recepten', onClick: () => onNavigate('recipes') } : undefined}
        />
      )}

      {matches.map((match) => {
        const recipe = recipes.find((r) => r.id === match.recipeId);
        if (!recipe) return null;
        const deel = Math.round((match.hits.length / Math.max(1, match.ingredientCount)) * 100);
        return (
          <article key={match.recipeId} className="overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-start gap-3 p-3.5 pb-3">
              {recipe.imageUrl ? (
                <img src={recipe.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <ChefHat className="h-6 w-6" strokeWidth={1.8} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[1.0625rem] font-semibold leading-tight text-foreground">{match.name}</h2>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {match.hits.length} van {match.ingredientCount} ingrediënten in de bonus
                </p>
                {/* Hoeveel van het recept deze week in de aanbieding ligt. */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
                  <div className="h-full rounded-full bg-[hsl(var(--ah-bonus))]" style={{ width: `${deel}%` }} />
                </div>
              </div>
              {match.saving > 0 && (
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold leading-none tabular-nums text-accent-ink">
                    {euro.format(match.saving)}
                  </p>
                  <p className="text-[0.625rem] text-muted-foreground">voordeel</p>
                </div>
              )}
            </div>

            {/* De aanbiedingen zelf, zoals ze in de winkel liggen. */}
            <div className="-mx-0 flex gap-2 overflow-x-auto px-3.5 pb-3">
              {match.hits.map((hit) => (
                <BonusOfferCard
                  key={hit.productId}
                  title={hit.title}
                  mechanism={hit.mechanism}
                  price={hit.price}
                  priceBefore={hit.priceBefore}
                  imageUrl={hit.imageUrl}
                  unitSize={hit.unitSize}
                  because={hit.ingredient}
                />
              ))}
            </div>

            <div className="flex gap-2 border-t border-border p-3.5">
              <Button className="min-h-11 flex-1" onClick={() => setListRecipe(recipe)}>Zet op je lijst</Button>
              <RecipeViewDialog
                recipe={recipe}
                onAddToList={() => setListRecipe(recipe)}
                trigger={<Button variant="outline" className="min-h-11 px-3.5">Bekijken</Button>}
              />
            </div>
          </article>
        );
      })}

      {status === 'ready' && (result?.sample?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 font-display text-[1.0625rem] font-semibold text-foreground">Deze week in de bonus</h2>
            <span className="text-xs text-muted-foreground">tik om op je lijst te zetten</span>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {(result?.sample ?? []).slice(0, 20).map((offer) => (
              <BonusOfferCard
                key={offer.title}
                title={offer.title}
                mechanism={offer.mechanism}
                price={offer.price}
                priceBefore={offer.price_before}
                imageUrl={offer.image_url}
                onAdd={() => {
                  addGroceryItem(offer.title);
                  toast.success(`"${offer.title}" op je lijst gezet`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {status === 'ready' && matches.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="hidden h-3 w-3" aria-hidden="true" />
          Prijzen en acties komen van Albert Heijn.
        </p>
      )}

      <AddToListSheet recipe={listRecipe} onClose={() => setListRecipe(null)} onNavigate={() => onNavigate?.('list')} />
    </div>
  );
};

export default BonusChef;
