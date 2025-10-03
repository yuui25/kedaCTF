#!/usr/bin/env bash
set -euo pipefail

has_cmd() { command -v "$1" >/dev/null 2>&1; }
need_root() { [ "$(id -u)" -eq 0 ] || sudo -n true 2>/dev/null || { echo "=> sudo権限が必要です"; exit 1; }; }

install_docker_packages() {
  echo "=> Docker本体と Compose(V1) を導入します（Debian/Ubuntu/Kali系）"
  need_root
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose
  sudo systemctl enable --now docker
}

ensure_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif has_cmd docker-compose; then
    echo "docker-compose"
  else
    echo "=> docker-compose(V1) を導入します"
    need_root
    sudo apt-get install -y docker-compose
    echo "docker-compose"
  fi
}

main() {
  # どのディレクトリで実行しているか表示（docker-compose.yml がある場所で実行してください）
  echo "=> Current dir: $(pwd)"
  if [ ! -f "./docker-compose.yml" ]; then
    echo "!! docker-compose.yml が見つかりません。このファイルがあるディレクトリで実行してください。"
    exit 1
  fi

  # Docker 本体
  if ! has_cmd docker; then
    install_docker_packages
  fi
  docker --version || { echo "docker が正しく導入されていません"; exit 1; }

  # Compose コマンド決定
  COMPOSE_CMD=$(ensure_compose_cmd)
  $COMPOSE_CMD version || true

  # sudo なしで docker を使いたい場合のヒント（グループ未所属なら表示）
  if ! id -nG "${SUDO_USER:-$USER}" | grep -qw docker; then
    echo "HINT: sudoなしで docker を使うには以下を実行し、ログアウト/ログインしてください："
    echo "  sudo usermod -aG docker ${SUDO_USER:-$USER} && newgrp docker"
  fi

  # ビルド & 起動
  echo "=> ビルド"
  $COMPOSE_CMD build
  echo "=> 起動"
  $COMPOSE_CMD up -d

  echo ""
  echo "== 起動完了 =="
  echo "URL: http://127.0.0.1:8000/"
  echo "停止: ./scripts/ctf-down.sh  または  $COMPOSE_CMD down"
}

main "$@"
