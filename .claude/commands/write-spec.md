Generate a complete technical specification for the Node.js multi-agent banking transaction processing system in homework-6/.

The specification must follow the template in homework-6/specification-TEMPLATE-hint.md exactly.

Write the output to homework-6/specification.md with these sections:

## 1. High-Level Objective
One sentence: a 3-agent Node.js pipeline that validates, scores for fraud risk, and settles banking transactions using file-based JSON message passing.

## 2. Mid-Level Objectives
5 concrete, testable requirements:
- Transactions with missing required fields or invalid amounts are rejected with a reason code
- Transactions with invalid ISO 4217 currency codes are rejected with INVALID_CURRENCY
- Transactions above $10,000 are scored for fraud risk; above $50,000 are HIGH risk
- HIGH risk transactions are rejected with FRAUD_RISK_HIGH; LOW/MEDIUM are settled
- The pipeline processes all 8 sample transactions and writes 8 result files to shared/results/

## 3. Implementation Notes
- Monetary values: use string representation throughout (never float); parse with a decimal library
- Currency validation: ISO 4217 whitelist (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, HKD, NZD, SEK, SGD, NOK, DKK)
- Logging: audit trail to stderr with ISO 8601 timestamp, agent name, transaction_id, outcome
- PII: mask account numbers in logs (first 4 chars + ****)
- Language: Node.js (ES modules or CommonJS), no Python

## 4. Context
- Beginning state: sample-transactions.json exists with 8 raw transaction records
- Ending state: all 8 transactions processed, results in shared/results/, test coverage ≥ 90%, README and HOWTORUN complete

## 5. Low-Level Tasks

One entry per agent in this format:

### Task: Transaction Validator
**Prompt**: "Context: Node.js project, file-based JSON message passing via shared/ directories. Task: Build agents/transactionValidator.js that reads a message envelope from shared/input/, validates the transaction data, and writes the result to shared/output/. Rules: check required fields (transaction_id, amount, currency, source_account, destination_account, timestamp), validate amount is a positive number (string-encoded), validate currency against ISO 4217 whitelist, mask account numbers in logs, write status: validated or rejected with rejection_reason. Output: CommonJS module exporting processMessage(message) returning updated message."
**File to CREATE**: agents/transactionValidator.js
**Function to CREATE**: processMessage(message)
**Details**: Validates required fields, positive amount, ISO 4217 currency. Returns status: validated or rejected + rejection_reason.

### Task: Fraud Detector
**Prompt**: "Context: Node.js project. Input is a validated message from shared/output/. Task: Build agents/fraudDetector.js that scores transactions for fraud risk. Rules: amount > $10,000 = +3 pts, amount > $50,000 = +4 additional pts, unusual hour 2–4 AM UTC = +2 pts, cross-border or non-USD = +1 pt, known fraud accounts = +2 pts. Risk levels: LOW 0–2, MEDIUM 3–6, HIGH 7–10. Only process validated messages; pass through rejected ones unchanged. Output: CommonJS module exporting processMessage(message) returning message with fraud_risk_score and fraud_risk_level."
**File to CREATE**: agents/fraudDetector.js
**Function to CREATE**: processMessage(message)
**Details**: Scores fraud risk 0–10. Sets fraud_risk_level: LOW/MEDIUM/HIGH. Passes through rejected transactions unchanged.

### Task: Settlement Processor
**Prompt**: "Context: Node.js project. Input is a fraud-scored message from shared/processing/. Task: Build agents/settlementProcessor.js that finalizes transactions. Rules: HIGH risk → rejected with FRAUD_RISK_HIGH, MEDIUM risk → settled + review_flag: true, LOW risk → settled. Generate a UUID settlement_id for settled transactions. Write final JSON to shared/results/<transaction_id>.json. Output: CommonJS module exporting processMessage(message) returning final message."
**File to CREATE**: agents/settlementProcessor.js
**Function to CREATE**: processMessage(message)
**Details**: Finalizes settlement. HIGH risk rejected, MEDIUM settled with review flag, LOW settled. Writes result files.

Author: Yaroslav Brahinets
