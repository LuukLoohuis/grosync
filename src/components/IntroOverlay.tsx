import { useEffect, useState } from 'react';
import './IntroOverlay.css';

const GEZIEN = 'couplecart-intro-gezien';
// Hoe lang de intro staat voordat hij oplost; met minder beweging korter.
const INTRO_MS = 2050;
const INTRO_KORT_MS = 900;

/**
 * Eén keer per sessie: sessionStorage hoort bij de tab (en bij elke start van de app op het
 * beginscherm), dus niet opnieuw bij wisselen van pagina of een herlaadbeurt. Lezen hier, het
 * merkteken zetten pas in het effect: StrictMode roept deze functie twee keer aan.
 */
const nogNietGezien = () => {
  try {
    return !sessionStorage.getItem(GEZIEN);
  } catch {
    return true; // Geen opslag: dan gewoon spelen.
  }
};

const markeerGezien = () => {
  try {
    sessionStorage.setItem(GEZIEN, '1');
  } catch {
    // Geen opslag: niets te onthouden.
  }
};

const WOORD = [...'CoupleCart'];

/**
 * Het merkmoment na het inloggen: het embleem draait rond in beeld, de hartjes vonken, het
 * woordmerk komt letter voor letter op en het geheel lost op in de lijst, die eronder al laadt.
 * Tikken slaat hem over. De stappen en tijden staan in IntroOverlay.css.
 */
const IntroOverlay = () => {
  const [tonen] = useState(nogNietGezien);
  const [weg, setWeg] = useState(false);
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    if (!tonen) return;
    markeerGezien();
    const kort = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setWeg(true), kort ? INTRO_KORT_MS : INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [tonen]);

  if (!tonen || klaar) return null;
  return (
    <div
      aria-hidden="true"
      className={weg ? 'intro intro-leave' : 'intro'}
      onClick={() => setWeg(true)}
      onAnimationEnd={(e) => { if (weg && e.target === e.currentTarget) setKlaar(true); }}
    >
      <div className="intro-stack">
        <div className="intro-emblem">
          <img src="/favicon.png" alt="" width={190} height={190} />
          <div className="intro-sparks"><span /><span /><span /></div>
        </div>
        <div className="intro-word">
          {WOORD.map((letter, i) => (
            <span key={i} className={i < 6 ? 'intro-couple' : 'intro-cart'} style={{ '--intro-i': i } as React.CSSProperties}>
              {letter}
            </span>
          ))}
        </div>
        <div className="intro-tag">Two People. One Cart.</div>
      </div>
    </div>
  );
};

export default IntroOverlay;
