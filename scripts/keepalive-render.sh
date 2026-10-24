#!/usr/bin/env bash
# ==============================================================================
# scripts/keepalive-render.sh
# Render backend warm-up and keepalive script (10-minute interval).
#
# Usage:
#   ./scripts/keepalive-render.sh           # Run once (suitable for crontab)
#   ./scripts/keepalive-render.sh --loop    # Run continuously every 10 minutes
# ==============================================================================

set -euo pipefail

BACKEND_URL="${BACKEND_API_URL:-https://koliance-backend.onrender.com}"
INTERVAL_SECONDS=600

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

if [[ "${1:-}" == "--loop" ]]; then
  echo "[INFO] Starting keepalive daemon (interval: ${INTERVAL_SECONDS}s / 10m)..."
  while true; do
    ping_backend
    echo "[INFO] Sleeping for ${INTERVAL_SECONDS}s..."
    sleep "${INTERVAL_SECONDS}"
  done
else
  ping_backend
fi
