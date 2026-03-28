# BlueMind API — Endpoints et requêtes pour le diagnostic de notifications fantômes

> Tous les exemples utilisent `<API_KEY>` comme placeholder pour la clé d'authentification.
> Ne jamais exporter ou stocker la clé dans les rapports.
> Base URL generique : `https://<INSTANCE>/api/`

---

## Résolution utilisateurs

### Par login (rapide, à essayer en premier)

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/users/<DOMAIN>/byLogin/<LOGIN>"
```

### Par email (fallback si byLogin retourne 404)

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/users/<DOMAIN>/_byEmail/<LOGIN>@<DOMAIN>"
```

### Construction du container

```
calendar:Default:<UID_UTILISATEUR>
```

Exemple : si `byLogin/mbu` retourne `uid: "A41AB247-9407-44C7-A5D8-4B473CC405D1"`,
le container est `calendar:Default:A41AB247-9407-44C7-A5D8-4B473CC405D1`.

---

## Recherche d'événements

### Recherche par texte libre (scope global)

```bash
curl -s -X POST \
  -H "X-BM-ApiKey: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"eventQuery":{"query":"<TITRE_EVENEMENT>"}}' \
  "https://<INSTANCE>/api/calendars/_search"
```

### Recherche avec containers explicites

```bash
curl -s -X POST \
  -H "X-BM-ApiKey: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "containers": ["calendar:Default:<UID1>", "calendar:Default:<UID2>"],
    "eventQuery": {"query":"<TITRE_EVENEMENT>"}
  }' \
  "https://<INSTANCE>/api/calendars/_search"
```

---

## Changeset (tombstones et suppressions)

```bash
# Depuis l'epoch (complet)
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/_changeset?since=0"

# Depuis une date précise (epoch en secondes, ex : 2021-01-01 = 1609459200)
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/_changeset?since=1609459200"
```

Réponse : `{ "created": [...], "updated": [...], "deleted": [...], "version": N }`

Les UIDs dans `deleted` sont les candidats à tester via `/complete`.

---

## Inspection détaillée

### Récupération complète (VEventSeries)

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/<UID>/complete"
```

### Historique des modifications

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/<UID>/_itemchangelog"
```

### Champs clés à inspecter dans la réponse `/complete`

| Chemin JSON                    | Signification                          | Ce qui indique un problème                                |
|--------------------------------|----------------------------------------|-----------------------------------------------------------|
| `value.main.status`            | Statut de la série                     | `Confirmed` sur une série terminée = alarme active        |
| `value.main.rrule.until`       | Date de fin de récurrence              | Dans le passé → la série ne génère plus d'occurrences     |
| `value.main.rrule.frequency`   | Fréquence (`WEEKLY`, `DAILY`, etc.)    | —                                                         |
| `value.main.rrule.byDay[].day` | Jour(s) de la semaine (`MO`–`SU`)      | Croiser avec le jour de la notification reçue             |
| `value.main.rrule.interval`    | Intervalle (ex : 2 = bi-hebdo)         | —                                                         |
| `value.main.alarm[].trigger`   | Décalage en secondes (négatif = avant) | `-900` = 15 min avant. Croiser avec l'heure de la notif   |
| `value.main.dtstart`           | Date/heure de début                    | Fuseau horaire à noter                                    |
| `value.main.exdate`            | Liste d'exclusions de dates            | `null` = aucune exclusion                                 |
| `value.occurrences`            | Exceptions individuelles               | Chercher des `status: Cancelled`                          |
| `createdBy`                    | UID du créateur                        | Différent de l'utilisateur signalant → calendrier partagé |
| `updatedBy`                    | Qui a fait la dernière modif           | `system` = traitement automatique                         |
| `updated`                      | Timestamp (epoch ms) de dernière modif | Convertir pour vérifier la date                           |

---

## Listage exhaustif (dernier recours)

### Liste des UIDs seulement (léger)

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/_all"
```

### Liste complète avec objets (lourd)

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/<CONTAINER>/_list"
```

Filtrer en post-traitement :

```bash
... | jq '.[] | select(.value.main.summary | test("TERME"; "i"))'
```

---

## Export ICS

```bash
curl -s -H "X-BM-ApiKey: <API_KEY>" \
  "https://<INSTANCE>/api/calendars/vevent/<CONTAINER>/<UID>"
```

Retourne du texte brut au format RFC 5545. Sauvegarder avec l'extension `.ics`.

---

## Purge du cache CalDAV client

### Thunderbird

1. Fermer Thunderbird.
2. Ouvrir le dossier de profil :
   - **Linux** : `~/.thunderbird/<profil>/`
   - **Windows** : `%AppData%\Mozilla\Thunderbird\Profiles\<profil>\`
   - **macOS** : `~/Library/Thunderbird/Profiles/<profil>/`
3. Supprimer le sous-dossier du compte CalDAV (sous `imapmail/` ou à la racine du profil).
4. Redémarrer Thunderbird → resync automatique.

### macOS Calendar

`Préférences Système > Internet et Accounts` → supprimer le compte CalDAV → le re-créer.

**Important** : purger le cache client sans corriger côté serveur entraîne une resync qui
rapatrie à nouveau l'événement avec son `VALARM`. Toujours corriger côté serveur en premier.

---

## Notes sur les identifiants

- Un même événement a deux UIDs distincts : un **UID BlueMind** (retourné par l'API, utilisé dans les URLs) et un **UID ICS** (champ `UID` dans le fichier `.ics`, champ `icsUid` dans la réponse `/complete`).
- Les containers suivent le format `calendar:Default:<UID_utilisateur>`.
- Les UIDs utilisateur peuvent être des slugs (`user_entity_XXXXX`) ou des UUID complets (`XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`), selon la configuration de l'instance.
