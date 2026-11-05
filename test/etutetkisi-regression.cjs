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
const by = (m, id) => m.ogrenciler.find(r => r.id === id);

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
    assert.equal(m.ders, 'Coğrafya'); assert.equal(m.kip, 'turkiye'); assert.deepEqual(m.ogrenciler[0].dizi, [2, 2.5, 3.5]);
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
  await check('intervals: consecutive exams a student sat, the etüts strictly between the exam days, other lessons and AYT-only courses never count', () => {
    const s = (id, nets, sessions) => ({ id, name: 'SENTETİK ' + id, cls: '12/A', sessions, exams: sinavlar(nets) });
    const L = [
      s('Z1', [10, 12, 13], [...et(MAT, A, '2026-10-07', '2026-10-08', '2026-10-14', '2026-10-15', '2026-10-21', '2026-10-22'), ...et('FİZİK', A, '2026-10-09'), ...et('MATEMATİK AYT', A, '2026-10-10')]),
      s('Z2', [10, null, 13, 15], et(MAT, B, '2026-10-09', '2026-10-17', '2026-10-24')),   // missed the middle exam: the pair is 7 → 21 Oct, then 21 → 28 Oct
      s('Z3', [10, 11, 12, 11, 14], []), s('Z4', [1, 2], et(MAT, A, '2026-10-09')),
      ...PL.slice(0, 6)];
    const m = model(L, { ders: 'Matematik' }, TR), r = Object.fromEntries(m.ogrenciler.map(x => [x.id, x]));
    // Z1: 8 Oct (inside 7–14), 15 Oct (inside 14–21) count; the exam days 7, 14, 21 and the 22 Oct (after the last exam) do not.
    assert.equal(r.Z1.n, 2); assert.equal(r.Z1.aralik, 2); assert.equal(r.Z1.etutlu, 2.5, 'd = 0, −2, 5: the gains −2 and 7, both intervals have an etüt'); assert.equal(r.Z1.etutsuz, null);
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
    assert.equal(m.ogrenciler.length, 12); assert.equal(m.aralik, 48); assert.equal(e.aralik, 48);
    assert(Math.abs(e.b - 0.5) < 1e-9, 'b = ' + e.b); assert(Math.abs(e.c) < 1e-9, 'no rebound was planted: c = ' + e.c); assert.equal(e.n, 12);
    assert(e.ci[0] <= 0.5 + 1e-9 && e.ci[1] >= 0.5 - 1e-9 && e.ci[1] - e.ci[0] < 1e-6, 'a noise-free fit has a point interval: ' + e.ci);
    // The same intervals by dummy variables.
    const L = m.ogrenciler.map(r => { const l = []; const ex = r.dizi; const idx = ex.map((v, i) => v === null ? null : i).filter(i => i !== null); for (let q = 1; q < idx.length; q++) l.push({ d1: ex[idx[q - 1]], g: ex[idx[q]] - ex[idx[q - 1]] }); return l; });
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
    put('__O', m.ogrenciler.map(r => r.id)); // the intervals again, for the uncontrolled fit
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
    assert.equal(h.ogrenciler.length, 12); assert.equal(h.aralik, 48); assert.deepEqual(h.listesiz, []);
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
    assert(!('X5' in neden), 'X5 has a valid pair'); assert.equal(m.toplamOgrenci, 11); assert.equal(m.ogrenciler.length, 7);
  });
  await check('teachers: the same estimate with that teacher’s etüts only, ranked by it; ties share a rank, under 5 students no rank, faint and last', () => {
    // Four exams, three intervals. Each student takes 0, 1 or 2 etüts of ONE teacher, in a different interval; the gain per etüt differs by teacher.
    const T = (t, k, kat, e) => dikili(t.slice(-1) + k, (k % 3) - 1, ((k * 2) % 3) * 0.25, e, { kat, hoca: t });
    const P = 'SENTETİK ÖĞRETMEN P', Q = 'SENTETİK ÖĞRETMEN Q', R = 'SENTETİK ÖĞRETMEN R', Tt = 'SENTETİK ÖĞRETMEN T';
    const pat = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 1, 0], [0, 0, 2]];
    const L = [...pat.slice(0, 5).map((e, k) => T(P, k + 1, 1, e)), ...pat.slice(0, 5).map((e, k) => T(Q, k + 1, 1, e)), ...pat.slice(0, 5).map((e, k) => T(R, k + 1, 0, e)), ...pat.slice(0, 2).map((e, k) => T(Tt, k + 1, 3, e))];
    const m = model(L, {}, TR), h = m.hocalar;
    assert.deepEqual(h.map(x => [x.ad, x.sira, x.az, x.n]), [['Sentetik Öğretmen P', 1, false, 5], ['Sentetik Öğretmen Q', 1, false, 5], ['Sentetik Öğretmen R', 3, false, 5], ['Sentetik Öğretmen T', null, true, 2]]);
    assert(h[0].b > 0.5 && bit(h[0].b, h[1].b, 1e-9) && h[2].b < h[0].b - 0.3, 'P and Q tie, R is flat: ' + h.map(x => x.b)); assert(h[3].b > h[0].b, 'T has the biggest estimate yet comes last');
    assert(h.every(x => x.ci && x.ci[0] <= x.b + 1e-9 && x.ci[1] >= x.b - 1e-9)); assert.equal(h[0].etut, 14, 'the etüts of the five P students: 3 + 3 + 3 + 3 + 2');
    merged(L); const sayfa = run('ETUT_ETKI.icerik()'), tbody = /<section class="et-panel" id="eeHocalar">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(sayfa)[1];
    const rows = tbody.split('</tr>').filter(x => x.includes('<tr')).map(r => [/<td class="sayi ee-sira">(.*?)<\/td>/.exec(r)[1], /class="ee-ad"[^>]*>(.*?)<\/button>/.exec(r)[1], r.includes('class="ee-az"')]);
    assert.deepEqual(rows, [['1', 'Sentetik Öğretmen P', false], ['1', 'Sentetik Öğretmen Q', false], ['3', 'Sentetik Öğretmen R', false], ['—', 'Sentetik Öğretmen T', true]]);
    assert.match(sayfa, /<th class="sayi ee-sira">Sıra<\/th><th>Öğretmen<\/th><th class="sayi">Öğrenci<\/th><th class="sayi et-dar-gizle">Etüt<\/th><th class="sayi">Her etüt için artış \(net\)<\/th>/);
    // A teacher’s name filters the students; the left-out list stays whole.
    run("EK.eeHoca='SENTETİK ÖĞRETMEN T'"); const t = run('ETUT_ETKI.icerik()'); assert.equal((t.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 2); assert.match(t, /<h2>Öğrenciler · Sentetik Öğretmen T<\/h2>/); assert.match(t, /data-ee-hoca="">Tüm öğretmenler/);
  });
  await check('periods and sessions: exams with equal titles stay apart; Son 4 deneme keeps the last four; a TYT-only course never counts for AYT', () => {
    const ayni = PL.map(s => ({ ...s, exams: s.exams.map(e => ({ ...e, exam: 'GENEL DENEME' })) }));
    const m = model(ayni, {}, null); assert.equal(m.sinavlar.length, 5); assert.deepEqual(m.sinavlar.map(e => e.etiket), ['7 Eki', '14 Eki', '21 Eki', '28 Eki', '4 Kas'].map(g => 'GENEL DENEME (' + g + ')'));
    const s4 = model(PL, { donem: 'son4' }, TR); assert.equal(s4.donem, 'son4'); assert.deepEqual(s4.sinavlar.map(e => e.ad), [ad(1), ad(2), ad(3), ad(4)]); assert.equal(s4.aralik, 36); assert.equal(model(PL, { donem: 'baska' }, TR).donem, 'tum');
    const ayt = Array.from({ length: 4 }, (_, i) => ({ id: 'a' + i, name: 'SENTETİK AYT ' + i, cls: '12/A', sessions: [...et('MATEMATİK AYT', A, '2026-10-16'), ...et('MATEMATİK TYT', B, '2026-10-16')],
      exams: [['AYT-1', '2026-10-07'], ['AYT-2', '2026-10-21']].map(([exam, date], k) => ({ exam, date, session: 'AYT', nets: { mat: 10 + 2 * k } })) }));
    const a = model(ayt, { oturum: 'AYT' }); assert.deepEqual(a.oturumlar, ['AYT']); assert.deepEqual(a.hocalar.map(h => h.ad), ['Sentetik Öğretmen A']); assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","AYT")'), false);
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
  await check('page: the sentence, the verdict, the comparison, the controls, the sections in order, no tiers and no manual words', () => {
    merged(PL); trSayfa(TR); let h = run('ETUT_ETKI.icerik()');
    const metin = id => new RegExp('<p class="et-cumle[^"]*" id="' + id + '">(.*?)</p>').exec(h)[1].replace(/<[^>]+>/g, '');
    assert.equal(metin('eeCumle'), '12. sınıf · Matematik · 5 deneme (7 Eki – 4 Kas) · 12 öğrenci, 48 deneme arası (her öğrencinin Türkiye farkı iki ardışık denemede karşılaştırıldı).');
    assert.match(metin('eeKarar'), /^Etüt aldıkça artış belirgin|^Belirgin bir fark yok|^Yeterli veri yok|^Etüt alınan/); assert.match(h, /id="eeKarar"/);
    assert.match(metin('eeEslesme'), /^Hem etüt aldığı hem almadığı deneme arası olan \d+ öğrenci: etüt alınan aralarda ortalama [+−]?\d,\d\d net, alınmayanlarda [+−]?\d,\d\d net; fark [+−]?\d,\d\d/);
    assert.equal(metin('eeSayim'), '12 öğrencinin hepsi sayıldı.');
    assert.match(h, /<p class="mini" id="eeSinir">Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir\.<\/p>/);
    const sira = ['id="eeCumle"', 'id="eeKarar"', 'class="et-arac"', 'id="eeArtis"', 'id="eeGrafik"', 'id="eeHocalar"', 'id="eeOgrenciler"', 'id="eeNasil"'].map(k => h.indexOf(k)); assert(sira.every(i => i > 0), String(sira));
    assert.deepEqual([...sira].sort((a, b) => a - b), sira, 'order: sentence, verdict, controls, bars, standing, teachers, students, method');
    assert.match(h, /data-ee-duzey="12"|data-ee-oturum="TYT" aria-pressed="true"/); assert.match(h, /data-ee-oturum="AYT"[^>]*disabled/); assert.match(h, /<select id="eeDers" aria-label="Ders">/);
    assert.match(h, /data-ee-donem="tum" aria-pressed="true">Tümü/); assert.match(h, /data-ee-donem="son4" aria-pressed="false">Son 4 deneme/);
    const duz = h.replace(/<[^>]+>/g, ' ');
    assert(!yasak.test(duz.replace(HAMYOK, '')), 'no tier labels or manual words: ' + (yasak.exec(duz) || [])[0]); assert(!/GRUPLAR|eeGruplar/.test(h));
    // The method block is one collapsed details block in plain words.
    assert.match(h, /<details id="eeNasil"><summary>Nasıl hesaplanır<\/summary>/); assert(!/<details id="eeNasil" open/.test(h));
    const nasil = /<details id="eeNasil">([\s\S]*?)<\/details>/.exec(h)[1].replace(/<[^>]+>/g, ' ');
    for (const k of ['Türkiye farkı', 'kendisiyle kıyaslanır', 'toparlanma']) assert(nasil.includes(k), k);
    for (const b of ['Öğretmen', 'Her etüt için artış (net)', 'Sıra', 'Etütlü aralarda artış (net)', 'Etütsüz aralarda artış (net)', 'Deneme arası', 'Etüt']) assert(h.includes('>' + b + '</th>'), b);
    assert.equal((h.match(/<th class="sayi[ "]/g) || []).length, 4 + 4, 'every numeric header is a .sayi header');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 12, 'one row per counted student');
    assert(!h.includes('NaN') && !h.includes('undefined'));
    // Controls change the page.
    const fz = PL.map(s => ({ ...s, exams: s.exams.map(e => ({ ...e, nets: { ...e.nets, fizik: 4 } })), sessions: [...s.sessions, ...et('FİZİK', C, '2026-10-16', '2026-10-17')] }));
    merged(fz); run("EK.eeDers='Fizik'"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /· Fizik · 5 deneme/); assert.match(h, /Sentetik Öğretmen C/);
    run("EK.eeDers=undefined;EK.eeDonem='son4'"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /data-ee-donem="son4" aria-pressed="true"/);
    run('EK.eeDonem=undefined'); merged(PL.map(s => s.id === 'P1' ? { ...s, name: 'SENTETİK <ÖĞRENCİ> "1"' } : s)); h = run('ETUT_ETKI.icerik()'); assert(!h.includes('<öğrenci>')); assert.match(h, /&lt;öğrenci&gt;/);
  });
  await check('the left-out list sits under the students with the reasons', () => {
    const L = [...PL, { id: 'X1', name: 'SENTETİK X1', cls: '12/A', sessions: et(MAT, A, '2026-10-16'), exams: sinavlar([10, null, null, null, null]) }, { id: 'X2', name: 'SENTETİK X2', cls: '12/B', sessions: [], exams: TARIH.map((date, k) => ({ exam: ad(k), date, session: 'TYT', nets: { fizik: 5 } })) }];
    merged(L); const h = run('ETUT_ETKI.icerik()');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 12);
    assert.match(h, /<details id="eeDisarida"><summary>Dışarıda kalan 2 öğrenci<\/summary>[\s\S]*Sentetik X1 · 12\/A · yalnızca 1 denemeye girdi[\s\S]*Sentetik X2 · 12\/B · bu dersin neti yok/);
    assert.equal(metinSayim(h), '14 öğrenciden 12’si sayıldı; 2’si dışarıda (aşağıda listelenir).');
  });
  await check('the school’s standing: the lesson line of the Türkiye geneli page for the grade, with the dilim wording, and the weekly etüts on the same dates', () => {
    const rapor = [1, 2, 3].map(e => get('TURKIYE.pdfCoz(' + JSON.stringify(kurumRaporu(kurumListesi(e)).pages) + ',' + JSON.stringify('27-YKS-120' + e + ' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf') + ')'));
    put('__RP', rapor); run(`D.turkiye=TURKIYE.paketle(__RP.reduce((a,r)=>TURKIYE.birlestir(a,r),{okul:${JSON.stringify(BIZ)},sinavlar:[]}),1)`);
    const ogr = PL.map(s => ({ ...s, exams: s.exams.slice(0, 3) }));
    merged(ogr); const h = run('ETUT_ETKI.icerik()');
    assert.match(h, /<h2>Okulun Türkiye’deki yeri · Matematik<\/h2>/); assert(!h.includes('eeHamUyari'), 'the lists exist');
    put('__G', ogr); const st = get('(()=>{const m=ETUT_ETKI.model(__G,{},null,TURKIYE.ortalamalar(TURKIYE.oku().veri));return ETUT_ETKI.durus(__G,m,TURKIYE.oku().veri)})()');
    assert.equal(st.durum, 'tamam'); assert.equal(st.cizgiler.length, 1); assert.equal(st.cizgiler[0].nokta.length, 3);
    // The school's Matematik net in the three lists (BIZIM): 12, 11.2, 14.5; the dilim is what the Türkiye geneli page says for the same point.
    const pts = get('(()=>{const t=TURKIYE.model(TURKIYE.oku().veri,{duzey:"d12",oturum:"TYT"});const d=t.dersler.find(x=>x.kod==="MATEMATİK-T");return d.seri.map(p=>TURKIYE.dilimNokta(p))})()');
    assert.deepEqual(st.cizgiler[0].nokta.map(p => p.dilim), pts); assert(pts.every(x => x > 0 && x < 100));
    assert.deepEqual(st.cizgiler[0].nokta.map(p => p.g), [gun(TARIH[0]), gun(TARIH[1]), gun(TARIH[2])]); assert.equal(st.haftalik.length > 0, true);
    // The chart: ilk % labels, inverted (a smaller dilim is higher), the weekly bars, no NaN.
    put('__S', st); const svg = get('ETUT_ETKI.durusSvg(__S,640)');
    assert.match(svg, /<text class="ee-ad"[^>]*>ilk %\d+(,\d)?<\/text>/); assert(svg.includes('>Haftalık etüt</text>') && !svg.includes('NaN') && !svg.includes('undefined'));
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
  await check('page states: no data, one exam, no etüt in the period, nobody with two exams, a failing source', () => {
    merged([]); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/); assert.match(h, /data-sekme="etutler"/);
    merged([PL[0]].map(s => ({ ...s, exams: s.exams.slice(0, 1) }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /İki deneme gerekli/);
    merged(PL.map(s => ({ ...s, sessions: [] }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /Dönemde etüt kaydı yok/); assert(!h.includes('id="eeHocalar"') && !h.includes('id="eeArtis"')); assert.match(h, /data-ee-donem="tum"/);
    run('OGRENCI_RAPOR.temelOgrenciler=()=>{throw new Error("Rapor okunamadı.")}'); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<p class="et-uyari">Rapor okunamadı\.<\/p>/);
    // Everyone sat only one exam: the page says so instead of drawing nothing.
    merged(PL.map((s, i) => ({ ...s, exams: [s.exams[i % 5]] }))); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /bu derste art arda iki denemesi olan öğrenci yok/); assert(!h.includes('id="eeArtis"') && !h.includes('NaN'));
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
