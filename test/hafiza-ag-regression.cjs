// Bağlantılı hafıza (src/hafiza-ag.js) on the app's own FSRS-6. Synthetic topics and results only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const F = require('./konutakibi-fixtures.cjs');
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
new vm.Script(fs.readFileSync(__dirname + '/../src/hafiza-ag.js', 'utf8'), {filename: 'src/hafiza-ag.js'}).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const H = run('HAFIZA_AG'), hatirlama = run('hatirlama'), tekrarla = run('tekrarla'), ilkS = run('ilkS');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' vs ' + b);
const duz = x => JSON.parse(JSON.stringify(x)); // objects made inside the sandbox have its prototypes
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };

// A small YKS map. `ust` uses `alt`; sincos is a hidden part of TYT trigonometry; okulTrig is TYT trigonometry's twin.
const KONULAR = [
  {id: 'dik', ad: 'Dik Üçgen', ders: 'Geometri', soru: 2},
  {id: 'tytTrig', ad: 'Trigonometri (TYT)', ders: 'Matematik TYT', soru: 3, esler: ['okulTrig']},
  {id: 'sincos', ad: 'Dik üçgende sin/cos', gizli: true, parcasi: 'tytTrig'},
  {id: 'aytTrig', ad: 'Trigonometrik Denklemler', ders: 'Matematik AYT', soru: 4},
  {id: 'trigFonk', ad: 'Trigonometrik Fonksiyonlar', ders: 'Matematik AYT', soru: 2},
  {id: 'matVek', ad: 'Vektörler', ders: 'Matematik AYT', soru: 1},
  {id: 'fizVek', ad: 'Vektörler ve Kuvvet', ders: 'Fizik', soru: 2},
  {id: 'fonk', ad: 'Fonksiyonlar', ders: 'Matematik AYT', soru: 3},
  {id: 'turev', ad: 'Türev', ders: 'Matematik AYT', soru: 6},
  {id: 'integral', ad: 'İntegral', ders: 'Matematik AYT', soru: 4}
];
const BAGLAR = [
  {alt: 'dik', ust: 'tytTrig', kullanim: 'cok'},
  {alt: 'tytTrig', ust: 'aytTrig', kullanim: 'tam'},
  {alt: 'tytTrig', ust: 'trigFonk', kullanim: 'cok'},
  {alt: 'matVek', ust: 'fizVek', kullanim: 'tam'},
  {alt: 'sincos', ust: 'fizVek', kullanim: 'cok'},
  {alt: 'fonk', ust: 'turev', kullanim: 'cok'},
  {alt: 'turev', ust: 'integral', kullanim: 'tam'},
  {alt: 'fonk', ust: 'integral', kullanim: 'az'},
  {alt: 'turev', ust: 'integral', tur: 'karisik'}
];
const girdi = (sonuclar, bugun, extra) => Object.assign({konular: KONULAR, baglar: BAGLAR, sonuclar, bugun}, extra || {});
const satir = (out, id) => out.konular.find(s => s.id === id);
const olay = (out, kaynak, id, tur, gun) => out.olaylar.filter(e => (kaynak === null || e.kaynak === kaynak) && e.id === id && e.tur === tur && (gun === undefined || e.gun === gun));
const hepsi = (ids, gun, not = 3) => ids.map(id => ({gun, id, not}));

test('no links: every topic is the app\'s own FSRS-6 chain, shown = own', () => {
  const sonuclar = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 3, id: 'tytTrig', not: 3}, {gun: 12, id: 'tytTrig', not: 1}, {gun: 14, id: 'tytTrig', not: 2}, {gun: 30, id: 'tytTrig', not: 4}];
  const out = H.hesapla({konular: KONULAR.filter(k => !k.gizli), baglar: [], sonuclar, bugun: 45});
  let kart = null, son = 0;
  for (const r of sonuclar) { const t = tekrarla(kart, r.not, r.gun - son, 0.9, 365, 1); kart = {s: t.s, d: t.d}; son = r.gun; }
  const s = satir(out, 'tytTrig');
  near(s.sGun, kart.s, 1e-12, 'S'); near(s.rOz, hatirlama(15, kart.s), 1e-12, 'R'); near(s.r, s.rOz, 0);
  assert.equal(out.olaylar.length, 0);
  const e = H.degerlendir({konular: KONULAR.filter(k => !k.gizli), baglar: [], sonuclar, bugun: 45});
  near(e.ag, e.duz, 1e-12, 'evaluation: same model'); assert.equal(e.n, 4);
});

