# How to Run the Banking Transaction Pipeline

Step-by-step instructions from a clean checkout to a running demo.

---

## 1. Prerequisites

- **Node.js v18 or later** is required. Verify your version:
  ```bash
  node --version
  ```
- Clone the repository and navigate to the project directory:
  ```bash
  git clone <repository-url>
  cd AI-Coding-Partner-Homework/homework-6
  ```

---

## 2. Install Dependencies

```bash
npm install
```

This installs `decimal.js`, `uuid`, `express`, `@modelcontextprotocol/sdk`, and `jest`.

---

## 3. Run the Full Batch Pipeline

```bash
npm run pipeline
```

Equivalent to:

```bash
node integrator.js
```

The integrator reads all 9 transactions from `sample-transactions.json`, routes each one through the six pipeline agents in sequence, and writes results to `shared/results/`. After all transactions are processed, a summary table is printed to stdout.

The pipeline stages (in order):

| Stage | Agent | Input | Output |
|-------|-------|-------|--------|
| 0 | Currency Converter | `shared/input/` | `shared/converted/` |
| 1 | Transaction Validator | `shared/converted/` | `shared/output/` |
| 2 | Fraud Detector | `shared/output/` | `shared/processing/` |
| 3 | Compliance Checker | `shared/processing/` | `shared/compliance/` |
| 4 | Settlement Processor | `shared/compliance/` | `shared/results/` |
| 5 | Reporting Agent | `shared/results/` | `shared/results/pipeline-report.json` |

Audit log lines (one per agent per transaction) are written to stderr. To separate them:

```bash
node integrator.js 2>pipeline-audit.log
```

### Expected output

```
=== Banking Pipeline Starting ===

Loaded 9 transactions from sample-transactions.json

Dropped 9 messages into shared/input/

=== Pipeline Complete ===

Transaction Results:
----------------------------------------------------------------------
TXN001  SETTLED     risk=LOW
TXN002  SETTLED     risk=MEDIUM   [AML_REVIEW] [REVIEW_FLAG]
TXN003  SETTLED     risk=LOW
TXN004  SETTLED     risk=MEDIUM   [REVIEW_FLAG]
TXN005  REJECTED    risk=HIGH     [FRAUD_RISK_HIGH] [AML_REVIEW]
TXN006  REJECTED    risk=N/A      [INVALID_CURRENCY]
TXN007  REJECTED    risk=N/A      [INVALID_AMOUNT]
TXN008  SETTLED     risk=LOW
TXN009  SETTLED     risk=LOW
----------------------------------------------------------------------

Summary:
  Total:    9
  Settled:  6
  Rejected: 3
```

TXN004 (EUR) and TXN009 (UAH) are converted to USD by the Currency Converter before validation. Their result files include `original_amount`, `original_currency`, and `conversion_rate` fields.

---

## 4. Run Validation Only (Dry Run)

To run the Transaction Validator against `sample-transactions.json` without writing any files or touching the `shared/` directories:

```bash
node agents/transactionValidator.js --dry-run
```

This prints a table of each transaction ID, its validation status, and any rejection reason to stdout.

---

## 5. Start the REST API Server

```bash
npm run api
```

Equivalent to:

```bash
node api/server.js
```

The server starts on **port 1234** and exposes three endpoints:

| Method | Endpoint | Description | Success code |
|--------|----------|-------------|--------------|
| `POST` | `/api/transactions` | Submit a transaction for processing | 201 |
| `GET`  | `/api/transactions/:id/status` | Get result for a specific transaction | 200 |
| `GET`  | `/api/results` | List all processed transactions | 200 |

### Submit a transaction

```bash
curl -X POST http://localhost:1234/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "MY-TXN-1",
    "amount": "500.00",
    "currency": "EUR",
    "source_account": "ACC-001",
    "destination_account": "ACC-002",
    "timestamp": "2026-03-24T10:00:00Z",
    "transaction_type": "transfer"
  }'
```

Response:

```json
{ "tracking_id": "MY-TXN-1", "status": "accepted" }
```

### Check status

```bash
curl http://localhost:1234/api/transactions/MY-TXN-1/status
```

### List all results

```bash
curl http://localhost:1234/api/results
```

### Error responses

| Situation | HTTP code | Body |
|-----------|-----------|------|
| Missing required fields | 400 | `{ "error": "Missing required fields", "missing_fields": [...] }` |
| Transaction not found | 404 | `{ "error": "Transaction not found", "transaction_id": "..." }` |

---

## 6. Run the Interactive Demo

```bash
./demo.sh
```

The script walks through the full system end-to-end in four interactive steps, each gated by pressing Enter:

1. **Start server** — launches `api/server.js` in the background and health-checks it
2. **Submit transactions** — POSTs four test transactions (USD, large wire, UAH, invalid currency)
3. **Inspect results** — GETs each transaction's status with risk level, flags, and conversion info
4. **Summary** — shows approved vs rejected counts, then stops the server

No manual steps are required beyond pressing Enter. The server is started and stopped automatically.

---

## 7. Run Tests and Coverage

Run the full test suite:

```bash
npm test
```

Run tests with a coverage report (requires >= 80% statement coverage to pass):

```bash
npm run test:coverage
```

Coverage is collected from all files under `agents/`. The HTML report is written to `coverage/lcov-report/index.html`.

---

## 8. Start the MCP Server

The MCP server (`mcp/server.js`) exposes two tools and one resource to any MCP-compatible client (such as Claude Code):

- `get_transaction_status` — look up the result of a single transaction by ID
- `list_pipeline_results` — list all processed transactions with status and risk level
- `pipeline://summary` resource — human-readable summary of `pipeline-report.json`

Start the server over stdio:

```bash
node mcp/server.js
```

The server reads result files from `shared/results/`, so run the pipeline at least once before querying it.

---

## 9. Use Claude Code Skills

Inside a Claude Code session in this project directory:

| Skill | What it does |
|-------|-------------|
| `/run-pipeline` | Runs `node integrator.js` and asks Claude to interpret the results |
| `/validate-transactions` | Runs the dry-run validator and asks Claude to summarise outcomes |
