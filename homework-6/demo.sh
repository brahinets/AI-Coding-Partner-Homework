#!/usr/bin/env bash
set -euo pipefail

PORT=1234
API="http://localhost:$PORT/api"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── helpers ────────────────────────────────────────────────────────────────────

jget() {
  node -e "
    const o = JSON.parse(process.argv[1]);
    const val = (function(){ try { return $2; } catch(e){ return undefined; } })();
    process.stdout.write(val !== null && val !== undefined ? String(val) : '${3:-}');
  " "$1" 2>/dev/null || echo "${3:-}"
}

pause() {
  printf "\n${DIM}  ▶  $1  —  press Enter to continue...${NC}"
  read -r
  echo ""
}

section() {
  echo ""
  printf "${CYAN}${BOLD}━━━  $1  ━━━${NC}\n"
  echo ""
}

cleanup() {
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    printf "\n${DIM}Server stopped.${NC}\n"
  fi
}
trap cleanup EXIT

# ── intro ──────────────────────────────────────────────────────────────────────

clear
printf "${BOLD}╔══════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║     Banking Pipeline — Live Demo         ║${NC}\n"
printf "${BOLD}╚══════════════════════════════════════════╝${NC}\n"
echo ""
echo "  This demo walks through the full pipeline step by step:"
echo "  1. Start the REST API server"
echo "  2. Submit 4 test transactions via HTTP"
echo "  3. Inspect each result (status, risk, flags)"
echo "  4. View summary"
echo ""

pause "Step 1: Start API server"

# ── step 1: start server ───────────────────────────────────────────────────────

section "Step 1 — Starting API Server"

printf "  Starting node api/server.js on port ${BOLD}$PORT${NC}...\n"

node "$SCRIPT_DIR/api/server.js" > /tmp/banking-api.log 2>&1 &
API_PID=$!

for i in $(seq 1 10); do
  if curl -sf "$API/results" > /dev/null 2>&1; then
    printf "  ${GREEN}✓ Server is ready at http://localhost:$PORT${NC}\n"
    break
  fi
  printf "  waiting..."
  sleep 0.5
  printf "\r                \r"
  if [ "$i" -eq 10 ]; then
    printf "  ${RED}✗ Server failed to start${NC}\n" >&2
    cat /tmp/banking-api.log >&2
    exit 1
  fi
done

pause "Step 2: Submit transactions"

# ── step 2: submit transactions ────────────────────────────────────────────────

section "Step 2 — Submitting Transactions via HTTP POST"

submit() {
  local id=$1 label=$2 body=$3
  printf "  ${DIM}POST /api/transactions${NC}  %-28s" "$label"
  local resp
  resp=$(curl -s -X POST "$API/transactions" \
    -H "Content-Type: application/json" \
    -d "$body")
  local status tracking_id
  status=$(jget "$resp" "o.status" "error")
  tracking_id=$(jget "$resp" "o.tracking_id" "?")
  if [ "$status" = "accepted" ]; then
    printf "${GREEN}✓ accepted${NC}  (tracking_id: $tracking_id)\n"
  else
    printf "${RED}✗ $status${NC}\n"
  fi
  sleep 0.3
}

submit "TXN-DEMO-1" '$1,500 USD — rent payment' \
  '{"transaction_id":"TXN-DEMO-1","amount":"1500.00","currency":"USD",
    "source_account":"ACC-D001","destination_account":"ACC-D002",
    "timestamp":"2026-03-24T09:00:00Z","transaction_type":"transfer",
    "description":"Rent payment","metadata":{"channel":"online","country":"US"}}'

submit "TXN-DEMO-2" '$75,000 USD — property wire' \
  '{"transaction_id":"TXN-DEMO-2","amount":"75000.00","currency":"USD",
    "source_account":"ACC-D003","destination_account":"ACC-D004",
    "timestamp":"2026-03-24T09:01:00Z","transaction_type":"wire_transfer",
    "description":"Property settlement","metadata":{"channel":"branch","country":"US"}}'

