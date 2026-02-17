-- Add macros column to recipes table (JSONB for flexibility)
ALTER TABLE public.recipes
ADD COLUMN macros JSONB DEFAULT NULL;

COMMENT ON COLUMN public.recipes.macros IS 'Macro nutrients: {calories, protein, carbs, fat, fiber} - all numeric values';
