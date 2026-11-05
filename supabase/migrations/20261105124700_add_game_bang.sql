-- Ajoute BANG ! au catalogue (issue #61).
-- Placée après 20261104120000_scores_server_only : le thème (genre) est obligatoire.
insert into public.games (slug, title, description, category, theme)
values ('bang', 'BANG !', 'Shérif, hors-la-loi et renégat s’affrontent au saloon : à quatre sur le même écran, ou en ligne.', 'multi', 'strategie');
