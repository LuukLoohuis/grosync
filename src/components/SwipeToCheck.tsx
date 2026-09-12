import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';

// How far a row must travel before letting go checks it off.
const THRESHOLD = 96;
// Movement that still counts as a tap or a scroll.
const SLOP = 10;

interface SwipeToCheckProps {
  onSwipe: () => void;
  children: ReactNode;
}

/** Swipe a row to the right to check it off. Touch and pen only; the check button stays the main control. */
const SwipeToCheck = ({ onSwipe, children }: SwipeToCheckProps) => {
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
      if (dx < SLOP || dx < Math.abs(dy)) return;
      g.dragging = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the row still follows the moves it gets.
      }
    }
    move(Math.max(0, dx - SLOP));
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.dragging) return;
    // The browser may still fire a click on the button under the finger.
    swallowClick.current = true;
    setDragging(false);
    if (e.type === 'pointerup' && offsetRef.current >= THRESHOLD) onSwipe();
    move(0);
  };

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center gap-2 bg-primary pl-4 text-sm font-semibold text-primary-foreground"
        style={{ opacity: offset > 0 ? 0.4 + 0.6 * Math.min(offset / THRESHOLD, 1) : 0 }}
      >
        <Check className="h-5 w-5" /> Afvinken
      </div>
      <div
        className={`relative touch-pan-y ${dragging ? '' : 'transition-transform duration-200'}`}
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
