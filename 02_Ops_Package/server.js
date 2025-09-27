// MiniDocs: IDOR(管理者PWを含むdoc) → 管理者ログイン → Prototype Pollution で別FLAG
// 127.0.0.1:8000 / Node.js単体（npm不要）

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');

// ===== Flags (外部ファイル優先・欠けていても体裁を整える) =====
const RUNDIR = '/tmp/web-pack';
function readText(path){ try { return fs.readFileSync(path,'utf8').trim(); } catch { return ''; } }
function normalizeFlag(text, fallback){
  const s = (text || '').trim();
  if (!s) return fallback;
  return s.endsWith('}') ? s : (s + '}');
}
const FLAG_PP   = normalizeFlag(readText(`${RUNDIR}/FLAG_PP.txt`),   'PCTF{pp_default}');
const FLAG_IDOR = normalizeFlag(readText(`${RUNDIR}/FLAG_IDOR.txt`), 'PCTF{idor_default}');

// ===== Users / Passwords =====
// 一般ユーザは alice のみ。bob はユーザとしては存在しないが、文書は存在して一覧に出す。
const ADMIN_PASSWORD = 'adm-' + crypto.randomBytes(3).toString('hex'); // /docs/doc-ad-0001 の本文
const USERS = {
  alice: { role: 'user',  password: 'testalice' },
  admin: { role: 'admin', password: ADMIN_PASSWORD },
};

// ===== Session =====
const SESSIONS = Object.create(null); // sid -> {user}
function newSid(){ return crypto.randomBytes(16).toString('hex'); }
function parseCookies(req){
  const raw = req.headers.cookie || ''; const out = {};
  raw.split(';').forEach(p => { const [k,v] = p.trim().split('='); if (k) out[k] = decodeURIComponent(v||''); });
  return out;
}
function setCookieKV(name, value){ return { 'Set-Cookie': `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly` }; }
function getUserFromSession(req){
  const sid = parseCookies(req)['session_pxt'];
  if (sid && SESSIONS[sid] && USERS[SESSIONS[sid].user]) return SESSIONS[sid].user;
  return null;
}

// ===== Docs =====
const DOCS = Object.create(null);
function addDoc(id, owner, title, body, ymd){ DOCS[id] = { id, owner, title, body, createdAt: ymd }; }

// bob / alice の6件（本文は編集しやすいよう "test" 初期化）
addDoc('doc-bo-0001', 'bob',   'bob note #1',   'test', '2025/09/25');
addDoc('doc-bo-0002', 'bob',   'bob note #2',   'test', '2025/09/26');
addDoc('doc-bo-0003', 'bob',   'bob note #3',   'test', '2025/09/27');
addDoc('doc-al-0001', 'alice', 'alice memo #1', 'test', '2025/09/25');
addDoc('doc-al-0002', 'alice', 'alice memo #2', 'test', '2025/09/26');
addDoc('doc-al-0003', 'alice', 'alice memo #3', 'test', '2025/09/27');

// ★管理者の隠しドキュメント: 一般ユーザの一覧には出さない。
// admin ログイン後の me/docs には表示。IDOR では一般ユーザも直打ちで参照可。
const ADMIN_DOC_ID = 'doc-ad-0001';
addDoc(ADMIN_DOC_ID, 'admin', 'Admin memo', ADMIN_PASSWORD, '2025/09/27');

