
-- Create RPC to look up shared list by share_code (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_shared_list_by_code(_share_code text)
RETURNS TABLE(id uuid, user_id uuid, name text, share_code text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, share_code, created_at
  FROM public.shared_lists
  WHERE shared_lists.share_code = _share_code
  LIMIT 1;
$$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view shared lists" ON public.shared_lists;

-- Create restrictive SELECT policy: only owners can directly query the table
CREATE POLICY "Owner can view own shared lists"
ON public.shared_lists
FOR SELECT
USING (auth.uid() = user_id);
