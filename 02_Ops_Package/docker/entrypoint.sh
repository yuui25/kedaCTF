#!/usr/bin/env sh
set -eu

# RUNDIR と FLAGファイル（server.js が /tmp/web-pack/FLAG_*.txt を読む）
RUNDIR=/tmp/web-pack
mkdir -p "$RUNDIR"

: "${FLAG_PP:=PCTF{pp_default0001}}"
: "${FLAG_IDOR:=PCTF{idor_default0001}}"
echo "$FLAG_PP"   > "$RUNDIR/FLAG_PP.txt"
echo "$FLAG_IDOR" > "$RUNDIR/FLAG_IDOR.txt"
chmod 600 "$RUNDIR"/FLAG_*.txt

# アプリ起動
exec node /app/server.js
