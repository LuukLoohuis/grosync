import React, { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGroceryItems } from '@/hooks/useGroceryItems';
import { useRecipes } from '@/hooks/useRecipes';
import { GroceryItem, Recipe } from '@/types';

interface AppContextType {
  userId: string | null;
  groceryItems: GroceryItem[];
  recipes: Recipe[];
  loading: boolean;
  addGroceryItem: (name: string, fromRecipe?: string) => Promise<void>;
  toggleGroceryItem: (id: string) => Promise<void>;
  removeGroceryItem: (id: string) => Promise<void>;
  clearCheckedItems: () => Promise<void>;
  clearAllItems: () => Promise<void>;
  addRecipeToGroceryList: (ingredients: string[], recipeName: string) => Promise<void>;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<string | null>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id'>>) => Promise<void>;
  removeRecipe: (id: string) => Promise<void>;
  updateRecipeImage: (id: string, imageUrl: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const AppProvider = ({ children, userId }: { children: React.ReactNode; userId: string | null }) => {
  const grocery = useGroceryItems({ userId });
  const recipeHook = useRecipes({ userId });

  const value: AppContextType = {
    userId,
    groceryItems: grocery.groceryItems,
    recipes: recipeHook.recipes,
    loading: grocery.loading || recipeHook.loading,
    addGroceryItem: grocery.addGroceryItem,
    toggleGroceryItem: grocery.toggleGroceryItem,
    removeGroceryItem: grocery.removeGroceryItem,
    clearCheckedItems: grocery.clearCheckedItems,
    clearAllItems: grocery.clearAllItems,
    addRecipeToGroceryList: grocery.addRecipeToGroceryList,
    addRecipe: recipeHook.addRecipe,
    updateRecipe: recipeHook.updateRecipe,
    removeRecipe: recipeHook.removeRecipe,
    updateRecipeImage: recipeHook.updateRecipeImage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
