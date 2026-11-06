# Mutants BANG! restants — 5 novembre 2026

Inventaire complet des survivants, non couverts et timeouts des campagnes ciblées finales. Les mutants tués restent consultables dans les rapports XML/JSON et HTML. Aucun de ces mutants restants n’est masqué ou exclu du calcul.

SHA des sources et tests : `61c6737de1c0077c465e099550c8e6f471531de2`.

## PIT

Rapports : `quality/reports/bang/pit-after/index.html` et `mutations.xml`. Les deux mutations du drapeau face visible d’InitialDeal n’affectent pas la projection privée, qui publie uniquement le rôle du Shérif. Les mutations du générateur de code et de l’accesseur interne `game` se distinguent des refus de commandes : une survie ne prouve pas à elle seule un défaut du code courant. Plusieurs gardes restent testées par HTTP et non par la boucle unitaire PIT.

| État | Source | Méthode | Mutation |
| --- | --- | --- | --- |
| SURVIVED | PrivateTableService.java:273 | activeTable | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:276 | activeTable | removed conditional - replaced equality check with false |
| TIMED_OUT | PrivateTableService.java:65 | create | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:65 | create | removed conditional - replaced equality check with true |
| SURVIVED | PrivateTableService.java:194 | discard | changed conditional boundary |
| SURVIVED | PrivateTableService.java:190 | discard | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:194 | discard | removed conditional - replaced comparison check with false |
| SURVIVED | PrivateTableService.java:148 | draw | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:179 | endTurn | changed conditional boundary |
| SURVIVED | PrivateTableService.java:179 | endTurn | Replaced integer subtraction with addition |
| SURVIVED | PrivateTableService.java:165 | endTurn | removed conditional - replaced equality check with false |
| TIMED_OUT | PrivateTableService.java:179 | endTurn | removed conditional - replaced comparison check with false |
| SURVIVED | PrivateTableService.java:179 | endTurn | removed conditional - replaced comparison check with true |
| SURVIVED | PrivateTableService.java:235 | fire | Replaced integer addition with subtraction |
| SURVIVED | PrivateTableService.java:224 | fire | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:299 | game | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:297 | game | removed call to fr/tikigaming/games/bang/engine/PrivateTableService::purgeInactive |
| NO_COVERAGE | PrivateTableService.java:201 | lambda$discard$1 | replaced return value with null for fr/tikigaming/games/bang/engine/PrivateTableService::lambda$discard$1 |
| SURVIVED | PrivateTableService.java:284 | seatedGame | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:286 | seatedGame | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:287 | seatedGame | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:290 | seatedGame | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:283 | seatedGame | removed call to fr/tikigaming/games/bang/engine/PrivateTableService::purgeInactive |
| SURVIVED | PrivateTableService.java:90 | start | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:92 | start | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:89 | start | removed call to fr/tikigaming/games/bang/engine/PrivateTableService::purgeInactive |
| SURVIVED | PrivateTableService.java:108 | state | removed conditional - replaced equality check with false |
| SURVIVED | PrivateTableService.java:107 | state | removed call to fr/tikigaming/games/bang/engine/PrivateTableService::purgeInactive |
| SURVIVED | InitialDeal.java:45 | deal | removed conditional - replaced equality check with false |
| SURVIVED | InitialDeal.java:45 | deal | removed conditional - replaced equality check with true |

## Stryker

Rapports : `quality/reports/bang/stryker-after/mutation.html` et `mutation.json`. L’identifiant est celui du JSON, stable entre les campagnes car le code muté n’a pas changé. Les timeouts restent distincts des échecs d’assertion : les boucles de mélange/pioche peuvent ne plus terminer, et des mutations de défausse font boucler un parcours de composant. Le test direct de défausse échoue immédiatement sur le mutant de conservation de la main, mais Stryker conserve ici un classement en timeout en exécutant d’abord un autre test couvrant.

