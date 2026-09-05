#!/usr/bin/env node
'use strict';
// Dependency-free, vm-based tests for the Firebase home-sync code (oncedenAyir,
// bulutYuvasiCoz, bulutBaglantisiniSifirla, sunucudanCek, syncIdSagla, the .ogrPaket/
// #bulutBaglan handlers, gorunumAyarlar's #bulutGonder gate, and girisOgrenci). Mirrors
// test/role-regression.js's extraction pattern — no Playwright/browser dependency.

const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');

// ---------------------------------------------------------------- ana uygulama sandbox'ı
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const appSource = html.slice(start, boot);

function element() {
  return {
    style: {}, hidden: false, textContent: '', innerHTML: '', value: '', checked: false,
    classList: { contains() { return false; }, add() {}, remove() {} }, dataset: {},
    setAttribute() {}, appendChild() {}, click() {}, remove() {}, focus() {}, select() {},
    getClientRects() { return [1]; }, closest() { return null; }
  };
}

function loadAppSandbox() {
  const listeners = {};
  const nodes = {
    ray: { innerHTML: '' }, ana: { innerHTML: '' },
    stil: { textContent: 'body{}' }, uygulama: { textContent: appSource }, veri: { textContent: 'null' }
  };
  const store = {};
  const sandbox = {
    console, setTimeout, clearTimeout, Blob, URL, URLSearchParams, crypto,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl,
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    fetch: async () => ({ ok: false }),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: {},
    window: { scrollTo() {}, open() { return null; }, addEventListener() {}, bulut: null },
    document: {
      activeElement: null,
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      contains() { return true; },
      getElementById(id) { return nodes[id] || null; },
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === '.oRutin' ? (nodes.__routines || []) : []; },
      createElement() { return element(); },
      body: { appendChild() {}, insertAdjacentHTML(_where, markup) { this.lastHTML = markup; } }
    }
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  new vm.Script(appSource, { filename: target }).runInContext(sandbox);
  return { sandbox, run: code => vm.runInContext(code, sandbox), listeners, nodes };
}

function resetOgr(sandbox, ogrList, role) {
  vm.runInContext(
    `D = varsayilan(); D.rol = ${JSON.stringify(role || 'rehber')}; D.kurum = 'Test Lisesi'; ` +
    `D.ogr = ${JSON.stringify(ogrList)};`,
    sandbox
  );
}

const student = (extra) => Object.assign({ no: 1, ad: 'Ada', alan: 'SAY', sube: '12A', hedef: null }, extra || {});

// ---------------------------------------------------------------- test koşucusu
// test() yalnızca KAYDEDER — sırayla ÇALIŞTIRMA dosyanın en altındaki tek async
// döngüde olur, aksi halde await'lenmeyen çağrılar iç içe geçip sandbox'ları paylaşırdı.
const results = [];
const pending = [];
function test(name, fn) {
  pending.push(async () => {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: String((e && e.stack) || e) }); }
  });
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function equal(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'mismatch') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }

// aktif bir "ogrenciler" belgesi taklidi
function docSnap(exists, data) { return { exists: () => exists, data: () => data }; }

function baseBulut(overrides) {
  return Object.assign({
    db: {},
    doc: (db, coll, id) => id,
    mevcutKullanici: () => ({ uid: 'teacher-uid', isAnonymous: false }),
    girisOgretmen: async () => ({ uid: 'teacher-uid', isAnonymous: false, email: 't@x.com' })
  }, overrides || {});
}

// ================================================================== (a) oncedenAyir idempotent
test('oncedenAyir-idempotent-no-rewrite', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'b1' })]);
  let exists = false, setDocCalls = 0, lastPayload = null;
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(exists, exists ? { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', bagliUid: null, paket: null, durum: 'aktif' } : undefined),
    setDoc: async (ref, data) => { setDocCalls++; lastPayload = data; exists = true; }
  });
  const r1 = await run('oncedenAyir(0)');
  const r2 = await run('oncedenAyir(0)');
  assert(r1.tur === 'tamam', 'first call should create: ' + JSON.stringify(r1));
  assert(r2.tur === 'zatenVar', 'second call should be a no-op: ' + JSON.stringify(r2));
  equal(setDocCalls, 1, 'setDoc must be called exactly once');
  assert(lastPayload.ogrenciBulutId === 'b1', 'create payload must carry ogrenciBulutId');
});

// ================================================================== (b) 27969ca regression: re-download never touches an existing binding
test('ogrPaket-redownload-never-touches-existing-binding', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'b1' })]);
  let setDocCalls = 0;
  const boundDoc = { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A',
    ogrenciBulutId: 'b1', bagliUid: 'student-device-uid', paket: { tur: 'yks-sonuc', kayit: [] }, durum: 'aktif' };
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(true, boundDoc),
    setDoc: async () => { setDocCalls++; }
  });
  sandbox.indir = async () => true;
  const target = Object.assign(element(), { dataset: { i: '0' }, closest(sel) { return sel === '.ogrPaket' ? this : null; } });
  await listeners.click[0]({ target });
  equal(setDocCalls, 0, 'a plain re-download must never write to an already-bound slot');
  equal(boundDoc.bagliUid, 'student-device-uid', 'binding must be untouched');
  equal(boundDoc.paket.kayit, [], 'paket must be untouched');
});

// ================================================================== (c)/(d) bulutYuvasiCoz import-before-advance
test('bulutYuvasiCoz-import-before-advance-success', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'old', ogrenciBulutId: 'b1' })]);
  let savedSyncId = null;
  const docs = {
    old: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'iptal', sonrakiSyncId: 'new', bagliUid: 'u1',
      paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 5, k: 3, d: 8, s: 10, t: 1 }], konular: {} } },
    new: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const r = await run('bulutYuvasiCoz(0)');
  assert(!r.hata, 'unexpected hata: ' + r.hata);
  equal(r.syncId, 'new', 'should resolve to the active document');
  const logLen = run('D.log.length');
  assert(logLen === 1, 'the pending package must have been imported into D.log');
  const oSyncId = run('D.ogr[0].syncId');
  equal(oSyncId, 'new', 'o.syncId must have advanced');
});

test('bulutYuvasiCoz-never-advances-past-unimportable-package', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'old', ogrenciBulutId: 'b1' })]);
  const docs = {
    old: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'iptal', sonrakiSyncId: 'new', bagliUid: 'u1',
      paket: { tur: 'yks-sonuc', surum: 2, kayit: 'NOT-AN-ARRAY', konular: {} } },
    new: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const r = await run('bulutYuvasiCoz(0)');
  assert(r.hata, 'malformed kayit must be reported as hata, not silently skipped');
  const oSyncId = run('D.ogr[0].syncId');
  equal(oSyncId, 'old', 'o.syncId must stay on the old id, not silently advance');
});

// ================================================================== (e) hop cap + cycle detection
test('bulutYuvasiCoz-hop-cap-returns-consistent-pair', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'h0', ogrenciBulutId: 'b1' })]);
  const docs = {};
  for (let i = 0; i < 51; i++) {
    docs['h' + i] = { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'iptal', sonrakiSyncId: 'h' + (i + 1), bagliUid: null, paket: null };
  }
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const r = await run('bulutYuvasiCoz(0)');
  assert(r.hata, 'hop cap must produce an hata');
  equal(r.anlik, null, 'anlik must be null on hop-cap abort, never a stale earlier hop');
});

test('bulutYuvasiCoz-cycle-detection', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'a', ogrenciBulutId: 'b1' })]);
  const docs = {
    a: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'iptal', sonrakiSyncId: 'b', bagliUid: null, paket: null },
    b: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'iptal', sonrakiSyncId: 'a', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const r = await run('bulutYuvasiCoz(0)');
  assert(r.hata && /döngü/.test(r.hata), 'a cycle must be reported via the cycle message, not the hop cap');
});

// ================================================================== (f) bulutBaglantisiniSifirla via mocked transaction
test('bulutBaglantisiniSifirla-single-transaction-delegates-import', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'old', ogrenciBulutId: 'b1' })]);
  const docs = {
    old: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: 'stu-old', paket: null }
  };
  let txCalls = 0;
  let txDb = null;
  sandbox.window.bulut = baseBulut({
    getDoc: async (id) => docSnap(!!docs[id], docs[id]),
    runTransaction: async (db, cb) => {
      txCalls++;
      txDb = db;
      const tx = {
        get: async (ref) => docSnap(!!docs[ref], docs[ref]),
        update: (ref, data) => { Object.assign(docs[ref], data); },
        set: (ref, data) => { docs[ref] = data; }
      };
      return cb(tx);
    }
  });
  const r = await run('bulutBaglantisiniSifirla(0)');
  assert(r.tur === 'tamam', 'expected tamam: ' + JSON.stringify(r));
  equal(txCalls, 1, 'runTransaction must be called exactly once');
  assert(txDb === sandbox.window.bulut.db, 'runTransaction must receive the Firestore db as its first argument');
  assert(docs.old.durum === 'iptal' && docs.old.sonrakiSyncId, 'old doc must be frozen with a successor pointer');
  const newId = docs.old.sonrakiSyncId;
  assert(docs[newId] && docs[newId].durum === 'aktif' && docs[newId].ogrenciBulutId === 'b1', 'new doc must carry the same ogrenciBulutId');
  const oSyncId = run('D.ogr[0].syncId');
  equal(oSyncId, newId, 'o.syncId must have advanced to the new document via bulutYuvasiCoz, not duplicated logic');
});

