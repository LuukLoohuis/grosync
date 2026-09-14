const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

// Tekstmodel: standaard OpenAI, maar zet DEEPSEEK_API_KEY en alles wat tekst is
// loopt via DeepSeek (dezelfde API-vorm, een stuk goedkoper). Beelden en video
// kan DeepSeek niet lezen; die blijven bij OpenAI of Gemini.
const textApi = () => {
  const deepseek = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  if (deepseek) {
    return {
      key: deepseek,
      endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.deepseek.com/v1') + '/chat/completions',
      model: Deno.env.get('TEXT_MODEL') || 'deepseek-chat',
    };
  }
  return {
    key: Deno.env.get('OPENAI_API_KEY') ?? '',
    endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.openai.com/v1') + '/chat/completions',
    model: Deno.env.get('TEXT_MODEL') || 'gpt-4o-mini',
  };
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Supabase stops a request after 150s; keep a margin for building the response.
const REQUEST_BUDGET_MS = 140_000;

type Macros = { calories: number; protein: number; carbs: number; fat: number; fiber: number };

type RecipeData = {
  name: string;
  description: string;
  ingredients: unknown[];
  instructions: string;
  servings: number | null;
  macros: Macros | null;
};

type ExtractedFrom = 'page' | 'description' | 'linked-page' | 'video' | 'none';

type Extraction = { recipe: RecipeData; imageUrl: string | null; extractedFrom: ExtractedFrom };

const emptyRecipe = (): RecipeData => ({
  name: '', description: '', ingredients: [], instructions: '', servings: null, macros: null,
});

const hasRecipe = (recipe: RecipeData) => recipe.ingredients.length >= 2;

const NON_INGREDIENT_WORDS = new Set([
  'tbsp', 'tbsps', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 'cups', 'gram', 'grams',
  'ounce', 'ounces', 'pound', 'pounds', 'large', 'small', 'medium', 'fresh', 'freshly', 'chopped',
  'diced', 'minced', 'sliced', 'finely', 'roughly', 'ground', 'whole', 'high', 'quality', 'taste',
  'pinch', 'handful', 'optional', 'about', 'plus', 'more', 'needed', 'each',
  'eetlepel', 'eetlepels', 'theelepel', 'theelepels', 'snufje', 'naar', 'smaak',
]);

function ingredientWords(ingredient: string): string[] {
  return (ingredient.toLowerCase().match(/\p{L}+/gu) || [])
    .filter((word) => word.length >= 4 && !NON_INGREDIENT_WORDS.has(word));
}

// Given only a title like "3 ingredients for pasta", a language model happily
// writes a plausible recipe. Keep a text extraction only when most ingredients
// actually occur in the text it came from.
function isGroundedIn(recipe: RecipeData, source: string): boolean {
  const names = recipe.ingredients.filter((ingredient): ingredient is string => typeof ingredient === 'string');
  if (names.length === 0) return true;
  const text = source.toLowerCase();
  const found = names.filter((name) => ingredientWords(name)
    .some((word) => text.includes(word) || text.includes(word.replace(/(es|s)$/, ''))));
  return found.length / names.length >= 0.5;
}

const RECIPE_RULES = 'Return valid JSON only, no markdown code blocks. Schema: {"name":"string","description":"string","ingredients":["string"],"instructions":"string","servings":number,"macros":{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}}. For "servings", extract the number of servings/portions the recipe is intended for. If the page mentions "voor X personen" or "serves X" or similar, use that number. If not explicitly stated, estimate based on ingredient quantities. Default to 4 if truly unknown. For ingredients include quantities. IMPORTANT: You MUST convert EVERY occurrence of "cup" or "cups" to grams (for solids) or milliliters (for liquids). This applies to ALL ingredients without exception — flour, sugar, olives, cheese, vegetables, nuts, everything. Examples: "1 cup flour" → "125g flour", "1 cup milk" → "240ml milk", "½ cup olives" → "75g olives", "1 cup spinach" → "30g spinach". Keep tablespoons, teaspoons, ounces, and all other units unchanged. Keep ingredient names in their original language. For instructions write clear numbered steps. For macros, estimate the total nutritional values for the ENTIRE recipe (all servings combined) based on the ingredients. Provide calories in kcal, protein/carbs/fat/fiber in grams as whole numbers. If no recipe found, return empty arrays/strings and null for macros.';

function parseJsonLoose(content: string): unknown {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

function toRecipeData(parsed: any): RecipeData {
  return {
    name: parsed?.name || '',
    description: parsed?.description || '',
    ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients : [],
    instructions: parsed?.instructions || '',
    servings: typeof parsed?.servings === 'number' ? parsed.servings : null,
    macros: parsed?.macros && typeof parsed.macros.calories === 'number' ? parsed.macros : null,
  };
}

async function extractRecipeFromText(text: string): Promise<RecipeData> {
  const ai = textApi();
  if (!ai.key || !text.trim()) return emptyRecipe();

  try {
    const response = await fetch(ai.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ai.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: `You extract recipe data from web page text. Only list ingredients that are written in the text itself; never reconstruct a recipe from a title, hashtags or general knowledge. ${RECIPE_RULES}` },
          { role: 'user', content: `Extract the recipe from this page content:\n\n${text.substring(0, 20000)}` },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      console.error('OpenAI error:', response.status, await response.text());
      return emptyRecipe();
    }
    const data = await response.json();
    const recipe = toRecipeData(parseJsonLoose(data.choices?.[0]?.message?.content || ''));
    if (hasRecipe(recipe) && !isGroundedIn(recipe, text)) {
      console.log('Discarding ingredients that are not in the source text:', recipe.ingredients);
      return { ...emptyRecipe(), name: recipe.name };
    }
    console.log('Text extraction:', recipe.name, recipe.ingredients.length, 'ingredients');
    return recipe;
  } catch (e) {
    console.error('Text extraction failed:', e);
    return emptyRecipe();
  }
}

// Gemini can watch a public YouTube video, so it also finds recipes that are only
// spoken or shown on screen.
async function extractRecipeFromVideo(video: { fileUri: string; mimeType?: string }, timeoutMs: number): Promise<RecipeData> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set, skipping video analysis');
    return emptyRecipe();
  }
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `You extract recipe data from a cooking video. Use what is said, what is shown on screen and any text overlays. ${RECIPE_RULES} Only state a quantity as exact when it is said, shown on screen or written in a text overlay. When you estimate a quantity yourself, start that ingredient with "ca. ", for example "ca. 300g bread flour". Never put "ca." before a quantity that was said or shown.` },
            { file_data: { file_uri: video.fileUri, ...(video.mimeType ? { mime_type: video.mimeType } : {}) } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('Gemini error:', response.status, await response.text());
      return emptyRecipe();
    }
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((part: any) => part.text || '').join('');
    const recipe = toRecipeData(parseJsonLoose(text));
    console.log('Video extraction:', recipe.name, recipe.ingredients.length, 'ingredients');
    return recipe;
  } catch (e) {
    console.error('Video extraction failed:', e);
    return emptyRecipe();
  } finally {
    clearTimeout(timer);
  }
}

