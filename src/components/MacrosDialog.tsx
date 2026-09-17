import { useState } from 'react';
import { Flame, Beef, Wheat, Droplets, Leaf, Loader2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Recipe, Macros } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

interface MacrosDialogProps {
  recipe: Recipe;
  onMacrosCalculated?: (recipeId: string, macros: Macros) => void;
  /** Leave out for the button; pass these to open it from somewhere else. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MacroBar = ({ label, value, unit, max, color, icon: Icon }: {
  label: string;
  value: number;
  unit: string;
  max: number;
  color: string;
  icon: React.ElementType;
}) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
        <span className="text-sm font-bold text-foreground">{value}{unit}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const MacrosContent = ({ macros }: { macros: Macros }) => (
  <div className="space-y-5 py-2">
    <div className="flex items-center justify-center gap-4 py-4">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="hsl(var(--primary))" strokeWidth="8"
            strokeDasharray={`${Math.min((macros.calories / 800) * 264, 264)} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{macros.calories}</span>
          <span className="text-xs text-muted-foreground font-bold">kcal</span>
        </div>
      </div>
    </div>
    <div className="space-y-4">
      <MacroBar label={t("Eiwit")} value={macros.protein} unit="g" max={100} color="text-primary" icon={Beef} />
      <MacroBar label={t("Koolhydraten")} value={macros.carbs} unit="g" max={200} color="text-secondary" icon={Wheat} />
      <MacroBar label={t("Vet")} value={macros.fat} unit="g" max={80} color="text-destructive" icon={Droplets} />
      <MacroBar label={t("Vezels")} value={macros.fiber} unit="g" max={40} color="text-primary" icon={Leaf} />
    </div>
    <p className="text-xs text-muted-foreground text-center">
      {t("Geschatte waarden per totaal recept")}
    </p>
  </div>
);

const MacrosDialog = ({ recipe, onMacrosCalculated, open, onOpenChange }: MacrosDialogProps) => {
  const controlled = open !== undefined;
  const [calculating, setCalculating] = useState(false);
  const macros = recipe.macros;

  const handleCalculate = async () => {
    if (recipe.ingredients.length === 0) {
      toast.error(t("Dit recept heeft geen ingrediënten."));
      return;
    }
    try {
      setCalculating(true);
      const { data, error } = await supabase.functions.invoke('calculate-macros', {
        body: { ingredients: recipe.ingredients },
      });
      if (error) throw error;
      if (data?.macros && typeof data.macros.calories === 'number') {
        onMacrosCalculated?.(recipe.id, data.macros);
        toast.success(t("Voedingswaarden berekend"));
      } else {
        throw new Error('Invalid response');
      }
    } catch (e) {
      console.error('Failed to calculate macros:', e);
      toast.error(t("Voedingswaarden berekenen lukte niet. Probeer het opnieuw."));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full h-auto min-h-11 flex-col gap-1 px-1 py-2 text-[11px] font-medium leading-tight whitespace-normal">
            <Flame className="h-4 w-4" />
            {t("Voedingswaarden")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t('Voedingswaarden — {0}', [recipe.name])}</DialogTitle>
        </DialogHeader>

        {macros ? (
          <>
            <MacrosContent macros={macros} />
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Herberekenen...")}</> : <><Calculator className="h-4 w-4" /> {t("Opnieuw berekenen")}</>}
            </Button>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground space-y-4">
            <Flame className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold">{t("Nog geen voedingswaarden")}</p>
            <p className="text-sm">{t("Bereken ze op basis van de ingrediënten.")}</p>
            <Button className="gap-2" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Berekenen...")}</> : <><Calculator className="h-4 w-4" /> {t("Voedingswaarden berekenen")}</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MacrosDialog;
