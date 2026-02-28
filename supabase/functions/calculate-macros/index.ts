const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients } = await req.json();
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: 'Ingredients array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
    const isOpenAI = !!Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = isOpenAI
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://ai.gateway.lovable.dev/v1/chat/completions';
    const model = isOpenAI ? 'gpt-4o-mini' : 'google/gemini-2.5-flash';

    const aiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You estimate macro nutrients from a list of ingredients. Return valid JSON only, no markdown code blocks. Schema: {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}. All values should be whole numbers. Calories in kcal, protein/carbs/fat/fiber in grams. Estimate the total nutritional values for ALL ingredients combined (the entire recipe). Be as accurate as possible based on the quantities given.',
          },
          {
            role: 'user',
            content: `Estimate the total macro nutrients for this recipe with these ingredients:\n${ingredients.join('\n')}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const macros = JSON.parse(jsonStr);

    if (typeof macros.calories !== 'number') {
      throw new Error('Invalid macros response');
    }

    return new Response(JSON.stringify({ macros }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating macros:', error);
    return new Response(JSON.stringify({ error: 'Failed to calculate macros' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
