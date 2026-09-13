import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, ChefHat, Plus, Search, Settings2, Link, X, Loader2, Languages, ClipboardPaste } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import RecipeEditDialog from '@/components/RecipeEditDialog';
import MacrosDialog from '@/components/MacrosDialog';
import { fetchRecipeFromUrl, fetchRecipeFromText, translateRecipe, calculateMacros, type FetchedRecipe } from '@/services/recipeApi';
import RecipeSuggestDialog from '@/components/RecipeSuggestDialog';
import { Skeleton } from '@/components/ui/skeleton';
import EstimateBadge from '@/components/EstimateBadge';
import AddToListSheet from '@/components/AddToListSheet';
import { SOURCE_LABELS, detectImportInput, isEstimated, progressLabel, withoutEstimate, type SourceKey } from '@/lib/recipeImport';
import CategoryPicker from '@/components/CategoryPicker';
import RecipeTile from '@/components/RecipeTile';
import RecipeDetailSheet from '@/components/RecipeDetailSheet';
import RecipeCategorySheet from '@/components/RecipeCategorySheet';
import { PRESETS, countPerCategory, dotOf, findCategory, sameName, suggestCategories, tintOf, usedCategories } from '@/lib/recipeCategories';

interface RecipeListProps {
  /** A link or text shared into the app; opens the import dialog and starts fetching. */
  initialImport?: string | null;
  onImportConsumed?: () => void;
  onNavigate?: (tab: 'list') => void;
}

