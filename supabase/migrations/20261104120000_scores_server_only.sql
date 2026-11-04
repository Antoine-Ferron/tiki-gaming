-- Les scores ne sont plus écrits depuis le navigateur : seul le backend Java (clé service_role) les enregistre,
-- pour le compte de la session HTTP du joueur (POST /api/scores). Un joueur ne peut plus insérer de score avec
-- supabase-js, même pour son propre compte.
--
-- La RLS ne s'applique pas au service_role : les règles du catalogue (jeu actif, games.max_score) passent de la
-- politique d'insertion à un trigger, qui les vérifie quel que soit l'auteur de l'insertion.
--
-- À appliquer APRÈS le déploiement du front qui envoie les scores au backend : avant, l'envoi des scores échoue.

drop policy "Users can insert their own scores" on public.scores;
revoke insert on public.scores from authenticated;

create or replace function public.check_score_allowed()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  game public.games%rowtype;
begin
  select * into game from public.games where slug = new.game_slug;
  -- Jeu absent du catalogue : la clé étrangère refuse la ligne (23503).
  if not found then
    return new;
  end if;
  if not game.is_active then
    raise exception 'Le jeu % n''accepte plus de scores', new.game_slug
      using errcode = 'object_not_in_prerequisite_state'; -- 55000
  end if;
  if game.max_score is not null and new.score > game.max_score then
    raise exception 'Score % supérieur au maximum du jeu % (%)', new.score, new.game_slug, game.max_score
      using errcode = 'check_violation'; -- 23514
  end if;
  return new;
end;
$$;

revoke all on function public.check_score_allowed() from public, anon, authenticated;

create trigger scores_check_allowed
  before insert on public.scores
  for each row execute function public.check_score_allowed();

comment on column public.games.max_score is
  'Score maximal accepté pour ce jeu (null = pas de limite). Vérifié par le trigger scores_check_allowed.';
