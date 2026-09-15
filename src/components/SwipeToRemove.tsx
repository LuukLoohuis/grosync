import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

// How far a chip must travel to the left before letting go throws it away.
const THRESHOLD = 72;
// Movement that still counts as a tap or a scroll.
const SLOP = 10;

interface SwipeToRemoveProps {
  onRemove: () => void;
  label: string;
  children: ReactNode;
}

/**
 * Swipe a chip to the left to throw it away. Touch and pen only, so a mouse
 * keeps tapping; the delete button inside the sheet stays the main control.
 */
const SwipeToRemove = ({ onRemove, label, children }: SwipeToRemoveProps) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const offsetRef = useRef(0);
  const swallowClick = useRef(false);

  const move = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    swallowClick.current = false;
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.dragging) {
      // Scrolling the page wins over swiping a chip.
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (dx > -SLOP || Math.abs(dx) < Math.abs(dy)) return;
      g.dragging = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the chip still follows the moves it gets.
      }
    }
    move(Math.min(0, dx + SLOP));
  };

  const onPointerEnd = (e: PointerEvent<HTMLSpanElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.dragging) return;
    // The browser may still fire a click on the chip under the finger.
    swallowClick.current = true;
    setDragging(false);
    if (e.type === 'pointerup' && offsetRef.current <= -THRESHOLD) onRemove();
    move(0);
  };

  const onClickCapture = (e: MouseEvent<HTMLSpanElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const reached = offset <= -THRESHOLD;

  return (
    <span className="relative inline-flex overflow-hidden rounded-full">
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end rounded-full bg-destructive pr-3.5 text-destructive-foreground"
        style={{ opacity: offset < 0 ? 0.35 + 0.65 * Math.min(-offset / THRESHOLD, 1) : 0 }}
      >
        <Trash2 className={`h-4 w-4 transition-transform duration-150 ${reached ? 'scale-110' : ''}`} />
      </span>
      <span
        className={`relative inline-flex touch-pan-y ${dragging ? '' : 'transition-transform duration-200 ease-smooth'}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        aria-label={`${label}, veeg naar links om weg te gooien`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </span>
    </span>
  );
};

export default SwipeToRemove;
