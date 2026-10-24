#!/usr/bin/env node
'use strict';
// Sıralamalar: list parsing, notebook storage, change boxes and privacy. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { okulListesi, sinifListesi, SINAVLAR, SINIFLAR } = require('./fixtures/siralama-pdf.cjs');
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
const sinif = k => { const {pages, boylar} = sinifListesi(SINIFLAR[k]); put('pages', pages); put('boylar', boylar); return get('siralamaPdfCoz(pages,boylar)'); };
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
  await check("each grade's own list: 9. sınıf (8 lessons, large type, one score), 10. sınıf (wrapped school name), 11. sınıf (AYT without S.F)", () => {
    const d = sinif('dokuz2'), ece = d.ogr.find(o => o.no === '2001');
    assert.equal(d.tur, 'T'); assert.equal(d.ad, 'Sentetik 9 Deneme 2'); assert.equal(d.tarih, '23.10.2026'); assert.equal(d.ogr.length, 3);
    // Stored in the 12. sınıf column order; Felsefe, S.F and Geometri were not printed.
    assert.deepEqual(ece.n, [14, 7, 5.75, null, 4, null, 7, null, 5.75, 5.75, 3.75]);
    assert.deepEqual(ece.dy, ['15/4', '7/0', '6/1', null, '4/0', null, '8/4', null, '6/1', '6/1', '4/1']);
    assert.equal(ece.snf, '102 9/A'); assert.deepEqual(ece.p, [280.5, null, null, null]); assert.equal(ece.r[0], '1 1 1 -');
    assert.equal(d.ogr.find(o => o.no === '2003').ad, 'SENTETİK GÜL UZUNADLI İKİNCİ'); assert.deepEqual(d.kurum.p, [255.25, null, null, null]);
    const on = sinif('on');
    assert.equal(on.okul, 'SENTETİK ANADOLU LİSESİ'); assert.deepEqual(on.katilim, ['2', '2', '2']);
    assert.deepEqual([on.ogr[0].n[3], on.ogr[0].n[5], on.ogr[0].n[7]], [5, null, null]);
    const onbir = sinif('onbir'), jale = onbir.ogr.find(o => o.no === '4001');
    assert.equal(onbir.tur, 'F'); assert.equal(onbir.katilim[1], 'TYT: 2 | AYT: 2'); assert.equal(jale.snf, '302 11/A');
    assert.deepEqual([jale.n[11], jale.n[17], jale.n[18], jale.n[19]], [15, 4.75, null, 19]); assert.deepEqual(jale.r, ['1 1 5 900', '1 1 9 2000', '1 1 4 800', '1 1 3 700']);
    // Denemeler reads the same lists; a grade's own exam gets its question counts from the answers.
    put('pages', sinifListesi(SINIFLAR.dokuz2).pages); const r = get('denemePdfCoz(pages)');
    assert.equal(r.satirlar.length, 3);
    assert.deepEqual(r.satirlar[0].dersler.map(x => x.kod + '/' + x.soru), ['turkce/20', 'tarih/7', 'cografya/7', 'din/6', 'mat/20', 'fizik/7', 'kimya/7', 'biyoloji/6']);
    put('R', r); run('for(const row of R.satirlar)denemePdfKaydi(R,row)');
    put('pages', sinifListesi(SINIFLAR.onbir).pages); const r11 = get('denemePdfCoz(pages)');
    assert.deepEqual(r11.satirlar.map(x => x.oturum), ['TYT', 'AYT', 'TYT', 'AYT']); assert(r11.satirlar.every(x => x.dersler.every(d => d.soru === null)));
    assert.equal(r11.satirlar[1].dersler.length, 12); assert(!r11.satirlar[1].dersler.some(d => d.kod === 'sf'));
    // A lesson is bounded by its test, the test by its size.
    const kayit = dersler => ({id:'p:x', ad:'X', tarih:'2026-10-23', tur:'TYT', oturum:'TYT', brans:'', alan:'SAY', dersler, sure:null, puan:null, ts:1});
    put('k', [kayit([{kod:'tarih', dogru:7, yanlis:0, soru:7}, {kod:'cografya', dogru:6, yanlis:1, soru:7}])]); run('denemeDogrula(k)');
    put('k', [kayit([{kod:'tarih', dogru:7, yanlis:0, soru:null}, {kod:'cografya', dogru:7, yanlis:0, soru:null}, {kod:'din', dogru:7, yanlis:0, soru:null}])]);
    assert.throws(() => run('denemeDogrula(k)'), /toplam soru/);
  });
  await check('reordered lesson headers and a net that does not match its D/Y are refused', () => {
    const p = sinifListesi(SINIFLAR.dokuz1); p.pages[0].find(o => o.s === 'TAR').s = 'FİZ'; put('pages', p.pages); put('boylar', p.boylar);
    assert.throws(() => run('siralamaPdfCoz(pages,boylar)'), /ders sütunları okunamadı/); assert.throws(() => run('denemePdfCoz(pages)'), /sütun düzeni desteklenmiyor/);
    const q = sinifListesi(SINIFLAR.dokuz1); q.pages[0].find(o => o.s === '11.00').s = '11.50'; put('pages', q.pages);
    assert.throws(() => run('denemePdfCoz(pages)'), /neti ile doğru\/yanlış/);
  });
  await check('grades are compared only with their own; lists keep their own lessons in reports and rankings', async () => {
    put('L', [list('once', 'T'), list('sonra', 'T'), sinif('dokuz1'), sinif('dokuz2'), sinif('on'), sinif('onbir')]); await run('siralamaKaydet(L)');
    const ms = 'SIRALAMA.modeller(SIRALAMA.oku().veri)';
    assert.deepEqual(get(`${ms}.map(e=>[e.name,e.sinif])`), [['Sentetik Deneme 1', 12], ['Sentetik 9 Deneme 1', 9], ['Sentetik Deneme 2', 12], ['Sentetik 10 Deneme 1', 10], ['Sentetik 11 Deneme 1', 11], ['Sentetik 9 Deneme 2', 9]]);
    assert.deepEqual(get(`${ms}.map(SIRALAMA.listeAdlari)`), [['TYT · Net Sayısı Sıralı'], ['TYT · 8 ders'], ['TYT · Net Sayısı Sıralı'], ['TYT · 9 ders'], ['TYT + AYT · 23 ders'], ['TYT · 8 ders']]);
    assert.deepEqual(get(`${ms}.at(-1).tyt.dersler`), ['TÜR', 'TAR', 'COĞ', 'DİN', 'MAT', 'FİZ', 'KİM', 'BİY']);
    assert.deepEqual(get(`${ms}.at(-2).ayt.dersler`), ['EDB', 'TAR1', 'COĞ1', 'TAR2', 'COĞ2', 'FELGR', 'DİN2', 'AMAT', 'AGEO', 'AFİZ', 'AKİM', 'ABİY']);
    // The newest exam (9. sınıf) compares with the 9. sınıf one, not the 12. sınıf exam between them,
    // even when another grade's exam was chosen before.
    let m = model(); assert.equal(m.cur.name, 'Sentetik 9 Deneme 2'); assert.equal(m.prev.name, 'Sentetik 9 Deneme 1');
    run("EK.srOnceki='SENTETİK DENEME 2'"); m = model(); assert.equal(m.prev.name, 'Sentetik 9 Deneme 1');
    const sayfa = run('gorunumSiralamalar()'), onceki = sayfa.slice(sayfa.indexOf('id="srOnceki"'), sayfa.indexOf('</select>', sayfa.indexOf('id="srOnceki"')));
    assert.equal((onceki.match(/<option/g) || []).length, 1); assert(onceki.includes('Sentetik 9 Deneme 1 · 9. sınıf'));
    assert(sayfa.includes('9. sınıf · TYT 3 öğrenci') && sayfa.includes('TYT · 8 ders'));
    run('M=SIRALAMA.secim(SIRALAMA.modeller(SIRALAMA.oku().veri))');
    assert.equal(run('SIRALAMA.neden(SIRALAMA.RAPORLAR[0],M.cur,M.prev)'), ''); assert.equal(run('SIRALAMA.neden(SIRALAMA.RAPORLAR[2],M.cur,M.prev)'), 'Bu sınavda AYT yok.');
    // Changes: only lessons both lists printed; Felsefe was not printed, so it has none.
    run('R=SIRALAMA.tytRows(M.cur.tyt,M.prev.tyt,Object.values(M.cur.tyt.students))');
    const ece = run("R.find(r=>r.s.no==='2001')"); assert.equal(box(ece.delta['TÜR']), '+3.00'); assert.equal(box(ece.delta['TAR']), '+2.50'); assert.equal(ece.delta['FEL'], null);
    const kur = run("SIRALAMA.tytAvg(M.cur.tyt,M.prev.tyt,'Kurum Ortalamaları',null)"); assert.equal(box(kur.delta['TÜR']), '+2.00'); assert.equal(kur.delta['GEO'], null);
    const sube = run("SIRALAMA.tytAvg(M.cur.tyt,M.prev.tyt,'Şube Ortalamaları',R)"); assert.equal(sube.delta['GEO'], null); assert.notEqual(sube.delta['DİN'], null);
    // Tarih has 7 questions in this exam: the gap closed stays defined with a full net of 7, not 5.
    const tar = get("SIRALAMA.siraSatirlari(M.cur,M.prev,'TYT:TAR','fark')"); assert(tar.every(r => Number.isFinite(r.fark)));
    assert.equal(tar.find(r => r.s.no === '2001').fark.toFixed(4), Math.log((7 - 4.5 + 1) / (7 - 7 + 1)).toFixed(4));
    run("EK.srSiraTur='TYT';EK.srSiraNet='TYT:GEO'"); const sira = run('SIRALAMA.siraBolumu(M.cur,M.prev)');
    assert(!sira.includes('value="TYT:GEO"') && !sira.includes('value="TYT:FEL"') && sira.includes('value="TYT:DİN"') && sira.includes('value="TYT:G-SOS"') && !sira.includes('value="TYT:G-MAT"'));
    assert(sira.includes('value="TYT" selected'));
    // The 10. sınıf exam has no exam of its grade to compare with; the 11. sınıf AYT fields add up without S.F.
    run("EK.srSimdiki='SENTETİK 10 DENEME 1';EK.srOnceki=null"); m = model(); assert.equal(m.prev, null);
    assert.equal(run('(()=>{const s=SIRALAMA.secim(SIRALAMA.modeller(SIRALAMA.oku().veri));return SIRALAMA.neden(SIRALAMA.RAPORLAR[0],s.cur,s.prev)})()'), 'Karşılaştırmak için 10. sınıfların ikinci bir sınavı gerekir.');
    const k11 = run(`SIRALAMA.aytKurum(${ms}.at(-2).ayt,null)`); assert.equal(k11.field['SÖZ'].net, 6 + 1.5 + 1 + 1.5 + 1.5 + 1 + 1.5); assert.equal(k11.field['SÖZ'].dy, '18.0/16.0');
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
  await check('in-site ranking: net, net increase, % increase and gap closed (log), per session, field and class', async () => {
    await loadAll(); run('M=SIRALAMA.secim(SIRALAMA.modeller(SIRALAMA.oku().veri))');
    const sira = (alan, olcut) => get(`SIRALAMA.siraSatirlari(M.cur,M.prev,'${alan}','${olcut}').map(r=>[r.s.no,r.sira,r.once,r.simdi,r.artis,r.yuzde===null?null:+r.yuzde.toFixed(1),r.fark===null?null:+r.fark.toFixed(3)])`);
    assert.deepEqual(sira('TYT', 'net'), [['1003', 1, 76.75, 84.25, 7.5, 9.8, 0.186], ['1001', 2, 63.5, 72, 8.5, 13.4, 0.16], ['1005', 3, null, 63.25, null, null, null],
      ['1002', 4, 42.75, 42.5, -0.25, -0.6, -0.003], ['1004', 5, 36.25, 33.25, -3, -8.3, -0.035]]);
    assert.deepEqual(sira('TYT', 'artis').map(r => [r[0], r[1]]), [['1001', 1], ['1003', 2], ['1002', 3], ['1004', 4], ['1005', null]], 'no earlier exam: last, unranked');
    assert.deepEqual(sira('TYT', 'yuzde').map(r => r[0]), ['1001', '1003', '1002', '1004', '1005']);
    // ln((120 − 76.75 + 1) / (120 − 84.25 + 1)) > ln((120 − 63.5 + 1) / (120 − 72 + 1)): closing the gap near the top counts more.
    assert.deepEqual(sira('TYT', 'fark').map(r => r[0]), ['1003', '1001', '1002', '1004', '1005']);
    assert.deepEqual(sira('SAY', 'net').map(r => [r[0], r[2], r[3]]), [['1003', 46, 51.75], ['1005', null, 32.25], ['1004', 13.5, 11.5]], 'AYT SAY: only students who took both tests');
    // Each course ranks on its own net; the gap closed uses the course's question count (Matematik 30).
    assert.deepEqual(sira('TYT:MAT', 'fark').map(r => [r[0], r[2], r[3], r[6]]), [['1003', 19, 21.5, 0.234], ['1001', 11, 13, 0.105], ['1002', 7, 7, 0], ['1004', 8, 6.5, -0.063], ['1005', null, 13.75, null]]);
    assert.deepEqual(sira('AYT:EDB', 'net').map(r => [r[0], r[2], r[3]]), [['1001', 15, 17.5], ['1002', null, 11]], 'an AYT course counts only where its test was answered');
    // A test ranks on the sum of its lessons: Matematik + Geometri out of 40, Edebiyat–Sosyal 1 where it was answered.
    const mg = sira('TYT:G-MAT', 'net'), mat = sira('TYT:MAT', 'net'), geo = sira('TYT:GEO', 'net'), deger = (l, no) => l.find(r => r[0] === no)[3];
    assert.equal(mg.length, 5); for (const r of mg) assert(Math.abs(r[3] - deger(mat, r[0]) - deger(geo, r[0])) < 0.011, r[0]);
    assert.deepEqual(mg.map(r => r[1]), [1, 2, 3, 4, 5]);
    assert.deepEqual(sira('AYT:G-TDE', 'net').map(r => r[0]), sira('AYT:EDB', 'net').map(r => r[0]), 'the same students as Edebiyat');
    // Averages: the school, then each class; the change is the current average minus the same students' earlier one.
    put('O', get("(()=>{const t=SIRALAMA.siraSatirlari(M.cur,M.prev,'TYT','net');return [SIRALAMA.siraOrtalama('Okul',t,120),SIRALAMA.siraOrtalama('301-A',t.filter(r=>r.s.cls==='301 12/A'),120)]})()"));
    assert.deepEqual(sandbox.O.map(o => [o.ad, o.n, +o.simdi.toFixed(2), +o.once.toFixed(4), o.artis]), [['Okul', 5, 59.05, 54.8125, 4.24], ['301-A', 2, 57.25, 53.125, 4.13]]);
    // Equal values share a rank; % needs a positive earlier net.
    put('R', [{s:{name:'A'},simdi:5,artis:2},{s:{name:'B'},simdi:4,artis:2},{s:{name:'C'},simdi:3,artis:1},{s:{name:'D'},simdi:2,artis:null}]);
    assert.deepEqual(get("SIRALAMA.siraNumarala(R,'artis').map(r=>r.sira)"), [1, 1, 3, null]);
    put('C', {tyt:{students:{'1':{no:'1',name:'A',cls:'',net:{'TÜR':10},dy:{}}}}}); put('P', {tyt:{students:{'1':{no:'1',name:'A',cls:'',net:{'TÜR':0},dy:{}}}}});
    assert.deepEqual(get("SIRALAMA.siraSatirlari(C,P,'TYT','yuzde').map(r=>[r.artis,r.yuzde,r.sira])"), [[10, null, null]]);
    // The page: controls, the chosen column, class filter, and names of notebook students open their view.
    run("EK.srSiraOlcut='fark';EK.srSiraSube='201 12/B'"); let page = run('gorunumSiralamalar()');
    assert.match(page, /aria-pressed="true" data-sr-sira-olcut="fark">Kapanan fark \(log\)/);
    assert.match(page, /<th scope="col" class="k-fark secili">Kapanan fark \(log\)<\/th>/);
    assert.match(page, /Sentetik Deneme 1 → Sentetik Deneme 2 · 2 öğrenci/);
    run("EK.srSiraSube='';EK.srSiraOlcut='net'"); page = run('gorunumSiralamalar()');
    assert.deepEqual([...page.matchAll(/<tr class="sr-ort[^"]*"><td><\/td><td><b>([^<]+) ortalaması<\/b> <span class="mini">(\d+) öğrenci/g)].map(m => m[1] + ':' + m[2]),
      ['Okul:5', '301-A:2', '201-B:2', '205-C:1'], 'school and class averages open the table');
    assert.match(page, /<span class="mini">1001<\/span> <button type="button" class="ogr-ad" data-ogr-gor="0" title="Öğrenci gözüyle gör">SENTETİK ADA<\/button>/);
    assert.match(page, /<span class="mini">1002<\/span> SENTETİK BORA<\/td>/, 'not in the notebook: plain text');
    // One "Net" list: TYT total or a TYT course; for AYT a field, the AYT total or an AYT course.
    run("EK.srSiraTur='AYT';EK.srSiraNet='Toplam'"); page = run('gorunumSiralamalar()');
    assert.match(page, /<select id="srSiraNet"><optgroup label="Alan"><option value="SAY">SAY<\/option><option value="EA">EA<\/option><option value="SÖZ">SÖZ<\/option><option value="Toplam" selected>AYT toplam<\/option><\/optgroup><optgroup label="Ders"><option value="AYT:EDB">Edebiyat<\/option>/);
    run("EK.srSiraTur='TYT'"); page = run('gorunumSiralamalar()');
    assert.match(page, /<option value="TYT" selected>TYT toplam<\/option><optgroup label="Ders"><option value="TYT:TÜR">Türkçe/, 'an AYT choice falls back to TYT total');
    assert.match(page, /<\/optgroup><optgroup label="Toplam"><option value="TYT:G-SOS">Sosyal Bilimler<\/option><option value="TYT:G-MAT">Matematik \+ Geometri<\/option><option value="TYT:G-FEN">Fen Bilimleri<\/option><\/optgroup><\/select>/);
  });
  await check('exam date correction: kept apart from the lists, orders the exams, moves students\' school results', async () => {
    await loadAll();
    const id = get("SIRALAMA.oku().veri.sinavlar.find(s=>s.ad==='Sentetik Deneme 2').id");
    assert.match(run('gorunumSiralamalar()'), /data-sr-tarih="[^"]+" value="2026-10-02"/);
    await assert.rejects(run(`SIRALAMA.tarihDegistir(${JSON.stringify(id)},'2026-09-01')`), /Tarih geçersiz/);
    assert.deepEqual(JSON.parse(JSON.stringify(await run(`SIRALAMA.tarihDegistir(${JSON.stringify(id)},'01.09.2026')`))), {ad: 'Sentetik Deneme 2', eski: ['02.10.2026', '09.10.2026']});
    const m = get("SIRALAMA.modeller(SIRALAMA.oku().veri).map(e=>[e.name,e.dates,e.pdfDates])");
    assert.deepEqual(m, [['Sentetik Deneme 2', ['01.09.2026'], ['02.10.2026', '09.10.2026']], ['Sentetik Deneme 1', ['18.09.2026'], ['18.09.2026']]], 'the corrected date orders the exams');
    assert.equal(run('SIRALAMA.secim(SIRALAMA.modeller(SIRALAMA.oku().veri)).cur.name'), 'Sentetik Deneme 1');
    assert.match(run('gorunumSiralamalar()'), /value="2026-09-01"[^>]*><div class="mini">PDF’de: 02\.10\.2026 · 09\.10\.2026<\/div>/);
    put('L', [list('sonra', 'T')]); await run('siralamaKaydet(L)');
    assert.equal(run('SIRALAMA.oku().veri.sinavlar.find(s=>s.ad==="Sentetik Deneme 2").tarih'), '01.09.2026', 'adding the PDF again keeps the correction');
    put('bad', {...get('SIRALAMA.oku().veri'), sinavlar: get('SIRALAMA.oku().veri.sinavlar').map(s => ({...s, tarih: '2026-09-01'}))});
    assert.throws(() => run('SIRALAMA.dogrula(bad)'), /sınav tarihi/);
    run("YG=yalnizcaGoruntuleme;yalnizcaGoruntuleme=()=>true");
    try { await assert.rejects(run(`SIRALAMA.tarihDegistir(${JSON.stringify(id)},'02.09.2026')`), /rehber öğretmen/);
      assert.doesNotMatch(run('gorunumSiralamalar()'), /data-sr-tarih/, 'a viewing teacher sees the date as text'); }
    finally { run('yalnizcaGoruntuleme=YG'); }
  });
  await check('moving an exam\'s results to the corrected date: PDF rows get the new id, manual rows keep theirs', async () => {
    run(`(()=>{const ders=n=>DENEME_DERSLER.TYT.map(d=>({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
      const k=(id,ad,tarih,n)=>({id,ad,tarih,tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:5});
      const pid=t=>'p:'+encodeURIComponent([denemeAdAnahtari('Hazırbulunuşluk'),t,'TYT'].join('|'));
      D.ogr=[{no:1,ad:'A',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,denemeOkul:[k(pid('2026-09-13'),'Hazırbulunuşluk','2026-09-13',30),k('p:x','Başka','2026-09-13',5)],
          denemeler:[k('m:own','Hazırbulunuşluk','2026-09-13',30)]},
        {no:2,ad:'B',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,denemeOkul:[k('p:manual-1','hazırbulunuşluk ','2026-09-13',20)]},
        {no:3,ad:'C',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,silindi:true,denemeOkul:[k(pid('2026-09-13'),'Hazırbulunuşluk','2026-09-13',10)]}];})()`);
    assert.equal(await run("denemeOkulTarihTasi('HAZIRBULUNUŞLUK',['2026-09-13'],'2026-08-18')"), 2);
    const a = get("D.ogr[0].denemeOkul.map(r=>[decodeURIComponent(r.id),r.tarih,!!r.silindi])");
    assert.deepEqual(a, [['p:HAZIRBULUNUŞLUK|2026-08-18|TYT', '2026-08-18', false], ['p:HAZIRBULUNUŞLUK|2026-09-13|TYT', '2026-09-13', true], ['p:x', '2026-09-13', false]]);
    assert.deepEqual(get("D.ogr[1].denemeOkul.map(r=>[r.id,r.tarih,!!r.silindi])"), [['p:manual-1', '2026-08-18', false]]);
    assert.deepEqual(get("D.ogr.map(o=>!!o.denemeYayinBekliyor)"), [true, true, false]);
    assert.equal(run("D.ogr[0].denemeler[0].tarih"), '2026-09-13', "the student's own entry is theirs");
    assert.equal(run("D.ogr[2].denemeOkul[0].tarih"), '2026-09-13', 'deleted students are left alone');
    assert.deepEqual(get("denemeListe(0).map(r=>[r.ad,r.tarih])"), [['Hazırbulunuşluk', '2026-08-18'], ['Başka', '2026-09-13']], 'the own duplicate stays hidden');
    assert.equal(await run("denemeOkulTarihTasi('Hazırbulunuşluk',['2026-09-13'],'2026-08-18')"), 0, 'nothing left to move');
    run("D.ogr[1].denemeOkul[0].tarih='2026-09-13';kaydet=async()=>false"); const once = run('JSON.stringify(D.ogr)');
    await assert.rejects(run("denemeOkulTarihTasi('Hazırbulunuşluk',['2026-09-13'],'2026-08-18')"), /kaydedilemedi/);
    assert.equal(run('JSON.stringify(D.ogr)'), once, 'a failed save changes nothing');
    await assert.rejects(run("denemeOkulTarihTasi('Hazırbulunuşluk',['2026-09-13'],'2026-02-30')"), /Tarih geçersiz/);
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
