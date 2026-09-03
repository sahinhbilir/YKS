#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const source = html.slice(start, boot);

const node = () => ({
  innerHTML: '', textContent: '', style: {}, hidden: false,
  setAttribute() {}, appendChild() {}, remove() {}, click() {}, focus() {},
  getClientRects() { return [1]; },
});
const nodes = {
  ray: node(), stil: { textContent: 'body{}' },
  uygulama: { textContent: source }, veri: { textContent: 'null' },
};
const sandbox = {
  console, setTimeout, clearTimeout, Blob, URL, URLSearchParams,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert() {}, confirm() { return true; }, prompt() { return ''; },
  fetch: async () => ({ ok: false }),
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollTo() {}, open() { return null; }, addEventListener() {} },
  document: {
    activeElement: null, addEventListener() {}, contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return node(); },
    body: { appendChild() {}, insertAdjacentHTML() {} },
  },
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(source, { filename: target }).runInContext(sandbox);

const results = vm.runInContext(`(() => {
  const checks = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message || 'assertion failed'); };
  const equal = (actual, expected, message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error((message || 'values differ') + ': ' + JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
  };
  const expectThrow = (fn, pattern) => {
    let error = null;
    try { fn(); } catch (e) { error = e; }
    assert(error, 'expected an error');
    if (pattern) assert(pattern.test(String(error.message || error)), 'unexpected error: ' + (error.message || error));
  };
  const test = (name, fn) => {
    try { fn(); checks.push({ name: name, ok: true }); }
    catch (e) { checks.push({ name: name, ok: false, error: String(e.message || e) }); }
  };
  const student = { no: 42, ad: 'Ada', alan: 'SAY', sube: '12-A', hedef: null };
  const reset = role => {
    D = varsayilan(); D.rol = role || 'rehber'; D.ayar.testTarih = '2026-09-03';
    D.ogr = [JSON.parse(JSON.stringify(student))];
  };
  const day = gunNo('2026-09-01');
  const custom = KATALOG.length;
  const packet = (version, rows, topics) => {
    const p = { tur: 'yks-sonuc', surum: version, katalogImza: KATALOG_IMZA,
      no: 42, ad: 'Ada', sube: '12-A', kayit: rows };
    if (topics !== undefined) p.konular = topics;
    return p;
  };
  const state = () => JSON.stringify({ ekKonular: D.ekKonular, log: D.log, kart: D.kart });

  test('separate-result-package-version', () => {
    assert(SONUC_PAKET_SURUM === 2 && PAKET_SURUM === 1, 'package versions are not independent');
  });

  test('export-includes-custom-topic-metadata', () => {
    reset('ogrenci');
    D.ekKonular.push([0, 12, 'Test', 'Öğrencinin konusu', 0, '']);
    D.log = [[day, 0, custom, 8, 10, 3, 1001]];
    const p = sonucPaketi();
    assert(p.surum === 2, 'wrong result package version');
    equal(p.konular[custom], [0, 'Öğrencinin konusu'], 'custom topic metadata missing');
  });

  test('export-rejects-invalid-local-topic-metadata', () => {
    reset('ogrenci');
    D.ekKonular.push([999, 12, 'Test', 'Bozuk konu', 0, '']);
    D.log = [[day, 0, custom, 8, 10, 3, 1001]];
    expectThrow(() => sonucPaketi(), /geçersiz ders numarası/i);
  });

  test('same-local-index-collision-is-remapped', () => {
    reset();
    D.ekKonular.push([0, 12, 'Teacher', 'Öğretmenin ilgisiz konusu', 0, '']);
    sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]],
      { [custom]: [0, 'Öğrencinin konusu'] }));
    assert(D.ekKonular.length === 2, 'incoming topic was not created separately');
    assert(konuAl(D.log[0][2])[3] === 'Öğrencinin konusu', 'result attached to wrong local topic');
  });

  test('exact-normalized-name-merges', () => {
    reset();
    D.ekKonular.push([0, 12, 'Teacher', 'Aynı Konu', 0, '']);
    sonucPaketiUygula(packet(2, [[day, custom + 50, 8, 10, 1001]],
      { [custom + 50]: [0, '  AYNI   KONU '] }));
    assert(D.ekKonular.length === 1, 'exact normalized topic was duplicated');
    assert(D.log[0][2] === custom, 'result did not use existing exact topic');
  });

  test('prefix-near-miss-stays-separate', () => {
    reset();
    D.ekKonular.push([0, 12, 'Teacher', 'Fonksiyonlarda İşlemler', 0, '']);
    sonucPaketiUygula(packet(2, [[day, custom + 1, 7, 10, 1001]],
      { [custom + 1]: [0, 'Fonksiyonlarda İşlemler ve Uygulamalar'] }));
    assert(D.ekKonular.length === 2, 'prefix near-miss was merged');
  });

  test('same-name-different-subject-stays-separate', () => {
    reset();
    D.ekKonular.push([1, 12, 'Teacher', 'Ortak Konu', 0, '']);
    sonucPaketiUygula(packet(2, [[day, custom + 1, 7, 10, 1001]],
      { [custom + 1]: [2, 'Ortak Konu'] }));
    assert(D.ekKonular.length === 2 && konuAl(D.log[0][2])[0] === 2, 'cross-subject topic was merged');
  });

  test('turkish-letter-collision-stays-separate', () => {
    reset();
    D.ekKonular.push([0, 12, 'Teacher', 'ÇIĞ', 0, '']);
    sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]], { [custom]: [0, 'IŞIĞI'] }));
    assert(D.ekKonular.length === 2, 'lossy Turkish-letter collision was merged');
    assert(konuAl(D.log[0][2])[3] === 'IŞIĞI', 'result attached to Turkish-letter near-match');
  });

  test('out-of-range-subject-is-atomic', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]],
      { [custom]: [999, 'Geçersiz ders'] })), /geçersiz ders numarası/i);
    assert(state() === before, 'invalid subject mutated state');
  });

  test('non-integer-subject-is-atomic', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]],
      { [custom]: ['0', 'Geçersiz ders'] })), /geçersiz ders numarası/i);
    assert(state() === before, 'non-integer subject mutated state');
  });

  test('missing-topic-metadata-is-atomic', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]], {})), /özel konu bilgisi eksik/i);
    assert(state() === before, 'missing topic metadata mutated state');
  });

  test('missing-v2-topic-map-is-rejected', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, 0, 8, 10, 1001]])), /eşleştirme bilgisi yok/i);
    assert(state() === before, 'missing v2 topic map mutated state');
  });

  test('legacy-v1-built-in-topic-imports', () => {
    reset();
    const summary = sonucPaketiUygula(packet(1, [[day, 0, 8, 10, 1001]]));
    assert(summary.eklenen === 1 && D.log.length === 1 && D.log[0][2] === 0, 'safe legacy row did not import');
  });

  test('legacy-v1-custom-topic-fails-loudly', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(1, [[day, custom, 8, 10, 1001]])), /eski sonuç paketi özel konu içeriyor/i);
    assert(state() === before, 'unsafe legacy custom row mutated state');
  });

  test('invalid-sender-topic-id-is-atomic', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, '0', 8, 10, 1001]], {})), /geçersiz konu numarası/i);
    assert(state() === before, 'invalid sender topic id mutated state');
  });

  test('overlong-topic-name-is-atomic', () => {
    reset(); const before = state(), longName = 'x'.repeat(161);
    expectThrow(() => sonucPaketiUygula(packet(2, [[day, custom, 8, 10, 1001]],
      { [custom]: [0, longName] })), /geçersiz konu adı/i);
    assert(state() === before, 'overlong topic name mutated state');
  });

  test('later-malformed-row-is-atomic', () => {
    reset(); const before = state();
    expectThrow(() => sonucPaketiUygula(packet(2,
      [[day, custom, 8, 10, 1001], [day, 0, 11, 10, 1002]],
      { [custom]: [0, 'Yeni konu'] })), /doğru sayısı/i);
    assert(state() === before, 'later malformed row left partial state');
  });

  test('future-package-version-is-rejected', () => {
    reset();
    expectThrow(() => sonucPaketiUygula(packet(3, [[day, 0, 8, 10, 1001]], {})), /uyumlu değil/i);
  });

  test('newest-duplicate-row-wins', () => {
    reset();
    const summary = sonucPaketiUygula(packet(2,
      [[day, 0, 4, 10, 1001], [day, 0, 9, 10, 1002]], {}));
    assert(summary.eklenen === 1 && summary.atlanan === 1, 'duplicate summary is wrong');
    assert(D.log.length === 1 && D.log[0][3] === 9 && D.log[0][6] === 1002, 'newest duplicate did not win');
  });

  return checks;
})()`, sandbox);

results.push({
  name: 'upload-ui-surfaces-unresolved-count',
  ok: html.includes('konu eşleştirilemedi; aktarılmadı'),
  error: html.includes('konu eşleştirilemedi; aktarılmadı') ? undefined : 'upload message hides unresolved rows',
});

const failed = results.filter(x => !x.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, checks: results }, null, 2));
if (failed.length) process.exit(1);
