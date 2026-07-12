import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildInventory } from './build-api-inventory.mjs'

test('groups endpoints and emits OpenAPI paths + Postman items', () => {
  const raw = [
    { stack: 'retrofit', method: 'GET', path: '/v1/users', host: 'api.example.com', evidence: { file: 'A.java', line: 10 } },
    { stack: 'retrofit', method: 'POST', path: '/v1/users', host: 'api.example.com', evidence: { file: 'A.java', line: 20 } },
    { stack: 'hardcoded-url', method: null, path: '/health', host: 'api.example.com', evidence: { file: 'B.java', line: 5 } },
  ]
  const { inventory, openapi, postman } = buildInventory(raw)

  // inventory regroupe par host+path
  assert.equal(inventory.length, 2)
  const users = inventory.find((e) => e.path === '/v1/users')
  assert.deepEqual(users.methods.sort(), ['GET', 'POST'])

  // OpenAPI 3.1 avec un serveur et les deux paths
  assert.equal(openapi.openapi, '3.1.0')
  assert.ok(openapi.servers.some((s) => s.url.includes('api.example.com')))
  assert.ok(openapi.paths['/v1/users'].get)
  assert.ok(openapi.paths['/v1/users'].post)

  // Collection Postman v2.1 avec un item par endpoint
  assert.match(postman.info.schema, /v2\.1\.0/)
  assert.equal(postman.item.length, 2)
})
