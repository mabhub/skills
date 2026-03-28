---
name: glab-cli
description: |
  Primary tool for interacting with GitLab from the command line using glab CLI.
  Use this skill FIRST for any GitLab operation: merge requests, issues/tickets,
  CI/CD pipelines, jobs, labels, releases, snippets, and repository information.
  Triggers on: "merge request", "MR", "pipeline", "CI/CD", "glab", "gitlab issue",
  "ticket", "gitlab", or when git remote contains "gitlab". Fall back to gitlab-api
  skill only when glab cannot accomplish the task (e.g., GraphQL introspection,
  creating issues linked to MR discussions, session cookie auth).
---

# glab CLI - Interface principale GitLab

Utiliser `glab` comme outil **principal** pour toutes les opérations GitLab. Ne basculer vers le skill `gitlab-api` que lorsque glab ne peut pas accomplir la tâche.

## Vérification de l'environnement

**Test fonctionnel d'authentification** : préférer un appel concret plutôt que `glab auth status` qui peut signaler "Invalid token provided" sur des instances pourtant fonctionnelles (faux positif connu, voir gitlab-org/cli#926) :

```bash
glab repo view --output json
```

Si glab n'est pas installé ou que l'appel API échoue : **STOP**.  
Informer l'utilisateur, lui demander de s'identifier (`glab auth login`), ou basculer vers le skill `gitlab-api` avec PAT.

## Règles critiques

1. **JAMAIS de commandes interactives/TUI** : `glab ci view` ouvre un TUI. Utiliser `glab ci status` à la place.
2. **Toujours utiliser `--fill --yes`** pour `glab mr create` afin d'éviter les prompts interactifs.
3. **Préfixer `NO_PROMPT=1`** pour désactiver tout prompt restant : `NO_PROMPT=1 glab mr create --fill --yes`.
4. **Utiliser `--output json`** quand le résultat doit être parsé ou traité.
5. **Confirmation obligatoire** avant toute opération d'écriture
   - Afficher le contenu/la commande complète à l'utilisateur
   - Attendre l'approbation explicite avant d'exécuter
6. **Ne jamais utiliser `-F` (follow)** ni les flags de streaming qui bloquent indéfiniment.
7. **Détection automatique du contexte** : glab détecte le host et le projet via le remote git.  
   Toujours essayer la commande sans `-R` ni `GITLAB_HOST` d'abord.  
   Ne les spécifier qu'en seconde intention si la détection échoue.

## Référence rapide

### Merge Requests

| Opération                    | Commande                                               |
|------------------------------|--------------------------------------------------------|
| Lister les MR ouvertes       | `glab mr list`                                         |
| Lister mes MR                | `glab mr list --author=@me`                            |
| Créer une MR                 | `NO_PROMPT=1 glab mr create --fill --yes`              |
| Créer une MR (brouillon)     | `NO_PROMPT=1 glab mr create --fill --yes --draft`      |
| Créer une MR (branche cible) | `NO_PROMPT=1 glab mr create --fill --yes -b <branche>` |
| Voir les détails d'une MR    | `glab mr view <iid>`                                   |
| Voir une MR en JSON          | `glab mr view <iid> --output json`                     |
| Voir le diff d'une MR        | `glab mr diff <iid>`                                   |
| Checkout la branche d'une MR | `glab mr checkout <iid>`                               |
| Approuver une MR             | `glab mr approve <iid>`                                |
| Merger une MR                | `glab mr merge <iid> --yes`                            |
| Ajouter un commentaire       | `glab mr note <iid> -m "commentaire"`                  |
| Marquer comme prête          | `glab mr update <iid> --ready`                         |
| Ajouter des labels           | `glab mr update <iid> --label "bug,urgent"`            |
| Lister les commentaires      | `glab mr view <iid> --comments`                        |

### Issues

| Opération                  | Commande                                        |
|----------------------------|-------------------------------------------------|
| Lister les issues ouvertes | `glab issue list`                               |
| Lister par label           | `glab issue list -l "bug"`                      |
| Créer une issue            | `glab issue create -t "Titre" -d "Description"` |
| Voir une issue             | `glab issue view <iid>`                         |
| Fermer une issue           | `glab issue close <iid>`                        |
| Ajouter un commentaire     | `glab issue note <iid> -m "commentaire"`        |

### Pipelines & Jobs CI/CD

| Opération                   | Commande                                         |
|-----------------------------|--------------------------------------------------|
| Statut du pipeline          | `glab ci status`                                 |
| Lister les pipelines        | `glab ci list`                                   |
| Voir la trace d'un job      | `glab ci trace <job-id>`                         |
| Relancer un pipeline échoué | `glab ci retry <pipeline-id>`                    |
| Valider la config CI        | `glab ci lint`                                   |
| Lancer un pipeline          | `glab ci run`                                    |
| Lancer avec variables       | `glab ci run -b <branche> --variables KEY1:val1` |
| Télécharger les artifacts   | `glab ci artifact <job-id>`                      |

