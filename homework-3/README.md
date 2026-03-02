# Homework 3 - Specification-Driven Design

## Student & Task Summary

**Student**: Yaroslav Brahinets
**Task**: Design a specification package for a finance-oriented application using Specification-Driven Development (SDD) principles. No implementation required - only documents.

**Chosen feature**: **Spending Caps & Budgeting Service** - a microservice that lets end-users set daily, weekly, and monthly spending limits (optionally scoped to spending categories), tracks utilisation against those limits in real time, and emits alerts when thresholds are crossed. An admin/ops API provides read-only oversight for compliance and support teams.

---

## Deliverables

| File               | Purpose                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `specification.md` | Full SDD specification - high-level objective, mid-level objectives, implementation notes, context, and 9 low-level tasks |
| `agents.md`        | AI agent configuration - tech stack, project structure, domain rules, testing expectations, security constraints          |
| `README.md`        | This file - rationale and industry best practices mapping                                                                 |

---

## Rationale

The specification follows the five-section SDD template taught in Lesson 3 (High-Level Objective → Mid-Level Objectives → Implementation Notes → Context → Low-Level Tasks). Key design choices:

- **High-level objective** is a single sentence that any stakeholder can understand. It intentionally avoids technical details - those belong in Implementation Notes.
- **Mid-level objectives** are deliberately phrased as testable outcomes ("end-users can create, read, update, and delete spending caps…"). Each one could be turned into an acceptance test.
- **Context sections** (beginning/ending) give an AI coding partner a clear "before and after" snapshot, which reduces hallucinated files or misguided assumptions about existing infrastructure.
- **Low-level tasks** each follow the four-question template (prompt, file, function, details). They are ordered by dependency - models first, then repositories, then middleware, then routes, then tests - so an AI agent can execute them sequentially without missing prerequisites.

The specification describes *what* the system does. The `agents.md` describes *how to work on it* - domain-specific rules that apply to every prompt regardless of which task is being executed. Separating these concerns means:

- The specification can be reviewed by product and compliance stakeholders who do not care about ESLint rules.
- The agents.md can be reused across multiple feature specifications within the same codebase. coding standards, forbidden patterns, 
- An AI assistant can be given agents.md as persistent context while cycling through different task-level prompts from the specification.

---

## Industry Best Practices

The table below maps each practice to the specific location(s) where it appears in the specification package.

| #   | Practice                                                                                                                                                                                                                                                     | Where It Appears                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Integer minor units for money** - Avoids floating-point rounding errors that can cause financial discrepancies. Standard practice in payment systems (Stripe, Adyen, and most card processors use minor units).                                            | `specification.md` → Implementation Notes → Coding Standards; `agents.md` → Domain Rules                                                                                    |
| 2   | **Immutable append-only audit trail** - Required by financial regulators (PCI-DSS, SOX, local banking authorities). Every state change is recorded with actor, timestamp, and before/after state so that any mutation can be traced and explained.           | `specification.md` → Mid-Level Objective #5, Implementation Notes → Audit & Regulatory, Tasks 1 / 2 / 4; `agents.md` → Domain Rules #4                                      |
| 3   | **Soft deletes** - Financial records must never be hard-deleted due to regulatory retention requirements and audit traceability. A status flag preserves the record while removing it from active queries.                                                   | `specification.md` → Task 2 (repository has `softDelete`), Task 4 (`DELETE` sets status to DELETED); `agents.md` → Domain Rules #6, Things to Never Generate                |
| 4   | **PII masking in logs** - GDPR Article 25 ("data protection by design") and PCI-DSS Requirement 3 demand that sensitive identifiers are not exposed in application logs. Masked identifiers still allow debugging while protecting user privacy.             | `specification.md` → Implementation Notes → Security & Compliance, Task 6 (admin PII masking), Task 7 (request logger); `agents.md` → Domain Rules #5, Security Constraints |
| 5   | **Role-Based Access Control (RBAC)** - Separation of end-user and internal-ops access is a fundamental security control in multi-tenant financial systems. The principle of least privilege ensures support staff see only what they need.                   | `specification.md` → Task 3 (RBAC middleware), Task 6 (admin role requirement); `agents.md` → Security Constraints                                                          |
| 6   | **Idempotent transaction processing** - Distributed systems may deliver the same event more than once. Without idempotency, spending caps could be double-decremented, leading to incorrect blocks or false alerts.                                          | `specification.md` → Implementation Notes → Performance, Mid-Level Objective #2, Task 5; `agents.md` → Domain Rules #3, Testing Expectations                                |
| 7   | **ISO-8601 UTC timestamps** - Eliminates timezone ambiguity across services, databases, and log aggregators. Critical in financial systems where the exact time of a transaction or alert has regulatory significance.                                       | `specification.md` → Implementation Notes → Coding Standards; `agents.md` → Domain Rules #2                                                                                 |
| 8   | **Contract-first API development (OpenAPI)** - Defining the API contract before implementation ensures frontend/backend alignment, enables automated contract testing, and provides always-current documentation. Taught in Lesson 3 as a core SDD practice. | `specification.md` → Ending Context (`docs/openapi.yaml`), Task 9; `agents.md` → Project Overview ("OpenAPI contract is the single source of truth");                       |
| 9   | **Repository pattern (data-store abstraction)** - Decouples business logic from persistence technology. Allows the team to start with an in-memory store for fast testing and swap in a production database later without touching service code.             | `specification.md` → Implementation Notes → Tech Stack ("abstracted via repository pattern"), Task 2                                                                        |
| 10  | **Structured JSON logging** - Machine-readable logs (via pino) enable efficient querying in log aggregation tools (ELK, Datadog, Splunk). Essential for production observability and incident response in financial systems.                                 | `specification.md` → Implementation Notes → Tech Stack, Task 7; `agents.md` → Code Style ("No console.log - use pino")                                                      |
| 11  | **GDPR / CCPA data-export support** - Regulated financial services must honour data subject access requests within statutory timeframes. The specification explicitly requires this capability.                                                              | `specification.md` → Implementation Notes → Audit & Regulatory; `agents.md` → Security & Compliance Constraints                                                             |
| 12  | **Rate limiting** - Prevents abuse and protects shared infrastructure. Especially important in financial APIs where automated attacks could trigger unintended cap modifications or data exfiltration.                                                       | `specification.md` → Implementation Notes → Security & Compliance; `agents.md` → Security Constraints                                                                       |

---

## How This Specification Supports the SDD Workflow

| SDD Phase               | Covered By                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Phase 1 - SPECIFY**   | `specification.md` (objectives, notes, context)                                         |
| **Phase 2 - PLAN**      | `specification.md` (low-level task ordering, dependency graph)                          |
| **Phase 3 - TASK**      | `specification.md` (individual low-level tasks with prompts)                            |
| **Phase 4 - IMPLEMENT** | `agents.md` (guide the AI during code generation, coding standards, forbidden patterns) |
| **Phase 5 - VALIDATE**  | `specification.md` Task 8 (test suite) + Task 9 (OpenAPI contract for contract testing) |