#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  docker compose down || true
else
  echo "docker未導入のため、非Docker手順のstop_all.shを実行します（存在する場合）"
  [ -x /opt/web-pack/minidocs/stop_all.sh ] && sudo /opt/web-pack/minidocs/stop_all.sh || true
fi

echo "停止しました"
