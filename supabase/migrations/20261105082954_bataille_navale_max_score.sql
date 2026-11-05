-- Score maximal de Bataille navale : flotte de 17 cases (5+4+3+3+2), 1000 + hits*20 - misses*10 (logic.ts).
-- Le meilleur score théorique coule toute la flotte sans aucun tir dans l'eau : 1000 + 17*20 = 1340.
-- Aligné avec scoreLimits côté front (vérifié par tests/integration/catalog.test.ts).
update public.games set max_score = 1340 where slug = 'bataille-navale';
