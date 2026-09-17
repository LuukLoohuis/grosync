import { useRef, type TouchEvent } from 'react';

/** Zo ver moet je trekken voordat het vel dichtgaat. */
const DREMPEL = 110;

/**
 * Een bodemvel naar beneden vegen om het te sluiten. Trekken mag alleen als de
 * inhoud bovenaan staat, anders scroll je nog in het vel zelf.
 */
export const useSheetSwipeClose = (onClose: () => void) => {
  const vel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sleep = useRef<{ y: number; x: number; actief: boolean } | null>(null);

  const zet = (px: number, animeer: boolean) => {
    const el = vel.current;
    if (!el) return;
    const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = animeer && !rustig ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = px ? `translateY(${px}px)` : '';
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const vinger = e.touches[0];
    // Sta je middenin de tekst, dan scroll je eerst terug naar boven.
    const bovenaan = (scroller.current?.scrollTop ?? 0) <= 0;
    sleep.current = bovenaan ? { y: vinger.clientY, x: vinger.clientX, actief: false } : null;
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const start = sleep.current;
    if (!start) return;
    const vinger = e.touches[0];
    const dy = vinger.clientY - start.y;
    const dx = vinger.clientX - start.x;
    if (!start.actief) {
      if (dy < 10 || Math.abs(dx) > Math.abs(dy)) return;
      start.actief = true;
    }
    zet(Math.max(0, dy), false);
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = sleep.current;
    sleep.current = null;
    if (!start?.actief) return;
    const dy = e.changedTouches[0].clientY - start.y;
    if (dy >= DREMPEL) {
      const el = vel.current;
      const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const hoogte = el?.getBoundingClientRect().height ?? window.innerHeight;
      // Het vel schuift verder waar je vinger ophield. Radix zou er zijn eigen
      // uitschuif-animatie overheen leggen, die bij nul begint — dat is precies
      // het sprongetje omhoog. Die zetten we hier uit; wij zijn al onderweg.
      if (el) el.style.animation = 'none';
      zet(hoogte - dy > 0 ? hoogte : dy, !rustig);
      window.setTimeout(onClose, rustig ? 0 : 200);
    } else {
      zet(0, true);
    }
  };

  return {
    /** Op het vel zelf. */
    velProps: { ref: vel, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: () => { sleep.current = null; zet(0, true); } },
    /** Op het deel dat scrollt. */
    scrollRef: scroller,
  };
};
