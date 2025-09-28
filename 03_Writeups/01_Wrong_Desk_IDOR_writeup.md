# Wrong Desk (IDOR) - Writeup

## 解法の流れ

1. ユーザでログインする  
   - 例: `alice / testalice`

2. `/me` から自分のドキュメント一覧を確認する

3. `/leak` にアクセス  
   - JSON に `doc-**-abcd` のようなヒントが含まれている

4. パターンに従って他ユーザの ID を推測  
   - 例: `/docs/doc-vi-abcd`

5. アクセスすると **Victor** の内部資料が表示され、そこにフラグが書かれている

## ポイント
- IDOR（Insecure Direct Object Reference）の典型例
- 認可チェックが欠けているため、**URL さえ知れば他人のデータにアクセス可能**
- 実システムでも頻繁に発見される脆弱性
