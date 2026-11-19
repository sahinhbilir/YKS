'use strict';
// Yanlışlar defteri → Öğrenciye deneme karnesi (2026-11-20): per student and exam, every question judged (TYT everyone, Din compulsory, Ek Felsefe
// never; a blank is boş, not right) with its number in the student's own booklet, its konu (Konu Takibi's sınav özeti; B students through the çözüm
// map), its band (the Performans analizi: Çok kolay … Çok zor) and the result; the publication (off, every exam, the selected ones, a viewing teacher
// changes nothing), the student's package, and the slides on the student's page: denemeler, dersler, konular and the questions, all five bands, over
// all or some of the exams. Synthetic data only.
const fs = require('node:fs'), assert = require('node:assert/strict');
const fixture = fs.readFileSync('test/yanlislar-regression.cjs', 'utf8').split('(async () => {')[0];
const {T, run, Y, kur} = new Function('require', fixture + '\nreturn {T,run,Y,kur};')(require);
const S = T.durumu();
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const copy = x => JSON.parse(JSON.stringify(x));
// 1203's TYT: Türkçe 1-4, Tarih 1-2, Din 3-4, Ek Felsefe 5-6. The publisher's p: Türkçe 1-2 easy, 3-4 hard; Tarih orta.
const PERF = [{ad: 'TÜRKÇE-T', n: 4, anahtar: Y.KEY_A.slice(0, 4), p: [.9, .8, .2, .1]}, {ad: 'TARİH-T', n: 2, anahtar: Y.KEY_A.slice(4, 6), p: [.6, .4]},
  {ad: 'DİN KÜLTÜRÜ-T', n: 2, anahtar: Y.KEY_A.slice(6, 8), p: [.9, .95]}, {ad: 'S.FELSEFE-T', n: 2, anahtar: Y.KEY_A.slice(8, 10), p: [.55, .02]}];
const perfKur = () => T.performansCoz(Y.itemlere(Y.performansSpec({dersler: PERF})));
// Konu Takibi's sınav özeti of the exam: Türkçe 1-2 Sözcükte Anlam, 3-4 Cümlede Anlam; Tarih 1-2 Tarih ve Zaman; Din and Ek Felsefe have none.
const ozetKur = ad => run(`D.konutakibi={};KONU_TAKIBI.__oku=KONU_TAKIBI.__oku||KONU_TAKIBI.oku;KONU_TAKIBI.oku=()=>({veri:{maps:{},zorluk:{x:{ad:${JSON.stringify(ad)},
  ozet:{'TÜRKÇE-T':[['T.12.1.1'],['T.12.1.2'],['T.12.3.1'],['T.12.3.2']],'TARİH-T':[['E.TAR.9.1.1'],['E.TAR.9.1.2']]}}}}})`);
const ozetYok = () => run('if(KONU_TAKIBI.__oku)KONU_TAKIBI.oku=KONU_TAKIBI.__oku;delete D.konutakibi');
async function kutuphane({ikinci = false} = {}) {
  const {rapor, k} = await kur({method: 8}); T.sifirla();
  run(`D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar';kaydet=()=>true`);
  const e = T.denemeKoy({kitlar: {TYT: k}, rapor, pairs: {TYT: Y.HARITA}, perf: perfKur()});
  const e2 = ikinci ? T.denemeKoy({kod: '1299', kitlar: {TYT: k}, rapor, ad: 'SENTETİK-1299', pairs: {TYT: Y.HARITA}, perf: perfKur()}) : null;
  ozetKur(rapor.ad); S.kutYuklendi = true;
  return {rapor, e, e2};
}
const sorular = k => k.s[0][3].map(b => b.slice(0, 3).join('|') + ':' + b[3].map(q => q.join(',')).join(' '));

