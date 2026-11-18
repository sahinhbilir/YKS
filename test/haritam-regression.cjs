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
