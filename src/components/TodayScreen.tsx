import { useState } from 'react';
import { ChefHat, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddToListSheet from '@/components/AddToListSheet';
import EmptyState from '@/components/EmptyState';
import HeaderActions from '@/components/HeaderActions';
import OfflineBanner from '@/components/OfflineBanner';
import RecipeViewDialog from '@/components/RecipeViewDialog';
import { useAppContext } from '@/contexts/AppContext';
import { useMealPlanner } from '@/hooks/useMealPlanner';
import type { GroceryItem, Recipe } from '@/types';

type TodayTarget = 'list' | 'recipes';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const todayLabel = () => {
  const label = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const personen = (count: number) => `${count} ${count === 1 ? 'persoon' : 'personen'}`;

const TILE =
  'rounded-[14px] border border-border bg-card p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** The launch screen: tonight's dinner, what to buy and what is in the plan. */
const TodayScreen = ({ onNavigate }: { onNavigate: (tab: TodayTarget) => void }) => {
  const { userId, recipes, groceryItems, usuals, loading, addGroceryItem, setGroceryItemChecked, trackPurchase, stockUp } = useAppContext();
  const planner = useMealPlanner(userId, recipes);
  const [addRecipe, setAddRecipe] = useState<Recipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Monday is day 0 in the week plan.
  const dinner = planner.getEntry((new Date().getDay() + 6) % 7, 'dinner');
  // The planner links its recipe when the plan arrives; look it up again in case the
  // recipes were still loading at that moment.
  const recipe = dinner?.recipe ?? recipes.find((r) => r.id === dinner?.recipeId);
  const todayIndex = (new Date().getDay() + 6) % 7;

  const chooseDinner = async (chosen: Recipe) => {
    setPickerOpen(false);
    await planner.setMeal(todayIndex, 'dinner', chosen.id);
    toast.success(`Vanavond: ${chosen.name}`);
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const priced = unchecked.filter((i) => i.ahProduct);
  const ahTotal = priced.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const bonusCount = priced.filter((i) => i.ahProduct?.isBonus).length;
  const listCaption = priced.length > 0
    ? `± ${euro.format(ahTotal)} bij AH${bonusCount > 0 ? ` · ${bonusCount} in de bonus` : ''}`
    : unchecked.length > 0 ? 'Nog geen AH-prijzen' : 'Niets te halen';

  // Favourites that are not on the list yet stand in for "Bijna op" until there is a pantry.
  const onList = new Set(unchecked.map((i) => i.name.trim().toLowerCase()));
  const missingUsuals = usuals.filter((u) => !onList.has(u.name.trim().toLowerCase())).slice(0, 3);

  const addUsuals = async () => {
    const names = missingUsuals.map((u) => u.name);
    for (const name of names) await addGroceryItem(name);
    toast.success(`${names.length} ${names.length === 1 ? 'item' : 'items'} op je lijst gezet`, {
      action: { label: 'Bekijk lijst', onClick: () => onNavigate('list') },
    });
  };

  const checkOff = (item: GroceryItem) => {
    trackPurchase(item.name);
    void stockUp(item.name, 'lijst');
    void setGroceryItemChecked(item.id, true);
    toast(`“${item.name}” afgevinkt`, {
      action: { label: 'Ongedaan maken', onClick: () => { void setGroceryItemChecked(item.id, false); } },
    });
  };

  const dinnerTitle = recipe?.name ?? dinner?.customMealName ?? 'Nog niets gepland';
  const dinnerCaption = recipe
    ? `Voor ${personen(recipe.servings || 4)} · ${recipe.ingredients.length} ingrediënten`
    : dinner ? 'Voor vanavond gekozen' : 'Kies wat jullie vanavond eten.';

  return (
    <div>
      <section className="bg-primary px-[22px] pb-[18px] pt-4 text-primary-foreground dark:bg-primary-deep dark:text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary-muted">{todayLabel()}</p>
            <h1 className="mt-0.5 font-display text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em]">Vandaag</h1>
          </div>
          <HeaderActions onDark />
        </div>

        <div className="mt-3.5 flex items-center gap-3 rounded-[14px] bg-primary-deep px-3.5 py-3 dark:bg-card">
          {recipe?.imageUrl ? (
            <img src={recipe.imageUrl} alt="" className="h-[62px] w-[62px] shrink-0 rounded-[10px] object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-muted dark:bg-muted">
              <ChefHat className="h-6 w-6" strokeWidth={1.8} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary-muted">Vanavond eten we</p>
            {planner.loading ? (
              <Skeleton className="mt-1.5 h-5 w-40 bg-primary/60 dark:bg-muted" />
            ) : (
              <>
                <p className="mt-0.5 font-display text-lg font-semibold leading-[1.15]">{dinnerTitle}</p>
                <p className="mt-0.5 text-xs text-primary-muted">{dinnerCaption}</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex gap-2">
          {recipe ? (
            <RecipeViewDialog
              recipe={recipe}
              onAddToList={() => setAddRecipe(recipe)}
              trigger={<Button variant="accent" className="flex-1">Bekijk recept</Button>}
            />
          ) : (
            <Button variant="accent" className="flex-1" onClick={() => setPickerOpen(true)}>
              Kies wat we eten
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => (recipe || dinner ? setPickerOpen(true) : onNavigate('recipes'))}
            className="border-[#3C6F5B] bg-transparent px-3.5 text-primary-foreground hover:bg-primary-deep dark:border-border-strong dark:text-foreground dark:hover:bg-card"
          >
            {recipe || dinner ? 'Ruilen' : 'Recepten'}
          </Button>
        </div>
      </section>

      <div className="space-y-2.5 px-[18px] pt-4">
        <OfflineBanner />

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => onNavigate('list')} className={TILE}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShoppingCart className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> Lijst
            </span>
            <span className="mt-1.5 block font-display text-2xl font-bold tabular-nums text-foreground">
              {unchecked.length} {unchecked.length === 1 ? 'item' : 'items'}
            </span>
            <span className="block text-xs text-muted-foreground">{listCaption}</span>
          </button>
          <button type="button" onClick={() => onNavigate('recipes')} className={TILE}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
              <ChefHat className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> Recepten
            </span>
            <span className="mt-1.5 block font-display text-2xl font-bold tabular-nums text-foreground">{recipes.length}</span>
            <span className="block text-xs text-muted-foreground">
              {recipes.length === 0 ? 'Plak een link om er een toe te voegen' : 'Kies er een voor vanavond'}
            </span>
          </button>
        </div>

        {missingUsuals.length > 0 && (
          <div className="flex items-center gap-3 rounded-[14px] border border-accent/25 bg-accent-soft px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-accent-ink">Vaak gekocht</p>
              <p className="mt-0.5 truncate text-[0.9375rem] font-medium text-foreground">{missingUsuals.map((u) => u.name).join(', ')}</p>
            </div>
            <button
              type="button"
              onClick={addUsuals}
              className="min-h-11 shrink-0 rounded-[10px] bg-foreground px-3 text-[0.8125rem] font-semibold text-background transition-transform duration-150 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Zet op lijst
            </button>
          </div>
        )}

        <div className="flex items-baseline justify-between pb-0.5 pt-2">
          <h2 className="font-display text-[0.9375rem] font-bold text-foreground">Op je lijst</h2>
          {unchecked.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{unchecked.length} te halen</span>}
        </div>

        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : unchecked.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Je lijst is leeg"
            body="Typ wat je nodig hebt, of zet een recept op je lijst."
            action={{ label: 'Naar recepten', onClick: () => onNavigate('recipes') }}
          />
        ) : (
          <>
            <ul className="space-y-2">
              {unchecked.slice(0, 4).map((item) => (
                <li key={item.id} className="flex min-h-14 items-center gap-1.5 rounded-xl border border-border bg-card py-1 pl-0.5 pr-3">
                  <button
                    type="button"
                    onClick={() => checkOff(item)}
                    aria-label={`Vink ${item.name} af`}
                    className="group/check flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="h-6 w-6 rounded-[8px] border-2 border-primary transition-colors group-hover/check:bg-primary-soft" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">{item.name}</span>
                    {item.ahProduct && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.ahProduct.quantity}× {item.ahProduct.title}
                      </span>
                    )}
                  </span>
                  {item.price != null && (
                    <span className="shrink-0 font-display text-sm font-semibold tabular-nums">{euro.format(item.price)}</span>
                  )}
                </li>
              ))}
            </ul>
            {unchecked.length > 4 && (
              <Button variant="ghost" className="w-full" onClick={() => onNavigate('list')}>
                Bekijk alle {unchecked.length} boodschappen
              </Button>
            )}
          </>
        )}
      </div>

      <AddToListSheet recipe={addRecipe} onClose={() => setAddRecipe(null)} onNavigate={() => onNavigate('list')} />

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
          <SheetHeader className="px-5 pb-3 pr-14 pt-5 text-left">
            <SheetTitle className="font-display text-xl">Wat eten we vanavond?</SheetTitle>
            <SheetDescription>Kies een recept uit je eigen lijst.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {recipes.length === 0 ? (
              <EmptyState
                icon={ChefHat}
                title="Nog geen recepten"
                body="Plak een link van een recept, dan kun je hem hier kiezen."
                action={{ label: 'Naar recepten', onClick: () => { setPickerOpen(false); onNavigate('recipes'); } }}
              />
            ) : (
              recipes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseDinner(option)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {option.imageUrl ? (
                    <img src={option.imageUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-[10px] object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                      <ChefHat className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-foreground">{option.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Voor {personen(option.servings || 4)} · {option.ingredients.length} ingrediënten
                    </span>
                  </span>
                  {recipe?.id === option.id && <span className="shrink-0 text-xs font-semibold text-primary">Nu</span>}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TodayScreen;