test('a pass on AYT trig: half a review to TYT trig, the same to its hidden part, less further down', () => {
  const onu = hepsi(['dik', 'tytTrig', 'aytTrig', 'matVek', 'fizVek'], 0);
  const once = H.hesapla(girdi(onu, 9)), sonra = H.hesapla(girdi(onu.concat({gun: 9, id: 'aytTrig', not: 3}), 9));
  const [t] = olay(sonra, 'aytTrig', 'tytTrig', 'kredi', 9), [p] = olay(sonra, 'aytTrig', 'sincos', 'kredi', 9), [d] = olay(sonra, 'aytTrig', 'dik', 'kredi', 9);
  near(t.w, 0.5, 1e-12, 'kredi 0.5 × tam 1'); near(p.w, 0.5, 1e-12, 'a part gets what its topic gets'); near(d.w, 0.125, 1e-12, '0.5 × (0.5 × çok 0.5)');
  near(t.rSonra, t.rOnce + 0.5 * (1 - t.rOnce), 1e-12); near(satir(sonra, 'tytTrig').rOz, t.rSonra, 1e-9);
  assert(satir(sonra, 'tytTrig').sGun > satir(once, 'tytTrig').sGun);
  const tam = H.hesapla(girdi(onu.concat({gun: 9, id: 'tytTrig', not: 3}), 9));
  assert(satir(sonra, 'tytTrig').sGun < satir(tam, 'tytTrig').sGun, 'less than its own test');
  assert.equal(olay(tam, 'tytTrig', 'aytTrig', 'kredi').length, 0, 'credit never flows up');
  assert.equal(olay(sonra, 'aytTrig', 'matVek', 'kredi').length, 0, 'not connected');
});

test('credit while recall is still high adds almost nothing', () => {
  const ayni = H.hesapla(girdi(hepsi(['tytTrig', 'aytTrig'], 0).concat({gun: 0, id: 'aytTrig', not: 3}), 0));
  const [e] = olay(ayni, 'aytTrig', 'tytTrig', 'kredi', 0).slice(-1);
  near(e.sSonra, e.sOnce, 1e-9);
  const gec = H.hesapla(girdi(hepsi(['tytTrig', 'aytTrig'], 0).concat({gun: 20, id: 'aytTrig', not: 3}), 20));
  const [g] = olay(gec, 'aytTrig', 'tytTrig', 'kredi', 20);
  assert(g.sSonra / g.sOnce > 1.5);
});

test('a lesson or a pass on a topic starts its foundations that have no memory', () => {
  const ders = H.hesapla({konular: KONULAR.map(k => k.id === 'aytTrig' ? Object.assign({}, k, {ogrenildi: 5}) : k), baglar: BAGLAR, sonuclar: [], bugun: 10});
  ['aytTrig', 'tytTrig', 'sincos', 'dik'].forEach(id => { assert(satir(ders, id).rOz > 0, id); });
  assert.equal(satir(ders, 'fizVek').rOz, null, 'not a foundation of AYT trig');
  near(satir(ders, 'tytTrig').sGun, ilkS(3), 1e-12, 'started as taught that day');
  assert.equal(olay(ders, 'aytTrig', 'tytTrig', 'basla', 5).length, 1);
  const gecti = H.hesapla(girdi([{gun: 2, id: 'integral', not: 3}], 4));
  ['turev', 'fonk'].forEach(id => { assert(satir(gecti, id).rOz > 0, id); });
  // A lesson also credits a foundation that already has memory, as an "İyi".
  const kredi = H.hesapla({konular: KONULAR.map(k => k.id === 'aytTrig' ? Object.assign({}, k, {ogrenildi: 20}) : k), baglar: BAGLAR, sonuclar: [{gun: 0, id: 'tytTrig', not: 3}], bugun: 20});
  near(olay(kredi, 'aytTrig', 'tytTrig', 'kredi', 20)[0].w, 0.5, 1e-12);
});

