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
    const model = isOpenAI ? 'gpt-4o-mini' : 'google/gemini-3-flash-preview';

    const response = await fetch(endpoint, {
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
            content: 'Je bent een creatieve kookassistent. Je suggereert recepten op basis van beschikbare ingrediënten. Antwoord ALLEEN via de tool call.',
          },
          {
            role: 'user',
            content: `Ik heb de volgende ingrediënten beschikbaar:\n${ingredients.join('\n')}\n\nSuggereer 3 recepten die ik hiermee kan maken. Het mogen recepten zijn die ook een paar extra ingrediënten nodig hebben, maar de meeste ingrediënten moeten uit de lijst komen.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_recipes',
              description: 'Return recipe suggestions based on available ingredients',
              parameters: {
                type: 'object',
                properties: {
                  recipes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Naam van het recept in het Nederlands' },
                        description: { type: 'string', description: 'Korte beschrijving (1-2 zinnen) in het Nederlands' },
                        ingredients: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Lijst van alle ingrediënten met hoeveelheden',
                        },
                        instructions: { type: 'string', description: 'Stap-voor-stap bereidingswijze in het Nederlands' },
                        servings: { type: 'number', description: 'Aantal personen' },
                        extra_needed: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Ingrediënten die NIET in de beschikbare lijst staan en extra gekocht moeten worden',
                        },
                      },
                      required: ['name', 'description', 'ingredients', 'instructions', 'servings', 'extra_needed'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['recipes'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_recipes' } },
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Te veel verzoeken, probeer het later opnieuw.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Tegoed op, voeg credits toe.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI error:', status, t);
      throw new Error('AI error');
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('suggest-recipes error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate recipe suggestions' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
