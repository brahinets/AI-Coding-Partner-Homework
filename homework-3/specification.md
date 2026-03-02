# Spending Caps & Budgeting Service - Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective

Build a RESTful **Spending Caps & Budgeting** microservice that allows end-users to create and manage spending limits (daily, weekly, monthly) and per-category budgets, receive threshold-based alerts, and gives internal ops/compliance staff read-only oversight - all within a regulated fintech environment.

## Mid-Level Objectives

1. **Spending Cap CRUD** - End-users can create, read, update, and delete spending caps scoped to a configurable period (daily / weekly / monthly) and, optionally, to a spending category.
2. **Budget Utilisation Tracking** - Every authorised transaction is evaluated against the user's active caps; the service maintains a running utilisation counter per cap per period.
3. **Threshold Alerts** - When utilisation reaches configurable warning thresholds (e.g. 80 %, 100 %), the service emits an event (webhook / message queue) so that downstream notification services can alert the user.
4. **Admin / Ops Dashboard API** - Internal endpoints expose a read-only view of all caps, utilisation summaries, and alert history - filtered by user, date range, and status - for compliance and support purposes.
5. **Audit Trail** - Every mutation (cap created, updated, deleted, threshold breached) is persisted in an append-only audit log with actor, timestamp, and before/after state.

## Implementation Notes

### Tech Stack & Coding Standards

> Defined in [`agents.md`](agents.md). That file is the single source of truth for technology choices, coding conventions, and project structure.

### Security & Compliance

- **Authentication** - Every request must carry a valid JWT; middleware rejects expired or malformed tokens with `401 Unauthorized`.
- **Authorisation** - End-user endpoints are scoped to the authenticated user's own data. Admin endpoints require an `admin` or `compliance_officer` role claim.
- **Input validation** - Validate and sanitise all inputs at the controller layer before they reach service logic.
- **PII handling** - User identifiers in logs must be masked or tokenised. Full PII is never written to application logs.
- **Rate limiting** - Apply per-user rate limits (e.g. 60 req/min) to prevent abuse.
- **HTTPS only** - TLS termination at the load balancer; the service must refuse plain HTTP in production.

### Audit & Regulatory

- Append-only audit log; records are immutable once written.
- Every audit entry contains: `eventType`, `actorId`, `actorRole`, `timestamp`, `resourceId`, `previousState`, `newState`.
- Audit records must be retained for a minimum of 7 years (configurable).
- The service must support data-export requests (GDPR / CCPA) for a given user.

### Error Handling

- Use a consistent error envelope: `{ "error": { "code": "<MACHINE_CODE>", "message": "<human readable>", "traceId": "<correlation id>" } }`.
- Map domain exceptions to appropriate HTTP status codes (400, 401, 403, 404, 409, 422, 429, 500).
- Never leak stack traces or internal details in production responses.

### Performance

- Cap lookup per transaction must respond within **50 ms p95** under normal load.
- The utilisation update path must be idempotent to handle duplicate transaction webhooks safely.

## Context

### Beginning Context

| Item             | State                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| `package.json`   | Initialised with Express, Jest, pino, Joi dependencies                               |
| `src/`           | Empty - skeleton folder structure only                                               |
| `tests/`         | Empty                                                                                |
| External IdP     | Exists; issues JWTs with `sub`, `roles[]`, `exp` claims                              |
| Transaction feed | An upstream service sends authorised-transaction events via webhook or message queue |

### Ending Context

| Item                 | State                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| `src/routes/`        | Express routers for `/api/v1/caps`, `/api/v1/budgets`, `/api/v1/admin/caps` |
| `src/controllers/`   | Controller modules for caps, budgets, admin                                 |
| `src/services/`      | Business logic - cap evaluation, utilisation tracking, alert emission       |
| `src/repositories/`  | Repository interfaces (data-store agnostic)                                 |
| `src/middleware/`    | Auth, validation, rate-limiting, error-handler middleware                   |
| `src/models/`        | Domain models / schemas for Cap, Budget, AuditEntry, Alert                  |
| `src/events/`        | Event emitter / publisher for threshold alerts                              |
| `tests/unit/`        | Jest unit tests for services and models                                     |
| `tests/integration/` | Supertest integration tests for every endpoint                              |
| `docs/openapi.yaml`  | OpenAPI 3.0 contract for the full API surface                               |

