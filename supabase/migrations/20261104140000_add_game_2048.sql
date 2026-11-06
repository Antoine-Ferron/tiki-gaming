-- Ajoute 2048 au catalogue (issue #89).
-- Pas de max_score : le score n'a pas de plafond. Aligné avec l'absence de scoreLimits côté front.
insert into public.games (slug, title, description, category, theme)
values ('game-2048', '2048', 'Fais glisser les tuiles et fusionne-les pour atteindre 2048.', 'solo', 'reflexion');
