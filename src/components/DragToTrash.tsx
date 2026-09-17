import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';

// Zo lang houd je een potje vast voordat het loskomt.
const VASTHOUDEN_MS = 350;
// Zoveel mag je vinger intussen bewegen; meer is scrollen of vegen.
const STILSTAAN_PX = 8;

interface Sleep { label: string; onRemove: () => void; x: number; y: number }

interface Bak {
  start: (sleep: Sleep) => void;
  move: (x: number, y: number) => void;
  end: () => void;
  bezig: string | null;
}

const Ctx = createContext<Bak | null>(null);

/**
 * Houd een potje vast, sleep het naar de prullenbak onderin, laat los: weg.
 * De provider tekent de zwevende kopie en de prullenbak; de tegels melden
 * alleen waar de vinger is.
 */
export const DragToTrashProvider = ({ children }: { children: ReactNode }) => {
  const [sleep, setSleep] = useState<Sleep | null>(null);
  const [erboven, setErboven] = useState(false);
  const bak = useRef<HTMLDivElement>(null);
  const laatste = useRef<Sleep | null>(null);
  const erbovenRef = useRef(false);

  const start = useCallback((nieuw: Sleep) => {
    laatste.current = nieuw;
    erbovenRef.current = false;
    setSleep(nieuw);
    setErboven(false);
    try { navigator.vibrate?.(12); } catch { /* geen trilmotor */ }
  }, []);

  const move = useCallback((x: number, y: number) => {
    setSleep((huidig) => (huidig ? { ...huidig, x, y } : huidig));
    const r = bak.current?.getBoundingClientRect();
    const boven = Boolean(r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    erbovenRef.current = boven;
    setErboven(boven);
  }, []);

  const end = useCallback(() => {
    if (laatste.current && erbovenRef.current) laatste.current.onRemove();
    laatste.current = null;
    setSleep(null);
    setErboven(false);
  }, []);

  // Zolang je sleept mag de pagina niet scrollen onder je vinger.
  useEffect(() => {
    if (!sleep) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', stop, { passive: false });
    return () => document.removeEventListener('touchmove', stop);
  }, [sleep]);

  return (
    <Ctx.Provider value={{ start, move, end, bezig: sleep?.label ?? null }}>
      {children}
      {sleep && createPortal(
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[70] max-w-[60vw] truncate rounded-[12px] border border-border bg-card px-3 py-2 text-[0.90625rem] font-medium text-foreground shadow-soft"
            style={{ left: sleep.x, top: sleep.y, transform: 'translate(-50%, -140%) scale(1.04)' }}
          >
            {sleep.label}
          </div>
          <div
            ref={bak}
            role="status"
            className={`fixed inset-x-4 z-[70] flex h-16 items-center justify-center gap-2 rounded-[16px] border-2 border-dashed font-display text-sm font-bold transition-colors duration-150 ease-smooth ${
              erboven ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive/60 bg-destructive/10 text-destructive'
            }`}
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
          >
            <Trash2 className="h-5 w-5" />
            {erboven ? t('Laat los om weg te gooien') : t('Sleep hierheen om weg te gooien')}
          </div>
        </>,
        document.body,
      )}
    </Ctx.Provider>
  );
};

/**
 * Handvatten voor een tegel. Lang vasthouden begint het slepen; bewegen
 * daarvoor laat het over aan scrollen of vegen. Een tik blijft een tik.
 */
export const useDragToTrash = (label: string, onRemove: () => void) => {
  const bak = useContext(Ctx);
  const timer = useRef<number | null>(null);
  const begin = useRef<{ x: number; y: number; id: number; el: HTMLElement } | null>(null);
  const actief = useRef(false);
  const netGesleept = useRef(false);

  const stopTimer = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!bak || !e.isPrimary) return;
    netGesleept.current = false;
    actief.current = false;
    const el = e.currentTarget;
    begin.current = { x: e.clientX, y: e.clientY, id: e.pointerId, el };
    stopTimer();
    timer.current = window.setTimeout(() => {
      const b = begin.current;
      if (!b) return;
      actief.current = true;
      try { el.setPointerCapture(b.id); } catch { /* de vinger is al weg */ }
      bak.start({ label, onRemove, x: b.x, y: b.y });
    }, VASTHOUDEN_MS);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const b = begin.current;
    if (!b || b.id !== e.pointerId || !bak) return;
    if (!actief.current) {
      if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > STILSTAAN_PX) { stopTimer(); begin.current = null; }
      return;
    }
    // De veegtegel eronder mag dit niet als veeg zien.
    e.stopPropagation();
    bak.move(e.clientX, e.clientY);
  };

  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    stopTimer();
    const wasActief = actief.current;
    begin.current = null;
    actief.current = false;
    if (!wasActief || !bak) return;
    e.stopPropagation();
    netGesleept.current = true;
    bak.end();
  };

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!netGesleept.current) return;
    netGesleept.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    handvatten: {
      onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture,
      onContextMenu: (e: MouseEvent<HTMLElement>) => { if (actief.current || timer.current !== null) e.preventDefault(); },
      style: { WebkitTouchCallout: 'none', userSelect: 'none' } as const,
    },
    wordtGesleept: bak?.bezig === label,
  };
};
