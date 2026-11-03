-- Score maximal de Rush Hour (issue #6) : 20 niveaux × 1000 points. Aligné avec scoreLimits côté front.
update public.games set max_score = 20000 where slug = 'rush-hour';
