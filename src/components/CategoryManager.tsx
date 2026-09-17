import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORY_COLORS, dotOf, sameName } from '@/lib/recipeCategories';
import type { RecipeCategory } from '@/types';
import { t } from '@/lib/i18n';

/** Renaming, recolouring and removing the categories you made. */
const CategoryManager = () => {
  const { recipeCategories, recipes, renameRecipeCategory, recolorRecipeCategory, removeRecipeCategory } = useAppContext();
  const [names, setNames] = useState<Record<string, string>>({});
  const [doomed, setDoomed] = useState<RecipeCategory | null>(null);

  const usedBy = (name: string) => recipes.filter((r) => (r.categories ?? []).some((l) => sameName(l, name))).length;

  const save = async (category: RecipeCategory) => {
    const typed = (names[category.id] ?? category.name).trim();
    setNames((prev) => { const next = { ...prev }; delete next[category.id]; return next; });
    if (!typed || typed === category.name) return;
    if (recipeCategories.some((c) => c.id !== category.id && sameName(c.name, typed))) {
      toast.error(t("Je hebt “{0}” al", [typed]));
      return;
    }
    await renameRecipeCategory(category.id, typed);
    toast.success(t("“{0}” heet nu “{1}”", [category.name, typed]));
  };

  const remove = async (category: RecipeCategory) => {
    setDoomed(null);
    await removeRecipeCategory(category.id);
    toast.success(t("“{0}” verwijderd", [category.name]));
  };

  if (recipeCategories.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("Je hebt nog geen categorieën gemaakt.")}</p>;
  }

  return (
    <div className="space-y-3">
      {recipeCategories.map((category) => {
        const count = usedBy(category.name);
        return (
          <div key={category.id} className="rounded-[12px] border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${dotOf(category.color)}`} aria-hidden="true" />
              <Input
                value={names[category.id] ?? category.name}
                maxLength={24}
                aria-label={t("Naam van {0}", [category.name])}
                onChange={(e) => setNames((prev) => ({ ...prev, [category.id]: e.target.value }))}
                onBlur={() => save(category)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <button
                type="button"
                onClick={() => setDoomed(category)}
                aria-label={t("{0} verwijderen", [category.name])}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-destructive transition-colors duration-150 ease-smooth hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => recolorRecipeCategory(category.id, color)}
                  aria-label={`${category.name} in kleur ${color}`}
                  aria-pressed={category.color === color}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dotOf(color)} ${
                    category.color === color ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {category.color === color && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {count === 1 ? t("1 recept") : t("{0} recepten", [count])}
              </span>
            </div>
          </div>
        );
      })}

      <AlertDialog open={Boolean(doomed)} onOpenChange={(open) => { if (!open) setDoomed(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('“{0}” verwijderen?', [doomed?.name])}</AlertDialogTitle>
            <AlertDialogDescription>
              {doomed && usedBy(doomed.name) > 0
                ? t("Het label verdwijnt van {0}. De recepten zelf blijven staan.", [usedBy(doomed.name) === 1 ? t("1 recept") : t("{0} recepten", [usedBy(doomed.name)])])
                : t("Deze categorie wordt nergens gebruikt.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("Annuleren")}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => doomed && remove(doomed)}>
              {t("Verwijderen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CategoryManager;
