#!/usr/bin/env sh
set -eu

umask 077

RUNDIR=/tmp/web-pack
mkdir -p "$RUNDIR"
chmod 700 "$RUNDIR"

# フラグは必須（.env 等から渡す）。未設定なら即終了して分かりやすくエラーにする。
: "${FLAG_PP:?FLAG_PP is required. Set it via .env (FLAG_PP=...)}"
: "${FLAG_IDOR:?FLAG_IDOR is required. Set it via .env (FLAG_IDOR=...)}"

printf '%s\n' "$FLAG_PP"   > "$RUNDIR/FLAG_PP.txt"
printf '%s\n' "$FLAG_IDOR" > "$RUNDIR/FLAG_IDOR.txt"
chmod 600 "$RUNDIR"/FLAG_*.txt

exec node /app/server.js
