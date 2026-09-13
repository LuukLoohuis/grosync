import { useEffect, useState } from 'react';

const IDLE_MS = 2500;

/**
 * Lets the tab bar step aside while you read. Any scroll, tap or key press brings
 * it straight back; on a page that cannot scroll it stays put, so there is always
 * a way back to it.
 */
export const useIdleTabBar = () => {
  const [visible, setVisible] = useState(true);

  // Whatever sits above the bar (the AH price bar) travels with it, see index.css.
  useEffect(() => {
    document.documentElement.classList.toggle('tabbar-hidden', !visible);
    return () => document.documentElement.classList.remove('tabbar-hidden');
  }, [visible]);

  useEffect(() => {
    let timer: number | undefined;
    const canScroll = () => document.documentElement.scrollHeight > window.innerHeight + 8;

    const show = () => {
      setVisible(true);
      window.clearTimeout(timer);
      // A page that cannot scroll keeps its bar; it is checked again each round,
      // because a list can grow long after the screen first appeared.
      timer = window.setTimeout(() => (canScroll() ? setVisible(false) : show()), IDLE_MS);
    };

    show();
    // Capture, because a scroll inside a dialog or a sheet never reaches the window.
    window.addEventListener('scroll', show, { passive: true, capture: true });
    const others = ['touchstart', 'pointerdown', 'keydown', 'focusin'] as const;
    for (const name of others) window.addEventListener(name, show, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', show, { capture: true } as EventListenerOptions);
      for (const name of others) window.removeEventListener(name, show);
    };
  }, []);

  return visible;
};
