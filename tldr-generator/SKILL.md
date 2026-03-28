---
name: tldr-generator
description: >
  Génère des résumés TL;DR en français pour articles Markdown.
  Utilise cette skill quand l'utilisateur demande de générer un TLDR,
  résumer un article, créer une version condensée, ou synthétiser du contenu.
  Trigger phrases: "génère [un/le/les] TLDR", "résume [l'article/cet article]",
  "crée [un/le] résumé", "synthétise [le contenu/l'article]".
---

# Générateur de résumés TL;DR

## Processus de génération

### 1. Identification des articles

Utiliser le script JavaScript pour lister tous les articles nécessitant un TL;DR, triés par priorité (articles les plus longs en premier) :

```bash
node tldr-generator/scripts/identify-articles.mjs
```

**Sortie JSON pour traitement automatisé :**

```bash
node tldr-generator/scripts/identify-articles.mjs --json
```

### 2. Analyse préliminaire (optionnel)

Avant de générer le TL;DR, analyser l'article pour déterminer son type et obtenir des recommandations :

```bash
node tldr-generator/scripts/analyze-article.mjs "nom-article.md"
```

Cette commande fournit :
- Type d'article détecté
- Statistiques (mots, temps de lecture, structure)
- Template recommandé
- Objectif de mots pour le TL;DR
- Conseils spécifiques

**Sortie JSON :**

```bash
node tldr-generator/scripts/analyze-article.mjs "nom-article.md" --json
```

### 3. Critères de génération

Pour chaque fichier `.md` (hormis `README.md`, `INDEX.md` et fichiers système), créer un fichier `.tldr.md` correspondant **s'il n'existe pas déjà**.

### 4. Spécifications du contenu TL;DR

#### Style rédactionnel

- **Équilibre style/structure** : Combiner style rédactionnel fluide et listes de faits structurées
- **Éviter le style haché** : Ne pas se limiter à des listes à puces exclusivement
- **Préservation d'informations** : Conserver un maximum d'informations de l'article original
- **Front-matter enrichi** : Reprendre et compléter la logique du front-matter de l'article source

#### Contraintes de longueur

- **Temps de lecture cible** : **moins de 3 minutes de lecture**
- **Estimation** : ~750 mots maximum, selon la complexité du sujet
- Ne pas allonger inutilement le texte
- Pas de limite maximale de réduction : un long article peut avoir une réduction de 80-90% si le TL;DR reste informatif

### 5. Structure suggérée du TL;DR

Consulter `TEMPLATES.md` pour des exemples concrets de structures selon le type d'article.

**Structure générique :**

1. **Front-matter enrichi** :
   - Reprendre les métadonnées originales (created, source, author)
   - Ajouter des tags thématiques pertinents
   - Ajouter champs optionnels : `type`, `themes`, etc.

2. **Résumé exécutif** (2-3 paragraphes) :
   - Synthèse des points clés
   - Message principal de l'article
   - Conclusion ou implication majeure

3. **Corps structuré** (adapté au contenu) :
   - **Articles analytiques** : Contexte → Analyse → Implications
   - **Articles techniques** : Présentation → Fonctionnement → Cas d'usage
   - **Articles d'actualité** : Faits → Contexte → Conséquences
   - **Articles opinion** : Thèse → Arguments → Conclusion

4. **Sections spécifiques** (si pertinent) :
   - Faits marquants avec dates, chiffres, noms
   - Citations importantes
   - Liens et références essentiels

### 6. Méthodologie de rédaction

#### Analyse du contenu source

1. **Lire l'article complet** pour comprendre le contexte global
2. **Identifier les informations essentielles** :
   - Qui ? Quoi ? Quand ? Où ? Pourquoi ? Comment ?
   - Thèse principale et arguments clés
   - Données chiffrées et faits vérifiables
3. **Extraire la chronologie** des événements si applicable
4. **Repérer les acteurs principaux** et leurs positions
5. **Analyser les enjeux** sous-jacents et implications

#### Rédaction du résumé

1. **Commencer par le résumé exécutif** :
   - Formuler en 2-3 phrases l'essentiel
   - Répondre à "Pourquoi ce texte existe ?"

2. **Structurer logiquement** :
   - Progression du général au particulier
   - Ou chronologique si événementiel
   - Ou thématique si analytique

3. **Préserver les éléments factuels** :
   - Dates exactes
   - Noms propres (personnes, organisations, lieux)
   - Chiffres et statistiques
   - Citations marquantes (reformulées si trop longues)
   - Références et liens importants

4. **Maintenir le ton** :
   - Journalistique pour articles de presse
   - Technique pour documentation
   - Analytique pour essais
   - Neutre et factuel par défaut

5. **Éviter** :
   - Répétitions inutiles (sauf si essentielles à la compréhension)
   - Détails anecdotiques non pertinents
   - Informations redondantes
   - Longueurs injustifiées

#### Validation qualité

Consulter `VALIDATION.md` pour les critères détaillés. Points clés :

1. **Complétude** : Toutes les informations clés sont-elles présentes ?
2. **Fluidité** : Le texte se lit-il naturellement ?
3. **Longueur** : Respecte-t-on la contrainte des 3 minutes (~750 mots) ?
4. **Front-matter** : Est-il cohérent et enrichi ?
5. **Fidélité** : Le TL;DR reflète-t-il fidèlement l'article ?

**Validation automatique des métriques :**

```bash
node tldr-generator/scripts/validate-metrics.mjs "article.tldr.md"
```

Cette commande vérifie :
- Nombre de mots (max 750)
- Temps de lecture (max 3 min)
- Réduction par rapport à l'original
- Présence des champs requis dans le front-matter
- Nombre de tags

**Validation approfondie (Python) :**

```bash
python tldr-generator/scripts/validate_tldr.py "article.tldr.md"
```

Cette commande vérifie en plus :
- Structure du document
- Longueur des paragraphes
- Syntaxe des liens
- Encodage UTF-8

### 7. Cas particuliers

#### Articles très longs (> 5000 mots)

- Privilégier l'approche thématique
- Utiliser des sous-sections claires
- Rester sous 750 mots malgré la longueur source
- Réduction > 80% acceptable si informatif

#### Articles très techniques

- Préserver la terminologie technique
- Expliquer brièvement les concepts clés
- Maintenir la précision des spécifications
- Utiliser listes à puces pour données structurées

#### Articles d'opinion/essais

- Identifier clairement la thèse
- Résumer les arguments principaux (3-5 max)
- Préserver les nuances importantes
- Indiquer la conclusion de l'auteur

#### Articles multi-sujets

- Créer des sections thématiques claires
- Traiter chaque sujet proportionnellement à son importance
- Maintenir les liens logiques entre sujets

## Notes d'implémentation

- **Langue** : toujours en français
- **Nom de fichier** : `[nom-article].tldr.md` (même nom que l'original avec `.tldr` avant `.md`)
- **Placement** : même répertoire que l'article original
- **Encodage** : UTF-8
- **Format Markdown** : respecter les conventions (front-matter YAML, syntaxe standard)

## Adaptation du niveau de détail

Le niveau de détail doit être adapté selon :

- **Complexité** : plus l'article est complexe, plus il faut d'explications
- **Public cible** : lecteurs recherchant information complète mais synthétisée
- **Densité informationnelle** : article très dense = TLDR plus structuré
- **Type de contenu** : actualité vs. analyse vs. technique vs. opinion

**Principe directeur** : Le lecteur du TL;DR doit pouvoir comprendre l'essentiel sans lire l'original, tout en ayant suffisamment d'informations pour décider s'il veut approfondir.