| ID | État | Source | Mutateur | Remplacement |
| --- | --- | --- | --- | --- |
| 110 | NoCoverage | local.ts:98 | StringLiteral | "" |
| 139 | NoCoverage | local.ts:109 | StringLiteral | `` |
| 169 | NoCoverage | local.ts:120 | StringLiteral | "" |
| 178 | NoCoverage | local.ts:122 | StringLiteral | "" |
| 218 | NoCoverage | local.ts:136 | StringLiteral | "" |
| 235 | NoCoverage | local.ts:138 | StringLiteral | "" |
| 6 | Timeout | local.ts:31 | UpdateOperator | i++ |
| 4 | Survived | local.ts:31 | EqualityOperator | i >= 0 |
| 16 | Survived | local.ts:40 | ArithmeticOperator | i - 1 |
| 22 | Survived | local.ts:41 | ArithmeticOperator | i - 1 |
| 28 | Survived | local.ts:47 | StringLiteral | "" |
| 29 | Survived | local.ts:47 | StringLiteral | "" |
| 30 | Survived | local.ts:47 | StringLiteral | "" |
| 42 | Survived | local.ts:57 | ConditionalExpression | true |
| 89 | Timeout | local.ts:81 | UpdateOperator | index-- |
| 104 | Survived | local.ts:97 | StringLiteral | "" |
| 117 | Survived | local.ts:104 | StringLiteral | "" |
| 123 | Survived | local.ts:105 | StringLiteral | "" |
| 158 | Survived | local.ts:117 | StringLiteral | "" |
| 180 | Timeout | local.ts:125 | ObjectLiteral | {} |
| 181 | Timeout | local.ts:125 | MethodExpression | player.hand |
| 183 | Timeout | local.ts:125 | ConditionalExpression | true |
| 189 | Survived | local.ts:132 | ConditionalExpression | false |
| 195 | Survived | local.ts:132 | StringLiteral | "" |
| 190 | Survived | local.ts:132 | LogicalOperator | game.phase !== 'PLAY' && game.pendingShot |
| 191 | Survived | local.ts:132 | ConditionalExpression | false |
| 208 | Survived | local.ts:135 | ConditionalExpression | true |
| 210 | Survived | local.ts:135 | LogicalOperator | c.id === cardId \|\| canUseAs(shooter.character, c.type, 'BANG') |
| 211 | Survived | local.ts:135 | ConditionalExpression | true |
| 216 | Survived | local.ts:136 | ConditionalExpression | false |
| 225 | Survived | local.ts:137 | ConditionalExpression | true |
| 226 | Survived | local.ts:137 | EqualityOperator | p.health >= 0 |
| 230 | Survived | local.ts:138 | LogicalOperator | !target && targetSeat === shooter.seat |
| 229 | Survived | local.ts:138 | ConditionalExpression | false |
| 232 | Survived | local.ts:138 | ConditionalExpression | false |
| 288 | Survived | local.ts:165 | ConditionalExpression | true |
| 295 | Survived | local.ts:168 | ConditionalExpression | true |
| 306 | Survived | local.ts:171 | ConditionalExpression | true |
| 316 | Survived | local.ts:176 | ConditionalExpression | true |
| 332 | Survived | local.ts:187 | StringLiteral | "" |
| 335 | Survived | local.ts:196 | MethodExpression | p.character.toLowerCase() |
| 345 | NoCoverage | OnlineTable.tsx:9 | StringLiteral | "" |
| 517 | NoCoverage | OnlineTable.tsx:163 | BlockStatement | {} |
| 518 | NoCoverage | OnlineTable.tsx:164 | CallExpression | ; |
| 519 | NoCoverage | OnlineTable.tsx:165 | StringLiteral | "" |
| 520 | NoCoverage | OnlineTable.tsx:165 | ArrowFunction | () => undefined |
| 350 | Survived | OnlineTable.tsx:17 | BlockStatement | {} |
| 374 | Survived | OnlineTable.tsx:51 | ConditionalExpression | true |
| 376 | Survived | OnlineTable.tsx:51 | LogicalOperator | err instanceof ApiError \|\| [401, 403, 404].includes(err.status) |
| 379 | Survived | OnlineTable.tsx:53 | CallExpression | ; |
| 413 | Survived | OnlineTable.tsx:82 | OptionalChaining | view.phase |
| 419 | Survived | OnlineTable.tsx:83 | OptionalChaining | view.players.find(player => player.seat === view.seat).health |
| 421 | Survived | OnlineTable.tsx:83 | ConditionalExpression | true |
| 435 | Survived | OnlineTable.tsx:88 | ConditionalExpression | true |
| 440 | Survived | OnlineTable.tsx:90 | ConditionalExpression | true |
| 441 | Survived | OnlineTable.tsx:90 | EqualityOperator | appliedRead.current >= sending.current.afterRead |
| 459 | Survived | OnlineTable.tsx:104 | OptionalChaining | current.phase |
| 460 | Survived | OnlineTable.tsx:104 | OptionalChaining | view.phase |
| 461 | Survived | OnlineTable.tsx:104 | ConditionalExpression | true |
| 463 | Survived | OnlineTable.tsx:104 | OptionalChaining | current.currentSeat |
| 464 | Survived | OnlineTable.tsx:104 | OptionalChaining | view.currentSeat |
| 482 | Survived | OnlineTable.tsx:119 | ConditionalExpression | true |
| 484 | Survived | OnlineTable.tsx:120 | ConditionalExpression | true |
| 486 | Survived | OnlineTable.tsx:121 | ConditionalExpression | true |
| 515 | Survived | OnlineTable.tsx:159 | StringLiteral | "" |
| 529 | Survived | OnlineTable.tsx:182 | StringLiteral | "" |
| 530 | Survived | OnlineTable.tsx:182 | ArrowFunction | () => undefined |
| 521 | Survived | OnlineTable.tsx:170 | ArrowFunction | () => undefined |
| 546 | Survived | OnlineTable.tsx:194 | StringLiteral | `` |
| 549 | Survived | OnlineTable.tsx:197 | StringLiteral | `` |
| 552 | Survived | OnlineTable.tsx:199 | StringLiteral | `` |
| 351 | Survived | OnlineTable.tsx:21 | StringLiteral | "Stryker was here!" |
| 352 | Survived | OnlineTable.tsx:27 | ObjectLiteral | {} |
| 353 | Survived | OnlineTable.tsx:27 | StringLiteral | "Stryker was here!" |
| 393 | Survived | OnlineTable.tsx:67 | ArrayDeclaration | [] |
| 525 | Survived | OnlineTable.tsx:176 | ConditionalExpression | true |
| 526 | Survived | OnlineTable.tsx:176 | LogicalOperator | code \|\| !view |
