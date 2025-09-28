// MiniDocs - PP (教育用) 完全版
// place at /opt/web-pack/minidocs/server.js
// - featureFlags.revealSecret is NOT defined initially (so "new key" injection via __proto__ works)
// - deepMerge left intentionally vulnerable (teaches Prototype Pollution)
// - diagnostics reads prototype-level injected keys too (so PP effects are visible)

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');

const RUNDIR = '/tmp/web-pack';
function readText(p){ try { return fs.readFileSync(p, 'utf8').trim(); } catch { return ''; } }
function normalizeFlag(x, fb){
  const s = (x || '').trim();
  if (!s) return fb;
  return s.endsWith('}') ? s : (s + '}');
}
const FLAG_PP   = normalizeFlag(readText(`${RUNDIR}/FLAG_PP.txt`),   'PCTF{pp_default}');
const FLAG_IDOR = normalizeFlag(readText(`${RUNDIR}/FLAG_IDOR.txt`), 'PCTF{idor_default}');

// Users
const ADMIN_PASSWORD = 'adm-' + crypto.randomBytes(3).toString('hex');
const USERS = {
  alice: { role: 'user',  password: 'testalice' },
  admin: { role: 'admin', password: ADMIN_PASSWORD },
};

// Sessions
const SESS = Object.create(null);
const sidKey = 'session_pxt';
const newSid = () => crypto.randomBytes(16).toString('hex');
function parseCookies(req){
  const raw = req.headers.cookie || ''; const out = {};
  raw.split(';').forEach(p => { const [k,v] = p.trim().split('='); if (k) out[k] = decodeURIComponent(v||''); });
  return out;
}
function userFromReq(req){
  const sid = parseCookies(req)[sidKey];
  if (sid && SESS[sid] && USERS[SESS[sid].user]) return SESS[sid].user;
  return null;
}
function setCookie(name, val){ return { 'Set-Cookie': `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly` }; }

// Docs
const DOCS = Object.create(null);
function addDoc(id, owner, title, body, ymd){ DOCS[id] = { id, owner, title, body, createdAt: ymd }; }

addDoc('doc-bo-0001', 'bob',   'bob note #1',   'test', '2025/09/25');
addDoc('doc-bo-0002', 'bob',   'bob note #2',   'test', '2025/09/26');
addDoc('doc-bo-0003', 'bob',   'bob note #3',   'test', '2025/09/27');
addDoc('doc-al-0001', 'alice', 'alice memo #1', 'test', '2025/09/25');
addDoc('doc-al-0002', 'alice', 'alice memo #2', 'test', '2025/09/26');
addDoc('doc-al-0003', 'alice', 'alice memo #3', 'test', '2025/09/27');

// Admin secret doc (admin password stored as doc body)
const ADMIN_DOC_ID = 'doc-ad-0001';
addDoc(ADMIN_DOC_ID, 'admin', 'Admin memo (password)', ADMIN_PASSWORD, '2025/09/27');

// Runtime config (note: featureFlags.revealSecret is NOT defined initially)
const RUNTIME = { featureFlags: { /* revealSecret intentionally left undefined */ }, limits: { maxDoc: 100 } };

// Intentionally vulnerable deepMerge (educational) — **DO NOT USE IN PRODUCTION**
function deepMerge(dst, src){
  if (!src || typeof src !== 'object') return dst;
  Object.keys(src).forEach(k => {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)){
      if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
      deepMerge(dst[k], v);
    } else {
      dst[k] = v;
    }
  });
  return dst;
}

