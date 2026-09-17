const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// A full cupboard holds plenty; the checkboxes downstream are the filter, not this.
const MAX_ITEMS = 40;
// Roughly 5 MB of image after base64; the app sends about 200 kB.
const MAX_BASE64 = 7_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

/** The signed-in user, or null. The platform checked the token; this reads who it belongs to. */
async function signedInUser(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id } : null;
}


/** Instellingen uit de database; leeg betekent: val terug op de omgeving. */
async function aiSettings(): Promise<{ scanModel: string }> {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { scanModel: '' };
  try {
    const response = await fetch(`${url}/rest/v1/app_settings?key=eq.ai&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return { scanModel: '' };
    const rows = await response.json();
    return { scanModel: String(rows?.[0]?.value?.scan_model ?? '') };
  } catch (error) {
    console.error('Instellingen lezen mislukt:', error);
    return { scanModel: '' };
  }
}

type Quota = { allowed: boolean; used: number; quota: number; plus: boolean };

/** Counts this use and says whether it was within the monthly allowance. */
async function consumeAi(userId: string, feature: string, limit: number): Promise<Quota> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/consume_ai`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ _user: userId, _feature: feature, _limit: limit }),
  });
  if (!response.ok) {
    console.error('consume_ai failed:', response.status, (await response.text()).slice(0, 200));
    // A broken meter must not lock people out of what they paid for.
    return { allowed: true, used: 0, quota: limit, plus: false };
  }
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { allowed: row?.allowed !== false, used: row?.used ?? 0, quota: row?.quota ?? limit, plus: row?.plus === true };
}

/** Free gets five a month of the two that cost real money; Plus gets everything. */
const FREE_LIMIT = 5;

const PROMPT = `Je kijkt naar een foto van een voorraadkast, koelkast of aanrecht in een Nederlands huishouden.
Noem alles wat eetbaar is en wat je op de foto kunt aanwijzen. Kijk de hele foto af: elke plank van
boven naar beneden, ook de randen, de achterste rij en wat half achter iets anders staat.

Regels:
- Nederlandse, algemene productnamen in enkelvoud en kleine letters: "pindakaas", "passata", "volkoren brood".
- Geen merknamen, tenzij het product zonder merk niet te benoemen is (nutella, cup-a-soup).
- Kun je het etiket niet lezen, benoem dan wat het duidelijk is: "blik tomaten", "pak melk", "pot jam".
- Geen hoeveelheden, gewichten of verpakkingsmaten. Niet "pak rijst", wel "rijst".
- Hetzelfde product maar één keer, ook als er meerdere pakken van staan.
- Sla schoonmaakmiddelen, keukengerei, servies en versiering over.
- Twijfel je? Noem het tóch, met een lage zekerheid. De gebruiker vinkt zelf af wat klopt,
  dus iets missen is vervelender dan iets voorstellen.
- Hoogstens ${MAX_ITEMS} producten.

Antwoord als JSON: {"items":[{"naam":"pindakaas","zeker":0.9}]}
"zeker" is tussen 0 en 1: 0.9 als je het etiket leest, 0.5 als je het aan de vorm ziet, 0.3 als je gokt.`;

type Item = { naam?: unknown; zeker?: unknown };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const user = await signedInUser(req);
    if (!user) return json({ error: 'Sign in required' }, 401);

    const { scanModel: gekozen } = await aiSettings();
    const scanModel = gekozen || env('SCAN_MODEL') || 'gpt-4o';

    const quota = await consumeAi(user.id, 'kastfoto', FREE_LIMIT);
    if (!quota.allowed) {
      return json({ error: 'limiet', feature: 'kastfoto', used: quota.used, quota: quota.quota }, 402);
    }

    const key = env('OPENAI_API_KEY');
    if (!key) return json({ error: 'Scannen staat niet aan' }, 503);

    const body = await req.json().catch(() => ({}));
    const image: string = typeof body?.image === 'string' ? body.image : '';
    const lang = body?.lang === 'en' ? 'en' : 'nl';
    const prompt = PROMPT + (lang === 'en' ? '\n\nBelangrijk: schrijf elke productnaam in het Engels, bijvoorbeeld "peanut butter", "passata", "wholemeal bread".' : '');
    if (!image.startsWith('data:image/')) return json({ error: 'Geen foto ontvangen' }, 400);
    if (image.length > MAX_BASE64) return json({ error: 'De foto is te groot' }, 413);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // A cupboard photo is a cluttered scene; the small model skips things the big one reads.
        model: scanModel,
        response_format: { type: 'json_object' },
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            // "high" makes the model tile the image instead of reading one small thumbnail.
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error('Vision call failed:', response.status, (await response.text()).slice(0, 200));
      return json({ error: 'De foto lezen lukte niet' }, 502);
    }

    const data = await response.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const seen = new Set<string>();
    const items = (Array.isArray(parsed?.items) ? parsed.items : [])
      .map((item: Item) => ({
        name: String(item?.naam ?? '').trim().toLowerCase(),
        sure: typeof item?.zeker === 'number' ? item.zeker : 0.5,
      }))
      .filter((item: { name: string; sure: number }) => {
        if (item.name.length < 2 || item.name.length > 40 || seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
      })
      .slice(0, MAX_ITEMS);

    return json({ items });
  } catch (error) {
    console.error('pantry-scan failed:', error);
    return json({ error: 'Scannen lukte niet' }, 500);
  }
});
