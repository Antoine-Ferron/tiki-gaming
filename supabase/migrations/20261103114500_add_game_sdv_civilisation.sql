-- Ajoute SDV Civilisation au catalogue (issue #7). Pas de max_score tant que le score final n'est pas calculé.
insert into public.games (slug, title, description, category)
values ('sdv-civilisation', 'SDV Civilisation', 'Développe ta civilisation en trois âges et affronte les autres joueurs.', 'multi');
