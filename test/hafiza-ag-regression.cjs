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
const H = run('HAFIZA_AG'), hatirlama = run('hatirlama'), tekrarla = run('tekrarla');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' vs ' + b);
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };

// A small YKS map. ust rests on alt: solving the upper topic practises part of the lower one.
const KONULAR = [
  {id: 'dik', ad: 'Dik Üçgen ve Öklid', ders: 'Geometri'},
  {id: 'tytTrig', ad: 'Trigonometrik Oranlar (TYT)', ders: 'Matematik TYT'},
  {id: 'aytTrig', ad: 'Trigonometrik Denklemler (AYT)', ders: 'Matematik AYT'},
  {id: 'matVek', ad: 'Vektörler', ders: 'Matematik AYT'},
  {id: 'fizVek', ad: 'Vektörler ve Kuvvet', ders: 'Fizik'},
  {id: 'fonk', ad: 'Fonksiyonlar', ders: 'Matematik AYT'},
  {id: 'turev', ad: 'Türev', ders: 'Matematik AYT'},
  {id: 'integral', ad: 'İntegral', ders: 'Matematik AYT'}
];
const BAGLAR = [
  {ust: 'aytTrig', alt: 'tytTrig', tur: 'kapsar', w: 0.6},
  {ust: 'tytTrig', alt: 'dik', tur: 'kapsar', w: 0.5},
  {ust: 'matVek', alt: 'tytTrig', tur: 'kapsar', w: 0.3},
  {a: 'matVek', b: 'fizVek', tur: 'kardes', w: 0.2},
  {ust: 'turev', alt: 'fonk', tur: 'kapsar', w: 0.5},
  {ust: 'integral', alt: 'turev', tur: 'kapsar', w: 0.5},
  {ust: 'integral', alt: 'fonk', tur: 'onkosul'}
];
const girdi = (sonuclar, bugun, extra) => Object.assign({konular: KONULAR, baglar: BAGLAR, sonuclar, bugun}, extra || {});
const satir = (out, id) => out.konular.find(s => s.id === id);
const olay = (out, kaynak, id, tur, gun) => out.olaylar.filter(e => e.kaynak === kaynak && e.id === id && e.tur === tur && (gun === undefined || e.gun === gun));
const duz = x => JSON.parse(JSON.stringify(x)); // objects made inside the sandbox have its prototypes

test('no links: every topic is the app\'s own FSRS-6 chain', () => {
  const sonuclar = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 3, id: 'tytTrig', not: 3}, {gun: 12, id: 'tytTrig', not: 1}, {gun: 14, id: 'tytTrig', not: 2}, {gun: 30, id: 'tytTrig', not: 4}];
  const out = H.hesapla({konular: KONULAR, baglar: [], sonuclar, bugun: 45});
  let kart = null, son = 0;
  for (const r of sonuclar) { const t = tekrarla(kart, r.not, r.gun - son, 0.9, 365, 1); kart = {s: t.s, d: t.d}; son = r.gun; }
  const s = satir(out, 'tytTrig');
  near(s.sGun, kart.s, 1e-12, 'S'); near(s.r, hatirlama(45 - 30, kart.s), 1e-12, 'R');
  assert.equal(out.olaylar.length, 0);
});

test('a result on AYT trigonometry reviews TYT trigonometry and, further down, the right triangle (FIRe)', () => {
  const onu = [{gun: 0, id: 'dik', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}];
  const once = H.hesapla(girdi(onu, 9)), sonra = H.hesapla(girdi(onu.concat({gun: 9, id: 'aytTrig', not: 3}), 9));
  const [t] = olay(sonra, 'aytTrig', 'tytTrig', 'ortuk', 9), [d] = olay(sonra, 'aytTrig', 'dik', 'ortuk', 9);
  near(t.w, 0.6, 1e-12); near(d.w, 0.3, 1e-12, 'the share multiplies along the path');
  assert(satir(sonra, 'tytTrig').r > satir(once, 'tytTrig').r && satir(sonra, 'tytTrig').sGun > satir(once, 'tytTrig').sGun);
  near(t.rSonra, t.rOnce + 0.6 * (1 - t.rOnce), 1e-12, 'recall refreshed by the share');
  near(satir(sonra, 'tytTrig').r, t.rSonra, 1e-9, 'the curve is rebuilt through the refreshed recall');
  // A full review would give more; a farther topic gets less.
  const tam = H.hesapla(girdi(onu.concat({gun: 9, id: 'tytTrig', not: 3}), 9));
  assert(satir(sonra, 'tytTrig').sGun < satir(tam, 'tytTrig').sGun);
  assert(d.sSonra / d.sOnce < t.sSonra / t.sOnce);
  // Credit never flows up: TYT practice does not review AYT.
  const yukari = H.hesapla(girdi(onu.concat({gun: 9, id: 'tytTrig', not: 3}), 9));
  assert.equal(olay(yukari, 'tytTrig', 'aytTrig', 'ortuk').length, 0);
});

