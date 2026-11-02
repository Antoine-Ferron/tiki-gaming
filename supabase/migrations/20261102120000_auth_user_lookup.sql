-- Le backend Java (clé service_role) retrouve le compte Supabase d'un email vérifié par Google.
create or replace function public.find_auth_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.find_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id(text) to service_role;
