
-- Shared grocery lists
CREATE TABLE public.shared_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_code TEXT NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  name TEXT NOT NULL DEFAULT 'Grocery List',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Items in shared lists
CREATE TABLE public.shared_grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_grocery_items ENABLE ROW LEVEL SECURITY;

-- Public access policies (share_code is the "password")
CREATE POLICY "Anyone can view shared lists" ON public.shared_lists FOR SELECT USING (true);
CREATE POLICY "Anyone can create shared lists" ON public.shared_lists FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view shared items" ON public.shared_grocery_items FOR SELECT USING (true);
CREATE POLICY "Anyone can add items" ON public.shared_grocery_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update items" ON public.shared_grocery_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete items" ON public.shared_grocery_items FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_grocery_items;
