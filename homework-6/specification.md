# Specification: AI-Powered Multi-Agent Banking Transaction Pipeline

**Author**: Yaroslav Brahinets

---

## 1. High-Level Objective

Build a 3-agent Node.js pipeline that validates, scores for fraud risk, and settles banking transactions using file-based JSON message passing.

---

## 2. Mid-Level Objectives

- Transactions with missing required fields or invalid amounts are rejected with a reason code (`MISSING_FIELDS` or `INVALID_AMOUNT`)
- Transactions with invalid ISO 4217 currency codes are rejected with `INVALID_CURRENCY`
- Transactions above $10,000 are assigned a fraud risk score; transactions above $50,000 receive a HIGH risk level
- HIGH risk transactions are rejected with `FRAUD_RISK_HIGH`; LOW and MEDIUM risk transactions are settled
- The pipeline processes all 8 sample transactions and writes 8 result files to `shared/results/`

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
- **Ending state**: All 8 transactions processed. Results written to `shared/results/` as individual JSON files per `transaction_id`. Test coverage ≥ 90%. `README.md` and `HOWTORUN.md` complete.

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