// ================================================================== (g) kaydet(false) reverts, retry re-invokes kaydet
test('bulutYuvasiCoz-reverts-on-failed-save-and-retries', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'old', ogrenciBulutId: 'b1' })]);
  const docs = {
    old: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'iptal', sonrakiSyncId: 'new', bagliUid: null,
      paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 3, d: 5, s: 10, t: 1 }], konular: {} } },
    new: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  let kaydetCalls = 0;
  sandbox.kaydet = async () => { kaydetCalls++; return false; };
  const r1 = await run('bulutYuvasiCoz(0)');
  assert(r1.hata, 'a failed save must surface as hata, not silently tamam');
  equal(run('D.ogr[0].syncId'), 'old', 'syncId must revert to its pre-attempt value on save failure');
  equal(kaydetCalls, 1, 'kaydet must have been invoked once');
  sandbox.kaydet = async () => { kaydetCalls++; return true; };
  const r2 = await run('bulutYuvasiCoz(0)');
  assert(!r2.hata, 'retry should succeed: ' + r2.hata);
  equal(kaydetCalls, 2, 'kaydet must actually be invoked again on retry, not skipped');
  equal(run('D.log.length'), 1, 'no duplicate D.log rows from the idempotent re-import');
});

// ================================================================== (h) sunucudanCek resilience (ported from Playwright test)
test('sunucudanCek-resilience-getdoc-fail-bad-row-untouched', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [
    student({ no: 1, ad: 'Ogrenci Basarili', syncId: 'sync-ok', ogrenciBulutId: 'b1' }),
    student({ no: 2, ad: 'Ogrenci GetDocHatali', syncId: 'sync-getdoc-fail', ogrenciBulutId: 'b2' }),
    student({ no: 3, ad: 'Ogrenci BozukSatir', syncId: 'sync-bad-row', ogrenciBulutId: 'b3' }),
    student({ no: 4, ad: 'Ogrenci HicSenkron', syncId: 'sync-untouched', ogrenciBulutId: 'b4' })
  ]);
  const docs = {
    'sync-ok': { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ogrenci Basarili', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'aktif', bagliUid: 'stu1', paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 5, d: 8, s: 10, t: 1 }], konular: {} } },
    'sync-bad-row': { ogretmenUid: 'teacher-uid', ogrenciNo: 3, ogrenciAd: 'Ogrenci BozukSatir', ogrenciSube: '12A', ogrenciBulutId: 'b3',
      durum: 'aktif', bagliUid: 'stu3', paket: { tur: 'yks-sonuc', surum: 2, kayit: [null], konular: {} } },
    'sync-untouched': { ogretmenUid: 'teacher-uid', ogrenciNo: 4, ogrenciAd: 'Ogrenci HicSenkron', ogrenciSube: '12A', ogrenciBulutId: 'b4',
      durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({
    getDoc: async (id) => {
      if (id === 'sync-getdoc-fail') throw new Error('ağ hatası (simüle)');
      return docSnap(!!docs[id], docs[id]);
    }
  });
  const rapor = await run('sunucudanCek()');
  const success = rapor.find(r => r.ad === 'Ogrenci Basarili');
  const getDocFail = rapor.find(r => r.hata && r.hata.includes('Ogrenci GetDocHatali'));
  const badRow = rapor.find(r => r.hata && r.hata.includes('Ogrenci BozukSatir'));
  const untouchedAbsent = !rapor.find(r => (r.ad || '').includes('HicSenkron') || (r.hata || '').includes('HicSenkron'));
  assert(success, 'successful student must be processed');
  assert(getDocFail, 'getDoc failure must be surfaced, not silently skipped');
  assert(badRow, 'malformed row must be surfaced per-student, loop must not abort');
  assert(untouchedAbsent, 'untouched student (no paket yet) must be absent from the report');
  equal(run('D.log.length'), 1, 'only the successful student’s result should merge into D.log');
});

// ================================================================== (i) paket present, kayit non-array -> hata (via sunucudanCek's own guard too)
test('sunucudanCek-reports-non-array-kayit-as-hata', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'b1' })]);
  const docs = { s1: { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
    durum: 'aktif', bagliUid: 'stu1', paket: { tur: 'yks-sonuc', surum: 2, kayit: 'nope', konular: {} } } };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const rapor = await run('sunucudanCek()');
  assert(rapor.length === 1 && rapor[0].hata, 'non-array kayit must be reported as hata');
});

test('sunucudanCek-keeps-validated-target-after-roster-identity-edit', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ no: 99, ad: 'Yeni Ad', sube: '12B', syncId: 's1', ogrenciBulutId: 'b1' })]);
  const docs = {
    s1: { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Eski Ad', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'aktif', bagliUid: 'stu1', paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 5, d: 8, s: 10, t: 1 }], konular: {} } }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const rapor = await run('sunucudanCek()');
  assert(rapor.length === 1 && !rapor[0].hata, 'a roster rename/renumber must not break an already-validated cloud link: ' + JSON.stringify(rapor));
  equal(rapor[0].ad, 'Yeni Ad', 'the result must be reported under the current local identity');
  equal(run('D.log.length'), 1, 'the cloud result must be imported');
  equal(run('D.log[0][1]'), 0, 'the result must be written to the validated local student index');
});

test('sunucudanCek-duplicate-numbers-use-validated-cloud-target', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [
    student({ no: 7, ad: 'Hedef Ogrenci', sube: '12A', syncId: 's1', ogrenciBulutId: 'b1' }),
    student({ no: 7, ad: 'Baska Ogrenci', sube: '12B' })
  ]);
  const docs = {
    s1: { ogretmenUid: 'teacher-uid', ogrenciNo: 7, ogrenciAd: 'Hedef Ogrenci', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'aktif', bagliUid: 'stu1', paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 5, d: 7, s: 10, t: 1 }], konular: {} } }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const rapor = await run('sunucudanCek()');
  assert(rapor.length === 1 && !rapor[0].hata, 'duplicate student numbers must not make a validated cloud target ambiguous: ' + JSON.stringify(rapor));
  equal(run('D.log.length'), 1, 'the cloud result must be imported exactly once');
  equal(run('D.log[0][1]'), 0, 'the result must belong to the student whose stable cloud id was validated');
});

test('bulutYuvasiCoz-old-package-uses-validated-target-with-duplicate-numbers', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [
    student({ no: 7, ad: 'Hedef Ogrenci', sube: '12A', syncId: 'old', ogrenciBulutId: 'b1' }),
    student({ no: 7, ad: 'Baska Ogrenci', sube: '12B' })
  ]);
  const docs = {
    old: { ogretmenUid: 'teacher-uid', ogrenciNo: 7, ogrenciAd: 'Hedef Ogrenci', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'iptal', sonrakiSyncId: 'new', bagliUid: 'stu1',
      paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 5, d: 9, s: 10, t: 1 }], konular: {} } },
    new: { ogretmenUid: 'teacher-uid', ogrenciNo: 7, ogrenciAd: 'Hedef Ogrenci', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const sonuc = await run('bulutYuvasiCoz(0)');
  assert(!sonuc.hata, 'a pending package in a rotated slot must use the already-validated target: ' + JSON.stringify(sonuc));
  equal(run('D.ogr[0].syncId'), 'new', 'the cloud pointer must advance after the import');
  equal(run('D.log.length'), 1, 'the pending result must be imported');
  equal(run('D.log[0][1]'), 0, 'the pending result must belong to the validated student');
});

// ================================================================== (j) .ogrPaket handler: final syncId, honest file-only fallback
test('ogrPaket-package-carries-post-resolution-syncId', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'stale', ogrenciBulutId: 'b1' })]);
  // oncedenAyir/bulutYuvasiCoz resolves the pointer to a NEWER syncId as a side effect.
  const docs = {
    stale: { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1',
      durum: 'iptal', sonrakiSyncId: 'fresh', bagliUid: null, paket: null },
    fresh: { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  let captured = null;
  sandbox.indir = async (adi, icerik) => { captured = JSON.parse(icerik); return true; };
  const target = Object.assign(element(), { dataset: { i: '0' }, closest(sel) { return sel === '.ogrPaket' ? this : null; } });
  await listeners.click[0]({ target });
  assert(captured, 'indir must have been called');
  equal(captured.syncId, 'fresh', 'downloaded package must carry the FINAL, post-resolution syncId, never the stale one');
  equal(captured.ogr.syncId, 'fresh', 'embedded ogr snapshot must also carry the final syncId');
});

test('ogrPaket-strips-syncId-when-reservation-not-ready', async () => {
  for (const bulutMock of [
    baseBulut({ getDoc: async () => { throw new Error('boom'); } }),
    null
  ]) {
    const { sandbox, run, listeners } = loadAppSandbox();
    resetOgr(sandbox, [student({})]);   // no syncId yet
    sandbox.window.bulut = bulutMock;
    let captured = null;
    sandbox.indir = async (adi, icerik) => { captured = JSON.parse(icerik); return true; };
    const target = Object.assign(element(), { dataset: { i: '0' }, closest(sel) { return sel === '.ogrPaket' ? this : null; } });
    await listeners.click[0]({ target });
    assert(captured, 'indir must have been called');
    assert(!('syncId' in captured), 'file must not advertise a syncId when the slot was never reserved');
    assert(!(captured.ogr && 'syncId' in captured.ogr), 'embedded ogr snapshot must not carry syncId either');
  }
});