### Dépôt

| Opération               | Commande                       |
|-------------------------|--------------------------------|
| Voir les infos du dépôt | `glab repo view`               |
| Cloner un dépôt         | `glab repo clone <owner/repo>` |
| Forker un dépôt         | `glab repo fork`               |

### Releases & Variables

| Opération               | Commande                                          |
|-------------------------|---------------------------------------------------|
| Lister les releases     | `glab release list`                               |
| Créer une release       | `glab release create <tag> -n "Notes de release"` |
| Lister les variables CI | `glab variable list`                              |
| Définir une variable CI | `glab variable set KEY value`                     |

## Travailler hors contexte de dépôt

**Règle : toujours essayer la commande simple d'abord.** glab détecte automatiquement le host et le projet via le remote git configuré. Ne spécifier `-R` ou `GITLAB_HOST` qu'en seconde intention, si la détection automatique échoue.

```bash
# 1. D'abord : commande simple (glab détecte le contexte via git remote)
glab mr list

# 2. Seulement si ça échoue ou si on est hors d'un dépôt git :
glab mr list -R owner/repo
glab issue list -R group/namespace/repo

# 3. Instance self-hosted (seulement si le remote ne suffit pas) :
GITLAB_HOST=gitlab.example.com glab mr list -R owner/repo
# Ou s'authentifier de manière permanente :
glab auth login --hostname gitlab.example.com
```

## API brute via glab

Pour les endpoints sans sous-commande dédiée, utiliser `glab api` :

```bash
# API REST
glab api /projects/:id/members
glab api /projects/:id/jobs?per_page=100

# POST avec données
glab api /projects/:id/issues -X POST -f title="Nouvelle issue" -f description="Détails"

# GraphQL
glab api graphql -f query='{ project(fullPath: "group/repo") { name webUrl } }'

# Pagination automatique (REST uniquement, per_page dans l'URL pas en flag)
glab api /projects/:id/issues --paginate
```

**Note** : les paramètres de pagination se placent dans l'URL : `/projects/:id/jobs?per_page=100`, pas en flag séparé.

## Pièges courants

| Piège                          | Problème                       | Solution                                                     |
|--------------------------------|--------------------------------|--------------------------------------------------------------|
| `glab ci view`                 | Ouvre un TUI interactif        | Utiliser `glab ci status`                                    |
| `glab mr create` sans `--fill` | Ouvre un éditeur interactif    | Toujours ajouter `--fill --yes`                              |
| Sortie brute de `glab mr view` | Rend le Markdown avec glamour  | Ajouter `--output json` pour du parseable                    |
| `glab ci trace`                | Streame en temps réel          | Définir un timeout ou utiliser `--output json` si disponible |
| `glab mr merge` sans `--yes`   | Demande confirmation           | Toujours ajouter `--yes`                                     |
| Pagination dans `glab api`     | `--per-page` n'est pas un flag | Utiliser les params dans l'URL : `?per_page=100`             |
| `-R`/`GITLAB_HOST` systématique | glab détecte le contexte via git remote | Essayer la commande simple d'abord, `-R` seulement en fallback |

## Exemples de workflows

### De la branche au merge

```bash
# 1. Créer et pousser la branche
git checkout -b feature/mon-changement
# ... modifications, commit ...
git push -u origin feature/mon-changement

# 2. Créer la MR
NO_PROMPT=1 glab mr create --fill --yes --draft

# 3. Vérifier le statut CI
glab ci status

# 4. Quand la CI passe et la review est terminée, marquer prête et merger
glab mr update <iid> --ready
glab mr merge <iid> --yes
```

### Remédiation d'un échec CI

```bash
# 1. Vérifier le statut du pipeline
glab ci status

# 2. Lister les pipelines récents pour trouver celui en échec
glab ci list

# 3. Voir la trace du job en échec
glab ci trace <job-id>

# 4. Après correction locale, pousser et relancer
git push
glab ci retry <pipeline-id>
```

## Quand basculer vers gitlab-api

Utiliser le skill `gitlab-api` au lieu de glab quand :

1. **Issues liées à des discussions MR** : le paramètre `merge_request_to_resolve_discussions_of` n'est disponible que via l'API REST
2. **Requêtes GraphQL complexes** : champs imbriqués (discussions, positions, notes) nécessitant des formes de requête personnalisées
3. **Authentification par session cookie** : quand on utilise le cookie `_gitlab_session` au lieu d'un PAT
4. **Opérations bulk avec pagination fine** : quand on a besoin d'un contrôle précis sur les headers de pagination (`X-Total-Pages`, `X-Next-Page`)
5. **Introspection GraphQL** : exploration du schéma via les requêtes `__schema`
6. **glab indisponible ou non authentifié** : quand la vérification d'environnement échoue
