const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tekstmodel: standaard OpenAI, maar zet DEEPSEEK_API_KEY en alles wat tekst is
// loopt via DeepSeek (dezelfde API-vorm, een stuk goedkoper). Beelden kan DeepSeek
// niet lezen; die blijven bij OpenAI of Gemini.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, description, ingredients, instructions } = await req.json();
    const ai = textApi();
    const apiKey = ai.key;
    if (!apiKey) throw new Error("API key is not configured");

    const endpoint = ai.endpoint;
    const model = ai.model;

    const prompt = `Vertaal het volgende recept naar het Nederlands. Geef het resultaat terug als JSON met exact deze velden: name, description, ingredients (array van strings), instructions (string).

Belangrijk:
- Vertaal alles naar correct Nederlands
- Zet eenheden in 'cups' om naar grammen of milliliters
- Laat tablespoons en teaspoons in hun originele formaat staan
- Behoud de structuur en nummering van instructies

Recept:
Naam: ${name || ""}
Beschrijving: ${description || ""}
Ingrediënten:
${(ingredients || []).join("\n")}
Instructies:
${instructions || ""}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Je bent een vertaalassistent voor recepten. Antwoord ALLEEN met valid JSON, geen markdown codeblokken." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "translate_recipe",
              description: "Return the translated recipe",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  ingredients: { type: "array", items: { type: "string" } },
                  instructions: { type: "string" },
                },
                required: ["name", "description", "ingredients", "instructions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "translate_recipe" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Tegoed op, voeg credits toe." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const translated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(translated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-recipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
