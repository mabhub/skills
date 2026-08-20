---
name: code-review-skill
description: >
  Use when the user wants to proactively audit an existing codebase — without link to a recent
  implementation. Détecte code smells, duplications, risques, et sur-ingénierie (code plus
  compliqué qu'il n'a besoin de l'être : abstractions prématurées, indirections inutiles,
  généricité spéculative). Triggers: "revue de code", "passe en revue le code", "analyse le code",
  "audite le projet", "code review", "nettoie le code", "assainissement", "assainir",
  "que penses-tu du code", "analyse la branche", "review la branche", "review this branch",
  "ce code est-il trop compliqué", "simplifie ce code", "sur-ingénierie", "over-engineering",
  "trop d'abstractions", "yagni".
---

# Code Review

## Vue d'ensemble

Audit proactif d'un codebase existant : code smells, duplications, risques techniques,
**sur-ingénierie**, et améliorations potentielles. **Distinct** de
`superpowers:requesting-code-review` (workflow post-implémentation SDD) — ici l'utilisateur veut
auditer/nettoyer un projet existant.

**Principe directeur** : un finding faux coûte plus cher qu'un finding manqué. Un audit qui
signale trois problèmes réels est plus utile qu'un audit qui en liste quinze dont six sont
imaginaires — l'utilisateur perd sa confiance dans la liste entière. Chaque finding doit survivre
à l'étape 4 (vérification) avant d'être écrit.

## Étape 1 : Déterminer le scope

| Signal dans le message | Scope |
|---|---|
| Pas d'argument, "le projet", "tout le code" | `projet` |
| Chemin ou composant mentionné ("src/api/", "le module auth") | `zone` |
| Nom de branche, "la branche X", "cette PR" | `branche` |

Défaut : `projet` si aucun signal.

Si l'utilisateur emploie un vocabulaire de simplification ("nettoie", "simplifie", "trop
compliqué", "assainit"), traiter la **sur-ingénierie comme axe prioritaire** de l'analyse — mais
sans jamais retirer les autres axes : un audit reste un audit. Ce vocabulaire change l'**ordre**
du rapport, pas son périmètre. Le balayage § 4.6 s'applique intégralement : quelqu'un qui demande
de simplifier veut aussi savoir que son endpoint de paiement n'a pas de timeout — le lui taire
parce qu'il n'a pas posé cette question-là serait un mauvais service.

### Clarification si ambigu

Si le scope est ambigu sur un grand projet (> 50 fichiers source), poser **une seule question** :

> Quel est le périmètre de la revue ? (projet entier / répertoire spécifique / branche Git)

## Garde-fous de sécurité

### Fichiers et répertoires exclus de l'exploration

Ne JAMAIS lire ni lister le contenu de :

- **Porteurs de secrets, par emplacement ou extension** : `.env`, `.env.*`, `*.pem`, `*.key`,
  `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `id_rsa*`, `.npmrc`, `.netrc`, `*.tfvars`,
  `**/credentials`, `**/credentials.json`, `**/secrets.{json,yaml,yml}`
- **Répertoires** : `node_modules/`, `.git/`, `vendor/`, `dist/`, `build/`, `target/`,
  `__pycache__/`, `.venv/`, `coverage/`
- **Fichiers de lock** : `*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
  Exclusion **délibérée** : l'audit des dépendances (CVE, versions transitives) est un travail
  distinct et coûteux. Si la revue laisse penser qu'il est nécessaire, le **recommander** en fin
  de rapport (`npm audit`, `pip-audit`, Dependabot) plutôt que le faire.
- **Fixtures/seeds** contenant des données personnelles réelles

⚠️ **Ne pas exclure le code qui *manipule* des secrets.** `token-parser.ts`, `secretsManager.py`,
`useAuthToken.tsx`, `credentials.service.ts` sont du code source normal — souvent le plus important
à auditer. Les exclure reviendrait à ne jamais réviser la couche d'authentification. Ils se lisent
comme n'importe quel fichier ; c'est la règle de non-reproduction des valeurs (voir « Rédaction »)
qui protège, pas l'évitement du fichier.

Si un fichier exclu apparaît dans un Glob, le mentionner dans la synthèse comme « exclu par
politique de sécurité » sans révéler son contenu.

### Règle Glob

Toujours utiliser des patterns ciblés :
- ✅ `Glob("src/**/*.ts")` — ciblé
- ❌ `Glob("**/*")` — trop large, risque d'inclure des fichiers sensibles

## Étape 2 : Établir la référence du projet

