# Quiet Config（Prototype Pollution）Writeup

## 概要
- ターゲット: `http://127.0.0.1:8000/`
- 脆弱性: **Prototype Pollution（プロトタイプ汚染）**
- 目標: `/admin/config` に細工した JSON を与え、`/admin/info` で **FLAG_PP** を表示

---

## 発見の流れ（ブラウザ）
1. `http://127.0.0.1:8000/` を開く → ナビ内に `/admin`, `/admin/config`, `/admin/info` がある。
2. `/admin` は 403 で「管理UIの存在」を示唆。
3. `/admin/config` は JSON を POST できるフォームがある（設定をマージする旨の文言）。
4. JSON マージの実装が安全でない可能性 → `__proto__` を使った汚染を検証。

---

## 侵害手順（ブラウザ手動）
1. `/admin/config` を開く。
2. テキストエリアに以下を貼り付けて Submit:
   ```json
   {"__proto__":{"revealSecret":true}}