// ===== Admin config (PP 脆弱) =====
const ADMIN_CONFIG = { revealSecret: false, limits: { maxDoc: 100 } };
function deepMerge(dst, src){
  if (src && typeof src==='object'){
    for (const k of Object.keys(src)){
      if (src[k] && typeof src[k] === 'object'){
        if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
        deepMerge(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
  }
  return dst;
}

// ===== Utils =====
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function send(res, code, body, ctype='text/html; charset=utf-8', headers={}){ res.writeHead(code, { 'Content-Type': ctype, ...headers }); res.end(body); }
function parseBody(req){
  return new Promise((resolve)=>{
    let data=''; req.on('data', ch => data += ch);
    req.on('end', ()=>{
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')){ try { return resolve({ json: JSON.parse(data) }); } catch { return resolve({}); } }
      const q = querystring.parse(data); if (q.json){ try { q.json = JSON.parse(q.json); } catch {} }
      resolve(q);
    });
  });
}

function layout(title, user, innerHtml){
  const loggedIn = !!user;
  const isAdmin  = loggedIn && USERS[user]?.role === 'admin';
  const userLine = loggedIn ? `<p class="who">Signed in as <b>${escapeHtml(user)}</b> (${escapeHtml(USERS[user].role)})</p>` : '';
  const nav = loggedIn
    ? [`<a href="/me">me</a>`,`<a href="/docs">docs</a>`, ...(isAdmin?[`<a href="/admin">admin</a>`]:[]), `<a href="/logout">logout</a>`].join(' · ')
    : `<a href="/login">login</a>`;
  return `<!doctype html><meta charset="utf-8"><title>${title} - MiniDocs</title>
<style>
:root{--bg:#f7f9fb;--card:#fff;--ink:#111;--muted:#6b7280;--pri:#2563eb;--line:#e5e7eb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,Segoe UI,Roboto,Helvetica,Arial}
.header{background:#fff;border-bottom:1px solid var(--line)}
.container{max-width:860px;margin:0 auto;padding:16px}
.brand{font-weight:700}
nav a{color:var(--pri);text-decoration:none;margin-right:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
td,th{padding:10px;border-top:1px solid var(--line);text-align:left}
th{background:#fafafa;color:#374151}
.bad{color:#b00020}.hint{color:var(--muted)}.who{color:#374151}
h1,h2{margin:8px 0 12px}
pre{background:#0b1020;color:#e5e7eb;padding:10px;border-radius:8px;overflow:auto}
label input, textarea, select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px}
</style>
<header class="header"><div class="container">
  <h1 class="brand"><a href="/" style="text-decoration:none;color:inherit">MiniDocs</a></h1>
  <nav>${nav}</nav>
  ${userLine}
</div></header>
<main class="container">${innerHtml}</main>`;
}
function card(html){ return `<section class="card">${html}</section>`; }

// ===== Guards =====
function requireLogin(req, res){
  const u = getUserFromSession(req);
  if (!u){ send(res, 302, '', 'text/plain', { Location: '/login' }); return [null, null]; }
  return [u, USERS[u]];
}
function requireAdmin(req, res){
  const [u, info] = requireLogin(req, res); if (!u) return [null, null];
  if (info.role !== 'admin'){ send(res, 403, layout('403', u, card(`<p class="bad">403 Forbidden</p>`))); return [null, null]; }
  return [u, info];
}

// ===== Handler =====
async function handler(req, res){
  const { pathname } = url.parse(req.url, true);
  const user = getUserFromSession(req);

  // Top：未ログイン時のみ案内を表示。ログイン済みならダッシュボード風に。
  if (req.method==='GET' && pathname==='/'){
    if (!user){
      return send(res, 200, layout('Home', user,
        card(`<h2>ようこそ</h2><p>社内ミニドキュメントのプレビュー環境です。まずは <a href="/login">login</a> から。</p>`)
      ));
    }
    // ログイン後は簡素な案内のみ
    return send(res, 200, layout('Home', user,
      card(`<h2>ダッシュボード</h2><p><a href="/me">me</a> / <a href="/docs">docs</a></p>`)
    ));
  }

  // Login / Logout
  if (req.method==='GET' && pathname==='/login'){
    return send(res, 200, layout('Login', user, card(`
      <h2>Login</h2>
      <form method="POST">
        <p><label>User ID <input name="user" required></label></p>
        <p><label>Password <input name="password" type="password" required></label></p>
        <p><button>Sign in</button></p>
      </form>
      <p class="hint">一般ユーザ: <code>alice / testalice</code>。管理者は調査でパスワード入手。</p>
    `)));
  }
  if (req.method==='POST' && pathname==='/login'){
    const body = await parseBody(req);
    const name = (body.user||'').toString();
    const pass = (body.password||'').toString();
    if (!USERS[name] || USERS[name].password !== pass){
      return send(res, 401, layout('Login', user, card(`<p class="bad">ユーザIDまたはパスワードが違います</p>`)));
    }
    const sid = newSid(); SESSIONS[sid] = { user: name };
    return send(res, 302, '', 'text/plain', { ...setCookieKV('session_pxt', sid), Location: (name==='admin'?'/admin':'/') });
  }
  if (req.method==='GET' && pathname==='/logout'){
    const sid = parseCookies(req)['session_pxt']; if (sid) delete SESSIONS[sid];
    return send(res, 302, '', 'text/plain', { ...setCookieKV('session_pxt',''), Location: '/' });
  }

  // Me（ログイン後）: admin の場合は doc-ad-0001 も表示
  if (req.method==='GET' && pathname==='/me'){
    const [u] = requireLogin(req, res); if (!u) return;
    let mine = Object.values(DOCS).filter(d => d.owner === u);
    if (USERS[u].role === 'admin' && !mine.find(d => d.id === ADMIN_DOC_ID)){
      mine = [DOCS[ADMIN_DOC_ID], ...mine];
    }
    const rows = mine.length
      ? mine.map(d => `<tr><td>${escapeHtml(d.id)}</td><td><a href="/docs/${d.id}">${escapeHtml(d.title)}</a></td><td>${escapeHtml(d.createdAt||'-')}</td></tr>`).join('')
      : `<tr><td colspan="3">(自分の文書はありません)</td></tr>`;
    return send(res, 200, layout('My Docs', u, card(`
      <h2>My Docs</h2>
      <table><thead><tr><th>ID</th><th>Title</th><th>Created</th></tr></thead>
      <tbody>${rows}</tbody></table>
    `)));
  }

  // Docs list（ログイン後）: 一般ユーザには admin doc を出さない。admin は出す。
  if (req.method==='GET' && pathname==='/docs'){
    const [u] = requireLogin(req, res); if (!u) return;
    let list = Object.values(DOCS);
    if (USERS[u].role !== 'admin'){
      list = list.filter(d => d.id !== ADMIN_DOC_ID);
    }
    const rows = list
      .sort((a,b)=>a.id.localeCompare(b.id))
      .map(d => `<tr><td>${escapeHtml(d.id)}</td><td><a href="/docs/${d.id}">${escapeHtml(d.title)}</a></td><td>${escapeHtml(d.createdAt||'-')}</td></tr>`)
      .join('');
    return send(res, 200, layout('Docs', u, card(`
      <h2>All Docs</h2>
      <table><thead><tr><th>ID</th><th>Title</th><th>Created</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="hint">例: <code>doc-bo-0002</code> など ID 規則に注目。</p>
    `)));
  }

  // Doc view（IDOR: 所有者チェックなし / 要ログイン）
  if (req.method==='GET' && pathname.startsWith('/docs/')){
    const [u] = requireLogin(req, res); if (!u) return;
    const id = pathname.split('/').pop();
    const d = DOCS[id];
    if (!d) return send(res, 404, layout('404', u, card(`<p>not found</p>`)));
    return send(res, 200, layout(d.title, u, card(`
      <h2>${escapeHtml(d.title)}</h2>
      <pre>${escapeHtml(d.body)}</pre>
      <p class="hint">id=${escapeHtml(d.id)}, owner=${escapeHtml(d.owner)}</p>
    `)));
  }

  // Admin ダッシュボード（IDOR flag を表示）
  if (req.method==='GET' && pathname==='/admin'){
    const [u] = requireAdmin(req, res); if (!u) return;
    return send(res, 200, layout('Admin', u,
      card(`<h2>Admin dashboard</h2><p class="hint">ようこそ、管理者ページへ。</p>
            <p><b>IDOR flag</b>:</p><pre>${escapeHtml(FLAG_IDOR)}</pre>`)
      + card(`<h3>Links</h3><ul>
          <li><a href="/admin/info">/admin/info</a>（PPトグル後にFLAG表示）</li>
          <li><a href="/admin/config">/admin/config</a>（脆弱マージ）</li>
        </ul>`)
    ));
  }

  // Admin info（PP で revealSecret が true になれば FLAG_PP を表示）
  if (req.method==='GET' && pathname==='/admin/info'){
    const [u] = requireAdmin(req, res); if (!u) return;
    return send(res, 200, layout('Admin Info', u, card(`
      <h2>Secret</h2><pre>${ADMIN_CONFIG.revealSecret ? FLAG_PP : '(secret hidden)'}</pre>
    `)));
  }

  // Admin config（PP）
  if (pathname==='/admin/config'){
    const [u] = requireAdmin(req, res); if (!u) return;
    if (req.method==='GET'){
      return send(res, 200, layout('Admin Config', u, card(`
        <h2>Admin Config</h2>
        <form method="POST">
          <p><label>json
            <textarea name="json" rows="6" placeholder='{"limits":{"maxDoc":200}}'></textarea>
          </label></p>
          <p><button>Merge</button></p>
        </form>
        <p class="hint">※ベータ版のため __proto__ もマージされます</p>
        <pre>${escapeHtml(JSON.stringify(ADMIN_CONFIG, null, 2))}</pre>
      `)));
    }
    if (req.method==='POST'){
      const body = await parseBody(req);
      const payload = body.json || {};
      deepMerge(ADMIN_CONFIG, payload); // ← Prototype Pollution 脆弱
      return send(res, 302, '', 'text/plain', { Location: '/admin/config' });
    }
  }

  // Fallback
  return send(res, 404, layout('404', user, card(`<p>not found</p>`)));
}

// ===== Server =====
const srv = http.createServer(handler);
srv.listen(8000, '127.0.0.1', () => console.log('MiniDocs on http://127.0.0.1:8000'));
