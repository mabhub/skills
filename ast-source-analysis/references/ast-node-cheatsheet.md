# ESTree AST Node Cheatsheet

Les ~30 types de nœuds les plus utiles pour l'analyse de code JS/TS.

## Structure de base

### `Program`
Racine de l'AST. Contient tous les statements du fichier.
```javascript
{ type: 'Program', body: Statement[], sourceType: 'module'|'script' }
```

### `Identifier`
Un nom : variable, fonction, paramètre.
```javascript
{ type: 'Identifier', name: 'myVariable' }
// Source: myVariable
```

### `Literal`
Une valeur littérale : string, number, boolean, null, regex.
```javascript
{ type: 'Literal', value: 42, raw: '42' }
{ type: 'Literal', value: 'hello', raw: "'hello'" }
```

---

## Imports / Exports

### `ImportDeclaration`
```javascript
{ type: 'ImportDeclaration',
  source: Literal,            // source.value = 'react'
  specifiers: [ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier] }
// Source: import { useState } from 'react'
// Source: import React from 'react'
// Source: import * as utils from './utils.js'
```

### `ImportSpecifier`
```javascript
{ type: 'ImportSpecifier', imported: Identifier, local: Identifier }
// imported.name = 'useState', local.name = 'useState' (or alias)
```

### `ImportDefaultSpecifier`
```javascript
{ type: 'ImportDefaultSpecifier', local: Identifier }
// local.name = 'React'
```

### `ImportNamespaceSpecifier`
```javascript
{ type: 'ImportNamespaceSpecifier', local: Identifier }
// local.name = 'utils'
```

### `ExportNamedDeclaration`
```javascript
{ type: 'ExportNamedDeclaration',
  declaration: Declaration | null,  // function/class/var if inline export
  specifiers: ExportSpecifier[],    // for { a, b } style
  source: Literal | null }          // non-null for re-exports
// Source: export { foo, bar }
// Source: export function foo() {}
// Source: export { baz } from './baz.js'
```

### `ExportDefaultDeclaration`
```javascript
{ type: 'ExportDefaultDeclaration',
  declaration: Expression | FunctionDeclaration | ClassDeclaration }
// Source: export default function App() {}
// Source: export default myValue
```

### `ExportAllDeclaration`
```javascript
{ type: 'ExportAllDeclaration', source: Literal, exported: Identifier | null }
// Source: export * from './utils.js'
// Source: export * as helpers from './utils.js'
```

---

## Fonctions

### `FunctionDeclaration`
```javascript
{ type: 'FunctionDeclaration',
  id: Identifier,               // function name (null for default export)
  params: Pattern[],            // parameters
  body: BlockStatement,
  async: boolean,
  generator: boolean,
  start: number, end: number }  // use for bodyLines = source.slice(start,end).split('\n').length
// Source: function calculateTotal(entries) {}
// Source: async function fetchData(url, options) {}
```

### `ArrowFunctionExpression`
```javascript
{ type: 'ArrowFunctionExpression',
  params: Pattern[],
  body: BlockStatement | Expression,
  async: boolean,
  expression: boolean }         // true if body is an expression (not block)
// Source: const fn = (x) => x * 2
// Source: const fetch = async (url) => { ... }
```

### `FunctionExpression`
```javascript
{ type: 'FunctionExpression',
  id: Identifier | null,
  params: Pattern[],
  body: BlockStatement,
  async: boolean,
  generator: boolean }
// Source: const fn = function namedFn(x) { ... }
```

---

## Classes

### `ClassDeclaration`
```javascript
{ type: 'ClassDeclaration',
  id: Identifier,
  superClass: Expression | null,
  body: ClassBody { body: ClassBodyElement[] },
  decorators: Decorator[] }
// Source: class MyComponent extends React.Component {}
```

### `MethodDefinition`
```javascript
{ type: 'MethodDefinition',
  key: Expression,              // method name
  value: FunctionExpression,
  kind: 'constructor'|'method'|'get'|'set',
  static: boolean,
  computed: boolean }
// Source: render() {} / static getInstance() {}
```

