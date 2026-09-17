-- Een recept als favoriet markeren, met een hartje in het overzicht.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;

-- Favorieten staan vooraan; deze index houdt dat goedkoop.
CREATE INDEX IF NOT EXISTS recipes_favorite_idx ON public.recipes (user_id, favorite);
