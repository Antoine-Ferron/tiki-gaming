-- Ajoute Prismine au catalogue (#8) : jeu de déduction solo, jouable sans compte.
-- Titre, description, catégorie et thème alignés avec frontend/src/games/prismine/index.ts.
insert into public.games (slug, title, description, category, theme)
values (
  'prismine',
  'Prismine',
  'Envoie des faisceaux de lumière dans une mine obscure et déduis où se cachent les cristaux.',
  'solo',
  'reflexion'
);
