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

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoupleCart/1.0)' },
    });
    const html = await response.text();

    // Extract OG image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);

    let imageUrl = ogImageMatch?.[1] || null;
    if (!imageUrl) {
      const imgMatch = html.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
        if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url);
          imageUrl = `${urlObj.origin}${imageUrl}`;
        }
      }
    }

    if (imageUrl && !imageUrl.startsWith('http')) {
      const urlObj = new URL(url);
      imageUrl = imageUrl.startsWith('/')
        ? `${urlObj.origin}${imageUrl}`
        : `${urlObj.origin}/${imageUrl}`;
    }

    const title = ogTitleMatch?.[1] || null;

    // Use AI to extract recipe data from HTML
    let ingredients: string[] = [];
    let instructions = '';
    let recipeName = title || '';
    let description = '';

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (apiKey) {
      try {
        // Strip scripts/styles to reduce token size
        const cleanHtml = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 15000);

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
                content: 'You extract recipe data from web page text. Return valid JSON only, no markdown. Schema: {"name":"string","description":"string","ingredients":["string"],"instructions":"string"}. If no recipe found, return empty arrays/strings.'
              },
              {
                role: 'user',
                content: `Extract the recipe from this page:\n\n${cleanHtml}`
              }
            ],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          // Parse JSON from response (handle potential markdown wrapping)
          const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(jsonStr);
          ingredients = parsed.ingredients || [];
          instructions = parsed.instructions || '';
          if (parsed.name) recipeName = parsed.name;
          if (parsed.description) description = parsed.description;
        }
      } catch (e) {
        console.error('AI extraction failed, returning basic meta only:', e);
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
