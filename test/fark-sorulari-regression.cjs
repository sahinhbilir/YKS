'use strict';
// Yanlışlar defteri → Ders öğretmenleri: fark soruları. Who is judged on which test (TYT everyone, Din compulsory, Ek Felsefe never; AYT only the
// field's tests, the field from the notebook, the şube's alan, the şube's answers or the student's own), the school's rates worked by hand, the chance
// test that picks the questions (z ≤ −1,96), the sentence with the Turkish possessive, the model (a sheet per teacher and exam subject over the şubeler
// of the timetables, or per ders for the whole school without them; dersler with none, exams without a Performans analizi, şubeler without a teacher),
// the page and the PDF plan: the data in words, no points and no colours. Synthetic data only (test/yanlislar-fixtures.cjs).
const fs = require('node:fs'), assert = require('node:assert/strict');
const fixture = fs.readFileSync('test/yanlislar-regression.cjs', 'utf8').split('(async () => {')[0];
const {T, run, Y, kit, kur, bytes, copy} = new Function('require', fixture + '\nreturn {T,run,Y,kit,kur,bytes,copy};')(require);
const S = T.durumu();
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const sayfaHazirla = (ogr = []) => run(`D=varsayilan();D.rol='rehber';D.ogr=${JSON.stringify(ogr)};EK.sekme='yanlislar'`);
// Timetables (Etüt planı): Türkçe by two teachers (12/A, 12/B), Din in both by a third; Tarih has no teacher here.
const SA = ['09.00', '10.00'];
const PLAN = {'12/A': {kod: '301', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TÜRKÇE', 'SENTETİK ÖĞRETMEN TÜR A'], [0, '10.00', 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK ÖĞRETMEN DİN']]},
  '12/B': {kod: '302', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TÜRKÇE', 'SENTETİK ÖĞRETMEN TÜR B'], [0, '10.00', 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK ÖĞRETMEN DİN']]}};
const planKur = () => run(`(()=>{const p=ETUTPLANI.oku().plan;p.programlar=${JSON.stringify(PLAN)};D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)))})()`);
const perfKur = dersler => T.performansCoz(Y.itemlere(Y.performansSpec({dersler})));
// 1203's TYT: Türkçe 1-4, then the SOS test: Tarih 1-2, Din 3-4, Ek Felsefe 5-6 (keys KEY_A); three students. With three students only a near-certain
// question is behind beyond chance: Türkçe 3 (ours 1/3, theirs 97 %) and Din 4 (1/3 against 95 %); Din 3 (2/3 against 90 %, 23 points) may be chance.
const PERF = [{ad: 'TÜRKÇE-T', n: 4, anahtar: Y.KEY_A.slice(0, 4), p: [.9, .7, .97, .2]}, {ad: 'TARİH-T', n: 2, anahtar: Y.KEY_A.slice(4, 6), p: [.6, .4]},
  {ad: 'DİN KÜLTÜRÜ-T', n: 2, anahtar: Y.KEY_A.slice(6, 8), p: [.9, .95]}, {ad: 'S.FELSEFE-T', n: 2, anahtar: Y.KEY_A.slice(8, 10), p: [.55, .02]}];
