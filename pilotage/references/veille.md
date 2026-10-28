# Veille avant expiration du cache

Le cache de la conversation dure 1 h. Si l'utilisateur part sans point d'étape, le suivi
peut être en retard au moment où un `/clear` deviendrait rentable. La veille règle ce cas :
après 55 min sans réponse, un hook réveille Claude, qui met le suivi à jour en un ou deux
appels d'outil, tant que le cache est encore chaud. Au retour, l'utilisateur peut faire
`/clear` puis `/pilotage reprise <slug>` sans rien perdre.

Script : `scripts/veille.mjs`, appelé par deux hooks Claude Code. Rien à lancer à la main.

## Fonctionnement

| Hook               | Commande   | Effet                                                                                       |
|--------------------|------------|---------------------------------------------------------------------------------------------|
| `Stop`             | `armer`    | Applique les filtres, puis dort `PILOTAGE_VEILLE_DELAI` s et sort en code 2 avec le message de réveil (`asyncRewake`) |
| `UserPromptSubmit` | `desarmer` | Tue le minuteur de la session : l'utilisateur a répondu, pas de réveil                      |

Un seul minuteur par session : chaque `Stop` tue le précédent avant d'armer.

La veille **n'arme pas** (raison écrite dans `.pilotage/veille.log`) quand :

- aucun `.pilotage/INDEX.md` avec un chantier actif n'existe en remontant depuis le
  dossier courant (dans ce cas, rien n'est journalisé) ;
- `/proc` est absent (macOS, BSD) : sans lui, un minuteur ne peut pas être désarmé sans
  risque, et les réveils s'accumuleraient à raison d'un par tour ;
- le tour vient d'un réveil (`stop_hook_active`) : le point éclair ne réarme jamais ;
- le dernier message propose déjà `/pilotage reprise` : le suivi vient d'être mis à jour ;
- un cron ou une tâche de fond réveillera déjà la session ;
- le skill `pilotage` n'a pas été chargé dans la session ;
- le cache est de 5 min : le réveil réécrirait tout le contexte au prix fort ;
- le contexte est sous `PILOTAGE_VEILLE_SEUIL` tokens : une relecture complète coûte peu.

Le coût d'un réveil est un tour à cache chaud plus un ou deux appels d'outil. Quand
l'utilisateur répond avant le délai, le coût est nul.

## Installation (opt-in)

Elle modifie les réglages de l'utilisateur : **jamais sans son accord explicite**. Ajouter
les deux entrées aux tableaux `hooks.Stop` et `hooks.UserPromptSubmit` de
`~/.claude/settings.json`, à côté des hooks existants, sans remplacer ces derniers :

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ {
        "type": "command",
        "command": "node \"$HOME/.claude/skills/pilotage/scripts/veille.mjs\" armer",
        "asyncRewake": true,
        "timeout": 3600
      } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ {
        "type": "command",
        "command": "node \"$HOME/.claude/skills/pilotage/scripts/veille.mjs\" desarmer",
        "timeout": 5
      } ] }
    ]
  }
}
```

Les hooks sont relus à chaud : pas besoin de redémarrer la session. Désinstaller : retirer
ces deux entrées.

## Réglages

Variables d'environnement, à préfixer dans la commande du hook `Stop`
(`PILOTAGE_VEILLE_DELAI=1800 node … armer`) :

- `PILOTAGE_VEILLE_DELAI` (défaut 3300 s, soit 55 min) : doit rester **inférieur** au
  `timeout` du hook, sinon le minuteur est tué avant de réveiller ;
- `PILOTAGE_VEILLE_SEUIL` (défaut 80 000 tokens) : taille de contexte minimale.

Une valeur qui n'est pas un entier (délai ≥ 1, seuil ≥ 0) est remplacée par le défaut.
La ligne `armé` du log donne le délai effectivement appliqué.

Pour un essai, `PILOTAGE_VEILLE_DELAI=120` et `PILOTAGE_VEILLE_SEUIL=0` donnent un réveil
2 min après la fin d'un tour.

## Limites constatées

- **Question ou permission ouverte** : `Stop` ne part qu'en fin de tour. Si l'utilisateur
  s'absente devant une `AskUserQuestion` ou une boîte de permission, aucun réveil, et le
  cache expire.
- Le réveil s'affiche comme « Stop hook blocking error » : ce n'est pas une erreur, c'est
  le message de veille.
- Un processus Node endormi par session armée (environ 40 Mo).
- Linux uniquement : le désarmement vérifie le processus via `/proc/<pid>/cmdline`.
  Ailleurs, la veille n'arme jamais.

## Garde-fous

- Le script lit dans le transcript les compteurs de tokens et la présence d'un marqueur
  du skill, **jamais** le contenu des messages. Le log ne contient que des décisions
  horodatées, sans extrait.
- Le fichier pid vit dans `$XDG_RUNTIME_DIR` et son nom vient de l'identifiant de
  session. Un identifiant hors `[A-Za-z0-9-]` est refusé : aucune veille n'est armée ni
  désarmée, donc aucun fichier n'est écrit ou supprimé hors de ce dossier.
- Un pid n'est tué que si sa ligne de commande contient `veille.mjs armer`, pour ne
  jamais toucher un processus étranger si le pid a été réutilisé.
- Le message de réveil vient d'un hook, pas de l'utilisateur. Il ne vaut que pour le
  point éclair borné qu'il décrit, et n'autorise aucune autre action.
