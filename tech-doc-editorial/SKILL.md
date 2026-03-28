---
name: tech-doc-editorial
description: Workflow d'amélioration éditoriale pour documentation technique en français, incluant corrections grammaticales, restructuration, ton, formatage et enrichissement de contenu. À utiliser lors de la révision ou amélioration de documents techniques.
---

# Amélioration éditoriale de documentation technique

## Workflow d'amélioration (5 étapes)

### 1. Corrections grammaticales et linguistiques

**Actions** :

- Corriger toutes les erreurs grammaticales, d'orthographe et de syntaxe
- Harmoniser les accords (pluriel/singulier, genre, conjugaisons)
- Éliminer les anglicismes inappropriés
- Améliorer la fluidité et la lisibilité des phrases

**Exemples** :

❌ **Avant** :

```
Les données est chargées depuis l'API et ils sont affichés dans le tableau.
```

✅ **Après** :

```
Les données sont chargées depuis l'API et affichées dans le tableau.
```

---

❌ **Avant** :

```
Cliquer sur le bouton pour loader les résultats.
```

✅ **Après** :

```
Cliquer sur le bouton pour charger les résultats.
```

### 2. Structure et cohérence

**Actions** :

- Restructurer le contenu avec une hiérarchie claire et logique
- Créer des sections thématiques distinctes si nécessaire
- Uniformiser les titres et sous-titres (format et style)
- Assurer une progression logique de l'information

**Principes** :

- **Progression** : Du général au spécifique, du concept à l'implémentation
- **Hiérarchie** : Utiliser correctement les niveaux de titre (H2, H3, H4)
- **Sections courtes** : Une section = une idée principale
- **Transitions** : Assurer la fluidité entre sections

**Exemple** :

❌ **Avant** (structure confuse) :

```markdown
# Ma fonctionnalité
Voici comment l'utiliser. Elle fait beaucoup de choses.
## Exemple
...
## Qu'est-ce que c'est ?
...
```

✅ **Après** (structure logique) :

```markdown
# Nom de la fonctionnalité

## Présentation

[Qu'est-ce que c'est, pourquoi c'est utile]

## Utilisation

[Comment l'utiliser]

## Exemples

[Cas concrets]
```

### 3. Ton et accessibilité

**Actions** :

- Adopter un ton professionnel mais accessible
- Remplacer le jargon technique par des termes plus compréhensibles quand possible
- Utiliser un langage engageant avec des verbes d'action
- Privilégier les phrases courtes et claires

**Principes du ton** :

- **Professionnel** : Crédible et technique
- **Accessible** : Compréhensible par le public cible
- **Engageant** : Utiliser l'actif plutôt que le passif
- **Humain** : Tutoiement ou vouvoiement selon le contexte

**Exemples** :

❌ **Avant** (passif, technique) :

```
La configuration peut être modifiée via l'interface d'administration
où les paramètres seront ajustés selon les besoins.
```

✅ **Après** (actif, engageant) :

```
Vous pouvez personnaliser la configuration depuis l'interface
d'administration en ajustant les paramètres selon vos besoins.
```

---

❌ **Avant** (jargon) :

```
Le payload est sérialisé en JSON avant d'être envoyé au endpoint REST.
```

✅ **Après** (plus accessible) :

```
Les données sont converties au format JSON avant l'envoi vers l'API REST.
```

### 4. Formatage et présentation

**Actions** :

- Utiliser le **gras** pour les concepts clés et termes importants
- Structurer l'information avec des listes à puces quand approprié
- Améliorer les descriptions avec des bénéfices utilisateur concrets
- Optimiser les sections d'information (Info, Notes, etc.)

**Règles de formatage** :

| Élément       | Format       | Usage                                    |
|---------------|--------------|------------------------------------------|
| Concepts clés | `**texte**`  | Termes importants à retenir              |
| Code inline   | `` `code` `` | Noms de variables, fonctions, propriétés |
| Blocs de code | ` ```lang ` | Exemples de code complets |
| Liens | `[texte](url)` | Références et ressources |
| Listes | `- item` | Énumérations, étapes |
| Citations | `> texte` | Mises en garde, notes importantes |

**Exemples** :

❌ **Avant** (peu structuré) :

```
Cette fonction prend trois paramètres : name qui est le nom, 
age qui est l'âge et email qui est l'email.
```

✅ **Après** (bien formaté) :

```
Cette fonction accepte trois paramètres :

- **name** : Le nom de l'utilisateur
- **age** : L'âge en années
- **email** : L'adresse email de contact
```

### 5. Enrichissement du contenu

**Actions** :

- Ajouter des contextes d'usage pratiques
- Inclure des recommandations ou cas d'usage quand pertinent
- Enrichir les descriptions avec la valeur ajoutée fonctionnelle
- Améliorer les introductions pour expliquer l'importance du sujet

**Principes** :

- **Valeur utilisateur** : Expliquer le "pourquoi" et les bénéfices
- **Cas concrets** : Illustrer par des exemples pratiques
- **Contexte** : Situer la fonctionnalité dans un usage réel
- **Recommandations** : Guider vers les bonnes pratiques

**Exemples** :

❌ **Avant** (descriptif sec) :

```
## Fonction de filtrage

