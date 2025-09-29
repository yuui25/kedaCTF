
'use strict';

const http = require('http');
const url  = require('url');
const fs   = require('fs');
const qs   = require('querystring');
const crypto = require('crypto');

// ===== Flags =====
const RUNDIR = '/tmp/web-pack';
function readText(p){ try { return fs.readFileSync(p, 'utf8').trim(); } catch { return ''; } }
function normalizeFlag(x, fb){ const s = (x||'').trim(); return s ? (s.endsWith('}') ? s : s + '}') : fb; }
const FLAG_PP   = normalizeFlag(readText(`${RUNDIR}/FLAG_PP.txt`),   'FLAG{pp_default}');
const FLAG_IDOR = normalizeFlag(readText(`${RUNDIR}/FLAG_IDOR.txt`), 'FLAG{idor_default}');

// ===== Runtime config (revealSecret は未定義のまま) =====
const RUNTIME = {
  app: { name: 'MiniDocs', mode: 'prod', version: '1.0' },
  featureFlags: {},                 // ← 機能フラグはここ。revealSecret はUIからは無視される
  limits: { maxDoc: 100 },
  // revealSecret: (undefined)    // ← ここをあえて作らない（PPで原型に生やされる余地）
};

// ===== vulnerable deep merge (教育用) =====
function deepMerge(dst, src) {
  if (!src || typeof src !== 'object') return dst;
  for (const key of Object.keys(src)) {
    const value = src[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!dst[key] || typeof dst[key] !== 'object') dst[key] = {};
      deepMerge(dst[key], value);   // ← __proto__ もそのまま潜る（Prototype Pollutionが成立）
    } else {
      dst[key] = value;
    }
  }
  return dst;
}

// ===== HTML utils (白基調) =====
const esc = s => String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function send(res, code, body, ctype='text/html; charset=utf-8', headers={}){ res.writeHead(code, { 'Content-Type': ctype, ...headers }); res.end(body); }
function layout(title, user, body){
  const isLogged = !!user;
  const isAdmin  = isLogged && USERS[user]?.role === 'admin';
  const nav = isLogged
    ? [`<a href="/">home</a>`,`<a href="/me">me</a>`,`<a href="/docs">docs</a>`, ...(isAdmin?[`<a href="/admin">admin</a>`]:[]), `<a href="/logout">logout</a>`].join(' · ')
    : `<a href="/login">login</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    :root{
      --bg:#ffffff; --fg:#0f172a; --muted:#475569; --border:#e2e8f0; --card:#ffffff; --link:#2563eb;
      --input-bg:#ffffff; --input-fg:#0f172a; --input-bd:#cbd5e1;
    }
    *{box-sizing:border-box} body{margin:0; font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--fg)}
    header,footer{padding:12px 16px; border-bottom:1px solid var(--border); background:#fafafa}
    main{max-width:960px; margin:0 auto; padding:20px}
    a{color:var(--link); text-decoration:none}
    a:hover{text-decoration:underline}
    .card{background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; margin:16px 0}
    code,pre{background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:8px}
    input,textarea,button{background:var(--input-bg); color:var(--input-fg); border:1px solid var(--input-bd); border-radius:8px; padding:8px}
    textarea{width:100%}
    table{width:100%; border-collapse:collapse}
    th,td{border-bottom:1px solid var(--border); padding:8px; text-align:left}
    .muted{color:var(--muted)}
    form.inline{display:inline}
  </style></head><body>
  <header><strong>MiniDocs</strong><nav style="float:right">${nav}</nav></header>
  <main>${body}</main>
  <footer>© MiniDocs</footer>
  </body></html>`;
}
const card = html => `<div class="card">${html}</div>`;

// ===== Auth / Sessions =====
const sidKey = 'session_pxt';
const SESS = Object.create(null);
const newSid = () => crypto.randomBytes(16).toString('hex');

const USERS = { alice: { role: 'user',  password: 'testalice' } };
const ADMIN_PASSWORD = 'adm-' + crypto.randomBytes(3).toString('hex');
USERS.admin = { role: 'admin', password: ADMIN_PASSWORD };

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

// ===== Docs (in-memory) =====
const DOCS = Object.create(null);
function addDoc(id, owner, title, body, ymd){ DOCS[id] = { id, owner, title, body, createdAt: ymd }; }

// 初期データ（ヒント含む）
// ===== 初期データ（役割別ヒントを自然に散らす） =====

// bob: 新人開発者（PPのヒント役）
addDoc('doc-bo-0001', 'bob', '勉強メモ: オブジェクトの設定管理',
  'JSの学習: 設定項目を管理するためのオブジェクトがあって、いくつかのフラグで処理を切り替えている。', '2025/08/03');
