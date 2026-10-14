# Ouvrir et clore un chantier

À lire à l'ouverture d'un chantier et au moment de le clore, pas à chaque session : une
reprise n'en a pas besoin.

## Le dossier `.pilotage/`

```
.pilotage/
├── INDEX.md                  # une ligne par chantier → seul fichier lu d'office
└── <chantier>/               # slug : minuscules, chiffres, tirets
    ├── plan.md               # objectif, macro-plan, « où on en est », ce qui est en vigueur
    ├── journal.md            # ajout en fin seulement, lu par la fin
    ├── connaissances.md      # ce qui est établi, par thème, avec confiance et sources
    ├── decisions/NNN-*.md    # décisions qui méritent leur contexte et leurs options comparées
    └── …                     # fichiers complémentaires, selon les besoins du chantier
```

- `init` crée le dossier et ajoute `/.pilotage/` au fichier `info/exclude` du dépôt
  (via `git rev-parse --git-path`, donc correct aussi dans un worktree). Hors dépôt
  git, rien à exclure.
- **Mémoire** : au premier `init` d'un projet, enregistrer une mémoire projet d'une
  ligne qui pointe vers `.pilotage/INDEX.md` et `/pilotage reprise`. Rien d'autre :
  la mémoire est rechargée à chaque session, son contenu se paie à chaque tour.

## Ouvrir un chantier

Pour une tâche de plusieurs étapes ou qui s'étalera sur plusieurs sessions :

1. `pilotage.mjs init --chantier <slug> --titre "<titre>"` : crée `plan.md`,
   `journal.md` et `connaissances.md`.
2. Lire `references/formats.md` si ce n'est pas déjà fait dans la session.
3. Remplir `plan.md` : objectif, critère de fin (une commande et son résultat attendu
   quand c'est possible), macro-plan en étapes vérifiables. S'il existe déjà une spec
   ou un plan détaillé, y renvoyer sans le recopier. Faire valider le macro-plan par
   l'utilisateur ; ses consignes vont en `[directive D1]`, `[directive D2]`…
4. Ajouter la ligne du chantier dans `INDEX.md` (section « Actifs »).
5. Si c'est le premier chantier du projet, créer le pointeur mémoire (voir plus haut).

Une tâche de deux ou trois tours n'a pas besoin de chantier. Le coût du suivi doit
rester inférieur à ce qu'il fait gagner.

## Clore un chantier

1. **Proposer un contrôle de convergence** (l'utilisateur peut le décliner). Il
   confronte l'intention à l'état réel, sans se fier aux cases cochées : une case
   cochée est une affirmation, pas une preuve. Sources d'intention : objectif, critère
   de fin, chaque étape du macro-plan, « En vigueur », et la spec citée dans
   « Repères » s'il y en a une. Pour chaque écart, une ligne classée :
   - `manque` : demandé, absent ;
   - `partiel` : présent, mais ne satisfait pas entièrement la demande ;
   - `contredit` : fait autrement que ce qui est demandé ou en vigueur ;
   - `non demandé` : fait sans avoir été demandé (à justifier ou à retirer, jamais
     supprimé d'office).

   Vérifier aussi « Hors dépôt » : ressources temporaires retirées (droits accordés,
   services de test, fichiers remplacés), retour arrière encore possible pour ce qui
   reste. Lancer le critère de fin.

   Présenter les écarts à l'utilisateur, sans rien corriger. Chacun devient une
   nouvelle étape du plan, une ligne de « Reporté volontairement », ou est accepté tel
   quel (`[décision·utilisateur]`). S'il reste des étapes, le chantier n'est pas clos.
   Sans écart, le noter au journal (« convergence : aucun écart, critère de fin OK »).
   Borner la vérification à ce que le suivi désigne : ne pas auditer tout le projet.
2. Dernière entrée de journal : résultat, ce qui reste hors périmètre.
3. Dans `INDEX.md`, déplacer la ligne vers « Clos » avec le résultat en une phrase.
4. Garder les fichiers : ils ne coûtent rien tant qu'on ne les lit pas. Ne rien
   supprimer sans demande explicite.
