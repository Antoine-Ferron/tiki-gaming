# language: fr
Fonctionnalité: Déblocage des niveaux
  Pour découvrir les niveaux dans l'ordre, du plus facile au plus difficile
  En tant que joueur
  Je veux qu'un niveau s'ouvre dès que j'ai terminé le précédent

  Plan du scénario: Un niveau est ouvert quand le précédent est terminé
    Étant donné que les niveaux terminés sont : <terminés>
    Quand le joueur regarde le niveau <niveau>
    Alors le niveau est <état>

    Exemples:
      | terminés | niveau | état   |
      | aucun    | 1      | ouvert |
      | aucun    | 2      | fermé  |
      | 1        | 2      | ouvert |
      | 1        | 3      | fermé  |
      | 1, 2     | 3      | ouvert |

  Scénario: Terminer un niveau avec 0 point ouvre quand même le suivant
    Étant donné que le niveau 1 est terminé avec 0 point
    Quand le joueur regarde le niveau 2
    Alors le niveau est ouvert