// ================================================================== (o) oncedenAyir concurrent-first-reservation race
test('oncedenAyir-concurrent-create-race-loser-detects-winner', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'b1' })]);
  let firstGetDocCall = true, setDocAttempts = 0;
  sandbox.window.bulut = baseBulut({
    getDoc: async () => {
      if (firstGetDocCall) { firstGetDocCall = false; return docSnap(false, undefined); }
      return docSnap(true, { ogretmenUid: 'teacher-uid', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: null, paket: null });
    },
    setDoc: async () => { setDocAttempts++; throw new Error('permission-denied (simulated race loss)'); }
  });
  const r = await run('oncedenAyir(0)');
  equal(r.tur, 'zatenVar', 'the loser of a concurrent create race must resolve to zatenVar, not hata: ' + JSON.stringify(r));
  equal(setDocAttempts, 1, 'setDoc should only be attempted once');
});

test('oncedenAyir-concurrent-create-race-real-failure-not-masked', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'b1' })]);
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(false, undefined),
    setDoc: async () => { throw new Error('permission-denied (genuine failure)'); }
  });
  const r = await run('oncedenAyir(0)');
  equal(r.tur, 'hata', 'a genuine failure (doc still absent after retry) must not be masked as zatenVar');
});

// ================================================================== (p) bulutBaglantisiniSifirla zatenBos + hata not swallowed
test('bulutBaglantisiniSifirla-zatenBos-surfaces-followup-hata', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'old', ogrenciBulutId: 'b1' })]);
  let getDocCalls = 0;
  sandbox.window.bulut = baseBulut({
    getDoc: async () => {
      getDocCalls++;
      // coz1 (pre-transaction check) sees an active, bound doc so the transaction is attempted...
      if (getDocCalls === 1) return docSnap(true, { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'aktif', bagliUid: 'u1', paket: null });
      // ...but the follow-up bulutYuvasiCoz after zatenBos fails (simulated broken chain).
      return docSnap(true, { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'iptal', sonrakiSyncId: null, bagliUid: 'u1', paket: null });
    },
    runTransaction: async () => ({ zatenBos: true })
  });
  const r = await run('bulutBaglantisiniSifirla(0)');
  equal(r.tur, 'kismenTamam', 'a zatenBos transaction whose follow-up bulutYuvasiCoz fails must surface as kismenTamam, not silently zatenBos: ' + JSON.stringify(r));
});

// ================================================================== (q) broken-chain vs never-provisioned distinction
test('bulutYuvasiCoz-never-provisioned-is-not-an-error', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'nope', ogrenciBulutId: 'b1' })]);
  sandbox.window.bulut = baseBulut({ getDoc: async () => docSnap(false, undefined) });
  const r = await run('bulutYuvasiCoz(0)');
  equal(r.hata, null, 'a never-provisioned slot (first hop missing) must not be reported as hata');
});

test('bulutYuvasiCoz-broken-chain-mid-hop-is-an-error', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'first', ogrenciBulutId: 'b1' })]);
  const docs = {
    first: { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'b1', durum: 'iptal', sonrakiSyncId: 'missing', bagliUid: null, paket: null }
  };
  sandbox.window.bulut = baseBulut({ getDoc: async (id) => docSnap(!!docs[id], docs[id]) });
  const r = await run('bulutYuvasiCoz(0)');
  assert(r.hata && /kırık/.test(r.hata), 'a document missing mid-chain must be reported as a broken chain, not treated as unprovisioned');
});

// ================================================================== (r) ogrenciBulutId mismatch guard
test('bulutYuvasiCoz-rejects-ogrenciBulutId-mismatch', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1', ogrenciBulutId: 'expected' })]);
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(true, { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'DIFFERENT', durum: 'aktif', bagliUid: null, paket: null })
  });
  const r = await run('bulutYuvasiCoz(0)');
  assert(r.hata, 'an ogrenciBulutId mismatch must be reported as hata');
  equal(run('D.ogr[0].syncId'), 's1', 'syncId must not advance on a mismatch');
});

test('bulutYuvasiCoz-accepts-missing-local-ogrenciBulutId-legacy-record', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1' })]);   // no ogrenciBulutId locally (legacy record)
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(true, { ogretmenUid: 't', ogrenciNo: 1, ogrenciAd: 'Ada', ogrenciSube: '12A', ogrenciBulutId: 'anything', durum: 'aktif', bagliUid: null, paket: null })
  });
  const r = await run('bulutYuvasiCoz(0)');
  equal(r.hata, null, 'a locally-missing ogrenciBulutId must not itself trigger a mismatch (legacy record path)');
});

// ================================================================== (s) #bulutGonder gating (Fix K)
test('bulutGonder-hidden-without-syncId-shown-with-it', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({})], 'ogrenci');
  sandbox.window.bulut = { yapilandirilmis: true };
  const withoutSyncId = run('gorunumAyarlar()');
  assert(!/id="bulutGonder"/.test(withoutSyncId), 'bulutGonder must be hidden when the package has no syncId');
  resetOgr(sandbox, [student({ syncId: 's1' })], 'ogrenci');
  sandbox.window.bulut = { yapilandirilmis: true };
  const withSyncId = run('gorunumAyarlar()');
  assert(/id="bulutGonder"/.test(withSyncId), 'bulutGonder must be shown once both yapilandirilmis and syncId are present');
});

// ================================================================== (t) lazy ogrenciBulutId persists before any Firestore write
test('oncedenAyir-persists-lazy-ogrenciBulutId-before-write', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1' })]);   // legacy: syncId set, ogrenciBulutId absent
  let kaydetCalls = 0, setDocCalls = 0, setDocPayload = null;
  const realKaydet = sandbox.kaydet;
  sandbox.kaydet = async (...args) => { kaydetCalls++; return realKaydet(...args); };
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(false, undefined),
    setDoc: async (ref, data) => { setDocCalls++; setDocPayload = data; }
  });
  const r = await run('oncedenAyir(0)');
  assert(r.tur === 'tamam', 'expected tamam: ' + JSON.stringify(r));
  assert(kaydetCalls >= 1, 'kaydet must be invoked to persist the lazily-generated ogrenciBulutId');
  const localId = run('D.ogr[0].ogrenciBulutId');
  assert(localId, 'o.ogrenciBulutId must have been generated');
  equal(setDocPayload.ogrenciBulutId, localId, 'the value written to Firestore must match what ended up persisted locally');
});

test('oncedenAyir-skips-write-when-lazy-persist-fails', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 's1' })]);
  sandbox.kaydet = async () => false;
  let setDocCalls = 0;
  sandbox.window.bulut = baseBulut({
    getDoc: async () => docSnap(false, undefined),
    setDoc: async () => { setDocCalls++; }
  });
  const r = await run('oncedenAyir(0)');
  equal(r.tur, 'hata', 'a failed local save must be reported as hata');
  equal(setDocCalls, 0, 'a document must never be created under an id that could not be durably remembered locally');
});

// ================================================================== (k) girisOgrenci: dedup, retry-on-reject, no permanent stale cache
const modStart = html.indexOf('<script type="module">') + '<script type="module">'.length;
const modEnd = html.indexOf('</script>', modStart);
const modSourceRaw = html.slice(modStart, modEnd);
const modSource = modSourceRaw.split('\n').filter(line => !/^\s*import\s/.test(line)).join('\n');

function loadModuleSandbox() {
  const authObj = { currentUser: null };
  const secondaryAuthObj = { currentUser: null };
  let authCall = 0;
  let signInAnonymouslyImpl = () => Promise.reject(new Error('not mocked'));
  const calls = { signInAnonymously: 0 };
  const initOrder = [];
  let appCheckOptions = null;
  const sandbox = {
    console,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 15)),   // gerçek 15sn'yi testte beklememek için sıkıştırılmış
    clearTimeout, crypto, TextEncoder,
    window: {},
    initializeApp: () => { initOrder.push('app'); return {}; },
    initializeAppCheck: (_, options) => { initOrder.push('app-check'); appCheckOptions = options; return {}; },
    ReCaptchaEnterpriseProvider: function ReCaptchaEnterpriseProvider(key) { this.key = key; },
    getAuth: () => { initOrder.push('auth'); return authCall++ === 0 ? authObj : secondaryAuthObj; },
    signInAnonymously: (...args) => { calls.signInAnonymously++; return signInAnonymouslyImpl(...args); },
    signInWithPopup: () => Promise.reject(new Error('not mocked in this harness')),
    signInWithEmailAndPassword: () => Promise.reject(new Error('not mocked in this harness')),
    createUserWithEmailAndPassword: () => Promise.reject(new Error('not mocked in this harness')),
    GoogleAuthProvider: function GoogleAuthProvider() {},
    getFirestore: () => { initOrder.push('firestore'); return {}; },
    doc: () => {}, getDoc: () => {}, setDoc: () => {}, updateDoc: () => {}, runTransaction: () => {},
    collection: () => {}, getDocs: async () => ({ forEach() {} })
  };
  vm.createContext(sandbox);
  new vm.Script(modSource, { filename: target + '(module)' }).runInContext(sandbox);
  return { sandbox, authObj, calls, initOrder, getAppCheckOptions: () => appCheckOptions,
    setImpl: fn => { signInAnonymouslyImpl = fn; } };
}

test('enterprise-app-check-starts-before-auth-and-firestore', () => {
  const { initOrder, getAppCheckOptions } = loadModuleSandbox();
  equal(initOrder.join(','), 'app,app-check,auth,firestore,app,auth');
  const options = getAppCheckOptions();
  assert(options && options.provider instanceof Object, 'Enterprise App Check provider must be configured');
  assert(options.provider.key && !options.provider.key.includes('YER-TUTUCU'), 'Enterprise site key must be real');
  equal(options.isTokenAutoRefreshEnabled, true);
});

