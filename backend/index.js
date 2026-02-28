const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://supabase-api:8080';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicmVmIjoiYWJjZTEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5NTI2NTE1MCwiZXhwIjoyNDYxODQxMTUwfQ.Yy-TT0SLbDjXYl-fFNQIrBzFG0xd9yJvVKRnz4s4fKk';

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Supabase App', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/supabase-status', async (req, res) => {
  try {
    // Check Supabase API connectivity
    const response = await fetch(`${supabaseUrl}/health`, { timeout: 5000 });
    
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    res.json({ 
      supabase: 'connected',
      timestamp: new Date().toISOString(),
      url: supabaseUrl
    });
  } catch (error) {
    res.status(503).json({ 
      supabase: 'disconnected',
      error: error.message,
      url: supabaseUrl
    });
  }
});

// Supabase Edge Functions configuration
const SUPABASE_PROJECT_ID = 'wguzdygvwtacfbzqwnxa';
const FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

// Add recipe from URL
app.post('/api/recipes/add-from-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    // Step 1: Fetch recipe metadata from URL
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
    console.log('Fetched recipe:', recipe);

    // Step 2: Translate recipe to Dutch
    const translateResponse = await fetch(`${FUNCTIONS_URL}/translate-recipe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    
    if (!translateResponse.ok) {
      console.warn(`Warning: Failed to translate recipe: ${translateResponse.statusText}`);
    }
    
    const translatedRecipe = translateResponse.ok ? await translateResponse.json() : recipe;
    console.log('Translated recipe:', translatedRecipe);

    // Step 3: Calculate macronutrients
    const macrosResponse = await fetch(`${FUNCTIONS_URL}/calculate-macros`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients: translatedRecipe.ingredients }),
    });
    
    if (!macrosResponse.ok) {
      console.warn(`Warning: Failed to calculate macros: ${macrosResponse.statusText}`);
    }
    
    const macros = macrosResponse.ok ? await macrosResponse.json() : {};
    console.log('Calculated macros:', macros);

    // Combine all data
    const finalRecipe = {
      ...translatedRecipe,
      ...macros,
      sourceUrl: url,
    };

    res.json(finalRecipe);
  } catch (error) {
    console.error('Error adding recipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all recipes
app.get('/api/recipes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json({ recipes: data });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recipe by ID
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// Translate recipe
app.post('/api/recipes/translate', async (req, res) => {
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
    res.json(translated);
  } catch (error) {
    console.error('Error translating recipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate macros
app.post('/api/recipes/calculate-macros', async (req, res) => {
  try {
    const { ingredients } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array required' });
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
      const error = await macrosResponse.text();
      throw new Error(`Failed to calculate macros: ${error}`);
    }
    
    const macros = await macrosResponse.json();
    res.json(macros);
  } catch (error) {
    console.error('Error calculating macros:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
});
