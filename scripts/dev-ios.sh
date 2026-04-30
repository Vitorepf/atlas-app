#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-lan}"
PORT="${ATLAS_METRO_PORT:-8081}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx nao encontrado. Instale Node/npm antes de iniciar o ambiente iOS." >&2
  exit 1
fi

if [ "${ATLAS_KILL_METRO:-0}" = "1" ] && command -v lsof >/dev/null 2>&1; then
  for STALE_PORT in 8081 8082; do
    STALE_PIDS="$(lsof -ti "tcp:${STALE_PORT}" || true)"
    if [ -n "$STALE_PIDS" ]; then
      echo "Encerrando Metro existente na porta ${STALE_PORT}: ${STALE_PIDS}"
      kill $STALE_PIDS >/dev/null 2>&1 || true
    fi
  done
  sleep 1
fi

if [ -n "$PORT" ] && command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti "tcp:${PORT}" || true)"
  if [ -n "$PIDS" ]; then
    LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
    echo "Metro ja esta rodando na porta ${PORT}: ${PIDS}"
    if [ -n "$LAN_IP" ]; then
      echo "URL manual no Development Build: http://${LAN_IP}:${PORT}"
    fi
    echo "Use npm run dev:ios:restart se precisar reiniciar o Metro."
    exit 1
  fi
fi

HOST_ARGS=(--host lan)
case "$MODE" in
  lan)
    HOST_ARGS=(--host lan)
    ;;
  tunnel)
    HOST_ARGS=(--tunnel)
    ;;
  localhost)
    HOST_ARGS=(--localhost)
    ;;
  *)
    echo "Modo invalido: ${MODE}. Use lan, tunnel ou localhost." >&2
    exit 1
    ;;
esac

export ATLAS_APPLE_TEAM_ID="${ATLAS_APPLE_TEAM_ID:-W28WF9A5A2}"

echo "Atlas iOS dev"
echo "Projeto: ${ROOT_DIR}"
echo "Metro: ${MODE} porta ${PORT}"
if [ "$MODE" = "lan" ]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [ -n "$LAN_IP" ]; then
    echo "URL manual no Development Build: http://${LAN_IP}:${PORT}"
  fi
fi
echo "App: abra o Atlas Development Build no iPhone e conecte neste servidor."

CMD=(npx expo start --dev-client "${HOST_ARGS[@]}")
CMD+=(--port "$PORT")

if [ "${CLEAR:-0}" = "1" ]; then
  CMD+=(--clear)
fi

"${CMD[@]}"
