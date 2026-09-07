#!/usr/bin/env node
'use strict';
// Dependency-free visibility regression. The app must not redraw on a normal alt-tab or
// while result/settings/modal edits are in progress. An idle plan may refresh after rollover.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const source = html.slice(start, boot);

function field(id, value) {
  const el = { id, value: value || '', checked: false, selectionStart: 0, selectionEnd: 0,
    focus() { context.document.activeElement = el; },
    setSelectionRange(a, b) { el.selectionStart = a; el.selectionEnd = b; } };
  return el;
}

const events = {};
const nodes = { ray: { innerHTML: '' }, ana: { innerHTML: '' }, veri: { textContent: 'null' },
  stil: { textContent: 'body{}' }, uygulama: { textContent: source } };
const context = {
  console, Date, Math, JSON, Intl, URL, URLSearchParams, Blob, crypto,
  setTimeout, clearTimeout,
  location: { search: '?dev=1' },
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollX: 0, scrollY: 0, scrollTo(x, y) { this.scrollX = x; this.scrollY = y; },
    addEventListener() {}, open() { return null; }, bulut: null },
  document: {
    visibilityState: 'visible', activeElement: null,
    addEventListener(type, fn) { (events[type] ||= []).push(fn); },
    contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, remove() {} }; },
    body: { appendChild() {}, insertAdjacentHTML() {} }
  }
};
context.window.document = context.document;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'index.html' });
const run = code => vm.runInContext(code, context);
const visibility = () => events.visibilitychange[0]();
const assertEq = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

function resultRow(ki, gun, mode, value) {
  const numeric = { hidden: mode !== 'numeric' };
  const dogru = { value: mode === 'numeric' ? String(value) : '' }, soru = { value: '12' };
  const rating = mode === 'rating' ? { dataset: { sonucNot: String(value) } } : null;
  return { dataset: { ki: String(ki), gun: String(gun), slot: String(ki) },
    querySelector(sel) {
      if (sel === '.sonuc-not.secili') return rating;
      if (sel === '.sonuc-sayisal') return numeric;
      if (sel === '[data-sonuc-dogru]') return dogru;
      if (sel === '[data-sonuc-soru]') return soru;
      return null;
    }
  };
}