addDoc('doc-bo-0002', 'bob', '勉強メモ: 配列のマージ処理',
  'JSの学習: 配列を結合する方法を調べていたら、「deepmerge」っていうメソッドを使うと深い階層まで結合できるらしい。', '2025/08/12');
addDoc('doc-bo-0003', 'bob', '勉強メモ: 設定の切り替え',
  'JSの学習: 設定を動的に切り替える方法を試していたら、オブジェクトのフラグを使う方法が便利そうだ。設定を簡単に管理できる。', '2025/08/15');
addDoc('doc-bo-0004', 'bob', '勉強メモ: 機能フラグの管理',
  'JSの学習: 自分のプロジェクトでは、設定の切り替えに「featureFlags」というトップレベルキーを使って、特定の機能をオンオフできるようにした。', '2025/08/21');
addDoc('doc-bo-0005', 'bob', '勉強メモ: 設定の管理方法',
  'JSの学習: 設定フラグを使うと便利だけど、フラグが増えすぎると管理が大変になるかも。特に深い階層の設定を扱う場合。', '2025/08/30');

// alice: システム担当者（IDORのヒント役）
addDoc('doc-al-0001', 'alice', '運用メモ: 夜間ジョブの監視',
  '夜間のジョブが予定通りに実行されているかを監視している。ログは一通り確認済み。', '2025/09/26');
addDoc('doc-al-0002', 'alice', '運用メモ: 管理者のIDについて',
  'システムの管理者が使っているIDは、複雑なものではなく、誰でも思いつくようなシンプルな名前だった。これでは外部から推測される恐れがある。', '2025/09/27');
addDoc('doc-al-0003', 'alice', '運用メモ: メンテナンス中のシステム状態確認',
  'システムメンテナンスの間、特定の機能が停止していることを確認。メンテナンス終了後、再度チェックが必要。', '2025/09/28');
addDoc('doc-al-0004', 'alice', '運用メモ: システムセキュリティ強化',
  'セキュリティに関する設定変更が最近行われたが、一部の設定はまだ完全に適用されていない。', '2025/09/29');
addDoc('doc-al-0005', 'alice', '運用メモ: パスワード管理方法の見直し',
  '管理者がパスワードをメモ帳に保存していることが判明。後ほど削除依頼を出す予定。', '2025/09/30');

// admin
addDoc('doc-ad-0001', 'admin', 'メモ',
  'システムのメモ\n- 設定はいろいろあるけど正直よく分かってない。\n- 何かあったらここに書いておく。', '2025/09/26');
addDoc('doc-ad-0002', 'admin', '設定っぽいもの',
  '誰かが「設定は画面から入れろ」と言ってた。\n自分は難しいことは分からないので、ここに書いてコピーしておく。', '2025/09/27');
addDoc('doc-ad-0003', 'admin', 'パスワード',
  `大事そうだからここにメモしておく。\nパスワード: ${ADMIN_PASSWORD}\n管理ページに入る時に必要。`, '2025/09/28');


// ===== Helpers =====
function requireLogin(req, res){
  const u = userFromReq(req);
  if (!u){ send(res, 302, '', 'text/plain', { Location: '/login' }); return [null,null]; }
  return [u, USERS[u]];
}
function requireAdmin(req, res){
  const [u, info] = requireLogin(req, res); if (!u) return [null,null];
  if (info.role !== 'admin'){ send(res, 403, layout('403', u, card(`<p>forbidden</p>`))); return [null,null]; }
  return [u, info];
}
function parseBody(req){
  return new Promise(resolve=>{
    let data=''; req.on('data', c => data += c).on('end', ()=>{
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')){
        try { resolve({ json: JSON.parse(data) }); } catch { resolve({}); }
      } else { resolve(qs.parse(data)); }
    });
  });
}

