---
name: git-commit-messages
description: |
  Génère et rédige des messages de commit Git professionnels pour les changements
  en staging. Crée des commits clairs au mode impératif en anglais avec formatage
  approprié. Utilise ce skill pour générer un commit, générer le commit, générer
  les commits nécessaires, créer un commit, committer les changements, écrire un
  message de commit, ou modifier des commits existants.
  Déclenché par: "génère [le/un/les] commit[s]", "crée [le/un] commit",
  "commit [ces changements/les modifications]", "écris le message de commit",
  "generate commit", "create commit", "write commit message", "stage and commit".
---

# Rédaction de messages de commit Git

Ce skill aide à rédiger des messages de commit professionnels, clairs et actionnables suivant les meilleures pratiques de l'industrie.

## Structure du message

Les messages de commit se composent de deux parties :

- **Sujet** : Première ligne, sert de titre au commit
- **Corps** : Explication détaillée optionnelle après une ligne vide

## Règles pour le sujet

### Mode impératif

Rédiger les sujets comme des commandes (complétant "This commit will...") :

- ✅ "Add user authentication endpoint"
- ✅ "Fix memory leak in data processor"
- ❌ "Added authentication" (passé)
- ❌ "Adding authentication" (présent continu)

### Verbes d'action descriptifs

Utiliser des verbes spécifiques plutôt que génériques :

- ✅ "Implement", "Refactor", "Optimize", "Extract", "Introduce"
- ❌ À éviter : "Fix", "Update", "Add", "Remove", "Change" (trop vagues)

Quand les verbes génériques sont nécessaires, ajouter un contexte spécifique :

- ✅ "Fix memory leak in user session handler"
- ✅ "Update dependencies to address security vulnerabilities"

### Placer l'information importante en premier

Placer les informations clés dans les 50 premiers caractères (visibles dans la plupart des outils Git) :

- ✅ "Optimize database queries for user dashboard"
- ❌ "Make some optimizations to improve the performance of database queries"

### Formatage

- Première lettre en majuscule
- Pas de point final
- Garder sous 72 caractères quand possible

## Formatage du corps

### Quand inclure un corps

- Le sujet est auto-explicatif → Pas de corps nécessaire
- Changements complexes → Ajouter une explication détaillée
- Contexte nécessaire → Expliquer le "pourquoi", pas seulement le "quoi"

### Structure du corps

- Séparer le sujet du corps par une ligne vide
- Indenter chaque ligne avec 4 espaces pour une meilleure lisibilité
- Limiter la longueur des lignes à 80 caractères
- Utiliser des puces (`-`) pour les changements multiples (toujours préférer `-` à `*`)
- Ajouter des unicode/emojis avec parcimonie s'ils améliorent la clarté

### Directives de contenu

- Expliquer **pourquoi** le changement a été fait
- Décrire **quel** problème il résout
- Mentionner le **contexte** s'il n'est pas évident depuis le code
- Lier aux issues si pertinent : `Refs: #123` (seulement si l'issue existe)
- Éviter la redondance avec le sujet

### Co-auteurs

- **N'ajouter JAMAIS de mentions `Co-authored-by:`** sauf si explicitement demandé par l'utilisateur
- Les trailers de co-auteur ne doivent être inclus que lorsque l'utilisateur fournit explicitement les noms et emails des contributeurs
- Format attendu si requis : `Co-authored-by: Name <email@example.com>`

## Workflow

### 1. Vérifier la zone de staging

Avant d'écrire le message de commit :

```bash
git status
git diff --staged
```

Si la zone de staging est vide, stager d'abord les changements :

```bash
git add <files>
```

### 2. Analyser les changements

- Quel est l'objectif principal de ce commit ?
- Quel problème résout-il ?
- Y a-t-il un contexte qui ne sera pas évident depuis le diff ?

### 3. Rédiger le sujet

- Commencer par un verbe impératif
- Être spécifique sur ce qui a changé
- Placer l'information importante en premier

### 4. Décider si un corps est nécessaire

Se demander :

- Le sujet est-il complet et clair en soi ?
- Y a-t-il un contexte qui aiderait les futurs lecteurs ?
- Y a-t-il plusieurs changements liés ?

### 5. Formater le corps (si nécessaire)

- Ligne vide après le sujet
- Indenter avec 4 espaces
- Utiliser des puces pour plusieurs éléments
- Garder les lignes sous 80 caractères

### 6. Vérifier la compatibilité terminal

Les messages doivent pouvoir être copiés/collés dans un terminal sans modifications :

- Pas de caractères spéciaux nécessitant un échappement
- Encodage UTF-8 valide
- Retours à la ligne au format standard

## Exemples

### Commit simple (sans corps)

```
Implement JWT-based user authentication
```

### Commit avec corps

```
Refactor database connection pooling logic

    The previous implementation created a new connection for each request,
    causing performance degradation under load.

    - Implement connection pool with configurable size
    - Add connection timeout handling
    - Reuse connections across requests

    Refs: #456
```

Pour des exemples plus complets par cas d'usage, voir [references/good-commits.md](./references/good-commits.md).

## Ressources de référence

- Référence de format : Voir [commit-template.txt](./references/commit-template.txt)
- Plus d'exemples : Voir [good-commits.md](./references/good-commits.md)

## Collecte de contexte

Si tu n'as pas accès à la zone de staging, demander à l'utilisateur :

- Quels fichiers sont committés ?
- Quel est le changement ou la fonctionnalité principale ?
- Y a-t-il un contexte qui aiderait à expliquer le changement ?

## Conseils

- **Un changement logique par commit** : Si tu te retrouves à utiliser "et" plusieurs fois, considère de séparer en plusieurs commits
- **Tester avant de committer** : S'assurer que le code fonctionne et que les tests passent
- **Réviser le diff** : S'assurer de committer ce qui est prévu
- **Penser au futur toi** : Rédiger des messages qui auront du sens dans 6 mois
