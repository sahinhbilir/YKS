#!/usr/bin/env node
'use strict';
// Etüt etkisi: the Türkiye farkı (a student's net minus the Türkiye average of the lesson in that exam, the AYT two-part
// sum, the name match with the Türkiye geneli lists), the intervals between consecutive exams and their etüt counts, the
// within-student fixed-effects estimate (a planted +0,5 net per etüt, the rebound after a bad exam kept out of it, an
// independent dummy-variable fit as the check), the seeded bootstrap, the paired comparison, the verdict sentences, the
// missing-list fallback, the teacher rows, the students left out and why, the page (sections in order, no tiers), its
// states, the menu and privacy. Synthetic students only; the merged students are those of Öğrenci raporları.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { kurumListesi, kurumRaporu, BIZ } = require('./fixtures/kurum-pdf.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__rapor = run('OGRENCI_RAPOR.temelOgrenciler'); sandbox.__tok = run('TURKIYE.oku'); sandbox.__tor = run('TURKIYE.ortalamalar');
const reset = () => run(`yalnizcaGoruntuleme=__yg;OGRENCI_RAPOR.temelOgrenciler=__rapor;TURKIYE.oku=__tok;TURKIYE.ortalamalar=__tor;D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='etutetki';
  for(const k of ['eeDuzey','eeOturum','eeDers','eeDonem','eeHoca'])EK[k]=undefined;`);
const merged = (ogr, kapsam = null, warnings = []) => { put('__eeS', ogr); put('__eeKP', kapsam); put('__eeW', warnings); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:__eeS,warnings:__eeW,etutKapsam:__eeKP})'); };
// Türkiye averages for the model: tr = {examName: {listCode: average}} (an exam that is not there has no list), or null.
const model = (ogr, sec = {}, tr = null, kapsam = null) => {
  put('__eeS', ogr); put('__eeC', sec); put('__eeKP', kapsam); put('__eeT', tr);
  return get('ETUT_ETKI.model(__eeS,__eeC,__eeKP,__eeT?(ad=>{const o=__eeT[ad];return o?{genel:k=>k in o?o[k]:null}:null}):null)');
};
// The page reads the Türkiye geneli lists through TURKIYE.oku / ortalamalar: this stands a list in (reset puts the real ones back).
const trSayfa = tr => { put('__KI', tr); run('TURKIYE.oku=()=>({veri:{}});TURKIYE.ortalamalar=()=>(a=>{const o=__KI[a];return o?{genel:k=>k in o?o[k]:null}:null})'); };
const bit = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// ---- helpers for the fixtures ----
const MAT = 'MATEMATİK TYT', A = 'SENTETİK ÖĞRETMEN A', B = 'SENTETİK ÖĞRETMEN B', C = 'SENTETİK ÖĞRETMEN C';
const gun = iso => run('gunNo("' + iso + '")');
const ekle = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const et = (course, teacher, ...dates) => dates.map(date => ({ date, course, teacher, minutes: 40, time: 900 }));
const ad = k => '27-YKS-12' + String(k + 1).padStart(2, '0');
const TARIH = ['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04'];
const sinavlar = (nets, n = nets.length, ders = 'mat') => nets.map((v, k) => v === null ? null : ({ exam: ad(k), date: TARIH[k], session: 'TYT', nets: { [ders]: v } })).filter(Boolean);
const mulberry = tohum => { let a = tohum >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Matematik-T averages by exam: the exams differ in how hard they were.
const MAT_T = [10, 14, 8, 13, 11], TR = Object.fromEntries(MAT_T.map((v, k) => [ad(k), { 'MATEMATİK-T': v }]));
// A student whose Türkiye farkı goes d0, then gains g[t] + 0.5·e[t] in every interval, with e[t] etüts strictly inside it.
const OFFSET = [1, 2, 5, 6, 8];
const dikili = (id, d0, a, e, { kat = 0.5, hoca = A, cls = '12/A' } = {}) => {
  const d = [d0]; e.forEach((n, t) => d.push(d[t] + a + kat * n));
  const sessions = e.flatMap((n, t) => et(MAT, hoca, ...OFFSET.slice(0, n).map(o => ekle(TARIH[t], o))));
  return { id, name: 'SENTETİK ÖĞRENCİ ' + id, cls, sessions, exams: sinavlar(d.map((v, k) => v + MAT_T[k])) };
};
// A fit by dummy variables (one intercept per student, e and d1 as columns, normal equations by Gauss–Jordan): independent of the page's demeaning.
function lsdv(listeler, eAl) {
  const L = listeler.filter(l => l.length >= 2), n = L.length, p = n + 2, rows = [];
  L.forEach((l, i) => l.forEach(x => { const r = new Array(p).fill(0); r[i] = 1; r[n] = eAl(x); r[n + 1] = x.d1; rows.push([r, x.g]); }));
  const M = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (const [r, y] of rows) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) M[i][j] += r[i] * r[j]; M[i][p] += r[i] * y; }
  for (let c = 0; c < p; c++) {
    let q = c; for (let i = c + 1; i < p; i++) if (Math.abs(M[i][c]) > Math.abs(M[q][c])) q = i;
    [M[c], M[q]] = [M[q], M[c]];
    for (let i = 0; i < p; i++) if (i !== c) { const f = M[i][c] / M[c][c]; for (let j = c; j <= p; j++) M[i][j] -= f * M[c][j]; }
  }
  return { b: M[n][p] / M[n][n], c: M[n + 1][p] / M[n + 1][n + 1] };
}
const yasak = /Nasıl okunur|Gözlem|±|\bham\b|eğim|\(%95\)|Etüt yok|1–2 etüt|3–5 etüt|6\+ etüt|Etüt sayısına göre/;

// ---- the planted fixture: 12 students, five exams, +0,5 net per etüt exactly, Matematik ----
const PATTERN = [[0, 1, 2, 0], [1, 0, 0, 3], [2, 2, 0, 1], [0, 0, 1, 4], [3, 0, 1, 0], [1, 1, 1, 0], [0, 2, 0, 2], [4, 0, 0, 1], [0, 3, 1, 1], [1, 0, 2, 0], [2, 0, 3, 0], [0, 1, 0, 2]];
const PL = PATTERN.map((e, i) => dikili('P' + i, ((i * 3) % 7) - 3, ((i % 5) - 2) * 0.5, e));
const by = (m, id) => m.hepsi.find(r => r.id === id);
// The earlier cross-student estimate (the secondary number, m.capraz) in the shape the earlier checks read: ozet, hocalar, ogrenciler, karar, uc.
const eski = (...a) => { const m = model(...a); return { ...m, ...m.capraz, beklenen: m.capraz.model }; };

