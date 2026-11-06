/* 후기씨앗 글쓰기 설정 스튜디오: 내 블로그 분석 → 글 구성 → 디자인 결 → 설정 파일 */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = window.HS_TEMPLATES, O = window.HS_OPTIONS;
const LS = 'hs-studio-v1';
let ME = null;
const dec = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return t.value; };

let st = load() || { blog: '', tpl: 'food', profiles: {} };
if (!st.mode) st.mode = 'kw';
if (st.profiles.hello_gajajia && !st.myBlog) { delete st.profiles.hello_gajajia; delete st.profiles.event_code; if (!/^kw:/.test(st.blog)) st.blog = ''; }
if (!st.profiles) st.profiles = {};
function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
let _sv = 0;
function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} clearTimeout(_sv); _sv = setTimeout(() => { if (ME) fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(st) }).catch(() => {}); }, 800); }
function prof() { const k = st.blog || '_'; if (!st.profiles[k]) st.profiles[k] = { name: '', design: { ...window.HS_DEFAULT_DESIGN }, ana: null, skip: [] }; return st.profiles[k]; }
function D() { return prof().design; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------- 사진 자리 (실제 사진 대신 부드러운 자리표시) ---------- */
const HUES = [[246, 226, 233], [230, 238, 227], [255, 239, 214], [226, 236, 246], [240, 232, 250]];
let phN = 0;
const FOOD = ["/img/food-1.jpg", "/img/food-3.jpg"];
function ph(label, w = 4, h = 3) {
  if (["food", "compare", "summary"].includes(st.tpl) && !/지도|영수증|메뉴판|간판|외관/.test(label)) return FOOD[(phN++) % FOOD.length];
  const c = HUES[(phN++) % HUES.length], W = 800, H = Math.round(W * h / w);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${c})"/><stop offset="1" stop-color="rgb(${c.map(v => Math.max(0, v - 18))})"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g transform="translate(${W / 2 - 34},${H / 2 - 46})" fill="none" stroke="rgba(60,60,60,.35)" stroke-width="5"><rect x="0" y="12" width="68" height="50" rx="10"/><circle cx="34" cy="37" r="13"/><path d="M22 12l6-10h12l6 10"/></g><text x="50%" y="${H / 2 + 42}" text-anchor="middle" font-family="sans-serif" font-size="30" fill="rgba(60,60,60,.55)">${esc(label)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------- 네이버 스마트에디터 마크업 ---------- */
function span(text, d, o = {}) {
  const base = o.color || d.textColor || '#000000';
  const hl = x => d.hlMode === 'solid' ? `<span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:#ffffff;background-color:${d.solid || '#1a1915'};"><b>${x}</b></span>` : `<span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:${base};background-color:${d.highlight};">${x}</span>`;
  const acc = x => `</span><span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:${d.subColor || '#222222'};"><b>${x}</b></span><span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:${base};">`;
  let html = esc(text).replace(/\[\[(.+?)\]\]/g, (m, x) => o.plain ? x : acc(x)).replace(/==(.+?)==/g, (m, x) => (d.hlMode === 'solid' || d.highlight) ? `</span>${hl(x)}<span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:${base};">` : x);
  if (o.bold) html = `<b>${html}</b>`;
  return `<span class="se-fs-${o.fs || d.size} se-ff-${d.font}" style="color:${base};">${html}</span>`;
}
function para(text, d, o = {}) { return `<p class="se-text-paragraph se-text-paragraph-align-${o.align || d.align}" style="line-height:${d.lh};">${span(text, d, o)}</p>`; }
const wrap = (cls, inner, src) => `<div class="se-component ${cls}">${src ? `<span class="src">${esc(src)}</span>` : ''}<div class="se-component-content">${inner}</div></div>`;

const blank = d => `<p class="se-text-paragraph se-text-paragraph-align-${d.align}" style="line-height:${d.lh};"><span class="se-fs-${d.size}">&#8203;</span></p>`;
function seText(lines, d, src) {
  let ps;
  if (d.short) { ps = ''; lines.forEach((l, i) => { if (i && i % 3 === 0) ps += blank(d); ps += para(l, d); }); }
  else { const chunks = []; for (let i = 0; i < lines.length; i += 3) chunks.push(lines.slice(i, i + 3).join(' ')); ps = chunks.map(c => para(c, d)).join(blank(d)); }
  return wrap('se-text se-l-default', `<div class="se-section se-section-text se-l-default"><div class="se-module se-module-text">${ps}</div></div>`, src);
}
function seQuote(lines, layout, d, o = {}, src) {
  const ps = (Array.isArray(lines) ? lines : [lines]).map((l, i) => `<p class="se-text-paragraph se-text-paragraph-align-">${span(l, d, { fs: o.fs || '', bold: o.boldFirst && i === 0, color: o.color })}</p>`).join('');
  return wrap(`se-quotation se-l-${layout}`, `<div class="se-section se-section-quotation se-l-${layout}"><blockquote class="se-quotation-container"><div class="se-module se-module-text se-quote">${ps}</div></blockquote></div>`, src);
}
function seSub(text, d, src) {
  if (d.sub === 'quote') return seQuote(text, d.subQuote, d, { fs: d.subSize, color: d.subColor }, src);
  if (d.sub === 'section') return wrap('se-sectionTitle se-l-default', `<div class="se-section se-section-sectionTitle se-l-default"><div class="se-module se-module-text"><p class="se-text-paragraph se-text-paragraph-align-${d.align}">${span(text, d, { fs: d.subSize, bold: true, color: d.subColor })}</p></div></div>`, src);
  return wrap('se-text se-l-default', `<div class="se-section se-section-text se-l-default"><div class="se-module se-module-text">${para(text, d, { fs: 'fs19', bold: true, color: d.subColor })}</div></div>`, src);
}
function seLine(d) { return wrap(`se-horizontalLine se-l-${d.line}`, `<div class="se-section se-section-horizontalLine se-l-${d.line} se-section-align-center"><div class="se-module se-module-horizontalLine"><hr class="se-hr"></div></div>`); }
function seImage(label, src) { return wrap('se-image se-l-default', `<div class="se-section se-section-image se-l-default se-section-align-"><div class="se-module se-module-image"><img class="se-image-resource ph" src="${ph(label)}" alt=""></div></div>`, src); }
function seStrip(labels, src) {
  const n = labels.length, w = (100 / n).toFixed(1);
  const mods = labels.map(l => `<div class="se-module se-module-image" style="width:${w}%;"><img class="se-image-resource ph" src="${ph(l, 1, 1)}" alt=""></div>`).join('');
  return `<div class="se-component se-imageStrip se-imageStrip${n} se-l-default">${src ? `<span class="src">${esc(src)}</span>` : ''}<div class="se-component-content se-component-content-extend"><div class="se-section se-section-imageStrip se-l-default"><div class="se-imageStrip-container se-imageStrip-col-${n}">${mods}</div></div></div></div>`;
}
function sePlace(b, src) { return wrap('se-placesMap se-l-map_text', `<div class="se-section se-section-placesMap se-section-align-center se-l-map_text"><div class="se-module se-module-map-text"><a class="se-map-info"><div class="se-map-marker"></div><strong class="se-map-title">${esc(b.name)}</strong><p class="se-map-address">${esc(b.addr)}</p></a></div></div>`, src); }
function seTable(rows, d, src, o = {}) {
  const head = o.head != null ? o.head : rows.length > 2 && rows[0].every(c => c.length <= 8) && rows[0][0] !== '위치';
  const H = d.tableHead || '#333333', C = d.tableCol || '#f4f4f4';
  const tr = rows.map((r, i) => `<tr class="se-tr">${r.map((c, j) => {
    const isH = head && i === 0, isC = !isH && j === 0;
    const bg = isH ? H : isC ? C : '';
    const fg = isH ? (isDark(H) ? '#ffffff' : '#222222') : isC ? (isDark(C) ? '#ffffff' : (d.textColor || '#444444')) : (d.textColor || '#444444');
    return `<td class="se-cell" style="width:${j === 0 && r.length === 2 ? '32' : (100 / r.length).toFixed(1)}%;height:40px;border:none;padding:9px 12px;${bg ? 'background-color:' + bg + ';' : ''}"><div class="se-module se-module-text"><p class="se-text-paragraph se-text-paragraph-align-left" style="line-height:1.6;">${span(c, { ...d, size: 'fs15' }, { bold: isH || isC, color: fg, plain: true })}</p></div></td>`;
  }).join('')}</tr>`).join('');
  return wrap('se-table se-l-default', `<div class="se-section se-section-table se-l-default se-section-align-center" style="width:100%;"><div class="se-table-container"><table class="se-table-content" style="border:none;"><tbody>${tr}</tbody></table></div></div>`, src);
}
const isDark = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140; };
function seBox(lines, d, src) {
  const fg = isDark(d.boxFill) ? '#ffffff' : '#000000';
  const ps = lines.map((l, i) => `<p class="se-text-paragraph se-text-paragraph-align-left" style="line-height:1.9;"><span class="se-fs-fs15 se-ff-${d.font}" style="color:${fg};background-color:${d.boxFill};">${i === 0 ? '<b>' + esc(l) + '</b>' : esc(l)}</span></p>`).join('');
  return wrap('se-table se-l-default', `<div class="se-section se-section-table se-l-default se-section-align-center" style="width:100%;"><div class="se-table-container"><table class="se-table-content" style="border:none;"><tbody><tr class="se-tr"><td class="se-cell" style="width:100%;padding:16px 18px;border:none;background-color:${d.boxFill};"><div class="se-module se-module-text">${ps}</div></td></tr></tbody></table></div></div>`, src);
}
function seSticker() { return `<div class="se-component se-sticker se-l-default"><div class="hs-sticker"><span>🌱</span></div></div>`; }
function seLink(b, src) { return wrap('se-oglink se-l-default', `<div class="hs-link"><i></i><div><b>${esc(b.title)}</b><small>smartstore.naver.com</small></div></div>`, src); }

