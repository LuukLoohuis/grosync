import React, { createContext, useContext } from 'react';
import { useGroceryItems } from '@/hooks/useGroceryItems';
import { useRecipes } from '@/hooks/useRecipes';
import { useUsuals } from '@/hooks/useUsuals';
import { GroceryItem, Recipe, UsualItem } from '@/types';

interface AppContextType {
  userId: string | null;
  groceryItems: GroceryItem[];
  recipes: Recipe[];
  usuals: UsualItem[];
  loading: boolean;
  addGroceryItem: (name: string, fromRecipe?: string) => Promise<void>;
  toggleGroceryItem: (id: string) => Promise<void>;
  removeGroceryItem: (id: string) => Promise<void>;
  clearCheckedItems: () => Promise<void>;
  clearAllItems: () => Promise<void>;
  addRecipeToGroceryList: (ingredients: string[], recipeName: string) => Promise<void>;
  mergeDuplicateItems: () => Promise<void>;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<string | null>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id'>>) => Promise<void>;
  removeRecipe: (id: string) => Promise<void>;
  updateRecipeImage: (id: string, imageUrl: string) => Promise<void>;
  addUsual: (name: string) => Promise<void>;
  removeUsual: (id: string) => Promise<void>;
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
  const usualsHook = useUsuals({ userId });

  const value: AppContextType = {
    userId,
    groceryItems: grocery.groceryItems,
    recipes: recipeHook.recipes,
    usuals: usualsHook.usuals,
    loading: grocery.loading || recipeHook.loading || usualsHook.loading,
    addGroceryItem: grocery.addGroceryItem,
    toggleGroceryItem: grocery.toggleGroceryItem,
    removeGroceryItem: grocery.removeGroceryItem,
    clearCheckedItems: grocery.clearCheckedItems,
    clearAllItems: grocery.clearAllItems,
    addRecipeToGroceryList: grocery.addRecipeToGroceryList,
    mergeDuplicateItems: grocery.mergeDuplicateItems,
    addRecipe: recipeHook.addRecipe,
    updateRecipe: recipeHook.updateRecipe,
    removeRecipe: recipeHook.removeRecipe,
    updateRecipeImage: recipeHook.updateRecipeImage,
    addUsual: usualsHook.addUsual,
    removeUsual: usualsHook.removeUsual,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