test('implicit practice while recall is still high adds almost nothing', () => {
  const erken = H.hesapla(girdi([{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}], 0));
  const [e] = olay(erken, 'aytTrig', 'tytTrig', 'ortuk').slice(-1);
  assert.equal(olay(erken, 'aytTrig', 'tytTrig', 'ortuk').length, 2);
  near(e.sSonra, e.sOnce, 1e-9, 'same day: R = 1, FSRS gain 0');
  const gec = H.hesapla(girdi([{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 20, id: 'aytTrig', not: 3}], 20));
  const [g] = olay(gec, 'aytTrig', 'tytTrig', 'ortuk', 20);
  assert(g.sSonra / g.sOnce > 1.5, 'late: a real gain');
});

test('implicit credit is capped until the topic gets a real result of its own', () => {
  const sonuclar = [{gun: 0, id: 'tytTrig', not: 3}];
  for (let g = 3; g <= 120; g += 3) sonuclar.push({gun: g, id: 'aytTrig', not: 4});
  const out = H.hesapla(girdi(sonuclar, 120)), s0 = tekrarla(null, 3, 0, 0.9, 365, 1).s;
  near(satir(out, 'tytTrig').sGun, s0 * H.AYAR.ortukTavan, 1e-9, 'stops at the cap');
  assert(olay(out, 'aytTrig', 'tytTrig', 'tavan').length > 0);
  // Its own result lifts the cap again.
  const sonra = H.hesapla(girdi(sonuclar.concat({gun: 121, id: 'tytTrig', not: 3}, {gun: 150, id: 'aytTrig', not: 3}), 150));
  assert(olay(sonra, 'aytTrig', 'tytTrig', 'ortuk').some(e => e.gun === 150));
});

test('a failed foundation dents the topics built on it; a failed upper topic only flags its foundations', () => {
  const onu = [{gun: 0, id: 'dik', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 5, id: 'aytTrig', not: 3}];
  const temiz = H.hesapla(girdi(onu, 10));
  const tytHata = H.hesapla(girdi(onu.concat({gun: 10, id: 'tytTrig', not: 1}), 10));
  assert(satir(tytHata, 'aytTrig').r < satir(temiz, 'aytTrig').r, 'AYT recall falls');
  near(olay(tytHata, 'tytTrig', 'aytTrig', 'hata')[0].w, 0.6 * H.AYAR.hataYukari, 1e-12);
  near(satir(tytHata, 'dik').r, satir(temiz, 'dik').r, 1e-12, 'nothing flows down on a failure');
  const aytHata = H.hesapla(girdi(onu.concat({gun: 10, id: 'aytTrig', not: 1}), 10));
  near(satir(aytHata, 'tytTrig').r, satir(temiz, 'tytTrig').r, 1e-12, 'foundation memory untouched');
  assert.deepEqual(duz(satir(aytHata, 'tytTrig').kontrol), {gun: 10, kaynak: 'aytTrig'});
  assert.equal(satir(aytHata, 'tytTrig').alarm, 'alarm', 'below the line: the red alarm outranks the check');
  const iyi = H.hesapla(girdi(onu.concat({gun: 9, id: 'tytTrig', not: 3}, {gun: 10, id: 'aytTrig', not: 1}), 10));
  assert(satir(iyi, 'tytTrig').r >= 0.9); assert.equal(satir(iyi, 'tytTrig').alarm, 'kontrol', 'remembered: a check test');
  const kontrolSonra = H.hesapla(girdi(onu.concat({gun: 10, id: 'aytTrig', not: 1}, {gun: 11, id: 'tytTrig', not: 3}), 11));
  assert.equal(satir(kontrolSonra, 'tytTrig').kontrol, null, 'its own result clears the flag');
  // A pure prerequisite carries a small fixed share of a failure and no practice credit.
  const fonk = H.hesapla(girdi([{gun: 0, id: 'fonk', not: 3}, {gun: 0, id: 'turev', not: 3}, {gun: 0, id: 'integral', not: 3}, {gun: 8, id: 'fonk', not: 1}], 8));
  near(olay(fonk, 'fonk', 'integral', 'hata')[0].w, H.AYAR.hataOnkosul, 1e-12);
  const int = H.hesapla(girdi([{gun: 0, id: 'fonk', not: 3}, {gun: 0, id: 'turev', not: 3}, {gun: 0, id: 'integral', not: 3}, {gun: 8, id: 'integral', not: 3}], 8));
  near(olay(int, 'integral', 'fonk', 'ortuk')[0].w, 0.25, 1e-12, 'only through Türev, 0.5 × 0.5');
});