const GEMINI_API = 'https://generativelanguage.googleapis.com';
// Instagram videos are short; this keeps the function's memory use well within limits.
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

// Gemini cannot open an Instagram link itself, so the video goes through its Files API:
// download it, upload it, wait until Gemini has processed it, then read the recipe from it.
async function extractRecipeFromVideoFile(videoUrl: string, timeoutMs: number): Promise<RecipeData> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return emptyRecipe();
  const deadline = Date.now() + timeoutMs;
  let fileName: string | null = null;
  try {
    const download = await fetch(videoUrl, { headers: { 'User-Agent': IPHONE_SAFARI } });
    if (!download.ok) {
      console.error('Video download failed:', download.status);
      return emptyRecipe();
    }
    const bytes = new Uint8Array(await download.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_VIDEO_BYTES) {
      console.log('Video skipped, size:', bytes.length);
      return emptyRecipe();
    }
    const mimeType = download.headers.get('content-type')?.split(';')[0] || 'video/mp4';

    const start = await fetch(`${GEMINI_API}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'couplecart-instagram' } }),
    });
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!start.ok || !uploadUrl) {
      console.error('Gemini upload start failed:', start.status, await start.text());
      return emptyRecipe();
    }

    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: bytes,
    });
    if (!upload.ok) {
      console.error('Gemini upload failed:', upload.status, await upload.text());
      return emptyRecipe();
    }
    let file = (await upload.json()).file as { name: string; uri: string; state: string };
    fileName = file.name;

    while (file.state === 'PROCESSING' && Date.now() < deadline - 20_000) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await fetch(`${GEMINI_API}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': apiKey } });
      if (!status.ok) break;
      file = await status.json();
    }
    if (file.state !== 'ACTIVE') {
      console.error('Gemini file not ready:', file.state);
      return emptyRecipe();
    }
    console.log('Instagram video uploaded:', bytes.length, 'bytes');
    return await extractRecipeFromVideo({ fileUri: file.uri, mimeType }, Math.max(deadline - Date.now(), 10_000));
  } catch (e) {
    console.error('Video file extraction failed:', e);
    return emptyRecipe();
  } finally {
    // Uploaded files expire after two days anyway; removing them right away keeps nothing around.
    if (fileName) await fetch(`${GEMINI_API}/v1beta/${fileName}`, { method: 'DELETE', headers: { 'x-goog-api-key': apiKey } }).catch(() => {});
  }
}

