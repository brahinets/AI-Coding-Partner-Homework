# AI Agent Configuration - Spending Caps & Budgeting Service

> This file defines project-wide rules for any AI coding assistant (GitHub Copilot, Claude Code, Cursor, etc.) working on this codebase.

---

## Project Overview

- **Service**: Spending Caps & Budgeting microservice for a regulated fintech platform.
- **Primary spec**: See `specification.md` - it is the single source of truth for all feature requirements.
- **OpenAPI contract**: `docs/openapi.yaml` - all endpoints must match this contract exactly (to be created).

---

## Tech Stack

| Component  | Version / Tool                          |
| ---------- | --------------------------------------- |
| Runtime    | Node.js 25 LTS                          |
| Framework  | Express 5.x                             |
| Testing    | Jest 30+ with Supertest                 |
| Validation | Joi 18+                                 |
| Logging    | pino (structured JSON)                  |
| Linting    | ESLint with `eslint-config-airbnb-base` |
| Auth       | JWT (RS256 or HS256 - configurable)     |

---

## Project Structure

```
src/
├── routes/          # Express routers - one file per resource
├── controllers/     # Thin controllers - parse request, call service, format response
├── services/        # Business logic - all domain rules live here
├── repositories/    # Data access interfaces + in-memory implementations
├── models/          # Domain model definitions
├── validation/      # Joi schemas for request payloads
├── middleware/      # Auth, RBAC, error handler, request logger, rate limiter
├── events/          # Alert publisher / event emitter abstraction
├── config/          # Environment-based configuration (dotenv)
└── utils/           # Shared helpers (ID generation, date utils)
tests/
├── unit/            # Jest unit tests - one file per service/middleware
├── integration/     # Supertest API tests - one file per router
└── fixtures/        # Shared test data and factory functions
docs/
└── openapi.yaml     # OpenAPI 3.0 contract
```

---

## Code Style & Conventions

- **Module system**: ES modules (`import`/`export`). Set `"type": "module"` in `package.json`.
- **Naming**: camelCase for variables and functions; PascalCase for classes; kebab-case for file names (e.g. `cap.service.js`, `auth.middleware.js`).
- **Functions**: Prefer named function declarations or `const fn = async () => {}` for exported functions. No default exports except for Express app entry point.
- **Error throwing**: Throw custom domain error classes (e.g. `CapNotFoundError`, `AuthorisationError`) - never throw plain strings.
- **No `var`**: Use `const` by default; `let` only when reassignment is genuinely needed.
- **No `console.log`**: Always use the pino logger instance. `console.*` calls must not appear in `src/`.

---

## Domain Rules - Fintech / Banking

These rules are **mandatory** - any generated code that violates them must be rejected.

1. **Monetary values** - Always represent as **integer minor units** (cents). Never use `Number` with decimals for money. Never use `parseFloat` on monetary strings.
2. **Dates & times** - Store and transmit in **ISO-8601 UTC**. Never rely on server-local timezone.
3. **Idempotency** - Transaction processing must be idempotent. Use `transactionId` as a deduplication key.
4. **Audit trail** - Every state mutation must write an immutable audit record with `actorId`, `actorRole`, `timestamp`, `previousState`, `newState`.
5. **PII masking** - User identifiers must be masked in logs (show last 4 characters only). Full PII must never appear in application logs.
6. **Soft deletes** - Never hard-delete financial records. Use a `status: DELETED` flag with an audit entry.
7. **Input validation** - Validate all external input at the controller/middleware layer. Reject unexpected fields.
8. **Sensitive headers** - Never log `Authorization`, `Cookie`, or any header containing tokens or credentials.

---

## Testing Expectations

- **Minimum coverage**: 80 % line coverage across `src/`.
- **Unit tests**: Test services in isolation with in-memory repositories. Mock external dependencies.
- **Integration tests**: Test API endpoints using Supertest. Verify status codes, response shapes, auth enforcement, and error envelopes.
- **Test naming**: Use the pattern `describe('<Module>') → it('should <expected behaviour> when <condition>')`.
- **No production dependencies in tests**: Use `devDependencies` for test libraries.
- **Idempotency tests**: Explicitly test that duplicate transaction events do not double-count utilisation.

---

## Security & Compliance Constraints

- **Authentication**: Every endpoint (except health checks) requires a valid JWT in the `Authorization: Bearer` header.
- **Role-based access**: Admin endpoints require `admin` or `compliance_officer` role. End-user endpoints are scoped to the token's `sub` claim.
- **Rate limiting**: Enforce per-user rate limits. Default: 60 requests per minute.
- **HTTPS**: The service must refuse plain HTTP in production environments.
- **Dependency scanning**: Run `npm audit` as part of CI; fail the build on high/critical vulnerabilities.
- **Environment secrets**: Never hard-code secrets. Load via environment variables (dotenv in development, secret manager in production).
- **GDPR / CCPA**: Support data-export and data-deletion requests for a given userId. Audit records are retained for 7 years minimum.

---

## What to Avoid

- ❌ Floating-point arithmetic for monetary calculations.
- ❌ Hard-coded secrets, API keys, or connection strings.
- ❌ `console.log` / `console.error` - use pino logger.
- ❌ Hard-deleting any record from the data store.
- ❌ Returning stack traces or internal error details in API responses.
- ❌ Logging raw JWTs, full user IDs, or any PII.
- ❌ Using `any` in JSDoc types - be explicit.
- ❌ Skipping audit entries for state-changing operations.
- ❌ Adding endpoints not defined in `docs/openapi.yaml` - update the contract first.