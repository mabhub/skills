# oxc-parser API Reference

## Parsing

```javascript
import { parseSync, parse, Visitor, visitorKeys } from 'oxc-parser';

// Synchronous (preferred for batch analysis)
const result = parseSync(filename, sourceText, options);

// Asynchronous
const result = await parse(filename, sourceText, options);
```

**`filename`** — Used to detect language from extension (`.js`, `.jsx`, `.ts`, `.tsx`). Does not need to exist on disk.

**`options`** (all optional):

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `lang` | `'js'` `'jsx'` `'ts'` `'tsx'` `'dts'` | from extension | Override language detection |
| `sourceType` | `'module'` `'script'` `'unambiguous'` | `'module'` | ES module vs script |
| `astType` | `'js'` `'ts'` | `'js'` | `'ts'` adds TS-specific properties to JS ASTs |
| `range` | `boolean` | `false` | Add `[start, end]` arrays to AST nodes |
| `preserveParens` | `boolean` | `true` | Keep `ParenthesizedExpression` nodes |
| `showSemanticErrors` | `boolean` | `false` | Enable semantic error checking (small perf cost) |

## ParseResult

```typescript
class ParseResult {
  program: Program         // Full ESTree-compliant AST
  module: EcmaScriptModule // Import/export metadata (no traversal needed)
  comments: Comment[]      // All comments in source order
  errors: OxcError[]       // Parse errors with source locations
}
```

## Comment

```typescript
interface Comment {
  type: 'Line' | 'Block'  // // vs /* */
  value: string            // Text content (without delimiters)
  start: number            // Character offset in source
  end: number              // Character offset in source
}
```

For block comments, `value` contains everything between `/*` and `*/`, including newlines.

Line number from offset: `source.slice(0, comment.start).split('\n').length`

## EcmaScriptModule

```typescript
interface EcmaScriptModule {
  hasModuleSyntax: boolean
  staticImports: StaticImport[]
  staticExports: StaticExport[]
  dynamicImports: DynamicImport[]
  importMetas: Span[]         // { start, end }
}
```

### StaticImport

```typescript
interface StaticImport {
  start: number
  end: number
  moduleRequest: { value: string, start: number, end: number }
  entries: Array<{
    importName: { kind: 'Name' | 'NamespaceObject' | 'Default', name: string }
    localName: { value: string }
    isType: boolean
  }>
}
```

### StaticExport

```typescript
interface StaticExport {
  start: number
  end: number
  entries: Array<{
    exportName: { kind: 'Name' | 'Default' | 'None', name: string }
    localName: { kind: string, name: string }
    moduleRequest: null | { value: string }  // Non-null for re-exports
    isType: boolean
  }>
}
```

## Visitor

Traverse the AST using the visitor pattern. Supports 165 node types with enter/exit callbacks.

```javascript
const visitor = new Visitor({
  FunctionDeclaration(node) {
    // Enter — called when node is first visited
    console.log(node.id.name, node.params.length);
  },
  'FunctionDeclaration:exit'(node) {
    // Exit — called after all children are visited
  }
});

visitor.visit(result.program);
```

## visitorKeys

```javascript
// Record<string, string[]> — traversable child fields for each node type
visitorKeys['FunctionDeclaration']
// → ['id', 'typeParameters', 'params', 'returnType', 'body']
```