test('a failed foundation dents the topics using it, one step; its own foundations are flagged, not lowered', () => {
  const onu = hepsi(['dik', 'tytTrig', 'aytTrig', 'trigFonk', 'matVek', 'fizVek'], 0).concat({gun: 5, id: 'aytTrig', not: 3});
  const temiz = H.hesapla(girdi(onu, 10)), hata = H.hesapla(girdi(onu.concat({gun: 10, id: 'tytTrig', not: 1}), 10));
  near(olay(hata, 'tytTrig', 'aytTrig', 'ceza', 10)[0].w, 0.5, 1e-12, 'ceza 0.5 × tam');
  near(olay(hata, 'tytTrig', 'trigFonk', 'ceza', 10)[0].w, 0.25, 1e-12, 'ceza 0.5 × çok');
  assert(satir(hata, 'aytTrig').rOz < satir(temiz, 'aytTrig').rOz);
  // The hidden part failed with its topic; what uses the part (physics vectors) is dented too.
  assert.equal(satir(hata, 'sincos').sonOz, 10);
  near(olay(hata, 'tytTrig', 'fizVek', 'ceza', 10)[0].w, 0.25, 1e-12);
  near(satir(hata, 'dik').rOz, satir(temiz, 'dik').rOz, 1e-12, 'nothing flows down on a failure');
  assert.deepEqual(duz(satir(hata, 'dik').kontrol), {gun: 10, kaynak: 'tytTrig'});
  const aytHata = H.hesapla(girdi(onu.concat({gun: 10, id: 'aytTrig', not: 1}), 10));
  near(satir(aytHata, 'tytTrig').rOz, satir(temiz, 'tytTrig').rOz, 1e-12, 'foundation memory untouched');
  assert.equal(satir(aytHata, 'tytTrig').kontrol.kaynak, 'aytTrig');
  const sonra = H.hesapla(girdi(onu.concat({gun: 10, id: 'aytTrig', not: 1}, {gun: 11, id: 'tytTrig', not: 3}), 11));
  assert.equal(satir(sonra, 'tytTrig').kontrol, null, 'its own test clears the flag');
});

test('a hidden part is tested with its topic; a twin result counts for the topic', () => {
  const out = H.hesapla(girdi([{gun: 0, id: 'okulTrig', not: 3}, {gun: 4, id: 'okulTrig', not: 3}], 10));
  assert.equal(satir(out, 'tytTrig').sonOz, 4); assert.equal(satir(out, 'sincos').sonOz, 4);
  near(satir(out, 'sincos').sGun, satir(out, 'tytTrig').sGun, 1e-12);
  assert.equal(satir(out, 'sincos').calis, 'tytTrig', 'its alarm sends the student to TYT trig');
  assert.equal(out.konular.some(s => s.id === 'okulTrig'), false, 'one node');
});

