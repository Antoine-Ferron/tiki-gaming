-- Catégorie obligatoire de chaque jeu (format de jeu).
-- Liste alignée avec frontend/src/games/categories.ts : toute nouvelle catégorie passe par
-- une migration qui remplace la contrainte, plus une entrée dans GAME_CATEGORIES.
alter table public.games
  add column category text not null default 'solo'
  constraint games_category_check check (category in ('solo', 'duel', 'multi'));

-- Le défaut ne sert qu'à remplir les jeux existants : chaque nouveau jeu doit déclarer sa catégorie.
alter table public.games alter column category drop default;

comment on column public.games.category is 'solo = 1 joueur, duel = 2 joueurs, multi = 3 joueurs et +';
