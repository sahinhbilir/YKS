#!/usr/bin/env node
'use strict';
// Viewing teacher (izleyici öğretmen): opens the owner's notebook read-only, follows its updates
// and the owner's student slots, never writes, and leaves the viewer's own notebook untouched.
// Firebase is an in-memory stand-in; the matching security rules are in test/firebase. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));
const SAHIP = 'sahip-uid-1', IZLEYICI = 'izleyici-uid-1', BASKA = 'baska-ogretmen-1';

function uygulama({ izin = { sahipUid: SAHIP, ad: 'Sentetik Öğretmen' }, kendiDefter = '{"kendi":true}' } = {}) {
  const yerel = new Map(kendiDefter ? [['yks_veri', kendiDefter]] : []), oturum = new Map();
  const depo = m => ({ get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  const belgeler = new Map(), dinleyiciler = new Map(), yazilar = [], durum = { kullanici: { uid: IZLEYICI, isAnonymous: false, email: 'izleyici@example.com' }, yenilendi: 0 };
  if (izin) belgeler.set('izleyiciler/' + IZLEYICI, izin);
  const anlik = (yol, veri) => ({ exists: () => veri !== undefined, data: () => JSON.parse(JSON.stringify(veri)), metadata: { fromCache: false, hasPendingWrites: false } });
  const yaz = ad => async (...a) => { yazilar.push([ad, a[0]]); };
  const bulut = { yapilandirilmis: true, db: {}, doc: (db, ...yol) => yol.join('/'),
    getDocFromServer: async yol => { if (durum.reddet?.has(yol)) throw { code: 'permission-denied' }; return anlik(yol, belgeler.get(yol)); },
    onSnapshot: (yol, a, b, c) => { const [cb, hata] = typeof a === 'function' ? [a, b] : [b, c]; dinleyiciler.set(yol, { cb, hata }); return () => dinleyiciler.delete(yol); },
    mevcutKullanici: () => durum.kullanici, oturumHazir: async () => {}, oturumuKapat: async () => { durum.kullanici = null; },
    setDoc: yaz('setDoc'), updateDoc: yaz('updateDoc'), runTransaction: yaz('runTransaction'), sifreTalepleriAl: async () => { yazilar.push(['sifreTalepleriAl']); return []; } };
  const node = () => ({ innerHTML: '', textContent: '', style: {}, hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {}, click() {}, focus() {}, getClientRects() { return [1]; } });
  const nodes = { ray: node(), ana: node(), stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' } };
  const sandbox = { console, setTimeout, clearTimeout, Blob, URL, URLSearchParams, TextEncoder, location: { search: '?dev=1' }, Date, Math, JSON, Intl,
    alert() {}, confirm() { return true; }, prompt() { return ''; }, fetch: async () => ({ ok: false }), localStorage: depo(yerel), sessionStorage: depo(oturum), navigator: { onLine: true },
    window: { scrollTo() {}, open() { return null; }, addEventListener() {}, bulut, location: { reload() { durum.yenilendi++; } } },
    document: { activeElement: null, addEventListener() {}, contains() { return true; }, getElementById(id) { return nodes[id] || null; }, querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return node(); }, body: { appendChild() {}, insertAdjacentHTML() {}, classList: { add() {}, remove() {} } } } };
  sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
  const run = code => vm.runInContext(code, sandbox);
  // The owner's notebook as the owner's app would back it up.
  run(`D=varsayilan();D.rol='rehber';D.kurum='SENTETİK LİSE';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true,syncId:'sync-1',ogrenciBulutId:'bulut-1'}];
    SAHIP_DEFTERI=JSON.stringify(D);D=varsayilan();EK.sekme='plan';`);
  belgeler.set('ogretmenYedek/' + SAHIP, { veri: run('SAHIP_DEFTERI'), ts: 1, surum: 1, boyut: 1 });
  belgeler.set('ogretmenYedek/' + BASKA, { veri: run('SAHIP_DEFTERI'), ts: 1, surum: 1, boyut: 1 });
  return { run, yerel, oturum, belgeler, dinleyiciler, yazilar, durum, nodes, bulut };
}
const ac = async a => { a.run('KUL=window.bulut.mevcutKullanici()'); return a.run('bulutDefteriniAc(KUL)'); };
let passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('a teacher without a console permission opens their own notebook as before', async () => {
    const a = uygulama({ izin: null });
    assert.equal(await a.run('izlemeHedefiOku(window.bulut.mevcutKullanici())'), null);
    a.durum.reddet = new Set(['izleyiciler/' + IZLEYICI]);   // rules not yet published
    assert.equal(await a.run('izlemeHedefiOku(window.bulut.mevcutKullanici())'), null);
    assert.equal(a.run('yalnizcaGoruntuleme()'), false);
    for (const bad of [{ sahipUid: IZLEYICI }, { sahipUid: '../x' }, { sahipUid: '' }, {}]) {
      a.belgeler.set('izleyiciler/' + IZLEYICI, bad); a.durum.reddet = null;
      assert.equal(await a.run('izlemeHedefiOku(window.bulut.mevcutKullanici())'), null, JSON.stringify(bad));
    }
  });
  await check('with a permission, the owner’s notebook opens read-only and the viewer’s own notebook stays', async () => {
    const a = uygulama();
    assert.equal(await ac(a), true);
    assert.equal(a.run('yalnizcaGoruntuleme()'), true); assert.equal(a.run('D.ogr[0].ad'), 'SENTETİK ADA'); assert.equal(a.run('D.rol'), 'rehber');
    assert.equal(a.run('EK.sekme'), 'takip'); assert.equal(a.yerel.get('yks_veri'), '{"kendi":true}');
    assert.deepEqual(JSON.parse(a.yerel.get('yks_izleme')), { sahipUid: SAHIP, izleyiciUid: IZLEYICI, ad: 'Sentetik Öğretmen' });
    assert.equal(a.yerel.get('yks_izleme_veri'), a.run('SAHIP_DEFTERI'));
    assert(a.nodes.ana.innerHTML.includes('Yalnızca görüntüleme')); assert(a.nodes.ray.innerHTML.includes('>Çıkış yap<'));
    assert(a.dinleyiciler.has('ogretmenYedek/' + SAHIP));
  });
  await check('nothing is saved: no device write, no cloud backup, no Firestore write, no reset-request reads', async () => {
    const a = uygulama(); await ac(a);
    a.run("D.ogr[0].ad='DEĞİŞTİ'");
    assert.equal(await a.run('kaydet(true)'), false); assert.equal(await a.run('kaydet()'), false);
    assert.deepEqual(JSON.parse(JSON.stringify(await a.run('bulutaYedekle()'))), { tur: 'yok' });
    await a.run('bulutYedekDene()'); a.run('window.bulutDegisti()');
    assert.equal(a.yerel.get('yks_veri'), '{"kendi":true}'); assert.equal(a.yerel.get('yks_izleme_veri'), a.run('SAHIP_DEFTERI'));
    await assert.rejects(a.run('denemeOkulYayinla(0)'), /rehber öğretmen/);
    assert.deepEqual(a.yazilar, []);
  });
  await check('the owner’s student slots update the screen; another teacher’s slot is ignored', async () => {
    const a = uygulama(); await ac(a); await new Promise(r => setTimeout(r, 5));
    const slot = a.dinleyiciler.get('ogrenciler/sync-1'); assert(slot, 'student slot is followed');
    const kayit = { id: 'p:okul-1', ad: 'Sentetik okul denemesi', tarih: '2026-09-18', tur: 'TYT', oturum: 'TYT', brans: '', alan: 'SAY', dersler: [{ kod: 'turkce', dogru: 28, yanlis: 8, soru: 40 }], sure: null, puan: 250, ts: 100 };
    const veri = ogretmenUid => ({ exists: () => true, data: () => ({ ogretmenUid, durum: 'aktif', ogrenciBulutId: 'bulut-1', bagliUid: null, paket: null, denemeOkul: JSON.stringify([kayit]) }), metadata: {} });
    slot.cb(veri(IZLEYICI)); assert.equal(a.run('(D.ogr[0].denemeOkul||[]).length'), 0);
    slot.cb(veri(SAHIP)); assert.equal(a.run('D.ogr[0].denemeOkul.length'), 1);
    await new Promise(r => setTimeout(r, 5));
    assert.deepEqual(a.yazilar, []); assert.equal(a.yerel.get('yks_veri'), '{"kendi":true}');
    assert.doesNotMatch(a.run("EK.ogretmenSyncDurum||''"), /kaydedilemedi/, 'viewing does not try to save received work');
  });
  await check('a new backup by the owner replaces the view; an unchanged one does not', async () => {
    const a = uygulama(); await ac(a);
    const izle = a.dinleyiciler.get('ogretmenYedek/' + SAHIP);
    a.run("D.ogr[0].ad='YEREL DEĞİŞİKLİK'"); izle.cb({ exists: () => true, data: () => ({ veri: a.run('SAHIP_DEFTERI') }), metadata: {} });
    assert.equal(a.run('D.ogr[0].ad'), 'YEREL DEĞİŞİKLİK', 'same backup: no redraw');
    const yeni = JSON.parse(a.run('SAHIP_DEFTERI')); yeni.ogr.push({ ...yeni.ogr[0], no: 1002, ad: 'SENTETİK BORA', syncId: 'sync-2', ogrenciBulutId: 'bulut-2' });
    izle.cb({ exists: () => true, data: () => ({ veri: JSON.stringify(yeni) }), metadata: {} });
    assert.equal(a.run('D.ogr.length'), 2); assert.equal(a.run('D.ogr[0].ad'), 'SENTETİK ADA');
    assert.equal(JSON.parse(a.yerel.get('yks_izleme_veri')).ogr.length, 2);
    izle.cb({ exists: () => true, data: () => ({ veri: '{"rol":"ogrenci","ayar":{},"ogr":[]}' }), metadata: {} });
    assert.equal(a.run('D.ogr.length'), 2, 'a student notebook is never shown'); assert.match(a.run('EK.izlemeDurum'), /okunamadı/);
  });
  await check('when the permission is removed, the device copy is deleted and the viewer’s own notebook returns', async () => {
    const a = uygulama(); await ac(a);
    a.dinleyiciler.get('ogretmenYedek/' + SAHIP).hata({ code: 'permission-denied' });
    assert.equal(a.yerel.has('yks_izleme'), false); assert.equal(a.yerel.has('yks_izleme_veri'), false);
    assert.equal(a.yerel.get('yks_veri'), '{"kendi":true}'); assert.equal(a.durum.yenilendi, 1);
    assert.match(a.oturum.get('yks_izleme_mesaj'), /izniniz kaldırıldı/); assert.equal(a.run('yalnizcaGoruntuleme()'), false);
    const b = uygulama(); b.durum.reddet = new Set(['ogretmenYedek/' + SAHIP]);
    await assert.rejects(ac(b), /görüntüleme izniniz yok/); assert.equal(b.run('yalnizcaGoruntuleme()'), false); assert.equal(b.yerel.has('yks_izleme'), false);
  });
  await check('reopening uses the device copy until the server answers; a damaged copy is discarded', async () => {
    const a = uygulama(); await ac(a);
    const b = uygulama(); b.yerel.set('yks_izleme', a.yerel.get('yks_izleme')); b.yerel.set('yks_izleme_veri', a.yerel.get('yks_izleme_veri'));
    assert.equal(b.run('izlemeAcilisi()'), true); assert.equal(b.run('D.ogr[0].ad'), 'SENTETİK ADA'); assert.equal(b.run('yalnizcaGoruntuleme()'), true);
    b.run('window.bulutDegisti()'); assert(b.dinleyiciler.has('ogretmenYedek/' + SAHIP));
    b.durum.kullanici = { uid: BASKA, isAnonymous: false }; b.run('izlemeDinlemeyiDurdur();izlemeDinlemeyiBaslat()');
    assert(!b.dinleyiciler.has('ogretmenYedek/' + SAHIP), 'another account does not follow the shared notebook');
    const c = uygulama(); c.yerel.set('yks_izleme', a.yerel.get('yks_izleme')); c.yerel.set('yks_izleme_veri', '{bozuk');
    assert.equal(c.run('izlemeAcilisi()'), false); assert.equal(c.yerel.has('yks_izleme'), false); assert.equal(c.run('yalnizcaGoruntuleme()'), false);
    const d = uygulama(); d.yerel.set('yks_izleme', JSON.stringify({ sahipUid: IZLEYICI, izleyiciUid: IZLEYICI })); d.yerel.set('yks_izleme_veri', a.yerel.get('yks_izleme_veri'));
    assert.equal(d.run('izlemeAcilisi()'), false);
  });
  await check('logging out while viewing signs out and deletes only the shared copy', async () => {
    const a = uygulama(); await ac(a);
    assert.equal(await a.run('kaydedipCikisYapGercek()'), true);
    assert.equal(a.durum.kullanici, null); assert.equal(a.yerel.has('yks_izleme_veri'), false); assert.equal(a.yerel.has('yks_izleme'), false);
    assert.equal(a.yerel.get('yks_veri'), '{"kendi":true}'); assert.equal(a.durum.yenilendi, 1); assert.deepEqual(a.yazilar, []);
  });
  await check('import and edit controls are hidden while viewing; class sort works in memory only', async () => {
    const a = uygulama(); await ac(a);
    a.run(`EK.sekme='denemeler';EK.ogr=0`); const deneme = a.run('gorunumDenemeler()');
    assert(!deneme.includes('id="dnPdf"') && !deneme.includes('id="dnYayinla"'));
    const sr = a.run('gorunumSiralamalar()'); assert(!sr.includes('id="srPdf"') && !sr.includes('data-sr-sil'));
    await a.run("SIRALAMA.tercihKaydet('301 12/A','SAY')"); assert.equal(a.run("SIRALAMA.oku().veri.tercih['301 12/A']"), 'SAY');
    assert.equal(a.run('D.siralama'), undefined); assert.deepEqual(a.yazilar, []);
    assert.equal(a.run('izlemeBandi()').includes('<'), true); a.run("IZLEME.ad='<img src=x>'"); assert(!a.run('izlemeBandi()').includes('<img'));
  });
  console.log(passed + ' viewing-teacher checks passed');
})();
