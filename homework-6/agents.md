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

**Outputs**: `integrator.js`, `agents/transactionValidator.js`, `agents/fraudDetector.js`, `agents/complianceChecker.js`, `agents/settlementProcessor.js`, `agents/reportingAgent.js`

### Pipeline agents (5 total)

| # | Agent | Input dir | Output dir | Decision |
|---|-------|-----------|------------|----------|
| 1 | Transaction Validator | `shared/input/` | `shared/output/` | validated / rejected |
| 2 | Fraud Detector | `shared/output/` | `shared/processing/` | LOW / MEDIUM / HIGH risk score |
| 3 | Compliance Checker | `shared/processing/` | `shared/compliance/` | cleared / AML_REVIEW_REQUIRED / SANCTIONED_ACCOUNT |
| 4 | Settlement Processor | `shared/compliance/` | `shared/results/` | settled / rejected (FRAUD_RISK_HIGH) |
| 5 | Reporting Agent | `shared/results/` | `shared/results/pipeline-report.json` | summary statistics |

---

## Agent 3 — Unit Test Agent

**Role**: Writes unit and integration tests for all pipeline agents.

**Hook**: Coverage gate — blocks `git push` if test coverage falls below 80%.

**Outputs**: `tests/` directory

---

## Agent 4 — Documentation Agent

**Role**: Generates README, HOWTORUN, and project documentation.

**Requirement**: README must include author name (Yaroslav Brahinets).

**Outputs**: `README.md`, `HOWTORUN.md`
