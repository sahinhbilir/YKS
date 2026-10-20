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
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__bg = run('bulutYedekGecmisi'); sandbox.__bga = run('buluttanGunAl');
const reset = () => run(`yalnizcaGoruntuleme=__yg;bulutYedekGecmisi=__bg;buluttanGunAl=__bga;confirm=()=>true;delete window.bulut;D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'Sentetik Ada',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='etutler';
  EK.etAralik=undefined;EK.etTur=undefined;EK.etDers=undefined;EK.etHoca=undefined;EK.etOgr=undefined;EK.etSira=undefined;EK.etAra='';EK.etSinif='';KAYIT=0;kaydet=async()=>{KAYIT++;return true};ETUT.onbellek.ts=null;`);
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
    // A one-day report for 13 Eki replaces that day only.
    await ekle(rapor([{tarih:'13.10.2026',satirlar:[['Türkçe','SENTETİK ÖĞRETMEN BEŞ','SENTETİK EGE','101 10/A','101','15:00','20 Dk.']]}], {bas:'13.10.2026',bit:'13.10.2026'}));
    const s = model(); assert.equal(s.rows.length, 36 - 11 + 1); assert.equal(s.rows.filter(r => iso(r.g) === '2026-10-13').length, 1);
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
  await check('many teachers on one day: the readout lists the busiest and counts the rest', async () => {
    const satirlar = Array.from({ length: 12 }, (_, i) => ['Matematik', 'SENTETİK HOCA ' + String(i + 1).padStart(2, '0'), 'SENTETİK EGE', '101 10/A', '101', '15:00', '20 Dk.']);
    await ekle(rapor([{ tarih: '13.10.2026', satirlar }], { bas: '13.10.2026', bit: '13.10.2026' }));
    const g = get(`ETUT.GRAFIKLER.hoca(ETUT.model(ETUT.oku().veri),{s:2,tur:'gun',ders:null,hoca:null,kim:null},720)`);
    const p = g.ipucu[0].satir; assert.equal(p.length, 10); assert.deepEqual(p[9].slice(1), ['+3 öğretmen', '3']);
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
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutplani']);
    assert.match(run('gorunumEtutler()'), /Henüz etüt raporu yok/);
  });
  console.log(passed + ' Etütler checks passed');
})();
