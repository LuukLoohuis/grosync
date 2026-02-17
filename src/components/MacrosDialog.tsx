import { useState } from 'react';
import { Flame, Beef, Wheat, Droplets, Leaf, Loader2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Recipe, Macros } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MacrosDialogProps {
  recipe: Recipe;
  onMacrosCalculated?: (recipeId: string, macros: Macros) => void;
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
      <MacroBar label="Eiwit" value={macros.protein} unit="g" max={100} color="text-primary" icon={Beef} />
      <MacroBar label="Koolhydraten" value={macros.carbs} unit="g" max={200} color="text-secondary" icon={Wheat} />
      <MacroBar label="Vet" value={macros.fat} unit="g" max={80} color="text-destructive" icon={Droplets} />
      <MacroBar label="Vezels" value={macros.fiber} unit="g" max={40} color="text-primary" icon={Leaf} />
    </div>
    <p className="text-xs text-muted-foreground text-center">
      Geschatte waarden per totaal recept
    </p>
  </div>
);

const MacrosDialog = ({ recipe, onMacrosCalculated }: MacrosDialogProps) => {
  const [calculating, setCalculating] = useState(false);
  const macros = recipe.macros;

  const handleCalculate = async () => {
    if (recipe.ingredients.length === 0) {
      toast.error('Dit recept heeft geen ingrediënten.');
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
        toast.success("Macro's berekend!");
      } else {
        throw new Error('Invalid response');
      }
    } catch (e) {
      console.error('Failed to calculate macros:', e);
      toast.error("Kon macro's niet berekenen.");
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 font-medium">
          <Flame className="h-3.5 w-3.5" /> Macro's
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Macro's — {recipe.name}</DialogTitle>
        </DialogHeader>

        {macros ? (
          <>
            <MacrosContent macros={macros} />
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <><Loader2 className="h-4 w-4 animate-spin" /> Herberekenen...</> : <><Calculator className="h-4 w-4" /> Herbereken macro's</>}
            </Button>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground space-y-4">
            <Flame className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold">Geen macro's beschikbaar</p>
            <p className="text-sm">Laat de macro's berekenen op basis van de ingrediënten.</p>
            <Button className="gap-2" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <><Loader2 className="h-4 w-4 animate-spin" /> Berekenen...</> : <><Calculator className="h-4 w-4" /> Bereken macro's</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MacrosDialog;
