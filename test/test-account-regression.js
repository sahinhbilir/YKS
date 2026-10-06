'use strict';
// "Test hesabı aç": a Google user's own notebook in testDefter/{uid}. vm-based and
// dependency-free; one in-memory Firestore double is shared by several "devices".
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

const GOOGLE = { uid: 'google-1', isAnonymous: false, email: 'tester@example.test' };
const DIGER = { uid: 'google-2', isAnonymous: false, email: 'other@example.test' };

function sunucu() { return { belgeler: {}, yazma: 0, reddet: false, silinen: [] }; }
function cihaz(s, kullanici = GOOGLE, oturumAcik = false) {
  const store = {}, session = {}, listeners = {}, timers = new Set(), events = [];
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', disabled: false,
    hidden: false, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, remove() {}, appendChild() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el(), cikisDurum: el() };
  let user = oturumAcik ? kullanici : null;
  const storage = data => ({ get length() { return Object.keys(data).length; }, key: i => Object.keys(data)[i] ?? null,
    getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } });
  const snap = data => ({ exists: () => !!data, data: () => data && structuredClone(data) });
  const yaz = (ref, data) => { if (data === null) { s.silinen.push(ref); delete s.belgeler[ref]; } else s.belgeler[ref] = JSON.parse(JSON.stringify(data)); s.yazma++; };
  let istem = '';
  const b = { yapilandirilmis: true, db: {}, doc: (_db, ...p) => p.join('/'), mevcutKullanici: () => user,
    oturumHazir: async () => {},
    girisOgretmen: async () => { user = kullanici; return user; },
    async runTransaction(_db, fn) {
      if (s.reddet) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
      const writes = [];
      const r = await fn({ get: async ref => snap(s.belgeler[ref]), set: (ref, data) => writes.push([ref, data]),
        delete: ref => writes.push([ref, null]) });
      writes.forEach(([ref, data]) => yaz(ref, data));
      return r;
    },
    getDocFromServer: async ref => snap(s.belgeler[ref]),
    setDoc: async (ref, data) => yaz(ref, data),
    async oturumuKapat() { events.push('signout'); user = null; } };
  const sandbox = { console, JSON, Date, Math, Intl, TextEncoder, Blob, URL, URLSearchParams, crypto: webcrypto, structuredClone,
    location: { search: '?dev=1' }, navigator: { onLine: true, locks: { request: async (_n, _o, fn) => fn({}) } },
    localStorage: storage(store), sessionStorage: storage(session), fetch: async () => ({ ok: false }),
    alert: m => events.push('alert:' + m), confirm: () => true, prompt: () => { events.push('prompt'); return istem; },
    setTimeout(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); t.unref(); timers.add(t); return t; },
    clearTimeout(t) { clearTimeout(t); timers.delete(t); },
    window: { bulut: b, scrollTo() {}, addEventListener() {}, location: { reload() {} } },
    document: { activeElement: null, addEventListener(k, fn) { (listeners[k] ||= []).push(fn); },
      getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [],
      contains: () => true, createElement: () => el(),
      body: { ...el(), appendChild: v => events.push('bilgi:' + v.textContent), insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  run("D=varsayilan();D.ayar.testTarih='2026-09-20';EK.sekme='plan';");
  const tikla = async id => {
    const target = Object.assign(el(), { id, closest: q => q === '#' + id ? target : null });
    nodes[id] = target;
    for (const fn of listeners.click || []) await fn({ target });
    await run('KAYIT_ZINCIRI');
  };
  return { run, nodes, store, events, b, tikla, el, sandbox, user: () => user, setUser: u => { user = u; }, istem: v => { istem = v; },
    close() { timers.forEach(clearTimeout); } };
}
// Opens a new test account and completes the existing solo setup as a grade-11 student.
async function kur(s, ad = 'Kuzey') {
  const a = cihaz(s);
  await a.tikla('testHesapAc');
  Object.assign(a.nodes, { kOgrAd: a.el({ value: ad }), kOgrSinif: a.el({ value: '11' }),
    kMufredatBaslangic: a.el({ value: '2026-09-14' }), kOgrSube: a.el({ value: '' }), kOgrAlan: a.el({ value: 'SAY' }) });
  await a.tikla('kOgrBaslat');
  return a;
}
const yukle = a => a.run('bulutaYedekle()');
// "Kaydol" accounts in the shared server double: user name → {sifre, kullanici}. School
// name+number login always fails here, so a numeric password falls through to Kaydol.
const kimlikHatasi = () => Object.assign(new Error('auth'), { code: 'auth/invalid-credential' });
function uyeler(a, s) {
  s.uyeler ||= {}; a.cagri = [];
  a.b.uyeKaydol = async (ad, sifre) => {
    a.cagri.push(['kaydol', ad]);
    if (s.uyeler[ad]) throw Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' });
    const u = { uid: 'uye-' + ad, isAnonymous: false, email: 'uye-' + 'a'.repeat(40) + '@uye.ykstekrar.app' };
    s.uyeler[ad] = { sifre, u }; a.setUser(u); return u;
  };
  a.b.uyeGiris = async (ad, sifre) => {
    a.cagri.push(['giris', ad]);
    const k = s.uyeler[ad]; if (!k || k.sifre !== sifre) throw kimlikHatasi();
    a.setUser(k.u); return k.u;
  };
  a.b.girisOgrenciHesabi = async (ad, no) => { a.cagri.push(['okul', ad, no]); throw kimlikHatasi(); };
  a.b.okulSifreGirisi = async () => { throw kimlikHatasi(); };   // no school student set a password
  return a;
}
async function kaydol(a, ad = 'Ali Veli 07', sifre = 'gizli-123', alan = 'EA') {
  Object.assign(a.nodes, { kaydolAd: a.el({ value: ad }), kaydolSifre: a.el({ value: sifre }), kaydolAlanSec: a.el({ value: alan }),
    kaydolDurum: a.el() });
  await a.tikla('kaydolAc');
  await a.tikla('kaydolBaslat');
  return a;
}
async function girisYap(a, ad, sifre) {
  Object.assign(a.nodes, { ogrenciGirisAd: a.el({ value: ad }), ogrenciGirisNo: a.el({ value: sifre }), ogrenciGirisDurum: a.el() });
  await a.tikla('ogrenciBulutGiris');
  return a.nodes.ogrenciGirisDurum.textContent;
}
const bulutDefteri = (s, uid = GOOGLE.uid) => JSON.parse(s.belgeler['testDefter/' + uid].veri);

const checks = [];
async function check(name, fn) {
  const acik = [];
  try { await fn(x => { acik.push(x); return x; }); checks.push(name); }
  finally { acik.forEach(a => a.close()); }
}

(async () => {
  await check('start-screen-opens-student-login-with-teacher-and-test-account-below', async kapat => {
    const a = kapat(cihaz(sunucu()));
    const h = a.run('gorunumKurulum()');
    assert.match(h, /<h1 class="giris-baslik">YKS 2027<\/h1><p class="giris-alt">Hedefine bir adım daha yaklaş<\/p>/);
    const kart = h.slice(h.indexOf('id="ogrenciGirisAlan"'), h.indexOf('</section>'));
    assert(!/id="ogrenciGirisAlan"[^>]*hidden/.test(h), 'student login is open');
    for (const id of ['ogrenciGirisAd', 'ogrenciGirisNo', 'ogrenciBulutGiris', 'rolRehber', 'testHesapAc']) assert(kart.includes('id="' + id + '"'), id);
    assert(kart.indexOf('id="ogrenciBulutGiris"') < kart.indexOf('id="rolRehber"'), 'teacher login comes after Giriş yap');
    assert.match(kart, /<button class="dugme" id="rolRehber">Rehber öğretmeniyim<\/button><button class="dugme" id="kaydolAc">Kaydol<\/button><button class="dugme" id="testHesapAc">Test hesabı aç<\/button>/);
    // One login for both: Kaydol (user name + password) and school (name + school number).
    assert.match(kart, /id="ogrenciGirisAd" autocomplete="username"[^>]*placeholder="Kullanıcı adı - Ad soyad"/);
    assert.match(kart, /<div class="sifre-kutu"><input type="password" id="ogrenciGirisNo" autocomplete="current-password" placeholder="Şifre - Okul numarası"><button type="button" class="sifre-goster" data-sifre-goster="ogrenciGirisNo"[^>]*aria-pressed="false" aria-label="Şifreyi göster">/);
    assert(!/type="number"|inputmode="numeric"/.test(kart), 'no number spinner on the school number');
    assert(h.indexOf('</section>') < h.indexOf('class="giris-cizim"'), 'the drawing comes after the login');
    // No hint texts: the status line stays empty until there is an error or progress to show.
    assert.match(kart, /id="ogrenciGirisDurum" role="status" aria-live="polite"><\/span>/);
    assert(!/class="mini giris-not"|>veya</.test(h), 'no extra small texts');
    assert.match(h, /<details class="giris-yedek mini"><summary class="baglanti">Yedekten geri yükle<\/summary>/, 'backup restore is one folded link');
    a.run("D.ayar.sinav='2028-06-17'");
    assert.match(a.run('gorunumKurulum()'), /<h1 class="giris-baslik">YKS 2028<\/h1>/, 'the year follows the exam date');
  });

  await check('new-account-asks-nickname-and-hides-teacher-file', async kapat => {
    const s = sunucu(), a = kapat(cihaz(s));
    await a.tikla('testHesapAc');
    assert.equal(a.run('D.rol'), 'ogrenci');
    assert.equal(a.run('D.testHesap.uid'), GOOGLE.uid);
    assert.equal(a.run('D.ogr.length'), 0);
    assert.match(a.nodes.ana.innerHTML, /Takma adın/);
    assert.doesNotMatch(a.nodes.ana.innerHTML, /paketYukle/);
    assert.equal((await yukle(a)).tur, 'yok', 'nothing is uploaded before setup is complete');
    assert.equal(s.yazma, 0);
  });

  await check('setup-uploads-own-notebook-and-weekday-history-slot', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal(a.run('D.ogr[0].ad'), 'Kuzey');
    assert.equal(a.run('D.ogr[0].sinif'), 11);
    assert.equal(a.run('testHesabiMi()'), true);
    assert.equal((await yukle(a)).tur, 'tamam');
    const ana = s.belgeler['testDefter/' + GOOGLE.uid];
    assert.deepEqual(Object.keys(ana).sort(), ['boyut', 'surum', 'ts', 'veri']);
    assert.equal(ana.veri, a.run('JSON.stringify(D)'));
    const yuva = a.run('String(haftaGunu(bugunNo()))');
    assert.equal(yuva, '6', '2026-09-20 is a Sunday');
    assert.equal(s.belgeler['testDefter/' + GOOGLE.uid + '/gecmis/' + yuva].veri, ana.veri);
    assert.equal(s.belgeler['testDefter/' + GOOGLE.uid + '/gecmis/' + yuva].gun, '2026-09-20');
    assert(!Object.keys(s.belgeler).some(k => k.startsWith('ogretmenYedek') || k.startsWith('ogrenciler')));
    assert.match(a.run("EK.sekme='ayarlar';gorunumAyarlar()"), /<h2>Test hesabın<\/h2>/);
    assert.doesNotMatch(a.run('gorunumAyarlar(true)'), /paketYukle/);
  });

  await check('history-is-bounded-to-seven-weekday-slots', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    for (let g = 0; g < 21; g++) {
      a.run("D.ayar.testTarih=isoDan(gunNo('2026-09-20')+" + g + ');');
      await a.run('kaydet(true)');
      assert.equal((await yukle(a)).tur, 'tamam');
    }
    const gecmis = Object.keys(s.belgeler).filter(k => k.includes('/gecmis/'));
    assert.deepEqual(gecmis.map(k => k.split('/').pop()).sort(), ['0', '1', '2', '3', '4', '5', '6']);
  });

  await check('second-device-opens-the-cloud-notebook', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    a.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}])'); await a.run('kaydet(true)');
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(cihaz(s));
    await b.tikla('testHesapAc');
    assert.equal(b.run('D.ogr[0].ad'), 'Kuzey');
    assert.equal(b.run('D.log.length'), 1);
    assert.equal(b.run('EK.sekme'), 'ana');
    assert(b.events.some(e => e.startsWith('bilgi:Hoş geldin Kuzey')));
  });

  await check('clean-device-pulls-newer-cloud-notebook-automatically', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    b.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:3}])'); await b.run('kaydet(true)');
    assert.equal((await yukle(b)).tur, 'tamam');
    await a.run('testDefteriniDenetle()');
    assert.equal(a.run('D.log.length'), 1, 'device A adopts device B notebook');
    assert.equal(a.run('EK.testCakisma'), false);
    assert.equal((await yukle(a)).tur, 'tamam', 'A can keep saving after the pull');
  });

  // Opening the page may re-save the notebook (automatic plan preparation). Until the
  // student touches the page, that alone must not block taking the newer cloud copy.
  for (const dokundu of [false, true])
    await check('startup-automation-change-' + (dokundu ? 'after-user-click-asks' : 'alone-still-pulls'), async kapat => {
      const s = sunucu(), a = kapat(await kur(s));
      assert.equal((await yukle(a)).tur, 'tamam');
      const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
      b.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:3}])'); await b.run('kaydet(true)'); await yukle(b);
      a.run("TEST_ACILIS_JSON=localStorage.getItem('yks_veri');D.ogr[0].kap=5;");
      await a.run('kaydet(true)');
      if (dokundu) await a.tikla('herhangiBirDugme');
      await a.run('testDefteriniDenetle()');
      assert.equal(a.run('D.log.length'), dokundu ? 0 : 1);
      assert.equal(a.run('EK.testCakisma'), dokundu);
      assert.equal(a.run('TEST_ACILIS_JSON'), null, 'the startup exception is used at most once');
    });

  await check('changes-on-both-devices-are-never-overwritten-silently', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    b.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:3}])'); await b.run('kaydet(true)');
    assert.equal((await yukle(b)).tur, 'tamam');
    const bulut = s.belgeler['testDefter/' + GOOGLE.uid].veri;
    a.run('sonucIsle(0,[{ki:1,gun:bugunNo(),not:4}])'); await a.run('kaydet(true)');
    const r = await yukle(a);
    assert.equal(r.tur, 'hata'); assert.equal(r.cakisma, true);
    assert.equal(s.belgeler['testDefter/' + GOOGLE.uid].veri, bulut, 'cloud keeps device B notebook');
    await a.run('testDefteriniDenetle()');
    assert.equal(a.run('D.log[0][2]'), 1, 'dirty device is not replaced automatically');
    assert.equal(a.run('EK.testCakisma'), true);
    const ayar = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(ayar, /id="testBulutuAc"/); assert.match(ayar, /id="testYereliYaz"/);
  });

  await check('conflict-keep-this-device-saves-replaced-cloud-copy', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    b.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:3}])'); await b.run('kaydet(true)'); await yukle(b);
    const bulut = s.belgeler['testDefter/' + GOOGLE.uid].veri;
    a.run('sonucIsle(0,[{ki:1,gun:bugunNo(),not:4}])'); await a.run('kaydet(true)'); await yukle(a);
    await a.tikla('testYereliYaz');
    assert.equal(bulutDefteri(s).log[0][2], 1, 'device A notebook is now in the cloud');
    assert.equal(s.belgeler['testDefter/' + GOOGLE.uid + '/gecmis/cakisma'].veri, bulut);
    assert.equal(a.run('EK.testCakisma'), false);
  });

  await check('conflict-open-cloud-replaces-this-device', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    b.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:3}])'); await b.run('kaydet(true)'); await yukle(b);
    a.run('sonucIsle(0,[{ki:1,gun:bugunNo(),not:4}])'); await a.run('kaydet(true)'); await yukle(a);
    await a.tikla('testBulutuAc');
    assert.equal(a.run('D.log[0][2]'), 0);
    assert.equal(a.run('EK.testCakisma'), false);
    assert.equal((await yukle(a)).tur, 'tamam');
  });

  await check('another-google-account-cannot-write-or-open-this-notebook', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    a.setUser(DIGER);
    const r = await yukle(a);
    assert.equal(r.tur, 'hata'); assert.equal(s.yazma, 0);
    a.setUser({ uid: GOOGLE.uid, isAnonymous: true });
    assert.equal((await yukle(a)).tur, 'baglanilmadi');
    a.setUser(GOOGLE); await yukle(a);
    const b = kapat(cihaz(s, DIGER));
    await b.tikla('testHesapAc');
    assert.equal(b.run('D.testHesap.uid'), DIGER.uid, 'the other account gets its own empty notebook');
    assert.equal(b.run('D.ogr.length'), 0);
    s.belgeler['testDefter/' + DIGER.uid] = s.belgeler['testDefter/' + GOOGLE.uid];
    const c = kapat(cihaz(s, DIGER));
    await c.tikla('testHesapAc');
    assert(c.events.some(e => e.includes('bu test hesabına ait değil')));
    assert.equal(c.run('D.rol'), '');
  });

  await check('rules-denial-reports-publish-hint', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    s.reddet = true;
    const r = await yukle(a);
    assert.equal(r.tur, 'hata'); assert.match(r.mesaj, /firestore\.rules/);
  });

  await check('logout-verifies-cloud-copy-then-clears-device', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    a.run('sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}])'); await a.run('kaydet(true)');
    assert.equal(await a.run('kaydedipCikisYap()'), true, a.nodes.cikisDurum.innerHTML);
    assert.equal(bulutDefteri(s).log.length, 1);
    assert.equal(a.store.yks_veri, undefined);
    assert(a.events.includes('signout'));
    assert.equal(a.run('D.rol'), '');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    assert.equal(b.run('D.log.length'), 1);
  });

  await check('logout-keeps-device-when-cloud-copy-cannot-be-confirmed', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    s.reddet = true;
    assert.equal(await a.run('kaydedipCikisYap()'), false);
    assert(a.store.yks_veri); assert(!a.events.includes('signout'));
    assert.equal(a.run('D.ogr[0].ad'), 'Kuzey');
  });

  await check('reset-needs-the-typed-confirmation', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    const ayar = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(ayar, /<h2>Verileri sıfırla<\/h2><div class="arac">[^]*?id="testSifirla"[^]*?<\/div>/, 'in the Verileri sıfırla card');
    assert.equal(ayar.match(/id="testSifirla"/g).length, 1);
    assert.doesNotMatch(ayar, /Baştan başlamak için/, 'no pointer text; the button sits in Verileri sıfırla');
    a.istem(null); await a.tikla('testSifirla');
    a.istem('evet'); await a.tikla('testSifirla');
    assert(s.belgeler['testDefter/' + GOOGLE.uid], 'nothing deleted without SIFIRLA');
    assert(a.events.some(e => e.startsWith('alert:Sıfırlama iptal edildi')));
    assert.equal(a.run('D.ogr[0].ad'), 'Kuzey');
  });

  await check('reset-deletes-cloud-notebook-history-and-device-then-signs-out', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    for (let g = 0; g < 3; g++) { a.run("D.ayar.testTarih=isoDan(gunNo('2026-09-20')+" + g + ');'); await a.run('kaydet(true)'); await yukle(a); }
    a.run('TEST_DENETIM_IS=null;');
    s.belgeler['testDefter/' + GOOGLE.uid + '/gecmis/cakisma'] = { veri: '{}', ts: 1, surum: 1, boyut: 2, gun: '2026-09-20' };
    s.belgeler['testDefter/' + DIGER.uid] = { veri: 'baskasi', ts: 1, surum: 1, boyut: 7 };
    assert.equal(Object.keys(s.belgeler).filter(k => k.startsWith('testDefter/' + GOOGLE.uid)).length, 5);
    a.istem('sıfırla'); await a.tikla('testSifirla');
    await a.run('CIKIS_IS||Promise.resolve()');
    assert.deepEqual(Object.keys(s.belgeler).filter(k => k.startsWith('testDefter/' + GOOGLE.uid)), [], 'notebook and every slot deleted');
    assert(s.belgeler['testDefter/' + DIGER.uid], 'another account is untouched');
    assert.equal(a.store.yks_veri, undefined); assert(a.events.includes('signout'));
    assert.equal(a.run('D.rol'), '');
    const b = kapat(cihaz(s)); await b.tikla('testHesapAc');
    assert.equal(b.run('D.ogr.length'), 0, 'the same Google account starts from an empty setup');
  });

  await check('reset-failure-deletes-nothing-and-keeps-the-device', async kapat => {
    const s = sunucu(), a = kapat(await kur(s));
    assert.equal((await yukle(a)).tur, 'tamam');
    s.reddet = true;
    a.istem('SIFIRLA'); await a.tikla('testSifirla'); await a.run('CIKIS_IS||Promise.resolve()');
    assert(s.belgeler['testDefter/' + GOOGLE.uid]); assert(a.store.yks_veri); assert(!a.events.includes('signout'));
    assert.equal(a.run('CIKIS_DURUMU'), ''); assert.equal(a.run('D.ogr[0].ad'), 'Kuzey');
    s.reddet = false; a.setUser(DIGER);
    await a.tikla('testSifirla'); await a.run('CIKIS_IS||Promise.resolve()');
    assert(s.belgeler['testDefter/' + GOOGLE.uid], 'another signed-in account cannot reset this notebook');
  });

  // Only a test account can reset. Teachers, teacher-linked students, students without a
  // test account and a test marker forged onto a linked notebook never see or run it.
  await check('reset-is-only-for-test-accounts-never-teachers-or-students', async kapat => {
    const s = sunucu();
    s.belgeler['testDefter/' + GOOGLE.uid] = { veri: 'test', ts: 1, surum: 1, boyut: 4 };
    const defterler = {
      ogretmen: "D.rol='rehber';D.ogr=[{no:1,ad:'Ada',alan:'SAY',sube:'12A',kap:6,off:[]}];",
      okulOgrencisi: "D.rol='ogrenci';D.ogr=[{no:1,ad:'Ada',alan:'SAY',sube:'12A',kap:6,off:[],syncId:'slot',hesapUid:'" + GOOGLE.uid + "'}];",
      tekBasinaOgrenci: "D.rol='ogrenci';D.ogr=[{no:1,ad:'Ada',alan:'SAY',sube:'benim',kap:6,off:[]}];",
      sahteTestIsareti: "D.rol='ogrenci';D.testHesap={uid:'" + GOOGLE.uid + "',acilis:1};D.ogr=[{no:1,ad:'Ada',alan:'SAY',sube:'12A',kap:6,off:[],syncId:'slot'}];",
    };
    for (const [ad, kod] of Object.entries(defterler)) {
      const a = kapat(cihaz(s, GOOGLE, true));                   // signed in with the Google account that owns the test notebook
      a.run("D=varsayilan();D.ayar.testTarih='2026-09-20';EK.sekme='ayarlar';" + kod);
      await a.run('kaydet(true)');
      const yerel = a.store.yks_veri;
      assert.equal(a.run('testSifirlamaIzinli()'), false, ad);
      assert.doesNotMatch(a.run('gorunumAyarlar()') + a.run('gorunumAyarlar(true)'), /testSifirla|sıfırla<\/summary>/, ad + ' sees no reset');
      a.istem('SIFIRLA');
      await a.tikla('testSifirla');
      assert.equal(await a.run('testHesabiniSifirla()'), false, ad);
      await assert.rejects(a.run('testHesabiniSifirlaGercek()'), /Yalnızca test hesabı sıfırlanabilir/, ad);
      assert(!a.events.includes('prompt'), ad + ' is never asked to confirm');
      assert(!a.events.includes('signout'), ad + ' stays signed in');
      assert.deepEqual(s.silinen, [], ad + ' deletes nothing in the cloud');
      assert(s.belgeler['testDefter/' + GOOGLE.uid]);
      assert.equal(a.store.yks_veri, yerel, ad + ' keeps this device');
      assert.equal(a.run('CIKIS_DURUMU'), '', ad);
    }
    const t = kapat(await kur(sunucu()));                        // the test account itself still can
    assert.equal(t.run('testSifirlamaIzinli()'), true);
    assert.match(t.run("EK.sekme='ayarlar';gorunumAyarlar()"), /id="testSifirla"/);
  });

  await check('kaydol-form-removes-spaces-and-validates-before-creating-an-account', async kapat => {
    const s = sunucu(), a = kapat(uyeler(cihaz(s), s));
    await a.tikla('kaydolAc');
    assert.equal(a.run('EK.kaydol'), true);
    const h = a.nodes.ana.innerHTML;
    assert.match(h, /<section class="giris-kart" id="kaydolKart"[\s\S]*id="kaydolAd"[\s\S]*<input type="password" id="kaydolSifre" autocomplete="new-password"[\s\S]*data-sifre-goster="kaydolSifre"[\s\S]*<select id="kaydolAlanSec">[\s\S]*id="kaydolBaslat"[\s\S]*id="kaydolGeri"/);
    assert.equal(a.run("uyeAdiTemizle(' Ali  Veli\\t07 ')"), 'aliveli07', 'spaces anywhere are removed');
    assert.equal(a.run("uyeAdiTemizle('IŞIK')"), 'ışık', 'Turkish lower case');
    for (const [ad, sifre, alan, mesaj] of [['', 'gizli-123', 'SAY', /Bir kullanıcı adı seç/], ['a b', 'gizli-123', 'SAY', /3–30 karakter/],
        ['ali<veli>', 'gizli-123', 'SAY', /yalnızca harf, rakam/], ['aliveli', '12345', 'SAY', /en az 6 karakter/], ['aliveli', 'gizli-123', '', /Alanını seç/]]) {
      Object.assign(a.nodes, { kaydolAd: a.el({ value: ad }), kaydolSifre: a.el({ value: sifre }), kaydolAlanSec: a.el({ value: alan }), kaydolDurum: a.el() });
      await a.tikla('kaydolBaslat');
      assert.match(a.nodes.kaydolDurum.textContent, mesaj, ad + '/' + sifre + '/' + alan);
    }
    assert.deepEqual(a.cagri, [], 'nothing reaches Firebase');
    assert.equal(a.run('D.rol'), '');
    await a.tikla('kaydolGeri');
    assert.equal(a.run('EK.kaydol'), false);assert.match(a.nodes.ana.innerHTML, /id="ogrenciGirisAlan"/);
  });

  await check('kaydol-starts-a-yks-plan-this-week-without-school', async kapat => {
    const s = sunucu(), a = kapat(await kaydol(uyeler(cihaz(s), s)));
    assert.deepEqual(a.cagri, [['kaydol', 'aliveli07']], 'the user name is sent without spaces');
    assert.deepEqual(JSON.parse(a.run('JSON.stringify([D.rol,D.testHesap.tur,D.testHesap.ad,D.testHesap.uid])')), ['ogrenci', 'uye', 'aliveli07', 'uye-aliveli07']);
    const o = JSON.parse(a.run('JSON.stringify(D.ogr[0])'));
    assert.equal(o.ad, 'aliveli07'); assert.equal(o.alan, 'EA'); assert.equal(o.okul, false); assert.equal(o.sinavTuru, undefined, 'YKS');
    assert.equal(o.ilkAktif, a.run('bugunNo()'), 'starts today');
    assert.equal(a.run('D.ayar.donemBasi'), '2026-09-14', 'weeks start on this Monday');
    assert.equal(o.kendiPlan.tur, 'YKS', 'all YKS topics come with the own plan');
    assert(Object.values(o.kendiPlan.seviye).every(v => v === 'hic') && Object.keys(o.kendiPlan.seviye).length > 3);
    assert(o.kendiPlan.sira.length > 100, 'TYT and EA AYT topics: ' + o.kendiPlan.sira.length);
    assert(a.run('kendiPlanKuyrugu(0).length') > 0);
    assert.equal(a.run('EK.sekme'), 'ana'); assert.equal(a.run('EK.kaydol'), false);
    assert(a.events.some(e => /^bilgi:Hoş geldin aliveli07 — YKS planın bu hafta başladı/.test(e)));
    // The cloud notebook is the same as a test account's; the reset is not offered.
    assert.equal((await yukle(a)).tur, 'tamam');
    assert.equal(bulutDefteri(s, 'uye-aliveli07').testHesap.tur, 'uye');
    assert.equal(a.run('testSifirlamaIzinli()'), false, 'a Kaydol account cannot reset everything');
    const ayar = a.run("EK.sekme='ayarlar';gorunumAyarlar()") + a.run('gorunumAyarlar(true)');
    assert.match(ayar, /<h2>Hesabın<\/h2><p class="mini">Kullanıcı adı: <b>aliveli07<\/b><\/p>/);
    assert.doesNotMatch(ayar, /testSifirla|Google/);
  });

  await check('kaydol-refuses-a-taken-user-name-and-keeps-the-form', async kapat => {
    const s = sunucu(); kapat(await kaydol(uyeler(cihaz(s), s)));
    const b = kapat(await kaydol(uyeler(cihaz(s), s), 'aliVeli07', 'baska-sifre', 'SAY'));
    assert.match(b.nodes.kaydolDurum.textContent, /Bu kullanıcı adı alınmış/);
    assert.equal(b.run('D.rol'), ''); assert.equal(b.run('EK.kaydol'), true);
    assert.equal(b.nodes.kaydolAd.value, 'aliVeli07', 'what was typed stays');
  });

  await check('one-login-opens-a-kaydol-notebook-with-user-name-and-password', async kapat => {
    const s = sunucu(), a = kapat(await kaydol(uyeler(cihaz(s), s)));
    a.run('sonucIsle(0,[{ki:kendiPlanKuyrugu(0)[0].ki,gun:bugunNo(),not:3}])'); await a.run('kaydet(true)');
    assert.equal((await yukle(a)).tur, 'tamam');
    // A letter password goes straight to Kaydol; spaces and capitals in the name do not matter.
    const b = kapat(uyeler(cihaz(s), s));
    assert.equal(await girisYap(b, 'Ali Veli 07', 'yanlış-şifre'), 'Kullanıcı adı ve şifre ya da ad soyad ve okul numarası eşleşmedi. Bilgilerini kontrol et.');
    assert.equal(b.run('D.rol'), '');
    await girisYap(b, '  ALİ veli07 ', 'gizli-123');
    assert.deepEqual(b.cagri, [['giris', 'aliveli07'], ['giris', 'aliveli07']], 'not tried as a school login');
    assert.equal(b.run('D.testHesap.uid'), 'uye-aliveli07'); assert.equal(b.run('D.log.length'), 1);
    assert.equal(b.run('EK.sekme'), 'ana');
    assert(b.events.some(e => e === 'bilgi:Hoş geldin aliveli07 — defterin buluttan açıldı.'));
  });

  await check('a-numeric-password-tries-the-school-login-first', async kapat => {
    const s = sunucu(), a = kapat(await kaydol(uyeler(cihaz(s), s), 'sayi', '123456', 'SAY'));
    assert.equal((await yukle(a)).tur, 'tamam');
    const b = kapat(uyeler(cihaz(s), s));
    await girisYap(b, 'sayi', '1234');                  // fits a school number, not this account's password
    assert.deepEqual(b.cagri, [['okul', 'sayi', 1234]], 'a 4-character password cannot be a Kaydol password');
    b.cagri.length = 0;
    await girisYap(b, 'sayi', '123456');
    assert.deepEqual(b.cagri, [['giris', 'sayi']], 'above 9999 is never a school number');
    assert.equal(b.run('D.testHesap.uid'), 'uye-sayi');
    // A school student whose number happens to match: the school login wins and Kaydol is not tried.
    const c = kapat(uyeler(cihaz(s), s));
    c.run("ogrenciHesabindanYukle=async(ad,no)=>{window.bulut.girisOgrenciHesabi;okulGiris=[ad,no];return {ad,sunucudanAlinanSonuc:0};}");
    await girisYap(c, 'Ada Yılmaz', ' 42 ');
    assert.deepEqual(JSON.parse(c.run('JSON.stringify(okulGiris)')), ['Ada Yılmaz', 42]); assert.deepEqual(c.cagri, []);
  });

  await check('half-finished-kaydol-opens-the-setup-with-the-user-name', async kapat => {
    const s = sunucu(), a = kapat(uyeler(cihaz(s), s));
    s.uyeler.yarim = { sifre: 'gizli-123', u: { uid: 'uye-yarim', isAnonymous: false, email: 'x' } };
    await girisYap(a, 'yarim', 'gizli-123');
    assert.equal(a.run('D.testHesap.tur'), 'uye'); assert.equal(a.run('D.ogr.length'), 0);
    assert.match(a.nodes.ana.innerHTML, /id="kOgrAd"[^>]*value="yarim"/);
  });

  await check('kaydol-account-signs-in-again-with-its-password', async kapat => {
    const s = sunucu(), a = kapat(await kaydol(uyeler(cihaz(s), s)));
    a.setUser(null);
    const kart = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(kart, /bu cihazda oturum kapalı[\s\S]*<input type="password" id="uyeYenidenSifre"[\s\S]*id="uyeYenidenGir">Yeniden gir/);
    a.nodes.uyeYenidenSifre = a.el({ value: 'yanlis' });
    await a.tikla('uyeYenidenGir');
    assert(a.events.includes('alert:Şifre eşleşmedi.')); assert.equal(a.user(), null);
    a.nodes.uyeYenidenSifre = a.el({ value: 'gizli-123' });
    await a.tikla('uyeYenidenGir');
    assert.equal(a.user().uid, 'uye-aliveli07');
    assert.equal((await yukle(a)).tur, 'tamam');
  });

  await check('change-password-under-the-settings-heading-for-kaydol-only-not-google', async kapat => {
    const s = sunucu(), a = kapat(await kaydol(uyeler(cihaz(s), s)));
    const ayar = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(ayar, /^<div class="baslik"><h1>Ayarlar<\/h1><\/div><details class="kart" id="sifreKart"[^>]*><summary[^>]*>Şifre değiştir<\/summary>/, 'right under the heading, folded');
    assert.match(ayar, /<input type="password" id="sdMevcut" autocomplete="current-password" placeholder="Mevcut şifre">[\s\S]*<input type="password" id="sdYeni" autocomplete="new-password"/);
    a.b.sifreDegistir = async (m, y, okul) => { a.cagri.push(['sifre', m, y, okul]); if (m !== 'gizli-123') throw kimlikHatasi(); };
    const dene = async (mevcut, yeni) => {
      Object.assign(a.nodes, { sdMevcut: a.el({ value: mevcut }), sdYeni: a.el({ value: yeni }), sifreDurum: a.el() });
      await a.tikla('sifreDegistir'); return a.nodes.sifreDurum.textContent;
    };
    assert.match(await dene('', 'yeni-sifre'), /Mevcut şifreni yaz/);
    assert.match(await dene('gizli-123', 'kisa'), /en az 6 karakter/);
    assert.match(await dene('gizli-123', 'gizli-123'), /farklı olmalı/);
    assert.equal(a.cagri.filter(c => c[0] === 'sifre').length, 0, 'nothing reaches Firebase before the checks pass');
    assert.equal(await dene('yanlis', 'yeni-sifre'), 'Mevcut şifre yanlış.');
    assert.equal(await dene('gizli-123', 'yeni-sifre'), 'Şifren değişti.');
    assert.deepEqual(a.cagri.at(-1), ['sifre', 'gizli-123', 'yeni-sifre', null], 'a Kaydol account has no school lookup');
    assert(a.events.includes('bilgi:Şifren değişti. Bundan sonra kullanıcı adın ve yeni şifrenle giriş yap.'));
    const t = kapat(await kur(sunucu()));                       // Google test account: no password here
    assert.doesNotMatch(t.run("EK.sekme='ayarlar';gorunumAyarlar()"), /sifreKart/);
  });

  await check('school-student-sets-a-password-and-logs-in-with-name-and-password', async kapat => {
    const s = sunucu(), a = kapat(cihaz(s));
    a.run("D.rol='ogrenci';D.ogr=[{no:42,ad:'Ada Yılmaz',alan:'SAY',sube:'12A',sinif:12,kap:6,off:[6],aktif:true,hesapUid:'okul-1',syncId:'slot-1',maddeler:[],rutin:{}}];EK.ogr=0;");
    assert.match(a.run("EK.sekme='ayarlar';gorunumAyarlar()"), /id="sifreKart"[\s\S]*placeholder="Mevcut şifre - okul numarası"/);
    let arg = null; a.b.sifreDegistir = async (...x) => { arg = x; };
    Object.assign(a.nodes, { sdMevcut: a.el({ value: '42' }), sdYeni: a.el({ value: 'yeni-sifre' }), sifreDurum: a.el() });
    await a.tikla('sifreDegistir');
    assert.deepEqual(JSON.parse(JSON.stringify(arg)), ['42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }], 'the school number is the current password');
    assert(a.events.includes('bilgi:Şifren değişti. Bundan sonra ad soyadın ve yeni şifrenle giriş yap.'));
    a.b.sifreDegistir = async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); };
    Object.assign(a.nodes, { sdMevcut: a.el({ value: '42' }), sdYeni: a.el({ value: 'yeni-sifre' }), sifreDurum: a.el() });
    await a.tikla('sifreDegistir');
    assert.match(a.nodes.sifreDurum.textContent, /^Şifren değişmedi: buluta erişim izni yok/);
    a.run('delete D.ogr[0].hesapUid');
    assert.doesNotMatch(a.run('gorunumAyarlar()'), /sifreKart/, 'a student without a cloud account has no password');
    // Another device: Kaydol is tried first, then the name lookup; the plan loads with that account.
    const b = kapat(uyeler(cihaz(s), s));
    b.b.okulSifreGirisi = async (ad, sifre) => { b.cagri.push(['okulSifre', ad]); if (sifre !== 'yeni-sifre') throw kimlikHatasi(); return { uid: 'okul-1' }; };
    b.run('ogrenciHesabindanYukle=async(ad,no,hazir)=>{okulYukle=[ad,no,hazir&&hazir.uid];return {ad,sunucudanAlinanSonuc:0};}');
    assert.match(await girisYap(b, 'Ada Yılmaz', 'yanlis-sifre'), /^Kullanıcı adı ve şifre ya da ad soyad ve okul numarası eşleşmedi/);
    b.cagri.length = 0;
    await girisYap(b, 'Ada Yılmaz', 'yeni-sifre');
    assert.deepEqual(b.cagri, [['giris', 'adayılmaz'], ['okulSifre', 'Ada Yılmaz']]);
    assert.deepEqual(JSON.parse(b.run('JSON.stringify(okulYukle)')), ['Ada Yılmaz', null, 'okul-1']);
    assert(b.events.includes('bilgi:Hoş geldin Ada Yılmaz — planın sunucudan yüklendi.'));
    // Rules not yet published: the lookup read is refused and reads as a mismatch, not a raw error.
    const c = kapat(uyeler(cihaz(s), s));
    c.b.okulSifreGirisi = async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); };
    assert.match(await girisYap(c, 'Ada Yılmaz', 'yeni-sifre'), /eşleşmedi/);
  });

  await check('school-student-and-teacher-paths-are-unchanged', async kapat => {
    const a = kapat(cihaz(sunucu()));
    a.run("D.rol='ogrenci';D.ogr=[{no:1,ad:'Ada',alan:'SAY',sube:'12A',kap:6,off:[],syncId:'slot'}];");
    assert.equal(a.run('testHesabiMi()'), false);
    assert.equal((await yukle(a)).tur, 'yok');
    a.run("D.rol='rehber'");
    assert.equal(a.run('testHesabiMi()'), false);
  });

  console.log('test account regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
