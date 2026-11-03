-- Jeux dont le score est calculé et enregistré par le backend (#8) : un joueur ne peut pas insérer lui-même
-- un score pour ces jeux, seule la clé service_role du serveur le peut (elle contourne la RLS).
-- Prismine en premier : le serveur Java arbitre la partie et classe le score en fin d'expédition.

alter table public.games
  add column server_scored boolean not null default false;

comment on column public.games.server_scored is
  'true : score écrit uniquement par le backend (service_role) ; la politique « Server-scored games refuse player scores » refuse les joueurs.';

update public.games set server_scored = true where slug = 'prismine';

-- Politique RESTRICTIVE, distincte de « Users can insert their own scores » : elle s'ajoute (ET) aux politiques
-- permissives, et une future réécriture de celles-ci ne peut pas la faire disparaître par oubli.
create policy "Server-scored games refuse player scores"
  on public.scores as restrictive for insert to authenticated
  with check (
    not exists (select 1 from public.games g where g.slug = game_slug and g.server_scored)
  );

-- Un score Prismine par expédition : le backend range l'identifiant de l'expédition dans metadata.runId. Une nouvelle
-- tentative d'enregistrement (après une panne) est refusée en doublon, le score n'est jamais classé deux fois.
create unique index scores_prismine_run_idx
  on public.scores ((metadata ->> 'runId'))
  where game_slug = 'prismine';
