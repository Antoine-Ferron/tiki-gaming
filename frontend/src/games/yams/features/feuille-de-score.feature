# language: fr
Fonctionnalité: Feuille de score du Yams
  Pour savoir qui gagne la partie
  En tant que joueur
  Je veux que chaque case de ma feuille rapporte les points prévus par les règles

  Contexte:
    Soit une feuille de score vierge

  Scénario: Un full inscrit dans sa case rapporte 25 points
    Étant donné les dés "3-3-3-6-6"
    Quand je les inscris dans la case "Full"
    Alors la case "Full" vaut 25 points
    Et la case "Full" n'est plus disponible

  Scénario: Une case déjà jouée ne peut pas être rejouée
    Étant donné que la case "Yams" vaut déjà 50 points
    Et les dés "6-6-6-6-6"
    Quand je les inscris dans la case "Yams"
    Alors l'inscription est refusée avec le message "Case déjà jouée"

  Plan du scénario: Les combinaisons à la frontière des règles
    Étant donné les dés "<lancer>"
    Quand je les inscris dans la case "<case>"
    Alors la case "<case>" vaut <points> points

    Exemples:
      | lancer    | case         | points |
      | 3-3-6-6-1 | Full         | 0      |
      | 4-4-4-4-4 | Full         | 0      |
      | 2-2-2-2-2 | Carré        | 10     |
      | 5-5-5-2-1 | Carré        | 0      |
      | 1-2-3-4-4 | Petite suite | 30     |
      | 1-2-3-5-6 | Petite suite | 0      |
      | 6-6-6-6-1 | Yams         | 0      |
      | 6-6-6-6-6 | Yams         | 50     |

  Plan du scénario: Le bonus de 35 points se gagne à partir de 63 en section haute
    Étant donné une section haute qui totalise <sous_total> points
    Quand je calcule le bonus
    Alors le bonus vaut <bonus> points

    Exemples:
      | sous_total | bonus |
      | 62         | 0     |
      | 63         | 35    |
      | 64         | 35    |
