---
name: rda-authoring
description: Guide de rédaction des RDA (Records of Decision Architecture) avec standards de formatage français, incluant structure, workflow de validation et processus de revue. À utiliser lors de la création ou révision de documents d'architecture décisionnelle.
---

# Rédaction de RDA (Records of Decision Architecture)

Ce skill aide à rédiger des documents d'architecture décisionnelle (RDA) professionnels, structurés et complets, suivant un formalisme précis.

## Qu'est-ce qu'un RDA ?

Un RDA (Record of Decision Architecture) documente une décision architecturale importante dans un projet. Il capture le **contexte**, les **options considérées**, la **décision prise** et ses **conséquences**.

**Objectif** : Tracer les décisions techniques majeures pour comprendre les choix passés et leurs raisons.

## Structure obligatoire

### En-tête

Chaque RDA doit commencer par :

```markdown
---
title: RDA [Domaine]-[Sujet principal]
---
- 📅 Date : YYYY-MM-DD
- 🔄 Version : [1.0 | 1.1 | etc.]
- 👥 Décision prise par : [Nom de l'organisation/équipe]
- 🗳️ Proposition par : [Nom de l'organisation/équipe] (optionnel si différent du décideur)
- 👀 Revue par : [Nom des relecteurs] (optionnel)
```

**Conventions de nommage :**

- **Domaine** : Data, Map, Architecture, API, Frontend, Backend, etc.
- **Sujet principal** : description concise du sujet traité
- **Exemples** :
  - `RDA Data-Mode de mise à disposition de trajectoires`
  - `RDA Map-Regroupement thématique des données`
  - `RDA API-Stratégie de versioning`

### Sections du document

#### 1. Statut

**Format** : Une ligne avec le statut actuel

**Valeurs possibles** :

- `Proposé` : En cours de discussion
- `Work in Progress 👷` : En rédaction
- `Accepté` : Décision validée et appliquée
- `Rejeté` : Proposition refusée
- `Obsolète` : Remplacé par un autre RDA

**Exemple** :

```markdown
## Statut

Accepté
```

#### 2. Contexte

**Contenu** :

- Description claire du problème à résoudre
- Contraintes techniques, opérationnelles ou métier
- Enjeux et impacts potentiels
- Cas d'usage concernés

**Exemple** :

```markdown
## Contexte

L'application demande l'affichage de données cartographiques avec les
contraintes suivantes : performance, précision, adaptabilité,
disponibilité et efficacité.

Les utilisateurs doivent pouvoir visualiser simultanément plusieurs
couches de données sur des fonds de carte variés, avec des temps de
réponse inférieurs à 2 secondes.
```

#### 3. Options envisagées 💡

**Format** : Minimum 2-3 options avec avantages/inconvénients équilibrés

Pour chaque option :

- Description concise de l'approche
- 👍 **Avantages** : liste à puces
- 🚫 **Inconvénients** : liste à puces

**Exemple** :

```markdown
## Options envisagées 💡

### Option 1 : Tuiles raster pré-générées

Description : Utiliser des tuiles PNG/JPEG générées à l'avance et
servies par un CDN.

👍 **Avantages** :
- Performance élevée (images statiques)
- Cache CDN efficace
- Compatible tous navigateurs

🚫 **Inconvénients** :
- Taille de stockage importante
- Mise à jour complexe
- Pas de styling dynamique
```

#### 4. Critères de décision ⚖️

**Contenu** :

- Liste des critères ayant guidé le choix
- Pondération ou priorisation si pertinent

**Critères courants** :

- Performance
- Coût (développement, infrastructure)
- Complexité technique
- Maintenabilité
- Scalabilité
- Time-to-market

**Exemple** :

```markdown
## Critères de décision ⚖️

Les critères suivants ont été utilisés, par ordre de priorité :

1. **Performance** : Temps de réponse < 2s
2. **Flexibilité** : Capacité à changer de style dynamiquement
3. **Coût** : Budget infrastructure limité
4. **Maintenabilité** : Équipe réduite
```

#### 5. Décision 🏆

**Contenu** :

- Explication claire de l'option choisie
- Justification du choix
- Détails techniques si nécessaires

**Exemple** :

```markdown
## Décision 🏆

Nous adoptons **l'option 2 : Tuiles vectorielles avec MapLibre GL JS**.

Cette solution concilie performance et flexibilité. Les tuiles
vectorielles permettent le styling dynamique côté client tout en
conservant une taille de transfert réduite grâce à la compression.

MapLibre GL JS est open-source et maintenu activement, réduisant
les risques de dépendance.
```

#### 6. Conséquences

**Contenu** :

- **Positives** : bénéfices attendus
- **Négatives** : risques et contraintes introduits
- Implications sur l'architecture, performances, maintenance

**Exemple** :

```markdown
## Conséquences

### Positives
- Styling dynamique sans rechargement
- Bande passante réduite (~75% vs raster)
- Rendu fluide même avec données denses
- Personnalisation client possible

### Négatives
- Nécessite WebGL (IE11 non supporté)
- Complexité de mise en place initiale
- Courbe d'apprentissage pour l'équipe
- Génération de tuiles vectorielles à mettre en place
```

#### 7. Migration et réversibilité 🔄

**Contenu** :

- Plan de migration si applicable
- Conditions et moyens de revenir en arrière
- Stratégie de transition ou rollback

**Exemple** :

