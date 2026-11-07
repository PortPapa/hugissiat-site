// hugissiat.com: 정적 페이지 + 테스터 신청 API
import { EmailMessage } from 'cloudflare:email';
import { analyzeBlog, topPosts, blogSkin } from './analyze.js';
import { handleAuth, handleMe, sessionUser } from './auth.js';

const GROUP_URL = 'https://groups.google.com/g/hugissiat-testers';
const OPTIN_URL = 'https://play.google.com/apps/testing/com.portpapa.hugissiat';
const STORE_URL = 'https://play.google.com/store/apps/details?id=com.portpapa.hugissiat';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

async function notify(env, name, email, count) {
  if (!env.NOTIFY) return;
  const subject = `후기씨앗 테스터 신청 (${count}번째): ${name}`;
  const body = `이름: ${name}\n이메일: ${email}\n시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n누적 신청: ${count}명`;
  const raw = [
    'From: "후기씨앗" <noreply@hugissiat.com>',
    'To: lcjun37@gmail.com',
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Message-ID: <${crypto.randomUUID()}@hugissiat.com>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(body),
  ].join('\r\n');
  try { await env.NOTIFY.send(new EmailMessage('noreply@hugissiat.com', 'lcjun37@gmail.com', raw)); } catch (e) { console.log('notify failed', e && e.message); }
}

async function signup(req, env, ctx) {
  let d = {};
  try { d = await req.json(); } catch (e) { return json({ ok: false, error: '내용을 읽지 못했어요' }, 400); }
  const name = String(d.name || '').trim().slice(0, 40);
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  if (d.website) return json({ ok: true, group: GROUP_URL, optin: OPTIN_URL, store: STORE_URL }); // 봇
  if (!name) return json({ ok: false, error: '이름을 적어주세요' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: '이메일 주소를 확인해 주세요' }, 400);
  if (!d.agree) return json({ ok: false, error: '개인정보 수집에 동의해 주세요' }, 400);
  const key = 't:' + email;
  const had = await env.TESTERS.get(key);
  const rec = { name, email, at: new Date().toISOString(), ua: (req.headers.get('user-agent') || '').slice(0, 160) };
  await env.TESTERS.put(key, JSON.stringify(rec));
  if (!had) {
    const n = parseInt((await env.TESTERS.get('count')) || '0', 10) + 1;
    await env.TESTERS.put('count', String(n));
    ctx.waitUntil(notify(env, name, email, n));
  }
  return json({ ok: true, again: !!had, group: GROUP_URL, optin: OPTIN_URL, store: STORE_URL });
}

async function analyze(url, env) {
  const blog = (url.searchParams.get('blog') || '').trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//, '').split(/[/?#]/)[0];
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(blog)) return json({ ok: false, error: '블로그 아이디를 확인해 주세요' }, 400);
  const n = Math.min(12, Math.max(3, parseInt(url.searchParams.get('n') || '8', 10)));
  const kind = url.searchParams.get('kind') === 'review' ? 'review' : 'all';
  const key = `a4:${blog}:${n}:${kind}`;
  if (!url.searchParams.get('fresh')) {
    const c = await env.TESTERS.get(key);
    if (c) return new Response(c, { headers: { 'content-type': 'application/json; charset=utf-8', 'x-cache': 'hit' } });
  }
  try {
    const r = await analyzeBlog(blog, n, kind);
    const body = JSON.stringify({ ok: true, ...r });
    await env.TESTERS.put(key, body, { expirationTtl: 21600 });
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' } });
  } catch (e) { return json({ ok: false, error: (e && e.message) || '불러오지 못했어요' }, 502); }
}

const J = { 'content-type': 'application/json; charset=utf-8' };
async function cached(env, key, ttl, fresh, make) {
  if (!fresh) { const c = await env.TESTERS.get(key); if (c) return new Response(c, { headers: { ...J, 'x-cache': 'hit' } }); }
  try { const body = JSON.stringify({ ok: true, ...(await make()) }); await env.TESTERS.put(key, body, { expirationTtl: ttl }); return new Response(body, { headers: J }); }
  catch (e) { return new Response(JSON.stringify({ ok: false, error: (e && e.message) || '불러오지 못했어요' }), { status: 502, headers: J }); }
}
async function top(url, env) {
  const q = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (q.length < 2) return new Response(JSON.stringify({ ok: false, error: '키워드를 두 글자 이상 넣어 주세요' }), { status: 400, headers: J });
  return cached(env, 't3:' + q, 86400, url.searchParams.get('fresh'), async () => { const r = await topPosts(q, 10); if (!r.posts.length) throw new Error('분석할 수 있는 글이 없어요'); return r; });
}
async function skin(url, env) {
  const blog = (url.searchParams.get('blog') || '').trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//, '').split(/[/?#]/)[0];
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(blog)) return new Response(JSON.stringify({ ok: false, error: '블로그 아이디를 확인해 주세요' }), { status: 400, headers: J });
  return cached(env, 'sk1:' + blog, 21600, url.searchParams.get('fresh'), () => blogSkin(blog));
}
async function imgProxy(url) {
  const u = url.searchParams.get('u') || '';
  let h; try { h = new URL(u).hostname; } catch (e) { return new Response('bad', { status: 400 }); }
  if (!/(^|\.)pstatic\.net$/.test(h)) return new Response('bad', { status: 400 });
  const r = await fetch(u, { headers: { Referer: 'https://blog.naver.com/' }, cf: { cacheTtl: 86400, cacheEverything: true } });
  return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'image/png', 'cache-control': 'public, max-age=86400' } });
}

