const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey || !text.trim()) return emptyRecipe();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
async function extractRecipeFromVideo(videoUrl: string, timeoutMs: number): Promise<RecipeData> {
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
            { text: `You extract recipe data from a cooking video. Use what is said, what is shown on screen and any text overlays. ${RECIPE_RULES}` },
            { file_data: { file_uri: videoUrl } },
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
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (firecrawlKey) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: watchUrl, formats: ['rawHtml'] }),
      });
      if (response.ok) {
        const details = videoDetailsFrom((await response.json()).data?.rawHtml || '');
        if (details?.description) return details;
        console.log('No description in Firecrawl YouTube page');
      } else {
        console.error('Firecrawl error:', response.status, await response.text());
      }
    } catch (e) {
      console.error('Firecrawl YouTube failed:', e);
    }
  }

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
    const fromVideo = await extractRecipeFromVideo(watchUrl, remaining);
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

async function instagramCaption(url: string): Promise<{ caption: string; imageUrl: string | null }> {
  const endpoints = [
    `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&maxwidth=640`,
    `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&maxwidth=640`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' } });
      if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
        const data = await response.json();
        if (data.title) return { caption: data.title, imageUrl: data.thumbnail_url || null };
      }
    } catch (e) {
      console.log('oEmbed endpoint failed:', e);
    }
  }

  try {
    console.log('oEmbed failed, trying direct meta tag extraction');
    const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' });
    const html = await response.text();
    const description = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
      || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const caption = (description?.[1] || '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'");
    return { caption, imageUrl: ogImage(html) };
  } catch (e) {
    console.error('Instagram extraction error:', e);
    return { caption: '', imageUrl: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deadline = Date.now() + REQUEST_BUDGET_MS;
    const videoId = youTubeVideoId(url);
    let result: Extraction;

    if (videoId) {
      result = await recipeFromYouTube(videoId, deadline);
    } else if (/tiktok\.com\//i.test(url)) {
      result = await recipeFromTikTok(url, deadline);
    } else if (/instagram\.com\/(p|reel|reels)\//i.test(url)) {
      const { caption, imageUrl } = await instagramCaption(url);
      result = await recipeFromCaption(caption, imageUrl, deadline);
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
