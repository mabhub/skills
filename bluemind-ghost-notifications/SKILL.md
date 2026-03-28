---
name: bluemind-ghost-notifications
description: >
  Investigate and resolve ghost/phantom calendar notification issues on BlueMind instances.
  Use when a user reports receiving recurring alarm or reminder notifications for a calendar
  event that does not appear in their agenda, or for an event that has already ended.
  Covers the full diagnostic workflow: resolving user UIDs, searching events via the
  BlueMind REST API (_search, _changeset, /complete, _all, _list), inspecting event
  properties (status, rrule, VALARM, exdate, occurrences), and recommending remediation
  (organiser-side deletion, client cache purge, status update via API).
  Triggered by: "notification fantôme", "ghost notification", "alarme récurrente invisible",
  "rappel pour un événement introuvable", "phantom reminder calendar", or any similar
  description of a recurring alarm with no visible event.
---

# BlueMind Ghost Notifications — Workflow de diagnostic

## Contexte rapide

Une notification fantôme advient quand un événement existe côté serveur (statut `Confirmed`,
`VALARM` présent) mais n'est visible nulle part dans l'agenda de l'utilisateur. Causes
typiques : l'utilisateur est invité sur le calendrier d'un **autre** utilisateur, la série
est terminée (`UNTIL` dépassé) mais jamais annulée, et/ou le cache CalDAV client propage
les alarmes après la fin de la série.

## Variables à collecter avant de démarrer

Demandez à l'utilisateur :

1. **Titre exact** du rappel / de la notification
2. **Heure** de réception (régulière ? jour de semaine ?)
3. **Client utilisé** (Thunderbird, macOS Calendar, web BlueMind ?)
4. **La notification arrive-t-elle aussi via le web ?** (oui → l'objet existe côté serveur)
5. **URL de l'instance BlueMind** et **clé API** disponible pour les requêtes

Ne stockez jamais la clé API dans les rapports ou fichiers de sortie.

## Graphe de décision

```
ÉTAPE 1 : Résoudre les UIDs des utilisateurs mentionnés
    ↓
ÉTAPE 2 : _search global par texte libre (titre de l'événement)
    ├── [TROUVÉ] ──→ ÉTAPE 4 (inspection /complete) ──→ ÉTAPE 5 (export ICS)
    └── [VIDE]   ──→ ÉTAPE 3 (_changeset, chercher dans deleted)
                        ├── [UIDs deleted trouvés] ──→ tentative /complete sur chacun
                        │       ├── [200] ──→ ÉTAPE 4 ──→ ÉTAPE 5
                        │       └── [tous 404] ──→ ÉTAPE 3b (_all / _list exhaustif)
                        └── [changeset vide] ──→ ÉTAPE 3b (_all / _list)
```

## Étapes détaillées

Voir `references/api-endpoints.md` pour les requêtes curl exactes à chaque étape.

### ÉTAPE 1 — Résolution utilisateurs

Résoudre les logins mentionnés en UIDs. Stratégie : `byLogin` d'abord, fallback `_byEmail`.

```
GET /users/{domain}/byLogin/{login}
→ 404 ? GET /users/{domain}/_byEmail/{login}@{domain}
```

Construire le container : `calendar:Default:{UID}`

### ÉTAPE 2 — Recherche globale

```
POST /calendars/_search
body: { "eventQuery": { "query": "<TITRE>" } }
```

Si vide, retenter avec `containers` explicites (container du user signalé + containers des
utilisateurs résolus à l'étape 1).

### ÉTAPE 3 — Changeset (si `_search` vide)

```
GET /calendars/{container}/_changeset?since=0
```

Retourne `{ created, updated, deleted, version }`. Les UIDs dans `deleted` sont les
candidats. Tenter chacun via `/complete`. Si tous en 404 ou changeset vide, passer au
listage exhaustif (`_all` puis `_list`).

### ÉTAPE 4 — Inspection détaillée

```
GET /calendars/{container}/{uid}/complete
GET /calendars/{container}/{uid}/_itemchangelog
```

Champs à analyser — voir `references/api-endpoints.md` section "Champs clés à inspecter".

### ÉTAPE 5 — Export ICS

```
GET /calendars/vevent/{container}/{uid}
```

Sauvegardez le résultat avant toute action de nettoyage.

## Recommandations de résolution

Après identification de l'événement, appliquer selon le cas :

| Scénario                            | Action recommandée                                                                          |
|-------------------------------------|---------------------------------------------------------------------------------------------|
| Vous êtes invité, pas organisateur  | Contacter l'organisateur pour suppression côté serveur                                      |
| Vous êtes organisateur ou admin     | Mettre le statut à `Cancelled` ou supprimer via API                                         |
| Alarme arrive seulement côté client | Purger le cache CalDAV du client (voir `references/api-endpoints.md` section "Purge cache") |
| Les deux (web + client)             | Action serveur en premier, puis purge cache                                                 |

## Rapport de sortie

Produisez toujours un rapport structuré comprenant :

- Hypothèses testées et résultats (confirmée / infirmée / non testée)
- Détails des événements trouvés (container, UID, organisateur, rrule, alarme, status)
- Actions de résolution recommandées avec les identifiants concrets
- Fichiers ICS exportés
- Trace des requêtes exécutées (endpoint, code HTTP, résultat)

Ne jamais faire apparaître la clé API dans le rapport.