test('kardes topics share a little, both ways, one step only', () => {
  const out = H.hesapla(girdi([{gun: 0, id: 'matVek', not: 3}, {gun: 0, id: 'fizVek', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 10, id: 'fizVek', not: 3}, {gun: 20, id: 'matVek', not: 3}], 20));
  near(olay(out, 'fizVek', 'matVek', 'ortuk')[0].w, 0.2, 1e-12);
  near(olay(out, 'matVek', 'fizVek', 'ortuk')[0].w, 0.2, 1e-12);
  assert.equal(olay(out, 'fizVek', 'tytTrig', 'ortuk').length, 0, 'no cascade through a kardes link');
});

test('short-term / long-term tier and exam safety', () => {
  const kisa = H.hesapla(girdi([{gun: 0, id: 'dik', not: 3}], 1, {sinavGunu: 200}));
  assert.equal(satir(kisa, 'dik').katman, 'kisa'); assert.equal(satir(kisa, 'dik').sinavaKadar, false);
  const seri = [{gun: 0, id: 'dik', not: 3}, {gun: 3, id: 'dik', not: 3}, {gun: 12, id: 'dik', not: 3}, {gun: 40, id: 'dik', not: 3}, {gun: 130, id: 'dik', not: 3}];
  const tiers = [1, 2, 3, 4, 5].map(n => satir(H.hesapla(girdi(seri.slice(0, n), seri[n - 1].gun, {sinavGunu: 200})), 'dik'));
  assert.deepEqual(tiers.map(t => t.katman), tiers.map(t => t.sGun < 7 ? 'kisa' : t.sGun < 30 ? 'orta' : 'uzun'));
  assert(tiers.map(t => t.sGun).every((s, i, a) => i === 0 || s > a[i - 1]));
  assert.equal(tiers[4].katman, 'uzun');
  assert.equal(tiers[4].sinavaKadar, hatirlama(200 - 130, tiers[4].sGun) >= 0.9);
  assert.equal(satir(kisa, 'tytTrig').katman, null, 'not learnt: no tier');
});

test('foundations ring the alarm; a leaf with the same recall does not, and ranks lower', () => {
  // Same history for TYT trig (2 topics on it) and İntegral (none on it).
  const s = [{gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'integral', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 0, id: 'matVek', not: 3}];
  const out = H.hesapla(girdi(s, 6, {sinavGunu: 200}), {ortukKatsayi: 0});
  const t = satir(out, 'tytTrig'), i = satir(out, 'integral');
  near(t.r, i.r, 1e-12); assert(t.r < 0.9);
  assert.equal(t.bagimli, 2); assert.equal(t.temel, true); assert.equal(t.alarm, 'alarm');
  assert.equal(i.bagimli, 0); assert.equal(i.alarm, null);
  assert(out.sira.indexOf('tytTrig') < out.sira.indexOf('integral'));
  near(t.oncelik / i.oncelik, Math.sqrt(3), 1e-12);
  // Remembered but not yet long-term: a quieter warning.
  assert.equal(satir(H.hesapla(girdi(s, 1)), 'tytTrig').alarm, 'uyari');
  // The right triangle has three topics on it; never measured while they are studied: start it with a lesson.
  assert.equal(satir(out, 'dik').bagimli, 3); assert.equal(satir(out, 'dik').alarm, 'eksik');
  // A lesson day starts memory without a result.
  const ders = H.hesapla({konular: KONULAR.map(k => k.id === 'dik' ? Object.assign({ogrenildi: 0}, k) : k), baglar: BAGLAR, sonuclar: s, bugun: 6});
  assert.notEqual(satir(ders, 'dik').alarm, 'eksik'); assert(satir(ders, 'dik').r > 0);
});

