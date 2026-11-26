---
name: javascript-conventions
description: >
  Standards JavaScript/Node.js (style fonctionnel, ESM, async/await, JSDoc,
  formatage) pour tout code JS/TS : scripts Node, front navigateur,
  automatisation, sauf conventions de projet déjà établies.
---

# JavaScript Conventions

## Priorité et conventions du projet

Ce skill vaut **là où le projet ne dit rien**. Ordre de priorité, du plus fort au plus faible :

1. configuration de lint et de formatage du projet (ESLint, oxlint, Biome, Prettier, oxfmt…) ; si le nombre d'erreurs est très élevé, interroger l'utilisateur avant de procéder ;
2. conventions documentées par le projet : section du `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, skill local ;
3. conventions observées dans le code du projet ;
4. ce skill.

**Fond et forme.** Les règles de fond (§5 ESM, §6 async/await, `AbortSignal`, `cause`, §11 comparaisons strictes, §12 immutabilité, §14 cible) s'appliquent tant que le projet ne les contredit pas explicitement. Les règles de forme (§2 fonctions fléchées, §3 formatage, §4 JSDoc, §7 objets de correspondance, §8 objets d'options) cèdent aussi à ce qu'on observe dans le code.

**Observer une fois, consigner, ne plus relire.** Lire des fichiers voisins avant chaque écriture coûte cher ; l'observation se fait une fois par projet :

- le projet documente ses conventions (niveau 2) : les appliquer sans lecture supplémentaire ;
- il ne les documente pas et la tâche crée du code nouveau : observer une fois quelques fichiers représentatifs et récents (forme seulement : déclaration des fonctions et composants, imports, types, commentaires et JSDoc, tests), puis proposer à l'utilisateur de consigner le résultat, daté, dans le `CLAUDE.md` du projet ; sans accord, s'en tenir à cette observation pour la session, sans la refaire à chaque fichier ;
- modification d'un fichier existant : ce fichier sert de référence (il est lu de toute façon), aucune lecture de plus.

Consigner les pratiques comme des constats, pas comme des interdictions : « JSDoc rare » ou « aucun test de composant » décrit l'existant. Un ajout de ce type reste possible quand il est utile, signalé comme nouveauté ; seules les règles que le projet énonce lui-même (lint, documentation, remarques de revue) deviennent des directives.

Revoir la section consignée sur signal, pas à intervalle fixe : remarque de revue qui la contredit, échec de lint sur une règle de forme, fichier récent qui s'en écarte nettement.

## Standards de Codage

### 1. Langue

**Anglais par défaut**

- Tout le code (variables, fonctions, classes, constantes) doit être en anglais
- Tous les commentaires de code et JSDoc doivent être en anglais
- Les messages utilisateur peuvent être localisés selon le contexte

```javascript
// ✅ Correct
const userName = 'Alice';
/**
 * Compute the total price including tax
 * @param {number} price - Base price
 * @param {number} taxRate - Tax rate as decimal
 * @returns {number} Total price with tax
 */
const calculateTotal = (price, taxRate) => price * (1 + taxRate);

// ❌ Éviter
const nomUtilisateur = 'Alice';  // Code en français
/**
 * Calcule le prix total avec taxe  // Commentaire en français
 */
const calculerTotal = (prix, tauxTaxe) => prix * (1 + tauxTaxe);
```

### 2. Paradigme de Programmation

**Programmation fonctionnelle > POO**

- Privilégier les fonctions pures et la programmation fonctionnelle
- N'utiliser la programmation objet que si elle apporte un avantage indéniable

**Arrow functions par défaut**

```javascript
// ✅ Correct
const add = (a, b) => a + b;

const fetchUser = async id => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};

// ❌ Éviter (unless `this` context is needed)
function add(a, b) {
  return a + b;
}
```

**Exception :** Utiliser les fonctions classiques uniquement quand le contexte `this` est nécessaire (méthodes d'objet, callbacks avec binding).

### 3. Formatage

**Points-virgules obligatoires**

```javascript
// ✅ Correct
const x = 42;
console.log(x);
```

**Dangling commas sur multilignes**

```javascript
// ✅ Correct
const config = {
  name: 'app',
  version: '1.0.0',
  dependencies: ['express', 'dotenv'],  // trailing comma
};

