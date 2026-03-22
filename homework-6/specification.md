# Specification: AI-Powered Multi-Agent Banking Transaction Pipeline

**Author**: Yaroslav Brahinets

---

## 1. High-Level Objective

Build a 5-agent Node.js pipeline that validates, scores for fraud risk, checks regulatory compliance, settles, and reports on banking transactions using file-based JSON message passing.

---

## 2. Mid-Level Objectives

- Transactions with missing required fields or invalid amounts are rejected with a reason code (`MISSING_FIELDS` or `INVALID_AMOUNT`)
- Transactions with invalid ISO 4217 currency codes are rejected with `INVALID_CURRENCY`
- Transactions above $10,000 are assigned a fraud risk score; transactions above $50,000 receive a HIGH risk level
- HIGH risk transactions are rejected with `FRAUD_RISK_HIGH`; LOW and MEDIUM risk transactions proceed to compliance check
- Wire transfers above $10,000 are flagged for AML review (`AML_REVIEW_REQUIRED`); transactions to sanctioned accounts are rejected with `SANCTIONED_ACCOUNT`
- The pipeline processes all 8 sample transactions and writes 8 result files to `shared/results/`
- A final reporting agent produces a `shared/results/pipeline-report.json` summary with counts by status, risk level, and rejection reason

---

## 3. Implementation Notes

- **Monetary values**: use string representation throughout (never `float`); parse with a decimal library (`decimal.js` or equivalent)
- **Currency validation**: ISO 4217 whitelist — USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, HKD, NZD, SEK, SGD, NOK, DKK
- **Logging**: audit trail written to stderr with ISO 8601 timestamp, agent name, `transaction_id`, and outcome
- **PII**: mask account numbers in all log output (first 4 chars + `****`)
- **Language**: Node.js (CommonJS modules); no Python

---

## 4. Context

- **Beginning state**: `sample-transactions.json` exists with 8 raw transaction records. No agent files exist. `shared/` subdirectories may not exist.
- **Ending state**: All 8 transactions processed. Results written to `shared/results/` as individual JSON files per `transaction_id`. A `pipeline-report.json` summary file is also present in `shared/results/`. Test coverage ≥ 90%. `README.md` and `HOWTORUN.md` complete.

---

## 5. Low-Level Tasks

### Task: Transaction Validator

**Prompt**: "Context: Node.js project, file-based JSON message passing via shared/ directories. Task: Build agents/transactionValidator.js that reads a message envelope from shared/input/, validates the transaction data, and writes the result to shared/output/. Rules: check required fields (transaction_id, amount, currency, source_account, destination_account, timestamp), validate amount is a positive number (string-encoded), validate currency against ISO 4217 whitelist, mask account numbers in logs, write status: validated or rejected with rejection_reason. Output: CommonJS module exporting processMessage(message) returning updated message."

**File to CREATE**: `agents/transactionValidator.js`

**Function to CREATE**: `processMessage(message)`

**Details**:
- Check all required fields are present: `transaction_id`, `amount`, `currency`, `source_account`, `destination_account`, `timestamp`
- Validate `amount` is a positive number (string-encoded, parseable as decimal)
- Validate `currency` against ISO 4217 whitelist
- Mask account numbers in log output (first 4 chars + `****`)
- Return message with `status: "validated"` or `status: "rejected"` + `rejection_reason` code

---

### Task: Fraud Detector

**Prompt**: "Context: Node.js project. Input is a validated message from shared/output/. Task: Build agents/fraudDetector.js that scores transactions for fraud risk. Rules: amount > $10,000 = +3 pts, amount > $50,000 = +4 additional pts, unusual hour 2–4 AM UTC = +2 pts, cross-border or non-USD = +1 pt, known fraud accounts (ACC-9999, ACC-0000, ACC-1111) = +2 pts. Risk levels: LOW 0–2, MEDIUM 3–6, HIGH 7–10. Only process validated messages; pass through rejected ones unchanged. Output: CommonJS module exporting processMessage(message) returning message with fraud_risk_score and fraud_risk_level."

**File to CREATE**: `agents/fraudDetector.js`

**Function to CREATE**: `processMessage(message)`

