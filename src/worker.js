// hugissiat.com: 정적 페이지 + 테스터 신청 API
import { EmailMessage } from 'cloudflare:email';

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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/api/tester' && req.method === 'POST') return signup(req, env, ctx);
    if (url.hostname === 'www.hugissiat.com') return Response.redirect('https://hugissiat.com' + url.pathname + url.search, 301);
    return env.ASSETS.fetch(req);
  },
};