test('girisOgrenci-dedups-concurrent-in-flight-calls', async () => {
  const { sandbox, authObj, calls, setImpl } = loadModuleSandbox();
  let resolveFn;
  setImpl(() => new Promise(res => { resolveFn = res; }).then(user => { authObj.currentUser = user; return { user }; }));
  const p1 = vm.runInContext('girisOgrenci()', sandbox);
  const p2 = vm.runInContext('girisOgrenci()', sandbox);
  resolveFn({ uid: 'anon1', isAnonymous: true });
  const [u1, u2] = await Promise.all([p1, p2]);
  equal(calls.signInAnonymously, 1, 'a second concurrent call must reuse the in-flight promise');
  equal(u1.uid, 'anon1'); equal(u2.uid, 'anon1');
});

test('girisOgrenci-live-anonymous-user-skips-network-call', async () => {
  const { sandbox, authObj, calls, setImpl } = loadModuleSandbox();
  setImpl(async () => { authObj.currentUser = { uid: 'anon1', isAnonymous: true }; return { user: authObj.currentUser }; });
  const first = await vm.runInContext('girisOgrenci()', sandbox);
  equal(first.uid, 'anon1');
  equal(calls.signInAnonymously, 1);
  const second = await vm.runInContext('girisOgrenci()', sandbox);
  equal(second.uid, 'anon1');
  equal(calls.signInAnonymously, 1, 'an already-anonymous live session must be returned directly, no extra network call');
});

test('girisOgrenci-rejects-and-retries', async () => {
  const { sandbox, calls, setImpl } = loadModuleSandbox();
  setImpl(async () => { throw new Error('ağ hatası'); });
  let firstError = null;
  try { await vm.runInContext('girisOgrenci()', sandbox); } catch (e) { firstError = e; }
  assert(firstError, 'a rejected sign-in must reject the returned promise');
  equal(calls.signInAnonymously, 1);
  let secondError = null;
  try { await vm.runInContext('girisOgrenci()', sandbox); } catch (e) { secondError = e; }
  assert(secondError, 'a subsequent call must retry, not stay rejected forever');
  equal(calls.signInAnonymously, 2, 'signInAnonymously must be invoked again on retry, not served from a dead cached promise');
});

test('girisOgrenci-timeout-then-clean-retry', async () => {
  const { sandbox, calls, setImpl } = loadModuleSandbox();
  setImpl(() => new Promise(() => {}));   // never resolves -> must hit the (compressed) timeout
  let timeoutError = null;
  try { await vm.runInContext('girisOgrenci()', sandbox); } catch (e) { timeoutError = e; }
  assert(timeoutError && /zaman aşımı/.test(timeoutError.message), 'expected the timeout message, got: ' + timeoutError);
  setImpl(async () => ({ user: { uid: 'anon1', isAnonymous: true } }));
  const user = await vm.runInContext('girisOgrenci()', sandbox);
  equal(user.uid, 'anon1', 'a call after a timeout must still retry cleanly');
});

test('girisOgrenci-does-not-return-stale-user-after-role-switch', async () => {
  // Regression: "Verileri sıfırla" resets D.rol WITHOUT a reload, so the same tab/auth
  // instance can go anonymous -> (in-place role switch) -> real Google session. A
  // permanently-cached resolved promise would then wrongly hand back the old anonymous user.
  const { sandbox, authObj, calls, setImpl } = loadModuleSandbox();
  setImpl(async () => { authObj.currentUser = { uid: 'anon1', isAnonymous: true }; return { user: authObj.currentUser }; });
  const first = await vm.runInContext('girisOgrenci()', sandbox);
  equal(first.uid, 'anon1');
  // Simulate girisOgretmen()'s real effect on the shared auth instance (signInWithPopup
  // replaces auth.currentUser with the real Google session).
  authObj.currentUser = { uid: 'teacher1', isAnonymous: false };
  setImpl(async () => { authObj.currentUser = { uid: 'anon2', isAnonymous: true }; return { user: authObj.currentUser }; });
  const second = await vm.runInContext('girisOgrenci()', sandbox);
  equal(second.uid, 'anon2', 'must not return the stale anon1 reference; must re-authenticate since the live session was non-anonymous');
  equal(calls.signInAnonymously, 2, 'the role-switch must force a fresh signInAnonymously call, not reuse the old cache');
});

// ================================================================== öğretmenin bulut yedeği
test('bulutaYedekle-writes-whole-notebook-as-json-string', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ ad: 'Ada' }), student({ no: 2, ad: 'Deniz' })]);
  const cagrilar = [];
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    setDoc: async (r, data) => { cagrilar.push({ ref: r, data: data }); }
  });
  const r = await run('bulutaYedekle()');
  equal(r.tur, 'tamam', 'expected tamam: ' + JSON.stringify(r));
  const canli = cagrilar.find(c => c.ref.indexOf('gecmis/') < 0);
  const ref = canli.ref, yazilan = canli.data;
  equal(ref, 'ogretmenYedek/teacher-uid', 'backup must be written under the teacher own UID');
  assert(typeof yazilan.veri === 'string', 'veri must be a JSON STRING (Firestore rejects nested arrays)');
  const geri = JSON.parse(yazilan.veri);
  equal(geri.ogr.length, 2, 'the whole roster must be in the backup');
  assert(Number.isSafeInteger(yazilan.ts) && yazilan.ts > 0, 'ts must be a positive integer');
  equal(yazilan.boyut, yazilan.veri.length, 'boyut must match the payload length');
  assert(Object.keys(yazilan).sort().join(',') === 'boyut,surum,ts,veri',
    'payload must carry exactly the fields the rules allow: ' + Object.keys(yazilan).join(','));
});

test('bulutaYedekle-refuses-when-not-connected-or-not-teacher', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({})]);
  let setDocCalls = 0;
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    mevcutKullanici: () => ({ uid: 'anon', isAnonymous: true }),
    setDoc: async () => { setDocCalls++; }
  });
  equal((await run('bulutaYedekle()')).tur, 'baglanilmadi', 'anonymous session must not upload a teacher backup');
  // öğrenci rolündeki bir cihaz asla öğretmen yedeği yazmamalı
  resetOgr(sandbox, [student({})], 'ogrenci');
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, setDoc: async () => { setDocCalls++; } });
  equal((await run('bulutaYedekle()')).tur, 'yok', 'student role must never upload a teacher backup');
  equal(setDocCalls, 0, 'no write may be attempted in either case');
});

test('bulutaYedekle-refuses-oversized-notebook', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({})]);
  let setDocCalls = 0;
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, setDoc: async () => { setDocCalls++; } });
  run('D.kurum = "x".repeat(BULUT_YEDEK_UST_SINIR + 10);');
  const r = await run('bulutaYedekle()');
  equal(r.tur, 'hata', 'an oversized notebook must be reported, not silently truncated or rejected by Firestore');
  assert(/KB/.test(r.mesaj), 'the message should tell the teacher how big it got: ' + r.mesaj);
  equal(setDocCalls, 0, 'no doomed write may be attempted');
});

test('buluttanYedekAl-reads-missing-and-corrupt-cases', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({})]);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, getDoc: async () => docSnap(false, undefined) });
  equal((await run('buluttanYedekAl()')).tur, 'yok', 'no cloud backup yet must read as yok, not an error');
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, getDoc: async () => docSnap(true, { veri: '{bozuk', ts: 1 }) });
  equal((await run('buluttanYedekAl()')).tur, 'hata', 'corrupt JSON must be reported');
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, getDoc: async () => docSnap(true, { veri: { nesne: 1 }, ts: 1 }) });
  equal((await run('buluttanYedekAl()')).tur, 'hata', 'a non-string veri field must be reported');
  const gecerli = JSON.stringify({ rol: 'rehber', ogr: [{ ad: 'Ada' }, { ad: 'Silinmis', silindi: true }] });
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, getDoc: async () => docSnap(true, { veri: gecerli, ts: 1750000000000 }) });
  const ok = await run('buluttanYedekAl()');
  equal(ok.tur, 'tamam');
  equal(ok.ts, 1750000000000, 'ts must survive the round trip');
  equal(run('yedekOgrenciSayisi(' + JSON.stringify(JSON.parse(gecerli)) + ')'), 1, 'deleted students must not be counted');
});

test('rolRehber-restores-cloud-backup-after-google-sign-in', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  run('D = varsayilan(); D.rol = null;');   // kurulum ekranı durumu
  const yedek = run(`(() => {
    D = varsayilan(); D.rol = 'rehber'; D.kurum = 'Karamürsel';
    D.ogr = [{no:1,ad:'Ada',alan:'SAY',sube:'201',hedef:null},{no:2,ad:'Deniz',alan:'EA',sube:'301',hedef:null}];
    const s = JSON.stringify(D); D = varsayilan(); D.rol = null; return s;
  })()`);
  let girisSayisi = 0;
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    girisOgretmen: async () => { girisSayisi++; return { uid: 'teacher-uid', isAnonymous: false, email: 'x@y.com' }; },
    getDoc: async () => docSnap(true, { veri: yedek, ts: 1750000000000 }),
    setDoc: async () => {}
  });
  let sorulan = '';
  sandbox.confirm = (m) => { sorulan = m; return true; };
  sandbox.prompt = () => { throw new Error('kurum adı sorulmamalıydı — yedek geri yüklendi'); };
  const target = Object.assign(element(), { closest(sel) { return sel.indexOf('#rolRehber') >= 0 ? this : null; } });
  await listeners.click[0]({ target });
  equal(girisSayisi, 1, 'clicking the teacher role must trigger the Google sign-in itself');
  assert(/2 öğrenci/.test(sorulan), 'the confirmation must say how many students are coming back: ' + sorulan);
  const sonuc = run('({ rol: D.rol, kurum: D.kurum, ogr: D.ogr.length, sekme: EK.sekme })');
  equal(sonuc.rol, 'rehber'); equal(sonuc.kurum, 'Karamürsel');
  equal(sonuc.ogr, 2, 'the cloud roster must be restored');
});