test('a school unit\'s result and lesson count for every YKS topic it covers', () => {
  const birimler = [{id: 'okul9DikTrig', kapsar: ['dik', 'tytTrig'], ogrenildi: 0}];
  const out = H.hesapla(girdi([{gun: 6, id: 'okul9DikTrig', not: 3}], 10, {birimler}));
  ['dik', 'tytTrig', 'sincos'].forEach(id => { assert.equal(satir(out, id).sonOz, 6, id); });
  const ayri = H.hesapla(girdi([{gun: 0, id: 'dik', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 6, id: 'dik', not: 3}, {gun: 6, id: 'tytTrig', not: 3}], 10));
  assert(Math.abs(satir(out, 'tytTrig').sGun - satir(ayri, 'tytTrig').sGun) < 1e-9, 'lesson day = first "İyi", then the unit result as a review');
  assert.equal(out.konular.some(s => s.id === 'okul9DikTrig'), false, 'not a node of its own');
  assert.equal(H.hesapla(girdi([], 1, {birimler: [{id: 'x', kapsar: ['yok']}]})).uyarilar.length, 1);
});

test('live pull-down: the weakest-relative foundation pulls the shown recall, never the stored memory', () => {
  // TYT trig learnt long ago, AYT trig just tested.
  const s = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 25, id: 'aytTrig', not: 3}];
  const out = H.hesapla(girdi(s, 26), {kredi: 0});
  const ayt = satir(out, 'aytTrig'), tyt = satir(out, 'tytTrig');
  assert(tyt.r < ayt.rOz);
  near(ayt.r, ayt.rOz - 0.5 * 1 * (ayt.rOz - tyt.r), 1e-12, 'çekiş 0.5 × tam × gap');
  // Two weak foundations: only the strongest pull counts (integral uses türev tam and fonksiyonlar az).
  const iki = H.hesapla(girdi([{gun: 0, id: 'fonk', not: 3}, {gun: 0, id: 'turev', not: 3}, {gun: 12, id: 'turev', not: 3}, {gun: 0, id: 'integral', not: 3}, {gun: 29, id: 'integral', not: 3}], 30), {kredi: 0});
  const i = satir(iki, 'integral'), t = satir(iki, 'turev'), f = satir(iki, 'fonk');
  near(i.r, i.rOz - Math.max(0.5 * 1 * (i.rOz - t.r), 0.5 * 0.25 * (i.rOz - f.r)), 1e-12);
  assert(t.r < t.rOz, 'türev itself pulled by fonksiyonlar: the weak base reaches up the chain');
  // A foundation without memory pulls nothing.
  const yok = H.hesapla({konular: KONULAR, baglar: BAGLAR, sonuclar: [{gun: 0, id: 'fizVek', not: 3}], bugun: 3});
  near(satir(yok, 'fizVek').r, satir(yok, 'fizVek').rOz, 1e-12);
});

test('memory level from stability; the exam star uses the shown recall on exam day', () => {
  const seri = [{gun: 0, id: 'dik', not: 3}, {gun: 3, id: 'dik', not: 3}, {gun: 12, id: 'dik', not: 3}, {gun: 40, id: 'dik', not: 3}, {gun: 130, id: 'dik', not: 3}];
  const tiers = [1, 2, 3, 4, 5].map(n => satir(H.hesapla(girdi(seri.slice(0, n), seri[n - 1].gun, {sinavGunu: 200})), 'dik'));
  assert.deepEqual(tiers.map(t => t.katman), tiers.map(t => t.sGun < 7 ? 'kisa' : t.sGun < 30 ? 'orta' : 'uzun'));
  assert.equal(tiers[0].katman, 'kisa'); assert.equal(tiers[4].katman, 'uzun');
  assert.equal(tiers[4].sinavaKadar, hatirlama(70, tiers[4].sGun) >= 0.9);
  // Credit alone can lift a topic to long-term.
  const kredi = [{gun: 0, id: 'tytTrig', not: 3}];
  for (let g = 3; g <= 150; g += 3) kredi.push({gun: g, id: 'aytTrig', not: 4});
  assert.equal(satir(H.hesapla(girdi(kredi, 150)), 'tytTrig').katman, 'uzun');
});

