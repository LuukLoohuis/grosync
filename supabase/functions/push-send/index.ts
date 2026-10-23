import * as webpush from 'jsr:@negrel/webpush@0.5';
import { bericht, isSoort, schoneNamen, stilNu, type Soort } from './tekst.ts';

// Stuurt een pushmelding naar de andere leden van je Cart Club. De app roept
// dit aan na iets wat de anderen willen weten (iets toegevoegd, in de winkel,
// klaar, voorraad op, nieuw lid). Wie, wat en of het mag, beslist de server:
// de app geeft alleen de soort en de namen van de producten mee.
//
// Geheimen: VAPID_KEYS (JSON van webpush.exportVapidKeys).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

// Hooguit één melding per soort per ontvanger in deze tijd; daarna wint de stilte.
const RUSTTIJD_MS = 10 * 60 * 1000;

const STANDAARD = { toegevoegd: true, winkel: true, klaar: true, voorraad: true, club: true, stille_uren: true, tijdzone: 'Europe/Amsterdam' };
type Instellingen = typeof STANDAARD & { user_id: string };

let appServer: Promise<webpush.ApplicationServer> | null = null;

const server = () => {
  appServer ??= (async () => {
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(env('VAPID_KEYS')), { extractable: false });
    return webpush.ApplicationServer.new({ contactInformation: 'mailto:info.couplecart@gmail.com', vapidKeys });
  })();
  return appServer;
};

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// De database als service role: instellingen, toestellen en het logboek van anderen.
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const lees = async <T>(path: string): Promise<T[]> => {
  const response = await rest(path);
  if (!response.ok) throw new Error(`${path.split('?')[0]}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
};

type Lid = { user_id: string; naam: string | null; jij: boolean };

/** De club zoals de afzender hem ziet, met diens eigen sessie: zo kan niemand een andere club bestoken. */
async function clubVan(token: string): Promise<Lid[] | null> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/cart_club_leden`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) return null;
  return response.json();
}

type Abonnement = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function verstuur(soort: Soort, ontvangers: string[], payload: string) {
  if (ontvangers.length === 0) return 0;
  const lijst = `in.(${ontvangers.join(',')})`;
  const sinds = new Date(Date.now() - RUSTTIJD_MS).toISOString();
  const [instellingen, recent, abonnementen] = await Promise.all([
    lees<Instellingen>(`push_settings?user_id=${lijst}`),
    lees<{ recipient: string }>(`push_log?select=recipient&soort=eq.${soort}&created_at=gte.${encodeURIComponent(sinds)}&recipient=${lijst}`),
    lees<Abonnement>(`push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=${lijst}`),
  ]);

  const nu = new Date();
  const kortGeleden = new Set(recent.map((r) => r.recipient));
  const wie = ontvangers.filter((id) => {
    const s = instellingen.find((i) => i.user_id === id) ?? { ...STANDAARD, user_id: id };
    if (!s[soort]) return false;
    if (s.stille_uren && stilNu(nu, s.tijdzone)) return false;
    return !kortGeleden.has(id);
  });

  const app = await server();
  const weg: string[] = [];
  const gelukt: string[] = [];
  const bereikt = new Set<string>();
  await Promise.all(abonnementen.filter((a) => wie.includes(a.user_id)).map(async (a) => {
    try {
      await app.subscribe({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } })
        .pushTextMessage(payload, { ttl: 60 * 60, urgency: webpush.Urgency.Normal, topic: soort });
      gelukt.push(a.id);
      bereikt.add(a.user_id);
    } catch (error) {
      // Uitgeschakeld of de app verwijderd: dit toestel komt niet meer terug.
      if (error instanceof webpush.PushMessageError && error.isGone()) weg.push(a.id);
      else console.error('Push mislukt:', a.endpoint.slice(0, 60), error);
    }
  }));

  await Promise.all([
    bereikt.size > 0 && rest('push_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([...bereikt].map((recipient) => ({ recipient, soort }))),
    }),
    weg.length > 0 && rest(`push_subscriptions?id=in.(${weg.join(',')})`, { method: 'DELETE' }),
    gelukt.length > 0 && rest(`push_subscriptions?id=in.(${gelukt.join(',')})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ last_used_at: nu.toISOString() }),
    }),
  ]);
  return bereikt.size;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Alleen POST' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    // De publieke sleutel die de browser nodig heeft om zich aan te melden.
    if (body?.actie === 'sleutel') {
      return json({ publicKey: base64url(await (await server()).getVapidPublicKeyRaw()) });
    }

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Niet ingelogd' }, 401);
    if (!isSoort(body?.soort)) return json({ error: 'Onbekende soort' }, 400);

    const leden = await clubVan(token);
    if (!leden) return json({ error: 'Niet ingelogd' }, 401);
    const afzender = leden.find((l) => l.jij);
    if (!afzender) return json({ error: 'Niet ingelogd' }, 401);
    const ontvangers = leden.filter((l) => !l.jij).map((l) => l.user_id);

    const namen = schoneNamen(body.namen);
    const aantal = Number.isFinite(body.aantal) ? Math.max(0, Math.min(999, Math.round(body.aantal))) : undefined;
    if ((body.soort === 'toegevoegd' || body.soort === 'voorraad') && namen.length === 0) {
      return json({ error: 'Namen ontbreken' }, 400);
    }

    const payload = JSON.stringify(bericht({ soort: body.soort, namen, aantal }, afzender.naam));
    const verstuurd = await verstuur(body.soort, ontvangers, payload);
    return json({ verstuurd });
  } catch (error) {
    console.error('push-send:', error);
    return json({ error: 'Er ging iets mis' }, 500);
  }
});
