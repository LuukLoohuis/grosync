
CREATE TABLE public.purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  purchase_count integer NOT NULL DEFAULT 1,
  last_purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_name)
);

ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON public.purchase_history FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.purchase_history FOR ALL TO public
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));
