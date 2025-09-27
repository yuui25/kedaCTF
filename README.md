# MiniDocs CTF (IDOR + Prototype Pollution)

VDI 上の **ローカルだけ** で完結する Web CTF。  
1つの Node.js サーバ（外部依存なし）に **2問** を同梱しています。

- ✅ **Prototype Pollution（PP）**: 管理画面のマージ不備を突き、`/admin/info` に FLAG を表示させる  
- ✅ **IDOR**: 末尾4桁ヒントから他ユーザ文書 ID を特定し、本文内の FLAG を読む

所要時間の目安: **合計 30〜40分**（CTF慣れした参加者）  
対象環境: **Kali Linux**（標準 Node で稼働、npm不要）  
ネットワーク: **外部に出ない**（127.0.0.1:8000 のみ）

---

## リポジトリ構成
01_Problem_Text/ # 参加者向けの問題文（PP / IDOR）
02_Ops_Package/ # 運用配布物（server.js / start_all.sh / stop_all.sh / README_for_ops.txt / setup.sh）
03_Writeups/ # 想定解法（運用・解説用、配布不要）

---

## すぐ試す（Kali, まっさら想定）
# セットアップ（依存導入・配置まで自動）
sudo bash 02_Ops_Package/minidocs_setup.sh

# 起動
sudo /opt/web-pack/minidocs/start_all.sh

# 確認（ログ＆ポート）
ss -ltnp | grep 127.0.0.1:8000 || true
sudo tail -n +1 /tmp/web-pack/minidocs.log

# ブラウザ（VDI内）
# http://127.0.0.1:8000/
# 詳細運用手順・トラブル対処は 02_Ops_Package/README_for_ops.txt を参照。
