#!/usr/bin/env bash
set -euo pipefail

need_root() { [ "$(id -u)" -eq 0 ] || sudo -n true 2>/dev/null || { echo "=> sudo権限が必要です"; exit 1; }; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }

install_docker_kali() {
  echo "=> Dockerを導入します（Kali/Debian/Ubuntu系）"
  need_root
  sudo apt-get update -y
  sudo apt-get install -y docker.io || { echo "docker.io の導入に失敗"; exit 1; }
  sudo systemctl enable --now docker
}

ensure_compose() {
  # compose v2 があればそれを、なければ v1 を使う
  if docker compose version >/dev/null 2>&1; then
    echo "=> compose v2 を使用（docker compose）"
    echo docker compose
  elif has_cmd docker-compose; then
    echo "=> compose v1 を使用（docker-compose）"
    echo docker-compose
  else
    echo "=> docker-compose(V1) を導入します"
    need_root
    sudo apt-get install -y docker-compose || { echo "docker-compose の導入に失敗"; exit 1; }
    echo docker-compose
  fi
}

main() {
  # 1) docker
  has_cmd docker || install_docker_kali
  docker --version || { echo "docker が正しく導入されていません"; exit 1; }

  # 2) composeコマンドの選択
  COMPOSE=$(ensure_compose)
  $COMPOSE version || true

  # 3) ビルド & 起動（compose.yml があるディレクトリで実行すること）
  echo "=> ビルド"
  $COMPOSE build
  echo "=> 起動"
  $COMPOSE up -d

  echo "== 起動完了 =="
  echo "URL: http://127.0.0.1:8000/"
  echo "停止: ./scripts/ctf-down.sh  または  $COMPOSE down"
}

main "$@"
