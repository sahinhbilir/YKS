#!/usr/bin/env node
'use strict';
// School holidays shift the topic plan, the first-review delay is learned per student, broad and
// compound topics can be split into sub-topics from a list, and Ayarlar is split into sections.
// Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',className:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},
  window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},
    querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){},classList:{add(){},remove(){},contains(){return false}}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox), json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const iso = g => run('isoDan(' + g + ')');

check('the 2026–2027 holidays: new notebooks have them, an older notebook gets them once', () => {
  run(`D = varsayilan(); D.rol = 'rehber'; D.ayar.testTarih = '2026-10-14'`);
  assert.deepEqual(json('D.ayar.tatiller.map(t => [t.bas, t.bit])'),
    [['2026-11-16','2026-11-20'],['2027-01-25','2027-02-05'],['2027-03-08','2027-03-12'],['2027-05-16','2027-05-19']]);
  // Holiday weeks: 3+ weekdays off. Kurban (Sun–Wed) leaves Thu/Fri but still has 3 weekdays off.
  assert.deepEqual(json(`['2026-11-16','2027-01-25','2027-02-01','2027-03-08','2027-05-17','2026-11-09','2027-05-10'].map(d => tatilHaftasiMi(gunNo(d)))`),
    [true, true, true, true, true, false, false]);
  run(`delete D.ayar.tatiller; tatilleriHazirla()`);
  assert.equal(run('D.ayar.tatiller.length'), 4, 'installed once');
  run(`D.ayar.tatiller = []; tatilleriHazirla()`);
  assert.equal(run('D.ayar.tatiller.length'), 0, 'a teacher who removed them all keeps an empty list');
  run('yedekDogrula(JSON.parse(JSON.stringify(varsayilan())))');
  assert.throws(() => run(`(() => { const y = varsayilan(); y.ayar.tatiller = [{bas:'2026-12-10', bit:'2026-12-01', ad:'x'}]; yedekDogrula(y); })()`), /tatil/);
});

check('holiday weeks do not use a plan week; the topic plan moves on by one; lessons skip holiday days', () => {
  run(`D = varsayilan(); D.rol = 'rehber'; D.ayar.testTarih = '2026-10-14'; D.ayar.donemBasi = '2026-09-07'; D.ayar.donemElle = true;
    D.ogr = [{ad:'Ada', no:1, sube:'12-A', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true}];
    D.konuPlani = {'12-A': Array.from({length: 40}, (_, w) => ({'Fizik': ['Fizik konu ' + (w + 1)]}))};
    const prog = {saatler:['09:00','10:00'], gunler:[['Fizik'],[],['Fizik'],[],[],[],[]]};
    D.programHafta = {'12-A': {[gunNo('2026-09-07')]: prog}}; D.dersProgrami = {'12-A': prog};`);
  const nov9 = run(`gunNo('2026-11-09')`), nov16 = nov9 + 7, nov23 = nov9 + 14;
  assert.equal(run(`planHaftasi('12-A', ${nov9})`), 10);
  assert.equal(run(`planHaftasi('12-A', ${nov23})`), 11, 'the holiday week is skipped');
  assert.equal(iso(run(`haftaTakvimi(11, '12-A')`)), '2026-11-23', 'and the inverse agrees');
  assert.equal(iso(run(`haftaTakvimi(10, '12-A')`)), '2026-11-09');
  // After the two-week semester break the plan continues where it stopped.
  assert.equal(run(`planHaftasi('12-A', gunNo('2027-02-08')) - planHaftasi('12-A', gunNo('2027-01-18'))`), 1);
  // Distribution: nothing in the holiday week; the next plan week lands right after it.
  run(`ileriDagit(gunNo('2026-11-02'), '12-A', 4)`);
  const tarih = json(`(() => { const m = D.subeIslenis['12-A'], out = {}; Object.keys(m).forEach(k => { out[konuAl(+k)[3]] = isoDan(m[k]); }); return out; })()`);
  assert.equal(tarih['Fizik konu 9'], '2026-11-02');
  assert.equal(tarih['Fizik konu 10'], '2026-11-09');
  assert.equal(tarih['Fizik konu 11'], '2026-11-23', 'not in 16–20 Kasım');
  assert(!Object.values(tarih).some(d => d >= '2026-11-16' && d <= '2026-11-20'));
  // A short holiday (one weekday) only moves that day's lesson to another lesson day of the week.
  run(`D.ayar.tatiller = [{bas:'2026-12-07', bit:'2026-12-07', ad:'Tek gün'}]; D.subeIslenis = {}; D.konuPlani['12-A'][13] = {'Fizik': ['Pazartesi konusu', 'Çarşamba konusu']}`);
  assert.equal(run(`tatilHaftasiMi(gunNo('2026-12-07'))`), false);
  run(`programUygula(gunNo('2026-12-07'), '12-A')`);
  const aralik = json(`(() => { const m = D.subeIslenis['12-A'], out = {}; Object.keys(m).forEach(k => { out[konuAl(+k)[3]] = isoDan(m[k]); }); return out; })()`);
  assert.deepEqual([aralik['Pazartesi konusu'], aralik['Çarşamba konusu']], ['2026-12-09', '2026-12-09'], 'Monday off: Wednesday lesson');
});

