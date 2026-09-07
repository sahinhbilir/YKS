// Exercise the actual export functions and tap handlers without making real downloads.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const source = html.split('<script id="uygulama">')[1].split('// ---------------------------------------------------------------- başlangıç')[0];
const nodes = {}, events = {}, timers = [], shared = [], downloads = [], revoked = [];
let printing = 0, copies = '', active = true, bridgeCalls = 0;
const element = (id = '') => ({
  id, dataset: {}, style: {}, value: '', textContent: '', hidden: false,
  classList: { add() {}, remove() {}, contains() { return false; } },
  setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, appendChild() {},
  closest(s) { return s.split(',').includes('#' + this.id) ? this : null; },
  click() { downloads.push(this); },
  remove() { delete nodes[this.id]; },
  set innerHTML(value) { this.markup = value; for (const m of value.matchAll(/id="([^"]+)"/g)) nodes[m[1]] = element(m[1]); },
  get innerHTML() { return this.markup || ''; }
});
nodes.ana = element('ana'); nodes.ray = element('ray');
const context = {
  console, Blob, File, Date, JSON, Math, Intl, URLSearchParams,
  URL: { createObjectURL() { return 'blob:export-' + timers.length; }, revokeObjectURL(url) { revoked.push(url); } },
  setTimeout(fn, ms) { timers.push({fn, ms}); return timers.length; }, clearTimeout() {},
  location: { search: '?dev=1' }, localStorage: {getItem(){return null;},setItem(){}}, sessionStorage: {getItem(){return null;}},
  alert() { throw Error('Unexpected blocking alert'); }, confirm() { return false; },
  navigator: { userAgent: 'iPhone', canShare: () => true, share(data) {
    assert.equal(active, true, 'native share must start synchronously inside the tap');
    shared.push(data); return Promise.resolve();
  } },
  window: { addEventListener() {}, print() {
    assert.equal(active, true, 'native print must start synchronously inside the tap');
    assert.ok(nodes.planBaski, 'print document must exist before native printing'); printing++;
  }, open() { throw Error('Printing must not depend on a popup'); } },
  document: {
    title: 'YKS', activeElement: element('original'),
    body: { classList: {add(){},remove(){}}, appendChild(el) { nodes[el.id] = el; } },
    getElementById(id) { return nodes[id] || null; }, createElement() { return element(); },
    addEventListener(k, fn) { (events[k] ||= []).push(fn); }, querySelectorAll() { return []; }
  }
};
vm.createContext(context); vm.runInContext(source, context);
const run = s => vm.runInContext(s, context);
const checks = [];
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); };
async function click(id) { for (const fn of events.click) await fn({target: nodes[id] || element(id)}); }
async function exportFile() {
  active = true;
  const result = run('indir("yedek.json", "{\\"ad\\":\\"Örnek Öğrenci\\"}", "json")');
  active = false;
  return result;
}
(async () => {
  check('iphone-share-succeeds', await exportFile());
  check('share-receives-original-json-file', shared[0].files[0].name === 'yedek.json' &&
    await shared[0].files[0].text() === '{"ad":"Örnek Öğrenci"}');
  check('share-does-not-add-page-url-or-personal-metadata', Object.keys(shared[0]).join(',') === 'files');
  context.navigator.userAgent = 'Macintosh'; context.navigator.platform = 'MacIntel'; context.navigator.maxTouchPoints = 5;
  check('ipad-desktop-mode-detected', run('appleMobilMi()'));
  await exportFile(); check('ipad-uses-share-sheet', shared.length === 2);
  context.navigator.share = () => Promise.reject(Object.assign(Error('cancelled'), {name: 'AbortError'}));
  check('cancel-is-not-reported-as-success', !(await exportFile()));
  check('cancel-does-not-open-another-dialog', !nodes.disariAktar);
  context.navigator.canShare = () => false;
  check('unsupported-json-share-not-reported-as-saved', !(await exportFile()));
  check('unsupported-sharing-has-real-download-link', nodes.disariAktar.innerHTML.includes('download="yedek.json"'));
  check('fallback-keeps-exact-backup-text', nodes.ciktiMetni.value === '{"ad":"Örnek Öğrenci"}');
  context.navigator.clipboard = {writeText(v) { copies = v; return Promise.resolve(); }};
  await click('yedekKopyala'); check('copy-fallback-preserves-complete-json', copies === nodes.ciktiMetni.value);
  const previousTitle = context.document.title;
  await click('ciktiKapat');
  check('closing-restores-app-and-title', !nodes.disariAktar && context.document.title === previousTitle);
  check('blob-not-revoked-immediately-after-close', revoked.length === 0 && timers.some(t => t.ms >= 60000));
  context.navigator.canShare = () => true;
  context.navigator.share = () => Promise.reject(Object.assign(Error('blocked'), {name:'NotAllowedError'}));
  await exportFile(); check('blocked-sharing-is-recoverable', !!nodes.disariAktar);
  delete context.navigator.clipboard;
  await click('yedekKopyala'); check('blocked-clipboard-offers-manual-copy', nodes.ciktiDurum.textContent.includes('basılı tut'));
  await click('ciktiKapat');
  context.navigator.userAgent = 'Desktop'; context.navigator.maxTouchPoints = 0;
  active = true; const desktopResult = run('indir("backup.json", "{}", "json")');
  check('desktop-download-starts-without-await', downloads.length === 1);
  active = false; check('desktop-download-still-works', await desktopResult);
  context.window.claude = {use() {bridgeCalls++;return Promise.resolve({save:()=>Promise.resolve()});}};
  check('artifact-host-export-still-works', await exportFile());
  check('artifact-host-bridge-is-used-only-when-present', bridgeCalls === 1);
  delete context.window.claude;
  run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-07';
    D.ogr=[{ad:'Örnek Öğrenci',no:0,sube:'201',alan:'SAY',kap:6,off:[6],aktif:true}];
    EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};ogrenciOtomasyonHazirla();`);
  const before = run('JSON.stringify(D)');
  active = true; const printResult = run('planYazdir(null)');
  check('printing-starts-in-original-tap', printing === 1); active = false;
  check('print-call-completes', await printResult);
  check('print-preview-has-visible-retry', nodes.disariAktar.innerHTML.includes('id="ciktiYazdir"'));
  check('print-preview-retains-repetition-labels', nodes.disariAktar.innerHTML.includes('1. tekrar'));
  check('printing-does-not-change-results-or-freeze-plans', before === run('JSON.stringify(D)'));
  active = true; await click('ciktiYazdir'); check('visible-print-retry-works', printing === 2);
  await click('ciktiKapat'); check('print-close-restores-original-title', context.document.title === 'YKS');
  context.window.print = () => { throw Error('Print unavailable in embedded browser'); };
  check('blocked-print-not-reported-as-success', !(await run('planYazdir(null)')));
  check('blocked-print-leaves-readable-preview', !!nodes.planBaski && nodes.ciktiDurum.textContent.includes('Safari'));
  const css = run('planBaskiStili()');
  check('print-preview-style-is-scoped', !/(^|})\s*(body|table|th|td)\s*\{/.test(css));
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e => { console.error(e); process.exitCode = 1; });
