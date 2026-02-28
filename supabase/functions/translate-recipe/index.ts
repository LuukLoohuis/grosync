const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, description, ingredients, instructions } = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    const isOpenAI = !!Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("API key is not configured");

    const endpoint = isOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const model = isOpenAI ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

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
