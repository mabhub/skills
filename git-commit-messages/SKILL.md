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

**Le corps est optionnel, et l'absence de corps est un résultat valide.** Un
corps qui ne fait que redire le diff en prose est du bruit, pas de la
documentation.

Un corps se justifie dès que l'une de ces conditions tient :

- Le sujet seul ne suffit pas à comprendre le changement
- Le **rôle** du changement ou le **pourquoi** restent invisibles, même si le
  *quoi* est limpide dans le diff — un diff parfaitement lisible ne rend pas le
  corps inutile
- Le changement a des conséquences qui dépassent les lignes modifiées

Sinon, s'arrêter au sujet. Ce qu'il faut alors écrire est décrit plus bas, en
[Directives de contenu](#directives-de-contenu).

### Structure du corps

- Séparer le sujet du corps par une ligne vide
- Indenter chaque ligne avec 4 espaces pour une meilleure lisibilité
- Limiter la longueur des lignes à 80 caractères
- Utiliser des puces (`-`) pour les changements multiples (toujours préférer `-` à `*`)
- Ajouter des unicode/emojis avec parcimonie s'ils améliorent la clarté

### Directives de contenu

Trois axes structurent un corps utile :

- **Pourquoi** le changement a été fait : cause racine, symptôme observé,
  contrainte externe invisible dans le code (bug d'un outil tiers, limite
  d'API, décision produit)
- **Quel** problème il résout
- **Ce qu'il permet** : le rôle du changement dans l'ensemble — ce qui devient
  possible, ce qu'il débloque pour la suite, ce qu'il autorise à supprimer plus
  tard. Un diff peut être parfaitement clair sans que sa finalité le soit ;
  c'est souvent l'information la plus durable du message.

Compléments utiles selon le cas :

- Les alternatives écartées et la raison de leur rejet
- Les conséquences non locales : rupture de compatibilité, migration requise,
  effet de bord sur un autre composant
- Ce qui n'a **volontairement pas** été fait, et pourquoi
- Le **contexte** s'il n'est pas évident depuis le code
- Lier aux issues si pertinent : `Refs: #123` (seulement si l'issue existe)
- Éviter la redondance avec le sujet

### Ne pas paraphraser le diff

Le diff est joint au commit et reste lisible indéfiniment. Le corps sert donc
en priorité à écrire ce que le diff ne montre pas de lui-même : ce qui s'en
déduit directement peut généralement être laissé de côté, au profit du sens.

Formulations qui n'apportent typiquement rien de plus que le diff :

- L'inventaire des fichiers touchés (`git show --stat` le donne déjà)
- Les noms de fonctions/classes/constantes ajoutées, renommées ou supprimées
- Le récit ligne à ligne de la modification ("remplace la boucle `for` par un
  `map`", "ajoute le champ `timeout` à la config")
- La reformulation en prose d'un changement de valeur ("passe le délai de 30 à
  60 secondes") — utile en revanche si le **pourquoi** de la valeur est donné
- Les comptages décoratifs ("3 nouveaux tests", "12 fichiers migrés")
- La répétition d'un message d'erreur, d'un log ou d'un commentaire déjà ajouté
  dans le code par ce même commit

**Test de l'information déductible** : pour chaque puce envisagée, se demander
« un lecteur qui a le diff sous les yeux apprend-il quelque chose ? ». Si la
réponse est non, la puce peut sauter. Si toutes les puces tombent, le sujet
suffit probablement.

**Exemple** — même commit, corps gonflé puis corps utile :

❌ Paraphrase du diff :

```
Increase upload timeout for large attachments

    - Change UPLOAD_TIMEOUT from 30 to 60 in config.js
    - Update the timeout parameter in uploadFile()
    - Adjust the corresponding test assertion
```

✅ Information non déductible :

```
Increase upload timeout for large attachments

    The upstream proxy buffers request bodies before forwarding them, which
    adds up to 25s on attachments over 50MB. The old timeout cut the
    connection before the proxy was done.

    60s matches the proxy's own limit; aligning both avoids a client retry
    that re-uploaded the whole file.
```

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

Confronter le commit aux conditions de [Quand inclure un
corps](#quand-inclure-un-corps). Si aucune ne tient, le sujet suffit.

Si l'une tient, appliquer le test de l'information déductible (voir [Ne pas
paraphraser le diff](#ne-pas-paraphraser-le-diff)) et garder ce qui y survit.

Ne pas rédiger un corps par réflexe parce que le diff est volumineux — un gros
diff mécanique (renommage, migration, reformatage) se passe souvent
d'explication, alors qu'un diff d'une ligne peut en exiger une.

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

    Creating one connection per request saturated the database past ~200
    concurrent users, where latency went from 40ms to several seconds.

    Also unblocks the read-replica routing planned in #457, which needs a
    single place to pick a connection.

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
