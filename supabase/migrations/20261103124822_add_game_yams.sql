-- Ajoute le jeu Yams au catalogue. Score maximal d'une feuille : 105 (haut) + 35 (bonus) + 235 (bas) = 375.
insert into public.games (slug, title, description, category, max_score)
values (
  'yams',
  'Yams',
  'Lance les dés, choisis ta combinaison et remplis ta feuille de score.',
  'duel',
  375
);