const sahteResim = e => { for (const [ti, t] of Object.values(e.kitlar).flatMap(k => k.testler).entries()) t.sorular.forEach(q => e.crops.set(ti + ':' + q.no, {url: 'blob:sentetik-' + ti + '-' + q.no, blob: null, w: 400, h: 200, genis: false})) };
async function sinav({perf = PERF, harita = true} = {}) {
  const {rapor, k} = await kur({method: 8}); T.sifirla(); sayfaHazirla();
  const e = T.denemeKoy({kitlar: {TYT: k}, rapor, pairs: harita ? {TYT: Y.HARITA} : {}, perf: perf ? perfKur(perf) : null}); sahteResim(e);
  return e;
}
// AYT: a two-session report. EDB test = Edebiyat 1-3 + Tarih-1 4-5, MAT test = Matematik 1-3 (key A B C D E | A B C).
const AYT = [
  {no: '7001', ad: 'SENTETİK SAY 1', sube: '205 12/C', kit: 'A', cev: ['', '', '', '', '', '', '', '']},          // SAY in the notebook, everything blank
  {no: '7002', ad: 'SENTETİK SAY 2', sube: '205 12/C', kit: 'A', cev: ['', '', '', 'D', '', 'A', '', '']},         // SAY, with one Tarih-1 answer that does not count
  {no: '7003', ad: 'SENTETİK ŞUBE C', sube: '205 12/C', kit: 'A', cev: ['', '', '', '', '', '', '', '']},          // no alan: the şube's (SAY)
  {no: '7004', ad: 'SENTETİK ŞUBE D 1', sube: '205 12/D', kit: 'A', cev: ['A', 'B', '', '', '', '', '', '']},
  {no: '7005', ad: 'SENTETİK ŞUBE D 2', sube: '205 12/D', kit: 'A', cev: ['A', '', '', '', 'E', '', '', '']},
  {no: '7006', ad: 'SENTETİK ŞUBE D 3', sube: '205 12/D', kit: 'A', cev: ['', '', '', '', '', '', '', '']},        // no alan anywhere in 12/D: the tests most of 12/D answered
  {no: '7007', ad: 'SENTETİK EA', sube: '205 12/E', kit: 'A', cev: ['', '', '', '', '', '', '', '']},             // EA: Edebiyat–Sosyal-1 and Matematik
  {no: '7008', ad: 'SENTETİK ŞUBE F 1', sube: '205 12/F', kit: 'A', cev: ['A', '', '', '', '', '', '', '']},       // 12/F: no alan, no test most answered:
  {no: '7009', ad: 'SENTETİK ŞUBE F 2', sube: '205 12/F', kit: 'A', cev: ['', '', '', '', '', 'A', '', '']}];      //   each student's own answered tests
const NOTDEFTERI = [{no: '7001', alan: 'SAY'}, {no: '7002', alan: 'SAY'}, {no: '7007', alan: 'EA'}];
async function iki() {
  const rapor = await T.raporCoz(bytes(Y.raporXlsx2({ayt: {ogrenciler: AYT}}))), kT = kit(), kA = T.kitapcikCoz(Y.kitapcikSayfalariAyt()), es = T.esle(rapor, {TYT: kT, AYT: kA});
  return {rapor, kT, kA, es};
}

