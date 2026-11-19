'use strict';
// Yanlışlar defteri → Ders öğretmenleri: fark soruları. Who is judged on which test (TYT everyone, Din compulsory, Ek Felsefe only when answered;
// AYT the field's tests and every test answered, the field from the notebook, the şube's alan or the şube's answers), the school's rates worked by
// hand, the sentence with the Turkish possessive, the model (a sheet per teacher and exam subject over the şubeler of the timetables, or per ders
// for the whole school without them; threshold, dersler with none, exams without a Performans analizi, şubeler without a teacher), the page and
// the PDF plan: the data in words, no points and no colours. Synthetic data only (test/yanlislar-fixtures.cjs).
const fs = require('node:fs'), assert = require('node:assert/strict');
const fixture = fs.readFileSync('test/yanlislar-regression.cjs', 'utf8').split('(async () => {')[0];
const {T, run, Y, kit, kur, bytes, copy} = new Function('require', fixture + '\nreturn {T,run,Y,kit,kur,bytes,copy};')(require);
const S = T.durumu();
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const sayfaHazirla = (ogr = []) => run(`D=varsayilan();D.rol='rehber';D.ogr=${JSON.stringify(ogr)};EK.sekme='yanlislar'`);
// Timetables (Etüt planı): Türkçe by two teachers (12/A, 12/B), Din in both by a third; Tarih and Ek Felsefe have no teacher here.
const SA = ['09.00', '10.00'];
const PLAN = {'12/A': {kod: '301', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TÜRKÇE', 'SENTETİK ÖĞRETMEN TÜR A'], [0, '10.00', 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK ÖĞRETMEN DİN']]},
  '12/B': {kod: '302', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TÜRKÇE', 'SENTETİK ÖĞRETMEN TÜR B'], [0, '10.00', 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK ÖĞRETMEN DİN']]}};
const planKur = () => run(`(()=>{const p=ETUTPLANI.oku().plan;p.programlar=${JSON.stringify(PLAN)};D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)))})()`);
const perfKur = dersler => T.performansCoz(Y.itemlere(Y.performansSpec({dersler})));
// 1203's TYT: Türkçe 1-4, then the SOS test: Tarih 1-2, Din 3-4, Ek Felsefe 5-6 (keys KEY_A). Rates chosen so that Türkçe 3 and Din 3 are well behind.
const PERF = [{ad: 'TÜRKÇE-T', n: 4, anahtar: Y.KEY_A.slice(0, 4), p: [.9, .7, .6, .2]}, {ad: 'TARİH-T', n: 2, anahtar: Y.KEY_A.slice(4, 6), p: [.6, .4]},
  {ad: 'DİN KÜLTÜRÜ-T', n: 2, anahtar: Y.KEY_A.slice(6, 8), p: [.9, .3]}, {ad: 'S.FELSEFE-T', n: 2, anahtar: Y.KEY_A.slice(8, 10), p: [.55, .15]}];
