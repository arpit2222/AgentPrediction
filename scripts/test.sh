#!/usr/bin/env bash
# =============================================================================
# AgentPrediction — Full Test Suite Runner
# Usage: ./scripts/test.sh [unit|integration|e2e|contracts|all]
# =============================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[TEST]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

SCOPE="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; TOTAL=0

run() {
  local label="$1"; shift
  TOTAL=$((TOTAL+1))
  log "Running: $label"
  if "$@"; then
    PASS=$((PASS+1))
    log "✅ PASSED: $label"
  else
    fail "❌ FAILED: $label"
  fi
  echo ""
}

# ── Smart Contracts ──────────────────────────────────────────────────────────
contracts() {
  log "=== Smart Contract Tests ==="
  run "Hardhat unit tests" \
    bash -c "cd '$ROOT' && npx hardhat test"
}

# ── Agent Framework ───────────────────────────────────────────────────────────
agents() {
  log "=== Agent Framework Tests ==="
  run "Agent unit + integration + E2E" \
    bash -c "cd '$ROOT/agent-framework' && npm test -- --runInBand"
}

# ── TypeScript checks ─────────────────────────────────────────────────────────
typecheck() {
  log "=== TypeScript Type Checks ==="
  run "Telegram bot TSC" \
    bash -c "cd '$ROOT/telegram-bot' && npx tsc --noEmit"
  run "Dashboard next build" \
    bash -c "cd '$ROOT/dashboard' && npm run build -- --no-lint 2>&1 | tail -5"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$SCOPE" in
  contracts)  contracts ;;
  unit)       agents ;;
  integration) agents ;;
  e2e)        agents ;;
  types)      typecheck ;;
  all)
    contracts
    agents
    typecheck
    ;;
  *)
    echo "Usage: $0 [contracts|unit|integration|e2e|types|all]"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo -e "${GREEN} Test Results: ${PASS}/${TOTAL} suites passed${NC}"
echo -e "${GREEN}═══════════════════════════════════${NC}"
[[ $PASS -eq $TOTAL ]] && exit 0 || exit 1
