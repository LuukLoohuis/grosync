-- VOORSTEL, nog niet uitgevoerd. Zie docs/supermarkt-koppeling.md.
--
-- Een gekozen product kan nu ook van Jumbo of Dirk zijn. De ah_*-kolommen
-- (nummer, titel, maat, aantal, foto, bonus, afdeling) zijn al winkel-neutraal
-- genoeg; ze krijgen er twee kolommen bij:
--   product_store  bij welke winkel het product hoort; NULL = AH, zodat alle
--                  bestaande rijen blijven kloppen zonder backfill.
--   product_url    de productpagina. AH en Dirk bouwt de app uit ah_product_id,
--                  Jumbo heeft de naam in de link nodig.
-- ah_product_id bewaart bij Jumbo het artikelnummer zonder verpakkingscode
-- ("723887PAK" → 723887).
--
-- Later netter: de ah_*-kolommen hernoemen naar product_* (raakt de app,
-- de edge functions en de offline-wachtrij tegelijk; apart doen).
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS product_store TEXT
    CHECK (product_store IS NULL OR product_store IN ('Jumbo', 'Dirk')),
  ADD COLUMN IF NOT EXISTS product_url TEXT;

COMMENT ON COLUMN public.grocery_items.product_store IS 'Winkel van het gekozen product; NULL = AH.';
COMMENT ON COLUMN public.grocery_items.product_url IS 'Productpagina bij die winkel; NULL = bouw uit ah_product_id.';