(async () => {

run(`D = varsayilan(); D.rol = 'ogrenci'; D.ayar.testTarih = '2026-09-07';
  D.ogr = [{ ad: 'Ada', alan: 'SAY', sube: '12A', aktif: true }];
  EK = { sekme: 'plan', ogr: 0, hafta: null, kirli: false, son: '', girisAcik: {} };`);
const state = { redraws: 0, flushes: 0, syncs: [] };
context.state = state;
run(`ciz = function () { state.redraws++; document.activeElement = document.body; };
  bulutYedekBosalt = function () { state.flushes++; };
  ogrenciEsitlemePlanla = function (gecikme, zorla) { state.syncs.push([gecikme, zorla]); };`);

// A regular alt-tab keeps the current DOM, field contents, focus, and view untouched.
const original = field('draft', 'typed before alt-tab');
original.selectionStart = 4; original.selectionEnd = 10;
nodes.draft = original; context.document.activeElement = original;
context.window.scrollX = 17; context.window.scrollY = 231;
context.document.visibilityState = 'hidden'; visibility();
assertEq(state.flushes, 1, 'hidden transition must flush pending teacher backup');
context.document.visibilityState = 'visible'; visibility();
assertEq(state.redraws, 0, 'same-day return must not redraw the app');
assertEq(context.document.activeElement, original, 'same-day return must preserve focus');
assertEq([context.window.scrollX, context.window.scrollY], [17, 231], 'same-day return must preserve scroll');
assertEq(state.syncs, [[0, true]], 'student return must still force background sync');

// Sunday → Monday while entering several result rows: inputs intentionally have no ids,
// so the safe behavior is to leave the DOM alone. A rating button is represented by a
// selected class/value on the same draft screen and must survive for the same reason.
run(`EK.sekme = 'giris'; D.ayar.testTarih = '2026-09-13';`);
const dogru1 = field('', '7'), soru1 = field('', '12'), dogru2 = field('', '');
const rating2 = { id: '', value: 'Zor', classList: { contains(name) { return name === 'secili'; }, add() {}, remove() {} } };
nodes.dogru1 = dogru1; nodes.soru1 = soru1; nodes.dogru2 = dogru2; nodes.rating2 = rating2;
context.document.activeElement = dogru1; context.window.scrollX = 9; context.window.scrollY = 804;
context.document.visibilityState = 'hidden'; visibility();
run(`D.ayar.testTarih = '2026-09-14';`);
context.document.visibilityState = 'visible'; visibility();
assertEq(state.redraws, 0, 'result draft must not redraw across a week boundary');
assertEq([dogru1.value, soru1.value, dogru2.value, rating2.value], ['7', '12', '', 'Zor'],
  'all score/rating drafts must remain in the existing DOM');
assertEq(context.document.activeElement, dogru1, 'result draft must preserve focus');
assertEq([context.window.scrollX, context.window.scrollY], [9, 804], 'result draft must preserve scroll');
assertEq(state.syncs, [[0, true], [0, true]], 'rollover must retain forced background sync');

// Saving the still-visible Sunday form on Monday must use its bound Sunday week and
// rendered plan. Both rows retain their original dates; only the old snapshot freezes,
// and completing it opens the newly-current week rather than skipping one week ahead.
const oldWeek = run("gunNo('2026-09-07')"), oldSunday = oldWeek + 6;
run(`D.ayar.testTarih='2026-09-13'; EK.sekme='giris'; EK.hafta=null;
  D.islenis[0]=${oldWeek - 3}; D.islenis[1]=${oldWeek - 2}; gorunumGiris();`);
const rows = [resultRow(0, oldSunday, 'numeric', 7), resultRow(1, oldSunday, 'rating', 2)];
context.document.querySelectorAll = selector => selector === '[data-sonuc-row]' ? rows : [];
run("D.ayar.testTarih='2026-09-14'; kaydet=async()=>true");
const save = { id: 'sonucKaydet', dataset: { sonucOgr: '0', sonucHafta: String(oldWeek) },
  classList: { contains() { return false; } },
  closest(sel) { return sel.includes('#sonucKaydet') ? this : null; } };
await events.click[0]({ target: save });
assertEq(run('D.log.map(l=>[l[0],l[2],l[3],l[4],l[5]])'),
  [[oldSunday,0,7,12,2],[oldSunday,1,null,null,2]], 'rollover save must retain both original DOM dates');
assert.equal(!!run('elleAl(0,' + oldWeek + ').sabit'), true, 'the rendered Sunday plan must freeze');
assert.equal(!!run('elleAl(0,' + (oldWeek + 7) + ').sabit'), false, 'the Monday plan must not freeze by mistake');
assertEq([run('EK.hafta'), run('EK.sekme')], [oldWeek + 7, 'plan'], 'completion must open the current week');
state.redraws = 0;

// Settings and an open topic modal are also editing surfaces; neither may be replaced.
run(`EK.sekme = 'ayarlar'; D.ayar.testTarih = '2026-09-13';`);
context.document.visibilityState = 'hidden'; visibility(); run(`D.ayar.testTarih = '2026-09-14';`);
context.document.visibilityState = 'visible'; visibility();
assertEq(state.redraws, 0, 'settings edit must not redraw across rollover');
run(`EK.sekme = 'plan'; PENCERE = { g: 0, s: 0 }; D.ayar.testTarih = '2026-09-13';`);
context.document.visibilityState = 'hidden'; visibility(); run(`D.ayar.testTarih = '2026-09-14';`);
context.document.visibilityState = 'visible'; visibility();
assertEq(state.redraws, 0, 'open modal edit must not redraw across rollover');

// Once the plan is idle, rollover refreshes the date-sensitive view and keeps scroll.
run(`PENCERE = null; EK.sekme = 'plan'; D.ayar.testTarih = '2026-09-13';`);
context.window.scrollX = 4; context.window.scrollY = 310;
context.document.visibilityState = 'hidden'; visibility(); run(`D.ayar.testTarih = '2026-09-14';`);
context.document.visibilityState = 'visible'; visibility();
assertEq(state.redraws, 1, 'idle plan must refresh after rollover');
assertEq([context.window.scrollX, context.window.scrollY], [4, 310], 'idle plan must preserve scroll');

console.log(JSON.stringify({ passed: 18, checks: [
  'hidden-flush', 'same-day-no-redraw', 'same-day-focus', 'same-day-scroll', 'same-day-sync',
  'result-rollover-no-redraw', 'result-score-drafts', 'result-focus', 'result-scroll', 'rollover-sync',
  'rollover-save-original-dates', 'rollover-save-old-snapshot', 'rollover-save-current-snapshot-untouched', 'rollover-save-navigation',
  'settings-rollover-no-redraw', 'modal-rollover-no-redraw', 'idle-rollover-redraw', 'idle-rollover-scroll'
] }, null, 2));
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
