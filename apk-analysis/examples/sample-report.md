# Rapport d'analyse APK — exemple

> Format cible produit par Claude en Phase 5, à partir des JSON des scripts + de l'arbre
> `decompile/`. **Exemple entièrement fictif** (app inventée `com.example.bikelog`) : aucune
> donnée d'application réelle. Toute valeur sensible est masquée conformément aux garde-fous.

## En-tête

| Champ | Valeur |
|---|---|
| Package | `com.example.bikelog` |
| Version | 1.17.0 (versionCode 41) |
| SHA-256 | `<sha256-de-l-apk-analysé>` |
| Date d'analyse | AAAA-MM-JJ |
| Cadre | App dont je suis propriétaire / périmètre de pentest autorisé |

## Fingerprint (Phase 0)

- **Framework** : natif (Java/Kotlin) → pipeline jadx pleinement pertinent.
- **Obfuscation** : none-or-light → noms de classes largement lisibles.
- **Stacks HTTP détectées au packaging** : aucune signature de classe évidente ; les
  endpoints ont été retrouvés par URLs en dur dans les sources (voir Phase 2).
- **Libs natives** : aucune.
- **Permissions** : 5 (jeu restreint, cohérent avec une app de suivi de matériel).

## Inventaire API (Phase 3)

Endpoint métier principal : **`api.bikelog.example`**.

| Méthode | Hôte | Path | Nature |
|---|---|---|---|
| ? | api.bikelog.example | `/auth/login-android` | Authentification (login mobile) |
| ? | api.bikelog.example | `/auth/callback` | Callback OAuth |
| ? | api.bikelog.example | `/shopping/component-offers/` | Offres de composants (métier) |
| — | partner.example | `/settings/gear`, `/activities/%d` | Intégration partenaire (deep links) |

Exports générés : `openapi.json` (OpenAPI 3.1) et `postman.json` (collection v2.1)
pour rejouer/documenter l'API. Les hôtes tiers de télémétrie / pubs
(`analytics.example`, `ads.example`) sont à distinguer de l'API métier.

> Note : la méthode HTTP est `?` quand l'endpoint provient d'une URL en dur (le verbe n'est
> pas porté par la chaîne). Un passage dynamique (proxy émulateur) confirmerait les verbes réels.

## Cartographie de la logique métier (Phase 4)

Reconstruite par lecture ciblée de `decompile/` autour des points d'évidence :

```
LoginActivity / écran d'auth
  └─> appel /auth/login-android  (obtention d'un token de session)
        └─> /auth/callback       (finalisation OAuth)
Écran boutique
  └─> /shopping/component-offers/ (catalogue d'offres de composants)
Intégration partenaire
  └─> deep links partner.example/settings/gear, /activities/{id}
```

Fil directeur : app de **suivi d'entretien de vélo** ; l'API métier gère l'authentification,
le catalogue de composants et se connecte à un partenaire pour récupérer l'activité de l'utilisateur.

## Secrets & obfuscation

- `extract-strings.sh` a signalé **66 valeurs secret-looking**, toutes **masquées**
  (`<redacted:len=N>`) — clés de config tierces probables. **Aucune valeur en clair** dans ce rapport.
- Récupération de noms Kotlin : `name-map.json` vide (app essentiellement Java, pas de
  métadonnées coroutines) → analyse par comportement, pas par nom.

## Provenance & annexes

- Empreinte APK : voir SHA-256 en en-tête (trace la version exacte auditée).
- Fichiers exploitables : `api-inventory.json`, `openapi.json`, `postman.json`.
- Pour aller plus loin : capturer le trafic réel via `references/dynamic-analysis-emulator.md`
  (proxy MITM) afin de confirmer les verbes HTTP et découvrir les endpoints construits à l'exécution.