test('foundational by weighted use; importance counts the topic\'s own questions twice', () => {
  const out = H.hesapla(girdi([], 0));
  const tyt = satir(out, 'tytTrig'), sin = satir(out, 'sincos'), dik = satir(out, 'dik'), fonk = satir(out, 'fonk');
  near(tyt.kullananAgirlik, 1 + 0.5, 1e-12); assert.equal(tyt.temel, true);
  near(tyt.onem, 2 * 3 + 1 * 4 + 0.5 * 2, 1e-12);
  near(sin.kullananAgirlik, 1 + 1 + 0.5 + 0.5, 1e-12, 'its topic, what uses its topic, and physics vectors');
  near(sin.onem, 0 + 1 * 3 + 1 * 4 + 0.5 * 2 + 0.5 * 2, 1e-12);
  near(dik.kullananAgirlik, 0.5 + 0.5 + 0.25, 1e-12); assert.equal(dik.temel, false);
  near(fonk.kullananAgirlik, 0.5 + 0.5, 1e-12, 'integral counted once, by its strongest path'); assert.equal(fonk.temel, false);
});

test('alarms: one per foundation, grey > red > orange > yellow; top 3 by colour then importance', () => {
  // Nothing learnt but AYT trig and trig functions: TYT trig and its part are missing (grey).
  const gri = H.hesapla(girdi([{gun: 0, id: 'trigFonk', not: 3}], 1), {});
  // the pass on trigFonk started TYT trig, so it is not grey
  assert.notEqual(satir(gri, 'tytTrig').alarm, 'gri');
  const yalniz = H.hesapla({konular: KONULAR, baglar: BAGLAR, sonuclar: [], bugun: 1});
  assert.equal(satir(yalniz, 'tytTrig').alarm, null, 'nothing studied above it: no alarm');
  const s = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 0, id: 'trigFonk', not: 3}];
  const kirmizi = H.hesapla(girdi(s, 8), {kredi: 0});
  assert.equal(satir(kirmizi, 'tytTrig').alarm, 'kirmizi'); assert.equal(satir(kirmizi, 'aytTrig').alarm, null, 'not foundational');
  const sari = H.hesapla(girdi(s, 1), {kredi: 0});
  assert.equal(satir(sari, 'tytTrig').alarm, 'sari');
  const turuncu = H.hesapla(girdi(s.concat({gun: 1, id: 'tytTrig', not: 3}, {gun: 2, id: 'aytTrig', not: 1}), 2), {kredi: 0});
  assert.equal(satir(turuncu, 'tytTrig').alarm, 'turuncu');
  assert.deepEqual(duz(kirmizi.ust3), duz(kirmizi.alarmlar.slice(0, 3)));
  const sirali = kirmizi.alarmlar.map(id => satir(kirmizi, id));
  sirali.forEach((a, j) => { if (j) { const r = {gri: 0, kirmizi: 1, turuncu: 2, sari: 3}, b = sirali[j - 1];
    assert(r[b.alarm] < r[a.alarm] || (r[b.alarm] === r[a.alarm] && b.onem >= a.onem)); } });
});

