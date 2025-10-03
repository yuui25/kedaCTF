#!/usr/bin/env bash
set -euo pipefail

need_root() { [ "$(id -u)" -eq 0 ] || sudo -n true 2>/dev/null || { echo "=> sudo権限が必要です"; exit 1; }; }

distro_install_docker() {
  echo "=> Dockerを導入します（Debian/Ubuntu/Kali系）"
  need_root
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-plugin
  sudo systemctl enable --now docker
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

main() {
  if ! has_cmd docker; then
    distro_install_docker
  fi
  echo "=> Docker情報"; docker --version; docker compose version || true

  echo "=> イメージをビルド（オンライン環境で一度だけ必要）"
  docker compose build

  echo "=> コンテナ起動"
  docker compose up -d

  echo ""
  echo "== 起動完了 =="
  echo "URL: http://127.0.0.1:8000/"
  echo "停止: scripts/ctf-down.sh"
  echo "※ 一度buildできれば、その後はオフラインでも 'docker compose up -d' で再起動できます"
}

main "$@"
