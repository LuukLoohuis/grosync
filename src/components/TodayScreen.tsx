import { useMemo, useState } from 'react';
import { ArrowRight, ChefHat, Plus, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddToListSheet from '@/components/AddToListSheet';
import HeaderActions from '@/components/HeaderActions';
import OfflineBanner from '@/components/OfflineBanner';
import RecipeViewDialog from '@/components/RecipeViewDialog';
import { useAppContext } from '@/contexts/AppContext';
import { useMealPlanner } from '@/hooks/useMealPlanner';
import { leesBonusGeheugen } from '@/lib/bonusMemory';
import { splitAmount } from '@/lib/itemAmount';
import type { GroceryItem, Recipe } from '@/types';

type TodayTarget = 'list' | 'recipes' | 'bonus';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const hoofdletter = (tekst: string) => tekst.charAt(0).toUpperCase() + tekst.slice(1);
const datumLabel = (datum = new Date()) =>
  hoofdletter(datum.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }));

const personen = (count: number) => `${count} ${count === 1 ? 'persoon' : 'personen'}`;
const dingen = (count: number) => `${count} ${count === 1 ? 'ding' : 'dingen'}`;

/** Maandag is dag 0 in de weekplanning. */
const dagIndex = (datum = new Date()) => (datum.getDay() + 6) % 7;

