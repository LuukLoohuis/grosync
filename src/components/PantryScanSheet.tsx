import { useEffect, useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ScanHit } from '@/services/pantryApi';

interface PantryScanSheetProps {
  hits: ScanHit[] | null;
  onClose: () => void;
  onConfirm: (names: string[]) => void;
  /** Opens the camera again; what it finds is added to this list. */
  onAnotherPhoto: () => void;
  scanning: boolean;
}

/** Nothing is stored before you have seen it: the photo proposes, you decide. */
const PantryScanSheet = ({ hits, onClose, onConfirm, onAnotherPhoto, scanning }: PantryScanSheetProps) => {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<ScanHit[]>([]);
  const [extra, setExtra] = useState('');

  useEffect(() => {
    if (!hits) return;
    setShown((prev) => {
      // A second photo of the next shelf adds to the list instead of replacing it.
      const merged = [...prev];
      for (const hit of hits) {
        const known = merged.findIndex((item) => item.name === hit.name);
        if (known === -1) merged.push(hit);
        else merged[known] = { ...merged[known], sure: Math.max(merged[known].sure, hit.sure) };
      }
      return merged;
    });
    // A doubtful read starts unticked, so a wrong guess never sneaks in.
    setChosen((prev) => new Set([...prev, ...hits.filter((hit) => hit.sure >= 0.6).map((hit) => hit.name)]));
  }, [hits]);

  const addByHand = () => {
    const clean = extra.trim().toLowerCase();
    if (!clean) return;
    setExtra('');
    // What the camera missed, you type in here instead of afterwards.
    setShown((prev) => (prev.some((hit) => hit.name === clean) ? prev : [...prev, { name: clean, sure: 1 }]));
    setChosen((prev) => new Set([...prev, clean]));
  };

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <Sheet open={Boolean(hits)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">Dit zag ik staan</SheetTitle>
          <SheetDescription>
            {shown.length === 0
              ? 'Niets herkend op deze foto.'
              : 'Vink af wat klopt. Scan gerust nog een plank erbij.'}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-2 mt-3 flex-1 overflow-y-auto px-2">
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Probeer het nog eens van dichterbij, met de etiketten naar voren.
            </p>
          )}
          <ul className="space-y-1">
            {shown.map((hit) => {
              const on = chosen.has(hit.name);
              return (
                <li key={hit.name}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] px-2 hover:bg-muted/60">
                    <Checkbox checked={on} onCheckedChange={() => toggle(hit.name)} aria-label={hit.name} />
                    <span className="flex-1 text-[0.9375rem] text-foreground first-letter:uppercase">{hit.name}</span>
                    {hit.sure < 0.6 && <span className="text-xs text-muted-foreground">twijfel</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addByHand(); } }}
            placeholder="Iets gemist? Typ het erbij"
            aria-label="Zelf een product toevoegen"
            className="bg-card font-body"
          />
          <Button onClick={addByHand} size="icon" className="h-11 w-11 shrink-0" aria-label="Product toevoegen">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex gap-2 pb-2">
          <Button variant="outline" className="min-h-12 flex-1 gap-2" onClick={onAnotherPhoto} disabled={scanning}>
            <Camera className="h-4 w-4" /> {scanning ? 'Bezig…' : 'Nog een plank'}
          </Button>
          <Button
            className="min-h-12 flex-1"
            disabled={chosen.size === 0}
            onClick={() => onConfirm([...chosen])}
          >
            In de kast{chosen.size > 0 ? ` (${chosen.size})` : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PantryScanSheet;
