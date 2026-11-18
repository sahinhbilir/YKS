'use strict';
// Every YKS topic in every plan (2026-11-18): the field's YKS plan holds every topic its exams ask (TYT for all, the field's
// AYT), the same as the connected-memory map says; an existing şube plan and a student's own plan get the topics they lack by
// themselves, once, without the teacher or the student doing anything, and never in the way of opening the notebook.
// Synthetic students only.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

function app() {
  const store = {};
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el() };
  const sandbox = { console: { ...console, error() {} }, setTimeout: () => 0, clearTimeout() {}, Blob, URL, URLSearchParams, crypto, TextEncoder, structuredClone,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl, alert() {}, confirm: () => true, prompt: () => '',
    fetch: async () => ({ ok: false }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: {}, innerWidth: 1280,
    matchMedia: () => ({ matches: false }), window: { scrollTo() {}, addEventListener() {}, bulut: null },
    document: { activeElement: null, addEventListener() {}, contains: () => true, getElementById: id => nodes[id] || null,
      querySelector: () => null, querySelectorAll: () => [], createElement: () => el(), body: { appendChild() {}, insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox), json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  return { run, json };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
const TYT_INKILAP = ["Mustafa Kemal'in Hayatı", 'XX. Yüzyıl Başlarında Osmanlı Devleti', 'I. Dünya Savaşı ve Sonrası Gelişmeler',
  "Millî Mücadele'nin Hazırlık Çalışmaları", "Büyük Millet Meclisi'nin Açılması", 'Sevr Antlaşması', 'Doğu ve Güney Cephesi', 'Batı Cephesi',
  'Lozan Barış Antlaşması', 'Atatürkçülük ve Türk İnkılabı'];
// A teacher's notebook with one 12th-grade şube of the given field whose plan is the given one.
function ogretmen(a, alan, plan) {
  a.run("D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-18';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;");
  a.run(`D.ogr=[{no:1,ad:'Sentetik',sube:'12-A',alan:'${alan}',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];`);
  a.run(`D.konuPlani={'12-A':${plan}};EK={ogr:0,sekme:'konuplani',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};`);
}
const konular = (a, k) => a.json(`[...new Set((D.konuPlani['12-A']||[]).flatMap(h=>h[${JSON.stringify(k)}]||[]))]`);

test('every field’s YKS plan holds every topic its exams ask, as the connected-memory map says (TYT for all, the field’s AYT)', () => {
  const a = app();
  for (const alan of ['SAY', 'EA', 'SÖZ', 'DİL']) {
    a.run(`D=varsayilan();D.rol='ogrenci';D.ogr=[{no:1,ad:'Sentetik',sube:'201',alan:'${alan}',sinif:12}]`);
    // the plan's topics by ders identity and name; the map's ders names that the plans spell another way
    const plan = new Set(a.json(`planKonuSirasi(yeniYksKonuPlani('${alan}')).map(x=>dersKimligi(x.dersAd)+'|'+konuAdiTamAnahtari(x.ad))`));
    const tyt = new Set(a.json(`kendiPlanKonulari('${alan}','TYT').map(x=>dersKimligi(x.dersAd)+'|'+konuAdiTamAnahtari(x.ad))`));
    const anahtar = a.json(`HARITA_VERI.konular.filter(k=>!k.gizli&&HARITAM.gorunur(D.ogr[0]).has(k.id)).map(k=>({id:k.id,tyt:k.sinav.includes('TYT'),
      a:[k.ders].concat(k.ders==='Felsefe (+ Felsefe Grubu)'?['Felsefe']:k.ders==='Matematik AYT'?['Matematik TYT']:[]).map(d=>dersKimligi(d)+'|'+konuAdiTamAnahtari(k.ad))}))`);
    const eksik = anahtar.filter(k => !k.a.some(x => plan.has(x))).map(k => k.id);
    assert.deepEqual(eksik, [], alan + ': exam topics missing from the plan');
    const tytEksik = anahtar.filter(k => k.tyt && !k.a.some(x => tyt.has(x))).map(k => k.id);
    assert.deepEqual(tytEksik, [], alan + ': TYT topics missing from the TYT plan');
  }
  // What changed (2026-11-18): SAY has TYT's İnkılap Tarihi; non-SAY fields TYT's Hareket ve Kuvvet and Enerji; SÖZ and DİL
  // TYT's function topics, under TYT mathematics; vectors stay AYT.
  const say = a.json("[...new Set(yeniYksKonuPlani('SAY').flatMap(h=>h['T.C. İnkılap Tarihi ve Atatürkçülük']||[]))]");
  assert.deepEqual(say, TYT_INKILAP);
  for (const alan of ['EA', 'SÖZ', 'DİL']) {
    const fiz = a.json(`[...new Set(yeniYksKonuPlani('${alan}').flatMap(h=>h.Fizik||[]))]`);
    assert(fiz.includes("Newton'un Hareket Yasaları") && fiz.includes('İş-Güç-Enerji') && !fiz.includes('Vektörler ve Kuvvet') && !fiz.includes('Çembersel Hareket'), alan);
  }
  for (const alan of ['SÖZ', 'DİL']) {
    const p = a.json(`yeniYksKonuPlani('${alan}')`);
    assert(!p.some(h => h['Matematik AYT']), alan + ': no AYT mathematics course');
    assert(['Fonksiyon Kavramı - Tanım ve Görüntü Kümesi', 'Fonksiyonlarda İşlemler', 'Grafik Yorumlama'].every(ad => p.some(h => (h['Matematik TYT'] || []).includes(ad))));
  }
  const dil = a.json("[...new Set(yeniYksKonuPlani('DİL').flatMap(h=>h['T.C. İnkılap Tarihi ve Atatürkçülük']||[]))]");
  assert.deepEqual(dil, TYT_INKILAP, 'DİL: TYT’s İnkılap part only');
  assert.equal(a.run("tytPlanKonusuMu('Fizik','Vektörler ve Kuvvet')"), false); assert.equal(a.run("tytPlanKonusuMu('Fizik',\"Newton'un Hareket Yasaları\")"), true);
  assert.equal(a.run("tytPlanKonusuMu('T.C. İnkılap Tarihi ve Atatürkçülük','Batı Cephesi')"), true);
  assert.equal(a.run("tytPlanKonusuMu('T.C. İnkılap Tarihi ve Atatürkçülük','Millî Mücadele')"), true, 'the catalogue unit a plan topic can resolve to');
  assert.equal(a.run("tytPlanKonusuMu('T.C. İnkılap Tarihi ve Atatürkçülük','İki Savaş Arasındaki Dönemde Türkiye ve Dünya')"), false);
  assert.equal(a.run("tytPlanKonusuMu('Matematik AYT','Türev')"), false);
});

test('a şube plan made before gets the topics it lacks by itself, in the coming weeks, once; a topic removed later stays removed', () => {
  const a = app();
  // The SAY plan as it was: no İnkılap Tarihi, and Newton’s laws and a Tarih topic taken out.
  ogretmen(a, 'SAY', `(()=>{const p=JSON.parse(JSON.stringify(yeniYksKonuPlani('SAY')));p.forEach(h=>{delete h['T.C. İnkılap Tarihi ve Atatürkçülük'];
    if(h.Tarih)h.Tarih=h.Tarih.filter(x=>x!=='Orta Çağ’da Dünya')});return p})()`);
  // The first plan week the change may use: next week's (2026-11-18 falls in the mid-term break, so this week and next map to
  // the same plan week, the next one taught).
  const once = a.run("JSON.stringify(D.konuPlani['12-A'])"), ilk = a.run("planHaftasiSirasi('12-A',pazartesi(bugunNo())+7)");
  assert(a.json('yksPlanEksikleri("12-A")').length >= 2, 'the gaps are seen');
  assert.equal(a.run('yksPlanlariniTamamla()'), true, 'changed: the caller saves');
  assert.deepEqual(konular(a, 'T.C. İnkılap Tarihi ve Atatürkçülük'), TYT_INKILAP);
  assert(konular(a, 'Tarih').includes('Orta Çağ’da Dünya'), 'a single missing topic of a ders the plan has');
  assert.deepEqual(a.json('yksPlanEksikleri("12-A")'), [], 'nothing missing');
  // Added from next week on only (this week's papers are out); every topic that was there is still there, in its week.
  const p0 = JSON.parse(once), p1 = a.json("D.konuPlani['12-A']");
  p0.forEach((h, i) => Object.entries(h).forEach(([d, l]) => l.forEach(ad => assert(p1[i][d].includes(ad), 'kept: ' + ad))));
  p1.forEach((h, i) => { if (i < ilk) assert.deepEqual(Object.values(h).flat().sort(), Object.values(p0[i] || {}).flat().sort(), 'weeks up to now unchanged'); });
  assert.equal(a.run("D.yksKonuSurumu['12-A']"), a.run('YKS_KONU_SURUMU'));
  // Once: a second run changes nothing; a topic the teacher removes afterwards does not come back.
  assert.equal(a.run('yksPlanlariniTamamla()'), false);
  a.run("D.konuPlani['12-A'].forEach(h=>{if(h.Tarih)h.Tarih=h.Tarih.filter(x=>x!=='Orta Çağ’da Dünya')})");
  assert.equal(a.run('yksPlanlariniTamamla()'), false); assert(!konular(a, 'Tarih').includes('Orta Çağ’da Dünya'));
  // A plan that already has everything is only marked.
  ogretmen(a, 'EA', "JSON.parse(JSON.stringify(yeniYksKonuPlani('EA')))");
  const tam = a.run("JSON.stringify(D.konuPlani['12-A'])");
  assert.equal(a.run('yksPlanlariniTamamla()'), true); assert.equal(a.run("JSON.stringify(D.konuPlani['12-A'])"), tam);
});

test('never in the way of opening the notebook: a viewing teacher changes nothing, an error leaves the plan as it was, the page draws', () => {
  const a = app();
  const eski = `(()=>{const p=JSON.parse(JSON.stringify(yeniYksKonuPlani('SAY')));p.forEach(h=>delete h['T.C. İnkılap Tarihi ve Atatürkçülük']);return p})()`;
  ogretmen(a, 'SAY', eski);
  const once = a.run("JSON.stringify(D.konuPlani['12-A'])");
  a.run('yalnizcaGoruntuleme=()=>true'); assert.equal(a.run('yksPlanlariniTamamla()'), false); assert.equal(a.run("JSON.stringify(D.konuPlani['12-A'])"), once);
  a.run('yalnizcaGoruntuleme=()=>false');
  // A failure half way: the plan is put back, nothing is marked, no exception reaches the page.
  a.run("const _y=yksEksikleriniEkle;yksEksikleriniEkle=(s,h)=>{D.konuPlani[s][0].Fizik.push('YARIM');throw new Error('sentetik')}");
  assert.equal(a.run('yksPlanlariniTamamla()'), false); assert.equal(a.run("JSON.stringify(D.konuPlani['12-A'])"), once);
  assert.equal(a.run("(D.yksKonuSurumu||{})['12-A']"), undefined, 'tried again next time');
  // The page draws as usual while it fails (no error screen), and the change is tried again on the next draw.
  a.run("var _hata=0;hataEkraniGoster=()=>{_hata++};EK.sekme='konuplani';ciz()"); assert.equal(a.run('_hata'), 0, 'no error screen');
  // Broken data (a plan week that is not an object) never makes it throw.
  a.run('yksEksikleriniEkle=_y'); a.run("D.konuPlani['12-A'][3]=null"); assert.doesNotThrow(() => a.run('yksPlanlariniTamamla()'));
});

test('a student’s own plan gets the topics it lacks in their place, once; general reviews already done are kept', () => {
  const a = app();
  a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-18';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;");
  // Outside a school (okul: false): the own plan is the student's whole plan, with its general reviews.
  a.run("D.ogr=[{no:1,ad:'Sentetik',sube:'201',okul:false,alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};");
  a.run("kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2027-04-23')");
  const tam = a.json('D.ogr[0].kendiPlan.sira');
  // As a plan made before: its İnkılap topics gone, one general review done.
  a.run("const kp=D.ogr[0].kendiPlan;kp.sira=kp.sira.filter(ki=>!/İnkılap/.test(konuDersAdi(ki)));delete kp.yksKonuSurumu;kp.genelTekrar.tamam[kp.genelTekrar.sira[0]]=bugunNo()-3");
  const ilkGt = a.run('D.ogr[0].kendiPlan.genelTekrar.sira[0]');
  assert(a.json('D.ogr[0].kendiPlan.sira').length < tam.length);
  assert.equal(a.run('yksPlanlariniTamamla()'), true);
  assert.deepEqual(a.json('D.ogr[0].kendiPlan.sira'), tam, 'back in their places');
  assert.equal(a.run(`D.ogr[0].kendiPlan.genelTekrar.tamam[${JSON.stringify(ilkGt)}]`), a.run('bugunNo()-3'), 'a done general review stays done');
  assert(a.json('D.ogr[0].kendiPlan.genelTekrar.sira').some(k => /İnkılap/.test(k)), 'İnkılap Tarihi has its general review');
  assert.equal(a.run('yksPlanlariniTamamla()'), false, 'once');
  // A teacher's notebook never changes a student's own plan (the student's device owns it).
  a.run("D.rol='rehber';D.ogr[0].kendiPlan.sira=D.ogr[0].kendiPlan.sira.slice(0,5);delete D.ogr[0].kendiPlan.yksKonuSurumu");
  a.run('yksPlanlariniTamamla()'); assert.equal(a.json('D.ogr[0].kendiPlan.sira').length, 5);
});

console.log(passed + ' YKS plan checks passed');