(async () => {
  await test('the Turkish possessive after a percentage: %60’ı, %10’u, %50’si, %100’ü', () => {
    const e = n => run(`YANLISLAR.ekli(${n})`);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(e), ['%0’ı', '%1’i', '%2’si', '%3’ü', '%4’ü', '%5’i', '%6’sı', '%7’si', '%8’i', '%9’u']);
    assert.deepEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(e), ['%10’u', '%20’si', '%30’u', '%40’ı', '%50’si', '%60’ı', '%70’i', '%80’i', '%90’ı', '%100’ü']);
    assert.deepEqual([15, 33, 67, 25, 46].map(e), ['%15’i', '%33’ü', '%67’si', '%25’i', '%46’sı']);
  });

  await test('who counts, TYT: everyone who sat it on every test, blanks as wrong; Din is compulsory; Ek Felsefe never counts', async () => {
    const {rapor, es} = await kur(); sayfaHazirla();
    const f = T.sayilanKural(rapor, es).f, ad = o => [...f(o)].map(i => es.bolumler[i].ders);
    const [a, b, c] = rapor.ogrenciler;   // 9001 left Ek Felsefe blank; 9002 left Din blank and answered Ek Felsefe; 9003 answered everything
    for (const o of [a, b, c]) assert.deepEqual(ad(o), ['Türkçe', 'Tarih', 'Din Kültürü'], o.no);
  });

  await test('who counts, AYT: only the field’s tests, blanks as wrong (another test answered does not count); the field from the notebook, the şube’s alan, what most of the şube answered, or the student’s own answers', async () => {
    const {rapor, es} = await iki(); sayfaHazirla(NOTDEFTERI);
    const k = T.sayilanKural(rapor, es), ayt = no => [...k.f(rapor.ogrenciler.find(o => o.no === no))].map(i => es.bolumler[i]).filter(b => b.oturum === 'AYT').map(b => b.ders);
    const EDB = ['Türk Dili ve Edebiyatı', 'Tarih-1'], MAT = ['Matematik'];
    assert.deepEqual(ayt('7001'), MAT, 'SAY: Matematik counts even left wholly blank; Edebiyat–Sosyal-1 does not');
    assert.deepEqual(ayt('7002'), MAT, 'SAY with one Tarih-1 answer: still Matematik only');
    assert.deepEqual(ayt('7003'), MAT, 'no alan: the alan most of the şube has in the notebook (SAY)');
    assert.deepEqual([ayt('7004'), ayt('7005'), ayt('7006')], [EDB, EDB, EDB], 'no alan in the whole şube: the tests more than half of it answered, blank for 7006');
    assert.deepEqual(ayt('7007'), [...EDB, ...MAT], 'EA: both of its tests, even blank');
    assert.deepEqual([ayt('7008'), ayt('7009')], [EDB, MAT], 'no alan and no test most of the şube answered: the tests the student answered');
    assert.deepEqual(ayt('9001'), [], 'a student who sat only the TYT has no AYT test');
    // the cache follows the notebook: once 7003 is EA, it is judged on EA's tests
    sayfaHazirla([...NOTDEFTERI, {no: '7003', alan: 'EA'}]); const k2 = T.sayilanKural(rapor, es);
    assert.notEqual(k2.imza, k.imza); assert.deepEqual([...k2.f(rapor.ogrenciler.find(o => o.no === '7003'))].map(i => es.bolumler[i].ders), [...EDB, ...MAT]);
  });

  await test('school rates by hand: the students judged on the test, B through the çözüm map, a blank is wrong; the options our students marked; no Ek Felsefe', async () => {
    const e = await sinav(), m = T.okulMaddeleri(e), r = k => { const x = m.get(k); return x && [x.dogru, x.n] };
    // Türkçe (test 0): A1 3/3, A2 2/3 (9001 C), A3 1/3 (two blanks), A4 3/3
    assert.deepEqual([r('0:1'), r('0:2'), r('0:3'), r('0:4')], [[3, 3], [2, 3], [1, 3], [3, 3]]);
    assert.deepEqual(copy(m.get('0:2').sec), {A: 0, B: 2, C: 1, D: 0, E: 0, '': 0}); assert.deepEqual(copy(m.get('0:3').sec), {A: 0, B: 0, C: 1, D: 0, E: 0, '': 2});
    // SOS (test 1): Din 3-4 counts all three (9002 left it blank: wrong, not skipped); Ek Felsefe 5-6 never counts
    assert.deepEqual([r('1:3'), r('1:4')], [[2, 3], [1, 3]]); assert.equal(m.has('1:5') || m.has('1:6'), false);
    // without the çözüm map the B student is not counted (its question numbers are not A's)
    const e2 = await sinav({harita: false}); assert.deepEqual([T.okulMaddeleri(e2).get('0:3').n, T.okulMaddeleri(e2).get('1:3').n], [2, 2]);
    assert.equal(T.okulOranlari(e).get('0:3'), 1 / 3, 'okulOranlari: the same rates');
  });

  await test('AYT school rates follow the rule: SAY students are not in Edebiyat, even one who answered a Tarih-1 question; the student’s own list shows the same rate', async () => {
    const {rapor, kT, kA} = await iki(); T.sifirla(); sayfaHazirla(NOTDEFTERI);
    const e = T.denemeKoy({kitlar: {TYT: kT, AYT: kA}, rapor}), m = T.okulMaddeleri(e), t = e.es.bolumler.find(b => b.ders === 'Türk Dili ve Edebiyatı').test, tm = e.es.bolumler.find(b => b.ders === 'Matematik').test;
    // Edebiyat 1 (key A): judged 7004 A, 7005 A, 7006 (blank), 7007 (blank), 7008 A: 3 / 5
    const ed = m.get(t + ':1'); assert.deepEqual([ed.dogru, ed.n], [3, 5]);
    const mt = m.get(tm + ':1'); assert.deepEqual([mt.dogru, mt.n], [2, 5], 'Matematik 1 (key A): 7001, 7002 A, 7003, 7007, 7009 A');
    const L = copy(T.ogrenciListesi('7006')), satir = L.s[0].d.find(d => d[0] === 'Türk Dili ve Edebiyatı')[2][0];
    assert.deepEqual(satir.slice(0, 4), ['1', '', 'A', 60], 'Okulunda doğru = the same 3 / 5');
    assert.deepEqual(copy(T.ogrenciListesi('7002').s[0].d.map(d => d[0])), ['Matematik'], 'a SAY student’s list has no Edebiyat');
  });

  await test('one question by hand: z = (D − N·p) / √(N·p·(1 − p)) picks it (≤ −1,96), the gap it needs follows N; rates rounded for the sentence; the wrong option most marked', () => {
    const e = {rapor: {anahtar: {A: ['C']}}}, eb = {off: 0, test: 0, bas: 0, n: 1, ad: 'TÜRKÇE-T'};
    const pm = p => new Map([[T.key('TÜRKÇE-T'), {n: 1, maddeler: [{p}]}]]);
    const om = (dogru, n, sec) => new Map([['0:1', {dogru, n, p: dogru / n, sec: {A: 0, B: 0, C: dogru, D: 0, E: 0, '': 0, ...sec}}]]);
    let x = T.farkSorusu(e, eb, 0, om(9, 30, {B: 15, '': 6}), pm(.5));
    assert.deepEqual(copy([x.okul, x.okullar, x.geride, x.yanlis, x.yanlisPay, x.bos, x.cevap, x.n]), [30, 50, true, 'B', 50, 20, 'C', 30]);
    assert(Math.abs(x.z - (9 - 15) / Math.sqrt(7.5)) < 1e-12, '30 students, 30 % against 50 %: z = −6 / √7,5 = −2,19');
    assert.equal(T.farkSorusu(e, eb, 0, om(3, 10, {}), pm(.5)).geride, false, '10 students, 30 % against 50 %: z = −1,26, may be chance');
    assert.equal(T.farkSorusu(e, eb, 0, om(3, 20, {}), pm(.5)).geride, true, 'the example: 15 % against 50 % with 20 students');
    assert.equal(T.farkSorusu(e, eb, 0, om(90, 200, {}), pm(.52)).geride, true, '200 students: 45 % against 52 % is already real (z = −1,98)');
    assert.equal(T.farkSorusu(e, eb, 0, om(29, 30, {}), pm(1)).geride, false, 'a printed 1,00 is read as 0,99: one miss in thirty is no gap');
    x = T.farkSorusu(e, eb, 0, om(2, 20, {B: 8, '': 4}), pm(.6));
    assert.equal(T.farkCumle({ogretmen: 'Sentetik Öğretmen'}, x), 'Sınav okullarında öğrencilerin %60’ı bu soruyu doğru cevapladı; şubelerinizde yalnızca %10’u.');
    assert.equal(T.farkCumle({ogretmen: null}, x), 'Sınav okullarında öğrencilerin %60’ı bu soruyu doğru cevapladı; okulumuzda yalnızca %10’u.', 'without timetables: the whole school');
    x = T.farkSorusu(e, eb, 0, om(0, 5, {A: 5}), pm(.5)); assert.equal(T.farkCumle({ogretmen: 'X'}, x), 'Sınav okullarında öğrencilerin %50’si bu soruyu doğru cevapladı; şubelerinizde kimse doğru cevaplamadı.');
    // a rate printed out of 100 is read as a share; a missing rate gives no question
    assert.equal(T.farkSorusu(e, eb, 0, om(9, 30, {}), pm(50)).okullar, 50); assert.equal(T.farkSorusu(e, eb, 0, om(9, 30, {}), new Map()), null);
  });

  await test('two groups: when the Performans analizi prints few pupils for a ders (25 on AYT Sosyal-2), its rate is a sample too: z = (D/N − p) / √(p̄(1 − p̄)(1/N + 1/M))', () => {
    const z2 = (D, N, p, M) => { const pb = Math.min(.99, Math.max(.01, (D + p * M) / (N + M))); return (D / N - p) / Math.sqrt(pb * (1 - pb) * (1 / N + 1 / M)) };
    const Z = (D, N, p, M) => run(`YANLISLAR.farkZ(${D},${N},${p},${M})`);
    assert(Math.abs(Z(3, 8, 1, 25) - z2(3, 8, 1, 25)) < 1e-12); assert(Math.abs(Z(3, 8, 1, 25) - -4.287) < .01, '3 of 8 against 25 of 25: still behind (z ≈ −4,3, not −17)');
    assert(Z(2, 8, .64, 25) > -1.96, '2 of 8 against 64 % of 25: may be chance');
    assert(Z(2, 8, .64, null) <= -1.96, 'the same against a rate of thousands: behind');
    assert(Math.abs(Z(9, 30, .5, 100000) - Z(9, 30, .5, null)) < .01, 'many pupils: the one-group test');
    // the question carries the count it was compared against
    const e = {rapor: {anahtar: {A: ['C']}}}, eb = {off: 0, test: 0, bas: 0, n: 1, ad: 'TÜRKÇE-T'};
    const x = T.farkSorusu(e, eb, 0, new Map([['0:1', {dogru: 2, n: 8, p: .25, sec: {A: 0, B: 0, C: 2, D: 0, E: 0, '': 6}}]]), new Map([[T.key('TÜRKÇE-T'), {n: 1, orneklem: 25, maddeler: [{p: .64}]}]]));
    assert.deepEqual(copy([x.okullarN, x.geride]), [25, false]);
  });

  await test('the model without timetables: a sheet per ders for the whole school; only questions behind beyond chance; dersler with none, exams without a Performans analizi, the ders ticks', async () => {
    const e = await sinav(); Object.assign(S, {gorunum: 'ders', ogretmen: ''});
    let M = T.farkModeli();
    assert.equal(M.ogretmenli, false);
    assert.deepEqual(copy(M.geride.map(g => [g.ogretmen, g.ders, g.oturum, g.denemeler[0].sorular.map(x => x.a)])), [[null, 'Türkçe', 'TYT', [3]], [null, 'Din Kültürü', 'TYT', [4]]]);
    assert.deepEqual(copy(M.temiz.map(g => g.ders)), ['Tarih']); assert.deepEqual(copy(M.eksik), []);
    assert(!M.sayfalar.some(g => g.ders === 'Ek Felsefe'), 'Ek Felsefe never counts, even 1 of 2 against 2 %');
    const [tr] = M.geride, d = tr.denemeler[0], x = d.sorular[0];
    assert.deepEqual(copy([d.ad, d.n, d.toplam]), ['SENTETİK-1203', 3, 4]);
    assert.deepEqual(copy([x.a, x.okul, x.okullar, x.geride, x.cevap, x.yanlis, x.bos]), [3, 33, 97, true, 'C', null, 67]);
    // Din 3: 23 points behind (67 against 90) but three students: may be chance, so not listed
    const din3 = T.farkSorusu(e, e.es.bolumler.find(b => b.ders === 'Din Kültürü'), 0, T.okulMaddeleri(e), new Map(e.perf.dersler.map(x => [T.key(x.ad), x])));
    assert.deepEqual(copy([din3.okul, din3.okullar, din3.geride]), [67, 90, false]);
    S.kapali = new Set(['Türkçe']); assert.deepEqual(copy(T.farkModeli().geride.map(g => g.ders)), ['Din Kültürü'], 'an unticked ders is left out'); S.kapali = new Set();
    // Hangi sorular: a fixed gap instead of the chance test lists Din 3 too (67 against 90: 23 points), whatever the number of students
    S.secim = 20; M = T.farkModeli();
    assert.deepEqual(copy(M.geride.map(g => [g.ders, g.denemeler[0].sorular.map(x => [x.a, x.fark])])), [['Türkçe', [[3, -64]]], ['Din Kültürü', [[3, -23], [4, -62]]]]);
    S.secim = 25; assert.deepEqual(copy(T.farkModeli().geride.map(g => [g.ders, g.denemeler[0].sorular.map(x => x.a)])), [['Türkçe', [3]], ['Din Kültürü', [4]]], '25 points: Din 3 (23) is out');
    S.secim = 'z';
    // a second exam without the Performans analizi is named, not guessed
    const {rapor, k} = await kur({method: 8}); T.denemeKoy({kod: '1299', kitlar: {TYT: k}, rapor, ad: 'SENTETİK-1299'});
    assert.deepEqual(copy(T.farkModeli().eksik), ['SENTETİK-1299']);
    assert.doesNotMatch(JSON.stringify(T.farkModeli(), (k, v) => k === 'e' ? undefined : v), /(?<![\d.])\d{11}(?![\d.])/, 'no TC in the model');
  });

  await test('the model with timetables: a sheet per teacher and exam subject over the şubeler the teacher teaches it in; the Öğretmen filter; şubeler with no teacher are named', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ders', ogretmen: ''});
    let M = T.farkModeli();
    assert.equal(M.ogretmenli, true); assert.deepEqual(copy(M.ogretmenler), ['Sentetik Öğretmen Din', 'Sentetik Öğretmen Tür A', 'Sentetik Öğretmen Tür B']);
    assert.deepEqual(copy(M.geride.map(g => [g.ogretmen, g.ders, g.siniflar, g.soru])), [['Sentetik Öğretmen Din', 'Din Kültürü', ['12/A', '12/B'], 1], ['Sentetik Öğretmen Tür A', 'Türkçe', ['12/A'], 1]]);
    assert.deepEqual(copy(M.temiz.map(g => g.ogretmen)), ['Sentetik Öğretmen Tür B'], '12/B answered every Türkçe question right');
    // 12/A alone (9001 A, 9002 B through the map): Türkçe 3 nobody against 97 % (listed); Türkçe 2 1/2 against 70 % may be chance
    const tA = M.geride[1].denemeler[0];
    assert.deepEqual(copy([tA.n, tA.sorular.map(x => [x.a, x.okul, x.okullar])]), [2, [[3, 0, 97]]]);
    assert.equal(T.farkCumle(M.geride[1], tA.sorular[0]), 'Sınav okullarında öğrencilerin %97’si bu soruyu doğru cevapladı; şubelerinizde kimse doğru cevaplamadı.');
    assert.deepEqual(copy(M.sahipsiz), ['TYT Tarih (12/A, 12/B)'], 'Ek Felsefe never counts, so it needs no teacher');
    S.ogretmen = 'Sentetik Öğretmen Tür A'; M = T.farkModeli(); assert.deepEqual(copy(M.sayfalar.map(g => g.ogretmen)), ['Sentetik Öğretmen Tür A']);
    S.ogretmen = 'Böyle biri yok'; M = T.farkModeli(); assert.equal(S.ogretmen, '', 'an unknown teacher falls back to all'); assert.equal(M.sayfalar.length, 3);
    run('delete D.etutPlani');
  });

  await test('the page: Defter switch, Öğretmen, how the questions are picked, one sheet per teacher and subject with the picture and the data in words; no points, no colours', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ogrenci', ogretmen: ''});
    let out = T.gorunum();
    assert.match(out, /data-yd-gorunum="ogrenci" aria-pressed="true">Öğrenci defterleri<\/button><button type="button" class="yd-chip" data-yd-gorunum="ders" aria-pressed="false">Ders öğretmenleri: fark soruları<\/button>/);
    S.gorunum = 'ders'; out = T.gorunum();
    assert.match(out, /<label class="yd-sec">Öğretmen<select data-yd-f="ogretmen"><option value="" selected>Bütün öğretmenler<\/option><option value="Sentetik Öğretmen Din">/);
    assert.match(out, /<label class="yd-sec">Hangi sorular<select data-yd-f="secim"><option value="z" selected>Tesadüf olamayacak kadar geride<\/option><option value="10">En az 10 puan geride<\/option><option value="15">En az 15 puan geride<\/option><option value="20">En az 20 puan geride<\/option>/, 'the chance test by default, a fixed gap as an option');
    assert.doesNotMatch(out, /data-yd-f="alan"|data-yd-f="sube"|data-yd-f="ogr"|Kendi seviyesi/, 'no student filters in this view');
    assert.match(out, /Listelenen sorular: şubelerin doğru oranının, öğrenci sayısına göre tesadüfle açıklanamayacak kadar sınav okullarının altında kaldığı sorular \(z ≤ −1,96\)\./);
    assert.match(out, /<span><b>Sentetik Öğretmen Din · TYT Din Kültürü<\/b> 1<\/span><span><b>Sentetik Öğretmen Tür A · TYT Türkçe<\/b> 1<\/span>/);
    assert.match(out, /Belirgin biçimde geride kalınan soru yok: Sentetik Öğretmen Tür B · TYT Türkçe/); assert.match(out, /Ders programında öğretmeni olmayan: TYT Tarih \(12\/A, 12\/B\)\./);
    S.secim = 20; let o20 = T.gorunum(); S.secim = 'z';
    assert.match(o20, /<option value="20" selected>En az 20 puan geride<\/option>/);
    assert.match(o20, /Listelenen sorular: sınav okullarında doğru cevaplayanların oranının şubelerinkinden en az 20 puan yüksek olduğu sorular \(öğrenci sayısına bakılmaksızın\)\./);
    assert.match(o20, /<span><b>Sentetik Öğretmen Din · TYT Din Kültürü<\/b> 2<\/span>/, 'Din 3 and 4');
    assert.doesNotMatch(o20.split('<div class="yd-baski"')[1].replace(/<[^>]+>/g, ' '), /puan|Fark|fark/, 'the sheet still says no points');
    const sayfalar = out.split('<article class="yd-ogr yd-fd"').slice(1); assert.equal(sayfalar.length, 2);
    const a = sayfalar[1];
    assert.match(a, /<h2>TYT Türkçe<\/h2><p class="yd-kimlik"><b>Sentetik Öğretmen Tür A · 12\/A<\/b><\/p><p class="yd-kimlik">Bu denemede şubelerinizin sınav okullarının gerisinde kaldığı sorular<\/p><p class="yd-say"><b>1<\/b> soru<\/p>/);
    assert.match(a, /SENTETİK-1203 <span class="yd-tarih">01\.01\.2000<\/span><\/h3><p class="yd-kimlik">2 öğrenci · 1 \/ 4 soru<\/p>/);
    assert.match(a, /<b>Soru 3<\/b><\/span><\/figcaption><p class="yd-fs-cumle">Sınav okullarında öğrencilerin %97’si bu soruyu doğru cevapladı; şubelerinizde kimse doğru cevaplamadı\.<\/p><p class="yd-fs-bilgi"><span>Doğru cevap: C<\/span><span>Boş bırakan: %100<\/span><\/p><img alt="Soru 3" data-yd="1203\|0:3" src="blob:sentetik-0-3">/);
    assert.match(sayfalar[0], /<p class="yd-fs-cumle">Sınav okullarında öğrencilerin %95’i bu soruyu doğru cevapladı; şubelerinizde yalnızca %33’ü\.<\/p><p class="yd-fs-bilgi"><span>Doğru cevap: D<\/span><span>Boş bırakan: %67<\/span>/);
    const sayfaMetni = sayfalar.join('').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(sayfaMetni, /puan|Fark|fark|tesadüf|kesin|z ≤/, 'no points, no gap and no statistics on the sheets');
    assert.doesNotMatch(sayfalar.join(''), /style="background/, 'no colours on the sheets');
    // without timetables the sheets are the school's, in the same words
    run('delete D.etutPlani'); out = T.gorunum(); assert.doesNotMatch(out, /data-yd-f="ogretmen"/); assert.match(out, /okulumuzda yalnızca %33’ü\./); assert.match(out, /<b>Bütün okul<\/b>/); assert.match(out, /Ders programı yok: sayfalar ders ders, bütün okul için\./);
    // the student view is untouched
    S.gorunum = 'ogrenci'; out = T.gorunum(); assert.match(out, /Seçili denemeler için yazdır/); assert.doesNotMatch(out, /yd-fd/);
  });

  await test('the PDF plan: each sheet starts its own page with the subject, the teacher and şubeler and the count; the sentence and the answers; the picture; no coloured box; the footer', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ders', ogretmen: ''});
    const M = T.farkModeli(), olcu = (s, size) => String(s).length * size * .5, plan = T.farkPlan(M, olcu);
    assert.equal(plan.kisiler.length, 2); assert.equal(plan.sayfa, 2);
    const ops = plan.kisiler[1].sayfalar[0].ops, metin = ops.filter(o => o.t === 't').map(o => o.s);
    assert.deepEqual(copy(metin.slice(0, 4)), ['TYT Türkçe', 'Sentetik Öğretmen Tür A · 12/A', 'Bu denemede şubelerinizin sınav okullarının gerisinde kaldığı sorular', '1 soru']);
    assert(metin.includes('SENTETİK-1203 · 01.01.2000')); assert(metin.includes('2 öğrenci · 1 / 4 soru')); assert(metin.includes('Soru 3'));
    assert.equal(metin.filter(s => /şubelerinizde|Sınav okullarında/.test(s)).length >= 1, true, 'the sentence, wrapped to the column');
    assert(metin.includes('Doğru cevap: C · Boş bırakan: %100'), metin.join(' | '));
    assert.equal(ops.filter(o => o.t === 'f').length, 0, 'no coloured box'); assert(!metin.some(s => /puan/.test(s)), 'no points');
    assert.deepEqual(copy(ops.filter(o => o.t === 'i').map(o => o.c.url)), ['blob:sentetik-0-3']);
    assert.equal(metin.at(-1), 'Sentetik Öğretmen Tür A · TYT Türkçe · 1 / 1');
    assert.equal(plan.kisiler[0].sayfalar[0].ops.find(o => o.t === 't').s, 'TYT Din Kültürü', 'the first teacher’s sheet on its own page');
    // the answers wrap only between items, so a label never leaves its value
    const uzun = T.farkSorusu({rapor: {anahtar: {A: ['C']}}}, {off: 0, test: 0, bas: 0, n: 1, ad: 'TÜRKÇE-T'}, 0, new Map([['0:1', {dogru: 1, n: 10, p: .1, sec: {A: 0, B: 5, C: 1, D: 0, E: 0, '': 4}}]]), new Map([[T.key('TÜRKÇE-T'), {n: 1, maddeler: [{p: .7}]}]]));
    assert.deepEqual(copy(T.dersPlani({ogretmen: 'X', ders: 'Türkçe', oturum: 'TYT', siniflar: ['12/A'], denemeler: [{e: S.denemeler.get('1203'), ad: 'D', tarih: '', n: 10, toplam: 1, sorular: [{...uzun, test: 0, a: 1}]}], soru: 1}, olcu).sayfalar[0].ops.filter(o => o.t === 't').map(o => o.s).filter(s => /Doğru cevap|Boş bırakan/.test(s))),
      ['Doğru cevap: C · En çok işaretlenen yanlış: B (%50)', 'Boş bırakan: %40']);
    assert.equal(T.farkDosyaAdi([{kod: '1203'}]), 'Fark_sorulari_1203.pdf'); assert.equal(T.farkDosyaAdi([{kod: '1203'}, {kod: '1204'}]), 'Fark_sorulari_2_deneme.pdf');
    assert.equal(T.farkDosyaAdi([{kod: '1203'}], 'Sentetik Öğretmen Tür A'), 'Fark_sorulari_1203_SentetikOgretmenTurA.pdf');
    assert.equal(T.farkDosyaAdi([{kod: '1203'}], '', 20), 'Fark_sorulari_1203_20_puan.pdf', 'a fixed gap is named in the file');
    run('delete D.etutPlani');
  });

  await test('nothing is stored or sent: the view adds no notebook field', async () => {
    await sinav(); Object.assign(S, {gorunum: 'ders'}); T.gorunum();
    assert.equal(run('Object.keys(D).filter(k=>/fark|yanlis/i.test(k)).length'), 0);
    T.sifirla(); assert.equal(S.gorunum, 'ogrenci'); assert.equal(S.ogretmen, ''); assert.equal(S.secim, 'z'); assert.equal('esik' in S, false);
  });
  console.log('Fark soruları: ' + passed + ' tests passed.');
})();
