// 네이버 블로그 디자인 결 분석: 공개 글 HTML(스마트에디터 se-* 마크업)에서 통계만 뽑는다. AI 없음.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#38;/g, '&').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = s => decode(s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')).replace(/\u200b/g, '').trim();
const inc = (o, k, n = 1) => { if (k) o[k] = (o[k] || 0) + n; };

export async function listPosts(blogId, count = 12) {
  const u = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}&viewdate=&currentPage=1&categoryNo=0&parentCategoryNo=&countPerPage=${count}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://blog.naver.com/' } });
  if (!r.ok) throw new Error('블로그를 찾지 못했어요');
  const t = await r.text();
  const out = [];
  const re = /"logNo":"(\d+)","title":"([^"]*)"/g;
  let m;
  while ((m = re.exec(t))) {
    let title = m[2];
    try { title = decodeURIComponent(title.replace(/\+/g, ' ')); } catch (e) {}
    const rest = t.slice(re.lastIndex, re.lastIndex + 400);
    const dm = rest.match(/"addDate":"([^"]*)"/);
    out.push({ logNo: m[1], title: decode(title), date: dm ? dm[1] : '' });
  }
  return out;
}

export function analyzeHtml(html) {
  const s = html;
  const st = { comps: {}, seq: [], fonts: {}, sizes: {}, align: {}, lineHeights: {}, colors: {}, highlights: {}, endings: {}, images: 0, imageRows: { single: 0, strip2: 0, strip3: 0, slide: 0 }, quotes: [], quoteStyles: {}, lines: {}, stickers: 0, places: 0, links: 0, videos: 0, tables: 0, textChars: 0, paragraphs: 0, blankParas: 0, paraLens: [], laugh: 0, emoji: 0, exclam: 0, question: 0, firstLines: [], sponsor: null, boldCount: 0 };
  // 카테고리
  const cat = s.match(/class="blog2_series">\s*<a[^>]*>([^<]+)</);
  st.category = cat ? strip(cat[1]) : '';
  const titleM = s.match(/se-title-text[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
  st.title = titleM ? strip(titleM[1]) : '';
  const startIdx = s.indexOf('se-main-container');
  const body = startIdx >= 0 ? s.slice(startIdx) : s;
  // 컴포넌트 순서
  const compRe = /class="se-component (se-[a-zA-Z]+)(?: (se-imageStrip\d))?(?: (se-l-[a-zA-Z_0-9]+))?/g;
  let m;
  while ((m = compRe.exec(body))) {
    const type = m[1].replace('se-', '');
    const layout = (m[3] || '').replace('se-l-', '');
    const key = layout && layout !== 'default' ? `${type}:${layout}` : type;
    inc(st.comps, key);
    if (type === 'documentTitle') continue;
    let token = type;
    if (type === 'quotation') { token = 'quote:' + (layout || 'default'); inc(st.quoteStyles, layout || 'default'); }
    else if (type === 'horizontalLine') { token = 'line:' + (layout || 'default'); inc(st.lines, layout || 'default'); }
    else if (type === 'imageStrip') { const n = (m[2] || '').replace('se-imageStrip', '') || '2'; token = 'strip' + n; st.imageRows[n === '3' ? 'strip3' : 'strip2']++; }
    else if (type === 'image') { st.imageRows.single++; }
    else if (type === 'imageGroup') { token = 'slide'; st.imageRows.slide++; }
    else if (type === 'sticker') st.stickers++;
    else if (type === 'placesMap') st.places++;
    else if (type === 'oglink') st.links++;
    else if (type === 'video') st.videos++;
    else if (type === 'table') st.tables++;
    if (st.seq.length && st.seq[st.seq.length - 1].t === token) st.seq[st.seq.length - 1].n++;
    else st.seq.push({ t: token, n: 1 });
  }
  st.images = (body.match(/class="se-image-resource/g) || []).length;
  // 글꼴·크기·정렬·줄간격·색
  for (const x of body.matchAll(/se-ff-([a-z0-9]+)/g)) inc(st.fonts, x[1]);
  for (const x of body.matchAll(/se-fs-(fs\d+)/g)) inc(st.sizes, x[1]);
  for (const x of body.matchAll(/se-text-paragraph-align-([a-z]+)/g)) inc(st.align, x[1]);
  for (const x of body.matchAll(/line-height:\s*([\d.]+)/g)) inc(st.lineHeights, x[1]);
  for (const x of body.matchAll(/[;"]color:\s*(#[0-9a-fA-F]{6})/g)) inc(st.colors, x[1].toLowerCase());
  for (const x of body.matchAll(/background-color:\s*(#[0-9a-fA-F]{6})/g)) { const c = x[1].toLowerCase(); if (c !== '#fbfbfb' && c !== '#00c73c') inc(st.highlights, c); }
  st.boldCount = (body.match(/<b>|<strong/g) || []).length;
  // 본문 문단 (인용구 제외)
  const quoteBlocks = [...body.matchAll(/<blockquote class="se-quotation-container">([\s\S]*?)<\/blockquote>/g)].map(x => strip(x[1])).filter(Boolean);
  st.quotes = quoteBlocks.slice(0, 8);
  const endIdx = body.search(/SE_DOC_FOOTER|post_footer_contents|<div class="post-btn/);
  const bodyText = (endIdx > 0 ? body.slice(0, endIdx) : body).replace(/<blockquote[\s\S]*?<\/blockquote>/g, '').replace(/<table[\s\S]*?<\/table>/g, '');
  const paras = [];
  for (const p of bodyText.matchAll(/<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)) paras.push(strip(p[1]));
  for (const p of paras) {
    if (!p) { st.blankParas++; continue; }
    st.paragraphs++; st.textChars += p.length; st.paraLens.push(p.length);
    if (st.firstLines.length < 4) st.firstLines.push(p);
    const end = p.replace(/[\s.!?~♡♥ㅎㅋ^)\]"'…]+$/, '');
    const e = end.match(/(더라고요|거든요|었어요|았어요|했어요|네요|죠|에요|예요|어요|아요|해요|요|습니다|니다|었다|았다|했다|다)$/);
    if (e) inc(st.endings, e[1]);
    st.laugh += (p.match(/ㅎㅎ|ㅋㅋ/g) || []).length;
    st.emoji += (p.match(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu) || []).length;
    st.exclam += (p.match(/!/g) || []).length;
    st.question += (p.match(/\?/g) || []).length;
  }
  // 대가 표기
  const all = [...quoteBlocks, ...paras].join('\n');
  const spIdx = paras.findIndex(p => /제공받|지원받|협찬|원고료|체험단|소정의|업체로부터/.test(p));
  if (spIdx >= 0) st.sponsor = { text: paras[spIdx].slice(0, 120), at: spIdx < paras.length * 0.3 ? 'top' : 'bottom' };
  else if (/제공받|지원받|협찬|원고료/.test(all)) st.sponsor = { text: '', at: 'quote' };
  st.avgParaLen = st.paragraphs ? Math.round(st.textChars / st.paragraphs) : 0;
  delete st.paraLens;
  return st;
}

export async function analyzeBlog(blogId, n = 8, kind = 'all') {
  const pool = kind === 'review' ? 30 : Math.max(n, 12);
  const list = (await listPosts(blogId, pool)).slice(0, pool);
  if (!list.length) throw new Error('공개된 글이 없어요');
  const fetchOne = async p => {
    try {
      const u = `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${p.logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
      const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: `https://blog.naver.com/${blogId}` } });
      const html = await r.text();
      const st = analyzeHtml(html);
      return { ...st, logNo: p.logNo, title: st.title || p.title, date: p.date, url: `https://blog.naver.com/${blogId}/${p.logNo}` };
    } catch (e) { return { logNo: p.logNo, title: p.title, error: true }; }
  };
  let posts = (await Promise.all((kind === 'review' ? list : list.slice(0, n)).map(fetchOne))).filter(p => !p.error);
  if (kind === 'review') {
    // 실사 후기: 사진이 많거나 장소 지도가 있는 글
    const isReview = p => p.places > 0 || p.images >= 8 || /맛집|카페|여행|나들이|숙소|호텔|펜션|체험|키즈|리뷰|후기/.test(p.category || '');
    posts = posts.filter(isReview).slice(0, n);
  }  // 블로그 이름·닉네임
  let nick = '';
  try {
    const r = await fetch(`https://blog.naver.com/NBlogTop.naver?isHttpsRedirect=true&blogId=${encodeURIComponent(blogId)}`, { headers: { 'User-Agent': UA } });
    const t = await r.text();
    const m = t.match(/<title>([^<]+)<\/title>/);
    if (m) nick = decode(m[1]).replace(/\s*:\s*네이버 블로그\s*$/, '').trim();
  } catch (e) {}
  return { blogId, name: nick, kind, at: new Date().toISOString(), posts };
}
