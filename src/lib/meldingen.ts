import { supabase } from '@/integrations/supabase/client';
import { callFunction } from '@/services/functions';
import { currentInstallWay, isIos } from '@/lib/installHint';

// Pushmeldingen: aanmelden per toestel, instellingen per persoon, en de
// seintjes zelf. Wat er in een melding staat en of hij uitgaat, beslist de
// functie push-send; de app zegt alleen wat er gebeurde.

export type Soort = 'toegevoegd' | 'winkel' | 'klaar' | 'voorraad' | 'club';

/**
 * kan-niet: deze browser heeft geen pushmeldingen.
 * beginscherm: iPhone of iPad, maar nog niet vanaf het beginscherm geopend.
 * geweigerd: eerder nee gezegd; alleen de instellingen van de browser kunnen dat terugdraaien.
 */
export type MeldStatus = 'kan-niet' | 'beginscherm' | 'geweigerd' | 'uit' | 'aan';

export interface MeldInstellingen {
  toegevoegd: boolean;
  winkel: boolean;
  klaar: boolean;
  voorraad: boolean;
  club: boolean;
  stille_uren: boolean;
}

export const STANDAARD_INSTELLINGEN: MeldInstellingen = {
  toegevoegd: true, winkel: true, klaar: true, voorraad: true, club: true, stille_uren: true,
};

const ondersteund = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const registratie = async (): Promise<ServiceWorkerRegistration | null> => {
  const bestaand = await navigator.serviceWorker.getRegistration();
  if (bestaand) return bestaand;
  // In productie registreert main.tsx de service worker al; zonder (dev) pas nu.
  return navigator.serviceWorker.register('/sw.js');
};

export async function meldStatus(): Promise<MeldStatus> {
  // Op iOS kan een website alleen meldingen sturen als hij als app op het beginscherm staat.
  const way = currentInstallWay();
  if (isIos(way)) return 'beginscherm';
  if (!ondersteund()) return 'kan-niet';
  if (Notification.permission === 'denied') return 'geweigerd';
  if (Notification.permission !== 'granted') return 'uit';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'aan' : 'uit';
}

let sleutel: Promise<string> | null = null;
const publiekeSleutel = () => {
  sleutel ??= callFunction<{ publicKey: string }>('push-send', { actie: 'sleutel' })
    .then((r) => r.publicKey)
    .catch((error) => { sleutel = null; throw error; });
  return sleutel;
};

const bytes = (base64url: string) => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

/** Vraagt toestemming (alleen vanuit een tik) en meldt dit toestel aan. */
export async function zetMeldingenAan(): Promise<MeldStatus> {
  const huidig = await meldStatus();
  if (huidig === 'kan-niet' || huidig === 'beginscherm' || huidig === 'geweigerd') return huidig;
  const toestemming = await Notification.requestPermission();
  if (toestemming === 'denied') return 'geweigerd';
  if (toestemming !== 'granted') return 'uit';

  const reg = await registratie();
  if (!reg) return 'kan-niet';
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(await publiekeSleutel()) });
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Onvolledig pushabonnement');
  const { error } = await supabase.rpc('meld_toestel_aan', {
    _endpoint: endpoint, _p256dh: keys.p256dh, _auth: keys.auth, _user_agent: navigator.userAgent,
  });
  if (error) throw error;
  return 'aan';
}

/** Dit toestel krijgt geen meldingen meer; je andere toestellen wel. */
export async function zetMeldingenUit(): Promise<void> {
  if (!ondersteund()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function leesInstellingen(userId: string): Promise<MeldInstellingen> {
  const { data } = await supabase.from('push_settings').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return STANDAARD_INSTELLINGEN;
  const { toegevoegd, winkel, klaar, voorraad, club, stille_uren } = data;
  return { toegevoegd, winkel, klaar, voorraad, club, stille_uren };
}

export async function bewaarInstellingen(userId: string, instellingen: MeldInstellingen): Promise<boolean> {
  const tijdzone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
  const { error } = await supabase.from('push_settings').upsert({
    user_id: userId, ...instellingen, tijdzone, updated_at: new Date().toISOString(),
  });
  if (error) console.error('Meldinginstellingen bewaren mislukt:', error);
  return !error;
}

// Alleen seintjes sturen als er iemand is om ze te krijgen; AppContext houdt dit bij.
let anderenInClub = false;
export const zetAnderenInClub = (ja: boolean) => { anderenInClub = ja; };

/** Zegt push-send wat er gebeurde. Mislukt het, dan is dat geen reden om de app te storen. */
export function stuurMelding(soort: Soort, extra: { namen?: string[]; aantal?: number } = {}) {
  if (!anderenInClub || !navigator.onLine) return;
  void supabase.functions.invoke('push-send', { body: { soort, ...extra } })
    .then(({ error }) => { if (error) console.warn('Melding niet verstuurd:', error.message); })
    .catch(() => { /* geen verbinding: dan maar geen seintje */ });
}

/**
 * Net ingestapt in een Cart Club: de anderen horen het. Los van de vlag
 * hierboven, want die weet nog niet dat je nu in een club zit. Wacht hooguit
 * even, zodat een herlaad direct erna het verzoek niet afbreekt.
 */
export async function meldNieuwLid(): Promise<void> {
  const verzoek = supabase.functions.invoke('push-send', { body: { soort: 'club' } }).catch(() => null);
  await Promise.race([verzoek, new Promise((klaar) => setTimeout(klaar, 1500))]);
}

// Wie vijf dingen achter elkaar typt, stuurt één melding: alles binnen deze tijd samen.
const BUNDEL_MS = 20_000;
let gebundeld: string[] = [];
let bundelTimer: ReturnType<typeof setTimeout> | null = null;

const verstuurBundel = () => {
  if (bundelTimer) clearTimeout(bundelTimer);
  bundelTimer = null;
  if (gebundeld.length === 0) return;
  const namen = gebundeld;
  gebundeld = [];
  stuurMelding('toegevoegd', { namen });
};

/** Iets op de lijst gezet; de melding gaat even later, samen met wat er nog bij komt. */
export function meldToegevoegd(namen: string[]) {
  if (!anderenInClub || namen.length === 0) return;
  gebundeld.push(...namen);
  bundelTimer ??= setTimeout(verstuurBundel, BUNDEL_MS);
}

if (typeof document !== 'undefined') {
  // De app gaat dicht of naar de achtergrond: wat klaarstaat nu versturen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') verstuurBundel();
  });
}