check('editing holidays in Ayarlar → Ders programı redistributes the coming weeks', () => {
  run(`D.ayar.tatiller = TATIL_2026_2027.map(t => ({...t})); EK = {sekme:'ayarlar', ayarBolum:'program', ogr:0, girisAcik:{}}; D.subeIslenis = {};`);
  const h = run('gorunumAyarlar()');
  assert.match(h, /data-ayar-bolum="genel"[^>]*>Genel<\/button><button type="button" class="secili" aria-pressed="true" data-ayar-bolum="program">Ders programı<\/button>/);
  assert.match(h, /<h2>Tatiller<\/h2>/); assert.match(h, /Yarıyıl tatili<\/b><\/td><td>25\.01\.2027 – 05\.02\.2027/);
  assert.match(h, /id="tatilEkle"/); assert.match(h, /data-mufredat-sube="12-A"[^>]*>12-A · Özel tasarlanmış müfredat/);
  assert.doesNotMatch(h, /border-color:var\(--kritik\)/, 'no orange outline on the AI box');
  run(`IZLEME = {sahipUid:'a', izleyiciUid:'b'}`);
  assert.doesNotMatch(run('tatillerKarti()'), /tatilEkle|data-tatil-sil/, 'view-only cannot edit');
  run('IZLEME = null');
});

check('Ayarlar sections: Genel keeps the settings, Öğrenci kalibrasyonu holds the course profiles', () => {
  run(`EK.ayarBolum = 'genel'`);
  let h = run('gorunumAyarlar()');
  assert.match(h, /id="ayarKaydet"/); assert.doesNotMatch(h, /Ders profilleri|Programı AI ile aktar/);
  run(`EK.ayarBolum = 'kalibrasyon'`); h = run('gorunumAyarlar()');
  assert.match(h, /<h2>Ders profilleri<\/h2>/); assert.match(h, /İlk tekrar: <b>/); assert.doesNotMatch(h, /id="ayarKaydet"/);
  run(`EK.ayarBolum = 'yok'`); assert.match(run('gorunumAyarlar()'), /aria-pressed="true" data-ayar-bolum="genel"/);
  // A student's advanced settings: no timetable section without a class, calibration still there.
  run(`D.rol = 'ogrenci'; D.ogr = [{ad:'Ada', no:1, sube:'', alan:'SAY', kap:6, off:[6]}]; D.dersProgrami = {}; D.programHafta = {}; D.konuPlani = {}; EK.ayarBolum = 'program'`);
  h = run('gorunumAyarlar(true)');
  assert.doesNotMatch(h, /data-ayar-bolum="program"/); assert.match(h, /aria-pressed="true" data-ayar-bolum="genel"/);
  // The old "program" page opens Ders programı (inside the opened Gelişmiş ayarlar), which steps
  // through school weeks: Monday, even when the student's own week starts on Wednesday.
  run(`D.ayar.testTarih = '2026-10-14'; D.ogr = [{ad:'Ada', no:1, sube:'benim', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true, ilkAktif:gunNo('2026-09-07'),
    haftaDuzeni:{donemler:[{bas:gunNo('2026-09-09'), gun:2}]}}]; EK = {sekme:'program', ogr:0, hafta:null, girisAcik:{}}; cizIc()`);
  assert.deepEqual(json('[EK.sekme, EK.ayarBolum, EK.gelismisAcik]'), ['ayarlar', 'program', true]);
  assert.match(nodes.ana.innerHTML, /id="ogrGelismis"[^>]* open>[\s\S]*aria-pressed="true" data-ayar-bolum="program"[\s\S]*Programı AI ile aktar/);
  assert.equal(iso('haftaBasi()'), '2026-10-12', 'Ders programı: school week');
  run(`EK.ayarBolum = 'genel'`); assert.equal(iso('haftaBasi()'), '2026-10-14', "elsewhere: the student's own week");
});

