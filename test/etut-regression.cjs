#!/usr/bin/env node
'use strict';
// Etütler: report parsing, notebook storage and merging, weekly model, statuses, teachers, view
// and privacy. Synthetic data only (test/fixtures/etut-pdf.cjs).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { etutRaporu, GUNLER } = require('./fixtures/etut-pdf.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const dinleyiciler = {};
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(tur,f){(dinleyiciler[tur]=dinleyiciler[tur]||[]).push(f)},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__bg = run('bulutYedekGecmisi'); sandbox.__bga = run('buluttanGunAl');
const reset = () => run(`yalnizcaGoruntuleme=__yg;bulutYedekGecmisi=__bg;buluttanGunAl=__bga;confirm=()=>true;delete window.bulut;D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'Sentetik Ada',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='etutler';
  EK.etAralik=undefined;EK.etTur=undefined;EK.etDers=undefined;EK.etHoca=undefined;EK.etSecA=undefined;EK.etSecB=undefined;EK.etOlcu=undefined;EK.etOgr=undefined;EK.etSira=undefined;EK.etKademe=undefined;EK.etAra='';EK.etSinif='';KAYIT=0;kaydet=async()=>{KAYIT++;return true};ETUT.onbellek.ts=null;`);
const rapor = (gunler = GUNLER, aralik) => { put('pages', etutRaporu(gunler, aralik).pages); return get('ETUT.pdfCoz(pages)'); };
const iso = g => run('isoDan(' + g + ')');
const ekle = async r => { put('R', r); await run('ETUT.raporEkle([R])'); };
const model = () => get('ETUT.model(ETUT.oku().veri)');
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('reads the report: header range, every row, wrapped names, a day that continues on the next page', () => {
    const r = rapor();
    assert.equal(iso(r.bas), '2026-08-16'); assert.equal(iso(r.bit), '2026-10-19'); assert.equal(r.atlanan, 0);
    assert.equal(r.satirlar.length, 36);
    const ilk = r.satirlar[0];
    assert.deepEqual([iso(ilk.g), ilk.brans, ilk.ogretmen, ilk.ad, ilk.sinif, ilk.saat, ilk.sure], ['2026-09-08', 'MATEMATİK TYT', 'SENTETİK ÖĞRETMEN BİR', 'SENTETİK UZUNADLI FERİDE İKİNCİ', '12/A', 880, 20]);
    assert(r.satirlar.some(s => s.ogretmen === 'SENTETİK UZUNADLI ÖĞRETMEN İKİ' && s.brans === 'Geometri'));
    assert.equal(r.satirlar.filter(s => iso(s.g) === '2026-10-13').length, 11, 'rows after the page break keep their day');
    assert.equal(r.satirlar.find(s => s.sure === 40).saat, 920);
  });
  await check('non-report PDFs and reports without rows are refused', () => {
    put('pages', [[{s:'Merhaba',x:10,y:500,w:30,h:9,z:9}]]); assert.throws(() => run('ETUT.pdfCoz(pages)'), /Tarih Bazlı Etüt Raporu/);
    put('pages', etutRaporu([{tarih:'01.10.2026',satirlar:[]}]).pages); assert.throws(() => run('ETUT.pdfCoz(pages)'), /etüt satırı/);
  });
  await check('stores a compact copy; a later report replaces only its own date range', async () => {
    await ekle(rapor()); assert.equal(run('KAYIT'), 1);
    const v = get('D.etut');
    assert.equal(v.surum, 1); assert.equal(v.satir.length, 36); assert.equal(v.kaynak.length, 1); assert.equal(v.kaynak[0].n, 36);
    assert(v.satir.every(s => s.length === 6)); assert.equal(get('ETUT.dogrula(D.etut)').satir.length, 36);
    assert(run('baytBoyu(JSON.stringify(D.etut))') < 6000);
    // The same cumulative report again changes nothing but the source list.
    const once = JSON.stringify(v.satir); await ekle(rapor()); assert.equal(JSON.stringify(get('D.etut.satir')), once); assert.equal(get('D.etut.kaynak').length, 2);
    // A one-day report for 13 Eki holding one class (10/A) replaces that class's etüts of that day only.
    const gun = model().rows.filter(r => iso(r.g) === '2026-10-13'), sinifin = gun.filter(r => r.sinif === '10/A').length;
    assert(gun.length > sinifin, 'other classes have etüts that day');
    await ekle(rapor([{tarih:'13.10.2026',satirlar:[['Türkçe','SENTETİK ÖĞRETMEN BEŞ','SENTETİK EGE','101 10/A','101','15:00','20 Dk.']]}], {bas:'13.10.2026',bit:'13.10.2026'}));
    let s = model(); assert.equal(s.rows.length, 36 - sinifin + 1); assert.equal(s.rows.filter(r => iso(r.g) === '2026-10-13').length, gun.length - sinifin + 1);
    // A report with every class of the day replaces the whole day.
    const siniflar = [...new Set(gun.map(r => r.sinif))];
    await ekle(rapor([{tarih:'13.10.2026',satirlar:siniflar.map(c => ['Türkçe','SENTETİK ÖĞRETMEN BEŞ','SENTETİK EGE','101 '+c,'101','15:00','20 Dk.'])}], {bas:'13.10.2026',bit:'13.10.2026'}));
    s = model(); assert.equal(s.rows.filter(r => iso(r.g) === '2026-10-13').length, siniflar.length); assert.equal(s.rows.length, 36 - gun.length + siniflar.length);
  });
  await check('weekly model: zero weeks, the partial last week, windows, subjects and statuses', async () => {
    await ekle(rapor());
    const m = model();
    assert.deepEqual(m.hafta.map(h => iso(h.p) + ':' + h.etut + (h.kismi ? '*' : '')), ['2026-09-07:3','2026-09-14:2','2026-09-21:7','2026-09-28:5','2026-10-05:6','2026-10-12:11','2026-10-19:2*']);
    assert.deepEqual(m.pencere[2].once.map(iso), ['2026-09-21','2026-09-28']); assert.deepEqual(m.pencere[2].son.map(iso), ['2026-10-05','2026-10-12']);
    assert.equal(m.pencere[4], undefined, 'six full weeks: no 4-week comparison');
    const o = m.ozet[2];
    assert.deepEqual([o.etutOnce,o.etutSon,o.etutFark,o.ogrOnce,o.ogrSon,o.yeni,o.artan,o.azalan], [12,17,5,4,5,1,3,2]);
    const kimya = m.dersler.find(d => d.ders === 'Kimya'); assert.equal(kimya.toplam, 4, 'KİMYA TYT and Kimya are one subject');
    assert.equal(m.dersler[0].ders, 'Matematik'); assert.equal(m.dersler[0].toplam, 12);
    const durum = Object.fromEntries(m.kisiler.map(k => [k.ad.split(' ').pop(), k.k[2].durum + ':' + k.k[2].once + '>' + k.k[2].son]));
    assert.deepEqual(durum, {ADA:'Rising:2>7',BORA:'Falling:5>1',CEM:'Stopped:3>0',DENİZ:'New:0>6',EGE:'Steady:2>2',İKİNCİ:'Returned:0>1'});
    assert.deepEqual(m.kisiler.find(k => k.ad === 'SENTETİK ADA').hafta, [0,1,1,1,3,4,1]);
    assert.equal(m.gun.length, 8); assert.equal(m.gun[m.gun.length - 1].ort5, (6+11+2+5+2)/5);
  });
  await check('the page: sentence, controls, charts and the student table; names are escaped', async () => {
    const r = rapor(); r.satirlar[0].ad = 'SENTETİK <img src=x>'; await ekle(r);
    const h = run('ETUT.icerik()');
    assert.match(h, /Son 2 hafta \(5–18 Eki\): <b>17<\/b> etüt, önceki 2 haftaya göre <b>%42 fazla<\/b>/);
    assert.match(h, /data-et-aralik="4"[^>]* disabled/); assert(h.includes('id="etPdf"')); assert(h.includes('id="etSil"'));
    for (const g of ['genel', 'ders', 'hoca', 'ogrenci', 'kisi']) assert(h.includes('data-et-grafik="' + g + '"'), g);
    assert(!/<img/i.test(h)); assert(/&lt;img src=x&gt;/i.test(h));
    assert.equal((h.match(/<tr data-et-ogr=/g) || []).length, 7);
    assert(h.includes('data-ogr-gor="0"'), 'a student in the notebook opens in student view');
  });
  await check('charts draw from the model with every window and both periods', async () => {
    await ekle(rapor());
    for (const s of [1, 2]) for (const tur of ['hafta', 'gun']) {
      run(`EK.etAralik=${s};EK.etTur='${tur}';EK.etDers=null`);
      const m = 'ETUT.model(ETUT.oku().veri)', st = `{s:${s},tur:'${tur}',ders:null,hoca:null,kim:ETUT.model(ETUT.oku().veri).kisiler[0].kim}`;
      for (const g of ['genel', 'ders', 'hoca', 'ogrenci', 'kisi']) {
        const c = run(`ETUT.GRAFIKLER.${g}(${m},${st},720)`);
        assert(c.svg.startsWith('<svg') && !/NaN|undefined/.test(c.svg), g + ' ' + s + ' ' + tur);
        assert.equal(c.xs.length, c.ipucu.length);
      }
    }
    const f = run(`ETUT.GRAFIKLER.ders(ETUT.model(ETUT.oku().veri),{s:2,tur:'hafta',ders:'Kimya',kim:null},720)`);
    assert.equal((f.svg.match(/class="et-cizgi/g) || []).length, 2, 'one subject: its line and the dashed partial week');
  });
  await check('teachers: each under their main subject, with windows, students and the student card', async () => {
    await ekle(rapor());
    const m = model();
    assert.deepEqual(m.ogretmenler.map(o => o.ad.replace('SENTETİK ', '') + ':' + o.ders + ':' + o.toplam),
      ['ÖĞRETMEN BİR:Matematik:12', 'ÖĞRETMEN ÜÇ:Fizik:8', 'ÖĞRETMEN BEŞ:Türkçe:6', 'UZUNADLI ÖĞRETMEN İKİ:Geometri:4', 'ÖĞRETMEN DÖRT:Kimya:4', 'ÖĞRETMEN ALTI:Biyoloji:2']);
    const bir = m.ogretmenler[0];
    assert.deepEqual([bir.k[2].once, bir.k[2].son, bir.k[2].fark], [3, 6, 3]); assert.equal(bir.ogrenci, 4);
    assert.deepEqual(bir.kisiler.map(k => k.ad.split(' ').pop() + ':' + k.n), ['ADA:4', 'BORA:4', 'DENİZ:2', 'İKİNCİ:2']);
    assert.deepEqual(bir.hafta, [1, 1, 2, 1, 3, 3, 1]);
    assert.equal(m.ogretmenler.find(o => o.ders === 'Kimya').toplam, 4, 'KİMYA TYT and Kimya by one teacher are one card');
    let h = run('ETUT.icerik()');
    assert(h.includes('id="etOgretmenler"')); assert.equal((h.match(/class="et-ders et-hoca-kart"/g) || []).length, 6);
    assert(h.includes('data-et-grafik="hoca"') && h.includes('Öğretmenlere göre etüt'));
    assert(h.indexOf('id="etDersler"') < h.indexOf('id="etOgretmenler"') && h.indexOf('id="etOgretmenler"') < h.indexOf('id="etOgrenciler"'));
    run(`EK.etHoca=${JSON.stringify(bir.hoca)};EK.etOgr=${JSON.stringify(m.kisiler.find(k => k.ad === 'SENTETİK ADA').kim)}`);
    h = run('ETUT.icerik()');
    assert.match(h, /Sentetik Öğretmen Bir etütleri · haftalık/); assert(h.includes('data-et-hoca=""'), 'Tüm öğretmenler');
    assert.equal((h.match(/<div class="et-hoca-liste">[\s\S]*?<\/div><\/section>/)[0].match(/data-et-ogr=/g) || []).length, 4);
    assert.match(h, /Öğretmenlere göre<\/span><div class="et-cubuklar hoca">[\s\S]*Sentetik Öğretmen Bir[\s\S]*Sentetik Uzunadlı Öğretmen İki/);
    const st = `{s:2,tur:'hafta',ders:null,hoca:${JSON.stringify(bir.hoca)},kim:null}`, mm = 'ETUT.model(ETUT.oku().veri)';
    const tek = run(`ETUT.GRAFIKLER.hoca(${mm},${st},720)`);
    assert.equal((tek.svg.match(/class="et-cizgi/g) || []).length, 2, 'one teacher: their line and the dashed partial week');
    const hep = run(`ETUT.GRAFIKLER.hoca(${mm},{s:2,tur:'gun',ders:null,hoca:null,kim:null},720)`);
    assert(!/NaN|undefined/.test(hep.svg)); assert.equal(hep.xs.length, hep.ipucu.length);
    assert(hep.ipucu.every(p => p.satir.every(r => r[2] !== '0')), 'the readout leaves out teachers with no etüt that day');
  });
  await check('places by etüt count in each window: shared places, climbs and falls; the table, cards and teachers\' ranking', async () => {
    await ekle(rapor());
    const m = model(), yer = Object.fromEntries(m.kisiler.map(k => [k.ad.split(' ').pop(), [k.k[2].onceSira, k.k[2].sonSira, k.k[2].siraFark]]));
    assert.deepEqual(yer, { ADA: [3, 1, 2], BORA: [1, 4, -3], CEM: [2, null, null], DENİZ: [null, 2, null], EGE: [3, 3, 0], İKİNCİ: [null, 4, null] });
    assert(m.ogretmenler.every(o => o.k[2].siraFark === (o.k[2].onceSira !== null && o.k[2].sonSira !== null ? o.k[2].onceSira - o.k[2].sonSira : null)));
    assert.equal(m.ogretmenler[0].k[2].sonSira, 1, 'Sentetik Öğretmen Bir is the fullest in the last two weeks');
    let h = run('ETUT.icerik()');
    assert(h.includes('<h2>Sıralama · doluluk</h2>'), 'with no teacher chosen, the teachers ranked beside the chart');
    const liste = h.match(/<h2>Sıralama · doluluk<\/h2>[\s\S]*?<\/section>/)[0], sira = [...liste.matchAll(/class="et-sira-no">([^<]+)</g)].map(x => x[1]);
    assert.deepEqual(sira, sira.slice().sort((a, b) => (a === '—' ? 1e9 : +a) - (b === '—' ? 1e9 : +b)), 'in place order');
    assert(h.includes('data-et-sira="sira"'), 'the table has a Sıra column');
    assert.match(h, /data-et-ogr="SENTETİK ADA\|12\/A"[\s\S]*?<td class="sayi">1<span class="et-sira-ok yukari" role="img" aria-label="2 sıra yükseldi">▲2<\/span><\/td>/);
    assert.match(h, /data-et-ogr="SENTETİK BORA\|12\/B"[\s\S]*?<td class="sayi">4<span class="et-sira-ok asagi" role="img" aria-label="3 sıra düştü">▼3<\/span><\/td>/);
    assert.match(h, /class="et-ders et-hoca-kart"[\s\S]*?<span class="mini">1\. sıra<\/span>/, 'teacher cards carry their place');
    run("EK.etSira='sira';EK.etSiraYon='artan'"); h = run('ETUT.icerik()');
    assert.deepEqual([...h.matchAll(/<tr data-et-ogr="SENTETİK ([^ |]+)/g)].map(x => x[1]).slice(0, 3), ['ADA', 'DENİZ', 'EGE'], 'sorting by place');
  });
  await check('Seç: any two full weeks compared week to week, with lines on the chart and lists of weeks', async () => {
    await ekle(rapor()); run("EK.etAralik='sec'");
    const gun = t => run('gunNo("' + t + '")'), m = () => get('ETUT.model(ETUT.oku().veri,{a:EK.etSecA,b:EK.etSecB})');
    let w = m().pencere.sec; assert.deepEqual([w.once.map(iso), w.son.map(iso)], [['2026-09-14', '2026-09-14'], ['2026-10-12', '2026-10-12']], 'by default the last full week and four weeks before it');
    let h = run('ETUT.icerik()');
    assert.match(h, /data-et-aralik="sec" aria-pressed="true"/);
    assert.match(h, /12 Eki haftası: <b>11<\/b> etüt, 14 Eyl haftasına göre <b>%450 fazla<\/b> \(2 → 11\)\./);
    assert(h.includes('<select id="etSecA"') && h.includes('<select id="etSecB"')); assert.match(h, /<option value="\d+" selected>14 Eyl haftası<\/option>/);
    assert(!/<option[^>]*>19 Eki haftası/.test(h), 'the partial week cannot be chosen');
    assert(h.includes('<th scope="col" aria-sort="none"><button type="button" data-et-sira="son">12 Eki haftası</button></th>'));
    // The chosen weeks: a student's change and status follow them; the order of the two does not matter.
    run(`EK.etSecA=${gun('2026-10-12')};EK.etSecB=${gun('2026-09-07')};ETUT.onbellek.ts=null`);
    w = m().pencere.sec; assert.deepEqual([iso(w.once[0]), iso(w.son[0])], ['2026-09-07', '2026-10-12']);
    const ada = m().kisiler.find(k => k.ad === 'SENTETİK ADA').k.sec; assert.deepEqual([ada.once, ada.son, ada.durum], [0, 4, 'New'], 'her first etüt came after the Önceki week');
    const g = run(`(()=>{const v=ETUT.oku().veri,mm=ETUT.model(v,{a:EK.etSecA,b:EK.etSecB});return ETUT.GRAFIKLER.genel(mm,{s:'sec',tur:'hafta',ders:null,hoca:null,kim:null},720)})()`);
    assert(g.tutamak && /data-tutamak="once"/.test(g.svg) && /data-tutamak="son"/.test(g.svg), 'two lines with handles');
    assert(!/<text class="et-bant-yazi"/.test(g.svg), 'the handles name the weeks');
    const gg = run(`(()=>{const v=ETUT.oku().veri,mm=ETUT.model(v,{a:EK.etSecA,b:EK.etSecB});return ETUT.GRAFIKLER.genel(mm,{s:'sec',tur:'gun',ders:null,hoca:null,kim:null},720)})()`);
    assert(!gg.tutamak, 'the daily chart shows the weeks as bands; the lists choose them');
  });
  await check('charts with many lines: each line can take the stage; a chosen subject or teacher is one line', async () => {
    await ekle(rapor());
    const mm = 'ETUT.model(ETUT.oku().veri)', st = x => `{s:2,tur:'hafta',ders:${x.ders || null},hoca:${x.hoca || null},kim:null}`;
    const d = run(`ETUT.GRAFIKLER.ders(${mm},${st({})},720)`);
    assert.equal(d.seriler.length, 6); assert.equal((d.svg.match(/data-seri="0"/g) || []).length, 2, 'a line and its dashed partial week');
    assert.equal(d.seriIpucu(0, 1).satir[0][4], true, 'the readout leads with that line'); assert.equal(d.seriNokta(0, 1).length, 1);
    assert.equal(run(`ETUT.GRAFIKLER.ders(${mm},${st({ders:"'Kimya'"})},720).seriler`), undefined);
    const hoca = run(`ETUT.GRAFIKLER.hoca(${mm},${st({})},720)`);assert.equal(hoca.seriler.length, 6); assert(hoca.seriler.every(x => x.k.startsWith('SENTETİK')));
  });
  await check('many teachers on one day: the readout lists the busiest and counts the rest', async () => {
    const satirlar = Array.from({ length: 12 }, (_, i) => ['Matematik', 'SENTETİK HOCA ' + String(i + 1).padStart(2, '0'), 'SENTETİK EGE', '101 10/A', '101', '15:00', '20 Dk.']);
    await ekle(rapor([{ tarih: '13.10.2026', satirlar }], { bas: '13.10.2026', bit: '13.10.2026' }));
    const g = get(`ETUT.GRAFIKLER.hoca(ETUT.model(ETUT.oku().veri),{s:2,tur:'gun',ders:null,hoca:null,kim:null},720)`);
    const p = g.ipucu[0].satir; assert.equal(p.length, 10); assert.deepEqual(p[9].slice(1), ['+3 öğretmen', '3']);
  });
  await check('teachers\' etüt days: from the report as the schedule changes, or the Etüt planı; other days are passed over and doluluk ranks them', async () => {
    await ekle(rapor());
    let m = model();
    const kim = ad => m.ogretmenler.find(o => o.ad === 'SENTETİK ÖĞRETMEN ' + ad), bir = kim('BİR'), bes = kim('BEŞ'), dort = kim('DÖRT'), alti = kim('ALTI');
    // No plan: the weekdays of their etüts in the last four weeks (BİR: Monday 19 Eki and Tuesdays).
    assert.deepEqual([bir.gunleri, bir.kaynak, bes.gunleri], [[0, 1], 'rapor', [1]]);
    assert.deepEqual(bir.kapHafta, [4, 4, 4, 4, 4, 4, 4], 'four places on each of their days that had etüts');
    assert.deepEqual([bir.k[2].kapOnce, bir.k[2].kapSon, bir.k[2].dolOnce, bir.k[2].dolSon], [8, 8, 0.375, 0.75]);
    // BEŞ gives etüts on Tuesdays only: Thursday 24 Eyl and Monday 19 Eki are not theirs.
    const gun = m.gun.map(x => iso(x.p)), i24 = gun.indexOf('2026-09-24'), i19 = gun.indexOf('2026-10-19');
    assert.deepEqual([bes.gunG[i24], bes.gunG[i19], bes.gun[i24]], [null, null, 0]); assert.equal(bes.haftaG[6], null, 'the partial week has no Tuesday yet');
    // Days follow the schedule: a weekday is theirs only next to a week they held etüts on it.
    assert.deepEqual(dort.haftaG, [null, 0, 1, 1, 1, 1, null], 'DÖRT starts on 22 Eyl: 7 Eyl is not theirs, 14 Eyl is an empty Tuesday');
    assert.deepEqual(alti.haftaG, [null, null, 1, null, 0, 1, null], 'ALTI: Thursday 24 Eyl, Tuesdays 6 and 13 Eki');
    assert.deepEqual(m.ogretmenler.map(o => [o.k[2].sonSira, o.k[2].siraFark]), [[1, 0], [2, 0], [2, 0], [4, 2], [4, -2], [6, -4]], 'places by doluluk');
    assert.deepEqual([dort.k[2].onceSira, dort.k[2].sonSira], [2, 4]);
    let h = run('ETUT.icerik()');
    assert.match(h, /data-et-hoca="SENTETİK ÖĞRETMEN BİR"[\s\S]*?<span class="mini">%75 dolu<\/span><span class="mini">1\. sıra<\/span>/);
    const liste = h.match(/<h2>Sıralama · doluluk<\/h2>[\s\S]*?<\/section>/)[0];
    assert.match(liste, /Sentetik Öğretmen Bir<\/span><span class="mini">Matematik · 6\/8 etüt · önceki: %38<\/span><\/span><b>%75<\/b>/);
    const st = (hoca, tur) => `{s:2,tur:'${tur}',ders:null,hoca:${JSON.stringify(hoca)},kim:null}`, mm = 'ETUT.model(ETUT.oku().veri)';
    const tek = get(`ETUT.GRAFIKLER.hoca(${mm},${st(bes.hoca, 'gun')},720)`);
    assert(!/NaN|undefined/.test(tek.svg)); assert.deepEqual(tek.ipucu[i24].satir, [[null, 'Etüt günü değil', '']]);
    assert.deepEqual(tek.ipucu[gun.indexOf('2026-10-13')].satir.slice(-1), [[null, 'Doluluk', '%50 · 2/4']]);
    const hep = get(`ETUT.GRAFIKLER.hoca(${mm},${st(null, 'gun')},720)`);
    assert(!/NaN|undefined/.test(hep.svg)); assert.equal(hep.seriler[m.ogretmenler.indexOf(bes)].pts[i24], null, 'no point on a day that is not theirs');
    run(`EK.etHoca=${JSON.stringify(bir.hoca)}`); assert.match(run('ETUT.icerik()'), /id="etHocaGun">Etüt günleri: Pazartesi, Salı · etüt raporundan</);
    // The Etüt planı puts BİR on Tuesdays and Thursdays: Thursday 24 Eyl adds four places.
    run("D.etutPlani={surum:1,ts:7,gunler:[[],[['Matematik','Sentetik Öğretmen Bir',['','','','']]],[],[['Matematik','sentetik öğretmen bir',['','','','']]],[]]}");
    m = get('ETUT.icerik()&&ETUT.onbellek.m'); const p = m.ogretmenler.find(o => o.ad === 'SENTETİK ÖĞRETMEN BİR');
    assert.deepEqual([p.gunleri, p.kaynak, p.kapHafta[2], p.k[2].kapOnce, p.k[2].dolOnce], [[1, 3], 'plan', 8, 12, 0.25]);
    assert.equal(m.ogretmenler.find(o => o.ad === 'SENTETİK ÖĞRETMEN BEŞ').kaynak, 'rapor', 'teachers not in the plan keep the report');
    assert.match(run('ETUT.icerik()'), /Etüt günleri: Salı, Perşembe · Etüt planından/);
  });
  await check('Sınıf: one grade at a time; 12. sınıflar have no Friday etüt days from 14 Eyl, other grades keep them', async () => {
    const cuma = (tarih, ...kisiler) => ({tarih, satirlar:kisiler.map(([ad, sube], i) => ['Türkçe', 'SENTETİK ÖĞRETMEN BEŞ', ad, sube, '101', (15 + i) + ':00', '20 Dk.'])});
    // Friday 11 Eyl (before the rule) for 12/A, Friday 25 Eyl for 11/A only, Friday 2 Eki for 12/A (a row against the rule stays).
    await ekle(rapor(GUNLER.concat([cuma('11.09.2026', ['SENTETİK ADA', '301 12/A']), cuma('25.09.2026', ['SENTETİK DENİZ', '302 11/A']), cuma('02.10.2026', ['SENTETİK ADA', '301 12/A'])])));
    run("D.etutPlani={surum:1,ts:3,gunler:[[],[['Türkçe','Sentetik Öğretmen Beş',['','','','']]],[],[],[['Türkçe','Sentetik Öğretmen Beş',['','','','']]]]}");
    const gunler = () => get('ETUT.icerik()&&ETUT.onbellek.m.gun.map(x=>x.p)').map(iso);
    assert(gunler().includes('2026-09-25') && gunler().includes('2026-09-11'), 'all grades: every etüt day');
    let h = run('ETUT.icerik()');
    assert.match(h, /<select id="etKademe" aria-label="Sınıf"><option value="">Tüm sınıflar<\/option><option value="12">12\. sınıflar<\/option><option value="11">11\. sınıflar<\/option><option value="10">10\. sınıflar<\/option><\/select>/);
    run('EK.etKademe=12');
    const g12 = gunler();
    assert(!g12.includes('2026-09-25'), 'no Friday after 14 Eyl for 12. sınıflar');
    assert(g12.includes('2026-09-11') && g12.includes('2026-10-02'), 'Friday 11 Eyl (before the rule) and a 12/A etüt on a Friday stay');
    assert(g12.includes('2026-10-13'), 'days with other grades\' etüts stay');
    const m = get('ETUT.onbellek.m');
    assert(m.kisiler.every(k => /^12\//.test(k.sinif)) && m.kisiler.length === 4); assert.equal(m.kademe, 12);
    const bes = m.ogretmenler.find(o => o.ad === 'SENTETİK ÖĞRETMEN BEŞ'), w = m.haftalar.indexOf(get('gunNo("2026-09-21")'));
    assert.deepEqual([bes.gunleri, bes.kapHafta[w]], [[1], 4], 'BEŞ\'s Friday is not a 12. sınıf day');
    h = run('ETUT.icerik()');
    assert.match(h, /<p class="et-cumle">12\. sınıflar · Son 2 hafta/); assert.match(h, /<option value="12" selected>/);
    run('EK.etKademe=11'); assert(gunler().includes('2026-09-25'), '11. sınıflar keep Fridays');
    const m11 = get('ETUT.onbellek.m'), bes11 = m11.ogretmenler.find(o => o.ad === 'SENTETİK ÖĞRETMEN BEŞ');
    assert.deepEqual([bes11.gunleri, bes11.kapHafta[m11.haftalar.indexOf(get('gunNo("2026-09-21")'))]], [[1, 4], 8]);
    run('EK.etKademe=9'); assert.equal(get('ETUT.icerik()&&ETUT.onbellek.m.kademe'), null, 'a grade not in the report shows everyone');
    run('EK.etKademe=12'); assert.equal(get('ETUT.planIcin()').ogrenciler.length, 6, 'Etüt planı still gets every student');
  });
  await check('drag to measure: every time chart and weekly mini graph says what it measures; Çizgi is on the page', async () => {
    await ekle(rapor());
    const mm = 'ETUT.model(ETUT.oku().veri)', st = (tur, ders = null, hoca = null) => `{s:2,tur:'${tur}',ders:${JSON.stringify(ders)},hoca:${JSON.stringify(hoca)},kim:'SENTETİK ADA|12/A'}`;
    const m = model(), olc = (g, s) => get(`ETUT.GRAFIKLER.${g}(${mm},${s},720).olc`);
    const genel = olc('genel', st('hafta'));
    assert.deepEqual([genel.donem, genel.uzunluk, genel.birim, genel.ana.v], [m.haftalar, 7, 'etüt', m.hafta.map(h => h.etut)]);
    assert.deepEqual([olc('genel', st('gun')).uzunluk, olc('genel', st('gun')).donem], [1, m.gun.map(x => x.p)]);
    const ders = olc('ders', st('hafta'));
    assert.equal(ders.seriler.length, m.dersler.length); assert.equal(ders.ana.ad, 'Tüm dersler'); assert.deepEqual(ders.ana.v, m.hafta.map(h => h.etut));
    assert.deepEqual(olc('ders', st('hafta', 'Fizik')).ana.v, m.dersler.find(d => d.ders === 'Fizik').hafta, 'a chosen subject is its own line');
    assert.equal(olc('hoca', st('hafta')).ana.ad, 'Tüm öğretmenler');
    assert.deepEqual([olc('ogrenci', st('hafta')).birim, olc('kisi', st('gun')).uzunluk], ['öğrenci', 7], 'the student card stays weekly');
    const h = run('ETUT.icerik()'), hafta = m.haftalar.join(',');
    assert.equal((h.match(new RegExp('data-olc-donem="' + hafta + '" data-olc-uzunluk="7"', 'g')) || []).length, m.dersler.length + m.ogretmenler.length + m.kisiler.length, 'cards and the table');
    assert.match(h, /data-et-cizgi="kose" aria-pressed="true"/); assert.match(h, /data-et-cizgi="yumusak" aria-pressed="false"/);
    run("GRAFIK_CIZGI.sec('yumusak')"); assert.match(run(`ETUT.GRAFIKLER.genel(${mm},${st('hafta')},720).svg`), /class="et-cizgi" d="M[^"]*C/); run("GRAFIK_CIZGI.sec('kose')");
  });
  await check('Etüt / Doluluk on the teachers\' chart: doluluk = etüts ÷ places, null (the line passes over) where there are no places; the toggle, titles and axis', async () => {
    // Seven full weeks from Mon 31 Ağu. A is at school every weekday (one etüt a day, two on Mondays: 6 of 20 places a week).
    // B gives etüts on Tuesdays of the 1st, 2nd, 6th and 7th weeks only: the 3rd and 5th weeks' Tuesdays are next to a
    // Tuesday with etüts (open, empty), the 4th week's is not (no places).
    const tarih = (hafta, gun) => { const d = new Date(Date.UTC(2026, 7, 31 + hafta * 7 + gun)); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear(); };
    let n = 0; const sat = (hoca, brans) => ['' + brans, 'SENTETİK ÖĞRETMEN ' + hoca, 'SENTETİK ÖĞRENCİ ' + (++n), (100 + n) + ' 10/A', '101', '15:00', '20 Dk.'];
    const bEtut = [1, 2, 0, 0, 0, 3, 5], gunler = [];
    for (let w = 0; w < 7; w++) for (let g = 0; g < 5; g++) {
      const satirlar = [sat('A', 'Türkçe')]; if (g === 0) satirlar.push(sat('A', 'Türkçe'));
      if (g === 1) for (let k = 0; k < bEtut[w]; k++) satirlar.push(sat('B', 'Tarih'));
      gunler.push({ tarih: tarih(w, g), satirlar });
    }
    await ekle(rapor(gunler, { bas: '31.08.2026', bit: '16.10.2026' }));
    const m = model(), A = m.ogretmenler.find(o => o.ad.endsWith(' A')), B = m.ogretmenler.find(o => o.ad.endsWith(' B'));
    assert.deepEqual(A.kapHafta, [20, 20, 20, 20, 20, 20, 20]); assert.deepEqual(B.kapHafta, [4, 4, 4, 0, 4, 4, 4], 'B: no places in the 4th week');
    const mm = 'ETUT.model(ETUT.oku().veri)', st = (olcu, tur = 'hafta', hoca = null) => `{s:2,tur:'${tur}',olcu:${JSON.stringify(olcu)},ders:null,hoca:${JSON.stringify(hoca)},kim:null}`;
    const seri = (olcu, tur) => get(`ETUT.hocaSeri(${mm},${st(olcu, tur)})`), bul = (l, o) => l[m.ogretmenler.indexOf(o)];
    // Doluluk by week: count ÷ places where there are places, null where there are none (not 0).
    const hd = seri('doluluk', 'hafta');
    assert.deepEqual(bul(hd, A).v, [6, 6, 6, 6, 6, 6, 6].map(x => x / 20));
    assert.deepEqual(bul(hd, B).v, [0.25, 0.5, 0, null, 0, 0.75, 1.25], 'null in the week with no places, 0 in an open empty week; over 100 % is kept');
    assert.deepEqual(bul(hd, B).say, B.haftaG); assert.deepEqual(bul(hd, B).kap, B.kapHafta);
    // By day: etüts ÷ places on the days that are theirs, null on the others.
    const gd = bul(seri('doluluk', 'gun'), B);
    gd.v.forEach((v, i) => assert.equal(v, B.kapGun[i] > 0 ? B.gunG[i] / B.kapGun[i] : null)); assert(gd.v.includes(null) && gd.v.some(v => v === 1.25));
    // The count mode is what it was.
    assert.deepEqual(bul(seri('etut', 'hafta'), B).v, B.haftaG); assert.deepEqual(bul(get(`ETUT.hocaSeri(${mm},{s:2,tur:'gun',ders:null,hoca:null,kim:null})`), B).v, B.gunG);
    // The chart: percent ticks, readout "%63 · 10/16" style, ranked by the share, measuring off; counts keep measuring.
    const ciz = (olcu, tur = 'hafta', hoca = null) => run(`ETUT.GRAFIKLER.hoca(${mm},${st(olcu, tur, hoca)},720)`);
    const g = ciz('doluluk'), say = ciz('etut');
    const tikler = s => [...s.matchAll(/class="et-tik"[^>]*dy="0.32em">([^<]*)</g)].map(x => x[1]);
    assert.deepEqual(tikler(g.svg), ['%0', '%50', '%100', '%150'], 'over 100 % extends the axis'); assert(!/NaN|undefined/.test(g.svg));
    assert(!tikler(say.svg).some(t => t.includes('%'))); assert(say.olc && !g.olc, 'measuring is off in doluluk mode only');
    const bi = m.ogretmenler.indexOf(B), ai = m.ogretmenler.indexOf(A), yolB = g.svg.match(new RegExp('data-seri="' + bi + '" style="[^"]*" d="([^"]*)"'))[1];
    assert.equal((yolB.match(/M/g) || []).length, 1, 'B\'s line is one piece: it passes over the week with no places'); assert.equal(g.seriler[bi].pts[3], null); assert.equal(g.seriler[ai].pts[3] === null, false);
    const duz = x => JSON.parse(JSON.stringify(x)), satir = i => g.ipucu[i].satir.map(r => r.slice(1, 3).join('=')), adB = 'Sentetik Öğretmen B', adA = 'Sentetik Öğretmen A';
    assert.deepEqual(duz(satir(6)), [adB + '=%125 · 5/4', adA + '=%30 · 6/20'], 'ranked by the shown value');
    assert.deepEqual(duz(satir(3)), [adA + '=%30 · 6/20'], 'B is not in the readout in a week with no places'); assert.deepEqual(duz(satir(1)), [adB + '=%50 · 2/4', adA + '=%30 · 6/20']);
    assert.deepEqual(duz(g.seriIpucu(bi, 5).satir[0].slice(1, 3)), [adB, '%75 · 3/4']); assert.deepEqual(duz(g.seriIpucu(bi, 3).satir[0].slice(1, 3)), [adB, '—']);
    assert.deepEqual(duz(say.ipucu[6].satir.map(r => r.slice(1, 3).join('='))), [adA + '=6', adB + '=5'], 'counts are unchanged');
    // One teacher: a single line with area, in percent; the day that is not theirs says so.
    const tek = ciz('doluluk', 'hafta', B.hoca); assert.deepEqual(tikler(tek.svg), ['%0', '%50', '%100', '%150']);
    assert.deepEqual(duz(tek.ipucu[6].satir.map(r => r.slice(1, 3).join('='))), [adB + '=%125 · 5/4']); assert.deepEqual(duz(tek.ipucu[3].satir), [[null, 'Etüt günü değil', '']]);
    assert.deepEqual(duz(ciz('doluluk', 'hafta', A.hoca).ipucu[0].satir.map(r => r.slice(1, 3).join('='))), [adA + '=%30 · 6/20']);
    // The toggle: the click handler stores EK.etOlcu and the view follows (title, aria-label, pressed button).
    nodes.etKok = node(); const tikla = async dugme => { const el = { dataset: { etOlcu: dugme }, disabled: false, closest: () => null }; for (const f of dinleyiciler.click) await f({ target: { closest: q => /data-et-olcu/.test(q) ? el : null } }); };
    assert.equal(run('EK.etOlcu'), undefined); let h = run('ETUT.icerik()');
    assert(h.includes('Öğretmenlere göre etüt · haftalık') && !h.includes('doluluk yüzdesi') && !h.includes('id="etHocaDol"'));
    assert(h.includes('data-et-olcu="etut" aria-pressed="true"') && h.includes('data-et-olcu="doluluk" aria-pressed="false"') && h.includes('<span class="et-seg-label">Göster</span>'));
    await tikla('doluluk'); assert.equal(run('EK.etOlcu'), 'doluluk'); h = nodes.etKok.innerHTML;
    assert(h.includes('<h2>Öğretmenlere göre doluluk · haftalık</h2>') && h.includes('aria-label="Öğretmen doluluk yüzdesi (haftalık)"') && h.includes('data-et-olcu="doluluk" aria-pressed="true"'));
    assert.match(h, /id="etHocaDol">Doluluk = etüt ÷ öğretmenin etüt günlerindeki yer/); assert(h.includes('<h2>Sıralama · doluluk</h2>'), 'the ranking list is as it was');
    await tikla('doluluk'); assert.equal(run('EK.etOlcu'), 'doluluk', 'pressing the chosen button keeps it');
    run('EK.etTur="gun"'); assert(run('ETUT.icerik()').includes('<h2>Öğretmenlere göre doluluk · günlük</h2>')); run('EK.etTur=undefined');
    run(`EK.etHoca=${JSON.stringify(B.hoca)}`); h = run('ETUT.icerik()');
    assert(h.includes('<h2>Sentetik Öğretmen B doluluk · haftalık</h2>') && h.includes('data-et-hoca=""') && h.includes('aria-label="Sentetik Öğretmen B doluluk yüzdesi (haftalık)"'));
    await tikla('etut'); assert.equal(run('EK.etOlcu'), 'etut'); h = nodes.etKok.innerHTML;
    assert(h.includes('<h2>Sentetik Öğretmen B etütleri · haftalık</h2>') && h.includes('etüt sayısı (haftalık)') && !h.includes('doluluk yüzdesi'));
    await tikla('bozuk'); assert.equal(run('EK.etOlcu'), 'etut', 'an unknown value falls back to Etüt');
    delete nodes.etKok;
  });
  await check('Etüt planı gets each weekday\'s teachers of the last four weeks and the report\'s names', async () => {
    run('ETUT.onbellek.ts=null'); assert.equal(run('ETUT.planIcin()'), null);
    await ekle(rapor());
    const p = get('ETUT.planIcin()');
    assert.deepEqual(p.gunler[0], [{ brans: 'Matematik', ogretmen: 'Sentetik Öğretmen Bir' }, { brans: 'Fizik', ogretmen: 'Sentetik Öğretmen Üç' }]);
    assert.deepEqual(p.gunler[1].map(o => o.ogretmen.replace('Sentetik ', '')), ['Öğretmen Bir', 'Öğretmen Üç', 'Öğretmen Beş', 'Öğretmen Dört', 'Uzunadlı Öğretmen İki', 'Öğretmen Altı']);
    assert.deepEqual(p.gunler[3].map(o => o.brans), ['Biyoloji', 'Fizik']); assert.deepEqual([p.gunler[2], p.gunler[4]], [[], []]);
    assert.equal(p.ogretmenler.length, 6); assert(p.ogrenciler.some(o => o.ad === 'Sentetik Ada' && o.sinif === '12/A'));
  });
  await check('an empty notebook takes its etüt rows back from the newest cloud copy that has them; nothing else changes', async () => {
    await ekle(rapor()); const etut = get('D.etut'); run("delete D.etut;KAYIT=0;ETUT.onbellek.ts=null;D.ogr[0].ad='Değişmeyen Ada'");
    assert(!run('ETUT.icerik()').includes('etGeriGetir'), 'not signed in to the cloud: no button');
    run("window.bulut={yapilandirilmis:true,mevcutKullanici:()=>({uid:'u1',isAnonymous:false})}");
    assert(run('ETUT.icerik()').includes('id="etGeriGetir"'));
    put('YEDEK', { ogr: [], ayar: {}, etut });
    run(`__okunan=[];bulutYedekGecmisi=async()=>({tur:'tamam',liste:['2026-10-20','2026-10-19','2026-10-18','2026-10-17'].map(gun=>({gun}))});
      buluttanGunAl=async gun=>{__okunan.push(gun);return {tur:'tamam',yedek:gun==='2026-10-20'?{ogr:[],ayar:{}}:gun==='2026-10-19'?{ogr:[],ayar:{},etut:{surum:9}}:YEDEK}}`);
    assert.match(await run('ETUT.yedektenGetir()'), /Geri getirildi: 36 etüt \(18 Eki 2026 yedeğinden\)/);
    assert.deepEqual(get('__okunan'), ['2026-10-20', '2026-10-19', '2026-10-18'], 'newest first, past copies without or with unreadable rows');
    assert.equal(JSON.stringify(get('D.etut.satir')), JSON.stringify(etut.satir)); assert.equal(run('D.ogr[0].ad'), 'Değişmeyen Ada'); assert.equal(run('KAYIT'), 1);
    assert(!run('ETUT.icerik()').includes('etGeriGetir')); await assert.rejects(run('ETUT.yedektenGetir()'), /zaten etüt verisi/);
    run("delete D.etut;ETUT.onbellek.ts=null;buluttanGunAl=async()=>({tur:'tamam',yedek:{ogr:[],ayar:{}}})");
    assert.match(await run('ETUT.yedektenGetir()'), /Bulut yedeklerinde etüt verisi yok/); assert.equal(run('D.etut'), undefined);
    run('buluttanGunAl=async()=>({tur:"tamam",yedek:YEDEK});confirm=()=>false'); assert.match(await run('ETUT.yedektenGetir()'), /Geri getirilmedi/); assert.equal(run('D.etut'), undefined);
    run("bulutYedekGecmisi=async()=>({tur:'hata',mesaj:'izin yok'})"); await assert.rejects(run('ETUT.yedektenGetir()'), /izin yok/);
    run('confirm=()=>true;yalnizcaGoruntuleme=()=>true'); assert(!run('ETUT.icerik()').includes('etGeriGetir')); await assert.rejects(run('ETUT.yedektenGetir()'), /Yalnızca rehber/);
    assert.equal(run('KAYIT'), 1, 'only the restore saved');
  });
  await check('a viewing teacher sees the board without import or delete; nothing is saved', async () => {
    await ekle(rapor()); run('KAYIT=0;yalnizcaGoruntuleme=()=>true');
    const h = run('ETUT.icerik()'); assert(!h.includes('id="etPdf"') && !h.includes('id="etSil"'));
    await assert.rejects(run('ETUT.raporEkle([])'), /Yalnızca rehber/); await assert.rejects(run('ETUT.sil()'), /Yalnızca rehber/);
    assert.equal(run('KAYIT'), 0);
  });
  await check('unreadable stored data is shown, never overwritten; limits and failed saves keep the old data', async () => {
    run("D.etut={surum:9}"); assert.match(run('ETUT.icerik()'), /Kayıtlı etüt verisi okunamadı/);
    put('R', rapor()); await assert.rejects(run('ETUT.raporEkle([R])'), /okunamadı/); assert.deepEqual(get('D.etut'), {surum:9});
    run('delete D.etut;kaydet=async()=>false'); await assert.rejects(run('ETUT.raporEkle([R])'), /Cihaza kaydedilemedi/); assert.equal(run('D.etut'), undefined);
    run("kaydet=async()=>true;D.dolgu='x'.repeat(BULUT_YEDEK_UST_SINIR)"); await assert.rejects(run('ETUT.raporEkle([R])'), /bulut yedeği/); assert.equal(run('D.etut'), undefined);
    run('delete D.dolgu'); await run('ETUT.raporEkle([R])'); await run('ETUT.sil()'); assert.equal(run('D.etut'), undefined);
  });
  await check('etüt rows never reach a student packet', async () => {
    await ekle(rapor());
    const paket = JSON.stringify(run('ogrenciPaketi(0)'));
    assert(!paket.includes('SENTETİK BORA') && !paket.includes('"etut"'));
  });
  await check('the teacher menu lists Etütler and Etüt planı under Öğrenciler', () => {
    assert(get('SEKME_REHBER').some(([id, ad]) => id === 'etutler' && ad === 'Etütler'));
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    assert.match(run('gorunumEtutler()'), /Henüz etüt raporu yok/);
  });
  console.log(passed + ' Etütler checks passed');
})();
