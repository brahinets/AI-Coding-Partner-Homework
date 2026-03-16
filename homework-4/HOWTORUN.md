# How to Run — Homework 4

## Running the Fixed Application

```bash
cd demo-bug-fix
npm install
npm start
```

The server starts at `http://localhost:3000`.

### Test the endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get all users (was already working)
curl http://localhost:3000/api/users

# Get single user by ID (was broken — now fixed)
curl http://localhost:3000/api/users/123
curl http://localhost:3000/api/users/456
curl http://localhost:3000/api/users/789

# Non-existent user (returns 404 as expected)
curl http://localhost:3000/api/users/999
```

---

## Running the Unit Tests

```bash
cd demo-bug-fix
npm install
npm test
```

Expected output: 7 tests pass, 0 failures.

---

## Using the Agent Pipeline

The agents are defined as markdown files in `/agents/`. To run the pipeline manually for a new bug:

1. Create `context/bugs/<BUG_ID>/bug-context.md` with bug description.
2. Run Bug Researcher (not included — produces `research/codebase-research.md`).
3. Run **Bug Research Verifier** (`agents/research-verifier.agent.md`) → produces `research/verified-research.md`.
4. Run Bug Planner (not included — produces `implementation-plan.md`).
5. Run **Bug Implementer** (`agents/bug-implementer.agent.md`) → applies fixes, produces `fix-summary.md`.
6. Run **Security Verifier** (`agents/security-verifier.agent.md`) → produces `security-report.md`.
7. Run **Unit Test Generator** (`agents/unit-test-generator.agent.md`) → produces tests and `test-report.md`.

Each agent file documents its inputs, outputs, and step-by-step instructions.

---

## Project Structure

```
homework-4/
├── agents/                        # 4 agent definitions
│   ├── research-verifier.agent.md
│   ├── bug-implementer.agent.md
│   ├── security-verifier.agent.md
│   └── unit-test-generator.agent.md
├── skills/                        # Reusable skill definitions
│   ├── research-quality-measurement.md
│   └── unit-tests-FIRST.md
├── context/bugs/API-404/          # Pipeline artifacts for bug API-404
│   ├── research/
│   │   ├── codebase-research.md
│   │   └── verified-research.md
│   ├── implementation-plan.md
│   ├── fix-summary.md
│   ├── security-report.md
│   └── test-report.md
├── demo-bug-fix/                  # The application (bug fixed)
│   ├── src/
│   │   ├── controllers/userController.js  ← bug fixed here
│   │   └── routes/users.js
│   ├── tests/
│   │   └── userController.test.js
│   ├── server.js
│   └── package.json
├── docs/screenshots/
├── README.md
├── HOWTORUN.md
└── STUDENT.md
```