check('the first-review delay is learned after 4 weeks of first measurements; Ayarlar says so', () => {
  run(`D = varsayilan(); D.rol = 'rehber'; D.ayar.testTarih = '2026-11-20'; D.ayar.ilk = 3; D.ayar.hedef = 0.9;
    D.ogr = [0, 1, 2].map(i => ({ad:'S' + i, no:i + 1, sube:'12-A', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true})); D.log = []; D.islenis = {};
    // S0: always remembers at 3 days (10 topics over 5 weeks); S1: often forgets; S2: only 3 weeks of data.
    for (let i = 0; i < 10; i++) { const t = gunNo('2026-09-14') + i * 4; D.islenis[i] = t;
      D.log.push([t + 3, 0, i, null, null, 3, 1]); D.log.push([t + 3, 1, i, null, null, i % 3 ? 1 : 3, 1]); if (t + 3 < gunNo('2026-10-08')) D.log.push([t + 3, 2, i, null, null, 3, 1]); }`);
  const r = json('[0,1,2].map(si => ilkTekrarOgrenilen(si))');
  assert.equal(r[0].n, 10); assert(r[0].gun > 3, 'a student who remembers gets a longer first gap: ' + r[0].gun);
  assert(r[1].gun !== null && r[1].gun < r[0].gun, 'a student who forgets gets a shorter one: ' + r[1].gun);
  assert.equal(r[2].gun, null, 'under 4 weeks: the setting is used'); assert(r[2].n >= 5);
  assert.equal(run('ilkTekrarAraligi(0, 50, gunNo("2026-11-20"))'), r[0].gun);
  assert.equal(run('ilkTekrarAraligi(2, 50, gunNo("2026-11-20"))'), 3);
  // Assumed İyi reviews are not first measurements; only real results count.
  run(`D.kart['0:60'] = {s:2, d:5, son:1, due:2, n:1, y:null, not:3, vg:[1]}`);
  assert.equal(run('ilkTekrarOgrenilen(0).n'), 10);
  const not = run('ilkTekrarAyarNotu()');
  assert.match(not, /Yalnızca verisi yetmeyen 1 öğrenci için\. 2 öğrencide algoritma belirliyor \(\d+–\d+ gün\)/);
  run(`EK = {sekme:'ayarlar', ayarBolum:'genel', ogr:0, girisAcik:{}}`);
  assert.match(run('gorunumAyarlar()'), /id="aIlk"[^>]*value="3">[\s\S]*Yalnızca verisi yetmeyen/);
  assert.match(run('ilkTekrarBilgisi(2)'), /ayardaki değer; 8 ilk ölçüm ve 4 hafta birikince algoritma belirler \(şu an 6 ölçüm, 2 hafta\)/);
});

check('alt konu: compound topic names and kazanım codes become a list; a click splits one for this student only', () => {
  run(`D = varsayilan(); D.rol = 'rehber'; D.ayar.testTarih = '2026-10-14';
    D.ogr = [0, 1].map(i => ({ad:'S' + i, no:i + 1, sube:'12-A', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true}));
    D.ekKonular = [[1, 12, 'Sayılar', 'Asal Sayılar, Ardışık Sayılar, Faktöriyel', 0, '', 0], [0, 9, 'Şiir', '9. sınıf · 1.1 · Şiir ve deneme: edebî dil, imge ve sembol', 0, '', 0]];
    var asal = KATALOG.length, siir = KATALOG.length + 1;`);
  assert.deepEqual(json('konuKazanimlari(asal)'), ['Asal Sayılar', 'Ardışık Sayılar', 'Faktöriyel']);
  assert.deepEqual(json('konuKazanimlari(siir)'), ['Şiir ve deneme: edebî dil', 'Şiir ve deneme: imge ve sembol']);
  assert.deepEqual(json('konuKazanimlari(0)'), ['Kazanım 9.1', 'Kazanım 9.2', 'Kazanım 9.3'], 'catalogue topics show their codes');
  let h = run('altKonuKutusu(0, asal)');
  assert.match(h, /<details class="altKutu"><summary>Alt konulara ayır \(3\)/, 'closed unless broad');
  assert.match(h, /data-ad="Ardışık Sayılar">Ardışık Sayılar<\/button>/); assert.match(h, /class="altKonuAd"/);
  assert.match(run('altKonuKutusu(0, 0)'), /<details class="altKutu" open>/, 'a broad topic opens it');
  const ki = run(`altKonuAc(0, asal, 'Ardışık Sayılar')`);
  assert.equal(run(`D.altKonu[${ki}]`), run('asal'));
  assert(run(`!!D.ogrIslenis[0][${ki}] && D.islenis[${ki}] === undefined`), "the teacher's split stays with that student");
  h = run('altKonuKutusu(0, asal)'); assert.match(h, /<span class="rozet">✓ Ardışık Sayılar<\/span>/);
  assert.doesNotMatch(run('altKonuKutusu(1, asal)'), /✓ Ardışık/, 'not split for the other student');
  assert.equal(run(`altKonuAc(1, asal, 'Ardışık Sayılar')`), ki, 'the same split reuses the topic');
  assert.equal(run('D.ekKonular.length'), 3);
  assert.equal(run(`altKonuKutusu(0, ${ki})`), '', 'a sub-topic is not split again');
});

console.log('okul takvimi regression: ' + passed + ' checks passed');