const items = [
  'first',
  'second',
  'third',  // trailing comma
];
```

**Pas d'espaces blancs en fin de ligne**

- Exception : les chaînes de caractères peuvent intentionnellement en contenir
- Configurer l'éditeur pour supprimer automatiquement les trailing whitespaces sur les lignes de code modifiées

### 4. Documentation

**JSDoc systématique**

```javascript
/**
 * Calculates the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum of a and b
 */
const add = (a, b) => a + b;

/**
 * Fetches a user from the API
 * @param {string} id - User identifier
 * @returns {Promise<Object>} Promise resolved with user data
 * @throws {Error} If the user does not exist
 */
const fetchUser = async id => {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`User ${id} not found`);
  }
  return response.json();
};
```

### 5. Modules et Imports

**ESM (ECMAScript Modules) > CommonJS**

```javascript
// ✅ Correct - ESM
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import myModule from './my-module.js';

export const myFunction = () => {};
export default mainFunction;

// ❌ Éviter - CommonJS (only as last resort)
const fs = require('fs');
module.exports = myFunction;
```

**Préfixe `node:` obligatoire pour modules natifs**

Toujours préfixer les imports de modules Node.js natifs avec `node:` pour :

- Différencier clairement les modules natifs des packages npm
- Améliorer la performance (résolution directe, pas de recherche dans node_modules)
- Éviter les conflits de nommage avec des packages tiers
- Suivre les bonnes pratiques Node.js modernes

```javascript
// ✅ Correct - Préfixe node: pour modules natifs
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';

// ❌ Éviter - Imports sans préfixe
import fs from 'fs';
import { readFile } from 'fs/promises';
```

**Modules natifs courants :**

- `node:fs`, `node:fs/promises`
- `node:path`
- `node:http`, `node:https`
- `node:url`
- `node:crypto`
- `node:stream`
- `node:events`
- `node:child_process`
- `node:process`

### 6. Asynchronisme

**async/await > Promises**

```javascript
// ✅ Correct
const processData = async () => {
  const data = await fetchData();
  const result = await transform(data);
  return result;
};

// ❌ Éviter
const processData = () => {
  return fetchData()
    .then(data => transform(data))
    .then(result => result);
};
```

**Délais et annulation : `AbortSignal` plutôt qu'un minuteur géré à la main**

```javascript
// ✅ Correct - délai seul, ou délai combiné à une annulation
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

const controller = new AbortController();
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);

// ❌ Éviter - setTimeout + AbortController + clearTimeout à la main
```

**Relancer une erreur sans perdre l'originale : `cause`**

```javascript
// ✅ Correct
try {
  await loadConfig(path);
} catch (err) {
  throw new Error(`Configuration illisible : ${path}`, { cause: err });
}
```

### 7. Structures de Contrôle

**Éviter if/else en cascade et switch/case**

Privilégier les structures de données (objets, Maps) ou les fonctions de tableau :

```javascript
// ❌ Éviter
const getColor = (status) => {
  if (status === 'active') {
    return 'green';
  } else if (status === 'pending') {
    return 'yellow';
  } else if (status === 'error') {
    return 'red';
  } else {
    return 'gray';
  }
};

// ✅ Correct - Mapping object
const STATUS_COLORS = {
  active: 'green',
  pending: 'yellow',
  error: 'red',
};

const getColor = (status) => STATUS_COLORS[status] ?? 'gray';

// ✅ Alternative - Map for more complex logic
const handlers = new Map([
  ['create', createHandler],
  ['update', updateHandler],
  ['delete', deleteHandler],
]);

const processAction = (action, data) => {
  const handler = handlers.get(action);
  return handler?.(data) ?? null;
};
```

**Exception :** Si une boucle ou structure complexifie inutilement le code, un if/else simple est acceptable.

### 8. Signatures de Fonctions

**Objets d'options pour 3+ paramètres**

```javascript
// ❌ Éviter - Multiple positional arguments
const createUser = (name, email, age, role, department) => {
  // ...
};

