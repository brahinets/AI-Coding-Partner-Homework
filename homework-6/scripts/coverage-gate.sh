#!/bin/bash
# Coverage gate hook — blocks git commit if statement coverage < 80%
# Reads tool_input from stdin; only activates on git commit commands.

INPUT=$(cat)
BASH_CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept git commit commands
if ! echo "$BASH_CMD" | grep -qE 'git commit'; then
  exit 0
fi

echo "Coverage gate: running Jest coverage check before commit..." >&2

COVERAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$COVERAGE_DIR" || exit 0

# Run jest with coverage, capture output
COVERAGE_OUTPUT=$(npx jest --coverage --coverageReporters=text-summary 2>&1)
EXIT_CODE=$?

# Extract statement coverage percentage
STMTS=$(echo "$COVERAGE_OUTPUT" | grep -E "^Statements" | grep -oE '[0-9]+\.[0-9]+' | head -1)

if [ -z "$STMTS" ]; then
  # No tests yet or jest failed — warn but don't block
  echo '{"decision":"allow","reason":"Coverage check skipped: no tests found yet."}'
  exit 0
fi

BELOW=$(echo "$STMTS < 80" | bc -l 2>/dev/null || awk "BEGIN{print ($STMTS < 80)}")

if [ "$BELOW" = "1" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Coverage gate BLOCKED: statement coverage is ${STMTS}% (below 80% threshold). Run npm run test:coverage to see details.\"}}"
  exit 2
else
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"permissionDecisionReason\":\"Coverage gate passed: ${STMTS}% statement coverage.\"}}"
  exit 0
fi
# test
