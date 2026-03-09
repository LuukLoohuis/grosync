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

  if (req.method === 'GET' && req.url === '/health') {
    res.status(200).json({ status: 'healthy' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/recipes/add-from-url') {
    try {
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
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/recipes/translate') {
    try {
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
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/recipes/calculate-macros') {
    try {
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
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(404).json({ error: 'Not found' });
};
