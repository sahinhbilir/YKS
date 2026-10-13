#!/usr/bin/env node
'use strict';
// Co-teacher (ortak öğretmen) and the one-editor lock: a console grant with yetki 'ortak' opens the
// owner's notebook editable on a clean device; saves, history and student slots use the owner's uid;
// only one person edits at a time (defterKilidi); the other follows the cloud copy read-only and takes
// over when the lock is released or goes stale; removing the grant deletes the device copy.
// Firebase is an in-memory stand-in that applies the same lock rule as firestore.rules. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));
const SAHIP = 'sahip-uid-1', ORTAK = 'ortak-uid-1', BASKA = 'baska-uid-1';
const IKI_DK = 2 * 60000;
const izinYok = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

// One server shared by every device in a test.
function sunucu() {
  const belgeler = new Map(), dinleyiciler = new Map(), olaylar = [];
  const s = { belgeler, dinleyiciler, olaylar, saat: () => Date.now(), kurallarYok: false };
  s.yayinla = yol => { for (const [d, cb] of dinleyiciler) if (d.yol === yol) cb(s.anlik(yol)); };
  s.anlik = yol => { const v = belgeler.get(yol); return { exists: () => v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), metadata: { fromCache: false, hasPendingWrites: false } }; };
  // firestore.rules: kilitUygun() for the notebook and its history; defterKilidi update only by its holder or when stale.
  s.kilitUygun = (sahip, uid) => { const k = belgeler.get('defterKilidi/' + sahip); return !k || k.uid === uid || s.saat() - k.ts >= IKI_DK; };
  return s;
}
function cihaz(srv, { uid, kendiDefter = null, izin } = {}) {
  const yerel = new Map(kendiDefter ? [['yks_veri', kendiDefter]] : []), oturum = new Map();
  const depo = m => ({ get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  const durum = { kullanici: { uid, isAnonymous: false, email: uid + '@example.com', displayName: uid === SAHIP ? 'Sentetik Sahip' : 'Sentetik Ortak' }, yenilendi: 0, bilgi: [] };
  if (izin !== undefined) { if (izin) srv.belgeler.set('izleyiciler/' + uid, izin); else srv.belgeler.delete('izleyiciler/' + uid); }
  const ben = () => durum.kullanici && durum.kullanici.uid;
  const yazKontrol = yol => {
    if (srv.kurallarYok) throw izinYok();
    const m = /^ogretmenYedek\/([^/]+)(\/gecmis\/.*)?$/.exec(yol);
    if (m && !srv.kilitUygun(m[1], ben())) throw izinYok();
  };
  const yaz = (yol, veri) => { yazKontrol(yol); srv.belgeler.set(yol, JSON.parse(JSON.stringify(veri))); srv.olaylar.push([ben(), 'yaz', yol]); setTimeout(() => srv.yayinla(yol), 0); };
  const bulut = { yapilandirilmis: true, db: {}, doc: (db, ...yol) => yol.join('/'), collection: (db, ...yol) => yol.join('/'),
    getDoc: async yol => srv.anlik(yol), getDocFromServer: async yol => { if (srv.kurallarYok && yol.startsWith('izleyiciler/')) throw izinYok(); return srv.anlik(yol); },
    getDocs: async () => ({ forEach() {}, docs: [] }),
    setDoc: async (yol, veri) => yaz(yol, veri), updateDoc: async (yol, veri) => yaz(yol, { ...(srv.belgeler.get(yol) || {}), ...veri }),
    runTransaction: async (db, fn) => fn({ get: async yol => srv.anlik(yol), set: (yol, veri) => yaz(yol, veri), update: (yol, veri) => yaz(yol, { ...(srv.belgeler.get(yol) || {}), ...veri }), delete: yol => srv.belgeler.delete(yol) }),
    onSnapshot: (yol, a, b, c) => { const [cb] = typeof a === 'function' ? [a] : [b]; const d = { yol }; srv.dinleyiciler.set(d, cb); return () => srv.dinleyiciler.delete(d); },
    mevcutKullanici: () => durum.kullanici, oturumHazir: async () => {}, oturumuKapat: async () => { durum.kullanici = null; },
    sifreTalepleriAl: async () => [],
    // Same decisions as the module's defterKilidiDene/defterKilidiBirak.
    defterKilidiDene: async (sahip, ad, al) => {
      if (srv.kurallarYok || (sahip !== ben() && !(srv.belgeler.get('izleyiciler/' + ben()) || {}).yetki)) throw izinYok();
      const yol = 'defterKilidi/' + sahip, k = srv.belgeler.get(yol);
      if (k && k.uid !== ben() && srv.saat() - k.ts < IKI_DK) return { tur: 'baskasinda', uid: k.uid, ad: k.ad };
      if (!al) return { tur: k && k.uid === ben() ? 'bende' : 'serbest' };
      srv.belgeler.set(yol, { uid: ben(), ad, ts: srv.saat() }); srv.olaylar.push([ben(), 'kilit', sahip]);
      return { tur: 'bende' };
    },
    defterKilidiBirak: async sahip => { const k = srv.belgeler.get('defterKilidi/' + sahip); if (k && k.uid === ben()) { srv.belgeler.delete('defterKilidi/' + sahip); srv.olaylar.push([ben(), 'birak', sahip]); } } };
  const node = () => ({ innerHTML: '', textContent: '', style: {}, hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {}, click() {}, focus() {}, getClientRects() { return [1]; } });
  const nodes = { ray: node(), ana: node(), stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' } };
  const sandbox = { console, setTimeout, clearTimeout, Blob, URL, URLSearchParams, TextEncoder, crypto, location: { search: '?dev=1' }, Date, Math, JSON, Intl,
    alert() {}, confirm() { return true; }, prompt() { return ''; }, fetch: async () => ({ ok: false }), localStorage: depo(yerel), sessionStorage: depo(oturum), navigator: { onLine: true },
    window: { scrollTo() {}, open() { return null; }, addEventListener() {}, bulut, location: { reload() { durum.yenilendi++; } } },
    document: { activeElement: null, visibilityState: 'visible', addEventListener() {}, contains() { return true; }, getElementById(id) { return nodes[id] || null; }, querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return node(); }, body: { appendChild(n) { durum.bilgi.push(n.textContent); }, insertAdjacentHTML() {}, classList: { add() {}, remove() {} } } } };
  sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
  const run = code => vm.runInContext(code, sandbox);
  return { run, yerel, oturum, durum, nodes, bulut };
}
// The owner's notebook as the owner's app backs it up.
function sahipDefteri(srv) {
  const c = cihaz(srv, { uid: SAHIP });
  c.run(`D=varsayilan();D.rol='rehber';D.kurum='SENTETİK LİSE';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true,syncId:'sync-1',ogrenciBulutId:'bulut-1'}];`);
  const json = c.run('JSON.stringify(D)');
  srv.belgeler.set('ogretmenYedek/' + SAHIP, { veri: json, ts: 1, surum: 1, boyut: json.length });
  return json;
}
const GRANT = { sahipUid: SAHIP, ad: 'Sentetik Sahip', yetki: 'ortak' };
const bekle = (ms = 5) => new Promise(r => setTimeout(r, ms));
// A clean co-teacher device ("Rehber öğretmeniyim" on a device with no notebook), connected.
async function ortakBagla(srv) {
  const c = cihaz(srv, { uid: ORTAK, izin: GRANT });
  c.run("D=varsayilan();D.rol='rehber';EK.sekme='takip'");
  assert.equal(await c.run('bulutDefteriniAc(window.bulut.mevcutKullanici())'), true);
  await bekle();
  return c;
}
// The owner's device that already has its notebook (as after its own earlier session).
async function sahipCihazi(srv, json) {
  const c = cihaz(srv, { uid: SAHIP, kendiDefter: json });
  c.run(`D=JSON.parse(localStorage.getItem('yks_veri'));EK.sekme='takip'`);
  await c.run(`bulutYedekTemeliniHatirla('${SAHIP}', localStorage.getItem('yks_veri'))`);
  return c;
}
let passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('a co-teacher opens the owner’s notebook editable and saves to the owner’s notebook', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = await ortakBagla(srv);
    assert.equal(c.run('D.ogr[0].ad'), 'SENTETİK ADA'); assert.equal(c.run('yalnizcaGoruntuleme()'), false);
    assert.deepEqual(JSON.parse(c.yerel.get('yks_ortak')), { sahipUid: SAHIP, ortakUid: ORTAK, ad: 'Sentetik Sahip' });
    assert.equal(c.run('defterUid(window.bulut.mevcutKullanici())'), SAHIP);
    assert.equal(srv.belgeler.get('defterKilidi/' + SAHIP).uid, ORTAK, 'the co-teacher holds the edit lock');
    assert(c.nodes.ana.innerHTML.includes('Ortak defter') && c.nodes.ana.innerHTML.includes('Sentetik Sahip'));
    assert(c.nodes.ray.innerHTML.includes('>Kaydet ve çıkış yap<'));
    c.run("D.ogr[0].ad='SENTETİK ADA (ORTAK)'");
    assert.equal(await c.run('kaydet(true)'), true);
    const r = await c.run('bulutaYedekle()'); assert.equal(r.tur, 'tamam', JSON.stringify(r));
    assert.match(srv.belgeler.get('ogretmenYedek/' + SAHIP).veri, /SENTETİK ADA \(ORTAK\)/);
    assert(srv.belgeler.has('ogretmenYedek/' + SAHIP + '/gecmis/' + c.run('isoDan(bugunNo())')), 'the daily copy goes to the owner too');
    assert.equal([...srv.belgeler.keys()].some(k => k.startsWith('ogretmenYedek/' + ORTAK)), false, 'nothing under the co-teacher’s own uid');
  });
  await check('student slots are created with the owner’s uid and the owner’s slots are followed', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = await ortakBagla(srv);
    c.run("D.ogr.push({...D.ogr[0],no:1002,ad:'SENTETİK BORA',syncId:'sync-2',ogrenciBulutId:'bulut-2'})");
    assert.equal((await c.run('oncedenAyir(1)')).tur, 'tamam');
    assert.equal(srv.belgeler.get('ogrenciler/sync-2').ogretmenUid, SAHIP);
    c.run('ogretmenDinlemeyiBaslat(true)');
    assert([...srv.dinleyiciler.keys()].some(d => d.yol === 'ogrenciler/sync-1'), 'the owner’s student slot is followed');
  });
  await check('a device with another notebook open does not become a co-teacher', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = cihaz(srv, { uid: ORTAK, izin: GRANT });
    c.run("D=varsayilan();D.rol='rehber';D.ogr=[{no:5,ad:'KENDİ ÖĞRENCİM',sube:'9-B',alan:'SAY',sinif:9,kap:6,off:[6],aktif:true}]");
    await assert.rejects(c.run('bulutDefteriniAc(window.bulut.mevcutKullanici())'), /başka bir defter açık/);
    assert.equal(c.run('ORTAK'), null); assert.equal(c.yerel.has('yks_ortak'), false);
    assert.equal(srv.belgeler.has('defterKilidi/' + SAHIP), false);
  });
  await check('one editor at a time: the owner waits read-only, follows the cloud copy, then takes over', async () => {
    const srv = sunucu(); const json = sahipDefteri(srv);
    const c = await ortakBagla(srv);
    const s = await sahipCihazi(srv, json);
    await s.run('kilitDenetle(true)');
    assert.equal(s.run('KILIT.durum'), 'baskasinda'); assert.equal(s.run('yalnizcaGoruntuleme()'), true);
    assert(s.nodes.ana.innerHTML.includes('Sentetik Ortak düzenliyor'), 'banner names the editor');
    assert(s.nodes.ray.innerHTML.includes('>Çıkış yap<'));
    s.run("D.ogr[0].ad='SAHİP YEREL DEĞİŞİKLİK'");
    assert.equal(await s.run('kaydet(true)'), false, 'nothing is saved while the other edits');
    assert.equal((await s.run('bulutaYedekle()')).tur, 'yok');
    assert.equal(s.yerel.get('yks_veri'), json);
    // The co-teacher's save reaches the owner's screen and device copy.
    c.run("D.ogr[0].ad='ORTAKTAN GELEN'"); await c.run('kaydet(true)'); assert.equal((await c.run('bulutaYedekle()')).tur, 'tamam');
    await bekle(20);
    assert.equal(s.run('D.ogr[0].ad'), 'ORTAKTAN GELEN'); assert.match(s.yerel.get('yks_veri'), /ORTAKTAN GELEN/);
    // Even an old app on the owner's side cannot overwrite while the co-teacher holds the lock.
    await assert.rejects(s.bulut.setDoc('ogretmenYedek/' + SAHIP, { veri: '{}' }), /permission/i);
    // The co-teacher logs out: the lock is released at once and the owner takes over.
    assert.equal(await c.run('kaydedipCikisYapGercek()'), true);
    assert.equal(srv.belgeler.has('defterKilidi/' + SAHIP), false, 'released on logout');
    await s.run('kilitDenetle(true)'); await bekle(20);
    assert.equal(s.run('KILIT.durum'), 'bende'); assert.equal(s.run('yalnizcaGoruntuleme()'), false);
    assert(!s.nodes.ana.innerHTML.includes('düzenliyor'));
    assert(s.durum.bilgi.some(t => /Düzenleme sırası sizde/.test(t)));
    s.run("D.ogr[0].ad='SAHİP DÜZENLEDİ'"); assert.equal(await s.run('kaydet(true)'), true);
    assert.equal((await s.run('bulutaYedekle()')).tur, 'tamam');
    assert.match(srv.belgeler.get('ogretmenYedek/' + SAHIP).veri, /SAHİP DÜZENLEDİ/);
  });
  await check('a startup auto-save does not stop the waiting device from following; a real unsaved edit is never overwritten', async () => {
    const srv = sunucu(); const json = sahipDefteri(srv);
    const c = await ortakBagla(srv);
    const s = await sahipCihazi(srv, json);
    s.run("TEST_ACILIS_JSON=localStorage.getItem('yks_veri');D.ogr[0].kap=7");      // e.g. upcoming weeks filled at startup
    assert.equal(await s.run('kaydet(true)'), true); s.run('ACILIS_KAYIT=KAYIT_SAYAC');
    await s.run('kilitDenetle(true)'); assert.equal(s.run('KILIT.durum'), 'baskasinda');
    c.run("D.ogr[0].ad='ORTAKTAN'"); await c.run('kaydet(true)'); assert.equal((await c.run('bulutaYedekle()')).tur, 'tamam'); await bekle(20);
    assert.equal(s.run('D.ogr[0].ad'), 'ORTAKTAN', 'startup-only change: follows the cloud');
    const t = await sahipCihazi(srv, srv.belgeler.get('ogretmenYedek/' + SAHIP).veri);
    t.run("TEST_ACILIS_JSON=localStorage.getItem('yks_veri');ACILIS_KAYIT=KAYIT_SAYAC;D.ogr[0].ad='ÇEVRİMDIŞI DÜZENLEME'");
    assert.equal(await t.run('kaydet(true)'), true);                                // saved on the device, not in the cloud
    await t.run('kilitDenetle(true)'); assert.equal(t.run('KILIT.durum'), 'baskasinda');
    c.run("D.ogr[0].ad='ORTAKTAN 2'"); await c.run('kaydet(true)'); await c.run('bulutaYedekle()'); await bekle(20);
    assert.equal(t.run('D.ogr[0].ad'), 'ÇEVRİMDIŞI DÜZENLEME'); assert.match(t.run('EK.kilitNot'), /buluta gitmemiş/);
    assert.match(t.yerel.get('yks_veri'), /ÇEVRİMDIŞI DÜZENLEME/);
  });
  await check('a stale lock passes to the person who is working; an idle tab does not take a free lock', async () => {
    const srv = sunucu(); const json = sahipDefteri(srv);
    srv.belgeler.set('defterKilidi/' + SAHIP, { uid: ORTAK, ad: 'Sentetik Ortak', ts: Date.now() - 3 * 60000 });
    const s = await sahipCihazi(srv, json);
    s.run('SON_ETKINLIK=Date.now()-10*60000');
    await s.run('kilitDenetle()');
    assert.equal(s.run('KILIT.durum'), 'serbest', 'idle: no lock taken'); assert.equal(srv.belgeler.get('defterKilidi/' + SAHIP).uid, ORTAK);
    s.run('SON_ETKINLIK=Date.now()'); await s.run('kilitDenetle(true)');
    assert.equal(s.run('KILIT.durum'), 'bende'); assert.equal(srv.belgeler.get('defterKilidi/' + SAHIP).uid, SAHIP);
  });
  await check('the holder refreshes the lock about once a minute, and only while active', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = await ortakBagla(srv);
    const say = () => srv.olaylar.filter(o => o[1] === 'kilit').length, ilk = say();
    await c.run('kilitDenetle()'); assert.equal(say(), ilk, 'not refreshed within the minute');
    c.run('KILIT.ts=Date.now()-61000'); await c.run('kilitDenetle()'); assert.equal(say(), ilk + 1);
    c.run('KILIT.ts=Date.now()-61000;SON_ETKINLIK=Date.now()-10*60000'); await c.run('kilitDenetle()');
    assert.equal(say(), ilk + 1, 'an idle tab stops refreshing so the lock can go stale');
  });
  await check('removing the grant deletes the co-teacher’s device copy; a passing error does not', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = await ortakBagla(srv);
    srv.belgeler.set('izleyiciler/' + ORTAK, GRANT);
    c.bulut.defterKilidiDene = async () => { throw izinYok(); };
    await c.run('kilitDenetle(true)');
    assert.equal(c.durum.yenilendi, 0, 'grant still there: nothing deleted'); assert(c.yerel.has('yks_veri'));
    srv.belgeler.delete('izleyiciler/' + ORTAK);
    await c.run('kilitDenetle(true)');
    assert.equal(c.durum.yenilendi, 1); assert.equal(c.yerel.has('yks_veri'), false); assert.equal(c.yerel.has('yks_ortak'), false);
    assert.match(c.oturum.get('yks_izleme_mesaj'), /izniniz kaldırıldı/);
  });
  await check('reopening restores co-teacher mode; another Google account cannot save into the owner’s notebook', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = await ortakBagla(srv);
    const d = cihaz(srv, { uid: ORTAK, kendiDefter: c.yerel.get('yks_veri') });
    d.yerel.set('yks_ortak', c.yerel.get('yks_ortak'));
    d.run(`D=JSON.parse(localStorage.getItem('yks_veri'));ortakAcilisi()`);
    assert.equal(d.run('ORTAK.sahipUid'), SAHIP); assert.equal(d.run('defterUid(window.bulut.mevcutKullanici())'), SAHIP);
    d.durum.kullanici = { uid: BASKA, isAnonymous: false, email: 'baska@example.com' };
    const r = await d.run('bulutaYedekle()'); assert.equal(r.tur, 'hata'); assert.match(r.mesaj, /başka bir Google hesabıyla/);
    assert.equal([...srv.belgeler.keys()].some(k => k.startsWith('ogretmenYedek/' + BASKA)), false);
    const e = cihaz(srv, { uid: ORTAK }); e.yerel.set('yks_ortak', '{"sahipUid":"x","ortakUid":"x"}'); e.run("D=varsayilan();D.rol='rehber';ortakAcilisi()");
    assert.equal(e.run('ORTAK'), null, 'a damaged record is dropped'); assert.equal(e.yerel.has('yks_ortak'), false);
  });
  await check('an owner works as before when the rules are not published yet (no lock)', async () => {
    const srv = sunucu(); const json = sahipDefteri(srv);
    const s = await sahipCihazi(srv, json);
    s.bulut.defterKilidiDene = async () => { throw izinYok(); };
    await s.run('kilitDenetle(true)');
    assert.equal(s.run('KILIT.durum'), ''); assert.equal(s.run('KILIT_KAPALI'), true); assert.equal(s.run('yalnizcaGoruntuleme()'), false);
    s.run("D.ogr[0].ad='KURALSIZ'"); assert.equal(await s.run('kaydet(true)'), true);
    assert.equal((await s.run('bulutaYedekle()')).tur, 'tamam');
  });
  await check('a plain viewer grant (no yetki) still opens read-only', async () => {
    const srv = sunucu(); sahipDefteri(srv);
    const c = cihaz(srv, { uid: ORTAK, izin: { sahipUid: SAHIP, ad: 'Sentetik Sahip' } });
    c.run("D=varsayilan();D.rol='rehber'");
    assert.equal(await c.run('bulutDefteriniAc(window.bulut.mevcutKullanici())'), true);
    assert.equal(c.run('yalnizcaGoruntuleme()'), true); assert.equal(c.run('ORTAK'), null);
    assert.equal(srv.belgeler.has('defterKilidi/' + SAHIP), false, 'a viewer never takes the lock');
  });
  console.log(passed + ' co-teacher checks passed');
})();
