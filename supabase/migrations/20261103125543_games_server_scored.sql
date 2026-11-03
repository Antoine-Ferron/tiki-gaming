-- Jeux dont le score est calculé et enregistré par le backend (#8) : un joueur ne peut pas insérer lui-même
-- un score pour ces jeux, seule la clé service_role du serveur le peut (elle contourne la RLS).
-- Prismine en premier : le serveur Java arbitre la partie et classe le score en fin d'expédition.

alter table public.games
  add column server_scored boolean not null default false;

comment on column public.games.server_scored is
  'true : score écrit uniquement par le backend (service_role) ; la politique d''insertion de public.scores refuse les joueurs.';

update public.games set server_scored = true where slug = 'prismine';

drop policy "Users can insert their own scores" on public.scores;

create policy "Users can insert their own scores"
  on public.scores for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.games g
      where g.slug = game_slug
        and g.is_active
        and not g.server_scored
        and (g.max_score is null or score <= g.max_score)
    )
  );