## Low-Level Tasks


### Task 0 - OpenAPI Contract

**Prompt:** Write an OpenAPI 3.0 specification that documents every endpoint, request/response schema, and error response.

**File to CREATE:** `docs/openapi.yaml`

**Details:**

- Document all endpoints from Tasks 4 and 6.
- Define reusable `components/schemas` for `SpendingCap`, `AuditEntry`, `AlertEvent`, `ErrorEnvelope`, and pagination wrapper.
- Include security scheme (`bearerAuth` with JWT).
- Specify all possible HTTP status codes per operation.
- This contract is the single source of truth - any implementation drift from this file is a defect.

### Task 1 - Domain Models & Validation Schemas

**Prompt:** Create the domain models and Joi validation schemas for SpendingCap, Budget, AuditEntry, and AlertEvent.

**File to CREATE:** `src/models/spending-cap.model.js`, `src/models/budget.model.js`, `src/models/audit-entry.model.js`, `src/models/alert-event.model.js`, `src/validation/cap.schema.js`, `src/validation/budget.schema.js`

**Details:**

- `SpendingCap`: `id`, `userId`, `periodType` (DAILY | WEEKLY | MONTHLY), `limitAmountMinorUnits` (integer), `categoryCode` (nullable - null means "all spending"), `currentUtilisationMinorUnits`, `warningThresholdPercent` (default 80), `status` (ACTIVE | PAUSED | DELETED), `createdAt`, `updatedAt`.
- `Budget`: composite view that groups a user's caps with utilisation percentages; not a separate persisted entity.
- `AuditEntry`: `id`, `eventType`, `actorId`, `actorRole`, `resourceType`, `resourceId`, `previousState` (JSON), `newState` (JSON), `timestamp`.
- `AlertEvent`: `id`, `userId`, `capId`, `thresholdPercent`, `currentUtilisationMinorUnits`, `limitAmountMinorUnits`, `emittedAt`.
- All monetary fields are integers (minor units). Joi schemas must reject negative amounts, enforce enum values, and cap `limitAmountMinorUnits` at a configurable max (e.g. 10 000 000 = $100 000).

### Task 2 - Repository Interfaces

**Prompt:** Create repository interface modules that abstract data access for spending caps, audit entries, and alert events.

**File to CREATE:** `src/repositories/cap.repository.js`, `src/repositories/audit.repository.js`, `src/repositories/alert.repository.js`

**Details:**

- Each repository exports an interface (object of async functions): `create`, `findById`, `findByUserId`, `update`, `softDelete`.
- `audit.repository.js` is append-only - it exposes `append` and `findByResource` / `findByActor` but no `update` or `delete`.
- Provide an in-memory implementation for each repository (used by tests and local development).
- The interface contract is the specification; any future Postgres/Mongo adapter must satisfy the same function signatures and return shapes.

### Task 3 - Authentication & Authorisation Middleware

**Prompt:** Implement Express middleware for JWT verification and role-based access control.

**File to CREATE:** `src/middleware/auth.middleware.js`, `src/middleware/rbac.middleware.js`

**Details:**

- `auth.middleware.js` - Extracts the `Authorization: Bearer <token>` header, verifies the JWT signature and expiry using a configurable public key / secret key, and attaches the decoded payload to `req.user`. Returns `401` on missing, malformed, or expired tokens.
- `rbac.middleware.js` - Factory function `requireRole(...roles)` that checks `req.user.roles` against the allowed list. Returns `403` if the user lacks the required role.
- Never log the raw JWT or any claim that constitutes PII.

### Task 4 - Spending Cap Endpoints (End-User)

**Prompt:** Create the Express router and controller for end-user spending cap operations.

**File to CREATE:** `src/routes/cap.routes.js`, `src/controllers/cap.controller.js`, `src/services/cap.service.js`

**Details:**

