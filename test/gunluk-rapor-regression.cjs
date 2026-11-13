#!/usr/bin/env node
'use strict';
// Günlük rapor (src/gunlukrapor.js): the document id and the Istanbul day key, payload validation and
// size caps (mirroring firestore.rules), the required reply prefix, the AI-failure fallback, the onemli path,
// the three-a-day slot walk, photo compression steps, and that nothing from the notebook (names, grades,
// ids) reaches yapayZeka. The model and Firestore are stubs; nothing leaves the process. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const depo = new Map();
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextDecoder,TextEncoder,btoa,atob,
  location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},
  sessionStorage:{getItem:k => depo.has(k) ? depo.get(k) : null, setItem:(k, v) => depo.set(k, String(v)), removeItem:k => depo.delete(k)},navigator:{},
  window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},
    querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; sandbox.window.sessionStorage = sandbox.sessionStorage;
vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const G = run('GUNLUKRAPOR');
const j = x => JSON.parse(JSON.stringify(x));

// ---- stubs
const UID = 'UidOgrenci1', SAHIP = 'ogretmen-sahip';
let yzIstekleri, yzCevap, belgeler, kapali, yazmaIstekleri, silinenler;
const izin = () => Object.assign(new Error('Missing or insufficient permissions.'), {code:'permission-denied'});
function bulutKur() {
  yzIstekleri = []; belgeler = new Map(); kapali = false; yazmaIstekleri = []; silinenler = [];
  sandbox.window.bulut = {yapilandirilmis:true, db:'db',
    mevcutKullanici:() => ({uid:UID, isAnonymous:false}), girisOgrenci:async () => ({uid:UID, isAnonymous:false}),
    doc:(db, ...yol) => ({yol:yol.join('/')}), collection:(db, ...yol) => ({yol:yol.join('/')}),
    getDoc:async r => ({exists:() => r.yol === 'ogrenciler/sync-1', data:() => ({ogretmenUid:SAHIP, bagliUid:UID, durum:'aktif', ogrenciBulutId:'bulut-1'})}),
    setDoc:async (r, v) => { yazmaIstekleri.push(r.yol); if (kapali || belgeler.has(r.yol)) throw izin(); belgeler.set(r.yol, j(v)); },
    getDocs:async () => ({docs:[...belgeler].map(([y, v]) => ({id:y.split('/').pop(), data:() => v}))}),
    deleteDoc:async r => { silinenler.push(r.yol); belgeler.delete(r.yol); },
    yapayZeka:async a => { yzIstekleri.push(a); const y = typeof yzCevap === 'function' ? yzCevap(a) : yzCevap; return {metin:typeof y === 'string' ? y : JSON.stringify(y), model:'stub'}; }};
}
const ovguYanit = 'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün: Bugün 40 paragraf sorusu çözmen ve yanlışlarını yazman çok değerli. Böyle devam et.';
const elestiriOn = 'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte eleştirin:';
const jpeg = n => 'data:image/jpeg;base64,' + 'QUJD'.repeat(Math.floor((n - 23) / 4));
function ogrenci() {
  depo.clear(); G.sifirla(); bulutKur(); yzCevap = {yanit:ovguYanit, onemli:false};
  run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-12';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ogrenciBulutId:'bulut-1',syncId:'sync-1',hesapUid:'${UID}'}];EK.ogr=0;`);
}
function sabitZaman(ms) {
  sandbox.Date = class extends Date { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } };
}
let passed = 0;
async function check(name, fn) { try { ogrenci(); sandbox.Date = Date; await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } finally { sandbox.Date = Date; } }
const rapor = (o = {}) => ({ogrenciUid:UID, ogrenciBulutId:'bulut-1', ts:1760000000000, metin:'Bugün paragraf çözdüm.', fotograflar:[], tercih:'ovgu', yzYanit:ovguYanit, onemli:false, ...o});

