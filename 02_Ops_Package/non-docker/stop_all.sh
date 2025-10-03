#!/usr/bin/env bash
set -euo pipefail
RUNDIR=/tmp/web-pack
PIDFILE="$RUNDIR/minidocs.pid"
[ -f "$PIDFILE" ] && sudo kill "$(cat "$PIDFILE")" 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true
rm -f "$PIDFILE"
echo "[STOP] MiniDocs down"
