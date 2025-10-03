# MiniDocs 運用手順

> 本書は **運営向け** です（参加者へは配布しない）。  
> 方針：構築はオンラインで一度だけ実施し、その後は **オフラインでも運用**できる形にする。

---

## 1. 起動方式

### A) Docker（推奨：一度オンライン→以降オフライン可）
構築スクリプトが **Dockerの導入（apt）→ビルド→起動** を自動で行います。  
対象OS：**Debian/Ubuntu/Kali系**。

```bash
# 初回（オンライン必須）
chmod +x scripts/ctf-up.sh scripts/ctf-down.sh
./scripts/ctf-up.sh

# 以降（オフラインでも可）
docker compose up -d      # 起動
docker compose down       # 停止
```

- 待受ポート：**8000/TCP**
- アクセスURL：**http://127.0.0.1:8000/**  
- 備考：初回ビルドで `node:20-alpine` を取得（ローカルにキャッシュ）。以降はオフラインでも `up -d` 可能。

完全オフラインVDIで初回からビルドしたい場合：別PCで以下を実施してVDIへtarを持ち込み、`docker load`の後に`docker compose build`。

```bash
docker pull node:20-alpine
docker save -o node20-alpine.tar node:20-alpine

# VDI（オフライン）側
docker load -i node20-alpine.tar
docker compose build
```

### B) 非Docker（フォールバック）
`apt` で Node.js を導入し、ホスト直起動します。対象OS：**Debian/Ubuntu/Kali系**。

```bash
sudo bash 02_Ops_Package/minidocs_setup.sh
# → /opt/web-pack/minidocs に配置・起動
# 停止: sudo /opt/web-pack/minidocs/stop_all.sh
```

- アクセスURL：**http://127.0.0.1:8000/**
- ログ：**/tmp/web-pack/minidocs.log**

---

## 2. アクセス情報

- URL（VDIローカル想定）：**http://127.0.0.1:8000/**
- 推奨ブラウザ：Chrome / Firefox（VDI標準で可）
- 注意：VDIポリシーでループバック以外を禁止する場合は、参加者はVDI内ブラウザからアクセスする運用にする。

---

## 3. アカウント

- 一般ユーザ：`alice / testalice`
- 管理者　　：`admin /（起動時にサーバ側で生成。画面またはログで確認）`  
  管理者パスワードは **管理者向けメモdoc** にも記載（IDORの導線）。

---

## 4. フラグ

- 起動時に `/tmp/web-pack/` に以下が生成されます：  
  - `FLAG_PP.txt`（Prototype Pollution 問）  
  - `FLAG_IDOR.txt`（IDOR 問）

- 差し替え（Docker運用）
```bash
FLAG_PP='PCTF{pp_yyyy}' FLAG_IDOR='PCTF{idor_xxxx}' docker compose up -d --build
```

- 差し替え（非Docker運用）
```bash
sudo FLAG_PP='PCTF{pp_yyyy}' FLAG_IDOR='PCTF{idor_xxxx}' /opt/web-pack/minidocs/start_all.sh
```

---

## 5. 想定解法（2問）

### (1) IDOR（認可不備によるドキュメント閲覧）
1. 一般ユーザ `alice/testalice` でログイン。  
2. ドキュメント詳細 `/docs/<doc-id>` へ直接アクセスでき、**所有者チェックが不十分**。  
3. 命名規則（`doc-<prefix>-NNNN` 等）を推測して **管理者メモdoc** に到達。  
4. 当該docに **管理者パスワード** が記載。  
5. `admin/<パスワード>` で管理ログイン → 管理画面で **IDORフラグ** を取得。

### (2) Prototype Pollution（機能フラグ編集のJSONマージ不備）
1. 管理者で `/admin` の「feature-flags」フォームから **JSONパッチ**を送信。  
2. サーバの脆弱なマージ処理により、`featureFlags` 配下に `__proto__` を混入させることで **プロトタイプ汚染** が可能。  
3. 例（UIからの正攻法に沿った解法）：
```json
{"featureFlags":{"__proto__":{"revealSecret":true}}}
```
4. 管理画面の診断表示（ダイアグノスティクス）が **PPフラグ** に切り替わる。

> 備考：トップレベル直下の `{"__proto__":{...}}` はサーバ側制御で受理されない想定。  
> `featureFlags.__proto__.revealSecret` による汚染が想定解。

---

## 6. 監視・トラブルシュート

- ログ（Docker）
```bash
docker ps
docker logs -f <コンテナ名>
```

- ログ（非Docker）
```bash
sudo tail -n 100 /tmp/web-pack/minidocs.log
```

- ポート確認
```bash
ss -ltnp | grep :8000
```

- 500 / 起動失敗時の確認
  - `/tmp/web-pack/FLAG_PP.txt` / `FLAG_IDOR.txt` の有無
  - `/tmp` への書き込み権限
  - Docker の場合は `docker compose build` の成功可否・イメージ存在を確認

---

## 7. 停止・片付け

- Docker
```bash
docker compose down
```

すべてクリーンにする場合（任意）
```bash
docker system prune -f
docker volume prune -f
```

- 非Docker
```bash
sudo /opt/web-pack/minidocs/stop_all.sh
```

---

## 8. オフライン運用のヒント（VDI 向け）

- ベースイメージの事前配布
```bash
# オンライン端末
docker pull node:20-alpine
docker save -o node20-alpine.tar node:20-alpine

# オフラインVDI
docker load -i node20-alpine.tar
```
これにより、**ビルド時にインターネットへ出ない**環境でも `FROM node:20-alpine` が解決できる。

- 可能なら、アプリ本体のイメージも事前に `docker build` → `docker save` して配布すると、VDI側は `docker load` → `docker run/compose up` だけで起動可能。
