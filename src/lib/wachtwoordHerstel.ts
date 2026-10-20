/**
 * Een nieuw wachtwoord kiezen na de link uit "Wachtwoord vergeten?". Die link logt je in
 * (#access_token=…&type=recovery): Supabase leest hem, haalt hem uit de adresbalk en meldt
 * één keer PASSWORD_RECOVERY. Wie die melding mist, is ingelogd zonder nieuw wachtwoord en
 * zit de volgende keer weer vast. Daarom luistert dit al vóór de eerste render (main.tsx) en
 * onthoudt het voor wie nog een wachtwoord gekozen moet worden, ook na herladen of als iOS de
 * tab weggooit. Zolang dat zo is, toont ProtectedRoute het scherm NieuwWachtwoord.
 */

const SLEUTEL = 'couplecart-nieuw-wachtwoord';

/** Het deel van supabase.auth dat dit gebruikt, zodat een test het kan nabootsen. */
export interface HerstelAuth {
  onAuthStateChange(callback: (event: string, session: { user: { id: string } } | null) => void): unknown;
}

const lees = (): string | null => {
  try {
    return localStorage.getItem(SLEUTEL);
  } catch {
    return null;
  }
};

let wachtVoor: string | null = null;
const luisteraars = new Set<() => void>();
const meld = () => luisteraars.forEach((luisteraar) => luisteraar());

const onthoud = (userId: string | null) => {
  wachtVoor = userId;
  try {
    if (userId) localStorage.setItem(SLEUTEL, userId);
    else localStorage.removeItem(SLEUTEL);
  } catch {
    // Zonder opslag (privévenster) geldt het tot de pagina herlaadt.
  }
  meld();
};

/** Eén keer bij het laden, vóór de eerste render. */
export const volgWachtwoordHerstel = (auth: HerstelAuth) => {
  wachtVoor = lees();
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) onthoud(session.user.id);
    else if (event === 'SIGNED_OUT') onthoud(null);
  });
  // Opgeslagen of uitgelogd in een ander tabblad.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== SLEUTEL && e.key !== null) return;
      wachtVoor = lees();
      meld();
    });
  }
};

/** Het nieuwe wachtwoord is opgeslagen: de app mag weer open. */
export const nieuwWachtwoordGekozen = () => onthoud(null);

/** Voor useSyncExternalStore: wie nog een nieuw wachtwoord moet kiezen, of null. */
export const herstelVoor = () => wachtVoor;

export const volgHerstel = (luisteraar: () => void) => {
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
  };
};
