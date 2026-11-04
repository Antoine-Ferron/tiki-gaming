# language: fr
Fonctionnalité: Calcul du score
  En tant que joueur
  Je veux que mon score récompense la rapidité et la difficulté
  Afin que gagner vite sur une grille difficile rapporte plus de points

  Plan du scénario: Le score dépend du temps écoulé et du nombre de mines
    Quand je calcule le score pour une partie de <mines> mines gagnée en <secondes> secondes
    Alors le score est de <score>

    Exemples:
      | mines | secondes | score |
      | 10    | 10       | 990   |
      | 10    | 100      | 900   |
      | 40    | 10       | 3990  |
      | 10    | 5000     | 0     |