test('check tests: flagged foundations, and one sample a month among credit-only foundations', () => {
  const onu = hepsi(['tytTrig', 'aytTrig', 'trigFonk'], 0).concat({gun: 3, id: 'aytTrig', not: 1});
  const k = H.hesapla(girdi(onu, 3));
  assert.deepEqual(duz(k.kontroller.filter(c => c.sebep === 'supheli').map(c => c.id)), ['tytTrig'], 'AYT trig failed: its direct foundation');
  assert.equal(k.kontroller.find(c => c.id === 'tytTrig').soru, 5);
  // TYT trig kept up only by AYT passes for 60 days: a sample check, once per window, the same draw every time.
  const kredi = [{gun: 0, id: 'tytTrig', not: 3}];
  for (let g = 10; g <= 60; g += 10) kredi.push({gun: g, id: 'aytTrig', not: 3});
  const a = H.hesapla(girdi(kredi, 61, {anahtar: 'ogr-7'})), b = H.hesapla(girdi(kredi, 61, {anahtar: 'ogr-7'}));
  const ornek = a.kontroller.filter(c => c.sebep === 'ornek');
  assert.equal(ornek.length, 1); assert.deepEqual(duz(ornek), duz(b.kontroller.filter(c => c.sebep === 'ornek')));
  // Candidates: TYT trig and its part (own test 61 days ago) and the right triangle (started by the AYT passes, never tested).
  assert(['tytTrig', 'sincos', 'dik'].includes(ornek[0].id));
  const anahtarlar = new Set(); for (let i = 0; i < 40; i++) anahtarlar.add(H.hesapla(girdi(kredi, 61, {anahtar: 'ogr-' + i})).kontroller.find(c => c.sebep === 'ornek').id);
  assert(anahtarlar.size > 1, 'different students draw different topics');
  const yapildi = H.hesapla(girdi(kredi, 61, {anahtar: 'ogr-7', ornekGecmisi: [{gun: 60, id: 'tytTrig'}]}));
  assert.equal(yapildi.kontroller.filter(c => c.sebep === 'ornek').length, 0, 'already one in this window');
  const yeni = H.hesapla(girdi(kredi.slice(0, 2), 12, {anahtar: 'ogr-7'}));
  assert.equal(yeni.kontroller.filter(c => c.sebep === 'ornek').length, 0, 'own test recent, or memory only just started');
});

test('learning: links whose credit does not hold are learnt down, per student blended with the shared value', () => {
  // Every student passes AYT trig often but fails TYT trig whenever it is tested: credit over-predicts.
  const r = rng(11), ogrenciler = [];
  for (let s = 0; s < 6; s++) {
    const sonuclar = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}];
    for (let g = 4; g <= 120; g += 4) sonuclar.push({gun: g, id: 'aytTrig', not: 3});
    for (let g = 15; g <= 120; g += 15) sonuclar.push({gun: g + Math.floor(r() * 3), id: 'tytTrig', not: 1});
    ogrenciler.push({anahtar: 'o' + s, sonuclar, bugun: 125});
  }
  const ogr = H.ogren({konular: KONULAR, baglar: BAGLAR, ogrenciler});
  const pay = ogr.paylasilan['tytTrig>aytTrig'];
  assert(pay.kredi < 0.5, 'shared credit learnt down: ' + pay.kredi);
  assert(pay.n.kredi > 0);
  const o0 = ogr.ogrenci.o0['tytTrig>aytTrig'];
  near(o0.kredi, (o0.n.kredi * 0 + 10 * pay.kredi) / (o0.n.kredi + 10), 0.13, 'own best blended with shared by 10');
  const tek = H.ogren({konular: KONULAR, baglar: BAGLAR, ogrenciler, sadece: ['tytTrig>aytTrig']});
  assert.deepEqual(duz(Object.keys(tek.paylasilan)), ['tytTrig>aytTrig'], 'one link per call when asked');
  near(tek.paylasilan['tytTrig>aytTrig'].kredi, pay.kredi, 1e-12);
  // A link nobody's results touch keeps its starting value.
  assert.equal(ogr.paylasilan['matVek>fizVek'].kredi, 0.5);
  // Values feed back into the student's map.
  const out = H.hesapla(girdi(ogrenciler[0].sonuclar, 125, {parametreler: {paylasilan: ogr.paylasilan, ogrenci: ogr.ogrenci.o0}}));
  const ilk = H.hesapla(girdi(ogrenciler[0].sonuclar, 125));
  assert(satir(out, 'tytTrig').rOz < satir(ilk, 'tytTrig').rOz, 'less credit: lower TYT recall');
});

