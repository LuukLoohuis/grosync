const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Alleen met Plus: wie vraagt het, en heeft die Plus. Bij twijfel geen Plus, want
// elke aanroep kost een taalmodel.
async function plusStatus(req: Request): Promise<'anon' | 'free' | 'plus'> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !url) return 'anon';
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return 'anon';
  const user = await userResponse.json();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const plusResponse = await fetch(`${url}/rest/v1/rpc/is_plus`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ _user: user?.id }),
  });
  if (!plusResponse.ok) {
    console.error('is_plus failed:', plusResponse.status, (await plusResponse.text()).slice(0, 200));
    return 'free';
  }
  return (await plusResponse.json()) === true ? 'plus' : 'free';
}

// Tekstmodel: standaard OpenAI, maar zet DEEPSEEK_API_KEY en alles wat tekst is
// loopt via DeepSeek (dezelfde API-vorm, een stuk goedkoper). Beelden kan DeepSeek
// niet lezen; die blijven bij OpenAI of Gemini.
const textApi = (settings = { provider: '', textModel: '' }) => {
  const deepseek = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  const openai = Deno.env.get('OPENAI_API_KEY') ?? '';
  // De keuze in Beheer wint; zonder keuze beslist de sleutel die er ligt.
  const wantsDeepseek = settings.provider ? settings.provider === 'deepseek' : Boolean(deepseek);

  if (wantsDeepseek && deepseek) {
    return {
      key: deepseek,
      endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.deepseek.com/v1') + '/chat/completions',
      model: settings.textModel || Deno.env.get('TEXT_MODEL') || 'deepseek-chat',
    };
  }
  return {
    key: openai,
    endpoint: (Deno.env.get('TEXT_API_BASE') || 'https://api.openai.com/v1') + '/chat/completions',
    model: settings.textModel || Deno.env.get('TEXT_MODEL') || 'gpt-4o-mini',
  };
};

/** Instellingen uit de database; leeg betekent: val terug op de omgeving. */
async function aiSettings(): Promise<{ provider: string; textModel: string; scanModel: string }> {
  const leeg = { provider: '', textModel: '', scanModel: '' };
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return leeg;
  try {
    const response = await fetch(`${url}/rest/v1/app_settings?key=eq.ai&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return leeg;
    const rows = await response.json();
    const value = rows?.[0]?.value ?? {};
    return {
      provider: String(value.provider ?? ''),
      textModel: String(value.text_model ?? ''),
      scanModel: String(value.scan_model ?? ''),
    };
  } catch (error) {
    console.error('Instellingen lezen mislukt:', error);
    return leeg;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const status = await plusStatus(req);
    if (status !== 'plus') {
      return new Response(JSON.stringify(status === 'anon' ? { error: 'Sign in required' } : { error: 'Plus required', plus_required: true }), {
        status: status === 'anon' ? 401 : 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { ingredients, staples, lang: gevraagd } = await req.json();
    const lang = gevraagd === 'en' ? 'en' : 'nl';
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: 'Ingredients array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ai = textApi(await aiSettings());
    if (!ai.key) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = ai.endpoint;
    const model = ai.model;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ai.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: lang === 'en'
              ? 'You are a creative cooking assistant. You suggest recipes from the ingredients at hand. Write everything in English. Answer ONLY via the tool call.'
              : 'Je bent een creatieve kookassistent. Je suggereert recepten op basis van beschikbare ingrediënten. Antwoord ALLEEN via de tool call.',
          },
          {
            role: 'user',
            content: `Ik heb de volgende ingrediënten beschikbaar:\n${ingredients.join('\n')}\n\n` +
              `Deze basisproducten heb ik altijd in huis: ${(Array.isArray(staples) && staples.length ? staples : ['zout', 'peper', 'olie']).join(', ')}.\n\n` +
              `Suggereer 3 recepten die ik hiermee kan maken, haalbaar op een doordeweekse avond. Basisproducten tellen niet als "extra nodig". De meeste andere ingrediënten moeten uit de lijst komen.`,
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
                        name: { type: 'string', description: lang === 'en' ? 'Recipe name in English' : 'Naam van het recept in het Nederlands' },
                        description: { type: 'string', description: lang === 'en' ? 'Short description (1-2 sentences) in English' : 'Korte beschrijving (1-2 zinnen) in het Nederlands' },
                        ingredients: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Lijst van alle ingrediënten met hoeveelheden',
                        },
                        instructions: { type: 'string', description: lang === 'en' ? 'Step-by-step instructions in English' : 'Stap-voor-stap bereidingswijze in het Nederlands' },
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
