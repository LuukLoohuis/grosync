import { describe, expect, it } from 'vitest';
import {
  herstelVoor, nieuwWachtwoordGekozen, volgHerstel, volgWachtwoordHerstel, type HerstelAuth,
} from '@/lib/wachtwoordHerstel';

type Melding = (event: string, session: { user: { id: string } } | null) => void;

const opslag = new Map<string, string>();
let opslagWeigert = false;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => { if (opslagWeigert) throw new Error('SecurityError'); return opslag.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (opslagWeigert) throw new Error('QuotaExceededError'); opslag.set(k, v); },
    removeItem: (k: string) => { if (opslagWeigert) throw new Error('SecurityError'); opslag.delete(k); },
  },
});

/** Een supabase.auth die alleen onthoudt wie er luistert; de test meldt zelf. */
const nepAuth = () => {
  let melding: Melding = () => {};
  const auth: HerstelAuth = { onAuthStateChange: (callback) => { melding = callback; } };
  return { auth, meld: (event: string, userId: string | null) => melding(event, userId ? { user: { id: userId } } : null) };
};

describe('wachtwoordHerstel', () => {
  it('onthoudt na PASSWORD_RECOVERY wie nog een nieuw wachtwoord moet kiezen', () => {
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth);
    expect(herstelVoor()).toBeNull();
    meld('PASSWORD_RECOVERY', 'u1');
    expect(herstelVoor()).toBe('u1');
    expect(opslag.get('couplecart-nieuw-wachtwoord')).toBe('u1');
  });

  it('blijft staan na herladen, en bij gewone meldingen van Supabase', () => {
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth); // de pagina laadt opnieuw
    expect(herstelVoor()).toBe('u1');
    for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) meld(event, 'u1');
    expect(herstelVoor()).toBe('u1');
  });

  it('vergeet het als het nieuwe wachtwoord is opgeslagen', () => {
    nieuwWachtwoordGekozen();
    expect(herstelVoor()).toBeNull();
    expect(opslag.has('couplecart-nieuw-wachtwoord')).toBe(false);
  });

  it('vergeet het bij uitloggen', () => {
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth);
    meld('PASSWORD_RECOVERY', 'u2');
    meld('SIGNED_OUT', null);
    expect(herstelVoor()).toBeNull();
    expect(opslag.has('couplecart-nieuw-wachtwoord')).toBe(false);
  });

  it('negeert PASSWORD_RECOVERY zonder sessie', () => {
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth);
    meld('PASSWORD_RECOVERY', null);
    expect(herstelVoor()).toBeNull();
  });

  it('meldt elke verandering aan wie volgt, tot die stopt', () => {
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth);
    let keer = 0;
    const stop = volgHerstel(() => { keer += 1; });
    meld('PASSWORD_RECOVERY', 'u3');
    nieuwWachtwoordGekozen();
    stop();
    meld('PASSWORD_RECOVERY', 'u3');
    expect(keer).toBe(2);
    nieuwWachtwoordGekozen();
  });

  it('werkt zonder opslag tot de pagina herlaadt', () => {
    opslagWeigert = true;
    const { auth, meld } = nepAuth();
    volgWachtwoordHerstel(auth);
    meld('PASSWORD_RECOVERY', 'u4');
    expect(herstelVoor()).toBe('u4');
    nieuwWachtwoordGekozen();
    expect(herstelVoor()).toBeNull();
    opslagWeigert = false;
  });
});
