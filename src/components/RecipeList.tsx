import { useState } from 'react';
import { ChefHat, ChevronDown, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useStore } from '@/store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const RecipeList = () => {
  const { recipes, addRecipe, removeRecipe, addRecipeToGroceryList } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !ingredientText.trim()) return;
    addRecipe({
      name: name.trim(),
      description: description.trim(),
      ingredients: ingredientText.split('\n').map((l) => l.trim()).filter(Boolean),
      instructions: instructions.trim() || undefined,
    });
    setName('');
    setDescription('');
    setIngredientText('');
    setInstructions('');
    setOpen(false);
    toast.success('Recipe added!');
  };

  const handleCook = (recipeId: string, recipeName: string) => {
    addRecipeToGroceryList(recipeId);
    toast.success(`Added ingredients from "${recipeName}" to your list!`);
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add Recipe
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Recipe name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Ingredients (one per line)
              </label>
              <Textarea
                placeholder={"Chicken breast (500g)\nRice (300g)\nSoy sauce"}
                value={ingredientText}
                onChange={(e) => setIngredientText(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Instructions
              </label>
              <Textarea
                placeholder={"1. Preheat the oven to 180°C\n2. Season the chicken...\n3. Cook for 25 minutes..."}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={10}
                className="min-h-[200px]"
              />
            </div>
            <Button onClick={handleAdd} className="w-full">
              Save Recipe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {recipes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="font-display text-lg">No recipes yet</p>
          <p className="text-sm mt-1">Add your favourite recipes above!</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="bg-card rounded-lg p-4 shadow-soft animate-fade-in group relative"
          >
            <button
              onClick={() => removeRecipe(recipe.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-display text-lg text-foreground">{recipe.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
            <Collapsible>
              <CollapsibleTrigger className="text-sm text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer">
                <ChevronDown className="h-3.5 w-3.5" /> Ingredients ({recipe.ingredients.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 space-y-1">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {ing}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
            {recipe.instructions && (
              <Collapsible>
                <CollapsibleTrigger className="text-sm text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer">
                  <ChevronDown className="h-3.5 w-3.5" /> Instructions
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="mt-2 text-sm text-foreground/80 whitespace-pre-line">{recipe.instructions}</p>
                </CollapsibleContent>
              </Collapsible>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full gap-2"
              onClick={() => handleCook(recipe.id, recipe.name)}
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Add to Grocery List
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeList;