function absoluteUrl(imageUrl: string | null, pageUrl: string): string | null {
  if (!imageUrl || imageUrl.startsWith('http')) return imageUrl;
  const origin = new URL(pageUrl).origin;
  return imageUrl.startsWith('/') ? `${origin}${imageUrl}` : `${origin}/${imageUrl}`;
}

function ogImage(html: string): string | null {
  const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  return match?.[1]?.replace(/&amp;/g, '&') || null;
}

// Firecrawl renders JavaScript-heavy pages; a plain fetch is the fallback.
async function scrapePage(url: string): Promise<{ content: string; imageUrl: string | null }> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (firecrawlKey) {
    try {
      console.log('Using Firecrawl to scrape:', url);
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown', 'html'], waitFor: 5000 }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.data?.markdown || data.data?.html || '';
        if (content) {
          const imageUrl = ogImage(data.data?.html || '') || data.data?.metadata?.ogImage || null;
          return { content, imageUrl: absoluteUrl(imageUrl, url) };
        }
      } else {
        console.error('Firecrawl error:', response.status, await response.text());
      }
    } catch (e) {
      console.error('Firecrawl failed:', e);
    }
  }

  try {
    console.log('Falling back to simple fetch:', url);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoupleCart/1.0)' } });
    const html = await response.text();
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    return { content, imageUrl: absoluteUrl(ogImage(html), url) };
  } catch (e) {
    console.error('Simple fetch failed:', e);
    return { content: '', imageUrl: null };
  }
}

// Social and shop links in a caption never lead to a recipe page.
const NON_RECIPE_HOSTS = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|fb\.me|twitter\.com|x\.com|threads\.net|pinterest\.[a-z.]+|patreon\.com|linktr\.ee|spotify\.com|apple\.com|discord\.gg|amazon\.[a-z.]+|amzn\.to)$/i;

function recipeLinksIn(text: string): string[] {
  const links: string[] = [];
  for (const candidate of text.match(/https?:\/\/[^\s)"'<>\]]+/g) || []) {
    try {
      const url = new URL(candidate.replace(/[.,!?]+$/, ''));
      if (!NON_RECIPE_HOSTS.test(url.hostname) && !links.includes(url.href)) links.push(url.href);
    } catch {
      // not a valid URL
    }
  }
  return links.slice(0, 2);
}

// Captions often hold the recipe itself, or a link to it on the creator's site.
async function recipeFromCaption(caption: string, imageUrl: string | null, deadline: number): Promise<Extraction> {
  const recipe = await extractRecipeFromText(caption);
  if (hasRecipe(recipe)) return { recipe, imageUrl, extractedFrom: 'description' };

  for (const link of recipeLinksIn(caption)) {
    if (deadline - Date.now() < 30_000) break;
    const page = await scrapePage(link);
    const linked = await extractRecipeFromText(page.content);
    if (hasRecipe(linked)) return { recipe: linked, imageUrl: imageUrl || page.imageUrl, extractedFrom: 'linked-page' };
  }
  return { recipe, imageUrl, extractedFrom: 'none' };
}

function youTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/')[1] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery) return fromQuery;
      return parsed.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/)?.[2] || null;
    }
  } catch {
    // not a valid URL
  }
  return null;
}

