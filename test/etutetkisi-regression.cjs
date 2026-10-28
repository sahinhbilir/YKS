#!/usr/bin/env node
'use strict';
// Etüt etkisi: every student's progress through all their exams in a lesson (the least-squares slope of their nets),
// the four fixed etüt groups, the teacher rows with overlap and the difference from the class, the students left out
// and why, the etüt counting rules (exam days, other lessons, TYT / AYT courses), the Son 4 deneme period, the page
// (sections in order, no manual words), its states, the menu, the viewing teacher and privacy. Synthetic students
// only; the merged students are those of Öğrenci raporları.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
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
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__rapor = run('OGRENCI_RAPOR.temelOgrenciler');
const reset = () => run(`yalnizcaGoruntuleme=__yg;OGRENCI_RAPOR.temelOgrenciler=__rapor;D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='etutetki';
  for(const k of ['eeDuzey','eeOturum','eeDers','eeDonem','eeHoca'])EK[k]=undefined;`);
const merged = (ogr, kapsam = null, warnings = []) => { put('__eeS', ogr); put('__eeKP', kapsam); put('__eeW', warnings); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:__eeS,warnings:__eeW,etutKapsam:__eeKP})'); };
const model = (ogr, sec = {}, kapsam = null) => { put('__eeS', ogr); put('__eeC', sec); put('__eeKP', kapsam); return get('ETUT_ETKI.model(__eeS,__eeC,__eeKP)'); };
const r2 = x => Math.round(x * 100) / 100;
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// ---- synthetic grade 12: three exams a week apart (Wed 7, 14 and 21 Oct 2026), Matematik and Fizik nets ----
const E = [['27-YKS-1201', '2026-10-07'], ['27-YKS-1202', '2026-10-14'], ['27-YKS-1203', '2026-10-21']];
const A = 'SENTETİK ÖĞRETMEN A', B = 'SENTETİK ÖĞRETMEN B', C = 'SENTETİK ÖĞRETMEN C', F = 'SENTETİK ÖĞRETMEN F';
const MAT = 'MATEMATİK TYT';
const et = (course, teacher, ...dates) => dates.map(date => ({ date, course, teacher, minutes: 40, time: 900 }));
// With three exams one apart the slope is (last − first) / 2: the expected values below are worked out from that.
const S = (id, nets, sessions = [], cls = '12/A') => ({ id, name: 'SENTETİK ÖĞRENCİ ' + id, cls, sessions,
  exams: E.map(([exam, date], k) => nets[k] === null ? null : ({ exam, date, session: 'TYT', nets: { mat: nets[k], fizik: 5 + k } })).filter(Boolean) });