test('rolRehber-falls-back-to-normal-setup-when-no-backup-or-sign-in-fails', async () => {
  for (const senaryo of ['yedek-yok', 'giris-basarisiz']) {
    const { sandbox, run, listeners } = loadAppSandbox();
    run('D = varsayilan(); D.rol = null;');
    sandbox.window.bulut = baseBulut({
      yapilandirilmis: true,
      girisOgretmen: async () => {
        if (senaryo === 'giris-basarisiz') throw new Error('popup kapatıldı');
        return { uid: 'teacher-uid', isAnonymous: false, email: 'x@y.com' };
      },
      getDoc: async () => docSnap(false, undefined),
      setDoc: async () => {}
    });
    let promptSorusu = 0;
    sandbox.prompt = () => { promptSorusu++; return 'Yeni Okul'; };
    const target = Object.assign(element(), { closest(sel) { return sel.indexOf('#rolRehber') >= 0 ? this : null; } });
    await listeners.click[0]({ target });
    equal(promptSorusu, 1, senaryo + ': normal kuruluma düşmeliydi');
    equal(run('D.rol'), 'rehber', senaryo + ': rol yine de öğretmen olmalı');
    equal(run('D.kurum'), 'Yeni Okul', senaryo + ': girilen kurum adı kaydedilmeli');
  }
});

test('rolRehber-keeps-local-data-when-restore-is-declined-or-broken', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  run('D = varsayilan(); D.rol = null;');
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    girisOgretmen: async () => ({ uid: 'teacher-uid', isAnonymous: false, email: 'x@y.com' }),
    // şema doğrulamasından geçmeyecek bir yedek: veriyiHazirla fırlatmalı, D bozulmamalı
    getDoc: async () => docSnap(true, { veri: JSON.stringify({ rol: 'rehber', ogr: 'dizi-degil' }), ts: 1 }),
    setDoc: async () => {}
  });
  sandbox.confirm = () => true;
  let uyari = '';
  sandbox.alert = (m) => { uyari = m; };
  sandbox.prompt = () => 'Yedek Okulu';
  const target = Object.assign(element(), { closest(sel) { return sel.indexOf('#rolRehber') >= 0 ? this : null; } });
  await listeners.click[0]({ target });
  assert(/yüklenemedi|okunamadı/.test(uyari), 'a broken cloud backup must be reported: ' + uyari);
  equal(run('D.rol'), 'rehber', 'the teacher must still end up set up locally');
  equal(run('D.kurum'), 'Yedek Okulu', 'the normal setup must continue after a failed restore');
  assert(Array.isArray(run('D.ogr')), 'D must not be left holding the invalid backup');
});

test('student-name-number-login-downloads-package-without-confirmation', async () => {
  const { sandbox, run, listeners, nodes } = loadAppSandbox();
  resetOgr(sandbox, [student({ no: 42, ad: 'Ada Öğrenci', syncId: 'student-sync', ogrenciBulutId: 'cloud-1' })]);
  const paket = run('ogrenciPaketi(0)');
  run('D = varsayilan(); D.rol = null;');
  nodes.ogrenciGirisAd = Object.assign(element(), { value: 'Ada Öğrenci' });
  nodes.ogrenciGirisNo = Object.assign(element(), { value: '42' });
  nodes.ogrenciGirisDurum = element();
  let giris = null, confirmSayisi = 0;
  sandbox.confirm = () => { confirmSayisi++; return true; };
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    girisOgrenciHesabi: async (ad, no) => { giris = { ad, no }; return { uid: 'student-account-42' }; },
    getDoc: async () => docSnap(true, { aktif: true, veri: JSON.stringify(paket), syncId: 'student-sync' }),
    setDoc: async () => {}
  });
  const target = Object.assign(element(), {
    id: 'ogrenciBulutGiris',
    closest(sel) { return sel === '#ogrenciBulutGiris' ? this : null; }
  });
  await listeners.click[0]({ target });
  equal(giris, { ad: 'Ada Öğrenci', no: 42 }, 'visible credentials must be passed to Firebase Auth');
  equal(confirmSayisi, 0, 'a successful student login must not ask before loading the package');
  equal(run('D.rol'), 'ogrenci', 'the downloaded package must switch to student mode');
  equal(run('D.ogr[0].no'), 42, 'the downloaded package must belong to the selected student');
});

test('teacher-publishes-one-private-package-and-sync-slot-per-student', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [
    student({ no: 11, ad: 'Bir Öğrenci' }),
    student({ no: 12, ad: 'İki Öğrenci', alan: 'EA', sube: '12B' })
  ]);
  const writes = [];
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    doc: (_db, coll, id) => coll + '/' + id,
    ogrenciHesabiHazirla: async (_ad, no) => ({ uid: 'account-' + no }),
    getDoc: async () => docSnap(false, undefined),
    setDoc: async (ref, data) => { writes.push({ ref, data }); },
    updateDoc: async () => { throw new Error('new slots must not need update'); }
  });
  const rapor = await run('ogrenciHesaplariniYayinla()');
  equal(rapor.filter(r => r.tamam).length, 2, 'both students must be published');
  const hesaplar = writes.filter(w => w.ref.startsWith('ogrenciHesaplari/'));
  const yuvalar = writes.filter(w => w.ref.startsWith('ogrenciler/'));
  equal(hesaplar.length, 2, 'one private package document per student');
  equal(yuvalar.length, 2, 'one result sync slot per student');
  hesaplar.forEach(w => {
    const pk = JSON.parse(w.data.veri);
    assert(pk.tur === 'yks-ogrenci-paketi', 'server data must use the validated student package format');
    assert(pk.ogr && pk.ogr.hesapUid, 'package must carry its own account UID');
    assert(w.data.syncId === pk.syncId, 'account package and result slot must share syncId');
  });
  yuvalar.forEach(w => {
    assert(/^account-/.test(w.data.bagliUid), 'published result slot must be pre-bound to the selected account');
  });
});


test('permission-denied-is-explained-not-shown-raw', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  run('D = varsayilan(); D.rol = null;');
  const izinHatasi = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    girisOgretmen: async () => ({ uid: 'teacher-uid', isAnonymous: false, email: 'x@y.com' }),
    getDoc: async () => { throw izinHatasi; },
    setDoc: async () => { throw izinHatasi; }
  });
  equal((await run('buluttanYedekAl()')).tur, 'izinYok', 'a permission error must be classified, not passed through raw');
  run("D.rol = 'rehber';");   // yükleme yolu yalnızca öğretmen rolünde çalışır
  const yukleme = await run('bulutaYedekle()');
  assert(/yayınlanmamış|ogretmenler/.test(yukleme.mesaj || ''), 'upload must explain the likely cause: ' + yukleme.mesaj);
  run('D.rol = null;');       // kurulum ekranı durumuna geri dön
  let uyari = '';
  sandbox.alert = (m) => { uyari = m; };
  sandbox.prompt = () => 'Okul';
  const target = Object.assign(element(), { closest(sel) { return sel.indexOf('#rolRehber') >= 0 ? this : null; } });
  await listeners.click[0]({ target });
  assert(!/insufficient permissions/i.test(uyari), 'the raw Firebase string must not be what the teacher sees: ' + uyari);
  assert(/Rules|ogretmenler/.test(uyari), 'the alert must name what to check: ' + uyari);
  equal(run('D.rol'), 'rehber', 'setup must still complete locally');
});

test('save-schedules-a-cloud-backup-that-actually-uploads', async () => {
  const { sandbox, run } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1] = null; };
  resetOgr(sandbox, [student({})]);
  const uploads = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, doc: (db, ...yol) => yol.join('/'),
    setDoc: async (ref, d) => { uploads.push({ ref, boyut: d.boyut }); } });
  await run('kaydet(true)');
  const bekleyen = timers.filter(Boolean).filter(t => t.ms === run('BULUT_YEDEK_GECIKME'));
  equal(bekleyen.length, 1, 'a save must schedule exactly one backup upload');
  equal(uploads.length, 0, 'nothing may be uploaded before the delay elapses');
  await bekleyen[0].fn();
  await new Promise(r => setImmediate(r));   // bulutYedekDene() ateşle-unut; mikrogörevler bitsin
  // canlı yedek + o günün kopyası
  equal(uploads.filter(u => u.ref.indexOf('gecmis/') < 0).length, 1, 'the scheduled timer must actually perform the upload');
  equal(uploads.filter(u => u.ref.indexOf('gecmis/') >= 0).length, 1, 'and also record the day snapshot');
  equal(uploads[0].ref, 'ogretmenYedek/teacher-uid', 'upload must go to the teacher own backup doc');
  await run('kaydet(true)');
  assert(timers.filter(Boolean).some(t => t.ms === run('BULUT_YEDEK_GECIKME')), 'a later save must schedule again');
});

