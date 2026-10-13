#!/usr/bin/env node
'use strict';
// Sıralamalar: list parsing, notebook storage, change boxes and privacy. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { okulListesi, SINAVLAR } = require('./fixtures/siralama-pdf.cjs');
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
const reset = () => run(`D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='siralamalar';
  EK.srOnceki=undefined;EK.srSimdiki=undefined;KAYIT=0;kaydet=async()=>{KAYIT++;return true};SIRALAMA.onbellek.clear();`);
const list = (exam, tur) => { const {pages, boylar} = okulListesi(SINAVLAR[exam][tur]); put('pages', pages); put('boylar', boylar); return get('siralamaPdfCoz(pages,boylar)'); };
const loadAll = async () => { put('L', ['once', 'sonra'].flatMap(e => ['T', 'F'].map(t => list(e, t)))); await run('siralamaKaydet(L)'); };
const model = () => run(`(()=>{const v=SIRALAMA.oku().veri,s=SIRALAMA.secim(SIRALAMA.modeller(v));return s})()`);
const box = d => run('SIRALAMA.deltaStyle')(d).s;
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('reads both list layouts: header, Kurum row, wrapped names, two-line classes, scores and ranks', () => {
    const t = list('sonra', 'T');
    assert.equal(t.tur, 'T'); assert.equal(t.ad, 'Sentetik Deneme 2'); assert.equal(t.tarih, '02.10.2026'); assert.equal(t.okul, 'SENTETİK ANADOLU LİSESİ');
    assert.deepEqual(t.katilim, ['1250', '410', '5']); assert.equal(t.ogr.length, 5);
    assert.deepEqual(t.kurum.n.slice(0, 2), [21.5, 2.25]); assert.equal(t.kurum.dy[0], '23.0/6.0'); assert.deepEqual(t.kurum.p, [262.4, null, null, null]);
    const cemre = t.ogr.find(o => o.no === '1003');
    assert.equal(cemre.ad, 'SENTETİK CEMRE UZUNADLI İKİNCİ'); assert.equal(cemre.snf, '201 12/B');
    assert.equal(cemre.n[0], 29); assert.equal(cemre.dy[0], '30/4'); assert.deepEqual(cemre.p, [340, 350, 310, 290]); assert.equal(cemre.r[1], '1 1 1 300');
    const f = list('sonra', 'F');
    assert.equal(f.tur, 'F'); assert.equal(f.ogr[0].n.length, 24); assert.equal(f.katilim[0], 'TYT: 1250 | AYT: 1150');
    assert.equal(f.ogr.find(o => o.no === '1001').n[11], 17.5);
  });
  await check('the Denemeler parser still reads the same synthetic lists', () => {
    for (const tur of ['T', 'F']) { put('pages', okulListesi(SINAVLAR.sonra[tur]).pages); const r = get('denemePdfCoz(pages)');
      assert.equal(r.ad, 'Sentetik Deneme 2'); assert.equal(r.satirlar.filter(x => x.oturum === 'TYT').length, 5); }
  });
  await check('non-list PDFs and lists without an exam name are refused', () => {
    put('pages', [[{s:'Merhaba',x:10,y:500,w:30,h:9,z:9}]]); assert.throws(() => run('siralamaPdfCoz(pages,[595.28])'), /toplu sonuç listesi/);
    const p = okulListesi(SINAVLAR.sonra.T); p.pages[0] = p.pages[0].filter(i => !/^Sınav Adı|^Sentetik Deneme/.test(i.s)); put('pages', p.pages);
    assert.throws(() => run('siralamaPdfCoz(pages,[595.28])'), /sınav adı/);
  });
  await check('lists are stored per exam in the notebook, merged by student number, and re-imports are idempotent', async () => {
    await loadAll();
    assert.equal(run('KAYIT'), 1); assert.equal(run('D.siralama.sinavlar.length'), 2);
    const once = run('JSON.stringify(D.siralama.sinavlar.map(s=>[s.id,!!s.T,!!s.F,s.T.ogr.length,s.F.ogr.length]))');
    assert.equal(once, JSON.stringify([['SENTETİK DENEME 1', true, true, 4, 4], ['SENTETİK DENEME 2', true, true, 5, 5]]));
    const before = run('JSON.stringify(D.siralama.sinavlar.map(({ts,...s})=>s))');
    await loadAll(); assert.equal(run('JSON.stringify(D.siralama.sinavlar.map(({ts,...s})=>s))'), before);
    // A class list adds to the school list; a corrected row replaces the old one.
    const sinif = list('sonra', 'T'); sinif.ogr = [{...sinif.ogr[0], n: [...sinif.ogr[0].n.slice(0, 10), 2]}, {...sinif.ogr[0], no: '1099', ad: 'SENTETİK YENİ'}];
    put('L', [sinif]); await run('siralamaKaydet(L)');
    assert.equal(run("D.siralama.sinavlar[1].T.ogr.length"), 6); assert.equal(run("D.siralama.sinavlar[1].T.ogr.find(o=>o.no==='1001').n[10]"), 2);
  });
  await check('TYT boxes: student, Kurum and Şube changes; N/A for a student without a previous TYT', async () => {
    await loadAll(); run('M=(()=>{const v=SIRALAMA.oku().veri;return SIRALAMA.secim(SIRALAMA.modeller(v))})()');
    assert.equal(run('M.prev.name'), 'Sentetik Deneme 1'); assert.equal(run('M.cur.name'), 'Sentetik Deneme 2');
    run('R=SIRALAMA.tytRows(M.cur.tyt,M.prev.tyt,Object.values(M.cur.tyt.students))');
    assert.deepEqual(get('R.map(r=>r.s.no)'), ['1003', '1001', '1005', '1002', '1004']);
    const ada = run("R.find(r=>r.s.no==='1001')"), ege = run("R.find(r=>r.s.no==='1005')");
    assert.equal(box(ada.delta['TÜR']), '+4.00'); assert.equal(box(ada.delta['FEL']), '+1.25'); assert.equal(box(ada.delta['TAR']), '0.00');
    assert.equal(box(run("R.find(r=>r.s.no==='1004')").delta['MAT']), '-1.50');
    assert.equal(box(ege.delta['TÜR']), 'N/A');
    const kur = run("SIRALAMA.tytAvg(M.cur.tyt,M.prev.tyt,'Kurum Ortalamaları',null)");
    assert.equal(box(kur.delta['TÜR']), '+1.50'); assert.equal(box(kur.delta['MAT']), '+1.75'); assert.equal(kur.puan.TYT, 262.4);
    // Şube: mean of the class now minus the same students' previous mean (EGE has none).
    const sube = run("SIRALAMA.tytAvg(M.cur.tyt,M.prev.tyt,'Şube Ortalamaları',R.filter(r=>r.s.cls==='301 12/A'))");
    assert.equal(sube.net['TÜR'], 26.5); assert.equal(box(sube.delta['TÜR']), '+1.25');
    // The TYT view prefers "Net Sayısı Sıralı" puan; AYT comes from "Öğrenci Adı Sıralı".
    assert.equal(run("M.cur.tyt.meta.toplam"), '1250'); assert.equal(run("M.cur.ayt.meta.toplam"), '1150');
  });
  await check('AYT boxes: tests compare only when answered twice; field change = sum of its branch boxes', async () => {
    await loadAll(); run('M=(()=>{const v=SIRALAMA.oku().veri;return SIRALAMA.secim(SIRALAMA.modeller(v))})()');
    const row = no => run(`SIRALAMA.aytRow(M.cur.ayt.students['${no}'],M.prev.ayt)`);
    const ada = row('1001'), bora = row('1002'), cemre = row('1003'), ege = row('1005');
    assert.equal(box(ada.delta.EDB), '+2.50'); assert.equal(box(ada.delta.AMAT), '+2.50');
    assert.equal(ada.field.EA.net, 18 - 0.5 + 6 - 0.5 + 4 + 16 - 1 + 6 - 0.5); assert.equal(box(ada.field.EA.delta), '+8.00'); assert.equal(ada.field.SAY.net, null);
    // BORA answered TDE-SB1 only now: those boxes are N/A and the EA change is MAT's change alone.
    assert.equal(box(bora.delta.EDB), 'N/A'); assert.equal(box(bora.delta.AMAT), '0.00'); assert.equal(bora.field.EA.net, 11 + 3.5 + 1.5 + 9 + 2.75); assert.equal(box(bora.field.EA.delta), '0.00');
    assert.equal(box(cemre.field.SAY.delta), '+5.75'); assert.equal(cemre.field.EA.net, null);
    assert.equal(box(ege.delta.AMAT), 'N/A'); assert.equal(box(ege.field.SAY.delta), 'N/A'); assert.equal(ege.field.SAY.net, 13.75 + 4.75 + 5.5 + 4.75 + 3.5);
    const kur = run('SIRALAMA.aytKurum(M.cur.ayt,M.prev.ayt)');
    assert.equal(kur.field.SAY.net, 13.5 + 4.25 + 3.5 + 2.25 + 2.75); assert.equal(box(kur.field.SAY.delta), '+3.25'); assert.equal(kur.field.SAY.dy, '28.7/9.8');
    const sube = run("SIRALAMA.aytSube(['1003','1004'].map(n=>SIRALAMA.aytRow(M.cur.ayt.students[n],M.prev.ayt)),M.prev.ayt)");
    assert.deepEqual(['AMAT','AGEO','AFİZ','AKİM','ABİY'].map(k => box(sube.delta[k])), ['+0.38', '+0.50', '+0.63', '+0.38', '0.00']);
    assert.equal(box(sube.field.SAY.delta), '+1.89');
  });
  await check('AYT Sınıf pages: one per class, sorted by the most common field unless the teacher picks another', async () => {
    await loadAll(); run('M=(()=>{const v=SIRALAMA.oku().veri;return SIRALAMA.secim(SIRALAMA.modeller(v))})()');
    let pages = get('SIRALAMA.aytSayfalari(M.cur,M.prev,"sinif",{}).map(p=>[p[0].map(r=>({s:{no:r.s.no}})),0,p[2]])');
    assert.deepEqual(pages.map(p => p[2].replace('DENEME SINAVI TOPLU SONUÇ LİSTESİ AYT ', '')), ['EA Net Sayısı Sıralı', 'SAY Net Sayısı Sıralı', 'SAY Net Sayısı Sıralı']);
    assert.deepEqual(pages.map(p => p[0].map(r => r.s.no)), [['1001', '1002'], ['1003', '1004'], ['1005']]);
    await run("SIRALAMA.tercihKaydet('301 12/A','Toplam')");
    pages = get('SIRALAMA.aytSayfalari(M.cur,M.prev,"sinif",SIRALAMA.oku().veri.tercih).map(p=>[0,0,p[2]])');
    assert.equal(pages[0][2], 'DENEME SINAVI TOPLU SONUÇ LİSTESİ AYT Net Sayısı Sıralı');
    const toplu = get('SIRALAMA.aytSayfalari(M.cur,M.prev,"toplu",{}).map(p=>[p[0].map(r=>({s:{no:r.s.no}}))])');
    assert.equal(toplu.length, 1); assert.deepEqual(toplu[0][0].map(r => r.s.no), ['1003', '1001', '1005', '1002', '1004']);
  });
  await check('reports need both exams and the right lists; previous defaults to the exam before the current one', async () => {
    put('L', [list('sonra', 'T')]); await run('siralamaKaydet(L)');
    let m = model(); assert.equal(m.prev, null); assert.match(run('SIRALAMA.neden(SIRALAMA.RAPORLAR[0],null,null)'), /iki sınav/);
    put('L', [list('once', 'T')]); await run('siralamaKaydet(L)'); m = model();
    assert.equal(m.cur.name, 'Sentetik Deneme 2'); assert.equal(m.prev.name, 'Sentetik Deneme 1');
    run('MM=SIRALAMA.secim(SIRALAMA.modeller(SIRALAMA.oku().veri))');
    assert.equal(run('SIRALAMA.neden(SIRALAMA.RAPORLAR[0],MM.cur,MM.prev)'), '');
    assert.match(run('SIRALAMA.neden(SIRALAMA.RAPORLAR[2],MM.cur,MM.prev)'), /Şimdiki sınavın Öğrenci Adı Sıralı/);
    run("EK.srSimdiki='SENTETİK DENEME 1'"); m = model(); assert.equal(m.cur.name, 'Sentetik Deneme 1'); assert.equal(m.prev.name, 'Sentetik Deneme 2');
  });
  await check('size limits: the lists and the cloud backup stay under their limits, and a refused write changes nothing', async () => {
    await loadAll(); const before = run('JSON.stringify(D.siralama)'), saves = run('KAYIT');
    const big = list('sonra', 'F'); big.ad = 'Sentetik Büyük'; big.ogr = Array.from({length: 600}, (_, i) => ({...big.ogr[i % 5], no: String(5000 + i), ad: 'SENTETİK '.repeat(13) + i}));
    put('L', [big, {...big, ad: 'Sentetik Büyük 2'}]); await assert.rejects(run('siralamaKaydet(L)'), /KB sınırını aşıyor/);
    assert.equal(run('JSON.stringify(D.siralama)'), before); assert.equal(run('KAYIT'), saves);
    run("D.ekKonular=[{ad:'x'.repeat(BULUT_YEDEK_UST_SINIR-baytBoyu(JSON.stringify(D))-500)}]"); put('L', [{...list('sonra', 'F'), ad: 'Sentetik Ek'}]);
    await assert.rejects(run('siralamaKaydet(L)'), /bulut yedeği sınırının/); assert.equal(run('JSON.stringify(D.siralama)'), before);
    // Deleting never grows the notebook, so it is allowed even when the notebook is too big.
    await run("SIRALAMA.sil('SENTETİK DENEME 1')"); assert.equal(run('D.siralama.sinavlar.length'), 1);
  });
  await check('damaged or newer stored lists are shown as unreadable and never overwritten', async () => {
    run("D.siralama={surum:2,sinavlar:[],gelecek:true}"); const before = run('JSON.stringify(D.siralama)');
    assert.match(run('SIRALAMA.oku().hata'), /okunamadı/); put('L', [list('sonra', 'T')]);
    await assert.rejects(run('siralamaKaydet(L)'), /Yeni liste eklenmedi/); assert.equal(run('JSON.stringify(D.siralama)'), before);
    assert.match(run('gorunumSiralamalar()'), /okunamadı/);
    for (const bad of [{surum:1,sinavlar:[{id:'X',ad:'X',okul:'',ts:1,T:{tarih:'',katilim:['','',''],kurum:null,ogr:[{no:'12a',ad:'A',snf:'',n:Array(11).fill(0),dy:Array(11).fill(null),p:[0,0,0,0],r:['','','','']}]}}]},
                       {surum:1,sinavlar:[{id:'X',ad:'X',okul:'',ts:1,T:{tarih:'',katilim:['','',''],kurum:null,ogr:[{no:'12',ad:'A',snf:'',n:Array(10).fill(0),dy:Array(11).fill(null),p:[0,0,0,0],r:['','','','']}]}}]},
                       {surum:1,sinavlar:[],tercih:{'301 12/A':'<b>'}}]) {
      put('bad', bad); assert.throws(() => run('SIRALAMA.dogrula(bad)'));
    }
  });
  await check('teacher only: not in student menus or packets; exam names are escaped in the page', async () => {
    const t = list('sonra', 'T'); t.ad = '<img src=x onerror=alert(1)>'; put('L', [t, list('once', 'T')]); await run('siralamaKaydet(L)');
    const page = run('gorunumSiralamalar()'); assert(!/<img/i.test(page)); assert(page.includes('&lt;img'));
    assert(page.includes('data-sr-indir="tyt-toplu"')); assert(!/data-sr-indir="tyt-toplu" disabled/.test(page));
    assert(/data-sr-indir="ayt-toplu" disabled/.test(page));
    run("D.ogr[0].syncId='synthetic-sync'"); const paket = run('JSON.stringify(ogrenciPaketi(0))');
    assert(!paket.includes('siralama')); assert(!paket.includes('SENTETİK EGE'));
    assert(get('SEKMELER().map(s=>s[0])').includes('siralamalar'));
    run("D.rol='ogrenci'"); assert(!get('SEKMELER().map(s=>s[0])').includes('siralamalar'));
    assert.match(run('gorunumSiralamalar()'), /rehber öğretmen içindir/);
    await assert.rejects(run('siralamaKaydet(L)'), /rehber öğretmen/);
  });
  await check('PDF downloads are binary: no text charset and no copy-text fallback', () => {
    assert.equal(run("dosyaTuru('pdf')"), 'application/pdf'); assert.equal(run("dosyaTuru('csv')"), 'text/csv;charset=utf-8');
  });
  await check('embedding is in sync and idempotent', () => {
    const { execFileSync } = require('node:child_process');
    execFileSync(process.execPath, ['scripts/embed-siralamalar.cjs', '--check']);
  });
  console.log(passed + ' Sıralamalar checks passed');
})();
