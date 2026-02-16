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

    // Try Firecrawl first for JS-rendered pages
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

          // Extract OG image from HTML
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

    // Fallback to simple fetch if Firecrawl didn't work
    if (!pageContent) {
      console.log('Falling back to simple fetch');
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoupleCart/1.0)' },
      });
      const html = await response.text();

      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      imageUrl = ogImageMatch?.[1] || null;

      // Strip tags for AI
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
                content: 'You extract recipe data from web page text. Return valid JSON only, no markdown code blocks. Schema: {"name":"string","description":"string","ingredients":["string"],"instructions":"string"}. For ingredients include quantities. IMPORTANT: Convert ONLY cups to grams or milliliters (e.g. "1 cup flour" → "125g flour", "1 cup milk" → "240ml milk"). Keep tablespoons, teaspoons, ounces, and all other measurements as-is. Keep the ingredient names in their original language. For instructions write clear numbered steps. If no recipe found, return empty arrays/strings.'
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
          console.log('AI extraction successful:', recipeName, ingredients.length, 'ingredients');
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
