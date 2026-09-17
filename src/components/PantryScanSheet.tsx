import { useEffect, useState } from 'react';
import { Camera, Pencil, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ScanHit } from '@/services/pantryApi';
import { t } from '@/lib/i18n';

interface PantryScanSheetProps {
  hits: ScanHit[] | null;
  onClose: () => void;
  onConfirm: (names: string[]) => void;
  /** Opent de camera opnieuw; wat die vindt komt bij deze lijst. */
  onAnotherPhoto: () => void;
  scanning: boolean;
  /** Wat er al in de kast staat, zodat een tweede scan dat zegt in plaats van dubbel te doen. */
  known: string[];
}

type Groep = 'zeker' | 'bekend' | 'twijfel';

const KOP: Record<Groep, string> = { zeker: 'Zeker', bekend: 'Staat er al', twijfel: 'Twijfel' };

/**
 * Wat de foto zag, in drie groepen: wat zeker is staat aangevinkt, wat je al hebt
 * staat erbij zonder vinkje, en twijfelgevallen staan onderaan met een reden.
 */
const PantryScanSheet = ({ hits, onClose, onConfirm, onAnotherPhoto, scanning, known }: PantryScanSheetProps) => {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<ScanHit[]>([]);
  const [extra, setExtra] = useState('');
  const [editing, setEditing] = useState<{ was: string; name: string } | null>(null);

  useEffect(() => {
    if (!hits) return;
    setShown((prev) => {
      // Een tweede foto van de volgende plank vult de lijst aan.
      const merged = [...prev];
      for (const hit of hits) {
        const known = merged.findIndex((item) => item.name === hit.name);
        if (known === -1) merged.push(hit);
        else merged[known] = { ...merged[known], sure: Math.max(merged[known].sure, hit.sure) };
      }
      return merged;
    });
    setChosen((prev) => new Set([
      ...prev,
      ...hits
        .filter((hit) => hit.sure >= 0.6 && !known.some((naam) => naam.trim().toLowerCase() === hit.name))
        .map((hit) => hit.name),
    ]));
    // De kast verandert tijdens het afvinken niet; alleen nieuwe treffers tellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);

  const rename = (was: string, typed: string) => {
    const clean = typed.trim().toLowerCase();
    setEditing(null);
    if (!clean || clean === was) return;
    setShown((prev) => prev.map((hit) => (hit.name === was ? { ...hit, name: clean } : hit)));
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.delete(was)) next.add(clean);
      return next;
    });
  };

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const addByHand = () => {
    const clean = extra.trim().toLowerCase();
    if (!clean) return;
    setExtra('');
    setShown((prev) => (prev.some((hit) => hit.name === clean) ? prev : [...prev, { name: clean, sure: 1 }]));
    setChosen((prev) => new Set([...prev, clean]));
  };

  const groepVan = (hit: ScanHit): Groep => {
    if (known.some((naam) => naam.trim().toLowerCase() === hit.name)) return 'bekend';
    return hit.sure >= 0.6 ? 'zeker' : 'twijfel';
  };

  const groepen: Record<Groep, ScanHit[]> = { zeker: [], bekend: [], twijfel: [] };
  for (const hit of shown) groepen[groepVan(hit)].push(hit);

  const regel = (hit: ScanHit, groep: Groep) => {
    const on = chosen.has(hit.name);
    if (editing?.was === hit.name) {
      return (
        <li key={hit.name} className="flex min-h-12 items-center gap-2 px-1">
          <Input
            autoFocus
            value={editing.name}
            maxLength={40}
            aria-label={t("Naam van {0}", [hit.name])}
            onChange={(e) => setEditing({ was: hit.name, name: e.target.value })}
            onBlur={() => rename(hit.name, editing.name)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        </li>
      );
    }
    return (
      <li
        key={hit.name}
        className={`flex items-center gap-1 rounded-[12px] ${
          groep === 'twijfel' ? 'border border-dashed border-border-strong px-1' : ''
        } ${groep === 'bekend' ? 'opacity-70' : ''}`}
      >
        <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 px-2">
          <Checkbox checked={on} onCheckedChange={() => toggle(hit.name)} aria-label={hit.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] text-foreground first-letter:uppercase">{hit.name}</span>
            {groep === 'bekend' && <span className="block text-xs text-muted-foreground">{t("staat al in je kast")}</span>}
            {groep === 'twijfel' && <span className="block text-xs text-muted-foreground">{t("label niet goed leesbaar")}</span>}
          </span>
        </label>
        {/* Verkeerd gelezen? Verbeter het hier, niet straks in de kast. */}
        <button
          type="button"
          onClick={() => setEditing({ was: hit.name, name: hit.name })}
          aria-label={t("{0} aanpassen", [hit.name])}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  };

  return (
    <Sheet open={Boolean(hits)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg flex-col rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">
            {shown.length === 0 ? t("Niets herkend") : t('{0} {1} gezien', [shown.length, shown.length === 1 ? t('product') : t('producten')])}
          </SheetTitle>
          <SheetDescription>
            {shown.length === 0
              ? t("Probeer het nog eens van dichterbij, met de etiketten naar voren.")
              : t("Vink af wat klopt. Twijfelgevallen staan onderaan.")}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-2 mt-3 flex-1 space-y-4 overflow-y-auto px-2">
          {(['zeker', 'bekend', 'twijfel'] as Groep[]).map((groep) => (
            groepen[groep].length > 0 && (
              <div key={groep}>
                <h3 className="mb-1 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  {KOP[groep]} · {groepen[groep].length}
                </h3>
                <ul className="space-y-1">{groepen[groep].map((hit) => regel(hit, groep))}</ul>
              </div>
            )
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addByHand(); } }}
            placeholder={t("Iets gemist? Typ het erbij")}
            aria-label={t("Zelf een product toevoegen")}
            className="bg-card font-body"
          />
          <Button onClick={addByHand} size="icon" className="h-11 w-11 shrink-0" aria-label={t("Product toevoegen")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex gap-2 pb-2">
          <Button variant="outline" className="min-h-12 flex-1 gap-2" onClick={onAnotherPhoto} disabled={scanning}>
            <Camera className="h-4 w-4" /> {scanning ? t("Bezig…") : t("Opnieuw")}
          </Button>
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            disabled={chosen.size === 0}
            onClick={() => onConfirm([...chosen])}
          >
            {chosen.size > 0 ? t("{0} toevoegen", [chosen.size]) : t("Toevoegen")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PantryScanSheet;
