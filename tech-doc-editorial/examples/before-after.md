# Exemples de transformations éditoriales

Ce document présente des exemples avant/après de révisions éditoriales sur de la documentation technique.

## Exemple 1 : Introduction de fonctionnalité

### ❌ Avant

```markdown
## Le système de cache

Notre application a un cache. Il permet de stocker des données.
Ça améliore les performances.
```

### ✅ Après

```markdown
## Système de cache

Le **système de cache** stocke temporairement les données fréquemment
consultées en mémoire pour accélérer leur accès et réduire la charge
sur la base de données.

**Bénéfices** :
- **Performance** : Réduction du temps de réponse de 80%
- **Scalabilité** : Support de 10x plus de requêtes concurrentes
- **Expérience utilisateur** : Pages qui se chargent instantanément

**Cas d'usage typiques** :
- Résultats de recherche récents
- Profils utilisateurs actifs
- Données de configuration
```

**Améliorations apportées** :

- Introduction enrichie expliquant le "pourquoi"
- Bénéfices quantifiés et concrets
- Cas d'usage pratiques ajoutés
- Formatage avec gras pour concepts clés

---

## Exemple 2 : Documentation d'API

### ❌ Avant

```markdown
## getUser

getUser récupère un utilisateur. Il prend un ID et retourne
les données.

```javascript
const user = getUser(123);
```

```

### ✅ Après

```markdown
## getUser()

Récupère les informations complètes d'un utilisateur depuis la base de données.

**Signature** :

```typescript
getUser(userId: number): Promise<User | null>
```

**Paramètres** :

- **userId** : L'identifiant unique de l'utilisateur (nombre entier positif)

**Valeur de retour** :

- **Promise<User>** : Les données de l'utilisateur si trouvé
- **Promise<null>** : Si l'utilisateur n'existe pas

**Exemple d'utilisation** :

```typescript
try {
  const user = await getUser(123);
  if (user) {
    console.log(`Bonjour ${user.name}`);
  } else {
    console.log('Utilisateur non trouvé');
  }
} catch (error) {
  console.error('Erreur lors de la récupération:', error);
}
```

> ⚠️ **Important** : Cette fonction effectue une requête base de données.
> Pour des appels fréquents, utilisez plutôt `getCachedUser()`.

**Voir aussi** :

- `getCachedUser()` - Version avec cache
- `getUsersByRole()` - Récupération par rôle

```

**Améliorations apportées** :

- Signature TypeScript ajoutée
- Paramètres et retour détaillés
- Gestion d'erreurs dans l'exemple
- Cas du null explicité
- Recommandation de bonne pratique
- Liens vers fonctions liées

---

## Exemple 3 : Guide d'installation

### ❌ Avant

```markdown
# Installation

Faire npm install pour installer. Ensuite lancer avec npm start.
Si ça marche pas vérifier node.
```

### ✅ Après

```markdown
# Installation

## Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Node.js** version 18 ou supérieure
- **npm** version 9 ou supérieure
- Un éditeur de code (VS Code recommandé)

### Vérification des versions

```bash
node --version  # Doit afficher v18.x.x ou supérieur
npm --version   # Doit afficher 9.x.x ou supérieur
```

## Installation des dépendances

1. Cloner le dépôt :

   ```bash
   git clone https://github.com/org/project.git
   cd project
   ```

2. Installer les dépendances :

   ```bash
   npm install
   ```

   > 💡 Cette étape peut prendre 2-3 minutes selon votre connexion.

3. Copier le fichier de configuration :

   ```bash
   cp .env.example .env
   ```

4. Configurer les variables d'environnement dans `.env` :
   - `DATABASE_URL` : URL de votre base de données
   - `API_KEY` : Clé d'API (obtenir sur dashboard.example.com)

## Lancement

Démarrer le serveur de développement :

```bash
npm start
```

L'application sera accessible sur **<http://localhost:3000>**

> ✅ **Succès** : Vous devriez voir "Server running on port 3000" dans la console.

## Dépannage

### Erreur "Module not found"

**Solution** : Supprimer `node_modules` et réinstaller :

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erreur "Port already in use"

**Solution** : Un autre processus utilise le port 3000. Arrêtez-le ou changez le port :

```bash
PORT=3001 npm start
```

### Erreur de connexion base de données

**Solution** : Vérifier que `DATABASE_URL` dans `.env` est correct et que la base est démarrée.

```

**Améliorations apportées** :

- Section prérequis ajoutée avec versions
- Instructions numérotées étape par étape
- Commandes formatées en blocs de code
- Feedback visuel sur le succès attendu
- Section dépannage pour erreurs courantes
- Notes et conseils avec emojis
- Temps estimés mentionnés