**Avant toute analyse.** Sans cette étape, la revue juge le code selon des préférences génériques
et signale comme défaut ce qui est la convention explicite du projet — c'est le moyen le plus
rapide de perdre la confiance de l'utilisateur.

Lire, quand ils existent :

1. `CLAUDE.md` / `AGENTS.md` — contraintes et conventions déclarées
2. Config du linter/formateur : `.eslintrc*`, `eslint.config.*`, `biome.json`, `ruff.toml`,
   `.rubocop.yml`, `clippy.toml`, section `[tool.*]` de `pyproject.toml`
3. Manifeste : `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod` — cible de runtime,
   scripts disponibles, dépendances déjà présentes
4. `README` / `docs/adr/` — décisions d'architecture assumées

Conséquences directes :
- Ce que le linter interdit déjà **n'est pas un finding** (l'outil le dit mieux et en CI).
- Ce que le linter autorise explicitement (règle désactivée) n'est pas un défaut, c'est un choix.
- Une convention majoritaire dans le repo prime sur la préférence générique du réviseur.
- Une dépendance déjà au manifeste peut être proposée en remplacement d'un utilitaire maison ;
  en ajouter une nouvelle est une suggestion beaucoup plus lourde, à formuler comme telle.

## Étape 3 : Explorer le codebase

### Scope `projet`
1. Cartographier les modules (`Glob` sur les répertoires sources)
2. Parcourir en priorité les fichiers les plus volumineux et les plus modifiés
   (`git log --format= --name-only -n 300 | sort | uniq -c | sort -rn | head -20`) — le code
   souvent touché est celui où la dette coûte réellement
3. Échantillonner intelligemment — **noter les zones non couvertes** pour le rapport

### Scope `zone`
Lire **tous** les fichiers du répertoire ou module ciblé.

### Scope `branche`
1. Résoudre la base — ne jamais supposer `main` :
   ```bash
   base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')
   base=${base:-$(git rev-parse --verify --quiet main >/dev/null && echo main || echo master)}
   git merge-base HEAD "$base"
   ```
   Si la résolution échoue, demander la base à l'utilisateur plutôt que deviner.
2. `git diff "$base"...HEAD --name-only` pour lister les fichiers touchés
3. Lire les **fichiers complets**, pas seulement le diff — nécessaire pour détecter duplications
   et incohérences hors du diff

## Étape 4 : Analyser

### 4.1 — Axes d'analyse

- **Correction** : bugs, cas limites non gérés, gestion d'erreurs absente, race conditions
- **Code smells** : fonctions trop longues, complexité cyclomatique élevée, nommage opaque,
  magic numbers, commentaires obsolètes ou contredits par le code
- **Duplications** : logique répétée extractible — vérifier que les occurrences sont réellement
  identiques *sémantiquement*, pas seulement d'apparence
- **Sur-ingénierie** : voir § 4.2, c'est un axe à part entière
- **Architecture** : responsabilités mal séparées, couplage fort, violation des patterns du projet
- **Risques** : usage dangereux d'API, données non validées aux frontières

### 4.2 — Sur-ingénierie : « ce code est-il plus compliqué qu'il n'a besoin de l'être ? »

La question à se poser sur chaque abstraction : **quelle est la version la plus simple de ce code
qui remplirait le même contrat observable ?** Si cette version est nettement plus courte ou plus
directe, l'écart est le coût de complexité — reste à savoir s'il est payé pour quelque chose.

Signaux à chercher :

| Signal | Description |
|---|---|
| **Abstraction prématurée** | Interface, classe abstraite ou protocole avec une seule implémentation, sans point d'extension prévu |
| **Généricité spéculative** | Paramètres de type, hooks, options de config jamais utilisés autrement qu'avec leur défaut |
| **Indirection sans gain** | Wrapper, façade ou couche qui ne fait que transférer l'appel en changeant les noms |
| **Pattern décoratif** | Factory / Builder / Strategy / Observer là où un appel direct, un littéral ou un `if` suffirait |
| **Configurabilité fantôme** | Options exposées qu'aucun appelant ne fait varier, feature flags jamais basculés |
| **Machinerie asynchrone injustifiée** | Queue, worker, cache, event bus pour un volume et une latence qui ne les demandent pas |
| **Réimplémentation** | Utilitaire maison reproduisant la lib standard ou une dépendance déjà au manifeste |
| **Défensif excessif** | Validations, try/catch, null checks sur des invariants garantis en amont (souvent par le typage) |
| **Découpage excessif** | Fichiers ou fonctions si petits que suivre le flux exige d'en ouvrir cinq |
| **Rétrocompat morte** | Branches de code pour des versions, plateformes ou formats qui n'existent plus |

