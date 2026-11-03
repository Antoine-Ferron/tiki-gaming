-- Score maximal de Mastermind (issue #4) : 10 points maximum.
-- Aligné avec scoreLimits côté front (vérifié par tests/integration/catalog.test.ts).
update public.games set max_score = 10 where slug = 'mastermind';
