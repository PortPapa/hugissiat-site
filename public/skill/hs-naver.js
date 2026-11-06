// 후기씨앗 글쓰기: 네이버 스마트에디터 ONE 입력 도우미 (Aside REPL에서 eval)
// const H = makeHS(page, style)   style = style.md의 JSON (blogId, design 값)
// await H.open(); await H.title(t); await H.run(blocks); await H.save();

async function hsPaste(P, html) {
  return await P.evaluate((html) => {
    const find = (doc) => { const ae = doc.activeElement; if (ae && ae.tagName === 'IFRAME') { try { return find(ae.contentDocument); } catch (e) { return ae; } } return ae; };
    const t = find(document); const dt = new DataTransfer();
    dt.setData('text/html', html); dt.setData('text/plain', html.replace(/<[^>]+>/g, ''));
    t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true;
  }, html);
}

function makeHS(P, style) {
  const S = Object.assign({ textColor: '#444444', subColor: '#222222', highlight: '#fff3b0', tableHead: '#333333', tableCol: '#f4f4f4', align: 'center', subQuote: 'quotation_line', quote: 'quotation_bubble', line: 'line5', notice: 'top' }, style.design || style);
  const blogId = style.blogId || S.blogId;
  let MF = null;
  const liveMF = async () => { for (const f of P.frames().filter(f => f.name() === 'mainFrame').reverse()) { try { await f.evaluate(() => 1); return f; } catch (e) {} } throw new Error('mainFrame not found'); };
  const list = async () => await MF.evaluate(() => [...document.querySelectorAll('.se-components-wrap > .se-component')].map(c => ({ t: (c.className.match(/se-(text|image|quotation|documentTitle|horizontalLine|table|placesMap)\b/) || [''])[0], s: c.innerText.trim().slice(0, 25) })));
  const scrollBottom = async () => { await MF.evaluate(() => { document.querySelectorAll('*').forEach(e => { if (e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; }); }); await sleep(250); };
  const newPara = async () => {
    const l = await list(); const last = l[l.length - 1]; await scrollBottom();
    const comp = MF.locator('.se-components-wrap > .se-component').last();
    if (last.t === 'se-text' && (last.s === '' || /^글감과 함께/.test(last.s))) { await comp.locator('.se-text-paragraph').last().click(); return; }
    const b = await comp.boundingBox(); await P.mouse.click(700, Math.min(b.y + b.height + 30, 885)); await sleep(300);
    if ((await list()).length === l.length) { await P.mouse.click(700, 885); await sleep(300); }
  };
  // 문단 안 서식
  const g = t => `<span style="color:${S.textColor}">${t}</span>`;
  const H = {
    c: t => `<span style="color:${S.subColor}"><b>${t}</b></span>`,
    b: t => `<b>${t}</b>`,
    m: t => `<span style="background-color:${S.highlight}">${t}</span>`,
    gray: t => `<span style="color:#9a9a9a">${t}</span>`,
  };
  const paras = arr => arr.map(x => x === '' ? '<p><br></p>' : `<p style="text-align:${S.align}">${g(x)}</p>`).join('');
  const subHtml = t => (S.subQuote === 'quotation_line' ? `<span style="color:${S.subColor}"><b>›</b></span> ` : '') + `<b>${t}</b>`;
  const tableHtml = rows => {
    const head = rows.length > 2 && rows[0].every(c => String(c).length <= 8) && rows[0][0] !== '주소';
    const dk = c => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140; };
    return '<table>' + rows.map((r, i) => '<tr>' + r.map((c, j) => {
      if (head && i === 0) return `<td style="background-color:${S.tableHead};color:${dk(S.tableHead) ? '#ffffff' : '#222222'}"><b>${c}</b></td>`;
      if (j === 0) return `<td style="background-color:${S.tableCol};color:${dk(S.tableCol) ? '#ffffff' : S.textColor}"><b>${c}</b></td>`;
      return `<td>${c}</td>`;
    }).join('') + '</tr>').join('') + '</table>';
  };
  const quote = async (html, layout) => {
    await MF.locator('button[data-name="quotation"].se-document-toolbar-icon-select-button').click(); await sleep(500);
    await hsPaste(P, html); await sleep(500);
    if (layout && layout !== 'default') { const b = MF.locator(`button[data-name="quotation-layout"][data-value="${layout}"]`); if (await b.count()) { await b.first().click(); await sleep(400); } }
  };
  const ops = {
    img: async (file) => { const [fc] = await Promise.all([P.waitForEvent('filechooser', { timeout: 8000 }), MF.locator('button[data-name="image"]').first().click()]); await fc.setFiles(file); await sleep(2500); },
    p: async (arr) => { await hsPaste(P, paras(arr)); await sleep(500); },
    notice: async (t) => { await hsPaste(P, `<p style="text-align:${S.align}"><span style="color:#a8a8a8">${t}</span></p><p><br></p>`); await sleep(400); },
    sub: async (t) => quote(subHtml(t), S.subQuote),
    quote: async (t, l) => quote(t, l || S.quote),
    summary: async (lines) => quote(lines.map((x, i) => i === 0 ? `<b>${x}</b>` : x).join('<br>'), 'quotation_corner'),
    hr: async () => {
      await MF.locator('button[data-name="horizontal-line"].se-document-toolbar-icon-select-button').click(); await sleep(500);
      const h = MF.locator('.se-components-wrap > .se-component.se-horizontalLine').last(); await h.scrollIntoViewIfNeeded();
      const b = await h.boundingBox(); await P.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(300);
      const l = MF.locator(`button[data-name="horizontal-line-layout"][data-value="${S.line || 'line5'}"]`); if (await l.count()) { await l.first().click(); await sleep(300); }
      const ac = MF.locator('.se-property-toolbar button[data-name="align"][data-value="center"]'); if (await ac.count()) { await ac.first().click(); await sleep(200); }
    },
    table: async (rows) => { await hsPaste(P, tableHtml(rows)); await sleep(700); },
    place: async (name) => {
      // 장소 첨부: 실패하면 건너뛰고 보고한다
      try {
        await MF.locator('button[data-name="map"]').first().click(); await sleep(1200);
        const input = MF.locator('input[placeholder*="장소"], .se-place-search-input input, input.react-autosuggest__input').first();
        await input.fill(name); await P.keyboard.press('Enter'); await sleep(1800);
        const add = MF.locator('button:has-text("추가"), .se-place-add-button').first(); await add.click(); await sleep(600);
        const ok = MF.locator('button:has-text("확인"), .se-popup-button-confirm').last(); await ok.click(); await sleep(900);
        return true;
      } catch (e) { await P.keyboard.press('Escape').catch(() => {}); return false; }
    },
  };
  const report = { skipped: [] };
  return {
    ...H, report, tableHtml,
    async open() {
      try { await P.goto(`https://blog.naver.com/${blogId}?Redirect=Write`, { timeout: 12000 }); } catch (e) {}
      await sleep(3000); MF = await liveMF();
      return (await MF.evaluate(() => /작성 중인 글이 있습니다/.test(document.body.innerText))) ? 'DIALOG' : 'ok';
    },
    async title(t) {
      MF = await liveMF();
      const l = await list(); if (l.length > 2) throw new Error('editor not empty');
      await MF.locator('.se-documentTitle .se-text-paragraph').first().click(); await P.keyboard.insertText(t); await sleep(300);
      const got = (await list())[0].s; if (!t.startsWith(got.slice(0, 10))) throw new Error('title input failed (close other editor tabs)');
    },
    async run(blocks, from = 0, budgetMs = 100000) {
      MF = await liveMF(); const t0 = Date.now(); let i = from; let first = !(await list()).some(x => x.t === 'se-image');
      for (; i < blocks.length && Date.now() - t0 < budgetMs; i++) {
        const b = blocks[i]; await newPara();
        if (b.img) { await ops.img(b.img); if (first) { first = false; try { await P.mouse.click(1413, 132); } catch (e) {} } }
        else if (b.p) await ops.p(b.p);
        else if (b.notice) await ops.notice(b.notice);
        else if (b.sub) await ops.sub(b.sub);
        else if (b.summary) await ops.summary(b.summary);
        else if (b.quote) await ops.quote(b.quote, b.l);
        else if (b.hr) await ops.hr();
        else if (b.table) await ops.table(b.table);
        else if (b.place) { if (!(await ops.place(b.place))) report.skipped.push('지도: ' + b.place); }
      }
      return i; // blocks.length보다 작으면 같은 blocks로 run(blocks, i)를 다시 부른다
    },
    async save() {
      const s = await snapshot(P, { interactive: true });
      const ref = (s.tree.match(/button "저장" \[ref=(\w+)\]/) || [])[1];
      await P.locator(ref).click(); await sleep(2000);
      const s2 = await snapshot(P, { interactive: true });
      return { drafts: (s2.tree.match(/임시저장된 글 보기, (\d+)개/) || [])[1], skipped: report.skipped };
    },
  };
}
globalThis.makeHS = makeHS; globalThis.hsPaste = hsPaste;
