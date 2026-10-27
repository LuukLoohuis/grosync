import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { minderBeweging, tik } from '@/lib/haptics';

// How far a row must travel before letting go checks it off or throws it away.
const THRESHOLD = 96;
// How long a thrown-away row flies before it is gone.
const WEG_MS = 180;
// Movement that still counts as a tap or a scroll.
const SLOP = 10;

interface SwipeToCheckProps {
  onSwipe: () => void;
  /** Swiping to the left throws the row away. Without it a row only swipes to the right. */
  onRemove?: () => void;
  children: ReactNode;
  /** The row's own corners; a row inside a shared card has none. */
  className?: string;
}

/**
 * Swipe a row to the right to check it off, or to the left to throw it away.
 * Touch and pen only; the check button and the row's sheet stay the main controls.
 */
const SwipeToCheck = ({ onSwipe, onRemove, children, className = 'rounded-xl' }: SwipeToCheckProps) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const offsetRef = useRef(0);
  const swallowClick = useRef(false);

  const move = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      const reach = onRemove ? Math.abs(dx) : dx;
      if (reach < SLOP || Math.abs(dx) < Math.abs(dy)) return;
      g.dragging = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the row still follows the moves it gets.
      }
    }
    const pulled = dx > 0 ? Math.max(0, dx - SLOP) : Math.min(0, dx + SLOP);
    const next = onRemove ? pulled : Math.max(0, pulled);
    // One small tick the moment letting go would count, so the thumb knows without looking.
    if ((Math.abs(next) >= THRESHOLD) !== (Math.abs(offsetRef.current) >= THRESHOLD)) tik('licht');
    move(next);
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.dragging) return;
    // The browser may still fire a click on the button under the finger.
    swallowClick.current = true;
    setDragging(false);
    const ver = offsetRef.current;
    const raak = e.type === 'pointerup' && (ver >= THRESHOLD || (!!onRemove && ver <= -THRESHOLD));
    if (!raak) {
      move(0);
      return;
    }
    // Past the line the row keeps going the way it was thrown, instead of springing back first.
    const breedte = e.currentTarget.offsetWidth;
    if (!minderBeweging()) move(ver > 0 ? breedte : -breedte);
    if (ver > 0) onSwipe();
    // Throwing away removes the row at once; give the throw its moment first.
    else window.setTimeout(() => onRemove?.(), minderBeweging() ? 0 : WEG_MS);
  };

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const strength = 0.4 + 0.6 * Math.min(Math.abs(offset) / THRESHOLD, 1);
  const reached = Math.abs(offset) >= THRESHOLD;

  return (
    // data-veeg: a sideways swipe on a row is for the row, not for switching tabs.
    <div data-veeg="item" className={`relative overflow-hidden ${className}`}>
      {offset > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center gap-2 bg-primary pl-4 text-sm font-semibold text-primary-foreground"
          style={{ opacity: strength }}
        >
          <Check className={`h-5 w-5 transition-transform duration-150 ${reached ? 'scale-110' : ''}`} /> {t("Afvinken")}
        </div>
      )}
      {offset < 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-end gap-2 bg-destructive pr-4 text-sm font-semibold text-destructive-foreground"
          style={{ opacity: strength }}
        >
          {t("Weggooien")} <Trash2 className={`h-5 w-5 transition-transform duration-150 ${reached ? 'scale-110' : ''}`} />
        </div>
      )}
      <div
        className={`relative touch-pan-y ${dragging ? '' : 'transition-transform duration-200 ease-smooth'}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToCheck;
