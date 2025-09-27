// MiniDocs (IDOR -> admin password -> PP) drop-in server.js
// 127.0.0.1:8000 ローカルのみ。依存なし (node 単体)
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');

// ====== Config / Flags ======
const RUNDIR = '/tmp/web-pack';
const FLAG_PP_PATH   = `${RUNDIR}/FLAG_PP.txt`;
const FLAG_IDOR_PATH = `${RUNDIR}/FLAG_IDOR.txt`;

// flags: 起動スクリプトが用意（無ければデフォルト）
function readFlagSafe(path, fallback) {
  try { return fs.readFileSync(path, 'utf8').trim(); }
  catch { return fallback; }
}
const FLAG_PP   = readFlagSafe(FLAG_PP_PATH,   'PCTF{pp_default}');
const FLAG_IDOR = readFlagSafe(FLAG_IDOR_PATH, 'PCTF{idor_default}`');

// ====== In-memory “DB” ======
// 末尾4桁ヒントをランダム生成（毎起動）
const DOC_TAIL = crypto.randomBytes(2).toString('hex'); // e.g. "a159"
const ADMIN_PASSWORD = 'adm-' + crypto.randomBytes(3).toString('hex'); // docに記載 → /login で使用

// ユーザ
const USERS = {
  alice: { role: 'user' },
  bob:   { role: 'user' },
  admin: { role: 'admin', password: ADMIN_PASSWORD },
};

// ドキュメント（所有者：victor の内部文書）
// これをIDORで覗いて admin パスワード & IDORフラグを取る
const DOCS = {};
const ADMIN_MEMO_ID = `doc-vi-${DOC_TAIL}`;
DOCS[ADMIN_MEMO_ID] = {
  id: ADMIN_MEMO_ID,
  owner: 'victor',
  title: 'Internal doc',
  body: `FLAG_IDOR: ${FLAG_IDOR}\nadminPassword: ${ADMIN_PASSWORD}\nnote: do not share`,
};

// ログイン後に /me で見える “自分の” 文書（体裁用）
DOCS['doc-al-0001'] = { id:'doc-al-0001', owner:'alice', title:'alice note', body:'(empty)' };
DOCS['doc-bo-0001'] = { id:'doc-bo-0001', owner:'bob',   title:'bob memo',   body:'(empty)' };

// 管理画面 設定（PP 脆弱なマージで __proto__ を許してしまう）
const ADMIN_CONFIG = { revealSecret: false, limits: { maxDoc: 100 } };