test('hiding-the-tab-flushes-a-pending-backup-immediately', async () => {
  const { sandbox, run } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1] = null; };
  resetOgr(sandbox, [student({})]);
  const uploads = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, setDoc: async () => { uploads.push(1); } });
  await run('kaydet(true)');
  equal(uploads.length, 0, 'still pending');
  await run('bulutYedekBosalt()');
  await new Promise(r => setImmediate(r));
  equal(uploads.length, 2, 'closing/hiding the tab must send the pending backup (live + day copy), not drop it');
  // bekleyen yoksa boşaltmak boşuna yazmamalı
  await run('bulutYedekBosalt()');
  await new Promise(r => setImmediate(r));
  equal(uploads.length, 2, 'flushing with nothing pending must not write again');
});

test('manual-backup-button-uploads-and-reports', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({})]);
  const uploads = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, doc: (db, ...yol) => yol.join('/'),
    setDoc: async (ref, d) => { uploads.push({ ref, boyut: d.boyut }); } });
  const dugme = Object.assign(element(), { id: 'bulutYedekle',
    closest(sel) { return sel.indexOf('#bulutYedekle') >= 0 ? this : null; } });
  await listeners.click[0]({ target: dugme });
  equal(uploads.filter(u => u.ref.indexOf('gecmis/') < 0).length, 1, 'the manual button must upload immediately, with no waiting');
  equal(uploads[0].ref, 'ogretmenYedek/teacher-uid');
  const gorunum = run("D.rol='rehber'; gorunumAyarlar()");
  assert(/id="bulutYedekle"/.test(gorunum), 'the button must be rendered for a connected teacher');
  assert(/Bulut yedeği:/.test(gorunum), 'settings must show the backup status line');
});

test('failed-automatic-backup-is-recorded-not-swallowed', async () => {
  // Asıl tehlike: sessiz başarısızlık. Öğretmen "yedeğim var" sanıp bulutta hiçbir şey olmaması.
  const { sandbox, run } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1] = null; };
  resetOgr(sandbox, [student({})]);
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    setDoc: async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); }
  });
  await run('kaydet(true)');
  const bekleyen = timers.filter(Boolean).filter(t => t.ms === run('BULUT_YEDEK_GECIKME'));
  await bekleyen[0].fn();
  await new Promise(r => setImmediate(r));
  const hata = run('EK.bulutYedekHata');
  assert(hata, 'a failed automatic upload must be recorded somewhere the teacher can see it');
  assert(/yayınlanmamış|ogretmenler/.test(hata), 'and it must explain the likely cause: ' + hata);
  const gorunum = run('gorunumAyarlar()');
  assert(/son deneme başarısız/.test(gorunum), 'settings must show the failure, not claim everything is fine');
  // sonraki başarılı yükleme uyarıyı temizlemeli
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true, setDoc: async () => {} });
  await run('bulutaYedekle()');
  equal(run('EK.bulutYedekHata'), '', 'a later success must clear the warning');
  assert(run('!!EK.bulutYedekTs'), 'and record when it succeeded');
});

// ================================================================== günlük yedek geçmişi
test('backup-also-writes-a-dated-daily-snapshot', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({}), student({ no: 2, ad: 'Deniz' })]);
  const yazilan = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    setDoc: async (ref, d) => { yazilan.push({ ref, d }); } });
  const r = await run('bulutaYedekle()');
  equal(r.tur, 'tamam');
  equal(yazilan.length, 2, 'one live backup plus one dated daily snapshot');
  const bugun = run('isoDan(bugunNo())');
  const gunluk = yazilan.find(y => y.ref.indexOf('gecmis/') >= 0);
  assert(gunluk, 'a daily snapshot must be written: ' + JSON.stringify(yazilan.map(y => y.ref)));
  equal(gunluk.ref, 'ogretmenYedek/teacher-uid/gecmis/' + bugun, 'snapshot id must be today date');
  equal(gunluk.d.ogrenciSayisi, 2, 'snapshot must carry the student count for the listing');
  assert(Object.keys(gunluk.d).sort().join(',') === 'boyut,ogrenciSayisi,sonucSayisi,surum,ts,veri',
    'snapshot fields must match what the rules allow: ' + Object.keys(gunluk.d).join(','));
});

test('daily-snapshot-failure-does-not-fail-the-main-backup', async () => {
  // Asıl yedek yazıldıysa gün kopyası yazılamadı diye başarısız sayılmamalı.
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({})]);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    setDoc: async (ref) => { if (ref.indexOf('gecmis/') >= 0) throw new Error('gün kopyası yazılamadı'); } });
  equal((await run('bulutaYedekle()')).tur, 'tamam', 'the main backup must still count as done');
});

test('stalled-teacher-backup-returns-a-timeout-status', async () => {
  const { sandbox, run } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].cleared = true; };
  resetOgr(sandbox, [student({})]);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    setDoc: () => new Promise(() => {})
  });
  const islem = run('bulutaYedekle()');
  const sure = timers.find(t => t.ms === run('BULUT_YAZMA_ZAMAN_ASIMI'));
  assert(sure, 'the teacher live-backup write must have a deadline');
  sure.fn();
  const sonuc = await islem;
  equal(sonuc.tur, 'hata');
  assert(/zamanında onay alamadı/.test(sonuc.mesaj), 'the timeout must be visible in backup status');
});

// ================================================================== otomatik öğrenci sonucu senkronizasyonu
test('event-only-upload-does-not-replace-a-populated-package', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  let payload = null, signIns = 0;
  const eskiPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 90, k: 4, d: 8, s: 10, t: 1 }] };
  const sunucu = { paket: JSON.parse(JSON.stringify(eskiPaket)) };
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    girisOgrenci: async () => { signIns++; return { uid: 'student-uid' }; },
    updateDoc: async (_ref, data) => { payload = data; Object.assign(sunucu, data); }
  });
  const adet = await run("sunucuyaGonder({tur:'plan-baslatildi',hafta:100,toplam:7})");
  equal(adet, 0, 'a plan event may be sent with zero result rows');
  equal(signIns, 1, 'the student must authenticate before the automatic write');
  assert(payload && payload.bagliUid === 'student-uid', 'the write must stay bound to the signed-in student');
  equal(payload.istemciOlay.tur, 'plan-baslatildi');
  equal(payload.istemciOlay.hafta, 100);
  equal(payload.istemciOlay.toplam, 7);
  assert(Number.isSafeInteger(payload.istemciOlay.ts), 'the event must have an integer timestamp');
  assert(!Object.prototype.hasOwnProperty.call(payload, 'paket'),
    'an event-only update must omit paket instead of sending an empty result snapshot');
  equal(sunucu.paket, eskiPaket, 'the populated server package must survive the event-only patch unchanged');
});

test('manual-sunucuyaGonder-still-skips-empty-results', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  let writes = 0, signIns = 0;
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    girisOgrenci: async () => { signIns++; return { uid: 'student-uid' }; },
    updateDoc: async () => { writes++; }
  });
  equal(await run('sunucuyaGonder()'), 0);
  equal(signIns, 0, 'an empty manual retry need not authenticate');
  equal(writes, 0, 'an empty manual retry must not overwrite the server record');
});

test('automatic-cloud-sync-is-student-only-and-keeps-permission-errors-nonfatal', async () => {
  const { sandbox, run } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'rehber');
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true });
  equal((await run("ogrenciBulutOtomatikGonder({tur:'plan-baslatildi',hafta:100})")).tur, 'atlan',
    'teacher actions must not enter the student upload path');

  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    girisOgrenci: async () => ({ uid: 'student-uid' }),
    updateDoc: async () => { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; }
  });
  const sonuc = await run("ogrenciBulutOtomatikGonder({tur:'plan-baslatildi',hafta:100})");
  equal(sonuc.tur, 'hata', 'the local button flow must receive a status, not a thrown error');
  assert(/izni reddedildi/.test(sonuc.mesaj), 'the raw Firebase permission text must be translated: ' + JSON.stringify(sonuc));
});

test('planiSabitle-click-triggers-automatic-server-write', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  run(`EK.ogr = 0; otomatikOlay = null; bildirimler = [];
    haftayiKullanimaAl = () => 4;
    kaydet = async () => true;
    ciz = () => {};
    bilgiVer = m => { bildirimler.push(m); };
    ogrenciBulutOtomatikGonder = async o => { otomatikOlay = o; return {tur:'tamam',adet:0}; };`);
  const target = Object.assign(element(), { id: 'planiSabitle',
    closest(sel) { return sel.indexOf('#planiSabitle') >= 0 ? this : null; } });
  await listeners.click[0]({ target });
  equal(run('otomatikOlay.tur'), 'plan-baslatildi');
  equal(run('otomatikOlay.toplam'), 4);
  const bildirimler = run('bildirimler');
  assert(/cihazda kaydedildi/.test(bildirimler[0]), 'local success must be shown before upload status');
  assert(/Sunucuya otomatik gönderildi/.test(bildirimler[1]), 'the student must see successful auto-sync status');
});

