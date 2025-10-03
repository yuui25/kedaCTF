#!/usr/bin/env bash
set -euo pipefail

echo "[*] MiniDocs setup start"

# 1) 実行ディレクトリ特定（minidocs/ 配下でも直下でも動く）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/minidocs"
if [ ! -f "$SRC_DIR/server.js" ]; then
  # フォルダ構成が直下の場合にフォールバック
  SRC_DIR="$SCRIPT_DIR"
fi

# 2) 必須コマンド（node）
if ! command -v node >/dev/null 2>&1 && ! command -v nodejs >/dev/null 2>&1; then
  echo "[*] Installing nodejs (apt)"
  sudo apt-get update -y
  sudo apt-get install -y nodejs
fi

# 3) ctfsvc ユーザ
if ! id -u ctfsvc >/dev/null 2>&1; then
  echo "[*] Creating user ctfsvc"
  sudo useradd -r -s /usr/sbin/nologin ctfsvc
fi

# 4) 配置
APP_BASE="/opt/web-pack"
APP_DIR="$APP_BASE/minidocs"
sudo mkdir -p "$APP_DIR"

NEEDED=(server.js start_all.sh stop_all.sh)
for f in "${NEEDED[@]}"; do
  if [ ! -f "$SRC_DIR/$f" ]; then
    echo "ERROR: $SRC_DIR/$f not found" >&2
    exit 1
  fi
  sudo cp -a "$SRC_DIR/$f" "$APP_DIR/"
done

# 5) CRLF対策 & 権限
sudo sed -i 's/\r$//' "$APP_DIR/"*.sh
sudo chown -R root:ctfsvc "$APP_BASE"
sudo find "$APP_BASE" -type d -exec chmod 750 {} \;
sudo find "$APP_BASE" -type f -exec chmod 640 {} \;
sudo chmod 750 "$APP_DIR/start_all.sh" "$APP_DIR/stop_all.sh"

# 6) /tmp 作業ディレクトリ
RUNDIR="/tmp/web-pack"
sudo mkdir -p "$RUNDIR"
sudo chown -R ctfsvc:ctfsvc "$RUNDIR"
sudo chmod 750 "$RUNDIR"

# 7) 起動（環境変数の FLAG_* があればそのまま引き継ぐ）
echo "[*] starting service"
if [ -n "${FLAG_PP:-}" ] || [ -n "${FLAG_IDOR:-}" ]; then
  sudo FLAG_PP="${FLAG_PP:-}" FLAG_IDOR="${FLAG_IDOR:-}" "$APP_DIR/start_all.sh"
else
  sudo "$APP_DIR/start_all.sh"
fi

echo "[*] Done. Access http://127.0.0.1:8000/"
echo "    Start/Stop: $APP_DIR/{start_all.sh,stop_all.sh}"
echo "    Log:        /tmp/web-pack/minidocs.log"
