# MiniDocs 運用手順（運営用）

この文書は参加者には配布しません。運営が環境を立ち上げる／停止するための手順です。

---

## セットアップ
本リポジトリを配置後、以下を実行:

    sudo /opt/web-pack/minidocs/start_all.sh

正常に起動すると:

    [UP] MiniDocs: http://127.0.0.1:8000/
    Logs: /tmp/web-pack/minidocs.log

でアクセス可能。

---

## 確認方法
- ポート確認:

      ss -ltnp | grep 127.0.0.1:8000

- ログ確認:

      sudo tail -n 20 /tmp/web-pack/minidocs.log

---

## 停止
以下で停止可能:

    sudo /opt/web-pack/minidocs/stop_all.sh

---

## フラグの設定
フラグは **起動時に /tmp/web-pack 配下へ作成**されます。  
運営が差し替えたい場合は、環境変数を指定して起動してください。

例:

    sudo FLAG_PP='PCTF{pp_example}' FLAG_IDOR='PCTF{idor_example}' /opt/web-pack/minidocs/start_all.sh

これにより:

- `/tmp/web-pack/FLAG_PP.txt`
- `/tmp/web-pack/FLAG_IDOR.txt`

が更新されます。

---

## 想定解法
- **IDOR**:
  1. `/login` でユーザログイン
  2. `/leak` でドキュメント ID の一部が漏れていることを確認
  3. 推測して他人の `/docs/doc-vi-xxxx` にアクセス → フラグ

- **Prototype Pollution**:
  1. 管理者ログイン (`admin/<難しいPW>`)
  2. `/admin/feature-flags` に JSON を POST
  3. `{"__proto__":{"featureFlags":{"revealSecret":true}}}`
  4. `/admin/diagnostics` でフラグが表示される

---

## 運用 Tips
- 競技開始前に必ず **フラグ文字列が想定通り露出するか確認**
- 起動時のログに `MiniDocs on http://127.0.0.1:8000` が出ていれば成功
- エラー時は `/tmp/web-pack/minidocs.log` を確認
