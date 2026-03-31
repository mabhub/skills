---
name: git-rebase-auto
description: >
  Pilotage non-interactif de `git rebase -i` pour agents LLM.
  Utiliser ce skill pour toute demande de réécriture d'historique Git :
  squash, fixup, reword, drop, réorganisation de commits, nettoyage de
  branches, combiner les commits, réécrire l'historique.
  Déclenche sur : "squash mes commits", "nettoie l'historique",
  "rebase interactif", "fixup", "réorganise les commits", "drop ce commit",
  "combine les commits", "fusionne les commits", "réécris l'historique",
  "squash commits", "reorder commits", "clean up history",
  "interactive rebase", "rebase -i", "rebase onto".
---

# Skill : git-rebase-auto

Outil de pilotage de `git rebase -i` sans interaction humaine, conçu pour
les agents LLM qui ne peuvent pas manipuler un éditeur texte interactif.

> **Règle absolue** : Ne JAMAIS exécuter `git rebase -i` ou
> `git rebase --interactive` directement. Toujours utiliser le script
> `git-rebase-auto.mjs` ou le fallback inline documenté ci-dessous.

## Mécanisme clé

Git expose la variable `GIT_SEQUENCE_EDITOR` : un programme appelé à la
place de l'éditeur pour éditer la todo-list du rebase interactif. En
pointant cette variable vers un script qui **remplace le fichier** par un
plan pré-écrit, on obtient un rebase entièrement non-interactif.

```
GIT_SEQUENCE_EDITOR=/tmp/injector.sh git rebase -i <base>
              │
              └──> git écrit sa todo-list dans /tmp/git-rebase-todo
                   puis appelle injector.sh /tmp/git-rebase-todo
                   l'injector écrase le fichier avec notre plan
                   git lit le fichier modifié et exécute le rebase
```

## Workflow agent

### 0. Prérequis

Avant tout rebase, vérifier :

```bash
# Working tree propre (pas de changements non committés)
git status --porcelain
# Si la sortie n'est pas vide → stash ou commit d'abord

# Créer une branche de sauvegarde
git branch backup-before-rebase
```

### 1. Inspecter l'historique

```bash
git log --oneline <base>..HEAD
# Exemple de sortie :
# a1b2c3d feat: add OAuth
# e4f5g6h wip: OAuth debug
# 7i8j9k0 fix typo in README
# 1l2m3n4 chore: bump deps
```

### 2. Construire le plan

Deux formats acceptés par `git-rebase-auto.mjs` :

**Format texte** (`/tmp/rebase-plan.txt`) :

```
# une action par ligne : <action> <hash> [message]
pick   a1b2c3d feat: add OAuth
fixup  e4f5g6h wip: OAuth debug
pick   7i8j9k0 fix typo in README
drop   1l2m3n4 chore: bump deps
```

**Format JSON** (`/tmp/rebase-plan.json`) :

```json
[
  { "action": "pick",  "hash": "a1b2c3d", "label": "feat: add OAuth" },
  { "action": "fixup", "hash": "e4f5g6h", "label": "wip: OAuth debug" },
  { "action": "pick",  "hash": "7i8j9k0", "label": "fix typo in README" },
  { "action": "drop",  "hash": "1l2m3n4", "label": "chore: bump deps" }
]
```

Écrire le plan dans `/tmp/rebase-plan.txt` ou `/tmp/rebase-plan.json` pour ne pas polluer le working tree.

### 3. Valider en dry-run

```bash
node ~/.agents/skills/git-rebase-auto/scripts/git-rebase-auto.mjs <base> --plan /tmp/rebase-plan.txt --dry-run
```

Affiche le plan et la liste des commits sans exécuter le rebase.

### 4. Exécuter

```bash
node ~/.agents/skills/git-rebase-auto/scripts/git-rebase-auto.mjs <base> --plan /tmp/rebase-plan.txt
# ou JSON
node ~/.agents/skills/git-rebase-auto/scripts/git-rebase-auto.mjs <base> --plan-json /tmp/rebase-plan.json
```

