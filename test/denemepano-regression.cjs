#!/usr/bin/env node
'use strict';
// Deneme panosu: the teacher's Denemeler board over the stored school lists. Model figures,
// comparison windows, statuses, class scopes, every chart, view-only teachers, the classic page
// and privacy. Synthetic data only (test/fixtures/siralama-pdf.cjs).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { okulListesi, sinifListesi, SINAVLAR, SINIFLAR } = require('./fixtures/siralama-pdf.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
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
    assert.equal(s.olcu, 'TYT'); assert.equal(s.s, 'tum', 'the default comparison is the whole period'); assert.equal(s.K, 'g12'); assert.equal(s.ks[0], 'g12'); assert(['12/A', '12/B'].every(k => s.ks.includes(k)));
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
    run('EK.dpAralik=1');   // these checks are about the exam-to-exam window; Tüm dönem is the default (see the range checks)
    put('L', ['once', 'sonra'].flatMap(e => ['T', 'F'].map(t => list(e, t)))); sandbox.L[3].ogr.find(o => o.no !== '1001').ad = 'SENTETİK <img src=x>'; await run('siralamaKaydet(L)'); run("EK.dpOgr='1001'");
    const h = run('DPANO.icerik()');
    assert.match(h, /12\. sınıflar · Son deneme \(Sentetik Deneme 2, \d+ [A-ZÇĞİÖŞÜ][a-zçğıöşü]+\): TYT ortalaması <b>[\d,]+<\/b> net, önceki denemeye göre <b>[+−][\d,]+<\/b> \(iki dönemde de giren \d+ öğrencinin kendi değişimi <b>[+−]?[\d,]+<\/b>\)\./);
    for (const g of ['genel', 'ders', 'dagilim', 'kisi']) assert(h.includes('data-dp-grafik="' + g + '"'), g);
    assert.equal((h.match(/class="et-ders"/g) || []).length, 10, 'ten TYT lessons'); assert.equal((h.match(/class="et-ders et-grup-kart"/g) || []).length, 3, 'and three tests');
    for (const k of ['G-SOS', 'G-MAT', 'G-FEN']) assert(h.includes('data-dp-ders="' + k + '"'), k);
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
    run('EK.dpAralik=1');   // these checks are about the exam-to-exam window; Tüm dönem is the default (see the range checks)
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
    assert.match(h, /Katılımcı ortalaması · şimdiki deneme/); assert.match(h, /<button type="button" data-dp-sira="son">Şimdiki<\/button>/);
    // The main chart draws the pair as two lines with handles; their band labels give way to the handles.
    const g = get('(()=>{const {t}=DPANO.veriAl();const g=DPANO.GRAFIKLER.genel(DPANO.durumAl(t),720);return {svg:g.svg,tutamak:g.tutamak,ids:g.ids}})()');
    assert(g.tutamak && /data-tutamak="once"/.test(g.svg) && /data-tutamak="son"/.test(g.svg)); assert(!/class="et-bant-yazi"/.test(g.svg));
    assert.deepEqual(g.ids, [idOf('Sentetik Deneme 1'), idOf('Sentetik Tarama 1'), idOf('Sentetik Deneme 2')], 'lines snap to these exams');
    // The same exam on both sides falls back to the one before Şimdiki.
    run(`EK.dpOnceki=EK.dpSimdiki`); assert.deepEqual(st('st=>[st.m.simdi,st.m.onceki]'), [2, 1]);
    // Şimdiki earlier than Önceki still compares the two.
    run(`EK.dpSimdiki=${JSON.stringify(idOf('Sentetik Deneme 1'))};EK.dpOnceki=${JSON.stringify(idOf('Sentetik Deneme 2'))}`);
    assert.deepEqual(st('st=>[st.m.simdi,st.m.onceki]'), [0, 2]);
  });
  await check('Sıralamalar measures: net artışı, % artış and the closed gap rank the students; şube averages head the table', async () => {
    run('EK.dpAralik=1');   // these checks are about the exam-to-exam window; Tüm dönem is the default (see the range checks)
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
    for (const b of ['Net artışı', 'Türkiye’ye göre', '% artış', 'Kapanan fark (log)']) assert(h.includes('data-dp-sira="' + {'Net artışı': 'fark', 'Türkiye’ye göre': 'trFark', '% artış': 'yuzde', 'Kapanan fark (log)': 'logFark'}[b] + '">' + b + '</button>'), b);
    assert(h.includes('<th scope="col" class="sayi dp-secili" aria-sort="none"><button type="button" data-dp-sira="yuzde">% artış</button>'));
    assert(h.includes('<th scope="col" class="sayi et-dar-gizle" aria-sort="none"><button type="button" data-dp-sira="logFark">Kapanan fark (log)</button>'));
    assert(h.includes('<th scope="col" class="sayi" aria-sort="ascending"><button type="button" data-dp-sira="sira">Sıra</button>'));
    assert.deepEqual([...h.matchAll(/data-dp-olcut="(\w+)"/g)].map(x => x[1]), ['net', 'artis', 'trfark', 'yuzde', 'fark'], 'Türkiye’ye göre is the Sırala pill after Net artışı');
    assert.match(h, /data-dp-olcut="trfark" aria-pressed="false" disabled/, 'no Türkiye list: the pill is off');
    assert(h.includes('id="dpTrSatir">Bu aralıkta Türkiye ortalaması yok</p>') && !/class="sayi et-(yukari|asagi|esit)"[^>]*>[▲▼]/.test(h.slice(h.indexOf('id="dpTablo"'))), 'no Türkiye list: the line says so and the column is empty');
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
  await check('tests next to the lessons, places moved since the önceki exam, and lessons from easiest to hardest', async () => {
    run('EK.dpAralik=1');   // these checks are about the exam-to-exam window; Tüm dönem is the default (see the range checks)
    await loadAll(); run("EK.dpOgrNet='G-FEN'");
    const net = (o, i) => { const p = o.dy[i]; return p ? p[0] - p[1] / 4 : 0; }, fen = o => net(o, 8) + net(o, 9) + net(o, 10), r2 = v => Math.round(v * 100) / 100;
    const s = st(`st=>({ust:st.mo.O.ust,ad:st.ogrDers.ad,seri:st.mo.ogrenciler.find(o=>o.no==="1001").seri,ogr:st.m.ogrenciler.map(o=>({sira:o.sira,siraOnce:o.siraOnce,siraFark:o.siraFark})),
      dersler:st.m.dersler.map(d=>({kod:d.kod,ad:d.ad,soru:d.soru,seri:d.seri,uyeler:d.uyeler||null}))})`);
    assert.equal(s.ust, 20); assert.equal(s.ad, 'Fen Bilimleri');
    assert.deepEqual(s.seri.map(r2), [fen(SINAVLAR.once.T.ogr[0]), fen(SINAVLAR.sonra.T.ogr[0])].map(r2), 'a test is the sum of its lessons');
    const d = k => s.dersler.find(x => x.kod === k);
    assert.deepEqual(['G-SOS', 'G-MAT', 'G-FEN'].map(k => d(k).soru), [20, 40, 20]);
    assert.equal(r2(d('G-MAT').seri[1]), r2(d('MAT').seri[1] + d('GEO').seri[1]), 'the Matematik + Geometri card adds both averages');
    assert(s.ogr.filter(o => o.sira !== null && o.siraOnce !== null).every(o => o.siraFark === o.siraOnce - o.sira));
    assert.deepEqual(s.ogr.map(o => o.siraFark), [0, 0, null, -1, -1], 'a newcomer in third place moves the two below down one place');
    let h = run('DPANO.icerik()');
    assert.match(h, /<optgroup label="Toplam"><option value="G-SOS">Sosyal Bilimler<\/option><option value="G-MAT">Matematik \+ Geometri<\/option><option value="G-FEN" selected>Fen Bilimleri<\/option>/);
    assert.match(h, /Sırası yükselen · son deneme<\/span><strong>0<\/strong><div class="et-ozet-alt"><span class="mini">düşen: 2 · aynı: 2<\/span>/); assert.match(h, /class="et-sira-ok (yukari|asagi|esit)" role="img" aria-label="(\d+ sıra (yükseldi|düştü)|sıra aynı)"/);
    // Kolaydan zora: the lessons only, by the class's success in the şimdiki exam.
    const zor = h.match(/<section class="et-panel" id="dpZorluk">[\s\S]*?<\/section>/)[0], sira = [...zor.matchAll(/data-dp-ders="([^"]+)"/g)].map(x => x[1]);
    const ders = s.dersler.filter(x => !x.uyeler), oran = x => x.seri[1] / x.soru;
    assert.deepEqual(sira, ders.slice().sort((a, b) => oran(b) - oran(a) || a.ad.localeCompare(b.ad, 'tr')).map(x => x.kod));
    assert.match(zor, new RegExp('En kolay ' + ders.find(x => x.kod === sira[0]).ad + ' · en zor ' + ders.find(x => x.kod === sira.at(-1)).ad));
    assert.match(zor, /puan<\/span>/, 'the change since the önceki exam in points');
    run("EK.dpDers='G-MAT'"); h = run('DPANO.icerik()'); assert.match(h, /<h2>Matematik \+ Geometri · ortalama net<\/h2>/);
    const c = get('(()=>{const {t}=DPANO.veriAl();const g=DPANO.GRAFIKLER.ders(DPANO.durumAl(t),720);return {svg:g.svg,ipucu:g.ipucu}})()');
    assert(!/NaN|undefined/.test(c.svg)); assert.equal(c.ipucu[1].satir[0][1], 'Matematik + Geometri');
    run("EK.dpDers=null"); const hepsi = get('(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.ders(DPANO.durumAl(t),720).seriler.map(x=>x.ad)})()');
    assert.equal(hepsi.length, 10, 'the all-subjects chart draws the lessons only');
    run("EK.dpOlcut='artis'"); assert(st('st=>st.mo.ogrenciler.every(o=>o.siraFark===null)'), 'ranked by a change, places moved are not shown');
  });
  await check("a grade's own exams: only the lessons its lists print, with their question counts", async () => {
    const sinif = k => { const {pages, boylar} = sinifListesi(SINIFLAR[k]); put('pages', pages); put('boylar', boylar); return get('siralamaPdfCoz(pages,boylar)'); };
    put('L', [list('once', 'T'), list('sonra', 'T'), sinif('dokuz1'), sinif('dokuz2')]); await run('siralamaKaydet(L)');
    run("EK.dpKapsam='g9'");
    const dersler = () => get('(()=>{const {t}=DPANO.veriAl(),s=DPANO.durumAl(t);return {ust:s.m.O.ust,d:s.m.dersler.map(d=>d.kod+"/"+d.soru),n:s.m.sinavlar.map(x=>x.ad)}})()');
    let m = dersler();
    assert.deepEqual(m.n, ['Sentetik 9 Deneme 1', 'Sentetik 9 Deneme 2']);
    assert.deepEqual(m.d, ['TÜR/20', 'TAR/7', 'COĞ/7', 'DİN/6', 'MAT/20', 'FİZ/7', 'KİM/7', 'BİY/6', 'G-SOS/20', 'G-FEN/20']); assert.equal(m.ust, 80);
    const h = run('gorunumDenemeler()'); assert(h.includes('20 soru')); assert(!/Felsefe|Geometri/.test(h));
    // A lesson net of a 9. sınıf exam is ranked against its own count.
    run("EK.dpOgrNet='TAR'"); assert(Number.isFinite(run('(()=>{const {t}=DPANO.veriAl();return DPANO.durumAl(t).mo.O.ust})()')));
    // The 12. sınıf board keeps the TYT lessons and counts.
    run("EK.dpKapsam='g12';EK.dpOgrNet=undefined"); m = dersler();
    assert.equal(m.ust, 120); assert(m.d.includes('TÜR/40') && m.d.includes('GEO/10') && m.d.includes('G-MAT/40'));
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
  await check('drag to measure: each time chart says what it measures, in net; mini graphs carry their exams; Çizgi is on the board', async () => {
    await loadAll();
    const g = (ad, alan = 'olc') => get(`(()=>{const {t}=DPANO.veriAl();const g=DPANO.GRAFIKLER.${ad}(DPANO.durumAl(t),720);return g&&g.${alan}||null})()`);
    const st = state(), ort = st.m.sinavlar.map(x => x.ort);
    const genel = g('genel');
    assert.deepEqual([genel.donem, genel.etiket, genel.birim, genel.ana.v], [[0, 1], ['18 Eyl', '2 Eki'], 'net', ort]);
    const ders = g('ders');
    assert.equal(ders.ana.ad, 'TYT toplam ortalaması'); assert.deepEqual(ders.ana.v, ort); assert.equal(ders.ana.y, null, 'not drawn: no dots');
    assert.deepEqual(ders.seriler.map(x => x.ad), g('ders', 'seriler').map(x => x.ad), 'one per line, in the lines\' order');
    assert(ders.seriler.every(x => x.v.length === 2 && x.y.length === 2), 'lessons measured in net, drawn at their %');
    run("EK.dpDers='MAT'"); assert.deepEqual([g('ders').ana.ad, g('ders').seriler], ['Matematik', null]);
    run('EK.dpDers=null');
    const ogr = g('ogrenci'); assert.equal(ogr.seriler.length, 5); assert.equal(ogr.ana.ad, 'Ortalama');
    assert(ogr.seriler.some(x => x.v.includes(null)), 'a missed exam has no point');
    assert.equal(g('dagilim'), null, 'the distribution has no time axis');
    assert.equal(g('kisi').ana.v.length, 2);
    const h = run('DPANO.icerik()');
    assert(h.includes('data-olc-donem="0,1" data-olc-uzunluk="1" data-olc-v="'), 'card and table mini graphs');
    assert.match(h, /data-dp-cizgi="kose" aria-pressed="true"/);
    run("GRAFIK_CIZGI.sec('yumusak')"); assert.match(run('DPANO.icerik()'), /data-dp-cizgi="yumusak" aria-pressed="true"/); run("GRAFIK_CIZGI.sec('kose')");
  });
  await check('the exam table corrects dates with Sıralamalar’s field; Raporlar at the bottom follow the board’s pair', async () => {
    run('EK.dpAralik=1');   // these checks are about the exam-to-exam window; Tüm dönem is the default (see the range checks)
    await loadUc();
    let h = run('DPANO.icerik()');
    for (const ad of ['Sentetik Deneme 1', 'Sentetik Tarama 1', 'Sentetik Deneme 2']) assert(h.includes('data-sr-tarih="' + idOf(ad) + '"'), ad);
    assert(h.includes('id="srDurum"'));
    // PDF ekle (lists only) and Sil, Sıralamalar's own, sit in the same table.
    assert(h.includes('<input type="file" id="srPdf"')); assert.equal((h.match(/data-sr-sil="/g) || []).length, 3);
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
    assert(!h.includes('id="srPdf"') && !h.includes('data-sr-sil='), 'nor adds or deletes lists');
    run('yalnizcaGoruntuleme=__yg');
  });
  // ---- Değişimin kaynağı and Isı haritası: hand-computed synthetic exams (no lists) ----
  // exams: [[name, {no: [A, B, C(, Z)]}]], people: {no: [name, şube]}. A = Matematik, B = Fizik, C = Türkçe; Z is
  // a net no printed lesson covers (it counts in the total only). Returns the model of the 12th grade or one şube.
  const elle = (sinavlar, kisiler, kapsam = 'g12', secim = null, gunler = null) => {
    put('ELLE', {sinavlar, kisiler, kapsam, secim, gunler});
    run(`globalThis.__m=(()=>{const E=ELLE,L=[['A','Matematik','var(--e-c1)'],['B','Fizik','var(--e-c2)'],['C','Türkçe','var(--e-c3)']].map(([kod,ad,renk])=>({kod,ad,soru:40,renk}));
      const O={key:'X',ad:'Elle',oturum:'tyt',ust:120,deger:o=>Object.values(o.net).reduce((a,b)=>a+b,0),dersler:L};
      const kisi=new Map(Object.entries(E.kisiler).map(([no,[ad,sinif]])=>[no,{no,ad,sinif}]));
      const t={kisi,sinavlar:E.sinavlar.map(([ad,satirlar],i)=>({id:'e'+i,ad,tarih:'',g:E.gunler?E.gunler[i]:i+1,dates:[],pdfDates:[],tur:'genel',ayt:{},
        tyt:Object.fromEntries(Object.entries(satirlar).map(([no,v])=>[no,{no,name:E.kisiler[no][0],cls:'',net:Object.fromEntries(v.map((x,j)=>['ABCZ'[j],x])),dy:{A:'1/0',B:'1/0',C:'1/0'}}]))}))};
      const K=E.kapsam==='g12'?{key:'g12',ad:'12. sınıflar',uyar:k=>!!k&&parseInt(k.sinif,10)===12}:{key:E.kapsam,ad:E.kapsam,uyar:k=>!!k&&k.sinif===E.kapsam};
      const m=DPANO.gorunumModeli(t,O,K,E.secim);const n=m.sinavlar.length;m.simdi=m.pencere.sec?m.pencere.sec.son[0]:n-1;m.onceki=m.pencere.sec?m.pencere.sec.once[0]:n-2;return m})()`);
  };
  const kaynak = s => get(`DPANO.degisimKaynagi(__m,${JSON.stringify(s)})`);
  const topla = l => l.reduce((a, b) => a + b, 0), yakin = (a, b, mesaj) => assert(Math.abs(a - b) < 1e-9, (mesaj || '') + ' ' + a + ' ≠ ' + b);
  const kisiler = {1001: ['SENTETİK ADA', '12/A'], 1002: ['SENTETİK BORA', '12/A'], 1003: ['SENTETİK CEMRE', '12/B'], 1004: ['SENTETİK DOĞA', '12/B'], 1005: ['SENTETİK EGE', '12/B'], 1007: ['SENTETİK GÜL', '12/C'], 1008: ['SENTETİK HAKAN', '12/D']};
  // 1004 sits the later exam out, 1005 and 1008 join only in it: none has a change. Changes (Matematik, Fizik, Türkçe | total):
  // 1001 +3 −1 +4 | +6, 1002 +3 0 +1 | +4, 1003 +1 −2 +1 | 0, 1007 +1 +1 0 | +2.
  const iki = [['Sentetik Deneme 1', {1001: [10, 5, 3], 1002: [8, 2, 2], 1003: [6, 6, 1], 1004: [9, 3, 3], 1007: [4, 1, 0]}],
    ['Sentetik Deneme 2', {1001: [13, 4, 7], 1002: [11, 2, 3], 1003: [7, 4, 2], 1005: [12, 6, 6], 1007: [5, 2, 0], 1008: [3, 3, 3]}]];
  await check('Değişimin kaynağı: the same students’ change splits exactly into lessons and into şubeler', async () => {
    elle(iki, kisiler); const k = kaynak(1);
    assert.equal(k.n, 4, 'only the students with a value in both exams'); assert.deepEqual(k.aynilar.map(r => r.no).sort(), ['1001', '1002', '1003', '1007']);
    assert.deepEqual(k.parcalar.map(p => [p.ad, p.katki]), [['Matematik', 2], ['Fizik', -0.5], ['Türkçe', 1.5]], 'mean change of each lesson');
    yakin(k.toplam, 3); yakin(topla(k.parcalar.map(p => p.katki)), k.toplam, 'lessons add to the total');
    assert.deepEqual(k.subeler.map(x => [x.ad, x.n, x.ort, x.katki]), [['12/A', 2, 5, 2.5], ['12/B', 1, 0, 0], ['12/C', 1, 2, 0.5], ['12/D', 0, null, 0]]);
    yakin(topla(k.subeler.map(x => x.katki)), k.toplam, 'şubeler add to the total');
    yakin(k.toplam, get('__m.ozet[1].ayni'), 'the same number as the Aynı öğrencilerin değişimi card'); assert.equal(get('__m.ozet[1].ayniN'), 4);
    // The students of 12/A: their own lesson changes.
    assert.deepEqual(k.aynilar.find(r => r.no === '1001').ders, [3, -1, 4]);
    assert(!k.parcalar.some(p => p.diger), 'the lessons cover the whole net');
  });
  await check('Değişimin kaynağı: windows of several exams use each student’s own mean; what no lesson covers is Diğer dersler', async () => {
    // 1001 misses the second exam; Z is a net no printed lesson covers. Önceki 2 = exams 1–2, Son 2 = exams 3–4.
    const dort = [['E1', {1001: [2, 2, 0, 1], 1003: [1, 1, 1]}], ['E2', {1003: [1, 1, 1]}], ['E3', {1001: [6, 4, 0, 3], 1003: [1, 1, 1]}], ['E4', {1001: [8, 2, 0, 5], 1003: [3, 1, 1]}]];
    elle(dort, kisiler);
    let k = kaynak(2); assert.equal(k.n, 2);
    assert.deepEqual(k.aynilar.map(r => [r.no, r.toplam]).sort(), [['1001', 9], ['1003', 1]]);
    assert.deepEqual(k.parcalar.map(p => [p.kod, p.katki]), [['A', 3], ['B', 0.5], ['C', 0], ['diger', 1.5]]); yakin(k.toplam, 5); yakin(k.toplam, get('__m.ozet[2].ayni'));
    assert.deepEqual(k.subeler.map(x => [x.ad, x.katki]), [['12/A', 4.5], ['12/B', 0.5]]); yakin(topla(k.subeler.map(x => x.katki)), 5);
    k = kaynak(1); assert.deepEqual(k.parcalar.map(p => [p.kod, p.katki]), [['A', 2], ['B', -1], ['C', 0], ['diger', 1]]); yakin(k.toplam, 2);
    // Seç: any two exams (first and last).
    elle(dort, kisiler, 'g12', {onceki: 'e0', simdi: 'e3'}); k = kaynak('sec');
    assert.deepEqual(k.parcalar.map(p => [p.kod, p.katki]), [['A', 4], ['B', 0], ['C', 0], ['diger', 2]]); yakin(k.toplam, 6); yakin(topla(k.parcalar.map(p => p.katki)), k.toplam);
    // No window, no students in both: nothing to show.
    assert.equal(kaynak(3), null);
    elle([['E1', {1001: [1, 1, 1]}], ['E2', {1003: [1, 1, 1]}]], kisiler); assert.equal(kaynak(1), null, 'nobody in both exams');
    assert.equal(run('DPANO.kaynakBolumleri({m:__m,s:1,K:__m.K})'), '');
  });
  await check('Değişimin kaynağı: the sentence names the biggest lesson and şube and what pulled down', async () => {
    elle(iki, kisiler);
    assert.equal(run('DPANO.kaynakCumlesi(DPANO.degisimKaynagi(__m,1),__m.K)'), '12. sınıflar ▲3,0 net (aynı 4 öğrenci): en çok Matematik ▲2,0 ve 12/A ▲2,5 katkı verdi; Fizik ▼0,5 düşürdü.');
    elle(iki, kisiler, '12/A');
    assert.equal(run('DPANO.kaynakCumlesi(DPANO.degisimKaynagi(__m,1),__m.K)'), '12/A ▲5,0 net (aynı 2 öğrenci): en çok Matematik ▲3,0 katkı verdi; Fizik ▼0,5 düşürdü.', 'a single şube has no şube part');
    // A fall: the same students the other way round.
    elle([iki[1], iki[0]], kisiler);
    assert.equal(run('DPANO.kaynakCumlesi(DPANO.degisimKaynagi(__m,1),__m.K)'), '12. sınıflar ▼3,0 net (aynı 4 öğrenci): en çok Fizik ▲0,5 katkı verdi; Matematik ▼2,0 ve 12/A ▼2,5 düşürdü.');
  });
  await check('Değişimin kaynağı section: bars sorted by size, the total from the parts, numbers right-aligned; şube table for a grade', async () => {
    elle(iki, kisiler);
    const h = run('DPANO.kaynakBolumleri({m:__m,s:1,K:__m.K})'), kaynakH = h.slice(h.indexOf('id="dpKaynak"'), h.indexOf('id="dpIsi"'));
    assert.match(kaynakH, /<h2>Değişimin kaynağı<\/h2><span class="mini">Sentetik Deneme 1 → Sentetik Deneme 2 · Elle<\/span>/);
    assert(kaynakH.includes('<p class="dp-kaynak-cumle">12. sınıflar ▲3,0 net (aynı 4 öğrenci): en çok Matematik ▲2,0 ve 12/A ▲2,5 katkı verdi; Fizik ▼0,5 düşürdü.</p>'));
    assert(kaynakH.includes('Toplam ▲3,00 net = 2,00 + 1,50 − 0,50'), 'the total is the sum of the printed parts');
    const sira = ['Matematik', 'Türkçe', 'Fizik'].map(a => kaynakH.indexOf('</i>' + a + '</th>')); assert(sira.every(i => i > 0) && sira[0] < sira[1] && sira[1] < sira[2], 'by size of the contribution');
    assert(kaynakH.includes('<td class="sayi et-yukari">+2,00</td>') && kaynakH.includes('<td class="sayi et-asagi">−0,50</td>'));
    assert(kaynakH.includes('<span class="dp-cubuk yukari" style="--g:100%">') && kaynakH.includes('<span class="dp-cubuk asagi" style="--g:25%">'), 'bars grow from the middle, scaled to the largest part');
    assert(kaynakH.includes('<tfoot><tr><th scope="row">Toplam</th><td></td><td class="sayi et-yukari">+3,00</td></tr></tfoot>'));
    const sube = kaynakH.slice(kaynakH.indexOf('<h3>Şubelere göre</h3>'));
    assert(sube.includes('Toplam ▲3,00 net = 2,50 + 0,00 + 0,50 + 0,00'));
    assert(sube.includes('<th scope="col" class="sayi">Öğrenci</th><th scope="col" class="sayi">Ortalama değişim</th>'));
    assert(sube.includes('<tr><th scope="row">12/A</th><td class="sayi">2</td><td class="sayi et-yukari">+5,00</td>') && sube.includes('<td class="sayi et-yukari">+2,50</td></tr>'), 'şube, n, mean change, contribution');
    assert(sube.includes('<tr><th scope="row">12/D</th><td class="sayi">0</td><td class="sayi et-esit">—</td>'), 'a şube without a pair has no change');
    assert(sube.includes('<tfoot><tr><th scope="row">12. sınıflar</th><td class="sayi">4</td>'));
    // Every number cell is right-aligned (class sayi), also in the headers above them.
    assert(!/<td class="(?!sayi|dp-cubuk-hucre)[^"]*">[+−\d]/.test(kaynakH), 'no left-aligned number cell');
    // One şube: lessons only.
    elle(iki, kisiler, '12/A'); const t = run('DPANO.kaynakBolumleri({m:__m,s:1,K:__m.K})'); assert(!t.includes('Şubelere göre') && t.includes('Derslere göre'));
  });
  await check('Isı haritası: şubeler of a grade, the students of one şube, empty cells, a colour scale capped at the 90th percentile', async () => {
    elle(iki, kisiler);
    let h = get('DPANO.isiHaritasi(DPANO.degisimKaynagi(__m,1),__m.K)');
    assert.deepEqual(h.kolonlar.map(c => c.ad), ['Matematik', 'Fizik', 'Türkçe', 'Toplam']);
    assert.deepEqual(h.satirlar.map(r => [r.ad, r.n, r.v]), [['12. sınıflar ortalaması', 4, [2, -0.5, 1.5, 3]], ['12/A', 2, [3, -0.5, 2.5, 5]], ['12/B', 1, [1, -2, 1, 0]], ['12/C', 1, [1, 1, 0, 2]], ['12/D', 0, [null, null, null, null]]]);
    // 16 values, 0 0 .5 .5 1 1 1 1 1.5 2 2 2 2.5 3 3 5: their 90th percentile is 3.
    assert.equal(h.cap, 3);
    const renk = v => run(`DPANO.isiRengi(${v},3)`);
    assert.equal(renk(5), renk(3), 'beyond the cap the colour stays'); assert.equal(renk(3), 'background:color-mix(in srgb,var(--e-ok) 55%,var(--e-panel))');
    assert.equal(renk(-5), 'background:color-mix(in srgb,var(--e-bad) 55%,var(--e-panel))'); assert.equal(renk(-3), renk(-5));
    assert.equal(renk(1.5), 'background:color-mix(in srgb,var(--e-ok) 28%,var(--e-panel))', 'half the cap, half the colour'); assert.equal(renk(-1.5), 'background:color-mix(in srgb,var(--e-bad) 28%,var(--e-panel))');
    assert.equal(renk(0), ''); assert.equal(renk('null'), ''); assert.equal(run('DPANO.isiRengi(2,0)'), '', 'all zero: no colour');
    assert.equal(get('DPANO.isiRengi(0.5,3)'), 'background:color-mix(in srgb,var(--e-ok) 9%,var(--e-panel))');
    const s = run('DPANO.kaynakBolumleri({m:__m,s:1,K:__m.K})'), isi = s.slice(s.indexOf('id="dpIsi"'));
    assert(isi.includes('<th scope="col">Şube</th><th scope="col" class="sayi">Matematik</th><th scope="col" class="sayi">Fizik</th><th scope="col" class="sayi">Türkçe</th><th scope="col" class="sayi dp-isi-toplam">Toplam</th>'));
    assert(isi.includes('<span>renk: değişim (net)</span>') && isi.includes('−3,0 ve altı') && isi.includes('+3,0 ve üstü'));
    assert(isi.includes('<th scope="row" class="dp-isi-ad">12/A <span class="mini">2 öğrenci</span></th><td class="sayi dp-isi-hucre" style="background:color-mix(in srgb,var(--e-ok) 55%,var(--e-panel))" title="12/A · Matematik: +3,00 net">+3,0</td>'));
    assert(isi.includes('<td class="sayi dp-isi-hucre" style="background:color-mix(in srgb,var(--e-bad) 37%,var(--e-panel))" title="12/B · Fizik: −2,00 net">−2,0</td>'), '2 of a cap of 3');
    assert(isi.includes('<td class="sayi dp-isi-hucre dp-isi-toplam" style="" title="12/B · Toplam: 0,00 net">0,0</td>'), 'no change, no colour');
    assert.equal((isi.match(/<td class="sayi dp-isi-hucre bos"><\/td>/g) || []).length, 4, 'a şube without a pair has empty cells');
    // One şube: its students, the biggest rise first.
    elle(iki, kisiler, '12/A'); h = get('DPANO.isiHaritasi(DPANO.degisimKaynagi(__m,1),__m.K)');
    assert.deepEqual(h.satirlar.map(r => [r.ad, r.no ?? null, r.v]), [['12/A ortalaması', null, [3, -0.5, 2.5, 5]], ['Sentetik Ada', '1001', [3, -1, 4, 6]], ['Sentetik Bora', '1002', [3, 0, 1, 4]]]);
    const t = run('DPANO.kaynakBolumleri({m:__m,s:1,K:__m.K})'), isi2 = t.slice(t.indexOf('id="dpIsi"'));
    assert(isi2.includes('<th scope="col">Öğrenci</th>') && isi2.includes('Öğrenciler · Sentetik Deneme 1 → Sentetik Deneme 2'));
    assert(isi2.includes('data-ogrenci-karti="1001">Sentetik Ada</button>') && isi2.indexOf('Sentetik Ada') < isi2.indexOf('Sentetik Bora'), 'names open Öğrenci kartı');
  });
  await check('Değişimin kaynağı and Isı haritası on the board: after Kolaydan zora, for windows and Seç; hidden with one exam', async () => {
    await loadAll();
    for (const aralik of [1, 'sec']) {
      run(`EK.dpAralik=${JSON.stringify(aralik)}`);
      const h = run('DPANO.icerik()');
      assert(h.indexOf('id="dpZorluk"') < h.indexOf('id="dpKaynak"') && h.indexOf('id="dpKaynak"') < h.indexOf('id="dpIsi"') && h.indexOf('id="dpIsi"') < h.indexOf('id="dpOgrenciler"'), 'between the lessons and the students');
      const k = st(`st=>{const k=DPANO.degisimKaynagi(st.m,st.s);return {toplam:k.toplam,ayni:st.m.ozet[st.s].ayni,n:k.n,ayniN:st.m.ozet[st.s].ayniN,parcalar:k.parcalar.map(p=>p.katki),subeler:k.subeler.map(x=>x.katki)}}`);
      yakin(k.toplam, k.ayni, 'the same students’ mean change'); assert.equal(k.n, k.ayniN); yakin(topla(k.parcalar), k.toplam); yakin(topla(k.subeler), k.toplam);
      assert(h.includes('(aynı ' + k.n + ' öğrenci)'));
    }
    run("EK.dpAralik=undefined;EK.dpKapsam='12/A'");
    const a = run('DPANO.icerik()'); assert(a.includes('id="dpKaynak"') && !a.includes('Şubelere göre')); assert.match(a.slice(a.indexOf('id="dpIsi"')), /<th scope="col">Öğrenci<\/th>/);
    // One exam: no comparison, nothing to split.
    reset(); put('L', [list('once', 'T'), list('once', 'F')]); await run('siralamaKaydet(L)');
    run("EK.dpKapsam=undefined"); const bir = run('DPANO.icerik()'); assert(!bir.includes('id="dpKaynak"') && !bir.includes('id="dpIsi"'), 'one exam hides both');
    run('D.siralama=null'); const bos = run('DPANO.icerik()'); assert(!bos.includes('id="dpKaynak"') && !bos.includes('id="dpIsi"'), 'no lists hide both');
  });
  // ---- Karşılaştır by date: Tüm dönem, Son 1 ay, Son 3 ay ----
  const gun = iso => run('gunNo("' + iso + '")');
  await check('ayGeri: the same date k months earlier, clamped to the end of a shorter month, across the year', () => {
    const geri = (iso, k) => get(`new Date(DPANO.ayGeri(gunNo("${iso}"),${k})*864e5).toISOString().slice(0,10)`);
    assert.equal(geri('2026-10-30', 1), '2026-09-30'); assert.equal(geri('2026-03-31', 1), '2026-02-28'); assert.equal(geri('2026-05-31', 3), '2026-02-28');
    assert.equal(geri('2026-01-15', 3), '2025-10-15'); assert.equal(geri('2028-03-31', 1), '2028-02-29', 'leap year'); assert.equal(geri('2026-08-31', 3), '2026-05-31');
  });
  await check('Tüm dönem, Son 1 ay, Son 3 ay compare the earliest exam of the range with the latest (hand-worked); Tüm dönem is the default', () => {
    // Six exams; 1001 and 1003 sit all of them. Total nets (A + B + C): 1001 18 19 20 21 22 24, 1003 13 14 15 16 17 18 → means 15.5 16.5 17.5 18.5 19.5 21.
    const adlar = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'], tarih = ['2026-07-02', '2026-08-20', '2026-09-18', '2026-10-02', '2026-10-16', '2026-10-30'];
    const a = [[10, 5, 3], [11, 5, 3], [12, 5, 3], [13, 5, 3], [14, 5, 3], [15, 6, 3]], c = [[6, 6, 1], [7, 6, 1], [8, 6, 1], [9, 6, 1], [10, 6, 1], [11, 6, 1]];
    const sinavlar = adlar.map((ad, i) => ['Sentetik ' + ad, { 1001: a[i], 1003: c[i] }]);
    elle(sinavlar, kisiler, 'g12', null, tarih.map(gun));
    // 30 Ekim − 1 ay = 30 Eylül → the first exam on or after it is 2 Ekim (4th); − 3 ay = 30 Temmuz → 20 Ağustos (2nd).
    assert.deepEqual(get('__m.pencere.tum'), { once: [0, 0], son: [5, 5] }); assert.deepEqual(get('__m.pencere["1ay"]'), { once: [3, 3], son: [5, 5] }); assert.deepEqual(get('__m.pencere["3ay"]'), { once: [1, 1], son: [5, 5] });
    assert.deepEqual(get('Object.keys(__m.pencere).filter(k=>__m.pencere[k].once[0]===__m.pencere[k].once[1]).sort()'), ['1', '1ay', '3ay', 'sec', 'tum'], 'Son deneme is exam-to-exam too, the others compare means of several exams');
    const yakinOzet = (k, once, son, fark) => { const o = get(`__m.ozet[${JSON.stringify(k)}]`); yakin(o.once, once); yakin(o.son, son); yakin(o.fark, fark); };
    yakinOzet('tum', 15.5, 21, 5.5); yakinOzet('3ay', 16.5, 21, 4.5); yakinOzet('1ay', 18.5, 21, 2.5);
    // The same students' own changes: 1001 +6 / +5 / +3, 1003 +5 / +4 / +2 → means 5.5, 4.5, 2.5.
    for (const [k, f1001, f1003] of [['tum', 6, 5], ['3ay', 5, 4], ['1ay', 3, 2]]) {
      const o = get(`__m.ogrenciler.map(o=>[o.no,o.k[${JSON.stringify(k)}].fark])`); assert.deepEqual(Object.fromEntries(o), { 1001: f1001, 1003: f1003 });
    }
    // Değişimin kaynağı splits the range exactly: Matematik (+5 / +4 / +2), Fizik (+0.5 / +0.5 / +0.5), Türkçe 0.
    for (const [k, mat, fiz] of [['tum', 5, .5], ['3ay', 4, .5], ['1ay', 2, .5]]) { const d = kaynak(k); assert.deepEqual(d.parcalar.map(p => [p.kod, p.katki]), [['A', mat], ['B', fiz], ['C', 0]], k); yakin(d.toplam, mat + fiz); }
    // Fewer than two exams in the range: the option is not there (a window needs two exams); Tüm dönem needs two exams in all.
    elle(sinavlar.slice(0, 2), kisiler, 'g12', null, ['2026-07-02', '2026-12-20'].map(gun));
    assert.deepEqual(get('Object.keys(__m.pencere).sort()'), ['1', 'sec', 'tum'], 'the only other exam is more than 3 months back');
    elle(sinavlar.slice(0, 1), kisiler, 'g12', null, [gun('2026-07-02')]); assert.deepEqual(get('Object.keys(__m.pencere)'), []);
  });
  await check('the board with Tüm dönem / Son 1 ay / Son 3 ay: default, buttons, sentence, cards, table, Değişimin kaynağı, Isı haritası, raporlar', async () => {
    // Four exams: two taramas on 10 Haz and 5 Ağu, then the two denemeler of 18 Eyl and 2 Eki.
    const eski = (ad, tarih) => ['T', 'F'].map(t => listOf({ ...SINAVLAR.once[t], ad, tarih }));
    put('L', [...eski('Sentetik Tarama 0', '10.06.2026'), ...eski('Sentetik Tarama 00', '05.08.2026'), list('once', 'T'), list('once', 'F'), list('sonra', 'T'), list('sonra', 'F')]); await run('siralamaKaydet(L)');
    assert.deepEqual(st('st=>st.m.sinavlar.map(s=>s.ad)'), ['Sentetik Tarama 0', 'Sentetik Tarama 00', 'Sentetik Deneme 1', 'Sentetik Deneme 2']);
    assert.deepEqual(st('st=>[st.s,st.m.pencere.tum,st.m.pencere["1ay"],st.m.pencere["3ay"]]'), ['tum', { once: [0, 0], son: [3, 3] }, { once: [2, 2], son: [3, 3] }, { once: [1, 1], son: [3, 3] }], '2 Eki − 1 ay = 2 Eyl, − 3 ay = 2 Tem');
    const ids = st('st=>st.m.sinavlar.map(s=>s.id)'), ort = st('st=>st.m.sinavlar.map(s=>s.ort)');
    let h = run('DPANO.icerik()');
    // Buttons: the three date ranges first, then the exam windows; the default one is pressed.
    const dugme = h.match(/aria-label="Karşılaştır">[\s\S]*?<\/div>/)[0], adlar = [...dugme.matchAll(/data-dp-aralik="([^"]+)" aria-pressed="(\w+)"[^>]*>([^<]+)</g)].map(x => [x[1], x[2], x[3]]);
    assert.deepEqual(adlar, [['tum', 'true', 'Tüm dönem'], ['1ay', 'false', 'Son 1 ay'], ['3ay', 'false', 'Son 3 ay'], ['1', 'false', 'Son deneme'], ['2', 'false', 'Son 2 deneme'], ['3', 'false', 'Son 3 deneme'], ['sec', 'false', 'Seç']]);
    for (const [k, ad, bas, onceI] of [['tum', 'Tüm dönem', '10 Haz', 0], ['1ay', 'Son 1 ay', '18 Eyl', 2], ['3ay', 'Son 3 ay', '5 Ağu', 1]]) {
      run(`EK.dpAralik=${JSON.stringify(k)}`); h = run('DPANO.icerik()');
      assert.match(h, new RegExp('<p class="et-cumle">12\\. sınıflar · ' + ad + ' \\(' + bas + ' → 2 Eki\\): TYT ortalaması <b>[\\d,]+</b> net, başlangıçtaki denemeye göre <b>[+−][\\d,]+</b>'), k);
      assert(h.includes('data-dp-aralik="' + k + '" aria-pressed="true"'), k);
      const o = st(`st=>[st.m.onceki,st.m.simdi,st.m.ozet[${JSON.stringify(k)}].fark]`); assert.deepEqual(o.slice(0, 2), [onceI, 3]); yakin(o[2], ort[3] - ort[onceI], k + ': the latest mean minus the first exam of the range');
      assert(h.includes('<span class="mini">Katılımcı ortalaması · ' + ad.toLocaleLowerCase('tr-TR') + '</span>'), 'the card names the range'); assert.match(h, /<span class="mini">başta: [\d,]+<\/span>/);
      assert(h.includes('Sırası yükselen · başlangıca göre'));
      // Değişimin kaynağı and Isı haritası say which range; their numbers are the same students' change from the range's first exam.
      assert(h.includes('<span class="mini">' + ad + ': ' + bas + ' → 2 Eki (' + st(`st=>st.m.sinavlar[${onceI}].ad`) + ' → Sentetik Deneme 2) · TYT</span>'), 'Değişimin kaynağı names the window');
      assert(h.includes('Öğrenciler · ' + ad + ': ') || h.includes('Şubeler · ' + ad + ': '), 'Isı haritası names the window');
      const k2 = st(`st=>{const k=DPANO.degisimKaynagi(st.m,st.s);return {t:k.toplam,a:st.m.ozet[st.s].ayni,p:k.parcalar.reduce((a,p)=>a+p.katki,0),s:k.subeler.reduce((a,p)=>a+p.katki,0)}}`);
      yakin(k2.t, k2.a); yakin(k2.p, k2.t); yakin(k2.s, k2.t);
      // The table: Başta and Sonda, the rank change since the first exam of the range; the reports compare the same pair.
      assert(h.includes('<button type="button" data-dp-sira="son">Sonda</button>') && h.includes('<button type="button" data-dp-sira="once">Başta</button>'), 'table headers');
      assert(h.includes('data-sr-onceki="' + ids[onceI] + '"') && h.includes('data-sr-simdi="' + ids[3] + '"'), 'Raporlar compare the range’s first exam with the latest');
      assert.match(h, new RegExp('<h2>En çok değişenler</h2><span class="mini">' + ad + ': ' + bas + ' → 2 Eki</span>'));
    }
    // Seç keeps working next to them, and an old numeric choice too.
    run(`EK.dpAralik='sec';EK.dpOnceki=${JSON.stringify(ids[0])};EK.dpSimdiki=${JSON.stringify(ids[3])}`); assert.deepEqual(st('st=>[st.s,st.m.onceki,st.m.simdi]'), ['sec', 0, 3]); assert(get('(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.genel(DPANO.durumAl(t),720).svg})()').includes('data-tutamak="once"'), 'the Seç lines are still there');
    run('EK.dpAralik=2'); assert.deepEqual(st('st=>[st.s,st.m.onceki,st.m.simdi]'), [2, 2, 3]);
    assert(!get('(()=>{const {t}=DPANO.veriAl();return DPANO.GRAFIKLER.genel(DPANO.durumAl(t),720).svg})()').includes('data-tutamak='), 'the other windows have no handles');
    // A range with a single exam is off; an unavailable choice falls back to the default.
    reset(); put('L', [...eski('Sentetik Tarama 0', '10.06.2026'), list('sonra', 'T'), list('sonra', 'F')]); await run('siralamaKaydet(L)');
    run("EK.dpAralik='3ay'"); h = run('DPANO.icerik()');
    assert.match(h, /data-dp-aralik="1ay" aria-pressed="false" disabled/); assert.match(h, /data-dp-aralik="3ay" aria-pressed="false" disabled/); assert.match(h, /data-dp-aralik="tum" aria-pressed="true"/, 'falls back to Tüm dönem');
  });
  // ---- Türkiye’ye göre: the change net of the Türkiye average's change over the same window (hand-worked, synthetic) ----
  // Six weekly 12. sınıf exams, TYT = Türkçe + Matematik + Geometri (Geometri 1 for everybody). Totals of the students and of Türkiye:
  //   1001 ADA  12/A  37 36 35 34 33 32      1002 BORA 12/A  31 30 27 26 23 21      1003 CEMRE 12/B  26 27 28 29 30 31      1004 DOĞA 12/B  16 (the last exam only)
  //   Türkiye         31 30 28 27 25 24
  const TRADLAR = ['27-YKS-1201', '27-YKS-1202', '27-YKS-1203', '27-YKS-1204', '27-YKS-1205', '27-YKS-1206'];
  const TRTARIH = ['03.09.2026', '10.09.2026', '17.09.2026', '24.09.2026', '01.10.2026', '08.10.2026'];
  const TRTUR = { 1001: [24, 24, 23, 23, 22, 22], 1002: [20, 19, 17, 17, 15, 14], 1003: [17, 18, 18, 19, 20, 20], 1004: [null, null, null, null, null, 10] };
  const TRMAT = { 1001: [12, 11, 11, 10, 10, 9], 1002: [10, 10, 9, 8, 7, 6], 1003: [8, 8, 9, 9, 9, 10], 1004: [null, null, null, null, null, 5] };
  const TRAD = { 1001: 'SENTETİK ADA', 1002: 'SENTETİK BORA', 1003: 'SENTETİK CEMRE', 1004: 'SENTETİK DOĞA' }, TRSUBE = { 1001: '301 12/A', 1002: '301 12/A', 1003: '201 12/B', 1004: '201 12/B' };
  // AYT SAY in the last three exams for ADA (50 49 48) and CEMRE (25 26 27).
  const TRAYT = { 1001: [18, 19, 20].reverse().map(m => ({ AMAT: m, AGEO: 8, AFİZ: 10, AKİM: 6, ABİY: 6 })), 1003: [10, 11, 12].map(m => ({ AMAT: m, AGEO: 4, AFİZ: 5, AKİM: 3, ABİY: 3 })) };
  const TYTK = ['TÜR', 'TAR', 'COĞ', 'FEL', 'DİN', 'S.F', 'MAT', 'GEO', 'FİZ', 'KİM', 'BİY'], AYTK = ['EDB', 'TAR1', 'COĞ1', 'TAR2', 'COĞ2', 'FELGR', 'DİN2', 'S.F2', 'AMAT', 'AGEO', 'AFİZ', 'AKİM', 'ABİY'];
  const trSatir = (no, e, tur) => {
    if (TRTUR[no][e] === null) return null;
    const all = { 'TÜR': TRTUR[no][e], MAT: TRMAT[no][e], GEO: 1, ...(tur === 'F' && e >= 3 && TRAYT[no] ? TRAYT[no][e - 3] : {}) }, keys = tur === 'F' ? [...TYTK, ...AYTK] : TYTK;
    return { no: String(no), ad: TRAD[no], snf: TRSUBE[no], n: keys.map(k => all[k] ?? null), dy: keys.map(k => all[k] ? all[k] + '/0' : null), p: [0, 0, 0, 0], r: ['', '', '', ''] };
  };
  const trOkul = () => ({ surum: 1, sinavlar: TRADLAR.map((ad, e) => {
    const slot = tur => ({ tarih: TRTARIH[e], katilim: ['4', '4', '4'], kurum: null, ogr: [1001, 1002, 1003, 1004].map(no => trSatir(no, e, tur)).filter(Boolean) });
    return { id: run('denemeAdAnahtari')(ad), ad, okul: 'SENTETİK ANADOLU LİSESİ', ts: 2000 + e, T: slot('T'), ...(e >= 3 ? { F: slot('F') } : {}) };
  }) });
  // The Türkiye lists: Türkçe 20 19 18 17 16 15, Matematik 10 10 9 9 8 8, Geometri 1; AYT (last three exams) Matematik 18 17 15 + Geometri 6, Fizik 9, Kimya 5, Biyoloji 5 (SAY 43 42 40).
  const trRapor = (e, dersler = null) => {
    const TUR = [20, 19, 18, 17, 16, 15], MAT = [10, 10, 9, 9, 8, 8], AMAT = [18, 17, 15];
    const d = dersler || [['TÜRKÇE-T', 40, TUR[e]], ['MATEMATİK-T', 30, MAT[e]], ['GEOMETRİ-T', 10, 1], ...(e >= 3 ? [['MATEMATİK-A', 30, AMAT[e - 3]], ['GEOMETRİ-A', 10, 6], ['FİZİK-A', 14, 9], ['KİMYA-A', 13, 5], ['BİYOLOJİ-A', 13, 5]] : [])];
    return { ad: TRADLAR[e], liste: 'kolej', yaz: null, dersler: d.map(([kod, soru, genel]) => ({ kod, soru, genel, satir: [{ sira: 1, ad: 'SENTETİK OKUL', net: Math.min(soru, genel + 5) }, { sira: 2, ad: 'SENTETİK KOLEJ', net: genel }] })) };
  };
  const trKur = async raporlar => { run('delete D.turkiye'); await new Promise(r => setTimeout(r, 3)); if (!raporlar.length) return; put('R', raporlar); await run('TURKIYE.raporEkle(R)'); };
  const trYukle = async aralik => { put('SR', trOkul()); run('D.siralama=SR'); await trKur(aralik.map(e => trRapor(e))); };
  const trSatiriMetni = () => { const m = /<p class="mini dp-tr-satir" id="dpTrSatir">([\s\S]*?)<\/p>/.exec(run('DPANO.icerik()')); return m ? m[1].replace(/<[^>]+>/g, '') : null; };
  // The Türkiye’ye göre cell (attributes and text) of every student row (by number) and average row (by name) of Tüm öğrenciler.
  const trHucreler = () => {
    const h = run('DPANO.icerik()'), tablo = h.slice(h.indexOf('id="dpTablo"'), h.indexOf('id="dpKisi"')), out = {};
    for (const m of tablo.matchAll(/<tr(?: data-dp-ogr="(\d+)"[^>]*| class="dp-ort")>([\s\S]*?)<\/tr>/g)) {
      const tds = [...m[2].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map(x => ({ attr: x[1], yazi: x[2].replace(/<[^>]+>/g, '') }));
      out[m[1] || tds[0].yazi.replace(/ ortalaması.*/, '')] = tds[5];   // Öğrenci Şube Şimdiki Önceki Net artışı Türkiye’ye göre …
    }
    return out;
  };
  const yk = (a, b, mesaj) => assert(Math.abs(a - b) < 1e-5, (mesaj || '') + ' ' + a + ' ≠ ' + b);
  const yazilar = (c, nolar = [1001, 1002, 1003]) => nolar.map(n => c[n].yazi);
  const pencere = (a, ek = '') => run(`EK.dpAralik=${JSON.stringify(a)};${ek}`);
  await check('Türkiye’ye göre: the change minus the Türkiye average’s change over each window; students, group rows and the line above the table (hand-worked)', async () => {
    await trYukle([0, 1, 2, 3, 4, 5]);
    assert.equal(st('st=>st.tr.var'), true); assert.deepEqual(st('st=>st.m.sinavlar.map(s=>s.ad)'), TRADLAR);
    // [window, Türkiye change, line, ADA, BORA, CEMRE]. Own changes: tum −5 −10 +5; 1ay (10 Eyl → 8 Eki) −4 −9 +4; Son deneme −1 −2 +1; Son 2 deneme −2 −4,5 +2; Son 3 deneme −3 −6 +3.
    const beklenen = [
      ['tum', -7, 'Türkiye ortalaması bu aralıkta ▼7,0 net (27-YKS-1201 → 27-YKS-1206)', ['▲2', '▼3', '▲12']],
      ['3ay', -7, 'Türkiye ortalaması bu aralıkta ▼7,0 net (27-YKS-1201 → 27-YKS-1206)', ['▲2', '▼3', '▲12']],
      ['1ay', -6, 'Türkiye ortalaması bu aralıkta ▼6,0 net (27-YKS-1202 → 27-YKS-1206)', ['▲2', '▼3', '▲10']],
      [1, -1, 'Türkiye ortalaması bu aralıkta ▼1,0 net (27-YKS-1205 → 27-YKS-1206)', ['0', '▼1', '▲2']],
      // Son 2 deneme: the mean of the two exams on each side, as the students’ own: Türkiye (28+27)/2 = 27,5 → (25+24)/2 = 24,5.
      [2, -3, 'Türkiye ortalaması bu aralıkta ▼3,0 net (27-YKS-1203 – 27-YKS-1204 ort. → 27-YKS-1205 – 27-YKS-1206 ort.)', ['▲1', '▼1,5', '▲5']],
      // Son 3 deneme: (31+30+28)/3 = 29,667 → (27+25+24)/3 = 25,333, −4,333; ADA −3 + 4,333 = 1,333, BORA −6 + 4,333, CEMRE +3 + 4,333.
      [3, -13 / 3, 'Türkiye ortalaması bu aralıkta ▼4,3 net (27-YKS-1201 – 27-YKS-1203 ort. → 27-YKS-1204 – 27-YKS-1206 ort.)', ['▲1,33', '▼1,67', '▲7,33']]];
    for (const [a, tr, satir, hucre] of beklenen) {
      pencere(a); yk(st('st=>st.tr.fark'), tr, String(a)); assert.equal(trSatiriMetni(), satir, String(a));
      const c = trHucreler(); assert.deepEqual(yazilar(c), hucre, String(a)); assert(c[1001].attr.includes('class="sayi '), 'a numeric cell');
      assert(c[1001].attr.includes(hucre[0].startsWith('▲') ? 'et-yukari' : hucre[0] === '0' ? 'et-esit' : 'et-asagi') && c[1002].attr.includes('et-asagi') && c[1003].attr.includes('et-yukari'), 'coloured by direction ' + a);
      assert.equal(c[1004].yazi, '—', 'a student without a change has no Türkiye’ye göre'); assert(!c[1001].attr.includes('title='), 'real averages carry no mark');
    }
    pencere('tum'); const k = st('st=>Object.fromEntries(st.mo.ogrenciler.map(o=>[o.no,o.k.tum.trFark]))'); yk(k[1001], 2); yk(k[1002], -3); yk(k[1003], 12); assert.equal(k[1004], null);
    // Group rows: their mean change minus the Türkiye change. 12/A (−5, −10) −7,5 → ▼0,5; 12/B 23,5 − 26 = −2,5 → ▲4,5; the grade 25 − 31,333 = −6,333 → ▲0,67.
    const g = trHucreler(); assert.deepEqual([g['12. sınıflar'], g['12/A'], g['12/B']].map(x => x.yazi), ['▲0,67', '▼0,5', '▲4,5']);
    assert(g['12/A'].attr.includes('et-asagi') && g['12/B'].attr.includes('et-yukari'));
    pencere(2); assert.equal(trHucreler()['12/A'].yazi, '▼0,25', '12/A: 30,5 → 27,25 is −3,25 against −3');
    // The status badge stays net-based: ADA fell 5 net although she beat Türkiye by 2.
    pencere('tum'); const h = run('DPANO.icerik()'), satir = h.match(/<tr data-dp-ogr="1001"[\s\S]*?<\/tr>/)[0]; assert(satir.includes('et-durum Falling') && satir.includes('>Düşüyor<'));
    assert(h.includes('<th scope="col" class="sayi" aria-sort="none"><button type="button" data-dp-sira="trFark">Türkiye’ye göre</button>'));
    assert(h.indexOf('data-dp-sira="fark"') < h.indexOf('data-dp-sira="trFark"') && h.indexOf('data-dp-sira="trFark"') < h.indexOf('data-dp-sira="yuzde"'), 'the column follows Net artışı');
    // The line sits above the table, below the title and the Sırala pills.
    assert(h.indexOf('data-dp-olcut="trfark"') < h.indexOf('id="dpTrSatir"') && h.indexOf('id="dpTrSatir"') < h.indexOf('id="dpAra"'));
  });
  await check('Türkiye’ye göre: sorting by the column and by the Sırala pill, ranks, students without a value last', async () => {
    await trYukle([0, 1, 2, 3, 4, 5]); pencere('tum');
    const sira = () => [...run('DPANO.icerik()').matchAll(/<tr data-dp-ogr="(\d+)"/g)].map(x => x[1]);
    run("EK.dpSira='trFark';EK.dpSiraYon='azalan'"); assert.deepEqual(sira(), ['1003', '1001', '1002', '1004'], 'largest first, DOĞA (no value) last');
    run("EK.dpSiraYon='artan'"); assert.deepEqual(sira(), ['1002', '1001', '1003', '1004'], 'smallest first, still without a value last');
    assert(run('DPANO.icerik()').includes('aria-sort="ascending"><button type="button" data-dp-sira="trFark">'));
    // The Sırala pill ranks the students by it and numbers them again (Sıra).
    run("EK.dpOlcut='trfark';EK.dpSira='sira';EK.dpSiraYon='artan'");
    assert.equal(st('st=>st.olcut'), 'trfark'); assert.deepEqual(sira(), ['1003', '1001', '1002', '1004']);
    assert.deepEqual(st('st=>Object.fromEntries(st.mo.ogrenciler.map(o=>[o.no,o.sira]))'), { 1001: 2, 1002: 3, 1003: 1, 1004: null });
    let h = run('DPANO.icerik()');
    assert.match(h, /data-dp-olcut="trfark" aria-pressed="true"/); assert(h.includes('<th scope="col" class="sayi dp-secili" aria-sort="none"><button type="button" data-dp-sira="trFark">Türkiye’ye göre</button>'));
    assert(!/<th scope="col" class="[^"]*et-dar-gizle[^"]*"[^>]*><button type="button" data-dp-sira="trFark"/.test(h), 'never folded away on a phone');
    assert(h.includes('<th scope="col" class="sayi et-dar-gizle" aria-sort="none"><button type="button" data-dp-sira="yuzde">'), '% artış folds away on a phone');
    pencere(1); assert.deepEqual(st('st=>Object.fromEntries(st.mo.ogrenciler.map(o=>[o.no,o.sira]))'), { 1001: 2, 1002: 3, 1003: 1, 1004: null }, 'Son deneme: 0, −1, +2');
    // Net returns to the default order (the şimdiki net, largest first: 32 31 21 16).
    run("EK.dpOlcut='net';EK.dpSira='son';EK.dpSiraYon='azalan'"); pencere('tum'); assert.deepEqual(sira(), ['1001', '1003', '1002', '1004']); assert.equal(st('st=>st.olcut'), 'net');
  });
  await check('Türkiye’ye göre: an exam without a Türkiye list uses the tahmini average, marked with ~ and a title; real averages carry no mark', async () => {
    // Lists for the first five exams only: the sixth is its school mean 25 (DOĞA sits it too: 32 21 31 16) minus the usual gap 2 (median of 0,333 1 2 2,667 3,667) = 23.
    await trYukle([0, 1, 2, 3, 4]); pencere('tum');
    assert.equal(st('st=>st.tr.tahmini'), true); yk(st('st=>st.tr.fark'), -8);   // 31 → 23
    assert.equal(trSatiriMetni(), 'Türkiye ortalaması bu aralıkta ▼8,0~ net (27-YKS-1201 → 27-YKS-1206)');
    let h = run('DPANO.icerik()'); assert(h.includes('<b title="tahmini Türkiye ortalaması">▼8,0~</b>'));
    let c = trHucreler(); assert.deepEqual(yazilar(c), ['▲3~', '▼2~', '▲13~']); assert(c[1002].attr.includes('title="tahmini Türkiye ortalaması"'));
    assert.equal(c[1004].yazi, '—'); assert(!c[1004].attr.includes('title='), 'no value, no mark');
    // Son deneme (the estimated exam against the real one before it): Türkiye 25 → 23 = −2; Son 2 deneme: 27,5 → (25+23)/2 = 24, −3,5.
    pencere(1); yk(st('st=>st.tr.fark'), -2); assert.equal(st('st=>st.tr.tahmini'), true); assert.deepEqual(yazilar(trHucreler()), ['▲1~', '0~', '▲3~']);
    pencere(2); yk(st('st=>st.tr.fark'), -3.5); assert.equal(trSatiriMetni(), 'Türkiye ortalaması bu aralıkta ▼3,5~ net (27-YKS-1203 – 27-YKS-1204 ort. → 27-YKS-1205 – 27-YKS-1206 ort.)');
    assert.deepEqual(yazilar(trHucreler()), ['▲1,5~', '▼1~', '▲5,5~']);
    // A window on real averages only is not marked: Seç 1201 → 1205 (31 → 25).
    run(`EK.dpAralik='sec';EK.dpOnceki=${JSON.stringify(idOf(TRADLAR[0]))};EK.dpSimdiki=${JSON.stringify(idOf(TRADLAR[4]))}`);
    assert.equal(st('st=>st.tr.tahmini'), false); yk(st('st=>st.tr.fark'), -6); h = run('DPANO.icerik()'); assert(!h.includes('~') && !h.includes('tahmini Türkiye ortalaması'));
    assert.equal(trSatiriMetni(), 'Türkiye ortalaması bu aralıkta ▼6,0 net (27-YKS-1201 → 27-YKS-1205)');
    // Own changes −4, −8, +4 against −6.
    assert.deepEqual(yazilar(trHucreler()), ['▲2', '▼2', '▲10']);
  });
  await check('Türkiye’ye göre: no Türkiye data for the window shows a dash, a line saying so, a disabled pill and falls back to Net', async () => {
    await trYukle([]); pencere('tum');
    assert.equal(st('st=>st.tr.var'), false); assert.equal(trSatiriMetni(), 'Bu aralıkta Türkiye ortalaması yok');
    assert.deepEqual(yazilar(trHucreler(), [1001, 1002, 1003, 1004, '12. sınıflar']), ['—', '—', '—', '—', '—']);
    assert.match(run('DPANO.icerik()'), /data-dp-olcut="trfark" aria-pressed="false" disabled/);
    run("EK.dpOlcut='trfark';EK.dpSira='sira';EK.dpSiraYon='artan'"); assert.equal(st('st=>st.olcut'), 'net', 'cannot rank by what is not there'); assert(!/NaN|undefined/.test(run('DPANO.icerik()')));
    // Lists exist, but none of the board's exams has one.
    await trKur([{ ...trRapor(0), ad: '27-YKS-9999' }]); assert.equal(st('st=>st.tr.var'), false); assert.equal(trSatiriMetni(), 'Bu aralıkta Türkiye ortalaması yok');
    // AYT Toplam has no Türkiye total to compare with.
    await trYukle([0, 1, 2, 3, 4, 5]); run("EK.dpOlcu='AYT:Toplam'"); assert.equal(st('st=>st.sec.key'), 'AYT:Toplam'); assert.equal(st('st=>st.tr.var'), false);
    assert.equal(trSatiriMetni(), 'Bu aralıkta Türkiye ortalaması yok'); assert.deepEqual([...new Set(Object.values(trHucreler()).map(x => x.yazi))], ['—']);
  });
  await check('Türkiye’ye göre: AYT measures use their own Türkiye total (SAY)', async () => {
    await trYukle([0, 1, 2, 3, 4, 5]); run("EK.dpOlcu='AYT:SAY'"); pencere('tum');
    assert.equal(st('st=>st.sec.key'), 'AYT:SAY'); assert.deepEqual(st('st=>st.m.sinavlar.map(s=>s.ad)'), TRADLAR.slice(3));
    // ADA 50 → 48 (−2), CEMRE 25 → 27 (+2); Türkiye 43 → 40 (−3) → ▲1 and ▲5.
    yk(st('st=>st.tr.fark'), -3); assert.equal(trSatiriMetni(), 'Türkiye ortalaması bu aralıkta ▼3,0 net (27-YKS-1204 → 27-YKS-1206)');
    assert.deepEqual(yazilar(trHucreler(), [1001, 1003]), ['▲1', '▲5']);
  });
  await check('Türkiye’ye göre: a single lesson’s net follows that lesson’s Türkiye average per exam; tests add their lessons; missing lists show a dash', async () => {
    await trYukle([0, 1, 2, 3, 4, 5]); run("EK.dpOgrNet='MAT'"); pencere('tum');
    assert.equal(st('st=>st.ogrDers.kod'), 'MAT'); assert.equal(st('st=>st.tr.tahmini'), false, 'a lesson has no tahmini average');
    // Matematik: Türkiye 10 → 8 (−2); ADA 12 → 9 (−3) → ▼1; BORA 10 → 6 (−4) → ▼2; CEMRE 8 → 10 (+2) → ▲4.
    yk(st('st=>st.tr.fark'), -2); assert.equal(trSatiriMetni(), 'Türkiye ortalaması bu aralıkta ▼2,0 net (27-YKS-1201 → 27-YKS-1206)');
    assert.deepEqual(yazilar(trHucreler()), ['▼1', '▼2', '▲4']);
    // Son 3 deneme: Türkiye (10+10+9)/3 → (9+8+8)/3 = −1,333; ADA 34/3 → 29/3 = −1,667 → ▼0,33.
    pencere(3); yk(st('st=>st.tr.fark'), -4 / 3); assert.equal(trHucreler()[1001].yazi, '▼0,33');
    // Türkçe: 20 → 15 (−5); ADA 24 → 22 (−2) → ▲3.
    run("EK.dpOgrNet='TÜR'"); pencere('tum'); yk(st('st=>st.tr.fark'), -5); assert.equal(trHucreler()[1001].yazi, '▲3');
    // Matematik + Geometri adds both lessons’ averages (11 → 9 = −2): ADA 13 → 10 = −3 → ▼1.
    run("EK.dpOgrNet='G-MAT'"); yk(st('st=>st.tr.fark'), -2); assert.equal(trHucreler()[1001].yazi, '▼1');
    // A list that lacks the lesson: no Matematik in any of them.
    await trKur([0, 1, 2, 3, 4, 5].map(e => trRapor(e, [['TÜRKÇE-T', 40, 20 - e], ['GEOMETRİ-T', 10, 1]])));
    run("EK.dpOgrNet='MAT'"); assert.equal(st('st=>st.tr.var'), false); assert.equal(trSatiriMetni(), 'Bu aralıkta Türkiye ortalaması yok'); assert.equal(trHucreler()[1001].yazi, '—');
    run("EK.dpOgrNet='G-MAT'"); assert.equal(st('st=>st.tr.var'), false, 'a test needs every lesson’s average');
    // Lists for the first five exams only: the window ends on an exam without a lesson average, so the change cannot be worked out.
    await trYukle([0, 1, 2, 3, 4]); run("EK.dpOgrNet='MAT'"); pencere('tum');
    assert.equal(st('st=>st.tr.var'), true); assert.equal(st('st=>st.tr.fark'), null); assert.match(trSatiriMetni(), /^Bu aralıkta Türkiye ortalaması eksik/); assert.equal(trHucreler()[1001].yazi, '—');
    assert.match(run('DPANO.icerik()'), /data-dp-olcut="trfark" aria-pressed="false" disabled/);
    // Seç inside the covered exams works: 1201 → 1205 Matematik 10 → 8 (−2); ADA 12 → 10 (−2) → 0.
    run(`EK.dpAralik='sec';EK.dpOnceki=${JSON.stringify(idOf(TRADLAR[0]))};EK.dpSimdiki=${JSON.stringify(idOf(TRADLAR[4]))}`); yk(st('st=>st.tr.fark'), -2); assert.equal(trHucreler()[1001].yazi, '0');
  });
  await check('Türkiye’ye göre: reading it writes nothing and a view-only teacher sees it', async () => {
    await trYukle([0, 1, 2, 3, 4, 5]); const once = JSON.stringify(get('D')); run('DPANO.icerik()'); assert.equal(JSON.stringify(get('D')), once);
    run('yalnizcaGoruntuleme=()=>true'); assert(run('DPANO.icerik()').includes('data-dp-sira="trFark"'));
  });
  console.log(passed + ' Deneme panosu checks passed');
})();
