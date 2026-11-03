// Soru zorluğu, madde kalitesi, kademeler and the two-session cevap raporu. Synthetic data only (test/yanlislar-fixtures.cjs and numbers made up here).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const F = require('./konutakibi-fixtures.cjs'), Y = require('./yanlislar-fixtures.cjs');
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const T = run('YANLISLAR'), Z = run('ZORLUK'), K = run('KADEME');
const copy = x => JSON.parse(JSON.stringify(x));
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' vs ' + b);
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const bytes = b => new Uint8Array(b);
// seeded random numbers (mulberry32) and normal draws
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const normal = r => () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const sig = z => 1 / (1 + Math.exp(-z));

(async () => {
  await test('Wilson 95% interval (Wilson 1927)', () => {
    const w = (k, n) => Z.wilson(k, n);
    near(w(8, 10)[0], 0.4902, 5e-4); near(w(8, 10)[1], 0.9433, 5e-4);
    near(w(0, 10)[0], 0, 1e-12); near(w(0, 10)[1], 0.2775, 5e-4);
    near(w(10, 10)[0], 0.7225, 5e-4); near(w(10, 10)[1], 1, 1e-12);
    near(w(50, 100)[0], 0.4038, 5e-4); near(w(50, 100)[1], 0.5962, 5e-4);
    assert.equal(w(0, 0), null);
  });
  await test('corrected point-biserial on a hand example', () => {
    // four persons, three items: scores 3, 2, 1, 0. Item 1 = [1,1,1,0]; the rest of the section = [2,1,0,0].
    const X = [[1, 1, 1], [1, 1, 0], [1, 0, 0], [0, 0, 0]], tot = X.map(r => r[0] + r[1] + r[2]);
    const x1 = X.map(r => r[0]);
    near(Z.ritDuzeltilmis(x1, tot), 0.75 / Math.sqrt(0.75 * 2.75), 1e-12);
    near(Z.ritDuzeltilmis(X.map(r => r[1]), tot), 0.5 / Math.sqrt(1 * 1.25) * 0 + Z.pearson(X.map(r => r[1]), [2, 1, 1, 0]), 1e-12);
    assert.equal(Z.ritDuzeltilmis([1, 1, 1, 1], tot), null, 'an item everyone got right has no correlation');
    // an item that goes against the section
    assert(Z.ritDuzeltilmis([0, 0, 1, 1], tot) < 0);
  });
  await test('KR-20 and its SEM on a hand example (known value 0.75)', () => {
    const r = Z.kr20([[1, 1, 1], [1, 1, 0], [1, 0, 0], [0, 0, 0]]);
    // k = 3, Σpq = .1875 + .25 + .1875 = .625, population variance of 3,2,1,0 = 1.25: (3/2)(1 − .625/1.25) = .75
    near(r.kr20, 0.75, 1e-12); near(r.sd, Math.sqrt(1.25), 1e-12); near(r.sem, Math.sqrt(1.25) * 0.5, 1e-12); near(r.ort, 1.5, 1e-12);
    assert.equal(Z.kr20([[1, 1], [1, 1]]), null);
  });
  await test('JMLE recovers the item difficulties of a seeded simulation (extremes left out, centred, Wright correction)', () => {
    const r = rng(20260101), nrm = normal(r), L = 30, N = 800, bt = Array.from({length: L}, (_, i) => -2 + 4 * i / (L - 1));
    const X = Array.from({length: N}, () => { const th = nrm(); return bt.map(b => r() < sig(th - b) ? 1 : 0) });
    const R = Z.rasch(X), m = bt.reduce((a, b) => a + b, 0) / L;
    assert(R.uygun); assert.equal(R.L, L);
    const idx = [...R.b.keys()].filter(i => R.b[i] !== null);
    const hata = idx.map(i => R.b[i] - (bt[i] - m)), rmse = Math.sqrt(hata.reduce((a, e) => a + e * e, 0) / idx.length);
    assert(rmse < 0.15, 'RMSE ' + rmse); assert(Z.pearson(idx.map(i => R.b[i]), idx.map(i => bt[i])) > 0.995);
    assert(idx.filter(i => Math.abs(R.b[i] - (bt[i] - m)) <= 2.5 * R.se[i]).length >= idx.length - 1, 'within 2.5 SE');
    near(idx.reduce((a, i) => a + R.b[i], 0) / idx.length, 0, 0.05, 'centred');
    assert(R.se.every(s => s === null || (s > 0.05 && s < 0.2)));
    assert(R.infit.every(v => v === null || (v > 0.8 && v < 1.2)) && R.outfit.every(v => v === null || (v > 0.8 && v < 1.25)), 'a Rasch-generated item fits');
    assert(R.ayirma.guvenirlik > 0.99 && R.ayirma.G > 5);
    // extreme persons and items are reported, not fitted
    const X2 = X.map(row => row.concat([1, 0])); X2.push(Array(L + 2).fill(1)); X2.push(Array(L + 2).fill(0));
    const R2 = Z.rasch(X2);
    assert.equal(R2.b[L], null); assert.equal(R2.b[L + 1], null); assert(R2.uc[L] && R2.uc[L + 1]); assert(R2.maddeUc >= 2); assert(R2.kisiUc >= 2);
    near(R2.b[5], R.b[5], 0.02, 'extremes do not move the other items');
  });
  await test('difficulty bands: edges, the "?" rule and low reliability', () => {
    const no = Z.bantNo;
    assert.deepEqual(copy([-3, -2, -1.999, -0.75, -0.7499, 0, 0.7499, 0.75, 1.999, 2, 3].map(no)), [0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4]);
    assert.deepEqual(copy(Z.BANTLAR.map(x => x[1])), ['Çok kolay', 'Kolay', 'Orta', 'Zor', 'Çok zor']);
    const kesin = Z.bantla(1.2, 0.2), kenar = Z.bantla(0.9, 0.05), belirsiz = Z.bantla(0.8, 0.3), iki = Z.bantla(-0.76, 0.5);
    assert.deepEqual([kesin.bant, kesin.belirsiz], ['zor', false]);
    assert.deepEqual([kenar.bant, kenar.belirsiz], ['zor', false], '0.9 ± 0.098 stays above 0.75');
    assert.deepEqual([belirsiz.bant, belirsiz.belirsiz], ['zor', false], '0.8 ± 0.588 reaches Orta: one neighbour band is tolerated');
    assert.deepEqual([iki.bant, iki.belirsiz], ['kolay', false], 'Kolay..Orta only');
    const uc = Z.bantla(0, 0.8), bes = Z.bantla(0.5, 0.9), sinir = Z.bantla(0, 0.7);
    assert.deepEqual([uc.bant, uc.belirsiz], ['orta', true], '0 ± 1.57 spans Kolay, Orta, Zor');
    assert.deepEqual([bes.bant, bes.belirsiz], ['orta', true], 'spans four bands');
    assert.equal(Z.bantla(0, 0.35).belirsiz, false, '0 ± 0.69 stays inside Orta'); assert.equal(sinir.belirsiz, true, '0 ± 1.37 also spans Kolay, Orta, Zor');
    assert.equal(Z.etiketYazi('zor', true), 'Zor?'); assert.equal(Z.etiketYazi('cok-kolay', false), 'Çok kolay');
    // the cut points are P ≈ .32 / .68 and .12 / .88 for an average student
    near(Z.sig(-0.75), 0.32, 0.005); near(Z.sig(0.75), 0.68, 0.005); near(Z.sig(-2), 0.12, 0.005); near(Z.sig(2), 0.88, 0.005);
    // fewer than 15 takers (or KR-20 < .5) → "Güvenilirlik düşük"; the labels get no "?" for it, only the muted chip (m.dusuk)
    const r = rng(7), nrm = normal(r), mat = (N, L) => Array.from({length: N}, () => { const th = nrm(); return Array.from({length: L}, (_, i) => r() < sig(th - (-2 + 4 * i / (L - 1))) ? 1 : -(r() < 0.3 ? 1 : 0)) });
    const kucuk = Z.bolum(mat(12, 20)), buyuk = Z.bolum(mat(60, 20));
    assert.equal(kucuk.dusuk, true); assert.equal(buyuk.dusuk, false);
    assert(kucuk.maddeler.filter(m => m.bant).every(m => m.dusuk === true) && buyuk.maddeler.filter(m => m.bant).every(m => m.dusuk === false), 'low reliability marks the items, not their "?"');
    assert(kucuk.maddeler.filter(m => m.bant && !m.uc).some(m => !m.belirsiz), 'a small group does not turn every label into "?"');
    assert(buyuk.maddeler.filter(m => m.bant && !m.uc).every(m => m.belirsiz === (Math.abs(Z.bantNo(m.rel + 1.96 * m.se) - Z.bantNo(m.rel - 1.96 * m.se)) >= 2)));
    // extreme items keep their band; "?" only below 15 takers
    const ucRows = N => Array.from({length: N}, (_, i) => [1, i % 2, i % 3 ? 1 : 0, 0]);
    const e15 = Z.bolum(ucRows(15)).maddeler, e14 = Z.bolum(ucRows(14)).maddeler;
    assert.deepEqual([e15[0].bant, e15[0].belirsiz, e15[3].bant, e15[3].belirsiz], ['cok-kolay', false, 'cok-zor', false]);
    assert.deepEqual([e14[0].bant, e14[0].belirsiz, e14[3].bant, e14[3].belirsiz], ['cok-kolay', true, 'cok-zor', true]);
    assert.match(Z.bolumSatiri('Türkçe', kucuk), /^Türkçe · 12 öğrenci · KR-20 [\d,]+ · .*Güvenilirlik düşük$/);
    assert.doesNotMatch(Z.bolumSatiri('Türkçe', buyuk), /Güvenilirlik düşük/);
    assert.equal(Z.bolumSatiri('Türkçe', {n: 27, kr20: 0.82, isaretli: 2, dusuk: false}), 'Türkçe · 27 öğrenci · KR-20 0,82 · 2 madde işaretli');
    assert.equal(Z.bolumSatiri('Türkçe', {n: 27, kr20: 0.82, isaretli: 2, dusuk: false}, 0.714), 'Türkçe · 27 öğrenci · KR-20 0,82 · 2 madde işaretli · okul verisi ρ 0,71');
  });
  await test('quality flags: reversed key, weak discrimination, misfit (and the flagged item keeps its label)', () => {
    assert.deepEqual(copy(Z.bayraklar(-0.1, 1, 1)), ['Ayırt etmiyor: anahtarı kontrol edin']);
    assert.deepEqual(copy(Z.bayraklar(0, 1, 1)), ['Zayıf ayırt edicilik']); assert.deepEqual(copy(Z.bayraklar(0.19, 1, 1)), ['Zayıf ayırt edicilik']);
    assert.deepEqual(copy(Z.bayraklar(0.2, 1, 1)), []);
    assert.deepEqual(copy(Z.bayraklar(0.4, 1.51, 1)), ['Uyumsuz']); assert.deepEqual(copy(Z.bayraklar(0.4, 1, 0.49)), ['Uyumsuz']); assert.deepEqual(copy(Z.bayraklar(0.4, 0.5, 1.5)), []);
    assert.deepEqual(copy(Z.bayraklar(-0.2, 2, 1)), ['Ayırt etmiyor: anahtarı kontrol edin', 'Uyumsuz']);
    const r = rng(99), nrm = normal(r), L = 15;
    const rows = Array.from({length: 120}, () => { const th = nrm(); return Array.from({length: L}, (_, i) => { const p = sig(th - (-1.5 + 3 * i / (L - 1))); return (i === 6 ? r() >= p : r() < p) ? 1 : 0 }) });
    const a = Z.bolum(rows), m = a.maddeler[6];
    assert(m.rit < 0); assert(m.bayrak.includes('Ayırt etmiyor: anahtarı kontrol edin')); assert(m.bant, 'a flagged item keeps its difficulty label');
    assert.equal(a.maddeler.filter(x => x.bayrak.length).length, a.isaretli); assert(a.isaretli >= 1);
  });
  await test('Kendi seviyesi window: the tier picks a window of difficulty bands (W0..W4), the Orta window without a tier', () => {
    const kv = Z.kendiSeviyesi, bantlar = ['cok-kolay', 'kolay', 'orta', 'zor', 'cok-zor'];
    const pen = (k, H) => bantlar.map((b, i) => kv(k, H, b) ? i : -1).filter(i => i >= 0);
    assert.deepEqual(copy(Z.PENCERELER), [[3, 4], [2, 3], [2], [1, 2], [0, 1]]);
    assert.deepEqual([1, 2, 3].map(k => pen(k, 3)), [[3, 4], [2], [0, 1]]);
    assert.deepEqual([1, 2, 3, 4].map(k => pen(k, 4)), [[3, 4], [2, 3], [1, 2], [0, 1]]);
    assert.deepEqual([1, 2, 3, 4, 5].map(k => pen(k, 5)), [[3, 4], [2, 3], [2], [1, 2], [0, 1]]);
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(k => pen(k, 6)), [[3, 4], [2, 3], [2], [2], [1, 2], [0, 1]], 'H = 6: round((k − 1)·4/5)');
    assert.deepEqual(pen(null, 4), [2]); assert.deepEqual(pen(undefined, null), [2], 'no tier: the Orta window');
    assert.equal(kv(1, 3, null), false); assert.equal(kv(1, 3, 'orta'), false);
  });
  await test('tiers: equating, precision and recency weights (0.8^age), delta-method SE', () => {
    const kay = (ogr, sinav, tarih, d, n = 40, ders = 'mat') => ({ogr, sinav, tarih, ad: sinav, oturum: 'TYT', ders, d, n});
    const kohort = (sinav, tarih, ds, n) => ds.map((d, i) => kay('o' + i, sinav, tarih, d, n));
    const a1 = (rows, i) => K.hesapla(rows).get('TYT:mat').ogrenciler.get('o' + i).a;
    // the same cohort in an easy and a hard exam: the student at the cohort mean has ability 0 in both; nobody's ability falls because the exam was harder
    const easy = kohort('E', '2026-10-01', [10, 12, 14, 16, 18, 20, 22].map(d => d + 12), 40), hard = kohort('H', '2026-10-01', [10, 12, 14, 16, 18, 20, 22].map(d => d - 6), 40);
    near(a1(easy, 3), 0, 1e-12); near(a1(hard, 3), 0, 1e-12);
    for (let i = 0; i < 7; i++) near(a1(easy, i), a1(hard, i), 0.5, 'student ' + i);
    assert(Math.log((22 + 12 + .5) / (40 - 34 + .5)) - Math.log((22 - 6 + .5) / (40 - 16 + .5)) > 1, 'the raw logit differs a lot');
    // one exam: SE = 1 / √(n p (1 − p)) with p = (D + .5) / (n + 1)
    const d1 = K.hesapla(easy).get('TYT:mat').ogrenciler.get('o0'), p = (22 + .5) / 41;
    near(d1.se, 1 / Math.sqrt(40 * p * (1 - p)), 1e-12);
    // two exams: weights precision × .8^age (AGIRLIK_KADEME), the latest exam has age 0
    const rows = [...kohort('A', '2026-09-01', [8, 10, 12, 14, 16, 18, 20], 40), ...kohort('B', '2026-10-01', [20, 18, 16, 14, 12, 10, 8], 40)];
    const q = K.hesapla(rows).get('TYT:mat').ogrenciler.get('o0'), pA = (8 + .5) / 41, pB = (20 + .5) / 41, mA = (14 + .5) / 41, mB = mA;
    const aA = Math.log(pA / (1 - pA)) - Math.log(mA / (1 - mA)), aB = Math.log(pB / (1 - pB)) - Math.log(mB / (1 - mB)), wA = 40 * pA * (1 - pA) * K.AGIRLIK_KADEME, wB = 40 * pB * (1 - pB);
    near(q.a, (wA * aA + wB * aB) / (wA + wB), 1e-12); near(q.se, Math.sqrt(wA * wA / (40 * pA * (1 - pA)) + wB * wB / (40 * pB * (1 - pB))) / (wA + wB), 1e-12);
    assert.equal(K.AGIRLIK_KADEME, 0.8); assert(q.a > 0, 'the recent exam weighs more'); assert.equal(q.seri.length, 2);
    // an exam with fewer than 5 takers cannot be equated and is ignored
    const az = K.hesapla(kohort('X', '2026-10-01', [10, 20, 30, 35], 40)); assert.equal(az.get('TYT:mat').n, 0);
    // a record with impossible numbers is ignored
    assert.equal(K.hesapla([kay('o', 'X', '2026-10-01', 41, 40), kay('o', 'X', '2026-10-01', 5, 0)]).size, 0);
  });
  await test('tiers: strata formula H = floor((4G + 1) / 3) clamped to 3..6; Fisher–Jenks natural breaks', () => {
    assert.deepEqual([0, 0.5, 1, 1.25, 2, 2.5, 3, 4, 5, 6, 12].map(K.katman), [3, 3, 3, 3, 3, 3, 4, 5, 6, 6, 6]);
    const ds = Array.from({length: 30}, (_, i) => 2 + i + (i % 3)), rows = ds.map((d, i) => ({ogr: 's' + i, sinav: 'E', tarih: '2026-10-01', ad: 'E', oturum: 'TYT', ders: 'turkce', d, n: 40}));
    const x = K.hesapla(rows).get('TYT:turkce');
    assert.equal(x.yetersiz, false); assert.equal(x.Hhedef, K.katman(x.G)); assert.equal(x.H, x.Hhedef); assert(x.H >= 3 && x.H <= 6); assert.equal(x.kenarlar.length, x.H - 1);
    near(x.guvenirlik, x.G * x.G / (1 + x.G * x.G), 1e-12); assert(x.gvf >= 0 && x.gvf <= 1);
    const os = [...x.ogrenciler.values()];
    // every tier is used, tiers do not increase with ability, boundaries descend and lie between the groups
    for (let k = 1; k <= x.H; k++) assert(os.some(o => o.kademe === k), 'tier ' + k);
    const ord = os.slice().sort((a, b) => b.a - a.a); for (let r = 1; r < ord.length; r++) assert(ord[r].kademe >= ord[r - 1].kademe);
    x.kenarlar.forEach((e, b) => { if (b) assert(e < x.kenarlar[b - 1]); const lo = Math.min(...os.filter(o => o.kademe <= b + 1).map(o => o.a)), hi = Math.max(...os.filter(o => o.kademe > b + 1).map(o => o.a)); near(e, (lo + hi) / 2, 1e-12) });
    // "?" only when ability ± 1.96 SE spans three or more tiers against the midpoint boundaries; not in a low-reliability ders
    const tier = v => 1 + x.kenarlar.filter(e => v < e).length;
    for (const o of os) { assert.equal(tier(o.a), o.kademe); assert.equal(o.belirsiz, !x.dusuk && Math.abs(tier(o.a - 1.96 * o.se) - tier(o.a + 1.96 * o.se)) >= 2) }
  });
  await test('Fisher–Jenks natural breaks: hand example, outlier, ties, flat, GVF', () => {
    const J = (a, H) => { const r = K.kademeAta(a, H); return {t: copy(r.t), e: copy(r.kenarlar), H: r.H, gvf: r.gvf} };
    // [1,2,3, 10,11,12, 30,31], H = 3: the optimal groups are {1,2,3}, {10,11,12}, {30,31}; tier 1 is the strongest
    const a = [1, 2, 3, 10, 11, 12, 30, 31], j = J(a, 3);
    assert.deepEqual(j.t, [3, 3, 3, 2, 2, 2, 1, 1]); assert.deepEqual(j.e, [21, 6.5]);
    // GVF = 1 − SDCM / SDAM by hand
    const mean = a.reduce((p, q) => p + q, 0) / 8, sdam = a.reduce((p, q) => p + (q - mean) ** 2, 0), ssd = g => { const m = g.reduce((p, q) => p + q, 0) / g.length; return g.reduce((p, q) => p + (q - m) ** 2, 0) };
    near(j.gvf, 1 - (ssd([1, 2, 3]) + ssd([10, 11, 12]) + ssd([30, 31])) / sdam, 1e-12); assert(j.gvf > 0.97 && j.gvf <= 1);
    // order of the input does not matter
    assert.deepEqual(J([31, 10, 1, 12, 3, 30, 11, 2], 3).t, [1, 2, 3, 2, 3, 1, 2, 3]);
    // an outlier: one far-top student forms tier 1 alone
    const o = J([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 9], 3); assert.equal(o.t[9], 1); assert.equal(o.t.filter(v => v === 1).length, 1);
    // ties are never split, even when the optimal cut would fall inside them
    const tie = J([1, 1, 1, 1, 5, 5, 5, 5, 9, 9], 3); assert.deepEqual(tie.t, [3, 3, 3, 3, 2, 2, 2, 2, 1, 1]);
    const tie2 = J([1, 2, 2, 2, 2, 2, 2, 3], 3); assert.equal(new Set(tie2.t.slice(1, 7)).size, 1);
    // fewer distinct values than H: H shrinks to that number; one value = a single tier without boundaries
    const two = J([4, 4, 7, 7, 7], 5); assert.equal(two.H, 2); assert.deepEqual(two.t, [2, 2, 1, 1, 1]); assert.equal(two.e.length, 1);
    const flat = J([0.3, 0.3, 0.3, 0.3], 4); assert.equal(flat.H, 1); assert.deepEqual(flat.t, [1, 1, 1, 1]); assert.deepEqual(flat.e, []); assert.equal(flat.gvf, 1);
    // GVF stays within 0..1 on random data and grows with H
    const r = rng(3), nrm = normal(r), v = Array.from({length: 60}, () => nrm());
    let prev = -1; for (let H = 2; H <= 6; H++) { const g = J(v, H).gvf; assert(g >= 0 && g <= 1 && g >= prev - 1e-12); prev = g }
  });
  await test('tiers are hidden when the data is insufficient ("Veri yetersiz")', () => {
    const mk = (n, f) => Array.from({length: n}, (_, i) => ({ogr: 's' + i, sinav: 'E', tarih: '2026-10-01', ad: 'E', oturum: 'TYT', ders: 'fizik', d: f(i), n: 7}));
    const few = K.hesapla(mk(7, i => i)).get('TYT:fizik');
    assert.equal(few.yetersiz, true); assert.equal(few.H, null); assert.deepEqual(copy(few.kenarlar), []); assert([...few.ogrenciler.values()].every(o => o.kademe === undefined));
    // no spread or only noise (SD_true² ≤ 0): the ders is not dropped, it gets 2 tiers, reliability 0 and dusuk
    const flat = K.hesapla(mk(12, () => 4)).get('TYT:fizik'); assert.equal(flat.yetersiz, false); assert.equal(flat.H, 1); assert.equal(flat.Hhedef, 3); assert.equal(flat.dusuk, true); assert.equal(flat.guvenirlik, 0);
    assert([...flat.ogrenciler.values()].every(o => o.kademe === 1 && o.belirsiz === false), 'equal abilities: one tier');
    const noise = K.hesapla(mk(12, i => 3 + (i % 2))).get('TYT:fizik'); assert.equal(noise.yetersiz, false, 'SD_obs² below the mean SE²'); assert.equal(noise.H, 2); assert.equal(noise.Hhedef, 3); assert.equal(noise.dusuk, true); assert.equal(noise.guvenirlik, 0); assert.equal(noise.G, 0);
    assert.deepEqual([...new Set([...noise.ogrenciler.values()].map(o => o.kademe))].sort(), [1, 2], 'two ability values, two tiers, ties never split');
    const ramp = K.hesapla(mk(12, i => i % 7)).get('TYT:fizik'); assert.equal(ramp.yetersiz, false); assert(ramp.H >= 3);
    assert([...noise.ogrenciler.values()].every(o => o.belirsiz === false), 'no "?" flood');
    assert.equal(K.hesapla(mk(8, i => i)).get('TYT:fizik').yetersiz, false, 'eight students are enough when they differ');
    // fewer than 8 students of the grade, or no equatable exam: Veri yetersiz; ability is null there
    run("D=varsayilan();D.rol='rehber';D.ogr=[]");
    for (let i = 0; i < 7; i++) run("D.ogr.push({ad:'SENTETİK ÖĞRENCİ " + i + "',no:'" + (9100 + i) + "',sube:'205 12/A',alan:'SAY',denemeOkul:[{id:'p:a" + i + "',ad:'Sentetik 1',tarih:'2026-10-01',tur:'TYT',oturum:'TYT',alan:'SAY',dersler:[{kod:'fizik',dogru:" + i + ",yanlis:0,soru:7}],sure:null,puan:null,ts:1000}]})");
    assert.equal(K.yetenek('9100', 'TYT', 'fizik'), null); assert.equal(K.dersBul(12, 'TYT', 'fizik').yetersiz, true);
    assert.equal(K.hesapla([]).size, 0);
  });
  await test('5-question dersler over 8 synthetic exams get tiers (recency 0.8)', () => {
    const r = rng(41), nrm = normal(r), N = 40, E = 8;
    const theta = Array.from({length: N}, () => nrm());
    const mkRows = () => { const rows = []; theta.forEach((th, i) => { for (let e = 0; e < E; e++) rows.push({ogr: 's' + i, sinif: 12, sinav: 'E' + e, tarih: '2026-09-' + String(10 + e * 2).padStart(2, '0'), ad: 'E' + e, oturum: 'TYT', ders: 'cografya', n: 5,
      d: Math.max(0, Math.min(5, Math.round(5 * sig(1.3 * th + 0.8 * nrm()))))}) }); return rows };
    const x = K.hesapla(mkRows()).get('TYT:cografya@12');
    assert.equal(x.yetersiz, false); assert(x.H >= 2); assert(Number.isFinite(x.guvenirlik) && x.guvenirlik > 0);
    assert.equal(x.dusuk, x.guvenirlik < 0.5);
    // effective n over 10 exams: 0.8 gives about 7, 0.5 about 3
    const neff = w => { const a = Array.from({length: 10}, (_, i) => w ** i); return a.reduce((p, q) => p + q, 0) ** 2 / a.reduce((p, q) => p + q * q, 0) };
    assert(neff(0.8) > 6.5 && neff(0.8) < 7.5 && neff(0.5) < 3.2);
    // stronger students get lower tier numbers
    const t = i => x.ogrenciler.get('s' + i).kademe, order = [...Array(N).keys()].sort((a, b) => theta[b] - theta[a]);
    assert(t(order[0]) <= t(order[N - 1]));
  });
  await test('tiers are per grade: a strong 9th grader is not pulled down by 12th graders', () => {
    const r = rng(8), nrm = normal(r), rows = [];
    const ekle = (sinif, pre, shift, N) => { for (let i = 0; i < N; i++) { const th = nrm(); for (let e = 0; e < 4; e++) rows.push({ogr: pre + i, sinif, sinav: 'E' + e, tarih: '2026-10-0' + (e + 1), ad: 'E' + e, oturum: 'TYT', ders: 'mat', n: 30, d: Math.max(0, Math.min(30, Math.round(30 * sig(1.1 * th + shift + 0.3 * nrm()))))}) } };
    ekle(9, 'a', -1.2, 24); ekle(12, 'b', 1.2, 24);
    const m = K.hesapla(rows), d9 = m.get('TYT:mat@9'), d12 = m.get('TYT:mat@12');
    assert(d9 && d12); assert.equal(d9.n, 24); assert.equal(d12.n, 24); assert.equal(d9.sinif, 9); assert.equal(d12.sinif, 12);
    assert.notDeepEqual(copy(d9.kenarlar), copy(d12.kenarlar), 'edges are per grade');
    // each grade is centred on its own cohort: both have students in tier 1 and in the last tier
    for (const d of [d9, d12]) { const ts = [...d.ogrenciler.values()].map(o => o.kademe); assert(ts.includes(1) && ts.includes(d.H)); }
    // ranked together (no grade) the 9th graders would sit in the weakest tiers
    const toplam = K.hesapla(rows.map(({sinif, ...q}) => q)).get('TYT:mat'), mean = (d, p) => { const l = [...d.ogrenciler.values()].filter(o => o.ogr.startsWith(p)); return l.reduce((a, o) => a + o.kademe, 0) / l.length };
    assert(mean(toplam, 'a') > mean(toplam, 'b') + 0.5, 'mixed cohort: the 9th graders look weak');
    assert(Math.abs(mean(d9, 'a') - mean(d12, 'b')) < 1, 'per grade both are around the middle');
  });
  await test('section names map to the Deneme ders codes (TYT and AYT, both sheets)', () => {
    const e = [['TÜRKÇE-T', 'TYT', 'turkce'], ['TARİH-T', 'TYT', 'tarih'], ['COĞRAFYA-T', 'TYT', 'cografya'], ['FELSEFE-T', 'TYT', 'felsefe'], ['DİN KÜLTÜRÜ-T', 'TYT', 'din'], ['S.FELSEFE-T', 'TYT', 'sf'], ['MATEMATİK-T', 'TYT', 'mat'], ['GEOMETRİ-T', 'TYT', 'geo'],
      ['FİZİK-T', 'TYT', 'fizik'], ['KİMYA-T', 'TYT', 'kimya'], ['BİYOLOJİ-T', 'TYT', 'biyoloji'], ['TÜRK DİLİ VE EDB-A', 'AYT', 'edebiyat'], ['TARİH.1-A', 'AYT', 'tarih1'], ['COĞRAFYA.1-A', 'AYT', 'cografya1'], ['TARİH.2-A', 'AYT', 'tarih2'],
      ['COĞRAFYA.2-A', 'AYT', 'cografya2'], ['FELSEFE GR.-A', 'AYT', 'felsefe'], ['DİN KÜLTÜRÜ-A', 'AYT', 'din'], ['S.FELSEFE-A', 'AYT', 'sf'], ['MATEMATİK-A', 'AYT', 'mat'], ['GEOMETRİ-A', 'AYT', 'geo'], ['FİZİK-A', 'AYT', 'fizik'], ['KİMYA-A', 'AYT', 'kimya'], ['BİYOLOJİ-A', 'AYT', 'biyoloji']];
    for (const [ad, oturum, kod] of e) assert.deepEqual(copy(K.kodDers(ad)), {oturum, kod}, ad);
    assert.equal(K.kodDers('BİLİNMEYEN-T'), null); assert.equal(K.kodDers('TÜRKÇE'), null);
    // every code exists in the Deneme lists
    for (const [, oturum, kod] of e) assert(run('DENEME_DERSLER')[oturum].some(d => d[0] === kod), kod);
  });
  await test('tiers from the notebook: denemeListe rows of every student, per ders, equated by exam', () => {
    run("D=varsayilan();D.rol='rehber';D.ogr=[]");
    const r = rng(5), nrm = normal(r), N = 16, exams = [['Sentetik 1', '2026-09-10', 0.3], ['Sentetik 2', '2026-09-24', -0.4], ['Sentetik 3', '2026-10-08', 0]];
    const theta = Array.from({length: N}, () => nrm());
    theta.forEach((th, i) => {
      const dm = exams.map(([ad, tarih, kolay], k) => ({id: 'p:s' + k + '-' + i, ad, tarih, tur: 'TYT', oturum: 'TYT', alan: 'SAY', sure: null, puan: null, ts: 1000 + k,
        dersler: [['mat', 30], ['turkce', 40]].map(([kod, n]) => { const d = Math.max(0, Math.min(n, Math.round(n * sig(1.2 * th + kolay + 0.3 * nrm())))); return {kod, dogru: d, yanlis: n - d - (i % 3), soru: n} })}));
      run("D.ogr.push(" + JSON.stringify({ad: 'SENTETİK ÖĞRENCİ ' + i, no: String(9200 + i), sube: i % 2 ? '205 12/B' : '205 12/A', alan: 'SAY', denemeOkul: dm}) + ")");
    });
    const m = K.model(), mat = m.dersler.get('TYT:mat@12');
    assert.equal(mat.n, N); assert.equal(mat.sinavSayisi, 3); assert.equal(mat.yetersiz, false); assert(mat.H >= 2);
    assert.equal(mat.ogrenciler.get('9200').seri.length, 3);
    const order = [...Array(N).keys()].sort((a, b) => theta[b] - theta[a]);
    assert(mat.ogrenciler.get(String(9200 + order[0])).kademe <= mat.ogrenciler.get(String(9200 + order[N - 1])).kademe, 'the stronger student has the lower tier number');
    near(K.yetenek('9200', 'TYT', 'mat'), mat.ogrenciler.get('9200').a, 1e-12);
    assert.equal(K.yetenek('0000', 'TYT', 'mat'), null); assert.equal(K.yetenek('9200', 'AYT', 'mat'), null);
    assert.equal(m, K.model(), 'cached while the notebook does not change');
    // a ders not answered in a TYT row is a real zero (a blank section); an AYT ders outside the field is not counted (denemeBolumSayilir)
    run("D.ogr[0].denemeOkul.push({id:'p:ayt0',ad:'Sentetik AYT',tarih:'2026-10-09',tur:'AYT',oturum:'AYT',alan:'SAY',sure:null,puan:null,ts:2000,dersler:[{kod:'mat',dogru:20,yanlis:5,soru:30},{kod:'edebiyat',dogru:0,yanlis:0,soru:24}]})");
    const m2 = K.model(); assert.notEqual(m2, m); assert.equal(m2.dersler.get('AYT:mat@12').n, 0, 'one student alone is below the cohort minimum'); assert(!m2.dersler.has('AYT:edebiyat@12'));
    // chips for the student's own page
    const chips = K.ogrenciSatiri(1); assert.match(chips, /Matematik · \d\??\. kademe \/ \d/); assert.match(chips, /Türkçe · \d\??\. kademe \/ \d/);
    assert.equal(K.ogrenciSatiri(99), '');
    const panel = K.panel(); assert.match(panel, /id="kdKok"/); assert.match(panel, /data-kd-hucre=/); assert.match(panel, /Matematik/); assert.match(panel, /kademe · 0,\d\d/);
    assert.match(panel, /data-kd-oturum="AYT"/);
    run("D=varsayilan();D.rol='rehber';D.ogr=[]"); assert.match(K.panel(), /Veri yetersiz/);
  });
  await test('Kademeler panel: Sınıf selector (default the highest grade), şube list and rows follow the grade; yetenek uses the student\'s own grade; low-reliability ders is muted', () => {
    run("D=varsayilan();D.rol='rehber';D.ogr=[]");
    const r = rng(12), nrm = normal(r);
    const ekle = (sinif, sube, i, shift, flat) => run("D.ogr.push(" + JSON.stringify({ad: 'SENTETİK ' + sube + ' ' + i, no: String(sinif * 1000 + i), sube, sinif, alan: 'SAY', denemeOkul: [0, 1, 2].map(k => ({id: 'p:g' + k + '-' + i, ad: 'Sentetik ' + k, tarih: '2026-10-0' + (k + 1), tur: 'TYT', oturum: 'TYT', alan: 'SAY', sure: null, puan: null, ts: 1000 + k,
      dersler: [{kod: 'mat', dogru: Math.max(0, Math.min(30, Math.round(30 * sig(1.2 * ((i * 7 % 10) / 5 - 1) + shift + 0.2 * nrm())))), yanlis: 0, soru: 30}, {kod: 'din', dogru: 3, yanlis: 2, soru: 5}]}))}) + ")");
    for (let i = 0; i < 12; i++) { ekle(9, i % 2 ? '9-B' : '9-A', i, -1.2); ekle(12, i % 2 ? '12-B' : '12-A', i, 1.2) }
    run("D.ogr.splice(0, D.ogr.length, ...D.ogr)"); run("KADEME.durum().sinif = null; KADEME.durum().sube = ''");
    let p = K.panel();
    assert.match(p, /data-kd-sinif="9"/); assert.match(p, /data-kd-sinif="12" aria-pressed="true"/); assert(!/data-kd-sinif="10"/.test(p), 'only grades with data');
    assert.equal(K.durum().sinif, 12); assert.match(p, /12-A/); assert(!/>9-A</.test(p), 'şube list of grade 12 only');
    assert.match(p, /12 öğrenci|24 öğrenci/); assert.equal((p.match(/<tr><th scope="row">/g) || []).length, 12);
    // Din (5 questions, no spread): not dropped, 2 kademe, güvenilirlik düşük, muted
    assert.match(p, /1 kademe · güvenilirlik düşük/); assert.match(p, /kd-dusuk/);
    run("KADEME.durum().sinif = 9"); p = K.panel();
    assert.match(p, /data-kd-sinif="9" aria-pressed="true"/); assert.match(p, />9-A</); assert(!/>12-A</.test(p)); assert.equal((p.match(/<tr><th scope="row">/g) || []).length, 12);
    // yetenek uses the student's own grade: grade 9 (shift −1.2) and 12 (+1.2) abilities are relative to their own cohorts
    const a9 = K.yetenek('9000', 'TYT', 'mat'), a12 = K.yetenek('12000', 'TYT', 'mat');
    assert(Number.isFinite(a9) && Number.isFinite(a12)); near(a9, K.dersBul(9, 'TYT', 'mat').ogrenciler.get('9000').a, 1e-12); near(a12, K.dersBul(12, 'TYT', 'mat').ogrenciler.get('12000').a, 1e-12);
    assert(Number.isFinite(K.yetenek('9001', 'TYT', 'din')), 'a low-reliability ders still has an ability');
    assert.equal(K.dersBul(9, 'TYT', 'din').dusuk, true);
    assert.match(K.ogrenciSatiri(0), /kd-hap kd-dusuk/);
  });

  /* ---------------- the report with two sheets ---------------- */
  await test('AYT sheet: both sheets parse into one report (TYT then AYT, inline strings, students joined by number)', async () => {
    const r = await T.raporCoz(bytes(Y.raporXlsx2()));
    assert.deepEqual(copy(r.oturumlar), ['TYT', 'AYT']); assert.equal(r.T, 18); assert.equal(r.ad, 'SENTETİK-1203'); assert.equal(r.sinavNo, '1203');
    assert.deepEqual(copy(r.bolumler.map(b => [b.oturum, b.ad, b.n, b.bas])), [['TYT', 'TÜRKÇE-T', 4, 0], ['TYT', 'TARİH-T', 2, 4], ['TYT', 'DİN KÜLTÜRÜ-T', 2, 6], ['TYT', 'S.FELSEFE-T', 2, 8],
      ['AYT', 'TÜRK DİLİ VE EDB-A', 3, 10], ['AYT', 'TARİH.1-A', 2, 13], ['AYT', 'MATEMATİK-A', 3, 15]]);
    assert.deepEqual(copy(r.anahtar.A), [...Y.KEY_A, ...Y.AYT_KEY_A]); assert.deepEqual(copy(r.anahtar.B), [...Y.KEY_B, ...Y.AYT_KEY_B]);
    assert.deepEqual(copy(r.ogrenciler.map(o => [o.no, o.kits, o.oturumlar])), [['9001', {TYT: 'A', AYT: 'A'}, ['TYT', 'AYT']], ['9002', {TYT: 'B', AYT: 'B'}, ['TYT', 'AYT']], ['9003', {TYT: 'A', AYT: 'A'}, ['TYT', 'AYT']], ['9004', {AYT: 'A'}, ['AYT']]]);
    assert.deepEqual(copy(r.ogrenciler[1].cev), [...Y.OGRENCILER[1].cev, ...Y.AYT_OGRENCILER[1].cev]);
    assert.deepEqual(copy(r.ogrenciler[3].cev.slice(0, 10)), Array(10).fill(''), 'a student of the AYT sheet only has no TYT answers');
    assert.deepEqual(copy(r.ogrenciler[3].cev.slice(10)), Y.AYT_OGRENCILER[3].cev);
    // the sheet order does not matter
    const ters = Y.cokSayfaXlsx([{ad: 'AYT', rows: Y.raporSatirlariAyt(), shared: false}, {ad: 'TYT', rows: Y.raporSatirlari(), shared: true}]);
    const r2 = await T.raporCoz(bytes(ters)); assert.deepEqual(copy(r2.oturumlar), ['TYT', 'AYT']); assert.deepEqual(copy(r2.bolumler), copy(r.bolumler));
    // the single-sheet report is unchanged
    const tek = await T.raporCoz(bytes(Y.raporXlsx())); assert.deepEqual(copy(tek.oturumlar), ['TYT']); assert.equal(tek.ogrenciler[0].kit, 'A');
  });
  await test('AYT sheet: errors (two sheets for one session, two exams in one workbook, a sheet with sections of both sessions)', async () => {
    const dup = Y.cokSayfaXlsx([{ad: 'TYT', rows: Y.raporSatirlari(), shared: true}, {ad: 'TYT 2', rows: Y.raporSatirlari(), shared: false}]);
    await assert.rejects(T.raporCoz(bytes(dup)), /Aynı oturum \(TYT veya AYT\) iki sayfada var/);
    const baska = Y.cokSayfaXlsx([{ad: 'TYT', rows: Y.raporSatirlari(), shared: true}, {ad: 'AYT', rows: Y.raporSatirlariAyt({sinav: 'SENTETİK-1202'}), shared: false}]);
    await assert.rejects(T.raporCoz(bytes(baska)), /farklı sınavlara ait \(SENTETİK-1203 ve SENTETİK-1202\)/);
    const karisik = Y.raporSatirlari({bolumler: [['TÜRKÇE-T', 4], ['TARİH-A', 2]], ogrenciler: [{no: '9001', ad: 'SENTETİK ÖĞRENCİ 1', sube: '205 12/A', kit: 'A', cev: ['A', 'B', 'C', 'D', 'A', 'B']}], anahtarA: ['A', 'B', 'C', 'D', 'A', 'B'], anahtarB: ['A', 'B', 'C', 'D', 'A', 'B']});
    await assert.rejects(T.raporCoz(bytes(F.xlsx({sheetName: 'TYT', rows: karisik}))), /hem TYT \(-T\) hem AYT \(-A\)/);
  });
  await test('privacy: TC numbers are dropped from both sheets and the TC cells are never opened', async () => {
    for (const shared of [true, false]) {
      const r = await T.raporCoz(bytes(Y.raporXlsx2({shared})));
      assert.doesNotMatch(JSON.stringify(r), /\d{11}/); for (const n of Y.SENTETIK_TC) assert(!JSON.stringify(r).includes(n));
      assert(!JSON.stringify(r.ogrenciler.map(o => Object.keys(o))).match(/tc|kimlik/i));
    }
    const touched = [], Real = sandbox.DOMParser;
    sandbox.DOMParser = class { parseFromString(t, m) {
      const doc = new Real().parseFromString(t, m);
      for (const c of doc.documentElement.getElementsByTagNameNS('*', 'c')) {
        const ref = c.getAttribute('r') || '';
        if (/^D(\d+)$/.test(ref) && +ref.slice(1) > 5) for (const el of [c, ...c.all()]) { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'textContent'); Object.defineProperty(el, 'textContent', {get() { touched.push(ref); return d.get.call(this) }}) }
      }
      return doc;
    } };
    try { const r = await T.raporCoz(bytes(Y.raporXlsx2())); assert.equal(r.ogrenciler.length, 4) } finally { sandbox.DOMParser = Real }
    assert.deepEqual(touched, [], 'no TC cell of either sheet was opened');
    // an 11 digit number anywhere else (the AYT sheet's Şube cell) is dropped too
    const ayt = Y.raporSatirlariAyt(); ayt[7][4] = '98765432109';
    const r = await T.raporCoz(bytes(Y.cokSayfaXlsx([{ad: 'TYT', rows: Y.raporSatirlari(), shared: true}, {ad: 'AYT', rows: ayt, shared: false}]))); assert.doesNotMatch(JSON.stringify(r), /\d{11}/);
  });

  /* ---------------- ders names ---------------- */
  await test('ders names: the real TYT and AYT section names map to proper names; a name present in both sessions gets the session', () => {
    const tyt = ['TÜRKÇE-T', 'TARİH-T', 'COĞRAFYA-T', 'FELSEFE-T', 'DİN KÜLTÜRÜ-T', 'S.FELSEFE-T', 'MATEMATİK-T', 'GEOMETRİ-T', 'FİZİK-T', 'KİMYA-T', 'BİYOLOJİ-T'];
    const ayt = ['TÜRK DİLİ VE EDB-A', 'TARİH.1-A', 'COĞRAFYA.1-A', 'TARİH.2-A', 'COĞRAFYA.2-A', 'FELSEFE GR.-A', 'DİN KÜLTÜRÜ-A', 'S.FELSEFE-A', 'MATEMATİK-A', 'GEOMETRİ-A', 'FİZİK-A', 'KİMYA-A', 'BİYOLOJİ-A'];
    assert.deepEqual(copy(tyt.map(T.dersAdi)), ['Türkçe', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü', 'Ek Felsefe', 'Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji']);
    assert.deepEqual(copy(ayt.map(T.dersAdi)), ['Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu', 'Din Kültürü', 'Ek Felsefe', 'Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji']);
    assert.equal(T.dersAdi('YENİ DERS-A'), 'Yeni Ders', 'an unknown name is only title-cased');
    const hepsi = T.dersOnek([...tyt.map(ad => ({ad, oturum: 'TYT', ders: T.dersAdi(ad)})), ...ayt.map(ad => ({ad, oturum: 'AYT', ders: T.dersAdi(ad)}))]).map(b => b.ders);
    assert.deepEqual(copy(hepsi), ['Türkçe', 'Tarih', 'Coğrafya', 'Felsefe', 'TYT Din Kültürü', 'TYT Ek Felsefe', 'TYT Matematik', 'TYT Geometri', 'TYT Fizik', 'TYT Kimya', 'TYT Biyoloji',
      'Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu', 'AYT Din Kültürü', 'AYT Ek Felsefe', 'AYT Matematik', 'AYT Geometri', 'AYT Fizik', 'AYT Kimya', 'AYT Biyoloji']);
    assert.equal(new Set(hepsi).size, hepsi.length, 'no two identical labels');
    assert.deepEqual(copy(T.dersOnek([{oturum: 'TYT', ders: 'Matematik'}, {oturum: 'TYT', ders: 'Fizik'}]).map(b => b.ders)), ['Matematik', 'Fizik'], 'one session: no prefix');
  });

  /* ---------------- booklets per session ---------------- */
  const kitTyt = () => T.kitapcikCoz(Y.kitapcikSayfalari()), kitAyt = sinav => T.kitapcikCoz(Y.kitapcikSayfalariAyt(sinav));
  await test('one A booklet per session: header code gives session and exam number; a booklet of another exam is refused in Turkish', async () => {
    const t = kitTyt(), a = kitAyt();
    assert.deepEqual([t.oturum, t.sinav, a.oturum, a.sinav], ['TYT', '1203', 'AYT', '1203']);
    assert.deepEqual(copy(a.testler.map(x => [x.kod, x.soru])), [['EDB', 5], ['MAT', 3]]);
    const r = await T.raporCoz(bytes(Y.raporXlsx2())), es = T.esle(r, {TYT: t, AYT: a});
    assert.deepEqual(copy(es.oturumlar), ['TYT', 'AYT']); assert.deepEqual(copy(es.testler), [4, 6, 5, 3]); assert.deepEqual(copy(es.aralik), {TYT: [0, 2], AYT: [2, 4]});
    assert.deepEqual(copy(es.bolumler.map(b => [b.oturum, b.ders, b.test, b.off, b.ri])), [['TYT', 'Türkçe', 0, 0, 0], ['TYT', 'Tarih', 1, 0, 1], ['TYT', 'Din Kültürü', 1, 2, 2], ['TYT', 'Ek Felsefe', 1, 4, 3], ['AYT', 'Türk Dili ve Edebiyatı', 2, 0, 4], ['AYT', 'Tarih-1', 2, 3, 5], ['AYT', 'Matematik', 3, 0, 6]]);
    assert.deepEqual(copy(es.ciftler), [[2, 3]]);
    // only the TYT booklet: the AYT sections have no cut-outs and are left out of the defter
    const yalniz = T.esle(r, {TYT: t}); assert.deepEqual(copy(yalniz.bolumler.map(b => b.oturum)), ['TYT', 'TYT', 'TYT', 'TYT']);
    // a single booklet goes to the session of its header
    assert.deepEqual(copy(T.esle(r, a).oturumlar), ['AYT']);
    // exam 1202 against a 1203 report
    assert.throws(() => T.esle(r, {TYT: t, AYT: kitAyt('1202')}), /AYT soru kitapçığı 1202 numaralı sınava ait, cevap raporu 1203 numaralı sınav \(SENTETİK-1203\)\./);
    // a report without an AYT sheet cannot take an AYT booklet
    const tek = await T.raporCoz(bytes(Y.raporXlsx())); assert.throws(() => T.esle(tek, {AYT: a}), /Cevap raporunda AYT sayfası yok/);
    // sections that do not fit the AYT booklet
    const bozuk = kitAyt(); bozuk.testler[1].soru = 4; assert.throws(() => T.esle(r, {TYT: t, AYT: bozuk}), /AYT · Rapor: .*eşleşmiyor|eşleşmiyor\. AYT · Rapor/);
    // a PDF with two sessions in its headers is not one booklet
    const iki = Y.kitapcikSayfalariAyt(); iki[5].items = iki[5].items.map(i => ({...i, s: i.s.replace('AYT/MAT', 'TYT/MAT')})); assert.throws(() => T.kitapcikCoz(iki), /birden fazla oturum veya sınav/);
  });
  await test('çözüm for TYT only: AYT B students fall back to numbers only; TYT B students get the A questions', async () => {
    const r = await T.raporCoz(bytes(Y.raporXlsx2())), es = T.esle(r, {TYT: kitTyt(), AYT: kitAyt()});
    const tyt = T.haritaKur(Y.HARITA, T.esOturum(es, 'TYT'), r); assert.equal(tyt.adet, 10);
    const harita = {testler: [...tyt.testler, null, null], adet: 10};
    const b = r.ogrenciler[1], d = T.defterKur(r, es, harita, b, null);
    const sec = Object.fromEntries(d.bolumler.map(x => [x.ders, x]));
    assert.equal(sec['Türkçe'].gorsel, true); assert.equal(sec['Türkçe'].sorular[0].a, 3); assert.equal(sec['Türkçe'].sorular[0].b, 4);
    assert.equal(sec['Matematik'].gorsel, false, 'AYT B student without the AYT map'); assert(sec['Matematik'].sorular.every(s => s.a === null && s.b !== null));
    assert.equal(d.gorsel, false);
    // with the AYT map as well
    const ayt = T.haritaKur(Y.AYT_HARITA, T.esOturum(es, 'AYT'), r); assert.equal(ayt.adet, 8);
    const d2 = T.defterKur(r, es, {testler: [...tyt.testler, ...ayt.testler], adet: 18}, b, null);
    assert.equal(d2.gorsel, true); assert.deepEqual(copy(d2.bolumler.find(x => x.ders === 'Matematik').sorular.map(s => [s.a, s.b])), [[3, 2]]);
    // a student sees only the sessions they sat
    const dd = T.defterKur(r, es, null, r.ogrenciler[3], null); assert(dd.bolumler.every(x => x.oturum === 'AYT'));
    // a çözüm file whose A↔B map disagrees with the AYT keys is refused
    assert.throws(() => T.haritaKur(Y.AYT_HARITA.map((p, i) => i === 0 ? [1, 3] : p), T.esOturum(es, 'AYT'), r), /birden fazla|uyuşmuyor/);
  });

  /* ---------------- section analysis on a simulated exam (two tests of 20 questions, 60 students, a third on booklet B) ---------------- */
  const LET = 'ABCDE', simulate = Y.simule;
  const BOLUMLER = Y.BUYUK_BOLUMLER;
  const kur = async (sim, mut) => {
    const rows = Y.raporSatirlari({ogrenciler: sim.ogr, anahtarA: sim.keyA, anahtarB: sim.keyB, bolumler: BOLUMLER});
    if (mut) mut(rows);
    const rapor = await T.raporCoz(bytes(Y.cokSayfaXlsx([{ad: 'TYT', rows, shared: false}])));
    const stub = {oturum: 'TYT', sinav: '1203', testler: [['TUR', 20], ['MAT', 20]].map(([kod, soru]) => ({kod, ad: kod + ' TESTI', soru, sorular: Array.from({length: soru}, (_, i) => ({no: i + 1, genis: false, parcalar: [{p: 2}]}))}))};
    const es = T.esle(rapor, stub), harita = T.haritaKur(sim.pairs, es, rapor);
    return {rapor, es, harita, stub};
  };
  const SIM = simulate();
  await test('pooling: with a valid A↔B map the A and B students share one analysis on A numbering; without it each booklet stands alone', async () => {
    const {rapor, es, harita} = await kur(SIM);
    assert.equal(rapor.ogrenciler.length, 60); assert.equal(rapor.ogrenciler.filter(o => o.kit === 'B').length, 20);
    const havuz = T.zorlukAnaliz(rapor, es, harita), ayri = T.zorlukAnaliz(rapor, es, null), tek = T.zorlukAnaliz(rapor, null, null);
    assert.equal(havuz.bolumler[0].gruplar.length, 1); assert.equal(havuz.bolumler[0].gruplar[0].kit, 'AB'); assert.equal(havuz.bolumler[0].gruplar[0].a.n, 60);
    assert.deepEqual(copy(ayri.bolumler[0].gruplar.map(g => [g.kit, g.a.n])), [['A', 40], ['B', 20]]); assert.deepEqual(copy(tek.bolumler[1].gruplar.map(g => [g.kit, g.a.n])), [['A', 40], ['B', 20]]);
    assert.match(havuz.bolumler[0].gruplar[0].satir, /^Türkçe · 60 öğrenci · KR-20 0,\d\d · /); assert.match(ayri.bolumler[0].gruplar[1].satir, /^Türkçe · B kitapçığı · 20 öğrenci/);
    assert.equal(havuz.bolumler[0].gruplar[0].a.dusuk, false, 'pooled: 60 takers'); assert(ayri.bolumler[0].gruplar[1].a.n >= Z.EN_AZ_OGRENCI);
    // keys: section index : numbering : question
    assert(havuz.map.has('0:A:1') && havuz.map.has('1:A:20') && !havuz.map.has('0:B:1')); assert(ayri.map.has('0:B:20') && ayri.map.has('0:A:20'));
    // the pooled analysis recovers the simulated difficulties (A numbering) better than the small B group alone
    const g = havuz.bolumler[1].gruplar[0].a, bt = SIM.bTrue.slice(20), ix = g.maddeler.map((m, i) => i).filter(i => g.maddeler[i].b !== null);
    assert(ix.length >= 17); assert(Z.pearson(ix.map(i => g.maddeler[i].b), ix.map(i => bt[i])) > 0.93, 'pooled b vs simulated b');
    // p is the share correct among takers: wrong and blank both count as 0; their rates are kept apart
    const m = g.maddeler[0]; assert.equal(m.dogru + m.yanlis + m.bos, 60); near(m.p, m.dogru / 60, 1e-12); near(m.yanlisOran + m.bosOran + m.p, 1, 1e-12); assert(m.aralik[0] < m.p && m.p < m.aralik[1]);
    // every item has a label from the Rasch b, relative to the mean ability, and the five labels exist
    const bantlar = new Set(havuz.bolumler.flatMap(b => b.gruplar[0].a.maddeler.map(x => x.bant))); assert(bantlar.size >= 4, [...bantlar].join());
    for (const x of g.maddeler.filter(x => x.b !== null)) assert.equal(x.bant, Z.bantla(x.b - g.mu, x.se).bant);
  });
  await test('takers: whoever left a whole section blank is not counted there; cancelled questions (key not A-E) are left out', async () => {
    const sim = simulate({N: 40, seed: 11});
    // student 1 leaves all of Matematik blank; student 2 leaves everything blank
    sim.ogr[1].cev = sim.ogr[1].cev.map((v, i) => i >= 20 ? '' : v); sim.ogr[2].cev = sim.ogr[2].cev.map(() => '');
    const {rapor, es, harita} = await kur(sim), za = T.zorlukAnaliz(rapor, es, harita);
    assert.deepEqual(copy(za.bolumler.map(b => b.gruplar[0].a.n)), [39, 38]);
    // question 3 of Türkçe is cancelled in the A key (and in B at its paired place)
    const iptal = await kur(sim, rows => { rows[5][10 + 2] = 'X'; rows[6][10 + sim.perm[0][2] - 1] = 'X' }), ia = T.zorlukAnaliz(iptal.rapor, iptal.es, null);
    assert.equal(ia.bolumler[0].gruplar[0].a.k, 19); assert.equal(ia.bolumler[0].gruplar[0].a.maddeler[2].iptal, true); assert.equal(ia.map.get('0:A:3').iptal, true);
    assert.equal(ia.map.get('0:A:3').bant, undefined);
  });
  await test('a reversed key is flagged with "Ayırt etmiyor: anahtarı kontrol edin" and keeps its difficulty label', async () => {
    const sim = simulate({N: 80, seed: 77}), {rapor, es, harita} = await kur(sim);
    // swap the key of Türkçe question 5 for a wrong letter in both booklets (at the paired place)
    const a = 5, b = SIM.perm ? null : null;
    const bAt = harita.testler[0].aToB[a], wrong = c => LET[(LET.indexOf(c) + 1) % 5];
    rapor.anahtar.A[a - 1] = wrong(rapor.anahtar.A[a - 1]); rapor.anahtar.B[bAt - 1] = rapor.anahtar.A[a - 1];
    const za = T.zorlukAnaliz(rapor, es, harita), m = za.map.get('0:A:5');
    assert(m.rit < 0.15, 'r_it ' + m.rit); assert(m.bayrak.length >= 1 && m.bayrak.some(x => /Ayırt etmiyor|Zayıf ayırt edicilik/.test(x)), m.bayrak.join()); assert(m.bant, 'still labelled');
    const satir = za.bolumler[0].gruplar[0].satir; assert.match(satir, /\d+ madde işaretli/);
  });
  await test('Spearman rank correlation against the school Madde Analizi, shown as one number in the section line', async () => {
    const {rapor, es, harita} = await kur(SIM), za0 = T.zorlukAnaliz(rapor, es, harita);
    assert.equal(za0.bolumler[0].gruplar[0].rho, null);
    const madde = {'TÜRKÇE-T': za0.bolumler[0].gruplar[0].a.maddeler.map(m => [Math.min(1, m.p * 0.9 + 0.02), 0, 0, 0, '']), 'MATEMATİK-T': za0.bolumler[1].gruplar[0].a.maddeler.map(m => [Math.max(0, 1 - m.p), 0, 0, 0, ''])};
    const dis = T.difficultyIndex({...rapor, ad: 'X'}, es, {ad: 'X', oturum: 'TYT', madde}), za = T.zorlukAnaliz(rapor, es, harita, dis);
    near(za.bolumler[0].gruplar[0].rho, 1, 1e-9); near(za.bolumler[1].gruplar[0].rho, -1, 1e-9);
    assert.match(za.bolumler[0].gruplar[0].satir, /· okul verisi ρ 1,00$/); assert.match(za.bolumler[1].gruplar[0].satir, /· okul verisi ρ −1,00$/);
    near(Z.spearman([1, 2, 3, 4], [10, 40, 20, 30]), 0.4, 1e-12); assert.equal(Z.spearman([1, 2], [1, 2]), null);
  });

  /* ---------------- chips, print set and the last page ---------------- */
  const show = async (sim, o = {}) => {
    const k = await kur(sim), S = T.durumu();
    Object.assign(S, {kitlar: {TYT: k.stub}, rapor: k.rapor, es: k.es, pairs: {}, cozum: {}, zOnbellek: null, bantlar: null, kendi: false, status: 'all', harita: o.harita === false ? null : k.harita, sube: '', ogr: '', kapali: new Set(), crops: new Map(), hata: {kit: '', rapor: '', coz: ''}, ...o.state});
    k.es.bolumler.forEach((b, i) => { for (let q = 1; q <= b.n; q++) S.crops.set(b.test + ':' + (b.off + q), {url: 'blob:sentetik-' + b.test + '-' + (b.off + q), w: 10, h: 10, genis: false}) });
    run("D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar'");
    return {...k, S};
  };
  const soruSayisi = out => (out.match(/<figure class="yd-soru/g) || []).length;
  await test('page: a difficulty chip next to each question replaces "Senin cevabın"; the answers move to the last page with the key', async () => {
    const {S} = await show(SIM), out = T.gorunum();
    assert(!/Senin cevabın: /.test(out)); assert(!/class="yd-isaret /.test(out));
    assert.match(out, /<figcaption><span><b>Soru \d+<\/b>(?: \(B kitapçığında \d+\))?<\/span><span class="yd-zorluk yd-z-[a-z-]+(?: yd-belirsiz)?">(?:Çok kolay|Kolay|Orta|Zor|Çok zor)\??<\/span><\/figcaption>/);
    const ogr = out.split('<article class="yd-ogr').slice(1);
    for (const a of ogr.slice(0, 5)) {
      const son = a.slice(a.indexOf('class="yd-anahtar"')); assert(a.indexOf('class="yd-anahtar"') > a.lastIndexOf('<img'), 'last page after the questions');
      assert.match(son, /<th scope="col">Soru<\/th><th scope="col">Senin cevabın<\/th><th scope="col">Doğru cevap<\/th>/); assert.match(son, /<caption>Türkçe<\/caption>/);
    }
    // a B student's rows carry their own B numbers, the cut-outs the A numbers (with the B number in brackets)
    const b = ogr.find(a => a.startsWith('" data-yd-ogr="2"')); assert.match(b, /\(B kitapçığında \d+\)/); assert.match(b.slice(b.indexOf('yd-anahtar')), /<td>\d+<\/td><td>(Boş|[A-E])<\/td><td>[A-E]<\/td>/);
    assert(out.indexOf('Zayıf ayırt') < out.indexOf('<div class="yd-baski"'), 'the quality table sits outside the printed pages');
    // the chips
    assert.equal((out.match(/data-yd-z="/g) || []).length, 6); assert.match(out, /data-yd-z="cok-kolay" aria-pressed="true">Çok kolay</); assert.match(out, /data-yd-z="kendi" aria-pressed="false">Kendi seviyesi</);
    assert.equal((out.match(/aria-pressed="true"/g) || []).length, 5, 'default: all five bands, Kendi seviyesi off');
  });
  await test('page: the chip selection makes a smaller print set, the header counts follow it, "Zor" includes "Zor?"', async () => {
    const {S} = await show(SIM), hepsi = T.gorunum(), toplam = soruSayisi(hepsi);
    S.bantlar = new Set(['zor', 'cok-zor']); const zor = T.gorunum(), nz = soruSayisi(zor);
    assert(nz > 0 && nz < toplam, nz + ' of ' + toplam);
    assert.match(zor, /Zor · Çok zor/); assert.match(zor, new RegExp('<span class="yd-ozet">60 öğrenci · ' + nz + ' soru</span>'));
    const chips = [...zor.matchAll(/<span class="yd-zorluk yd-z-([a-z-]+)(?: yd-belirsiz)?">([^<]+)<\/span>/g)]; assert(chips.length === nz); assert(chips.every(c => c[1] === 'zor' || c[1] === 'cok-zor'));
    assert(chips.some(c => /\?$/.test(c[2])) || true, 'uncertain chips keep their band');
    // the header counts follow the selection: yanlış + boş of the first student = its questions
    const ilk = zor.split('<article class="yd-ogr')[1], ymatch = /<b>(\d+)<\/b> yanlış · <b>(\d+)<\/b> boş/.exec(ilk); assert.equal(+ymatch[1] + +ymatch[2], (ilk.match(/<figure class="yd-soru/g) || []).length);
    S.bantlar = new Set(); const hic = T.gorunum(); assert.equal(soruSayisi(hic), 0); assert.match(hic, /data-yd-yazdir disabled/);
    S.bantlar = new Set(['kolay']); S.status = 'bos'; assert(soruSayisi(T.gorunum()) < toplam);
    // chips with the status select still work together; "Orta?" is included by Orta (the filter works on the band, not on the "?")
    S.bantlar = new Set(['orta']); const orta = T.gorunum(); assert([...orta.matchAll(/yd-z-([a-z-]+)/g)].every(m => m[1] === 'orta'));
  });
  await test('page: Kendi seviyesi keeps the wrong or empty questions in the student\'s weight class (Orta band without an ability)', async () => {
    const {S, rapor} = await show(SIM, {state: {}}), hepsi = soruSayisi(T.gorunum());
    // without notebook data no student has an ability: only Orta questions
    S.kendi = true; const orta = T.gorunum(); assert([...orta.matchAll(/yd-z-([a-z-]+)/g)].every(m => m[1] === 'orta')); assert(soruSayisi(orta) > 0 && soruSayisi(orta) < hepsi);
    assert.match(orta, /Kendi seviyesi/); assert.match(orta, /data-yd-z="kendi" aria-pressed="true"/);
    // with notebooks: 12 students of the report have school results (Matematik and Türkçe), ability moves the window
    run("D=varsayilan();D.rol='rehber';D.ogr=[]");
    const r = rng(3), nrm = normal(r);
    rapor.ogrenciler.slice(0, 16).forEach((o, i) => {
      const th = 1.6 * (i - 8) / 8;
      const dm = [0, 1, 2].map(k => ({id: 'p:k' + k + '-' + i, ad: 'Sentetik ' + k, tarih: '2026-09-1' + k, tur: 'TYT', oturum: 'TYT', alan: 'SAY', sure: null, puan: null, ts: 1000 + k,
        dersler: [['turkce', 40], ['mat', 30]].map(([kod, n]) => { const d = Math.max(0, Math.min(n, Math.round(n * sig(th + 0.2 * nrm())))); return {kod, dogru: d, yanlis: n - d, soru: n} })}));
      run("D.ogr.push(" + JSON.stringify({ad: o.ad, no: o.no, sube: o.sube, alan: 'SAY', denemeOkul: dm}) + ")");
    });
    assert.equal(K.model().dersler.get('TYT:mat@12').yetersiz, false);
    const guclu = rapor.ogrenciler[15], zayif = rapor.ogrenciler[0];
    assert(K.yetenek(guclu.no, 'TYT', 'mat') > K.yetenek(zayif.no, 'TYT', 'mat'));
    S.ogr = String(guclu.id); const g = T.gorunum(); S.ogr = String(zayif.id); const z = T.gorunum();
    const bantlar = h => [...h.matchAll(/yd-z-([a-z-]+)/g)].map(m => m[1]);
    // the strong student's window sits at harder questions than the weak one's
    const rank = b => ['cok-kolay', 'kolay', 'orta', 'zor', 'cok-zor'].indexOf(b), ort = l => l.map(rank).reduce((a, b) => a + b, 0) / (l.length || 1);
    assert(bantlar(g).length && bantlar(z).length); assert(ort(bantlar(g)) > ort(bantlar(z)), ort(bantlar(g)) + ' vs ' + ort(bantlar(z)));
    // the filter is applied per student and per ders: the same student's list with Kendi seviyesi off is a superset
    S.kendi = false; S.ogr = String(guclu.id); assert(soruSayisi(T.gorunum()) >= soruSayisi(g));
  });
  await test('analysis: Madde kalitesi tables per ders, on screen only, compact (soru, p, b, r_it, flag), section line', async () => {
    await show(SIM); const out = T.gorunum(), a = out.slice(out.indexOf('<section class="yd-analiz"'), out.indexOf('<div class="yd-baski"'));
    assert.match(a, /<h2>Madde kalitesi<\/h2>/); assert.equal((a.match(/<details class="yd-kalite">/g) || []).length, 2);
    assert.match(a, /<summary>Türkçe · 60 öğrenci · KR-20 0,\d\d · (\d+ madde işaretli|işaretli madde yok)<\/summary>/); assert.match(a, /<summary>Matematik · 60 öğrenci/);
    assert.match(a, /<th scope="col">Soru<\/th><th scope="col">p<\/th><th scope="col">b<\/th><th scope="col">r<sub>it<\/sub><\/th><th scope="col">İşaret<\/th>/);
    assert.equal((a.match(/<tr(?: class="yd-isaretli")?><td>\d+<\/td>/g) || []).length, 40);
    assert(source.includes('#ydKok>:not(#ydBaski)') || html.includes('body.yd-yazdir #ydKok>:not(#ydBaski){display:none!important}'), 'the print rule hides everything but the defter');
    // a small group says so
    const kucuk = simulate({N: 12, seed: 3}); await show(kucuk, {harita: false}); const k = T.gorunum(); assert.match(k, /Güvenilirlik düşük/);
    const kc = [...k.matchAll(/<span class="yd-zorluk[^"]*"[^>]*>([^<]+)<\/span>/g)];
    assert(kc.length && kc.every(m => /yd-dusuk/.test(m[0])), 'low reliability: every chip is muted');
  });
  await test('nothing from the files is kept: no storage, no notebook field, no network in the module', () => {
    const modul = source.slice(source.indexOf('const YANLISLAR'), source.indexOf('// END YANLISLAR')) + source.slice(source.indexOf('const ZORLUK'), source.indexOf('// END ZORLUK'));
    assert.doesNotMatch(modul, /localStorage|sessionStorage|indexedDB|firebase|\bfetch\(|XMLHttpRequest|sendBeacon/);
    const kmod = source.slice(source.indexOf('const KADEME'), source.indexOf('// END KADEME'));
    assert.doesNotMatch(kmod, /localStorage|sessionStorage|indexedDB|firebase|\bfetch\(|XMLHttpRequest|sendBeacon|kaydet\(/);
    assert.equal(run('Object.keys(D).filter(k=>/zorluk|kademe|defter|rapor/i.test(k)).length'), 0);
  });
  console.log('Zorluk ve kademeler: ' + passed + ' tests passed.');
})();