async function firecrawlRawHtml(url: string): Promise<string> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) return '';
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['rawHtml'] }),
    });
    if (response.ok) return (await response.json()).data?.rawHtml || '';
    console.error('Firecrawl error:', response.status, await response.text());
  } catch (e) {
    console.error('Firecrawl failed:', e);
  }
  return '';
}

function videoDetailsFrom(html: string): { title: string; description: string } | null {
  const player = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|<\/script>)/s);
  if (!player) return null;
  try {
    const details = JSON.parse(player[1])?.videoDetails;
    return details ? { title: details.title || '', description: details.shortDescription || '' } : null;
  } catch {
    return null;
  }
}

async function youTubeDetails(videoId: string): Promise<{ title: string; description: string }> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    // The consent cookies skip the EU cookie wall that would otherwise replace the page.
    const response = await fetch(`${watchUrl}&hl=en`, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'SOCS=CAI; CONSENT=YES+' },
    });
    const details = videoDetailsFrom(await response.text());
    if (details?.description) return details;
    console.log('No description in direct YouTube fetch');
  } catch (e) {
    console.error('YouTube page failed:', e);
  }

  // YouTube serves datacenter IPs a page without video data; Firecrawl gets through.
  const details = videoDetailsFrom(await firecrawlRawHtml(watchUrl));
  if (details?.description) return details;
  console.log('No description in Firecrawl YouTube page');

  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
    if (response.ok) return { title: (await response.json()).title || '', description: '' };
  } catch (e) {
    console.error('YouTube oEmbed failed:', e);
  }
  return { title: '', description: '' };
}

async function recipeFromYouTube(videoId: string, deadline: number): Promise<Extraction> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const { title, description } = await youTubeDetails(videoId);

  const fromCaption = await recipeFromCaption(`${title}\n\n${description}`, imageUrl, deadline);
  if (hasRecipe(fromCaption.recipe)) return fromCaption;

  const remaining = deadline - Date.now();
  if (remaining > 20_000) {
    const fromVideo = await extractRecipeFromVideo({ fileUri: watchUrl }, remaining);
    if (hasRecipe(fromVideo)) return { recipe: fromVideo, imageUrl, extractedFrom: 'video' };
  }

  const recipe = fromCaption.recipe;
  return { recipe: { ...recipe, name: recipe.name || title }, imageUrl, extractedFrom: 'none' };
}

async function recipeFromTikTok(url: string, deadline: number): Promise<Extraction> {
  let caption = '';
  let imageUrl: string | null = null;
  try {
    // Short links (vm.tiktok.com) need resolving before oEmbed accepts them.
    const resolved = (await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' })).url || url;
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolved)}`);
    if (response.ok) {
      const data = await response.json();
      caption = data.title || '';
      imageUrl = data.thumbnail_url || null;
    } else {
      console.error('TikTok oEmbed error:', response.status);
    }
  } catch (e) {
    console.error('TikTok oEmbed failed:', e);
  }
  return recipeFromCaption(caption, imageUrl, deadline);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function metaContent(html: string, property: string): string {
  const content = html.match(new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${property}"`, 'i'));
  return decodeEntities(content?.[1] || '');
}

// Instagram puts the caption in og:title as `Name on Instagram: "caption"` and in
// og:description as `12K likes, … on date: "caption".`
type InstagramPost = { caption: string; imageUrl: string | null; videoUrl: string | null; author: string };

function instagramPostFromHtml(html: string): InstagramPost | null {
  const captions = [metaContent(html, 'og:title'), metaContent(html, 'og:description')]
    .map((text) => text.match(/:\s*"([\s\S]*)"\.?\s*$/)?.[1]?.trim() || '')
    .sort((a, b) => b.length - a.length);
  if (!captions[0]) return null;
  return {
    caption: captions[0],
    imageUrl: metaContent(html, 'og:image') || null,
    videoUrl: metaContent(html, 'og:video') || null,
    author: metaContent(html, 'og:title').match(/^(.*?) on Instagram/)?.[1]?.trim() || '',
  };
}

