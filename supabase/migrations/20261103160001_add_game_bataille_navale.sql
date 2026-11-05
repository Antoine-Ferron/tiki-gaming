-- Ajoute le jeu bataille navale au catalogue (#3).
-- Placée après 20261103160000_game_themes : le thème (genre) est désormais obligatoire.
insert into public.games (slug, title, description, category, theme)
values ('bataille-navale', 'Bataille navale', 'Coule la flotte adverse en duel, à deux sur le même appareil.', 'duel', 'action');
