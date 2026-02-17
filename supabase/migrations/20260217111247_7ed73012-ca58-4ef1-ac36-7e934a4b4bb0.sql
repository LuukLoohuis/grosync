
-- Create usuals table for frequently bought items
CREATE TABLE public.usuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usuals ENABLE ROW LEVEL SECURITY;

-- Owner access
CREATE POLICY "Owner full access" ON public.usuals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Shared list access
CREATE POLICY "Shared list access" ON public.usuals FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuals;
