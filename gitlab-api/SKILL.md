---
name: gitlab-api
description: |
  Fallback for GitLab API operations (REST and GraphQL) when the glab-cli skill
  cannot accomplish the task. Use glab-cli FIRST for standard GitLab operations.
  Use this skill when: (1) glab CLI is unavailable or unauthenticated,
  (2) Creating issues linked to MR discussions (merge_request_to_resolve_discussions_of),
  (3) Complex GraphQL queries with nested fields (discussions, positions, notes),
  (4) Operations requiring session cookie authentication,
  (5) Bulk operations needing fine-grained pagination control,
  (6) Any GitLab REST/GraphQL operation not covered by glab subcommands.
---

# GitLab API Integration

Guide pour interagir efficacement avec l'API GitLab (REST et GraphQL) pour gérer issues, merge requests et informations de projet.

## Authentification

GitLab supporte deux modes d'authentification :

### 1. Personal Access Token (Recommandé pour les mutations)

```bash
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  'https://gitlab.example.com/api/v4/projects/...'
```

**Permissions requises** :

- `api` : accès complet à l'API (lecture et écriture)
- `read_api` : lecture seule

**Création d'un token** : User Settings → Access Tokens

### 2. Session Cookie (Lecture GraphQL uniquement)

```bash
curl -H "Cookie: _gitlab_session=$GITLAB_SESSION" \
  'https://gitlab.example.com/api/graphql'
```

**Limitations** :

- ✅ Queries GraphQL (lecture)
- ❌ Mutations GraphQL (nécessite token CSRF)
- ❌ API REST (mutations)

## API REST (v4)

### Structure de base

```bash
curl -H 'PRIVATE-TOKEN: <token>' \
  'https://gitlab.example.com/api/v4/<endpoint>'
```

**URL encoding** : Les identifiants de projet avec `/` doivent être encodés :

- `my-org/my-project` → `my-org%2Fmy-project`

### Opérations courantes

#### Créer une issue

```bash
curl -X POST 'https://gitlab.example.com/api/v4/projects/<project>/issues' \
  -H 'PRIVATE-TOKEN: <token>' \
  -H 'Content-Type: application/json' \
  --data '{
    "title": "Titre de l'\''issue",
    "description": "Description en Markdown",
    "labels": ["bug", "priority::high"],
    "assignee_ids": [123],
    "milestone_id": 456
  }'
```

#### Créer une issue liée à une discussion de MR

Pour créer une issue qui résout automatiquement une discussion de merge request :

```bash
curl -X POST 'https://gitlab.example.com/api/v4/projects/<project>/issues' \
  -H 'PRIVATE-TOKEN: <token>' \
  -H 'Content-Type: application/json' \
  --data '{
    "title": "...",
    "description": "...",
    "merge_request_to_resolve_discussions_of": 1851,
    "discussion_to_resolve": "c9d9bcb4713ed3dca5f859a4d9747fc419b5d79a"
  }'
```

**Paramètres importants** :