submit "TXN-DEMO-3" '41,500 UAH — freelance (converted)' \
  '{"transaction_id":"TXN-DEMO-3","amount":"41500.00","currency":"UAH",
    "source_account":"ACC-D005","destination_account":"ACC-D006",
    "timestamp":"2026-03-24T09:02:00Z","transaction_type":"transfer",
    "description":"Freelance payment","metadata":{"channel":"online","country":"UA"}}'

submit "TXN-DEMO-4" '$200 XYZ — invalid currency' \
  '{"transaction_id":"TXN-DEMO-4","amount":"200.00","currency":"XYZ",
    "source_account":"ACC-D007","destination_account":"ACC-D008",
    "timestamp":"2026-03-24T09:03:00Z","transaction_type":"transfer",
    "description":"Invalid currency test","metadata":{"channel":"online","country":"US"}}'

pause "Step 3: Inspect results"

# ── step 3: results ────────────────────────────────────────────────────────────

section "Step 3 — Pipeline Results  (GET /api/transactions/:id/status)"

show_result() {
  local id=$1
  local resp
  resp=$(curl -s "$API/transactions/$id/status")

  local status risk reason flag orig_amt orig_cur converted_amt
  status=$(jget "$resp"        "o.status"                       "unknown")
  risk=$(jget "$resp"          "o.details.fraud_risk_level"     "N/A")
  reason=$(jget "$resp"        "o.details.rejection_reason"     "")
  flag=$(jget "$resp"          "o.details.compliance_flag"      "")
  orig_amt=$(jget "$resp"      "o.details.original_amount"      "")
  orig_cur=$(jget "$resp"      "o.details.original_currency"    "")
  converted_amt=$(jget "$resp" "o.details.amount"               "")

  local notes=""
  [ -n "$reason" ]   && notes="$notes  ${RED}[$reason]${NC}"
  [ -n "$flag" ]     && notes="$notes  ${YELLOW}[$flag]${NC}"
  [ -n "$orig_cur" ] && notes="$notes  ${DIM}(converted: $orig_amt $orig_cur → $converted_amt USD)${NC}"

  if [ "$status" = "settled" ]; then
    printf "  ${GREEN}✓ %-14s APPROVED   risk=%-8s${NC}%b\n" "$id" "$risk" "$notes"
  else
    printf "  ${RED}✗ %-14s REJECTED   risk=%-8s${NC}%b\n" "$id" "$risk" "$notes"
  fi
  sleep 0.2
}

show_result "TXN-DEMO-1"
show_result "TXN-DEMO-2"
show_result "TXN-DEMO-3"
show_result "TXN-DEMO-4"

pause "Step 4: Summary"

# ── step 4: summary ────────────────────────────────────────────────────────────

section "Step 4 — Summary  (GET /api/results)"

RESULTS=$(curl -s "$API/results")

APPROVED=$(node -e "
  const r = JSON.parse(process.argv[1]);
  process.stdout.write(String(r.filter(x => x.transaction_id.startsWith('TXN-DEMO') && x.status === 'settled').length));
" "$RESULTS" 2>/dev/null || echo 0)

REJECTED=$(node -e "
  const r = JSON.parse(process.argv[1]);
  process.stdout.write(String(r.filter(x => x.transaction_id.startsWith('TXN-DEMO') && x.status === 'rejected').length));
" "$RESULTS" 2>/dev/null || echo 0)

printf "  ${GREEN}✓ Approved:  $APPROVED${NC}\n"
printf "  ${RED}✗ Rejected:  $REJECTED${NC}\n"

echo ""
printf "${BOLD}╔══════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║           Demo Complete ✓                ║${NC}\n"
printf "${BOLD}╚══════════════════════════════════════════╝${NC}\n"
echo ""
