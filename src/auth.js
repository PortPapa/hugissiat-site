// 네이버 로그인 + 서명된 세션 쿠키 + 계정별 설정 저장
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));
const fromB64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
function cookies(req) {
  const o = {};
  (req.headers.get('cookie') || '').split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return o;
}
const setCookie = (name, val, maxAge) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function sessionUser(req, env) {
  const c = cookies(req).hs_sess;
  if (!c || !env.SESSION_KEY) return null;
  const [p, sig] = c.split('.');
  if (!p || !sig || (await hmac(env.SESSION_KEY, p)) !== sig) return null;
  try {
    const s = JSON.parse(fromB64u(p));
    if (!s.uid || s.exp < Date.now()) return null;
    const u = await env.TESTERS.get('u:' + s.uid, 'json');
    return u || null;
  } catch (e) { return null; }
}

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const redirect = (to, headers = {}) => new Response(null, { status: 302, headers: { Location: to, ...headers } });
const CALLBACK = 'https://hugissiat.com/auth/naver/callback';
const GCALLBACK = 'https://hugissiat.com/auth/google/callback';

// 계정: u:<uid>. 로그인 수단 id:<provider>:<pid> → uid, 같은 이메일이면 한 계정으로 합침
async function upsertUser(env, provider, pid, prof) {
  const K = env.TESTERS;
  let uid = await K.get('id:' + provider + ':' + pid);
  if (!uid && provider === 'naver' && (await K.get('u:' + pid))) uid = pid; // 예전 네이버 계정
  const em = (prof.email || '').toLowerCase();
  if (!uid && em) uid = await K.get('em:' + em);
  if (!uid) uid = provider === 'naver' ? pid : 'g' + pid;
  const old = (await K.get('u:' + uid, 'json')) || { created: new Date().toISOString(), state: null };
  const providers = { ...(old.providers || {}), [provider]: pid };
  const user = { ...old, id: uid, providers, email: old.email || prof.email || '', nickname: old.nickname || prof.nickname || '', img: old.img || prof.img || '', last: new Date().toISOString(), lastVia: provider };
  if (provider === 'naver' && prof.email) user.naverEmail = prof.email;
  await K.put('u:' + uid, JSON.stringify(user));
  await K.put('id:' + provider + ':' + pid, uid);
  if (em) await K.put('em:' + em, uid);
  return uid;
}
async function startSession(env, uid, next) {
  const payload = b64uStr(JSON.stringify({ uid, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
  const sess = payload + '.' + (await hmac(env.SESSION_KEY, payload));
  const h = new Headers({ Location: next || '/studio' });
  h.append('Set-Cookie', setCookie('hs_sess', sess, 60 * 60 * 24 * 30));
  h.append('Set-Cookie', setCookie('hs_state', '', 0));
  return new Response(null, { status: 302, headers: h });
}

export async function handleAuth(req, env, url) {
  const p = url.pathname;
  if (p === '/auth/naver/login') {
    const state = crypto.randomUUID().replace(/-/g, '');
    const next = (url.searchParams.get('next') || '/studio').replace(/[^\w/\-?=&#.]/g, '');
    const to = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${env.NAVER_ID}&redirect_uri=${encodeURIComponent(CALLBACK)}&state=${state}`;
    return redirect(to, { 'Set-Cookie': setCookie('hs_state', state + '|' + next, 600) });
  }
  if (p === '/auth/naver/callback') {
    const ck = (cookies(req).hs_state || '').split('|');
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return redirect('/?login=cancel');
    if (!code || !state || state !== ck[0]) return redirect('/?login=fail');
    const tr = await fetch(`https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${env.NAVER_ID}&client_secret=${env.NAVER_SECRET}&code=${encodeURIComponent(code)}&state=${state}`);
    const tok = await tr.json();
    if (!tok.access_token) return redirect('/?login=fail');
    const mr = await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    const me = await mr.json();
    if (me.resultcode !== '00' || !me.response || !me.response.id) return redirect('/?login=fail');
    const r = me.response;
    const uid = await upsertUser(env, 'naver', r.id, { email: r.email || '', nickname: r.nickname || '', img: r.profile_image || '' });
    return startSession(env, uid, ck[1]);
  }
  if (p === '/auth/google/login') {
    const state = crypto.randomUUID().replace(/-/g, '');
    const next = (url.searchParams.get('next') || '/studio').replace(/[^\w/\-?=&#.]/g, '');
    const to = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(env.GOOGLE_ID)}&redirect_uri=${encodeURIComponent(GCALLBACK)}&scope=${encodeURIComponent('openid email profile')}&state=${state}&prompt=select_account`;
    return redirect(to, { 'Set-Cookie': setCookie('hs_state', state + '|' + next, 600) });
  }
  if (p === '/auth/google/callback') {
    const ck = (cookies(req).hs_state || '').split('|');
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return redirect('/?login=cancel');
    if (!code || !state || state !== ck[0]) return redirect('/?login=fail');
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_ID, client_secret: env.GOOGLE_SECRET, redirect_uri: GCALLBACK, grant_type: 'authorization_code' }) });
    const tok = await tr.json();
    if (!tok.access_token) return redirect('/?login=fail');
    const g = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } })).json();
    if (!g.sub) return redirect('/?login=fail');
    const uid = await upsertUser(env, 'google', g.sub, { email: g.email_verified ? (g.email || '') : '', nickname: g.name || '', img: g.picture || '' });
    return startSession(env, uid, ck[1]);
  }
  if (p === '/auth/logout') return redirect('/', { 'Set-Cookie': setCookie('hs_sess', '', 0) });
  return null;
}

export async function handleMe(req, env, url) {
  const u = await sessionUser(req, env);
  if (url.pathname === '/api/me') {
    if (!u) return json({ ok: false }, 401);
    const ne = u.naverEmail || u.email || '';
    const guess = /@naver\.com$/i.test(ne) ? ne.split('@')[0] : '';
    return json({ ok: true, nickname: u.nickname, img: u.img, email: u.email, via: Object.keys(u.providers || { naver: 1 }), blogGuess: guess });
  }
  if (url.pathname === '/api/state') {
    if (!u) return json({ ok: false }, 401);
    if (req.method === 'GET') return json({ ok: true, state: u.state || null });
    if (req.method === 'PUT') {
      let s = null; try { s = await req.json(); } catch (e) {}
      if (!s || typeof s !== 'object') return json({ ok: false }, 400);
      const str = JSON.stringify(s); if (str.length > 200000) return json({ ok: false, error: '너무 커요' }, 413);
      u.state = s; u.saved = new Date().toISOString();
      await env.TESTERS.put('u:' + u.id, JSON.stringify(u));
      return json({ ok: true });
    }
  }
  if (url.pathname === '/api/me/delete' && req.method === 'POST') {
    if (!u) return json({ ok: false }, 401);
    for (const [pv, pid] of Object.entries(u.providers || {})) await env.TESTERS.delete('id:' + pv + ':' + pid);
    if (u.email) await env.TESTERS.delete('em:' + u.email.toLowerCase());
    await env.TESTERS.delete('u:' + u.id);
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('hs_sess', '', 0) });
  }
  return null;
}