(async () => {
  await check('document id is <uid>-<YYYYAAGG Istanbul>-<n>; the day rolls over at Istanbul midnight, not UTC', async () => {
    sabitZaman(Date.UTC(2026, 10, 3, 20, 59, 59)); assert.equal(G.gunKodu(), '20261103');
    sabitZaman(Date.UTC(2026, 10, 3, 21, 0, 0)); assert.equal(G.gunKodu(), '20261104');
    sabitZaman(Date.UTC(2026, 11, 31, 22, 0, 0)); assert.equal(G.gunKodu(), '20270101');
    assert.equal(G.raporId('abc', '20261104', 2), 'abc-20261104-2');
    assert.match(G.raporId(UID, G.gunKodu(), 3), new RegExp('^' + UID + '-\\d{8}-[1-3]$'));
    assert.equal(G.KOTA, 3);
  });

  await check('payload validation mirrors the rules: fields, owner uid, size caps, JPEG data URLs, text or photo', async () => {
    assert.equal(G.dogrula(rapor(), UID), '');
    assert.equal(G.dogrula(rapor({metin:'', fotograflar:[jpeg(1000)]}), UID), '');
    assert.equal(G.dogrula(rapor({metin:'a'.repeat(4000), yzYanit:'b'.repeat(2500)}), UID), '');
    assert.equal(G.dogrula(rapor({fotograflar:[jpeg(280000), jpeg(280000), jpeg(280000)]}), UID), '');
    const kotu = {extra:{...rapor(), ekstra:1}, eksik:(({yzYanit, ...r}) => r)(rapor()), uid:rapor({ogrenciUid:'baska'}),
      uzun:rapor({metin:'a'.repeat(4001)}), yanit:rapor({yzYanit:'b'.repeat(2501)}), dort:rapor({fotograflar:[jpeg(1000), jpeg(1000), jpeg(1000), jpeg(1000)]}),
      buyuk:rapor({fotograflar:[jpeg(300004)]}), png:rapor({fotograflar:['data:image/png;base64,QUJD']}), url:rapor({fotograflar:['https://x.test/a.jpg']}),
      bos:rapor({metin:'  ', fotograflar:[]}), tercih:rapor({tercih:'harika'}), ts:rapor({ts:'1'}), ondalik:rapor({ts:1.5}), onemli:rapor({onemli:'evet'}),
      bulut:rapor({ogrenciBulutId:'x'.repeat(81)}), bulutBos:rapor({ogrenciBulutId:''}),
      toplam:rapor({metin:'a'.repeat(4000), yzYanit:'b'.repeat(2500), fotograflar:[jpeg(299000), jpeg(299000), jpeg(299000)]})};
    for (const [ad, r] of Object.entries(kotu)) assert.notEqual(G.dogrula(r, UID), '', ad + ' must be refused');
    assert.notEqual(G.dogrula(rapor(), ''), '');
  });

  await check('reply prefix: added when missing, a reworded one is replaced, ≤ 2500 characters, never for a crisis reply', async () => {
    assert.equal(G.onEk('ovgu'), 'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün:');
    assert.equal(G.onEk('elestiri'), elestiriOn);
    assert.equal(G.yanitiDogrula({yanit:ovguYanit, onemli:false}, 'ovgu').yanit, ovguYanit);
    assert.equal(G.yanitiDogrula({yanit:'Çok iyi çalışmışsın.', onemli:false}, 'ovgu').yanit, G.onEk('ovgu') + ' Çok iyi çalışmışsın.');
    assert.equal(G.yanitiDogrula({yanit:'Çok iyi.', onemli:false}, 'elestiri').yanit, elestiriOn + ' Çok iyi.');
    // wrong choice's prefix is replaced, not stacked
    assert.equal(G.yanitiDogrula({yanit:G.onEk('ovgu') + ' Metin.', onemli:false}, 'elestiri').yanit, elestiriOn + ' Metin.');
    const uzun = G.yanitiDogrula({yanit:'Cümle bir. '.repeat(500), onemli:false}, 'ovgu').yanit;
    assert(uzun.length <= 2500 && uzun.startsWith(G.onEk('ovgu')));
    const kriz = G.yanitiDogrula({yanit:'Bunu yazdığın için teşekkürler. Bugün rehber öğretmenine ya da güvendiğin bir yetişkine söyle.', onemli:true}, 'ovgu');
    assert.equal(kriz.onemli, true); assert(!kriz.yanit.startsWith('Rehber öğretmenin bir sonraki'));
    assert.throws(() => G.yanitiDogrula({yanit:'  ', onemli:false}, 'ovgu'));
    assert.throws(() => G.yanitiDogrula({onemli:false}, 'ovgu'));
    assert.throws(() => G.yanitiDogrula(null, 'ovgu'));
  });

  await check('a send asks the AI first, then writes one document with the reply; the card data carries X/3', async () => {
    sabitZaman(Date.UTC(2026, 10, 3, 12, 0, 0));
    const r = await G.gonder({metin:'Bugün 40 paragraf çözdüm.', fotograflar:[jpeg(1000)], tercih:'ovgu'});
    assert.equal(yzIstekleri.length, 1);
    assert.deepEqual([...belgeler.keys()], ['ogretmenYedek/' + SAHIP + '/gunlukRapor/' + UID + '-20261103-1']);
    const d = [...belgeler.values()][0];
    assert.deepEqual(Object.keys(d).sort(), ['fotograflar', 'metin', 'ogrenciBulutId', 'ogrenciUid', 'onemli', 'tercih', 'ts', 'yzYanit']);
    assert.equal(d.yzYanit, ovguYanit); assert.equal(d.onemli, false); assert.equal(d.ogrenciUid, UID); assert.equal(d.ogrenciBulutId, 'bulut-1');
    assert.equal(r.say, 1); assert.equal(r.yzBasarisiz, false);
    assert.equal(G.dogrula(d, UID), '');
    const r2 = await G.gonder({metin:'İkinci rapor', fotograflar:[], tercih:'elestiri'});
    assert.equal(r2.say, 2); assert(belgeler.has('ogretmenYedek/' + SAHIP + '/gunlukRapor/' + UID + '-20261103-2'));
    assert.deepEqual(yazmaIstekleri.slice(-1), ['ogretmenYedek/' + SAHIP + '/gunlukRapor/' + UID + '-20261103-2'], 'a known-used slot is not probed again');
  });

  await check('slots: an existing id (permission-denied) counts as used; the fourth report is stopped before the AI', async () => {
    sabitZaman(Date.UTC(2026, 10, 3, 12, 0, 0));
    belgeler.set('ogretmenYedek/' + SAHIP + '/gunlukRapor/' + UID + '-20261103-1', {});     // sent earlier, e.g. from another device
    const r = await G.gonder({metin:'a', fotograflar:[], tercih:'ovgu'});
    assert.equal(r.say, 2, 'slot 1 was used, so this is the second report today');
    assert(belgeler.has('ogretmenYedek/' + SAHIP + '/gunlukRapor/' + UID + '-20261103-2'));
    await G.gonder({metin:'b', fotograflar:[], tercih:'ovgu'});
    const once = yzIstekleri.length;
    await assert.rejects(G.gonder({metin:'c', fotograflar:[], tercih:'ovgu'}), e => e.grKod === 'limit' && /3 rapor/.test(e.message));
    assert.equal(yzIstekleri.length, once, 'no AI request for a day that is full');
  });

  await check('rules not published: every id is denied and the student reads "Günlük rapor henüz açık değil."', async () => {
    kapali = true;
    await assert.rejects(G.gonder({metin:'a', fotograflar:[], tercih:'ovgu'}), e => e.grKod === 'kapali' && e.message.startsWith('Günlük rapor henüz açık değil.'));
    assert.equal(yazmaIstekleri.length, 3, 'the three ids were tried');
    kapali = false;
    const r = await G.gonder({metin:'a', fotograflar:[], tercih:'ovgu'});
    assert.equal(r.say, 1, 'denied ids are not remembered as used once the rules are published');
  });

  await check('AI failure (error, timeout, bad JSON, no cloud AI) still sends the report with the fixed text', async () => {
    const hepsi = [() => { sandbox.window.bulut.yapayZeka = async () => { throw new Error('quota'); }; },
      () => { sandbox.window.bulut.yapayZeka = async () => ({metin:'bu json değil', model:'x'}); },
      () => { sandbox.window.bulut.yapayZeka = async () => ({metin:JSON.stringify({yanit:'', onemli:false}), model:'x'}); },
      () => { delete sandbox.window.bulut.yapayZeka; }];
    for (const bozma of hepsi) {
      ogrenci(); bozma();
      const r = await G.gonder({metin:'Bugün çalıştım.', fotograflar:[], tercih:'ovgu'});
      assert.equal(r.yzBasarisiz, true); assert.equal(r.yanit, 'Yapay zekâ şu an yanıt veremedi; rehber öğretmenin değerlendirecek.');
      assert.equal([...belgeler.values()][0].yzYanit, r.yanit); assert.equal(r.onemli, false);
    }
    // a timeout: the 60 s limit is shortened by scaling the sandbox timers
    ogrenci(); sandbox.window.bulut.yapayZeka = () => new Promise(() => {});
    const gercek = sandbox.setTimeout; sandbox.setTimeout = (f, ms) => gercek(f, ms >= 60000 ? 20 : ms);
    try { const r = await G.gonder({metin:'a', fotograflar:[], tercih:'elestiri'}); assert.equal(r.yzBasarisiz, true); assert.equal(belgeler.size, 1); }
    finally { sandbox.setTimeout = gercek; }
  });

  await check('a write that fails offline is retried with the same reply and does not spend another AI request', async () => {
    const yaz = sandbox.window.bulut.setDoc; let dene = 0;
    sandbox.window.bulut.setDoc = async (r, v) => { if (!dene++) throw new Error('unavailable'); return yaz(r, v); };
    await assert.rejects(G.gonder({metin:'a', fotograflar:[], tercih:'ovgu'}), /unavailable/);
    assert.equal(belgeler.size, 0);
    const r = await G.gonder({metin:'a', fotograflar:[], tercih:'ovgu'});
    assert.equal(r.say, 1); assert.equal(yzIstekleri.length, 1);
  });

  await check('onemli: the AI crisis flag is stored; when the AI is down a clear crisis phrase still sets it', async () => {
    yzCevap = {yanit:'Yazdıkların beni düşündürdü. Bugün rehber öğretmenine ya da güvendiğin bir yetişkine mutlaka söyle.', onemli:true};
    const r = await G.gonder({metin:'Kendimi çok kötü hissediyorum.', fotograflar:[], tercih:'elestiri'});
    assert.equal(r.onemli, true); const d = [...belgeler.values()][0];
    assert.equal(d.onemli, true); assert(!d.yzYanit.startsWith('Rehber öğretmenin bir sonraki')); assert.equal(G.dogrula(d, UID), '');
    ogrenci(); sandbox.window.bulut.yapayZeka = async () => { throw new Error('offline'); };
    const r2 = await G.gonder({metin:'Artık yaşamak istemiyorum.', fotograflar:[], tercih:'ovgu'});
    assert.equal(r2.yzBasarisiz, true); assert.equal(r2.onemli, true);
    ogrenci(); sandbox.window.bulut.yapayZeka = async () => { throw new Error('offline'); };
    assert.equal((await G.gonder({metin:'Kimya testi çözdüm.', fotograflar:[], tercih:'ovgu'})).onemli, false);
    // the instructions carry the safety rule
    assert.match(G.istem('ovgu'), /intihar[\s\S]*onemli alanını true yap/);
  });

  await check('only the report, the choice and fixed instructions go to yapayZeka: no name, number, class, ids or grades', async () => {
    run(`D.ogr[0].kayit=[{no:1,ders:'mat',dogru:17,yanlis:3}];D.ogr[0].hedefSiralama=1234;D.kurum='SENTETİK KURUM';`);
    await G.gonder({metin:'Bugün 40 paragraf çözdüm.', fotograflar:[jpeg(2000)], tercih:'elestiri'});
    assert.equal(yzIstekleri.length, 1);
    const a = yzIstekleri[0], tum = JSON.stringify(a);
    for (const yasak of ['ADA', '1001', '12-A', 'bulut-1', 'sync-1', UID, SAHIP, 'hedefSiralama', '1234']) assert(!tum.includes(yasak), 'must not send ' + yasak);
    assert(!/SENTETİK|\b1001\b|12-A|bulut-1|sync-1|hedefSiralama/.test(tum));
    assert.equal(a.parcalar.length, 3);
    assert.equal(a.parcalar[0].text, G.istem('elestiri'));
    assert.equal(a.parcalar[1].text, 'Öğrencinin yazdığı rapor:\nBugün 40 paragraf çözdüm.');
    assert.equal(a.parcalar[2].inlineData.mimeType, 'image/jpeg'); assert(!a.parcalar[2].inlineData.data.startsWith('data:'));
    assert.deepEqual(Object.keys(a).sort(), ['parcalar', 'sema', 'zamanAsimi']);
    assert.equal(a.zamanAsimi, 60000);
    assert.deepEqual(j(a.sema.required), ['yanit', 'onemli']);
    assert.match(a.parcalar[0].text, new RegExp(elestiriOn));
    assert.match(a.parcalar[0].text, /3 ile 5 cümle/); assert.match(a.parcalar[0].text, /sen/);
  });

  await check('photos: longest side ≤ 1280, JPEG quality stepped down from 0.75 until the data URL is ≤ 280000 characters', async () => {
    assert.deepEqual(j(G.olcek(4000, 3000)), [1280, 960]); assert.deepEqual(j(G.olcek(900, 1600)), [720, 1280]); assert.deepEqual(j(G.olcek(640, 480)), [640, 480]);
    const cagri = [];
    const uret = (boyut) => (w, h, q) => { cagri.push([w, h, q]); return 'x'.repeat(q > boyut ? 290000 : 270000); };
    assert.equal(G.sikistirDizi(uret(1), 4000, 3000).length, 270000);
    assert.deepEqual(cagri[0], [1280, 960, 0.75]);
    cagri.length = 0; G.sikistirDizi(uret(0.55), 4000, 3000);
    assert.deepEqual(cagri.map(c => c[2]), [0.75, 0.65, 0.55]);
    cagri.length = 0; assert.throws(() => G.sikistirDizi((w, h, q) => { cagri.push([w, h, q]); return 'x'.repeat(290000); }, 4000, 3000), /çok büyük/);
    assert(cagri.some(c => c[0] < 1280), 'a smaller picture is tried before giving up');
    assert(cagri.every(c => Math.max(c[0], c[1]) <= 1280));
    assert.equal(G.FOTO_HEDEF, 280000); assert(G.FOTO_HEDEF < G.FOTO_KARAKTER);
  });

  await check('an undecodable photo (HEIC in a browser without support) gives the Turkish message', async () => {
    sandbox.createImageBitmap = async () => { throw new Error('decode'); };
    sandbox.Image = class { set src(v) { setTimeout(() => this.onerror(new Error('x')), 0); } };
    sandbox.URL = {createObjectURL:() => 'blob:x', revokeObjectURL() {}};
    await assert.rejects(G.fotoSikistir({name:'IMG_1.HEIC', type:'image/heic'}), /^Error: Bu fotoğraf açılamadı; JPEG\/PNG deneyin\.$/);
    await assert.rejects(G.fotoSikistir({name:'not.pdf', type:'application/pdf'}), /Bu fotoğraf açılamadı/);
  });

  await check('teacher list: onemli first, then newest; a viewer gets no delete controls; Gördüm deletes the document', async () => {
    const l = [{id:'a', ts:300, onemli:false}, {id:'b', ts:100, onemli:true}, {id:'c', ts:200, onemli:false}, {id:'d', ts:50, onemli:true}];
    assert.deepEqual(j(G.sirala(l).map(x => x.id)), ['b', 'd', 'a', 'c']);
    run(`D=varsayilan();D.rol='rehber';D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ogrenciBulutId:'bulut-1'}];EK.ogr=0;EK.sekme='gunlukrapor';`);
    sandbox.window.bulut.mevcutKullanici = () => ({uid:SAHIP, isAnonymous:false});
    const yol = id => 'ogretmenYedek/' + SAHIP + '/gunlukRapor/' + id;
    belgeler.set(yol('r1'), rapor({ts:2000, onemli:false}));
    belgeler.set(yol('r2'), rapor({ts:1000, onemli:true, metin:'Önemli olan'}));
    await G.yukle();
    let h = G.ogretmenGorunum();
    assert(h.indexOf('Önemli olan') < h.indexOf('Bugün paragraf çözdüm.'), 'onemli first');
    assert.match(h, /SENTETİK ADA[\s\S]*12-A/); assert.equal((h.match(/data-gr-gordum/g) || []).length, 2); assert.match(h, /id="grTumu"/);
    assert.equal(G.rozet('gunlukrapor').includes('>2<'), true); assert.equal(G.rozet('ogrenciler').includes('>2<'), true); assert.equal(G.rozet('plan'), '');
    run(`IZLEME={sahipUid:'${SAHIP}'}`);
    h = G.ogretmenGorunum(); assert(!/data-gr-gordum|grTumu/.test(h), 'viewer has no delete buttons'); assert.match(h, /SENTETİK ADA/);
    run('IZLEME=null');
  });

  await check('the count is fetched once per owner when the menu renders (no listener); before publishing the teacher sees the rules note', async () => {
    run(`D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ana';`);
    let cagri = 0; const getDocs = sandbox.window.bulut.getDocs;
    sandbox.window.bulut.mevcutKullanici = () => ({uid:SAHIP, isAnonymous:false});
    sandbox.window.bulut.getDocs = async c => { cagri++; return getDocs(c); };
    sandbox.window.bulut.onSnapshot = () => { throw new Error('no live listener'); };
    belgeler.set('x/gunlukRapor/r1', rapor());
    G.sayiyiYukle(); G.sayiyiYukle(); run('rayCiz()'); await new Promise(r => setTimeout(r, 20)); run('rayCiz()');
    assert.equal(cagri, 1);
    G.sifirla();
    sandbox.window.bulut.getDocs = async () => { throw izin(); };
    G.sayiyiYukle(); await new Promise(r => setTimeout(r, 20));
    run(`EK.sekme='gunlukrapor'`);
    const h = G.ogretmenGorunum();
    assert.match(h, /firestore\.rules dosyası yayınlanmalı: Firebase konsolu → Firestore Database → Rules → Publish\./);
    assert(!/Okunmamış günlük rapor yok/.test(h));
  });

  await check('student menu entry only for a student linked to a teacher; teacher entry sits under Öğrenciler', async () => {
    assert(run('SEKMELER().some(s=>s[0]==="gunlukrapor")'));
    assert.deepEqual(j(run('MENU_OGRENCI.map(m=>m[0])')), ['hafiza', 'plan', 'denemeler', 'universite', 'gunlukrapor']);
    run('D.ogr[0].hesapUid=""'); assert(!run('SEKMELER().some(s=>s[0]==="gunlukrapor")'));
    run(`D=varsayilan();D.rol='rehber';`);
    assert(run('MENU_REHBER.find(m=>m[0]==="ogrenciler")[1].includes("gunlukrapor")'));
    assert(run('SEKMELER().some(s=>s[0]==="gunlukrapor"&&s[1]==="Günlük raporlar")'));
  });

  console.log(process.exitCode ? 'FAILED' : 'günlük rapor regression: ' + passed + ' checks passed');
})();
