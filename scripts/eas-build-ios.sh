#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-development}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx nao encontrado. Instale Node/npm antes de criar o build." >&2
  exit 1
fi

export ATLAS_APPLE_TEAM_ID="${ATLAS_APPLE_TEAM_ID:-W28WF9A5A2}"
export EAS_BUILD_PROFILE="$PROFILE"

if [ "${SKIP_TSC:-0}" != "1" ]; then
  npm run typecheck
fi

echo "Build iOS sem Screen Time nativo."
echo "HealthKit, audio, camera, Rize/backend, Atlas AI e sync continuam ativos."

npx eas build --platform ios --profile "$PROFILE" --clear-cache
