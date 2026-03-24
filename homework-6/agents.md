# Agents: AI-Powered Multi-Agent Banking Transaction Pipeline

**Author**: Yaroslav Brahinets

---

## Agent 1 — Specification Agent

**Role**: Produces the detailed technical specification before any code is written.

**Skill**: `/write-spec` — slash command that generates `specification.md` following the template in `specification-TEMPLATE-hint.md`.

**Outputs**: `specification.md`, `agents.md`

---

## Agent 2 — Code Generation Agent

**Role**: Implements the transaction processing pipeline from the specification.

**MCP**: Uses **context7** during code generation to look up Node.js libraries. Queries documented in `research-notes.md`.

**Outputs**: `integrator.js`, `agents/currencyConverter.js`, `agents/transactionValidator.js`, `agents/fraudDetector.js`, `agents/complianceChecker.js`, `agents/settlementProcessor.js`, `agents/reportingAgent.js`, `api/server.js`

### Pipeline agents (6 total)

| # | Agent | Input dir | Output dir | Decision |
|---|-------|-----------|------------|----------|
| 0 | Currency Converter | `shared/input/` | `shared/converted/` | USD pass-through / EUR→USD / UAH→USD / unsupported pass-through |
| 1 | Transaction Validator | `shared/converted/` | `shared/output/` | validated / rejected (MISSING_FIELDS, INVALID_AMOUNT, INVALID_CURRENCY) |
| 2 | Fraud Detector | `shared/output/` | `shared/processing/` | LOW / MEDIUM / HIGH risk score |
| 3 | Compliance Checker | `shared/processing/` | `shared/compliance/` | cleared / AML_REVIEW_REQUIRED / SANCTIONED_ACCOUNT |
| 4 | Settlement Processor | `shared/compliance/` | `shared/results/` | settled / rejected (FRAUD_RISK_HIGH) |
| 5 | Reporting Agent | `shared/results/` | `shared/results/pipeline-report.json` | summary statistics |

### REST API Gateway

**File**: `api/server.js`

**Role**: Accepts individual transactions over HTTP and runs them through the full pipeline inline (Currency Converter → Validator → Fraud Detector → Compliance Checker → Settlement Processor). Results are written to `shared/results/` and readable via GET endpoints.

**Endpoints**:

| Method | Path | Response |
|--------|------|----------|
| `POST` | `/api/transactions` | `201 { tracking_id, status }` |
| `GET`  | `/api/transactions/:id/status` | `200 { transaction_id, status, details }` or `404` |
| `GET`  | `/api/results` | `200 [{ transaction_id, status }, ...]` |

**Port**: 1234 (configurable via `PORT` environment variable)

---

## Agent 3 — Unit Test Agent

**Role**: Writes unit and integration tests for all pipeline agents.

**Hook**: Coverage gate — blocks `git push` if test coverage falls below 80%.

**Outputs**: `tests/` directory

---

## Agent 4 — Documentation Agent

**Role**: Generates README, HOWTORUN, and project documentation.

**Requirement**: README must include author name (Yaroslav Brahinets).

**Outputs**: `README.md`, `HOWTORUN.md`, `agents.md`
