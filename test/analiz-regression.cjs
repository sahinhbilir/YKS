#!/usr/bin/env node
'use strict';
// Öğrenci analizi and Öğrenci kartı: the sapma / beklenen / beklenenden / istikrar definitions against the Türkiye average
// (hand-worked), the "needs N exams" thresholds and labels, the Türkiye matching of exams, subject changes, etüts and absences of
// the last 30 days, weak topics from Konu Takibi, the class and şube target, the cache, missing sources, the page states, the
// name links, teacher-only access and that nothing is written to the notebook. Synthetic school and students only ('SENTETİK …').
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const F = require('./konutakibi-fixtures.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__yg = run('yalnizcaGoruntuleme');
const reset = () => run(`yalnizcaGoruntuleme=__yg;D=varsayilan();D.rol='rehber';D.ogr=[];D.ayar.testTarih='2026-10-29';EK.sekme='ogrencikarti';EK.okKim=undefined;EK.okOturum=undefined;EK.okGeri=undefined;kaydet=async()=>true`);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-5, (msg || '') + ' ' + a + ' != ' + b);
const gun = iso => run('gunNo("' + iso + '")');
const BUGUN = gun('2026-10-29');
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// ---- the synthetic school: five 12. sınıf exams a week apart, TYT (Türkçe + Matematik), AYT SAY in the last two ----
const KEYS = ['TÜR', 'TAR', 'COĞ', 'FEL', 'DİN', 'S.F', 'MAT', 'GEO', 'FİZ', 'KİM', 'BİY'];
const AKEYS = ['EDB', 'TAR1', 'COĞ1', 'TAR2', 'COĞ2', 'FELGR', 'DİN2', 'S.F2', 'AMAT', 'AGEO', 'AFİZ', 'AKİM', 'ABİY'];
const ADLAR = ['27-YKS-1201', '27-YKS-1202', '27-YKS-1203', '27-YKS-1204', '27-YKS-1205'];
const TARIHLER = ['17.09.2026', '24.09.2026', '01.10.2026', '08.10.2026', '15.10.2026'];
// Türkiye averages by exam: Türkçe + Matematik = 30, 31, 33, 34, 36.
const TR_TUR = [20, 21, 22, 23, 24], TR_MAT = [10, 10, 11, 11, 12], TR_TYT = TR_TUR.map((t, i) => t + TR_MAT[i]);
const AYT_TR = { 3: { 'MATEMATİK-A': 18, 'GEOMETRİ-A': 6, 'FİZİK-A': 9, 'KİMYA-A': 5, 'BİYOLOJİ-A': 5 }, 4: { 'MATEMATİK-A': 19, 'GEOMETRİ-A': 7, 'FİZİK-A': 9, 'KİMYA-A': 6, 'BİYOLOJİ-A': 5 } };
// [Türkçe, Matematik] per exam (null: absent).
const NET = {
  1001: [[20, 12], [20, 11], [23, 12], [22, 12], [25, 13]],             // ADA: totals 32 31 35 34 38 → sapma 2 0 2 0 2
  1002: [[18, 10], [19, 11], null, null, null],                           // BORA: two exams: 28 30 → sapma −2 −1
  1003: [[25, 13], [15, 8], [25, 14], [18, 10], [30, 16]],               // CEMRE: 38 23 39 28 46 → sapma 8 −8 6 −6 10
  1004: [[19, 10], null, [22, 12], null, [24, 12]],                       // DOĞA: 29 34 36 → sapma −1 1 0
  1005: [[20, 10], [21, 10], [22, 11], [23, 11], [24, 12]]               // EGE: equal to the Türkiye average; Fizik 3 on top
};
const ADI = { 1001: 'SENTETİK ADA', 1002: 'SENTETİK BORA', 1003: 'SENTETİK CEMRE', 1004: 'SENTETİK DOĞA', 1005: 'SENTETİK EGE' };
const SUBE = { 1001: '301 12/A', 1002: '301 12/A', 1003: '201 12/B', 1004: '201 12/B', 1005: '201 12/B' };
const AYT_NET = { 1001: [{ AMAT: 20, AGEO: 8, AFİZ: 10, AKİM: 6, ABİY: 6 }, { AMAT: 21, AGEO: 8, AFİZ: 11, AKİM: 7, ABİY: 6 }], 1003: [{ AMAT: 10, AGEO: 4, AFİZ: 5, AKİM: 3, ABİY: 3 }, { AMAT: 11, AGEO: 4, AFİZ: 5, AKİM: 3, ABİY: 3 }] };
function satir(no, e, tur) {
  const v = NET[no][e]; if (!v) return null;
  const nets = { 'TÜR': v[0], MAT: v[1], ...(no === 1005 ? { 'FİZ': 3 } : {}) };
  const ayt = tur === 'F' && e >= 3 && AYT_NET[no] ? AYT_NET[no][e - 3] : {};
  const keys = tur === 'F' ? [...KEYS, ...AKEYS] : KEYS, all = { ...nets, ...ayt };
  return { no: String(no), ad: ADI[no], snf: SUBE[no], n: keys.map(k => all[k] ?? null), dy: keys.map(k => all[k] ? all[k] + '/0' : null), p: [0, 0, 0, 0], r: ['', '', '', ''] };
}
function siralama(adlar = ADLAR) {
  const anahtar = run('denemeAdAnahtari');
  return { surum: 1, sinavlar: adlar.map((ad, e) => {
    const slot = tur => ({ tarih: TARIHLER[e], katilim: ['5', '5', '5'], kurum: null, ogr: Object.keys(NET).map(no => satir(Number(no), e, tur)).filter(Boolean) });
    return { id: anahtar(ad), ad, okul: 'SENTETİK ANADOLU LİSESİ', ts: 1000 + e, T: slot('T'), ...(e >= 3 ? { F: slot('F') } : {}) };
  }) };
}
const rapor = (e, ayt = true) => ({ ad: ADLAR[e], liste: 'kolej', yaz: null, dersler: [['TÜRKÇE-T', 40, TR_TUR[e]], ['MATEMATİK-T', 30, TR_MAT[e]], ...(ayt && e >= 3 ? Object.entries(AYT_TR[e]).map(([k, v]) => [k, 30, v]) : [])]
  .map(([kod, soru, genel]) => ({ kod, soru, genel, satir: [{ sira: 1, ad: 'SENTETİK OKUL', net: Math.min(soru, genel + 5) }, { sira: 2, ad: 'SENTETİK KOLEJ', net: genel }] })) });
