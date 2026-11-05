# BANG! — Correspondance des SHA après rebase

Le 5 novembre 2026, la branche locale propre et non publiée a été sauvegardée par le tag local `backup/bang-qualite-avant-rebase-20261105` à `cd76d10184914607db6da8aaa6764666fb558f41`.

Le contenu de `f867f321` était identique à `cb4ae7d4`. `origin/dev` avait avancé à `a58e0e210e0b87a4e02ca1b1ca6b56b21372666d` : seuls les 11 commits suivants ont été rejoués sur cette base, en gardant `af/bang-tests-reseau-mutation`. Ni `dev` ni `main` ne sont modifiées.

| Ancien SHA | Nouveau SHA | Commit |
| --- | --- | --- |
| `90610d51576b8e64d18007e8bc3ac9ab1172a2d0` | `19cf83302e3a88ec8c3bf7e96b2cf4565d3c06d1` | test(bang): verifie la reprise apres une fin de tour perdue (#57) |
| `31ee56097ac30f69a4fecf597107a127abe0ba4a` | `3398ed69e5722b0872068c2386a6caf05a15f9ee` | test(bang): refuse un tir hors de portee via le service (#58) |
| `b498ae6a7720daad33cc0a4befb48fd20444ef73` | `ff994f0b3616ff0f517de50e35ddc2aa2757f256` | test(bang): bloque la seconde fin de tour pendant un POST lent (#61) |
| `e602d7a35e978d0f08dfdae5ccb8c482d33035e2` | `121ad3d1ed8fdf209ccb329b1eced22399c584ba` | test(bang): ajoute les campagnes PIT et Stryker ciblees (#61) |
| `053dd6b5314ed7b4060d45e0505adf3766136d83` | `4144b160ae6fd2b6113040ae246bf83206b09078` | test(bang): couvre la portee depuis plusieurs sieges (#58) |
| `f1440d7492b517f105a0224e944fe402a4396ccb` | `255cf90abacd52c7dc1aa46222d1ce242ad83dd0` | test(bang): couvre le renvoi avant la derniere defausse (#57) |
| `f3dcafc75133e027757199e9ec75113e532d9beb` | `728e65941c2b065f26f984b8cef5208fbffa3fb4` | test(bang): conserve deux clics de defausse valides (#61) |
| `27fd8036ab2a91ef353b73bdc463e3e1dbf2ad35` | `575e2639cbaebc4983f8d5476af7f0d2a09a8f9f` | test(bang): protege la reponse au tir et son renvoi (#59) |
| `202c7a56fd6ec6aad10160650fe0405cadf8f92b` | `843e55bd9ec760f3887c53f8de3a51a011b10bec` | test(bang): observe la carte retiree sans parcours long (#57) |
| `61c6737de1c0077c465e099550c8e6f471531de2` | `77b6d195ebc6e1f000742761afd81842a5299c1c` | test(bang): exclut les copies Stryker de la suite Vitest (#61) |
| `cd76d10184914607db6da8aaa6764666fb558f41` | `9024b61a9b6ef0b66a118329d0595f6c6f92afa8` | docs(bang): consigne les mesures et preuves de qualite (#61) |

`git range-diff` confirme dix patches identiques. Le patch PIT ne diffère que par le contexte des cibles mini-GTA ajoutées sur dev : elles sont conservées avec toutes les cibles BANG!. La différence de fichiers entre la sauvegarde et la nouvelle tête correspond exactement aux fichiers modifiés entre cb4ae7d4 et origin/dev. Aucun fichier du moteur ou des cartes BANG! ne diffère.

Les rapports de qualité, inventaires et preuves originales gardent leurs SHA et leurs résultats historiques. Le SHA testé `61c6737d` y correspond maintenant à `77b6d195`, et leur remise `cd76d101` à `9024b61a`. Cette correspondance ne constitue pas une nouvelle exécution de ces campagnes.
