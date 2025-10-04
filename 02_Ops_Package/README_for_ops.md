# MiniDocs 運用手順

方針：
- **管理者（=root）が起動**し、**参加者はブラウザだけ**でアクセスする。参加者には Docker 権限を与えない。
- 参加者は docker グループに入れない。ファイルの配置場所は750 などで他ユーザ不可視に。

---

## 0. 事前準備（初回のみ / 管理者）

### A) リポジトリ配置（例：/opt/ctf-src）
```bash
sudo install -d -m 750 /opt/ctf-src
cd /opt/ctf-src
sudo git clone https://github.com/yuui25/CTF.git .
```

### B) フラグをリポジトリ外に配置（固定値はここで設定）
```bash
sudo install -d -m 700 /etc/minidocs
sudo bash -c 'cat >/etc/minidocs/minidocs.env <<EOF
FLAG_PP=PCTF{quiet_config_proto_secret_revealed}
FLAG_IDOR=PCTF{wrong_desk_idor_admin_pw_leak}
EOF'
sudo chmod 600 /etc/minidocs/minidocs.env
```

### C) Docker 導入（無ければ）
```bash
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose || true
sudo systemctl enable --now docker
```

---

## 1. 起動（管理者）

```bash
cd /opt/ctf-src/02_Ops_Package
sudo docker compose build
sudo docker compose up -d
```

- アクセス URL：`http://127.0.0.1:8000/`（VDI内ブラウザ）
- アカウント
    - 一般：alice / testalice
    - 管理：admin /（起動時に生成。画面またはログで確認）
- 参加者はブラウザのみ利用。Docker は操作不可。
> docker-compose.yml は /etc/minidocs/minidocs.env を参照するように編集済みであること

---

## 2. 停止・再起動（管理者）
**停止**
```bash
cd /opt/ctf-src/02_Ops_Package
sudo docker compose down
```
**再起動**
```bash
sudo docker compose down && sudo docker compose up -d
```

---

## 3. フラグ差し替え（管理者）
```bash
sed -i 's/PCTF{pp_.*/PCTF{pp_new}/' /etc/minidocs/minidocs.env
sed -i 's/PCTF{idor_.*/PCTF{idor_new}/' /etc/minidocs/minidocs.env
docker compose up -d --build
```

---

## 4. 停止・片付け（管理者）
```bash
cd /opt/ctf-src/02_Ops_Package
docker compose down
# すべてクリーン（任意）
docker system prune -f
docker volume prune -f
```
**すべてクリーンに（任意）**
```bash
cd /opt/ctf-src/02_Ops_Package
docker compose down
docker system prune -f
docker volume prune -f
```

---

## 5. 監視・トラブルシュート（管理者）

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo docker logs -f minidocs
ss -ltnp | grep :8000 || sudo lsof -i :8000
curl -i http://127.0.0.1:8000/
```

- `/etc/minidocs/minidocs.env` は root:root 600。値の変更時は `sudo docker compose up -d --build`。
- フラグはコンテナ内 `/tmp/web-pack/FLAG_*.txt` に生成（tmpfs）。
---

## 6. 非Docker（管理者）
**Node をホストに導入して起動**
```bash
sudo bash non-docker/minidocs_setup.sh
```
**起動/停止**
```bash
sudsudo /opt/web-pack/minidocs/start_all.sh
sudo /opt/web-pack/minidocs/stop_all.sh
```
- アクセス：http://127.0.0.1:8000/
- ログ：/tmp/web-pack/minidocs.log
---
>基本的にDocker想定なので使用する場合は要調整


## 7. 参加者案内文（例）

- VDI を起動し、VDI 内ブラウザで **http://127.0.0.1:8000/** にアクセスしてください。
- 受験者は PC から Docker を操作する必要はありません。
- ログイン：`alice/testalice`（一般）
- 管理系操作は運営のみが実施します。
