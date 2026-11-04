-- Ajoute MiniGTA au catalogue (issue #12).
-- Score = tout l'argent gagné en cumulé, plafond large. Aligné avec scoreLimits côté front.
insert into public.games (slug, title, description, category, max_score)
values (
  'mini-gta',
  'MiniGTA',
  'Une ville entière générée par le code : conduis, remplis des missions et échappe à la police.',
  'solo',
  1000000
);