const sahteResim = e => { for (const [ti, t] of Object.values(e.kitlar).flatMap(k => k.testler).entries()) t.sorular.forEach(q => e.crops.set(ti + ':' + q.no, {url: 'blob:sentetik-' + ti + '-' + q.no, blob: null, w: 400, h: 200, genis: false})) };
async function sinav({perf = PERF, harita = true} = {}) {
  const {rapor, k} = await kur({method: 8}); T.sifirla(); sayfaHazirla();
  const e = T.denemeKoy({kitlar: {TYT: k}, rapor, pairs: harita ? {TYT: Y.HARITA} : {}, perf: perf ? perfKur(perf) : null}); sahteResim(e);
  return e;
}
// AYT: a two-session report. EDB test = Edebiyat 1-3 + Tarih-1 4-5, MAT test = Matematik 1-3 (key A B C D E | A B C).
const AYT = [
  {no: '7001', ad: 'SENTETİK SAY 1', sube: '205 12/C', kit: 'A', cev: ['', '', '', '', '', '', '', '']},          // SAY in the notebook, everything blank
  {no: '7002', ad: 'SENTETİK SAY 2', sube: '205 12/C', kit: 'A', cev: ['', '', '', 'D', '', 'A', '', '']},         // SAY, but one Tarih-1 answer
  {no: '7003', ad: 'SENTETİK ŞUBE C', sube: '205 12/C', kit: 'A', cev: ['', '', '', '', '', '', '', '']},          // no alan: the şube's (SAY)
  {no: '7004', ad: 'SENTETİK ŞUBE D 1', sube: '205 12/D', kit: 'A', cev: ['A', 'B', '', '', '', '', '', '']},
  {no: '7005', ad: 'SENTETİK ŞUBE D 2', sube: '205 12/D', kit: 'A', cev: ['A', '', '', '', 'E', '', '', '']},
  {no: '7006', ad: 'SENTETİK ŞUBE D 3', sube: '205 12/D', kit: 'A', cev: ['', '', '', '', '', '', '', '']},        // no alan anywhere in 12/D: the tests most of 12/D answered
  {no: '7007', ad: 'SENTETİK EA', sube: '205 12/E', kit: 'A', cev: ['', '', '', '', '', '', '', '']}];            // EA: Edebiyat–Sosyal-1 and Matematik
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

  await test('who counts, TYT: everyone who sat it on every test, blanks as wrong; Din is compulsory; Ek Felsefe only for a student who answered it', async () => {
    const {rapor, es} = await kur(); sayfaHazirla();
    const f = T.sayilanKural(rapor, es).f, ad = o => [...f(o)].map(i => es.bolumler[i].ders);
    const [a, b, c] = rapor.ogrenciler;   // 9001 left Ek Felsefe blank; 9002 left Din blank and answered Ek Felsefe; 9003 answered everything
    assert.deepEqual(ad(a), ['Türkçe', 'Tarih', 'Din Kültürü']);
    assert.deepEqual(ad(b), ['Türkçe', 'Tarih', 'Din Kültürü', 'Ek Felsefe'], 'Din is never skipped');
    assert.deepEqual(ad(c), ['Türkçe', 'Tarih', 'Din Kültürü', 'Ek Felsefe']);
  });

  await test('who counts, AYT: the field’s tests (blank as wrong) and every other test answered at least once, the whole test; the field from the notebook, the şube’s alan, or what most of the şube answered', async () => {
    const {rapor, es} = await iki(); sayfaHazirla(NOTDEFTERI);
    const k = T.sayilanKural(rapor, es), ayt = no => [...k.f(rapor.ogrenciler.find(o => o.no === no))].map(i => es.bolumler[i]).filter(b => b.oturum === 'AYT').map(b => b.ders);
    const EDB = ['Türk Dili ve Edebiyatı', 'Tarih-1'], MAT = ['Matematik'];
    assert.deepEqual(ayt('7001'), MAT, 'SAY: Matematik counts even left wholly blank; Edebiyat–Sosyal-1 does not');
    assert.deepEqual(ayt('7002'), [...EDB, ...MAT], 'SAY with one Tarih-1 answer: judged on the whole Edebiyat–Sosyal-1 test, Edebiyat included');
    assert.deepEqual(ayt('7003'), MAT, 'no alan: the alan most of the şube has in the notebook (SAY)');
    assert.deepEqual(ayt('7006'), EDB, 'no alan in the whole şube: the tests more than half of it answered');
    assert.deepEqual([ayt('7004'), ayt('7005')], [EDB, EDB]);
    assert.deepEqual(ayt('7007'), [...EDB, ...MAT], 'EA: both of its tests, even blank');
    assert.deepEqual(ayt('9001'), [], 'a student who sat only the TYT has no AYT test');
    // the cache follows the notebook: once 7003 is EA, it is judged on EA's tests
    sayfaHazirla([...NOTDEFTERI, {no: '7003', alan: 'EA'}]); const k2 = T.sayilanKural(rapor, es);
    assert.notEqual(k2.imza, k.imza); assert.deepEqual([...k2.f(rapor.ogrenciler.find(o => o.no === '7003'))].map(i => es.bolumler[i].ders), [...EDB, ...MAT]);
  });

  await test('school rates by hand: the students judged on the test, B through the çözüm map, a blank is wrong; the options our students marked', async () => {
    const e = await sinav(), m = T.okulMaddeleri(e), r = k => { const x = m.get(k); return x && [x.dogru, x.n] };
    // Türkçe (test 0): A1 3/3, A2 2/3 (9001 C), A3 1/3 (two blanks), A4 3/3
    assert.deepEqual([r('0:1'), r('0:2'), r('0:3'), r('0:4')], [[3, 3], [2, 3], [1, 3], [3, 3]]);
    assert.deepEqual(copy(m.get('0:2').sec), {A: 0, B: 2, C: 1, D: 0, E: 0, '': 0}); assert.deepEqual(copy(m.get('0:3').sec), {A: 0, B: 0, C: 1, D: 0, E: 0, '': 2});
    // SOS (test 1): Din 3-4 counts all three (9002 left it blank: wrong, not skipped); Ek Felsefe 5-6 only the two who answered it
    assert.deepEqual([r('1:3'), r('1:4')], [[2, 3], [1, 3]]); assert.deepEqual([r('1:5'), r('1:6')], [[1, 2], [2, 2]]);
    // without the çözüm map the B student is not counted (its question numbers are not A's)
    const e2 = await sinav({harita: false}); assert.deepEqual([T.okulMaddeleri(e2).get('0:3').n, T.okulMaddeleri(e2).get('1:5').n], [2, 1]);
    assert.equal(T.okulOranlari(e).get('0:3'), 1 / 3, 'okulOranlari: the same rates');
  });

  await test('AYT school rates follow the rule: a SAY student’s blank Edebiyat does not drag Edebiyat down; the student’s own list shows the same rate', async () => {
    const {rapor, kT, kA} = await iki(); T.sifirla(); sayfaHazirla(NOTDEFTERI);
    const e = T.denemeKoy({kitlar: {TYT: kT, AYT: kA}, rapor}), m = T.okulMaddeleri(e), t = e.es.bolumler.find(b => b.ders === 'Türk Dili ve Edebiyatı').test, tm = e.es.bolumler.find(b => b.ders === 'Matematik').test;
    // Edebiyat 1 (key A): judged 7002 (blank), 7004 A, 7005 A, 7006 (blank), 7007 (blank): 2 / 5, not 2 / 7 (7001 and 7003 are SAY)
    const ed = m.get(t + ':1'); assert.deepEqual([ed.dogru, ed.n], [2, 5]);
    const mt = m.get(tm + ':1'); assert.deepEqual([mt.dogru, mt.n], [1, 4], 'Matematik 1 (key A): 7001, 7002 A, 7003, 7007; not 12/D');
    const L = copy(T.ogrenciListesi('7002')), satir = L.s[0].d.find(d => d[0] === 'Türk Dili ve Edebiyatı')[2][0];
    assert.deepEqual(satir.slice(0, 4), ['1', '', 'A', 40], 'Okulunda doğru = the same 2 / 5');
  });

  await test('one question by hand: the two rates rounded first, so the sentence adds up; the wrong option most marked; the sentence', () => {
    const e = {rapor: {anahtar: {A: ['C']}}}, eb = {off: 0, test: 0, bas: 0, n: 1, ad: 'TÜRKÇE-T'};
    const pm = p => new Map([[T.key('TÜRKÇE-T'), {n: 1, maddeler: [{p}]}]]);
    const om = (dogru, n, sec) => new Map([['0:1', {dogru, n, p: dogru / n, sec: {A: 0, B: 0, C: dogru, D: 0, E: 0, '': 0, ...sec}}]]);
    let x = T.farkSorusu(e, eb, 0, om(2, 20, {B: 8, '': 4}), pm(.6));
    assert.deepEqual(copy([x.okul, x.okullar, x.fark, x.yanlis, x.yanlisPay, x.bos, x.cevap, x.n]), [10, 60, -50, 'B', 40, 20, 'C', 20]);
    assert.equal(T.farkCumle({ogretmen: 'Sentetik Öğretmen'}, x), 'Sınav okullarında öğrencilerin %60’ı bu soruyu doğru cevapladı; şubelerinizde yalnızca %10’u.');
    assert.equal(T.farkCumle({ogretmen: null}, x), 'Sınav okullarında öğrencilerin %60’ı bu soruyu doğru cevapladı; okulumuzda yalnızca %10’u.', 'without timetables: the whole school');
    x = T.farkSorusu(e, eb, 0, om(0, 5, {A: 5}), pm(.5)); assert.equal(T.farkCumle({ogretmen: 'X'}, x), 'Sınav okullarında öğrencilerin %50’si bu soruyu doğru cevapladı; şubelerinizde kimse doğru cevaplamadı.');
    // the printed numbers add up: 30,4 % and 50,5 % print as 30 and 51, and the gap kept for the threshold is 21
    x = T.farkSorusu(e, eb, 0, new Map([['0:1', {dogru: 0, n: 1, p: .304, sec: {A: 0, B: 1, C: 0, D: 0, E: 0, '': 0}}]]), pm(.505)); assert.deepEqual(copy([x.okul, x.okullar, x.fark]), [30, 51, -21]);
    // a rate printed out of 100 is read as a share; a missing rate gives no question
    assert.equal(T.farkSorusu(e, eb, 0, om(9, 30, {}), pm(50)).okullar, 50); assert.equal(T.farkSorusu(e, eb, 0, om(9, 30, {}), new Map()), null);
  });

  await test('the model without timetables: a sheet per ders for the whole school; threshold, dersler with none, exams without a Performans analizi, the ders ticks', async () => {
    const e = await sinav(); Object.assign(S, {gorunum: 'ders', esik: 20, ogretmen: ''});
    let M = T.farkModeli();
    assert.equal(M.ogretmenli, false);
    assert.deepEqual(copy(M.geride.map(g => [g.ogretmen, g.ders, g.oturum, g.soru])), [[null, 'Türkçe', 'TYT', 1], [null, 'Din Kültürü', 'TYT', 1]]);
    assert.deepEqual(copy(M.temiz.map(g => g.ders)), ['Tarih', 'Ek Felsefe']); assert.deepEqual(copy(M.eksik), []);
    const [tr] = M.geride, d = tr.denemeler[0], x = d.sorular[0];
    assert.deepEqual(copy([d.ad, d.n, d.toplam]), ['SENTETİK-1203', 3, 4]);
    // Türkçe 3: ours 1/3 = 33 %, theirs 60 %: 27 points behind
    assert.deepEqual(copy([x.a, x.okul, x.okullar, x.fark, x.cevap, x.yanlis, x.bos]), [3, 33, 60, -27, 'C', null, 67]);
    assert.equal(M.geride[1].denemeler[0].sorular[0].fark, -23, 'Din 3: 67 against 90');
    S.esik = 25; M = T.farkModeli(); assert.deepEqual(copy(M.geride.map(g => g.ders)), ['Türkçe'], 'a higher threshold');
    S.esik = 20; S.kapali = new Set(['Türkçe']); assert.deepEqual(copy(T.farkModeli().geride.map(g => g.ders)), ['Din Kültürü'], 'an unticked ders is left out'); S.kapali = new Set();
    // a second exam without the Performans analizi is named, not guessed
    const {rapor, k} = await kur({method: 8}); T.denemeKoy({kod: '1299', kitlar: {TYT: k}, rapor, ad: 'SENTETİK-1299'});
    assert.deepEqual(copy(T.farkModeli().eksik), ['SENTETİK-1299']);
    assert.doesNotMatch(JSON.stringify(T.farkModeli(), (k, v) => k === 'e' ? undefined : v), /(?<![\d.])\d{11}(?![\d.])/, 'no TC in the model');
  });

  await test('the model with timetables: a sheet per teacher and exam subject over the şubeler the teacher teaches it in; the Öğretmen filter; şubeler with no teacher are named', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ders', esik: 20, ogretmen: ''});
    let M = T.farkModeli();
    assert.equal(M.ogretmenli, true); assert.deepEqual(copy(M.ogretmenler), ['Sentetik Öğretmen Din', 'Sentetik Öğretmen Tür A', 'Sentetik Öğretmen Tür B']);
    assert.deepEqual(copy(M.geride.map(g => [g.ogretmen, g.ders, g.siniflar, g.soru])), [['Sentetik Öğretmen Din', 'Din Kültürü', ['12/A', '12/B'], 1], ['Sentetik Öğretmen Tür A', 'Türkçe', ['12/A'], 2]]);
    assert.deepEqual(copy(M.temiz.map(g => g.ogretmen)), ['Sentetik Öğretmen Tür B'], '12/B answered every Türkçe question right');
    // 12/A alone (9001 A, 9002 B through the map): Türkçe 2 is 1/2 = 50 % against 70 %, Türkçe 3 nobody against 60 %
    const tA = M.geride[1].denemeler[0];
    assert.deepEqual(copy([tA.n, tA.sorular.map(x => [x.a, x.okul, x.okullar])]), [2, [[2, 50, 70], [3, 0, 60]]]);
    assert.equal(T.farkCumle(M.geride[1], tA.sorular[0]), 'Sınav okullarında öğrencilerin %70’i bu soruyu doğru cevapladı; şubelerinizde yalnızca %50’si.');
    assert.deepEqual(copy(M.sahipsiz), ['TYT Tarih (12/A, 12/B)', 'TYT Ek Felsefe (12/A, 12/B)']);
    S.ogretmen = 'Sentetik Öğretmen Tür A'; M = T.farkModeli(); assert.deepEqual(copy(M.sayfalar.map(g => g.ogretmen)), ['Sentetik Öğretmen Tür A']);
    S.ogretmen = 'Böyle biri yok'; M = T.farkModeli(); assert.equal(S.ogretmen, '', 'an unknown teacher falls back to all'); assert.equal(M.sayfalar.length, 3);
    run('delete D.etutPlani');
  });

  await test('the page: Defter switch, Öğretmen and Fark eşiği, one sheet per teacher and subject with the picture and the data in words; no points, no colours', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ogrenci', esik: 20, ogretmen: ''});
    let out = T.gorunum();
    assert.match(out, /data-yd-gorunum="ogrenci" aria-pressed="true">Öğrenci defterleri<\/button><button type="button" class="yd-chip" data-yd-gorunum="ders" aria-pressed="false">Ders öğretmenleri: fark soruları<\/button>/);
    S.gorunum = 'ders'; out = T.gorunum();
    assert.match(out, /<label class="yd-sec">Öğretmen<select data-yd-f="ogretmen"><option value="" selected>Bütün öğretmenler<\/option><option value="Sentetik Öğretmen Din">/);
    assert.match(out, /<label class="yd-sec">Fark eşiği<select data-yd-f="esik"><option value="10">10 puan ve üzeri<\/option><option value="15">15 puan ve üzeri<\/option><option value="20" selected>20 puan ve üzeri<\/option>/);
    assert.doesNotMatch(out, /data-yd-f="alan"|data-yd-f="sube"|data-yd-f="ogr"|Kendi seviyesi/, 'no student filters in this view');
    assert.match(out, /<span><b>Sentetik Öğretmen Din · TYT Din Kültürü<\/b> 1<\/span><span><b>Sentetik Öğretmen Tür A · TYT Türkçe<\/b> 2<\/span>/);
    assert.match(out, /Bu eşikte geride kalınan soru yok: Sentetik Öğretmen Tür B · TYT Türkçe/); assert.match(out, /Ders programında öğretmeni olmayan: TYT Tarih \(12\/A, 12\/B\), TYT Ek Felsefe \(12\/A, 12\/B\)\./);
    const sayfalar = out.split('<article class="yd-ogr yd-fd"').slice(1); assert.equal(sayfalar.length, 2);
    const a = sayfalar[1];
    assert.match(a, /<h2>TYT Türkçe<\/h2><p class="yd-kimlik"><b>Sentetik Öğretmen Tür A · 12\/A<\/b><\/p><p class="yd-kimlik">Bu denemede şubelerinizin sınav okullarının gerisinde kaldığı sorular<\/p><p class="yd-say"><b>2<\/b> soru<\/p>/);
    assert.match(a, /SENTETİK-1203 <span class="yd-tarih">01\.01\.2000<\/span><\/h3><p class="yd-kimlik">2 öğrenci · 2 \/ 4 soru<\/p>/);
    assert.match(a, /<b>Soru 3<\/b><\/span><\/figcaption><p class="yd-fs-cumle">Sınav okullarında öğrencilerin %60’ı bu soruyu doğru cevapladı; şubelerinizde kimse doğru cevaplamadı\.<\/p><p class="yd-fs-bilgi"><span>Doğru cevap: C<\/span><span>Boş bırakan: %100<\/span><\/p><img alt="Soru 3" data-yd="1203\|0:3" src="blob:sentetik-0-3">/);
    assert.match(a, /<p class="yd-fs-cumle">Sınav okullarında öğrencilerin %70’i bu soruyu doğru cevapladı; şubelerinizde yalnızca %50’si\.<\/p><p class="yd-fs-bilgi"><span>Doğru cevap: B<\/span><span>En çok işaretlenen yanlış: C \(%50\)<\/span><span>Boş bırakan: %0<\/span>/);
    const sayfaMetni = sayfalar.join('').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(sayfaMetni, /puan|Fark|fark|tesadüf|kesin/, 'no points and no gap on the sheets');
    assert.doesNotMatch(sayfalar.join(''), /style="background/, 'no colours on the sheets');
    // without timetables the sheets are the school's, in the same words
    run('delete D.etutPlani'); out = T.gorunum(); assert.doesNotMatch(out, /data-yd-f="ogretmen"/); assert.match(out, /okulumuzda yalnızca %33’ü\./); assert.match(out, /<b>Bütün okul<\/b>/); assert.match(out, /Ders programı yok: sayfalar ders ders, bütün okul için\./);
    // the student view is untouched
    S.gorunum = 'ogrenci'; out = T.gorunum(); assert.match(out, /Seçili denemeler için yazdır/); assert.doesNotMatch(out, /yd-fd/);
  });

  await test('the PDF plan: each sheet starts its own page with the subject, the teacher and şubeler and the count; the sentence and the answers; the picture; no coloured box; the footer', async () => {
    await sinav(); planKur(); Object.assign(S, {gorunum: 'ders', esik: 20, ogretmen: ''});
    const M = T.farkModeli(), olcu = (s, size) => String(s).length * size * .5, plan = T.farkPlan(M, olcu);
    assert.equal(plan.kisiler.length, 2); assert.equal(plan.sayfa, 2);
    const ops = plan.kisiler[1].sayfalar[0].ops, metin = ops.filter(o => o.t === 't').map(o => o.s);
    assert.deepEqual(copy(metin.slice(0, 4)), ['TYT Türkçe', 'Sentetik Öğretmen Tür A · 12/A', 'Bu denemede şubelerinizin sınav okullarının gerisinde kaldığı sorular', '2 soru']);
    assert(metin.includes('SENTETİK-1203 · 01.01.2000')); assert(metin.includes('2 öğrenci · 2 / 4 soru')); assert(metin.includes('Soru 2')); assert(metin.includes('Soru 3'));
    assert.equal(metin.filter(s => /^(Sınav okullarında|şubelerinizde|bu soruyu)/.test(s) || /şubelerinizde/.test(s)).length >= 2, true, 'the sentence, wrapped to the column');
    // the answers wrap only between items, so a label never leaves its value
    assert(metin.includes('Doğru cevap: B · En çok işaretlenen yanlış: C (%50)') && metin.includes('Boş bırakan: %0'), metin.join(' | '));
    assert.equal(ops.filter(o => o.t === 'f').length, 0, 'no coloured box'); assert(!metin.some(s => /puan/.test(s)), 'no points');
    assert.deepEqual(copy(ops.filter(o => o.t === 'i').map(o => o.c.url)), ['blob:sentetik-0-2', 'blob:sentetik-0-3']);
    assert.equal(metin.at(-1), 'Sentetik Öğretmen Tür A · TYT Türkçe · 1 / 1');
    assert.equal(plan.kisiler[0].sayfalar[0].ops.find(o => o.t === 't').s, 'TYT Din Kültürü', 'the first teacher’s sheet on its own page');
    assert.equal(T.farkDosyaAdi([{kod: '1203'}], 20), 'Fark_sorulari_1203_20_puan.pdf'); assert.equal(T.farkDosyaAdi([{kod: '1203'}, {kod: '1204'}], 15), 'Fark_sorulari_2_deneme_15_puan.pdf');
    assert.equal(T.farkDosyaAdi([{kod: '1203'}], 20, 'Sentetik Öğretmen Tür A'), 'Fark_sorulari_1203_SentetikOgretmenTurA_20_puan.pdf');
    run('delete D.etutPlani');
  });

  await test('nothing is stored or sent: the view adds no notebook field', async () => {
    await sinav(); Object.assign(S, {gorunum: 'ders', esik: 20}); T.gorunum();
    assert.equal(run('Object.keys(D).filter(k=>/fark|yanlis|esik/i.test(k)).length'), 0);
    T.sifirla(); assert.equal(S.gorunum, 'ogrenci'); assert.equal(S.esik, 20); assert.equal(S.ogretmen, '');
  });
  console.log('Fark soruları: ' + passed + ' tests passed.');
})();
