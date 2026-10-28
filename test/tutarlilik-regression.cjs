#!/usr/bin/env node
'use strict';
// Cross-page contract: the cases where pages used to disagree, run on one synthetic fixture through Deneme panosu,
// Etüt etkisi, Öğrenci raporları, Yoklama and Etütler. A participant mean is not the same students' change; one
// missed-day rule on both attendance pages; same-titled exams stay apart; six students are not twelve; an empty last
// pair keeps the history; the analysis base survives an unreadable Etüt planı and carries no attendance.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { etutRaporu, GUNLER } = require('./fixtures/etut-pdf.cjs'), { ornekRapor } = require('./fixtures/yoklama-pdf.cjs');
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
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__rapor = run('OGRENCI_RAPOR.temelOgrenciler'); sandbox.__ep = run('ETUTPLANI.oku');
const reset = () => run(`yalnizcaGoruntuleme=__yg;OGRENCI_RAPOR.temelOgrenciler=__rapor;ETUTPLANI.oku=__ep;OGRENCI_RAPOR.reset();D=varsayilan();D.rol='rehber';D.ogr=[];
  for(const k of ['eeDuzey','eeOturum','eeDers','eeSimdi','eeOnceki','eePencere','eeHoca'])EK[k]=undefined;`);
let passed = 0;
function check(name, fn) { reset(); try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// ---- the fixture: six 12/A students, three exams all titled GENEL DENEME a week apart ----
const DATES = ['2026-10-07', '2026-10-14', '2026-10-21'], A = 'SENTETİK ÖĞRETMEN A';
// 1–3 start low and take a Matematik etüt before each later exam; 4–6 start high and take none.
const NET = { 1: [10, 12, 14], 2: [11, 13, 15], 3: [12, 14, 16], 4: [20, 21, 22], 5: [21, 22, 23], 6: [22, 23, 24] };
const ogrenciler = (etutGunleri = ['2026-10-09', '2026-10-16']) => Object.entries(NET).map(([i, n]) => ({
  id: 'o' + i, name: 'SENTETİK ÖĞRENCİ ' + i, cls: '12/A',
  sessions: i <= 3 ? etutGunleri.map(date => ({ date, course: 'MATEMATİK TYT', teacher: A, minutes: 40, time: 900 })) : [],
  exams: DATES.map((date, k) => ({ exam: 'GENEL DENEME', date, session: 'TYT', nets: { mat: n[k] } })) }));
const KEY = k => 'GENEL DENEME|' + DATES[k];
const etki = (ogr, sec = {}) => { put('__tS', ogr); put('__tC', sec); return get('ETUT_ETKI.model(__tS,__tC,null)'); };

check('Deneme panosu: when the weaker students miss the later exam, the participant mean jumps; the same students barely move', () => {
  // The board's model on the same lists: the two weak students skip the second exam.
  const ogr = (no, v) => ({ no, v, net: {}, dy: {} }), sinav = (id, g, list) => ({ id, ad: 'GENEL DENEME', tarih: DATES[g], g: run('gunNo')(DATES[g]), dates: [DATES[g]], pdfDates: [], tur: 'genel', tyt: Object.fromEntries(list.map(o => [o.no, o])), ayt: {} });
  put('__tT', { sinavlar: [sinav('s1', 0, [ogr(1, 50), ogr(2, 50), ogr(3, 10), ogr(4, 10)]), sinav('s2', 1, [ogr(1, 51), ogr(2, 51)])] });
  const o = get(`(()=>{const t={...__tT,kisi:new Map([1,2,3,4].map(no=>[no,{no,ad:'SENTETİK '+no,sinif:'12/A'}]))};
    return DPANO.gorunumModeli(t,{key:'TYT',ad:'TYT',oturum:'tyt',deger:o=>o.v,dersler:[]},{uyar:()=>true},null).ozet.sec})()`);
  assert.equal(o.fark, 21, 'participant mean 30 → 51'); assert.equal(o.ayni, 1, 'the two who sat both: +1 each'); assert.equal(o.ayniN, 2);
});

check('attendance: Yoklama and Öğrenci raporları call the same days missed (three or more missed lessons, excused included)', () => {
  const durum = { P: 'Geldi', G: 'Gecikti', A: 'Gelmedi', R: 'Raporlu', M: 'Mazeretli (izinli)' };
  const kodlar = ['AAAAPPPP', 'AAAAAAAA', 'AAPPPPPP', 'MMMPPPPP', 'RRRRRRRR', 'GPPPPPPP', 'PPPPPAAA', 'AMRPPPPP'];
  const yoklama = kodlar.map(k => run('YOKLAMA.kacirma')(k));
  assert.deepEqual(yoklama, ['yarim', 'tam', null, 'yarim', 'tam', null, 'yarim', 'yarim']);
  for (const [i, k] of kodlar.entries()) {
    put('__tR', [{ date: '2026-10-01', statuses: [...k].map(c => durum[c]) }]);
    const s = get('OGRENCI_RAPOR.attendanceSummary(__tR)');
    assert.deepEqual([s.full, s.half, s.present], [yoklama[i] === 'tam' ? 1 : 0, yoklama[i] === 'yarim' ? 1 : 0, yoklama[i] ? 0 : 1], k);
  }
  // Yoklama still shows the day itself (at school, late) beside the count: AAAAPPPP is a late day and a missed half day.
  assert.equal(run('YOKLAMA.gunDurumu')('AAAAPPPP'), 'gec');
  // Yoklama's person and group counts use the rule too.
  run('D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(' + JSON.stringify(ornekRapor().pages) + '))');
  const m = get('(()=>{const m=YOKLAMA.model(D.yoklama);return {k:m.kisiler.map(k=>[k.kacirilan,k.liste.filter(x=>YOKLAMA.kacirma(x.kod)).length])}})()');
  assert(m.k.length > 0); for (const [a, b] of m.k) assert.equal(a, b);
});

check('Etüt etkisi: same-titled exams stay apart, six students are six (twelve observations), an empty last pair keeps the history', () => {
  const m = etki(ogrenciler());
  assert.equal(m.sinavlar.length, 3); assert.deepEqual(m.sinavlar.map(e => e.key), [0, 1, 2].map(KEY));
  // The whole run: 1–3 rose 4 with etüts, 4–6 rose 2 without; the adjusted difference has no overlap in starting net to use.
  assert.equal(m.hepsi.alan.n, 3); assert.equal(m.hepsi.kontrol.n, 3); assert.equal(m.hepsi.fark, 2);
  const a = m.seri.satirlar.find(r => r.ad === 'Sentetik Öğretmen A');
  assert.equal(a.gozlem, 6, 'two intervals × three students'); assert.equal(a.farkli, 3); assert.equal(a.donem.fark, 2, 'first → last for the same three');
  // Etüts only before the second exam: the last pair has none, the run's table still shows teacher A.
  const b = etki(ogrenciler(['2026-10-09']), { onceki: KEY(1), simdi: KEY(2) });
  assert.equal(b.durum, 'tamam'); assert.equal(b.hepsi.alan.n, 0); assert(b.seri.satirlar.some(r => r.ad === 'Sentetik Öğretmen A'));
});

check('analysis base: an unreadable Etüt planı stops the report but not Etüt etkisi; no attendance is carried; the etüts match Etütler', () => {
  run('D.ogr=[{no:1001,ad:"Sentetik Ada",sube:"12-A",sinif:12}];D.etut=ETUT.birlestir(null,ETUT.pdfCoz(' + JSON.stringify(etutRaporu(GUNLER).pages) + '));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(' + JSON.stringify(ornekRapor().pages) + '))');
  run('ETUTPLANI.oku=()=>({hata:"Etüt planı okunamadı."})');
  assert.throws(() => run('OGRENCI_RAPOR.model()'), /Etüt planı okunamadı/);
  const t = get('OGRENCI_RAPOR.temelOgrenciler()');
  assert.equal(t.students.reduce((n, s) => n + s.sessions.length, 0), get('ETUT.ac(D.etut).length'), 'every etüt row reaches the base');
  assert(t.students.every(s => !(s.attendance || []).length), 'no Yoklama in the base');
  assert.deepEqual(t.etutKapsam, get('ETUT.oku().veri.kaynak.map(k=>[k.bas,k.bit])'));
  assert.doesNotThrow(() => run('ETUT_ETKI.icerik()'));
});

console.log(passed + ' tutarlılık checks passed');
