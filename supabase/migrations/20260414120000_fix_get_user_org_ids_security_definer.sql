CREATE OR REPLACE FUNCTION get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = _user_id;
$$;
