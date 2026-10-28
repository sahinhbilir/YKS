#!/usr/bin/env node
'use strict';
// Yoklama: report parsing, the day's state, notebook storage and merging, the model (range, scope,
// weeks, classes, rankings, the day), the page, the viewing teacher and privacy. Synthetic data only
// (test/fixtures/yoklama-pdf.cjs).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { yoklamaRaporu, ornekSiniflar, ornekRapor } = require('./fixtures/yoklama-pdf.cjs');
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
const reset = () => run(`yalnizcaGoruntuleme=__yg;confirm=()=>true;D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'Sentetik Ada',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='yoklama';
  for(const k of ['ykBas','ykBit','ykKapsam','ykTur','ykGrup','ykGun','ykOgr','ykSira','ykSiraYon'])EK[k]=undefined;EK.ykAra='';KAYIT=0;kaydet=async()=>{KAYIT++;return true};YOKLAMA.onbellek.k=null;`);
const gun = iso => run('gunNo("' + iso + '")'), iso = g => run('isoDan(' + g + ')');
const coz = (pages = ornekRapor().pages) => { put('pages', pages); return get('YOKLAMA.pdfCoz(pages)'); };
const ekle = async r => { put('R', r); await run('YOKLAMA.raporEkle([R])'); };
const model = (secenek = {}) => { put('S', secenek); return get('(()=>{const m=YOKLAMA.model(D.yoklama,S);if(!m.bos){m.donemH=m.donem("*","hafta");m.donemG=m.donem("*","gun")}return m})()'); };
const kisi = (m, ad) => m.kisiler.find(k => k.ad.includes(ad));
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('reads the report: classes, wrapped names, lessons, students across pages and a rising list split by names', () => {
    const r = coz();
    assert.deepEqual(r.siniflar, ['12/A', '11/B', '9/A']);
    assert.deepEqual(r.ogrenciler.map(o => o.sinif + ' ' + o.ad), ['12/A SENTETİK ADA', '12/A SENTETİK UZUNADLI FERİDE İKİNCİ', '12/A SENTETİK BORA',
      '11/B SENTETİK CEM', '11/B SENTETİK DENİZ', '11/B SENTETİK EGE', '9/A SENTETİK FİLİZ']);
    assert.equal(iso(r.bas), '2026-09-07'); assert.equal(iso(r.bit), '2026-10-16'); assert.equal(iso(r.yaz), '2026-10-16');
    assert.equal(r.atlanan, 0); assert.equal(r.bilinmeyen, 0);
    // Every day of every student comes back with its lessons, page breaks or not.
    for (const s of ornekSiniflar()) for (const o of s.ogrenciler) {
      const p = r.ogrenciler.find(x => x.ad === o.ad.replace('|', ' ') && x.sinif === s.sinif);
      assert.deepEqual(p.gun.map(([g, k]) => iso(g) + ':' + k), o.gunler.map(([t, k]) => t.split('/').reverse().join('-') + ':' + k), o.ad);
    }
    const ada = r.ogrenciler[0].gun.map(([g, k]) => k);
    assert(ada.includes('GPPPPPPP') && ada.includes('AAPPPPPP'));
    const deniz = r.ogrenciler.find(o => o.ad.endsWith('DENİZ')), ege = r.ogrenciler.find(o => o.ad.endsWith('EGE'));
    assert.equal(iso(deniz.gun.at(-1)[0]), '2026-09-25'); assert.equal(iso(ege.gun[0][0]), '2026-09-28');
  });
  await check('unknown lesson text is left empty and counted; other PDFs and reports without rows are refused', () => {
    const p = ornekRapor().pages; const y = p[0].find(o => o.s === '14/09/2026').y;
    p[0] = p[0].filter(o => !(o.y === y && o.s === 'Geldi' && o.x > 260 && o.x < 280)); p[0].push({ s: 'Bilinmiyor', x: 267, y, w: 40, h: 8, z: 8 });
    const r = coz(p); assert.equal(r.bilinmeyen, 1);
    assert.equal(r.ogrenciler[0].gun.find(([g]) => iso(g) === '2026-09-14')[1], 'PP.PPPPP');
    put('pages', [[{ s: 'Merhaba', x: 10, y: 500, w: 30, h: 9, z: 9 }]]); assert.throws(() => run('YOKLAMA.pdfCoz(pages)'), /Yoklama Raporu” gibi görünmüyor/);
    put('pages', yoklamaRaporu([{ no: '205', sinif: '12/A', ogrenciler: [] }]).pages); assert.throws(() => run('YOKLAMA.pdfCoz(pages)'), /yoklama satırı/);
  });
  await check('the day’s state: late and absent apart, leaving early and missing a lesson are Geldi, excuses by majority', () => {
    const d = k => run('YOKLAMA.gunDurumu(' + JSON.stringify(k) + ')');
    for (const [k, v] of [['PPPPPPPP', 'geldi'], ['GPPPPPPP', 'gec'], ['PPGPPPPP', 'gec'], ['AAPPPPPP', 'gec'], ['MAPPPP', 'gec'], ['MPPPPP', 'geldi'], ['PPPPAAAA', 'geldi'], ['PPAPPPPP', 'geldi'],
      ['AAAAAAAA', 'gelmedi'], ['AAAAAAMM', 'gelmedi'], ['AAMMMMMM', 'diger'], ['AARR', 'raporlu'], ['MMMMMMMM', 'diger'], ['RRRRRR', 'raporlu'], ['MRR', 'raporlu'], ['MMR', 'diger'],
      ['..P', 'geldi'], ['.A', 'gelmedi'], ['...', null], ['', null]]) assert.equal(d(k), v, k);
    assert.equal(run('YOKLAMA.dersOzeti("AAPPPPPP")'), '1–2. ders gelmedi · 3–8. ders geldi');
    assert.equal(run('YOKLAMA.dersOzeti("P.MR")'), '1. ders geldi · 3. ders mazeretli (diğer) · 4. ders mazeretli (raporlu)');
  });
  await check('stores a compact copy from 14 Eylül; the same report again changes nothing; a class report replaces its own days', async () => {
    await ekle(coz()); assert.equal(run('KAYIT'), 1);
    const v = get('D.yoklama');
    assert.equal(v.surum, 1); assert.equal(iso(v.gunler[0]), '2026-09-14'); assert.equal(v.gunler.length, 25);
    assert.equal(v.ogrenci.length, 7); assert.equal(v.kaynak.length, 1); assert.equal(v.kaynak[0].n, 150); assert.equal(iso(v.kaynak[0].yaz), '2026-10-16');
    assert.equal(iso(v.kaynak[0].bas), '2026-09-14');
    assert(v.ogrenci.find(o => o[0] === 'SENTETİK BORA')[2].startsWith('8P,8P,'), 'a day of one code is stored as count + code');
    assert.equal(get('YOKLAMA.dogrula(D.yoklama)').ogrenci.length, 7);
    assert(run('baytBoyu(JSON.stringify(D.yoklama))') < 2500);
    const once = JSON.stringify(v.ogrenci); await ekle(coz()); assert.equal(JSON.stringify(get('D.yoklama.ogrenci')), once); assert.equal(get('D.yoklama.kaynak').length, 2);
    // A 12/A report for 6–8 Eki: ADA was on time on 6 Eki after all; 11/B keeps its days.
    const sinif = ornekSiniflar()[0]; for (const o of sinif.ogrenciler) o.gunler = o.gunler.filter(([t]) => ['06/10/2026', '07/10/2026', '08/10/2026'].includes(t));
    sinif.ogrenciler[0].gunler[0][1] = 'PPPPPPPP';
    await ekle(coz(yoklamaRaporu([sinif], { yazdirma: '9 Eki 2026' }).pages));
    const m = model(); assert.equal(kisi(m, 'ADA').say.gec, 1); assert.equal(kisi(m, 'CEM').say.gelmedi, 5); assert.equal(m.kisiler.length, 7);
    assert.deepEqual(get('[...YOKLAMA.model(D.yoklama).kismi]').map(iso), ['2026-10-16'], 'a report printed on its last day leaves that day incomplete');
  });
  await check('a report before 14 Eylül only is refused; broken stored data is reported and not overwritten', async () => {
    const s = ornekSiniflar().slice(0, 1); for (const o of s[0].ogrenciler) o.gunler = o.gunler.filter(([t]) => t.endsWith('09/2026') && +t.slice(0, 2) < 12);
    await assert.rejects(run('(async()=>{})()').then(() => { put('R', coz(yoklamaRaporu(s).pages)); return run('YOKLAMA.raporEkle([R])'); }), /14 Eyl 2026 ve sonrasına ait yoklama yok/);
    run(`D.yoklama={surum:1,ts:1,kaynak:[],gunler:[${gun('2026-09-14')},${gun('2026-09-15')}],ogrenci:[['A','12/A','8P']]}`);
    assert.throws(() => run('YOKLAMA.dogrula(D.yoklama)'), /öğrenci günleri/);
    assert.match(run('YOKLAMA.icerik()'), /Kayıtlı yoklama verisi okunamadı/);
    await assert.rejects(async () => { put('R', coz()); await run('YOKLAMA.raporEkle([R])'); }, /Yeni rapor eklenmedi/);
    run(`D.yoklama.ogrenci[0][2]='8P,X'`); assert.throws(() => run('YOKLAMA.dogrula(D.yoklama)'), /öğrenci günleri/);
  });
  await check('a failed save or the cloud backup limit leaves the notebook as it was', async () => {
    run('kaydet=async()=>false');
    await assert.rejects(async () => { put('R', coz()); await run('YOKLAMA.raporEkle([R])'); }, /Cihaza kaydedilemedi/);
    assert.equal(run('D.yoklama'), undefined);
    run('kaydet=async()=>true;D.dolgu="x".repeat(DEFTER_HAM_UST_SINIR)');
    await assert.rejects(async () => { put('R', coz()); await run('YOKLAMA.raporEkle([R])'); }, /bulut yedeği sınırının/);
    assert.equal(run('D.yoklama'), undefined);
  });
  await check('model: each student’s days, the school’s totals, rankings, every-day students and weeks', async () => {
    await ekle(coz());
    const m = model();
    const say = ad => { const k = kisi(m, ad); return [k.toplam, k.say.geldi, k.say.gec, k.say.gelmedi, k.say.raporlu, k.say.diger].join(','); };
    assert.equal(say('ADA'), '25,22,2,1,0,0'); assert.equal(say('FERİDE'), '25,19,0,3,1,2'); assert.equal(say('BORA'), '25,25,0,0,0,0');
    assert.equal(say('CEM'), '25,19,1,5,0,0'); assert.equal(say('DENİZ'), '10,10,0,0,0,0'); assert.equal(say('EGE'), '15,14,0,1,0,0'); assert.equal(say('FİLİZ'), '25,24,0,0,0,1');
    assert.deepEqual(m.ozet.say, { geldi: 133, gec: 3, gelmedi: 10, raporlu: 1, diger: 3 }); assert.equal(m.ozet.toplam, 150);
    assert.equal(Math.round(m.ozet.oran * 1000), 907); assert.equal(m.ozet.gelmeyen, 4); assert.equal(m.ozet.gecikan, 2);
    assert.deepEqual(m.gelmeyenler.map(k => k.ad.split(' ').pop()), ['CEM', 'İKİNCİ', 'EGE', 'ADA'], 'ties: the later absence first');
    assert.deepEqual(m.gecikenler.map(k => k.ad.split(' ').pop()), ['ADA', 'CEM']);
    assert.deepEqual(m.tam.map(k => k.ad.split(' ').pop()), ['BORA', 'DENİZ']);
    assert.deepEqual(m.donemH.map(r => iso(r.p) + ':' + [r.say.gelmedi, r.say.gec, r.say.raporlu, r.say.diger].join('/') + (r.kismi ? '*' : '')),
      ['2026-09-14:2/1/1/2', '2026-09-21:2/0/0/0', '2026-09-28:2/1/0/1', '2026-10-05:1/1/0/0', '2026-10-12:3/0/0/0*']);
    assert.equal(m.donemG.length, 25); assert.equal(m.donemG.at(-1).kismi, true); assert.equal(m.donemG.at(-1).say.gelmedi, 2);
    assert.deepEqual(m.subeler.map(s => s.k + ':' + s.ogrenci + ':' + s.say.gelmedi + ':' + s.say.gec), ['12/A:3:4:2', '11/B:3:6:1', '9/A:1:0:0']);
    assert.deepEqual(m.duzeyler.map(s => s.k + ':' + s.say.gelmedi), ['d12:4', 'd11:6', 'd9:0']);
  });
  await check('the range and the scope drive everything; the range stays inside the stored days', async () => {
    await ekle(coz());
    let m = model({ bas: gun('2026-09-21'), bit: gun('2026-10-02') });
    assert.equal(m.gunler.length, 10); assert.equal(m.ozet.say.gelmedi, 4); assert.equal(kisi(m, 'CEM').say.gelmedi, 2); assert.equal(kisi(m, 'DENİZ').toplam, 5);
    m = model({ bas: gun('2026-10-02'), bit: gun('2026-09-21') }); assert.equal(iso(m.a), '2026-09-21', 'a reversed range is turned around');
    m = model({ bas: gun('2026-01-01'), bit: gun('2027-01-01') }); assert.equal(iso(m.a), '2026-09-14'); assert.equal(iso(m.b), '2026-10-16');
    m = model({ kapsam: '11/B' }); assert.deepEqual(m.kisiler.map(k => k.ad.split(' ').pop()), ['CEM', 'DENİZ', 'EGE']); assert.equal(m.ozet.say.gelmedi, 6);
    m = model({ kapsam: 'd12' }); assert.equal(m.kisiler.length, 3); assert.equal(m.ozet.ad, '12. sınıflar');
    m = model({ kapsam: '10/A' }); assert.equal(m.bos, true);
  });
  await check('the day: who was where, and an absence that is not like the student is flagged', async () => {
    await ekle(coz());
    const gd = g => get('(()=>{const m=YOKLAMA.model(D.yoklama);const l=YOKLAMA.gunDetayi(m,' + gun(g) + ');for(const k in l)l[k]=l[k].map(x=>x.o.ad.split(" ").pop()+":"+x.once+":"+x.ayni+(x.beklenmedik?"!":""));return l})()');
    let l = gd('2026-09-22'); assert.deepEqual(l.gelmedi, ['ADA:6:0!']); assert.equal(l.geldi.length, 5, 'EGE has not joined yet');
    l = gd('2026-10-12'); assert.deepEqual(l.gelmedi, ['CEM:20:4']);
    l = gd('2026-10-16'); assert.deepEqual(l.gelmedi, ['EGE:14:0!', 'İKİNCİ:24:2']);
  });
  await check('the page: sentence, controls, key, figures, charts, rankings, classes, the day, the grid and the students; names are escaped', async () => {
    const r = coz(); r.ogrenciler[2].ad = 'SENTETİK <img src=x>'; await ekle(r);
    const h = run('YOKLAMA.icerik()');
    assert.match(h, /Tüm okul · 14 Eyl – 16 Eki · <b>25<\/b> okul günü · <b>7<\/b> öğrenci\. Gelme oranı <b>%90,7<\/b>\. Gelmedi <b>10<\/b> kez \(4 öğrenci\), geç geldi <b>3<\/b> kez \(2 öğrenci\)\./);
    for (const id of ['ykPdf', 'ykBas', 'ykBit', 'ykKapsam', 'ykGunSec', 'ykAra', 'ykSil', 'ykGrafik', 'ykSubeler', 'ykGun', 'ykTam', 'ykCizelge', 'ykKisi']) assert(h.includes('id="' + id + '"'), id);
    assert(h.includes('min="2026-09-14" max="2026-10-16" value="2026-09-14"'));
    for (const t of ['Erken çıkma ve ders kaçırma da “geldi” sayılır.', '“Gecikti” yazıyor ya da ilk derslere gelmeyip sonra geldi.', 'Gün boyu gelmedi, mazereti yok.', 'Mazeretli (Raporlu).', 'Mazeretli (Diğer).']) assert(h.includes(kacisla(t)), t);
    assert(h.includes('data-yk-grafik="donem"')); assert(h.includes('En çok gelmeyenler')); assert(h.includes('En çok geç gelenler'));
    assert(!/[+−]\d/.test(h.replace(/<[^>]+>/g, ' ')), 'no signed numbers anywhere');
    assert(h.includes('Rapor bu gün bitmeden alındı'), 'the last day is the incomplete one');
    assert.equal((h.match(/<tr data-yk-ogr=/g) || []).length, 7); assert.equal((h.match(/class="yk-cz-satir[^"]*"><button/g) || []).length, 7);
    assert(!/<img/i.test(h)); assert(/&lt;img src=x&gt;/i.test(h));
    run('EK.ykOgr=YOKLAMA.model(D.yoklama).kisiler.find(k=>k.ad==="SENTETİK ADA").kim');
    assert(run('YOKLAMA.icerik()').includes('data-ogr-gor="0"'), 'a student in the notebook opens in student view');
    assert(h.includes('<h3>Sentetik Cem</h3>'), 'the card opens on the most absent student');
    assert(h.includes('title="Sal 6 Eki · Geç geldi · 1–2. ders gelmedi · 3–8. ders geldi"'));
    assert(h.includes('data-yk-grup="sube"') && h.includes('data-yk-grup="duzey"'));
    run('EK.ykGrup="sube";YOKLAMA.onbellek.k=null');
    const s = run('YOKLAMA.icerik()'); assert.equal((s.match(/data-yk-grafik="grup:/g) || []).length, 3);
    run('EK.ykKapsam="11/B";YOKLAMA.onbellek.k=null');
    const c = run('YOKLAMA.icerik()'); assert(!c.includes('data-yk-grup=')); assert(!c.includes('id="ykSubeler"')); assert.match(c, /11\/B · 14 Eyl – 16 Eki/);
    run('EK.ykKapsam="10/A";YOKLAMA.onbellek.k=null'); assert.match(run('YOKLAMA.icerik()'), /Tüm okul · 14 Eyl – 16 Eki/, 'an unknown class falls back to the whole school');
    reset(); assert.match(run('YOKLAMA.icerik()'), /Henüz yoklama raporu yok/);
  });
  await check('bars: Gelmedi, Geç geldi, Raporlu and Diğer stacked in their colours, the readout has every state', async () => {
    await ekle(coz());
    const g = get('(()=>{const m=YOKLAMA.model(D.yoklama);return YOKLAMA.cubukGrafik(m.donem("*","hafta"),"hafta",640)})()');
    for (const k of ['gelmedi', 'gec', 'raporlu', 'diger']) assert(g.svg.includes('fill:var(--y-' + k + ')'), k);
    assert(!g.svg.includes('fill:var(--y-geldi)')); assert.equal(g.xs.length, 5);
    assert.equal((g.svg.match(/class="yk-cubuk kismi"/g) || []).length, 1, 'the unfinished week is faded');
    assert.deepEqual(g.ipucu[0].satir.map(s => s[1] + ' ' + s[2]), ['Gelmedi 2', 'Geç geldi 1', 'Raporlu 1', 'Diğer 2', 'Geldi 24', 'Gelme oranı %83,3']);
    assert.equal(g.ipucu[4].bas, '12 Eki haftası · devam ediyor · 5 gün');
  });
  await check('the viewing teacher sees the page without import or delete; students never get it', async () => {
    await ekle(coz());
    run('yalnizcaGoruntuleme=()=>true');
    const h = run('YOKLAMA.icerik()'); assert(!h.includes('id="ykPdf"')); assert(!h.includes('id="ykSil"')); assert(h.includes('data-yk-grafik="donem"'));
    await assert.rejects(async () => { put('R', coz()); await run('YOKLAMA.raporEkle([R])'); }, /Yalnızca rehber/);
    await assert.rejects(async () => run('YOKLAMA.sil()'), /Yalnızca rehber/);
    run('yalnizcaGoruntuleme=__yg');
    const paket = JSON.stringify(run('ogrenciPaketi(0)'));
    assert(!paket.includes('SENTETİK') && !paket.includes('"yoklama"'));
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    run("D.rol='ogrenci'"); assert.match(run('YOKLAMA.gorunum()'), /rehber öğretmen içindir/);
    run("D.rol='rehber'"); await run('YOKLAMA.sil()'); assert.equal(run('D.yoklama'), undefined);
  });
  console.log(passed + ' Yoklama checks passed');
})();
function kacisla(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