test('sonucKaydet-click-triggers-automatic-server-write', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  const gun = run('bugunNo()');
  const soru = { value: '10' };
  const dogru = Object.assign(element(), { value: '8', dataset: { ki: '0', gun: String(gun) },
    parentElement: { querySelector: () => soru } });
  sandbox.document.querySelectorAll = selector => selector === '.gDogru' ? [dogru] : [];
  run(`EK.ogr = 0; otomatikOlay = null; bildirimler = [];
    sonucIsle = (si, kayitlar) => { const k = kayitlar[0]; D.log.push([k.gun,si,k.ki,k.dogru,k.soru,1,k.guncellemeTs]); };
    kaydet = async () => true;
    ciz = () => {};
    bilgiVer = m => { bildirimler.push(m); };
    ogrenciBulutOtomatikGonder = async o => { otomatikOlay = o; return {tur:'tamam',adet:1}; };`);
  const target = Object.assign(element(), { id: 'sonucKaydet',
    closest(sel) { return sel.indexOf('#sonucKaydet') >= 0 ? this : null; } });
  await listeners.click[0]({ target });
  equal(run('otomatikOlay.tur'), 'sonuclar-kaydedildi');
  equal(run('otomatikOlay.toplam'), 1);
  equal(run('D.log.length'), 1, 'the result must be applied locally before upload');
  const bildirimler = run('bildirimler');
  assert(/1 sonuç cihazda kaydedildi/.test(bildirimler[0]), 'local result success must be shown first');
  assert(/Sunucuya otomatik gönderildi/.test(bildirimler[1]), 'cloud success must be shown separately');
});

test('stalled-upload-does-not-block-the-local-save', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].cleared = true; };
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  const hb = run('haftaBasi()'), gun = run('bugunNo()');
  const soru = { value: '10' };
  const dogru = Object.assign(element(), { value: '8', dataset: { ki: '0', gun: String(gun) },
    parentElement: { querySelector: () => soru } });
  sandbox.document.querySelectorAll = selector => selector === '.gDogru' ? [dogru] : [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    girisOgrenci: async () => ({ uid: 'student-uid' }),
    updateDoc: () => new Promise(() => {})
  });
  run(`EK.ogr = 0; bildirimler = []; cizSayisi = 0;
    sonucIsle = (si, kayitlar) => { const k = kayitlar[0]; D.log.push([k.gun,si,k.ki,k.dogru,k.soru,1,k.guncellemeTs]); };
    kaydet = async () => true;
    ciz = () => { cizSayisi++; };
    bilgiVer = m => { bildirimler.push(m); };`);
  const target = Object.assign(element(), { id: 'sonucKaydet',
    closest(sel) { return sel.indexOf('#sonucKaydet') >= 0 ? this : null; } });
  const islem = listeners.click[0]({ target });
  for (let i = 0; i < 8; i++) await Promise.resolve();

  equal(run('cizSayisi'), 1, 'the result view must redraw before server acknowledgement');
  equal(run('EK.hafta'), hb + 7, 'the week must advance while the network write is still pending');
  assert(/1 sonuç cihazda kaydedildi/.test(run('bildirimler[0]')),
    'local confirmation must be visible while upload is pending');
  const sure = timers.find(t => t.ms === run('BULUT_YAZMA_ZAMAN_ASIMI'));
  assert(sure, 'the pending updateDoc must have a deadline');
  sure.fn();
  await islem;
  assert(/20 saniye/.test(run('bildirimler[bildirimler.length - 1]')),
    'the later status must explain the acknowledgement timeout');
});

test('failed-local-save-is-not-reported-as-success', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  const hb = run('haftaBasi()'), gun = run('bugunNo()');
  const soru = { value: '10' };
  const dogru = Object.assign(element(), { value: '8', dataset: { ki: '0', gun: String(gun) },
    parentElement: { querySelector: () => soru } });
  sandbox.document.querySelectorAll = selector => selector === '.gDogru' ? [dogru] : [];
  run(`EK.ogr = 0; bildirimler = []; yuklemeSayisi = 0; cizSayisi = 0;
    sonucIsle = (si, kayitlar) => { const k = kayitlar[0]; D.log.push([k.gun,si,k.ki,k.dogru,k.soru,1,k.guncellemeTs]); };
    kaydet = async () => false;
    ciz = () => { cizSayisi++; };
    bilgiVer = m => { bildirimler.push(m); };
    ogrenciBulutOtomatikGonder = async () => { yuklemeSayisi++; return {tur:'tamam'}; };`);
  const target = Object.assign(element(), { id: 'sonucKaydet',
    closest(sel) { return sel.indexOf('#sonucKaydet') >= 0 ? this : null; } });
  await listeners.click[0]({ target });

  equal(run('yuklemeSayisi'), 0, 'cloud upload must not run after local persistence fails');
  equal(run('EK.hafta'), null, 'a failed local save must not advance away from the entered results');
  equal(run('cizSayisi'), 1, 'the status rail and in-memory result must still redraw');
  const mesaj = run('bildirimler[bildirimler.length - 1]');
  assert(/kaydedilemedi/.test(mesaj) && !/\bkaydedildi\b/.test(mesaj),
    'the toast must not claim success after a failed local save: ' + mesaj);
  equal(hb, run('buHafta()'), 'test setup must begin on the current week');
});

test('result-save-does-not-clobber-navigation-changed-during-local-save', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ syncId: 'student-slot' })], 'ogrenci');
  const hb = run('haftaBasi()'), gun = run('bugunNo()');
  const soru = { value: '10' };
  const dogru = Object.assign(element(), { value: '8', dataset: { ki: '0', gun: String(gun) },
    parentElement: { querySelector: () => soru } });
  sandbox.document.querySelectorAll = selector => selector === '.gDogru' ? [dogru] : [];
  let kaydiBitir;
  const kayitBekliyor = new Promise(resolve => { kaydiBitir = resolve; });
  sandbox.kayitBekliyor = kayitBekliyor;
  run(`EK.ogr = 0; bildirimler = [];
    sonucIsle = (si, kayitlar) => { const k = kayitlar[0]; D.log.push([k.gun,si,k.ki,k.dogru,k.soru,1,k.guncellemeTs]); };
    kaydet = () => kayitBekliyor;
    ciz = () => {};
    bilgiVer = m => { bildirimler.push(m); };
    ogrenciBulutOtomatikGonder = async () => ({tur:'tamam',adet:1});`);
  const target = Object.assign(element(), { id: 'sonucKaydet',
    closest(sel) { return sel.indexOf('#sonucKaydet') >= 0 ? this : null; } });
  const islem = listeners.click[0]({ target });
  run('EK.hafta = ' + (hb - 7) + ';');
  kaydiBitir(true);
  await islem;
  equal(run('EK.hafta'), hb - 7, 'the returning handler must preserve the week chosen during its await');
});

test('history-lists-newest-first-and-restores-a-chosen-day', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({}), student({ no: 2, ad: 'Deniz' })]);
  const eskiDefter = run(`(() => { const k = JSON.parse(JSON.stringify(D));
    k.ogr = [{no:9,ad:'Eski Ogrenci',alan:'SAY',sube:'201',hedef:null}]; k.log = []; return JSON.stringify(k); })()`);
  const gunler = {
    '2026-09-01': { veri: eskiDefter, ts: 1756684800000, boyut: eskiDefter.length, ogrenciSayisi: 1, sonucSayisi: 0 },
    '2026-09-03': { veri: eskiDefter, ts: 1756857600000, boyut: eskiDefter.length, ogrenciSayisi: 1, sonucSayisi: 0 }
  };
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    collection: (db, ...yol) => yol.join('/'),
    getDocs: async () => ({ forEach: (fn) => Object.keys(gunler).forEach(g => fn({ id: g, data: () => gunler[g] })) }),
    getDoc: async (ref) => { const g = String(ref).split('/').pop();
      return { exists: () => !!gunler[g], data: () => gunler[g] }; },
    setDoc: async () => {} });
  const liste = await run('bulutYedekGecmisi()');
  equal(liste.tur, 'tamam');
  equal(liste.liste.map(x => x.gun), ['2026-09-03', '2026-09-01'], 'newest day must come first');
  // Ayarlar geçmişi göstermeli
  run('EK.bulutGecmis = ' + JSON.stringify(liste.liste) + ';');
  const gorunum = run('gorunumAyarlar()');
  assert(/bulutGunYukle/.test(gorunum), 'each day needs a restore button');
  assert(/03\.09\.2026/.test(gorunum), 'the day must be shown in local format: ' + /.{0,40}09\.2026.{0,20}/.exec(gorunum));
  // geri yükleme
  sandbox.confirm = () => true;
  const dugme = Object.assign(element(), { dataset: { gun: '2026-09-01' },
    closest(sel) { return sel === '.bulutGunYukle' ? this : null; } });
  await listeners.click[0]({ target: dugme });
  equal(run('D.ogr.length'), 1, 'the chosen day must replace the current notebook');
  equal(run('D.ogr[0].ad'), 'Eski Ogrenci');
  equal(run('EK.bulutGecmis'), null, 'the stale listing must be cleared after restoring');
});

test('declining-or-failing-a-day-restore-keeps-current-data', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ ad: 'Simdiki' })]);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    getDoc: async () => ({ exists: () => true, data: () => ({ veri: JSON.stringify({ rol: 'rehber', ogr: 'dizi-degil' }), ts: 1 }) }),
    setDoc: async () => {} });
  sandbox.confirm = () => false;
  const dugme = Object.assign(element(), { dataset: { gun: '2026-09-01' },
    closest(sel) { return sel === '.bulutGunYukle' ? this : null; } });
  await listeners.click[0]({ target: dugme });
  equal(run('D.ogr[0].ad'), 'Simdiki', 'declining the confirmation must change nothing');
  // onaylanırsa ama yedek bozuksa da mevcut veri korunmalı
  sandbox.confirm = () => true;
  let uyari = '';
  sandbox.alert = (m) => { uyari = m; };
  await listeners.click[0]({ target: dugme });
  assert(/yüklenemedi/.test(uyari), 'a broken snapshot must be reported: ' + uyari);
  equal(run('D.ogr[0].ad'), 'Simdiki', 'and the current notebook must survive it');
});