/** Het openingsscherm: wat er vanavond gegeten wordt, en wat er nog gehaald moet worden. */
const TodayScreen = ({ onNavigate }: { onNavigate: (tab: TodayTarget) => void }) => {
  const { userId, recipes, groceryItems, usuals, pantry, loading, addGroceryItem, setGroceryItemChecked, trackPurchase, stockUp } = useAppContext();
  const planner = useMealPlanner(userId, recipes);
  const [addRecipe, setAddRecipe] = useState<Recipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDag, setPickerDag] = useState(dagIndex());
  const [bonus] = useState(leesBonusGeheugen);

  const vandaag = dagIndex();
  const dinner = planner.getEntry(vandaag, 'dinner');
  // De planner koppelt zijn recept zodra het binnen is; zoek het anders zelf op.
  const recipe = dinner?.recipe ?? recipes.find((r) => r.id === dinner?.recipeId);
  const morgen = planner.getEntry((vandaag + 1) % 7, 'dinner');
  const morgenDatum = new Date(Date.now() + 86_400_000);

  const kiesAvondeten = async (chosen: Recipe) => {
    setPickerOpen(false);
    await planner.setMeal(pickerDag, 'dinner', chosen.id);
    toast.success(pickerDag === vandaag ? `Vanavond: ${chosen.name}` : `${datumLabel(morgenDatum)}: ${chosen.name}`);
  };

  const openPicker = (dag: number) => { setPickerDag(dag); setPickerOpen(true); };

  const teHalen = groceryItems.filter((i) => !i.checked);
  const metPrijs = teHalen.filter((i) => i.ahProduct);
  const ahTotaal = metPrijs.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const inBonus = metPrijs.filter((i) => i.ahProduct?.isBonus).length;
  const lijstOnderschrift = metPrijs.length > 0
    ? `± ${euro.format(ahTotaal)} bij AH${inBonus > 0 ? ` · ${inBonus} in de bonus` : ''}`
    : teHalen.length > 0 ? 'Nog geen AH-prijzen' : null;

  // Wat je al hebt of al op de lijst hebt staan, hoef je niet nog een keer te halen.
  const opLijst = useMemo(
    () => new Set(groceryItems.map((i) => splitAmount(i.name).name.trim().toLowerCase())),
    [groceryItems],
  );
  const inKast = useMemo(
    () => new Set(pantry.filter((p) => p.quantity > 0).map((p) => p.name.trim().toLowerCase())),
    [pantry],
  );
  const nogHalen = (option: Recipe) =>
    option.ingredients.filter((regel) => {
      const naam = splitAmount(regel).name.trim().toLowerCase();
      if (!naam) return false;
      return !opLijst.has(naam) && ![...inKast].some((kast) => kast.includes(naam) || naam.includes(kast));
    }).length;

  const bonusVoorRecept = (id: string) => bonus?.recepten.find((r) => r.id === id) ?? null;

  // Drie voorstellen voor vanavond: eerst wat het minst te halen heeft.
  const voorstellen = useMemo(() => {
    return [...recipes]
      .map((option) => ({ option, halen: nogHalen(option), bonus: bonusVoorRecept(option.id) }))
      .sort((a, b) => (b.bonus ? 1 : 0) - (a.bonus ? 1 : 0) || a.halen - b.halen)
      .slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, opLijst, inKast, bonus]);

  const favorietenErbij = usuals
    .filter((u) => !opLijst.has(u.name.trim().toLowerCase()))
    .slice(0, 4);

  const zetErbij = async (naam: string) => {
    await addGroceryItem(naam);
    toast.success(`“${naam}” op je lijst`);
  };

  const vinkAf = (item: GroceryItem) => {
    trackPurchase(item.name);
    void stockUp(item.name, 'lijst');
    void setGroceryItemChecked(item.id, true);
    toast(`“${item.name}” afgevinkt`, {
      action: { label: 'Ongedaan maken', onClick: () => { void setGroceryItemChecked(item.id, false); } },
    });
  };

  const uur = new Date().getHours();
  const kaleStart = recipes.length === 0 && groceryItems.length === 0;
  const allesKlaar = teHalen.length === 0 && Boolean(dinner);
  const groet = kaleStart ? 'Welkom'
    : allesKlaar ? 'Alles klaar'
    : !dinner && uur >= 15 ? 'Wat eten we?'
    : uur < 12 ? 'Goedemorgen'
    : uur < 18 ? 'Goedemiddag'
    : 'Goedenavond';

  const avondTitel = recipe?.name ?? dinner?.customMealName ?? null;
  const avondOnderschrift = recipe
    ? `Voor ${personen(recipe.servings || 4)} · ${recipe.ingredients.length} ingrediënten${nogHalen(recipe) === 0 ? ', alles in huis' : ''}`
    : 'Voor vanavond gekozen';

  return (
    <div>
      <section className="bg-primary px-[22px] pb-[18px] pt-4 text-primary-foreground dark:bg-primary-deep dark:text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary-muted">{datumLabel()}</p>
            <h1 className="mt-0.5 font-display text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em]">{groet}</h1>
          </div>
          <HeaderActions onDark />
        </div>

        {/* Er staat iets gepland: dat is het antwoord op "wat eten we". */}
        {dinner && (
          <>
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
                    <p className="mt-0.5 font-display text-lg font-semibold leading-[1.15]">{avondTitel}</p>
                    <p className="mt-0.5 text-xs text-primary-muted">{avondOnderschrift}</p>
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
                <Button variant="accent" className="flex-1" onClick={() => openPicker(vandaag)}>Kies een recept</Button>
              )}
              <Button
                variant="outline"
                onClick={() => openPicker(vandaag)}
                className="border-[#3C6F5B] bg-transparent px-3.5 text-primary-foreground hover:bg-primary-deep dark:border-border-strong dark:text-foreground dark:hover:bg-card"
              >
                Ruilen
              </Button>
            </div>
          </>
        )}

        {/* Niets gepland, maar wel recepten: kies er hier een, met wat het je kost aan boodschappen. */}
        {!dinner && recipes.length > 0 && (
          <div className="mt-3.5 rounded-[14px] bg-primary-deep px-3.5 py-3 dark:bg-card">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary-muted">
              Uit jullie recepten · kunnen vanavond
            </p>
            <ul className="mt-2 space-y-1.5">
              {voorstellen.map(({ option, halen, bonus: korting }) => (
                <li key={option.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">{option.name}</span>
                    <span className="block truncate text-xs text-primary-muted">
                      {halen === 0 ? 'alles in huis' : `${dingen(halen)} halen`}
                      {korting ? ` · in de bonus, ± ${euro.format(korting.voordeel)} minder` : ''}
                    </span>
                  </span>
                  <Button variant="accent" size="sm" className="shrink-0" onClick={() => void kiesAvondeten(option)}>
                    Kies
                  </Button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('recipes')}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary-muted hover:text-primary-foreground"
            >
              Alle {recipes.length} recepten <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* De eerste dag: er valt nog niets te kiezen. */}
        {!dinner && recipes.length === 0 && (
          <div className="mt-3.5 rounded-[14px] bg-primary-deep px-3.5 py-3.5 dark:bg-card">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary-muted">Vanavond</p>
            <p className="mt-1 font-display text-lg font-semibold leading-[1.2]">
              Nog niets gepland — en nog geen recepten om uit te kiezen
            </p>
            <p className="mt-1 text-xs text-primary-muted">
              Zet er één in. Vanaf dan staat hier elke dag wat jullie eten, en de boodschappen ervoor gaan vanzelf op de lijst.
            </p>
            <Button variant="accent" className="mt-3 min-h-12 w-full" onClick={() => onNavigate('recipes')}>
              Eerste recept toevoegen
            </Button>
          </div>
        )}
      </section>

      <div className="space-y-2.5 px-[18px] pt-4">
        <OfflineBanner />

        <section className="rounded-[14px] border border-border bg-card p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[1.0625rem] font-bold text-foreground">
              Op je lijst{teHalen.length > 0 ? ` · ${teHalen.length} te halen` : ''}
            </h2>
            {teHalen.length > 4 && (
              <button type="button" onClick={() => onNavigate('list')} className="shrink-0 text-xs font-medium text-primary hover:underline">
                Ordenen
              </button>
            )}
          </div>
          {lijstOnderschrift && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{lijstOnderschrift}</p>}

          {favorietenErbij.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{teHalen.length === 0 ? 'Begin met' : 'Zet erbij'}</span>
              {favorietenErbij.map((favoriet) => (
                <button
                  key={favoriet.id}
                  type="button"
                  onClick={() => void zetErbij(favoriet.name)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[10px] bg-accent-soft px-2.5 text-[0.8125rem] font-medium text-accent-ink transition-colors duration-150 ease-smooth hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> {favoriet.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="mt-2.5 space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : teHalen.length === 0 ? (
            <div className="mt-2.5">
              <p className="text-sm text-muted-foreground">
                {allesKlaar
                  ? 'Alles gehaald. Wat je afvinkte staat nu in je voorraad.'
                  : 'Nog niets te halen. Typ wat je nodig hebt, of zet een recept op je lijst.'}
              </p>
              <Button variant="outline" className="mt-2.5 min-h-11 w-full" onClick={() => onNavigate('list')}>
                Iets anders toevoegen
              </Button>
            </div>
          ) : (
            <ul className="mt-2.5 divide-y divide-border">
              {teHalen.map((item) => (
                <li key={item.id} className="flex min-h-[3.25rem] items-center gap-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => vinkAf(item)}
                    aria-label={`Vink ${item.name} af`}
                    className="group/check flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="h-6 w-6 rounded-[8px] border-2 border-primary transition-colors group-hover/check:bg-primary-soft" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[0.9375rem] font-medium text-foreground">{item.name}</span>
                      {item.ahProduct?.isBonus && (
                        <span className="shrink-0 rounded-[5px] bg-ah-bonus/15 px-1.5 font-display text-[0.5625rem] font-bold uppercase tracking-[0.06em] text-accent-ink">
                          Bonus
                        </span>
                      )}
                    </span>
                    {item.ahProduct && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.ahProduct.quantity}× {item.ahProduct.title}
                      </span>
                    )}
                  </span>
                  {item.price != null && (
                    <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-foreground">{euro.format(item.price)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Wat Bonuschef de laatste keer vond, zonder er zelf voor te gaan wachten. */}
        {bonus && bonus.recepten.length > 0 && teHalen.length === 0 && (
          <section className="rounded-[14px] border border-border bg-card p-3.5">
            <h2 className="font-display text-[1.0625rem] font-bold text-foreground">Deze week in de bonus</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Uit jullie recepten · plan ze alvast in</p>
            <ul className="mt-2.5 space-y-2">
              {bonus.recepten.slice(0, 3).map((regel) => {
                const option = recipes.find((r) => r.id === regel.id);
                return (
                  <li key={regel.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium text-foreground">{regel.naam}</span>
                      <span className="block truncate text-xs tabular-nums text-muted-foreground">
                        {regel.treffers} in de bonus · ± {euro.format(regel.voordeel)} minder
                      </span>
                    </span>
                    {option && (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => void planner.setMeal((vandaag + 1) % 7, 'dinner', option.id).then(() => toast.success(`Morgen: ${option.name}`))}>
                        Plan
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => onNavigate('bonus')} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline">
              Naar Bonuschef <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        {/* Morgen is het weer raak. */}
        {dinner && !morgen && recipes.length > 0 && (
          <section className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-foreground">Morgen nog niets gepland</span>
              <span className="block text-xs text-muted-foreground">{datumLabel(morgenDatum)}</span>
            </span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => openPicker((vandaag + 1) % 7)}>
              Kies
            </Button>
          </section>
        )}
      </div>

      <AddToListSheet recipe={addRecipe} onClose={() => setAddRecipe(null)} onNavigate={() => onNavigate('list')} />

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
          <SheetHeader className="px-5 pb-3 pr-14 pt-5 text-left">
            <SheetTitle className="font-display text-xl">
              {pickerDag === vandaag ? 'Wat eten we vanavond?' : `Wat eten we ${datumLabel(morgenDatum).toLowerCase()}?`}
            </SheetTitle>
            <SheetDescription>Kies een recept uit je eigen lijst.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {recipes.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-display text-lg text-foreground">Nog geen recepten</p>
                <p className="mt-1 text-sm text-muted-foreground">Plak een link van een recept, dan kun je hem hier kiezen.</p>
                <Button className="mt-4 min-h-11" onClick={() => { setPickerOpen(false); onNavigate('recipes'); }}>
                  Naar recepten
                </Button>
              </div>
            ) : (
              recipes.map((option) => {
                const halen = nogHalen(option);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void kiesAvondeten(option)}
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
                        {halen === 0 ? 'alles in huis' : `${dingen(halen)} halen`} · voor {personen(option.servings || 4)}
                      </span>
                    </span>
                    {recipe?.id === option.id && <span className="shrink-0 text-xs font-semibold text-primary">Nu</span>}
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TodayScreen;