// ✅ Correct - Options object
/**
 * Creates a new user
 * @param {Object} options - User configuration
 * @param {string} options.name - User's name
 * @param {string} options.email - Email address
 * @param {number} options.age - Age
 * @param {string} options.role - Role
 * @param {string} options.department - Department
 * @returns {Object} Created user
 */
const createUser = ({ name, email, age, role, department }) => {
  // ...
};

// Usage
createUser({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  role: 'developer',
  department: 'engineering',
});
```

### 9. Gestion des Dépendances

**Versions @latest par défaut à l'ajout d'une dépendance**

```bash
# ✅ Preferred - Install latest version
npm install express@latest

# Exception: compatibility constraints
npm install react@18
```

Le `@latest` vaut pour **ajouter** une dépendance : la version est ensuite figée par le lockfile. Un `npx` lancé de façon répétée (scripts, skills, CI) n'a pas de lockfile : y épingler la version (`npx outil@1.4.2`), et la mettre à jour délibérément.

### 10. Environnement Node.js

**Version LTS paire récente**

- Privilégier les versions paires (LTS) : 20.x, 22.x, 24.x
- Statuts acceptables : "Current", "Active LTS", "Maintenance LTS"
- Spécifier dans `package.json` :

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 11. Comparaisons

**Toujours utiliser les comparaisons strictes**

Préférer `===` et `!==` à `==` et `!=` pour éviter la coercition de type implicite de JavaScript.

```javascript
// ✅ Correct - Strict equality
if (value === null) { ... }
if (count !== 0) { ... }
if (typeof x === 'string') { ... }

// ❌ Éviter - Loose equality (implicit type coercion)
if (value == null) { ... }   // matches both null and undefined
if (count != 0) { ... }
if (x == '42') { ... }       // true even if x is the number 42
```

**Exception :** `== null` est acceptable uniquement quand on veut explicitement tester à la fois `null` et `undefined` — mais dans ce cas, préférer le chaînage optionnel (`?.`) ou la nullish coalescing (`??`).

### 12. Tableaux — Immutabilité par défaut

**Privilégier les méthodes non mutatives** introduites en ES2023. Elles retournent un nouveau tableau sans modifier l'original, ce qui s'inscrit dans le paradigme fonctionnel de ces conventions.

| Mutatif            | Non mutatif (préféré) |
|--------------------|-----------------------|
| `sort()`           | `toSorted()`          |
| `reverse()`        | `toReversed()`        |
| `splice()`         | `toSpliced()`         |
| `array[i] = value` | `with(index, value)`  |

**Pièges :**

- `Set`, `NodeList`, `arguments` n'ont pas ces méthodes (→ `TypeError`) : convertir d'abord, `[...set].toSorted()`, `Array.from(nodeList).toSorted()`.
- Sur un tableau à trous, `toSorted()` et `toReversed()` remplacent les trous par `undefined`, alors que `sort()` les conserve.
- Les tableaux typés ont leurs propres `toSorted()` et `with()`, qui renvoient un tableau typé du même type.

```javascript
// ✅ Correct - Non-mutative methods
const numbers = [3, 1, 4, 1, 5];

const sorted = numbers.toSorted((a, b) => a - b);
const reversed = numbers.toReversed();
const withoutSecond = numbers.toSpliced(1, 1);
const replaced = numbers.with(0, 99);

// Original array is unchanged
console.log(numbers); // [3, 1, 4, 1, 5]

// ❌ Avoid - Mutative methods (modify the original array)
const numbers2 = [3, 1, 4, 1, 5];

