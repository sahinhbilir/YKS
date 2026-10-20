#!/usr/bin/env node
'use strict';
// Etüt planı: the paper sheet per weekday, branş grouping in the paper's order, students written
// twice, filling from the etüt report or a pasted list, storage checks and failed saves, the viewing
// teacher, printing and privacy. Synthetic names only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { etutRaporu, GUNLER } = require('./fixtures/etut-pdf.cjs');
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
sandbox.__yg = run('yalnizcaGoruntuleme');
const reset = () => run(`yalnizcaGoruntuleme=__yg;confirm=()=>true;D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-21';
  D.ogr=[{no:1001,ad:'Sentetik Ada',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='etutplani';
  EK.epGun=undefined;EK.epMod=undefined;KAYIT=0;kaydet=async()=>{KAYIT++;return true};ETUT.onbellek.ts=null;`);
const satir = (b, o, ogr = []) => [b, o, [0, 1, 2, 3].map(i => ogr[i] || '')];
const yaz = async gunler => { put('G', gunler); await run('ETUTPLANI.degistir(p=>{p.gunler=G})'); };
const bosGunler = () => [[], [], [], [], []];
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('an empty plan: five weekdays, today chosen, the paper title and columns', () => {
    assert.equal(run('ETUTPLANI.gunSec()'), 2, 'Wednesday 21 Eki opens Çarşamba');
    const h = run('ETUTPLANI.icerik()');
    assert(h.includes('ÇARŞAMBA — ETÜT PLANI'));
    for (const t of ['BRANŞ', 'ÖĞRETMEN', 'ÖĞRENCİ 1', 'ÖĞRENCİ 2', 'ÖĞRENCİ 3', 'ÖĞRENCİ 4']) assert(h.includes('>' + t + '</th>'), t);
    for (const g of ['0', '1', '2', '3', '4', 'hepsi']) assert(h.includes('data-ep-gun="' + g + '"'), g);
    assert.match(h, /data-ep-gun="2" aria-pressed="true"/);
    assert(h.includes('data-ep-ekle="2"') && !h.includes('data-ep-rapor'), 'no etüt report: only "Öğretmen ekle"');
    assert(/id="epTemizle" disabled/.test(h) && h.includes('id="epYazdir"'));
    run("D.ayar.testTarih='2026-10-24'"); assert.equal(run('ETUTPLANI.gunSec()'), 0, 'the weekend opens Pazartesi');
    assert.equal(run('D.etutPlani'), undefined, 'looking saves nothing'); assert.equal(run('KAYIT'), 0);
  });
  await check('rows keep their order; the sheet and the print group them by branş in the paper\'s order', async () => {
    await yaz([[satir('Fizik', 'Sentetik Fizikçi'), satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada']), satir('İngilizce', 'Sentetik İngilizceci'),
      satir('matematik', 'Sentetik Mat İki', ['', 'Sentetik Bora']), satir('Robotik', 'Sentetik Robotçu'), satir('Geometri', 'Sentetik Geometrici')], [], [], [], []]);
    assert.equal(run('KAYIT'), 1); assert.equal(get('D.etutPlani.gunler[0]').length, 6); assert.equal(get('D.etutPlani.gunler[0][3][2][1]'), 'Sentetik Bora');
    assert.deepEqual(get('ETUTPLANI.gruplar(D.etutPlani.gunler[0]).map(g=>g.brans+":"+g.satir.join(","))'), ['Matematik:1,3', 'Geometri:5', 'Fizik:0', 'İngilizce:2', 'Robotik:4']);
    run('EK.epGun=0'); const h = run('ETUTPLANI.icerik()');
    const sira = ['>MATEMATİK<', 'Sentetik Mat Bir', 'Sentetik Mat İki', '>GEOMETRİ<', '>FİZİK<', '>İNGİLİZCE<', '>ROBOTİK<'].map(t => h.indexOf(t));
    assert(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])), 'grouped in the paper order: ' + sira);
    assert.match(h, /<th scope="row" class="ep-brans" rowspan="2">MATEMATİK<\/th>/);
    assert.match(h, /data-ep-r="3" data-ep-k="1" value="Sentetik Bora"/, 'cells keep the row they were written in');
    const b = run('ETUTPLANI.baskiHtml(D.etutPlani,[0,1,2,3,4])');
    assert.equal((b.match(/<section class="ep-sayfa">/g) || []).length, 1, 'days without teachers are not printed');
    assert.match(b, /<h1>PAZARTESİ — ETÜT PLANI<\/h1>/); assert.match(b, /<th scope="row" rowspan="2">MATEMATİK<\/th><td>Sentetik Mat Bir<\/td><td>Sentetik Ada<\/td><td><\/td><td><\/td><td><\/td><\/tr><tr><td>Sentetik Mat İki<\/td><td><\/td><td>Sentetik Bora<\/td>/);
    assert(!b.includes('<input'), 'the printed sheet is plain text');
  });
  await check('a student written twice on one day is marked on both cells', async () => {
    await yaz([[satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada', 'Sentetik Bora']), satir('Fizik', 'Sentetik Fizikçi', ['sentetik  ada'])], [satir('Fizik', 'Sentetik Fizikçi', ['Sentetik Ada'])], [], [], []]);
    run('EK.epGun=0'); const h = run('ETUTPLANI.icerik()');
    assert.equal((h.match(/class="ep-cift"/g) || []).length, 2, 'same name, other spacing and case');
    run('EK.epGun=1'); assert(!run('ETUTPLANI.icerik()').includes('ep-cift'), 'another day is not a clash');
  });
  await check('the etüt report fills a weekday with its teachers; nobody is added twice; branş comes from the plan or the report', async () => {
    put('pages', etutRaporu(GUNLER).pages); await run('ETUT.raporEkle([ETUT.pdfCoz(pages)])'); run('ETUT.onbellek.ts=null');
    run('EK.epGun=0'); assert(run('ETUTPLANI.icerik()').includes('data-ep-rapor="0"'));
    await run("ETUTPLANI.ekle(0,ETUT.planIcin().gunler[0],'Etüt raporundan')");
    assert.deepEqual(get('D.etutPlani.gunler[0].map(s=>s[0]+"|"+s[1])'), ['Matematik|Sentetik Öğretmen Bir', 'Fizik|Sentetik Öğretmen Üç']);
    assert.match(run('ETUTPLANI.icerik()'), /Etüt raporundan: 2 öğretmen eklendi/);
    await run("ETUTPLANI.ekle(0,ETUT.planIcin().gunler[0],'Etüt raporundan')");
    assert.equal(get('D.etutPlani.gunler[0]').length, 2); assert.match(run('ETUTPLANI.icerik()'), /Eklenecek yeni öğretmen yok/);
    assert(!run('ETUTPLANI.icerik()').includes('data-ep-rapor="0"'), 'nothing left to add: the button goes');
    // Copying another day adds its teachers without their students.
    await run("ETUTPLANI.degistir(p=>{p.gunler[0][0][2][0]='Sentetik Ada';p.gunler[0].push(['','',['','','','']])})");
    await run("ETUTPLANI.ekle(1,D.etutPlani.gunler[0].map(s=>({brans:s[0],ogretmen:s[1]})).filter(o=>o.ogretmen),'Pazartesi gününden')");
    assert.deepEqual(get('D.etutPlani.gunler[1]'), [satir('Matematik', 'Sentetik Öğretmen Bir'), satir('Fizik', 'Sentetik Öğretmen Üç')]);
    assert.equal(run("ETUTPLANI.bransBul(D.etutPlani,'sentetik öğretmen üç')"), 'Fizik', 'from the plan');
    assert.equal(run("ETUTPLANI.bransBul(D.etutPlani,'Sentetik Öğretmen Dört')"), 'Kimya', 'from the report');
    assert.equal(run("ETUTPLANI.bransBul(D.etutPlani,'Sentetik Yeni')"), '');
    // The lists offer notebook and report students, and the report's teachers.
    const h = run('ETUTPLANI.icerik()');
    assert.match(h, /<datalist id="epOgrenciler"><option value="Sentetik Ada" label="12-A"><\/option>/);
    assert(h.includes('<option value="Sentetik Bora" label="12/B">') && h.includes('<option value="Sentetik Öğretmen Dört">'));
    assert.equal((h.match(/<datalist id="epOgrenciler">[\s\S]*?<\/datalist>/)[0].match(/value="Sentetik Ada"/g) || []).length, 1, 'one entry per name');
  });
  await check('a pasted list sets the week: weekday lines start a day, teachers keep their students, bad lines are named', async () => {
    await yaz([[satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada']), satir('Fizik', 'Sentetik Eski Fizikçi', ['Sentetik Bora'])], [], [], [], []]);
    run("EK.epGun='hepsi';KAYIT=0");
    put('L', 'Pazartesi — Etüt planı\nMatematik: Sentetik Mat Bir, Sentetik Mat İki\nGeometri: Sentetik Geo\n\nsali\nEdebiyat: Sentetik Ede Bir; Sentetik Ede İki\nCARSAMBA:\nİngilizce\tSentetik İng');
    assert.match(await run('ETUTPLANI.listeUygula(L)'), /Yapıştırıldı: Pazartesi 3 · Salı 2 · Çarşamba 1 öğretmen/);
    assert.deepEqual(get('D.etutPlani.gunler[0]'), [satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada']), satir('Matematik', 'Sentetik Mat İki'), satir('Geometri', 'Sentetik Geo')],
      'a teacher who stays keeps their students; one left out goes');
    assert.deepEqual(get('D.etutPlani.gunler[1].map(s=>s[0]+"|"+s[1])'), ['Edebiyat|Sentetik Ede Bir', 'Edebiyat|Sentetik Ede İki']);
    assert.deepEqual(get('D.etutPlani.gunler[2]'), [satir('İngilizce', 'Sentetik İng')]); assert.deepEqual(get('D.etutPlani.gunler[3]'), []);
    assert.equal(run('KAYIT'), 1, 'one save for the whole paste');
    run('EK.epGun=4'); put('L', 'Kimya: Sentetik Kimyacı'); await run('ETUTPLANI.listeUygula(L)');
    assert.deepEqual(get('D.etutPlani.gunler[4]'), [satir('Kimya', 'Sentetik Kimyacı')], 'no weekday line: the day on screen');
    const once = JSON.stringify(get('D.etutPlani.gunler'));
    put('L', 'PERŞEMBE\nMatematik Sentetik İkinoktasız\nFizik:\nKimya: Sentetik Tamam');
    await assert.rejects(run('ETUTPLANI.listeUygula(L)'), /Okunamayan satırlar: 2, 3\./);
    run("EK.epGun='hepsi'"); put('L', 'Matematik: Sentetik Günsüz');
    await assert.rejects(run('ETUTPLANI.listeUygula(L)'), /Okunamayan satır: 1\./, 'all days on screen: a weekday line is needed');
    put('L', 'SALI\n'); await assert.rejects(run('ETUTPLANI.listeUygula(L)'), /öğretmen yok/);
    run('confirm=()=>false'); put('L', 'Pazartesi\nTarih: Sentetik Tarihçi'); assert.equal(await run('ETUTPLANI.listeUygula(L)'), '');
    run('confirm=()=>true'); assert.equal(JSON.stringify(get('D.etutPlani.gunler')), once, 'refused or declined pastes change nothing');
    run("EK.epMod='ogretmen'"); assert(run('ETUTPLANI.icerik()').includes('id="epListe"'));
    run("EK.epMod='ogrenci'"); assert(!run('ETUTPLANI.icerik()').includes('id="epListe"'), 'the box is in the teacher view only');
  });
  await check('the teacher view edits branş and öğretmen; leaving it drops empty rows', async () => {
    await yaz([[satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada']), satir('', ''), satir('Fizik', '')], [satir('', '')], [], [], []]);
    run("EK.epGun='hepsi';EK.epMod='ogretmen'");
    const h = run('ETUTPLANI.icerik()');
    assert.equal((h.match(/class="ep-tablo duzen"/g) || []).length, 2, 'two days have rows'); assert.equal((h.match(/data-ep-ekle=/g) || []).length, 5);
    assert.match(h, /data-ep-r="0" data-ep-alan="1" value="Sentetik Mat Bir"/); assert(h.includes('data-ep-sil="0:2"'));
    assert(h.includes('<select data-ep-kopya="2"') && !h.includes('<select data-ep-kopya="0"><option value="">Başka günden ekle</option><option value="0">'), 'copy from the other days only');
    await run('ETUTPLANI.bosSatirlariAt()');
    assert.deepEqual(get('D.etutPlani.gunler'), [[satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada']), satir('Fizik', '')], [], [], [], []]);
    run('KAYIT=0'); await run('ETUTPLANI.bosSatirlariAt()'); assert.equal(run('KAYIT'), 0, 'nothing to drop: nothing saved');
  });
  await check('a viewing teacher reads and prints the plan; cells are read-only and nothing is saved', async () => {
    await yaz([[satir('Matematik', 'Sentetik Mat Bir', ['Sentetik Ada'])], [], [], [], []]);
    run("KAYIT=0;yalnizcaGoruntuleme=()=>true;EK.epGun=0;EK.epMod='ogretmen'");
    const h = run('ETUTPLANI.icerik()');
    assert(h.includes(' readonly>') && h.includes('id="epYazdir"')); assert(!h.includes('data-ep-mod') && !h.includes('epTemizle') && !h.includes('data-ep-alan'), 'no editing controls');
    await assert.rejects(run("ETUTPLANI.degistir(p=>{p.gunler[0]=[]})"), /Yalnızca rehber/); assert.equal(run('KAYIT'), 0);
    assert.equal(get('D.etutPlani.gunler[0]').length, 1);
  });
  await check('checks on every write; failed saves keep the old plan; an unreadable plan is shown and never overwritten', async () => {
    run('kaydet=async()=>false');
    await assert.rejects(run("ETUTPLANI.degistir(p=>{p.gunler[0].push(['Fizik','Sentetik',['','','','']])})"), /Cihaza kaydedilemedi/); assert.equal(run('D.etutPlani'), undefined);
    run('kaydet=async()=>{KAYIT++;return true}'); await yaz([[satir('Fizik', 'Sentetik Fizikçi')], [], [], [], []]);
    const once = JSON.stringify(get('D.etutPlani'));
    for (const [neden, kod] of [['five students', "p.gunler[0][0][2].push('')"], ['a long name', "p.gunler[0][0][1]='x'.repeat(61)"], ['a number', 'p.gunler[0][0][2][0]=5'],
      ['41 rows', "for(let i=0;i<41;i++)p.gunler[1].push(['','',['','','','']])"], ['six days', 'p.gunler.push([])']])
      await assert.rejects(run(`ETUTPLANI.degistir(p=>{${kod}})`), /etüt planı okunamadı/, neden);
    assert.equal(JSON.stringify(get('D.etutPlani')), once, 'rejected writes leave the stored plan');
    run("D.dolgu='x'.repeat(BULUT_YEDEK_UST_SINIR)"); await assert.rejects(run("ETUTPLANI.degistir(p=>{p.gunler[2].push(['Kimya','Sentetik Kimyacı',['','','','']])})"), /bulut yedeği/);
    assert.equal(JSON.stringify(get('D.etutPlani')), once); run('delete D.dolgu');
    run('D.etutPlani={surum:9}'); assert.match(run('ETUTPLANI.icerik()'), /Kayıtlı etüt planı okunamadı \(yapı\)/);
    await assert.rejects(run("ETUTPLANI.degistir(p=>{})"), /okunamadı/); assert.deepEqual(get('D.etutPlani'), { surum: 9 });
  });
  await check('names are escaped on the sheet, in the lists and on the printed page', async () => {
    await yaz([[satir('<b>Fizik</b>', 'Sentetik <img src=x>', ['"><script>'])], [], [], [], []]);
    run('EK.epGun=0'); const h = run('ETUTPLANI.icerik()') + run('ETUTPLANI.baskiHtml(D.etutPlani,[0])');
    assert(!/<img|<script|<b>Fizik/i.test(h)); assert(h.includes('Sentetik &lt;img src=x&gt;') && h.includes('&quot;&gt;&lt;script&gt;'));
  });
  await check('the plan never reaches a student packet', async () => {
    await yaz([[satir('Matematik', 'Sentetik Gizli Öğretmen', ['Sentetik Gizli Öğrenci'])], [], [], [], []]);
    const paket = JSON.stringify(run('ogrenciPaketi(0)'));
    assert(!paket.includes('Sentetik Gizli') && !paket.includes('etutPlani'));
  });
  await check('the teacher menu lists Etüt planı under Öğrenciler; it is for the teacher only', () => {
    assert(get('SEKME_REHBER').some(([id, ad]) => id === 'etutplani' && ad === 'Etüt planı'));
    assert(!get('SEKME_OGRENCI').some(([id]) => id === 'etutplani'));
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutplani']);
    assert.match(run('gorunumEtutPlani()'), /<div id="epKok"><header class="et-bas"><h1 class="et-baslik">Etüt planı<\/h1>/);
    run("D.rol='ogrenci'"); assert.match(run('gorunumEtutPlani()'), /Bu sayfa rehber öğretmen içindir/);
  });
  console.log(passed + ' Etüt planı checks passed');
})();