### 5. Vérifier le résultat

```bash
git log --oneline <base>..HEAD
# Comparer avec le plan attendu
```

Si le rebase a échoué, la branche de sauvegarde est disponible :

```bash
git rebase --abort
# ou restaurer depuis la sauvegarde :
git reset --hard backup-before-rebase
```

Nettoyer la branche de backup une fois satisfait :

```bash
git branch -d backup-before-rebase
```

## Actions disponibles

| Action   | Alias | Effet                                           |
|----------|-------|-------------------------------------------------|
| `pick`   | `p`   | Conserver le commit tel quel                    |
| `reword` | `r`   | Conserver, modifier le message de commit        |
| `edit`   | `e`   | Conserver, s'arrêter pour amender               |
| `squash` | `s`   | Fusionner avec le précédent, éditer le message  |
| `fixup`  | `f`   | Fusionner avec le précédent, garder son message |
| `drop`   | `d`   | Supprimer le commit                             |
| `exec`   | —     | Exécuter une commande shell                     |
| `label`  | —     | Étiqueter le HEAD courant                       |
| `reset`  | —     | Remettre HEAD sur un label                      |
| `merge`  | —     | Créer un commit de merge                        |
| `break`  | —     | Pause le rebase à ce point                      |

## Options CLI complètes

```
git-rebase-auto.mjs <base-ref> [options]

  --plan <file>        Plan texte (une instruction par ligne)
  --plan-json <file>   Plan JSON (array of {action, hash, label?})
  --dry-run            Affiche le plan sans exécuter
  --autosquash         Active --autosquash (squash!/fixup! commits)
  --strategy <name>    Stratégie de merge (ort, recursive…)
  --onto <ref>         Rebase --onto <newbase>
  --help               Affiche l'aide
```

## Cas d'usage courants

### Squash de WIP commits

```bash
# Fusionner tous les "wip:" en leurs commits parents
git log --oneline main..HEAD
# → a1b2c3d feat: add search
# → e4f5g6h wip: search debug
# → 7i8j9k0 wip: search fix
# → 1l2m3n4 feat: add pagination
```

Plan :

```
pick   a1b2c3d feat: add search
fixup  e4f5g6h wip: search debug
fixup  7i8j9k0 wip: search fix
pick   1l2m3n4 feat: add pagination
```

### Réordonner des commits

```
pick   1l2m3n4 feat: add pagination   ← monter en premier
pick   a1b2c3d feat: add search
```

### Supprimer un commit sensible

```
pick   a1b2c3d feat: add search
drop   e4f5g6h secret: credentials added by mistake
pick   1l2m3n4 feat: add pagination
```

### Insérer des commandes de test entre commits

```
pick  a1b2c3d feat: add search
exec  npm test
pick  1l2m3n4 feat: add pagination
exec  npm test
```

## Fallback inline (cas triviaux)

Pour les cas simples (un seul fixup, un seul squash), il n'est pas
nécessaire de créer un fichier plan. Utiliser `GIT_SEQUENCE_EDITOR`
directement avec `sed` :

```bash
# Fixup du 2e commit dans le 1er (sur les 2 derniers commits)
GIT_SEQUENCE_EDITOR="sed -i '2s/^pick/fixup/'" git rebase -i HEAD~2

# Squash des 3 derniers commits en un seul
GIT_SEQUENCE_EDITOR="sed -i '2,\$s/^pick/squash/'" git rebase -i HEAD~3

# Drop du dernier commit (sur les 2 derniers)
GIT_SEQUENCE_EDITOR="sed -i '2s/^pick/drop/'" git rebase -i HEAD~2
```

