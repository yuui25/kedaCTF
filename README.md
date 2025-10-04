# MiniDocs

ちょっとした社内メモアプリを舞台に、**IDOR（認可不備）**と**Prototype Pollution（設定マージの不備）**を学べる2問構成のWeb CTFです。  
ブラウザだけで解ける、短時間想定のシナリオ。URL は `http://127.0.0.1:8000/`。

---

## 環境
- 実行環境：**VDI 上の Linux**（受験者は VDI 内ブラウザのみ使用／Docker 権限なし）
- 受験 URL：`http://127.0.0.1:8000/`

## カテゴリ
- **web**

## 難易度
- **IDOR**：易
- **Prototype Pollution（PP）**：中

## テーマ
- **IDOR**：認可不備をついた**機微情報（管理者メモ）閲覧**
- **PP**：設定マージの不備を突く**不正操作（機能フラグの汚染）**

---

## タイトル
- **01 — Next Door Notes**
- **02 — Prototype Whisper**

## 問題文
### 01 — Next Door Notes
> 最近社内メモ管理ツールが導入された簡単なメモを残すには便利かもしれない。
> ただ、オフィスでは「となりの机の書類が混ざることがある」なんて噂も。

### 02 — Prototype Whisper
> 管理画面で“設定”をいじると見た目が変わる普通のツール。  
> 秘密の設定が、いつの間にか受け継がれることがあるらしい。

---

## フラグ
- **IDOR**：`PCTF{wrong_desk_idor_admin_pw_leak}`
- **PP**：`PCTF{quiet_config_proto_secret_revealed}`
> 後で変更可能

---

## 解法（簡易版）
### IDOR
1. 一般ユーザ `alice/testalice` でログインし、**doc-id 規則**（`doc-<prefix>-NNNN`）を把握。  
2. **管理者 prefix（ad）**の doc-id を直接 URL で試行（例：`/docs/doc-ad-0003`）し、メモ内の**管理者パスワード**を取得。  
3. `admin/<hidden>` でログインし、**管理画面**で `<FLAG_IDOR>` を確認。

### Prototype Pollution
1. 管理者でログイン後右上のadminを押下 
2. `{"featureFlags":{"__proto__":{"revealSecret":true}}}` を送信し、**prototype 汚染**で `revealSecret` を有効化。  
3. 画面下部の`secretPreview` が `<FLAG_PP>` に変化したことを確認。

---

## 必要ツール
- **ブラウザのみ**（VDI 内で提供）

---

## 参考情報 / ルール
- **環境構築は管理側で実施**：root 権限で Docker を使用してセットアップします。  
- **インターネット接続は構築時のみ必要**：挑戦時は**オフライン（VDI 内）**で動作します。  
- **使用禁止**：ファジングツールの利用、DoS、辞書攻撃・総当たり、OS/コンテナへの侵入。  
- **OK**：**ブラウザから行えるアプリの通常操作**、および URL 直打ち・フォーム送信等の範囲。  
- **URL**：`http://127.0.0.1:8000/`（挑戦時に Docker 権限はありません）

---

## 運用者向けドキュメント
- **環境構築・運用手順**は同梱の **`README_for_ops.md`** を参照してください。  
  - 例：フラグ設定（`/etc/minidocs/minidocs.env`）、`entrypoint.sh`、`docker-compose.yml` の配置と起動、`/tmp/web-pack/flags/FLAG_*.txt` の確認 など。

---
