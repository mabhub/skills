---
name: apk-analysis
description: >
  Analyse statique d'applications Android (APK/XAPK/AAB) pour la découverte
  d'API et l'extraction de logique métier. Décompile via jadx en conteneur
  isolé, extrait les endpoints (Retrofit/OkHttp/Ktor/Volley/Apollo), génère
  un inventaire OpenAPI/Postman, cartographie les flux Activity→ViewModel→réseau,
  détecte l'obfuscation et récupère les noms Kotlin R8. Usage : apps propres ou
  pentest autorisé uniquement.
  Trigger phrases : "analyse cet APK", "reverse cette app Android", "découvre
  l'API de cette app", "extrais les endpoints", "décompile cet APK", "logique
  métier de cette app Android", "analyze this APK", "reverse engineer Android app",
  "extract API endpoints", "decompile APK", "what API does this app call".
---

# apk-analysis

## Objectif & périmètre

Analyse **statique** d'applications Android pour deux objectifs :
- **Découverte d'API** — inventorier les endpoints appelés par l'app (méthode, path,
  hôte, stack HTTP), exportables en OpenAPI et Postman.
- **Extraction de logique métier** — cartographier les flux
  Activity→ViewModel→Repository→appel réseau à partir des sources décompilées.

Le pipeline statique est **automatisé** (scripts déterministes). L'analyse **dynamique**
(émulateur, Frida) est **documentée en `references/`** mais jamais orchestrée par le skill :
aucune exécution d'app n'est pilotée automatiquement.

## Garde-fous de sécurité

**Autorisation avant analyse**
- Avant toute décompilation, confirmer le cadre : app dont l'utilisateur est
  propriétaire (ou de son organisation), ou périmètre de **pentest / audit autorisé**.
  Si le contexte est ambigu, demander avant de lancer quoi que ce soit.
- Refuser d'aider à contourner des protections dans un but non autorisé
  (piratage de licence, triche, vol de propriété intellectuelle tierce).

**Isolation & exécution**
- Analyse statique par défaut en **conteneur Docker non-privilégié**, `--network none`,
  APK monté en **lecture seule** (`:ro`).
- **Jamais** d'exécution de l'APK ni du code natif extrait sur la machine hôte.
  Le dynamique (émulateur, Frida) reste en `references/` — documenté, jamais orchestré ;
  rappel systématique « émulateur/device jetable uniquement ».

**Secrets & données sensibles** (cœur du risque)
- Clés API, tokens, secrets, endpoints d'auth détectés → **signalés par emplacement**
  (`fichier:ligne`, type) mais **jamais reproduits en clair** dans les rapports.
  `extract-strings.sh` masque les valeurs ressemblant à des secrets
  (longueur + type conservés, valeur remplacée par `<redacted:len=N>`).
- Sorties (`decompile/`, `*.json`, rapport) **gitignorées par défaut** : un APK
  décompilé peut contenir des secrets clients → jamais commité.

**Provenance**
- Le rapport mentionne toujours le **hash SHA-256** de l'APK analysé + horodatage,
  pour tracer précisément la version auditée.

## Prérequis & modes d'exécution

Toujours commencer par détecter l'environnement :

```bash
scripts/check-tools.sh
```

