import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Heart, Lightbulb, Plus, Search, Settings2, Link, X, Loader2, Languages, ClipboardPaste } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import RecipeEditDialog from '@/components/RecipeEditDialog';
import MacrosDialog from '@/components/MacrosDialog';
import { fetchRecipeFromUrl, fetchRecipeFromText, translateRecipe, calculateMacros, type FetchedRecipe } from '@/services/recipeApi';
import { QuotaError } from '@/services/functions';
import { normalizeSteps } from '@/lib/recipeSteps';
import PlusSheet from '@/components/PlusSheet';
import { FREE_LIMIT } from '@/hooks/useEntitlements';
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
import { useCookCounts } from '@/hooks/useCookCounts';
import type { Recipe } from '@/types';
import { t } from '@/lib/i18n';

interface RecipeListProps {
  /** A link or text shared into the app; opens the import dialog and starts fetching. */
  initialImport?: string | null;
  onImportConsumed?: () => void;
  onNavigate?: (tab: 'list') => void;
}

const RecipeList = ({ initialImport, onImportConsumed, onNavigate }: RecipeListProps) => {
  const { loading, recipes, addRecipe, removeRecipe, updateRecipeImage, updateRecipe, recipeCategories, addRecipeCategory, plus, remaining, refreshEntitlements, userId, pantry, toggleFavorite } = useAppContext();
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
  const [overLimit, setOverLimit] = useState(false);
  const importOp = !plus && remaining('recept') === 0;
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  // Los van de categorieën: alleen wat je met een hartje hebt gemarkeerd.
  const [alleenFavoriet, setAlleenFavoriet] = useState(false);

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
    if (data?.instructions) setInstructions(normalizeSteps(data.instructions));
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
      toast.success(t("Recept opgehaald! Je kunt alles nog aanpassen."));
    } else {
      toast.warning(t("Alleen de titel gevonden, geen ingrediënten. Vul die zelf aan."));
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
      if (e instanceof QuotaError) {
        setOpen(false);
        setOverLimit(true);
      } else {
        console.error('Recipe import failed:', e);
        toast.error(t("Recept ophalen lukte niet. Controleer je verbinding en probeer het opnieuw."));
      }
    } finally {
      void refreshEntitlements();
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
        toast.error(t("Je klembord is leeg. Kopieer eerst de link of de tekst."));
        return;
      }
      setImportValue(text);
      void runImport(text);
    } catch {
      toast.error(t("Plakken lukte niet. Houd het veld ingedrukt en kies Plakken."));
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
      toast.error(t("Vul eerst een recept in om te vertalen"));
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
      if (data?.instructions) setInstructions(normalizeSteps(data.instructions));
      toast.success(t("Recept vertaald naar Nederlands!"));
    } catch (e) {
      console.error('Translation failed:', e);
      toast.error(t("Kon recept niet vertalen: {0}", [(e as Error).message]));
    } finally {
      setTranslating(false);
    }
  };

  const calculateMacrosHandler = async () => {
    const ingredients = ingredientText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!ingredients.length) {
      toast.error(t("Voeg eerst ingrediënten toe"));
      return;
    }
    try {
      const macros = await calculateMacros(ingredients);
      setFetchedMacros(macros);
      toast.success(t("Macronutriënten berekend!"));
    } catch (e) {
      console.error('Macro calculation failed:', e);
      toast.error(t("Kon macronutriënten niet berekenen: {0}", [(e as Error).message]));
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !ingredientText.trim()) return;
    const trimmedUrl = sourceUrl.trim() || undefined;

    const recipeId = await addRecipe({
      name: name.trim(),
      description: description.trim(),
      ingredients: ingredientText.split('\n').map((l) => l.trim()).filter(Boolean),
      instructions: normalizeSteps(instructions) || undefined,
      sourceUrl: trimmedUrl,
      imageUrl: fetchedImageUrl,
      macros: fetchedMacros || undefined,
      servings: servings,
      categories,
    });

    resetForm();
    setOpen(false);
    toast.success(t("Recept toegevoegd!"));
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
      if (alleenFavoriet && !recipe.favorite) return false;
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
  }, [recipes, filter, search, sort, alleenFavoriet]);

  const cookCounts = useCookCounts(userId);
  // Het gerecht dat jullie het vaakst maakten; pas noemenswaardig vanaf twee keer.
  const favoriet = useMemo(() => {
    let beste: { recipe: Recipe; count: number } | null = null;
    for (const recipe of recipes) {
      const count = cookCounts.get(recipe.id) ?? 0;
      if (count >= 2 && (!beste || count > beste.count)) beste = { recipe, count };
    }
    return beste;
  }, [recipes, cookCounts]);

  // Het gerecht dat jullie het vaakst maken ligt vooraan, en dus breed: het
  // overzicht krijgt zijn ritme van wat jullie echt koken.
  const mosaicRecipes = useMemo(() => {
    const metHartje = [
      ...visibleRecipes.filter((recipe) => recipe.favorite),
      ...visibleRecipes.filter((recipe) => !recipe.favorite),
    ];
    if (search.trim() || filter || !favoriet || favoriet.recipe.favorite) return metHartje;
    return [favoriet.recipe, ...metHartje.filter((recipe) => recipe.id !== favoriet.recipe.id)];
  }, [visibleRecipes, favoriet, search, filter]);

  // Staat het woord niet in de naam, dan laat de regel zien waar het wel in stond.
  const reasonFor = (recipe: Recipe) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return null;
    if (recipe.name.toLowerCase().includes(needle)) return 'in de titel';
    return recipe.ingredients.find((line) => line.toLowerCase().includes(needle))?.trim() ?? null;
  };

  // Zoek je op een ingrediënt dat in je kast staat, dan hoef je het niet te kopen.
  const inHuis = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length < 3) return null;
    return pantry.find((item) => item.quantity > 0 && item.name.toLowerCase().includes(needle)) ?? null;
  }, [pantry, search]);

  return (
    <div className="space-y-4">
      <AddToListSheet recipe={listRecipe} onClose={() => setListRecipeId(null)} onNavigate={onNavigate} />
      <RecipeCategorySheet
        recipe={categoryRecipe}
        open={Boolean(categoryRecipe) || managing}
        onClose={() => { setCategoryRecipeId(null); setManaging(false); }}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t("Nieuw recept")}</DialogTitle>
          </DialogHeader>

          {!showForm && (
            <div className="space-y-3">
              {importNotice === 'instagram' && (
                <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                  {t("Instagram laat ons deze post niet lezen. Plak hier de tekst van de post.")}
                </p>
              )}
              {importNotice === 'notfound' && (
                <div className="rounded-md bg-muted p-3 text-sm text-foreground space-y-2">
                  <p>{t("In deze link staat geen recept. Plak de tekst van de post, of vul het zelf in.")}</p>
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setManual(true)}>
                    {t("Zelf invullen")}
                  </Button>
                </div>
              )}
              <label htmlFor="recipe-import" className="sr-only">{t("Plak een link of de tekst van een recept")}</label>
              <Textarea
                id="recipe-import"
                placeholder={t("Plak een link of de tekst van een recept")}
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                rows={4}
                autoFocus
                disabled={fetchingMeta}
              />
              <div className="flex gap-2">
                {canReadClipboard && (
                  <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={pasteFromClipboard} disabled={fetchingMeta}>
                    <ClipboardPaste className="h-4 w-4" /> {t("Plak link")}
                  </Button>
                )}
                <Button
                  type="button"
                  className="flex-1 min-h-11 gap-2"
                  disabled={(!importValue.trim() && !importOp) || fetchingMeta}
                  onClick={() => {
                    // Tegoed op: eerst uitleggen, niet eerst laten wachten op een fout.
                    if (importOp) { setOpen(false); setOverLimit(true); return; }
                    void runImport(importValue);
                  }}
                >
                  {fetchingMeta ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Bezig…")}</> : importOp ? t("Tegoed op") : t("Recept ophalen")}
                </Button>
              </div>
              <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">{progress}</p>
              {!plus && (
                <p className="text-xs text-muted-foreground">
                  {importOp
                    ? t("Je recepten van deze maand zijn op. Zelf invullen kan altijd.")
                    : t('Nog {0} van {1} recepten deze maand. Zelf invullen kan altijd.', [remaining('recept'), FREE_LIMIT])}
                </p>
              )}
              <button type="button" onClick={() => setManual(true)} className="min-h-11 text-sm text-primary hover:underline">
                {t("Liever zelf invullen")}
              </button>
            </div>
          )}

          {showForm && (
            <div className="space-y-4">
              {sourceLabel && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <span className="font-semibold text-foreground">{sourceLabel}</span> {t("· Je kunt alles hieronder aanpassen.")}
                </p>
              )}
              {fetchedImageUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img src={fetchedImageUrl} alt={t("Recipe preview")} className="w-full h-full object-cover" />
                </div>
              )}
              <Input placeholder={t("Naam van het recept")} value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder={t("Korte beschrijving")} value={description} onChange={(e) => setDescription(e.target.value)} />
              <div>
                <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Link className="h-3.5 w-3.5" /> {t("Link naar het recept (optioneel)")}
                </label>
                <Input type="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("Ingrediënten (één per regel)")}</label>
                <Textarea placeholder={t("Kipfilet (500g)\nRijst (300g)\nSojasaus")} value={ingredientText} onChange={(e) => setIngredientText(e.target.value)} rows={6} />
                {estimatedLines.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <EstimateBadge />{' '}
                    {estimatedLines.length === 1 ? t("Kijk deze hoeveelheid even na") : t("Kijk deze hoeveelheden even na")}: {estimatedLines.map(withoutEstimate).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("Aantal personen")}</label>
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
                    {t("Voorstel:")} {suggestion.join(' · ')}
                  </button>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("Bereiding")}</label>
                <Textarea placeholder={t("1. Verwarm de oven voor op 180°C\n2. Kruid de kip...\n3. Bak 25 minuten...")} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} className="min-h-[200px]" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={resetForm} className="min-h-11 px-1 text-sm text-muted-foreground hover:underline">{t("← Terug")}</button>
                  <Button type="button" variant="outline" onClick={translateRecipeHandler} disabled={translating || (!name.trim() && !ingredientText.trim())} className="gap-2">
                    {translating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Vertalen...")}</> : <><Languages className="h-4 w-4" /> {t("Vertaal naar NL")}</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={calculateMacrosHandler} className="gap-2">
                    {t("Voedingswaarden")}
                  </Button>
                  <Button onClick={handleAdd} className="min-w-full sm:min-w-0 sm:flex-1">{t("Recept opslaan")}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlusSheet feature={overLimit ? 'recept' : null} onClose={() => setOverLimit(false)} />

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
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-2" aria-hidden="true">
            <div className={`col-span-2 flex h-[4.5rem] items-end rounded-[14px] px-3 py-2.5 ${tintOf('groen')}`}>
              <span className="font-display text-[0.9375rem] font-semibold">{t("courgette · pesto · penne")}</span>
            </div>
            <div className={`flex h-[4.5rem] items-end rounded-[14px] px-3 py-2.5 ${tintOf('blauw')}`}>
              <span className="font-display text-[0.84375rem] font-semibold">{t("kip · broccoli")}</span>
            </div>
            <div className={`flex h-[4.5rem] items-end rounded-[14px] px-3 py-2.5 ${tintOf('paars')}`}>
              <span className="font-display text-[0.84375rem] font-semibold">{t("zalm · citroen")}</span>
            </div>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.01em] text-foreground">{t("Zo gaat jouw kookboek eruitzien")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("Plak een link van TikTok, Instagram, YouTube of een receptsite. Ook zonder foto krijgt elk recept een eigen gezicht.")}
            </p>
          </div>
          <div className="space-y-2">
            <Button variant="accent" className="min-h-[50px] w-full" onClick={() => setOpen(true)}>{t("Link plakken")}</Button>
            <Button variant="outline" className="min-h-[50px] w-full" onClick={() => { setManual(true); setOpen(true); }}>
              {t("Zelf invullen")}
            </Button>
          </div>
          {!plus && (
            <p className="text-center text-xs text-muted-foreground">
              {t("Vijf per maand gratis · zelf typen kan altijd")}
            </p>
          )}
        </section>
      )}

      {!loading && recipes.length > 0 && (
        <>
          <header className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-foreground">
              {filter ? findCategory(recipeCategories, filter).name : t("Wat eten we?")}
            </h1>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {filter
                ? t('{0} van je {1} recepten', [visibleRecipes.length, recipes.length])
                : search.trim()
                  ? t("{0} {1} met “{2}”", [visibleRecipes.length, visibleRecipes.length === 1 ? t('recept') : t('recepten'), search.trim()])
                  : `${recipes.length} ${recipes.length === 1 ? t('recept') : t('recepten')}${favoriet ? t(' · {0} maak je het vaakst', [favoriet.recipe.name]) : ''}`}
            </p>
            </div>
            <div className="flex shrink-0 gap-2 pt-1">
              <RecipeSuggestDialog
                trigger={
                  <button
                    type="button"
                    aria-label={t("Wat kun je koken?")}
                    title={t("Wat kun je koken?")}
                    className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-card text-foreground transition-colors duration-150 ease-smooth hover:border-border-strong"
                  >
                    <Lightbulb className="h-5 w-5" strokeWidth={1.9} />
                  </button>
                }
              />
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t("Recept toevoegen")}
                title={t("Recept toevoegen")}
                className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent text-accent-foreground transition-transform duration-150 ease-smooth hover:bg-[#D9661C] active:scale-[.97]"
              >
                <Plus className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
          </header>

          {/* Sticks under the header, so searching and filtering stay within reach
              however far you have scrolled. */}
          <div className="sticky top-14 z-10 -mx-4 space-y-2 bg-background/95 px-4 pb-2 pt-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Zoek op naam of ingrediënt")}
              aria-label={t("Zoek in je recepten")}
              className="bg-card pl-9 pr-10 font-body"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t("Zoekopdracht wissen")}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSort((prev) => (prev === 'nieuw' ? 'naam' : 'nieuw'))}
            aria-label={sort === 'nieuw' ? t("Nu nieuwste eerst, sorteer op naam") : t("Nu op naam, sorteer op nieuwste")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
          </div>

          {filterNames.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4 pb-1">
              <div className="flex w-max items-center gap-2">
                {recipes.some((recipe) => recipe.favorite) && (
                  <button
                    type="button"
                    onClick={() => setAlleenFavoriet((aan) => !aan)}
                    aria-pressed={alleenFavoriet}
                    aria-label={t('Alleen je favorieten')}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-xs font-bold tracking-[-0.01em] transition-colors duration-150 ease-smooth ${
                      alleenFavoriet ? 'bg-destructive text-destructive-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Heart className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    <span className="tabular-nums opacity-80">{recipes.filter((recipe) => recipe.favorite).length}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  aria-pressed={filter === null}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-xs font-bold tracking-[-0.01em] transition-colors duration-150 ease-smooth ${
                    filter === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t("Alles")} <span className="tabular-nums opacity-70">{recipes.length}</span>
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
                  aria-label={t("Categorieën beheren")}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 font-display text-xs font-bold text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
                >
                  <Settings2 className="h-3.5 w-3.5" /> {t("Beheren")}
                </button>
              </div>
            </div>
          )}
          </div>

          {visibleRecipes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? t("Niets gevonden voor “{0}”.", [search.trim()])
                : t("Nog geen recept in “{0}”. Open een recept en zet het label erbij.", [filter])}
            </p>
          )}

          {inHuis && visibleRecipes.length > 0 && (
            <p className="rounded-[12px] border border-border bg-primary-soft px-3 py-2 text-xs text-primary-deep">
              {t('Je hebt {0} {1} in huis.', [inHuis.quantity, inHuis.name.toLowerCase()])}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {mosaicRecipes.map((recipe, index) => {
              // Zoekresultaten liggen allemaal breed; anders krijgt het overzicht
              // ritme doordat elk vijfde vlak de hele breedte pakt.
              const wide = Boolean(search.trim()) || index % 5 === 0;
              return (
                <div key={recipe.id} className={wide ? 'col-span-2' : ''}>
                  <RecipeTile
                    recipe={recipe}
                    categories={recipeCategories}
                    cookCount={cookCounts.get(recipe.id) ?? 0}
                    reason={reasonFor(recipe)}
                    wide={wide}
                    onOpen={() => setDetailId(recipe.id)}
                    onAddToList={() => setListRecipeId(recipe.id)}
                    onToggleFavorite={() => void toggleFavorite(recipe.id)}
                  />
                </div>
              );
            })}
          </div>

          {recipes.length < 3 && !filter && !search.trim() && (
            <section className="rounded-[14px] border border-border bg-primary-soft p-3.5">
              <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">{t("Bonuschef kijkt elke woensdag mee")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("Hoe meer recepten hier staan, hoe vaker er iets van jullie in de bonus ligt.")}
              </p>
            </section>
          )}

        </>
      )}
    </div>
  );
};

export default RecipeList;
