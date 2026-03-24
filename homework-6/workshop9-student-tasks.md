# Workshop 9 — Capstone Challenge: Extend Your Banking Pipeline

## Overview

In teams you will **extend your homework-6 multi-agent banking pipeline** with two new capability themes, build an end-to-end demo script, and present your solution to the group.

You have dedicated working time, followed by **team presentations** (~5 minutes each). Use AI tools throughout.

---

## Learning Objectives

- Extend an existing multi-agent system under time pressure using AI tools
- Externalize business rules into configuration (no hardcoded thresholds)
- Bridge a file-based batch pipeline to real-time HTTP access via an API gateway
- Write an automated end-to-end demo script that proves the system works
- Present technical work concisely to a peer audience

---

## Team Formation

- **4 teams**, ~4-5 people each
- Each team picks **one homework-6 project** as the base (choose the most complete submission)
- Designate roles to work in parallel:

| Role | Responsibility |
|------|----------------|
| **API Lead** | Build the REST API gateway (Theme B) |
| **New Agent Lead** | Build the new pipeline agent (Theme A) |
| **Rule Engine Lead** | Externalize thresholds into config, update existing agents (Theme A) |
| **Demo & Integration Lead** | Write demo script, integrate all parts, prepare presentation |

All members should use AI tools and help each other — roles are starting points, not silos.

---

## Tasks

### Theme A: New Agent + Configurable Rule Engine

#### Task A1: Add a New Agent to the Pipeline

Add a new (6th) agent to the pipeline. Choose one:

| Agent | Description | Suggested Position in Pipeline |
|-------|-------------|-------------------------------|
| **Currency Converter** | Converts non-USD transactions to USD using rates from config | Before Validator |
| **Rate Limiter** | Tracks per-account transaction velocity, blocks if too frequent | After Validator |
| **Notification Agent** | Produces alert messages for flagged/rejected transactions | After Fraud Detector |

**Requirements:**

- The agent must follow the existing **file-based JSON communication protocol** (read from `shared/output/`, write to `shared/output/` or `shared/results/`)
- Use the standard message format with `message_id`, `timestamp`, `source_agent`, `target_agent`, `message_type`, `data`
- The integrator must start this agent alongside existing agents
- The agent must process all transactions from `sample-transactions.json`

**Acceptance criteria:**

- [ ] Agent file exists in `agents/` directory
- [ ] Agent reads from and writes to `shared/` directories
- [ ] Agent produces valid JSON output in standard message format
- [ ] Integrator starts the new agent as part of the pipeline

---

#### Task A2: Externalized Rule Engine

Create a configuration file that externalizes business rules currently hardcoded in your agents.

**Required:** `config/rules.json` (or `config/rules.yaml`)

Must contain at minimum:

```json
{
  "fraud_detection": {
    "high_value_threshold": 10000,
    "very_high_value_threshold": 50000,
    "unusual_hours_start": 2,
    "unusual_hours_end": 5
  },
  "compliance": {
    "blocked_currencies": ["XYZ"],
    "aml_reporting_threshold": 10000
  },
  "velocity": {
    "max_transactions_per_hour": 5
  },
  "your_custom_rule_1": "...",
  "your_custom_rule_2": "..."
}
```

- Include **at least 2 additional custom rules** of your team's choosing
- **At least 2 existing agents** (e.g., Fraud Detector + Compliance Checker) must load thresholds from this config file instead of using hardcoded values
- Changing a value in the config file must change pipeline behavior **without editing any code**

**Acceptance criteria:**

- [ ] `config/rules.json` (or `.yaml`) exists with threshold values
- [ ] At least 2 agents read from this config file at startup
- [ ] Changing a threshold value changes agent behavior (no code edits needed)

---

### Theme B: API Gateway + Endpoints

#### Task B1: REST API Gateway

Wrap your pipeline behind a REST API so transactions can be submitted via HTTP.

**Technology:** Flask, FastAPI, Express.js, or equivalent.