```markdown
## Migration et réversibilité 🔄

### Plan de migration
1. Phase 1 : Configuration serveur de tuiles vectorielles (2 semaines)
2. Phase 2 : Intégration MapLibre GL JS en parallèle (1 semaine)
3. Phase 3 : Migration progressive des vues (3 semaines)
4. Phase 4 : Décommissionnement ancien système (1 semaine)

### Rollback
Possibilité de revenir à l'ancien système pendant 6 mois via feature
flag. Coût estimé du rollback : 2 jours de développement.
```

#### 8. Références et liens (optionnel)

**Contenu** :

- Liens vers documentation technique
- Standards ou spécifications
- Outils ou technologies
- **RDA liés** : autres RDA dépendants ou remplacés

**Exemple** :

```markdown
## Références et liens

- [MapLibre GL JS Documentation](https://maplibre.org/)
- [Spécification Mapbox Vector Tile](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/)
- RDA lié : RDA Map-Choix du fond de carte

**Technologies mentionnées** :
- MapLibre GL JS v3.x
- PostGIS pour génération tuiles
- Protocol Buffers (compression)
```

## Style rédactionnel

### Ton et langage

- ✅ **Français** pour le contenu principal
- ✅ **Anglais** pour termes techniques, noms d'outils, APIs
- ✅ Ton professionnel mais accessible
- ❌ Éviter le jargon inutile
- ✅ Privilégier clarté et concision

### Mise en forme

**Emojis structurants** (utiliser avec parcimonie) :

- 📅 Dates
- 🔄 Versions, migrations
- 👥 Décideurs
- 🗳️ Propositions
- 👀 Relecteurs
- 💡 Options
- ⚖️ Critères
- 🏆 Décision
- 👍 Avantages
- 🚫 Inconvénients
- 👷 Work in progress

**Formatage** :

- **Gras** pour mots-clés importants
- `Backticks` pour noms techniques, APIs, fichiers
- Listes à puces pour structuration
- Paragraphes courts (une idée par paragraphe)

### Organisation du contenu

- **Progression logique** : du général au spécifique
- **Exemples concrets** : illustrer les concepts abstraits
- **Quantification** : donner des ordres de grandeur
- **Équilibre** : présenter objectivement les options

## Workflow de rédaction

### 1. Préparation

- Identifier le problème à documenter
- Collecter le contexte technique
- Lister les parties prenantes

### 2. Recherche d'options

- Identifier minimum 2-3 approches viables
- Documenter avantages/inconvénients honnêtement
- Éviter de favoriser une option dans la présentation

### 3. Analyse et décision

- Définir les critères de choix
- Évaluer chaque option objectivement
- Documenter la décision avec justification

### 4. Documentation des conséquences

- Être réaliste sur les impacts positifs ET négatifs
- Identifier les risques
- Planifier la migration

### 5. Validation

- Relecture cohérence et complétude
- Validation technique (faisabilité)
- Approbation par l'équipe décisionnaire
- Intégration dans le dossier approprié

## Maintenance et évolution

### Versioning

- Incrémenter la version lors de modifications significatives
- Format : `1.0`, `1.1`, `2.0`, etc.
- Documenter les changements dans l'historique

### Mise à jour du statut

- `Proposé` → `Accepté` après validation
- `Accepté` → `Obsolète` si remplacé
- Référencer le RDA de remplacement

### Traçabilité

- Conserver l'historique des modifications
- Noter dates et raisons des changements
- Maintenir les liens avec RDA dépendants

## Bonnes pratiques

### ✅ À FAIRE

**Contexte bien rédigé** :

```markdown
L'application demande l'affichage de données cartographiques avec
les contraintes suivantes : performance (<2s), précision (±10m),
adaptabilité (multi-devices), disponibilité (99.9%), et efficacité
(coût CDN <500€/mois).
```

**Options équilibrées** :

- Présenter 3-4 options réalistes
- Documenter honnêtement avantages ET inconvénients
- Éviter de favoriser une option dans la présentation

**Décision justifiée** :

```markdown
Nous adoptons l'architecture hybride car elle concilie performance
(cache CDN pour 80% des cas) et flexibilité (génération dynamique
pour cas spécifiques). Le surcoût estimé (+15%) est compensé par
la réduction du temps de développement (-30%).
```

**Conséquences réalistes** :

- Identifier bénéfices ET risques
- Quantifier quand possible
- Être transparent sur les compromis

### ❌ À ÉVITER

**Contexte trop vague** :

```markdown
Il faut afficher des cartes.
```

**Option unique** :

- Présenter une seule option "évidente"
- Options déséquilibrées (une clairement meilleure)

**Décision non justifiée** :

```markdown
Nous choisissons l'option 2.
```

**Conséquences unilatérales** :

- Ne mentionner que les avantages
- Être excessivement négatif sans nuance

## Ressources de référence

- Template : Voir [rda-template.md](./references/rda-template.md)
- Exemple complet : Voir [rda-example.md](./references/rda-example.md)

## Références externes

- [Architecture Decision Records (ADR)](https://adr.github.io/)
- [MADR - Markdown ADR](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://github.com/joelparkerhenderson/architecture-decision-record)

## Collecte de contexte

Si tu manques d'informations pour rédiger un RDA, demande à l'utilisateur :

- Quel est le problème ou la décision à documenter ?
- Quelles sont les contraintes du projet ?
- Quelles options as-tu envisagées ?
- Quels critères sont importants pour la décision ?
- Y a-t-il des RDA existants liés à ce sujet ?
