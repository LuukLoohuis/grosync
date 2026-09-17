import React, { createContext, useCallback, useContext } from 'react';
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
import { sameProduct } from '@/lib/pantry';

/** Hoe vol een potje is, in de woorden die de app gebruikt. */
export type PantryState = 'vol' | 'bijna' | 'op';

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
  renameGroceryItem: (id: string, name: string) => Promise<void>;
  applyAhMatches: (matches: AhMatch[], unmatchedIds?: string[]) => Promise<void>;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<string | null>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id'>>) => Promise<void>;
  removeRecipe: (id: string) => void;
  updateRecipeImage: (id: string, imageUrl: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
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
  setPantryState: (id: string, stand: PantryState) => Promise<void>;
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

  // Wat bijna op of op is hoort op de boodschappenlijst; staat het weer vol, dan
  // hoeft het er niet meer op. Zo doet het label in de kast ook echt iets.
  const VAN_VOORRAAD = 'je voorraad';
  const stemAfMetLijst = useCallback((naam: string, nodig: boolean) => {
    const staatEr = grocery.groceryItems.find((item) => !item.checked && sameProduct(item.name, naam));
    if (nodig && !staatEr) { void grocery.addGroceryItem(naam, VAN_VOORRAAD); return; }
    // Alleen weghalen wat er namens de kast op kwam; wat je zelf typte blijft staan.
    if (!nodig && staatEr && staatEr.fromRecipe === VAN_VOORRAAD) void grocery.removeGroceryItem(staatEr.id);
  }, [grocery]);

  const setPantryQuantity = useCallback(async (id: string, quantity: number) => {
    const item = pantryHook.pantry.find((row) => row.id === id);
    await pantryHook.setQuantity(id, quantity);
    if (item) stemAfMetLijst(item.name, quantity === 0 || (quantity === 1 && item.low));
  }, [pantryHook, stemAfMetLijst]);

  /** De drie standen in één keer goed zetten, inclusief wat er op de lijst hoort. */
  const setPantryState = useCallback(async (id: string, stand: PantryState) => {
    const item = pantryHook.pantry.find((row) => row.id === id);
    if (!item) return;
    if (stand === 'op') {
      await pantryHook.setQuantity(id, 0);
      await pantryHook.setLow(id, false);
    } else {
      await pantryHook.setQuantity(id, Math.max(1, item.quantity));
      await pantryHook.setLow(id, stand === 'bijna');
    }
    stemAfMetLijst(item.name, stand !== 'vol');
  }, [pantryHook, stemAfMetLijst]);

  const setPantryLow = useCallback(async (id: string, low: boolean) => {
    const item = pantryHook.pantry.find((row) => row.id === id);
    await pantryHook.setLow(id, low);
    if (item) stemAfMetLijst(item.name, low || item.quantity === 0);
  }, [pantryHook, stemAfMetLijst]);

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
    renameGroceryItem: grocery.renameGroceryItem,
    applyAhMatches: grocery.applyAhMatches,
    addRecipe: recipeHook.addRecipe,
    updateRecipe: recipeHook.updateRecipe,
    removeRecipe: recipeHook.removeRecipe,
    updateRecipeImage: recipeHook.updateRecipeImage,
    toggleFavorite: recipeHook.toggleFavorite,
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
    setPantryQuantity,
    setPantryLow,
    setPantryState,
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