function renderDoc() {
  phN = 0;
  const d = D(), tpl = T.find(t => t.id === st.tpl) || T[0];
  const out = [];
  let firstText = true, hl = 0;
  if (d.notice === 'top') out.push(seText([d.noticeText], { ...d, size: 'fs13' }, '대가 표기'));
  for (const b of tpl.blocks) {
    if (b.t === 'image') out.push(seImage(b.label, b.src));
    else if (b.t === 'strip') {
      if (d.photo === 'single') b.labels.forEach((l, i) => out.push(seImage(l, i ? '' : b.src)));
      else out.push(seStrip(b.labels, b.src));
    }
    else if (b.t === 'text') {
      let lines = b.lines.slice();
      firstText = false;
      out.push(seText(lines, d, b.src));
    }
    else if (b.t === 'sub') out.push(seSub(b.text, d, b.src));
    else if (b.t === 'quote') out.push(seQuote(b.text, d.quote, d, {}, b.src));
    else if (b.t === 'line') { if (d.line !== 'none') out.push(seLine(d)); }
    else if (b.t === 'place') out.push(sePlace(b, b.src));
    else if (b.t === 'info') out.push(seTable(b.lines.map(l => { const m = l.replace(/^[^가-힣A-Za-z0-9]+\s*/, '').split(/:\s*/); return [m[0], m.slice(1).join(': ')]; }), d, b.src, { head: false }));
    else if (b.t === 'table') out.push(seTable(b.rows, d, b.src));
    else if (b.t === 'sticker') { if (d.sticker) out.push(seSticker()); }
    else if (b.t === 'link') out.push(seLink(b, b.src));
    else if (b.t === 'notice') { if (d.notice === 'bottom') out.push(seText([d.noticeText], { ...d, size: 'fs13' }, '대가 표기')); }
  }
  if (d.sticker && tpl.id !== 'product') out.splice(Math.min(out.length, out.length - 1), 0, seSticker());
  $('#doc').innerHTML = out.join('');
  $('#docTitle').innerHTML = `<span style="font-family:${fontCss(d.font)}">${esc(TITLES[tpl.id] || tpl.name)}</span>`;
}
const TITLES = { food: '용산 한정식, 소담 엄마랑 조용히 먹은 정식', kids: '의정부 키즈카페, 하늘마루 비 오는 날 다녀온 후기', stay: '양양 펜션, 솔바람 바다 보이는 독채 1박', product: '걸음마신발, 고민하다 신겨 본 돌아기 첫 신발', summary: '용산역 한정식 소담, 처음 가는 분들을 위한 정리', compare: '용산 이자카야 도하, 시킨 메뉴 3가지 비교' };
const FONT_CSS = { system: '-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif', nanumgothic: '"NanumGothic",sans-serif', nanummyeongjo: '"NanumMyeongjo",serif', nanumbarungothic: '"NanumBarunGothic",sans-serif', nanumsquare: '"NanumSquare",sans-serif', nanummaruburi: '"MaruBuri",serif', pretendard: 'Pretendard,sans-serif' };
const fontCss = f => FONT_CSS[f] || FONT_CSS.system;