(async () => {
  await test('every question by hand: own booklet number, konu, band (0 Çok kolay … 4 Çok zor), result (1 doğru, 0 yanlış, -1 boş); B in B numbers; Din without a konu kept; Ek Felsefe never', async () => {
    const {e} = await kutuphane();
    const k1 = T.konuKarnesi('9001', [e]);
    assert.equal(k1.v, 2); assert.deepEqual([k1.s[0][0], k1.s[0][1]], [e.rapor.ad, e.rapor.tarih]);
    assert.deepEqual(copy(k1.s[0][2]), ['Sözcükte Anlam', 'Cümlede Anlam', 'Tarih ve Zaman']);
    // 9001 (A): Türkçe A✓ C✗ boş D✓ on bands 0 1 3 4; Tarih A✓ B✓ (orta); Din C✓ boş (no konu); Ek Felsefe not judged
    assert.deepEqual(sorular(copy(k1)), ['Türkçe|TYT|A:1,0,0,1 2,0,1,0 3,1,3,-1 4,1,4,1', 'Tarih|TYT|A:1,2,2,1 2,2,2,1', 'Din Kültürü|TYT|A:3,-1,0,1 4,-1,0,-1']);
    // 9002 (B): B1 = A2 (Sözcükte, Kolay) ✓, B2 = A4 (Cümlede, Çok zor) ✓, B3 = A1 (Sözcükte, Çok kolay) ✓, B4 = A3 (Cümlede, Zor) boş
    assert.deepEqual(sorular(copy(T.konuKarnesi('9002', [e]))), ['Türkçe|TYT|B:1,0,1,1 2,1,4,1 3,0,0,1 4,1,3,-1', 'Tarih|TYT|B:1,2,2,1 2,2,2,-1', 'Din Kültürü|TYT|B:3,-1,0,-1 4,-1,0,-1']);
    const k3 = copy(T.konuKarnesi('9003', [e]));
    assert(!/\d{11}/.test(JSON.stringify(k3)), 'no 11 digit number'); assert(!/"[A-E]"/.test(JSON.stringify(k3.s[0][3].map(b => b[3]))), 'no answer letters');
    assert.equal(T.konuKarnesi('9999', [e]), null, 'a student not in the exam has none'); assert.equal(T.konuKarnesi('', [e]), null);
    ozetYok(); assert.deepEqual(copy(T.konuKarnesi('9001', [e]).s[0][2]), [], 'no sınav özeti: the questions without a konu, still by band');
  });

  await test('Öğrenciye yayınla: off until the rehber turns it on; every exam or the selected ones; Yayından kaldır; a viewing teacher changes nothing', async () => {
    const {e, e2} = await kutuphane({ikinci: true});
    assert.equal(T.ogrenciKarnesi('9001'), null, 'not published: nothing in the package');
    S.gorunum = 'karne';
    let h = T.gorunum();
    assert.match(h, /data-yd-gorunum="karne" aria-pressed="true">Öğrenciye deneme karnesi<\/button>/);
    assert.match(h, /Henüz öğrencilere gitmiyor\./); assert.match(h, /data-yd-kk-yayinla>Öğrenciye yayınla<\/button>/);
    assert.match(h, /data-yd-kk-mod="hepsi" aria-pressed="true">Bütün denemeler \(2\)/); assert.match(h, /data-yd-kk-mod="secili" aria-pressed="false">Seçili denemeler \(2\)/);
    assert.match(h, /<section class="kk" data-kk-yer="ogretmen">/, 'the preview is the student’s slides');
    assert.equal(T.karneYayinla('hepsi'), true); assert.deepEqual(copy(run('D.konuKarneYayin')), {mod: 'hepsi'});
    assert.equal(copy(T.ogrenciKarnesi('9001')).s.length, 2, 'every exam');
    h = T.gorunum(); assert.match(h, /<b>Öğrencilere gidiyor:<\/b> bütün denemeler\./); assert.match(h, /data-yd-kk-kaldir>Yayından kaldır/);
    // only the ticked exams
    e2.sec = false; T.karneModu('secili');
    assert.deepEqual(copy(run('D.konuKarneYayin')), {mod: 'secili', kodlar: [e.kod]});
    assert.deepEqual(copy(T.ogrenciKarnesi('9001')).s.map(s => s[0]), [e.rapor.ad]);
    e2.sec = true; assert.match(T.gorunum(), /data-yd-kk-guncelle>Seçili denemelerle güncelle/, 'the ticks changed since: offer to update');
    // a viewing teacher
    run('__yg=yalnizcaGoruntuleme;yalnizcaGoruntuleme=()=>true');
    try { assert.equal(T.karneYayinla('hepsi'), false); assert.deepEqual(copy(run('D.konuKarneYayin')), {mod: 'secili', kodlar: [e.kod]}); assert(!/data-yd-kk-kaldir/.test(T.gorunum())); }
    finally { run('yalnizcaGoruntuleme=__yg'); }
    run('delete D.konuKarneYayin'); assert.equal(T.ogrenciKarnesi('9001'), null); S.gorunum = 'ogrenci';
  });

  await test('the student’s package carries the karne; the student’s notebook keeps it; a malformed one is dropped', async () => {
    await kutuphane(); T.karneYayinla('hepsi');
    run(`D.ogr=[{no:9001,ad:'SENTETİK ÖĞRENCİ 1',sube:'12/A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,syncId:'s',ogrenciBulutId:'b'}]`);
    const pk = run('__pk=ogrenciPaketi(0)'); assert.equal(pk.konuKarne.v, 2); assert.equal(pk.konuKarne.s[0][3].length, 3);
    assert.deepEqual(copy(run('paketiYukle(__pk).konuKarne')), copy(pk.konuKarne));
    assert.equal(run("__pk.konuKarne={v:1,s:[]};paketiYukle(__pk).konuKarne"), undefined, 'another version is dropped');
    run('delete D.konuKarneYayin'); assert.equal(run('ogrenciPaketi(0).konuKarne'), null, 'not published: no karne');
  });

  await test('the student’s slides: denemeler, dersler, konular and the questions; the five bands; all exams or some; a ders; the sentences of Denemeye göre ayarla; names escaped', () => {
    // [no, konu, band, result]; D2 newer: Sözcükte Anlam bands 0 1 3 3 4 all right; Cümlede Anlam 1 ✓, 1 ✗, 3 ✗, 4 boş; a konu "<b>X</b>" in Tarih (orta ✓, unknown ✓)
    const K = {v: 2, t: 1, s: [['D2', '2026-11-01', ['Sözcükte Anlam', 'Cümlede Anlam', '<b>X</b>'], [['Türkçe', 'TYT', 'A', [[1, 0, 0, 1], [2, 0, 1, 1], [3, 0, 3, 1], [4, 0, 3, 1], [5, 0, 4, 1], [6, 1, 1, 1], [7, 1, 1, 0], [8, 1, 3, 0], [9, 1, 4, -1]]],
      ['Tarih', 'TYT', 'B', [[1, 2, 2, 1], [2, 2, -1, 1]]]]],
      ['D1', '2026-10-01', ['Sözcükte Anlam'], [['Türkçe', 'TYT', 'A', [[1, 0, 0, 1], [2, 0, 1, 1]]]]]]};
    const sayfa = () => run('gorunumYanlisListem()');
    run(`D=varsayilan();D.rol='ogrenci';D.konuKarne=${JSON.stringify(K)};EK.kk=undefined`);
    let h = sayfa();
    assert.match(h, /<section class="kk" data-kk-yer="ogrenci"><div class="kk-bas"><h2>Deneme karnen<\/h2>/); assert(!/Henüz liste yok/.test(h), 'the karne alone fills the page');
    assert.match(h, /data-kk-duzey="deneme" aria-pressed="false">Denemeler<\/button>.*data-kk-duzey="ders" aria-pressed="false">Dersler<\/button>.*data-kk-duzey="konu" aria-pressed="true">Konular<\/button>.*data-kk-duzey="soru" aria-pressed="false">Sorular<\/button>/s);
    assert.match(h, /data-kk-sinav="hepsi" aria-pressed="true">Bütün denemeler \(2\)<\/button><button type="button" class="kk-cip" data-kk-sinav="0" aria-pressed="false">D2 · 01\.11\.2026<\/button>/);
    assert.match(h, /<span class="kk-sayac" aria-live="polite">3 konu<\/span>/);
    // Sözcükte Anlam over both exams: 7 of 7, easy 4 of 4 (Çok kolay 2, Kolay 2), hard 3 of 3 (Zor 2, Çok zor 1) in two exams → güçlü
    const soz = h.slice(h.indexOf('aria-label="1 / 3: Sözcükte Anlam"'), h.indexOf('aria-label="2 / 3:'));
    assert.match(soz, /Kolay sorular<\/span><b class="kk-yuzde">%100<\/b><span class="kk-say">4 \/ 4 doğru/); assert.match(soz, /Zor sorular<\/span><b class="kk-yuzde">%100<\/b><span class="kk-say">3 \/ 3 doğru/);
    assert.match(soz, /<th scope="row">Çok kolay<\/th>.*?<td>2 \/ 2<\/td><td>%100<\/td>.*?<th scope="row">Kolay<\/th>.*?<td>2 \/ 2<\/td>.*?<tr class="kk-bant-yok"><th scope="row">Orta<\/th>.*?<td>—<\/td>.*?<th scope="row">Zor<\/th>.*?<td>2 \/ 2<\/td>.*?<th scope="row">Çok zor<\/th>.*?<td>1 \/ 1<\/td>/s, 'all five bands');
    assert.match(soz, /Bütün sorular: <b>7 \/ 7<\/b> doğru · 2 deneme<\/p><p class="kk-yorum kk-iyi">Zor sorularını da yapıyorsun: bu konuyu biliyorsun\./);
    const cum = h.slice(h.indexOf('aria-label="2 / 3: Cümlede Anlam"'), h.indexOf('aria-label="3 / 3:'));
    assert.match(cum, /Bütün sorular: <b>1 \/ 4<\/b> doğru · 1 boş · 1 deneme<\/p><p class="kk-yorum kk-zayif">Bu konuyu tekrar etmeye değer\./);
    assert.match(h, /<h3 class="kk-konu">&lt;b&gt;X&lt;\/b&gt;<\/h3>/); assert(!/<b>X<\/b>/.test(h), 'a konu name is escaped');
    assert.match(h, /<th scope="row">Zorluğu bilinmiyor<\/th><td><\/td><td>1 \/ 1<\/td>/, 'a question without a band is counted apart');
    // Denemeler: one slide per exam, newest first, its five bands
    run("EK.kk={duzey:'deneme'}"); h = sayfa();
    assert.match(h, /2 deneme<\/span>/); assert.match(h, /aria-label="1 \/ 2: D2"><p class="kk-ders">01\.11\.2026<\/p><h3 class="kk-konu">D2<\/h3>/);
    assert.match(h.slice(h.indexOf('1 / 2: D2'), h.indexOf('2 / 2: D1')), /Bütün sorular: <b>8 \/ 11<\/b> doğru · 1 boş<\/p><\/article>/, 'D2: 8 of 11, no sentence on an exam');
    // Dersler: one slide per ders over the chosen exams
    run("EK.kk={duzey:'ders'}"); h = sayfa();
    assert.match(h, /2 ders<\/span>/); assert.match(h, /<h3 class="kk-konu">TYT Türkçe<\/h3>[\s\S]*?Bütün sorular: <b>8 \/ 11<\/b> doğru · 1 boş · 2 deneme/);
    // Sorular: a slide per exam and ders with each question: own number (B marked), konu, band, result
    run("EK.kk={duzey:'soru',sinav:new Set([0])}"); h = sayfa();
    assert.match(h, /2 ders<\/span>/); assert.match(h, /data-kk-sinav="0" aria-pressed="true">/);
    assert.match(h, /<p class="kk-ders">D2 · 01\.11\.2026<\/p><h3 class="kk-konu">TYT Türkçe<\/h3>/);
    assert.match(h, /<tr class="kk-sd"><td><b>1<\/b><\/td><td>Sözcükte Anlam<\/td><td>Çok kolay<\/td><td>Doğru<\/td><\/tr>/);
    assert.match(h, /<tr class="kk-sy"><td><b>8<\/b><\/td><td>Cümlede Anlam<\/td><td>Zor<\/td><td>Yanlış<\/td><\/tr><tr class="kk-sb"><td><b>9<\/b><\/td><td>Cümlede Anlam<\/td><td>Çok zor<\/td><td>Boş<\/td><\/tr>/);
    assert.match(h, /<td><b>2<\/b> <span class="kk-kit">B<\/span><\/td><td>&lt;b&gt;X&lt;\/b&gt;<\/td><td>—<\/td><td>Doğru<\/td>/, 'a B question: own number, B; no band');
    // only the older exam, konular: Sözcükte Anlam 2 of 2 in one exam → biliyor; one konu
    run('EK.kk={sinav:new Set([1])}'); h = sayfa();
    assert.match(h, /data-kk-sinav="hepsi" aria-pressed="false">/); assert.match(h, /data-kk-sinav="1" aria-pressed="true">D1/);
    assert.match(h, /1 konu<\/span>/); assert.match(h, /2 \/ 2<\/b> doğru · 1 deneme<\/p><p class="kk-yorum kk-iyi">Soruların çoğunu doğru yapıyorsun\./);
    // a ders
    run("EK.kk={ders:'TYT Tarih'}"); h = sayfa(); assert.match(h, /<option value="TYT Tarih" selected>/); assert.match(h, /1 konu<\/span>/);
    // print: the list only
    assert.match(fs.readFileSync('src/yanlislar.css', 'utf8'), /@media print\{\.kk,\.yl-karne\{display:none!important\}\}/);
    run('delete D.konuKarne'); assert.match(sayfa(), /Henüz liste yok/); run("D.rol='rehber'"); T.sifirla();
  });

  await test('the package stays small: at most 15 exams, the newest, under the budget', async () => {
    const {e} = await kutuphane(); const k = copy(T.konuKarnesi('9001', Array(20).fill(e)));
    assert.equal(k.s.length, 15); assert(JSON.stringify(k).length < 150000);
  });

  console.log(passed + ' passed');
})();
