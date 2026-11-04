# language: fr
Fonctionnalité: Billets lâchés en ville (R4)
  Pour être récompensé quand je ramasse de l'argent
  En tant que joueur
  Je veux que les billets s'ajoutent à mon argent et à mon score

  Scénario: Les billets ramassés s'ajoutent à l'argent et au score
    Étant donné un joueur qui a 500 $ et qui a gagné 0 $
    Quand il ramasse des billets pour 120 $
    Alors il a 620 $
    Et il a gagné 120 $ depuis le début de la partie
    Et sa progression est sauvegardée

  Scénario: Les billets s'ajoutent aux gains déjà faits
    Étant donné un joueur qui a 2000 $ et qui a gagné 3000 $
    Quand il ramasse des billets pour 45 $
    Alors il a 2045 $
    Et il a gagné 3045 $ depuis le début de la partie