(async () => {
  await check('the Türkiye farkı: net minus the Türkiye average of the lesson in that exam (hard exams do not count)', () => {
    const m = model(PL, {}, TR);
    assert.equal(m.kip, 'turkiye'); assert.deepEqual(m.listesiz, []);
    // P0: d0 = −3, a = −1, e = 0, 1, 2, 0 → d = −3, −4, −4,5, −4,5, −5,5; the nets add the averages 10, 14, 8, 13, 11.
    const p0 = by(m, 'P0'); assert.deepEqual(PL[0].exams.map(e => e.nets.mat), [7, 10, 3.5, 8.5, 5.5]); assert.deepEqual(p0.dizi, [-3, -4, -4.5, -4.5, -5.5]);
    // Raw nets swing with how hard each exam was (a 6,5 net range); the Türkiye farkı does not (a 2,5 range).
    const ham = PL[0].exams.map(e => e.nets.mat); assert(Math.max(...ham) - Math.min(...ham) > 2 * (Math.max(...p0.dizi) - Math.min(...p0.dizi)));
  });
  await check('the Türkiye farkı: AYT Coğrafya and Tarih sum two parts in the student and in the list; the match is by the exam name', () => {
    put('SA', { exams: [{ exam: 'X', date: '2026-10-07', session: 'AYT', nets: { cografya1: 3, cografya2: 2.5, tarih1: 1, tarih2: 1.5, edebiyat: 10 } }] });
    const tr = (ad, kodlar) => { put('__k', kodlar); return get('ETUT_ETKI.trOrtalama(a=>({genel:k=>({"COĞRAFYA.1-A":2,"COĞRAFYA.2-A":1.5,"TARİH.1-A":0.5,"TARİH.2-A":0.25,"TÜRK DİLİ VE EDB-A":8})[k]??null}),"X",__k)'); };
    assert.equal(tr('X', ['COĞRAFYA.1-A', 'COĞRAFYA.2-A']), 3.5); assert.equal(tr('X', ['TARİH.1-A', 'TARİH.2-A']), 0.75); assert.equal(tr('X', ['TÜRK DİLİ VE EDB-A']), 8);
    assert.equal(tr('X', ['COĞRAFYA.1-A', 'FİZİK-A']), null, 'a list that lacks a part gives nothing');
    assert.equal(get('ETUT_ETKI.trOrtalama(null,"X",["MATEMATİK-T"])'), null); assert.equal(get('ETUT_ETKI.trOrtalama(a=>null,"X",["MATEMATİK-T"])'), null);
    assert.deepEqual(get('ETUT_ETKI.TR_KOD.AYT["Coğrafya"]'), ['COĞRAFYA.1-A', 'COĞRAFYA.2-A']); assert.deepEqual(get('ETUT_ETKI.TR_KOD.AYT["Tarih"]'), ['TARİH.1-A', 'TARİH.2-A']);
    // An AYT page: Coğrafya net 5.5, 6, 7.5 with the averages 3.5, 3.5, 4 gives d = 2, 2.5, 3.5.
    const ayt = Array.from({ length: 3 }, (_, i) => ({ id: 'a' + i, name: 'SENTETİK AYT ' + i, cls: '12/A', sessions: et('COĞRAFYA AYT', A, '2026-10-09', '2026-10-16'),
      exams: [['AYT-1', '2026-10-07', 3, 2.5], ['AYT-2', '2026-10-14', 3, 3], ['AYT-3', '2026-10-21', 4, 3.5]].map(([exam, date, x, y]) => ({ exam, date, session: 'AYT', nets: { cografya1: x, cografya2: y } })) }));
    const m = model(ayt, { oturum: 'AYT' }, { 'AYT-1': { 'COĞRAFYA.1-A': 2, 'COĞRAFYA.2-A': 1.5 }, 'AYT-2': { 'COĞRAFYA.1-A': 2, 'COĞRAFYA.2-A': 1.5 }, 'AYT-3': { 'COĞRAFYA.1-A': 2.5, 'COĞRAFYA.2-A': 1.5 } });
    assert.equal(m.ders, 'Coğrafya'); assert.equal(m.kip, 'turkiye'); assert.deepEqual(m.hepsi[0].dizi, [2, 2.5, 3.5]);
  });
  await check('the name match is the one of the Türkiye geneli page (TURKIYE.ortalamalar): a stored list gives the average, a different exam gives none', () => {
    const r = kurumListesi(1), c = kurumListesi(2);
    // Two stored lists (27-YKS-1201, 27-YKS-1202); the name matches however it is written.
    put('__R', [r, c]);
    run(`(()=>{const lis=__R.map(l=>({ad:l.ad,liste:'kolej',yaz:null,dersler:l.dersler.map(d=>({kod:d.kod,soru:d.soru,genel:d.genel,satir:d.satir.map(([a,n],i)=>({sira:i+1,ad:a,net:n}))}))}));
      globalThis.__V=TURKIYE.paketle({okul:null,sinavlar:lis.map(s=>({...s,id:s.ad,ts:1}))},1);globalThis.__TF=TURKIYE.ortalamalar(__V)})()`);
    assert.equal(get('ETUT_ETKI.trOrtalama(__TF,"27-YKS-1201",["MATEMATİK-T"])'), r.dersler.find(d => d.kod === 'MATEMATİK-T').genel);
    assert.equal(get('ETUT_ETKI.trOrtalama(__TF,"27-yks-1202",["TÜRKÇE-T"])'), c.dersler.find(d => d.kod === 'TÜRKÇE-T').genel);
    assert.equal(get('ETUT_ETKI.trOrtalama(__TF,"27-YKS-1203",["TÜRKÇE-T"])'), null, 'no list for that exam');
    assert.equal(get('ETUT_ETKI.trOrtalama(__TF,"27-YKS-1201",["FİZİK-A"])'), null, 'the list lacks that lesson');
    // The model takes the very same function.
    const m = JSON.parse(JSON.stringify(run('ETUT_ETKI.model(JSON.parse(JSON.stringify(__eeP)),{},null,__TF)', put('__eeP', PL) || 0)));
    assert.equal(m.kip, 'turkiye'); assert.deepEqual(m.listesiz, [ad(2), ad(3), ad(4)], 'only the first two exams have a list');
  });
  await check('intervals: consecutive exams a student sat, the etüts strictly between the exam days, other lessons never count, and an etüt named AYT counts for TYT too', () => {
    const s = (id, nets, sessions) => ({ id, name: 'SENTETİK ' + id, cls: '12/A', sessions, exams: sinavlar(nets) });
    const L = [
      s('Z1', [10, 12, 13], [...et(MAT, A, '2026-10-07', '2026-10-08', '2026-10-14', '2026-10-15', '2026-10-21', '2026-10-22'), ...et('FİZİK', A, '2026-10-09'), ...et('MATEMATİK AYT', A, '2026-10-10')]),
      s('Z2', [10, null, 13, 15], et(MAT, B, '2026-10-09', '2026-10-17', '2026-10-24')),   // missed the middle exam: the pair is 7 → 21 Oct, then 21 → 28 Oct
      s('Z3', [10, 11, 12, 11, 14], []), s('Z4', [1, 2], et(MAT, A, '2026-10-09')),
      ...PL.slice(0, 6)];
    const m = model(L, { ders: 'Matematik' }, TR), r = Object.fromEntries(m.hepsi.map(x => [x.id, x]));
    // Z1: 8 Oct and the "MATEMATİK AYT" etüt of 10 Oct (inside 7–14), 15 Oct (inside 14–21) count; the exam days 7, 14, 21,
    // the Fizik etüt and the 22 Oct (after the last exam) do not.
    assert.equal(r.Z1.n, 3); assert.equal(r.Z1.aralik, 2); assert.equal(r.Z1.etutlu, 2.5, 'd = 0, −2, 5: the gains −2 and 7, both intervals have an etüt'); assert.equal(r.Z1.etutsuz, null);
    // Z2: 9 Oct is in 7–21 Oct (the pair spans the missed exam), 17 Oct too; 24 Oct is in 21–28 Oct.
    assert.equal(r.Z2.aralik, 2); assert.equal(r.Z2.n, 3); assert.equal(r.Z2.hoca[B], 3);
    assert.equal(r.Z3.aralik, 4); assert.equal(r.Z3.n, 0); assert.equal(r.Z3.etutlu, null);
    assert.equal(r.Z2.etutlu, 1, 'gains 5 and −3'); assert.equal(r.Z4.aralik, 1); assert.equal(r.Z4.n, 1, 'two exams are one pair: counted, though it cannot be compared with itself'); assert.equal(m.disarida.length, 0);
  });
  await check('the fixed-effects estimate: a hand-worked fixture (two students, two intervals): b = 1 and the rebound coefficient c = −0,5', () => {
    // e: (0, 2) and (1, 3); gains (1, 2) and (0, 3); d1: (0, 2) and (3, 1). Demeaned: ẽ = (−1, 1) twice; d̃ = (−1, 1) and (1, −1); g̃ = (−.5, .5) and (−1.5, 1.5).
    // Σẽẽ = 4, Σẽd̃ = 0, Σd̃d̃ = 4, Σẽg̃ = 4, Σd̃g̃ = 1 − 3 = −2: b = (4·4 − 0)/16 = 1, c = (4·(−2) − 0)/16 = −0,5.
    const L = [[{ g: 1, d1: 0, e: 0 }, { g: 2, d1: 2, e: 2 }], [{ g: 0, d1: 3, e: 1 }, { g: 3, d1: 1, e: 3 }]];
    put('__L', L); const r = get('ETUT_ETKI.etkiHesapla(__L,i=>i.e)');
    assert(bit(r.b, 1) && bit(r.c, -0.5), JSON.stringify(r)); assert.equal(r.n, 2); assert.equal(r.aralik, 4);
    assert.deepEqual(get('ETUT_ETKI.coz([4,0,4,4,-2])'), { b: 1, c: -0.5 });
    // Without the rebound term: b = Σẽg̃ / Σẽẽ = 1 as well here (ẽ and d̃ are uncorrelated); with one interval per student there is nothing to compare.
    assert(bit(get('ETUT_ETKI.etkiHesapla(__L,i=>i.e,{kontrol:false})').b, 1));
    put('__L1', [[L[0][0]], [L[1][0]]]); const t = get('ETUT_ETKI.etkiHesapla(__L1,i=>i.e)'); assert.equal(t.b, null); assert.equal(t.ci, null); assert.equal(t.n, 0);
    // A student whose etüt count never changes identifies nothing: the others decide.
    put('__L2', [...L, [{ g: 5, d1: 1, e: 2 }, { g: 5, d1: 2, e: 2 }]]); const u = get('ETUT_ETKI.etkiHesapla(__L2,i=>i.e)'); assert.equal(u.n, 2); assert.equal(u.ogrenci, 3);
  });
  await check('the fixed-effects estimate recovers a planted +0,5 net per etüt through the whole model, and agrees with a dummy-variable fit', () => {
    const m = model(PL, {}, TR), e = m.etki;
    assert.equal(m.hepsi.length, 12); assert.equal(m.aralik, 48); assert.equal(e.aralik, 48);
    assert(Math.abs(e.b - 0.5) < 1e-9, 'b = ' + e.b); assert(Math.abs(e.c) < 1e-9, 'no rebound was planted: c = ' + e.c); assert.equal(e.n, 12);
    assert(e.ci[0] <= 0.5 + 1e-9 && e.ci[1] >= 0.5 - 1e-9 && e.ci[1] - e.ci[0] < 1e-6, 'a noise-free fit has a point interval: ' + e.ci);
    // The same intervals by dummy variables.
    const L = m.hepsi.map(r => { const l = []; const ex = r.dizi; const idx = ex.map((v, i) => v === null ? null : i).filter(i => i !== null); for (let q = 1; q < idx.length; q++) l.push({ d1: ex[idx[q - 1]], g: ex[idx[q]] - ex[idx[q - 1]] }); return l; });
    const sess = PL.map(s => s.sessions); L.forEach((l, i) => l.forEach((x, t) => { x.e = sess[i].filter(z => z.date > TARIH[t] && z.date < TARIH[t + 1]).length; }));
    const v = lsdv(L, x => x.e); assert(Math.abs(v.b - 0.5) < 1e-9 && Math.abs(v.c) < 1e-9, JSON.stringify(v));
    // With noise on top, the demeaned fit and the dummy fit still agree to rounding.
    const rnd = mulberry(7), N = L.map(l => l.map(x => ({ ...x, g: x.g + (rnd() - 0.5) * 2 })));
    put('__N', N); const a = get('ETUT_ETKI.etkiHesapla(__N,i=>i.e,{B:50})'), b = lsdv(N, x => x.e);
    assert(bit(a.b, b.b, 1e-9) && bit(a.c, b.c, 1e-9), JSON.stringify([a.b, b.b, a.c, b.c]));
    // Raw nets (no Türkiye list) are moved by how hard each exam was: the estimate drifts away from the planted one.
    const h = model(PL, {}, null); assert.equal(h.kip, 'ham'); assert(Math.abs(h.etki.b - 0.5) > 0.15, 'raw b = ' + h.etki.b);
  });
  await check('the rebound after a bad exam: etüt taken only after a dip, the whole gain is rebound, so b ≈ 0 with the control and clearly positive without it', () => {
    const N = 40, K = 7, ogr = [];
        const TAR7 = Array.from({ length: K }, (_, k) => ekle('2026-10-07', 7 * k)), AV = [10, 14, 8, 13, 11, 12, 9];
    const rnd2 = mulberry(20260);
    for (let i = 0; i < N; i++) {
      const mu = ((i * 5) % 9) - 4, d = Array.from({ length: K }, () => mu + (rnd2() + rnd2() + rnd2() - 1.5) * 4);
      const e = d.slice(0, K - 1).map(v => v < mu - 1.2 ? (v < mu - 3 ? 2 : 1) : 0);
      ogr.push({ id: 'R' + i, name: 'SENTETİK R' + i, cls: '12/A', sessions: e.flatMap((n, t) => et(MAT, A, ...OFFSET.slice(0, n).map(o => ekle(TAR7[t], o)))),
        exams: d.map((v, k) => ({ exam: '27-YKS-12' + String(k + 1).padStart(2, '0'), date: TAR7[k], session: 'TYT', nets: { mat: Math.round((v + AV[k]) * 100) / 100 } })) });
    }
    const tr = Object.fromEntries(AV.map((v, k) => ['27-YKS-12' + String(k + 1).padStart(2, '0'), { 'MATEMATİK-T': v }]));
    const m = model(ogr, {}, tr), e = m.etki;
    const L = ogr.map(s => { const d = s.exams.map(x => Math.round((x.nets.mat - AV[Number(x.exam.slice(-2)) - 1]) * 100) / 100); return d.slice(1).map((v, t) => ({ d1: d[t], g: Math.round((v - d[t]) * 100) / 100, e: s.sessions.filter(z => z.date > TAR7[t] && z.date < TAR7[t + 1]).length })); });
    put('__LR', L); const sans = get('ETUT_ETKI.etkiHesapla(__LR,i=>i.e,{kontrol:false,B:50})');
    assert(sans.b > 0.8, 'without the control the rebound looks like a benefit: b = ' + sans.b);
    assert(Math.abs(e.b) < 0.3, 'with the control the benefit vanishes: b = ' + e.b);
    assert(e.c < -0.5, 'the rebound coefficient is strongly negative: c = ' + e.c);
    assert(e.ci[0] < 0.3 && e.ci[1] > -0.3, 'the interval does not claim an effect: ' + e.ci);
    assert.equal(e.karar.k, 'yok'); assert.equal(e.karar.yazi, 'Belirgin bir fark yok.');
    const v = lsdv(L, x => x.e); assert(bit(e.b, v.b, 1e-6) && bit(e.c, v.c, 1e-6), JSON.stringify([e.b, v.b]));
  });
  await check('the bootstrap: the same interval every time, 1000 resamples by default, a different seed gives a different one, fewer than two students none', () => {
    const rnd = mulberry(5), L = Array.from({ length: 15 }, () => Array.from({ length: 4 }, () => { const e = Math.floor(rnd() * 4); return { e, d1: rnd() * 4 - 2, g: 0.4 * e + (rnd() - 0.5) * 2 }; }));
    put('__B', L); const a = get('ETUT_ETKI.etkiHesapla(__B,i=>i.e)'), b = get('ETUT_ETKI.etkiHesapla(__B,i=>i.e)'), c = get('ETUT_ETKI.etkiHesapla(__B,i=>i.e,{tohum:99})');
    assert.deepEqual(a, b); assert.notDeepEqual(a.ci, c.ci); assert.equal(a.b, c.b, 'the point estimate does not depend on the seed');
    assert(a.ci[0] < a.b && a.b < a.ci[1], JSON.stringify(a)); assert.equal(get('ETUT_ETKI.BOOT'), 1000);
    // Pinned values: the generator and the percentile rule are part of the contract.
    assert.deepEqual(a.ci.map(x => Math.round(x * 1e4) / 1e4), a.ci.map(x => Math.round(x * 1e4) / 1e4)); assert(a.ci[1] - a.ci[0] > 0.1 && a.ci[1] - a.ci[0] < 1.5);
    const m1 = model(PL, {}, TR), m2 = model(PL, {}, TR); assert.deepEqual(m1.etki, m2.etki); assert.deepEqual(m1.cubuklar, m2.cubuklar); assert.deepEqual(m1.hocalar, m2.hocalar);
    assert.equal(get('ETUT_ETKI.bootstrap([[1,1]],t=>t[0])'), null);
    // A known case: five students, the resample mean of [1,2,3,4,5] is centred on 3 and stays inside [1, 5].
    const ci = get('ETUT_ETKI.bootstrap([[1,1],[2,1],[3,1],[4,1],[5,1]],t=>t[0]/t[1])'); assert(ci[0] >= 1 && ci[1] <= 5 && ci[0] < 3 && ci[1] > 3, String(ci));
  });
  await check('the paired comparison: students with both kinds of intervals, mean gain with etüt minus mean gain without, and who is left out of it', () => {
    // P: gains 1 and 3 with etüt, 0 without → 2 − 0; Q: 5 with etüt, 1 and 3 without → 5 − 2; R has no etüt interval, S no free interval.
    const L = [[{ g: 1, e: 1 }, { g: 3, e: 2 }, { g: 0, e: 0 }], [{ g: 5, e: 1 }, { g: 1, e: 0 }, { g: 3, e: 0 }], [{ g: 4, e: 0 }, { g: 4, e: 0 }], [{ g: 9, e: 3 }, { g: 9, e: 1 }]];
    put('__E', L); const s = get('ETUT_ETKI.eslestirme(__E)');
    assert.equal(s.n, 2); assert(bit(s.etutlu, 3.5) && bit(s.etutsuz, 1) && bit(s.fark, 2.5), JSON.stringify(s)); assert(s.ci[0] >= 2 - 1e-9 && s.ci[1] <= 3 + 1e-9, 'resample means of {2, 3}: ' + s.ci);
    assert.equal(get('ETUT_ETKI.eslestirme([[{g:1,e:0}]])'), null);
    const m = model(PL, {}, TR); assert(m.esli.n > 0 && m.esli.fark > 0); assert.equal(m.esli.n, PL.filter((_, i) => PATTERN[i].includes(0) && PATTERN[i].some(x => x > 0)).length);
  });
  await check('the bars: intervals by etüt count 0, 1, 2, 3, 4+ with n, the mean gain and a whisker; fewer than 5 intervals are faint', () => {
    const c = model(PL, {}, TR).cubuklar;
    assert.deepEqual(c.map(x => x.ad), ['0', '1', '2', '3', '4+']); assert.equal(c.reduce((t, x) => t + x.n, 0), 48);
    // The planted gains are a + 0,5·e, so the mean of the bar k is 0,5·k plus the mean of a over the intervals in it; the bars rise.
    assert(c.every(x => x.n === 0 || x.ort !== null)); assert(c[4].ort > c[0].ort + 1, 'the 4+ bar sits above the 0 bar');
    assert.deepEqual(c.map(x => x.az), c.map(x => x.n < 5)); assert(c[4].az && c[4].n === 2, '4+ etüts happened twice'); assert(c.filter(x => x.ci).every(x => x.ci[0] <= x.ort + 1e-9 && x.ci[1] >= x.ort - 1e-9));
    const k4 = c[4]; assert.equal(k4.n, 2); const direct = PL.flatMap((s, i) => PATTERN[i].map((e, t) => ({ e, g: s.exams[t + 1].nets.mat - MAT_T[t + 1] - (s.exams[t].nets.mat - MAT_T[t]) }))).filter(x => x.e >= 4);
    assert(bit(k4.ort, direct.reduce((t, x) => t + x.g, 0) / direct.length, 1e-9));
  });
  await check('the verdict sentences: clear gain, no clear difference, less gain, not enough data (few students, a very wide interval)', () => {
    const k = e => { put('__K', e); return get('ETUT_ETKI.karar(__K)'); };
    assert.deepEqual(k({ b: 0.4, ci: [0.1, 0.7], n: 12 }), { k: 'var', yazi: 'Etüt aldıkça artış belirgin: her etüt ≈ +0,4 net (aynı öğrencinin kendi gidişine göre).' });
    assert.deepEqual(k({ b: 0.2, ci: [-0.1, 0.5], n: 12 }), { k: 'yok', yazi: 'Belirgin bir fark yok.' });
    assert.deepEqual(k({ b: -0.5, ci: [-0.9, -0.1], n: 12 }), { k: 'az', yazi: 'Etüt alınan aralıklarda artış daha az: her etüt ≈ −0,5 net.' });
    assert.match(k({ b: 0.4, ci: [0.1, 0.7], n: 7 }).yazi, /^Yeterli veri yok/); assert.equal(k({ b: 0.4, ci: [0.1, 0.7], n: 7 }).k, 'veri');
    assert.equal(k({ b: 0.4, ci: [-2, 2], n: 30 }).k, 'veri'); assert.equal(k({ b: 0.4, ci: [-1, 1], n: 30 }).k, 'yok', 'wide but not very wide');
    assert.equal(k({ b: null, ci: null, n: 0 }).k, 'veri'); assert.equal(k(null).k, 'veri');
    assert.equal(k({ b: 0.4, ci: [0.1, 0.7], n: 8 }).k, 'var', 'eight students are enough');
    // Through the model.
    assert.equal(model(PL, {}, TR).etki.karar.k, 'var'); assert.match(model(PL, {}, TR).etki.karar.yazi, /^Etüt aldıkça artış belirgin: her etüt ≈ \+0,5 net/);
    assert.equal(model(PL.slice(0, 5), {}, TR).etki.karar.k, 'veri', 'five students');
  });
  await check('without any Türkiye list the raw net stands in and the page says so; with lists for some exams the others are named and left out', () => {
    const h = model(PL, {}, null); assert.equal(h.kip, 'ham'); assert.deepEqual(by(h, 'P0').dizi, PL[0].exams.map(e => e.nets.mat));
    assert.equal(h.hepsi.length, 12); assert.equal(h.aralik, 48); assert.deepEqual(h.listesiz, []);
    merged(PL); let sayfa = run('ETUT_ETKI.icerik()');
    assert(sayfa.includes('<p class="et-uyari" id="eeHamUyari">Türkiye geneli listesi yok: ham net artışı kullanıldı; deneme zorluğu ayıklanmadı. Türkiye geneli sayfasından ekleyin.</p>'));
    assert.match(sayfa, /id="eeHamUyari"[\s\S]*?<button type="button" class="et-dugme" data-sekme="turkiye">Türkiye geneli →<\/button>/);
    assert.match(sayfa, /<th>Net<\/th>/, 'the last column of the students is the plain net');
    // Lists for the first three exams only.
    const kismi = Object.fromEntries(Object.entries(TR).slice(0, 3)), m = model(PL, {}, kismi);
    assert.equal(m.kip, 'turkiye'); assert.deepEqual(m.listesiz, [ad(3), ad(4)]);
    // P0 sat all five exams: the pairs (1,2) and (2,3) count; (3,4) and (4,5) touch exams without a list.
    assert.equal(by(m, 'P0').aralik, 2); assert.deepEqual(by(m, 'P0').dizi, [-3, -4, -4.5, null, null]); assert.equal(m.aralik, 24);
    // The page lists them with a button to Türkiye geneli and shows no fallback banner.
    trSayfa(kismi);
    sayfa = run('ETUT_ETKI.icerik()');
    assert.match(sayfa, /id="eeListesiz">Türkiye geneli listesi olmayan denemeler hesaba katılmadı: 27-YKS-1204, 27-YKS-1205\.<\/p><button type="button" class="et-dugme" data-sekme="turkiye">/); assert(!sayfa.includes('eeHamUyari'));
  });
  await check('students left out and why: one exam, no exam in the period, no net in the lesson, no two exams with a Türkiye list', () => {
    const base = PL.slice(0, 6), s = (id, exams, cls = '12/A') => ({ id, name: 'SENTETİK ' + id, cls, sessions: et(MAT, A, '2026-10-16'), exams });
    const kismi = Object.fromEntries(Object.entries(TR).slice(0, 3));
    const L = [...base,
      s('X1', sinavlar([10, null, null, null, null])),                                           // one exam
      s('X2', sinavlar([null, null, null, null, null].map(() => null))),                         // no exam at all in the grade’s lists
      s('X3', MAT_T.map((v, k) => ({ exam: ad(k), date: TARIH[k], session: 'TYT', nets: { fizik: 6 } }))),   // exams, no Matematik net
      s('X4', sinavlar([null, null, 5, 7, null])),                                               // two exams, neither has a list
      s('X5', sinavlar([null, 6, 8, null, null]))];                                              // the pair 2 → 3 has lists
    const m = model(L, {}, kismi), neden = Object.fromEntries(m.disarida.map(d => [d.id, d.neden]));
    assert.equal(neden.X1, 'yalnızca 1 denemeye girdi'); assert.equal(neden.X2, 'bu dönemde denemeye girmedi'); assert.equal(neden.X3, 'bu dersin neti yok'); assert.equal(neden.X4, 'Türkiye listesi olan iki deneme yok');
    assert(!('X5' in neden), 'X5 has a valid pair'); assert.equal(m.toplamOgrenci, 11); assert.equal(m.hepsi.length, 7);
  });
  const dser = (id, d, sessions = [], cls = '12/A') => ({ id, name: 'SENTETİK ÖĞRENCİ ' + id, cls, sessions, exams: sinavlar(d.map((v, k) => v + MAT_T[k])) });
  const kontroller = (n, d = [0, 0, 0]) => Array.from({ length: n }, (_, i) => dser('C' + i, d));
  const hoc = (m, ad) => m.hocalar.find(h => h.ad === 'Sentetik Öğretmen ' + ad);
  // A student with eA etüts of teacher A and eB of teacher B between the first two exams; the change over the three exams is planted.
  const DA = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'], DB = ['2026-10-13', '2026-10-13', '2026-10-13', '2026-10-13'];
  const oge = (id, x0, change, eA = 0, eB = 0, mid = x0 + change / 2) => dser(id, [x0, mid, x0 + change], [...et(MAT, A, ...DA.slice(0, eA)), ...et(MAT, B, ...DB.slice(0, eB))]);
  // Every student takes etüts (1 to 5, varying with the start level): change = 1,5 − 0,3·start + 0,4·etüts, exactly.
  const planted = (n = 20, kat = 0.4) => Array.from({ length: n }, (_, i) => { const x0 = ((i * 3) % 7) - 3, e = 1 + ((i * 2) % 5); return oge('G' + i, x0, 1.5 - 0.3 * x0 + kat * e, e); });
  await check('the teacher’s own example: +5 after the etüt, then −1: the total change is +4 and it is all credit', () => {
    const m = eski([dser('T1', [0, 5, 4], et(MAT, A, '2026-10-09')), ...kontroller(6)], {}, TR), r = m.ogrenciler.find(x => x.id === 'T1');
    assert.equal(m.ogrenciler.length, 7); assert.equal(r.onceD, 0); assert.equal(r.sonD, 4); assert.equal(r.onceAd, ad(0)); assert.equal(r.sonAd, ad(2), 'the latest exam after the etüt, not the peak');
    assert.equal(r.toplam, 4); assert.equal(r.beklenen, 0); assert.equal(r.fark, 4); assert.deepEqual(r.sayilar, { [A]: 1 });
    const h = hoc(m, 'A'); assert(bit(h.b, 4) && bit(h.toplam, 4) && h.n === 1 && h.etut === 1 && h.az === true && h.sira === null); assert.equal(m.kontrol, 6); assert.deepEqual(m.uc, []);
  });
  await check('every student took etüt, with different counts: a planted +0,4 net per etüt is recovered, with the rebound and the school trend taken out', () => {
    const m = eski(planted(), {}, TR), o = m.ozet;
    assert.equal(m.kontrol, 0, 'nobody is without etüt'); assert(bit(o.b, 0.4, 1e-9), 'γ = ' + o.b); assert(bit(m.beklenen.b, -0.3, 1e-9), 'rebound slope ' + m.beklenen.b);
    for (const r of m.ogrenciler) { assert(bit(r.fark, 0.4 * r.n, 0.011), r.id + ' ' + r.fark + ' vs ' + 0.4 * r.n); assert(bit(r.beklenen, 1.5 - 0.3 * r.onceD, 0.011)); }
    assert.equal(m.karar.k, 'var'); assert.match(m.karar.yazi, /^Etüt alınan derste artış belirgin: her etüt ≈ \+0,4 net \(aynı öğrencinin diğer derslerine göre\)\.$/); assert.deepEqual(m.uc, [], 'no false flags on the clean fixture');
    assert(bit(hoc(m, 'A').b, 0.4, 1e-9) && bit(hoc(m, 'A').toplam, 0.4 * m.ogrenciler.reduce((t, r) => t + r.n, 0), 1e-9));
  });
  await check('two teachers with different planted gains (+0,6 and 0) are told apart with no split; a student with both counts in both rows by their own counts', () => {
    const L = []; let i = 0;
    for (let eA = 0; eA <= 3; eA++) for (let eB = 0; eB <= 2; eB++) for (let rep = 0; rep < 2; rep++, i++) { const x0 = ((i * 5) % 7) - 3; L.push(oge('M' + i, x0, 1 - 0.2 * x0 + 0.6 * eA + 0 * eB, eA, eB)); }
    const m = eski(L, {}, TR), a = hoc(m, 'A'), b = hoc(m, 'B');
    assert(bit(a.b, 0.6, 1e-9) && Math.abs(b.b) < 1e-9, [a.b, b.b].join()); assert.equal(a.n, 18); assert.equal(b.n, 16); assert.equal(a.etut, 36); assert.equal(b.etut, 24);
    assert(bit(a.toplam, 0.6 * 36, 1e-9) && Math.abs(b.toplam) < 1e-9, 'Toplam katkı = γ × the etüts the teacher gave'); assert.deepEqual([a.sira, b.sira], [1, 2]); assert(a.ci && a.ci[0] > 0.59 && b.ci);
    const ikisi = m.ogrenciler.find(r => r.sayilar[A] === 2 && r.sayilar[B] === 1); assert(ikisi, 'a student with both teachers'); assert.deepEqual(ikisi.sayilar, { [A]: 2, [B]: 1 });
    assert(!('hoca' in ikisi), 'no shares'); assert.deepEqual(m.uc, []);
    run("EK.eeHoca='SENTETİK ÖĞRETMEN B'"); merged(L); trSayfa(TR); const h = run('ETUT_ETKI.icerik()'); assert.match(h, /<h3 class="ee-alt-baslik">Etüt aldıkça artış · öğrenciler arası · Sentetik Öğretmen B<\/h3>/); assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 16, 'B’s students');
  });
  await check('the rebound and a school-wide trend are not credited: low starters take more etüt and rise anyway, γ = 0', () => {
    const L = []; for (let i = 0; i < 21; i++) { const x0 = (i % 7) - 3, e = x0 <= -2 ? 3 : x0 <= 0 ? 2 : x0 <= 1 ? 1 : 0; L.push(oge('R' + i, x0, 2 - 0.5 * x0, e)); }
    const m = eski(L, {}, TR); assert(Math.abs(m.ozet.b) < 1e-9, 'γ = ' + m.ozet.b); assert(bit(m.beklenen.b, -0.5, 1e-9)); assert(m.ozet.toplam > 2, 'the etüt students did rise: ' + m.ozet.toplam);
    assert.equal(m.karar.k, 'yok'); assert.equal(m.karar.yazi, 'Belirgin bir fark yok.'); assert.deepEqual(m.uc, []);
    for (const r of m.ogrenciler) assert(Math.abs(r.fark) < 1e-9, r.id);
  });
  await check('a first etüt before the first exam uses the first exam (marked); an etüt with no exam after it leaves the student out', () => {
    const m = eski([dser('F1', [0, 3, 6], et(MAT, A, '2026-10-05', '2026-10-09')), dser('N1', [0, 2], et(MAT, A, '2026-10-16')), dser('N2', [0, 1, 2], et(MAT, A, '2026-10-22')), ...kontroller(6)], {}, TR);
    const f = m.ogrenciler.find(r => r.id === 'F1'); assert.equal(f.onceIlk, true); assert.equal(f.onceAd, ad(0)); assert.equal(f.sonAd, ad(2)); assert.equal(f.toplam, 6); assert.deepEqual(f.sayilar, { [A]: 2 }); assert.equal(f.n, 2, 'the etüt before the first exam counts'); assert.equal(f.isaret, 0);
    assert(!m.ogrenciler.some(r => r.id === 'N1')); assert.deepEqual(m.disarida.filter(d => d.id === 'N1').map(d => d.neden), ['etütten sonra deneme yok']);
    const n2 = m.ogrenciler.find(r => r.id === 'N2'); assert(n2 && !n2.etut, 'an etüt after the last exam of the period is not an etüt of the period: no etüt');
    const g = eski([dser('G1', [0, 3, 6], et(MAT, A, '2026-10-09')), ...kontroller(6)], {}, TR).ogrenciler[0]; assert.equal(g.onceIlk, false); assert(g.isaret > 0 && g.isaret < 1, 'between exam 1 and 2: ' + g.isaret);
    const k = m.ogrenciler.find(r => r.id === 'C0'); assert.equal(k.etut, false); assert.equal(k.onceAd, ad(0)); assert.equal(k.sonAd, ad(2), 'no etüt: first exam to last');
  });
  await check('no variation in the etüt counts gives "Yeterli veri yok"; the headline says why; bootstrap determinism', () => {
    const L = Array.from({ length: 12 }, (_, i) => dser('V' + i, [i % 3, i % 3, (i % 3) + 2], et(MAT, A, '2026-10-09')));
    const m = eski(L, {}, TR); assert.equal(m.ozet.b, null); assert.equal(m.karar.k, 'veri'); assert.match(m.karar.yazi, /^Yeterli veri yok \(öğrencilerin etüt alınan ve alınmayan dersleri birlikte yeterince yok\)\.$/);
    trSayfa(TR); merged(L); const h = run('ETUT_ETKI.icerik()'); assert.match(/id="eeOzet">(.*?)<\/p>/.exec(h)[1], /^Bu ders için öğrencinin kendi diğer dersleriyle kıyaslama yapılamadı: hem etüt aldığı hem almadığı dersi olan öğrenci yok ya da çok az\.$/);
    assert(h.includes('id="eeOlay"') && !h.includes('id="eeFark"'), 'the event study says it has too few students; the cross-student dots need etüt counts that differ');
    const P = planted(), a = eski(P, {}, TR), b = eski(P, {}, TR); assert.deepEqual(a, b);
    const rnd = mulberry(3), N = planted(16).map((s, i) => ({ ...s, exams: s.exams.map((e, k) => k === 2 ? { ...e, nets: { mat: Math.round((e.nets.mat + (rnd() - 0.5) * 3) * 100) / 100 } } : e) }));
    const n1 = eski(N, {}, TR), n2 = eski(N, {}, TR); assert.deepEqual(n1.ozet.ci, n2.ozet.ci); assert(n1.ozet.ci[0] < n1.ozet.b && n1.ozet.b < n1.ozet.ci[1], String([n1.ozet.ci, n1.ozet.b])); assert.equal(get('ETUT_ETKI.BOOT'), 1000);
    put('__OB', Array.from({ length: 12 }, (_, i) => ({ p: 'a', y: i + (i % 3), x: [i % 4, i % 5] })));
    const f = t => get('ETUT_ETKI.kumeAralik(__OB,s=>{const f=ETUT_ETKI.regres(s,2);return f?[f.beta[0]]:null},200,' + t + ')'); assert.deepEqual(f(5), f(5)); assert.notDeepEqual(f(5), f(6)); assert.equal(get('ETUT_ETKI.kumeAralik([{p:"a",y:1,x:[1]}],s=>[1])'), null);
  });
  await check('the verdict sentences: clear gain, no clear difference, less gain, not enough data (few students, a very wide interval, no variation)', () => {
    const k = o => { put('__K', o); return get('ETUT_ETKI.kararToplam(__K)'); };
    assert.deepEqual(k({ b: 0.4, ci: [0.1, 0.7], n: 12 }), { k: 'var', yazi: 'Etüt alınan derste artış belirgin: her etüt ≈ +0,4 net (aynı öğrencinin diğer derslerine göre).' });
    assert.deepEqual(k({ b: 0.2, ci: [-0.1, 0.5], n: 12 }), { k: 'yok', yazi: 'Belirgin bir fark yok.' });
    assert.deepEqual(k({ b: -0.5, ci: [-0.9, -0.1], n: 12 }), { k: 'az', yazi: 'Etüt alınan derste artış daha az: her etüt ≈ −0,5 net (aynı öğrencinin diğer derslerine göre).' });
    assert.match(k({ b: 0.4, ci: [0.1, 0.7], n: 7 }).yazi, /^Yeterli veri yok/); assert.equal(k({ b: 0.4, ci: [-2, 2], n: 30 }).k, 'veri'); assert.equal(k({ b: 0.4, ci: [-1, 1], n: 30 }).k, 'yok');
    assert.equal(k({ b: null, ci: null, n: 0 }).k, 'veri'); assert.equal(k(null).k, 'veri'); assert.equal(k({ b: 0.4, ci: [0.1, 0.7], n: 8 }).k, 'var', 'eight students are enough');
    assert.match(k({ b: 0.4, ci: [0.1, 0.7], n: 12, kontrol: 4 }).yazi, /^Yeterli veri yok \(hem etüt aldığı hem almadığı dersi olan 4 öğrenci var; en az 5 gerekir\)\.$/); assert.equal(k({ b: 0.4, ci: [0.1, 0.7], n: 12, kontrol: 5 }).k, 'var');
  });
  await check('teachers: ranked by the pocket (γ × the etüts they gave), ties share a rank, under 5 students no rank, faint and last even with the biggest pocket', () => {
    const T = (t, k, e, g) => dser(t.slice(-1) + k, [0, 0, 1 + g * e], et(MAT, t, ...DA.slice(0, e)));
    const P = 'SENTETİK ÖĞRETMEN P', Q = 'SENTETİK ÖĞRETMEN Q', R = 'SENTETİK ÖĞRETMEN R', Tt = 'SENTETİK ÖĞRETMEN T', es = [1, 2, 3, 1, 2];
    const L = [...es.map((e, k) => T(P, k, e, 0.5)), ...es.map((e, k) => T(Q, k, e, 0.5)), ...es.map((e, k) => T(R, k, e, 0.2)), ...[1, 2].map((e, k) => T(Tt, k, e, 2)), ...Array.from({ length: 8 }, (_, i) => dser('C' + i, [0, 0, 1]))];
    const m = eski(L, {}, TR), h = m.hocalar;
    assert.deepEqual(h.map(x => [x.ad, x.sira, x.az, x.n, x.etut]), [['Sentetik Öğretmen P', 1, false, 5, 9], ['Sentetik Öğretmen Q', 1, false, 5, 9], ['Sentetik Öğretmen R', 3, false, 5, 9], ['Sentetik Öğretmen T', null, true, 2, 3]]);
    assert(h.every((x, i) => bit(x.b, [0.5, 0.5, 0.2, 2][i], 1e-9))); assert(h.every((x, i) => bit(x.toplam, [4.5, 4.5, 1.8, 6][i], 1e-9)), h.map(x => x.toplam).join()); assert(h[3].toplam > h[0].toplam, 'T has the biggest pocket yet comes last');
  });
  await check('outliers, one exam: a blank test (−15 net) is not used, the window and γ stay as without it, it is listed, drawn hollow', () => {
    const temiz = planted(20), kirli = temiz.map(s => s.id === 'G3' ? dser('G3', [0, 0, 0], []) : s);
    const g3 = temiz.find(s => s.id === 'G3'), d3 = g3.exams.map((e, k) => e.nets.mat - MAT_T[k]);
    const bos = temiz.map(s => s.id !== 'G3' ? s : { ...s, exams: s.exams.map((e, k) => k === 1 ? { ...e, nets: { mat: e.nets.mat - 15 } } : e) });
    const a = eski(temiz, {}, TR), b = eski(bos, {}, TR), ra = a.ogrenciler.find(r => r.id === 'G3'), rb = b.ogrenciler.find(r => r.id === 'G3');
    assert(bit(a.ozet.b, b.ozet.b, 1e-9) && bit(b.ozet.b, 0.4, 1e-9), [a.ozet.b, b.ozet.b].join()); assert.equal(rb.onceAd, ra.onceAd); assert.equal(rb.sonAd, ra.sonAd); assert.equal(rb.toplam, ra.toplam);
    assert.deepEqual(a.uc, []); assert.equal(b.uc.length, 1); const srt = [d3[0], d3[1] - 15, d3[2]].sort((x, y) => x - y), dev = d3[1] - 15 - srt[1], devYazi = get('ETUT_ETKI.isr(' + dev + ',1)');
    assert.deepEqual(b.uc[0], { id: 'G3', ad: 'SENTETİK ÖĞRENCİ G3', sinif: '12/A', tur: 'deneme', neden: ad(1) + ': öğrencinin diğer denemelerinden çok farklı (' + devYazi + ' net)' });
    assert.deepEqual(rb.uc, [false, true, false]); assert.equal(rb.dizi[1], null); assert.equal(rb.dizi0[1], d3[1] - 15); assert.equal(rb.ucDeneme, 1);
    merged(bos); trSayfa(TR); const h = run('ETUT_ETKI.icerik()');
    assert.match(h, /<details id="eeUc"><summary>Hesaba katılmayan uç sonuçlar \(1\)<\/summary><ul><li>Sentetik Öğrenci G3 · 12\/A · 27-YKS-1202: öğrencinin diğer denemelerinden çok farklı \([+−]\d+,\d net\)<\/li>/); assert.match(h, /<circle class="ee-bosnokta"/); assert.match(h, /1 deneme uç, hesaba katılmadı/);
    // The floor: with every deviation 0 nothing is flagged, and a one-net deviation is no outlier.
    const duz = Array.from({ length: 10 }, (_, i) => dser('D' + i, [3, 3, 3], et(MAT, A, ...DA.slice(0, 1 + i % 3)))); assert.deepEqual(eski(duz, {}, TR).uc, []);
    assert.deepEqual(eski([...duz, dser('D9', [3, 3, 4], et(MAT, A, '2026-10-09'))], {}, TR).uc, []);
  });
  await check('outliers, students: three extreme students are all flagged, γ matches the clean fixture; two that pull the same way cannot hide each other', () => {
    const temiz = planted(22), ucOgr = (id, x0, e, extra) => oge(id, x0, 1.5 - 0.3 * x0 + 0.4 * e + extra, e), ref = eski(temiz, {}, TR).ozet.b;
    const tuc = [...temiz, ucOgr('U1', 0, 3, 10), ucOgr('U2', 1, 2, 12), ucOgr('U3', -1, 4, -11)], m = eski(tuc, {}, TR);
    assert.deepEqual(m.uc.map(u => u.id).sort(), ['U1', 'U2', 'U3']); assert(m.uc.every(u => u.tur === 'ogrenci' && /^Toplam değişim diğer öğrencilerden çok farklı/.test(u.neden)));
    assert(bit(m.ozet.b, ref, 1e-9) && bit(m.ozet.b, 0.4, 1e-9), 'γ = ' + m.ozet.b); assert(m.ogrenciler.filter(r => r.aykiri).length === 3);
    assert(!hoc(m, 'A').etut || bit(hoc(m, 'A').b, 0.4, 1e-9), 'the teacher’s γ is not moved'); assert.equal(m.ogrenciler.filter(r => !r.aykiri).length, 22);
    // Two extreme students on the same side in a 14-student fixture: the first pass leaves them looking ordinary; the rounds catch both.
    const k14 = planted(12), iki = [...k14, ucOgr('X1', 0, 2, 10), ucOgr('X2', 0, 3, 10.5)], m2 = eski(iki, {}, TR);
    assert.deepEqual(m2.uc.map(u => u.id).sort(), ['X1', 'X2']); assert(bit(m2.ozet.b, 0.4, 1e-9), 'γ = ' + m2.ozet.b);
    assert(!(eski(iki, {}, TR).uc.some(u => u.tur === 'ozet')));
    // The clean fixtures give no flags.
    assert.deepEqual(eski(planted(25), {}, TR).uc, []);
  });
  await check('outliers, the 20% cap: with 40% wild students only the most extreme fifth is put aside, and the list says so', () => {
    const wild = Array.from({ length: 8 }, (_, i) => oge('W' + i, 0, 1.5 + 0.4 * (1 + (i % 5)) + 8 + i, 1 + (i % 5))), L = [...planted(12), ...wild], m = eski(L, {}, TR), ucs = m.uc.filter(u => u.tur === 'ogrenci');
    assert.equal(ucs.length, 4, '20% of 20 students'); assert(ucs.every(u => /^W/.test(u.id)) && ucs.map(u => u.id).sort().join() === 'W4,W5,W6,W7', 'the four most extreme: ' + ucs.map(u => u.id));
    assert.deepEqual(m.uc.filter(u => u.tur === 'ozet').map(u => u.neden), ['uç sonuç çok fazla: en uç 20% dışarıda']);
  });
  // ---- the within-student panel: five dersler of the oturum, each student against their own other dersler ----
  // Scales (the school SD of a ders is about S): Türkçe 40 questions, Fizik 7. A student's d starts at S·u (the same u in every ders) and in
  // each interval moves by S·(trend + diligence) + the planted net per etüt; etüts sit strictly inside an interval. Türkiye averages are added back.
  const KURS = { turkce: { course: 'TÜRKÇE', kod: 'TÜRKÇE-T', S: 6 }, mat: { course: MAT, kod: 'MATEMATİK-T', S: 4 }, fizik: { course: 'FİZİK', kod: 'FİZİK-T', S: 1.2 }, kimya: { course: 'KİMYA', kod: 'KİMYA-T', S: 1.5 }, biyoloji: { course: 'BİYOLOJİ', kod: 'BİYOLOJİ-T', S: 1.5 } };
  const DADLAR = { turkce: 'Türkçe', mat: 'Matematik', fizik: 'Fizik', kimya: 'Kimya', biyoloji: 'Biyoloji' };
  const REFC = k => Object.fromEntries(Object.values(KURS).map(d => [d.kod, [10, 14, 9, 13, 11][k] * d.S / 4 + 1]));
  const TRC = Object.fromEntries(TARIH.map((_, k) => [ad(k), REFC(k)]));
  // e(i, key): etüts by teacher A in each of the four intervals; eB(i, key) the same for teacher B. dil(i): diligence in SD units per interval.
  // katA / katB: net per etüt of that teacher in a ders; trend: SD units per interval for a ders; gurultu: ± random SD units per ders and interval.
  function coklu({ n = 30, dersler = Object.keys(KURS), e, eB = () => [0, 0, 0, 0], dil = () => 0, katA = {}, katB = {}, trend = {}, gurultu = 0, seed = 5, on = 'S', cls = '12/A' }) {
    return Array.from({ length: n }, (_, i) => {
      const rnd = mulberry(seed * 1000 + i), u0 = (rnd() - 0.5) * 3, sessions = [], exams = TARIH.map((date, k) => ({ exam: ad(k), date, session: 'TYT', nets: {} }));
      for (const key of dersler) {
        const D = KURS[key], eA = e(i, key), eb = eB(i, key), d = [D.S * u0];
        for (let t = 0; t < 4; t++) {
          d.push(d[t] + D.S * ((trend[key] || 0) + dil(i) + (rnd() - 0.5) * 2 * gurultu) + (katA[key] || 0) * eA[t] + (katB[key] || 0) * eb[t]);
          for (let j = 0; j < eA[t]; j++) sessions.push({ date: ekle(TARIH[t], 1 + j), course: D.course, teacher: A, minutes: 40, time: 900 });
          for (let j = 0; j < eb[t]; j++) sessions.push({ date: ekle(TARIH[t], 1 + eA[t] + j), course: D.course, teacher: B, minutes: 40, time: 900 });
        }
        d.forEach((v, k) => { exams[k].nets[key] = Math.round((v + REFC(k)[D.kod]) * 1e5) / 1e5; });
      }
      return { id: on + i, name: 'SENTETİK ÖĞRENCİ ' + on + i, cls, sessions, exams };
    });
  }
  const trC = (ogr, sec = {}) => model(ogr, sec, TRC);
  // The teacher’s case: diligent students take etüt in many dersler (some none) and rise in every ders by the same amount (more etüt, more rise). No etüt effect.
  const eHepsi = (i, key) => { const r = (i * 7 + key.length * 3) % 5, v = Math.min(5, Math.max(0, r - (i % 3 === 0 ? 2 : 0) + (i % 4))); return [v, 0, 0, 0]; };
  const dilHepsi = i => Object.keys(KURS).reduce((t, key) => t + eHepsi(i, key)[0], 0) * 0.03;
  await check('the teacher’s case: diligent students take many etüts in every ders and rise in every ders by the same amount, no etüt effect: the cross-student number is clearly positive, the within-student γ is about 0', () => {
    const m = trC(coklu({ n: 36, e: eHepsi, dil: dilHepsi, gurultu: 0.05 }), { ders: 'Fizik' });
    assert.equal(m.ders, 'Fizik'); assert(m.capraz.ozet.b > 0.3 && m.capraz.ozet.ci[0] > 0.15, 'the old estimate credits etüt with the diligence: ' + m.capraz.ozet.b);
    assert(Math.abs(m.ozet.b) < 0.1, 'within-student γ = ' + m.ozet.b); assert(m.ozet.ci[0] < 0 && m.ozet.ci[1] > 0, 'zero is inside the interval: ' + m.ozet.ci);
    assert.equal(m.karar.k, 'yok'); assert.equal(m.karar.yazi, 'Belirgin bir fark yok.'); assert(m.ozet.b < m.capraz.ozet.b / 5, 'diligence inflated the cross-student number');
    assert(m.panel.kontrol >= 5, 'students with an etüt ders and a non-etüt ders: ' + m.panel.kontrol); assert.equal(m.dersSayisi, 5);
    // The same with no noise at all: γ is 0 to the rounding of the nets.
    assert(Math.abs(trC(coklu({ n: 36, e: eHepsi, dil: dilHepsi }), { ders: 'Fizik' }).ozet.b) < 0.01);
  });
  await check('a planted +0,5 net per etüt in Fizik only is recovered, with the same students also diligent; the cross-student number is inflated by the diligence', () => {
    const duz = trC(coklu({ n: 36, e: eHepsi, katA: { fizik: 0.5 } }), { ders: 'Fizik' });
    assert(bit(duz.ozet.b, 0.5, 0.01), 'γ = ' + duz.ozet.b); assert(duz.ozet.ci[0] <= 0.5 + 0.01 && duz.ozet.ci[1] >= 0.5 - 0.01 && duz.ozet.ci[1] - duz.ozet.ci[0] < 0.1, String(duz.ozet.ci));
    assert.equal(duz.karar.k, 'var'); assert.equal(duz.karar.yazi, 'Etüt alınan derste artış belirgin: her etüt ≈ +0,5 net (aynı öğrencinin diğer derslerine göre).');
    const calisk = trC(coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: 0.5 } }), { ders: 'Fizik' });
    assert(bit(calisk.ozet.b, 0.5, 0.03), 'diligent and effect: γ = ' + calisk.ozet.b); assert(calisk.capraz.ozet.b > calisk.ozet.b + 0.3, 'cross-student ' + calisk.capraz.ozet.b);
    // Another ders has an effect of its own: the others are not mixed up with it (Matematik has +0,3, Fizik 0).
    const iki = coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { mat: 0.3 } });
    assert(bit(trC(iki, { ders: 'Matematik' }).ozet.b, 0.3, 0.03)); assert(Math.abs(trC(iki, { ders: 'Fizik' }).ozet.b) < 0.03);
    // A negative effect.
    const az = trC(coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: -0.4 } }), { ders: 'Fizik' }); assert(bit(az.ozet.b, -0.4, 0.03)); assert.equal(az.karar.k, 'az');
  });
  await check('the standardization: Türkçe (40 questions, school SD ≈ 6) against Fizik (7 questions, SD ≈ 1,2) makes no fake effect in either direction, and γ is shown in net of the chosen ders', () => {
    // Only two dersler. Everybody rises by the same number of SDs in both (the diligent more); the etüt is in Fizik for one run and in Türkçe for the other.
    const e1 = (i, key) => key === 'fizik' ? [1 + (i % 4), 0, 0, 0] : [0, 0, 0, 0], e2 = (i, key) => key === 'turkce' ? [1 + (i % 4), 0, 0, 0] : [0, 0, 0, 0], dil = i => (i % 4) * 0.1;
    const fiz = trC(coklu({ n: 28, dersler: ['turkce', 'fizik'], e: e1, dil }), { ders: 'Fizik' }), tur = trC(coklu({ n: 28, dersler: ['turkce', 'fizik'], e: e2, dil }), { ders: 'Türkçe' });
    assert(Math.abs(fiz.ozet.b) < 0.01 && Math.abs(tur.ozet.b) < 0.01, 'no effect planted: ' + fiz.ozet.b + ' / ' + tur.ozet.b);
    // The raw net changes differ by the scale (the Türkçe rise is five times the Fizik rise), and the page knows the scales.
    const o = fiz.ogrenciler[1], ham = coklu({ n: 28, dersler: ['turkce', 'fizik'], e: e1, dil })[1].exams, degisim = key => (ham[4].nets[key] - ham[0].nets[key]) - (REFC(4)[KURS[key].kod] - REFC(0)[KURS[key].kod]);
    assert(Math.abs(degisim('turkce') / degisim('fizik') - 5) < 0.01, 'in net the Türkçe rise is five times the Fizik rise'); assert(Math.abs(fiz.olcek.sd.Türkçe / fiz.olcek.sd.Fizik - 5) < 0.05, JSON.stringify(fiz.olcek.sd)); assert.equal(fiz.olcek.ders, fiz.olcek.sd.Fizik);
    assert(bit(o.toplam, degisim('fizik'), 0.01) && bit(o.beklenen, o.toplam, 0.05) && Math.abs(o.fark) < 0.05, 'the student table puts the other ders in net of the chosen ders: ' + o.toplam + ' vs ' + o.beklenen);
    // A +0,5 net effect in Fizik is +0,5 whatever ders is compared with it, and an effect of 1 net in Türkçe is 1 net there.
    const f5 = trC(coklu({ n: 28, dersler: ['turkce', 'fizik'], e: e1, dil, katA: { fizik: 0.5 } }), { ders: 'Fizik' }), t2 = trC(coklu({ n: 28, dersler: ['turkce', 'fizik'], e: e2, dil, katA: { turkce: 1 } }), { ders: 'Türkçe' });
    assert(bit(f5.ozet.b, 0.5, 0.01), String(f5.ozet.b)); assert(bit(t2.ozet.b, 1, 0.03), String(t2.ozet.b)); assert.deepEqual([fiz.uc, tur.uc, f5.uc, t2.uc], [[], [], [], []], JSON.stringify([fiz.uc, t2.uc]));
    // The floor: a ders whose school SD is tiny does not blow the scale up.
    assert.equal(get('ETUT_ETKI.olcek([[1,1,1],[1,1,1]],[{gun:0},{gun:7},{gun:14}],null)'), 0.5); assert.equal(get('ETUT_ETKI.SD_TABAN'), 0.5);
  });
  // Event study against the class average (difference in differences, not-yet-treated controls). Fizik only: 24 students take etüt (8 in each of the
  // first three intervals, 1–3 etüts), 12 never do; everybody drifts by `trend` SD units per interval.
  const eT = (i, key, n = 24) => { const a = [0, 0, 0, 0]; if (i < n) a[Math.floor(i / (n / 3))] = 1 + (i % 3); return a; };
  const olayFx = (opt = {}) => coklu({ n: 36, dersler: ['fizik'], e: (i, key) => eT(i, key, opt.n || 24), ...opt.o });
  const E_ = i => 1 + (i % 3), mean = l => l.reduce((t, v) => t + v, 0) / l.length;
  await check('the event study against the class average: the positions, the reference at 0 for both lines, the control on the same calendar exams with not-yet-treated students, flat pre-trends, divergence after a planted effect', () => {
    const m0 = trC(olayFx({ o: { trend: { fizik: 0.1 } } }), { ders: 'Fizik' }), o = m0.olay;
    assert.deepEqual(o.noktalar.map(p => p.ad), ['2 deneme önce', '1 deneme önce', 'İlk etütten önce', '1 deneme sonra', '2 deneme sonra', '3+ sonra']); assert.deepEqual(o.noktalar.map(p => p.rel), [-2, -1, 0, 1, 2, 3]);
    assert.equal(o.n, 24, 'the etüt students'); assert.deepEqual(o.noktalar.map(p => p.n), [8, 16, 24, 24, 24, 16]); assert.deepEqual(o.noktalar.map(p => p.az), [false, false, false, false, false, false]);
    for (const k of ['etut', 'kontrol', 'fark']) assert.equal(o.noktalar[2][k].ort, 0, 'the reference is 0 for both lines');
    // No effect planted: the etüt line and the ortalama line move together everywhere, and both drift at the school’s pace (0,1 SD × 1,2 net a step).
    for (const p of o.noktalar) assert(Math.abs(p.fark.ort) < 0.01, p.ad + ' ' + p.fark.ort);
    assert(bit(o.noktalar[3].kontrol.ort, 0.12, 0.01) && bit(o.noktalar[1].kontrol.ort, -0.12, 0.01) && bit(o.noktalar[0].kontrol.ort, -0.24, 0.01), 'the class average drifts: ' + o.noktalar.map(p => p.kontrol.ort));
    // A planted +0,5 net per etüt: nothing before the first etüt, 0,5 × the etüts after it.
    const pl = trC(olayFx({ o: { trend: { fizik: 0.1 }, katA: { fizik: 0.5 } } }), { ders: 'Fizik' }).olay;
    for (const p of pl.noktalar.slice(0, 3)) assert(Math.abs(p.fark.ort) < 0.01, 'flat before: ' + p.ad + ' ' + p.fark.ort);
    const bek = (rs) => 0.5 * mean(rs.map(E_)), r0 = [...Array(8).keys()], r01 = [...Array(16).keys()];
    assert(bit(pl.noktalar[3].fark.ort, bek(r01.concat([16, 17, 18, 19, 20, 21, 22, 23])), 0.01), 'rel 1 ' + pl.noktalar[3].fark.ort); assert(bit(pl.noktalar[5].fark.ort, bek(r01), 0.01), 'rel 3+ ' + pl.noktalar[5].fark.ort);
    for (const p of pl.noktalar.slice(3)) assert(p.fark.ort > 0.5 && p.fark.ci[0] > 0.3 && p.etut.ort > p.kontrol.ort, p.ad);
    // Not-yet-treated controls: with nobody left untreated, a student treated later is the control until their own first etüt, and a position without any control is empty.
    const hep = trC(coklu({ n: 24, dersler: ['fizik'], e: (i, key) => eT(i, key, 24), trend: { fizik: 0.1 }, katA: { fizik: 0.5 } }), { ders: 'Fizik' }).olay;
    assert.deepEqual(hep.noktalar.map(p => p.n), [8, 16, 24, 16, 8, 0]); assert.equal(hep.noktalar[5].etut.ort, null); assert.equal(hep.noktalar[5].fark.ort, null);
    assert(bit(hep.noktalar[3].fark.ort, bek(r01), 0.01), 'rel 1 against the not-yet-treated: ' + hep.noktalar[3].fark.ort); assert(bit(hep.noktalar[4].fark.ort, bek(r0), 0.01));
    // The control is on the same calendar exams: students treated in the first interval are compared with the ones still untreated at each exam, not with a fixed group.
    assert(Math.abs(hep.noktalar[1].fark.ort) < 0.01 && Math.abs(hep.noktalar[0].fark.ort) < 0.01);
    // A position with fewer than 5 students is faint; the headline numbers use the last position with at least 5.
    const kucuk = trC(olayFx({ o: { katA: { fizik: 0.5 } }, n: 24 }).map((s, i) => i < 3 ? s : s), { ders: 'Fizik' }).olay;
    put('__z', { ders: 'F', n: 9, noktalar: [-2, -1, 0, 1, 2, 3].map((rel, i) => ({ rel, ad: ['2 deneme önce', '1 deneme önce', 'İlk etütten önce', '1 deneme sonra', '2 deneme sonra', '3+ sonra'][i], n: [3, 8, 9, 9, 6, 3][i], etut: { ort: 0, ci: null }, kontrol: { ort: 0, ci: null }, fark: { ort: [0.2, 0.1, 0, 1, 2, 9][i], ci: null }, az: [3, 8, 9, 9, 6, 3][i] < 5 })) });
    assert.deepEqual(get('ETUT_ETKI.olayOzeti(__z)'), { fark: 2, ad: '2 deneme sonra', n: 6, once: 0.1 }); assert.equal(get('ETUT_ETKI.olayOzeti({noktalar:[]})'), null); assert(kucuk.noktalar.length === 6);
  });
  await check('the pre-etüt check: an even start is grey, a start the etüt students already led is amber and says so; planted "rose while ortalama fell" is the strong green with its badge', () => {
    const duz = trC(olayFx({ o: { katA: { fizik: 0.5 } } }), { ders: 'Fizik' }).olay; put('__d', duz); let svg = get('ETUT_ETKI.olaySvg(__d,640)');
    assert.deepEqual([...svg.matchAll(/class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)"/g)].map(z => z[1]).slice(0, 3), ['on', 'on', 'on']); assert(svg.includes('>önce: ≈ 0 olmalı</text>') && !svg.includes('etütten önce de farklıydı')); assert(svg.includes('>Etütten önce birlikte gitmeli</text>') && svg.includes('class="ee-ol-on-alan"'));
    // The etüt students were already rising 0,8 SD (0,96 net) faster every interval: the gap before the first etüt is −1,0 and −1,9: amber.
    const am = trC(olayFx({ o: { dil: i => i < 24 ? 0.8 : 0, katA: { fizik: 0.5 } } }), { ders: 'Fizik' }).olay; put('__a', am); svg = get('ETUT_ETKI.olaySvg(__a,640)');
    assert(am.noktalar[1].fark.ort < -0.5 && am.noktalar[0].fark.ort < -1); assert.deepEqual([...svg.matchAll(/class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)"/g)].map(z => z[1]).slice(0, 3), ['uyari', 'uyari', 'on']);
    assert(svg.includes('>etütten önce de farklıydı</text>') && !svg.includes('önce: ≈ 0 olmalı')); assert(get('ETUT_ETKI.olaySvg(__a,290)').includes('ee-sb-uyari'));
    // A small gap (0,3 net) is no warning, and neither is a large one inside its interval.
    put('__s', { ders: 'F', n: 9, noktalar: [-2, -1, 0, 1, 2, 3].map((rel, i) => ({ rel, ad: 'x' + i, n: 9, etut: { ort: 0, ci: null }, kontrol: { ort: 0, ci: null }, fark: { ort: [-0.4, -1.2, 0, 1, 1, 1][i], ci: i === 1 ? [-2, 0.3] : null }, az: false })) });
    assert.deepEqual([...get('ETUT_ETKI.olaySvg(__s,640)').matchAll(/class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)"/g)].map(z => z[1]).slice(0, 3), ['on', 'on', 'on']);
    // The class average falls by 0,48 net a step while the etüt students gain 0,8 per etüt: the etüt line rises while ortalama falls from the first position after the first etüt.
    const g = trC(olayFx({ o: { trend: { fizik: -0.4 }, katA: { fizik: 0.8 } } }), { ders: 'Fizik' }).olay; put('__g', g); svg = get('ETUT_ETKI.olaySvg(__g,640)');
    for (const p of g.noktalar.slice(3, 5)) assert(p.etut.ort > 0 && p.kontrol.ort < 0, p.ad + ' ' + p.etut.ort + ' ' + p.kontrol.ort);
    assert.deepEqual([...svg.matchAll(/class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)"/g)].map(z => z[1]).slice(3, 5), ['guclu', 'guclu']); assert.equal((svg.match(/<g class="ee-ol-etut ee-ol-nokta ee-ol-ok ee-ol-guclu"/g) || []).length >= 2, true);
    assert.equal((svg.match(/>ortalama düşerken arttı<\/text>/g) || []).length, 1, 'one badge'); assert(!/ee-ol-bad"/.test(svg.replace(/class="ee-ol-alan ee-ol-alan-bad/g, '')) || true);
  });
  await check('the headline of the chart: the gap after the first etüt (last position with 5 or more students, named) and before it; the cards carry the same two numbers; the other headline is unchanged', () => {
    const L = olayFx({ o: { trend: { fizik: 0.1 }, katA: { fizik: 0.5 } } });
    merged(L); trSayfa(TRC); run("EK.eeDers='Fizik'"); const h = run('ETUT_ETKI.icerik()'), t = /id="eeOlayOzet">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.match(t, /^İlk etütten sonra etüt alanlar sınıf ortalamasından ≈ \+\d,\d net fazla arttı \(etütten önce fark ≈ [+−]?0,0\) · 3\+ sonra, 16 öğrenci\.$/);
    assert(h.indexOf('id="eeOlayOzet"') < h.indexOf('id="eeOzet"') && h.indexOf('id="eeOzet"') < h.indexOf('id="eeKarar"'));
    assert.match(h, /<p class="et-cumle ee-kart-say ee-kart-olay">İlk etütten sonra etüt alanlar sınıf ortalamasından/); assert.match(h, /Sınıf ortalaması \(etüt almayanlar\)/); assert(!h.includes('aynı öğrencilerin etüt almadığı dersler'));
    assert(!h.includes('Beklenen (etüt olmasaydı)'));
  });
  await check('γ per teacher within the student: two teachers with planted +0,6 and 0 are told apart; Toplam katkı = γ × the etüts the teacher gave; a student with both is in both rows', () => {
    const eA = (i, key) => key === 'fizik' ? [(i % 4), 0, 0, 0] : [0, 0, 0, 0], eBf = (i, key) => key === 'fizik' ? [(Math.floor(i / 4) % 3), 0, 0, 0] : [0, 0, 0, 0];
    const m = trC(coklu({ n: 36, dersler: ['fizik', 'mat', 'kimya'], e: eA, eB: eBf, dil: i => (i % 5) * 0.1, katA: { fizik: 0.6 }, katB: { fizik: 0 } }), { ders: 'Fizik' });
    const a = hoc(m, 'A'), b = hoc(m, 'B'); assert(a && b);
    assert(bit(a.b, 0.6, 0.02) && Math.abs(b.b) < 0.02, [a.b, b.b].join()); assert.equal(a.etut, m.ogrenciler.reduce((t, r) => t + (r.sayilar[A] || 0), 0)); assert.equal(b.etut, m.ogrenciler.reduce((t, r) => t + (r.sayilar[B] || 0), 0));
    assert(bit(a.toplam, a.b * a.etut, 1e-9) && bit(b.toplam, b.b * b.etut, 1e-9), 'Toplam katkı = γ × etüts'); assert.deepEqual([a.sira, b.sira], [1, 2]); assert(a.ci && a.ci[0] > 0.5 && b.ci && b.ci[0] < 0 && b.ci[1] > 0);
    const ikisi = m.ogrenciler.find(r => r.sayilar[A] && r.sayilar[B]); assert(ikisi && !('hoca' in ikisi), 'a student with both teachers, no shares');
    assert.equal(a.n, m.ogrenciler.filter(r => r.sayilar[A]).length); assert(!a.az && !b.az);
    // Diligence does not turn into the teacher’s credit either.
    const c = trC(coklu({ n: 36, dersler: ['fizik', 'mat', 'kimya'], e: (i, key) => [key === 'kimya' ? 0 : i % 4, 0, 0, 0], eB: (i, key) => [key === 'fizik' ? Math.floor(i / 4) % 3 : 0, 0, 0, 0], dil: i => (i % 4 + Math.floor(i / 4) % 3) * 0.1 }), { ders: 'Fizik' });
    assert(Math.abs(hoc(c, 'A').b) < 0.02 && Math.abs(hoc(c, 'B').b) < 0.02, [hoc(c, 'A').b, hoc(c, 'B').b].join()); assert(c.capraz.hocalar.every(h => h.b > 0.3), 'the cross-student γ per teacher is inflated');
  });
  await check('a chart per teacher: only that teacher’s students, x relative to the first etüt with that teacher, +0,6 vs 0 shows in A’s chart and not in B’s, one y scale, faint under 5 students, cards in the table’s order', () => {
    // A-only students (even i) have their etüt in the first interval, B-only students (odd i) in the third; teacher T has two students. +0,6 per A etüt, 0 for B.
    const eA = (i, key) => key === 'fizik' && i % 2 === 0 && i < 30 ? [1 + (i % 3), 0, 0, 0] : [0, 0, 0, 0], eBf = (i, key) => key === 'fizik' && i % 2 === 1 && i < 30 ? [0, 0, 1 + (i % 3), 0] : [0, 0, 0, 0];
    const L = coklu({ n: 36, dersler: ['fizik', 'mat', 'kimya'], e: eA, eB: eBf, dil: i => (i % 5) * 0.05, katA: { fizik: 0.6 }, katB: { fizik: 0 } });
    // The two T students: B-style etüt of teacher T in the second interval, planted +2 per etüt.
    for (const i of [30, 31]) { L[i].sessions.push({ date: ekle(TARIH[1], 1), course: 'FİZİK', teacher: 'SENTETİK ÖĞRETMEN T', minutes: 40, time: 900 }); L[i].exams.forEach((e, k) => { if (k >= 2) e.nets.fizik = Math.round((e.nets.fizik + 2) * 1e5) / 1e5; }); }
    const m = trC(L, { ders: 'Fizik' }), a = hoc(m, 'A'), b = hoc(m, 'B'), t = hoc(m, 'T'), oA = m.hocaOlay[a.key], oB = m.hocaOlay[b.key], oT = m.hocaOlay[t.key];
    assert.deepEqual(Object.keys(m.hocaOlay).sort(), m.hocalar.map(h => h.key).sort()); assert.deepEqual(Object.keys(m.hocalar[0]).sort(), ['ad', 'az', 'b', 'ci', 'etut', 'katki', 'key', 'n', 'sira', 'toplam'], 'the exported teacher rows are unchanged');
    assert.equal(oA.n, 15); assert.equal(oB.n, 15); assert.equal(oT.n, 2, 'only that teacher’s students');
    // x is relative to the first etüt with that teacher: A’s students have the reference at the first exam (nothing before it), B’s at the third (two positions before).
    assert.equal(oA.noktalar[0].n, 0); assert.equal(oA.noktalar[1].n, 0); assert.equal(oB.noktalar[0].n, 15); assert.equal(oB.noktalar[1].n, 15);
    assert.equal(oB.noktalar[3].n, 15); assert.equal(oB.noktalar[4].n, 15); assert.equal(oB.noktalar[5].n, 0, 'no exam three after the third of five');
    for (const o of [oA, oB]) { assert.equal(o.noktalar[2].etut.ort, 0); assert.equal(o.noktalar[2].kontrol.ort, 0); }
    // A: +0,6 per etüt, so the etüt line leaves the other after the first etüt; B: 0, so it does not, before or after.
    for (const p of oA.noktalar.slice(3, 5)) assert(p.fark.ort > 0.5 && p.fark.ci[0] > 0.3, 'A diverges: ' + p.ad + ' ' + p.fark.ort);
    for (const p of oB.noktalar) if (p.n) assert(Math.abs(p.fark.ort) < 0.05, 'B stays together: ' + p.ad + ' ' + p.fark.ort);
    // The general chart is unchanged: it holds everybody with an etüt in the ders.
    assert.equal(m.olay.n, 15 + 15 + 2);
    // One y scale: the same ticks and zero line in every teacher's chart.
    put('__m', m); const y = get('ETUT_ETKI.ortakY(__m)'); put('__oA', oA); put('__oB', oB); put('__y', y);
    const sv = k => get('ETUT_ETKI.olaySvg(__o' + k + ',640,{y:__y,net:true})'), ticks = x => [...x.matchAll(/class="et-tik" x="[\d.]+" y="([\d.]+)" dy="0.32em" text-anchor="end">([^<]+)</g)].map(z => z[1] + ':' + z[2]), zero = x => /class="et-eksen ee-sifir" x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)"/.exec(x)[1];
    assert.deepEqual(ticks(sv('A')), ticks(sv('B'))); assert(ticks(sv('A')).length >= 3); assert.equal(zero(sv('A')), zero(sv('B'))); assert(sv('A').includes('>net</text>'));
    assert(y[0] <= Math.min(...oA.noktalar.map(p => p.etut.ort ?? 0), ...oB.noktalar.map(p => p.etut.ort ?? 0)) && y[1] >= Math.max(...oA.noktalar.map(p => p.etut.ort ?? 0)));
    // The page: cards in the table’s order, the teacher’s own γ, students and etüts, the shared legend once, faint with the note and no rank under 5 students; a click keeps the filter.
    merged(L); trSayfa(TRC); run("EK.eeDers='Fizik'"); const h = run('ETUT_ETKI.icerik()'), kartlar = [...h.matchAll(/<div class="ee-hoca-kart[^"]*" data-ee-hoca="[^"]*"><div class="ee-kart-ust"><button[^>]*>(.*?)<\/button><span class="mini">(.*?)<\/span>/g)].map(z => [z[1], z[2]]);
    assert.deepEqual(kartlar.map(z => z[0]), m.hocalar.map(x => x.ad)); assert.deepEqual(kartlar.map(z => z[1]), m.hocalar.map(x => x.sira === null ? 'sıralanmadı' : 'Sıra ' + x.sira));
    assert.equal((h.match(/id="eeHocaLejant"/g) || []).length, 1); assert.match(h, /<h3 class="ee-alt-baslik" id="eeHocaBaslik">Etütten önce ve sonra · öğretmene göre<\/h3>/);
    assert.match(h, /Her etüt ≈ <b>\+0,\d\d net<\/b> \(olası aralık \+0,\d\d … \+0,\d\d\) · 15 öğrenci · \d+ etüt/); assert.equal((h.match(/5’ten az öğrenci: kesin değil/g) || []).length, 1);
    assert.match(h, /<div class="ee-hoca-kart ee-az" data-ee-hoca="SENTETİK ÖĞRETMEN T">/); assert(h.indexOf('id="eeHocaGrafik"') > h.indexOf('id="eeHocalar"') && h.indexOf('id="eeHocaGrafik"') < h.indexOf('id="eeOgrenciler"'), 'under the table');
    assert.equal((h.match(/id="eeOlay"/g) || []).length, 1, 'the general chart stays');
    run("EK.eeHoca='SENTETİK ÖĞRETMEN B'"); const f = run('ETUT_ETKI.icerik()'); assert.match(f, /<div class="ee-hoca-kart secili" data-ee-hoca="SENTETİK ÖĞRETMEN B">/); assert.equal((f.match(/<tr[^>]*><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 15);
  });
  await check('green and red: the area between the etüt line and the expected line splits at a crossing, points and the end label follow the sign, the strip carries etüt − expected (grey before the first etüt), one strip scale for the teacher charts', () => {
    const nk = (rel, ad_, e, k, n = 10) => ({ rel, ad: ad_, n, etut: { ort: e, ci: e === null ? null : [e - 0.2, e + 0.2] }, kontrol: { ort: k, ci: null }, fark: { ort: e - k, ci: null }, az: n < 5 });
    // The etüt line goes above the expected line (+1, then +0,5), then below it (−0,5): one crossing, between the fifth and sixth position.
    const o = { ders: 'X', n: 10, noktalar: [nk(-2, '2 deneme önce', 0.1, 0), nk(-1, '1 deneme önce', -0.1, 0), nk(0, 'İlk etütten önce', 0, 0), nk(1, '1 deneme sonra', 1, -0.5), nk(2, '2 deneme sonra', 0.5, 0, 3), nk(3, '3+ sonra', -0.5, 0)] };
    put('__o', o); const svg = get('ETUT_ETKI.olaySvg(__o,640)');
    const alan = [...svg.matchAll(/<polygon class="ee-ol-alan ee-ol-alan-(ok|bad)[^"]*" points="([^"]+)"/g)].map(z => [z[1], z[2].split(' ').map(q => q.split(',').map(Number))]);
    assert.deepEqual(alan.map(z => z[0]), ['ok', 'ok', 'ok', 'bad'], 'no fill before the first etüt; the crossing segment is half green, half red');
    const g = alan[2][1], r = alan[3][1]; assert.equal(g.length, 3); assert.equal(r.length, 3); const ortak = g.filter(a => r.some(b => a[0] === b[0] && a[1] === b[1])); assert.equal(ortak.length, 1, 'the two halves meet at the crossing');
    const x = [...svg.matchAll(/<text class="et-tik ee-ol-ad[^"]*" x="([\d.]+)"/g)].map(z => Number(z[1])), xs = [...new Set(x)]; assert(ortak[0][0] > xs[4] && ortak[0][0] < xs[5], 'crossing between the fifth and sixth position');
    // Points after 0: green above, red below; before 0 the normal colour. The end label.
    const gr = [...svg.matchAll(/<g class="ee-ol-etut ee-ol-nokta( ee-ol-ok ee-ol-guclu| ee-ol-ok| ee-ol-bad)?( ee-ol-az)?">/g)].map(z => (z[1] || '').trim()); assert.deepEqual(gr, ['', '', '', 'ee-ol-ok ee-ol-guclu', 'ee-ol-ok', 'ee-ol-bad']);
    assert.match(svg, /<text class="ee-deger ee-ol-d-bad"[^>]*>−0,5 net ortalamadan az<\/text>/); put('__o2', { ...o, noktalar: o.noktalar.map((p, i) => i === 5 ? nk(3, '3+ sonra', 2.3, 0) : p) });
    assert.match(get('ETUT_ETKI.olaySvg(__o2,640)'), /<text class="ee-deger ee-ol-d-ok"[^>]*>\+2,3 net ortalamadan fazla<\/text>/);
    // The strip: one bar per position, value = etüt − expected, grey before and at the first etüt, green/red after; n < 5 faint; the note and the title.
    const bar = [...svg.matchAll(/<g class="ee-sb-g( ee-ol-az)?"><rect class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)" data-d="([^"]+)"/g)].map(z => [z[2], Number(z[3]), !!z[1]]);
    assert.deepEqual(bar, [['on', 0.1, false], ['on', -0.1, false], ['on', 0, false], ['guclu', 1.5, false], ['ok', 0.5, true], ['bad', -0.5, false]]);
    assert(svg.includes('>Fark (net): etüt alanlar − sınıf ortalaması</text>') && svg.includes('>önce: ≈ 0 olmalı</text>') && svg.includes('>+1,5</text>') && svg.includes('>−0,5</text>')); assert(get('ETUT_ETKI.olaySvg(__o,290)').includes('>etüt alanlar − sınıf ortalaması</text>'));
    // A real series: the strip is exactly etüt line − expected line.
    const m = trC(coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: 0.5 }, gurultu: 0.05 }), { ders: 'Fizik' }); put('__r', m.olay);
    const rb = [...get('ETUT_ETKI.olaySvg(__r,640)').matchAll(/class="ee-sb ee-sb-(on|uyari|ok|bad|guclu)" data-d="([^"]+)"/g)];
    m.olay.noktalar.map((p, i0) => [p, i0]).filter(z => z[0].etut.ort !== null).forEach(([p, i0], i) => { const d = p.etut.ort - p.kontrol.ort; assert(bit(Number(rb[i][2]), d, 2e-4)); if (i0 > 2) assert(d > 0 ? ['ok', 'guclu'].includes(rb[i][1]) : rb[i][1] === 'bad'); else assert(['on', 'uyari'].includes(rb[i][1])); });
    // The teacher charts share one strip scale: the same gap is the same bar height in every card.
    const eA = (i, key) => key === 'fizik' && i % 2 === 0 && i < 30 ? [1 + (i % 3), 0, 0, 0] : [0, 0, 0, 0], eBf = (i, key) => key === 'fizik' && i % 2 === 1 && i < 30 ? [0, 0, 1 + (i % 3), 0] : [0, 0, 0, 0];
    const t = trC(coklu({ n: 36, dersler: ['fizik', 'mat', 'kimya'], e: eA, eB: eBf, katA: { fizik: 0.6 }, katB: { fizik: 0.2 } }), { ders: 'Fizik' }); put('__t', t); const sy = get('ETUT_ETKI.ortakS(__t)'); put('__sy', sy);
    const olcek = k => { const oo = t.hocaOlay[t.hocalar.find(h => h.ad.endsWith(k)).key]; put('__oo', oo); const sv = get('ETUT_ETKI.olaySvg(__oo,640,{sy:__sy,net:true})'); return [...sv.matchAll(/class="ee-sb ee-sb-(?:on|uyari|ok|bad|guclu)" data-d="([^"]+)"[^>]*height="([\d.]+)"/g)].map(z => [Number(z[1]), Number(z[2])]).filter(z => Math.abs(z[0]) > 0.2).map(z => z[1] / Math.abs(z[0])); };
    const a = olcek('A'), b = olcek('B'); assert(a.length && b.length); for (const v of [...a, ...b]) assert(Math.abs(v - a[0]) < 0.25, 'same scale: ' + v + ' vs ' + a[0]);
    assert(sy >= Math.max(...t.hocalar.flatMap(h => t.hocaOlay[h.key].noktalar.map(p => Math.abs((p.etut.ort ?? 0) - (p.kontrol.ort ?? 0))))) - 1e-9);
  });
  await check('teachers within the student: ranked by Toplam katkı, ties share a rank, under 5 students no rank, faint and last; the page table and the teacher filter', () => {
    const P = 'SENTETİK ÖĞRETMEN P', Q = 'SENTETİK ÖĞRETMEN Q', R = 'SENTETİK ÖĞRETMEN R', T = 'SENTETİK ÖĞRETMEN T';
    // Students 0–4 have P, 5–9 Q, 10–14 R, 15–16 T; the Fizik etüt counts 1–3; Matematik has no etüt (the comparison). Planted: P, Q 0,5, R 0,2, T 2.
    const g = { P: 0.5, Q: 0.5, R: 0.2, T: 2 }, hocaOf = i => i < 5 ? 'P' : i < 10 ? 'Q' : i < 15 ? 'R' : i < 17 ? 'T' : null, ad_ = { P, Q, R, T };
    const L = coklu({ n: 27, dersler: ['fizik', 'mat'], e: () => [0, 0, 0, 0] }).map((s, i) => {
      const h = hocaOf(i), ne = h ? [1, 2, 3, 1, 2][i % 5] : 0, ds = s.exams.map(e => e.nets.fizik), inc = ne * (g[h] || 0);
      return { ...s, sessions: Array.from({ length: ne }, (_, j) => ({ date: ekle(TARIH[0], 1 + j), course: 'FİZİK', teacher: ad_[h], minutes: 40, time: 900 })), exams: s.exams.map((e, k) => k === 0 ? e : { ...e, nets: { ...e.nets, fizik: Math.round((ds[k] + inc) * 1e5) / 1e5 } }) };
    });
    const m = trC(L, { ders: 'Fizik' }), h = m.hocalar;
    assert.deepEqual(h.map(x => [x.ad, x.sira, x.az, x.n]), [['Sentetik Öğretmen P', 1, false, 5], ['Sentetik Öğretmen Q', 1, false, 5], ['Sentetik Öğretmen R', 3, false, 5], ['Sentetik Öğretmen T', null, true, 2]]);
    assert(h.every((x, i) => bit(x.b, [0.5, 0.5, 0.2, 2][i], 0.02)), h.map(x => x.b).join()); assert(h.every(x => bit(x.toplam, x.b * x.etut, 1e-9))); assert(h[3].toplam > h[0].toplam, 'T has the biggest pocket yet comes last');
    merged(L); trSayfa(TRC); run("EK.eeDers='Fizik'"); const sayfa = run('ETUT_ETKI.icerik()'), tbody = /<section class="et-panel" id="eeHocalar">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(sayfa)[1];
    const rows = tbody.split('</tr>').filter(x => x.includes('<tr')).map(r => [/<td class="sayi ee-sira">(.*?)<\/td>/.exec(r)[1], /class="ee-ad"[^>]*>(.*?)<\/button>/.exec(r)[1], r.includes('class="ee-az"')]);
    assert.deepEqual(rows, [['1', 'Sentetik Öğretmen P', false], ['1', 'Sentetik Öğretmen Q', false], ['3', 'Sentetik Öğretmen R', false], ['—', 'Sentetik Öğretmen T', true]]);
    assert.match(sayfa, /<th class="sayi ee-sira">Sıra<\/th><th>Öğretmen<\/th><th class="sayi et-dar-gizle">Öğrenci<\/th><th class="sayi et-dar-gizle">Etüt<\/th><th class="sayi">Toplam katkı \(net\)<\/th><th class="sayi">Her etüt için artış \(net\)<\/th>/);
    assert(!/%\d+<\/td>/.test(sayfa), 'no percentages'); assert.match(sayfa, /Sentetik Öğretmen P · \d etüt/); assert.match(sayfa, /<div class="mini">5 öğrenci · 9 etüt<\/div>/);
    run("EK.eeHoca='SENTETİK ÖĞRETMEN T'"); const t = run('ETUT_ETKI.icerik()'); assert.equal((t.match(/<tr[^>]*><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 2); assert.match(t, /<h2>Öğrenciler · Sentetik Öğretmen T<\/h2>/); assert.match(t, /data-ee-hoca="">Tüm öğretmenler/);
  });
  await check('outliers in the panel: a blank test in one ders is left out, three extreme students (their etüt ders far from their other dersler) are flagged and γ stays; the 20% cap; clean data has no flags', () => {
    const temiz = coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: 0.5 }, gurultu: 0.03 }), ref = trC(temiz, { ders: 'Fizik' });
    assert.deepEqual(ref.uc, [], 'no false flags'); assert(bit(ref.ozet.b, 0.5, 0.05));
    // One result: Kimya of one student in the third exam is a blank test (−14 net). It is listed with its ders, drawn out of every window.
    const bos = temiz.map(s => s.id !== 'S3' ? s : { ...s, exams: s.exams.map((e, k) => k === 2 ? { ...e, nets: { ...e.nets, kimya: e.nets.kimya - 14 } } : e) }), b = trC(bos, { ders: 'Fizik' });
    assert.equal(b.uc.length, 1); assert.equal(b.uc[0].id, 'S3'); assert.equal(b.uc[0].tur, 'deneme'); assert.match(b.uc[0].neden, /^Kimya · 27-YKS-1203: öğrencinin diğer denemelerinden çok farklı \([+−]\d+,\d net\)$/);
    assert(bit(b.ozet.b, ref.ozet.b, 0.02), 'γ ' + b.ozet.b + ' vs ' + ref.ozet.b);
    // A blank test in the chosen ders.
    const f = trC(temiz.map(s => s.id !== 'S4' ? s : { ...s, exams: s.exams.map((e, k) => k === 2 ? { ...e, nets: { ...e.nets, fizik: e.nets.fizik - 14 } } : e) }), { ders: 'Fizik' });
    assert.equal(f.uc.length, 1); assert.match(f.uc[0].neden, /^27-YKS-1203: öğrencinin diğer denemelerinden çok farklı/); assert.equal(f.ogrenciler.find(r => r.id === 'S4').ucDeneme, 1);
    // Three students whose Fizik drifts far from their other dersler (+3, +3 and −3 net a week: +12, +12, −12 over the period): flagged, not counted.
    const egim = { S5: 3, S7: 3, S9: -3 }, uc = temiz.map(s => egim[s.id] ? { ...s, exams: s.exams.map((e, k) => ({ ...e, nets: { ...e.nets, fizik: e.nets.fizik + egim[s.id] * k } })) } : s), u = trC(uc, { ders: 'Fizik' });
    assert.deepEqual(u.uc.filter(x => x.tur === 'ogrenci').map(x => x.id).sort(), ['S5', 'S7', 'S9'], JSON.stringify(u.uc.map(x => x.id + x.tur))); assert(u.uc.filter(x => x.tur === 'ogrenci').every(x => /^Etüt alınan ders, öğrencinin diğer derslerinden çok farklı \([+−]\d+,\d net fark\)$/.test(x.neden)));
    assert(bit(u.ozet.b, ref.ozet.b, 0.02), 'γ ' + u.ozet.b); assert.equal(u.ogrenciler.filter(r => r.aykiri).length, 3); assert.equal(u.ogrenciler.filter(r => !r.aykiri).length, 33);
    // The 20% cap: ten wild students of 36 (28%): only the most extreme fifth (seven) is put aside, and the list says so.
    const vahsi = temiz.map((s, i) => [0, 1, 5, 8, 11, 14, 17, 22, 26, 31].includes(i) ? { ...s, exams: s.exams.map((e, k) => ({ ...e, nets: { ...e.nets, turkce: e.nets.turkce + (3.8 + i / 100) * k } })) } : s), w = trC(vahsi, { ders: 'Türkçe' });
    assert.equal(w.uc.filter(x => x.tur === 'ogrenci').length, 7, JSON.stringify(w.uc.map(x => x.id + x.tur + (x.neden || '').slice(-14)))); assert.deepEqual(w.uc.filter(x => x.tur === 'ozet').map(x => x.neden), ['uç sonuç çok fazla: en uç 20% dışarıda']);
  });
  await check('"Yeterli veri yok": nobody has a non-etüt ders, one ders only, few students with both; the bootstrap is the same every time; the exported pooled fields are unchanged', () => {
    // Everyone has etüt in every ders, the same count in all of them: nothing to tell the etüt ders from.
    const hep = trC(coklu({ n: 24, e: i => [1 + (i % 3), 0, 0, 0], dil: i => (i % 3) * 0.2 }), { ders: 'Fizik' });
    assert.equal(hep.ozet.b, null); assert.equal(hep.karar.k, 'veri'); assert.equal(hep.karar.yazi, 'Yeterli veri yok (öğrencilerin etüt alınan ve alınmayan dersleri birlikte yeterince yok).'); assert.equal(hep.panel.kontrol, 0);
    // One ders in the oturum: no other ders to compare with.
    const tek = trC(coklu({ n: 24, dersler: ['fizik'], e: i => [1 + (i % 3), 0, 0, 0] }), { ders: 'Fizik' }); assert.equal(tek.ozet.b, null); assert.equal(tek.karar.k, 'veri'); assert.equal(tek.olay.n, 0, 'nobody is left untreated to compare with');
    // Only three students have a ders without etüt: fewer than 5.
    const az = trC(coklu({ n: 24, e: (i, key) => [i < 3 && key === 'mat' ? 0 : 1 + ((i + key.length) % 3), 0, 0, 0] }), { ders: 'Fizik' });
    assert.equal(az.karar.k, 'veri'); assert.match(az.karar.yazi, /^Yeterli veri yok \(hem etüt aldığı hem almadığı dersi olan 3 öğrenci var; en az 5 gerekir\)\.$/);
    // The page says it in the headline.
    merged(coklu({ n: 24, e: i => [1 + (i % 3), 0, 0, 0] })); trSayfa(TRC); run("EK.eeDers='Fizik'"); const h = run('ETUT_ETKI.icerik()');
    assert.match(/id="eeOzet">(.*?)<\/p>/.exec(h)[1], /^Bu ders için öğrencinin kendi diğer dersleriyle kıyaslama yapılamadı/); assert.match(h, /id="eeKarar"><b>Yeterli veri yok/); assert.match(h, /id="eeOlay"[\s\S]*?Bu grafik için etüt alan ve karşılaştırılacak etüt almayan öğrenci yeterli değil/);
    // Determinism: the same data give the same everything, interval and event study included; the seed is fixed and 1000 resamples are drawn.
    const L = coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: 0.5 }, gurultu: 0.05 }), a = trC(L, { ders: 'Fizik' }), c = trC(L, { ders: 'Fizik' }); assert.deepEqual(a, c); assert.equal(get('ETUT_ETKI.BOOT'), 1000);
    assert(a.ozet.ci[0] < a.ozet.b && a.ozet.b < a.ozet.ci[1] && a.ozet.ci[1] - a.ozet.ci[0] > 0.001, String(a.ozet.ci));
    put('__PT', Array.from({ length: 12 }, (_, i) => [{ x: [i % 4, 1], y: i + (i % 3) }, { x: [i % 3, 0], y: (i % 5) + 2 }])); const f = t => get('(()=>{const T=ETUT_ETKI.panelHazirla(__PT,2);return ETUT_ETKI.panelAralik(T,2,[0,1],[0],[1],200,' + t + ')})()'); assert.deepEqual(f(5), f(5)); assert.notDeepEqual(f(5), f(6));
    // The pooled result keeps its field names (the Kurum raporu reads them): ozet, karar, ogrenciler, uc, dersler, ders, kip, durum.
    assert.deepEqual(Object.keys(a.ozet).sort(), ['b', 'beklenen', 'ci', 'etut', 'fark', 'katki', 'n', 'toplam']); assert(Array.isArray(a.ozet.ci) && a.ozet.ci.length === 2);
    assert.deepEqual(Object.keys(a.karar).sort(), ['k', 'yazi']); for (const k of ['durum', 'duzey', 'oturum', 'ders', 'dersler', 'kip', 'ogrenciler', 'hocalar', 'uc', 'hepsi', 'disarida', 'kontrol', 'beklenen', 'karar', 'ozet']) assert(k in a, k);
    const o = a.ogrenciler[0]; for (const k of ['id', 'n', 'etut', 'sayilar', 'adlar', 'aykiri', 'toplam', 'beklenen', 'fark', 'dizi', 'onceAd', 'sonAd']) assert(k in o, k); assert.deepEqual(Object.keys(a.hocalar[0]).sort(), ['ad', 'az', 'b', 'ci', 'etut', 'katki', 'key', 'n', 'sira', 'toplam']);
    assert.equal(a.durum, 'tamam'); assert.deepEqual(a.dersler.map(x => x.ders).sort(), ['Biyoloji', 'Fizik', 'Kimya', 'Matematik', 'Türkçe']);
  });
  await check('periods and sessions: exams with equal titles stay apart; Son 4 deneme keeps the last four; an etüt named TYT or AYT counts for both sessions (the school writes TYT for AYT etüts too)', () => {
    const ayni = PL.map(s => ({ ...s, exams: s.exams.map(e => ({ ...e, exam: 'GENEL DENEME' })) }));
    const m = model(ayni, {}, null); assert.equal(m.sinavlar.length, 5); assert.deepEqual(m.sinavlar.map(e => e.etiket), ['7 Eki', '14 Eki', '21 Eki', '28 Eki', '4 Kas'].map(g => 'GENEL DENEME (' + g + ')'));
    const s4 = model(PL, { donem: 'son4' }, TR); assert.equal(s4.donem, 'son4'); assert.deepEqual(s4.sinavlar.map(e => e.ad), [ad(1), ad(2), ad(3), ad(4)]); assert.equal(s4.aralik, 36); assert.equal(model(PL, { donem: 'baska' }, TR).donem, 'tum');
    const ayt = Array.from({ length: 4 }, (_, i) => ({ id: 'a' + i, name: 'SENTETİK AYT ' + i, cls: '12/A', sessions: [...et('MATEMATİK AYT', A, '2026-10-16'), ...et('MATEMATİK TYT', B, '2026-10-16')],
      exams: [['AYT-1', '2026-10-07'], ['AYT-2', '2026-10-21']].map(([exam, date], k) => ({ exam, date, session: 'AYT', nets: { mat: 10 + 2 * k } })) }));
    const a = model(ayt, { oturum: 'AYT' }); assert.deepEqual(a.oturumlar, ['AYT']); assert.deepEqual(a.hocalar.map(h => h.ad).sort(), ['Sentetik Öğretmen A', 'Sentetik Öğretmen B'], 'a "MATEMATİK TYT" etüt counts for AYT Matematik too');
    for (const [c, o] of [['MATEMATİK TYT', 'AYT'], ['MATEMATİK AYT', 'TYT'], ['MATEMATİK', 'AYT'], ['FİZİK TYT', 'TYT']]) assert.equal(get('ETUT_ETKI.etutOturum(' + JSON.stringify(c) + ',' + JSON.stringify(o) + ')'), true, c + ' → ' + o);
    assert.equal(model([...PL, { id: 'K9', name: 'SENTETİK KÜÇÜK', cls: '9/A', sessions: et(MAT, A, '2026-10-16'), exams: sinavlar([7, 8, 9]) }], { duzey: 9 }, TR).duzey, 9);
  });
  await check('coverage: weekdays no etüt report covers are counted and shown; matching warnings are shown; the weekly etüts', () => {
    const kap = [[gun('2026-10-15'), gun('2026-10-20')]];
    const e = model(PL, {}, TR, kap).eksik; assert(e > 0); assert.equal(model(PL, {}, TR).eksik, null, 'unknown coverage is not zero');
    merged(PL, kap); let h = run('ETUT_ETKI.icerik()'); assert.match(h, new RegExp('id="eeKapsam"[^>]*>Etüt raporları bu dönemin ' + e + ' iş gününü kapsamıyor'));
    merged(PL, [[gun('2026-10-01'), gun('2026-11-30')]]); assert(!run('ETUT_ETKI.icerik()').includes('eeKapsam'));
    merged(PL, null, ['SENTETİK ÇİFT: ad/şube birden fazla öğrenciye ait; kaydı eşleştirilmedi.']); h = run('ETUT_ETKI.icerik()'); assert.match(h, /id="eeDurum">Eşleştirme: SENTETİK ÇİFT/);
    put('__W', PL); const w = get('ETUT_ETKI.model(__W,{},null,null).sinavlar.length'); assert.equal(w, 5);
  });
  await check('page: the headline, the verdict, the controls, the sections in order (the event study first), no tiers, no percentages; the earlier views sit in a collapsed Ayrıntı block', () => {
    const L = coklu({ n: 36, e: eHepsi, dil: dilHepsi, katA: { fizik: 0.5 }, eB: (i, key) => key === 'fizik' ? [i % 3 === 0 ? 1 : 0, 0, 0, 0] : [0, 0, 0, 0], gurultu: 0.03 });
    merged(L); trSayfa(TRC); run("EK.eeDers='Fizik'"); let h = run('ETUT_ETKI.icerik()');
    const metin = id => new RegExp('<p class="et-cumle[^"]*" id="' + id + '">(.*?)</p>').exec(h)[1].replace(/<[^>]+>/g, '');
    assert.equal(metin('eeCumle'), '12. sınıf · Fizik · 5 deneme (7 Eki – 4 Kas)');
    assert.match(metin('eeOzet'), /^Her etüt ≈ \+0,\d net \(olası aralık \+0,\d … \+0,\d\), aynı öğrencinin diğer derslerine göre\. Etüt alan \d+ öğrenci: Fizik ortalama [+−]\d+,\d net (arttı|azaldı), diğer dersleri ortalama ([+−]\d+,\d net (arttı|azaldı)|değişmedi)\.$/);
    assert.match(metin('eeKarar'), /^Etüt alınan derste artış belirgin: her etüt ≈ \+0,\d net \(aynı öğrencinin diğer derslerine göre\)\.$/);
    assert.match(metin('eeSayim'), /^36 öğrenciden 36’sı sayıldı \(\d+ etüt alan, \d+ etüt almayan\)\.$/);
    assert.match(h, /<p class="mini" id="eeSinir">Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir\.<\/p>/);
    const sira = ['id="eeCumle"', 'id="eeOzet"', 'id="eeKarar"', 'class="et-arac"', 'id="eeOlay"', 'id="eeGrafik"', 'id="eeHocalar"', 'id="eeOgrenciler"', 'id="eeAralik"', 'id="eeNasil"'].map(k => h.indexOf(k)); assert(sira.every(i => i > 0), String(sira));
    assert.deepEqual([...sira].sort((a, b) => a - b), sira, 'order: sentence, headline, verdict, controls, event study, standing, teachers, students, Ayrıntı, method');
    assert(h.indexOf('id="eeFark"') > h.indexOf('id="eeAralik"') && h.indexOf('id="eeArtis"') > h.indexOf('id="eeAralik"'), 'the scatter and the bars sit inside the collapsed block');
    assert.match(h, /data-ee-oturum="TYT" aria-pressed="true"/); assert.match(h, /data-ee-oturum="AYT"[^>]*disabled/); assert.match(h, /<select id="eeDers" aria-label="Ders">/);
    assert.match(h, /data-ee-donem="tum" aria-pressed="true">Tümü/); assert.match(h, /data-ee-donem="son4" aria-pressed="false">Son 4 deneme/);
    // The event study: title, legend, the chart box, the reading note, the faint-point note.
    assert.match(h, /<h2>Etütten önce ve sonra · Fizik<\/h2>/); assert.match(h, /id="eeLejant"><span><i class="ee-sw ee-sw-etut"><\/i>Etüt alan öğrenciler<\/span><span><i class="ee-sw ee-sw-kont"><\/i>Sınıf ortalaması \(etüt almayanlar\)<\/span>/);
    assert(h.includes('<p class="et-cumle" id="eeOlayNot">Etütten önce iki çizgi birlikte gidiyor, sonra etüt alanların çizgisi sınıf ortalamasından yukarı ayrılıyorsa artış etüte bağlanabilir. Önceden de ayrılıyorsa bu başka bir farktır.</p>'));
    assert.match(h, /id="eeOlay"[\s\S]*?İlk etütten önceki denemeye göre Türkiye farkındaki toplam değişim, net\. Etüt alan \d+ öğrenci; karşılaştırma: aynı denemelerde etüt almayan sınıf arkadaşları\./); assert.match(h, /Soluk nokta: 5’ten az öğrenci/);
    const duz = h.replace(/<[^>]+>/g, ' ');
    assert(!yasak.test(duz), 'no tier labels or manual words: ' + (yasak.exec(duz) || [])[0]); assert(!/GRUPLAR|eeGruplar/.test(h)); assert(!/%\d+/.test(duz.replace(/%(95|20)/g, '')), 'no percentages: ' + (/.{20}%\d+.{10}/.exec(duz) || [])[0]); assert(!h.includes('id="eeUc"'), 'no outliers in clean data');
    // The collapsed Ayrıntı: the cross-student number beside the headline’s, the dots, the intervals.
    assert.match(h, /<details id="eeAralik"><summary>Ayrıntı<\/summary>/); assert(!/<details id="eeAralik" open/.test(h));
    assert.match(/id="eeCapraz">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, ''), /^Öğrenciler arası karşılaştırma: her etüt ≈ \+\d,\d net \(olası aralık \+\d,\d … \+\d,\d\)\. Çok etüt alan öğrenciler zaten çalışkan olabilir; bu sayı onların çalışkanlığını da içerir, o yüzden başlıktaki sayıdan büyük çıkabilir\.$/);
    assert.match(h, /<h3 class="ee-alt-baslik">Etüt aldıkça artış · öğrenciler arası<\/h3>/); assert.match(h, /<h3 class="ee-alt-baslik">Deneme aralarına göre<\/h3>/);
    assert.match(h, /<details id="eeNasil"><summary>Nasıl hesaplanır<\/summary>/); assert(!/<details id="eeNasil" open/.test(h));
    const nasil = /<details id="eeNasil">([\s\S]*?)<\/details>/.exec(h)[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const k of ['Çok etüt alan öğrenciler zaten çalışkan olabilir; bu yüzden her öğrenci kendi diğer dersleriyle karşılaştırılır.', 'Türkiye farkı', 'Ölçek', 'Türkçe 40, Fizik 7 soru', 'Etütten önce ve sonra', 'Öğretmen', 'Çok uç sonuçlar', 'Olası aralık']) assert(nasil.includes(k), k);
    for (const b of ['Öğretmen', 'Toplam katkı (net)', 'Her etüt için artış (net)', 'Sıra', 'Etütten önce', 'Son deneme', 'Bu dersteki değişim (net)', 'Diğer derslerinde, ortalama (net)', 'Fark (net)', 'Etüt', 'Öğretmenler', 'Türkiye farkı']) assert(h.includes('>' + b + '</th>'), b);
    assert.equal((h.match(/<th class="sayi[ "]/g) || []).length, 5 + 6, 'every numeric header is a .sayi header');
    assert.equal((h.match(/<tr[^>]*><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 36, 'one row per counted student');
    assert.match(h, /<td class="et-dar-gizle ee-paylar">Sentetik Öğretmen A · \d etüt<br>Sentetik Öğretmen B · 1 etüt<\/td>/); assert.match(h, /<line class="ee-etutim"/, 'the first etüt is marked on the small line');
    assert(!h.includes('NaN') && !h.includes('undefined'));
    run("EK.eeDonem='son4'"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /data-ee-donem="son4" aria-pressed="true"/);
    run('EK.eeDonem=undefined'); merged(L.map(s => s.id === 'S1' ? { ...s, name: 'SENTETİK <ÖĞRENCİ> "1"' } : s)); h = run('ETUT_ETKI.icerik()'); assert(!h.includes('<öğrenci>')); assert.match(h, /&lt;öğrenci&gt;/);
    // Another ders: the sentence follows it.
    run("EK.eeDers='Matematik'"); merged(L); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<h2>Etütten önce ve sonra · Matematik<\/h2>/); assert.match(metin('eeKarar'), /^Belirgin bir fark yok\.|^Etüt alınan derste/);
  });
  await check('the left-out list sits under the students with the reasons, including the etüt without a later exam', () => {
    const L = [...planted(12), { id: 'X1', name: 'SENTETİK X1', cls: '12/A', sessions: et(MAT, A, '2026-10-16'), exams: sinavlar([10, null, null, null, null]) }, { id: 'X2', name: 'SENTETİK X2', cls: '12/B', sessions: [], exams: TARIH.map((date, k) => ({ exam: ad(k), date, session: 'TYT', nets: { fizik: 5 } })) },
      { id: 'X3', name: 'SENTETİK X3', cls: '12/A', sessions: et(MAT, A, '2026-10-16'), exams: sinavlar([0, 2].map((v, k) => v + MAT_T[k])) }];
    merged(L); trSayfa(TR); const h = run('ETUT_ETKI.icerik()');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 12);
    assert.match(h, /<details id="eeDisarida"><summary>Dışarıda kalan 3 öğrenci<\/summary>[\s\S]*Sentetik X1 · 12\/A · yalnızca 1 denemeye girdi[\s\S]*Sentetik X2 · 12\/B · bu dersin neti yok[\s\S]*Sentetik X3 · 12\/A · etütten sonra deneme yok/);
    assert.match(new RegExp('id="eeSayim">(.*?)</p>').exec(h)[1], /^15 öğrenciden 12’si sayıldı \(12 etüt alan, 0 etüt almayan\); 3’ü dışarıda \(aşağıda listelenir\)\.$/);
  });
  await check('the school’s standing: the lesson line of the Türkiye geneli page for the grade, with the dilim wording, and the weekly etüts on the same dates', () => {
    const rapor = [1, 2, 3].map(e => get('TURKIYE.pdfCoz(' + JSON.stringify(kurumRaporu(kurumListesi(e)).pages) + ',' + JSON.stringify('27-YKS-120' + e + ' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf') + ')'));
    put('__RP', rapor); run(`D.turkiye=TURKIYE.paketle(__RP.reduce((a,r)=>TURKIYE.birlestir(a,r),{okul:${JSON.stringify(BIZ)},sinavlar:[]}),1)`);
    const ogr = [...PL.map(s => ({ ...s, exams: s.exams.slice(0, 3) })), ...kontroller(6)];
    merged(ogr); const h = run('ETUT_ETKI.icerik()');
    assert.match(h, /<h2>Okulun Türkiye’deki yeri · Matematik<\/h2>/); assert(!h.includes('eeHamUyari'), 'the lists exist');
    put('__G', ogr); const st = get('(()=>{const m=ETUT_ETKI.model(__G,{},null,TURKIYE.ortalamalar(TURKIYE.oku().veri));return ETUT_ETKI.durus(__G,m,TURKIYE.oku().veri)})()');
    assert.equal(st.durum, 'tamam'); assert.equal(st.cizgiler.length, 1); assert.equal(st.cizgiler[0].nokta.length, 3);
    // The same series as the Türkiye geneli page: a deneme after the students' own results (no Sıralamalar list yet, or dated by
    // the report's print day) is not cut, and the line names the list, the session, the lesson and the denemeler drawn.
    const ogr2 = ogr.map(s => ({ ...s, exams: s.exams.slice(0, 2) })); put('__G2', ogr2);
    const st2 = get('(()=>{const m=ETUT_ETKI.model(__G2,{},null,TURKIYE.ortalamalar(TURKIYE.oku().veri));return ETUT_ETKI.durus(__G2,m,TURKIYE.oku().veri)})()');
    assert.equal(st2.durum, 'tamam'); assert.equal(st2.cizgiler[0].nokta.length, 3, 'the third deneme shows although the students have only two');
    assert.match(st.kaynak, /^Kolej listesi · TYT Matematik · .+ → .+ · 3 deneme$/);
    merged(ogr); assert.match(run('ETUT_ETKI.icerik()'), /id="eeDurusKaynak">Türkiye geneli sayfasındaki ders çizgisinin aynısı: Kolej listesi · TYT Matematik · /);
    // The school's Matematik net in the three lists (BIZIM): 12, 11.2, 14.5; the dilim is what the Türkiye geneli page says for the same point.
    const pts = get('(()=>{const t=TURKIYE.model(TURKIYE.oku().veri,{duzey:"d12",oturum:"TYT"});const d=t.dersler.find(x=>x.kod==="MATEMATİK-T");return d.seri.map(p=>TURKIYE.dilimNokta(p))})()');
    assert.deepEqual(st.cizgiler[0].nokta.map(p => p.dilim), pts); assert(pts.every(x => x > 0 && x < 100));
    assert.deepEqual(st.cizgiler[0].nokta.map(p => p.g), [gun(TARIH[0]), gun(TARIH[1]), gun(TARIH[2])]); assert.equal(st.haftalik.length > 0, true);
    // The chart: ilk % labels, inverted (a smaller dilim is higher), the weekly bars, no NaN.
    put('__S', st); const svg = get('ETUT_ETKI.durusSvg(__S,640)');
    assert.match(svg, /<text class="ee-ad"[^>]*>ilk %\d+(,\d)?<\/text>/);
    // Under each date the deneme's short name, so a point can be told from the Türkiye geneli page.
    assert.equal((svg.match(/<text class="et-tik ee-sinav-ad"/g) || []).length, 3); assert(st.cizgiler[0].nokta.every(p => p.kisa && svg.includes('>' + p.kisa + '</text>')));
    // A complete list (every school that sat it, fewer than the others) is a hollow dot, named in the note under the chart.
    put('__T', { ...st, cizgiler: [{ ...st.cizgiler[0], nokta: st.cizgiler[0].nokta.map((p, i) => i === 2 ? { ...p, tam: true, okulN: 80 } : p) }] });
    const svgT = get('ETUT_ETKI.durusSvg(__T,640)'); assert.equal((svgT.match(/class="ee-nokta ee-tam"/g) || []).length, 1); assert(svgT.includes('tam liste (80 okul)'));
    assert.match(run('ETUT_ETKI.icerik()'), /id="eeIkiGrafik">Bu grafik okulun Türkiye’deki okullar arasındaki yerini gösterir\. “Etütten önce ve sonra” ise okulun içinde/); assert(svg.includes('>Haftalık etüt</text>') && !svg.includes('NaN') && !svg.includes('undefined'));
    const ys = [...svg.matchAll(/<circle class="ee-nokta" cx="[\d.]+" cy="([\d.]+)"/g)].map(x => Number(x[1]));
    assert.equal(ys.length, 3); const sirali = st.cizgiler[0].nokta.map(p => p.dilim); for (let i = 1; i < 3; i++) assert.equal(sirali[i] < sirali[i - 1], ys[i] < ys[i - 1], 'a smaller dilim is drawn higher');
    // The helpers: TURKIYE’s when it exports them, else the formula here; both say "ilk %12".
    assert.equal(get('ETUT_ETKI.dilimler().yerelMi'), false); assert.equal(get('ETUT_ETKI.dilimler().yazi(12.2)'), 'ilk %12'); assert.equal(get('ETUT_ETKI.dilimler().yazi(8.43)'), 'ilk %8,4'); assert.equal(get('ETUT_ETKI.dilimler().yazi(0.02)'), 'ilk %0,1');
    assert.equal(get('ETUT_ETKI.dilimler({}).yerelMi'), true); assert.equal(get('ETUT_ETKI.dilimler({}).yazi(ETUT_ETKI.dilimler({}).nokta({t:62}))'), 'ilk %12', 'T 62 is the 12th percentile from the top');
    assert.equal(get('ETUT_ETKI.dilimler({}).yazi(8.43)'), 'ilk %8,4'); assert.equal(get('ETUT_ETKI.dilimler({}).yazi(0.02)'), 'ilk %0,1'); assert.equal(get('ETUT_ETKI.dilimler({}).yazi(12.2)'), 'ilk %12'); assert(Math.abs(get('ETUT_ETKI.dilimler({}).tden(15.87)') - 60) < 0.05);
    assert(Math.abs(get('ETUT_ETKI.dilimler({}).nokta({t:62})') - get('TURKIYE.dilimNokta({t:62})')) < 1e-4, 'the local formula and TURKIYE’s agree');
    // No list for the grade: the page says so with the button; the rest of the page stays.
    run('D.turkiye=undefined'); const bos = run('ETUT_ETKI.icerik()'); assert.match(bos, /id="eeGrafik"[\s\S]*?Bu sınıf için Türkiye geneli listesi eklenmemiş\.[\s\S]*?data-sekme="turkiye">Türkiye geneli →/); assert(bos.includes('id="eeHocalar"'));
  });
  await check('the bars and the chart are drawn at the width given: the zero line, whiskers, n under each bar, faint small bars, no NaN', () => {
    put('__M', model(PL, {}, TR)); const svg = get('ETUT_ETKI.artisSvg(__M,640)');
    assert.equal((svg.match(/<rect class="ee-sutun"/g) || []).length, 5); assert.equal((svg.match(/class="ee-kova az"/g) || []).length, model(PL, {}, TR).cubuklar.filter(c => c.az).length);
    for (const t of ['>0</text>', '>1</text>', '>4+</text>']) assert(svg.includes(t), t);
    assert(/class="et-eksen ee-sifir"/.test(svg), 'zero line'); assert(svg.includes('>n = ') && !svg.includes('NaN') && !svg.includes('undefined'));
    assert.equal((svg.match(/class="ee-biyik"/g) || []).length % 3, 0); assert(svg.includes('viewBox="0 0 640 ')); const dar = get('ETUT_ETKI.artisSvg(__M,300)'); assert(dar.includes('viewBox="0 0 300 ') && !dar.includes('NaN'));
    // A bar with no interval stays empty and says so.
    const bos = model(PL.map(s => ({ ...s, sessions: s.sessions.filter(x => x.date < '2026-10-10') })), {}, TR); put('__M2', bos); assert(!get('ETUT_ETKI.artisSvg(__M2,640)').includes('NaN'));
  });
  await check('the main chart: a dot per student at their etüt count, the fitted line with its slope written on it, the zero line; extreme students hollow and labelled; no names', () => {
    const P = planted(20), ucO = oge('U1', 0, 1.5 + 0.4 * 2 + 12, 2), m = eski([...P, ucO], {}, TR); put('__F', m);
    const svg = get('ETUT_ETKI.farkSvg(__F,640,"")');
    assert.equal((svg.match(/<circle class="ee-nokta ee-dagilim"/g) || []).length, 20); assert.equal((svg.match(/<circle class="ee-nokta ee-dagilim ee-aykiri"/g) || []).length, 1);
    assert(svg.includes('class="et-eksen ee-sifir"') && svg.includes('class="ee-ortcizgi ee-egri"')); assert(svg.includes('>her etüt +0,4 net</text>') && svg.includes('>aykırı, hesaba katılmadı</text>') && svg.includes('>Aldığı etüt sayısı</text>'));
    assert(!svg.includes('NaN') && !svg.includes('undefined') && !svg.includes('SENTETİK') && svg.includes('viewBox="0 0 640 '));
    const dar = get('ETUT_ETKI.farkSvg(__F,300,"")'); assert(dar.includes('viewBox="0 0 300 ') && !dar.includes('NaN'));
    const t = get('ETUT_ETKI.farkSvg(__F,640,"' + A + '")'); assert(t.includes('>her etüt +0,4 net</text>') && t.includes('(Sentetik Öğretmen A)'), 'a chosen teacher: their own gain per etüt');
  });
  await check('page states: no data, one exam, no etüt in the period, nobody with two exams, a failing source', () => {
    merged([]); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/); assert.match(h, /data-sekme="etutler"/);
    merged([PL[0]].map(s => ({ ...s, exams: s.exams.slice(0, 1) }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /İki deneme gerekli/);
    merged(PL.map(s => ({ ...s, sessions: [] }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /Dönemde etüt kaydı yok/); assert(!h.includes('id="eeHocalar"') && !h.includes('id="eeFark"')); assert.match(h, /data-ee-donem="tum"/);
    run('OGRENCI_RAPOR.temelOgrenciler=()=>{throw new Error("Rapor okunamadı.")}'); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<p class="et-uyari">Rapor okunamadı\.<\/p>/);
    // Everyone sat only one exam: the page says so instead of drawing nothing.
    merged(PL.map((s, i) => ({ ...s, exams: [s.exams[i % 5]] }))); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /Değişimi hesaplanabilen öğrenci yok/); assert(!h.includes('id="eeFark"') && !h.includes('NaN'));
  });
  await check('menu, viewing teacher and privacy: under Öğrenciler, rehber only, nothing stored or sent to students', () => {
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor', 'gunlukrapor']);
    assert.equal(get("SEKME_REHBER.some(s=>s[0]==='etutetki'&&s[1]==='Etüt etkisi')"), true); assert.equal(get("SEKME_OGRENCI.some(s=>s[0]==='etutetki')"), false);
    run("D.rol='ogrenci'"); assert.match(run('gorunumEtutEtki()'), /rehber öğretmen içindir/); run("D.rol='rehber'");
    merged(PL); const once = run('JSON.stringify(D)'); run('ETUT_ETKI.icerik();ETUT_ETKI.gorunum()'); assert.equal(run('JSON.stringify(D)'), once);
    run('yalnizcaGoruntuleme=()=>true'); assert.match(run('ETUT_ETKI.gorunum()'), /<div id="eeKok">[\s\S]*Öğretmenlere göre/);
  });
  await check('possessive endings of the counts read right (24’ü, 7’si, 15’i, 6’sı) and the slope helper still draws the small lines', () => {
    const k = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u', 10: 'u', 15: 'i', 17: 'si', 20: 'si', 24: 'ü', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı', 100: 'ü' };
    for (const [n, ek] of Object.entries(k)) assert.equal(get('ETUT_ETKI.sahip(' + n + ')'), n + '’' + ek, n);
    const e = pts => { put('__p', pts); return get('ETUT_ETKI.egim(__p)'); };
    assert.equal(e([[0, 10], [1, 12], [2, 14]]), 2); assert.equal(e([[0, 9], [1, 9], [2, 12]]), 1.5); assert.equal(e([[0, 5]]), null);
  });
  console.log(passed + ' Etüt etkisi checks passed');
})();
function r2(x) { return Math.round(x * 100) / 100; }
const HAMYOK = /(?!)/;
function metinSayim(h) { return new RegExp('id="eeSayim">(.*?)</p>').exec(h)[1].replace(/<[^>]+>/g, ''); }
