-- Structure initiale du cycle TDD rencontres (#18), complétée avant toute fusion.
-- Noms de participants locaux, sans relation avec les comptes de la plateforme.
create table public.dame_matches (
  id          uuid primary key,
  white_name  text,
  black_name  text,
  started_at  timestamptz,
  status      text,
  finished_at timestamptz
);

-- Les noms ne sont pas publics. L'API Java contrôlera la session propriétaire de la rencontre.
alter table public.dame_matches enable row level security;
revoke all on public.dame_matches from public, anon, authenticated, service_role;
grant select, insert on public.dame_matches to service_role;
grant update (status, finished_at) on public.dame_matches to service_role;
