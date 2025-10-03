# MiniDocs 運用手順（運営用・完全版）

> 本書は **運営向け** です（参加者へは配布しない）。  
> 方針：構築はオンラインで一度だけ実施し、その後は **オフラインでも運用**できる形にする。

---

## 0. クイックスタート（Docker 推奨）

```bash
# 0) 取得＆移動（オンライン端末）
git clone https://github.com/yuui25/CTF.git
cd CTF/02_Ops_Package

# 1) スクリプトに実行権限を付与
chmod +x scripts/ctf-up.sh scripts/ctf-down.sh

# 2) 初回セットアップ＆起動（Docker の導入 → ビルド → 起動）
#    ※ パッケージ導入があるため sudo が必要
sudo ./scripts/ctf-up.sh

# 3) 動作確認
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -I http://127.0.0.1:8000/
```

- 2回目以降は **オフラインでも** 次で起動/停止できます：
  ```bash
  cd CTF/02_Ops_Package
  sudo docker compose up -d    # 起動
  sudo docker compose down     # 停止
  ```
  > 環境によっては `docker-compose`（ハイフン）コマンドになる場合があります。両方試してください。

---

## 1. 起動方式

### A) Docker（推奨：一度オンライン → 以降オフライン可）
構築スクリプトが **Docker の導入（apt）→ ビルド → 起動** を自動で行います。  
対象 OS：**Debian/Ubuntu/Kali 系**。

```bash
# 初回（オンライン必須）
git clone https://github.com/yuui25/CTF.git
cd CTF/02_Ops_Package
chmod +x scripts/ctf-up.sh scripts/ctf-down.sh
sudo ./scripts/ctf-up.sh

# 以降（オフラインでも可）
docker compose up -d      # 起動
docker compose down       # 停止
```

- 待受ポート：**8000/TCP**
- アクセス URL：**http://127.0.0.1:8000/**
- 備考：初回ビルドで `node:20-alpine` を取得（ローカルにキャッシュ）。以降はオフラインでも `up -d` 可能。

**完全オフライン VDI で初回からビルドしたい場合**：別 PC で以下を実施して VDI へ tar を持ち込み、`docker load` の後に `docker compose build`。

```bash
docker pull node:20-alpine
docker save -o node20-alpine.tar node:20-alpine

# VDI（オフライン）側
docker load -i node20-alpine.tar
docker compose build
```

### B) 非 Docker（フォールバック）
`apt` で Node.js を導入し、ホスト直起動します。対象 OS：**Debian/Ubuntu/Kali 系**。

```bash
git clone https://github.com/yuui25/CTF.git
cd CTF/02_Ops_Package
sudo bash non-docker/minidocs_setup.sh
# → /opt/web-pack/minidocs に配置・起動
# 停止: sudo /opt/web-pack/minidocs/stop_all.sh
```

- アクセス URL：**http://127.0.0.1:8000/**
- ログ：**/tmp/web-pack/minidocs.log**

---

## 2. アクセス情報

- URL（VDI ローカル想定）：**http://127.0.0.1:8000/**
- 推奨ブラウザ：Chrome / Firefox（VDI 標準で可）
- 注意：VDI ポリシーでループバック以外を禁止する場合は、参加者は VDI 内ブラウザからアクセスする運用にする。

---

## 3. アカウント

- 一般ユーザ：`alice / testalice`
- 管理者　　：`admin /（起動時にサーバ側で生成。画面またはログで確認）`  
  管理者パスワードは **管理者向けメモ doc** にも記載（IDOR の導線）。

---

## 4. フラグ

- 起動時に `/tmp/web-pack/` に以下が生成されます：  
  - `FLAG_PP.txt`（Prototype Pollution 問）  
  - `FLAG_IDOR.txt`（IDOR 問）

- 差し替え（Docker 運用）
```bash
FLAG_PP='PCTF{pp_yyyy}' FLAG_IDOR='PCTF{idor_xxxx}' docker compose up -d --build
```

- 差し替え（非 Docker 運用）
```bash
sudo FLAG_PP='PCTF{pp_yyyy}' FLAG_IDOR='PCTF{idor_xxxx}' /opt/web-pack/minidocs/start_all.sh
```

---

## 5. 想定解法（2問）

### (1) IDOR（認可不備によるドキュメント閲覧）
1. 一般ユーザ `alice/testalice` でログイン。  
2. ドキュメント詳細 `/docs/<doc-id>` へ直接アクセスでき、**所有者チェックが不十分**。  
3. 命名規則（`doc-<prefix>-NNNN` 等）を推測して **管理者メモ doc** に到達。  
4. 当該 doc に **管理者パスワード** が記載。  
5. `admin/<パスワード>` で管理ログイン → 管理画面で **IDOR フラグ** を取得。

