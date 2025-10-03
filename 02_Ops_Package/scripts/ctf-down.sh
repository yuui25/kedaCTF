#!/usr/bin/env bash
set -euo pipefail

if docker compose version >/dev/null 2>&1; then
  docker compose down
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose down
else
  echo "docker compose / docker-compose のいずれも見つかりません（停止不要か、未インストールの可能性）"
  exit 1
fi

echo "停止しました"
