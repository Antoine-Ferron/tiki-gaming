-- Ajoute Prismine au catalogue (#8) : jeu de déduction solo, jouable sans compte.
-- Titre, description et catégorie alignés avec frontend/src/games/prismine/index.ts.
insert into public.games (slug, title, description, category)
values (
  'prismine',
  'Prismine',
  'Envoie des faisceaux de lumière dans une mine obscure et déduis où se cachent les cristaux.',
  'solo'
);
