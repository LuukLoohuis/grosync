-- Foto's van recepten. Instagram en TikTok geven een gesigneerde link naar hun
-- eigen CDN die na een paar dagen verloopt; daarom zet fetch-url-meta de foto
-- zelf in deze bucket. Iedereen mag lezen (de link staat gewoon in de app),
-- schrijven doet alleen de edge function met de service role, die langs RLS gaat.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
