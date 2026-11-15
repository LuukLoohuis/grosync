const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { ingredients } = await req.json();
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: 'Ingredients array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ai = textApi(await aiSettings());
    const apiKey = ai.key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = ai.endpoint;
    const model = ai.model;

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
