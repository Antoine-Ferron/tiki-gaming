# Prismine : test de charge du serveur arbitre (k6)

Chaque action d'une expédition passe par le serveur Java, qui relit puis réécrit l'expédition dans Postgres : c'est le
chemin à mesurer. Le script [quality/k6/prismine.js](../../../quality/k6/prismine.js) joue une expédition complète
d'invité : session, démarrage, reprise, 3 tirs, validation, fin (8 requêtes).

## Seuils

Les mêmes SLO que le reste de la plateforme ([docs/slo.md](../../slo.md)). Un seuil dépassé fait sortir k6 en erreur.

| Indicateur | Seuil |
|------------|-------|
| Latence | P95 < 300 ms, P99 < 500 ms |
| Taux d'erreur | < 1 % |
| Vérifications réussies | > 99 % |

Un bord déjà exploré répond 409 : c'est une règle du jeu, le script ne le compte pas comme une panne.

## Environnement

- Le serveur Java, sur une machine de développement, avec 512 Mo de mémoire.
- Postgres et PostgREST dans Docker (`quality/docker-compose.yml`), avec les vraies migrations et 1 000 joueurs factices.
- Un proxy qui ajoute le préfixe `/rest/v1` de Supabase (`quality/rest-proxy.mjs`).
- La limite de démarrages par adresse relevée (`TIKI_PRISMINE_MAXSTARTSPERWINDOW`), car k6 joue depuis une seule adresse.

```bash
TIKI_PRISMINE_MAXSTARTSPERWINDOW=1000000 bash quality/prismine-local.sh   # dans un premier terminal
K6_PROFILE=load docker compose -f quality/docker-compose.yml run --rm k6 run --quiet /quality/k6/prismine.js
```

## Résultats mesurés (6 novembre 2026)

| Profil | Charge | Requêtes | P95 | P99 | Maximum | Erreurs | Verdict |
|--------|--------|----------|-----|-----|---------|---------|---------|
| `smoke` | 1 utilisateur, 5 expéditions | 40 | 19,0 ms | 33,3 ms | 39 ms | 0 % | Seuils tenus |
| `load` | 5 expéditions/s pendant 30 s | 1 208 | 13,8 ms | 16,0 ms | 22 ms | 0 % | Seuils tenus |
| `stress` | Montée jusqu'à 40 expéditions/s en 90 s | 12 600 | 13,1 ms | 15,6 ms | 55 ms | 0 % | Seuils tenus |
| `spike` | Pic à 50 expéditions/s en 5 s, tenu 20 s | 10 176 | 14,0 ms | 17,3 ms | 37 ms | 0,08 % | Seuils tenus |

## Ce qu'on en conclut

- La charge nominale tient avec une marge large : le P95 reste environ 20 fois sous le seuil de 300 ms.
- **La charge maximale n'est pas connue** : le test de stress s'arrête à 40 expéditions/s sans avoir trouvé le point de
  rupture.
- Le pic a produit 0,08 % d'échecs : des coupures de connexion entre k6 et le serveur, juste avant une panne de Docker
  Desktop sur la machine de mesure. Le seuil de 1 % reste tenu, mais la cause exacte n'a pas été isolée.

## Limites

- Mesure en local : ces latences ne comptent pas le réseau réel vers Supabase, donc elles sont optimistes.
- Invité uniquement : l'enregistrement du score d'un joueur connecté n'est pas chargé.
- Une seule adresse, avec la limite de démarrages relevée.
- Le profil `soak` (12 à 24 h, fuites mémoire) n'a pas été lancé.
- Le script n'est pas branché en CI : le job `Performance (k6)` ne lance que `quality/k6/lobby.js`.
