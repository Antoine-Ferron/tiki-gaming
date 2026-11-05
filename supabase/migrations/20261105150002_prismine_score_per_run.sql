-- Un score Prismine par expédition (#8) : le serveur Java arbitre la partie et classe lui-même le score en fin
-- d'expédition, en rangeant l'identifiant de l'expédition dans metadata.runId. Une nouvelle tentative
-- d'enregistrement (après une panne) est refusée en doublon, le score n'est jamais classé deux fois.
-- Les joueurs n'insèrent plus de score eux-mêmes (20261104120000_scores_server_only) et POST /api/scores refuse
-- Prismine (PrismineScoreValidator) : seule l'expédition terminée côté serveur produit un score.
create unique index scores_prismine_run_idx
  on public.scores ((metadata ->> 'runId'))
  where game_slug = 'prismine';