### `PropertyDefinition`
```javascript
{ type: 'PropertyDefinition',
  key: Expression,
  value: Expression | null,
  static: boolean,
  computed: boolean }
// Source: displayName = 'MyComponent'
// Source: static propTypes = { ... }
```

---

## Déclarations de variables

### `VariableDeclaration`
```javascript
{ type: 'VariableDeclaration',
  kind: 'const' | 'let' | 'var',
  declarations: VariableDeclarator[] }
// Source: const x = 1, y = 2
```

### `VariableDeclarator`
```javascript
{ type: 'VariableDeclarator',
  id: Pattern,                  // LHS (Identifier or destructuring)
  init: Expression | null }     // RHS (null if no initializer)
// Source: x = someFunction()
```

---

## Expressions courantes

### `CallExpression`
```javascript
{ type: 'CallExpression',
  callee: Expression,           // what's being called
  arguments: Expression[],
  optional: boolean }           // true for foo?.()
// Source: useState(0)
// Source: console.log('hello')
```

### `MemberExpression`
```javascript
{ type: 'MemberExpression',
  object: Expression,
  property: Expression,
  computed: boolean,            // true for obj[key], false for obj.key
  optional: boolean }
// Source: obj.method
// Source: arr[0]
```

### `AssignmentExpression`
```javascript
{ type: 'AssignmentExpression',
  operator: '=' | '+=' | etc,
  left: Pattern,
  right: Expression }
// Source: MyComponent.displayName = 'MyComponent'
```

---

## Statements de contrôle

### `IfStatement`
```javascript
{ type: 'IfStatement',
  test: Expression,
  consequent: Statement,
  alternate: Statement | null }
```

### `ReturnStatement`
```javascript
{ type: 'ReturnStatement', argument: Expression | null }
```

### `ThrowStatement`
```javascript
{ type: 'ThrowStatement', argument: Expression }
```

### `TryStatement`
```javascript
{ type: 'TryStatement',
  block: BlockStatement,
  handler: CatchClause | null,    // catch (e) { ... }
  finalizer: BlockStatement | null }
```

### `ForStatement` / `ForInStatement` / `ForOfStatement`
```javascript
{ type: 'ForOfStatement', left: Pattern, right: Expression, body: Statement, await: boolean }
// Source: for (const item of items) {}
// Source: for await (const chunk of stream) {}
```

---

## JSX

### `JSXElement`
```javascript
{ type: 'JSXElement',
  openingElement: JSXOpeningElement,
  closingElement: JSXClosingElement | null,
  children: JSXChild[] }
```

### `JSXOpeningElement`
```javascript
{ type: 'JSXOpeningElement',
  name: JSXIdentifier | JSXMemberExpression,
  attributes: JSXAttribute[],
  selfClosing: boolean }
// Source: <MyComponent disabled={true} />
```

### `JSXAttribute`
```javascript
{ type: 'JSXAttribute',
  name: JSXIdentifier,
  value: Literal | JSXExpressionContainer | null }
// name.name = 'disabled', value.expression = {type:'Literal',value:true}
```

---

## TypeScript (avec `astType: 'ts'` ou fichiers .ts/.tsx)

### `TSTypeAnnotation`
```javascript
{ type: 'TSTypeAnnotation', typeAnnotation: TSType }
// Source: : string  (la partie type après : dans un param ou déclaration)
```

### `TSInterfaceDeclaration`
```javascript
{ type: 'TSInterfaceDeclaration',
  id: Identifier,
  body: TSInterfaceBody,
  extends: TSInterfaceHeritage[] }
// Source: interface Props { name: string }
```

### `TSTypeAliasDeclaration`
```javascript
{ type: 'TSTypeAliasDeclaration',
  id: Identifier,
  typeAnnotation: TSType,
  typeParameters: TSTypeParameterDeclaration | null }
// Source: type Entry = { id: string; date: string }
```