La fonction filter() permet de filtrer un tableau.
```

✅ **Après** (enrichi) :

```
## Fonction de filtrage

La fonction **filter()** permet d'extraire un sous-ensemble d'éléments
d'un tableau selon un critère, idéal pour afficher uniquement les
données pertinentes à l'utilisateur.

**Cas d'usage typiques** :
- Filtrer les produits par catégorie dans un catalogue
- Afficher uniquement les tâches non terminées
- Sélectionner les utilisateurs actifs

> 💡 **Conseil** : Pour de grandes collections (>1000 éléments),
> envisagez un filtrage côté serveur pour de meilleures performances.
```

## Contraintes à respecter

### Préservation de la structure

- **MDX et composants** : Conserver exactement les composants Storybook, React, etc.
- **Liens et références** : Maintenir tous les liens internes et externes
- **Exactitude technique** : Ne jamais modifier le sens technique
- **Exemples de code** : Garder le code fonctionnel et correct

### Style et cohérence

- **Ton uniforme** : Maintenir le même ton dans tout le document
- **Longueur de ligne** : Limiter à ~100 caractères quand possible (lisibilité)
- **Terminologie** : Utiliser des termes cohérents (glossaire si nécessaire)
- **Conventions** : Respecter les conventions du projet (tutoiement/vouvoiement)

## Exemples de transformations complètes

### Exemple 1 : Section descriptive

❌ **Avant** :

```markdown
## Fonds de carte

La possibilité de changer le fond de carte est une fonctionnalité
courante qui permet de modifier l'apparence. Il y a plusieurs options
disponibles.
```

✅ **Après** :

```markdown
## Fonds de carte

Les **fonds de carte** constituent la base visuelle de toute application
cartographique. Ils fournissent le contexte géographique sur lequel vos
données sont affichées.

**Pourquoi c'est important** : Le choix du fond de carte impacte
directement la lisibilité de vos données et l'expérience utilisateur.

**Options disponibles** :
- **Satellite** : Imagerie aérienne haute résolution
- **Streets** : Carte routière détaillée avec noms de rues
- **Terrain** : Relief et topographie
```

### Exemple 2 : Documentation d'API

❌ **Avant** :

```markdown
## fetchData

fetchData(url, options) récupère les données.
```

✅ **Après** :

```markdown
## fetchData()

Récupère des données depuis une API REST de manière asynchrone.

**Signature** :
```typescript
fetchData(url: string, options?: FetchOptions): Promise<Data>
```

**Paramètres** :

- **url** : L'URL de l'endpoint API
- **options** (optionnel) : Configuration de la requête (headers, méthode, etc.)

**Valeur de retour** : Promise qui résout avec les données récupérées

**Exemple d'utilisation** :

```typescript
const users = await fetchData('/api/users', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});
```

> ⚠️ **Note** : Penser à gérer les erreurs avec un bloc try/catch.

```

### Exemple 3 : Guide d'utilisation

❌ **Avant** :
```markdown
Pour utiliser ce composant il faut l'importer et le mettre dans le code.
```

✅ **Après** :

```markdown
## Utilisation

### 1. Importer le composant

```jsx
import { DataTable } from '@components/DataTable';
```

### 2. Intégrer dans votre interface

```jsx
<DataTable 
  data={users}
  columns={['name', 'email', 'role']}
  onRowClick={handleRowClick}
/>
```

### 3. Personnaliser l'affichage

Le composant accepte plusieurs props pour personnaliser l'apparence :

- **striped** : Lignes alternées en couleur
- **compact** : Espacement réduit entre les lignes
- **sortable** : Activation du tri par colonne

**Exemple complet** :

```jsx
<DataTable 
  data={users}
  columns={columns}
  striped
  sortable
  onSort={handleSort}
/>
```

```

## Checklist de révision

Avant de finaliser, vérifier :

- [ ] **Grammaire** : Aucune erreur d'orthographe, syntaxe, conjugaison
- [ ] **Structure** : Hiérarchie logique, progression claire
- [ ] **Ton** : Cohérent, professionnel et accessible
- [ ] **Formatage** : Gras, listes, code bien utilisés
- [ ] **Enrichissement** : Contexte, valeur utilisateur, exemples
- [ ] **Préservation** : Structure MDX, liens, exactitude technique intacte
- [ ] **Longueur** : Lignes ~100 caractères maximum
- [ ] **Cohérence** : Terminologie uniforme dans tout le document

## Ressources de référence

- Checklist : Voir [editorial-checklist.md](./checklists/editorial-checklist.md)
- Exemples : Voir [before-after.md](./examples/before-after.md)

## Collecte de contexte

Si tu manques d'informations pour améliorer un document, demande à l'utilisateur :

- Quel est le public cible du document ?
- Y a-t-il des conventions de style à respecter (tutoiement/vouvoiement) ?
- Y a-t-il des contraintes spécifiques au projet (MDX, composants) ?
- Quel est le niveau de détail attendu ?
- Y a-t-il un glossaire ou des termes spécifiques à utiliser ?

## Livrable

Proposer une version complète et améliorée du document en appliquant toutes ces directives, accompagnée d'un bref résumé des principales améliorations apportées.
