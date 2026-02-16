import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GroceryItem, Recipe } from '@/types';

interface AppState {
  groceryItems: GroceryItem[];
  recipes: Recipe[];
  addGroceryItem: (name: string, fromRecipe?: string) => void;
  updateRecipeImage: (id: string, imageUrl: string) => void;
  toggleGroceryItem: (id: string) => void;
  removeGroceryItem: (id: string) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => void;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id'>>) => void;
  removeRecipe: (id: string) => void;
  addRecipeToGroceryList: (recipeId: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      groceryItems: [],
      recipes: [
        {
          id: '1',
          name: 'Pasta Carbonara',
          description: 'Classic Italian pasta with eggs, cheese, and pancetta',
          ingredients: ['Spaghetti (400g)', 'Pancetta (200g)', 'Eggs (4)', 'Parmesan cheese (100g)', 'Black pepper', 'Salt'],
        },
        {
          id: '2',
          name: 'Greek Salad',
          description: 'Fresh Mediterranean salad with feta and olives',
          ingredients: ['Cucumber (1)', 'Tomatoes (4)', 'Red onion (1)', 'Feta cheese (200g)', 'Kalamata olives', 'Olive oil', 'Oregano'],
        },
        {
          id: '3',
          name: 'Chicken Stir-Fry',
          description: 'Quick and easy Asian-inspired stir-fry',
          ingredients: ['Chicken breast (500g)', 'Bell peppers (2)', 'Broccoli (1 head)', 'Soy sauce', 'Garlic (3 cloves)', 'Ginger', 'Rice (300g)', 'Sesame oil'],
        },
      ],
      addGroceryItem: (name, fromRecipe) =>
        set((state) => ({
          groceryItems: [
            ...state.groceryItems,
            { id: crypto.randomUUID(), name, checked: false, fromRecipe },
          ],
        })),
      toggleGroceryItem: (id) =>
        set((state) => ({
          groceryItems: state.groceryItems.map((item) =>
            item.id === id ? { ...item, checked: !item.checked } : item
          ),
        })),
      removeGroceryItem: (id) =>
        set((state) => ({
          groceryItems: state.groceryItems.filter((item) => item.id !== id),
        })),
      clearCheckedItems: () =>
        set((state) => ({
          groceryItems: state.groceryItems.filter((item) => !item.checked),
        })),
      clearAllItems: () => set({ groceryItems: [] }),
      addRecipe: (recipe) =>
        set((state) => ({
          recipes: [...state.recipes, { ...recipe, id: crypto.randomUUID() }],
        })),
      updateRecipe: (id, updates) =>
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        })),
      updateRecipeImage: (id, imageUrl) =>
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, imageUrl } : r
          ),
        })),
      addRecipeToGroceryList: (recipeId) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return;
        const existing = get().groceryItems.map((i) => i.name.toLowerCase());
        const newItems = recipe.ingredients
          .filter((ing) => !existing.includes(ing.toLowerCase()))
          .map((ing) => ({
            id: crypto.randomUUID(),
            name: ing,
            checked: false,
            fromRecipe: recipe.name,
          }));
        set((state) => ({
          groceryItems: [...state.groceryItems, ...newItems],
        }));
      },
    }),
    { name: 'couple-cart-storage' }
  )
);
