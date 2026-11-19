'use strict';
// Haritam (connected-memory map) inside the app: who gets the tab, how a student's topics reach the map (plan topics by
// name, school units for every YKS topic they cover), and what the page draws. Synthetic students only.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

function app() {
  const store = {}, listeners = {};
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el() };
  const sandbox = { console, setTimeout: () => 0, clearTimeout() {}, Blob, URL, URLSearchParams, crypto, TextEncoder, structuredClone,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl, alert() {}, confirm: () => true, prompt: () => '',
    fetch: async () => ({ ok: false }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: {}, innerWidth: 1280,
    matchMedia: q => ({ matches: /dark/.test(q) }),
    window: { scrollTo() {}, addEventListener() {}, bulut: null },
    document: { activeElement: null, addEventListener(k, fn) { (listeners[k] ||= []).push(fn); }, contains: () => true,
      getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
      body: { appendChild() {}, insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  const json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  return { run, json, nodes, listeners, sandbox };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
const ogrenci = (a, alan, sinif) => {
  a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;");
  a.run(`D.ogr=[{no:1,ad:'Sentetik',sube:'201',${alan ? `alan:'${alan}',` : ''}sinif:${sinif},kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];` +
    "EK={ogr:0,sekme:'haritam',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};");
  if (alan) a.run(`kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('${alan}').map(d=>[d,'bilir'])),'2027-04-23')`);
};

// Denemeye göre ayarla (raise-only, 2026-11-20). dugum(a, id): a map topic's own recall today, its days to 90 %, its level and its days to the line.
const dugum = (a, id) => a.json(`(()=>{const s=HARITAM.durum(0).satir.get(${JSON.stringify(id)});return {r:s.r,rOz:s.rOz,sGun:s.sGun,katman:s.katman,sonOz:s.sonOz,gun:s.cizgiGun===null?null:s.cizgiGun-bugunNo()}})()`);
const sonuc = (a, ki, gun, not) => a.run(`D.log.push([bugunNo()-${gun},0,${ki},${not >= 3 ? 9 : 3},10,${not},Date.now()-${gun}*864e5+${ki}])`);
const planKi = (a, ad) => a.run(`(()=>{for(let i=KATALOG.length;i<konuSayisi();i++){const k=konuAl(i);if(k&&k[3]===${JSON.stringify(ad)})return i}return -1})()`);

test('Denemeye göre ayarla never lowers a topic: a foundation green from the topics built on it stays green when its unit went badly in a deneme (the reported bug)', () => {
  const a = app(); ogrenci(a, 'SAY', 12);
  // own results on topics that use Birinci Dereceden Denklemler: it is long-term and green by credit only, with no result of its own
  for (const ad of ['Basit Eşitsizlikler', 'Oran-Orantı', 'Sayı Problemleri', 'Kesir Problemleri', 'Yüzde Problemleri']) { const ki = planKi(a, ad); assert(ki > 0, ad); for (const g of [70, 45, 25, 8]) sonuc(a, ki, g, 4); }
  const once = dugum(a, 'tytDenklem'), temel = dugum(a, 'tytTemel');
  assert.equal(once.katman, 'uzun'); assert(once.r >= .9, 'green before'); assert.equal(once.sonOz, null, 'no result of its own');
  assert.equal(temel.katman, 'uzun'); assert(temel.rOz < .9, 'Temel Kavramlar is under the line before');
  // the deneme: the unit covering Birinci Dereceden Denklemler 0 of 4 (weak); Sayı Kümeleri 3 of 3 (known); Üslü İfadeler 5 of 5 on hard questions in two exams
  a.run(`D.turkiyeKiyas={v:1,t:bugunNo()-2,b:[{k:'MATEMATİK-T',o:'TYT',s:[],z:{e:[['D1',bugunNo()-30],['D2',bugunNo()-10]],r:[
    ['Birinci Dereceden Denklem ve Eşitsizlikler',[[0,1.5,2],[0,1.2,2]],[]],
    ['Sayı Kümeleri',[[2,1.6,2],[1,.8,1]],[]],
    ['Üslü İfadeler ve Denklemler',[[2,.8,2],[3,1.2,3]],[]]]}}]}`);
  const plan = a.json('HARITAM.denemeAyari(0)');
  assert.deepEqual(plan.seviyeler, {biliyor: 1, guclu: 1}, 'the weak unit raises nothing');
  assert.match(a.run('HARITAM.denemeDugmesi(0)'), /data-deneme-ayarla>Denemeye göre ayarla<\/button> Bu sistemi kullanmadan çalıştıysan: denemelerde bildiğini gösterdiğin 2 konu aklında görünsün\. Hiçbir konu aşağı inmez/);
  assert.match(a.run('gorunumHafiza()'), /data-deneme-ayarla/, 'on Hafızam'); assert.match(a.run('HARITAM.gorunum()'), /data-deneme-ayarla/, 'on Haritam');
  assert.equal(a.run('HARITAM.denemeyeGoreAyarla(0)'), 2);
  assert.equal(a.run(`hafizaElleDogru(D.ogr[0].hafizaElle,konuSayisi())`), true, 'a valid own setting, as Düzenle writes');
  const sonra = dugum(a, 'tytDenklem');
  for (const k of ['rOz', 'sGun', 'katman']) assert.equal(sonra[k], once[k], 'Birinci Dereceden Denklemler’s own memory is exactly as before: ' + k);
  assert(sonra.gun >= once.gun - 1e-9, 'and it stays above the line as long');
  assert(sonra.r >= once.r, 'its shown recall can only rise (a raised foundation pulls it down less)');
  for (const id of ['tytDenklem', 'tytEsitsizlik']) assert(dugum(a, id).r >= .9, id + ' stays green');
  const t2 = dugum(a, 'tytTemel');
  assert(Math.abs(t2.rOz - .96) < .005 && t2.r >= .9, 'Temel Kavramlar is raised over the line (biliyor: 96 %)'); assert(t2.sGun >= temel.sGun - .5, 'and keeps its long memory'); assert.equal(t2.katman, 'uzun');
  const u = dugum(a, 'tytUslu'); assert(Math.abs(u.rOz - .97) < .005, 'güçlü: 97 %'); assert.equal(u.katman, 'uzun', 'hard questions right in two exams: long-term');
  assert(u.gun >= 28 && u.gun <= 32, 'güçlü: about 30 days above the line, ' + u.gun);
  assert.equal(a.json('HARITAM.denemeAyari(0)').konular, 0, 'a second press finds nothing');
  assert.match(a.run('HARITAM.denemeDugmesi(0)'), /Denemelerde bildiğin konular aklında gösteriliyor\. <button type="button" class="dugme mini" data-deneme-geri>Geri al<\/button>/);
  assert.equal(a.run('HARITAM.denemeAyariniGeriAl(0)'), 2); assert.equal(a.run('D.ogr[0].hafizaElle'), undefined, 'Geri al removes exactly that press');
  assert.equal(dugum(a, 'tytTemel').rOz, temel.rOz, 'and the map is as before');
  // a viewing teacher, or a teacher's notebook, never gets the button
  a.run('D.ogr.push({no:2,ad:"X"})'); assert.equal(a.run('HARITAM.denemeDugmesi(0)'), '');
});

test('Denemeye göre ayarla reads the deneme karnesi first: zor soruları da doğru = long-term, çoğu doğru = settling, kolaylar = a week; weak topics and the student’s newer word stay; Geri al brings an earlier setting back', () => {
  const a = app(); ogrenci(a, 'SAY', 12);
  // The deneme karnesi (v2): every question [no, konu index, band 0–4, result]. kv: a konu's questions from its totals (d of n right; kd of kn easy, band 1;
  // zd of zn hard, band 3; the rest orta).
  const kv = (k, d, n, kd, kn, zd, zn) => { const q = [], ekle = (adet, dogru, z) => { for (let i = 0; i < adet; i++) q.push([0, k, z, i < dogru ? 1 : 0]); };
    ekle(kn, kd, 1); ekle(zn, zd, 3); ekle(n - kn - zn, d - kd - zd, 2); return q; };
  const sinav = (ad, gun, konular, qs) => `[${JSON.stringify(ad)},isoDan(bugunNo()-${gun}),${JSON.stringify(konular)},[['Matematik','TYT','A',${JSON.stringify(qs.flat().map((q, i) => [i + 1, ...q.slice(1)]))}]]]`;
  // newest first, as the package sends it
  a.run(`D.konuKarne={v:2,t:bugunNo(),s:[${sinav('D2', 10, ['Üslü İfadeler ve Denklemler', 'Sayı Kümeleri', 'Bölünebilme Kuralları', 'Kümelerde Temel Kavramlar'],
    [kv(0, 2, 2, 1, 1, 1, 1), kv(1, 2, 2, 2, 2, 0, 0), kv(2, 3, 5, 3, 3, 0, 2), kv(3, 1, 4, 1, 2, 0, 2)])},${sinav('D1', 30, ['Üslü İfadeler ve Denklemler'], [kv(0, 3, 3, 1, 1, 2, 2)])}]}`);
  // Türkiye says the student knew Kümeler: the karne (which knows the easy and the hard ones) decides
  a.run(`D.turkiyeKiyas={v:1,t:bugunNo()-2,b:[{k:'MATEMATİK-T',o:'TYT',s:[],z:{e:[['D2',bugunNo()-10]],r:[['Kümelerde Temel Kavramlar',[[2,1.5,2]],[]]]}}]}`);
  const sv = x => a.run(`HARITAM.denemeSeviyesi(${JSON.stringify(x)})`);
  assert.equal(sv({d: 5, n: 5, b: null, kd: 2, kn: 2, zd: 3, zn: 3, sinav: 2}), 'guclu');
  assert.equal(sv({d: 5, n: 5, b: null, kd: 2, kn: 2, zd: 3, zn: 3, sinav: 1}), 'biliyor', 'one exam is not enough for long-term');
  assert.equal(sv({d: 3, n: 4, b: 1.6, kd: null, kn: null, zd: null, zn: null, sinav: 2}), 'guclu', 'Türkiye: the network averaged at most half');
  assert.equal(sv({d: 3, n: 4, b: 2.4, kd: null, kn: null, zd: null, zn: null, sinav: 2}), 'biliyor');
  assert.equal(sv({d: 3, n: 5, b: null, kd: 3, kn: 3, zd: 0, zn: 2, sinav: 1}), 'temel');
  assert.equal(sv({d: 1, n: 4, b: 2, kd: null, kn: null, zd: null, zn: null, sinav: 1}), null);
  // the student's own word: a result on Bölme ve Bölünebilme after the exam stays; an earlier own setting on Temel Kavramlar is raised and comes back with Geri al
  const bolme = planKi(a, 'Bölme ve Bölünebilme'), temelKi = planKi(a, 'Temel Kavramlar, Tek-Çift ve Negatif-Pozitif Sayılar');
  sonuc(a, bolme, 3, 2);
  a.run(`D.ogr[0].hafizaElle={${temelKi}:{g:bugunNo()-15,r:.6,s:3,ts:1}}`);
  const oncekiBolme = dugum(a, 'tytBolme');
  const plan = a.json('HARITAM.denemeAyari(0)');
  assert.deepEqual(plan.seviyeler, {guclu: 1, biliyor: 1}, 'Bölünebilme (own result after the exam) and Kümeler (weak in the karne) are left');
  assert.equal(a.run('HARITAM.denemeyeGoreAyarla(0)'), 2);
  assert.equal(dugum(a, 'tytKume').r, null, 'a weak topic is not turned red');
  const b2 = dugum(a, 'tytBolme'); for (const k of ['rOz', 'sGun', 'katman', 'sonOz']) assert.equal(b2[k], oncekiBolme[k], 'Bölünebilme’s own memory stays: ' + k); assert(b2.r >= oncekiBolme.r);
  assert.equal(dugum(a, 'tytUslu').katman, 'uzun');
  const t = dugum(a, 'tytTemel'); assert(Math.abs(t.rOz - .96) < .005, 'biliyor: 96 %'); assert(t.gun >= 12.5 && t.gun <= 15.5, 'biliyor: two weeks above the line, ' + t.gun); assert.equal(t.katman, 'orta', 'settling, not long-term');
  assert.equal(a.run('HARITAM.denemeAyariniGeriAl(0)'), 2);
  assert.deepEqual(a.json('D.ogr[0].hafizaElle'), {[temelKi]: {g: a.run('bugunNo()-15'), r: .6, s: 3, ts: 1}}, 'the earlier own setting is back');
});

test('the embedded module and the map are in index.html', () => {
  assert.match(source, /const HARITA_VERI = \{/); assert.match(source, /const HAFIZA_AG = /); assert.match(source, /const HARITAM = /);
  assert.match(html, /\/\* BEGIN HARITAM \*\/[\s\S]*\.hm-svg/);
});

test('who gets Haritam: every YKS student, with the topics of their exams (TYT for all, the AYT of their field)', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const V = a.json('HARITA_VERI.konular'), K = new Map(V.map(k => [k.id, k])), gor = () => new Set(a.json('[...HARITAM.gorunur(D.ogr[0])]'));
  const AYT = {SAY: ['Geometri', 'Matematik AYT', 'Fizik', 'Kimya', 'Biyoloji'],
    EA: ['Geometri', 'Matematik AYT', 'Türk Dili ve Edebiyatı', 'Tarih', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Coğrafya'],
    SÖZ: ['Türk Dili ve Edebiyatı', 'Tarih', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Coğrafya', 'Felsefe (+ Felsefe Grubu)', 'Din Kültürü'], DİL: []};
  assert(V.every(k => Array.isArray(k.sinav) && k.sinav.length && k.sinav.every(x => x === 'TYT' || x === 'AYT')), 'every topic says its exam');
  for (const alan of ['SAY', 'EA', 'SÖZ', 'DİL']) {
    a.run(`D.ogr[0].alan='${alan}'`); const g = gor();
    for (const k of V) {
      const asil = k.gizli ? K.get(k.parcasi) : k, olmali = asil.sinav.includes('TYT') || (asil.sinav.includes('AYT') && AYT[alan].includes(asil.ders));
      assert.equal(g.has(k.id), olmali, alan + ' ' + k.id);
    }
    assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), a.json('HARITAM.dersleri(D.ogr[0])').filter(d => V.some(k => k.ders === d && g.has(k.id))));
  }
  // Every YKS student takes TYT: Tarih, Din Kültürü, Felsefe and Coğrafya (TYT) for SAY; TYT Fizik, Kimya, Biyoloji for EA.
  a.run("D.ogr[0].alan='SAY'"); let g = gor(), d = a.json('HARITAM.dersleri(D.ogr[0])');
  for (const x of ['Tarih', 'Din Kültürü', 'Felsefe (+ Felsefe Grubu)', 'Coğrafya', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Fizik']) assert(d.includes(x), 'SAY ' + x);
  assert(!d.includes('Türk Dili ve Edebiyatı'), 'SAY: no AYT Edebiyat');
  assert(g.has('felBilgi') && g.has('tarTurkIslam') && g.has('din91') && g.has('cogIklimTr') && g.has('inkWW1') && g.has('fizCembersel'));
  assert(!g.has('cogEkosistem') && !g.has('psiSurec') && !g.has('inkWW2'), 'SAY: no AYT Coğrafya, Felsefe grubu or later İnkılap');
  a.run("D.ogr[0].alan='EA'"); g = gor(); d = a.json('HARITAM.dersleri(D.ogr[0])');
  assert(d.includes('Fizik') && d.includes('Türk Dili ve Edebiyatı') && d.includes('Tarih'));
  assert(g.has('fizMadde') && g.has('fizNewton') && !g.has('fizCembersel'), 'EA: TYT Fizik only (Newton’s laws are TYT: the school’s table)');
  assert(g.has('cogEkosistem') && g.has('inkWW2') && !g.has('psiSurec') && !g.has('manKlasik'), 'EA: AYT Coğrafya-1 and Tarih-1, no Felsefe grubu');
  a.run("D.ogr[0].alan='SÖZ'"); g = gor();
  assert(g.has('psiSurec') && g.has('tytOran') && !g.has('aytLimitOzellik'), 'SÖZ: the Felsefe grubu and TYT Matematik, no AYT Matematik');
  assert(a.json('SEKMELER().map(s=>s[0])').includes('haritam'));
  a.run("D.ogr[0].alan='DİL'"); g = gor(); assert(g.has('trkParagrafAnlam') && g.has('tytOran') && !g.has('edSiirBilgi'), 'DİL: every TYT topic, no AYT');
  a.run("delete D.ogr[0].alan;D.ogr[0].sinif=10"); assert.equal(a.json('HARITAM.dersleri(D.ogr[0]).length'), 13, 'no field yet: every subject');
  assert.equal(gor().size, V.length);
  a.run("D.ogr[0].sinavTuru='LGS'"); assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), []);
  assert(a.json('ETKINLIK_SEKMELER').includes('haritam'), 'visits are counted like other pages');
  a.run("D.rol='rehber'"); assert(!a.json('SEKMELER().map(s=>s[0])').includes('haritam'), 'not a teacher page');
});

test('every topic of the YKS plan has its point: Tarih, Din Kültürü, and Felsefe’s branches as parts of their plan topic', () => {
  const a = app();
  ogrenci(a, 'EA', 12);
  const V = a.json('HARITA_VERI.konular'), kaynak = new Map(a.json('[...HARITAM.kaynaklar()]'));
  // Every topic of the app's YKS plans (the field plans and the subjects every plan gets) is a point, by its plan name.
  const planAdlari = a.json("(()=>{const s=new Set();for(const alan of ['SAY','EA'])for(const h of yeniYksKonuPlani(alan))for(const [d,l] of Object.entries(h))for(const ad of l)s.add(dersKimligi(d)+'|'+konuAdiTamAnahtari(ad.replace(/\\s*(?:\\(devamı\\)|- devamı)$/i,'')));return [...s]})()");
  const noktalar = new Set(a.json("HARITA_VERI.konular.filter(k=>!k.gizli).flatMap(k=>[k.ders].concat(k.ders==='Felsefe (+ Felsefe Grubu)'?['Felsefe']:[]).map(d=>dersKimligi(d)+'|'+konuAdiTamAnahtari(k.ad)))"));
  const eksik = planAdlari.filter(x => !noktalar.has(x) && !/GENEL TEKRAR/i.test(x));
  assert.deepEqual(eksik, [], 'plan topics with no point');
  // Every topic of this plan reaches its catalogue topic: by name (the Felsefe grubu too, which the plans call "Felsefe"), or
  // as a school unit where the catalogue spells it otherwise ("Mö 6. Yüzyıl-ms 2. …").
  const esler = new Map(a.json('[...HARITAM.cozumle().esler]'));
  for (const k of V.filter(k => !k.gizli && (['Tarih', 'Din Kültürü'].includes(k.ders) || (k.ders === 'Felsefe (+ Felsefe Grubu)' && /Felsef/.test(k.ad)))))
    assert(kaynak.get(k.id).length >= 1, k.id + ' reaches its catalogue topic');
  for (const id of ['felKonular', 'felTanima', 'tarTurkIslam', 'tarOsmSiyaset', 'din105', 'din115']) assert(esler.get(id).length >= 1, id + ' by name');
  assert.equal(V.filter(k => k.ders === 'Tarih').length, 18); assert.equal(V.filter(k => k.ders === 'Din Kültürü').length, 20);
  // Felsefe: the seven branches (MEB 10.3.1–10.3.7) are parts of the plan topic: its lessons and tests are theirs.
  const dal = V.filter(k => k.dal).map(k => k.ad);
  assert.deepEqual(dal, ['Varlık Felsefesi', 'Bilgi Felsefesi', 'Bilim Felsefesi', 'Ahlak Felsefesi', 'Din Felsefesi', 'Siyaset Felsefesi', 'Sanat Felsefesi']);
  assert(V.filter(k => k.dal).every(k => k.gizli && k.parcasi === 'felKonular'));
  const ki = kaynak.get('felKonular')[0];
  a.run(`sonucIsle(0,[{ki:${ki},gun:bugunNo()-5,not:3,dogru:null,soru:null}])`);
  const R = new Map(a.json('[...HARITAM.durum(0).satir].map(([id,s])=>[id,s.sonOz])'));
  for (const id of ['felKonular', 'felBilgi', 'felAhlak', 'felSanat']) assert.equal(R.get(id), a.run('bugunNo()') - 5, id + ' tested with its plan topic');
  a.run("EK.haritamSecili='felBilgi'"); const h = a.run('HARITAM.gorunum()');
  assert.match(h, /Bilgi Felsefesi · Felsefenin Temel Konuları ve Problemleri konusunun parçası/);
  assert.match(h, new RegExp('data-hf-ac="' + ki + '"'), 'the plan topic’s own Hafızam card');
  const r = id => +new RegExp('data-hm="' + id + '"[^>]*>\\s*<circle class="hm-vur" cx="[^"]*" cy="[^"]*" r="([0-9.]+)"').exec(h)[1];
  assert(r('felBilgi') >= 10, 'a branch is drawn as a topic (a hidden part’s touch area is smaller)');
  // The TYT table's rows count for the branches (Bilgi Felsefesi 12 questions 2018–2025), not for the whole unit.
  const S = a.json('HARITA_VERI.sinavSatirlari'), bilgi = S.find(x => x.sinav === 'TYT' && x.konu === 'Bilgi Felsefesi');
  assert.deepEqual(bilgi.paylar, {felBilgi: 1}); assert(!S.some(x => x.sinav === 'TYT' && x.paylar.felKonular));
});

test('a plan topic and a school unit both reach the map', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const kaynak = a.json('[...HARITAM.kaynaklar()].map(([id,k])=>[id,k])'), K = new Map(kaynak);
  assert(K.get('geoDik').length >= 1, 'the plan topic Dik Üçgen');
  // A continued plan topic ("… - devamı", "… (devamı)") is the same topic: it feeds the same point.
  const fiilimsi = K.get('trkFiilimsi')[0];
  a.run(`konuAl(${fiilimsi})[3]='Fiilimsiler (Eylemsiler) - devamı'`); assert.equal(a.run(`konuAl(${fiilimsi})[3]`), 'Fiilimsiler (Eylemsiler) - devamı');
  assert(a.json(`HARITAM.kaynaklar().get('trkFiilimsi')`).includes(fiilimsi), 'the "- devamı" topic feeds Fiilimsiler');
  a.run(`konuAl(${fiilimsi})[3]='Fiilimsiler (Eylemsiler)'`);
  const trig = a.run("KATALOG.findIndex(k=>k[0]===1&&k[1]===11&&k[3]==='Trigonometrik Fonksiyonlar')");
  for (const id of ['aytBirim', 'aytOzdeslik', 'aytIsaret', 'aytDonusum', 'aytPeriyot', 'aytTersTrig']) assert(K.get(id).includes(trig), id + ' fed by the grade-11 unit');
  const dik = K.get('geoDik')[0];
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-6,not:3,dogru:null,soru:null},{ki:${trig},gun:bugunNo()-4,not:3,dogru:null,soru:null}])`);
  const d = a.json('(()=>{const d=HARITAM.durum(0);return {r:[...d.satir].map(([id,s])=>[id,s.sonOz,s.r])}})()'), R = new Map(d.r.map(([id, g, r]) => [id, {g, r}]));
  const bugun = a.run('bugunNo()');
  assert.equal(R.get('geoDik').g, bugun - 6); assert.equal(R.get('pOranlar').g, bugun - 6, 'its hidden part is tested with it');
  for (const id of ['aytBirim', 'aytOzdeslik', 'aytPeriyot']) assert.equal(R.get(id).g, bugun - 4, id);
  assert(R.get('pOranlar').r > 0 && R.get('aytBirim').r > 0);
});

test('the page: one point per topic of the student\'s subjects, the real Hafızam card when a topic is chosen', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const dik = a.json("HARITAM.kaynaklar().get('geoDik')[0]");
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-6,not:3,dogru:null,soru:null}])`);
  let h = a.run('HARITAM.gorunum()');
  assert.match(h, /<svg class="hm-svg"/);
  assert.equal((h.match(/class="hm-d[ "]/g) || []).length, a.run('HARITAM.gorunur(D.ogr[0]).size'), 'every topic of SAY’s exams');
  assert.doesNotMatch(h, /data-hm-kart>[^<]*<div class="hf-oge/, 'no card before a topic is chosen');
  a.run("EK.haritamSecili='geoDik'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /hm-kart-yer hm-sabit/); assert.match(h, new RegExp('data-hf-ac="' + dik + '"'), 'Hafızam’s own Çalıştım button');
  assert.match(h, /hm-svg hm-odak/, 'neighbours lit, the rest dimmed');
  a.run("EK.haritamSecili='pOranlar'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /Dik Üçgen konusunun parçası/, 'a hidden part shows its topic’s card');
  a.run("D.ogr[0].alan='EA';EK.haritamSecili=undefined"); h = a.run('HARITAM.gorunum()');
  assert.doesNotMatch(h, /data-hm="fizCembersel"/, 'EA: no AYT physics points'); assert.match(h, /data-hm="fizMadde"/, 'EA: TYT physics');
  a.run("D.ogr[0].alan='SAY';EK.haritamDers='Fizik'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /data-hm="fizVektor"/); assert.doesNotMatch(h, /data-hm="geoDik"/, 'subject filter');
});

test('the student\'s FSRS settings and only real results go in', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const dik = a.json("HARITAM.kaynaklar().get('geoDik')[0]");
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-20,not:3,dogru:null,soru:null}])`);
  const r1 = a.json("HARITAM.durum(0).satir.get('geoDik').rOz");
  a.run(`D.ogr[0].unutmaDers={[dersAnahtari(${dik})]:2}`);
  const r2 = a.json("HARITAM.durum(0).satir.get('geoDik').rOz");
  assert(r2 > r1, 'slower forgetting set for the lesson keeps the recall higher: ' + r1 + ' → ' + r2);
  a.run(`D.log.push([bugunNo()+3,0,${dik},9,10,null])`);
  assert.equal(a.json("HARITAM.durum(0).satir.get('geoDik').sonOz"), a.run('bugunNo()') - 20, 'a future row is ignored');
});

// Haritam is Hafızam drawn as a map: it reads the same states (results with their entry time, lesson days, Düzenle,
// "Çoktan unuttum", basket lessons); with every link value at 0 it gives Hafızam's own numbers, and with the links
// Hafızam shows the map's number, so the two pages always agree.
test('Haritam reads Hafızam\'s own states, and the two pages show one number', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const K = new Map(a.json('[...HARITAM.kaynaklar()]')), ki = id => K.get(id)[0], b = a.run('bugunNo()');
  const sonuc = (id, g, n) => a.run(`sonucIsle(0,[{ki:${ki(id)},gun:${b + g},not:${n},dogru:null,soru:null}])`);
  sonuc('geoDik', -40, 3); sonuc('geoDik', -20, 3); sonuc('tytKok', -30, 3); sonuc('tytKok', -12, 2); sonuc('aytOzdeslik', -15, 3);
  sonuc('geoAci', -50, 3); sonuc('fizVektor', -25, 3); sonuc('aytBirim', -9, 4);
  assert(a.run(`hafizaElleKaydet(0,${ki('geoDik')},0.7,14)`), 'Düzenle');
  assert(a.run(`hafizaElleKaydet(0,${ki('tytKok')},0.01,1)`), 'Çoktan unuttum');
  sonuc('geoAci', 0, 2); // after the settings, the same day
  // A basket lesson today on a topic with an older result.
  const hb = a.run('buHafta(0)'), anl = ['fizVektor', 'aytOzdeslik', 'geoAci'].find(id => a.run(`ogrenciElleEkle(0,${hb},[${b}-${hb}],{tur:'anlatim',ki:${ki(id)}})`) === 1);
  assert(anl, 'a basket lesson was added');
  const hafiza = a.json('hafizaDurumu(0).liste'), H = new Map(hafiza.map(x => [x.ki, x]));
  // Map nodes with one notebook topic that has any state (a topic Hafızam does not list has none: no result, lesson,
  // setting or basket lesson), so its events are the node's events.
  const gizli = new Set(a.json("HARITA_VERI.konular.filter(k=>k.gizli).map(k=>k.id)"));
  const kac = new Map(); K.forEach((l, id) => { if (!gizli.has(id)) l.forEach(k => kac.set(k, (kac.get(k) || 0) + 1)); });
  const tekil = [...K].filter(([id, l]) => !gizli.has(id) && l.filter(k => H.has(k)).length === 1).map(([id, l]) => [id, l.find(k => H.has(k))]);
  assert(tekil.length >= 8, 'enough topics with one source: ' + tekil.length);
  const sifir = new Map(a.json("[...HARITAM.durum(0,{kredi:0,ceza:0,cekis:0}).satir].map(([id,s])=>[id,{r:s.r,c:s.cizgiGun}])"));
  for (const [id, k] of tekil) {
    const x = H.get(k), own = Number.isFinite(x.rKendi) ? x.rKendi : x.r;
    assert(sifir.get(id).r !== null, id + ' has memory on the map');
    assert(Math.abs(sifir.get(id).r - own) < 1e-9, id + ': no link effects → Hafızam\'s own number ' + sifir.get(id).r + ' vs ' + own);
  }
  assert(Math.abs(sifir.get('geoDik').r - 0.7) < 0.02, 'Düzenle: the map starts from the student\'s setting');
  assert(sifir.get('tytKok').r < 0.05, '"Çoktan unuttum": nearly nothing on the map');
  assert(H.get(ki(anl)).anlatildi, 'the basket lesson restarted ' + anl + ' in Hafızam'); assert(Math.abs(sifir.get(anl).r - 1) < 1e-9, '…and on the map');
  // With the links: Hafızam shows the map's number for every one-to-one topic.
  const harita = new Map(a.json("[...HARITAM.durum(0).satir].map(([id,s])=>[id,s.r])"));
  for (const [id, k] of tekil.filter(([, k]) => kac.get(k) === 1)) assert(Math.abs(H.get(k).r - harita.get(id)) < 1e-9, id + ': Hafızam = map');
  // A school unit covering several nodes: Hafızam shows their mean.
  const birim = [...kac].find(([k, n]) => n > 1 && H.has(k));
  if (birim) { const l = [...K].filter(([id, ks]) => !gizli.has(id) && ks.includes(birim[0]) && harita.get(id) !== null).map(([id]) => harita.get(id));
    assert(Math.abs(H.get(birim[0]).r - l.reduce((t, r) => t + r, 0) / l.length) < 1e-9, 'unit = mean of its nodes'); }
  const fark = hafiza.find(x => Number.isFinite(x.rKendi) && Math.round(x.r * 100) !== Math.round(x.rKendi * 100));
  assert(fark, 'connected topics change at least one number');
  assert.match(a.run(`(()=>{const d=hafizaDurumu(0);return hafizaSatiri(0,d.liste.find(x=>x.ki===${fark.ki}),d,{p:null,satirlar:[]})})()`), /bağlı konular [+−]\d+/, 'Hafızam says how much connected topics changed it');
  a.run("EK.haritamSecili='tytKok'"); assert.match(a.run('HARITAM.gorunum()'), /çoktan unuttum dedin/, 'the map card is Hafızam\'s card');
});

console.log(passed + ' passed');
