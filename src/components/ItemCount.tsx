import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { GroceryItem } from '@/types';
import { MAX_COUNT, countLabel, itemCount } from '@/lib/itemCount';
import { t } from '@/lib/i18n';
import { tik } from '@/lib/haptics';

const QUICK_PICKS = [1, 2, 3, 4, 6, 10];
// Zo lang blijft de stepper open na de laatste tik; daarna is de lijst weer rustig.
const CLOSE_AFTER_MS = 3500;
// Snel tikken van 1 naar 5 is één wijziging, geen vier.
const SAVE_AFTER_MS = 450;

interface Draft {
  id: string;
  count: number;
  saved: number;
}

/**
 * Eén aantal tegelijk open. De lijst ziet direct het nieuwe getal; opslaan
 * gebeurt pas als je even stopt met tikken, of als de stepper dichtgaat.
 */
export const useCountEditor = (save: (id: string, count: number) => void, remove: (id: string) => void) => {
  const draft = useRef<Draft | null>(null);
  const saveTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const saveRef = useRef(save);
  saveRef.current = save;
  const [, render] = useReducer((n: number) => n + 1, 0);

  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    const d = draft.current;
    if (!d || d.count === d.saved) return;
    d.saved = d.count;
    saveRef.current(d.id, d.count);
  }, []);

  const close = useCallback(() => {
    flush();
    window.clearTimeout(closeTimer.current);
    if (!draft.current) return;
    draft.current = null;
    render();
  }, [flush]);

  const keepOpen = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, CLOSE_AFTER_MS);
  }, [close]);

  const open = useCallback((item: GroceryItem) => {
    flush();
    const count = itemCount(item);
    draft.current = { id: item.id, count, saved: count };
    keepOpen();
    render();
  }, [flush, keepOpen]);

  const set = useCallback((count: number) => {
    const d = draft.current;
    if (!d) return;
    d.count = Math.min(Math.max(count, 1), MAX_COUNT);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_AFTER_MS);
    keepOpen();
    render();
  }, [flush, keepOpen]);

  /** Snelkeuze: meteen opslaan en kort daarna dicht, zodat je de keuze nog ziet oplichten. */
  const pick = useCallback((count: number) => {
    set(count);
    flush();
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, 280);
  }, [set, flush, close]);

  const removeItem = useCallback(() => {
    const d = draft.current;
    window.clearTimeout(saveTimer.current);
    window.clearTimeout(closeTimer.current);
    draft.current = null;
    render();
    if (d) remove(d.id);
  }, [remove]);

  // Ergens anders tikken sluit de stepper, net als een toetsenbord dat wegschuift.
  const openId = draft.current?.id;
  useEffect(() => {
    if (!openId) return;
    const outside = (e: PointerEvent) => {
      const editor = (e.target as Element | null)?.closest?.('[data-count-editor]');
      if (editor?.getAttribute('data-count-editor') !== openId) close();
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [openId, close]);

  // Weg van de lijst met een openstaand aantal: niet kwijtraken.
  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    flush();
  }, [flush]);

  return { editing: draft.current, open, set, pick, close, removeItem };
};

export type CountEditor = ReturnType<typeof useCountEditor>;

// Vegen begint niet op de knoppen: een tik op + mag nooit een regel afvinken.
const stopSwipe = (e: React.PointerEvent) => e.stopPropagation();

/** Het aantal rechts in de regel. Een knop, zodat je weet dat je eraan kunt draaien. */
export const CountPill = ({ item, onOpen }: { item: GroceryItem; onOpen: () => void }) => {
  const count = itemCount(item);
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={stopSwipe}
      aria-label={t('Aantal {0}: {1}. Wijzigen', [item.name, count])}
      className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`flex h-7 min-w-9 items-center justify-center rounded-full px-2.5 font-display text-[0.8125rem] font-bold tabular-nums transition-colors duration-150 ease-smooth ${
          count > 1 ? 'bg-primary-soft text-primary' : 'border border-border text-muted-foreground'
        }`}
      >
        {countLabel(item)}
      </span>
    </button>
  );
};

/** − aantal +, op de plek van de pil. Bij 1 wordt min een prullenbak. */
export const CountStepper = ({ item, editor }: { item: GroceryItem; editor: CountEditor }) => {
  const count = editor.editing?.count ?? itemCount(item);
  const knop = 'flex h-10 w-10 items-center justify-center rounded-full transition-[transform,background-color] duration-100 ease-smooth active:scale-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';
  return (
    <div
      onPointerDown={stopSwipe}
      role="group"
      aria-label={t('Aantal {0}', [item.name])}
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft p-0.5 animate-in fade-in zoom-in-95 duration-150"
    >
      {count <= 1 ? (
        <button type="button" onClick={() => { tik(); editor.removeItem(); }} aria-label={t('{0} weggooien', [item.name])} className={`${knop} bg-card text-destructive`}>
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      ) : (
        <button type="button" onClick={() => { tik(); editor.set(count - 1); }} aria-label={t('Eén minder')} className={`${knop} bg-card text-primary`}>
          <Minus className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>
      )}
      <span aria-live="polite" className="min-w-8 text-center font-display text-base font-bold tabular-nums text-foreground">
        {count}
      </span>
      <button
        type="button"
        onClick={() => { tik(); editor.set(count + 1); }}
        disabled={count >= MAX_COUNT}
        aria-label={t('Eén meer')}
        className={`${knop} bg-primary text-primary-foreground`}
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </button>
    </div>
  );
};

/** Veelgebruikte aantallen onder de regel: één tik naar 6 in plaats van vijf keer plus. */
export const CountQuickPicks = ({ editor }: { editor: CountEditor }) => {
  const current = editor.editing?.count;
  return (
    <div
      onPointerDown={stopSwipe}
      className="flex flex-wrap gap-1.5 pb-2.5 pl-11 pr-2 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {QUICK_PICKS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => { tik(); editor.pick(n); }}
          aria-pressed={current === n}
          className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2.5 font-display text-sm font-semibold tabular-nums transition-colors duration-150 ease-smooth focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
            current === n
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-foreground hover:border-border-strong'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
};
