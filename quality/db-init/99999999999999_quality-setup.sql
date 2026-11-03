-- Environnement de qualimétrie local uniquement, exécuté par l'image à l'initialisation (migrate.sh, en supabase_admin).

-- PostgREST se connecte avec le rôle authenticator, réservé au superutilisateur.
alter role authenticator with password 'postgres';

-- auth.uid() de la production (mise à jour par GoTrue, absente de l'image brute) : PostgREST récent ne remplit
-- que request.jwt.claims. Définition recopiée de la base de production.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
