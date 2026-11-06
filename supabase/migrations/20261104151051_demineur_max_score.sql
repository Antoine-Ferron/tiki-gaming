-- Score maximal du Démineur (issue #15) : score = mineCount × 100 − elapsedSeconds, jamais négatif,
-- donc borné par la difficulté la plus dure (Expert, 99 mines) à temps nul. Aligné avec scoreLimits côté front.
update public.games set max_score = 9900 where slug = 'demineur';
