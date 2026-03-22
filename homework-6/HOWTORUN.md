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

This installs `decimal.js`, `uuid`, `@modelcontextprotocol/sdk`, and `jest`.

---

## 3. Run the Full Pipeline

```bash
npm run pipeline
```

Equivalent to:

```bash
node integrator.js
```

The integrator reads all 8 transactions from `sample-transactions.json`, routes each one through the five pipeline agents in sequence, and writes results to `shared/results/`. After all transactions are processed, a summary table is printed to stdout.

---

## 4. Run Validation Only (Dry Run)

To run the Transaction Validator against `sample-transactions.json` without writing any files or touching the `shared/` directories:

```bash
node agents/transactionValidator.js --dry-run
```

This prints a table of each transaction ID, its validation status, and any rejection reason to stdout.

---

## 5. Run Tests and Coverage

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

## 6. Use the `/run-pipeline` Skill in Claude Code

Inside a Claude Code session in this project directory, invoke:

```
/run-pipeline
```

This executes `node integrator.js`, then prints the pipeline summary and asks Claude to interpret the results.

---

## 7. Use the `/validate-transactions` Skill in Claude Code

Inside a Claude Code session in this project directory, invoke:

```
/validate-transactions
```

This runs the dry-run validator and asks Claude to summarise which transactions passed or failed validation and why.

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

The server runs until terminated. It reads result files from `shared/results/`, so run the pipeline at least once before querying it.

To register it with Claude Code, add an entry to your `.claude/settings.local.json` or project MCP configuration pointing to `node mcp/server.js` with stdio transport.

---

## 9. Expected Output

After `npm run pipeline` completes successfully you should see output similar to the following:

```
=== Banking Pipeline Starting ===

Loaded 8 transactions from sample-transactions.json

Dropped 8 messages into shared/input/

=== Pipeline Complete ===

Transaction Results:
----------------------------------------------------------------------
TXN001       SETTLED     risk=LOW
TXN002       SETTLED     risk=MEDIUM    [AML_REVIEW]  [REVIEW_FLAG]
TXN003       REJECTED    risk=HIGH      [FRAUD_RISK_HIGH]
TXN004       REJECTED    risk=N/A       [MISSING_FIELDS]
TXN005       REJECTED    risk=N/A       [INVALID_AMOUNT]
TXN006       SETTLED     risk=LOW
TXN007       REJECTED    risk=N/A       [SANCTIONED_ACCOUNT]
TXN008       SETTLED     risk=LOW
----------------------------------------------------------------------

Summary:
  Total:    8
  Settled:  4
  Rejected: 4
...
Report written to shared/results/pipeline-report.json
```

Audit log lines are written to stderr (one line per agent per transaction) and will appear interleaved in the terminal unless you redirect stderr separately:

```bash
node integrator.js 2>pipeline-audit.log
```
