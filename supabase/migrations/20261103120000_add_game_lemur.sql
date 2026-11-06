-- LemurTiki : runner vertical solo (docs/games/lemur/specification.md).
-- category et max_score alignés avec frontend/src/games/lemur/index.ts (vérifié par tests/integration/catalog.test.ts).
-- max_score : 100 000 (EF-6.5), soit plus d'une heure d'ascension sans faute ; au-delà, le score n'est pas plausible.
insert into public.games (slug, title, description, category, max_score)
values (
  'lemur',
  'LemurTiki',
  'Grimpe le baobab de branche en branche avec le maki, sans te faire rattraper par la fossa.',
  'solo',
  100000
);