---

## Exemple 4 : Explication conceptuelle

### ❌ Avant

```markdown
## Props

Les props c'est des paramètres qu'on passe aux composants.
```

### ✅ Après

```markdown
## Props (Propriétés)

Les **props** (abréviation de "properties") sont des données que vous
transmettez d'un composant parent à un composant enfant en React.
Elles fonctionnent comme des arguments de fonction.

### Pourquoi utiliser les props ?

Les props permettent de :
- **Réutiliser** le même composant avec différentes données
- **Personnaliser** l'apparence ou le comportement d'un composant
- **Communiquer** entre composants de manière unidirectionnelle

### Anatomie d'une prop

```jsx
// Composant parent qui PASSE les props
<UserCard name="Alice" age={25} />

// Composant enfant qui REÇOIT les props
function UserCard(props) {
  return (
    <div>
      <h2>{props.name}</h2>
      <p>Âge : {props.age} ans</p>
    </div>
  );
}
```

### Bonnes pratiques

✅ **À FAIRE** :

- Nommer les props de manière explicite (`userName` plutôt que `n`)
- Documenter les props requises vs optionnelles
- Utiliser PropTypes ou TypeScript pour la validation

❌ **À ÉVITER** :

- Modifier les props dans le composant enfant (elles sont immuables)
- Passer trop de props (>5-7 : envisager un objet)
- Utiliser des noms ambigus

### Aller plus loin

- [Props avec TypeScript](./typescript-props.md)
- [Destructuring de props](./destructuring.md)
- [Props par défaut](./default-props.md)

```

**Améliorations apportées** :

- Définition claire et accessible
- Analogie avec fonctions (apprentissage)
- Section "Pourquoi" expliquant la valeur
- Exemple annoté montrant le flux
- Bonnes pratiques avec do/don't
- Liens vers concepts avancés

---

## Exemple 5 : Message d'erreur

### ❌ Avant

```markdown
## Erreurs

Si ça marche pas regarder la console.
```

### ✅ Après

```markdown
## Gestion des erreurs

### Identifier une erreur

Lorsqu'une erreur survient, elle apparaît dans la **console du navigateur** :

1. **Ouvrir la console** :
   - Chrome/Edge : `F12` ou `Ctrl + Shift + J`
   - Firefox : `F12` ou `Ctrl + Shift + K`
   - Safari : `Cmd + Option + C`

2. **Localiser l'erreur** : Les erreurs apparaissent en rouge avec :
   - Le **message d'erreur**
   - Le **fichier** et la **ligne** concernés
   - La **stack trace** (historique des appels)

### Erreurs courantes

#### TypeError: Cannot read property 'X' of undefined

**Cause** : Vous essayez d'accéder à une propriété sur une valeur `undefined`.

**Exemple problématique** :
```javascript
const user = undefined;
console.log(user.name); // ❌ Erreur !
```

**Solution** : Vérifier l'existence avant d'accéder :

```javascript
const user = getUserFromAPI();
if (user) {
  console.log(user.name); // ✅ Sécurisé
}

// Ou avec optional chaining (moderne) :
console.log(user?.name);
```

#### Network Error

**Cause** : Problème de connexion à l'API (serveur arrêté, URL incorrecte, CORS).

**Solution** :

1. Vérifier que l'API est démarrée : `curl http://localhost:3001/api/health`
2. Vérifier l'URL dans le code
3. Consulter les logs serveur

### Obtenir de l'aide

Si l'erreur persiste :

1. **Copier le message d'erreur complet**
2. **Noter les étapes pour reproduire**
3. **Consulter** la [FAQ](./faq.md) ou [créer une issue](https://github.com/org/repo/issues)

```

**Améliorations apportées** :
- Instructions précises pour ouvrir la console
- Erreurs courantes documentées avec solutions
- Exemples de code problématique vs solutionné
- Étapes de dépannage structurées
- Ressources d'aide clairement indiquées

---

## Principes généraux appliqués

### 🎯 Clarté

- Phrases courtes et directes
- Un concept par paragraphe
- Progression logique

### 📚 Pédagogie

- Analogies pour concepts complexes
- Exemples concrets et fonctionnels
- Explications du "pourquoi" pas seulement du "comment"

### ✨ Engagement

- Ton accessible et professionnel
- Verbes d'action
- Bénéfices utilisateur mis en avant

### 🎨 Présentation

- Formatage riche (gras, listes, code)
- Emojis structurants avec parcimonie
- Hiérarchie visuelle claire

### 🔧 Praticité

- Cas d'usage réels
- Solutions aux problèmes courants
- Liens vers ressources complémentaires
