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
  EK.denemeKlasik=undefined;EK.dpOlcu=undefined;EK.dpAralik=undefined;EK.dpKapsam=undefined;EK.dpDers=undefined;EK.dpOgr=undefined;EK.dpAra='';KAYIT=0;kaydet=async()=>{KAYIT++;return true};SIRALAMA.onbellek.clear();`);
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
  console.log(passed + ' Deneme panosu checks passed');
})();