// Utils & HTML layout
const esc = s => String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function send(res, code, body, ctype='text/html; charset=utf-8', headers={}){ res.writeHead(code, { 'Content-Type': ctype, ...headers }); res.end(body); }
function parseBody(req){
  return new Promise(resolve=>{
    let data=''; req.on('data', c=> data+=c); req.on('end', ()=>{
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')){ try { return resolve({ json: JSON.parse(data) }); } catch { return resolve({}); } }
      const q = querystring.parse(data); if (q.json){ try { q.json = JSON.parse(q.json); } catch {} }
      resolve(q);
    });
  });
}
function layout(title, user, inner){
  const logged = !!user; const isAdmin = logged && USERS[user]?.role==='admin';
  const nav = logged
    ? [`<a href="/me">me</a>`,`<a href="/docs">docs</a>`, ...(isAdmin?[`<a href="/admin">admin</a>`]:[]), `<a href="/logout">logout</a>`].join(' · ')
    : `<a href="/login">login</a>`;
  const who = logged ? `<p class="who">Signed in as <b>${esc(user)}</b> (${esc(USERS[user].role)})</p>` : '';
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)} - MiniDocs</title>
<style>body{font:14px/1.6 system-ui;margin:0;background:#f7f9fb;color:#111} .container{max-width:860px;margin:0 auto;padding:16px} header{background:#fff;padding:12px;border-bottom:1px solid #e5e7eb} nav a{color:#2563eb;text-decoration:none;margin-right:12px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:16px 0}.who{color:#374151} pre{background:#0b1020;color:#e5e7eb;padding:10px;border-radius:8px;overflow:auto}</style>
<header><div class="container"><h1><a href="/" style="color:inherit;text-decoration:none">MiniDocs</a></h1><nav>${nav}</nav>${who}</div></header><main class="container">${inner}</main>`;
}
const card = html => `<section class="card">${html}</section>`;

// Guards
function requireLogin(req, res){
  const u = userFromReq(req);
  if (!u){ send(res, 302, '', 'text/plain', { Location: '/login' }); return [null,null]; }
  return [u, USERS[u]];
}
function requireAdmin(req, res){
  const [u, info] = requireLogin(req, res); if (!u) return [null,null];
  if (info.role!=='admin'){ send(res, 403, layout('403', u, card(`<p class="bad">403 Forbidden</p>`))); return [null,null]; }
  return [u, info];
}

// Handler
async function handler(req, res){
  const { pathname } = url.parse(req.url, true);
  const user = userFromReq(req);

  if (req.method==='GET' && pathname==='/'){
    if (!user){
      return send(res, 200, layout('Home', user, card(`<h2>ようこそ</h2><p>社内ミニドキュメントのプレビュー環境です。まずは <a href="/login">login</a> から。</p>`)));
    }
    return send(res, 200, layout('Home', user, card(`<h2>ダッシュボード</h2><p><a href="/me">me</a> / <a href="/docs">docs</a></p>`)));
  }

  // Login
  if (req.method==='GET' && pathname==='/login'){
    return send(res, 200, layout('Login', user, card(`
      <h2>Login</h2>
      <form method="POST"><p><label>User ID <input name="user" required></label></p><p><label>Password <input name="password" type="password" required></label></p><p><button>Sign in</button></p></form>
      <p class="hint">ユーザ: alice / testalice. 管理者パスワードは運用文書にあります。</p>
    `)));
  }
  if (req.method==='POST' && pathname==='/login'){
    const body = await parseBody(req);
    const name = (body.user||'').toString();
    const pass = (body.password||'').toString();
    if (!USERS[name] || USERS[name].password !== pass){
      return send(res, 401, layout('Login', user, card(`<p class="bad">ユーザIDまたはパスワードが違います</p>`)));
    }
    const sid = newSid(); SESS[sid] = { user: name };
    return send(res, 302, '', 'text/plain', { ...setCookie(sidKey,sid), Location: (name==='admin'?'/admin':'/') });
  }
  if (req.method==='GET' && pathname==='/logout'){
    const sid = parseCookies(req)[sidKey]; if (sid) delete SESS[sid];
    return send(res, 302, '', 'text/plain', { ...setCookie(sidKey,''), Location: '/' });
  }

  // Me
  if (req.method==='GET' && pathname==='/me'){
    const [u] = requireLogin(req, res); if (!u) return;
    let mine = Object.values(DOCS).filter(d=> d.owner===u);
    if (USERS[u].role==='admin' && !mine.find(d=> d.id===ADMIN_DOC_ID)){
      mine = [DOCS[ADMIN_DOC_ID], ...mine];
    }
    const rows = mine.length
      ? mine.map(d=> `<tr><td>${esc(d.id)}</td><td><a href="/docs/${d.id}">${esc(d.title)}</a></td><td>${esc(d.createdAt||'-')}</td></tr>`).join('')
      : `<tr><td colspan="3">(自分の文書はありません)</td></tr>`;
    return send(res, 200, layout('My Docs', u, card(`<h2>My Docs</h2><table><thead><tr><th>ID</th><th>Title</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`)));
  }

  // Docs list
  if (req.method==='GET' && pathname==='/docs'){
    const [u] = requireLogin(req, res); if (!u) return;
    let list = Object.values(DOCS);
    if (USERS[u].role!=='admin'){ list = list.filter(d=> d.id!==ADMIN_DOC_ID); }
    const rows = list.sort((a,b)=> a.id.localeCompare(b.id))
      .map(d=> `<tr><td>${esc(d.id)}</td><td><a href="/docs/${d.id}">${esc(d.title)}</a></td><td>${esc(d.createdAt||'-')}</td></tr>`).join('');
    return send(res, 200, layout('Docs', u, card(`<h2>All Docs</h2><table><thead><tr><th>ID</th><th>Title</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table><p class="hint">例: doc-al-0001, doc-bo-0002 など</p>`)));
  }

  // Doc view (IDOR: no owner check)
  if (req.method==='GET' && pathname.startsWith('/docs/')){
    const [u] = requireLogin(req, res); if (!u) return;
    const id = pathname.split('/').pop();
    const d = DOCS[id];
    if (!d) return send(res, 404, layout('404', u, card(`<p>not found</p>`)));
    return send(res, 200, layout(d.title, u, card(`<h2>${esc(d.title)}</h2><pre>${esc(d.body)}</pre><p class="hint">id=${esc(d.id)}, owner=${esc(d.owner)}</p>`)));
  }

  // Admin dashboard
  if (req.method==='GET' && pathname==='/admin'){
    const [u] = requireAdmin(req, res); if (!u) return;
    return send(res, 200, layout('Admin', u, card(`<h2>Admin Console</h2><ul><li><a href="/admin/diagnostics">Diagnostics</a></li><li><a href="/admin/feature-flags">Feature Flags</a></li></ul><h3>IDOR flag</h3><pre>${esc(FLAG_IDOR)}</pre>`)));
  }

  // Diagnostics (reads prototype-level injections too)
  if (req.method==='GET' && pathname==='/admin/diagnostics'){
    const [u] = requireAdmin(req, res); if (!u) return;
    // detection order:
    // 1) own property on RUNTIME.revealSecret
    // 2) own property on RUNTIME.featureFlags.revealSecret
    // 3) prototype-level property (Object.prototype.revealSecret) — this is the PP route
    const own = (o,k) => Object.prototype.hasOwnProperty.call(o, k);
    const revealOwn = own(RUNTIME, 'revealSecret') ? RUNTIME.revealSecret : undefined;
    const revealFF = (RUNTIME.featureFlags && own(RUNTIME.featureFlags,'revealSecret')) ? RUNTIME.featureFlags.revealSecret : undefined;
    const revealProto = Object.prototype.revealSecret; // if prototype polluted, will be present
    const reveal = (revealOwn !== undefined) ? revealOwn : (revealFF !== undefined ? revealFF : (revealProto !== undefined ? revealProto : false));

    const diag = {
      app: { name: 'MiniDocs', mode: 'prod', version: '1.0' },
      featureFlags: RUNTIME.featureFlags,
      limits: RUNTIME.limits,
      serverTime: new Date().toISOString(),
      secretPreview: reveal ? FLAG_PP : '(hidden)'
    };
    return send(res, 200, layout('Diagnostics', u, card(`<h2>Diagnostics</h2><pre>${esc(JSON.stringify(diag, null, 2))}</pre>`)));
  }

  // Feature flags (vulnerable merge)
  if (pathname==='/admin/feature-flags'){
    const [u] = requireAdmin(req, res); if (!u) return;
    if (req.method==='GET'){
      return send(res, 200, layout('Feature Flags', u, card(`<h2>Feature Flags</h2><form method="POST"><p><label>patch (JSON)<textarea name="json" rows="6" placeholder='{"featureFlags":{"revealSecret":true}}'></textarea></label></p><p><button>Apply</button></p></form><p class="hint">デモ: 深いマージを行います（学習用に __proto__ を無検出でマージします）</p><pre>${esc(JSON.stringify(RUNTIME, null, 2))}</pre>`)));
    }
    if (req.method==='POST'){
      const body = await parseBody(req);
      const payload = body.json || {};
      // vulnerable merge — educational
      deepMerge(RUNTIME, payload);
      return send(res, 302, '', 'text/plain', { Location: '/admin/feature-flags' });
    }
  }

  // Debug (optional hint page) — visible only to admins here (can be toggled)
  if (req.method==='GET' && pathname==='/debug'){
    const [u] = requireAdmin(req, res); if (!u) return;
    return send(res, 200, layout('Debug', u, card(`<h2>Debug</h2><p>RUNTIME object snapshot:</p><pre>${esc(JSON.stringify(RUNTIME, null, 2))}</pre><p>Note: This is an educational environment.</p>`)));
  }

  // Fallback
  return send(res, 404, layout('404', user, card(`<p>not found</p>`)));
}

// Server
http.createServer(handler).listen(8000, '127.0.0.1', () => {
  console.log('MiniDocs on http://127.0.0.1:8000');
});
