# Exemples de messages de commit bien rédigés

Ce document contient des exemples concrets de bons messages de commit suivant les conventions de ce skill.

## Changements simples (sans corps)

### Ajout de fonctionnalité

```
Implement password reset functionality
```

### Refactoring

```
Extract user validation logic into separate service
```

### Correction de bug (avec spécificité)

```
Fix memory leak in WebSocket connection handler
```

### Amélioration de performance

```
Optimize SQL queries for dashboard analytics
```

### Documentation

```
Document API authentication flow in README
```

## Changements complexes (avec corps)

### Fonctionnalité majeure

```
Implement real-time collaborative editing

    Users can now edit documents simultaneously with live updates.

    Operational transformation was chosen over CRDTs: the documents are
    linear text and OT keeps the payload small enough for the existing
    WebSocket budget, at the cost of requiring a central server.

    Performance characteristics:
    - Supports up to 50 concurrent editors per document
    - Average latency <100ms for updates

    Refs: #789
```

### Changement d'architecture

```
Migrate authentication from sessions to JWT

    Session-based auth was causing scaling issues in distributed
    environment. JWT tokens enable stateless authentication and
    horizontal scaling.

    Breaking changes:
    - Client must now send Authorization header
    - Session cookies are no longer used
    - Token refresh required every 24 hours

    Migration path:
    - Existing sessions remain valid for 7 days
    - Users will be prompted to re-login after expiration

    Refs: #456
```

### Correction de bug avec contexte

```
Prevent race condition in order processing

    Under high load, concurrent requests could process the same order
    multiple times, leading to duplicate charges.

    Root cause:
    - Order status check and update were not atomic
    - Multiple workers could read "pending" status simultaneously

    Solution:
    - Implement database-level pessimistic locking
    - Add unique constraint on order_id + processed_at
    - Implement idempotency key validation

    Refs: #234
```

### Refactoring avec justification

```
Extract email sending logic into dedicated service

    Email functionality was scattered across multiple controllers,
    making it difficult to maintain consistent formatting and
    implement new email providers.

    Benefits:
    - Centralized email template management
    - Easy to swap email providers (SendGrid, Mailgun, etc.)
    - Consistent error handling and retry logic
    - Simplified testing with mock email service

    No breaking changes - existing email calls updated to use service.
```

### Mise à jour de dépendance

```
Update lodash to v4.17.21 to address security vulnerability

    CVE-2021-23337: Prototype pollution vulnerability in lodash
    before v4.17.21 could allow attackers to modify object prototypes.

    We do not call the affected `merge`/`zipObjectDeep` paths directly,
    but the template renderer passes user-controlled keys to `defaultsDeep`,
    which is enough to reach it.

    No API changes - update is backward compatible.
```

## Commits avec changements multiples

### Ensemble de fonctionnalités liées

```
Implement user profile customization

    Users can now personalize their profile appearance and privacy
    settings through a new settings interface.

    Features added:
    - Profile picture upload with automatic resizing
    - Bio and social links editing
    - Privacy controls for profile visibility
    - Theme selection (light/dark/auto)

    Profile images live in S3 rather than the database, so the existing
    avatar backup job no longer covers them - see #612 for the follow-up.
```

### Améliorations de qualité de code

```
Refactor payment processing module for maintainability

    The payment module had grown organically and become difficult to
    test and extend with new payment providers.

    The adapter boundary is what makes the Adyen integration planned for
    Q3 a new file rather than another branch in the dispatch function.

    Coverage went from 45% to 87% along the way: the provider logic was
    previously unreachable without hitting the live Stripe sandbox.

    No functional changes - all existing tests pass.
```

## Exemples spécifiques par domaine

### Migration de données

```
Migrate user avatars from filesystem to S3

    Filesystem storage was causing deployment issues and limiting
    horizontal scaling.

    Migration process:
    - Upload existing images to S3 bucket
    - Update database URLs to point to S3
    - Add CloudFront CDN distribution
    - Keep filesystem as fallback for 30 days

    Rollback: Run scripts/rollback-avatar-migration.sh

    Refs: #567
```

### Changements d'API

```
Add pagination to user list endpoint

    Endpoint was returning all users without limit, causing timeouts
    and memory issues with large datasets (>10k users).

    Breaking change:
    - Response now includes pagination metadata
    - Default page size: 50 items
    - Max page size: 100 items

    Query parameters:
    - page: Page number (default: 1)
    - limit: Items per page (default: 50, max: 100)

    Response format:
    {
      "data": [...],
      "pagination": {
        "page": 1,
        "total_pages": 20,
        "total_items": 1000
      }
    }

    Version: API v2.1
    Refs: #345
```

### Tests

```
Add integration tests for checkout flow

    E2E tests were missing coverage for the critical checkout process,
    leading to undetected regressions in production.

    Test scenarios:
    - Successful checkout with various payment methods
    - Cart modification during checkout
    - Session timeout handling
    - Invalid coupon code validation
    - Out-of-stock product handling

    Test framework: Playwright
    CI integration: Runs on every PR to main
```

## Ce qu'il faut éviter

### ❌ Trop vague

```
Fix bug
Update code
Make changes
```

### ❌ Temps passé

```
Added new feature
Fixed the login issue
Updated dependencies
```

### ❌ Corps redondant

```
Add user login

    This commit adds user login functionality.
```

Le corps ne fait que répéter le sujet - pas utile.

### ❌ Corps qui paraphrase le diff

```
Add retry logic to webhook dispatcher

    - Add MAX_RETRIES constant set to 5
    - Wrap the send() call in a for loop
    - Add exponential backoff between attempts
    - Update webhook_dispatcher_test.py
```

Chaque puce se lit directement dans le diff. Rien n'indique pourquoi les
webhooks échouaient, ni pourquoi 5 tentatives. Version utile :

```
Add retry logic to webhook dispatcher

    The partner endpoint returns 503s while restarting, for about 2
    minutes twice a day. Dropped events were not replayable and required
    a manual resync.

    5 attempts with backoff cover a 3-minute window, which absorbs the
    observed outage without tying up a worker for too long.
```

Les listes à rubrique (« Features added: », « Breaking changes: », « Migration
path: ») restent utiles quand elles portent une information absente du diff ou
regroupent un changement trop large pour être lu d'un coup. Quand une rubrique
ne fait que renommer les hunks, la supprimer.

### ❌ Mauvais choix de verbe

```
Change database connection
Update user model
Fix user service
```

Utiliser des verbes plus spécifiques : Refactor, Optimize, Extract, etc.

### ❌ Contexte manquant (quand nécessaire)

```
Refactor user service

    - Split into multiple functions
    - Add new methods
    - Update tests
```

N'explique pas POURQUOI le refactoring était nécessaire.