test('learning: a bad link is reported to the teacher', () => {
  const ogrenciler = [];
  for (let s = 0; s < 8; s++) {
    const sonuclar = [{gun: 0, id: 'matVek', not: 3}];
    for (let g = 3; g <= 90; g += 3) sonuclar.push({gun: g, id: 'fizVek', not: 4});
    for (let g = 10; g <= 90; g += 10) sonuclar.push({gun: g, id: 'matVek', not: 1});
    ogrenciler.push({anahtar: 'b' + s, sonuclar, bugun: 95});
  }
  let p = {};
  for (let i = 0; i < 2; i++) p = Object.assign({}, H.ogren({konular: KONULAR, baglar: BAGLAR, ogrenciler, parametreler: {paylasilan: p.paylasilan, ogrenci: p.ogrenci}}));
  const not = p.notlar.find(n => n.anahtar === 'matVek>fizVek');
  assert(not && not.deger < 0.1 && not.n >= 30, JSON.stringify(duz(p.notlar)));
});

test('evaluation against plain FSRS-6 on the same results', () => {
  const r = rng(5), sonuclar = [], ids = ['dik', 'tytTrig', 'aytTrig', 'fonk', 'turev', 'integral'];
  for (let gun = 0; gun < 200; gun += 1 + Math.floor(r() * 3)) sonuclar.push({gun, id: ids[Math.floor(r() * ids.length)], not: r() < 0.8 ? 3 : 1});
  const e = H.degerlendir(girdi(sonuclar, 200));
  assert(e.n > 30 && Number.isFinite(e.ag) && Number.isFinite(e.duz));
});

test('past-exam question counts: recency-weighted, patterns described only', () => {
  const y = {2018: 2, 2019: 1, 2020: 1, 2021: 1, 2022: 1, 2023: 1, 2024: 1, 2025: 1};
  const b = H.soruBeklentisi(y);
  let pay = 0, payda = 0; Object.keys(y).forEach(t => { const a = Math.pow(0.9, 2025 - t); pay += a * y[t]; payda += a; });
  near(b.beklenen, pay / payda, 1e-12); assert.equal(b.desen, 'her yıl');
  const d = H.soruBeklentisi({2018: 1, 2019: '-', 2020: 2, 2021: '-', 2022: 1, 2023: '-', 2024: 1, 2025: '-'});
  assert.equal(d.desen, 'iki yılda bir (son yıl sorulmadı)'); assert(d.beklenen > 0, 'a pattern never zeroes the expectation');
  assert.equal(H.soruBeklentisi({2018: 0, 2019: 3, 2020: 0, 2021: 0}).desen, '4 yılın 1’inde');
});

test('confusable links are drawn only; bad input is reported, cycles end', () => {
  const s = hepsi(['turev', 'integral'], 0).concat({gun: 9, id: 'integral', not: 3});
  const ile = H.hesapla(girdi(s, 10)), olmadan = H.hesapla(girdi(s, 10, {baglar: BAGLAR.filter(b => b.tur !== 'karisik')}));
  assert.deepEqual(duz(ile.karisik), [{a: 'turev', b: 'integral'}]);
  assert.deepEqual(duz(ile.konular), duz(olmadan.konular));
  const kotu = H.hesapla({konular: KONULAR.concat({id: 'dik'}, {id: 'x', gizli: true, parcasi: 'yok'}), baglar: [{alt: 'q', ust: 'dik', kullanim: 'tam'}, {alt: 'dik', ust: 'dik', kullanim: 'tam'},
    {alt: 'dik', ust: 'fonk', kullanim: 'biraz'}, {alt: 'dik', ust: 'tytTrig', kullanim: 'tam'}, {alt: 'tytTrig', ust: 'dik', kullanim: 'tam'}, {alt: 'dik', ust: 'fonk', tur: 'garip'}],
    sonuclar: hepsi(['dik', 'tytTrig'], 0).concat({gun: 5, id: 'tytTrig', not: 3}, {gun: 3, id: 'yok', not: 3}, {gun: 4, id: 'dik', not: 7}), bugun: 20});
  assert.equal(kotu.uyarilar.length, 6, JSON.stringify(duz(kotu.uyarilar)));
  assert(satir(kotu, 'dik').r > 0);
});

console.log(passed + ' passed');
