-- =============================================================================
-- Tiki Gaming — schéma socle de la plateforme
--   profiles   : profil public de chaque joueur (1-1 avec auth.users)
--   games      : catalogue des jeux (une ligne par jeu, ajoutée par l'équipe du jeu)
--   scores     : historique des scores (insert-only côté client)
--   game_saves : sauvegarde JSON par joueur et par jeu
--   leaderboard: vue meilleur score par joueur et par jeu
-- =============================================================================

-- Utilitaire : maintient updated_at -------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PROFILES --------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Création automatique du profil à l'inscription.
-- Le pseudo vient de options.data.username (signUp) ; il est nettoyé et
-- dédoublonné pour ne jamais faire échouer l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         int := 0;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_]', '', 'g');
  if length(base) < 3 then
    base := 'joueur_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base := left(base, 20);
  candidate := base;

  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- GAMES -----------------------------------------------------------------------
create table public.games (
  slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Games are readable by everyone"
  on public.games for select
  using (true);

-- SCORES ----------------------------------------------------------------------
create table public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_slug   text not null references public.games (slug) on delete cascade,
  score       bigint not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_slug, score desc);
create index scores_user_idx on public.scores (user_id);

alter table public.scores enable row level security;

create policy "Scores are readable by everyone"
  on public.scores for select
  using (true);

create policy "Users can insert their own scores"
  on public.scores for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.games g where g.slug = game_slug and g.is_active)
  );

-- GAME SAVES ------------------------------------------------------------------
create table public.game_saves (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_slug   text not null references public.games (slug) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_slug)
);

create trigger game_saves_set_updated_at
  before update on public.game_saves
  for each row execute function public.set_updated_at();

alter table public.game_saves enable row level security;

create policy "Users can read their own saves"
  on public.game_saves for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own saves"
  on public.game_saves for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saves"
  on public.game_saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saves"
  on public.game_saves for delete to authenticated
  using ((select auth.uid()) = user_id);

-- LEADERBOARD (vue, respecte la RLS de l'appelant) ----------------------------
create view public.leaderboard
with (security_invoker = true) as
select
  s.game_slug,
  s.user_id,
  p.username,
  p.avatar_url,
  max(s.score)       as best_score,
  count(*)           as games_played,
  max(s.created_at)  as last_played_at
from public.scores s
join public.profiles p on p.id = s.user_id
group by s.game_slug, s.user_id, p.username, p.avatar_url;

-- PRIVILÈGES explicites (ne pas dépendre des grants par défaut) ---------------
revoke all on public.profiles, public.games, public.scores, public.game_saves, public.leaderboard
  from anon, authenticated;

grant select on public.profiles, public.games, public.scores, public.leaderboard to anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant insert (game_slug, score, metadata) on public.scores to authenticated;
grant select, insert, update, delete on public.game_saves to authenticated;

-- JEU D'EXEMPLE ---------------------------------------------------------------
insert into public.games (slug, title, description)
values ('clicker', 'Clicker 10s', 'Clique le plus vite possible pendant 10 secondes. Jeu d''exemple / template.');
