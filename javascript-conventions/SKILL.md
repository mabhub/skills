---
name: javascript-conventions
description: Standards de codage JavaScript/Node.js couvrant style fonctionnel, formatage, ESM, async/await, JSDoc, et bonnes pratiques. Utiliser pour TOUT script JavaScript, qu'il s'agisse de Node.js backend, frontend navigateur, ou scripts d'automatisation. Déclencheurs typiques incluent création de scripts, génération de code JS/TS, écriture de fonctions, ou tout travail impliquant JavaScript/Node.js hors autres conventions déjà établies.
---

# JavaScript Conventions

**Priorité des règles :** Si un projet possède une configuration de linting fonctionnelle (ESLint, etc.), ses règles sont PRIORITAIRES sur celles de ce skill en cas de conflit. Si le nombre d'erreurs de linting est très élevé, interroger l'utilisateur avant de procéder.

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

**Versions @latest par défaut**
```bash
# ✅ Preferred - Install latest version
npm install express@latest

# Exception: compatibility constraints
npm install react@18
```

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

## Exemples Complets

Voir [javascript-examples.md](./references/javascript-examples.md) pour des exemples complets (script Node.js, module ESM réutilisable).

## Checklist Pré-Livraison

Avant de finaliser un script JavaScript :

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
- [ ] Linting projet respecté (si présent)
