import { Flame, Beef, Wheat, Droplets, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Recipe, Macros } from '@/types';

interface MacrosDialogProps {
  recipe: Recipe;
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

const MacrosDialog = ({ recipe }: MacrosDialogProps) => {
  const macros = recipe.macros;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Flame className="h-3.5 w-3.5" /> Macro's
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Macro's — {recipe.name}</DialogTitle>
        </DialogHeader>

        {!macros ? (
          <div className="text-center py-8 text-muted-foreground">
            <Flame className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold">Geen macro's beschikbaar</p>
            <p className="text-sm mt-1">Voeg het recept toe via een URL om automatisch macro's te berekenen.</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Calorie ring */}
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

            {/* Macro bars */}
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MacrosDialog;
