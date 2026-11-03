-- Ajoute le jeu Sudoku au catalogue.
insert into public.games (slug, title, description, category)
values ('sudoku', 'Sudoku', 'Remplis la grille de 9×9 sans répéter un chiffre. Plus tu es rapide et précis, plus ton score est haut.', 'solo');
