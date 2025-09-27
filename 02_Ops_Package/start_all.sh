#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/opt/web-pack/minidocs
RUNDIR=/tmp/web-pack
PIDFILE="$RUNDIR/minidocs.pid"
LOG="$RUNDIR/minidocs.log"

# 実行環境（/tmp は ctfsvc が書ける）
sudo mkdir -p "$RUNDIR"
sudo chown -R ctfsvc:ctfsvc "$RUNDIR"
sudo chmod 750 "$RUNDIR"

# フラグ（未指定ならデフォルト。指定があれば上書き）
: "${FLAG_PP:=PCTF{pp_default}}"
: "${FLAG_IDOR:=PCTF{idor_default}}"
echo "$FLAG_PP"   | sudo -u ctfsvc tee "$RUNDIR/FLAG_PP.txt"   >/dev/null
echo "$FLAG_IDOR" | sudo -u ctfsvc tee "$RUNDIR/FLAG_IDOR.txt" >/dev/null
sudo chmod 600 "$RUNDIR"/FLAG_*.txt

# パーミッション（必要最小限）
sudo chown -R root:ctfsvc /opt/web-pack
sudo chmod 640 "$APP_DIR/server.js" 2>/dev/null || true
# ★ 自分自身の実行権は最後に確保（640に落とさない）
sudo chmod 750 "$APP_DIR/start_all.sh" "$APP_DIR/stop_all.sh" 2>/dev/null || true

# 旧プロセス停止
[ -f "$PIDFILE" ] && sudo kill "$(cat "$PIDFILE")" 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true

# node 検出
NODECMD="node"; command -v node >/dev/null 2>&1 || NODECMD="nodejs"
command -v "$NODECMD" >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

# 起動（ctfsvc で /tmp にログ・PID）
sudo -E -u ctfsvc bash -c "$NODECMD $APP_DIR/server.js >>'$LOG' 2>&1 & echo \$! >'$PIDFILE'"

echo "[UP] MiniDocs: http://127.0.0.1:8000/"
echo "Logs: $LOG"