test('suggestions: a study is worth its own need plus the shares of the due topics it reviews', () => {
  const s = [{gun: 0, id: 'dik', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 0, id: 'integral', not: 3}];
  const out = H.hesapla(girdi(s, 5)), need = id => satir(out, id).oncelik, by = id => out.oneriler.find(o => o.id === id);
  // TYT trigonometry first: a foundation itself (two topics on it) and it reviews half of the right triangle.
  assert.equal(out.oneriler[0].id, 'tytTrig');
  near(by('tytTrig').deger, need('tytTrig') + 0.5 * need('dik'), 1e-12);
  assert.deepEqual(duz(by('aytTrig').kapsadiklari).map(k => k.id), ['tytTrig', 'dik']);
  near(by('aytTrig').deger, need('aytTrig') + 0.6 * need('tytTrig') + 0.3 * need('dik'), 1e-12);
  assert(by('aytTrig').deger > need('integral'), 'beats a leaf with the same own need');
  assert(!by('integral'), 'covers nothing: not a graph suggestion');
  assert.equal(H.hesapla(girdi(s, 5), {ortukKatsayi: 0}).oneriler.length, 0, 'no graph credit, no compression');
});

test('gates at zero give plain FSRS; bad input is reported, cycles end', () => {
  const s = [{gun: 0, id: 'dik', not: 3}, {gun: 0, id: 'tytTrig', not: 3}, {gun: 0, id: 'aytTrig', not: 3}, {gun: 7, id: 'aytTrig', not: 1}, {gun: 9, id: 'aytTrig', not: 3}];
  const kapali = H.hesapla(girdi(s, 20), {ortukKatsayi: 0, hataKatsayi: 0}), yalin = H.hesapla({konular: KONULAR, baglar: [], sonuclar: s, bugun: 20});
  kapali.konular.forEach(k => { near(k.r ?? -1, satir(yalin, k.id).r ?? -1, 1e-12, k.id); });
  const kotu = H.hesapla({konular: KONULAR.concat({id: 'dik'}), baglar: [{ust: 'x', alt: 'dik'}, {ust: 'dik', alt: 'dik'}, {ust: 'dik', alt: 'fonk', tur: 'garip'},
    {ust: 'dik', alt: 'tytTrig', w: 0.9}, {ust: 'tytTrig', alt: 'dik', w: 0.9}], sonuclar: s.concat({gun: 3, id: 'yok', not: 3}, {gun: 4, id: 'dik', not: 7}), bugun: 20});
  assert.equal(kotu.uyarilar.length, 4);
  assert(satir(kotu, 'dik').r > 0);
});

test('evaluation: log loss of the graph against plain FSRS on the same results', () => {
  // A student whose memory really is connected (simulated with the graph model itself, outcomes drawn from its recall).
  const r = rng(7), sonuclar = [], ids = KONULAR.map(k => k.id);
  for (let gun = 0; gun < 240; gun += 1 + Math.floor(r() * 3)) {
    const id = ids[Math.floor(r() * ids.length)];
    const p = sonuclar.some(x => x.id === id) ? satir(H.hesapla(girdi(sonuclar, gun)), id).r : 0.9;
    sonuclar.push({gun, id, not: r() < p ? 3 : 1});
  }
  const e = H.degerlendir(girdi(sonuclar, 240));
  assert(e.n > 50); assert(e.ag < e.duz, JSON.stringify(e)); near(e.fark, e.duz - e.ag, 1e-12);
  const yalin = H.degerlendir(girdi(sonuclar, 240), {ortukKatsayi: 0, hataKatsayi: 0});
  near(yalin.ag, yalin.duz, 1e-12, 'gates at zero: the same model');
});

console.log(passed + ' passed');
