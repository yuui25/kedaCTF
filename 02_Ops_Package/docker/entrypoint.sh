#!/usr/bin/env sh
set -eu
umask 077

BASE=/tmp/web-pack
RUNDIR="$BASE/flags"

# マウントポイント(BASE)は触らない。自分用のサブディレクトリだけ作成。
# 非rootでも 1777 な /tmp と同様に作成できる想定。
mkdir -p "$RUNDIR" || true
# 自分で作ったディレクトリだけ権限を絞る（失敗しても致命にしない）
chmod 700 "$RUNDIR" 2>/dev/null || true

# フラグは .env（/etc/minidocs/minidocs.env）から必須入力
: "${FLAG_PP:?FLAG_PP is required. Set it via .env (FLAG_PP=...)}"
: "${FLAG_IDOR:?FLAG_IDOR is required. Set it via .env (FLAG_IDOR=...)}"

printf '%s\n' "$FLAG_PP"   > "$RUNDIR/FLAG_PP.txt"
printf '%s\n' "$FLAG_IDOR" > "$RUNDIR/FLAG_IDOR.txt"
chmod 600 "$RUNDIR"/FLAG_*.txt 2>/dev/null || true

# アプリ起動
exec node /app/server.js
