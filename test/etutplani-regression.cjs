#!/usr/bin/env node
'use strict';
// Etüt planı: the sheet per weekday in the school's Excel layout, branş grouping in the paper's order,
// students written twice, filling from the etüt report or a pasted list, Sınıf dağıtımı (dated sheets,
// a class in Öğrenci 1, every class in every subject; with the classes' timetables each class's etüts
// go to its own teachers, weighted by weekly hours), storage checks and failed saves, the viewing
// teacher, landscape printing two days to a page, and privacy. Synthetic names only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { etutRaporu, GUNLER } = require('./fixtures/etut-pdf.cjs');
const { dersProgrami } = require('./fixtures/ders-programi-pdf.cjs');
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
    assert.match(h, /<th scope="row" class="ep-brans">MATEMATİK<\/th><td class="ep-hoca">SENTETİK MAT BİR<\/td>/, 'the branş on its first row, as in the Excel file');
    assert.match(h, /<tr><td class="ep-brans-bos"><\/td><td class="ep-hoca">SENTETİK MAT İKİ<\/td>/, 'the cell below it left empty');
    assert.match(h, /data-ep-r="3" data-ep-k="1" value="Sentetik Bora"/, 'cells keep the row they were written in');
    let b = run('ETUTPLANI.baskiHtml(D.etutPlani,[0,1,2,3,4])');
    assert.equal((b.match(/<section class="ep-sayfa"/g) || []).length, 1, 'days without teachers are not printed');
    assert.match(b, /<section class="ep-sayfa" style="--o:0\.82"><div class="ep-gun"><h1>PAZARTESİ — ETÜT PLANI<\/h1>/, 'at the Excel file\'s 82%');
    assert.match(b, /<th scope="row" class="ep-brans">MATEMATİK<\/th><td class="ep-hoca">SENTETİK MAT BİR<\/td><td class="ep-ogr">SENTETİK ADA<\/td><td class="ep-ogr"><\/td><td class="ep-ogr"><\/td><td class="ep-ogr"><\/td><\/tr><tr><td class="ep-brans-bos"><\/td><td class="ep-hoca">SENTETİK MAT İKİ<\/td><td class="ep-ogr"><\/td><td class="ep-ogr">SENTETİK BORA<\/td>/);
    assert(!b.includes('<input'), 'the printed sheet is plain text');
    // Two days to a landscape page, as the Excel file prints: Pazartesi–Salı, Çarşamba–Perşembe, Cuma.
    await yaz([0, 1, 2, 3, 4].map(g => [satir('Matematik', 'Sentetik Mat ' + g)]));
    b = run('ETUTPLANI.baskiHtml(D.etutPlani,[0,1,2,3,4])');
    assert.deepEqual(b.split('<section').slice(1).map(x => (x.match(/<h1>([^<]+)<\/h1>/g) || []).map(h => h.slice(4, -5).split(' ')[0])), [['PAZARTESİ', 'SALI'], ['ÇARŞAMBA', 'PERŞEMBE'], ['CUMA']]);
    assert.equal((b.match(/<div class="ep-ara"><\/div>/g) || []).length, 2);
    // A day too long for the page prints smaller, as Excel's fit to page does.
    await yaz([Array.from({length: 40}, (_, i) => satir('Matematik', 'Sentetik Uzun ' + i)), [], [], [], []]);
    assert.match(run('ETUTPLANI.baskiHtml(D.etutPlani,[0])'), /style="--o:0\.548"/);
  });
  await check('Sınıf dağıtımı: dated sheets from 22 Eki to 6 Kas, a class in every Öğrenci 1, each subject reaching every class', async () => {
    // The default: tomorrow to the Friday of the week after next, Cumhuriyet Bayramı and the afternoon before it off.
    assert.deepEqual(get('ETUTPLANI.varsayilanDonem()'), {bas:'2026-10-22', bit:'2026-11-06', siniflar:[], yok:['2026-10-28', '2026-10-29']});
    put('pages', etutRaporu(GUNLER).pages); await run('ETUT.raporEkle([ETUT.pdfCoz(pages)])'); run('ETUT.onbellek.ts=null');
    assert.deepEqual(get('ETUTPLANI.sinifOnerisi()'), ['10/A', '11/A'], 'the report\'s classes and the notebook\'s, without the 12th grade');
    assert.deepEqual(['10-a', '9 B', ' 11/c ', '12/A', 'abc', '10/'].map(c => run('ETUTPLANI.sinifYaz(' + JSON.stringify(c) + ')')), ['10/A', '9/B', '11/C', '12/A', null, null]);
    await yaz([[satir('Matematik', 'Sentetik Mat Bir'), satir('Fizik', 'Sentetik Fizikçi'), satir('Matematik', 'Sentetik Mat İki', ['Sentetik Ada', 'Sentetik Bora'])],
      [satir('Matematik', 'Sentetik Mat Bir')], [satir('Fizik', 'Sentetik Fizikçi'), satir('Biyoloji', 'Sentetik Biyolog')],
      [satir('Matematik', 'Sentetik Mat İki'), satir('Fizik', 'Sentetik Fizikçi')], [satir('Matematik', 'Sentetik Mat Bir')]]);
    run("D.ayar.tatiller=[{bas:'2026-11-03',bit:'2026-11-03',ad:'Sentetik tatil'}]");
    await run("ETUTPLANI.degistir(p=>{p.donem={bas:'2026-10-22',bit:'2026-11-06',siniflar:['9/A','9/B','10/A','11/A'],yok:['2026-10-28','2026-10-29']}})");
    const dg = () => get('(()=>{const d=ETUTPLANI.dagit(D.etutPlani);return {gunler:d.gunler.map(x=>isoDan(x.g)),sinif:Object.fromEntries([...d.sinif].map(([k,v])=>[isoDan(+k.split(":")[0])+":"+k.split(":")[1],v])),kapsam:d.kapsam}})()');
    const d = dg();
    assert.deepEqual(d.gunler, ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06'], 'school days, less the yok days and the school\'s holidays');
    // Matematik takes the classes in turn from 9/A, Fizik from 9/B; same-day teachers of a subject get different classes.
    assert.deepEqual([d.sinif['2026-10-22:0'], d.sinif['2026-10-22:1'], d.sinif['2026-10-23:0'], d.sinif['2026-10-26:0'], d.sinif['2026-10-26:2'], d.sinif['2026-10-26:1']], ['9/A', '9/B', '9/B', '10/A', '11/A', '10/A']);
    assert.deepEqual(d.kapsam.map(x => [x.brans, x.yer, x.eksik]), [['Matematik', 10, []], ['Fizik', 5, []], ['Biyoloji', 1, ['9/A', '9/B', '11/A']]], 'every class in every subject, or which classes miss it');
    assert(Object.values(d.sinif).every(c => !c.startsWith('12/')));
    // The page: dated sheets (today 21 Eki opens 22 Eki), Öğrenci 1 holds the class, the other cells the weekday's names.
    let h = run('ETUTPLANI.icerik()');
    assert.match(h, /<select id="epTarih" aria-label="Tarih"><option value="hepsi">Tümü \(22 Eki – 6 Kas\)<\/option>/);
    assert.match(h, /<h2 class="ep-baslik">PERŞEMBE 22 EKİM — ETÜT PLANI<\/h2>/); assert.equal((h.match(/class="et-panel ep-kagit"/g) || []).length, 1);
    assert.match(h, /<td class="ep-hoca">SENTETİK MAT İKİ<\/td><td class="ep-ogr ep-sinif">9\/A<\/td><td class="ep-ogr"><input type="text" data-ep-g="3" data-ep-r="0" data-ep-k="1"/);
    assert.match(h, /<summary>Sınıf dağıtımı · 22 Eki – 6 Kas · 4 sınıf · 1 derste eksik<\/summary>/);
    assert.match(h, /<li class="ep-eksik"><b>BİYOLOJİ<\/b> 1 etüt · alamayan: 9\/A, 9\/B, 11\/A<\/li>/);
    run("EK.epTarih='hepsi'"); h = run('ETUTPLANI.icerik()');
    assert.equal((h.match(/class="et-panel ep-kagit"/g) || []).length, 9);
    assert.match(h, /PAZARTESİ 26 EKİM — ETÜT PLANI[\s\S]*?<td class="ep-hoca">SENTETİK MAT İKİ<\/td><td class="ep-ogr ep-sinif">11\/A<\/td><td class="ep-ogr"><input[^>]*value="Sentetik Bora"/);
    // The teacher view edits the weekdays.
    run("EK.epMod='ogretmen'"); h = run('ETUTPLANI.icerik()'); assert(h.includes('data-ep-gun="hepsi"') && !h.includes('id="epTarih"'));
    // Printed per week, two days to a page.
    run("EK.epMod='ogrenci'");
    const b = run('(()=>{const p=D.etutPlani,d=ETUTPLANI.dagit(p);return ETUTPLANI.baskiHtml(p,d.gunler.map(({g,w})=>({g,w})),d)})()');
    assert.deepEqual(b.split('<section').slice(1).map(x => (x.match(/<h1>([^<]+)<\/h1>/g) || []).map(t => t.slice(4, -18))),
      [['PERŞEMBE 22 EKİM'], ['CUMA 23 EKİM'], ['PAZARTESİ 26 EKİM', 'SALI 27 EKİM'], ['CUMA 30 EKİM'], ['PAZARTESİ 2 KASIM'], ['ÇARŞAMBA 4 KASIM', 'PERŞEMBE 5 KASIM'], ['CUMA 6 KASIM']]);
    assert.match(b, /<td class="ep-hoca">SENTETİK MAT İKİ<\/td><td class="ep-ogr ep-sinif">9\/A<\/td><td class="ep-ogr"><\/td>/);
    // Stored with the plan and checked like it; a viewing teacher sees the sheets without the settings.
    for (const bad of [{bas:'2026-11-06', bit:'2026-10-22', siniflar:['9/A'], yok:[]}, {bas:'2026-10-22', bit:'2027-03-01', siniflar:['9/A'], yok:[]},
      {bas:'2026-10-22', bit:'2026-11-06', siniflar:[], yok:[]}, {bas:'2026-10-22', bit:'2026-11-06', siniflar:['9/A'], yok:['29.10.2026']}]) {
      put('X', bad); assert.throws(() => run('ETUTPLANI.dogrula({...D.etutPlani,donem:X})'), /sınıf dağıtımı/);
    }
    run('yalnizcaGoruntuleme=()=>true'); h = run('ETUTPLANI.icerik()'); assert(!h.includes('id="epDagitim"') && h.includes('id="epTarih"'));
  });
  await check('Ders programları: the school\'s timetable PDF read cell by cell (lesson bold, teacher plain); stored and shown', async () => {
    const H = [[0, 0, 'TARİH', 'SENTETİK TARİHÇİ'], [0, 1, 'TARİH', 'SENTETİK TARİHÇİ'], [1, 2, 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK EDEBİYATÇI'], [2, 5, 'GÖRSEL SANATLAR', 'SENTETİK UZUN RESSAM ADI SOYADI'],
      [2, 6, 'GÖRSEL SANATLAR', 'SENTETİK UZUN RESSAM ADI SOYADI'], [3, 1, 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK DİNCİ'], [4, 4, 'TÜRKÇE', ''], [4, 8, 'MATEMATİK TYT', 'SENTETİK MATÇI']];
    put('S', dersProgrami({kod: '302', sinif: '11/A', hucreler: H}));
    // The double Görsel Sanatlar sits closer than a cell apart in the school's PDF: a bold line after a plain one starts the next cell.
    run("S[0].filter(i=>i.y<500&&i.y>460).forEach(i=>i.y+=3);S2=S");
    const p = get('ETUTPLANI.programCoz(S)');
    assert.deepEqual([p.sinif, p.kod, p.saatler], ['11/A', '302', ['09.00', '09.55', '10.45', '11.35', '12.25', '13.00', '13.50', '14.40', '15.30']]);
    assert.deepEqual(p.dersler, [[0, '09.00', 'TARİH', 'SENTETİK TARİHÇİ'], [0, '09.55', 'TARİH', 'SENTETİK TARİHÇİ'], [1, '10.45', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK EDEBİYATÇI'],
      [2, '13.00', 'GÖRSEL SANATLAR', 'SENTETİK UZUN RESSAM ADI SOYADI'], [2, '13.50', 'GÖRSEL SANATLAR', 'SENTETİK UZUN RESSAM ADI SOYADI'], [3, '09.55', 'DİN KÜLTÜRÜ VE AHLAK BİLGİSİ', 'SENTETİK DİNCİ'],
      [4, '12.25', 'TÜRKÇE', ''], [4, '15.30', 'MATEMATİK TYT', 'SENTETİK MATÇI']]);
    put('S', [[{s:'Merhaba', x:10, y:500, w:30, z:9, f:'D'}]]); assert.throws(() => run('ETUTPLANI.programCoz(S)'), /Haftalık Ders Programı/);
    // Lessons and their branş on the sheet; a teacher matched by name or by initials and surname, never by a guess.
    assert.deepEqual(['MATEMATİK TYT', 'Matematik AYT', 'GEOMETRİ', 'TÜRK DİLİ VE EDEBİYATI', 'TÜRKÇE', 'T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK', 'BEDEN EĞİTİMİ'].map(d => run('ETUTPLANI.dersAilesi(' + JSON.stringify(d) + ')')),
      ['Matematik', 'Matematik', 'Geometri', 'Edebiyat', 'Türkçe', 'Tarih', null]);
    const esle = (a, l) => run('ETUTPLANI.hocaEsle(' + JSON.stringify(a) + ',new Set(' + JSON.stringify(l) + '))');
    assert.equal(esle('Sentetik Bir', ['SENTETİK BİR']), 'SENTETİK BİR');
    assert.equal(esle('S. Yılmazoğlu', ['SENTETİK YILMAZOĞLU', 'BAŞKA ADI']), 'SENTETİK YILMAZOĞLU');
    assert.equal(esle('Ayşe Sentetik', ['AYŞE ORTA SENTETİK']), 'AYŞE ORTA SENTETİK', 'a middle name');
    assert.equal(esle('Ahmet Sentetik', ['MEHMET SENTETİK']), null); assert.equal(esle('A. Sentetik', ['AHMET SENTETİK', 'ALİ SENTETİK']), null, 'two candidates');
    // Stored with the plan, checked like it, and shown as the class's weekly grid.
    await run("ETUTPLANI.degistir(p=>{const r=ETUTPLANI.programCoz(S2);p.programlar={[r.sinif]:{kod:r.kod,ts:1,saatler:r.saatler,dersler:r.dersler}}})");
    assert.deepEqual(get('Object.keys(D.etutPlani.programlar)'), ['11/A']); assert.equal(get('D.etutPlani.programlar["11/A"].dersler').length, 8);
    run("EK.epProgram='11/A'"); const h = run('ETUTPLANI.icerik()');
    assert.match(h, /<td><b>DİN KÜLTÜRÜ VE AHLAK BİLGİSİ<\/b><span>SENTETİK DİNCİ<\/span><\/td>/); assert.match(h, /data-ep-program-sil="11\/A"/);
    run('yalnizcaGoruntuleme=()=>true'); const salt = run('ETUTPLANI.icerik()'); assert(!salt.includes('id="epProgramPdf"') && !salt.includes('data-ep-program-sil'), 'a viewing teacher only reads');
  });
  await check('Sınıf dağıtımı with timetables: own teachers only, the lesson beside the class, more for lessons with more hours, never more for fewer', async () => {
    const MAT = 'Sentetik Matçı', TYT = 'Sentetik Tytci', GEO = 'Sentetik Geometrici', EDB = 'Sentetik Edebiyatçı', FIZ = 'Sentetik Fizikçi', ING = 'Sentetik İngilizceci', ON2 = 'Sentetik Onikici';
    const pr = (kod, sinif, dersler) => { const h = []; let i = 0; for (const [d, hoca, n] of dersler) for (let k = 0; k < n; k++, i++) h.push([i % 5, Math.floor(i / 5), d, hoca]); return dersProgrami({kod, sinif, hucreler: h}); };
    put('P', [pr('302', '11/A', [['MATEMATİK', MAT, 6], ['GEOMETRİ', TYT, 3], ['TÜRKÇE', EDB, 4], ['İNGİLİZCE', ING, 2], ['BEDEN EĞİTİMİ', 'Sentetik Sporcu', 2]]),
      pr('303', '11/B', [['MATEMATİK', MAT, 6], ['FİZİK', FIZ, 5], ['İNGİLİZCE', ING, 3]]), pr('301', '12/A', [['MATEMATİK AYT', ON2, 6]])]);
    // The weekly plan: every teacher every day; the 12th grade teacher has no 9–11 class.
    await yaz([0, 1, 2, 3, 4].map(() => [satir('Matematik', MAT.toLocaleUpperCase('tr-TR')), satir('Matematik', 'S. TYTCİ'), satir('Edebiyat', EDB), satir('Fizik', FIZ), satir('İngilizce', ING), satir('Matematik', ON2)]));
    await run("ETUTPLANI.degistir(p=>{p.programlar={};for(const s of P){const r=ETUTPLANI.programCoz(s);p.programlar[r.sinif]={kod:r.kod,ts:1,saatler:r.saatler,dersler:r.dersler}}})");
    assert.deepEqual(get('ETUTPLANI.sinifOnerisi()'), ['11/A', '11/B'], 'the classes with a timetable, 12th grade left out');
    await run("ETUTPLANI.degistir(p=>{p.donem={bas:'2026-10-26',bit:'2026-11-06',siniflar:['11/A','11/B','10/C'],yok:[],dersler:[]}})");
    const d = get('(()=>{const d=ETUTPLANI.dagit(D.etutPlani);return {mod:d.mod,gunler:d.gunler.length,sinif:[...d.sinif],tablo:d.tablo,programsiz:d.programsiz,eksik:d.eksik}})()');
    assert.equal(d.mod, 'program'); assert.equal(d.gunler, 10); assert.deepEqual(d.programsiz, ['10/C']);
    const ders = c => Object.fromEntries(d.tablo.find(t => t.sinif === c).dersler.map(x => [x.ders, x.etut]));
    // 11/A: Matematik 6 h, Türkçe 4, Geometri 3, İngilizce 2 (Beden Eğitimi has no etüt teacher); 11/B: Matematik 6, Fizik 5, İngilizce 3.
    assert.deepEqual(ders('11/A'), {'MATEMATİK': 5, 'TÜRKÇE': 3, 'GEOMETRİ': 2, 'İNGİLİZCE': 1}, 'per weekly hour never above Matematik (5 of 6)');
    assert.deepEqual(ders('11/B'), {'MATEMATİK': 5, 'FİZİK': 4, 'İNGİLİZCE': 2});
    for (const c of ['11/A', '11/B']) { const l = d.tablo.find(t => t.sinif === c).dersler; for (const a of l) for (const b of l) if (a.saat < b.saat) assert(a.etut / a.saat <= b.etut / b.saat + 1e-9 || a.etut === 1, c + ': ' + a.ders + ' over ' + b.ders); }
    assert.equal(d.eksik, 0, 'every lesson of every class has an etüt');
    // Each teacher's own classes only, the lesson beside the class when it is not the sheet's branş; the 12th grade teacher's rows stay empty.
    const yazilan = new Map(d.sinif), satirlar = get('D.etutPlani.gunler[0]');
    const sutun = i => [...yazilan].filter(([k]) => k.endsWith(':' + i)).map(([, v]) => v);
    assert(sutun(0).every(v => /^11\/[AB]$/.test(v)), 'Matematik: 11/A and 11/B');
    assert(sutun(1).every(v => v === '11/A (GEOMETRİ)'), 'a mathematician who teaches Geometri: ' + sutun(1));
    assert(sutun(2).every(v => v === '11/A (TÜRKÇE)'));
    assert(sutun(3).every(v => v === '11/B') && sutun(4).every(v => /^11\/[AB]$/.test(v)));
    assert.equal(sutun(5).length, 0, 'no 9–11 class: the row stays empty');
    assert.equal(sutun(3).length, 4, 'Fizik takes 4 of its 10 places: no more per hour than Matematik; the rest stay for students');
    // The panel lists each class's lessons; a class without a timetable is named.
    const h = run('ETUTPLANI.icerik()');
    assert.match(h, /<summary>Sınıf dağıtımı · 26 Eki – 6 Kas · 2 sınıf · ders programına göre · tamam<\/summary>/);
    assert.match(h, /<li><b>11\/A<\/b> <span class="ep-tamam" title="Haftada 6 saat">MATEMATİK 5<\/span>/);
    assert.match(h, /Ders programı olmayan: 10\/C/);
    assert.match(h, /<td class="ep-hoca">SENTETİK MATÇI<\/td><td class="ep-ogr ep-sinif">11\/[AB]<\/td>/);
    // The weekly grid of a class.
    run("EK.epProgram='11/A'"); const g = run('ETUTPLANI.icerik()');
    assert.match(g, /<summary>Ders programları · 11\/A, 11\/B, 12\/A<\/summary>/);
    assert.match(g, /<table class="ep-program"><caption>11\/A <span class="mini">\(302\)<\/span><\/caption><thead><tr><th scope="col"><\/th><th scope="col">Pazartesi<\/th>/);
    assert.match(g, /<tr><th scope="row">09\.00<\/th><td><b>MATEMATİK<\/b><span>Sentetik Matçı<\/span><\/td>/);
    // Checked on every write.
    for (const bad of ['{"11-A":{"kod":"","ts":1,"saatler":["09.00"],"dersler":[]}}', '{"11/A":{"kod":"","ts":1,"saatler":["09.00"],"dersler":[[7,"09.00","X",""]]}}', '{"11/A":{"kod":"","ts":1,"saatler":["09.00"],"dersler":[[0,"10.00","X",""]]}}'])
      assert.throws(() => run('ETUTPLANI.dogrula({...D.etutPlani,programlar:' + bad + '})'), /ders programı/);
  });
  await check('Rehberlik, Adab-ı Muaşeret, Fen Bilimleri Uygulamaları and Uygulamalı Deney count as the teacher\'s own lesson', async () => {
    for (const d of ['ADAB-I MUAŞERET', 'Adabı Muaşeret', 'REHBERLİK VE YÖNLENDİRME', 'FEN BİLİMLERİ UYGULAMALARI', 'Fen Bilimi Uygulamaları', 'UYGULAMALI DENEY']) assert(get('ETUTPLANI.araDers(' + JSON.stringify(d) + ')'), d);
    for (const d of ['FİZİK', 'BEDEN EĞİTİMİ', 'TÜRK DİLİ VE EDEBİYATI', 'MATEMATİK TYT']) assert(!get('ETUTPLANI.araDers(' + JSON.stringify(d) + ')'), d);
    const MAT = 'Sentetik Matçı', KIM = 'Sentetik Kimyacı', FIZ = 'Sentetik Fizikçi', TAR = 'Sentetik Tarihçi';
    const pr = (kod, sinif, dersler) => { const h = []; let i = 0; for (const [d, hoca, n] of dersler) for (let k = 0; k < n; k++, i++) h.push([i % 5, Math.floor(i / 5), d, hoca]); return dersProgrami({kod, sinif, hucreler: h}); };
    // 10/A: the chemistry teacher's Fen Bilimleri Uygulamaları, the physics teacher's Rehberlik (no Fizik in 10/A), the
    // mathematician's Uygulamalı Deney and Adab-ı Muaşeret from a history teacher who has no etüts (Tarih in 10/B).
    put('P', [pr('201', '10/A', [['MATEMATİK', MAT, 4], ['KİMYA', KIM, 2], ['FEN BİLİMLERİ UYGULAMALARI', KIM, 2], ['REHBERLİK VE YÖNLENDİRME', FIZ, 1], ['UYGULAMALI DENEY', MAT, 1], ['ADAB-I MUAŞERET', TAR, 1]]),
      pr('202', '10/B', [['TARİH', TAR, 3], ['MATEMATİK', MAT, 2]])]);
    await yaz([0, 1, 2, 3, 4].map(() => [satir('Matematik', MAT), satir('Kimya', KIM), satir('Fizik', FIZ), satir('Tarih', 'Sentetik Tarih İki')]));
    await run("ETUTPLANI.degistir(p=>{p.programlar={};for(const s of P){const r=ETUTPLANI.programCoz(s);p.programlar[r.sinif]={kod:r.kod,ts:1,saatler:r.saatler,dersler:r.dersler}};p.donem={bas:'2026-10-26',bit:'2026-11-06',siniflar:['10/A','10/B'],yok:[],dersler:[]}})");
    const d = get('(()=>{const d=ETUTPLANI.dagit(D.etutPlani);return {sinif:[...d.sinif],tablo:d.tablo}})()');
    const l = d.tablo.find(t => t.sinif === '10/A').dersler, saat = Object.fromEntries(l.map(x => [x.ders, x.saat]));
    assert.deepEqual(saat, {'MATEMATİK': 5, 'KİMYA': 4, 'FİZİK': 1, 'TARİH': 1}, 'hours of the teachers\' own lessons; the history teacher\'s from their timetable');
    assert.deepEqual(l.map(x => [x.ders, x.hoca]).filter(x => !x[1]), [['TARİH', false]], 'the history teacher gives no etüts');
    assert.equal(l.find(x => x.ders === 'FİZİK').etut, 1, 'one hour: one etüt');
    for (const a of l) for (const b of l) if (a.hoca && b.hoca && a.saat < b.saat) assert(a.etut / a.saat <= b.etut / b.saat + 1e-9 || a.etut === 1, a.ders + ' over ' + b.ders);
    const yazilan = d.sinif.map(([, v]) => v);
    assert(yazilan.includes('10/A') && yazilan.every(v => /^10\/[AB]$/.test(v)), 'no lesson beside the class: ' + [...new Set(yazilan)]);
  });
  await check('Sınıf dağıtımı only in the chosen lessons: Matematik, Fizik, Kimya, Biyoloji and Türkçe by default', async () => {
    const MAT = 'Sentetik Matçı', GEO = 'Sentetik Geometrici', EDB = 'Sentetik Edebiyatçı', FIZ = 'Sentetik Fizikçi', COG = 'Sentetik Coğrafyacı';
    const pr = (kod, sinif, dersler) => { const h = []; let i = 0; for (const [d, hoca, n] of dersler) for (let k = 0; k < n; k++, i++) h.push([i % 5, Math.floor(i / 5), d, hoca]); return dersProgrami({kod, sinif, hucreler: h}); };
    // 11/A has Türkçe and Türk Dili ve Edebiyatı; 10/A has only Türk Dili ve Edebiyatı, its Türkçe.
    put('P', [pr('302', '11/A', [['MATEMATİK', MAT, 6], ['GEOMETRİ', GEO, 3], ['TÜRKÇE', EDB, 4], ['TÜRK DİLİ VE EDEBİYATI', EDB, 5], ['FİZİK', FIZ, 4], ['COĞRAFYA', COG, 2]]),
      pr('201', '10/A', [['MATEMATİK', MAT, 5], ['TÜRK DİLİ VE EDEBİYATI', EDB, 5], ['COĞRAFYA', COG, 2]])]);
    await yaz([0, 1, 2, 3, 4].map(() => [satir('Matematik', MAT), satir('Matematik', GEO), satir('Edebiyat', EDB), satir('Fizik', FIZ), satir('Coğrafya', COG)]));
    await run("ETUTPLANI.degistir(p=>{p.programlar={};for(const s of P){const r=ETUTPLANI.programCoz(s);p.programlar[r.sinif]={kod:r.kod,ts:1,saatler:r.saatler,dersler:r.dersler}};p.donem={bas:'2026-11-02',bit:'2026-11-06',siniflar:['10/A','11/A'],yok:[]}})");
    const dagilim = () => get('(()=>{const d=ETUTPLANI.dagit(D.etutPlani);return {gunler:d.gunler.length,sinif:[...d.sinif],tablo:d.tablo,eksik:d.eksik}})()');
    let d = dagilim();
    assert.equal(d.gunler, 5, 'the first week of November');
    const dersler = c => d.tablo.find(t => t.sinif === c).dersler.map(x => x.ders).sort();
    assert.deepEqual(dersler('11/A'), ['FİZİK', 'MATEMATİK', 'TÜRKÇE'], 'no Geometri, Coğrafya or Türk Dili ve Edebiyatı where there is Türkçe');
    assert.deepEqual(dersler('10/A'), ['MATEMATİK', 'TÜRK DİLİ VE EDEBİYATI'], 'Türk Dili ve Edebiyatı is the Türkçe of a class without Türkçe');
    assert.equal(d.eksik, 0);
    const satirSiniflari = i => d.sinif.filter(([k]) => k.endsWith(':' + i)).map(([, v]) => v);
    assert.equal(satirSiniflari(1).length + satirSiniflari(4).length, 0, 'the Geometri and Coğrafya teachers\' rows stay empty');
    assert(satirSiniflari(2).includes('11/A (TÜRKÇE)') && satirSiniflari(2).includes('10/A'), 'Edebiyat row: ' + satirSiniflari(2));
    assert.match(run('ETUTPLANI.icerik()'), /<input type="text" id="epDersler" value="Matematik, Fizik, Kimya, Biyoloji, Türkçe" placeholder="Tüm dersler"/);
    // Chosen by family or name; an empty list is every lesson.
    await run("ETUTPLANI.degistir(p=>{p.donem.dersler=['geometri','Coğrafya']})"); d = dagilim();
    assert.deepEqual(dersler('11/A'), ['COĞRAFYA', 'GEOMETRİ']);
    await run("ETUTPLANI.degistir(p=>{p.donem.dersler=[]})"); d = dagilim();
    assert.deepEqual(dersler('11/A'), ['COĞRAFYA', 'FİZİK', 'GEOMETRİ', 'MATEMATİK', 'TÜRK DİLİ VE EDEBİYATI', 'TÜRKÇE']);
    assert.match(run('ETUTPLANI.icerik()'), /id="epDersler" value=""/);
    // Without timetables the sheet's branşes are chosen the same way: Edebiyat stands for Türkçe when no branş is Türkçe.
    await run("ETUTPLANI.degistir(p=>{delete p.programlar;p.donem.dersler=['Matematik','Türkçe']})");
    const sira = get('(()=>{const d=ETUTPLANI.dagit(D.etutPlani);return d.kapsam.map(x=>x.brans)})()');
    assert.deepEqual(sira, ['Matematik', 'Edebiyat']);
    for (const bad of ['"Matematik"', '[""]', '[' + Array(21).fill('"X"').join(',') + ']', '["' + 'x'.repeat(41) + '"]'])
      assert.throws(() => run("ETUTPLANI.dogrula({...D.etutPlani,donem:{...D.etutPlani.donem,dersler:" + bad + "}})"), /sınıf dağıtımı/);
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
