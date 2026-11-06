# language: fr
# Règles d'une expédition (#8). Le serveur arbitre : le joueur déduit la carte, il ne la reçoit jamais pendant l'étage.
@prismine @expedition
Fonctionnalité: Expédition dans la mine
  En tant que joueur de Prismine
  Je veux que l'huile, les tirs et les validations suivent des règles connues
  Afin de déduire la carte cachée à armes égales, sans qu'aucun joueur puisse tricher

  Contexte:
    Étant donné une galerie dont la seule pièce est un prisme rouge

  Scénario: Un tir coûte une dose d'huile et révèle le trajet du faisceau
    Étant donné une expédition avec 20 doses d'huile
    Quand je tire depuis "Haut D"
    Alors il me reste 19 doses d'huile
    Et le faisceau ressort en "Gauche 3" avec la couleur "rouge"

  Scénario: Un bord déjà exploré ne peut pas être retenté
    Étant donné une expédition avec 20 doses d'huile
    Et j'ai déjà tiré depuis "Haut D"
    Quand je tire depuis "Gauche 3"
    Alors le tir est refusé : "Ce bord a déjà été exploré : regarde le journal."
    Et il me reste 19 doses d'huile

  Plan du Scénario: Il faut au moins une dose pour tirer (<huile> en réserve)
    Étant donné une expédition avec <huile> doses d'huile
    Quand je tire depuis "Haut D"
    Alors le tir est <issue>
    Et il me reste <reste> doses d'huile

    Exemples:
      | huile | issue   | reste |
      | 0     | refusé  | 0     |
      | 1     | accepté | 0     |
      | 2     | accepté | 1     |

  Plan du Scénario: Une carte fausse coûte trois doses, sinon la lampe s'éteint (<huile> en réserve)
    Étant donné une expédition avec <huile> doses d'huile
    Quand je valide une carte fausse
    Alors l'expédition <issue>
    Et il me reste <reste> doses d'huile

    Exemples:
      | huile | issue      | reste |
      | 2     | se termine | 2     |
      | 3     | continue   | 0     |
      | 4     | continue   | 1     |

  Scénario: Une carte qui contredit un tir ne coûte rien
    Étant donné une expédition avec 20 doses d'huile
    Et j'ai déjà tiré depuis "Haut D"
    Quand je valide une carte avec un prisme de la mauvaise couleur
    Alors ma carte contredit le tir 1
    Et il me reste 19 doses d'huile

  Plan du Scénario: Un étage rapporte 100 points par niveau, plus 50 % sans erreur
    Étant donné une expédition à l'étage <etage> avec <erreurs> erreurs sur cet étage
    Quand je valide la bonne carte
    Alors je gagne <points> points

    Exemples:
      | etage | erreurs | points |
      | 1     | 0       | 150    |
      | 1     | 1       | 100    |
      | 3     | 0       | 450    |
      | 3     | 2       | 300    |

  Scénario: Un étage réussi fait descendre et remplit la lampe
    Étant donné une expédition avec 20 doses d'huile
    Quand je valide la bonne carte
    Alors je descends à l'étage 2
    Et il me reste 30 doses d'huile

  Scénario: Un joueur ne peut pas déclarer lui-même son score
    Quand je déclare moi-même un score de 150 points
    Alors mon score est refusé
