# AI-Powered Multi-Agent Banking Transaction Pipeline

Created by Yaroslav Brahinets

---

## What the System Does

This project implements a five-stage Node.js pipeline that processes banking transactions through a chain of specialized agents. Each agent performs a single, well-defined responsibility and communicates with the next agent by writing JSON message files to a shared directory on disk. The pipeline takes a batch of raw transaction records, validates their structure and data integrity, scores them for fraud risk, checks regulatory compliance, settles valid transactions, and produces a final aggregated report.

The pipeline solves the problem of processing untrusted banking transaction input in an auditable, staged manner. Transactions that fail any stage carry a machine-readable rejection reason forward through the remaining stages, which pass them through unchanged, ensuring every input produces exactly one result file. All agents write audit log entries to stderr with ISO 8601 timestamps and masked account numbers to satisfy PII requirements.

---

## Agent Responsibilities

- **Transaction Validator** — Checks that all required fields are present (`transaction_id`, `amount`, `currency`, `source_account`, `destination_account`, `timestamp`), validates that `amount` is a positive string-encoded decimal, and validates `currency` against the ISO 4217 whitelist. Sets `status: "validated"` or `status: "rejected"` with a `rejection_reason` of `MISSING_FIELDS`, `INVALID_AMOUNT`, or `INVALID_CURRENCY`.

- **Fraud Detector** — Scores each validated transaction on a 0–10 cumulative scale: amount > $10,000 (+3 pts), amount > $50,000 (+4 additional pts), transaction hour 2–4 AM UTC (+2 pts), non-USD currency or cross-border metadata (+1 pt), known fraud accounts ACC-9999 / ACC-0000 / ACC-1111 (+2 pts). Maps score to `fraud_risk_level`: LOW (0–2), MEDIUM (3–6), HIGH (7–10). Passes already-rejected messages through unchanged.

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
[Transaction Validator]
        │  reads  shared/input/
        │  writes shared/output/          status: validated | rejected
        ▼
  [Fraud Detector]
        │  reads  shared/output/
        │  writes shared/processing/      + fraud_risk_score, fraud_risk_level
        ▼
[Compliance Checker]
        │  reads  shared/processing/
        │  writes shared/compliance/      + compliance_status | compliance_flag | rejected
        ▼
[Settlement Processor]
        │  reads  shared/compliance/
        │  writes shared/results/<txn_id>.json   status: settled | rejected
        ▼
 [Reporting Agent]
        │  reads  shared/results/
        └─ writes shared/results/pipeline-report.json
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js v18+ (CommonJS modules) |
| Pipeline orchestration | `integrator.js` |
| Decimal arithmetic | `decimal.js` ^10.6.0 |
| UUID generation | `uuid` ^13.0.0 |
| MCP server | `@modelcontextprotocol/sdk` ^1.27.1 |
| Test framework | Jest ^30.3.0 |
| Module system | CommonJS (`"type": "commonjs"`) |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the full pipeline
npm run pipeline

# 3. Inspect the report
cat shared/results/pipeline-report.json
```
