-- Expéditions Prismine en cours (#8) : le serveur Java arbitre la partie et garde ici l'état de chaque
-- expédition, dont la graine de l'étage (donc sa carte cachée). Ni le joueur ni le front ne doivent la lire.
-- Écrite uniquement par le backend avec la clé service_role (voir backend/.../games/prismine/SupabaseRunRepository).
create table public.prismine_runs (
  id          uuid primary key,
  -- null pour une expédition d'invité
  user_id     uuid references public.profiles (id) on delete cascade,
  state       jsonb not null,
  created_at  timestamptz not null default now()
);

create index prismine_runs_user_idx on public.prismine_runs (user_id);

-- RLS activée sans aucune policy : anon et authenticated n'y ont aucun accès, seul service_role passe.
alter table public.prismine_runs enable row level security;

revoke all on public.prismine_runs from anon, authenticated;