async function kurTurkiye(aralik = [0, 1, 2, 3, 4]) { run('delete D.turkiye'); await new Promise(r => setTimeout(r, 3)); put('R', aralik.map(e => rapor(e))); await run('TURKIYE.raporEkle(R)'); }
async function kurTum() { put('SR', siralama()); run('D.siralama=SR'); await kurTurkiye(); }
const kart = (no, oturum) => get(`ANALIZ.kart(${JSON.stringify(String(no))},${oturum ? JSON.stringify(oturum) : 'undefined'},${BUGUN})`);
const seri = (no, o = 'TYT') => kart(no, o).noktalar;

(async () => {
  await check('beklenen / beklenenden: the exam’s Türkiye average plus the mean of up to 5 earlier sapma, needing at least 2 (hand-worked)', () => {
    // Eight exams, the Türkiye average 20 each; sapma 1, 3, -1, 2, 4, 0, 5, -2.
    const sapma = [1, 3, -1, 2, 4, 0, 5, -2];
    put('P', sapma.map(s => ({ net: 20 + s, trOrt: 20, trNet: 20 + s })));
    const t = get('ANALIZ.turet(P)');
    assert.deepEqual(t.map(p => p.sapma), sapma);
    assert.deepEqual(t.slice(0, 2).map(p => [p.beklenen, p.beklenenden]), [[null, null], [null, null]], 'one earlier exam is not enough');
    // Third exam: earlier sapma [1, 3] → mean 2 → beklenen 22; net 19 → -3.
    assert.deepEqual([t[2].beklenen, t[2].beklenenden], [22, -3]);
    // Fourth: [1, 3, -1] → 1 → 21; net 22 → +1.
    assert.deepEqual([t[3].beklenen, t[3].beklenenden], [21, 1]);
    // Seventh: the window is the last five, [3, -1, 2, 4, 0] → 1.6 → 21.6; net 25 → 3.4 (not the mean of all six, 1.1666).
    near(t[6].beklenen, 21.6); near(t[6].beklenenden, 3.4);
    // Eighth: [-1, 2, 4, 0, 5] → 2 → 22; net 18 → -4.
    assert.deepEqual([t[7].beklenen, t[7].beklenenden], [22, -4]);
  });
  await check('exams without a Türkiye average have no sapma; the window counts only earlier exams that have one', () => {
    put('P', [{ net: 22, trOrt: 20, trNet: 22 }, { net: 30, trOrt: null, trNet: null }, { net: 22, trOrt: 20, trNet: 22 }, { net: 17, trOrt: 20, trNet: 17 }, { net: 30, trOrt: null, trNet: null }]);
    const t = get('ANALIZ.turet(P)');
    assert.deepEqual(t.map(p => p.sapma), [2, null, 2, -3, null]);
    assert.deepEqual([t[2].beklenen, t[2].beklenenden], [null, null], 'one earlier exam with an average (the skipped one does not count)');
    // [2, 2] → beklenen 22; net 17 → -5 (sapma -3 minus the mean 2).
    assert.deepEqual([t[3].beklenen, t[3].beklenenden], [22, -5]);
    assert.deepEqual([t[4].beklenen, t[4].beklenenden, t[4].net], [null, null, 30], 'the exam without an average keeps its net and nothing else');
  });
  await check('istikrar: the spread of sapma over the last 6, at least 3; Çok istikrarlı < 3, İstikrarlı < 6, Dalgalı < 10, Çok dalgalı', () => {
    const ist = l => { put('P', l.map(s => ({ sapma: s }))); return get('ANALIZ.istikrar(P)'); };
    assert.deepEqual(ist([4, 7]), { n: 2, std: null, etiket: null, yeterli: false }, 'two exams are not enough');
    assert.equal(ist([0, 0, 0]).etiket, 'Çok istikrarlı'); assert.equal(ist([0, 0, 0]).std, 0);
    for (const [l, std, etiket] of [[[0, 5.98, 0, 5.98], 2.99, 'Çok istikrarlı'], [[0, 6, 0, 6], 3, 'İstikrarlı'], [[0, 11.98, 0, 11.98], 5.99, 'İstikrarlı'], [[0, 12, 0, 12], 6, 'Dalgalı'],
      [[0, 19.98, 0, 19.98], 9.99, 'Dalgalı'], [[0, 20, 0, 20], 10, 'Çok dalgalı'], [[-20, 20, -20, 20], 20, 'Çok dalgalı']]) {
      const r = ist(l); near(r.std, std); assert.equal(r.etiket, etiket, JSON.stringify(l));
    }
    // Population standard deviation: [1, 2, 3] → sqrt(2/3).
    near(ist([1, 2, 3]).std, Math.sqrt(2 / 3));
    // Only the last six count: an old swing of 100 is out of the window.
    const alti = ist([100, 1, 1, 1, 1, 1, 1]); assert.equal(alti.n, 6); assert.equal(alti.std, 0);
    // An exam without an average is skipped, not counted as zero.
    put('P', [{ sapma: 5 }, { sapma: null }, { sapma: 5 }, { sapma: 5 }]); assert.equal(get('ANALIZ.istikrar(P)').std, 0);
    assert.deepEqual(get('ANALIZ.ISTIKRAR_ETIKETLERI.map(x=>x[1])'), ['Çok istikrarlı', 'İstikrarlı', 'Dalgalı', 'Çok dalgalı']);
  });
  await check('the Türkiye average of an exam is matched by name (Kolej first); totals need every subject of the field', async () => {
    await kurTurkiye();
    const al = (ad, o) => { put('AD', ad); return get(`(()=>{const o=TURKIYE.ortalamalar(D.turkiye)(AD);if(!o)return null;const t=o.toplam(${JSON.stringify(o)});return {liste:o.liste,tyt:t&&t.genel,tur:o.genel('TÜRKÇE-T'),yok:o.genel('FİZİK-T')}})()`); };
    assert.deepEqual(al('27-YKS-1201', 'TYT'), { liste: 'kolej', tyt: 30, tur: 20, yok: null });
    assert.deepEqual(al('  27-yks-1203 ', 'TYT'), { liste: 'kolej', tyt: 33, tur: 22, yok: null }, 'case and spaces do not matter');
    assert.equal(al('27-YKS-9999', 'TYT'), null, 'no list for this exam');
    assert.equal(get('TURKIYE.ortalamalar(D.turkiye)("27-YKS-1201").toplam("SAY")'), null, 'the exam has no AYT subjects');
    assert.equal(get('TURKIYE.ortalamalar(D.turkiye)("27-YKS-1204").toplam("SAY").genel'), 43); assert.equal(get('TURKIYE.ortalamalar(D.turkiye)("27-YKS-1204").toplam("EA")'), null, 'EA needs Edebiyat and Tarih-1 too');
    // A second list of the same exam (Tüm kurumlar) never replaces the Kolej one.
    const r = rapor(0); r.liste = 'kurum'; r.dersler[0].genel = 99; put('R2', [r]); await run('TURKIYE.raporEkle(R2)');
    assert.deepEqual(al('27-YKS-1201', 'TYT'), { liste: 'kolej', tyt: 30, tur: 20, yok: null });
  });
  await check('series of one student against the Türkiye average: net, school mean, rank, sapma, beklenen and beklenenden (ADA, five exams)', async () => {
    await kurTum();
    const k = kart(1001), s = k.noktalar;
    assert.equal(k.durum, 'tamam'); assert.deepEqual(s.map(p => p.net), [32, 31, 35, 34, 38]); assert.deepEqual(s.map(p => p.tarih), TARIHLER);
    assert.deepEqual(s.map(p => p.trOrt), TR_TYT); assert.deepEqual(s.map(p => p.sapma), [2, 0, 2, 0, 2]);
    // School means: 32 (5 students), 29.5 (4), 36 (4), 33 (3), 39.75 (4). EGE counts with her Fizik net (TR + 3).
    assert.deepEqual(s.map(p => p.okulOrt), [32, 29.5, 36, 33, 39.75]); assert.deepEqual(s.map(p => p.n), [5, 4, 4, 3, 4]);
    assert.deepEqual(s.map(p => p.sira), [3, 2, 3, 2, 3], 'exam 1: 38 33 32 29 28; exam 5: 46 39 38 36');
    assert.deepEqual(s.map(p => p.beklenen).filter((x, i) => i !== 3), [null, null, 34, 37]); near(s[3].beklenen, 34 + 4 / 3);
    near(s[3].beklenenden, -4 / 3); assert.deepEqual([s[2].beklenenden, s[4].beklenenden], [1, 1]); assert.equal(s[0].beklenenden, null);
    assert.equal(k.son.net, 38); assert.equal(k.neden, null);
    // istikrar: sapma [2, 0, 2, 0, 2] → sqrt(0.96).
    near(k.istikrar.std, Math.sqrt(.96)); assert.equal(k.istikrar.etiket, 'Çok istikrarlı'); assert.equal(k.istikrar.n, 5);
    // The exams of the measure for the chart: every exam with its school mean and Türkiye average.
    assert.deepEqual(k.tum.map(x => [x.okulOrt, x.trOrt]), [[32, 30], [29.5, 31], [36, 33], [33, 34], [39.75, 36]]);
    assert.deepEqual([k.kisi.ad, k.kisi.sinif, k.kisi.no], ['SENTETİK ADA', '12/A', '1001']);
  });
  await check('other students: swings (Dalgalı), a student with gaps, two exams only, and a net that includes a subject the Türkiye list lacks', async () => {
    await kurTum();
    // CEMRE: sapma 8 -8 6 -6 10.
    const c = kart(1003), s = c.noktalar;
    assert.deepEqual(s.map(p => p.sapma), [8, -8, 6, -6, 10]); assert.deepEqual(s.map(p => p.beklenenden), [null, null, 6, -8, 10]); assert.deepEqual(s.map(p => p.beklenen), [null, null, 33, 36, 36]);
    near(c.istikrar.std, Math.sqrt(56)); assert.equal(c.istikrar.etiket, 'Dalgalı');
    // DOĞA missed two exams: three points; [-1, 1, 0] → needs three exams for istikrar and has exactly three.
    const d = kart(1004); assert.equal(d.noktalar.length, 3); assert.deepEqual(d.noktalar.map(p => p.sapma), [-1, 1, 0]); assert.equal(d.noktalar[2].beklenenden, 0);
    near(d.istikrar.std, Math.sqrt(2 / 3)); assert.equal(d.istikrar.etiket, 'Çok istikrarlı');
    // BORA: two exams. Her last exam has no beklenenden ("en az 3 deneme gerekli") and there is no istikrar yet.
    const b = kart(1002); assert.equal(b.noktalar.length, 2); assert.equal(b.son.beklenenden, null); assert.equal(b.neden, 'az'); assert.equal(b.istikrar.yeterli, false); assert.deepEqual(b.noktalar.map(p => p.sapma), [-2, -1]);
    // EGE: her net includes Fizik 3 but the Türkiye total counts Türkçe and Matematik only → sapma 0.
    const e = kart(1005); assert.deepEqual(e.noktalar.map(p => p.net), TR_TYT.map(x => x + 3)); assert.deepEqual(e.noktalar.map(p => p.sapma), [0, 0, 0, 0, 0]);
    assert.equal(e.istikrar.std, 0);
  });
  await check('an exam without Türkiye data: its net and school figures stay, sapma and beklenenden are empty, and earlier ones are used for the next', async () => {
    put('SR', siralama()); run('D.siralama=SR'); await kurTurkiye([0, 2, 3, 4]);   // no list for exam 2
    const a = kart(1001), s = a.noktalar;
    assert.deepEqual(s.map(p => p.sapma), [2, null, 2, 0, 2]); assert.equal(s[1].net, 31); assert.equal(s[1].okulOrt, 29.5);
    // Exam 4: earlier exams with an average are 1 and 3 → [2, 2] → beklenen 34 + 2 = 36; net 34 → -2.
    assert.deepEqual([s[3].beklenen, s[3].beklenenden], [36, -2]); assert.equal(s[2].beklenenden, null, 'only one earlier exam has an average');
    // The last exam of the series lacks an average: the card says so and does not fall back to the school mean.
    await kurTurkiye([0, 1, 2, 3]);
    const son = kart(1001); assert.equal(son.son.sapma, null); assert.equal(son.son.trOrt, null); assert.equal(son.neden, 'tr-yok'); assert.equal(son.son.beklenenden, null);
    assert.equal(son.noktalar[4].okulOrt, 39.75, 'the school mean is shown, but not used as a reference');
    near(son.istikrar.std, 1); assert.equal(son.istikrar.n, 4, 'istikrar over the exams that have an average: [2, 0, 2, 0]');
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    assert.match(h, /Bu denemenin Türkiye ortalaması yok/); assert(!/Okul ortalamasına göre/.test(h));
  });
  await check('with no Türkiye data at all every figure that needs it is empty and the page says so', async () => {
    put('SR', siralama()); run('D.siralama=SR');
    const k = kart(1001); assert.equal(k.trVar, false); assert(k.noktalar.every(p => p.sapma === null && p.beklenen === null && p.trOrt === null));
    assert.equal(k.istikrar.yeterli, false); assert.equal(k.son.net, 38);
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    assert.match(h, /Türkiye geneli verisi yok/); assert(h.includes('id="okGrafik"'));
  });
  await check('AYT per alan with the same rules as Deneme panosu; the Türkiye total needs every subject of the alan', async () => {
    await kurTum();
    const a = kart(1001); assert.deepEqual(a.oturumlar.map(o => [o.key, o.n]), [['TYT', 5], ['AYT:SAY', 2]]);
    const s = kart(1001, 'AYT:SAY'); assert.equal(s.oturum.key, 'AYT:SAY');
    assert.deepEqual(s.noktalar.map(p => p.net), [50, 53]); assert.deepEqual(s.noktalar.map(p => p.trOrt), [43, 46]); assert.deepEqual(s.noktalar.map(p => p.sapma), [7, 7]);
    assert.deepEqual(s.noktalar.map(p => p.okulOrt), [37.5, 39.5]);   // ADA and CEMRE (25, 26) took SAY
    assert.deepEqual(s.noktalar.map(p => p.sira), [1, 1]); assert.equal(s.neden, 'az');
    assert.deepEqual(kart(1003, 'AYT:SAY').noktalar.map(p => p.sapma), [-18, -20]);
    assert.deepEqual(kart(1002).oturumlar.map(o => o.key), ['TYT'], 'no AYT for a student who sat none');
    assert.equal(kart(1002, 'AYT:EA').oturum.key, 'TYT', 'an unknown measure falls back to TYT');
    assert.equal(kart(1001).kisi.alan, 'SAY', 'the alan is the one most taken when the notebook has none');
  });
  await check('subjects: last against previous exam, and against the Türkiye average of the last exam', async () => {
    await kurTum();
    const d = kart(1001).dersler;
    assert.deepEqual(d.map(x => x.ad), ['Türkçe', 'Matematik'], 'only the lessons the student has');
    assert.deepEqual(d.map(x => [x.son, x.once, x.degisim, x.trOrt, x.trFark]), [[25, 22, 3, 24, 1], [13, 12, 1, 12, 1]]);
    // DOĞA’s previous exam is her exam 3 (she missed exam 4): Türkçe 24 against 22 → +2; Matematik 12 against 12 → 0.
    assert.deepEqual(kart(1004).dersler.map(x => [x.son, x.once, x.degisim]), [[24, 22, 2], [12, 12, 0]]);
    // One exam: no previous.
    const bir = get('(()=>{const v=D.siralama;D.siralama={...v,sinavlar:[{...v.sinavlar[0],ts:77}]};return ANALIZ.kart("1001",undefined,' + BUGUN + ').dersler})()');
    assert.deepEqual(bir.map(x => [x.son, x.once, x.degisim]), [[20, null, null], [12, null, null]]);
  });
  await check('etüts of the last 30 days by lesson with their teachers (today in, 30 days ago and tomorrow out)', async () => {
    await kurTum();
    const rows = (ad, sinif, l) => l.map(([iso, brans, hoca]) => ({ g: gun(iso), brans, ogretmen: hoca, ad, sinif, saat: 900, sure: 40 }));
    const A = 'SENTETİK ÖĞRETMEN A', B = 'SENTETİK ÖĞRETMEN B', C = 'SENTETİK ÖĞRETMEN C';
    put('ER', rows('SENTETİK ADA', '12/A', [['2026-09-29', 'MATEMATİK TYT', A], ['2026-09-30', 'MATEMATİK TYT', A], ['2026-10-05', 'MATEMATİK TYT', A], ['2026-10-12', 'MATEMATİK TYT', B],
      ['2026-10-14', 'FİZİK TYT', C], ['2026-10-29', 'FİZİK TYT', C], ['2026-10-30', 'FİZİK TYT', C]]).concat(rows('SENTETİK CEMRE', '12/B', [['2026-10-10', 'KİMYA TYT', B]])));
    run(`D.etut=ETUT.paketle(ER,[{bas:${gun('2026-09-14')},bit:${gun('2026-10-27')},n:8,yaz:null,ts:5}],5)`);
    const e = kart(1001).etut;
    assert.equal(e.var, true); assert.equal(e.toplam, 5, '29 Eylül is 30 days ago, 30 Ekim is tomorrow');
    assert.deepEqual(e.dersler.map(d => [d.ders, d.n, d.hocalar]), [['Matematik', 3, [{ ad: 'Sentetik Öğretmen A', n: 2 }, { ad: 'Sentetik Öğretmen B', n: 1 }]], ['Fizik', 2, [{ ad: 'Sentetik Öğretmen C', n: 2 }]]]);
    assert.equal(e.son, gun('2026-10-27'), 'the last day the etüt reports cover');
    assert.deepEqual(kart(1003).etut.dersler.map(d => [d.ders, d.n]), [['Kimya', 1]]);
    const hic = kart(1002).etut; assert.equal(hic.var, true); assert.equal(hic.toplam, 0); assert.deepEqual(hic.dersler, []);
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    assert.match(h, /Etütler \(son 30 gün\)<\/h2><span class="mini">5 etüt/); assert.match(h, /<td class="ok-ad">Matematik<\/td><td class="sayi">3<\/td><td class="ok-hoca">Sentetik Öğretmen A \(2\), Sentetik Öğretmen B \(1\)<\/td>/);
    // The pure counter: a day number window, no data.
    put('S', [{ date: '2026-10-29', course: 'KİMYA', teacher: '' }]); assert.deepEqual(get(`ANALIZ.etutOzeti(S,${BUGUN})`).dersler[0].hocalar, [{ ad: 'Öğretmen belirtilmemiş', n: 1 }]);
    assert.deepEqual(get(`ANALIZ.etutOzeti(undefined,${BUGUN})`), { toplam: 0, dersler: [] });
  });
  await check('absences of the last 30 days: the 3+ missed lessons rule, whole and half days, matched by name and class', async () => {
    await kurTum();
    const gk = l => new Map(l.map(([iso, kod]) => [gun(iso), kod]));
    put('YK', [{ ad: 'SENTETİK ADA', sinif: '12/A', gun: [...gk([['2026-09-29', 'AAAAPPPP'], ['2026-09-30', 'AAAAAAAA'], ['2026-10-06', 'AAPPPPPP'], ['2026-10-13', 'MMMPPPPP'], ['2026-10-20', 'RRRRRRRR'], ['2026-10-22', 'GPPPPPPP'], ['2026-10-30', 'AAAAAAAA']])] },
      { ad: 'SENTETİK CEMRE', sinif: '12/B', gun: [...gk([['2026-10-21', 'AAAPPPPP']])] }]);
    run('(()=>{const k=YK.map(o=>({ad:o.ad,sinif:o.sinif,gun:new Map(o.gun)}));D.yoklama=YOKLAMA.paketle(k,[{bas:' + gun('2026-09-28') + ',bit:' + gun('2026-10-27') + ',n:2,yaz:null,ts:5}],5)})()');
    const y = kart(1001).yoklama;
    assert.equal(y.var, true); assert.equal(y.n, 3, 'two whole days and a half day; two missed lessons, a late day and the future do not count');
    assert.deepEqual(y.gunler, [{ g: gun('2026-09-30'), tur: 'tam' }, { g: gun('2026-10-13'), tur: 'yarim' }, { g: gun('2026-10-20'), tur: 'tam' }]);
    assert.equal(y.son, gun('2026-10-30'), 'the last day in the report');
    assert.deepEqual(kart(1003).yoklama.gunler, [{ g: gun('2026-10-21'), tur: 'yarim' }]);
    assert.deepEqual(kart(1002).yoklama, { var: false, son: gun('2026-10-30'), n: 0, gunler: [] }, 'not in the attendance report: no data, not zero');
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    assert.match(h, /Devamsızlık \(son 30 gün\)<\/h2><span class="mini">3 gün/); assert.match(h, /<b>30 Eyl<\/b><span class="mini"> tam gün<\/span>/); assert.match(h, /<b>13 Eki<\/b><span class="mini"> yarım gün<\/span>/);
    assert.match(run('EK.okKim="1002";ANALIZ.icerik()'), /— · Yoklama kaydı yok/);
    // The pure rule.
    put('G', [[gun('2026-10-01'), 'AAAPPPPP'], [gun('2026-10-02'), 'AAPPPPPP'], [gun('2026-10-03'), 'AAAAAAAA']]);
    assert.deepEqual(get(`ANALIZ.devamsizlik(G,${BUGUN}).gunler.map(x=>x.tur)`), ['yarim', 'tam']);
  });
  await check('weak topics from Konu Takibi: difficulty-adjusted points of -1 question or less, the worst first, at most 5', async () => {
    await kurTum();
    const S1 = { name: 'SENTETİK ADA', no: '1001', cls: '205 12/A' }, NZ = 100;
    const zpart = (tur, ad, spec) => {
      const dersler = {};
      for (const [c, qs] of Object.entries(spec)) dersler[c] = tur === 'ozet' ? qs.map(q => q[0].split(',')) : qs.map(q => { const D = Math.round(q[1] * NZ); return [q[1], D, NZ - D, 0, F.zorlukEtiketi(q[1])]; });
      return { tur, ad, oturum: 'TYT', ...(tur === 'madde' ? { ogrenci: NZ } : {}), dersler };
    };
    // Sözcükte Anlam: expected 0.11+0.07+0.93+0.89 = 2.0, correct 1 → exactly -1 (counts). Cümlede Anlam: p .9, wrong → -0.9 (does not).
    // Üslü İfadeler: .9 + .8 expected, none correct → -1.7. Ses Bilgisi: expected 1.0, 1 correct → 0.
    const spec = { 'TÜRKÇE-T': [['T.12.1.1', .11], ['T.12.1.1', .07], ['T.12.1.2', .93], ['T.12.1.2', .89], ['T.12.3.1', .9], ['T.12.5.1', .6], ['T.12.5.1', .4]], 'MATEMATİK-T': [['E.M.9.3.4', .9], ['E.M.9.3.4', .8]] };
    const rep = { ad: 'SENTETİK-ZORLUK', blocks: [
      F.block([F.row('T.12.1.1', 'a', [2, 0, 2, 0]), F.row('T.12.1.2', 'b', [2, 1, 1, 0]), F.row('T.12.3.1', 'c', [1, 0, 1, 0]), F.row('T.12.5.1', 'd', [2, 1, 1, 0])], 'outcome', 'TÜRKÇE-T', S1),
      F.block([F.row('E.M.9.3.4', 'e', [2, 0, 2, 0])], 'outcome', 'MATEMATİK-T', S1)] };
    const kt = run('KONU_TAKIBI'), v = kt.merge(kt.blank(), [rep], [zpart('ozet', 'SENTETİK-ZORLUK', spec), zpart('madde', 'SENTETİK-ZORLUK', spec)]);
    v.exams[0].date = '2026-10-14'; put('KV', v); run('D.konutakibi=KV');
    const z = kart(1001).zayif;
    assert.equal(z.var, true); assert.equal(z.zorluk, true);
    assert.deepEqual(z.liste.map(t => [t.konu, t.ders, t.fark, t.son]), [['Üslü İfadeler ve Denklemler', 'Matematik', -1.7, 0], ['Sözcükte Anlam', 'Türkçe', -1, 25]]);
    assert.equal(kart(1002).zayif.var, false, 'not in Konu Takibi');
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    assert.match(h, /<td class="ok-konu">Üslü İfadeler ve Denklemler<span class="mini"> · Matematik<\/span><\/td><td class="sayi et-asagi">−1,7<\/td><td class="sayi">%0<\/td>/);
    assert.match(h, /<td class="ok-konu">Sözcükte Anlam<span class="mini"> · Türkçe<\/span><\/td><td class="sayi et-asagi">−1,0<\/td><td class="sayi">%25<\/td>/);
    assert(!h.includes('Cümlede Anlam') && !h.includes('Ses Bilgisi'));
    assert.match(run('EK.okKim="1002";ANALIZ.icerik()'), /Konu Takibi’nde bu öğrenci yok/);
    // Without difficulty data the student is there, but nothing can be said.
    put('KV2', kt.merge(kt.blank(), [rep])); run('D.konutakibi=KV2'); const z2 = kart(1001).zayif; assert.deepEqual([z2.var, z2.zorluk, z2.liste.length], [true, false, 0]);
    assert.match(run('EK.okKim="1001";ANALIZ.icerik()'), /Zorluk verisi yok/);
    // More than five weak topics: the five worst.
    put('V', { exams: [] }); assert.deepEqual(get('ANALIZ.zayifKonular(V,"1001",[])'), { var: false, zorluk: false, liste: [] });
    assert.deepEqual(get('ANALIZ.zayifKonular(null,"1001",[])'), { var: false, zorluk: false, liste: [] });
  });
  await check('the class and şube target: the şube’s own when set, else the class’s; none when unset', async () => {
    await kurTum();
    run(`D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',sinif:12,kap:6,off:[6],aktif:true},{no:1005,ad:'SENTETİK EGE',sube:'12-C',sinif:12,kap:6,off:[6],aktif:true}]`);
    assert.equal(kart(1001).hedef, null, 'no target set');
    run(`D.denemeOrtHedef={TYT:{'':40,'12-A':45},'AYT:SAY':{'':50}}`);
    let h = kart(1001).hedef; assert.deepEqual(h, { deger: 45, kaynak: 'sube', sube: '12-A', fark: -7 }, 'her şube’s target; last net 38');
    h = kart(1005).hedef; assert.deepEqual([h.deger, h.kaynak, h.fark], [40, 'sinif', -1], 'EGE’s şube has none: the class target; her net 39');
    h = kart(1003).hedef; assert.deepEqual([h.deger, h.kaynak, h.fark], [40, 'sinif', 6], 'not in the notebook: the class target; net 46 is above it');
    assert.deepEqual(kart(1001, 'AYT:SAY').hedef.deger, 50); assert.equal(kart(1001, 'AYT:SAY').hedef.fark, 3);
    const t = run('EK.okKim="1001";ANALIZ.icerik()'); assert.match(t, /Şube hedefi · 12-A<\/span><strong class="">45,00 <small>net<\/small><\/strong>[\s\S]*Son net hedefin 7,00 net altında/);
    assert.match(run('EK.okKim="1003";ANALIZ.icerik()'), /Sınıf hedefi[\s\S]*Son net hedefin 6,00 net üstünde/);
  });
  await check('cache: the same data gives the same result; a changed list, Türkiye list or day, or the roster, gives a new one', async () => {
    await kurTum();
    const a = run('ANALIZ.kaynak(' + BUGUN + ')'), b = run('ANALIZ.kaynak(' + BUGUN + ')'); assert.equal(a, b, 'same signature, same object');
    assert.notEqual(run('ANALIZ.kaynak(' + (BUGUN + 1) + ')'), a, 'a new day');
    run('ANALIZ.kaynak(' + BUGUN + ')'); const c = run('ANALIZ.kaynak(' + BUGUN + ')');
    await kurTurkiye([0, 1, 2, 3]); const d = run('ANALIZ.kaynak(' + BUGUN + ')'); assert.notEqual(d, c, 'Türkiye list changed (its time stamp)');
    const e = run('ANALIZ.kaynak(' + BUGUN + ')'); assert.equal(e, d);
    run('D.siralama.sinavlar[0].ts=5555'); assert.notEqual(run('ANALIZ.kaynak(' + BUGUN + ')'), e, 'a school list changed');
    const f = run('ANALIZ.kaynak(' + BUGUN + ')'); run(`D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',sinif:12}]`); assert.notEqual(run('ANALIZ.kaynak(' + BUGUN + ')'), f, 'the roster changed');
    // New etüt data after the card was built: the new data shows.
    const g = kart(1001).etut; assert.equal(g.var, false);
    put('ER', [{ g: gun('2026-10-20'), brans: 'MATEMATİK TYT', ogretmen: 'SENTETİK ÖĞRETMEN A', ad: 'SENTETİK ADA', sinif: '12/A', saat: 900, sure: 40 }]);
    run(`D.etut=ETUT.paketle(ER,[{bas:${gun('2026-10-01')},bit:${gun('2026-10-27')},n:1,yaz:null,ts:9}],9)`); assert.equal(kart(1001).etut.toplam, 1);
    run(`D.etut=ETUT.paketle([],[{bas:${gun('2026-10-01')},bit:${gun('2026-10-27')},n:0,yaz:null,ts:10}],10)`); assert.equal(kart(1001).etut.toplam, 0);
  });
  await check('missing sources: every part says there is no data; nothing throws', async () => {
    put('SR', siralama()); run('D.siralama=SR');
    const k = kart(1001); assert.equal(k.durum, 'tamam');
    assert.equal(k.etut.var, false); assert.equal(k.yoklama.var, false); assert.equal(k.zayif.var, false); assert.equal(k.hedef, null); assert.equal(k.trVar, false);
    const h = run('EK.okKim="1001";ANALIZ.icerik()');
    for (const m of ['— · Etüt kaydı yok', '— · Yoklama kaydı yok', 'Konu Takibi’nde bu öğrenci yok', 'Hedef belirlenmemiş', 'Türkiye geneli verisi yok']) assert(h.includes(m), m);
    // Unreadable sources do not stop the card either.
    run('D.turkiye={bozuk:true};D.etut={bozuk:true};D.yoklama={bozuk:true};D.konutakibi={bozuk:true}');
    const k2 = kart(1001); assert.equal(k2.durum, 'tamam'); assert.equal(k2.trVar, false); assert.equal(k2.etut.var, false);
  });
  await check('page states: no data, unreadable lists, no student chosen, one exam, the full card', async () => {
    let h = run('ANALIZ.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/);
    run('D.siralama={surum:99}'); h = run('ANALIZ.icerik()'); assert.match(h, /<p class="et-uyari">[^<]*okunamadı/);
    await kurTum();
    h = run('ANALIZ.icerik()'); assert.match(h, /Bir öğrenci seçin/); assert(h.includes('id="okAra"') && h.includes('<datalist id="okListe">')); assert(!h.includes('id="okGrafik"'));
    assert.equal((h.match(/<option value=/g) || []).length, 5); assert(h.includes('Sentetik Ada · 12/A · 1001'));
    // One exam in the school lists: the card still shows what there is.
    run('EK.okKim="1001"'); put('V1', siralama()); sandbox.V1.sinavlar = sandbox.V1.sinavlar.slice(0, 1); run('D.siralama=V1');
    h = run('ANALIZ.icerik()'); assert.match(h, /Son TYT neti<\/span><strong class="">32,00<\/strong>/); assert.match(h, /En az 3 deneme gerekli/); assert(h.includes('id="okGrafik"'));
    put('SR2', siralama()); run('D.siralama=SR2');
    h = run('ANALIZ.icerik()');
    // The sections, in order; the four numbers of the plan and the target card.
    const ids = ['okAd', 'okKartlar', 'okGrafik', 'okDersler', 'okZayif', 'okEtut', 'okDevam'].map(i => h.indexOf('id="' + i + '"')); assert(ids.every(i => i > 0), ids.join()); assert.deepEqual([...ids].sort((a, b) => a - b), ids);
    for (const t of ['Son TYT neti', 'Türkiye’ye göre', 'Beklenenden', 'İstikrar', 'Hedef']) assert(h.includes('<span class="mini">' + t + '</span>') || h.includes('>' + t + '<'), t);
    assert.match(h, /Okulda 3\. \/ 4 öğrenci/); assert.match(h, /<span class="mini">Beklenenden<\/span><strong class="ok-yukari">▲1,00 <small>net<\/small><\/strong>[\s\S]*Türkiye ortalamasına göre her zamanki yerinden/);
    assert.match(h, /<span class="mini">Türkiye’ye göre<\/span><strong class="ok-yukari">▲2,00 <small>net<\/small><\/strong>[\s\S]*Türkiye ortalaması 36,00 net/);
    assert.match(h, /<span class="mini">İstikrar<\/span><strong class="">Çok istikrarlı<\/strong>[\s\S]*± 0,98 net · son 5 deneme/);
    assert.match(h, /<h1 class="et-baslik" id="okAd">Sentetik Ada<\/h1><p class="et-cumle" id="okKimlik">12\/A · Alan: SAY · No 1001 · 5 TYT denemesi<\/p>/);
    assert.match(h, /data-ok-oturum="AYT:SAY"/); assert(!/Nasıl okunur|Gözlem|\bham\b|\(%95\)/i.test(h), 'no manual words');
    // Numbers sit under right-aligned headers.
    for (const id of ['okDersler']) { const t = h.slice(h.indexOf('id="' + id + '"')); const th = t.slice(t.indexOf('<thead>'), t.indexOf('</thead>')); assert((th.match(/<th class="sayi/g) || []).length === 4, th); }
    assert(!h.includes('NaN') && !h.includes('undefined'));
    // The back button goes to where the card was opened from.
    run('EK.okGeri="denemeler"'); assert.match(run('ANALIZ.icerik()'), /data-sekme="denemeler">← Denemeler<\/button>/);
    run('EK.okOturum="AYT:SAY"'); h = run('ANALIZ.icerik()'); assert.match(h, /Son AYT · SAY neti<\/span><strong class="">53,00<\/strong>/);
  });
  await check('the chart: a line for the student, the school mean, the Türkiye average and the target, each named at its right end', async () => {
    await kurTum(); run(`D.denemeOrtHedef={TYT:{'':40}}`);
    put('C', kart(1001)); const svg = get('ANALIZ.grafikSvg(C,640)');
    assert(svg.startsWith('<svg') && svg.includes('viewBox="0 0 640 ') && !/NaN|undefined|Infinity/.test(svg));
    assert.equal((svg.match(/<path class="ok-cizgi/g) || []).length, 4); assert.equal((svg.match(/<circle class="ok-nokta"/g) || []).length, 5);
    for (const t of ['Öğrenci', 'Okul ortalaması', 'Türkiye ortalaması', 'Hedef', '38,00', '39,75', '36,00', '40,00']) assert(svg.includes('>' + t + '</text>'), t);
    for (const g of ['17 Eyl', '15 Eki']) assert(svg.includes('>' + g + '</text>'), g);
    const ys = [...svg.matchAll(/<text class="ok-ad" x="[\d.]+" y="([\d.]+)"/g)].map(x => Number(x[1])).sort((a, b) => a - b);
    assert.equal(ys.length, 4); for (let i = 1; i < ys.length; i++) assert(ys[i] - ys[i - 1] >= 28, 'labels overlap: ' + ys);
    const dar = get('ANALIZ.grafikSvg(C,300)'); assert(dar.includes('viewBox="0 0 300 ') && !/NaN|undefined/.test(dar));
    for (const m of dar.matchAll(/<text class="(?:ok-ad|et-tik)" x="([\d.]+)"/g)) assert(Number(m[1]) < 300, 'inside the box');
    // One exam, and a missing Türkiye average: no NaN, the Türkiye line is simply absent.
    await kurTurkiye([0, 1]); put('C', kart(1004)); const g2 = get('ANALIZ.grafikSvg(C,640)'); assert(!/NaN|undefined/.test(g2)); assert(g2.includes('>Türkiye ortalaması</text>'));
    put('C', kart(1001)); assert.equal((get('ANALIZ.grafikSvg(C,640)').match(/<path class="ok-cizgi/g) || []).length, 4);
  });
  await check('teacher only, nothing stored: the page and the link need a rehber; the student is sent away; D is never changed', async () => {
    await kurTum(); run('D.yoklama=undefined'); run('EK.okKim="1001"');
    run("D.rol='ogrenci'"); assert.match(run('gorunumOgrenciKarti()'), /rehber öğretmen içindir/); assert.equal(run('ANALIZ.ac("1001")'), false); assert.equal(run('EK.sekme'), 'ogrencikarti');
    assert.equal(get("SEKME_OGRENCI.some(s=>s[0]==='ogrencikarti')"), false); run("D.rol='rehber'");
    const once = run('JSON.stringify(D)');
    run('ANALIZ.icerik();ANALIZ.gorunum();ANALIZ.kart("1001");gorunumOgrenciKarti()'); assert.equal(run('JSON.stringify(D)'), once, 'nothing written to the notebook');
    run('yalnizcaGoruntuleme=()=>true'); assert.match(run('gorunumOgrenciKarti()'), /<div id="okKok">[\s\S]*Sentetik Ada/); run('yalnizcaGoruntuleme=__yg');
    // Opening from a name: the school number is the key; the page opened from is remembered.
    run('EK.sekme="denemeler";EK.okKim=undefined;ciz=()=>{}');
    assert.equal(run('ANALIZ.ac("1003")'), true); assert.deepEqual(get('[EK.sekme,EK.okKim,EK.okGeri,EK.okOturum]'), ['ogrencikarti', '1003', 'denemeler', null]);
    assert.equal(run('ANALIZ.ac("1004");EK.okGeri'), 'denemeler', 'opening another student keeps the first page to go back to');
    // The page is not a top-menu item; it opens from Öğrenciler.
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    assert.equal(get("MENU_REHBER.flat(2).includes('ogrencikarti')"), false); assert.equal(get("MENU_BAGLI.ogrencikarti"), 'ogrenciler'); assert.equal(get("SEKME_REHBER.find(s=>s[0]==='ogrencikarti')[1]"), 'Öğrenci kartı');
    run("EK.sekme='ogrencikarti';rayCiz()"); assert.match(nodes.ray.innerHTML, /data-sekme="ogrenciler" aria-current="page"/);
  });
  await check('name links: Deneme panosu, Etüt etkisi and Sıralamalar names carry data-ogrenci-karti with the school number', async () => {
    await kurTum();
    run('EK.sekme="denemeler";EK.denemeKlasik=undefined');
    const dp = run('DPANO.icerik()');
    for (const no of [1001, 1003, 1005]) assert(dp.includes('<td><button type="button" class="et-ad" data-ogrenci-karti="' + no + '">'), 'Deneme panosu ' + no);
    assert.equal((dp.match(/<td><button type="button" class="et-ad" data-ogrenci-karti=/g) || []).length, 5, 'one name button per student of the table');
    assert(dp.includes('<tr data-dp-ogr="1001"'), 'the row still selects the student');
    assert.equal(run('ANALIZ.adDugmesi(7,"Ad <b>")'), '<button type="button" class="et-ad" data-ogrenci-karti="7">Ad &lt;b&gt;</button>');
    // Etüt etkisi: the student table’s names.
    const ogr = ['1001', '1002'].map((no, i) => ({ id: no + '|X', no, name: 'SENTETİK ' + no, cls: '12/A', sessions: [],
      exams: [['A', '2026-10-07', 10], ['B', '2026-10-14', 12 + i], ['C', '2026-10-21', 14]].map(([exam, date, mat]) => ({ exam, date, session: 'TYT', nets: { mat } })) }));
    ogr[0].sessions = [{ date: '2026-10-10', course: 'MATEMATİK TYT', teacher: 'SENTETİK ÖĞRETMEN A' }]; put('OG', ogr);
    run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:OG,warnings:[],etutKapsam:null});EK.sekme="etutetki"');
    const ee = run('ETUT_ETKI.icerik()'); assert(ee.includes('<td class="tg-ad"><button type="button" class="et-ad" data-ogrenci-karti="1001">Sentetik 1001</button></td>'), 'Etüt etkisi');
  });
  console.log(passed + ' Öğrenci kartı checks passed');
})();
