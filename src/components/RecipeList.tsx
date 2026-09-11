import { useState } from 'react';
import { ChefHat, ChevronDown, Plus, ShoppingCart, Link, X, Loader2, PenLine, Globe, Languages } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import RecipeEditDialog from '@/components/RecipeEditDialog';
import RecipeViewDialog from '@/components/RecipeViewDialog';
import MacrosDialog from '@/components/MacrosDialog';
import { fetchRecipeFromUrl, fetchRecipeFromText, translateRecipe, calculateMacros, type FetchedRecipe } from '@/services/recipeApi';
import RecipeSuggestDialog from '@/components/RecipeSuggestDialog';

const RecipeList = () => {
  const { recipes, addRecipe, removeRecipe, addRecipeToGroceryList, updateRecipeImage, updateRecipe } = useAppContext();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'manual' | 'url'>('choose');
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
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const resetForm = () => {
    setName(''); setDescription(''); setIngredientText(''); setInstructions(''); setSourceUrl(''); setMode('choose'); setFetchedMacros(null); setFetchedImageUrl(undefined); setServings(4); setTranslating(false); setPasteMode(false); setPastedText('');
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

  const fetchFromUrl = async () => {
    const url = sourceUrl.trim();
    if (!url) return;
    try {
      setFetchingMeta(true);
      const data = await fetchRecipeFromUrl(url);
      if (applyFetchedRecipe(data)) return;
      if (/instagram\.com\//i.test(url)) {
        // Instagram sends our server to its login page, so the post text has to come from the user.
        setPasteMode(true);
        toast.error('Instagram laat ons deze post niet uitlezen. Plak de tekst van de post hieronder.');
      } else {
        setMode('manual');
        toast.error('Geen recept gevonden in deze link. Vul het hieronder zelf in.');
      }
    } catch (e) {
      console.error('Failed to fetch from URL:', e);
      toast.error(`Kon recept niet ophalen: ${(e as Error).message}`);
    } finally {
      setFetchingMeta(false);
    }
  };

  const fetchFromText = async () => {
    const text = pastedText.trim();
    if (!text) return;
    try {
      setFetchingMeta(true);
      const data = await fetchRecipeFromText(text);
      if (!applyFetchedRecipe(data)) {
        setMode('manual');
        toast.error('Geen recept gevonden in deze tekst. Vul het hieronder zelf in.');
      }
    } catch (e) {
      console.error('Failed to read recipe text:', e);
      toast.error(`Kon recept niet uitlezen: ${(e as Error).message}`);
    } finally {
      setFetchingMeta(false);
    }
  };

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
    });

    resetForm();
    setOpen(false);
    toast.success('Recept toegevoegd!');
  };

  const handleCook = (recipeId: string, recipeName: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    addRecipeToGroceryList(recipe.ingredients, recipeName);
    toast.success(`${recipe.ingredients.length} items op je lijst gezet`);
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" /> Recept toevoegen
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nieuw recept</DialogTitle>
          </DialogHeader>

          {mode === 'choose' && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground text-center">Hoe wil je het recept toevoegen?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setMode('url')} className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all">
                  <Globe className="h-8 w-8 text-primary" />
                  <span className="font-medium text-foreground">Via een link</span>
                  <span className="text-xs text-muted-foreground text-center">Plak een URL en we halen het recept op</span>
                </button>
                <button onClick={() => setMode('manual')} className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all">
                  <PenLine className="h-8 w-8 text-primary" />
                  <span className="font-medium text-foreground">Handmatig</span>
                  <span className="text-xs text-muted-foreground text-center">Voer het recept zelf in</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'url' && !name && !ingredientText && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Link className="h-3.5 w-3.5" /> Plak de recept-URL
                </label>
                <div className="flex gap-2">
                  <Input type="url" placeholder="https://example.com/recipe" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} autoFocus />
                  <Button type="button" onClick={fetchFromUrl} disabled={!sourceUrl.trim() || fetchingMeta} className="shrink-0 gap-2">
                    {fetchingMeta ? <><Loader2 className="h-4 w-4 animate-spin" /> Ophalen...</> : 'Ophalen'}
                  </Button>
                </div>
              </div>
              {pasteMode ? (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground mb-1 block">Tekst van de post</label>
                  <Textarea placeholder="Kopieer de beschrijving van de post en plak hem hier" value={pastedText} onChange={(e) => setPastedText(e.target.value)} rows={6} />
                  <Button type="button" onClick={fetchFromText} disabled={!pastedText.trim() || fetchingMeta} className="w-full gap-2">
                    {fetchingMeta ? <><Loader2 className="h-4 w-4 animate-spin" /> Uitlezen...</> : 'Recept uit tekst halen'}
                  </Button>
                </div>
              ) : (
                <button onClick={() => setPasteMode(true)} className="text-xs text-primary hover:underline block">Of plak de tekst van een post</button>
              )}
              <button onClick={() => setMode('choose')} className="text-xs text-muted-foreground hover:underline">← Terug</button>
            </div>
          )}

          {(mode === 'manual' || (mode === 'url' && (name || ingredientText))) && (
            <div className="space-y-4">
              {mode === 'url' && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  ✅ {pasteMode ? 'Recept uit geplakte tekst gehaald' : 'Recept opgehaald van URL'} — je kunt alles hieronder aanpassen.
                </div>
              )}
              {fetchedImageUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img src={fetchedImageUrl} alt="Recipe preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input placeholder="Recept naam" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Korte beschrijving" value={description} onChange={(e) => setDescription(e.target.value)} />
              {mode === 'manual' && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Link className="h-3.5 w-3.5" /> Recept URL (optioneel)
                  </label>
                  <Input type="url" placeholder="https://example.com/recipe" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Ingrediënten (één per regel)</label>
                <Textarea placeholder={"Kipfilet (500g)\nRijst (300g)\nSojasaus"} value={ingredientText} onChange={(e) => setIngredientText(e.target.value)} rows={6} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Aantal personen</label>
                <Input type="number" min={1} max={100} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 4)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Instructies</label>
                <Textarea placeholder={"1. Verwarm de oven voor op 180°C\n2. Kruid de kip...\n3. Bak 25 minuten..."} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} className="min-h-[200px]" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button onClick={() => { resetForm(); }} className="text-xs text-muted-foreground hover:underline">← Terug</button>
                  <Button type="button" variant="outline" onClick={translateRecipeHandler} disabled={translating || (!name.trim() && !ingredientText.trim())} className="gap-2">
                    {translating ? <><Loader2 className="h-4 w-4 animate-spin" /> Vertalen...</> : <><Languages className="h-4 w-4" /> Vertaal naar NL</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={calculateMacrosHandler} className="gap-2">
                    🍎 Macros
                  </Button>
                  <Button onClick={handleAdd} className="flex-1">Recept opslaan</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecipeSuggestDialog />

      {recipes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="font-display text-lg">Nog geen recepten</p>
          <p className="text-sm mt-1">Plak een link van TikTok, Instagram, YouTube of een receptsite.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="bg-card rounded-lg overflow-hidden shadow-soft animate-fade-in group relative">
            {recipe.imageUrl && (
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <div className="p-4">
              <button
                onClick={() => removeRecipe(recipe.id)}
                aria-label={`Verwijder ${recipe.name}`}
                className="absolute top-1 right-1 h-11 w-11 flex items-center justify-center text-destructive transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
              >
                <span className="bg-background/80 rounded-full p-1.5"><X className="h-4 w-4" /></span>
              </button>
              <h3 className="font-display text-lg text-foreground">{recipe.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
              {recipe.sourceUrl && (
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
                  <Link className="h-3 w-3" /> Origineel bekijken
                </a>
              )}
              <Collapsible>
                <CollapsibleTrigger className="text-sm text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer">
                  <ChevronDown className="h-3.5 w-3.5" /> Ingrediënten ({recipe.ingredients.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>{ing}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
              {recipe.instructions && (
                <Collapsible>
                  <CollapsibleTrigger className="text-sm text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer">
                    <ChevronDown className="h-3.5 w-3.5" /> Bereiding
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="mt-2 text-sm text-foreground/80 whitespace-pre-line">{recipe.instructions}</p>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <div className="mt-4 space-y-2">
                <Button size="sm" className="w-full gap-2" onClick={() => handleCook(recipe.id, recipe.name)}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Zet op je lijst
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <RecipeViewDialog recipe={recipe} />
                  <RecipeEditDialog recipe={recipe} />
                  <MacrosDialog recipe={recipe} onMacrosCalculated={(id, macros) => updateRecipe(id, { macros })} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeList;
