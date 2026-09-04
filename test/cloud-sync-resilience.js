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
  return { sandbox, run: code => vm.runInContext(code, sandbox), listeners };
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
  let signInAnonymouslyImpl = () => Promise.reject(new Error('not mocked'));
  const calls = { signInAnonymously: 0 };
  const initOrder = [];
  let appCheckOptions = null;
  const sandbox = {
    console,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 15)),   // gerçek 15sn'yi testte beklememek için sıkıştırılmış
    clearTimeout, crypto,
    window: {},
    initializeApp: () => { initOrder.push('app'); return {}; },
    initializeAppCheck: (_, options) => { initOrder.push('app-check'); appCheckOptions = options; return {}; },
    ReCaptchaEnterpriseProvider: function ReCaptchaEnterpriseProvider(key) { this.key = key; },
    getAuth: () => { initOrder.push('auth'); return authObj; },
    signInAnonymously: (...args) => { calls.signInAnonymously++; return signInAnonymouslyImpl(...args); },
    signInWithPopup: () => Promise.reject(new Error('not mocked in this harness')),
    GoogleAuthProvider: function GoogleAuthProvider() {},
    getFirestore: () => { initOrder.push('firestore'); return {}; },
    doc: () => {}, getDoc: () => {}, setDoc: () => {}, updateDoc: () => {}, runTransaction: () => {}
  };
  vm.createContext(sandbox);
  new vm.Script(modSource, { filename: target + '(module)' }).runInContext(sandbox);
  return { sandbox, authObj, calls, initOrder, getAppCheckOptions: () => appCheckOptions,
    setImpl: fn => { signInAnonymouslyImpl = fn; } };
}

test('enterprise-app-check-starts-before-auth-and-firestore', () => {
  const { initOrder, getAppCheckOptions } = loadModuleSandbox();
  equal(initOrder.join(','), 'app,app-check,auth,firestore');
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
  let yazilan = null, ref = null;
  sandbox.window.bulut = baseBulut({
    yapilandirilmis: true,
    setDoc: async (r, data) => { ref = r; yazilan = data; }
  });
  const r = await run('bulutaYedekle()');
  equal(r.tur, 'tamam', 'expected tamam: ' + JSON.stringify(r));
  equal(ref, 'teacher-uid', 'backup must be written under the teacher own UID');
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

// ================================================================== özet
(async () => {
  for (const t of pending) await t();
  console.log(JSON.stringify({ passed: results.filter(r => r.ok).length, total: results.length, results }, null, 2));
  process.exitCode = results.some(r => !r.ok) ? 1 : 0;
})();
