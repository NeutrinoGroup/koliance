#!/usr/bin/env bash
# ==============================================================================
# scripts/keepalive-render.sh
# Render backend warm-up and keepalive script (10-minute interval).
#
# Usage:
#   ./scripts/keepalive-render.sh           # Run once (checks active window 10:00-21:59 CST)
#   ./scripts/keepalive-render.sh --force   # Run once unconditionally
#   ./scripts/keepalive-render.sh --loop    # Run continuously (pings only during active window)
# ==============================================================================

set -euo pipefail

BACKEND_URL="${BACKEND_API_URL:-https://koliance-backend.onrender.com}"
INTERVAL_SECONDS=600

# Active time window (Default: 10:00 - 21:59 Beijing Time / 02:00 - 13:59 UTC)
WINDOW_START_HOUR_UTC="${KEEPALIVE_START_HOUR_UTC:-2}"
WINDOW_END_HOUR_UTC="${KEEPALIVE_END_HOUR_UTC:-13}"

is_within_active_window() {
  local current_hour_utc
  current_hour_utc="$(date -u +"%H")"
  # Strip leading zero for bash arithmetic comparison
  current_hour_utc=$((10#$current_hour_utc))
  
  if (( current_hour_utc >= WINDOW_START_HOUR_UTC && current_hour_utc <= WINDOW_END_HOUR_UTC )); then
    return 0
  else
    return 1
  fi
}

ping_backend() {
  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[INFO] [${timestamp}] Pinging Render backend: ${BACKEND_URL}..."

  local health_code
  health_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${BACKEND_URL}/healthz" 2>/dev/null || true)"
  if [[ -z "$health_code" || "$health_code" == "000" ]]; then
    health_code="000"
  fi
  echo "[INFO] [${timestamp}] /healthz response code: ${health_code}"

  local movers_code
  movers_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${BACKEND_URL}/api/v1/market/movers" 2>/dev/null || true)"
  if [[ -z "$movers_code" || "$movers_code" == "000" ]]; then
    movers_code="000"
  fi
  echo "[INFO] [${timestamp}] /api/v1/market/movers response code: ${movers_code}"

  if [[ "$health_code" -ge 200 && "$health_code" -lt 400 ]]; then
    echo "[OK] [${timestamp}] Backend container is active and healthy."
  else
    echo "[WARN] [${timestamp}] Backend ping returned non-2xx status: ${health_code}"
  fi
}

FORCE_MODE=false
LOOP_MODE=false

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE_MODE=true
      ;;
    --loop)
      LOOP_MODE=true
      ;;
  esac
done

if [[ "$LOOP_MODE" == "true" ]]; then
  echo "[INFO] Starting keepalive daemon (interval: ${INTERVAL_SECONDS}s / 10m, active window: 10:00 - 21:59 CST)..."
  while true; do
    local_ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    if [[ "$FORCE_MODE" == "true" ]] || is_within_active_window; then
      ping_backend
    else
      echo "[INFO] [${local_ts}] Outside active window (10:00 - 21:59 CST / 02:00 - 13:59 UTC). Skipping ping to conserve Render free hours."
    fi
    echo "[INFO] Sleeping for ${INTERVAL_SECONDS}s..."
    sleep "${INTERVAL_SECONDS}"
  done
else
  if [[ "$FORCE_MODE" == "true" ]] || is_within_active_window; then
    ping_backend
  else
    local_ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "[INFO] [${local_ts}] Outside active window (10:00 - 21:59 CST / 02:00 - 13:59 UTC). Ping skipped (use --force to bypass)."
  fi
fi
