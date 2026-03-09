import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://supabase-api:8080';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SUPABASE_PROJECT_ID = 'wguzdygvwtacfbzqwnxa';
const FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET /api/recipes - health check
    if (req.method === 'GET') {
      res.status(200).json({ status: 'healthy' });
      return;
    }

    // POST /api/recipes with action query param
    if (req.method === 'POST') {
      const action = req.query.action || 'fetch-from-url';

      if (action === 'fetch-from-url') {
        const { url } = req.body;
        if (!url) {
          res.status(400).json({ error: 'URL required' });
          return;
        }

        const fetchResponse = await fetch(`${FUNCTIONS_URL}/fetch-url-meta`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        });

        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch recipe: ${fetchResponse.statusText}`);
        }

        const recipe = await fetchResponse.json();

        const translateResponse = await fetch(`${FUNCTIONS_URL}/translate-recipe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recipe),
        });

        const translatedRecipe = translateResponse.ok ? await translateResponse.json() : recipe;

        const macrosResponse = await fetch(`${FUNCTIONS_URL}/calculate-macros`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ingredients: translatedRecipe.ingredients }),
        });

        const macros = macrosResponse.ok ? await macrosResponse.json() : {};

        const finalRecipe = {
          ...translatedRecipe,
          ...macros,
          sourceUrl: url,
        };

        res.status(200).json(finalRecipe);
        return;
      }

      if (action === 'translate') {
        const recipe = req.body;

        const translateResponse = await fetch(`${FUNCTIONS_URL}/translate-recipe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recipe),
        });

        if (!translateResponse.ok) {
          throw new Error(`Failed to translate: ${translateResponse.statusText}`);
        }

        const translated = await translateResponse.json();
        res.status(200).json(translated);
        return;
      }

      if (action === 'calculate-macros') {
        const { ingredients } = req.body;

        if (!ingredients || !Array.isArray(ingredients)) {
          res.status(400).json({ error: 'Ingredients array required' });
          return;
        }

        const macrosResponse = await fetch(`${FUNCTIONS_URL}/calculate-macros`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ingredients }),
        });

        if (!macrosResponse.ok) {
          throw new Error(`Failed to calculate macros: ${macrosResponse.statusText}`);
        }

        const macros = await macrosResponse.json();
        res.status(200).json(macros);
        return;
      }

      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