/* ---------- 스마트에디터 툴바 ---------- */
const ICON = {
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
  sticker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 7H6a2 2 0 0 0-2 2v4h4v4l3-4V8a1 1 0 0 0-1-1zm9 0h-4a2 2 0 0 0-2 2v4h4v4l3-4V8a1 1 0 0 0-1-1z"/></svg>',
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h18"/><path d="M7 8h10M7 16h10" opacity=".35"/></svg>',
  place: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M3 15h18M9 5v14M15 5v14"/></svg>',
  font: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 19L11 5h2l6 14M8 14h8"/></svg>',
  align: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>'
};
function renderBar() {
  if (!$('#seBar')) return;
  const d = D();
  const tools = [['photo', '사진', 'photo'], ['video', '동영상'], ['sticker', '스티커', 'sticker'], '|', ['quote', '인용구', 'quote', true], ['line', '구분선', 'line', true], ['place', '장소'], ['link', '링크'], ['table', '표'], '|', ['font', fontName(d.font), 'font', true], ['align', d.align === 'center' ? '가운데' : '왼쪽', 'align']];
  $('#seBar').innerHTML = tools.map(t => t === '|' ? '<span class="se-sep"></span>' : `<button type="button" class="se-tool${t[2] === 'sticker' && d.sticker ? ' on' : ''}" data-k="${t[2] || ''}">${ICON[t[0]]}<span>${t[1]}${t[3] ? '<span class="dd">▾</span>' : ''}</span></button>`).join('');
  $('#seBar').querySelectorAll('.se-tool').forEach(b => b.onclick = e => barAction(b.dataset.k, b));
}
const fontName = f => (O.fonts.find(x => x[0] === f) || ['', '기본서체'])[1];
function barAction(k, el) {
  const d = D();
  if (k === 'sticker') { d.sticker = !d.sticker; changed(); return; }
  if (k === 'align') { d.align = d.align === 'center' ? 'left' : 'center'; changed(); return; }
  if (k === 'photo') { d.photo = d.photo === 'strip' ? 'single' : 'strip'; changed(); toast(d.photo === 'strip' ? '사진 2~3장 묶어서' : '사진 한 장씩'); return; }
  if (k === 'quote') return popQuote(el);
  if (k === 'line') return popLine(el);
  if (k === 'font') return popFont(el);
}
function openPop(el, html, bind) {
  const p = $('#pop'); p.innerHTML = html; p.hidden = false;
  const r = el.getBoundingClientRect(); p.style.left = Math.min(window.innerWidth - 270, Math.max(8, r.left)) + 'px'; p.style.top = (r.bottom + 6) + 'px';
  bind(p);
  setTimeout(() => document.addEventListener('click', closePop, { once: true }), 0);
}
function closePop(e) { const p = $('#pop'); if (e && p.contains(e.target)) { document.addEventListener('click', closePop, { once: true }); return; } p.hidden = true; }
function popQuote(el) {
  const d = D();
  const sample = l => `<div class="se-viewer se-theme-default pv">${seQuote('소제목 예시', l, { ...d, size: 'fs16' }, { fs: 'fs16' })}</div>`;
  openPop(el, `<div class="t">소제목에 쓸 인용구</div>` + O.quotes.map(([k, n]) => `<button type="button" data-q="${k}" class="${d.sub === 'quote' && d.subQuote === k ? 'on' : ''}"><div class="t">${n}</div>${sample(k)}</button>`).join(''), p => {
    p.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { d.sub = 'quote'; d.subQuote = b.dataset.q; p.hidden = true; changed(); });
  });
}
function popLine(el) {
  const d = D();
  openPop(el, `<div class="t">구분선</div>` + O.lines.map(([k, n]) => `<button type="button" data-l="${k}" class="${d.line === k ? 'on' : ''}"><div class="t">${n}</div><div class="se-viewer se-theme-default pv">${seLine({ ...d, line: k })}</div></button>`).join('') + `<button type="button" data-l="none" class="${d.line === 'none' ? 'on' : ''}"><div class="t">안 씀</div></button>`, p => {
    p.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { d.line = b.dataset.l; p.hidden = true; changed(); });
  });
}
function popFont(el) {
  const d = D();
  openPop(el, O.fonts.map(([k, n]) => `<button type="button" data-f="${k}" class="${d.font === k ? 'on' : ''}" style="font-family:${fontCss(k)};font-size:15px">${n}</button>`).join(''), p => {
    p.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { d.font = b.dataset.f; p.hidden = true; changed(); });
  });
}

