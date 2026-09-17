import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { CATEGORY_COLORS, PRESETS, dotOf, nextColor, sameName, tintOf } from '@/lib/recipeCategories';
import { t } from '@/lib/i18n';

interface CategoryPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Picks the categories of one recipe. Everything you already have is a toggle;
 * the ready-made ones you have not used yet sit underneath, and below that you
 * can make up your own with a colour of your choice.
 */
const CategoryPicker = ({ value, onChange }: CategoryPickerProps) => {
  const { recipeCategories, addRecipeCategory } = useAppContext();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(nextColor(recipeCategories.map((c) => c.color)));

  const isOn = (label: string) => value.some((v) => sameName(v, label));

  const toggle = (label: string) => {
    onChange(isOn(label) ? value.filter((v) => !sameName(v, label)) : [...value, label]);
  };

  const create = async (label: string, chosen?: string) => {
    const clean = label.trim();
    if (!clean) return;
    const stored = await addRecipeCategory(clean, chosen);
    if (!isOn(stored)) onChange([...value, stored]);
    setName('');
    setCreating(false);
    setColor(nextColor([...recipeCategories.map((c) => c.color), chosen ?? '']));
  };

  // Labels on the recipe that no longer have a row of their own still belong here.
  const known = [
    ...recipeCategories.map((c) => ({ name: c.name, color: c.color })),
    ...value
      .filter((label) => !recipeCategories.some((c) => sameName(c.name, label)))
      .map((label) => ({ name: label, color: 'groen' })),
  ];
  const unused = PRESETS.filter((preset) => !known.some((c) => sameName(c.name, preset.name)));

  return (
    <div>
      <span className="mb-2 block text-sm text-muted-foreground">{t("Categorieën")}</span>

      <div className="flex flex-wrap gap-2">
        {known.map((category) => {
          const on = isOn(category.name);
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => toggle(category.name)}
              aria-pressed={on}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-xs font-bold tracking-[-0.01em] transition-colors duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                on ? tintOf(category.color) : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {on ? <Check className="h-3.5 w-3.5" /> : <span className={`h-2 w-2 rounded-full ${dotOf(category.color)}`} />}
              {category.name}
            </button>
          );
        })}

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 font-display text-xs font-bold text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" /> {t("Eigen categorie")}
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-3 rounded-[12px] border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              maxLength={24}
              placeholder={t("Bijvoorbeeld: Vega")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(name, color); } }}
            />
            <button
              type="button"
              onClick={() => { setCreating(false); setName(''); }}
              aria-label={t("Annuleren")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={t("Kleur {0}", [option])}
                aria-pressed={color === option}
                className={`h-8 w-8 shrink-0 rounded-full ${dotOf(option)} transition-transform duration-150 ease-smooth ${
                  color === option ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
            <button
              type="button"
              onClick={() => create(name, color)}
              disabled={!name.trim()}
              className="ml-auto min-h-11 rounded-full bg-primary px-4 font-display text-xs font-bold text-primary-foreground disabled:opacity-40"
            >
              {t("Maken")}
            </button>
          </div>
        </div>
      )}

      {unused.length > 0 && !creating && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("Ook handig:")}</span>
          {unused.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => create(preset.name, preset.color)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 font-display text-xs font-bold text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3 w-3" /> {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryPicker;
