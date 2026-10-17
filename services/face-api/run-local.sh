#!/usr/bin/env bash
# Локальный запуск face-api сервиса (без Docker).
# @TheTechMargin 2026
#
# Использование:
#   ./run-local.sh            # порт 8090, модель buffalo_l
#   PORT=8095 ./run-local.sh  # свой порт
#
# Первый запуск качает веса InsightFace (~300MB для buffalo_l) в
# ~/.insightface/models/<model> — занимает 1-3 минуты.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8090}"
INSIGHTFACE_MODEL="${INSIGHTFACE_MODEL:-buffalo_l}"
API_SECRET="${API_SECRET:-}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3100,http://localhost:3000}"

if [ ! -x .venv/bin/python ]; then
  echo "→ создаю venv (python3 -m venv .venv)"
  python3 -m venv .venv
  .venv/bin/python -m pip install --upgrade pip setuptools wheel
  .venv/bin/python -m pip install -r requirements-local.txt
fi

export PORT INSIGHTFACE_MODEL API_SECRET CORS_ORIGINS
echo "→ face-api на http://localhost:${PORT} (модель: ${INSIGHTFACE_MODEL})"
exec .venv/bin/python app.py
