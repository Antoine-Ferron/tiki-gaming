-- Bornes des scores : un score est un entier positif ou nul, plafonné par jeu (games.max_score).
-- Aligné avec GameDefinition.scoreLimits côté front (vérifié par tests/integration/catalog.test.ts).

alter table public.scores
  add constraint scores_score_check check (score >= 0);

alter table public.games
  add column max_score bigint constraint games_max_score_check check (max_score >= 0);

comment on column public.games.max_score is
  'Score maximal accepté pour ce jeu (null = pas de limite). Vérifié par la politique d''insertion de public.scores.';

-- Clicker 10s : 30 clics par seconde pendant 10 s, au-delà ce n'est plus un humain.
update public.games set max_score = 300 where slug = 'clicker';

drop policy "Users can insert their own scores" on public.scores;

create policy "Users can insert their own scores"
  on public.scores for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.games g
      where g.slug = game_slug
        and g.is_active
        and (g.max_score is null or score <= g.max_score)
    )
  );
