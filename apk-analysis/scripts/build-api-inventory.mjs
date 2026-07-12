#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Consolide les endpoints bruts en un inventaire, plus des exports OpenAPI 3.1 et Postman v2.1.
 * @param {Array<{stack:string, method:?string, path:?string, host:?string, evidence:object}>} raw
 * @returns {{inventory:Array, openapi:object, postman:object}}
 */
export function buildInventory(raw) {
  const byKey = new Map()
  for (const e of raw) {
    const host = e.host ?? 'unknown-host'
    const path = e.path ?? '/'
    const key = `${host}${path}`
    if (!byKey.has(key)) byKey.set(key, { host, path, methods: new Set(), evidence: [] })
    const g = byKey.get(key)
    if (e.method) g.methods.add(e.method.toUpperCase())
    g.evidence.push(e.evidence)
  }

  const inventory = [...byKey.values()].map((g) => ({
    host: g.host,
    path: g.path,
    methods: [...g.methods],
    evidence: g.evidence,
  }))

  const hosts = [...new Set(inventory.map((e) => e.host).filter((h) => h && h !== 'unknown-host'))]

  const paths = {}
  for (const e of inventory) {
    paths[e.path] ??= {}
    const methods = e.methods.length ? e.methods : ['GET']
    for (const m of methods) {
      paths[e.path][m.toLowerCase()] = {
        summary: `${m} ${e.path}`,
        responses: { 200: { description: 'Discovered via static analysis' } },
      }
    }
  }

  const openapi = {
    openapi: '3.1.0',
    info: { title: 'Discovered API', version: '0.0.0-static' },
    servers: hosts.map((h) => ({ url: `https://${h}` })),
    paths,
  }

  const postman = {
    info: {
      name: 'Discovered API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: inventory.map((e) => ({
      name: `${e.methods[0] ?? 'GET'} ${e.path}`,
      request: {
        method: e.methods[0] ?? 'GET',
        url: {
          raw: `https://${e.host}${e.path}`,
          host: [e.host],
          path: e.path.split('/').filter(Boolean),
        },
      },
    })),
  }

  return { inventory, openapi, postman }
}

// CLI : node build-api-inventory.mjs <out-dir>
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2]
  if (!outDir) {
    console.error('Usage: build-api-inventory.mjs <out-dir>')
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(join(outDir, 'api-raw.json'), 'utf8'))
  const { inventory, openapi, postman } = buildInventory(raw)
  writeFileSync(join(outDir, 'api-inventory.json'), JSON.stringify(inventory, null, 2))
  writeFileSync(join(outDir, 'openapi.json'), JSON.stringify(openapi, null, 2))
  writeFileSync(join(outDir, 'postman.json'), JSON.stringify(postman, null, 2))
  console.log(join(outDir, 'api-inventory.json'))
}
