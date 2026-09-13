const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// A photo of one shelf holds a handful of things; more than this is a mis-read.
const MAX_ITEMS = 25;
// Roughly 5 MB of image after base64; the app sends about 200 kB.
const MAX_BASE64 = 7_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) ?? '';

async function isSignedIn(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

const PROMPT = `Je kijkt naar een foto van een voorraadkast, koelkast of aanrecht in een Nederlands huishouden.
Noem wat je met zekerheid ziet staan, als boodschappen.

Regels:
- Nederlandse, algemene productnamen in enkelvoud en kleine letters: "pindakaas", "passata", "volkoren brood".
- Geen merknamen, tenzij het product zonder merk niet te benoemen is (nutella, cup-a-soup).
- Geen hoeveelheden, gewichten of verpakkingen. Niet "pak rijst", wel "rijst".
- Sla over wat je niet duidelijk kunt lezen of herkennen; liever vijf zekere dan vijftien gokken.
- Sla schoonmaakmiddelen, keukengerei, servies en versiering over.
- Hetzelfde product maar één keer, ook als er meerdere pakken staan.
- Hoogstens ${MAX_ITEMS} producten.

Antwoord als JSON: {"items":[{"naam":"pindakaas","zeker":0.9}]}
"zeker" is tussen 0 en 1: hoe zeker je bent dat dit product er echt staat.`;

type Item = { naam?: unknown; zeker?: unknown };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!(await isSignedIn(req))) return json({ error: 'Sign in required' }, 401);

    const key = env('OPENAI_API_KEY');
    if (!key) return json({ error: 'Scannen staat niet aan' }, 503);

    const body = await req.json().catch(() => ({}));
    const image: string = typeof body?.image === 'string' ? body.image : '';
    if (!image.startsWith('data:image/')) return json({ error: 'Geen foto ontvangen' }, 400);
    if (image.length > MAX_BASE64) return json({ error: 'De foto is te groot' }, 413);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: image } },
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