/* ---------- 오른쪽 디자인 패널 ---------- */
function seg(key, opts, label) {
  const d = D();
  return `<div class="row"><label>${label}</label><div class="seg" data-key="${key}">${opts.map(([v, n]) => `<button type="button" data-v="${v}" class="${String(d[key]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
}
function sw(key, colors, label, allowNone) {
  const d = D();
  return `<div class="row"><label>${label}</label><div class="sw" data-key="${key}">${colors.map(c => `<button type="button" data-v="${c}" class="${c ? '' : 'none'}${String(d[key] || '') === c ? ' on' : ''}" style="${c ? 'background:' + c : ''}" title="${c || '안 씀'}"></button>`).join('')}<input type="color" class="cpick" data-ck="${key}" value="${/^#[0-9a-f]{6}$/i.test(d[key] || '') ? d[key] : '#888888'}" title="직접 고르기"></div></div>`;
}
let openRow = '';
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const dot = c => c ? `<i style="background:${c}"></i>` : '';
function swRaw(key, colors) {
  const d = D();
  return `<div class="sw" data-key="${key}">${colors.map(c => `<button type="button" data-v="${c}" class="${c ? '' : 'none'}${String(d[key] || '') === c ? ' on' : ''}" style="${c ? 'background:' + c : ''}" title="${c || '안 씀'}"></button>`).join('')}<input type="color" class="cpick" data-ck="${key}" value="${/^#[0-9a-f]{6}$/i.test(d[key] || '') ? d[key] : '#888888'}" title="직접 고르기"></div>`;
}
const segRaw = (key, opts) => { const d = D(); return `<div class="seg" data-key="${key}">${opts.map(([v, n]) => `<button type="button" data-v="${v}" class="${String(d[key]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`; };
function quoteGrid(cur, key, extra = []) {
  const d = D();
  const pv = l => `<div class="se-viewer se-theme-default pv">${seQuote('소제목 예시', l, { ...d, size: 'fs16' }, { fs: 'fs16' })}</div>`;
  return `<div class="qgrid">${O.quotes.map(([k, n]) => `<button type="button" data-${key}="${k}" class="${cur === k ? 'on' : ''}"><div class="t">${n}</div>${pv(k)}</button>`).join('')}${extra.join('')}</div>`;
}
function designRows() {
  const d = D();
  const subVal = d.sub === 'quote' ? '인용구 · ' + qName(d.subQuote) : d.sub === 'section' ? '소제목 칸' : '굵은 글씨';
  const sizeName = (O.sizes.find(x => x[0] === d.size) || [0, d.size])[1];
  return [
    ['글자', [
      ['font', '글꼴', fontName(d.font), () => `<div class="flist">${O.fonts.map(([k, n]) => `<button type="button" data-f="${k}" class="${d.font === k ? 'on' : ''}" style="font-family:${fontCss(k)}">${n}</button>`).join('')}</div>`],
      ['size', '본문 크기', sizeName, () => segRaw('size', O.sizes)],
      ['align', '정렬', d.align === 'center' ? '가운데' : '왼쪽', () => segRaw('align', [['center', '가운데'], ['left', '왼쪽']])],
      ['short', '줄 나눔', d.short ? '한 줄씩 끊기' : '문단으로', () => segRaw('short', [[true, '한 줄씩 끊기'], [false, '문단으로']])],
    ]],
    ['꾸밈', [
      ['sub', '소제목', subVal, () => quoteGrid(d.sub === 'quote' ? d.subQuote : '', 'q', [`<button type="button" data-subm="section" class="${d.sub === 'section' ? 'on' : ''}"><div class="t">소제목 칸</div></button>`, `<button type="button" data-subm="bold" class="${d.sub === 'bold' ? 'on' : ''}"><div class="t">굵은 글씨</div></button>`])],
      ['quote', '강조 한 문장', qName(d.quote), () => quoteGrid(d.quote, 'eq')],
      ['line', '구분선', lName(d.line), () => `<div class="qgrid">${O.lines.map(([k, n]) => `<button type="button" data-l="${k}" class="${d.line === k ? 'on' : ''}"><div class="t">${n}</div><div class="se-viewer se-theme-default pv">${seLine({ ...d, line: k })}</div></button>`).join('')}<button type="button" data-l="none" class="${d.line === 'none' ? 'on' : ''}"><div class="t">안 씀</div></button></div>`],
      ['photo', '사진', d.photo === 'strip' ? '2~3장 묶기' : '한 장씩', () => segRaw('photo', [['strip', '2~3장 묶기'], ['single', '한 장씩']])],
      ['sticker', '스티커', d.sticker ? '써요' : '안 써요', () => segRaw('sticker', [[true, '써요'], [false, '안 써요']])],
    ]],
    ['색', [
      ['mycolor', '내 블로그 색', st.palette ? (st.palette.name || st.palette.blog) : '맞추기', () => '<div class="mycolor" id="myColor"></div>'],
      ['subColor', '포인트 글자색', dot(d.subColor) + (d.subColor || '#000000'), () => swRaw('subColor', O.textColors)],
      ['hl', '강조', dot(d.hlMode === 'solid' ? d.solid : d.highlight) + (d.hlMode === 'solid' ? '진한 배경' : (d.highlight ? '형광펜' : '안 씀')), () => segRaw('hlMode', [['mark', '형광펜'], ['solid', '진한 배경']]) + '<div style="height:10px"></div>' + (d.hlMode === 'solid' ? swRaw('solid', O.solids) : swRaw('highlight', O.highlights))],
      ['table', '표 색', dot(d.tableHead) + dot(d.tableCol) + '머리 · 첫 칸', () => '<div class="mut" style="margin:0 0 6px">머리 줄</div>' + swRaw('tableHead', [...O.solids, ...O.boxes]) + '<div class="mut" style="margin:12px 0 6px">첫 칸</div>' + swRaw('tableCol', [...O.boxes, '#ffffff'])],
      ['textColor', '본문 글자색', dot(d.textColor) + (d.textColor || '#000000'), () => swRaw('textColor', O.textColors)],
    ]],
    ['대가 표기', [
      ['notice', '위치', { top: '맨 위', bottom: '맨 아래', none: '안 넣음' }[d.notice], () => segRaw('notice', [['top', '맨 위'], ['bottom', '맨 아래'], ['none', '안 넣음']])],
      ['noticeText', '문구', d.notice === 'none' ? '-' : '수정', () => `<textarea data-text="noticeText">${esc(d.noticeText)}</textarea>`],
    ]],
  ];
}
function renderDesign() {
  const d = D();
  $('#design').innerHTML = designRows().map(([g, rows]) => `<div class="dgrp"><div class="gt">${g}</div>${rows.map(([k, label, val, pick]) => `<button type="button" class="opt${openRow === k ? ' open' : ''}" data-row="${k}"><span>${label}</span><em>${val}</em>${CHEV}</button>${openRow === k ? `<div class="pick">${pick()}</div>` : ''}`).join('')}</div>`).join('');
  const box = $('#design');
  box.querySelectorAll('.opt').forEach(b => b.onclick = () => { openRow = openRow === b.dataset.row ? '' : b.dataset.row; renderDesign(); });
  box.querySelectorAll('.seg,.sw').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; d[g.dataset.key] = v; changed(); }));
  box.querySelectorAll('.cpick').forEach(c => c.oninput = () => { d[c.dataset.ck] = c.value; save(); renderDoc(); });
  box.querySelectorAll('[data-text]').forEach(t => t.oninput = () => { d[t.dataset.text] = t.value; save(); renderDoc(); });
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { d.font = b.dataset.f; changed(); });
  box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { d.sub = 'quote'; d.subQuote = b.dataset.q; changed(); });
  box.querySelectorAll('[data-subm]').forEach(b => b.onclick = () => { d.sub = b.dataset.subm; changed(); });
  box.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { d.quote = b.dataset.eq; changed(); });
  box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { d.line = b.dataset.l; changed(); });
  const a = prof().ana;
  $('#designFrom').textContent = a ? (/^kw:/.test(st.blog) ? st.blog.slice(3) + ' 상위 글 기준' : (prof().name || st.blog) + ' 기준') : '';
  if ($('#myColor')) renderMyColor();
}
// 단계 탭
let step = 'src';
function goStep(k) {
  step = k;
  document.querySelectorAll('#steps button').forEach(b => b.classList.toggle('on', b.dataset.step === k));
  document.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane !== k);
  $('.panel').scrollTop = 0;
}
document.querySelectorAll('#steps button').forEach(b => b.onclick = () => goStep(b.dataset.step));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goStep(b.dataset.go));
// 미리보기에서 블록을 누르면 그 설정으로
$('#doc').addEventListener('click', e => {
  const c = e.target.closest('.se-component'); if (!c) return;
  const cl = c.className;
  const k = /se-quotation/.test(cl) ? (/sub/.test(c.dataset.k || '') ? 'sub' : 'sub') : /horizontalLine/.test(cl) ? 'line' : /imageStrip|se-image/.test(cl) ? 'photo' : /se-table/.test(cl) ? 'table' : /sticker/.test(cl) ? 'sticker' : /se-text/.test(cl) ? 'font' : '';
  if (!k) return; openRow = k; goStep('design'); renderDesign();
  const row = document.querySelector('[data-row="' + k + '"]'); if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

/* ---------- 내 블로그 색 ---------- */
const MILD = { textColor: '#444444', subColor: '#222222', hlMode: 'mark', highlight: '#fff3b0', solid: '#333333', tableHead: '#333333', tableCol: '#f4f4f4' };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (h, w, t) => { const a = rgb(h), b = rgb(w); return hx(a.map((v, i) => v + (b[i] - v) * t)); };
function hsl(h) { const [r, g, b] = rgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; const s = mx === mn ? 0 : (l > .5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn)); return { s, l }; }
const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const darkFor = (h, need) => { let c = h, i = 0; while ((1.05) / (lum(c) + .05) < need && i++ < 20) c = mix(c, '#000000', .08); return c; };
async function imgColors(url) {
  if (!url) return [];
  return new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try {
      const cv = document.createElement('canvas'); const W = 80, H = Math.max(8, Math.round(80 * im.height / im.width)); cv.width = W; cv.height = H;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0, W, H); const px = x.getImageData(0, 0, W, H).data; const bin = {};
      for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 200) continue; const k = (px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4); const b = bin[k] || (bin[k] = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2]; }
      res(Object.values(bin).sort((a, b) => b.n - a.n).slice(0, 12).map(b => ({ c: hx([b.r / b.n, b.g / b.n, b.b / b.n]), n: b.n })));
    } catch (e) { res([]); } };
    im.onerror = () => res([]); im.src = '/api/img?u=' + encodeURIComponent(url);
  });
}
function pickPalette(sk, cols) {
  const cand = [sk.menuOn, ...cols.map(c => c.c)].filter(Boolean);
  const accent = cand.find(c => { const { s, l } = hsl(c); return s >= .22 && l >= .22 && l <= .78; });
  if (!accent) return { ...MILD, _src: 'mild' };
  const pageBg = [sk.postBg, sk.bg].find(c => c && c !== '#ffffff' && hsl(c).l > .9);
  const t = sk.title && hsl(sk.title).l < .2 ? sk.title : '#000000';
  return { textColor: t, subColor: darkFor(accent, 3.2), hlMode: 'mark', highlight: mix(accent, '#ffffff', .75), solid: darkFor(accent, 4.5), tableHead: darkFor(accent, 4.5), tableCol: pageBg || mix(accent, '#ffffff', .9), _src: 'skin', _accent: accent };
}
const GREENS = ['#00c73c', '#2cae0c', '#03c75a', '#2db400', '#ffffff'];
function postPalette(posts) {
  const cnt = f => { const o = {}; posts.forEach(p => Object.entries(p[f] || {}).forEach(([k, v]) => o[k] = (o[k] || 0) + v)); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(x => x[0]).filter(c => !GREENS.includes(c)); };
  const cols = cnt('colors'), hls = cnt('highlights'), th = cnt('tableHead'), tc = cnt('tableCol');
  const o = {};
  const neutral = cols.find(c => hsl(c).s < .25 && hsl(c).l < .65); if (neutral) o.textColor = neutral;
  const acc = cols.find(c => hsl(c).s >= .3 && hsl(c).l > .2 && hsl(c).l < .75); if (acc) o.subColor = acc;
  const light = hls.find(c => hsl(c).l > .8); if (light) { o.hlMode = 'mark'; o.highlight = light; }
  const dark = hls.find(c => hsl(c).l < .3); if (dark) o.solid = dark;
  if (th[0]) o.tableHead = th[0]; else if (dark) o.tableHead = dark;
  if (tc[0]) o.tableCol = tc[0]; else { const l2 = hls.filter(c => hsl(c).l > .8)[1]; if (l2) o.tableCol = l2; }
  return o;
}
function paletteDesign() { const p = st.palette && st.palette.colors || MILD; const o = {}; Object.keys(MILD).forEach(k => o[k] = p[k] || MILD[k]); return o; }
async function loadMyColor(id, guess) {
  if ($('#myColor')) $('#myColor').innerHTML = '<div class="load"><i></i>내 블로그 스킨을 보는 중…</div>';
  try {
    const [a, j] = await Promise.all([fetch('/api/analyze?blog=' + encodeURIComponent(id) + '&n=12&kind=all').then(r => r.json()), fetch('/api/skin?blog=' + encodeURIComponent(id)).then(r => r.json())]);
    if (!a.ok || !a.posts || !a.posts.length) throw new Error('블로그를 찾지 못했어요. 내 블로그 주소를 넣어 주세요.');
    const cols = j.ok ? [...await imgColors(j.headImg), ...await imgColors(j.bgImg)] : [];
    const base = j.ok ? pickPalette(j, cols) : { ...MILD, _src: 'mild' };
    const fromPosts = postPalette(a.posts);
    const colors = { ...base, ...fromPosts, _src: Object.keys(fromPosts).length ? 'posts' : base._src };
    st.myBlog = id; st.palette = { v: 2, blog: id, name: a.name || (j.ok && j.name) || id, headImg: j.ok ? j.headImg : '', colors };
    Object.values(st.profiles).forEach(p => { if (p.design) Object.assign(p.design, paletteDesign()); });
    save(); changed(); toast(st.palette.colors._src === 'mild' ? '눈에 띄는 색이 없어 무난한 색으로 했어요' : '내 블로그 색을 맞췄어요');
  } catch (e) { if (guess) { renderMyColor(); return; } if ($('#myColor')) $('#myColor').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; setTimeout(renderMyColor, 2500); }
}
function renderMyColor() {
  const el = $('#myColor'); if (!el) return;
  const p = st.palette;
  if (!p) {
    el.innerHTML = '<div class="lb">색은 내 블로그에 맞추기</div><form class="r" id="mcForm"><input id="mcId" placeholder="내 블로그 주소 (blog.naver.com/...)" value=""><button>맞추기</button></form>';
    $('#mcForm').onsubmit = e => { e.preventDefault(); const v = $('#mcId').value.trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//, '').split(/[/?#]/)[0]; if (v) loadMyColor(v); };
    return;
  }
  const c = p.colors;
  el.innerHTML = '<div class="lb">' + esc(p.name || p.blog) + ' 색 <a href="#" id="mcRe">바꾸기</a></div>' + (p.headImg ? '<div class="hd" style="background-image:url(/api/img?u=' + encodeURIComponent(p.headImg) + ')"></div>' : '') + '<div class="dots">' + [c.textColor, c.subColor, c.highlight, c.tableHead, c.tableCol].map(x => '<i style="background:' + x + '"></i>').join('') + '<span>' + (c._src === 'posts' ? '내 글에서 뽑은 색' : c._src === 'skin' ? '스킨에서 뽑은 색' : '무난한 기본색') + '</span></div>';
  $('#mcRe').onclick = e => { e.preventDefault(); st.palette = null; save(); renderMyColor(); };
}

/* ---------- 왼쪽: 블로그·분석·구성 ---------- */
function renderBlogs() {
  const have = Object.keys(st.profiles).filter(k => k !== '_' && st.profiles[k].ana);
  const list = have.map(id => [id, /^kw:/.test(id) ? '🔍 ' + id.slice(3) : (st.profiles[id].name || id)]);
  $('#blogs').hidden = !list.length;
  $('#blogs').innerHTML = list.map(([id, n]) => `<button type="button" data-b="${id}" class="${st.blog === id ? 'on' : ''}">${esc(n)}</button>`).join('');
  $('#blogs').querySelectorAll('button').forEach(b => b.onclick = () => selectBlog(b.dataset.b));
}
function selectBlog(id) {
  st.blog = id; save();
  const p = prof();
  if (!p.ana) analyze(id); else { renderAll(); }
}
async function analyze(id, fresh) {
  st.blog = id; const p = prof(); save(); renderBlogs();
  const isKw = /^kw:/.test(id);
  $('#anaBox').innerHTML = `<div class="load"><i></i>${isKw ? '네이버 블로그 검색 상위 글을 읽는 중… (20~30초)' : '최근 글을 읽는 중… (10~20초)'}</div>`;
  try {
    const r = await fetch(isKw ? `/api/top?q=${encodeURIComponent(id.slice(3))}${fresh ? '&fresh=1' : ''}` : `/api/analyze?blog=${encodeURIComponent(id)}&n=8&kind=${$('#reviewOnly').checked ? 'review' : 'all'}${fresh ? '&fresh=1' : ''}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '불러오지 못했어요');
    if (!j.posts.length) throw new Error($('#reviewOnly').checked ? '사진 많은 후기 글을 못 찾았어요. 체크를 풀고 다시 해 보세요.' : '공개 글이 없어요');
    p.name = j.name || id; p.ana = j; p.skip = [];
    p.design = { ...window.HS_DEFAULT_DESIGN, ...designFrom(j.posts), ...paletteDesign(), noticeText: p.design.noticeText };
    save(); renderAll(); toast('디자인 결을 읽어왔어요');
  } catch (e) { $('#anaBox').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
const top = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
function sum(posts, f) { const o = {}; posts.forEach(p => Object.entries(p[f] || {}).forEach(([k, v]) => o[k] = (o[k] || 0) + v)); return o; }
function usedPosts() { const p = prof(); return (p.ana ? p.ana.posts : []).filter(x => !(p.skip || []).includes(x.logNo)); }
function designFrom(posts) {
  if (!posts.length) return {};
  const d = {};
  const al = sum(posts, 'align'); d.align = (al.center || 0) >= (al.left || 0) ? 'center' : 'left';
  const ff = top(sum(posts, 'fonts'))[0]; d.font = ff ? ff[0] : 'system';
  const fs = top(sum(posts, 'sizes')).filter(([k]) => ['fs13', 'fs15', 'fs16', 'fs19'].includes(k))[0]; d.size = fs ? fs[0] : 'fs15';
  const lh = top(sum(posts, 'lineHeights')).filter(([k]) => parseFloat(k) <= 4)[0]; d.lh = lh ? lh[0] : '1.8';
  const big = top(sum(posts, 'sizes')).filter(([k]) => /fs(2[4-9]|3\d)/.test(k))[0]; d.subSize = big ? big[0] : 'fs24';
  const q = top(sum(posts, 'quoteStyles'));
  const sec = posts.reduce((a, p) => a + ((p.comps || {}).sectionTitle || 0), 0);
  const qn = q.reduce((a, x) => a + x[1], 0);
  if (sec > qn / 2 && sec > 0) d.sub = 'section'; else if (qn) d.sub = 'quote'; else d.sub = 'bold';
  if (q[0]) d.subQuote = q[0][0];
  d.quote = q[1] ? q[1][0] : (q[0] ? q[0][0] : 'default');
  d.infoQuote = (q.find(x => x[0] === 'quotation_line') || q[1] || q[0] || ['quotation_line'])[0];
  const ln = top(sum(posts, 'lines'))[0]; d.line = ln ? ln[0] : 'none';
  const rows = posts.reduce((a, p) => { const r = p.imageRows || {}; a.s += r.single || 0; a.m += (r.strip2 || 0) + (r.strip3 || 0); return a; }, { s: 0, m: 0 });
  d.photo = rows.m >= rows.s ? 'strip' : 'single';
  const avg = posts.reduce((a, p) => a + (p.avgParaLen || 0), 0) / posts.length; d.short = avg < 48;
  d.sticker = posts.reduce((a, p) => a + (p.stickers || 0), 0) / posts.length >= 0.8;
  const sp = posts.map(p => p.sponsor).filter(Boolean);
  if (sp.find(s => s.text)) d.noticeText = sp.find(s => s.text).text;
  return d;
}
function renderAna() {
  const p = prof(), a = p.ana;
  if (!a) { if (!st.blog) $('#anaBox').innerHTML = '<div class="mut" style="margin:6px 0 0">블로그를 고르면 최근 글의 구성과 디자인을 읽어와요.</div>'; return; }
  const ps = usedPosts();
  const imgs = ps.length ? Math.round(ps.reduce((x, q) => x + q.images, 0) / ps.length) : 0;
  const chars = ps.length ? Math.round(ps.reduce((x, q) => x + q.textChars, 0) / ps.length) : 0;
  const subs = ps.length ? Math.round(ps.reduce((x, q) => x + Object.values(q.quoteStyles || {}).reduce((a, b) => a + b, 0) + ((q.comps || {}).sectionTitle || 0), 0) / ps.length) : 0;
  const places = ps.filter(q => q.places).length;
  $('#anaBox').innerHTML = `<div class="sum"><div><b>${imgs}장</b><span>글 하나 사진</span></div><div><b>${chars.toLocaleString()}자</b><span>글 하나 길이</span></div><div><b>${subs}개</b><span>소제목·인용구</span></div><div><b>${places}/${ps.length}</b><span>장소 지도 넣은 글</span></div></div>
  <details><summary>읽은 글 ${a.posts.length}개 보기</summary><div class="posts">${a.posts.map(q => `<label><input type="checkbox" data-l="${q.logNo}" ${(p.skip || []).includes(q.logNo) ? '' : 'checked'}><span>${esc(dec(q.title))}<br><small>${q.rank ? `<b class="rk">${q.rank}위</b> ${esc(q.nick || q.blogId)} · ` : esc(q.category ? q.category + ' · ' : '')}사진 ${q.images} · <a href="${q.url}" target="_blank" rel="noopener">원문</a></small></span></label>`).join('')}</div></details>
  <div class="mut" style="margin:8px 0 0"><a href="#" id="reAna" style="color:var(--sage-d)">다시 읽기</a></div>`;
  $('#anaBox').querySelectorAll('[data-l]').forEach(c => c.onchange = () => {
    const s = new Set(p.skip || []); c.checked ? s.delete(c.dataset.l) : s.add(c.dataset.l); p.skip = [...s];
    p.design = { ...p.design, ...designFrom(usedPosts()) }; changed(); renderAna();
  });
  $('#reAna').onclick = e => { e.preventDefault(); analyze(st.blog, true); };
}
function renderTone() {
  const ps = usedPosts();
  if (!ps.length) { $('#toneCard').hidden = true; return; }
  $('#toneCard').hidden = false;
  const en = top(sum(ps, 'endings')).slice(0, 5).map(([k]) => '~' + k).join(', ');
  const laugh = ps.reduce((a, p) => a + p.laugh, 0), emoji = ps.reduce((a, p) => a + p.emoji, 0), ex = ps.reduce((a, p) => a + p.exclam, 0);
  const per = n => (n / ps.length).toFixed(1);
  const avg = Math.round(ps.reduce((a, p) => a + p.avgParaLen, 0) / ps.length);
  const first = (ps.find(p => (p.firstLines || []).length) || {}).firstLines || [];
  $('#tone').innerHTML = `<div class="tone"><dl><dt>끝맺음</dt><dd>${esc(en)}</dd><dt>한 줄 길이</dt><dd>평균 ${avg}자</dd><dt>ㅎㅎ·이모지</dt><dd>글당 ${per(laugh + emoji)}번</dd><dt>느낌표</dt><dd>글당 ${per(ex)}번</dd></dl>${first.length ? `<div class="ex">${first.slice(0, 3).map(esc).join('<br>')}</div>` : ''}<p class="mut" style="margin:8px 0 0">말투는 Aside 스킬이 이 글들을 직접 읽고 맞춰요.</p></div>`;
}
function renderTpls() {
  $('#tpls').innerHTML = T.map(t => `<button type="button" class="tpl${st.tpl === t.id ? ' on' : ''}" data-t="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><span class="tg">${esc(t.tag)}</span></button>`).join('');
  $('#tpls').querySelectorAll('.tpl').forEach(b => b.onclick = () => { st.tpl = b.dataset.t; save(); renderTpls(); renderDoc(); if (window.innerWidth < 900) $('#paper').scrollIntoView({ behavior: 'smooth' }); });
}

/* ---------- 설정 파일 ---------- */
const SUB_NAME = { quote: '인용구', section: '소제목 컴포넌트', bold: '굵은 글씨' };
const qName = k => (O.quotes.find(x => x[0] === k) || [k, k])[1];
const lName = k => k === 'none' ? '안 씀' : (O.lines.find(x => x[0] === k) || [k, k])[1];
function buildProfile() {
  const p = prof(), d = D(), tpl = T.find(t => t.id === st.tpl) || T[0], ps = usedPosts();
  const blk = b => {
    switch (b.t) {
      case 'image': return `사진 1장 (${b.label})`;
      case 'strip': return d.photo === 'strip' ? `사진 ${b.n}장 묶음` : `사진 ${b.n}장 한 장씩`;
      case 'text': return `본문 ${b.lines.length}~${b.lines.length + 1}줄`;
      case 'sub': return `소제목 (예: "${b.text}")`;
      case 'quote': return `강조 한 문장 (예: "${b.text}")`;
      case 'line': return '구분선';
      case 'place': return '장소 지도';
      case 'info': return '이용 정보 박스 (주소·영업시간·휴무·주차·예약)';
      case 'table': return '표';
      case 'sticker': return '스티커';
      case 'link': return '상품 링크';
      case 'notice': return '대가 표기';
      default: return b.t;
    }
  };
  const order = tpl.blocks.filter(b => !(b.t === 'sticker' && !d.sticker) && !(b.t === 'line' && d.line === 'none') && !(b.t === 'notice' && d.notice !== 'bottom')).map((b, i) => `${i + 1}. ${blk(b)}${b.src ? ` ← 후기씨앗: ${b.src}` : ''}`);
  if (d.notice === 'top') order.unshift('0. 대가 표기');
  const en = top(sum(ps, 'endings')).slice(0, 6).map(([k]) => '~' + k);
  const avg = ps.length ? Math.round(ps.reduce((a, q) => a + q.avgParaLen, 0) / ps.length) : 0;
  const json = { v: 1, blog: st.blog, name: p.name, template: tpl.id, design: d, refs: ps.slice(0, 6).map(q => q.url) };
  return `---
hugissiat_style: 1
blog: ${st.blog || '(미지정)'}
blog_name: ${p.name || ''}
template: ${tpl.id} (${tpl.name})
updated: ${new Date().toISOString().slice(0, 10)}
---
# 글쓰기 설정: ${p.name || st.blog || '내 블로그'} · ${tpl.name}

## 글 구성 (순서대로)
${order.join('\n')}

## 디자인 결 (네이버 스마트에디터 기준)
- 정렬: ${d.align === 'center' ? '가운데' : '왼쪽'}
- 글꼴: ${fontName(d.font)} (se-ff-${d.font}), 본문 ${d.size.replace('fs', '')}, 줄간격 ${d.lh}
- 소제목: ${SUB_NAME[d.sub]}${d.sub === 'quote' ? ` · ${qName(d.subQuote)}` : ''}, 크기 ${d.subSize.replace('fs', '')}
- 강조 한 문장: 인용구 ${qName(d.quote)}
- 이용 정보 박스: 인용구 ${qName(d.infoQuote)}, 📍주소 ⏰영업시간 ❌휴무 🚗주차 ☎예약 순서
- 구분선: ${lName(d.line)}
- 사진: ${d.photo === 'strip' ? '2~3장씩 묶어서 넣고, 사진 묶음마다 2~3줄 설명' : '한 장씩 넣고 사진마다 1~2줄 설명'}
- 줄 나눔: ${d.short ? `한 문장씩 줄을 나눠요 (한 줄 평균 ${avg || 38}자 안팎)` : '2~3문장을 한 문단으로'}
- 본문 글자색: ${d.textColor || '#000000'} / 소제목 글자색: ${d.subColor || '#000000'}
- 강조: ${d.hlMode === 'solid' ? `진한 배경 ${d.solid} + 흰 글씨(굵게)` : (d.highlight ? `형광펜 ${d.highlight}` : '안 씀')}, 글 전체에서 2~3군데만
- 이용 정보 박스: ${d.boxFill ? `표 한 칸에 배경 ${d.boxFill}` : '인용구'}${d.tableFill ? ` / 표 머리 칸 배경 ${d.tableFill}` : ''}
- 스티커: ${d.sticker ? '처음과 끝에 하나씩' : '안 씀'}
- 대가 표기: ${d.notice === 'none' ? '넣지 않음' : `${d.notice === 'top' ? '맨 위' : '맨 아래'} · "${d.noticeText}"`}

## 말투
- 자주 쓰는 끝맺음: ${en.join(', ') || '(분석 전)'}
- 참고 글 (Aside가 읽고 말투를 맞춰요):
${ps.slice(0, 6).map(q => `  - ${dec(q.title)} ${q.url}`).join('\n') || '  - (블로그를 불러오면 채워져요)'}

## 지키기
- 후기씨앗 경험 기록(MD)에 없는 경험·감정·숫자는 지어내지 않아요. 비어 있으면 그 문단은 빼요.
- 가게·제품 정보는 MD의 "참고 정보"에서만 가져와요.
- "~에 대해 알아보겠습니다", "결론적으로", "다양한", "특별한 경험" 같은 AI 티 나는 말은 쓰지 않아요.
- 블로그에는 임시저장까지만 하고, 발행은 직접 확인한 뒤에 해요.

\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`
`;
}
window.HS_buildProfile = buildProfile;
$('#dl').onclick = () => {
  const md = buildProfile(); const b = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `후기씨앗 글쓰기 설정 - ${prof().name || st.blog || '내 블로그'}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('설정 파일을 받았어요');
};
$('#cp').onclick = async () => { try { await navigator.clipboard.writeText(buildProfile()); toast('복사했어요'); } catch (e) { toast('복사하지 못했어요'); } };

/* ---------- 기타 ---------- */
const KW_CHIPS = ['맛집 후기', '카페 추천', '아이랑 가볼만한곳', '펜션 후기', '제품 사용 후기'];
$('#kwChips').innerHTML = KW_CHIPS.map(k => '<button type="button" data-k="' + k + '">' + k + '</button>').join('');
$('#kwChips').querySelectorAll('button').forEach(b => b.onclick = () => analyze('kw:' + b.dataset.k));
$('#kwForm').onsubmit = e => { e.preventDefault(); const v = $('#kw').value.trim(); if (v.length < 2) return; $('#kw').value = ''; analyze('kw:' + v); };
function setMode(m) { st.mode = m; save(); document.querySelectorAll('.srcTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); $('#kwForm').hidden = $('#kwChips').hidden = m !== 'kw'; $('#blogForm').hidden = $('#reviewWrap').hidden = m !== 'blog'; }
document.querySelectorAll('.srcTabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
$('#blogForm').onsubmit = e => { e.preventDefault(); const v = $('#blogId').value.trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//, '').split(/[/?#]/)[0]; if (!v) return; $('#blogId').value = ''; analyze(v); };
$('#reviewOnly').onchange = () => { if (st.blog && !/^kw:/.test(st.blog)) analyze(st.blog); };
$('#viewMobile').onclick = () => { $('#paper').classList.add('mobile'); $('#viewMobile').classList.add('on'); $('#viewPc').classList.remove('on'); };
$('#viewPc').onclick = () => { $('#paper').classList.remove('mobile'); $('#viewPc').classList.add('on'); $('#viewMobile').classList.remove('on'); };
function changed() { save(); renderBar(); renderDesign(); renderDoc(); }
function renderAll() { renderBlogs(); renderAna(); renderTone(); renderTpls(); renderBar(); renderDesign(); renderDoc(); }
setMode(st.mode || 'kw');
renderAll();
fetch('/api/me').then(r => r.ok ? r.json() : null).then(j => {
  if (!j) return; ME = j;
  $('#me').hidden = false;
  $('#me').innerHTML = (j.img ? '<img src="' + esc(j.img) + '" alt="">' : '<i class="noimg"></i>') + esc(j.nickname || '내 계정');
  const VIA = { naver: '네이버', google: '구글' };
  $('#acct').innerHTML = '<div class="ah">' + (j.img ? '<img src="' + esc(j.img) + '" alt="">' : '<i class="noimg"></i>') + '<div><b>' + esc(j.nickname || '이름 없음') + '</b><span>' + esc(j.email || '이메일 없음') + '</span></div></div>' +
    '<dl><dt>로그인</dt><dd>' + (j.via || []).map(v => VIA[v] || v).join(', ') + '</dd><dt>설정 저장</dt><dd>이 계정에 자동 저장돼요</dd></dl>' +
    '<a class="ab" href="/auth/logout">로그아웃</a><button type="button" class="ab del" id="acctDel">계정 지우기</button>';
  $('#me').onclick = e => { e.stopPropagation(); $('#acct').hidden = !$('#acct').hidden; };
  document.addEventListener('click', e => { if (!$('#acct').contains(e.target)) $('#acct').hidden = true; });
  $('#acctDel').onclick = async () => { if (!confirm('계정과 저장된 설정을 모두 지울까요? 되돌릴 수 없어요.')) return; await fetch('/api/me/delete', { method: 'POST' }); localStorage.removeItem(LS); localStorage.removeItem(LS + '-synced'); location.href = '/'; };
  fetch('/api/state').then(r => r.json()).then(x => { if (x.ok && x.state && x.state.profiles && !localStorage.getItem(LS + '-synced')) { st = { ...st, ...x.state }; localStorage.setItem(LS + '-synced', '1'); save(); setMode(st.mode || 'kw'); renderAll(); } });
  if (st.palette && st.palette.v !== 2) st.palette = null;
  if (!st.palette && st.myBlog) loadMyColor(st.myBlog); else if (!st.palette && j.blogGuess) loadMyColor(j.blogGuess, true); else renderMyColor();
}).catch(() => {});
if (!st.blog) analyze('kw:맛집 후기');
})();
