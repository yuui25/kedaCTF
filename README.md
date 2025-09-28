# MiniDocs Challenge

chatCPTに相談しながら作ってみました。
どのような構初構成の問題が作れるのか分からなかったので一旦期設定以外に外部接続なしでweb問題作れないか試してみました。

---

## 環境
- 想定環境: Linux (VDI 内)
- 提供形式: `/opt/web-pack/minidocs/` にサーバコード一式配置済み
- 起動後: `http://127.0.0.1:8000/` でアクセス可能

---

## セットアップ
ダウンロード後、以下を実行:

    cd CTF
    sudo bash 02_Ops_Package/minidocs_setup.sh

本リポジトリを配置後、以下を実行:

    sudo /opt/web-pack/minidocs/start_all.sh

正常に起動すると:

    [UP] MiniDocs: http://127.0.0.1:8000/
    Logs: /tmp/web-pack/minidocs.log

起動後以下にアクセス:

    http://127.0.0.1:8000/

---

## 確認方法
- ポート確認:

      ss -ltnp | grep 127.0.0.1:8000

- ログ確認:

      sudo tail -n 20 /tmp/web-pack/minidocs.log

---

## 問題
### 1. IDOR (Insecure Direct Object Reference)
- ユーザは `/login` からログイン可能です。
- 他人のドキュメントにアクセスできてしまう不備を突き、フラグを取得してください。

### 2. Prototype Pollution
- 管理者ログイン後、特定の設定 API で **プロトタイプ汚染** を仕掛けられます。
- 内部の管理情報を操作して、フラグを取得してください。

---

## 注意事項
- フラグの形式は一旦 `PCTF{...}` で作ってます。
- ファジングツールなど使用禁止、ブラウザから行えるアプリの想定動作のみを行ってください。
- 必要なら `curl` などのコマンドラインツールを使っても構いません

---

## 使用ツール
- ブラウザのみ。(人によってはCurlでやるかも)