test('restore-preserves-current-notebook-before-delayed-backup-replaces-today', async () => {
  // Canlı hata: geri yükleme kaydet(true) çağırır; 10 saniye sonra otomatik yedek hem
  // canlı belgeyi hem bugünün günlük kopyasını geri yüklenen ESKİ veriyle değiştirir.
  // O zaman bugünkü iyi durum yalnızca benzersiz ve değiştirilemez geriNoktalari belgesinde kalmalıdır.
  const { sandbox, run, listeners } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1] = null; };
  resetOgr(sandbox, [student({ ad: 'Bugunku Defter' }), student({ no: 2, ad: 'Yeni Sonuc Sahibi' })]);
  run('D.log = [[100,0,0,8,10,3,1750000000000]]; D.ayar.testTarih = "2026-09-05";');
  const bugunkuJson = run('JSON.stringify(D)');
  const eskiDefter = run(`(() => { const k = JSON.parse(JSON.stringify(D));
    k.ogr = [{no:9,ad:'Eski Defter',alan:'SAY',sube:'201',hedef:null}]; k.log = [];
    return JSON.stringify(k); })()`);
  const yazilan = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    getDoc: async () => ({ exists: () => true,
      data: () => ({ veri: eskiDefter, ts: 1756684800000, boyut: eskiDefter.length,
        ogrenciSayisi: 1, sonucSayisi: 0 }) }),
    setDoc: async (ref, data) => { yazilan.push({ ref, data: JSON.parse(JSON.stringify(data)) }); }
  });
  sandbox.confirm = () => true;
  const dugme = Object.assign(element(), { dataset: { gun: '2026-09-01' },
    closest(sel) { return sel === '.bulutGunYukle' ? this : null; } });
  await listeners.click[0]({ target: dugme });

  equal(run('D.ogr[0].ad'), 'Eski Defter', 'the chosen old snapshot must become the active notebook');
  const koruma = yazilan.find(y => y.ref.indexOf('/geriNoktalari/') >= 0);
  assert(koruma, 'the current notebook must be preserved under a unique restore-point id before mutation');
  equal(koruma.data.veri, bugunkuJson, 'the restore point must contain the exact pre-restore notebook');
  equal(JSON.parse(koruma.data.veri).ogr[0].ad, 'Bugunku Defter');
  assert(!/geriNoktalari\/2026-09-05$/.test(koruma.ref), 'restore point must not reuse the daily date key');
  const bekleyen = timers.filter(Boolean).filter(t => t.ms === run('BULUT_YEDEK_GECIKME'));
  equal(bekleyen.length, 1, 'restoring must still schedule the restored state as the new live backup');

  await bekleyen[0].fn();
  await new Promise(r => setImmediate(r));
  const bugununGunlugu = yazilan.find(y => /\/gecmis\/2026-09-05$/.test(y.ref));
  assert(bugununGunlugu, 'the delayed backup must still update today daily snapshot');
  equal(JSON.parse(bugununGunlugu.data.veri).ogr[0].ad, 'Eski Defter',
    'the test must reproduce the overwrite that previously destroyed today only good copy');
  equal(JSON.parse(koruma.data.veri).ogr[0].ad, 'Bugunku Defter',
    'the immutable restore point must retain today state after the delayed overwrite');
});

test('restore-aborts-before-mutation-when-protection-point-cannot-be-written', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ ad: 'Korunacak Defter' })]);
  const eskiDefter = run(`(() => { const k = JSON.parse(JSON.stringify(D));
    k.ogr = [{no:9,ad:'Eski Defter',alan:'SAY',sube:'201',hedef:null}]; return JSON.stringify(k); })()`);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    getDoc: async () => ({ exists: () => true,
      data: () => ({ veri: eskiDefter, ts: 1, boyut: eskiDefter.length, ogrenciSayisi: 1, sonucSayisi: 0 }) }),
    setDoc: async (ref) => { if (ref.indexOf('/geriNoktalari/') >= 0) throw new Error('koruma yazılamadı'); }
  });
  sandbox.confirm = () => true;
  let uyari = '';
  sandbox.alert = m => { uyari = m; };
  const dugme = Object.assign(element(), { dataset: { gun: '2026-09-01' },
    closest(sel) { return sel === '.bulutGunYukle' ? this : null; } });
  await listeners.click[0]({ target: dugme });
  equal(run('D.ogr[0].ad'), 'Korunacak Defter', 'failed protection must abort before changing D');
  assert(/değiştirilmedi/.test(uyari) && /koruma yazılamadı/.test(uyari),
    'the teacher must be told that restore stopped safely: ' + uyari);
});

test('stalled-protection-write-times-out-before-restore-mutation', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  sandbox.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].cleared = true; };
  resetOgr(sandbox, [student({ ad: 'Korunacak Defter' })]);
  const eskiDefter = run(`(() => { const k = JSON.parse(JSON.stringify(D));
    k.ogr = [{no:9,ad:'Eski Defter',alan:'SAY',sube:'201',hedef:null}]; return JSON.stringify(k); })()`);
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'),
    getDoc: async () => ({ exists: () => true,
      data: () => ({ veri: eskiDefter, ts: 1, boyut: eskiDefter.length, ogrenciSayisi: 1, sonucSayisi: 0 }) }),
    setDoc: () => new Promise(() => {})
  });
  sandbox.confirm = () => true;
  let uyari = '';
  sandbox.alert = m => { uyari = m; };
  const dugme = Object.assign(element(), { dataset: { gun: '2026-09-01' },
    closest(sel) { return sel === '.bulutGunYukle' ? this : null; } });
  const islem = listeners.click[0]({ target: dugme });
  for (let i = 0; i < 6; i++) await Promise.resolve();
  const sure = timers.find(t => t.ms === run('BULUT_YAZMA_ZAMAN_ASIMI'));
  assert(sure, 'the pre-restore protection write must have a deadline');
  sure.fn();
  await islem;
  equal(run('D.ogr[0].ad'), 'Korunacak Defter', 'timeout must abort before changing D');
  assert(/değiştirilmedi/.test(uyari) && /zamanında onay alamadı/.test(uyari),
    'the teacher must see a safe-abort timeout message: ' + uyari);
});

test('restore-point-history-is-visible-and-restores-reversibly', async () => {
  const { sandbox, run, listeners } = loadAppSandbox();
  resetOgr(sandbox, [student({ ad: 'Su Anki Defter' })]);
  const korunanDefter = run(`(() => { const k = JSON.parse(JSON.stringify(D));
    k.ogr = [{no:7,ad:'Korunan Defter',alan:'SAY',sube:'201',hedef:null}]; k.log = [];
    return JSON.stringify(k); })()`);
  const noktalar = {
    'nokta-1757000000000-a': { veri: korunanDefter, ts: 1757000000000, boyut: korunanDefter.length,
      kaynak: '02.09.2026 tarihli günlük yedeğe dönüş', ogrenciSayisi: 1, sonucSayisi: 0 },
    'nokta-1756000000000-b': { veri: korunanDefter, ts: 1756000000000, boyut: korunanDefter.length,
      kaynak: 'eski nokta', ogrenciSayisi: 1, sonucSayisi: 0 }
  };
  const yazilan = [];
  sandbox.window.bulut = baseBulut({ yapilandirilmis: true,
    doc: (db, ...yol) => yol.join('/'), collection: (db, ...yol) => yol.join('/'),
    getDocs: async () => ({ forEach: fn => Object.keys(noktalar).forEach(id =>
      fn({ id, data: () => noktalar[id] })) }),
    getDoc: async ref => { const id = String(ref).split('/').pop();
      return { exists: () => !!noktalar[id], data: () => noktalar[id] }; },
    setDoc: async (ref, data) => { yazilan.push({ ref, data }); }
  });
  const liste = await run('bulutGeriYuklemeNoktalari()');
  equal(liste.liste.map(x => x.id), ['nokta-1757000000000-a', 'nokta-1756000000000-b'],
    'restore points must be newest first');
  run('EK.bulutGecmis = []; EK.bulutGeriNoktalar = ' + JSON.stringify(liste.liste) + ';');
  assert(/bulutGeriNoktaYukle/.test(run('gorunumAyarlar()')),
    'settings must offer an undo button for persisted restore points');

  sandbox.confirm = () => true;
  const dugme = Object.assign(element(), { dataset: { id: 'nokta-1757000000000-a' },
    closest(sel) { return sel === '.bulutGeriNoktaYukle' ? this : null; } });
  await listeners.click[0]({ target: dugme });
  equal(run('D.ogr[0].ad'), 'Korunan Defter', 'the selected protection point must be restorable');
  const yeniKoruma = yazilan.find(y => y.ref.indexOf('/geriNoktalari/') >= 0);
  assert(yeniKoruma && JSON.parse(yeniKoruma.data.veri).ogr[0].ad === 'Su Anki Defter',
    'undoing a restore must first preserve the state it replaces, so the undo is itself reversible');
});

// ================================================================== özet
(async () => {
  for (const t of pending) await t();
  console.log(JSON.stringify({ passed: results.filter(r => r.ok).length, total: results.length, results }, null, 2));
  process.exitCode = results.some(r => !r.ok) ? 1 : 0;
})();