**Details**:
- Score each validated transaction on a 0–10 scale using cumulative rules
- Amount > $10,000: +3 pts; amount > $50,000: +4 additional pts (total +7)
- Transaction hour 2–4 AM UTC: +2 pts
- Cross-border or non-USD currency: +1 pt
- Known fraud accounts (ACC-9999, ACC-0000, ACC-1111): +2 pts
- Map score to risk level: LOW (0–2), MEDIUM (3–6), HIGH (7–10)
- Pass through rejected transactions without modification

---

### Task: Settlement Processor

**Prompt**: "Context: Node.js project. Input is a fraud-scored message from shared/processing/. Task: Build agents/settlementProcessor.js that finalizes transactions. Rules: HIGH risk → rejected with FRAUD_RISK_HIGH, MEDIUM risk → settled + review_flag: true, LOW risk → settled. Generate a UUID settlement_id for settled transactions. Write final JSON to shared/results/<transaction_id>.json. Output: CommonJS module exporting processMessage(message) returning final message."

**File to CREATE**: `agents/settlementProcessor.js`

**Function to CREATE**: `processMessage(message)`

**Details**:
- HIGH fraud risk → set `status: "rejected"`, `rejection_reason: "FRAUD_RISK_HIGH"`
- MEDIUM fraud risk → set `status: "settled"`, `review_flag: true`
- LOW fraud risk → set `status: "settled"`
- Settled transactions receive a UUID v4 `settlement_id` and ISO 8601 `settlement_timestamp`
- Write final result to `shared/results/<transaction_id>.json`

---

### Task: Compliance Checker

**Prompt**: "Context: Node.js project. Input is a fraud-scored message from shared/processing/. Task: Build agents/complianceChecker.js that enforces AML and sanctions rules before settlement. Rules: wire_transfer with amount > $10,000 → set compliance_flag: 'AML_REVIEW_REQUIRED', sanctioned accounts list (ACC-SANC1, ACC-SANC2) → reject with rejection_reason: 'SANCTIONED_ACCOUNT'. Pass through already-rejected messages unchanged. All other validated+fraud-scored messages pass with compliance_status: 'cleared'. Output: CommonJS module exporting processMessage(message) returning updated message."

**File to CREATE**: `agents/complianceChecker.js`

**Function to CREATE**: `processMessage(message)`

**Details**:
- Skip messages already rejected (pass through unchanged)
- If `transaction_type === "wire_transfer"` and `amount > $10,000`: set `compliance_flag: "AML_REVIEW_REQUIRED"` (does not reject, proceeds to settlement with flag)
- If `source_account` or `destination_account` is in sanctioned list (`ACC-SANC1`, `ACC-SANC2`): set `status: "rejected"`, `rejection_reason: "SANCTIONED_ACCOUNT"`
- All other messages: set `compliance_status: "cleared"`
- Log compliance decision to stderr with ISO 8601 timestamp and masked account numbers

---

### Task: Reporting Agent

**Prompt**: "Context: Node.js project. Input is all final result files from shared/results/. Task: Build agents/reportingAgent.js that reads every <transaction_id>.json file from shared/results/, aggregates statistics, and writes shared/results/pipeline-report.json. Report must include: total_transactions, counts by status (settled, rejected), counts by fraud_risk_level (LOW, MEDIUM, HIGH, N/A), rejection_reason breakdown (key → count), list of transactions requiring AML review (compliance_flag: AML_REVIEW_REQUIRED), generated_at ISO 8601 timestamp. Output: CommonJS module exporting generateReport(resultsDir) returning the report object."

**File to CREATE**: `agents/reportingAgent.js`

**Function to CREATE**: `generateReport(resultsDir)`

**Details**:
- Read all `.json` files from `shared/results/` (skip `pipeline-report.json` itself)
- Compute: `total_transactions`, `settled_count`, `rejected_count`
- Group by `fraud_risk_level` (LOW / MEDIUM / HIGH / N/A for rejected-before-scoring)
- Count each unique `rejection_reason`
- List `transaction_id` values where `compliance_flag === "AML_REVIEW_REQUIRED"`
- Write aggregated report to `shared/results/pipeline-report.json`
- Return the report object so it can be printed by the integrator
