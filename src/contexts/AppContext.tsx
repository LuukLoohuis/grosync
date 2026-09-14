import React, { createContext, useContext } from 'react';
import { useGroceryItems } from '@/hooks/useGroceryItems';
import { useRecipes } from '@/hooks/useRecipes';
import { useUsuals } from '@/hooks/useUsuals';
import { usePantryStaples } from '@/hooks/usePantryStaples';
import { useRecipeCategories } from '@/hooks/useRecipeCategories';
import { usePantry } from '@/hooks/usePantry';
import { useEntitlements, type MeteredFeature } from '@/hooks/useEntitlements';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import type { AhMatch } from '@/services/ahApi';
import { GroceryItem, PantryItem, Recipe, RecipeCategory, UsualItem } from '@/types';

interface FrequentItem {
  name: string;
  count: number;
}

interface AppContextType {
  userId: string | null;
  groceryItems: GroceryItem[];
  recipes: Recipe[];
  usuals: UsualItem[];
  loading: boolean;
  frequentItems: FrequentItem[];
  trackPurchase: (itemName: string) => Promise<void>;
  addGroceryItem: (name: string, fromRecipe?: string) => Promise<void>;
  toggleGroceryItem: (id: string) => Promise<void>;
  setGroceryItemChecked: (id: string, checked: boolean) => Promise<void>;
  removeGroceryItem: (id: string) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => Promise<void>;
  addRecipeToGroceryList: (ingredients: string[], recipeName: string) => Promise<boolean>;
  mergeDuplicateItems: () => Promise<void>;
  applyAhMatches: (matches: AhMatch[], unmatchedIds?: string[]) => Promise<void>;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<string | null>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id'>>) => Promise<void>;
  removeRecipe: (id: string) => void;
  updateRecipeImage: (id: string, imageUrl: string) => Promise<void>;
  recipeCategories: RecipeCategory[];
  addRecipeCategory: (name: string, color?: string) => Promise<string>;
  renameRecipeCategory: (id: string, name: string) => Promise<void>;
  recolorRecipeCategory: (id: string, color: string) => Promise<void>;
  removeRecipeCategory: (id: string) => Promise<void>;
  addUsual: (name: string) => Promise<void>;
  removeUsual: (id: string) => void;
  pantry: PantryItem[];
  pantryLoading: boolean;
  stockUp: (name: string, source?: string, bump?: boolean) => Promise<void>;
  setPantryQuantity: (id: string, quantity: number) => Promise<void>;
  setPantryLow: (id: string, low: boolean) => Promise<void>;
  renamePantryItem: (id: string, name: string) => Promise<void>;
  removePantryItem: (id: string) => Promise<void>;
  plus: boolean;
  isAdmin: boolean;
  remaining: (feature: MeteredFeature) => number;
  refreshEntitlements: () => Promise<void>;
  pantryStaples: string[];
  savePantryStaples: (staples: string[]) => Promise<void>;
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
  const purchaseHook = usePurchaseHistory(userId);
  const pantry = usePantryStaples(userId);
  const categoryHook = useRecipeCategories({ userId });
  const pantryHook = usePantry({ userId });
  const entitlements = useEntitlements({ userId });

  const value: AppContextType = {
    userId,
    groceryItems: grocery.groceryItems,
    recipes: recipeHook.recipes,
    usuals: usualsHook.usuals,
    loading: grocery.loading || recipeHook.loading || usualsHook.loading,
    frequentItems: purchaseHook.frequentItems,
    trackPurchase: purchaseHook.trackPurchase,
    addGroceryItem: grocery.addGroceryItem,
    toggleGroceryItem: grocery.toggleGroceryItem,
    setGroceryItemChecked: grocery.setGroceryItemChecked,
    removeGroceryItem: grocery.removeGroceryItem,
    clearCheckedItems: grocery.clearCheckedItems,
    clearAllItems: grocery.clearAllItems,
    addRecipeToGroceryList: grocery.addRecipeToGroceryList,
    mergeDuplicateItems: grocery.mergeDuplicateItems,
    applyAhMatches: grocery.applyAhMatches,
    addRecipe: recipeHook.addRecipe,
    updateRecipe: recipeHook.updateRecipe,
    removeRecipe: recipeHook.removeRecipe,
    updateRecipeImage: recipeHook.updateRecipeImage,
    recipeCategories: categoryHook.categories,
    addRecipeCategory: categoryHook.addCategory,
    renameRecipeCategory: categoryHook.renameCategory,
    recolorRecipeCategory: categoryHook.recolorCategory,
    removeRecipeCategory: categoryHook.removeCategory,
    addUsual: usualsHook.addUsual,
    removeUsual: usualsHook.removeUsual,
    pantry: pantryHook.pantry,
    pantryLoading: pantryHook.pantryLoading,
    stockUp: pantryHook.stockUp,
    setPantryQuantity: pantryHook.setQuantity,
    setPantryLow: pantryHook.setLow,
    renamePantryItem: pantryHook.renamePantryItem,
    removePantryItem: pantryHook.removePantryItem,
    plus: entitlements.plus,
    isAdmin: entitlements.isAdmin,
    remaining: entitlements.remaining,
    refreshEntitlements: entitlements.refreshEntitlements,
    pantryStaples: pantry.pantryStaples,
    savePantryStaples: pantry.savePantryStaples,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
