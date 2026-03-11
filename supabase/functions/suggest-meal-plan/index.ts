const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { existingRecipes, emptySlots } = await req.json();

    const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
    const isOpenAI = !!Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = isOpenAI
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://ai.gateway.lovable.dev/v1/chat/completions';
    const model = isOpenAI ? 'gpt-4o-mini' : 'google/gemini-3-flash-preview';

    const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    const mealNames: Record<string, string> = { breakfast: 'ontbijt', lunch: 'lunch', dinner: 'avondeten' };

    const slotsDescription = emptySlots
      .map((s: any) => `${dayNames[s.dayIndex]} - ${mealNames[s.mealType]}`)
      .join('\n');

    const recipeNames = existingRecipes?.map((r: any) => r.name).join(', ') || 'geen';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Je bent een maaltijdplanner assistent. Suggereer gevarieerde, gezonde Nederlandse maaltijden. Antwoord ALLEEN via de tool call.',
          },
          {
            role: 'user',
            content: `Vul de volgende lege maaltijdslots in met suggesties. De gebruiker heeft deze recepten al: ${recipeNames}.\n\nLege slots:\n${slotsDescription}\n\nGeef voor elk slot een maaltijdsuggestie met naam, korte beschrijving en ingrediëntenlijst.`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'fill_meal_plan',
            description: 'Fill empty meal plan slots with suggestions',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      dayIndex: { type: 'number' },
                      mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
                      name: { type: 'string', description: 'Naam van de maaltijd in het Nederlands' },
                      description: { type: 'string', description: 'Korte beschrijving' },
                      ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingrediënten met hoeveelheden' },
                      instructions: { type: 'string', description: 'Bereidingswijze' },
                      servings: { type: 'number', description: 'Aantal personen' },
                    },
                    required: ['dayIndex', 'mealType', 'name', 'description', 'ingredients', 'instructions', 'servings'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['suggestions'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'fill_meal_plan' } },
        temperature: 0.9,
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
    console.error('suggest-meal-plan error:', error);
    return new Response(JSON.stringify({ error: 'Kon geen maaltijdsuggesties genereren' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