// 카카오톡·네이버·인스타 등 인앱 브라우저 → 기본 브라우저로
const INAPP = /KAKAOTALK|NAVER\(inapp|FBAN|FBAV|Instagram|DaumApps|everytimeApp|BAND\/|Line\/|; wv\)/i;
const ESCAPE = `<script>(function(){var ua=navigator.userAgent,u=location.href;
if(/KAKAOTALK/i.test(ua)){location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(u);return}
if(/Line\\//i.test(ua)){if(!/openExternalBrowser=1/.test(u))location.replace(u+(u.indexOf('?')<0?'?':'&')+'openExternalBrowser=1');return}
if(/Android/i.test(ua)){location.href='intent://'+u.replace(/^https?:\\/\\//,'')+'#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(u)+';end';return}
document.addEventListener('DOMContentLoaded',function(){var d=document.createElement('div');d.setAttribute('style','position:fixed;inset:0;z-index:2147483647;background:rgba(28,35,27,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;font-family:-apple-system,sans-serif');
d.innerHTML='<div style="width:100%;max-width:420px;background:#fffdf8;border-radius:22px;padding:24px 20px 18px;text-align:center;color:#1c231b"><b style="font-size:18px">Safari에서 열어 주세요</b><p style="margin:8px 0 16px;font-size:14.5px;line-height:1.55;color:#555">앱 안 브라우저에서는 구글 로그인이 막혀요.<br>오른쪽 아래(또는 위) <b>···</b> 메뉴에서<br><b>Safari로 열기</b>를 눌러 주세요.</p><button id="hsCopy" style="width:100%;height:48px;border:0;border-radius:14px;background:#1c231b;color:#fff;font-size:15px;font-weight:600">주소 복사하기</button><button id="hsClose" style="margin-top:8px;width:100%;height:40px;border:0;background:none;color:#888;font-size:14px">그냥 볼게요</button></div>';
document.body.appendChild(d);document.getElementById('hsCopy').onclick=function(){try{navigator.clipboard.writeText(u);this.textContent='복사했어요. Safari 주소창에 붙여 넣어 주세요'}catch(e){prompt('주소를 복사해 주세요',u)}};document.getElementById('hsClose').onclick=function(){d.remove()}})})();</script>`;
export default {
  async fetch(req, env, ctx) {
    const res = await route(req, env, ctx);
    const ua = req.headers.get('user-agent') || '';
    if (INAPP.test(ua) && (res.headers.get('content-type') || '').includes('text/html')) {
      return new HTMLRewriter().on('head', { element(e) { e.prepend(ESCAPE, { html: true }); } }).transform(res);
    }
    return res;
  },
};
async function route(req, env, ctx) {
  {
    const url = new URL(req.url);
    const host = url.hostname;
    if (url.pathname === '/api/tester' && req.method === 'POST') return signup(req, env, ctx);
    if (url.pathname === '/api/analyze') return analyze(url, env);
    if (url.pathname === '/api/top') return top(url, env);
    if (url.pathname === '/api/skin') return skin(url, env);
    if (url.pathname === '/api/img') return imgProxy(url);
    if (url.pathname.startsWith('/auth/')) { const r = await handleAuth(req, env, url); if (r) return r; }
    if (url.pathname === '/api/me' || url.pathname === '/api/state' || url.pathname === '/api/me/delete') { const r = await handleMe(req, env, url); if (r) return r; }
    if (host === 'www.hugissiat.com') return Response.redirect('https://hugissiat.com' + url.pathname + url.search, 301);
    if (host === 'app.hugissiat.com') {
      // 앱 소개: /app 아래 파일. 개인정보처리방침은 공통
      if (/^\/privacy(\.html)?$/.test(url.pathname)) return env.ASSETS.fetch(req);
      const u2 = new URL(req.url); u2.pathname = '/app' + (url.pathname === '/' ? '/' : url.pathname);
      return env.ASSETS.fetch(new Request(u2.toString(), req));
    }
    if (url.pathname === '/studio' || url.pathname === '/studio/') {
      const u = await sessionUser(req, env);
      if (!u) return Response.redirect('https://hugissiat.com/?login=need', 302);
      const u2 = new URL(req.url); u2.pathname = '/studio';
      return env.ASSETS.fetch(new Request(u2.toString(), req));
    }
    return env.ASSETS.fetch(req);
  }
}