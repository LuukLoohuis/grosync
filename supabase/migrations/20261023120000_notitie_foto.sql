-- "Dit merk": een korte notitie ("Optimel, de blauwe") en een eigen foto per
-- boodschap. De foto is een klein JPEG-plaatje als data-URL in de rij zelf:
-- zo reist hij mee met realtime en met de lijst die de telefoon bewaart, en
-- staat hij ook in een winkel zonder bereik naast het item.
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS photo TEXT;

ALTER TABLE public.grocery_items
  DROP CONSTRAINT IF EXISTS grocery_items_note_length,
  ADD CONSTRAINT grocery_items_note_length CHECK (note IS NULL OR char_length(note) <= 120),
  DROP CONSTRAINT IF EXISTS grocery_items_photo_thumb,
  ADD CONSTRAINT grocery_items_photo_thumb CHECK (
    photo IS NULL OR (photo LIKE 'data:image/jpeg;base64,%' AND char_length(photo) <= 80000)
  );
