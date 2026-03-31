---
name: code-review
description: >
  Use when the user wants to proactively audit an existing codebase — without link to a recent
  implementation. Triggers: "revue de code", "passe en revue le code", "analyse le code",
  "audite le projet", "code review", "nettoie le code", "assainissement", "assainir",
  "que penses-tu du code", "analyse la branche", "review la branche", "review this branch".
---

# Code Review

## Vue d'ensemble

Audit proactif d'un codebase existant pour identifier code smells, duplications, risques techniques
et améliorations potentielles. **Distinct** de `superpowers:requesting-code-review` (workflow
post-implémentation SDD) — ici l'utilisateur veut auditer/nettoyer un projet existant.

## Étape 1 : Déterminer scope et mode

### Scope (déduire depuis l'invocation)

| Signal dans le message | Scope |
|---|---|
| Pas d'argument, "le projet", "tout le code" | `projet` |
| Chemin ou composant mentionné ("src/api/", "le module auth") | `zone` |
| Nom de branche, "la branche X", "cette PR" | `branche` |

Défaut : `projet` si aucun signal.

### Mode (déduire depuis le vocabulaire)

| Signal dans le message | Mode |
|---|---|
| "nettoie", "assainit", "clean", "simplifie" | `nettoyage` — code smells + duplications seulement |
| "revue", "audit", "analyse", "review" (sans qualificatif) | `complet` — inclut architecture |

Défaut : `complet`.

### Clarification si ambigu

Si scope ambigu sur un grand projet (> 50 fichiers source), poser **une seule question** :

> Quel est le périmètre de la revue ? (projet entier / répertoire spécifique / branche Git)
> Et l'objectif : nettoyage (smells, simplification) ou revue complète avec architecture ?

## Garde-fous de sécurité

### Fichiers et répertoires exclus de l'exploration

Ne JAMAIS lire ni lister le contenu de :
- Fichiers de secrets : `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*credentials*`, `*secret*`, `*token*`
- Répertoires : `node_modules/`, `.git/`, `vendor/`, `dist/`, `build/`, `__pycache__/`
- Fichiers de lock : `*.lock`, `package-lock.json` (pas pertinents pour une revue)
- Fixtures/seeds contenant des données factices sensibles

Si un fichier exclu est détecté par Glob, le mentionner dans la synthèse comme "exclu par politique de sécurité" sans révéler son contenu.

### Règle Glob

Toujours exclure les patterns ci-dessus. Utiliser des patterns ciblés :
- ✅ `Glob("src/**/*.ts")` — ciblé
- ❌ `Glob("**/*")` — trop large, risque d'inclure des fichiers sensibles

## Étape 2 : Explorer le codebase

### Scope `projet`
1. Lister les modules principaux (`Glob` sur les répertoires sources)
2. Lire les fichiers de config (package.json, Cargo.toml, pyproject.toml, etc.)
3. Parcourir les fichiers les plus volumineux en priorité
4. Échantillonner intelligemment — noter les zones non couvertes dans le rapport

### Scope `zone`
- Lire **tous** les fichiers du répertoire ou module ciblé

### Scope `branche`
1. `git diff <base>...HEAD --name-only` pour lister les fichiers touchés
2. Lire les **fichiers complets** (pas juste le diff) — nécessaire pour détecter duplications et incohérences hors du diff

## Étape 3 : Analyser

### Toujours (modes `nettoyage` et `complet`)

- **Code smells** : fonctions trop longues, complexité cyclomatique élevée, nommage opaque, magic numbers, commentaires obsolètes
- **Duplications** : logique répétée extractible en utilitaire
- **Risques** : gestion d'erreurs absente, dépendances dangereuses, race conditions potentielles
- **Qualité** : lisibilité, cohérence de style, couplage fort

### Mode `complet` uniquement

- **Architecture** : responsabilités mal séparées, modules trop couplés, violation des patterns établis dans le projet

## Étape 4 : Prioriser les findings

| Niveau | Critère |
|---|---|
| **Critique** | Problème fonctionnel, risque sécurité ou données |
| **Important** | Dette technique significative, code fragile |
| **Mineur** | Amélioration lisibilité, nettoyage cosmétique |

Limiter à ~15 findings au total — grouper les mineurs si nombreux.

## Étape 5 : Rédiger le rapport

```
## Revue de code — [scope] ([mode])

### Synthèse
[2-3 phrases sur l'état général et les axes d'amélioration principaux]

### Findings critiques
[Si aucun : "Aucun problème critique identifié."]

1. **[Titre court]** — `chemin/fichier.ext:ligne`
   [Description du problème et pourquoi c'est problématique.]
   → [Suggestion concrète et actionnable.]

### Findings importants
[Même format]

### Findings mineurs
[Même format, groupés si nombreux]

### Recommandations générales
[Patterns récurrents, refactorings structurels à envisager]

### Périmètre couvert
- Fichiers analysés : [nombre]
- Fichiers exclus (politique sécurité) : [nombre et raison]
- Zones non couvertes : [liste]
```

### Règles de rédaction

- Toujours référencer fichier + ligne ou nom de fonction
- Suggestions **spécifiques** (nom proposé, pattern à appliquer), jamais génériques
- Pas de score de confiance
- Si zone non couverte par l'exploration, le mentionner explicitement dans la synthèse
- Ne JAMAIS citer de valeurs qui ressemblent à des secrets (chaînes base64 longues, tokens, clés API) même si trouvées en dur dans le code — signaler leur présence sans les reproduire
- Ne pas inclure de chemins complets vers des fichiers de configuration sensibles dans le rapport
- Si un finding concerne un secret en dur : dire "secret en dur détecté dans [fichier]:[ligne]" sans citer la valeur