// ドキュメントID自動採番（ユーザー名→接頭辞）
const PREFIX_MAP = { alice: 'al', admin: 'ad', bob: 'bo' };
function nextDocIdFor(user){
  const p = PREFIX_MAP[user] || user.slice(0,2).toLowerCase();
  const re = new RegExp(`^doc-${p}-(\\d{4})$`);
  let max = 0;
  for (const id of Object.keys(DOCS)){
    const m = id.match(re);
    if (m){ const n = parseInt(m[1],10); if (n>max) max = n; }
  }
  const num = String(max + 1).padStart(4, '0');
  return `doc-${p}-${num}`;
}
function todayYMD(){
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${day}`;
}

// ===== /admin 画面（Diagnostics 統合） =====
function buildAdminPage(user){
  // ★ 判定は「素朴に読む」＝現実っぽい（ownPropertyで防御しない）
  const v1 = RUNTIME.revealSecret;                 // ルート直下（基本は未定義）
  const v2 = RUNTIME.featureFlags?.revealSecret;   // フラグ入れ物（prototype汚染で見える）
  const reveal = (v1 !== undefined) ? v1
               : (v2 !== undefined) ? v2
               : false;

  const diag = {
    app: RUNTIME.app,
    limits: RUNTIME.limits,
    availableFeatureFlags: [
      { name: "revealSecret", type: "boolean" },                           // ← “存在”だけ示す
      { name: "betaUI",       type: "boolean", experimental: true },
      { name: "exportCSV",    type: "enum",    values: ["disabled","user","admin"] },
      { name: "auditLog",     type: "enum",    values: ["off","errors","all"] }
    ],
    serverTime: new Date().toISOString(),
    secretPreview: reveal ? FLAG_PP : "(hidden)"
  };

  const sec1 = card(`<h2>IDOR flag</h2><pre>${esc(FLAG_IDOR)}</pre>`);

  const sec2 = card(`<h2>システム管理</h2>
    <ul>
      <li><strong>設定変更</strong>：設定内容を変更できます。テキストエリアに JSON を入力して適用します。</li>
      <li><strong>現在の設定</strong>：現在の設定内容と候補仕様（フラグのスキーマ）を確認できます。</li>
    </ul>`);

  const sec3 = card(`<h2>設定変更</h2>
    <form method="POST" action="/admin/feature-flags">
      <p><label for="patch">patch (JSON)</label><br>
        <textarea id="patch" name="json" rows="6" placeholder='{"limits":{"maxDoc":100}}'></textarea>
      </p>
      <p><button>Apply</button></p>
    </form>`);

  const sec4 = card(`<h2>現在の設定</h2>
    <pre>${esc(JSON.stringify(diag, null, 2))}</pre>`);

  return sec1 + sec2 + sec3 + sec4;
}

// ===== Routes =====
async function handler(req, res){
  const { pathname } = url.parse(req.url, true);
  const user = userFromReq(req);

  // Home
  if (req.method==='GET' && pathname==='/'){
    const body = card(`<h2>MiniDocsについて</h2>
      <p>MiniDocs は、軽量なメモ管理システムです。ログインして自分のメモを作成し、あとから一覧や詳細を確認できます。管理者は運用設定の調整も行えます。</p>
      <ul>
        <li><strong>Me</strong>：自分のメモの一覧と新規作成</li>
        <li><strong>Docs</strong>：メモの一覧</li>
      </ul>`);
    return send(res, 200, layout('Home', user, body));
  }

  // Login / Logout
  if (req.method==='GET' && pathname==='/login'){
    return send(res, 200, layout('Login', user, card(`<h2>Login</h2>
      <form method="POST" action="/login">
        <p><label>Username <input name="user" required></label></p>
        <p><label>Password <input name="pass" type="password" required></label></p>
        <p><button>Sign in</button></p>
      </form>
      <p class="muted">例: <code>alice/testalice</code></p>`)));
  }
  if (req.method==='POST' && pathname==='/login'){
    const body = await parseBody(req);
    const u = String(body.user||''); const p = String(body.pass||'');
    if (!USERS[u] || USERS[u].password !== p){
      return send(res, 200, layout('Login', user, card(`<p class="muted">invalid</p>`)));
    }
    const sid = newSid(); SESS[sid] = { user: u, ts: Date.now() };
    return send(res, 302, '', 'text/plain', { ...setCookie(sidKey, sid), Location: '/' });
  }
  if (req.method==='GET' && pathname==='/logout'){
    const sid = parseCookies(req)[sidKey]; if (sid) delete SESS[sid];
    return send(res, 302, '', 'text/plain', { ...setCookie(sidKey,''), Location: '/' });
  }

  // Me（自分のメモ一覧 + 新規作成）
  if (pathname==='/me'){
    const [u] = requireLogin(req, res); if (!u) return;
    if (req.method==='GET'){
      const mine = Object.values(DOCS).filter(d => d.owner === u).sort((a,b)=> a.id.localeCompare(b.id));
      const rows = mine.length
        ? mine.map(d=> `<tr><td>${esc(d.id)}</td><td><a href="/docs/${esc(d.id)}">${esc(d.title)}</a></td><td>${esc(d.createdAt||'-')}</td></tr>`).join('')
        : `<tr><td colspan="3">(empty)</td></tr>`;
      const form = `
        <h3>新規メモ</h3>
        <form method="POST" action="/me">
          <p><label>Title <input name="title" required></label></p>
          <p><label>Body<br><textarea name="body" rows="6" required></textarea></label></p>
          <p><button>Create</button></p>
        </form>`;
      return send(res, 200, layout('Me', u, card(`<h2>My Docs</h2>
        <table><thead><tr><th>ID</th><th>Title</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`)+card(form)));
    }
    if (req.method==='POST'){
      const body = await parseBody(req);
      const title = String(body.title||'').trim();
      const text  = String(body.body||'').trim();
      if (!title || !text) return send(res, 200, layout('Me', u, card(`<p>title/body is required.</p>`)));
      const id = nextDocIdFor(u);
      addDoc(id, u, title, text, todayYMD());
      return send(res, 302, '', 'text/plain', { Location: '/me' });
    }
  }

  // Docs list（admin=全件、一般=自分）
  if (req.method==='GET' && pathname==='/docs'){
    const [u] = requireLogin(req, res); if (!u) return;
    const isAdmin = USERS[u].role === 'admin';
    const list = isAdmin ? Object.values(DOCS) : Object.values(DOCS).filter(d => d.owner === u);
    const rows = list.sort((a,b)=> a.id.localeCompare(b.id))
      .map(d=> `<tr><td>${esc(d.id)}</td><td><a href="/docs/${esc(d.id)}">${esc(d.title)}</a></td><td>${esc(d.owner)}</td><td>${esc(d.createdAt||'-')}</td></tr>`).join('');
    const head = `<tr><th>ID</th><th>Title</th><th>Owner</th><th>Created</th></tr>`;
    return send(res, 200, layout('Docs', u, card(`<h2>${isAdmin ? 'All Docs' : 'Your Docs'}</h2>
      <table><thead>${head}</thead><tbody>${rows||'<tr><td colspan="4">(empty)</td></tr>'}</tbody></table>`)));
  }

  // Doc view（★IDOR: 所有者チェックをしない）
  if (req.method==='GET' && pathname.startsWith('/docs/')){
    const [u] = requireLogin(req, res); if (!u) return;
    const id = pathname.split('/').pop();
    const d = DOCS[id];
    if (!d) return send(res, 404, layout('404', u, card(`<p>not found</p>`)));
    return send(res, 200, layout(d.title, u, card(`<h2>${esc(d.title)}</h2><pre>${esc(d.body)}</pre><p class="muted">id=${esc(d.id)}, owner=${esc(d.owner)}</p>`)));
  }

  // Admin（Diagnostics 統合）
  if (req.method==='GET' && pathname==='/admin'){
    const [u] = requireAdmin(req, res); if (!u) return;
    return send(res, 200, layout('Admin', u, buildAdminPage(u)));
  }

  // Feature Flags（パッチ適用）
  if (pathname==='/admin/feature-flags'){
    const [u] = requireAdmin(req, res); if (!u) return;
    if (req.method==='GET'){
      return send(res, 302, '', 'text/plain', { Location: '/admin' });
    }
    if (req.method==='POST'){
      const body = await parseBody(req);
      let patch = {};
      if (body && typeof body.json === 'object'){
        patch = body.json;
      } else if (body && typeof body.json === 'string'){
        try { patch = JSON.parse(body.json); } catch { patch = {}; }
      }
      if (!patch || typeof patch !== 'object') patch = {};

      // 構造的サニタイズ（文字列パターンではない）:
      const allowedRoots = new Set(['limits','featureFlags']);
      for (const k of Object.keys(patch)){
        if (!allowedRoots.has(k)) delete patch[k];
      }
      // 2) 正攻法からの revealSecret 直接指定は無視（自然な「システム専用フラグ」扱い）
      if (patch.featureFlags && typeof patch.featureFlags === 'object'){
        if (Object.prototype.hasOwnProperty.call(patch.featureFlags, 'revealSecret')){
          delete patch.featureFlags.revealSecret;
        }
      }
      // 3) ルート直下も同様に無視（万一入ってきても無効化）
      if (Object.prototype.hasOwnProperty.call(patch, 'revealSecret')){
        delete patch.revealSecret;
      }

      // ★ deepMerge は脆弱なまま ⇒ __proto__ を通すと PP が成立
      deepMerge(RUNTIME, patch);

      return send(res, 302, '', 'text/plain', { Location: '/admin' });
    }
  }

  // 404
  return send(res, 404, layout('404', user, card(`<p>not found</p>`)));
}

// ===== Server =====
http.createServer(handler).listen(8000, '127.0.0.1', () => {
  console.log('MiniDocs on http://127.0.0.1:8000');
});