Il renvoie l'un de 4 modes :
- `MODE=container` — Docker + image `apk-analysis:local` prêts (**recommandé**).
- `MODE=image-missing` — Docker présent, image à construire (commande affichée).
- `MODE=local` — pas de Docker, outils locaux présents (⚠️ pas d'isolation).
- `MODE=local-missing` — outils manquants (guide d'install affiché).

**Construction de l'image (build manuel par défaut)** :

```bash
docker build -t apk-analysis:local apk-analysis/tools
```

Ne construire l'image que sur demande explicite. Voir `tools/README.md` pour le détail
(version jadx pinnée + checksum).

## Pipeline en 6 phases

| Phase | Rôle | Outil |
|---|---|---|
| 0 — Fingerprint | Triage sans décompiler : framework, stack HTTP, obfuscation, libs natives, permissions, SHA-256 | `scripts/fingerprint.sh` |
| 1 — Décompilation | jadx (+ dex2jar en fallback) → arbre de sources | `scripts/decompile.sh` |
| 2 — Extraction | Endpoints multi-stack + noms Kotlin + strings | `scripts/find-api-calls.sh`, `scripts/recover-kotlin-names.sh`, `scripts/extract-strings.sh` |
| 3 — Inventaire API | Consolidation → catalogue + OpenAPI + Postman | `scripts/build-api-inventory.mjs` |
| 4 — Cartographie | Flux Activity→ViewModel→Repository→réseau | **Claude interprète** |
| 5 — Rapport | Synthèse Markdown | **Claude interprète** |

## Choisir les phases (ne pas tout dérouler par défaut)

Les phases sont **composables** : n'exécuter que le sous-ensemble utile au besoin qui a
déclenché le skill. La décompilation (Phase 1) est de loin la plus coûteuse (jadx sur des
milliers de classes) ; les Phases 2 sont indépendantes entre elles. Injecter `strings.json`
ou l'arbre `decompile/` entier dans le contexte alors que la question était « quels
endpoints ? » gaspille du temps ET du contexte.

Règles de dépendance :
- Phase 0 est **toujours** utile et quasi gratuite (~0,5 s) → la lancer d'abord.
- Si `fingerprint.json` indique un framework **≠ native** (Flutter/RN/Cordova/Xamarin),
  **s'arrêter** : le pipeline JVM ne verra pas la logique → voir `references/framework-specifics.md`.
- Phases 2 et 3 lisent `decompile/` → Phase 1 est un prérequis pour elles, mais chaque
  script de Phase 2 est facultatif indépendamment.

Matrice besoin → phases minimales :

| Besoin exprimé | Phases | Scripts |
|---|---|---|
| Triage rapide (« c'est quoi cette app ? ») | 0 | `fingerprint.sh` |
| Découverte d'API / endpoints | 0 → 1 → 2a → 3 | + `decompile.sh`, `find-api-calls.sh`, `build-api-inventory.mjs` |
| Logique métier / flux | 0 → 1 → (2a) → 4 | + `decompile.sh` (+ `find-api-calls.sh`), puis Claude lit `decompile/` |
| Audit secrets / clés en dur | 0 → 1 → 2c | + `decompile.sh`, `extract-strings.sh` |
| Déobfuscation / noms Kotlin | 0 → 1 → 2b | + `decompile.sh`, `recover-kotlin-names.sh` |
| Rapport complet | 0 → 1 → 2a+2b+2c → 3 → 4 → 5 | tout (séquence ci-dessous) |

(2a = `find-api-calls.sh`, 2b = `recover-kotlin-names.sh`, 2c = `extract-strings.sh`.)

## Utilisation

La séquence ci-dessous est le **cas exhaustif** (rapport complet). Pour un besoin ciblé,
n'exécuter que les scripts de la ligne correspondante dans la matrice ci-dessus.

```bash
S=apk-analysis/scripts
APK=<apk>
OUT=<out-dir>

"$S/check-tools.sh"                       # vérifier le mode
"$S/fingerprint.sh"        "$APK" "$OUT"  # Phase 0
"$S/decompile.sh"          "$APK" "$OUT"  # Phase 1
"$S/find-api-calls.sh"           "$OUT"   # Phase 2
"$S/recover-kotlin-names.sh"     "$OUT"   # Phase 2
"$S/extract-strings.sh"          "$OUT"   # Phase 2
node "$S/build-api-inventory.mjs" "$OUT"  # Phase 3
```

Puis Claude interprète les JSON (`fingerprint.json`, `api-inventory.json`, `name-map.json`,
`strings.json`) + l'arbre `decompile/` pour produire la cartographie (Phase 4) et le
rapport de synthèse (Phase 5). Voir le format cible dans `examples/sample-report.md`.

## Livrables

Trois niveaux, du plus brut au plus interprété :
1. **JSON brut** — sorties des scripts (`fingerprint.json`, `api-raw.json`, `strings.json`, `name-map.json`).
2. **Inventaire API exploitable** — `api-inventory.json`, `openapi.json` (OpenAPI 3.1), `postman.json` (collection v2.1).
3. **Rapport Markdown** — synthèse rédigée par Claude (endpoints, logique métier, secrets masqués, obfuscation, provenance SHA-256).

## Analyse dynamique

Le skill **ne pilote jamais** de device ni d'émulateur. Deux pans complémentaires sont
documentés pour aller au-delà du statique, à mener manuellement dans un environnement jetable :
- `references/dynamic-analysis-emulator.md` — **où exécuter en sécurité** : AVD jetable,
  proxy MITM + CA pour capturer le trafic API en live, `logcat`, isolation réseau.
- `references/dynamic-analysis-frida.md` — **comment instrumenter le runtime** : hooking,
  bypass SSL pinning, capture de valeurs déchiffrées.

Voir aussi `references/obfuscation-patterns.md` (R8/ProGuard, name recovery) et
`references/framework-specifics.md` (spécificités Flutter/RN/Cordova/Xamarin).