const RecipeList = ({ initialImport, onImportConsumed, onNavigate }: RecipeListProps) => {
  const { loading, recipes, addRecipe, removeRecipe, updateRecipeImage, updateRecipe, recipeCategories, addRecipeCategory } = useAppContext();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [servings, setServings] = useState<number>(4);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchedMacros, setFetchedMacros] = useState<any>(null);
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | undefined>();
  const [translating, setTranslating] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [importNotice, setImportNotice] = useState<'instagram' | 'notfound' | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [listRecipeId, setListRecipeId] = useState<string | null>(null);
  const [categoryRecipeId, setCategoryRecipeId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'nieuw' | 'naam'>('nieuw');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [macrosId, setMacrosId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  const resetForm = () => {
    setName(''); setDescription(''); setIngredientText(''); setInstructions(''); setSourceUrl(''); setManual(false); setFetchedMacros(null); setFetchedImageUrl(undefined); setServings(4); setTranslating(false);
    setImportValue(''); setImportNotice(null); setSourceLabel(null); setProgress(null); setCategories([]);
  };

  // Fills the form from a fetch-url-meta response. Returns false when nothing usable came back.
  const applyFetchedRecipe = (data: FetchedRecipe | null | undefined) => {
    if (data?.imageUrl) setFetchedImageUrl(data.imageUrl);
    const hasIngredients = Boolean(data?.ingredients?.length);
    if (!hasIngredients && !data?.name && !data?.title) return false;

    if (data?.name || data?.title) setName(data.name || data.title);
    if (data?.description) setDescription(data.description);
    if (hasIngredients) {
      setIngredientText(
        (data?.ingredients ?? [])
          .map((ing) => {
            if (typeof ing === 'string') return ing;
            return `${ing.name}${ing.quantity ? ` (${ing.quantity}${ing.unit || ''})` : ''}`;
          })
          .join('\n')
      );
    }
    if (data?.instructions) setInstructions(data.instructions);
    if (data?.servings) setServings(data.servings);
    // Extract macros from response
    const macros = {
      calories: data?.calories,
      protein: data?.protein,
      carbs: data?.carbs,
      fat: data?.fat,
      fiber: data?.fiber,
    };
    if (Object.values(macros).some(v => v !== undefined)) {
      setFetchedMacros(macros);
    }
    if (hasIngredients) {
      toast.success('Recept opgehaald! Je kunt alles nog aanpassen.');
    } else {
      toast.warning('Alleen de titel gevonden, geen ingrediënten. Vul die zelf aan.');
    }
    return true;
  };

  const runImport = async (value: string) => {
    const input = detectImportInput(value);
    if (!input) return;
    setImportNotice(null);
    setFetchingMeta(true);
    const started = Date.now();
    setProgress(progressLabel(0, input));
    const ticker = setInterval(() => setProgress(progressLabel(Date.now() - started, input)), 1000);
    try {
      if (input.kind === 'url') setSourceUrl(input.url);
      const data = input.kind === 'url' ? await fetchRecipeFromUrl(input.url) : await fetchRecipeFromText(input.text);
      if (applyFetchedRecipe(data)) {
        const source: SourceKey | undefined = input.kind === 'text' && data?.extractedFrom === 'description' ? 'text' : data?.extractedFrom;
        setSourceLabel(source && source !== 'none' ? SOURCE_LABELS[source] : null);
        return;
      }
      if (input.kind === 'url' && /instagram\.com\//i.test(input.url) && data?.captionFound !== true) {
        // Instagram showed our server only its login page, so the post text has to come from the user.
        setImportNotice('instagram');
        setImportValue('');
      } else {
        setImportNotice('notfound');
      }
    } catch (e) {
      console.error('Recipe import failed:', e);
      toast.error('Recept ophalen lukte niet. Controleer je verbinding en probeer het opnieuw.');
    } finally {
      clearInterval(ticker);
      setProgress(null);
      setFetchingMeta(false);
    }
  };

  const canReadClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);

  // On iPhone this shows the system "Plakken" bubble; the read only succeeds after tapping it.
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error('Je klembord is leeg. Kopieer eerst de link of de tekst.');
        return;
      }
      setImportValue(text);
      void runImport(text);
    } catch {
      toast.error('Plakken lukte niet. Houd het veld ingedrukt en kies Plakken.');
    }
  };

  useEffect(() => {
    if (!initialImport) return;
    resetForm();
    setOpen(true);
    setImportValue(initialImport);
    void runImport(initialImport);
    onImportConsumed?.();
    // Only react to a new shared link, not to every render of the handlers above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImport]);

  const showForm = manual || Boolean(name) || Boolean(ingredientText);
  const estimatedLines = ingredientText.split('\n').filter(isEstimated);

  const translateRecipeHandler = async () => {
    if (!name.trim() && !ingredientText.trim()) {
      toast.error('Vul eerst een recept in om te vertalen');
      return;
    }
    try {
      setTranslating(true);
      const data = await translateRecipe({
        name: name.trim(),
        description: description.trim(),
        ingredients: ingredientText.split('\n').map((l) => l.trim()).filter(Boolean),
        instructions: instructions.trim(),
      });
      if (data?.name) setName(data.name);
      if (data?.description) setDescription(data.description);
      if (data?.ingredients?.length) {
        setIngredientText(
          data.ingredients
            .map((ing: any) => {
              if (typeof ing === 'string') return ing;
              return `${ing.name}${ing.quantity ? ` (${ing.quantity}${ing.unit || ''})` : ''}`;
            })
            .join('\n')
        );
      }
      if (data?.instructions) setInstructions(data.instructions);
      toast.success('Recept vertaald naar Nederlands!');
    } catch (e) {
      console.error('Translation failed:', e);
      toast.error(`Kon recept niet vertalen: ${(e as Error).message}`);
    } finally {
      setTranslating(false);
    }
  };

  const calculateMacrosHandler = async () => {
    const ingredients = ingredientText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!ingredients.length) {
      toast.error('Voeg eerst ingrediënten toe');
      return;
    }
    try {
      const macros = await calculateMacros(ingredients);
      setFetchedMacros(macros);
      toast.success('Macronutriënten berekend!');
    } catch (e) {
      console.error('Macro calculation failed:', e);
      toast.error(`Kon macronutriënten niet berekenen: ${(e as Error).message}`);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !ingredientText.trim()) return;
    const trimmedUrl = sourceUrl.trim() || undefined;

    const recipeId = await addRecipe({
      name: name.trim(),
      description: description.trim(),
      ingredients: ingredientText.split('\n').map((l) => l.trim()).filter(Boolean),
      instructions: instructions.trim() || undefined,
      sourceUrl: trimmedUrl,
      imageUrl: fetchedImageUrl,
      macros: fetchedMacros || undefined,
      servings: servings,
      categories,
    });

    resetForm();
    setOpen(false);
    toast.success('Recept toegevoegd!');
  };

  const listRecipe = recipes.find((r) => r.id === listRecipeId) ?? null;
  const categoryRecipe = recipes.find((r) => r.id === categoryRecipeId) ?? null;
  const detailRecipe = recipes.find((r) => r.id === detailId) ?? null;
  const editRecipe = recipes.find((r) => r.id === editId) ?? null;
  const macrosRecipe = recipes.find((r) => r.id === macrosId) ?? null;

  // A first guess at the category, from what has been filled in so far.
  const suggestion = useMemo(() => {
    const lines = ingredientText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!name.trim() && lines.length === 0) return [];
    return suggestCategories(name, lines);
  }, [name, ingredientText]);

  const applySuggestion = async () => {
    const stored: string[] = [];
    for (const label of suggestion) {
      const preset = PRESETS.find((p) => sameName(p.name, label));
      stored.push(await addRecipeCategory(label, preset?.color));
    }
    setCategories((prev) => [...prev, ...stored.filter((label) => !prev.some((p) => sameName(p, label)))]);
  };

  const counts = useMemo(() => countPerCategory(recipes), [recipes]);
  // Everything you can filter on: the categories you made, plus labels still on a recipe.
  const filterNames = useMemo(() => {
    const names = recipeCategories.map((c) => c.name);
    for (const label of usedCategories(recipes)) {
      if (!names.some((known) => sameName(known, label))) names.push(label);
    }
    return names;
  }, [recipeCategories, recipes]);

  // A category can be deleted while its filter is on; then everything comes back.
  useEffect(() => {
    if (filter && !filterNames.some((label) => sameName(label, filter))) setFilter(null);
  }, [filter, filterNames]);

  const visibleRecipes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const found = recipes.filter((recipe) => {
      if (filter && !(recipe.categories ?? []).some((label) => sameName(label, filter))) return false;
      if (!needle) return true;
      // Searching on an ingredient answers "wat kan ik met kip?" without extra UI.
      return recipe.name.toLowerCase().includes(needle)
        || recipe.description.toLowerCase().includes(needle)
        || recipe.ingredients.some((ingredient) => ingredient.toLowerCase().includes(needle));
    });
    // The list arrives oldest first, so "newest" walks it backwards.
    return sort === 'naam'
      ? [...found].sort((a, b) => a.name.localeCompare(b.name, 'nl'))
      : [...found].reverse();
  }, [recipes, filter, search, sort]);

  return (
    <div className="space-y-4">
      <AddToListSheet recipe={listRecipe} onClose={() => setListRecipeId(null)} onNavigate={onNavigate} />
      <RecipeCategorySheet
        recipe={categoryRecipe}
        open={Boolean(categoryRecipe) || managing}
        onClose={() => { setCategoryRecipeId(null); setManaging(false); }}
      />
      <div className="grid grid-cols-2 gap-2">
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button className="min-h-11 w-full gap-2">
            <Plus className="h-4 w-4" /> Recept
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nieuw recept</DialogTitle>
          </DialogHeader>

          {!showForm && (
            <div className="space-y-3">
              {importNotice === 'instagram' && (
                <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                  Instagram laat ons deze post niet lezen. Plak hier de tekst van de post.
                </p>
              )}
              {importNotice === 'notfound' && (
                <div className="rounded-md bg-muted p-3 text-sm text-foreground space-y-2">
                  <p>In deze link staat geen recept. Plak de tekst van de post, of vul het zelf in.</p>
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setManual(true)}>
                    Zelf invullen
                  </Button>
                </div>
              )}
              <label htmlFor="recipe-import" className="sr-only">Plak een link of de tekst van een recept</label>
              <Textarea
                id="recipe-import"
                placeholder="Plak een link of de tekst van een recept"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                rows={4}
                autoFocus
                disabled={fetchingMeta}
              />
              <div className="flex gap-2">
                {canReadClipboard && (
                  <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={pasteFromClipboard} disabled={fetchingMeta}>
                    <ClipboardPaste className="h-4 w-4" /> Plak link
                  </Button>
                )}
                <Button type="button" className="flex-1 min-h-11 gap-2" onClick={() => runImport(importValue)} disabled={!importValue.trim() || fetchingMeta}>
                  {fetchingMeta ? <><Loader2 className="h-4 w-4 animate-spin" /> Bezig…</> : 'Recept ophalen'}
                </Button>
              </div>
              <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">{progress}</p>
              <button type="button" onClick={() => setManual(true)} className="min-h-11 text-sm text-primary hover:underline">
                Liever zelf invullen
              </button>
            </div>
          )}

          {showForm && (
            <div className="space-y-4">
              {sourceLabel && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <span className="font-semibold text-foreground">{sourceLabel}</span> · Je kunt alles hieronder aanpassen.
                </p>
              )}
              {fetchedImageUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img src={fetchedImageUrl} alt="Recipe preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input placeholder="Naam van het recept" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Korte beschrijving" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div>
                <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Link className="h-3.5 w-3.5" /> Link naar het recept (optioneel)
                </label>
                <Input type="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Ingrediënten (één per regel)</label>
                <Textarea placeholder={"Kipfilet (500g)\nRijst (300g)\nSojasaus"} value={ingredientText} onChange={(e) => setIngredientText(e.target.value)} rows={6} />
                {estimatedLines.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <EstimateBadge />{' '}
                    {estimatedLines.length === 1 ? 'Kijk deze hoeveelheid even na' : 'Kijk deze hoeveelheden even na'}: {estimatedLines.map(withoutEstimate).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Aantal personen</label>
                <Input type="number" min={1} max={100} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 4)} />
              </div>
              <div>
                <CategoryPicker value={categories} onChange={setCategories} />
                {categories.length === 0 && suggestion.length > 0 && (
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="mt-2 min-h-11 text-sm text-primary hover:underline"
                  >
                    Voorstel: {suggestion.join(' · ')}
                  </button>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Bereiding</label>
                <Textarea placeholder={"1. Verwarm de oven voor op 180°C\n2. Kruid de kip...\n3. Bak 25 minuten..."} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} className="min-h-[200px]" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={resetForm} className="min-h-11 px-1 text-sm text-muted-foreground hover:underline">← Terug</button>
                  <Button type="button" variant="outline" onClick={translateRecipeHandler} disabled={translating || (!name.trim() && !ingredientText.trim())} className="gap-2">
                    {translating ? <><Loader2 className="h-4 w-4 animate-spin" /> Vertalen...</> : <><Languages className="h-4 w-4" /> Vertaal naar NL</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={calculateMacrosHandler} className="gap-2">
                    Voedingswaarden
                  </Button>
                  <Button onClick={handleAdd} className="min-w-full sm:min-w-0 sm:flex-1">Recept opslaan</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecipeSuggestDialog />
      </div>

      <RecipeDetailSheet
        recipe={detailRecipe}
        onClose={() => setDetailId(null)}
        onAddToList={(item) => setListRecipeId(item.id)}
        onEdit={(item) => setEditId(item.id)}
        onMacros={(item) => setMacrosId(item.id)}
        onCategories={(item) => setCategoryRecipeId(item.id)}
      />
      {editRecipe && (
        <RecipeEditDialog recipe={editRecipe} open onOpenChange={(next) => { if (!next) setEditId(null); }} />
      )}
      {macrosRecipe && (
        <MacrosDialog
          recipe={macrosRecipe}
          open
          onOpenChange={(next) => { if (!next) setMacrosId(null); }}
          onMacrosCalculated={(id, macros) => updateRecipe(id, { macros })}
        />
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-[14px]" />)}
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <ChefHat className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="font-display text-lg text-foreground">Nog geen recepten</p>
          <p className="mt-1 text-sm">Plak een link van TikTok, Instagram, YouTube of een receptsite.</p>
          <Button className="mt-4 min-h-11 gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Recept toevoegen
          </Button>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <>
          {/* Sticks under the header, so searching and filtering stay within reach
              however far you have scrolled. */}
          <div className="sticky top-14 z-10 -mx-4 space-y-2 bg-background/95 px-4 pb-2 pt-2 backdrop-blur-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op naam of ingrediënt"
              aria-label="Zoek in je recepten"
              className="bg-card pl-9 pr-10 font-body"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Zoekopdracht wissen"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filterNames.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4 pb-1">
              <div className="flex w-max items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  aria-pressed={filter === null}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-xs font-bold tracking-[-0.01em] transition-colors duration-150 ease-smooth ${
                    filter === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Alles <span className="tabular-nums opacity-70">{recipes.length}</span>
                </button>
                {filterNames.map((label) => {
                  const category = findCategory(recipeCategories, label);
                  const active = filter !== null && sameName(filter, label);
                  const count = counts.get(label.trim().toLowerCase()) ?? 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setFilter(active ? null : label)}
                      aria-pressed={active}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-xs font-bold tracking-[-0.01em] transition-colors duration-150 ease-smooth ${
                        active ? `${tintOf(category.color)} ring-1 ring-current` : 'border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dotOf(category.color)}`} />
                      {category.name} <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setManaging(true)}
                  aria-label="Categorieën beheren"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 font-display text-xs font-bold text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Beheren
                </button>
              </div>
            </div>
          )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums">{visibleRecipes.length}</span>
              {visibleRecipes.length === 1 ? ' recept' : ' recepten'}
            </p>
            <button
              type="button"
              onClick={() => setSort((prev) => (prev === 'nieuw' ? 'naam' : 'nieuw'))}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sort === 'nieuw' ? 'Nieuwste eerst' : 'Op naam'}
            </button>
          </div>

          {visibleRecipes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? `Niets gevonden voor “${search.trim()}”.`
                : `Nog geen recept in “${filter}”. Open een recept en zet het label erbij.`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {visibleRecipes.map((recipe) => (
              <RecipeTile
                key={recipe.id}
                recipe={recipe}
                categories={recipeCategories}
                onOpen={() => setDetailId(recipe.id)}
                onAddToList={() => setListRecipeId(recipe.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default RecipeList;