// The page keeps its data as JSON inside a string, so the address arrives with escaped
// slashes. Instagram includes it for some videos and leaves it out for others.
function embeddedVideoUrl(html: string): string | null {
  const raw = html.match(/video_url\\*"\s*:\s*\\*"(https?:[^"]+)"/)?.[1];
  if (!raw) return null;
  return decodeEntities(raw.replace(/\\+$/, '').replace(/\\+\//g, '/').replace(/\\+u0026/g, '&'));
}

// The embed page that other sites use to show a post carries the caption as HTML.
function instagramPostFromEmbed(html: string): InstagramPost | null {
  const block = html.match(/class="Caption">([\s\S]*?)<div class="CaptionComments"/i)?.[1];
  const caption = block
    ? decodeEntities(
        block
          .replace(/<a[^>]*class="CaptionUsername"[\s\S]*?<\/a>/i, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ''),
      ).trim()
    : '';
  const videoUrl = embeddedVideoUrl(html);
  if (!caption && !videoUrl) return null;
  const image = html.match(/<img[^>]*class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i)?.[1];
  const author = decodeEntities(html.match(/class="CaptionUsername"[^>]*>([^<]+)<\/a>/i)?.[1] || '').trim();
  return { caption, imageUrl: image ? decodeEntities(image) : null, videoUrl, author };
}

type FetchAttempt = { url: string; agent: string; status: number; finalUrl: string; length: number; caption: boolean; title: string };

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FACEBOOK_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

async function instagramCaption(url: string): Promise<InstagramPost & { attempts: FetchAttempt[] }> {
  const id = url.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?)\/([\w-]+)/i)?.[1];
  const postUrl = id ? `https://www.instagram.com/p/${id}/` : url;
  const embedUrl = id ? `https://www.instagram.com/p/${id}/embed/captioned/` : null;

  // Instagram renders the caption into the embed page other sites use, and into meta
  // tags for link-preview crawlers. From Supabase the post page redirects to the login
  // page while the embed page still works, so the embed page goes first. If both fail
  // the app asks for the caption text (Firecrawl refuses Instagram altogether).
  const tries = [
    ...(embedUrl ? [{ url: embedUrl, agent: IPHONE_SAFARI, parse: instagramPostFromEmbed }] : []),
    { url: postUrl, agent: FACEBOOK_CRAWLER, parse: instagramPostFromHtml },
  ];

  const attempts: FetchAttempt[] = [];
  for (const attempt of tries) {
    try {
      const response = await fetch(attempt.url, { headers: { 'User-Agent': attempt.agent }, redirect: 'follow' });
      const html = await response.text();
      const post = attempt.parse(html);
      attempts.push({
        url: attempt.url,
        agent: attempt.agent.slice(0, 24),
        status: response.status,
        finalUrl: response.url,
        length: html.length,
        caption: Boolean(post),
        title: html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim().slice(0, 80) || '',
      });
      if (post) return { ...post, attempts };
    } catch (e) {
      console.error('Instagram fetch failed:', attempt.url, e);
    }
  }
  console.log('No Instagram caption:', JSON.stringify(attempts));
  return { caption: '', imageUrl: null, videoUrl: null, author: '', attempts };
}

// Words that say which dish it is, for comparing a search result with the post.
const dishWords = (text: string) =>
  new Set(
    text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length >= 4),
  );

function sameDish(wanted: string, found: string): boolean {
  const want = dishWords(wanted);
  if (want.size === 0) return false;
  const got = dishWords(found);
  const shared = [...want].filter((word) => got.has(word)).length;
  return shared >= Math.min(2, want.size) && shared / want.size >= 0.5;
}

// The first line of a caption usually names the dish: "💥 CRISPY BANG BANG CAULIFLOWER 💥".
function dishFromCaption(caption: string): string {
  const line = caption
    .split('\n')
    .map((text) => text.replace(/#[\p{L}\p{N}_]+|@[\w.]+/gu, ' ').replace(/[^\p{L}\p{N}\s'&-]/gu, ' ').replace(/\s+/g, ' ').trim())
    .find((text) => text.length >= 4);
  return (line || '').slice(0, 80);
}

// Last resort for a post without a recipe in its text or a readable video: search the web for
// the dish and its maker, and take the recipe from a page that is about the same dish.
async function recipeFromSearch(dish: string, maker: string, imageUrl: string | null, deadline: number): Promise<Extraction | null> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey || !dish || deadline - Date.now() < 25_000) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(45_000, deadline - Date.now() - 15_000));
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${dish} ${maker} recipe`.replace(/\s+/g, ' ').trim(),
        limit: 5,
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('Firecrawl search failed:', response.status, await response.text());
      return null;
    }
    const results: { url?: string; markdown?: string }[] = (await response.json()).data || [];
    for (const result of results) {
      if (!result.url || !result.markdown || deadline - Date.now() < 10_000) continue;
      let host = '';
      try {
        host = new URL(result.url).hostname;
      } catch {
        continue;
      }
      if (NON_RECIPE_HOSTS.test(host)) continue;
      const recipe = await extractRecipeFromText(result.markdown);
      if (hasRecipe(recipe) && sameDish(dish, recipe.name)) {
        console.log('Recipe found through search:', result.url);
        return { recipe, imageUrl, extractedFrom: 'page' };
      }
    }
    console.log('No matching recipe in search results for:', dish);
  } catch (e) {
    console.error('Recipe search failed:', e);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await signedInUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sign in required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const quota = await consumeAi(user.id, 'recept', FREE_LIMIT);
    if (!quota.allowed) {
      return new Response(JSON.stringify({ error: 'limiet', feature: 'recept', used: quota.used, quota: quota.quota }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url, text } = await req.json();
    if (!url && !text) {
      return new Response(JSON.stringify({ error: 'URL or text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deadline = Date.now() + REQUEST_BUDGET_MS;
    const videoId = url ? youTubeVideoId(url) : null;
    let result: Extraction;
    // Instagram only: whether the post text itself could be read.
    let captionFound: boolean | undefined;

    if (text) {
      // Pasted post text, for platforms that block server-side fetching.
      result = await recipeFromCaption(String(text).slice(0, 20000), null, deadline);
    } else if (videoId) {
      result = await recipeFromYouTube(videoId, deadline);
    } else if (/tiktok\.com\//i.test(url)) {
      result = await recipeFromTikTok(url, deadline);
    } else if (/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?)\//i.test(url)) {
      const post = await instagramCaption(url);
      captionFound = Boolean(post.caption || post.videoUrl);
      result = await recipeFromCaption(post.caption, post.imageUrl, deadline);
      // No recipe in the text: let Gemini watch the video, when Instagram gave its address.
      const remaining = deadline - Date.now();
      if (!hasRecipe(result.recipe) && post.videoUrl && remaining > 30_000) {
        const fromVideo = await extractRecipeFromVideoFile(post.videoUrl, remaining - 5_000);
        if (hasRecipe(fromVideo)) result = { recipe: fromVideo, imageUrl: post.imageUrl, extractedFrom: 'video' };
      }
      // Still nothing: look the dish up online, often on the maker's own site.
      if (!hasRecipe(result.recipe) && post.caption) {
        const dish = result.recipe.name || dishFromCaption(post.caption);
        const fromSearch = await recipeFromSearch(dish, post.author, post.imageUrl, deadline);
        if (fromSearch) result = fromSearch;
      }
    } else {
      const page = await scrapePage(url);
      const recipe = await extractRecipeFromText(page.content);
      result = { recipe, imageUrl: page.imageUrl, extractedFrom: hasRecipe(recipe) ? 'page' : 'none' };
    }

    console.log('Extracted from:', result.extractedFrom);
    const { recipe } = result;
    return new Response(JSON.stringify({
      imageUrl: result.imageUrl,
      title: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      macros: recipe.macros,
      servings: recipe.servings,
      extractedFrom: result.extractedFrom,
      ...(captionFound === undefined ? {} : { captionFound }),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch URL metadata' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