### (2) Prototype Pollution（機能フラグ編集の JSON マージ不備）
1. 管理者で `/admin` の「feature-flags」フォームから **JSON パッチ**を送信。  
2. サーバの脆弱なマージ処理により、`featureFlags` 配下に `__proto__` を混入させることで **プロトタイプ汚染** が可能。  
3. 例（UI からの正攻法に沿った解法）：
```json
{"featureFlags":{"__proto__":{"revealSecret":true}}}
```
4. 管理画面の診断表示（ダイアグノスティクス）が **PP フラグ** に切り替わる。

> 備考：トップレベル直下の `{"__proto__":{...}}` はサーバ側制御で受理されない想定。  
> `featureFlags.__proto__.revealSecret` による汚染が想定解。

---

## 6. 監視・トラブルシュート

### 6.1 ログ確認

- **Docker**
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  docker logs -f <コンテナ名>     # 例: docker logs -f minidocs
  ```

- **非 Docker**
  ```bash
  sudo tail -n 100 /tmp/web-pack/minidocs.log
  sudo tail -f /tmp/web-pack/minidocs.log
  ```

### 6.2 ポート・プロセス確認

```bash
ss -ltnp | grep :8000 || sudo lsof -i :8000
```

### 6.3 500 エラー / 起動失敗時のチェックリスト

- `/tmp/web-pack/FLAG_PP.txt` および `/tmp/web-pack/FLAG_IDOR.txt` の**存在**を確認  
  （ない場合はエントリポイントや初期化処理が動いていない可能性）
- `/tmp` および `/tmp/web-pack` の**書き込み権限**
  ```bash
  sudo -u <実行ユーザ> sh -lc 'mkdir -p /tmp/web-pack && touch /tmp/web-pack/.perm_test'
  ```
- **Docker の場合**
  ```bash
  cd CTF/02_Ops_Package
  docker compose build                  # 失敗していないか
  docker images | head                  # イメージが作成されているか
  ```
- **ポート競合**（8000 番が他プロセスで使用中でないか）
- **キャッシュ/古いボリュームの悪影響**が疑わしい場合は再デプロイ（6.5 参照）

### 6.4 セットアップ時の APT ミラー不調（HTTP 521/5xx など）

`02_Ops_Package/scripts/ctf-up.sh` 実行中に APT エラーで止まる場合は、ミラーを公式に戻して再試行してください。

```bash
# 1) まずミラー更新＆再試行付きで APT を整える
sudo apt-get clean
sudo sed -i 's|http://mirror.tefexia.net/kali|http://http.kali.org/kali|g' /etc/apt/sources.list
sudo apt-get update -o Acquire::Retries=5

# （任意）依存解決の再試行
sudo apt-get install -y --fix-missing docker.io docker-compose

# Docker デーモンを起動＆自動起動
sudo systemctl enable --now docker
```

> 公式以外を使う場合は安定ミラー（例: JAIST/RIKEN）に置き換え、`apt-get update` を再実行。

```bash
# 例: JAIST に固定
sudo sed -i 's|http://http.kali.org/kali|http://ftp.jaist.ac.jp/pub/Linux/kali|g' /etc/apt/sources.list
sudo apt-get update
```

### 6.5 再デプロイのテンプレ

- **Docker**
  ```bash
  cd CTF/02_Ops_Package
  docker compose down -v --remove-orphans
  docker compose build --no-cache
  docker compose up -d
  docker logs -f <コンテナ名>
  ```

- **非 Docker**
  ```bash
  sudo /opt/web-pack/minidocs/stop_all.sh
  sudo /opt/web-pack/minidocs/start_all.sh
  ```

### 6.6 簡易ヘルスチェック

```bash
curl -i http://127.0.0.1:8000/
```

---

## 7. 停止・片付け

- **Docker**
  ```bash
  docker compose down
  ```

  すべてクリーンにする場合（任意）
  ```bash
  docker system prune -f
  docker volume prune -f
  ```

- **非 Docker**
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

  # オフライン VDI
  docker load -i node20-alpine.tar
  ```
  これにより、**ビルド時にインターネットへ出ない**環境でも `FROM node:20-alpine` が解決できる。

- 可能なら、アプリ本体のイメージも事前に `docker build` → `docker save` して配布すると、VDI 側は `docker load` → `docker run/compose up` だけで起動可能。

---

## 9. 備考（よくある質問）

- **`docker compose` と `docker-compose` の違いは？**  
  近年は前者（スペース区切り, Compose v2）が標準です。環境により後者のみインストールされる場合があります。

- **`sudo` なしで `docker` を使いたい**  
  ```bash
  sudo usermod -aG docker $USER
  # 反映にはログアウト/ログインまたは newgrp docker が必要
  newgrp docker
  ```
