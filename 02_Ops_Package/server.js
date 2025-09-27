#!/usr/bin/env node
'use strict';

// 依存: Node 標準のみ（npm不要）
const http = require('http');
const fs = require('fs');
const url = require('url');
const qs = require('querystring');
const crypto = require('crypto');

const PORT = 8000;
const RUNDIR = '/tmp/web-pack';
const FLAG_PP_FILE = `${RUNDIR}/FLAG_PP.txt`;
const FLAG_IDOR_FILE = `${RUNDIR}/FLAG_IDOR.txt`;

// ====== 小物 ======
function readFlag(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); }
  catch { return '(flag-unset)'; }
}
function html(body) {
  return `<!doctype html><meta charset="utf-8"><title>MiniDocs</title>
<style>body{font:14px/1.5 system-ui;margin:2rem} input,textarea{width:100%} .hint{color:#666} .bad{color:#b00}</style>
${body}`;
}
function parseCookies(req) {
  const c = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(kv=>{
    const i = kv.indexOf('=');
    if (i>0) c[kv.slice(0,i).trim()] = decodeURIComponent(kv.slice(i+1));
  });
  return c;
}
function rand4() { return crypto.randomBytes(2).toString('hex'); }

// ====== 状態 ======
const users = {
  alice:  { abbr:'al' },
  bob:    { abbr:'bo' },
  victor: { abbr:'vi' } // 被害者
};
let config = {}; // 汚染される想定

const victimTail4 = rand4();
const victimId = `doc-${users.victor.abbr}-${victimTail4}`;
const docs = Object.create(null);

// 起動時に被害者ドキュメントを置く（IDOR）
docs[victimId] = {
  owner: 'victor',
  title: 'Internal doc',
  body: `FLAG_IDOR: ${readFlag(FLAG_IDOR_FILE)}`
};

// ====== 脆弱なマージ（Prototype Pollution） ======
function vulnMerge(target, source) {
  // __proto__/constructor.prototypeをブロックしない“わざと脆弱”な実装
  for (const k in source) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      vulnMerge(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

// ====== ルータ ======
const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const path = u.pathname;
  const method = req.method;
  const cookies = parseCookies(req);
  const me = users[cookies.user] ? cookies.user : null;

  // CORS/headers（不要だが簡単化）
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // "/" index
  if (method === 'GET' && path === '/') {
    const body = `
      <h1>MiniDocs</h1><p>ユーザ: <b>${me||'(未ログイン)'}</b></p>
      <ul>
        <li><a href="/login">/login</a></li>
        <li><a href="/me">/me</a>（自分のドキュメント）</li>
        <li><a href="/leak">/leak</a>（メタデータ：IDヒント）</li>
        <li><a class="bad" href="/admin">/admin</a>（管理UIが存在することを示唆）</li>
        <li><a href="/admin/config">/admin/config</a></li>
        <li><a href="/admin/info">/admin/info</a></li>
        <li><a href="/debug">/debug</a></li>
      </ul>
      <p class="hint">目標: FLAG_PP（/admin系） と FLAG_IDOR（他人の doc）</p>`;
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(html(body));
  }

  // /login
  if (path === '/login') {
    if (method === 'GET') {
      const body = `<h1>Login</h1><form method="POST">
         <p><label>ユーザ選択:
           <select name="user">
             <option value="alice">alice</option>
             <option value="bob">bob</option>
           </select></label></p>
         <button>Login</button>
       </form>
       <p class="hint">固定ユーザのみ。登録は不要。</p>`;
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(html(body));
    }
    if (method === 'POST') {
      let data=''; req.on('data', ch=> data+=ch);
      req.on('end', ()=>{
        const q = qs.parse(data);
        const user = (q.user||'').toString();
        if (!users[user]) {
          res.writeHead(400, {'Content-Type':'text/html; charset=utf-8'});
          return res.end(html('<p>unknown user</p>'));
        }
        res.writeHead(302, {
          'Set-Cookie': `user=${encodeURIComponent(user)}; Path=/; HttpOnly`,
          'Location':'/'
        });
        return res.end();
      });
      return;
    }
  }

  // /me
  if (method === 'GET' && path === '/me') {
    let list = [];
    if (me) {
      list = Object.entries(docs)
        .filter(([id, d]) => d.owner === me)
        .map(([id, d]) => ({ id, title:d.title }));
    }
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ user: me||null, my_docs:list }, null, 2));
  }

  // /leak（ヒント: doc-**-xxxx）
  if (method === 'GET' && path === '/leak') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({
      my_docs: [],
      hints: [ `doc-**-${victimTail4}` ]
    }, null, 2));
  }

  // /docs/:id
  if (method === 'GET' && path.startsWith('/docs/')) {
    const id = path.slice('/docs/'.length);
    const d = docs[id];
    if (!d) {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(html('<p>not found</p>'));
    }
    const body = `<h1>${d.title}</h1><pre>${d.body}</pre><p class="hint">id=${id}, owner=${d.owner}</p>`;
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(html(body));
  }

  // /admin → 403（存在を示唆）
  if (path === '/admin' && method === 'GET') {
    res.writeHead(403, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(html('<h1>403 Forbidden</h1>'));
  }

  // /admin/config（PPの入口）
  if (path === '/admin/config') {
    if (method === 'GET') {
      const body = `<h1>Admin Config</h1>
        <form method="POST">
          <p><label>json:<br><textarea name="json" rows="6" placeholder='{"feature":true}'></textarea></label></p>
          <button>Submit</button>
        </form>
        <p class="hint">JSON をマージします（十分に安全とは限りません）。</p>`;
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(html(body));
    }
    if (method === 'POST') {
      let data=''; req.on('data', ch=> data+=ch);
      req.on('end', ()=>{
        const q = qs.parse(data);
        try {
          const o = JSON.parse(q.json || '{}');
          vulnMerge(config, o); // ← 脆弱
          res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
          return res.end(html(`<pre>${JSON.stringify(config, null, 2)}</pre>`));
        } catch(e) {
          res.writeHead(400, {'Content-Type':'text/html; charset=utf-8'});
          return res.end(html('<p>bad json</p>'));
        }
      });
      return;
    }
  }

  // /admin/info（PP成立時にFLAG表示）
  if (method === 'GET' && path === '/admin/info') {
    const reveal = !!(config.revealSecret); // 汚染で true になりうる
    const body = reveal
      ? `<h1>Admin Info</h1><pre>${readFlag(FLAG_PP_FILE)}</pre>`
      : `<h1>Admin Info</h1><p>no secret</p>`;
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(html(body));
  }

  // /debug
  if (method === 'GET' && path === '/debug') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({
      me, config, victimId, hintTail4: victimTail4
    }, null, 2));
  }

  // fallback
  res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
  return res.end(html('<p>404</p>'));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MiniDocs on http://127.0.0.1:${PORT}`);
});
