# Skill: Research Quality Measurement

## Purpose

This skill defines a standardized framework for assessing the quality of codebase research produced by a Bug Researcher agent. The Bug Research Verifier must apply these levels when producing `verified-research.md`.

---

## Quality Levels

| Level | Label | Reference Accuracy | Description |
|-------|-------|--------------------|-------------|
| 5 | **Outstanding** | 95–100% | All file:line references verified; code snippets match source exactly; root cause is unambiguous; zero discrepancies. |
| 4 | **Excellent** | 85–94% | Nearly all references verified; minor wording differences in snippets; root cause clear; discrepancies are trivial. |
| 3 | **Good** | 70–84% | Most references verified; a few lines off or snippets slightly stale; root cause reasonable but requires minor clarification. |
| 2 | **Adequate** | 50–69% | Some references verified; notable discrepancies (wrong line numbers, missing context); root cause partially correct. |
| 1 | **Poor** | < 50% | Many references wrong or unverifiable; snippets do not match source; root cause unclear or incorrect. |

---

## How to Apply This Skill

1. For each claim in the research document, locate the referenced file and line.
2. Compare the quoted snippet with the actual source code (exact match required for Outstanding/Excellent).
3. Count: `verified / total` references.
4. Map the ratio to the table above.
5. Record the level label and percentage in the `Research Quality Assessment` section of `verified-research.md`.

---

## Required Sections in `verified-research.md`

```
## Verification Summary
- Pass/Fail:
- Research Quality: <Level> — <Label> (<X>% references verified)

## Verified Claims
(list each verified file:line with ✅)

## Discrepancies Found
(list each failed check with ❌, actual vs. claimed)

## Research Quality Assessment
- Level: <1–5>
- Label: <Outstanding | Excellent | Good | Adequate | Poor>
- Percentage Verified: <X>%
- Reasoning: <one paragraph>

## References
(links / paths to source files checked)
```

---

## Notes

- A "discrepancy" includes: wrong file path, wrong line number (±2 lines tolerance for minor edits), snippet text differs by more than whitespace.
- If the researcher notes a line range (e.g., 20–25), verify the whole range.
- Quality level **3 (Good) or above** is required for the Bug Planner to proceed without re-research.
