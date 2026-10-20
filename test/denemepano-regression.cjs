#!/usr/bin/env node
'use strict';
// Deneme panosu: the teacher's Denemeler board over the stored school lists. Model figures,
// comparison windows, statuses, class scopes, every chart, view-only teachers, the classic page
// and privacy. Synthetic data only (test/fixtures/siralama-pdf.cjs).
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
sandbox.__yg = run('yalnizcaGoruntuleme');
const reset = () => run(`yalnizcaGoruntuleme=__yg;D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='denemeler';
  EK.denemeKlasik=undefined;EK.dpOlcu=undefined;EK.dpAralik=undefined;EK.dpKapsam=undefined;EK.dpDers=undefined;EK.dpOgr=undefined;EK.dpAra='';EK.dpTur=undefined;EK.dpOnceki=undefined;EK.dpSimdiki=undefined;EK.dpOlcut=undefined;EK.dpOgrNet=undefined;EK.dpSira=undefined;EK.dpSiraYon=undefined;KAYIT=0;kaydet=async()=>{KAYIT++;return true};SIRALAMA.onbellek.clear();`);
const list = (exam, tur) => { const {pages, boylar} = okulListesi(SINAVLAR[exam][tur]); put('pages', pages); put('boylar', boylar); return get('siralamaPdfCoz(pages,boylar)'); };
const loadAll = async () => { put('L', ['once', 'sonra'].flatMap(e => ['T', 'F'].map(t => list(e, t)))); await run('siralamaKaydet(L)'); };
const state = () => get('(()=>{const {t}=DPANO.veriAl();const s=DPANO.durumAl(t);return {ks:s.ks.map(k=>k.key),K:s.K.key,olcu:s.sec.key,s:s.s,m:{sinavlar:s.m.sinavlar.map(x=>({ad:x.ad,n:x.n,ort:x.ort,medyan:x.medyan,max:x.max,ders:x.ders})),ozet:s.m.ozet,ogrenciler:s.m.ogrenciler,dersler:s.m.dersler.map(d=>({k:d.k,ad:d.ad,seri:d.seri,k1:d.k[1]}))},olcular:s.olcular.map(o=>[o.key,o.m.sinavlar.length])}})()');
// Independent TYT totals straight from the fixture: net = D − Y/4 over the 11 TYT columns.
const tytNet = o => o.dy.slice(0, 11).reduce((a, p) => a + (p ? p[0] - p[1] / 4 : 0), 0);
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('the teacher opens the board; the per-student page is one click away and comes back', async () => {
    let h = run('gorunumDenemeler()');
    assert.match(h, /<div id="dpKok">/); assert.match(h, /Henüz deneme listesi yok/); assert(h.includes('id="dnPdf"'), 'the import stays on the board');
    run('EK.denemeKlasik=true'); h = run('gorunumDenemeler()');
    assert(!h.includes('id="dpKok"')); assert(h.includes('id="dpPanoya"')); assert(h.includes('id="dnPdf"'));
    run("D.rol='ogrenci';EK.denemeKlasik=undefined"); assert(!run('gorunumDenemeler()').includes('dpKok'), 'students keep Denemelerim');
  });
  await check('model: averages, middle half, participation, ranks and the comparison window match the lists', async () => {
    await loadAll();
    const s = state();
    assert.equal(s.olcu, 'TYT'); assert.equal(s.s, 1); assert.equal(s.K, 'g12'); assert.equal(s.ks[0], 'g12'); assert(['12/A', '12/B'].every(k => s.ks.includes(k)));
    const exp = e => SINAVLAR[e].T.ogr.map(tytNet);
    assert.deepEqual(s.m.sinavlar.map(x => x.ad), ['Sentetik Deneme 1', 'Sentetik Deneme 2']);
    s.m.sinavlar.forEach((x, i) => { const v = exp(['once', 'sonra'][i]); assert.equal(x.n, v.length); assert(Math.abs(x.ort - v.reduce((a, b) => a + b, 0) / v.length) < 1e-9); assert.equal(x.max, Math.max(...v)); });
    assert(Math.abs(s.m.ozet[1].fark - (s.m.sinavlar[1].ort - s.m.sinavlar[0].ort)) < 1e-9);
    const ada = s.m.ogrenciler.find(o => o.no === '1001'), v1 = tytNet(SINAVLAR.once.T.ogr[0]), v2 = tytNet(SINAVLAR.sonra.T.ogr.find(o => o.no === '1001'));
    assert.deepEqual(ada.seri, [v1, v2]); assert.equal(ada.k[1].fark, v2 - v1);
    assert.equal(ada.k[1].durum, v2 - v1 >= 1 ? 'Yükseliyor' : v2 - v1 <= -1 ? 'Düşüyor' : 'Aynı');
    const ege = s.m.ogrenciler.find(o => o.ad === 'SENTETİK EGE'); if (ege) assert.equal(ege.k[1].durum, 'Yeni', 'a student only in the later exam is new');
    const ranks = s.m.ogrenciler.filter(o => o.sira !== null).map(o => o.sira).sort((a, b) => a - b); assert.equal(ranks[0], 1);
    assert.equal(s.m.ozet[2], undefined, 'two exams: no 2-exam comparison');
  });
  await check('scopes never mix: a class keeps only its own students; AYT fields count only those who took them', async () => {
    await loadAll();
    run("EK.dpKapsam='12/A'"); const a = state();
    assert.equal(a.K, '12/A'); assert(a.m.ogrenciler.every(o => o.sinif === '12/A'));
    run("EK.dpKapsam=undefined;EK.dpOlcu='AYT:Toplam'"); const t = state();
    assert.equal(t.olcu, 'AYT:Toplam'); assert(t.m.sinavlar.length >= 1);
    const fields = Object.fromEntries(t.olcular); assert.equal(fields.TYT, 2);
    run("EK.dpOlcu='AYT:SÖZ'"); const z = state(); assert(['AYT:SÖZ', 'TYT'].includes(z.olcu), 'a field nobody took falls back to a field with data');
  });
  await check('the page: sentence, controls, subject cards, table and the student card; names are escaped', async () => {
    put('L', ['once', 'sonra'].flatMap(e => ['T', 'F'].map(t => list(e, t)))); sandbox.L[3].ogr.find(o => o.no !== '1001').ad = 'SENTETİK <img src=x>'; await run('siralamaKaydet(L)'); run("EK.dpOgr='1001'");
    const h = run('DPANO.icerik()');
    assert.match(h, /12\. sınıflar · Son deneme \(Sentetik Deneme 2, \d+ [A-ZÇĞİÖŞÜ][a-zçğıöşü]+\): TYT ortalaması <b>[\d,]+<\/b> net, önceki denemeye göre <b>[+−][\d,]+<\/b>\./);
    for (const g of ['genel', 'ders', 'dagilim', 'kisi']) assert(h.includes('data-dp-grafik="' + g + '"'), g);
    assert.equal((h.match(/class="et-ders"/g) || []).length, 10, 'ten TYT subjects');
    assert.match(h, /data-dp-aralik="2"[^>]* disabled/); assert(h.includes('id="dpKlasik"')); assert(h.includes('data-sekme="siralamalar"'));
    assert(!/<img/i.test(h)); assert(/&lt;img src=x&gt;/i.test(h));
    assert(h.includes('data-ogr-gor="0"'), 'a notebook student opens in student view');
  });
  await check('every chart draws for every measure and focus without NaN', async () => {
    await loadAll();
    for (const olcu of ['TYT', 'AYT:SAY', 'AYT:EA', 'AYT:Toplam']) for (const ders of [null, 'MAT', 'AMAT']) {
      run(`EK.dpOlcu='${olcu}';EK.dpDers=${ders ? `'${ders}'` : 'null'}`);
      for (const g of ['genel', 'ders', 'dagilim', 'kisi']) {
        const c = run(`(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.${g}(DPANO.durumAl(t),720)})()`);
        assert(c && c.svg.startsWith('<svg') && !/NaN|undefined|Infinity/.test(c.svg), g + ' ' + olcu + ' ' + ders);
        assert.equal(c.xs.length, c.ipucu.length);
      }
    }
  });
  await check('a viewing teacher sees the board without import', async () => {
    await loadAll(); run('yalnizcaGoruntuleme=()=>true');
    const h = run('DPANO.icerik()'); assert(!h.includes('id="dnPdf"')); assert(h.includes('data-dp-grafik="genel"'));
  });
  await check('unreadable lists show their warning and keep the import', async () => {
    run('D.siralama={surum:9}'); const h = run('DPANO.icerik()');
    assert.match(h, /okunamadı/); assert(h.includes('id="dnPdf"'));
  });
  await check('the board stores nothing of its own and student packets stay free of lists', async () => {
    await loadAll(); const once = JSON.stringify(get('D')); run('DPANO.icerik()'); assert.equal(JSON.stringify(get('D')), once);
    const paket = JSON.stringify(run('ogrenciPaketi(0)')); assert(!paket.includes('SENTETİK BORA') && !paket.includes('siralama'));
  });
  // A third, synthetic exam between the two: the first exam's lists renamed "Sentetik Tarama 1".
  const listOf = l => { const {pages, boylar} = okulListesi(l); put('pages', pages); put('boylar', boylar); return get('siralamaPdfCoz(pages,boylar)'); };
  const tarama = tur => listOf({...SINAVLAR.once[tur], ad: 'Sentetik Tarama 1', tarih: '25.09.2026'});
  const loadUc = async () => { put('L', [list('once', 'T'), list('once', 'F'), tarama('T'), tarama('F'), list('sonra', 'T'), list('sonra', 'F')]); await run('siralamaKaydet(L)'); };
  const idOf = ad => get(`DPANO.veriAl().t.sinavlar.find(s=>s.ad===${JSON.stringify(ad)}).id`);
  const st = code => get(`(()=>{const {t}=DPANO.veriAl();const st=DPANO.durumAl(t);return (${code})(st)})()`);
  await check('genel and tarama: from the name, filtered by Tür, set by the teacher and kept through a new import', async () => {
    await loadUc();
    assert.deepEqual(st('st=>st.m.sinavlar.map(s=>[s.ad,s.tur])'), [['Sentetik Deneme 1', 'genel'], ['Sentetik Tarama 1', 'tarama'], ['Sentetik Deneme 2', 'genel']]);
    run("EK.dpTur='genel'"); assert.deepEqual(st('st=>[st.tur,st.m.sinavlar.map(s=>s.ad)]'), ['genel', ['Sentetik Deneme 1', 'Sentetik Deneme 2']]);
    run("EK.dpTur='tarama'"); assert.deepEqual(st('st=>st.m.sinavlar.map(s=>s.ad)'), ['Sentetik Tarama 1']);
    assert.match(run('DPANO.icerik()'), /^<header class="et-bas"><h1 class="et-baslik">Denemeler<\/h1><p class="et-cumle">Tarama denemeleri · 12\. sınıflar · Tek deneme var/);
    // The teacher marks the first exam as a tarama; it survives the same lists being added again.
    run("EK.dpTur=''"); const d1 = idOf('Sentetik Deneme 1');
    await run(`SIRALAMA.turDegistir(${JSON.stringify(d1)},'tarama')`);
    assert.equal(get(`D.siralama.sinavlar.find(s=>s.id===${JSON.stringify(d1)}).tur`), 'tarama');
    put('L', [list('once', 'T')]); await run('siralamaKaydet(L)');
    run("EK.dpTur='tarama'"); assert.deepEqual(st('st=>st.m.sinavlar.map(s=>s.ad)'), ['Sentetik Deneme 1', 'Sentetik Tarama 1']);
    // Back to what the name says: nothing is stored.
    await run(`SIRALAMA.turDegistir(${JSON.stringify(d1)},'genel')`);
    assert.equal(get(`D.siralama.sinavlar.find(s=>s.id===${JSON.stringify(d1)}).tur ?? null`), null);
    assert.throws(() => run("SIRALAMA.dogrula({...JSON.parse(JSON.stringify(D.siralama)),sinavlar:D.siralama.sinavlar.map(s=>({...s,tur:'x'}))})"), /sınav türü/);
    run('yalnizcaGoruntuleme=()=>true');
    await assert.rejects(() => run(`SIRALAMA.turDegistir(${JSON.stringify(d1)},'tarama')`));
    const h = run('DPANO.icerik()'); assert(!h.includes('data-dp-sinav-tur'), 'a viewing teacher only reads the type');
    run('yalnizcaGoruntuleme=__yg');
    assert.match(run('DPANO.icerik()'), /<select class="dp-tur-sec" data-dp-sinav-tur="[^"]+" aria-label="Sentetik Tarama 1 türü"><option value="genel">Genel<\/option><option value="tarama" selected>Tarama<\/option><\/select>/);
  });
  await check('Seç compares any two exams; cards, ranks and texts follow the chosen pair', async () => {
    await loadUc();
    const varsayilan = st('st=>[st.m.pencere.sec,st.m.simdi,st.m.onceki]');
    assert.deepEqual(varsayilan, [{once: [1, 1], son: [2, 2]}, 2, 1], 'without Seç the last two');
    run(`EK.dpAralik='sec';EK.dpOnceki=${JSON.stringify(idOf('Sentetik Deneme 1'))};EK.dpSimdiki=${JSON.stringify(idOf('Sentetik Deneme 2'))}`);
    const s = st('st=>({s:st.s,simdi:st.m.simdi,onceki:st.m.onceki,ozet:st.m.ozet.sec,ort:st.m.sinavlar.map(x=>x.ort)})');
    assert.equal(s.s, 'sec'); assert.equal(s.simdi, 2); assert.equal(s.onceki, 0);
    assert(Math.abs(s.ozet.fark - (s.ort[2] - s.ort[0])) < 1e-9, 'the chosen pair, not the tarama in between');
    const h = run('DPANO.icerik()');
    assert.match(h, /12\. sınıflar · Sentetik Deneme 1 → Sentetik Deneme 2 \(\d+ [A-ZÇĞİÖŞÜ][a-zçğıöşü]+\): TYT ortalaması <b>[\d,]+<\/b> net, öncekine göre <b>[+−][\d,]+<\/b>/);
    assert.match(h, /<select id="dpOnceki" aria-label="Önceki deneme">.*<option value="[^"]+" selected>Sentetik Deneme 1 · \d+ \S+ · Genel<\/option><\/select>/);
    assert.match(h, /<option value="[^"]+">Sentetik Tarama 1 · \d+ \S+ · Tarama<\/option>/);
    assert.match(h, /Ortalama net · şimdiki deneme/); assert.match(h, /<button type="button" data-dp-sira="son">Şimdiki<\/button>/);
    // The same exam on both sides falls back to the one before Şimdiki.
    run(`EK.dpOnceki=EK.dpSimdiki`); assert.deepEqual(st('st=>[st.m.simdi,st.m.onceki]'), [2, 1]);
    // Şimdiki earlier than Önceki still compares the two.
    run(`EK.dpSimdiki=${JSON.stringify(idOf('Sentetik Deneme 1'))};EK.dpOnceki=${JSON.stringify(idOf('Sentetik Deneme 2'))}`);
    assert.deepEqual(st('st=>[st.m.simdi,st.m.onceki]'), [0, 2]);
  });
  await check('Sıralamalar measures: net artışı, % artış and the closed gap rank the students; şube averages head the table', async () => {
    await loadAll();
    const rows = () => st('st=>st.mo.ogrenciler.map(o=>({no:o.no,sira:o.sira,c:o.k[1]}))');
    for (const [olcut, alan] of [['artis', 'fark'], ['yuzde', 'yuzde'], ['fark', 'logFark']]) {
      run(`EK.dpOlcut='${olcut}'`); const r = rows().filter(x => x.c[alan] !== null).sort((a, b) => a.sira - b.sira);
      assert(r.length >= 3); for (let i = 1; i < r.length; i++) assert(r[i - 1].c[alan] >= r[i].c[alan] - 1e-9, olcut + ' ranks by ' + alan);
      assert.equal(r[0].sira, 1);
    }
    const ada = rows().find(x => x.no === '1001').c, u = 120;
    assert(Math.abs(ada.yuzde - ada.fark / ada.once * 100) < 1e-9);
    assert(Math.abs(ada.logFark - Math.log((u - ada.once + 1) / (u - ada.son + 1))) < 1e-9);
    run("EK.dpOlcut='yuzde';EK.dpSira='sira';EK.dpSiraYon='artan'"); let h = run('DPANO.icerik()');
    // All three measures are columns of Tüm öğrenciler, as in Sıralamalar; the ranked one stays on a phone.
    for (const b of ['Net artışı', '% artış', 'Kapanan fark (log)']) assert(h.includes('data-dp-sira="' + {'Net artışı': 'fark', '% artış': 'yuzde', 'Kapanan fark (log)': 'logFark'}[b] + '">' + b + '</button>'), b);
    assert(h.includes('<th scope="col" class="dp-secili" aria-sort="none"><button type="button" data-dp-sira="yuzde">% artış</button>'));
    assert(h.includes('<th scope="col" class="et-dar-gizle" aria-sort="none"><button type="button" data-dp-sira="logFark">Kapanan fark (log)</button>'));
    assert(h.includes('<th scope="col" aria-sort="ascending"><button type="button" data-dp-sira="sira">Sıra</button>'));
    assert(h.indexOf('data-dp-olcut="yuzde"') > h.indexOf('<h2>Tüm öğrenciler</h2>') && h.indexOf('data-dp-olcut="yuzde"') < h.indexOf('id="dpAra"'), 'Sırala sits in Tüm öğrenciler');
    assert.match(h, /<tr class="dp-ort"><td><b>12\. sınıflar ortalaması<\/b> <span class="mini">5 öğrenci<\/span><\/td>/);
    for (const c of ['12/A', '12/B', '12/C']) assert(h.includes('<b>' + c + ' ortalaması</b>'), c);
    run("EK.dpKapsam='12/A'"); h = run('DPANO.icerik()');
    assert(h.includes('<b>12/A ortalaması</b>') && !h.includes('<b>12/B ortalaması</b>'), 'one class: only its own row');
    run("EK.dpKapsam=undefined;EK.dpOlcut='net'");
    assert.equal(st('st=>st.olcut'), 'net');
  });
  await check('the students’ part can follow one subject’s net; the top of the board stays on the total', async () => {
    await loadAll(); run("EK.dpOgrNet='MAT'");
    const s = st('st=>({ust:st.mo.O.ust,ad:st.ogrDers.ad,seri:st.mo.ogrenciler.find(o=>o.no==="1001").seri,top:st.m.O.key})');
    assert.equal(s.ust, 30); assert.equal(s.ad, 'Matematik'); assert.equal(s.top, 'TYT');
    const mat = o => { const [d, y] = o.dy[6]; return d - y / 4; };
    assert.deepEqual(s.seri, [mat(SINAVLAR.once.T.ogr[0]), mat(SINAVLAR.sonra.T.ogr[0])]);
    const h = run('DPANO.icerik()');
    assert.match(h, /TYT ortalaması/); assert(h.includes('<h2>Öğrencilere göre · TYT Matematik</h2>'));
    assert.match(h, /<select id="dpOgrNet"[^>]*><option value="">TYT toplam<\/option>.*<option value="MAT" selected>Matematik<\/option>/);
    run("EK.dpOlcu='AYT:SAY'"); assert.equal(st('st=>st.ogrDers'), null, 'a subject of another session falls back to the total');
  });
  await check('every student as a line: one per student, coloured by class, readable on hover', async () => {
    await loadAll();
    const c = run('(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.ogrenci(DPANO.durumAl(t),720)})()');
    assert(c.svg.startsWith('<svg') && !/NaN|undefined|Infinity/.test(c.svg));
    assert.equal(c.seriler.length, 5); assert.equal((c.svg.match(/data-seri="/g) || []).length, 5, 'one mark per student');
    const renk = no => c.seriler.find(s => s.no === no).renk;
    assert.equal(renk('1001'), renk('1002'), '12/A shares a colour'); assert.notEqual(renk('1001'), renk('1003'));
    const k = c.seriler.findIndex(s => s.no === '1003'), p = c.seriIpucu(k, 1);
    assert.match(p.bas, /^Sentetik Cemre Uzunadlı İkinci · 12\/B$/); assert.deepEqual(JSON.parse(JSON.stringify(p.satir.map(r => r[1]))), ['Sentetik Deneme 2', 'Sıra', 'Ortalama']);
    const ege = c.seriler.findIndex(s => s.no === '1005'); assert.deepEqual(JSON.parse(JSON.stringify(c.seriIpucu(ege, 0).satir.map(r => r[2]))), ['girmedi']);
    // The subject chart offers its lines for hover too, and marks the one on stage in its readout.
    const d = run('(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.ders(DPANO.durumAl(t),720)})()');
    assert.equal(d.seriler.length, 10); assert.equal((d.svg.match(/<path class="et-cizgi ince" data-seri="/g) || []).length, 10);
    assert.deepEqual(JSON.parse(JSON.stringify(d.seriIpucu(0, 1).satir.filter(r => r[4]).map(r => r[1]))), [d.seriler[0].ad]);
    for (const olcu of ['TYT', 'AYT:SAY', 'AYT:Toplam']) for (const net of [null, 'MAT', 'AMAT', 'EDB']) {
      run(`EK.dpOlcu='${olcu}';EK.dpOgrNet=${net ? `'${net}'` : 'null'}`);
      for (const g of ['ogrenci', 'dagilim']) {
        const x = run(`(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.${g}(DPANO.durumAl(t),720)})()`);
        assert(x && !/NaN|undefined|Infinity/.test(x.svg), g + ' ' + olcu + ' ' + net);
      }
    }
  });
  await check('the exam table corrects dates with Sıralamalar’s field; Raporlar at the bottom follow the board’s pair', async () => {
    await loadUc();
    let h = run('DPANO.icerik()');
    for (const ad of ['Sentetik Deneme 1', 'Sentetik Tarama 1', 'Sentetik Deneme 2']) assert(h.includes('data-sr-tarih="' + idOf(ad) + '"'), ad);
    assert(h.includes('id="srDurum"'));
    const rap = h.slice(h.indexOf('<section class="et-panel" id="dpRaporlar"'));
    assert(rap.startsWith('<section class="et-panel" id="dpRaporlar" data-sr-simdi="' + idOf('Sentetik Deneme 2') + '" data-sr-onceki="' + idOf('Sentetik Tarama 1') + '">'), 'the last two exams');
    assert.equal((rap.match(/data-sr-indir="/g) || []).length, 4); assert(rap.includes('id="srHepsi"') && rap.includes('id="srSayfalar"'));
    assert(rap.includes('data-sr-sinif="301 12/A"'), 'AYT Sınıf keeps its per-class sort');
    assert(h.lastIndexOf('id="dpRaporlar"') > h.lastIndexOf('id="dpSinavlar"'), 'reports come last');
    run(`EK.dpAralik='sec';EK.dpOnceki=${JSON.stringify(idOf('Sentetik Deneme 1'))}`); h = run('DPANO.icerik()');
    assert(h.includes('data-sr-onceki="' + idOf('Sentetik Deneme 1') + '"'), 'Seç moves the reports too');
    assert.match(h, /<span class="mini">Sentetik Deneme 1 → Sentetik Deneme 2<\/span><\/div><div class="dp-raporlar">/);
    run('yalnizcaGoruntuleme=()=>true'); h = run('DPANO.icerik()');
    assert(!h.includes('data-sr-tarih=') && h.includes('data-sr-indir='), 'a viewing teacher reads dates and still downloads reports');
    run('yalnizcaGoruntuleme=__yg');
  });
  console.log(passed + ' Deneme panosu checks passed');
})();