### 4.3 — Test de falsification (obligatoire avant tout finding de sur-ingénierie)

**Toute abstraction paraît superflue quand on ignore la contrainte qui l'a motivée.** C'est la
catégorie de finding la plus facile à halluciner : ne jamais en écrire un sans avoir répondu
explicitement aux quatre questions.

1. **Combien d'usages réels ?** — `Grep` le nom du symbole dans tout le repo, tests inclus.
   Une deuxième implémentation, un mock de test, un appelant externe suffit à justifier
   l'abstraction. Un seul usage, et seulement à l'endroit de la définition, la condamne.
2. **Un test l'exige-t-il ?** — Une couture (seam) qui n'existe que pour injecter un double en
   test est justifiée. Ce n'est pas de la sur-ingénierie, c'est de la testabilité.
3. **Une contrainte externe l'exige-t-elle ?** — Contrat d'API publique, exigence d'un framework
   (DI, sérialisation, réflexion), compat multi-plateforme, frontière de module publiée.
   Chercher les indices : commentaire, ADR, nom explicite, `@public`, export dans un `index`.
4. **Que dit l'historique ?** — `git log --oneline -5 -- <fichier>` ou
   `git log -S '<symbole>' --oneline`. Une abstraction introduite *pour corriger un bug précis*
   n'est pas spéculative, même si elle paraît lourde.

Si l'une des quatre réponses justifie la complexité → **pas de finding**. Si le doute subsiste
après vérification → formuler en question ouverte dans « Recommandations », pas en finding
affirmatif.

### 4.4 — Ne pas confondre complexité et complication

La complexité **essentielle** vient du problème : un parseur, un moteur de règles métier, un
algorithme numérique sont intrinsèquement denses. Ce n'est pas de la sur-ingénierie.
La complication **accidentelle** vient de la solution : elle disparaît si on réécrit plus
simplement, sans rien perdre du comportement. Seule la seconde se signale.

Symétriquement, la simplification a un coût : ne proposer de supprimer une abstraction que si la
version simplifiée tient en un changement raisonnable et localisé. « Réécrire le module » n'est
pas un finding actionnable.

### 4.5 — Vérifier chaque finding avant de l'écrire

Cette étape s'applique à **tous** les axes, pas seulement à la sur-ingénierie. Pour chaque finding
candidat :

- **Correction / risque** : le chemin d'appel produit-il réellement le problème ? Remonter aux
  appelants — la validation ou le `try` manquant est souvent un cran au-dessus. Vérifier qu'un
  test ne couvre pas déjà le cas.
