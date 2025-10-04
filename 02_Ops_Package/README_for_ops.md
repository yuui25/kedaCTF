# MiniDocs 運用手順（運営用・ブラウザのみ参加方式）

> 方針：**管理者が起動**し、**参加者はブラウザだけ**でアクセスする。参加者には Docker 権限を与えない。

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
FLAG_PP=PCTF{pp_fixed_value}
FLAG_IDOR=PCTF{idor_fixed_value}
EOF'
sudo chmod 600 /etc/minidocs/minidocs.env
```

### C) Docker 導入（無ければ）
```bash
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose || true
sudo systemctl enable --now docker
```

> 参加者は docker グループに入れない。`/opt/ctf-src` は 750 などで他ユーザ不可視に。

---

## 1. 起動（管理者）

```bash
cd /opt/ctf-src/02_Ops_Package
# docker-compose.yml は /etc/minidocs/minidocs.env を参照するように編集済みであること
sudo docker compose build
sudo docker compose up -d
```

- アクセス URL：`http://127.0.0.1:8000/`（VDI内ブラウザ）
- 参加者はブラウザのみ利用。Docker は操作不可。

---

## 2. 停止・再起動（管理者）

```bash
cd /opt/ctf-src/02_Ops_Package
sudo docker compose down
# or 再起動
sudo docker compose down && sudo docker compose up -d
```

---

## 3. 監視・トラブルシュート（管理者）

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo docker logs -f minidocs
ss -ltnp | grep :8000 || sudo lsof -i :8000
curl -i http://127.0.0.1:8000/
```

- `/etc/minidocs/minidocs.env` は root:root 600。値の変更時は `sudo docker compose up -d --build`。
- フラグはコンテナ内 `/tmp/web-pack/FLAG_*.txt` に生成（tmpfs）。

---

## 4. 参加者案内文（例）

- VDI を起動し、VDI 内ブラウザで **http://127.0.0.1:8000/** にアクセスしてください。
- 受験者は PC から Docker を操作する必要はありません。
- ログイン：`alice/testalice`（一般）
- 管理系操作は運営のみが実施します。
