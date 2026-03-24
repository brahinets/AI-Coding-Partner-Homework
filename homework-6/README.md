# AI-Powered Multi-Agent Banking Transaction Pipeline

Created by Yaroslav Brahinets

---

## What the System Does

This project implements a six-stage Node.js pipeline that processes banking transactions through a chain of specialized agents. Each agent performs a single, well-defined responsibility and communicates with the next agent by writing JSON message files to a shared directory on disk.

The pipeline takes a batch of raw transaction records, normalizes their currency to USD, validates their structure and data integrity, scores them for fraud risk, checks regulatory compliance, settles valid transactions, and produces a final aggregated report.

Transactions that fail any stage carry a machine-readable rejection reason forward through all remaining stages, which pass them through unchanged — ensuring every input produces exactly one result file. All agents write audit log entries to stderr with ISO 8601 timestamps and masked account numbers to satisfy PII requirements.

The system also exposes a **REST API gateway** (`api/server.js`) that accepts individual transactions over HTTP and runs them through the same pipeline synchronously.

---

## Agent Responsibilities

- **Currency Converter** — Normalizes transaction amounts to USD before validation. Supported input currencies: USD (pass-through), EUR (rate: 1.08), UAH (rate: 0.024). Unsupported currencies are passed through unchanged for the validator to reject. Converted transactions carry `original_amount`, `original_currency`, and `conversion_rate` fields in the result.

- **Transaction Validator** — Checks that all required fields are present (`transaction_id`, `amount`, `currency`, `source_account`, `destination_account`, `timestamp`), validates that `amount` is a positive string-encoded decimal, and validates `currency` against the ISO 4217 whitelist. Sets `status: "validated"` or `status: "rejected"` with a `rejection_reason` of `MISSING_FIELDS`, `INVALID_AMOUNT`, or `INVALID_CURRENCY`.

- **Fraud Detector** — Scores each validated transaction on a 0–10 cumulative scale: amount > $10,000 (+3 pts), amount > $50,000 (+4 additional pts), transaction hour 2–4 AM UTC (+2 pts), non-USD currency or cross-border metadata (+1 pt), known fraud accounts ACC-9999 / ACC-0000 / ACC-1111 (+2 pts). Maps score to `fraud_risk_level`: LOW (0–2), MEDIUM (3–6), HIGH (7–10).

- **Compliance Checker** — Enforces AML and sanctions rules. Wire transfers above $10,000 receive `compliance_flag: "AML_REVIEW_REQUIRED"` (does not reject; transaction proceeds with flag). Transactions involving sanctioned accounts `ACC-SANC1` or `ACC-SANC2` are rejected with `rejection_reason: "SANCTIONED_ACCOUNT"`. All other non-rejected messages receive `compliance_status: "cleared"`.

- **Settlement Processor** — Finalizes each transaction. HIGH fraud risk triggers `status: "rejected"` with `rejection_reason: "FRAUD_RISK_HIGH"`. MEDIUM risk results in `status: "settled"` with `review_flag: true`. LOW risk results in `status: "settled"`. Settled transactions receive a UUID v4 `settlement_id` and ISO 8601 `settlement_timestamp`. Writes one result file per transaction to `shared/results/`.

- **Reporting Agent** — Reads all result files from `shared/results/`, aggregates statistics, and writes `shared/results/pipeline-report.json`. The report includes total transaction count, settled and rejected counts, distribution by fraud risk level, a breakdown of rejection reasons by code, and a list of transaction IDs that require AML review.

---

## Architecture

```
sample-transactions.json
        │
        ▼
   [Integrator]  (integrator.js)
        │  wraps each transaction in a message envelope
        │  writes to shared/input/<txn_id>.json
        ▼
[Currency Converter]                         ← NEW (stage 0)
        │  reads  shared/input/
        │  writes shared/converted/          EUR/UAH → USD, others pass-through
        ▼
[Transaction Validator]
        │  reads  shared/converted/
        │  writes shared/output/             status: validated | rejected
        ▼
  [Fraud Detector]
        │  reads  shared/output/
        │  writes shared/processing/         + fraud_risk_score, fraud_risk_level
        ▼
[Compliance Checker]
        │  reads  shared/processing/
        │  writes shared/compliance/         + compliance_status | compliance_flag | rejected
        ▼
[Settlement Processor]
        │  reads  shared/compliance/
        │  writes shared/results/<txn_id>.json   status: settled | rejected
        ▼
 [Reporting Agent]
        │  reads  shared/results/
        └─ writes shared/results/pipeline-report.json
```

The REST API gateway runs the same stages inline per HTTP request:

```
POST /api/transactions
        │
        └─ Currency Converter → Validator → Fraud Detector
                → Compliance Checker → Settlement Processor
                        └─ writes shared/results/<txn_id>.json
                                └─ returns { tracking_id, status }
```

---

## REST API

Start the server:

```bash
npm run api          # http://localhost:1234
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/transactions` | Submit a transaction; returns `{ tracking_id, status }` |
| `GET`  | `/api/transactions/:id/status` | Get processing result for a transaction |
| `GET`  | `/api/results` | List all processed transactions |

Error responses follow the format `{ "error": "...", ... }` with appropriate HTTP status codes (400, 404, 500).

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js v18+ (CommonJS modules) |
| Pipeline orchestration | `integrator.js` |
| REST API | Express ^5.2.1 |
| Decimal arithmetic | `decimal.js` ^10.6.0 |
| UUID generation | `uuid` ^13.0.0 |
| MCP server | `@modelcontextprotocol/sdk` ^1.27.1 |
| Test framework | Jest ^30.3.0 |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the full batch pipeline
npm run pipeline

# 3. Inspect the report
cat shared/results/pipeline-report.json

# 4. Start the REST API server
npm run api

# 5. Run the interactive end-to-end demo
./demo.sh
```
