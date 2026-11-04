-- Ajoute le jeu d'échecs au catalogue (issue #5).
-- Placée après 20261103160000_game_themes : le thème (genre) est désormais obligatoire.
insert into public.games (slug, title, description, category, theme)
values ('echecs', 'Échecs', 'Le jeu d''échecs classique, à deux sur le même écran.', 'duel', 'strategie');
