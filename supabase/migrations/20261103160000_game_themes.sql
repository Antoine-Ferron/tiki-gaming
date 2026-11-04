-- Thème obligatoire de chaque jeu (genre), en plus de la catégorie (nombre de joueurs).
-- Liste alignée avec frontend/src/games/themes.ts : tout nouveau thème passe par une migration
-- qui remplace la contrainte, plus une entrée dans GAME_THEMES.
alter table public.games
  add column theme text not null default 'action'
  constraint games_theme_check check (theme in ('action', 'reflexion', 'strategie'));

update public.games set theme = 'reflexion' where slug in ('mastermind', 'rush-hour', 'sudoku');
update public.games set theme = 'strategie' where slug = 'sdv-civilisation';

-- Le défaut ne sert qu'à remplir les jeux existants : chaque nouveau jeu doit déclarer son thème.
alter table public.games alter column theme drop default;

comment on column public.games.theme is 'action = réflexes, reflexion = logique et énigmes, strategie = gestion et stratégie';