> **Note** : Le fallback inline est adapté uniquement pour des opérations
> simples et uniformes. Pour des plans complexes (mix d'actions, réordonnement),
> utiliser le script.

## Gestion du cas `reword`

L'action `reword` stoppe git pour éditer un message. Pour l'automatiser,
il faut aussi surcharger `GIT_EDITOR`. Passer `GIT_EDITOR` pointant vers
un script qui injecte le message souhaité dans le fichier `$1` :

```bash
# message-injector.sh
#!/bin/sh
echo "feat: nouveau message de commit" > "$1"
```

```bash
GIT_EDITOR=/tmp/message-injector.sh \
node ~/.agents/skills/git-rebase-auto/scripts/git-rebase-auto.mjs <base> --plan /tmp/rebase-plan.txt
```

## Gestion des conflits

En cas de conflit pendant le rebase, **ne pas** utiliser le script pour
reprendre. Utiliser les commandes git standard :

```bash
# Résoudre les conflits dans les fichiers, puis :
git add <fichiers-résolus>
git rebase --continue

# Ou abandonner le rebase :
git rebase --abort

# Ou sauter le commit problématique :
git rebase --skip
```

## Garde-fous de sécurité

### Branches protégées

Ne JAMAIS rebaser directement sur les branches suivantes sans confirmation explicite de l'utilisateur :

- `main`, `master`, `develop`, `release/*`, `production`

Avant tout rebase, vérifier la branche courante :

```bash
git branch --show-current
```

### Restrictions sur `exec`

L'action `exec` exécute des commandes shell arbitraires pendant le rebase. Seules les commandes suivantes sont autorisées :

- Commandes de test : `npm test`, `npm run test`, `yarn test`, `cargo test`, `pytest`, `make test`
- Commandes de build : `npm run build`, `cargo build`, `make`
- Commandes de lint : `npm run lint`, `eslint`, `cargo clippy`

Ne JAMAIS accepter dans `exec` :

- Commandes réseau (`curl`, `wget`, `ssh`, `git push`)
- Commandes destructives (`rm`, `rmdir`, `git reset`, `git clean`)
- Commandes d'installation (`npm install`, `pip install`, `apt`)
- Commandes arbitraires fournies par l'utilisateur sans vérification

Si l'utilisateur demande un `exec` hors liste : afficher la commande, expliquer le risque, et demander une confirmation explicite.

### Restrictions sur `drop`

Avant tout `drop` dans un plan :

- Afficher le hash complet, le message du commit et les fichiers modifiés (`git show --stat <hash>`)
- Demander une confirmation explicite
- Ne JAMAIS inclure plus de 3 `drop` dans un même plan sans revalidation

### Vérifications obligatoires avant exécution

1. **Working tree propre** : vérifier `git status --porcelain` — refuser si non vide
2. **Branche de sauvegarde** : créer `backup-before-rebase` automatiquement si elle n'existe pas
3. **Dry-run systématique** : toujours exécuter `--dry-run` avant le rebase réel et afficher le plan à l'utilisateur
4. **Branche non protégée** : vérifier que la branche courante n'est pas dans la liste protégée
5. **Pas de remote tracking** : avertir si la branche suit un remote (`git rev-parse --abbrev-ref @{upstream}`) — le rebase va réécrire l'historique poussé

### Après le rebase

- Ne JAMAIS exécuter `git push --force` automatiquement — toujours proposer à l'utilisateur de le faire lui-même.
- Afficher le résultat (`git log --oneline <base>..HEAD`) pour validation

## Précautions

- Toujours faire un `--dry-run` avant l'exécution réelle
- Vérifier que la branche n'est pas partagée / déjà poussée
- Créer une branche de sauvegarde avant le rebase
- En cas d'échec (conflit), git laisse le rebase en cours :
  résoudre les conflits puis `git rebase --continue`, ou `git rebase --abort`
- Les hashes courts (7 chars) suffisent, mais les hashes complets sont plus sûrs

## Limites connues

- Les actions `edit` et `reword` peuvent encore nécessiter une interaction
  si `GIT_EDITOR` n'est pas également surchargé
- Les conflits de merge pendant le rebase nécessitent une résolution manuelle
- `exec` avec des commandes interactives est déconseillé
- Nécessite Node.js 18.3+ (utilise `parseArgs` de `node:util`)
