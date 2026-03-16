# Homework 4 — 4-Agent Pipeline

## Overview

This project implements a **4-agent automated bug-fixing pipeline** applied to a demo Express API application.

### The Bug

**API-404**: `GET /api/users/:id` returns 404 for all valid user IDs.

**Root cause**: `req.params.id` is a string (e.g., `"123"`), but the users array stores numeric IDs (`123`). Strict equality (`===`) between mismatched types always returns `false`, so `users.find()` always returns `undefined`.

**Fix**: Replace `u.id === userId` with `u.id === parseInt(userId, 10)`.

---

## Pipeline Architecture

```
Bug Researcher → Bug Research Verifier → Bug Planner → Bug Implementer
                                                              ↓
                                               ┌─────────────┴─────────────┐
                                        Security Verifier      Unit Test Generator
```

| Agent | File | Output |
|-------|------|--------|
| Bug Research Verifier | `agents/research-verifier.agent.md` | `verified-research.md` |
| Bug Implementer | `agents/bug-implementer.agent.md` | `fix-summary.md` + fixed code |
| Security Verifier | `agents/security-verifier.agent.md` | `security-report.md` |
| Unit Test Generator | `agents/unit-test-generator.agent.md` | tests + `test-report.md` |

---

## Skills

| Skill | File | Used By |
|-------|------|---------|
| Research Quality Measurement | `skills/research-quality-measurement.md` | Bug Research Verifier |
| Unit Tests FIRST | `skills/unit-tests-FIRST.md` | Unit Test Generator |

---

## Results

- **Bug fixed**: `src/controllers/userController.js:23`
- **Tests**: 7/7 passing (Jest)
- **Security**: APPROVED — no vulnerabilities introduced
- **Research quality**: Level 5 — Outstanding (100% references verified)

---

## Quick Start

```bash
cd demo-bug-fix && npm install && npm test   # run tests
cd demo-bug-fix && npm start                 # start server
```

See [HOWTORUN.md](./HOWTORUN.md) for detailed instructions.

---

## Author

Yaroslav Brahinets — AI Coding Partner Course, Homework 4
