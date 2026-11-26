// Scenarios for the end-to-end run. Each one opens a screen of the real app
// (through the IO_SHOT_PLAN mode in src/main/index.ts), clicks through it like
// a person would and writes a JSON report with the app's own text:save IPC.
import { join } from 'path'
import { LOCKED_PASSWORD } from './fixtures.mjs'

const slash = (p) => p.split(String.fromCharCode(92)).join('/')

export function buildScenarios(inDir, reportDir) {
  const IN = (n) => slash(join(inDir, n))
  const REP = (n) => slash(join(reportDir, `${n}.json`))

  // Runs inside the renderer. Selectors use roles, labels and visible text.
  const prelude = (name) => `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const btn = (txt) => $$('button').find((b) => b.textContent.trim() === txt);
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const choose = async (trigger, value) => {
  if (trigger.tagName === 'SELECT') return setVal(trigger, value);
  trigger.click(); await sleep(150);
  const opt = document.querySelector('[role=listbox] [data-value="' + value + '"]');
  if (!opt) throw new Error('option ' + value + ' missing');
  opt.click(); await sleep(100);
};
const waitFor = async (fn, ms = 90000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(250); } return null; };
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && e.reason.message || e.reason)));
const report = (obj) => window.io.call('text:save', [[JSON.stringify({ name: ${JSON.stringify(name)}, ...obj, errors }, null, 1)]], 'txt', ${JSON.stringify(REP(name))});
const saved = () => { const p = $$('p[title]').find((p) => /^Saved /.test(p.textContent)); return p && p.title; };
const alerts = () => $$('[role=alert]').map((e) => e.innerText.trim()).join(' | ');
const finish = async (extra = {}) => {
  await waitFor(() => saved() || alerts(), 180000);
  const out = saved();
  const info = out ? await window.io.call('fs:info', [out]) : [];
  await report({ ok: !!out && info.length === 1 && info[0].size > 0, output: out, size: info[0] && info[0].size, alert: alerts(), ...extra, ...(window.__extra || {}) });
};
const unlockModal = async (pw) => {
  const inp = await waitFor(() => document.querySelector('[role=dialog] input[type=password]'), 15000);
  if (!inp) return false;
  setVal(inp, pw); await sleep(100);
  btn('Continue').click(); await sleep(800); return true;
};
const targetOf = (row) => row.querySelector('[data-testid=target]');
`
  const wrap = (name, body) =>
    `(async () => { ${prelude(name)} try { ${body} } catch (e) { await report({ ok: false, crash: String(e && e.stack || e) }); } return true; })()`

  const tool = (name, page, files, label, pre = '') => ({
    name,
    page,
    files: files.map(IN),
    wait: 2500,
    after: 1500,
    script: wrap(
      name,
      `${pre}
    const b = await waitFor(() => { const b = btn(${JSON.stringify(label)}); return b && !b.disabled && b; }, 20000);
    if (!b) return await report({ ok: false, err: 'button missing or disabled: ${label}', alert: alerts() });
    b.click();
    await finish();`
    )
  })

  const convertFiles = ['doc.pdf', 'doc2.pdf', 'doc3.pdf', 'report.docx', 'photo.jpg', 'photo.tiff', 'tone.wav', 'data.xlsx', 'scan.png', 'clip.mp4', 'notes.md', 'page.html', 'rows.json', 'text.svg']

  return [
    // A mixed batch through every engine.
    {
      name: 'convert',
      page: 'convert',
      wait: 2500,
      after: 1500,
      files: convertFiles.map(IN),
      script: wrap(
        'convert',
        `
      await waitFor(() => $$('[data-testid=job]').length >= ${convertFiles.length}, 15000);
      const row = (n) => $$('[data-testid=job]').find((li) => li.textContent.includes(n));
      for (const [n, v] of [['doc2.pdf', 'docx'], ['doc3.pdf', 'txt'], ['scan.png', 'txt'], ['clip.mp4', 'webm'], ['data.xlsx', 'pdf']]) await choose(targetOf(row(n)), v);
      await sleep(300);
      btn('Convert files').click();
      await sleep(1000);
      await waitFor(() => !btn('Cancel'), 300000);
      await sleep(500);
      const header = document.querySelector('header p').textContent;
      const rows = $$('[data-testid=job]').map((li) => li.innerText.split('\\n').filter(Boolean).join(' · '));
      await report({ ok: /${convertFiles.length} files · ${convertFiles.length} done/.test(header), header, rows });`
      )
    },
    // Cancel a long job half-way.
    {
      name: 'convert-cancel',
      page: 'convert',
      wait: 2500,
      after: 500,
      files: [IN('long.mp4')],
      script: wrap(
        'convert-cancel',
        `
      const r = await waitFor(() => $$('[data-testid=job]')[0], 15000);
      await choose(targetOf(r), 'gif');
      btn('Convert files').click();
      await waitFor(() => btn('Cancel'), 5000);
      await sleep(800);
      btn('Cancel').click();
      await waitFor(() => !btn('Cancel'), 30000);
      await sleep(400);
      const t = $$('[data-testid=job]')[0].innerText;
      await report({ ok: /Cancelled/.test(t), row: t });`
      )
    },
    tool('split', 'split', ['doc.pdf'], 'Split PDF'),
    tool('split-each', 'split', ['doc.pdf'], 'Split PDF', `btn('Each page').click(); await sleep(200);`),
    tool('compress', 'compress', ['doc.pdf'], 'Compress PDF'),
    tool('watermark', 'watermark', ['doc.pdf'], 'Add watermark'),
    tool('numbers', 'numbers', ['doc.pdf'], 'Add numbers'),
    tool(
      'protect',
      'protect',
      ['doc.pdf'],
      'Protect PDF',
      `
    await waitFor(() => $$('input[type=password]').length === 2, 15000);
    const [a, b2] = $$('input[type=password]'); setVal(a, 'secret1'); setVal(b2, 'secret1'); await sleep(200);`
    ),
    tool('unlock', 'unlock', ['locked.pdf'], 'Unlock PDF', `await unlockModal('${LOCKED_PASSWORD}');`),
    tool(
      'unlock-wrong-password',
      'unlock',
      ['locked.pdf'],
      'Unlock PDF',
      `
    const inp = await waitFor(() => document.querySelector('[role=dialog] input[type=password]'), 15000);
    setVal(inp, 'nope'); await sleep(100); btn('Continue').click(); await sleep(1200);
    window.__extra = { wrongShown: !!document.querySelector('[role=dialog]') && document.body.innerText.includes('Wrong password') };
    await unlockModal('${LOCKED_PASSWORD}');`
    ),
    tool(
      'properties',
      'properties',
      ['doc.pdf'],
      'Save properties',
      `
    await waitFor(() => $$('aside input').length >= 4, 15000);
    setVal($$('aside input')[0], 'Başlık — test'); setVal($$('aside input')[1], 'İsmet'); await sleep(200);`
    ),
    tool('ocr-pdf', 'ocr', ['scan.png', 'doc.pdf'], 'Recognize text'),
    tool('ocr-txt', 'ocr', ['scan.png'], 'Recognize text', `btn('Plain text').click(); await sleep(200);`),
    tool('merge', 'merge', ['doc.pdf', 'doc2.pdf', 'locked.pdf'], 'Merge PDFs', `await unlockModal('${LOCKED_PASSWORD}');`),
    tool('images', 'images', ['photo.jpg', 'photo.png', 'photo.tiff', 'text.svg'], 'Create PDF'),
    // Rotate page 1, delete page 2, save.
    tool(
      'organize',
      'organize',
      ['doc.pdf'],
      'Save PDF',
      `
    await waitFor(() => $$('[data-testid=page-card] canvas').length >= 5, 15000); await sleep(800);
    const cards = $$('[data-testid=page-card]');
    cards[0].click(); await sleep(100);
    $$('button[aria-label="Rotate right"]')[0].click(); await sleep(100);
    cards[1].click(); await sleep(100);
    $$('button[aria-label="Delete"]')[0].click(); await sleep(300);`
    ),
    // Add a text box and a white-out, save.
    tool(
      'edit',
      'edit',
      ['doc.pdf'],
      'Save PDF',
      `
    const pg = await waitFor(() => document.querySelector('[data-page]'), 15000); await sleep(1200);
    const r = pg.getBoundingClientRect();
    const pe = (type, x, y) => pg.querySelector('canvas').dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    btn('Text').click(); await sleep(150);
    pe('pointerdown', r.left + r.width * 0.2, r.top + r.height * 0.15); await sleep(300);
    const ta = await waitFor(() => document.querySelector('[data-page] textarea'), 3000);
    setVal(ta, 'İmza: Ğüşıöç'); await sleep(100); ta.blur(); await sleep(200);
    btn('White-out').click(); await sleep(150);
    pe('pointerdown', r.left + r.width * 0.5, r.top + r.height * 0.5);
    pe('pointermove', r.left + r.width * 0.7, r.top + r.height * 0.6);
    pe('pointerup', r.left + r.width * 0.7, r.top + r.height * 0.6); await sleep(300);`
    ),
    {
      name: 'settings',
      page: 'settings',
      wait: 1500,
      after: 300,
      script: wrap(
        'settings',
        `
      const env = await window.io.call('app:env');
      await report({ ok: document.body.innerText.includes('LibreOffice') && !!env.version, env });`
      )
    },
    // Errors from the main process arrive translated.
    {
      name: 'turkish-errors',
      page: 'split',
      lang: 'tr',
      files: [IN('doc.pdf')],
      wait: 2500,
      after: 1500,
      script: wrap(
        'turkish-errors',
        `
      const inp = await waitFor(() => $$('aside input')[0], 10000); setVal(inp, '40-50'); await sleep(200);
      btn("PDF'i böl").click();
      await sleep(1500);
      await report({ ok: /sayfa aralığı/.test(alerts()), alert: alerts() });`
      )
    },
    // Command palette opens with Ctrl+K and navigates.
    {
      name: 'palette',
      page: 'convert',
      wait: 1500,
      after: 600,
      script: wrap(
        'palette',
        `
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
      const inp = await waitFor(() => document.querySelector('[role=combobox]'), 3000);
      setVal(inp, 'shrink'); await sleep(200);
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(500);
      // Convert stays mounted (hidden), so read the heading that is on screen.
      const h1 = $$('h1').find((h) => h.offsetParent !== null);
      await report({ ok: !!h1 && /Compress/.test(h1.textContent), heading: h1 && h1.textContent });`
      )
    }
  ]
}