// ====== Helpers ======
function tplPage(title, html, user) {
  const who = user ? `${user} (${USERS[user]?.role || 'guest'})` : '(未ログイン)';
  // トップには admin への導線を**出さない**（自然なアプリらしさ）
  // 管理UIは /login で admin 認証後だけ到達可能にする
  return (
`<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px/1.5 system-ui;margin:2rem}
input,textarea,select{font:inherit}
.hint{color:#666}.bad{color:#b00}</style>
<h1>MiniDocs</h1><p>ユーザ: <b>${who}</b></p>
${html}`
  );
}
function send(res, code, body, ctype='text/html; charset=utf-8', headers={}) {
  res.writeHead(code, { 'Content-Type': ctype, ...headers });
  res.end(body);
}
function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(p=>{
    const [k,v] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(v||'');
  });
  return out;
}
function setCookie(res, name, value) {
  return { 'Set-Cookie': `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly` };
}
function requireLogin(req, res) {
  const user = parseCookies(req).u || '';
  if (!user || !USERS[user]) {
    send(res, 302, '', 'text/plain', { Location: '/login' });
    return [null, null];
  }
  return [user, USERS[user]];
}
function requireAdmin(req, res) {
  const [user, info] = requireLogin(req, res);
  if (!user) return [null, null];
  if (info.role !== 'admin') {
    send(res, 403, tplPage('403', '<p>403 Forbidden</p>', user));
    return [null, null];
  }
  return [user, info];
}
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { return resolve({ json: JSON.parse(data) }); } catch { return resolve({}); }
      }
      // x-www-form-urlencoded
      const q = querystring.parse(data);
      if (q.json) {
        try { q.json = JSON.parse(q.json); } catch {}
      }
      resolve(q);
    });
  });
}
// 脆弱な deep merge（__proto__ を弾かない：PP用）
function deepMerge(dst, src) {
  if (src && typeof src === 'object') {
    for (const k of Object.keys(src)) {
      if (src[k] && typeof src[k] === 'object') {
        if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
        deepMerge(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
  }
  return dst;
}

// ====== Handlers ======
async function handler(req, res) {
  const { pathname, query } = url.parse(req.url, true);
  const cookies = parseCookies(req);
  const user = cookies.u || '';

  // ---- Routing ----
  if (req.method === 'GET' && pathname === '/') {
    // トップ：自然な導線。管理系リンクは**未表示**。
    const html = `
      <ul>
        <li><a href="/login">/login</a></li>
        <li><a href="/me">/me</a>（自分のドキュメント）</li>
        <li><a href="/leak">/leak</a>（メタデータ：IDヒント）</li>
      </ul>
      <p class="hint">目標：1) IDORで内部メモを覗いて管理者パスワードを入手 → 2) adminログイン → 3) 管理設定の不備（PP）でシークレットを表示</p>
    `;
    return send(res, 200, tplPage('MiniDocs', html, user));
  }

  if (req.method === 'GET' && pathname === '/login') {
    const html = `
      <h2>Login</h2>
      <form method="POST">
        <p><label>ユーザ:
          <select name="user">
            <option value="alice">alice</option>
            <option value="bob">bob</option>
            <option value="admin">admin</option>
          </select></label></p>
        <p><label>パスワード（adminのみ）:
          <input type="password" name="password" /></label></p>
        <button>Login</button>
      </form>
      <p class="hint">alice/bob はパスワード不要。admin は内部ドキュメントから取得。</p>
    `;
    return send(res, 200, tplPage('Login', html, user));
  }
  if (req.method === 'POST' && pathname === '/login') {
    const body = await parseBody(req);
    const name = (body.user || '').toString();
    const pass = (body.password || '').toString();

    if (!USERS[name]) {
      return send(res, 400, tplPage('Login', '<p class="bad">不明なユーザ</p>', user));
    }
    if (name === 'admin') {
      if (pass !== USERS.admin.password) {
        return send(res, 401, tplPage('Login', '<p class="bad">adminパスワードが違います</p>', user));
      }
    }
    return send(res, 302, '', 'text/plain', { ...setCookie(res, 'u', name), Location: '/' });
  }

  if (req.method === 'GET' && pathname === '/me') {
    const [u, info] = requireLogin(req, res);
    if (!u) return;

    const my = Object.values(DOCS).filter(d => d.owner === u);
    const items = my.length
      ? my.map(d => `<li><a href="/docs/${d.id}">${d.title} (${d.id})</a></li>`).join('')
      : '<li>(自分の文書はありません)</li>';

    const html = `
      <h2>My Docs</h2>
      <ul>${items}</ul>
      <p><a href="/">← top</a></p>
    `;
    return send(res, 200, tplPage('My Docs', html, u));
  }

  if (req.method === 'GET' && pathname === '/leak') {
    // 末尾4桁ヒントを出す
    const payload = JSON.stringify({ my_docs: [], hints: [ `doc-**-${DOC_TAIL}` ] }, null, 2);
    return send(res, 200, payload, 'application/json; charset=utf-8');
  }

  if (req.method === 'GET' && pathname.startsWith('/docs/')) {
    // ★IDOR：ログインは必須だが所有者チェックはしない
    const [u] = requireLogin(req, res);
    if (!u) return;

    const id = pathname.split('/').pop();
    const doc = DOCS[id];
    if (!doc) return send(res, 404, tplPage('404', '<p>not found</p>', u));

    const html = `
      <h2>${doc.title}</h2>
      <pre>${escapeHtml(doc.body)}</pre>
      <p class="hint">id=${doc.id}, owner=${doc.owner}</p>
      <p><a href="/me">← my docs</a></p>
    `;
    return send(res, 200, tplPage(doc.title, html, u));
  }

  // ---- 管理UI（adminログイン時のみ可視） ----
  if (req.method === 'GET' && pathname === '/admin') {
    const [u, info] = requireAdmin(req, res);
    if (!u) return;
    const html = `
      <h2>Admin</h2>
      <ul>
        <li><a href="/admin/info">/admin/info</a>（シークレット情報）</li>
        <li><a href="/admin/config">/admin/config</a>（設定：POSTでJSONマージ）</li>
      </ul>
      <p><a href="/">← top</a></p>
    `;
    return send(res, 200, tplPage('Admin', html, u));
  }

  if (req.method === 'GET' && pathname === '/admin/info') {
    const [u] = requireAdmin(req, res);
    if (!u) return;
    // PPで ADMIN_CONFIG.revealSecret が true になるとフラグ表示
    const html = `
      <h1>Admin Info</h1>
      <pre>${ADMIN_CONFIG.revealSecret ? FLAG_PP : '(secret hidden)'}</pre>
      <p class="hint">revealSecret=${String(ADMIN_CONFIG.revealSecret)}</p>
      <p><a href="/admin">← admin</a></p>
    `;
    return send(res, 200, tplPage('Admin Info', html, u));
  }

  if (pathname === '/admin/config') {
    const [u] = requireAdmin(req, res);
    if (!u) return;

    if (req.method === 'GET') {
      const html = `
        <h2>Admin Config</h2>
        <form method="POST">
          <p><label>json:
            <textarea name="json" rows="6" placeholder='{"limits":{"maxDoc":200}}'></textarea>
          </label></p>
          <button>Merge</button>
        </form>
        <p class="hint">※脆弱：__proto__ もマージされます</p>
        <pre>${escapeHtml(JSON.stringify(ADMIN_CONFIG, null, 2))}</pre>
        <p><a href="/admin">← admin</a></p>
      `;
      return send(res, 200, tplPage('Admin Config', html, u));
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const payload = body.json || {};
      // ★PP：防御しない deepMerge
      deepMerge(ADMIN_CONFIG, payload);
      return send(res, 302, '', 'text/plain', { Location: '/admin/config' });
    }
  }

  // それ以外
  return send(res, 404, tplPage('404', '<p>not found</p>', user));
}

// ====== Misc ======
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ====== Server ======
const srv = http.createServer(handler);
srv.listen(8000, '127.0.0.1', () => {
  console.log('MiniDocs on http://127.0.0.1:8000');
});
