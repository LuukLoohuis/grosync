import { useEffect, useState } from 'react';

// Scrolling less than this either way changes nothing: a thumb resting on the glass jitters.
const DREMPEL = 12;
// Near the top the bar always shows; near the end too, so the price bar under the list is reachable.
const RAND = 80;

/**
 * Lets the tab bar step aside while you scroll down through a list, and brings it
 * back as soon as you scroll up, reach the top or reach the end.
 *
 * It never hides on its own while you hold still: a bar that slides away under a
 * resting thumb turns the next tap into a tap on whatever was behind it.
 */
export const useScrollTabBar = () => {
  const [visible, setVisible] = useState(true);

  // Whatever sits above the bar (the AH price bar) leaves with it, see index.css.
  useEffect(() => {
    document.documentElement.classList.toggle('tabbar-hidden', !visible);
    return () => document.documentElement.classList.remove('tabbar-hidden');
  }, [visible]);

  useEffect(() => {
    let vorige = window.scrollY;
    let frame = 0;

    const kijk = () => {
      frame = 0;
      const y = window.scrollY;
      const eind = document.documentElement.scrollHeight - window.innerHeight;
      if (y < RAND || y > eind - RAND) {
        setVisible(true);
        vorige = y;
        return;
      }
      const dy = y - vorige;
      if (Math.abs(dy) < DREMPEL) return;
      setVisible(dy < 0);
      vorige = y;
    };

    const opScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(kijk);
    };
    // A field gets focus (the keyboard opens, a sheet closes): show the bar again.
    const toon = () => setVisible(true);

    window.addEventListener('scroll', opScroll, { passive: true });
    window.addEventListener('focusin', toon);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', opScroll);
      window.removeEventListener('focusin', toon);
    };
  }, []);

  return visible;
};