const OGR = [
  // Etüt yok (7): etüts that do not count (another lesson, an AYT-only course, exam days, before the first exam, after the last).
  S('Y1', [10, 11, 12], et(MAT, C, '2026-10-06')), S('Y2', [10, 10, 10], et('FİZİK', F, '2026-10-16')), S('Y3', [12, 13, 14], et(MAT, C, '2026-10-21')),
  S('Y4', [8, 9, 10], et('MATEMATİK AYT', C, '2026-10-16')), S('Y5', [10, 12, 14], et(MAT, C, '2026-10-07')), S('Y6', [9, 9, 12], et(MAT, C, '2026-10-22')),
  S('M1', [10, null, 14]),   // missed the middle exam: still counted, slope 2 per exam
  // 1–2 etüt (5)
  S('G1', [10, 12, 14], et(MAT, A, '2026-10-15')), S('G2', [11, 12, 16], et(MAT, A, '2026-10-08', '2026-10-16')), S('G3', [9, 10, 11], et(MAT, A, '2026-10-13')),
  S('G4', [10, 13, 13], et(MAT, A, '2026-10-19', '2026-10-20')), S('G5', [12, 14, 16], [...et(MAT, A, '2026-10-09'), ...et(MAT, B, '2026-10-15')]),
  // 3–5 etüt (3)
  S('H1', [10, 13, 16], et(MAT, A, '2026-10-12', '2026-10-13', '2026-10-14')),
  S('H2', [8, 10, 15], [...et(MAT, A, '2026-10-08', '2026-10-09', '2026-10-16'), ...et(MAT, B, '2026-10-19')]),
  S('H3', [12, 13, 14], et(MAT, A, '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-20')),
  // 6+ etüt (2)
  S('K1', [10, 14, 18], et('MATEMATİK', A, '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-19')),
  S('K2', [11, 13, 15], [...et(MAT, A, '2026-10-08', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16', '2026-10-20'), ...et(MAT, B, '2026-10-20')]),
  // Left out: one exam only (it still took an etüt); three exams but no Matematik net.
  S('X1', [10, null, null], et(MAT, A, '2026-10-16')),
  { id: 'X2', name: 'SENTETİK ÖĞRENCİ X2', cls: '12/A', sessions: [], exams: E.map(([exam, date]) => ({ exam, date, session: 'TYT', nets: { fizik: 6 } })) },
  // Another grade, never mixed in.
  { id: 'K9', name: 'SENTETİK KÜÇÜK', cls: '9/A', sessions: et(MAT, A, '2026-10-16'), exams: E.map(([exam, date]) => ({ exam: exam.replace('YKS', 'TYT'), date, session: 'TYT', nets: { mat: 7 } })) }
];
const U = s => s;   // the synthetic names are already upper case, so a teacher’s key is the name
const by = (m, id) => m.ogrenciler.find(r => r.id === id);
const gun = iso => run('gunNo("' + iso + '")');
const yasak = /Nasıl okunur|Gözlem|±|\bham\b|eğim|aralık|\(%95\)/i;

(async () => {
  await check('the slope: a least-squares line through the points, x is the exam’s place so a missed exam keeps its spacing', () => {
    const e = pts => { put('__p', pts); return get('ETUT_ETKI.egim(__p)'); };
    assert.equal(e([[0, 10], [1, 12], [2, 14]]), 2); assert.equal(e([[0, 10], [2, 14]]), 2, 'two points two exams apart: 4 net over 2 exams');
    assert.equal(e([[0, 5], [1, 5], [2, 5]]), 0); assert.equal(e([[0, 14], [1, 12], [2, 10]]), -2); assert.equal(e([[0, 9], [1, 9], [2, 12]]), 1.5, 'not the first-to-last jump of 3, not the mean of the two steps');
    assert(Math.abs(e([[0, 1], [1, 3], [3, 3]]) - 4 / 7) < 1e-12, 'uneven spacing: 24/42 worked out by hand');
    assert.equal(e([[0, 5]]), null); assert.equal(e([]), null);
  });
  await check('possessive endings of the counts read right (24’ü, 7’si, 15’i, 6’sı)', () => {
    const k = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u', 10: 'u', 15: 'i', 17: 'si', 20: 'si', 24: 'ü', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı', 100: 'ü' };
    for (const [n, ek] of Object.entries(k)) assert.equal(get('ETUT_ETKI.sahip(' + n + ')'), n + '’' + ek, n);
  });
  await check('defaults: the whole run, the grade with the most etüts, the lesson with the most etüts; counted and left-out students', () => {
    const m = model(OGR);
    assert.equal(m.durum, 'tamam'); assert.deepEqual(m.duzeyler, [12, 9]); assert.equal(m.duzey, 12); assert.deepEqual(m.oturumlar, ['TYT']); assert.equal(m.oturum, 'TYT'); assert.equal(m.donem, 'tum');
    assert.deepEqual(m.sinavlar.map(e => e.key), E.map(([a, d]) => a + '|' + d)); assert.deepEqual(m.sinavlar.map(e => e.etiket), E.map(e => e[0]));
    assert.deepEqual(m.dersler.map(d => d.ders), ['Matematik', 'Fizik']); assert.equal(m.ders, 'Matematik'); assert.equal(m.dersler[0].n, 34, 'every counting Matematik etüt of the grade, left-out students included');
    assert.equal(m.toplamOgrenci, 19); assert.equal(m.ogrenciler.length, 17); assert.equal(m.disarida.length, 2);
    assert.deepEqual(m.disarida.map(d => [d.ad, d.neden]).sort(), [['SENTETİK ÖĞRENCİ X2', 'bu dersin neti yok'], ['SENTETİK ÖĞRENCİ X1', 'yalnızca 1 denemeye girdi']].sort());
    assert(!m.ogrenciler.some(r => r.id === 'K9'));
    // The class: slopes 8.5 (none) + 9 + 7.5 + 6 = 31 over 17 students; totals 17 + 18 + 15 + 12 = 62.
    assert.equal(m.sinif.n, 17); assert.equal(m.sinif.egim, r2(31 / 17)); assert.equal(m.sinif.toplam, r2(62 / 17));
  });
  await check('one student: the nets in date order, the slope per exam, the total, first and last net, deneme count', () => {
    const m = model(OGR);
    const y6 = by(m, 'Y6'); assert.deepEqual(y6.netler, [9, 9, 12]); assert.equal(y6.egim, 1.5); assert.equal(y6.toplam, 3); assert.equal(y6.ilk, 9); assert.equal(y6.son, 12); assert.equal(y6.deneme, 3); assert.equal(y6.n, 0);
    const m1 = by(m, 'M1'); assert.deepEqual(m1.netler, [10, null, 14]); assert.equal(m1.deneme, 2); assert.equal(m1.egim, 2, 'a missed middle exam: 4 net over 2 exams'); assert.equal(m1.toplam, 4);
    const k2 = by(m, 'K2'); assert.equal(k2.n, 7); assert.deepEqual(k2.hoca, { [A]: 6, [B]: 1 }); assert.equal(k2.egim, 2);
      });
  await check('the four fixed groups: n, etüt per student, first and last net, slope per exam, total, and the faint flag', () => {
    const g = model(OGR).gruplar;
    assert.deepEqual(g.map(x => x.ad), ['Etüt yok', '1–2 etüt', '3–5 etüt', '6+ etüt']); assert.deepEqual(g.map(x => x.n), [7, 5, 3, 2]); assert.deepEqual(g.map(x => x.az), [false, false, true, true]);
    assert.deepEqual(g.map(x => x.etut), [0, 1.6, 4, 6.5], 'G5 took one etüt of A and one of B: 2 in all');
    assert.deepEqual(g.map(x => x.ilk), [r2(69 / 7), 10.4, 10, 10.5]); assert.deepEqual(g.map(x => x.son), [r2(86 / 7), 14, 15, 16.5]);
    assert.deepEqual(g.map(x => x.egim), [r2(8.5 / 7), 1.8, 2.5, 3]); assert.deepEqual(g.map(x => x.toplam), [r2(17 / 7), 3.6, 5, 6]);
    // The mean net of those who sat each exam: the middle exam of "Etüt yok" lacks M1 (64 over 6).
    assert.deepEqual(g[0].seri.map(s => s.ort), [r2(69 / 7), r2(64 / 6), r2(86 / 7)]); assert.deepEqual(g[0].seri.map(s => s.n), [7, 6, 7]);
    assert.deepEqual(g[1].seri.map(s => s.ort), [10.4, 12.2, 14]);
  });
  await check('etüt counting: exam days, the day before the first exam, after the last, another lesson and an AYT-only course never count', () => {
    const m = model(OGR);
    for (const id of ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6']) assert.equal(by(m, id).n, 0, id);
    assert.equal(by(m, 'H1').n, 3, 'the 14 Oct etüt falls on the middle exam’s day and still counts: only the first and last exam days bound the period');
    assert(!m.hocalar.some(h => h.key === U(C) || h.key === U(F)));
    const k9 = model(OGR, { duzey: 9 }); assert.equal(k9.duzey, 9); assert.deepEqual(k9.ogrenciler.map(r => r.id), ['K9'], 'another grade is a page of its own'); assert.equal(k9.sinif.egim, 0);
  });
  await check('teachers: students, etüt per student, slope per exam, difference from the class, and overlap', () => {
    const h = model(OGR).hocalar;
    assert.deepEqual(h.map(x => x.ad), ['Sentetik Öğretmen A', 'Sentetik Öğretmen B']);
    // A: G1–G5, H1–H3, K1, K2 (10 students, 30 etüts, slopes 9 + 7.5 + 6 = 22.5). B: G5, H2, K2 (3 students, 1 each, slopes 2 + 3.5 + 2).
    assert.deepEqual(h[0], { key: U(A), ad: 'Sentetik Öğretmen A', n: 10, etut: 3, egim: 2.25, fark: r2(2.25 - 31 / 17), ortak: 3 });
    assert.deepEqual(h[1], { key: U(B), ad: 'Sentetik Öğretmen B', n: 3, etut: 1, egim: 2.5, fark: r2(2.5 - 31 / 17), ortak: 3 });
    assert.equal(h[0].fark, 0.43); assert.equal(h[1].fark, 0.68);
    const f = model(OGR, { ders: 'Fizik' }); assert.equal(f.ders, 'Fizik'); assert.deepEqual(f.hocalar.map(x => [x.ad, x.n]), [['Sentetik Öğretmen F', 1]]);
    assert.equal(f.sinif.n, 18, 'X2 has Fizik nets in all three exams'); assert.equal(f.sinif.egim, r2(17 / 18), '17 students rise 1 per exam, X2 stays at 6'); assert.deepEqual(f.disarida.map(d => d.neden), ['yalnızca 1 denemeye girdi']);
  });
  await check('the weekly etüts of the lesson (Monday first) cover the span of the exams and count the whole grade', () => {
    const w = model(OGR).haftalik;
    assert.deepEqual(w.map(x => [x.bas, x.son]), [['2026-10-05', '2026-10-11'], ['2026-10-12', '2026-10-18'], ['2026-10-19', '2026-10-25']].map(([a, b]) => [gun(a), gun(b)]));
    assert.deepEqual(w.map(x => x.n), [7, 20, 7], 'week of 12 Oct: 19 of the counted students and 1 of X1, who is left out');
  });
  await check('exams with the same title on different dates stay apart and carry their dates', () => {
    const dates = ['2026-10-07', '2026-10-14', '2026-10-21'];
    const ogr = Array.from({ length: 12 }, (_, i) => ({ id: 'g' + i, name: 'SENTETİK GENEL ' + i, cls: '12/A', sessions: i < 6 ? et(MAT, A, '2026-10-16') : [],
      exams: dates.map((date, k) => ({ exam: 'GENEL DENEME', date, session: 'TYT', nets: { mat: 10 + k * (i < 6 ? 2 : 1) } })) }));
    const m = model(ogr);
    assert.equal(m.durum, 'tamam'); assert.equal(m.sinavlar.length, 3); assert.deepEqual(m.sinavlar.map(e => e.etiket), ['GENEL DENEME (7 Eki)', 'GENEL DENEME (14 Eki)', 'GENEL DENEME (21 Eki)']);
    assert.deepEqual(m.gruplar.map(g => [g.n, g.egim]), [[6, 1], [6, 2], [0, null], [0, null]]);
  });
  await check('TYT and AYT: a course named for one session counts for it only; the lesson’s net keys', () => {
    put('SA', { exams: [{ exam: 'X', date: '2026-10-07', session: 'AYT', nets: { edebiyat: 10, cografya1: 3, cografya2: 2.5, tarih1: 1 } }] });
    const net = (k, o, d) => get('ETUT_ETKI.netAl(SA,{key:"' + k + '"},"' + o + '","' + d + '")');
    assert.equal(net('X|2026-10-07', 'AYT', 'Türkçe'), 10); assert.equal(net('X|2026-10-07', 'AYT', 'Coğrafya'), 5.5); assert.equal(net('X|2026-10-07', 'AYT', 'Tarih'), 1);
    assert.equal(net('X|2026-10-07', 'TYT', 'Türkçe'), null); assert.equal(net('X|2026-10-14', 'AYT', 'Türkçe'), null, 'the same title on another date is another exam');
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","TYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","AYT")'), false);
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK AYT","AYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("Matematik","AYT")'), true);
    // An AYT page: the AYT exams, the AYT-only etüt counts, the TYT-only one does not.
    const ayt = Array.from({ length: 4 }, (_, i) => ({ id: 'a' + i, name: 'SENTETİK AYT ' + i, cls: '12/A', sessions: [...et('MATEMATİK AYT', A, '2026-10-16'), ...et('MATEMATİK TYT', B, '2026-10-16')],
      exams: [['AYT-1', '2026-10-07'], ['AYT-2', '2026-10-21']].map(([exam, date], k) => ({ exam, date, session: 'AYT', nets: { mat: 10 + 2 * k } })) }));
    const m = model(ayt, { oturum: 'AYT' }); assert.deepEqual(m.oturumlar, ['AYT']); assert.deepEqual(m.hocalar.map(h => h.ad), ['Sentetik Öğretmen A']); assert.equal(m.gruplar[1].n, 4);
  });
  await check('Son 4 deneme: only the last four exams, their etüts and their slope', () => {
    const dates = ['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04'], nets = [20, 10, 10, 12, 14];
    const ogr = Array.from({ length: 6 }, (_, i) => ({ id: 's' + i, name: 'SENTETİK DÖRT ' + i, cls: '12/A', sessions: et(MAT, A, '2026-10-09', '2026-10-30'),
      exams: dates.map((date, k) => ({ exam: 'DENEME ' + (k + 1), date, session: 'TYT', nets: { mat: nets[k] } })) }));
    let m = model(ogr); assert.equal(m.sinavlar.length, 5); assert.equal(by(m, 's0').egim, -1, 'all five: (−2×6.8 − 1×−3.2 … ) / 10 worked out by hand'); assert.equal(by(m, 's0').n, 2);
    m = model(ogr, { donem: 'son4' }); assert.equal(m.donem, 'son4'); assert.deepEqual(m.sinavlar.map(e => e.ad), ['DENEME 2', 'DENEME 3', 'DENEME 4', 'DENEME 5']);
    assert.equal(by(m, 's0').egim, 1.4, '10, 10, 12, 14: 7 / 5'); assert.equal(by(m, 's0').toplam, 4.2); assert.equal(by(m, 's0').n, 1, 'the 9 Oct etüt is before the first exam of the period');
    assert.equal(m.sinif.egim, 1.4); assert.deepEqual(m.haftalik.map(x => x.n), [0, 0, 6, 0], 'one etüt each on 30 Oct (week of 26 Oct)');
    assert.equal(model(ogr, { donem: 'baska' }).donem, 'tum');
  });
  await check('coverage: days no etüt report covers are counted and shown; matching warnings are shown', () => {
    const kap = [[gun('2026-10-15'), gun('2026-10-20')]];
    assert.equal(model(OGR, {}, kap).eksik, 5, '8, 9, 12, 13, 14 Oct are weekdays outside the report'); assert.equal(model(OGR).eksik, null, 'unknown coverage is not zero');
    merged(OGR, kap); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /id="eeKapsam"[^>]*>Etüt raporları bu dönemin 5 iş gününü kapsamıyor/);
    merged(OGR, [[gun('2026-10-01'), gun('2026-10-31')]]); assert(!run('ETUT_ETKI.icerik()').includes('eeKapsam'));
    merged(OGR, null, ['SENTETİK ÇİFT: ad/şube birden fazla öğrenciye ait; kaydı eşleştirilmedi.']); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /id="eeDurum">Eşleştirme: SENTETİK ÇİFT: ad\/şube birden fazla öğrenciye ait/);
  });
  await check('page: the sentence, the counts, the controls and the sections in order, with no manual words', () => {
    merged(OGR); let h = run('ETUT_ETKI.icerik()');
    const metin = id => new RegExp('<p class="et-cumle" id="' + id + '">(.*?)</p>').exec(h)[1].replace(/<[^>]+>/g, '');
    assert.equal(metin('eeCumle'), '12. sınıf · Matematik · 3 deneme (7 Eki – 21 Eki) · 17 öğrenci her denemede ortalama ▲1,82 net arttı. En çok etüt alan (6+) 2 öğrenci ▲3,00, etüt almayan 7 öğrenci ▲1,21.');
    assert.equal(metin('eeSayim'), '19 öğrenciden 17’si sayıldı; 2’si dışarıda (aşağıda listelenir).');
    assert.match(h, /<p class="mini" id="eeSinir">Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir\.<\/p>/);
    const sira = ['id="eeCumle"', 'class="et-arac"', 'id="eeGrafik"', 'id="eeGruplar"', 'id="eeHocalar"', 'id="eeOgrenciler"', 'id="eeDisarida"'].map(k => h.indexOf(k)); assert(sira.every(i => i > 0), String(sira));
    assert.deepEqual([...sira].sort((a, b) => a - b), sira, 'order: sentence, controls, chart, groups, teachers, students, left out');
    assert.match(h, /data-ee-duzey="12" aria-pressed="true"/); assert.match(h, /data-ee-oturum="AYT"[^>]*disabled/); assert.match(h, /<select id="eeDers" aria-label="Ders">/);
    assert.match(h, /data-ee-donem="tum" aria-pressed="true">Tümü/); assert.match(h, /data-ee-donem="son4" aria-pressed="false">Son 4 deneme/);
    assert(!/eeOnceki|eeSimdi|data-ee-pencere|eeSeri|eeDoz|eeNot\b/.test(h), 'the old pair pickers, window and tables are gone');
    assert(!yasak.test(h.replace(/<[^>]+>/g, ' ')), 'no method words: ' + (yasak.exec(h.replace(/<[^>]+>/g, ' ')) || [])[0]);
    for (const b of ['Grup', 'Öğrenci', 'Etüt / öğrenci', 'İlk denemelerde net', 'Son denemelerde net', 'Deneme başına artış (net)', 'Toplam artış (net)', 'Öğretmen', 'Sınıftan fazla / az (net)', 'Etüt sayısı', 'Deneme sayısı'])
      assert(h.includes('>' + b + '</th>'), b);
    assert.match(h, /<th class="sayi">Öğrenci<\/th>/); assert.equal((h.match(/<th class="sayi[ "]/g) || []).length, 6 + 4 + 4, 'every numeric header is a .sayi header');
    assert.match(h, /3’ü başka öğretmenden de aldı/);
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 17, 'one row per counted student');
    assert.match(h, /<details id="eeDisarida"><summary>Dışarıda kalan 2 öğrenci<\/summary>[\s\S]*Sentetik Öğrenci X1 · 12\/A · yalnızca 1 denemeye girdi[\s\S]*Sentetik Öğrenci X2 · 12\/A · bu dersin neti yok/);
    assert(!h.includes('NaN') && !h.includes('undefined'));
    // A teacher’s students; the left-out list stays whole.
    run("EK.eeHoca='SENTETİK ÖĞRETMEN B'"); h = run('ETUT_ETKI.icerik()');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 3); assert.match(h, /<h2>Öğrenciler · Sentetik Öğretmen B<\/h2>/); assert.match(h, /<tr class="secili">/); assert.match(h, /data-ee-hoca="">Tüm öğretmenler/); assert.match(h, /Dışarıda kalan 2 öğrenci/);
    // Controls change the page.
    run("EK.eeHoca=undefined;EK.eeDers='Fizik'"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /· Fizik · 3 deneme/); assert.match(h, /Sentetik Öğretmen F/);
    run("EK.eeDers=undefined;EK.eeDonem='son4'"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /data-ee-donem="son4" aria-pressed="true"/);
    run('EK.eeDonem=undefined'); merged(OGR.map(s => s.id === 'G1' ? { ...s, name: 'SENTETİK <ÖĞRENCİ> "1"' } : s)); h = run('ETUT_ETKI.icerik()'); assert(!h.includes('<öğrenci>')); assert.match(h, /&lt;öğrenci&gt;/);
  });
  await check('the chart: a line per non-empty group, the class dashed, labels at the right end, faint small groups, weekly bars from zero', () => {
    const m = model(OGR); put('__m', m);
    const svg = get('ETUT_ETKI.grafikSvg(__m,640)');
    assert.equal((svg.match(/<path class="ee-cizgi/g) || []).length, 5, 'four groups and the class'); assert.equal((svg.match(/<path class="ee-cizgi az/g) || []).length, 2, 'the 3–5 and 6+ groups are faint'); assert.equal((svg.match(/<path class="ee-cizgi kesik/g) || []).length, 1);
    for (const t of ['Etüt yok · 12,29', '1–2 etüt · 14,00', '3–5 etüt · 15,00', '6+ etüt · 16,50', 'Sınıf · 13,76']) assert(svg.includes('>' + t + '</text>'), t);
    assert(svg.includes('>(3 öğrenci)</text>') && svg.includes('>(2 öğrenci)</text>') && !svg.includes('(5 öğrenci)'));
    assert(svg.includes('>Haftalık etüt</text>')); assert.equal((svg.match(/<rect class="ee-cubuk"/g) || []).length, 3);
    for (const g of ['7 Eki', '14 Eki', '21 Eki']) assert(svg.includes('>' + g + '</text>'), g);
    assert(!svg.includes('NaN') && !svg.includes('undefined')); assert(!svg.includes('<legend') && !/lejant/.test(svg));
    // Each label sits clear of the next one: the y of the label texts are at least 14 px apart.
    const ys = [...svg.matchAll(/<text class="ee-ad" x="[\d.]+" y="([\d.]+)"/g)].map(x => Number(x[1])).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert(ys[i] - ys[i - 1] >= 14, 'labels overlap: ' + ys);
    const dar = get('ETUT_ETKI.grafikSvg(__m,300)'); assert(dar.includes('viewBox="0 0 300 ') && !dar.includes('NaN'));
    // A group missing from an exam is a gap, not a zero.
    const bos = { ...m, gruplar: m.gruplar.map(g => g.k === '1-2' ? { ...g, seri: [g.seri[0], null, g.seri[2]] } : g) }; put('__b', bos);
    assert.equal((get('ETUT_ETKI.grafikSvg(__b,640)').match(/<path class="ee-cizgi/g) || []).length, 4, 'the cut line has two points alone, so no path');
  });
  await check('page states: no data, one exam, no etüt in the period, nobody with two exams, a failing source', () => {
    merged([]); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/); assert.match(h, /data-sekme="etutler"/);
    merged([OGR[0]].map(s => ({ ...s, exams: s.exams.slice(0, 1) }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /İki deneme gerekli/);
    merged(OGR.map(s => ({ ...s, sessions: [] }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /Dönemde etüt kaydı yok/); assert(!h.includes('id="eeHocalar"') && !h.includes('id="eeGrafik"')); assert.match(h, /data-ee-donem="tum"/);
    run('OGRENCI_RAPOR.temelOgrenciler=()=>{throw new Error("Rapor okunamadı.")}'); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<p class="et-uyari">Rapor okunamadı\.<\/p>/);
    merged(OGR); assert.match(run('ETUT_ETKI.icerik()'), /data-ee-duzey="9" aria-pressed="false"/);
    // Everyone sat only one exam: the page says so instead of drawing nothing.
    merged(OGR.filter(s => s.id.startsWith('G')).map((s, i) => ({ ...s, exams: [s.exams[i % 2 ? 2 : 0]] }))); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /bu derste en az iki denemesi olan öğrenci yok/); assert(!h.includes('id="eeGrafik"') && !h.includes('NaN'));
  });
  await check('menu, viewing teacher and privacy: under Öğrenciler, rehber only, nothing stored or sent to students', () => {
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    assert.equal(get("SEKME_REHBER.some(s=>s[0]==='etutetki'&&s[1]==='Etüt etkisi')"), true); assert.equal(get("SEKME_OGRENCI.some(s=>s[0]==='etutetki')"), false);
    run("D.rol='ogrenci'"); assert.match(run('gorunumEtutEtki()'), /rehber öğretmen içindir/); run("D.rol='rehber'");
    merged(OGR); const once = run('JSON.stringify(D)'); run('ETUT_ETKI.icerik();ETUT_ETKI.gorunum()'); assert.equal(run('JSON.stringify(D)'), once);
    run('yalnizcaGoruntuleme=()=>true'); assert.match(run('ETUT_ETKI.gorunum()'), /<div id="eeKok">[\s\S]*Öğretmenlere göre/);
  });
  console.log(passed + ' Etüt etkisi checks passed');
})();