- **Duplication** : lire les deux occurrences en entier. Si elles divergent sur un détail
  sémantique (une condition, un cas d'erreur), la factorisation les casserait — ce n'est pas
  une duplication, c'est une similitude.
- **Convention** : le point est-il déjà couvert par le linter (§ Étape 2) ? Alors ce n'est pas un
  finding.
- **Préférence vs défaut** : « je l'écrirais autrement » n'est pas un finding. Sans conséquence
  concrète (bug, coût de maintenance mesurable, incohérence avec le repo), ne pas l'écrire.

Un finding qui ne survit pas à sa vérification est **supprimé**, pas rétrogradé en mineur.

**La vérification filtre, elle ne restreint pas la recherche.** Ces deux choses sont
indépendantes : chercher largement puis ne garder que ce qui tient debout. Le réflexe à éviter est
de chercher peu pour n'avoir rien à écarter — un rapport court parce qu'il a peu cherché ressemble
à un rapport court parce que le code est sain, et l'utilisateur ne peut pas faire la différence.
Si une section du rapport se retrouve vide, c'est le signal qu'il faut repasser sur la checklist
§ 4.6, pas une preuve de rigueur.

### 4.6 — Balayage de couverture avant de conclure

Les défauts les plus coûteux sont souvent des **absences** — rien dans le code ne les signale, donc
la lecture linéaire les manque. On ne les trouve qu'en posant la question par catégorie. Avant de
rédiger, passer cette liste et noter pour chaque ligne : finding, ou rien à signaler.

- **Frontières réseau et E/S** : timeout, retry, distinction erreur transitoire / définitive,
  idempotence sur les écritures, `Content-Type`, taille de réponse non bornée
- **Chemins d'erreur** : que se passe-t-il quand l'entrée est absente, vide, malformée ? Les
  `catch` avalent-ils sans trace ? Une erreur métier est-elle distinguée d'un bug ?
- **Données sensibles** : montants en flottant, dates sans fuseau, identifiants tronqués,
  comparaisons de chaînes sensibles à la casse ou aux accents
- **Frontières de confiance** : entrées externes validées avant usage, sorties échappées,
  autorisation vérifiée au bon niveau
- **Concurrence** : état partagé muté, `await` dans une boucle sur ressource limitée,
  lecture-puis-écriture non atomique
- **Contrat public** : ce que `CLAUDE.md` ou les exports déclarent stable est-il réellement outillé
  (test, type, validation) ou seulement documenté ?
- **Filet de sécurité** : les chemins critiques identifiés ci-dessus sont-ils couverts par un test ?
  Si le projet a un harnais de test, une lacune sur un chemin critique est un finding.

Cette liste est un déclencheur de recherche, pas un gabarit de rapport : chaque piste trouvée
repasse par la vérification § 4.5 avant d'être écrite. Une catégorie sans problème ne produit rien
et ne se mentionne pas.

## Étape 5 : Prioriser

| Niveau | Critère |
|---|---|
| **Critique** | Problème fonctionnel avéré, risque sécurité ou perte de données |
| **Important** | Dette technique significative, code fragile, complexité qui coûte cher à chaque modification |
| **Mineur** | Amélioration de lisibilité, nettoyage cosmétique |

Les findings de sur-ingénierie vont dans leur section dédiée (voir Étape 6), classés par coût :
une abstraction traversée à chaque lecture du module coûte plus qu'une option morte dans un coin.

Limiter à ~15 findings au total, sur-ingénierie comprise — grouper les mineurs si nombreux.
Ce plafond protège de la noyade, ce n'est pas un objectif de brièveté : n'écarter un finding vérifié
que s'il est réellement négligeable, jamais pour tenir un quota bas. Sur un codebase de taille
réelle, une revue sérieuse atteint souvent ce plafond — un rapport de trois findings sur un projet
entier doit s'expliquer par la santé du code, et le dire dans la synthèse.

## Étape 6 : Rédiger le rapport

```
## Revue de code — [scope]

### Synthèse
[2-3 phrases : état général, axes d'amélioration principaux, zones non couvertes.]

### Findings critiques
[Si aucun : "Aucun problème critique identifié."]

1. **[Titre court]** — `chemin/fichier.ext:ligne`
   [Le problème et sa conséquence concrète.]
   → [Suggestion spécifique et actionnable.]

### Findings importants
[Même format]

### Sur-ingénierie détectée
[Si aucune : "Pas de complexité manifestement injustifiée relevée."]

1. **[Titre court]** — `chemin/fichier.ext:ligne`
   [Ce que le code fait, et la version plus simple qui ferait la même chose.]
   Vérifié : [usages trouvés / historique / contrainte externe absente]
   → [Simplification concrète, avec son ampleur.]

### Findings mineurs
[Même format, groupés si nombreux]

### Recommandations générales
[Patterns récurrents, refactorings structurels, points incertains formulés en questions.]

### Périmètre couvert
- Fichiers analysés : [nombre]
- Fichiers exclus (politique sécurité) : [nombre et raison]
- Zones non couvertes : [liste]
```

### Règles de rédaction

- Toujours référencer fichier + ligne, ou nom de fonction
- Suggestions **spécifiques** (nom proposé, pattern à appliquer), jamais génériques
- Pour un finding de sur-ingénierie, **montrer la vérification** en une ligne (« un seul usage,
  aucun mock en test, introduit sans motif dans le commit initial ») — c'est ce qui distingue
  l'observation de la supposition
- Pas de score de confiance chiffré ; l'incertitude se dit en mots, dans « Recommandations »
- Une section de findings vide se justifie en une clause (« aucune frontière réseau dans ce
  périmètre », « chemins d'erreur déjà couverts par les tests ») plutôt que par un simple « aucun » :
  le lecteur doit pouvoir distinguer « vérifié, rien à dire » de « pas regardé »
- Ne pas proposer de réécriture globale ni de changement d'architecture non sollicité
- L'absence de tests n'est un finding que si le projet en a par ailleurs — sinon, une
  recommandation générale
- Ne JAMAIS citer de valeurs ressemblant à des secrets (chaînes base64 longues, tokens, clés API)
  même trouvées en dur — signaler leur présence sans les reproduire
- Si un finding concerne un secret en dur : « secret en dur détecté dans [fichier]:[ligne] »,
  sans la valeur
- Ne pas inclure de chemins complets vers des fichiers de configuration sensibles