**Required endpoints:**

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `POST` | `/api/transactions` | Submit a single transaction | `{ "tracking_id": "TXN001", "status": "accepted" }` |
| `GET` | `/api/transactions/{id}/status` | Check processing status | `{ "transaction_id": "TXN001", "status": "approved", "details": {...} }` |
| `GET` | `/api/results` | List all processed results | `[{ "transaction_id": "TXN001", "status": "approved" }, ...]` |

**How it works:**

1. `POST /api/transactions` receives a transaction JSON (same format as entries in `sample-transactions.json`)
2. The API writes it as a message to `shared/input/` for the pipeline to process
3. Pipeline agents process it through the normal flow
4. `GET` endpoints read from `shared/results/` to return status

**Acceptance criteria:**

- [ ] API starts on a port (e.g., `http://localhost:5000`)
- [ ] `POST /api/transactions` returns 200/201 with a tracking ID
- [ ] `GET /api/transactions/{id}/status` returns status for a processed transaction
- [ ] `GET /api/results` returns a JSON array of all results

---

#### Task B2: Error Handling

- Return proper HTTP status codes: `201` for created, `200` for success, `404` for not found, `400` for invalid input
- Return JSON error bodies: `{ "error": "Transaction not found", "transaction_id": "TXN999" }`
- Handle missing fields in POST body gracefully

**Acceptance criteria:**

- [ ] Invalid requests return 400 with error message
- [ ] Missing transaction ID returns 404
- [ ] All responses are valid JSON

---

## Demo Script

Create `demo.sh` in the project root. This script must run the entire system end-to-end with **zero manual intervention**.

**Required steps (in order):**

1. Start the API server in the background
2. Wait for the server to be ready (health check or brief pause)
3. Submit at least 3 test transactions via HTTP POST (using `curl` or `requests`)
4. Wait for pipeline processing to complete
5. Poll results via `GET /api/results` or `GET /api/transactions/{id}/status`
6. Print a summary: how many approved, how many rejected, any fraud flags
7. Stop the API server

**Acceptance criteria:**

- [ ] `demo.sh` exists in project root
- [ ] Script is executable and self-contained (no manual steps)
- [ ] Running it produces clear, readable output showing the full flow
- [ ] Server is started and stopped cleanly

**Example output:**

```
=== Banking Pipeline Demo ===
Starting API server on port 5000...
Server ready.

Submitting 3 test transactions...
  POST TXN001 ($1,500 USD) -> accepted
  POST TXN002 ($25,000 USD) -> accepted
  POST TXN003 ($200 XYZ)   -> accepted

Waiting for pipeline processing...

Fetching results...
  TXN001: APPROVED (risk: LOW)
  TXN002: APPROVED (risk: HIGH, flagged for review)
  TXN003: REJECTED (invalid currency: XYZ)

Summary: 2 approved, 1 rejected, 1 flagged
=== Demo Complete ===
```

---

## Presentation Guidelines

Each team presents for **5-7 minutes**, followed by **2–3 minutes of Q&A**.

**Must cover:**

1. **Architecture Overview** (about 1 minute)
   - Show pipeline diagram: which agents, where the new agent fits
   - Explain data flow from API request to final result

2. **Rule Engine Design** (about 1 minute)
   - Show the `config/rules.json` file
   - Demonstrate: if you change a threshold, the behavior changes

3. **API Gateway Demo** (about 2–3 minutes)
   - Live or recorded: POST a transaction, GET results
   - Show error handling (invalid input, 404)

4. **Demo Script Execution** (about 1 minute)
   - Run `./demo.sh` or `python demo.py` live (or show a recording)

5. **AI Tools Usage** (about 1 minute)
   - Which tools did you use? (e.g., Claude Code, Copilot, Cursor)
   - One concrete example: how AI helped with a specific part of the work

6. **Challenges & Lessons** (about 1 minute)
   - What was hardest? How did you solve it?

---

## Submitting Your Work

**Upload your complete project** as a **`.zip` archive**, or **share a public GitHub repository link** that contains your full solution (code, config, demo script, and any instructions needed to run it).