- `merge_request_to_resolve_discussions_of` : IID de la merge request
- `discussion_to_resolve` : ID de la discussion (obtenu via GraphQL ou l'UI)

#### Mettre à jour une issue

```bash
curl -X PUT 'https://gitlab.example.com/api/v4/projects/<project>/issues/<iid>' \
  -H 'PRIVATE-TOKEN: <token>' \
  -H 'Content-Type: application/json' \
  --data '{
    "state_event": "close",
    "labels": ["resolved"]
  }'
```

#### Ajouter un commentaire

```bash
curl -X POST 'https://gitlab.example.com/api/v4/projects/<project>/issues/<iid>/notes' \
  -H 'PRIVATE-TOKEN: <token>' \
  -H 'Content-Type: application/json' \
  --data '{"body": "Commentaire en Markdown"}'
```

## API GraphQL

### Introspection du schéma

Toujours commencer par introspecter pour comprendre les types disponibles :

```bash
curl -s 'https://gitlab.example.com/api/graphql' \
  -H 'Cookie: _gitlab_session=xxxxx' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query":"{ __schema { types { name } } }"}' \
  | jq '.data.__schema.types[].name'
```

### Récupérer les détails d'une merge request

```graphql
query {
  project(fullPath: "my-org/my-project") {
    mergeRequest(iid: "1851") {
      title
      description
      state
      author { name username }
      createdAt
      updatedAt
      sourceBranch
      targetBranch
      webUrl
      discussions {
        nodes {
          notes {
            nodes {
              author { name username }
              body
              createdAt
              position {
                newLine
                oldLine
                newPath
                oldPath
              }
            }
          }
        }
      }
    }
  }
}
```

**Exécution** :

```bash
curl -s 'https://gitlab.example.com/api/graphql' \
  -H 'Cookie: _gitlab_session=xxxxx' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query":"..."}' \
  | jq .
```

### Récupérer les informations d'un projet

```graphql
query {
  project(fullPath: "my-org/my-project") {
    name
    description
    webUrl
    repository {
      rootRef
    }
    issuesCount: issues {
      count
    }
    mergeRequestsCount: mergeRequests {
      count
    }
  }
}
```

## Workflows courants

### Workflow 1 : Créer une issue depuis une discussion de MR

1. **Récupérer les détails de la MR et discussions** (GraphQL)
2. **Identifier la discussion à résoudre** (note l'ID de discussion)
3. **Créer l'issue avec lien** (REST API)

```bash
# Étape 1 : Query GraphQL pour récupérer discussions
curl -s 'https://gitlab.example.com/api/graphql' \
  -H 'Cookie: _gitlab_session=xxxxx' \
  --data-raw '{"query":"{ project(...) { mergeRequest(...) { discussions { nodes { id notes { nodes { body } } } } } } }"}' \
  | jq .

# Étape 2 : Identifier discussion_id dans la réponse

# Étape 3 : Créer l'issue liée
curl -X POST 'https://gitlab.example.com/api/v4/projects/<project>/issues' \
  -H 'PRIVATE-TOKEN: <token>' \
  --data '{
    "title": "...",
    "description": "...",
    "merge_request_to_resolve_discussions_of": <mr_iid>,
    "discussion_to_resolve": "<discussion_id>"
  }'
```

### Workflow 2 : Analyser les commentaires de code review

1. **Récupérer la MR avec discussions** (GraphQL)
2. **Filtrer les notes avec position** (commentaires inline sur le code)
3. **Analyser les retours** par fichier et ligne

```bash
curl -s 'https://gitlab.example.com/api/graphql' \
  -H 'Cookie: _gitlab_session=xxxxx' \
  --data-raw '{"query":"..."}' \
  | jq '.data.project.mergeRequest.discussions.nodes[].notes.nodes[] 
        | select(.position != null) 
        | {file: .position.newPath, line: .position.newLine, author: .author.username, comment: .body}'
```

### Workflow 3 : Lister les issues d'un projet

```bash
curl -s 'https://gitlab.example.com/api/v4/projects/<project>/issues' \
  -H 'PRIVATE-TOKEN: <token>' \
  | jq '.[] | {iid, title, state, labels}'
```

**Filtres disponibles** :

- `?state=opened` : issues ouvertes uniquement
- `?labels=bug,priority::high` : par labels
- `?assignee_id=123` : assignées à un utilisateur
- `?milestone=v1.0` : par milestone

## Garde-fous de sécurité

### Protection des tokens et sanitisation de la sortie

- Ne JAMAIS afficher de valeur réelle de token (`glpat-*`, `glptt-*`, `glsoat-*`) dans la sortie, les confirmations, ou les commandes construites
- Dans les commandes curl, utiliser `$GITLAB_TOKEN` ou `$GITLAB_SESSION` — jamais de valeur en dur
- Ne JAMAIS afficher la valeur d'un cookie `_gitlab_session`
- Si une réponse API contient un champ `token`, `private_token`, `runners_token`, `secret`, ou `variable.value` : masquer la valeur avec `*****` et avertir
- Si la sortie contient un pattern `glpat-`, `glptt-`, `-----BEGIN`, ou `_gitlab_session=` : tronquer et avertir

### Classification des opérations

| Niveau           | Méthode HTTP / Type            | Confirmation requise                                               |
|------------------|--------------------------------|--------------------------------------------------------------------|
| **Lecture**      | `GET`, `HEAD`, GraphQL `query` | Aucune                                                             |
| **Écriture**     | `POST`, GraphQL `mutation`     | Afficher le body complet, attendre confirmation                    |
| **Modification** | `PUT`, `PATCH`                 | Afficher le contenu et l'impact, attendre confirmation avec rappel |
| **Destructif**   | `DELETE`                       | **Interdit par défaut** (voir ci-dessous)                          |

### Opérations interdites

Ne JAMAIS exécuter, même sur demande explicite :

- `DELETE /projects/:id` — suppression de projet
- `DELETE /groups/:id` — suppression de groupe
- `PUT /projects/:id` avec `visibility: "public"` — rendre un projet public
- `DELETE` sur `/protected_branches`, `/deploy_keys`, `/hooks`, `/members`
- Mutations GraphQL `projectDelete`, `groupDelete`
- `POST` ou `PUT` sur `/variables` avec une valeur qui ressemble à un secret (`glpat-*`, `-----BEGIN`, mot de passe)

Si l'utilisateur demande une opération interdite : refuser, expliquer le risque, et suggérer l'alternative via l'interface web.

### Restrictions sur DELETE

- **Interdit par défaut.** Refuser et orienter vers l'interface web.
- **Exception** : uniquement si l'utilisateur fournit une justification explicite ET confirme deux fois.
- Les opérations de la liste interdite restent bloquées sans exception.

### Trace d'audit

Pour chaque opération d'écriture, modification ou destructive exécutée, inclure dans la réponse :

- Horodatage
- Méthode HTTP + endpoint (avec tokens masqués)
- Body envoyé (résumé si volumineux)
- Résultat : code HTTP + identifiant de la ressource créée/modifiée

## Bonnes pratiques

### Confirmation avant publication

**RÈGLE OBLIGATOIRE** : Le niveau de confirmation dépend de la classification de l'opération (voir « Garde-fous de sécurité » ci-dessus).

**Format de confirmation** :

```
Opération GitLab [ÉCRITURE|MODIFICATION|DESTRUCTIF] :

Méthode : [POST|PUT|PATCH|DELETE]
Endpoint : [URL avec tokens masqués]
Contenu :
---
[body complet avec valeurs sensibles masquées]
---

Souhaitez-vous exécuter cette opération ? (oui/non)
```

**Exception** : Les opérations de lecture (GET, HEAD, queries GraphQL) ne nécessitent pas de confirmation.

### Gestion des erreurs

Toujours vérifier la réponse pour les erreurs :

```bash
response=$(curl -s ... | jq .)
if echo "$response" | jq -e '.errors' > /dev/null; then
    echo "Erreur : $(echo "$response" | jq -r '.errors[].message')"
    exit 1
fi
```

### Encodage des caractères spéciaux

Pour les descriptions longues avec JSON, utiliser un heredoc :

```bash
curl --data @- << 'EOF'
{
  "title": "Mon titre avec 'apostrophes'",
  "description": "Description avec\nnouveaux lignes\net \"guillemets\""
}
EOF
```

### Rate limiting

GitLab limite les requêtes API :

- **Authentifié** : 2000 requêtes/minute
- **Non authentifié** : 10 requêtes/minute

Vérifier les headers de réponse :

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`

### Pagination

Les endpoints REST retournent 20 éléments par défaut :

```bash
# Page 2, 50 éléments par page
curl '...?page=2&per_page=50'
```

Headers de pagination :

- `X-Total-Pages`
- `X-Next-Page`
- `Link` (contient les URLs next/prev/first/last)

## Références

- **Documentation REST API** : <https://docs.gitlab.com/ee/api/>
- **Documentation GraphQL** : <https://docs.gitlab.com/ee/api/graphql/>
- **GraphQL Explorer** : `https://<instance>/-/graphql-explorer`

## Exemples de cas d'usage réels

### Créer une issue technique avec checklist

```bash
curl -X POST 'https://gitlab.example.com/api/v4/projects/my-org%2Fmy-project/issues' \
  -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --data @- << 'EOF'
{
  "title": "Normaliser la nomenclature des propriétés Contact en camelCase",
  "description": "## Contexte\n\n...\n\n## Travaux à réaliser\n\n- [ ] Identifier toutes les sources\n- [ ] Vérifier la sérialisation\n\n## Références\n\nIssue identifiée lors de la code review de la MR !1851"
}
EOF
```

**Note** : GitLab détecte automatiquement les checkboxes `- [ ]` et affiche un compteur.

### Récupérer toutes les MR d'un auteur

```bash
curl -s 'https://gitlab.example.com/api/v4/projects/<project>/merge_requests' \
  -H 'PRIVATE-TOKEN: <token>' \
  -G --data-urlencode 'author_username=jdoe' \
  --data 'state=opened' \
  | jq '.[] | {iid, title, created_at: .created_at}'
```
