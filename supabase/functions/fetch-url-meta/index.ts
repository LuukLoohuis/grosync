const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    let pageContent = '';
    let imageUrl: string | null = null;

    // Check if this is an Instagram URL — use oEmbed API (public, no auth needed)
    const isInstagram = /instagram\.com\/(p|reel|reels)\//i.test(url);
    if (isInstagram) {
      try {
        console.log('Using Instagram oEmbed for:', url);
        // Try multiple oEmbed endpoints
        const endpoints = [
          `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&maxwidth=640`,
          `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&maxwidth=640`,
        ];
        
        for (const oembedUrl of endpoints) {
          try {
            const oembedResp = await fetch(oembedUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
            });
            const contentType = oembedResp.headers.get('content-type') || '';
            if (oembedResp.ok && contentType.includes('application/json')) {
              const oembedData = await oembedResp.json();
              pageContent = oembedData.title || '';
              imageUrl = oembedData.thumbnail_url || null;
              console.log('Instagram oEmbed success, caption length:', pageContent.length);
              break;
            } else {
              console.log('oEmbed endpoint returned:', oembedResp.status, contentType);
            }
          } catch (e) {
            console.log('oEmbed endpoint failed:', e);
          }
        }

        // If oEmbed didn't work, try fetching the page directly and extracting from meta tags
        if (!pageContent) {
          console.log('oEmbed failed, trying direct meta tag extraction');
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            redirect: 'follow',
          });
          const html = await resp.text();
          
          // Extract description from og:description or meta description (contains caption)
          const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
            || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
          
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          
          if (descMatch?.[1]) {
            // Decode HTML entities
            pageContent = descMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&#x27;/g, "'");
            console.log('Extracted caption from meta tags, length:', pageContent.length);
          }
          if (ogImageMatch?.[1] && !imageUrl) {
            imageUrl = ogImageMatch[1].replace(/&amp;/g, '&');
          }
        }
      } catch (e) {
        console.error('Instagram extraction error:', e);
      }
    }

    // For non-Instagram URLs, try Firecrawl first for JS-rendered pages
    if (!pageContent && !isInstagram) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        try {
          console.log('Using Firecrawl to scrape:', url);
          const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['markdown', 'html'],
              waitFor: 5000,
            }),
          });

          if (fcResponse.ok) {
            const fcData = await fcResponse.json();
            pageContent = fcData.data?.markdown || fcData.data?.html || '';

            const html = fcData.data?.html || '';
            const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
            imageUrl = ogMatch?.[1] || fcData.data?.metadata?.ogImage || null;
          } else {
            const errBody = await fcResponse.text();
            console.error('Firecrawl error:', fcResponse.status, errBody);
          }
        } catch (e) {
          console.error('Firecrawl failed:', e);
        }
      }
    }

    // Fallback to simple fetch if nothing worked yet
    if (!pageContent) {
      console.log('Falling back to simple fetch');
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoupleCart/1.0)' },
      });
      const html = await response.text();

      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (!imageUrl) imageUrl = ogImageMatch?.[1] || null;

      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
    }

    // Make image URL absolute
    if (imageUrl && !imageUrl.startsWith('http')) {
      const urlObj = new URL(url);
      imageUrl = imageUrl.startsWith('/')
        ? `${urlObj.origin}${imageUrl}`
        : `${urlObj.origin}/${imageUrl}`;
    }

    // Use AI to extract recipe data
    let ingredients: string[] = [];
    let instructions = '';
    let recipeName = '';
    let description = '';
    let macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number } | null = null;
    let servings: number | null = null;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (apiKey && pageContent) {
      try {
        const truncated = pageContent.substring(0, 20000);

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You extract recipe data from web page text. Return valid JSON only, no markdown code blocks. Schema: {"name":"string","description":"string","ingredients":["string"],"instructions":"string","servings":number,"macros":{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}}. For "servings", extract the number of servings/portions the recipe is intended for. If the page mentions "voor X personen" or "serves X" or similar, use that number. If not explicitly stated, estimate based on ingredient quantities. Default to 4 if truly unknown. For ingredients include quantities. IMPORTANT: You MUST convert EVERY occurrence of "cup" or "cups" to grams (for solids) or milliliters (for liquids). This applies to ALL ingredients without exception — flour, sugar, olives, cheese, vegetables, nuts, everything. Examples: "1 cup flour" → "125g flour", "1 cup milk" → "240ml milk", "½ cup olives" → "75g olives", "1 cup spinach" → "30g spinach". Keep tablespoons, teaspoons, ounces, and all other units unchanged. Keep ingredient names in their original language. For instructions write clear numbered steps. For macros, estimate the total nutritional values for the ENTIRE recipe (all servings combined) based on the ingredients. Provide calories in kcal, protein/carbs/fat/fiber in grams as whole numbers. If no recipe found, return empty arrays/strings and null for macros.'
              },
              {
                role: 'user',
                content: `Extract the recipe from this page content:\n\n${truncated}`
              }
            ],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(jsonStr);
          ingredients = parsed.ingredients || [];
          instructions = parsed.instructions || '';
          recipeName = parsed.name || '';
          description = parsed.description || '';
          servings = typeof parsed.servings === 'number' ? parsed.servings : null;
          if (parsed.macros && typeof parsed.macros.calories === 'number') {
            macros = parsed.macros;
          }
          console.log('AI extraction successful:', recipeName, ingredients.length, 'ingredients', 'servings:', servings, macros ? 'with macros' : 'no macros');
        }
      } catch (e) {
        console.error('AI extraction failed:', e);
      }
    }

    return new Response(JSON.stringify({
      imageUrl,
      title: recipeName,
      description,
      ingredients,
      instructions,
      macros,
      servings,
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