numbers2.sort((a, b) => a - b);  // mutates in place
numbers2.reverse();               // mutates in place
numbers2.splice(1, 1);            // mutates in place
```

**Exception :** La mutation est acceptable quand elle est intentionnelle et justifiée — par exemple pour des raisons de performance mémoire sur de très grands tableaux, ou quand on construit un tableau local qui n'est pas partagé.

### 13. Emplacement des Fichiers de Tests

**Colocation par défaut**

À défaut d'une convention déjà en place dans le projet, placer les fichiers de tests **à côté** du fichier testé plutôt que dans un répertoire `__tests__/`, `test/` ou `tests/` séparé.

```
src/
├── utils/
│   ├── format-date.js
│   ├── format-date.test.js       ✅ colocated
│   ├── parse-url.js
│   └── parse-url.test.js         ✅ colocated
```

**Avantages :**

- Visibilité immédiate : on voit qu'un module a (ou n'a pas) de tests en consultant son dossier
- Déplacer/renommer/supprimer un module entraîne naturellement son test
- Imports relatifs courts (`./parse-url.js` au lieu de `../../src/utils/parse-url.js`)

**Détection d'une convention existante — ne pas l'écraser :**

Avant de créer un nouveau fichier de test, vérifier si le projet impose déjà un emplacement :

1. Présence d'un répertoire `__tests__/`, `test/`, `tests/`, `spec/` utilisé de manière consistante
2. Configuration explicite du runner (`jest.config.js`, `vitest.config.js`, `package.json`) : champs `testMatch`, `testPathIgnorePatterns`, `roots`, `testRegex`
3. Documentation du projet (`CONTRIBUTING.md`, `README.md`, `AGENTS.md`)

Si une convention existe, la suivre même si elle diffère de la colocation.

**Nommage :** `<module>.test.js` (ou `.spec.js` si le projet utilise cette forme). Cohérence avec l'existant avant tout.

### 14. Cible d'exécution

**La cible vient du projet, jamais d'une supposition**

Avant d'utiliser une API récente (JS, DOM, CSS), lire la cible déclarée par le projet :

1. `browserslist` (champ de `package.json` ou fichier `.browserslistrc`)
2. `engines.node` dans `package.json`
3. `compilerOptions.target` et `lib` de `tsconfig.json` (projet TypeScript) : une méthode absente de `lib` ne compile pas, même si les navigateurs visés la connaissent (ex. `toSorted` avec `"lib": ["ES2022"]`)
4. Documentation du projet (`CLAUDE.md`, `AGENTS.md`, `README.md`)

Si l'API dépasse la cible déclarée, ne pas l'utiliser, ou le signaler. Si le projet ne déclare aucune cible et que l'API est récente (par exemple `Object.groupBy` ou `Promise.withResolvers`, absents de Node 20), poser la question plutôt que d'ajouter de soi-même un polyfill ou un code de repli.

## Exemples Complets

Voir [javascript-examples.md](./references/javascript-examples.md) pour des exemples complets (script Node.js, module ESM réutilisable).

## Checklist Pré-Livraison

Avant de finaliser un script JavaScript (règles de forme : sauf convention du projet, voir « Priorité et conventions du projet ») :

- [ ] Conventions documentées ou observées du projet respectées
- [ ] Arrow functions utilisées (sauf cas `this` nécessaire)
- [ ] Points-virgules présents
- [ ] Dangling commas sur multilignes
- [ ] Pas d'espaces blancs trailing
- [ ] JSDoc sur toutes les fonctions exportées
- [ ] ESM utilisé (import/export)
- [ ] Préfixe `node:` utilisé pour tous les imports de modules natifs
- [ ] async/await pour asynchronisme
- [ ] Pas de if/else en cascade ni switch/case (sauf exception justifiée)
- [ ] Fonctions 3+ params utilisent objets d'options
- [ ] Version Node.js LTS paire spécifiée si applicable
- [ ] Comparaisons strictes (`===`, `!==`) utilisées à la place de `==` et `!=`
- [ ] Méthodes non mutatives de tableaux utilisées par défaut (`toSorted`, `toReversed`, `toSpliced`, `with`)
- [ ] Fichiers de tests colocalisés avec le code testé (sauf convention projet différente)
- [ ] API récentes compatibles avec la cible déclarée du projet (sinon question posée)
- [ ] Versions épinglées dans les `npx` lancés de façon répétée
- [ ] Linting projet respecté (si présent)