- `POST /api/v1/caps` - Create a new cap. Validate input via Joi schema. Write audit entry. Return `201`.
- `GET /api/v1/caps` - List the authenticated user's active caps. Support query filters: `periodType`, `categoryCode`. Return `200`.
- `GET /api/v1/caps/:id` - Get a single cap. Return `404` if not found or not owned by the user.
- `PATCH /api/v1/caps/:id` - Update limit amount, warning threshold, or status. Write audit entry with before/after state. Return `200`.
- `DELETE /api/v1/caps/:id` - Soft-delete (set status to DELETED). Write audit entry. Return `204`.
- All endpoints are scoped to `req.user.sub` - a user must never access another user's caps.

### Task 5 - Utilisation Tracking & Alert Emission

**Prompt:** Implement the service that processes incoming transaction events, updates cap utilisation, and emits threshold alerts.

**File to CREATE:** `src/services/utilisation.service.js`, `src/events/alert.publisher.js`

**Details:**

- Receive a transaction event (`userId`, `amountMinorUnits`, `categoryCode`, `transactionId`, `timestamp`).
- Find all ACTIVE caps for the user that match the transaction's category (or have no category filter).
- Increment `currentUtilisationMinorUnits`. The operation must be **idempotent** - processing the same `transactionId` twice must not double-count.
- After updating, check whether utilisation has crossed the `warningThresholdPercent` or 100 %. If so, publish an `AlertEvent` via the alert publisher.
- `alert.publisher.js` - Accepts an `AlertEvent` and forwards it to a configurable transport (in-memory event emitter for now; designed to swap in Kafka / SQS / webhook later).

### Task 6 - Admin / Ops Endpoints

**Prompt:** Create read-only admin endpoints for compliance and support staff.

**File to CREATE:** `src/routes/admin.routes.js`, `src/controllers/admin.controller.js`

**Details:**

- `GET /api/v1/admin/caps` - List all caps across users. Support filters: `userId`, `status`, `periodType`, `dateFrom`, `dateTo`. Paginate with `offset` / `limit` (default 20, max 100).
- `GET /api/v1/admin/caps/:id` - Get any cap by ID (not scoped to the requester).
- `GET /api/v1/admin/caps/:id/audit` - Get the full audit trail for a specific cap.
- `GET /api/v1/admin/alerts` - List alerts. Filter by `userId`, `dateFrom`, `dateTo`, `thresholdPercent`.
- All admin routes require the `admin` or `compliance_officer` role via RBAC middleware.
- Responses must mask user PII (e.g. show only last 4 chars of external user identifiers) unless the caller holds a `pii_access` role.

### Task 7 - Error Handling & Logging Middleware

**Prompt:** Implement centralised error handling and structured request/response logging.

**File to CREATE:** `src/middleware/error-handler.middleware.js`, `src/middleware/request-logger.middleware.js`

**Details:**

- `error-handler.middleware.js` - Catches all unhandled errors, maps known domain errors to HTTP status codes, formats the error envelope, and ensures stack traces are never sent in production.
- `request-logger.middleware.js` - Logs every request/response with: method, path, status code, duration (ms), traceId (from `x-trace-id` header or auto-generated UUID). Mask authorisation headers and PII query params in log output.

### Task 8 - Unit & Integration Tests

**Prompt:** Write a comprehensive Jest test suite covering services, middleware, and API endpoints.

**File to CREATE:** `tests/unit/cap.service.test.js`, `tests/unit/utilisation.service.test.js`, `tests/unit/auth.middleware.test.js`, `tests/integration/cap.routes.test.js`, `tests/integration/admin.routes.test.js`

**Details:**

- **Unit tests** - Test each service function in isolation using the in-memory repository. Cover: happy path, validation errors, duplicate transaction idempotency, threshold crossing, soft-delete behaviour.
- **Integration tests** - Use Supertest against the Express app. Cover: full CRUD lifecycle, auth rejection (no token, expired token, wrong role), pagination, PII masking in admin responses.
- Minimum coverage target: **80 % line coverage** across `src/`.
- Include a `jest.config.js` with coverage thresholds enforced.
