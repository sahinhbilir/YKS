#!/usr/bin/env node
'use strict';
// Türkiye geneli: reading the "Ders Ortalamaları İlk 100 Kurum (Kolej)" report, the list kind, notebook
// storage (compact, validated, replaced, limits), the model (exam order, grade and list, the followed
// school, places, ties, outside the list), the charts, the page, the viewing teacher and privacy.
// Synthetic data only (test/fixtures/kurum-pdf.cjs).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { kurumListesi, kurumRaporu, BIZ, UZUN, KURS, DERSLER, normalNet, phi, phiTers } = require('./fixtures/kurum-pdf.cjs');
const { ornekRapor } = require('./fixtures/yoklama-pdf.cjs');
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
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__so = run('SIRALAMA.oku');
const reset = () => run(`yalnizcaGoruntuleme=__yg;SIRALAMA.oku=__so;confirm=()=>true;D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'Sentetik Ada',sube:'12-A',alan:'EA',sinif:12,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='turkiye';
  for(const k of ['tgListe','tgDuzey','tgOturum','tgDers','tgSimdi','tgOnceki','tgToplam','tgMod','tgOkul'])EK[k]=undefined;KAYIT=0;kaydet=async()=>{KAYIT++;return true};`);
const gun = iso => run('gunNo("' + iso + '")');
const dosya = (e, ek = ' (Kolej)') => '27-YKS-120' + e + ' Ders Ortalamaları İlk 100 Kurum' + ek + '.pdf';
const coz = (pages, ad = dosya(1)) => { put('P', pages); put('F', ad); return get('TURKIYE.pdfCoz(P,F)'); };
const ekle = async (...r) => { put('R', r); await run('TURKIYE.raporEkle(R)'); };
const liste = (e, o) => coz(kurumRaporu(kurumListesi(e, o)).pages, o && o.liste === 'kurum' ? dosya(e, '') : dosya(e));
const model = (sec = {}) => { put('S', sec); return get('TURKIYE.model(D.turkiye,S)'); };
// The followed school's place (1-based) in the fixture's list, or null outside it.
const yerimiz = (L, kod) => { const i = L.dersler.find(d => d.kod === kod).satir.findIndex(r => r[0] === BIZ); return i < 0 ? null : i + 1; };
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

(async () => {
  await check('reads the report: exam, subjects, rows across pages, Türkiye average, print day and list kind', () => {
    const L = kurumListesi(1), r = coz(kurumRaporu(L).pages);
    assert.equal(r.ad, '27-YKS-1201'); assert.equal(r.liste, 'kolej'); assert.equal(r.yaz, gun('2026-10-07')); assert.equal(r.atlanan, 0);
    // Ek Felsefe is printed but left out.
    const kept = L.dersler.filter(d => d.kod !== 'S.FELSEFE-T');
    assert.deepEqual(r.dersler.map(d => d.kod), kept.map(d => d.kod));
    for (const [i, d] of kept.entries()) {
      const p = r.dersler[i];
      assert.equal(p.soru, d.soru); assert.equal(p.genel, d.genel);
      assert.deepEqual(p.satir, d.satir.map(([ad, net], j) => ({ sira: j + 1, ad, net })), d.kod);
    }
    // The long name stays one name; 100 rows run over two pages; short pages read the same.
    assert(r.dersler[0].satir.some(x => x.ad === UZUN));
    assert.deepEqual(coz(kurumRaporu(L, { ilkSatir: 9, sonraki: 14 }).pages).dersler, r.dersler);
    assert.equal(get('TURKIYE.sinifDuzeyi("27-YKS-1202")'), 12); assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT-901")'), 9);
    assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT-1001")'), 10); assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT_SIFIR_POZİTİF")'), null);
    assert.deepEqual(get('TURKIYE.dersBilgi("TARİH.1-A")'), { oturum: 'AYT', ad: 'Tarih-1', sira: 11 });
    assert.equal(get('TURKIYE.dersBilgi("İNGİLİZCE-T")').oturum, 'TYT');
    assert.equal(get('TURKIYE.okulAdi("SINAV KOLEJİ DOĞU KAMPÜSÜ (KESTEL) FEN/ANADOLU LİSESİ")'), 'Sınav Koleji Doğu Kampüsü (Kestel) Fen/Anadolu Lisesi');
  });
  await check('the list kind comes from the file name, else from the names; other reports are refused', () => {
    assert.equal(run('TURKIYE.listeTuru("x (Kolej).pdf",["SENTETİK İLERİ KURS"])'), 'kolej');
    assert.equal(run('TURKIYE.listeTuru("x (Kurs).pdf",["A LİSESİ"])'), 'kurs');
    assert.equal(run('TURKIYE.listeTuru("1202.pdf",["A LİSESİ","B KOLEJİ"])'), 'kolej');
    assert.equal(run('TURKIYE.listeTuru("1202.pdf",["A LİSESİ","SENTETİK İLERİ KURS"])'), 'kurum');
    assert.equal(run('TURKIYE.listeTuru("1202.pdf",["SENTETİK KURS","SENTETİK İLERİ KURS"])'), 'kurs');
    const k = coz(kurumRaporu(kurumListesi(1, { liste: 'kurum' })).pages, '1201.pdf');
    assert.equal(k.liste, 'kurum'); assert(KURS.every(a => k.dersler[0].satir.some(x => x.ad === a)));
    assert.throws(() => coz(kurumRaporu(kurumListesi(1), { baslikEki: ' (İlk 100 Şube)' }).pages), /şube listesi/);
    assert.throws(() => coz(kurumRaporu(kurumListesi(1), { baslikEki: ' (İlk 100 Öğrenci)' }).pages), /öğrenci listesi/);
    assert.throws(() => coz(ornekRapor().pages), /benzemiyor/);
    const a = kurumRaporu(kurumListesi(1)).pages, b = kurumRaporu(kurumListesi(2)).pages;
    assert.throws(() => coz(a.slice(0, 2).concat(b.slice(2, 4))), /iki ayrı sınav/);
    // A title without its rows is no list.
    assert.throws(() => coz([a[0].filter(o => o.z !== 7 || o.y < 30)]), /okunabilen kurum satırı yok/);
  });
  await check('a school name on two lines joins its row; unreadable rows are counted and skipped', () => {
    const pages = kurumRaporu(kurumListesi(1)).pages, p = pages[0], y = 744.58;
    const ad = p.find(o => o.y === y && o.x === 97); p.splice(p.indexOf(ad), 1);
    p.push({ s: 'SENTETİK İKİ SATIRLI', x: 97, y: y + 3.6, w: 80, h: 7, z: 7 }, { s: 'KOLEJ LİSESİ', x: 97, y: y - 3.6, w: 50, h: 7, z: 7 });
    p.push({ s: 'çöp', x: 400, y: 700.1, w: 10, h: 7, z: 7 });
    const r = coz(pages);
    assert.equal(r.dersler[0].satir[2].ad, 'SENTETİK İKİ SATIRLI KOLEJ LİSESİ'); assert.equal(r.dersler[0].satir.length, 100);
    assert.equal(r.atlanan, 1);
    // A row whose name never comes is skipped.
    const q = pages[1], ad2 = q.find(o => o.x === 97); q.splice(q.indexOf(ad2), 1);
    const r2 = coz(pages); assert.equal(r2.dersler[0].satir.length, 99); assert.equal(r2.atlanan, 2);
  });
  await check('storage: compact and validated; adding the same list again replaces it; places and ties survive', async () => {
    const r1 = liste(1); await ekle(r1);
    const v = get('D.turkiye');
    assert.equal(v.surum, 1); assert.equal(v.okul, null); assert.equal(v.sinavlar.length, 1);
    assert.equal(v.adlar.length, new Set(r1.dersler.flatMap(d => d.satir.map(x => x.ad))).size);
    const [kod, soru, genel, sat] = v.sinavlar[0].dersler[0];
    assert.deepEqual([kod, soru, genel], ['TÜRKÇE-T', 40, Math.round(r1.dersler[0].genel * 100)]);
    assert.match(sat, /^[0-9a-z]+:-?[0-9a-z]+(,[0-9a-z]+:-?[0-9a-z]+)*$/);
    assert.deepEqual(get('TURKIYE.ac(D.turkiye).sinavlar[0].dersler').map(d => d.satir), r1.dersler.map(d => d.satir));
    assert.equal(run('KAYIT'), 1);
    await ekle(r1); assert.equal(run('D.turkiye.sinavlar.length'), 1);
    await ekle(liste(2), liste(1, { liste: 'kurum' })); assert.equal(run('D.turkiye.sinavlar.length'), 3);
    // A printed place that is not the row's position is kept as a third part.
    const r = liste(3); r.dersler[0].satir[1].sira = 1; await ekle(r);
    assert.equal(get('TURKIYE.ac(D.turkiye).sinavlar[3].dersler[0].satir[1].sira'), 1);
    assert.match(run('D.turkiye.sinavlar[3].dersler[0][3]').split(',')[1], /^[0-9a-z]+:[0-9a-z]+:1$/);
    // Damaged data is shown as unreadable and never overwritten.
    run('D.turkiye.sinavlar[0].dersler[0][3]="zz:1"');
    assert.match(run('TURKIYE.oku().hata'), /okunamadı \(ders satırı\)/);
    assert.match(run('TURKIYE.icerik()'), /class="et-uyari">Kayıtlı Türkiye geneli verisi okunamadı/);
    await assert.rejects(() => ekle(liste(1)), /Yeni liste eklenmedi/);
    for (const bozuk of ['D.turkiye.surum=2', 'D.turkiye.sinavlar[0].liste="x"', 'D.turkiye.adlar.push(D.turkiye.adlar[0])', 'D.turkiye.sinavlar[0].dersler[0][1]=0']) {
      reset(); await ekle(r1); run(bozuk); assert(run('TURKIYE.oku().hata'), bozuk);
    }
  });
  await check('Ek Felsefe: never read, and dropped from lists stored before on the next save', async () => {
    const r = liste(1); assert(!r.dersler.some(d => /FELSEFE/.test(d.kod) && d.kod.startsWith('S.')));
    // A list saved by the first version still holds S.FELSEFE-T.
    put('R1', r); run(`(()=>{const a={okul:null,sinavlar:[{id:'x',ad:R1.ad,liste:'kolej',yaz:R1.yaz,ts:1,dersler:R1.dersler.concat([{kod:'S.FELSEFE-T',soru:5,genel:0.94,satir:R1.dersler[0].satir.map(x=>({...x,net:1}))}])}]};D.turkiye=TURKIYE.paketle(a,5)})()`);
    assert.equal(run('D.turkiye.sinavlar[0].dersler.length'), 6); assert.equal(run('TURKIYE.oku().hata'), undefined);
    assert(!get('TURKIYE.model(D.turkiye,{}).dersler').some(d => d.ad === 'Ek Felsefe'));
    assert(!run('TURKIYE.icerik()').includes('Ek Felsefe'));
    await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    assert.equal(run('D.turkiye.sinavlar[0].dersler.length'), 5); assert(!run('JSON.stringify(D.turkiye)').includes('S.FELSEFE'));
  });
  await check('limits: the notebook cloud backup, a failed save and the list count leave the data as it was', async () => {
    await ekle(liste(1)); const once = run('JSON.stringify(D.turkiye)');
    run('D.buyuk="x".repeat(DEFTER_HAM_UST_SINIR)');
    await assert.rejects(() => ekle(liste(2)), /5\.000 KB cihaz bütçesini/); assert.equal(run('JSON.stringify(D.turkiye)'), once);
    run('delete D.buyuk;kaydet=async()=>false');
    await assert.rejects(() => ekle(liste(2)), /Cihaza kaydedilemedi/); assert.equal(run('JSON.stringify(D.turkiye)'), once);
    run('kaydet=async()=>true');
    const kucuk = n => ({ ad: '27-YKS-12' + String(n).padStart(2, '0'), liste: 'kolej', yaz: null, atlanan: 0, dersler: [{ kod: 'TÜRKÇE-T', soru: 40, genel: 20, satir: [{ sira: 1, ad: BIZ, net: 20 }] }] });
    reset(); await ekle(...Array.from({ length: run('TURKIYE.EN_COK_SINAV') }, (_, i) => kucuk(i)));
    await assert.rejects(() => ekle(kucuk(99)), /En fazla 40 liste/);
    assert.equal(run('D.turkiye.sinavlar.length'), 40);
    // A real list is about 15 KB; the size limit holds well over a school year of exams.
    reset(); await ekle(liste(1)); assert(run('baytBoyu(JSON.stringify(D.turkiye))') < 20000);
  });
  await check('model: exams by date (Sıralamalar first), the grade and the list kind; the followed school is guessed, then chosen', async () => {
    await ekle(liste(2), liste(1), liste(3, { ad: '27-YKS-1101' }), liste(1, { liste: 'kurum' }));
    let m = model();
    assert.deepEqual(m.listeler, ['kolej', 'kurum']); assert.equal(m.liste, 'kolej');
    assert.deepEqual(m.duzeyler, ['d12', 'd11', 'tum']); assert.equal(m.duzey, 'd12'); assert.equal(m.ana, 'd12');
    assert.deepEqual(m.sinavlar.map(s => s.ad), ['27-YKS-1201', '27-YKS-1202']); assert.equal(m.simdi, 1); assert.equal(m.onceki, 0);
    assert.deepEqual(m.oturumlar, ['TYT', 'AYT']); assert.equal(m.oturum, 'TYT');
    assert.equal(m.okul, null); assert.equal(m.okulKaynak, null); assert(m.okullar.includes(BIZ));
    assert.deepEqual(model({ duzey: 'd11' }).sinavlar.map(s => s.ad), ['27-YKS-1101']);
    assert.deepEqual(model({ duzey: 'tum' }).sinavlar.map(s => s.ad), ['27-YKS-1201', '27-YKS-1202', '27-YKS-1101']);
    assert.deepEqual(model({ liste: 'kurum' }).sinavlar.map(s => s.ad), ['27-YKS-1201']);
    assert.equal(model({ oturum: 'AYT' }).dersler.map(d => d.ad).join(), 'Edebiyat,Matematik');
    assert.equal(model({ simdi: '27-YKS-1201|kolej' }).simdi, 0);
    // Sıralamalar gives the exam its date and names the school.
    run(`SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1202',okul:'ÖZEL ${BIZ}',T:{tarih:'01.10.2026'}}]}})`);
    m = model();
    assert.deepEqual(m.sinavlar.map(s => s.ad), ['27-YKS-1202', '27-YKS-1201']);
    assert.equal(m.sinavlar[0].g, gun('2026-10-01')); assert.equal(m.sinavlar[0].gKaynak, 'sinav'); assert.equal(m.sinavlar[1].gKaynak, 'rapor');
    assert.equal(m.okul, BIZ); assert.equal(m.okulKaynak, 'tahmin');
    run('SIRALAMA.oku=__so');
    await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); assert.equal(run('D.turkiye.okul'), BIZ);
    m = model(); assert.equal(m.okulKaynak, 'secili');
    assert.equal(model({ okul: UZUN }).okulKaynak, 'gecici');
  });
  await check('model: places, ties, one net more, outside the list, the averages and the change between exams', async () => {
    await ekle(liste(1), liste(2), liste(3)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const L = [1, 2, 3].map(e => kurumListesi(e)), m = model(), ders = ad => m.dersler.find(d => d.ad === ad);
    assert.deepEqual(m.dersler.map(d => d.ad), ['Türkçe', 'Matematik', 'Fizik']); assert.equal(m.N, 100);
    for (const [ad, kod] of [['Türkçe', 'TÜRKÇE-T'], ['Matematik', 'MATEMATİK-T'], ['Fizik', 'FİZİK-T']])
      assert.deepEqual(ders(ad).seri.map(p => p.sira), L.map(l => yerimiz(l, kod)), ad);
    const fiz = ders('Fizik').seri[1];
    assert.equal(fiz.sira, null); assert.equal(fiz.net, null); assert.equal(fiz.k, -1); assert.equal(fiz.son.net, L[1].dersler[2].satir[99][1]);
    // Tied nets share a span of places.
    const mat = ders('Matematik').seri[0], esitler = L[0].dersler[1].satir.map((r, i) => [r[1], i + 1]).filter(r => r[0] === 12).map(r => r[1]);
    assert.equal(esitler.length, 6); assert.deepEqual(mat.esit, [Math.min(...esitler), Math.max(...esitler)]); assert.equal(mat.sira, yerimiz(L[0], 'MATEMATİK-T'));
    const tr = ders('Türkçe').seri[2], ustu = L[2].dersler[0].satir.filter(r => r[1] > 26 + 1).length;
    assert.equal(tr.birNet, ustu + 1); assert.equal(tr.net, 26); assert.equal(tr.genel, L[2].dersler[0].genel);
    // Outside the list counts as N + 1 in the average place; places moved compare the two exams.
    const yer = (e, kod) => yerimiz(L[e], kod) ?? 101, tyt = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'];
    const ort = e => tyt.reduce((t, k) => t + yer(e, k), 0) / 3;
    assert.equal(m.ozet[1].ort, ort(1)); assert.equal(m.ozet[1].ilk, 2); assert.equal(m.ozet[2].ilk, 3); assert.equal(m.ozet[2].ort, ort(2));
    assert.equal(m.ozet[2].enIyi.ad, 'Türkçe');
    assert.equal(m.ozet[2].ustu, tyt.filter((k, i) => { const d = L[2].dersler.find(x => x.kod === k); return d.satir.find(r => r[0] === BIZ)[1] > d.genel; }).length);
    assert.equal(run('(()=>{const s=TURKIYE.model(D.turkiye);return [...s.dersler].map(d=>d.seri[2].sira)})()').length, 3);
    put('KOD', 'FİZİK-T'); run('EK.tgDers=KOD');
    assert.equal(run('TURKIYE.durumAl(D.turkiye).odak.ad'), 'Fizik');
  });
  await check('charts: Sıra upside down with the dışı lane, a line per subject and the bold average; Net with the band and the Türkiye average', async () => {
    await ekle(liste(1), liste(2), liste(3)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const g = run('TURKIYE.grafikSira(TURKIYE.durumAl(D.turkiye),900)'), J = x => JSON.parse(JSON.stringify(x));
    for (let k = 0; k < 3; k++) assert(g.svg.includes('data-seri="' + k + '"'), 'line ' + k);
    assert.match(g.svg, /class="tg-ort"/); assert.match(g.svg, />İlk 100 dışı<\/text>/); assert.match(g.svg, /class="tg-disi-nokta" data-seri="2"/);
    assert.match(g.svg, /class="et-cizgi ince kesik" data-seri="2"/, 'to and from the lane is dashed');
    assert(!g.svg.includes('NaN'));
    const y = t => Number(new RegExp('y1="([\\d.]+)" y2="[\\d.]+"/><text class="et-tik" x="[\\d.]+" y="[\\d.]+" dy="0.32em">' + t + '\\.</text>').exec(g.svg)[1]);
    assert(y(1) < y(20) && y(20) < y(100), '1 at the top');
    assert.deepEqual(['1201', '1202', '1203'].map(t => g.svg.includes('>' + t + '</text>')), [true, true, true]);
    assert.equal(g.ipucu[1].bas, '27-YKS-1202 · 14 Eki');
    assert.deepEqual(J(g.ipucu[1].satir.slice(0, 2).map(r => r[1])), ['Ortalama sıra', 'İlk 100’de']);
    assert.deepEqual(J(g.ipucu[1].satir.at(-1).slice(1, 3)), ['Fizik', 'İlk 100 dışı']);
    assert.equal(g.seriIpucu(0, 2).satir.find(r => r[4])[1], 'Türkçe');
    // A narrow chart says only "dışı".
    assert.match(run('TURKIYE.grafikSira(TURKIYE.durumAl(D.turkiye),320).svg'), />dışı<\/text>/);
    run('EK.tgDers="FİZİK-T"');
    const o = run('TURKIYE.grafikSira(TURKIYE.durumAl(D.turkiye),900)');
    assert(!o.svg.includes('data-seri') && !o.svg.includes('tg-ort')); assert.match(o.ipucu[2].satir[0][2], /^\d+\.$/);
    assert.equal(o.ipucu[1].satir[0][2], 'İlk 100 dışı');
    const n = run('TURKIYE.grafikNet(TURKIYE.durumAl(D.turkiye),600)');
    assert.match(n.svg, /class="tg-bant"/); assert.match(n.svg, /class="tg-genel"/); assert(!n.svg.includes('NaN'));
    assert.deepEqual(J(n.ipucu[1].satir.map(r => r[1])), ['Sentetik Kartal Anadolu Lisesi', 'Türkiye ortalaması', 'İlk 100 aralığı', '1. kurum']);
    assert.equal(n.ipucu[1].satir[0][2], 'İlk 100 dışı'); assert.equal(n.ipucu[2].satir[0][2], '2,90 net');
    assert.deepEqual(get('TURKIYE.kisaAdlar([{ad:"27-YKS-1201"},{ad:"27-YKS-1202"}])'), ['1201', '1202']);
    assert.deepEqual(get('TURKIYE.kisaAdlar([{ad:"27-TYT_SIFIR_POZİTİF"},{ad:"27-YKS-1201"}])'), ['TYT_SIFIR_POZ…', 'YKS-1201']);
  });
  await check('exams together: a grade-less exam joins the 12. sınıf chart, Sıralamalar and the teacher set a grade, the others are listed', async () => {
    assert.equal(run('TURKIYE.adDuzeyi("12.SINIF_HAZIR_BULUNUŞLUK_SINAVI")'), 12); assert.equal(run('TURKIYE.adDuzeyi("11. Sınıf Hazırbulunuşluk")'), 11);
    assert.equal(run('TURKIYE.adDuzeyi("27-YKS-1202")'), 12); assert.equal(run('TURKIYE.adDuzeyi("27-TYT_SIFIR_POZİTİF")'), null);
    // The name says nothing: the exam joins the main group, between the others by date.
    await ekle(liste(1), liste(2), liste(4, { ad: '27-TYT_SIFIR_POZİTİF' }));
    let m = model();
    assert.deepEqual(m.duzeyler, ['d12']); assert.deepEqual(m.sinavlar.map(s => s.ad), ['27-YKS-1201', '27-YKS-1202', '27-TYT_SIFIR_POZİTİF']);
    assert.equal(m.tum[2].grup, null); assert.equal(m.tum[2].yer, 'd12');
    // A list of another kind and an exam of another grade stay out of the chart but are listed, each a button.
    await ekle(liste(3, { ad: '27-YKS-1101' }), liste(1, { liste: 'kurum' }));
    await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    m = model(); assert.equal(m.sinavlar.length, 3);
    let h = run('TURKIYE.icerik()');
    assert.match(h, /<p class="tg-diger">Grafikte 3 deneme var\. Diğerleri: <button type="button" class="tg-git" data-tg-git="27-YKS-1101\|kolej">27-YKS-1101 · 11\. sınıf<\/button> <button type="button" class="tg-git" data-tg-git="27-YKS-1201\|kurum">27-YKS-1201 · Tüm kurumlar listesi<\/button><\/p>/);
    // Sıralamalar knows the grade of an exam whose name does not.
    run(`SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-TYT_SIFIR_POZİTİF'}]}});__sm=SIRALAMA.model;SIRALAMA.model=()=>({sinif:11})`);
    assert.deepEqual(model({ duzey: 'd11' }).sinavlar.map(s => s.ad), ['27-YKS-1101', '27-TYT_SIFIR_POZİTİF']);
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm');
    // The teacher's choice wins, survives adding the list again and goes back to automatic.
    await run('TURKIYE.duzeyKaydet("27-YKS-1101|kolej",12)');
    assert.equal(run('D.turkiye.sinavlar.find(s=>s.ad==="27-YKS-1101").duzey'), 12);
    assert.deepEqual(model().sinavlar.map(s => s.ad), ['27-YKS-1201', '27-YKS-1202', '27-YKS-1101', '27-TYT_SIFIR_POZİTİF']);
    await ekle(liste(3, { ad: '27-YKS-1101' })); assert.equal(run('D.turkiye.sinavlar.find(s=>s.ad==="27-YKS-1101").duzey'), 12);
    h = run('TURKIYE.icerik()'); assert.match(h, /data-tg-sinif="27-YKS-1101\|kolej"[^>]*><option value="">Otomatik · 11\. sınıf<\/option><option value="12" selected>/);
    await run('TURKIYE.duzeyKaydet("27-YKS-1101|kolej",0)'); assert.deepEqual(model({ duzey: 'd' }).sinavlar.map(s => s.ad), ['27-YKS-1101']);
    await run('TURKIYE.duzeyKaydet("27-YKS-1101|kolej",null)'); assert.equal(run('D.turkiye.sinavlar.find(s=>s.ad==="27-YKS-1101").duzey'), undefined);
    await assert.rejects(async () => run('TURKIYE.duzeyKaydet("27-YKS-1101|kolej",7)'), /Geçersiz sınıf/);
    run('D.turkiye.sinavlar[0].duzey=8'); assert.match(run('TURKIYE.oku().hata'), /\(deneme\)/);
  });
  await check('Artış view: totals and subjects against the Türkiye average, the increase ranking, Önceki → Şimdiki', async () => {
    await ekle(liste(1), liste(2), liste(3)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); run("EK.tgMod='artis'");
    const L = [1, 2, 3].map(e => kurumListesi(e)), tyt = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'], r2 = x => Math.round(x * 100) / 100;
    const net = (e, kod, ad) => { const r = L[e].dersler.find(d => d.kod === kod).satir.find(x => x[0] === ad); return r ? r[1] : null; };
    const genel = (e, kod) => L[e].dersler.find(d => d.kod === kod).genel;
    const toplam = (e, ad) => { const v = tyt.map(k => ad === null ? genel(e, k) : net(e, k, ad)); return v.includes(null) ? null : r2(v.reduce((t, x) => t + x, 0)); };
    // 1202 → 1203 (the pair Sıra compares by default). FİZİK-T has the school only in 1203, so the TYT total of 1202 is missing.
    let m = run('TURKIYE.model(D.turkiye,{})'), T = m.toplam;
    assert.equal(T.key, 'TYT'); assert.deepEqual([...T.kodlar], tyt);
    assert.deepEqual(JSON.parse(JSON.stringify(T.seri)), [0, 1, 2].map(e => ({ okul: toplam(e, BIZ), genel: toplam(e, null) })));
    assert.equal(T.artis.fark, null); assert.equal(T.artis.genelFark, r2(toplam(2, null) - toplam(1, null)));
    // Türkçe: the school's increase, the Türkiye average's, the difference and the place among every school in both lists.
    const tr = m.dersler.find(d => d.ad === 'Türkçe').artis, fark = r2(net(2, 'TÜRKÇE-T', BIZ) - net(1, 'TÜRKÇE-T', BIZ)), gf = r2(genel(2, 'TÜRKÇE-T') - genel(1, 'TÜRKÇE-T'));
    assert.equal(tr.fark, fark); assert.equal(tr.genelFark, gf); assert.equal(tr.goreli, r2(fark - gf));
    const ikisi = L[1].dersler[0].satir.map(r => r[0]).filter(a => net(2, 'TÜRKÇE-T', a) !== null);
    assert.equal(tr.satir.length, ikisi.length);
    assert.equal(tr.biz.sira, ikisi.filter(a => r2(net(2, 'TÜRKÇE-T', a) - net(1, 'TÜRKÇE-T', a)) > fark + 1e-9).length + 1);
    for (let j = 1; j < tr.satir.length; j++) assert(tr.satir[j - 1].fark >= tr.satir[j].fark);
    // Önceki chosen: 1201 → 1203, where the total is there in both.
    m = run('TURKIYE.model(D.turkiye,{onceki:"27-YKS-1201|kolej"})'); T = m.toplam;
    assert.equal(m.onceki, 0); assert.equal(T.artis.fark, r2(toplam(2, BIZ) - toplam(0, BIZ))); assert.equal(T.artis.goreli, r2(T.artis.fark - (toplam(2, null) - toplam(0, null))));
    assert.equal(run('TURKIYE.model(D.turkiye,{onceki:"27-YKS-1203|kolej"}).onceki'), 1, 'Önceki is always before Şimdiki');
    // Artış reads the whole run by default: the first exam against the latest, the average over the steps between.
    const J = x => JSON.parse(JSON.stringify(x));
    m = run('TURKIYE.model(D.turkiye,{mod:"artis"})'); T = m.toplam;
    assert.equal(m.onceki, 0); assert.equal(m.simdi, 2); assert.equal(T.artis.adim, 2); assert.equal(T.artis.adimlar.length, 2);
    assert.equal(T.artis.fark, r2(toplam(2, BIZ) - toplam(0, BIZ))); assert.equal(T.artis.ort, r2(T.artis.fark / 2));
    assert.equal(T.artis.genelOrt, r2(T.artis.genelFark / 2)); assert.equal(T.artis.goreliOrt, r2(T.artis.goreli / 2));
    assert.deepEqual(J(T.artis.adimlar.map(x => x.fark)), [null, null], 'the school has no TYT total in 1202');
    const turkce = m.dersler.find(d => d.ad === 'Türkçe').artis;
    assert.equal(turkce.adim, 2); assert.deepEqual(J(turkce.adimlar.map(x => [x.onceki, x.ad])), [['27-YKS-1201', '27-YKS-1202'], ['27-YKS-1202', '27-YKS-1203']]);
    assert(turkce.adimlar.every(x => x.fark !== null) && Math.abs(turkce.adimlar.reduce((t, x) => t + x.fark, 0) - turkce.fark) < 0.011, 'the steps add up to the total');
    assert.equal(turkce.ort, r2(turkce.fark / 2));
    // AYT: one total per field.
    m = run('TURKIYE.model(D.turkiye,{oturum:"AYT"})'); assert.equal(m.toplamlar.length, 0, 'the fixture has no complete field');
    let h = run('TURKIYE.icerik()');
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.match(cumle, /^27-YKS-1201 → 27-YKS-1203 \(3 deneme\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: net toplam [▲▼]\d+,\d\d, deneme başına [▲▼]\d+,\d\d \(okul \d+,\d\d → \d+,\d\d; Türkiye ortalaması [▲▼]\d+,\d\d, deneme başına [▲▼]\d+,\d\d\)\. Türkiye’ye göre toplam [+−]\d+,\d\d net\. Artış sırası \d+\. \/ \d+ kurum\.$/);
    assert.match(h, /data-tg-mod="artis" aria-pressed="true"/); assert.match(h, /data-tg-grafik="toplam"/); assert.match(h, /id="tgArtisSira"/);
    assert.match(h, /Artış sıralaması · TYT toplam/); assert.match(h, /class="tg-cevre-satir tg-artis-satir tg-biz"/); assert.match(h, /Türkiye’ye göre artış · 27-YKS-1201 → 27-YKS-1203/);
    assert.match(h, /Dersler · 27-YKS-1201 → 27-YKS-1203/); assert.match(h, /<option value="27-YKS-1201\|kolej" selected>27-YKS-1201<\/option>/);
    assert.equal((h.match(/class="et-ders"/g) || []).length, 3);
    // The school's change in net from exam to exam for the total and every subject, then the total of the changes and the average per exam.
    assert.match(h, /id="tgAdimlar"/); assert.match(h, /Denemeler arası net değişimi/);
    assert.match(h, /<span class="et-seg-label">İlk deneme<\/span>/); assert.match(h, /<span class="et-seg-label">Son deneme<\/span>/); assert.match(h, /TR’ye göre \/ deneme<\/th>/);
    const mat = /<table class="et-tablo tg-tablo tg-matris">([\s\S]*?)<\/table>/.exec(h)[1];
    assert.deepEqual([...mat.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(x => x[1]), ['Ölçü', 'Toplam', 'Ortalama', '27-YKS-1202', '27-YKS-1203', 'TR toplam', 'TR ortalama']);
    const satirlar = [...mat.split('<tbody>')[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(x => [...x[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(y => y[1].replace(/<[^>]+>/g, '').trim()));
    const ok = v => (v > 0 ? '▲' : v < 0 ? '▼' : '') + Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.deepEqual(satirlar.map(r => r[0]), ['TYT toplam', 'Türkçe', 'Matematik', 'Fizik']);
    const tk = r2(net(2, 'TÜRKÇE-T', BIZ) - net(0, 'TÜRKÇE-T', BIZ)), tg = r2(genel(2, 'TÜRKÇE-T') - genel(0, 'TÜRKÇE-T'));
    assert.deepEqual(satirlar[1], ['Türkçe', ok(tk), ok(r2(tk / 2)), ok(r2(net(1, 'TÜRKÇE-T', BIZ) - net(0, 'TÜRKÇE-T', BIZ))), ok(r2(net(2, 'TÜRKÇE-T', BIZ) - net(1, 'TÜRKÇE-T', BIZ))), ok(tg), ok(r2(tg / 2))]);
    const tt = r2(toplam(2, BIZ) - toplam(0, BIZ)), ttg = r2(toplam(2, null) - toplam(0, null));
    assert.deepEqual(satirlar[0], ['TYT toplam', ok(tt), ok(r2(tt / 2)), '—', '—', ok(ttg), ok(r2(ttg / 2))], 'no TYT total in 1202, so its steps are empty; the total and average come from 1201 and 1203');
    assert.match(h, /Okul bir denemede listede yoksa neti basılmaz/);
    const g = run('TURKIYE.grafikToplam(TURKIYE.durumAl(D.turkiye),700)');
    assert.match(g.svg, /class="tg-genel"/); assert.match(g.svg, /class="et-cizgi kalin kesik tg-bosluk"/, "the missing 1202 total is bridged"); assert(!g.svg.includes('NaN'));
    assert.deepEqual(JSON.parse(JSON.stringify(g.ipucu[2].satir.map(r => r[1]))), ['Sentetik Kartal Anadolu Lisesi', 'Türkiye ortalaması', 'Türkiye’ye göre']);
    // A subject: its net chart and its own ranking.
    run('EK.tgDers="TÜRKÇE-T"'); h = run('TURKIYE.icerik()');
    assert.match(h, /data-tg-grafik="net"/); assert.match(h, /Artış sıralaması · Türkçe/); assert.match(h, /data-tg-ders="">Tüm dersler/);
    assert.match(h, /<tr data-tg-ders="TÜRKÇE-T" class="secili">/); assert.match(h, /Denemeler arası net değişimi/);
    // One exam only: no increase yet.
    reset(); await ekle(liste(1)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); run("EK.tgMod='artis'");
    assert.match(run('TURKIYE.icerik()'), /artışı görmek için ikinci bir deneme ekleyin/);
  });
  await check('Sıra view: empty state, school prompt, sentence, cards, the Türkiye comparison, the subject view and the exam table', async () => {
    let h = run('TURKIYE.icerik()');
    assert.match(h, /Henüz liste yok/); assert.match(h, /Ders Ortalamaları İlk 100 Kurum \(Kolej\)/); assert.match(h, /id="tgPdf"/);
    await ekle(liste(1), liste(2));
    h = run('TURKIYE.icerik()');
    assert.match(h, /Okulunuzu seçin/); assert.match(h, /<option value="">Okulunuzu seçin<\/option>/); assert(!h.includes('data-tg-grafik'));
    assert.match(h, /id="tgKaynak"/);
    await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    run("EK.tgMod='sira'"); h = run('TURKIYE.icerik()');
    const m = model(), o = m.ozet[1], p = m.ozet[0];
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.equal(cumle, '27-YKS-1202 (14 Eki) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT: ilk 100’de 2 / 3 ders, ortalama sıra ' +
      o.ort.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' (27-YKS-1201 ile: ' + (p.ort > o.ort ? '▲' : '▼') +
      Math.abs(p.ort - o.ort).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '). En iyi ders: Türkçe, ' + m.dersler[0].seri[1].sira + '. sıra. Türkiye ortalamasının üstünde ' + o.ustu + ' ders.');
    assert.match(h, /<option value="SENTETİK KARTAL ANADOLU LİSESİ" selected>Sentetik Kartal Anadolu Lisesi<\/option>/);
    assert.match(h, /data-tg-grafik="sira"/); assert.equal((h.match(/class="et-ders"/g) || []).length, 3);
    assert.match(h, /Türkiye ortalamasına göre · 27-YKS-1202/); assert.match(h, /ilk 100 dışı<\/b>/);
    assert.match(h, /Dersler · 27-YKS-1202/); assert.match(h, /data-tg-oturum="AYT" aria-pressed="false">/);
    assert.match(h, /id="tgSimdi"/); assert.match(h, /id="tgOnceki"/); assert.match(h, /data-tg-mod="sira" aria-pressed="true"/); assert.match(h, /data-tg-sil="27-YKS-1201\|kolej"/); assert.match(h, /7 Eki 2026 <span class="mini tg-dar-gizle">rapor<\/span>/);
    // One subject: its net chart and the schools around the followed one, with the Türkiye average.
    run('EK.tgDers="TÜRKÇE-T"'); h = run('TURKIYE.icerik()');
    assert.match(h, /data-tg-grafik="net"/); assert.match(h, /Sıralamada yakın · Türkçe · 27-YKS-1202/);
    assert.match(h, /class="tg-cevre-satir tg-biz"><span class="tg-sira">37\.<\/span>/);
    assert.equal((h.match(/class="tg-cevre-satir( tg-biz)?"/g) || []).length, 10);
    assert.match(h, /tg-genel-satir/); assert.match(h, /1 net daha ile \d+\. sıra\./); assert.match(h, /data-tg-ders="">Tüm dersler/);
    // Outside the list: the last schools and a note.
    run('EK.tgDers="FİZİK-T"'); h = run('TURKIYE.icerik()');
    assert.match(h, /Okulunuz bu derste listede yok; listenin sonundaki kurum/);
    assert.match(h, /<span class="tg-sira">100\.<\/span>/);
  });
  await check('menu, the viewing teacher and privacy: the page sits under Denemeler; students never get it or its data', async () => {
    await ekle(liste(1)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='denemeler')[1]"), ['siralamalar', 'turkiye', 'konutakibi', 'yanlislar', 'universite']);
    assert.equal(get("SEKME_REHBER.find(s=>s[0]==='turkiye')[1]"), 'Türkiye geneli');
    run('cizIc()'); assert.match(nodes.ana.innerHTML, /<div id="tgKok">/);
    run('yalnizcaGoruntuleme=()=>true');
    let h = run('TURKIYE.icerik()');
    assert(!h.includes('id="tgPdf"') && !h.includes('id="tgSilHepsi"') && !h.includes('data-tg-sil')); assert(h.includes('data-tg-grafik="t"'));
    run("EK.tgMod='artis'"); assert(run('TURKIYE.icerik()').includes('data-tg-grafik="toplam"')); run("EK.tgMod=undefined");
    await assert.rejects(() => ekle(liste(2)), /Yalnızca rehber/);
    await assert.rejects(async () => run('TURKIYE.okulKaydet(null)'), /Yalnızca rehber/);
    await assert.rejects(async () => run('TURKIYE.sil()'), /Yalnızca rehber/);
    await assert.rejects(async () => run('TURKIYE.sinavSil("27-YKS-1201|kolej")'), /Yalnızca rehber/);
    run('yalnizcaGoruntuleme=__yg');
    const paket = JSON.stringify(run('ogrenciPaketi(0)'));
    assert(!paket.includes('SENTETİK') && !paket.includes('"turkiye"'));
    run("D.rol='ogrenci'"); assert.match(run('TURKIYE.gorunum()'), /rehber öğretmen içindir/);
    run("EK.sekme='turkiye';D.ogr[0].sinavTuru='YKS';cizIc()"); assert.equal(run('EK.sekme'), 'plan');
    run("D.rol='rehber'");
    await run('TURKIYE.sinavSil("27-YKS-1201|kolej")'); assert.equal(run('D.turkiye'), undefined, 'the last list takes the data with it');
    await ekle(liste(1)); await run('TURKIYE.sil()'); assert.equal(run('D.turkiye'), undefined);
  });

  // ---- T puanı (okullar arası) and tahmini sıra ----
  const siraNetleri = (n, N, mu, sigma, gurultu = 0) => Array.from({ length: n }, (_, i) => ({ sira: i + 1, net: Math.round((normalNet(i + 1, N, mu, sigma) + gurultu * Math.sin(i * 12.9898 + N)) * 100) / 100 }));
  const uydur = (satir, mu, n) => { put('Sa', satir); return get('TURKIYE.siraUydur(Sa,' + mu + (n === undefined ? '' : ',' + n) + ')'); };
  await check('T: Φ and Φ⁻¹ agree with known values and each other', () => {
    assert(Math.abs(run('TURKIYE.normCdf(1.96)') - 0.9750021) < 1e-6); assert(Math.abs(run('TURKIYE.normTers(0.975)') - 1.959964) < 1e-5);
    assert.equal(run('TURKIYE.normCdf(0)'), 0.5); assert(Math.abs(run('TURKIYE.normTers(0.5)')) < 1e-12);
    for (const p of [1e-6, 0.001, 0.02, 0.2, 0.5, 0.77, 0.99, 0.999999]) assert(Math.abs(run('TURKIYE.normCdf(TURKIYE.normTers(' + p + '))') - p) < 1e-8, String(p));
    for (const z of [-3, -1.2, 0.3, 2.4]) assert(Math.abs(run('TURKIYE.normTers(' + phi(z) + ')') - z) < 1e-4, 'Φ⁻¹ against the test’s own Φ at ' + z);
  });
  await check('T: the fit recovers N and sigma from synthetic order statistics with known mu, sigma and N', () => {
    for (const [mu, sigma, N] of [[20, 3.5, 180], [11.9, 4.4, 170], [3.7, 0.95, 190], [9, 2, 300], [15, 3, 140]]) {
      const f = uydur(siraNetleri(100, N, mu, sigma), mu);
      assert(Math.abs(f.n - N) <= Math.max(3, N * 0.03), 'exact N ' + N + ' got ' + f.n); assert(Math.abs(f.sigma / sigma - 1) < 0.02, 'sigma ' + sigma + ' got ' + f.sigma);
      assert(f.rmse < 0.02 * sigma + 0.01, 'rmse ' + f.rmse); assert.equal(f.adet, 100);
      // Noise of about a tenth of sigma: N within a fifth, sigma within a tenth, rmse near the noise.
      const g = uydur(siraNetleri(100, N, mu, sigma, 0.1 * sigma), mu);
      assert(Math.abs(g.n - N) <= N * 0.2, 'noisy N ' + N + ' got ' + g.n); assert(Math.abs(g.sigma / sigma - 1) < 0.1, 'noisy sigma ' + g.sigma);
      assert(g.rmse > 0.03 * sigma && g.rmse < 0.15 * sigma, 'noisy rmse ' + g.rmse);
    }
    // sigma given N: the closed form, and the grid never goes below the list's last place + 20.
    const f = uydur(siraNetleri(100, 180, 20, 3.5), 20, 180); assert.equal(f.n, 180); assert(Math.abs(f.sigma - 3.5) < 0.02);
    assert(uydur(siraNetleri(100, 180, 20, 3.5), 20).n >= 120);
    assert.equal(uydur(siraNetleri(5, 180, 20, 3.5), 20), null, 'too few rows'); assert.equal(uydur(siraNetleri(100, 180, 20, 3.5), 20, 90), null, 'N below the list');
  });
  await check('T: pooled N is the median over the subjects that fit well; sigma is fitted again with it', () => {
    const mk = (kod, mu, sigma, N, gurultu = 0, bozuk = false) => ({ kod, soru: 40, genel: mu, satir: siraNetleri(100, N, mu, sigma, gurultu).map(r => bozuk ? { ...r, net: r.net + (r.sira % 2 ? 1 : -1) * 2.2 * sigma } : r) });
    const S = { id: 'x|kolej', ts: 1, dersler: [mk('TÜRKÇE-T', 20, 3.5, 180), mk('MATEMATİK-T', 12, 4.4, 160), mk('FİZİK-T', 4, 0.9, 200), mk('KİMYA-T', 3, 1, 180), mk('TARİH-T', 2.5, 0.5, 180, 0.04), mk('COĞRAFYA-T', 1.5, 0.5, 120, 0, true)] };
    put('S', S); const dg = get('(()=>{const d=TURKIYE.dagilimAl(S);return {n:d.n,aralik:d.aralik,adet:d.adet,dersler:[...d.dersler]}})()');
    assert.equal(dg.adet, 5, 'the badly fitting subject is left out'); assert.equal(dg.n, 180); assert.deepEqual(dg.aralik, [160, 200]);
    const T = dg.dersler.find(([k]) => k.startsWith('TÜRKÇE'))[1], M = dg.dersler.find(([k]) => k.startsWith('MATEMATİK'))[1];
    assert(Math.abs(T.sigma - 3.5) < 0.05); assert.equal(T.kendiN > 170 && T.kendiN < 190, true);
    assert(Math.abs(M.sigma / 4.4 - 1) < 0.1, 'MATEMATİK sigma at the pooled N 180 (its own fit is 160): ' + M.sigma);
    assert.equal(dg.dersler.length, 6, 'every subject still gets a sigma at the pooled N');
    // Even count: the middle two, rounded. No subject fits: no pooled N.
    put('S', { ...S, id: 'y|kolej', dersler: S.dersler.slice(0, 2) }); assert.equal(get('TURKIYE.dagilimAl(S).n'), 170);
    put('S', { ...S, id: 'z|kolej', dersler: [mk('COĞRAFYA-T', 1.5, 0.5, 120, 0, true)] }); assert.equal(get('TURKIYE.dagilimAl(S).n'), null);
    // A pooled N feeds nothing when there is none: the points have no T.
    assert.equal(get('TURKIYE.dagilimAl(S).dersler.size'), 0);
  });
  await check('T and place formulas: a hand example, the estimate, and a floor beyond the printed list', () => {
    assert.equal(run('TURKIYE.tPuani(24,20,4)'), 60); assert.equal(run('TURKIYE.tPuani(18,20,4)'), 45); assert.equal(run('TURKIYE.tPuani(20,20,4)'), 50);
    assert.equal(run('TURKIYE.tPuani(24,20,0)'), null); assert.equal(run('TURKIYE.tPuani(null,20,4)'), null);
    // rank = 1 + (N − 1)(1 − Φ(z)): z = 0 → 1 + 179 / 2 = 90.5 → 91; z = 1 → 1 + 179 × 0.158655 = 29.4 → 29; z = −1 → 1 + 179 × 0.841345 = 151.6 → 152.
    assert.equal(run('TURKIYE.tahminiSira(20,20,4,180)'), 91); assert.equal(run('TURKIYE.tahminiSira(24,20,4,180)'), 29); assert.equal(run('TURKIYE.tahminiSira(16,20,4,180)'), 152);
    assert.equal(run('TURKIYE.tahminiSira(40,20,4,180)'), 1); assert.equal(run('TURKIYE.tahminiSira(-20,20,4,180)'), 180);
    // Beyond the list: never above its last printed place + 1.
    assert.equal(run('TURKIYE.tahminiSira(24,20,4,180,101)'), 101); assert.equal(run('TURKIYE.tahminiSira(-20,20,4,180,101)'), 180);
    assert.equal(run('TURKIYE.tahminiSira(20,20,0,180)'), null); assert.equal(run('TURKIYE.tahminiSira(20,20,4,1)'), null);
  });
  // A synthetic report whose subjects are Normal(Türkiye average, 9 % of the questions) over 180 schools.
  const normalListe = e => liste(e, { normal: { N: 180, oran: 0.09 } }), okulAd = i => i === 7 ? 'SENTETİK KOLEJİ DOĞU KAMPÜSÜ (YAMAÇ) FEN/ANADOLU LİSESİ' : 'SENTETİK KOLEJ ' + String(i + 1).padStart(3, '0') + ' ANADOLU LİSESİ';
  const sl = (net = {}) => run(`SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1201',okul:'ÖZEL ${BIZ}',T:{tarih:'07.10.2026'}},{ad:'27-YKS-1202',okul:'ÖZEL ${BIZ}',T:{tarih:'14.10.2026'}},{ad:'27-YKS-1203',okul:'ÖZEL ${BIZ}',T:{tarih:'21.10.2026'}}]}});__sm=SIRALAMA.model;SIRALAMA.model=s=>({sinif:12,tyt:{kurum:{net:${JSON.stringify(net)}}},ayt:{kurum:{net:{}}}})`);
  await check('T on the page model: in the list the real place and the listed net; outside, an estimate; no net, a gap', async () => {
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    let m = model(); const [tur, mat, fiz] = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'].map(k => m.dersler.find(d => d.kod === k));
    // Every subject's pooled N is the generated 180 (fit within a few percent); sigma is 9 % of the questions.
    assert(Math.abs(m.sinavlar[0].dag.n - 180) <= 10, 'pooled N ' + m.sinavlar[0].dag.n); assert(Math.abs(tur.seri[0].dg.sigma / (40 * 0.09) - 1) < 0.05);
    // Inside the list: the printed place, the listed net, no estimate. T from the hand formula with the fitted sigma.
    const p = tur.seri[0]; assert(p.sira >= 1 && p.sira <= 100); assert.equal(p.net, 24.1); assert.equal(p.kaynak, 'liste'); assert.equal(p.tahmin, null);
    assert(Math.abs(p.t - (50 + 10 * (24.1 - p.genel) / p.dg.sigma)) < 1e-9); assert(p.t > 55 && p.t < 70, 'T ' + p.t);
    // Outside the list, no other source: a gap, never a guess.
    assert.equal(mat.seri[0].sira, null); assert.equal(mat.seri[0].net, null); assert.equal(mat.seri[0].tNet, null); assert.equal(mat.seri[0].t, null); assert.equal(mat.seri[0].tahmin, null); assert.equal(mat.seri[0].kaynak, null);
    // Outside the list, Sıralamalar' school average of the exam: T and an estimate, marked as from there.
    sl({ MAT: 12.4, FİZ: 2.3 }); m = model(); const q = m.dersler.find(d => d.kod === 'MATEMATİK-T').seri[0], fz = m.dersler.find(d => d.kod === 'FİZİK-T').seri[0];
    assert.equal(q.sira, null); assert.equal(q.net, null); assert.equal(q.tNet, 12.4); assert.equal(q.kaynak, 'okul');
    assert(Math.abs(q.t - (50 + 10 * (12.4 - q.genel) / q.dg.sigma)) < 1e-9);
    const beklenen = 1 + (q.dg.n - 1) * (1 - phi((12.4 - q.genel) / q.dg.sigma)); assert(Math.abs(q.tahmin - Math.max(101, Math.round(beklenen))) <= 1, 'estimate ' + q.tahmin + ' vs ' + beklenen);
    assert(q.tahmin > 100 && q.tahmin <= q.dg.n, 'beyond the printed list'); assert.equal(fz.tahmin > 100, true);
    // The printed place is never replaced, even when Sıralamalar has a figure for it.
    sl({ TÜR: 99 }); m = model(); assert.equal(m.dersler.find(d => d.kod === 'TÜRKÇE-T').seri[0].net, 24.1); assert.equal(m.dersler.find(d => d.kod === 'TÜRKÇE-T').seri[0].kaynak, 'liste'); assert.equal(m.dersler.find(d => d.kod === 'TÜRKÇE-T').seri[0].tahmin, null);
    // Sıralamalar about another school: not used.
    run(`SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1201',okul:'BAŞKA BİR OKUL'}]}})`); m = model(); assert.equal(m.dersler.find(d => d.kod === 'MATEMATİK-T').seri[0].tNet, null);
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm');
  });
  await check('T of a total: the sum of the nets against the sum of the averages; sigma between √Σσ² and Σσ; a gap when a subject is missing', async () => {
    assert(Math.abs(run('TURKIYE.toplamSigma([3,4],0)') - 5) < 1e-12); assert(Math.abs(run('TURKIYE.toplamSigma([3,4],1)') - 7) < 1e-12);
    assert(Math.abs(run('TURKIYE.toplamSigma([3,4],0.8)') - Math.sqrt(0.2 * 25 + 0.8 * 49)) < 1e-12); assert.equal(run('TURKIYE.toplamSigma([3,0])'), null); assert.equal(run('TURKIYE.toplamSigma([])'), null);
    assert.equal(run('TURKIYE.TOPLAM_KORELASYON'), 0.8, 'the default when no correlation can be measured');
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    sl({ MAT: 12.4, FİZ: 2.3 }); const m = model(), T = m.toplam, ders = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'].map(k => m.dersler.find(d => d.kod === k));
    assert.equal(T.key, 'TYT');
    const p = T.tseri[0], ps = ders.map(d => d.seri[0]), mu = ps.reduce((t, x) => t + x.genel, 0), net = ps.reduce((t, x) => t + x.tNet, 0), sg = ps.map(x => x.dg.sigma);
    assert(Math.abs(p.genel - mu) < 1e-9); assert(Math.abs(p.net - net) < 1e-9); assert(p.sigma > Math.sqrt(sg.reduce((t, x) => t + x * x, 0)) && p.sigma <= sg.reduce((t, x) => t + x, 0));
    assert(Math.abs(p.t - (50 + 10 * (net - mu) / p.sigma)) < 1e-9); assert.equal(p.sira, null, 'a total has no printed place'); assert.equal(p.kaynak, 'okul');
    assert(Math.abs(p.tahmin - Math.round(1 + (p.n - 1) * (1 - phi((net - mu) / p.sigma)))) <= 1);
    assert(Math.abs(p.ortT - ps.reduce((t, x) => t + x.t, 0) / 3) < 1e-9);
    // Without Sıralamalar the school's net in Matematik and Fizik is unknown: the total has no T.
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm'); const q = model().toplam.tseri[0]; assert.equal(q.t, null); assert.equal(q.tahmin, null); assert.equal(q.yok, 'net'); assert(q.genel > 0);
    // An AYT session without the subjects of a field has no total: the chart reads the subjects' mean T, labelled so.
    run("EK.tgOturum='AYT'"); const a = model({ oturum: 'AYT' }); assert.equal(a.toplam, null); assert.equal(a.ortT.ad, 'Ders ortalaması T');
    assert(a.ortT.tseri.some(x => x && x.t !== null));
  });
  await check('T of a total: correlations corrected for range restriction (Thorndike Case II), the total sigma, the fallbacks', async () => {
    assert(Math.abs(run('TURKIYE.duzeltilmisR(0.5,1)') - 0.5) < 1e-12, 'u = 1 changes nothing'); assert.equal(run('TURKIYE.duzeltilmisR(0.9,50)'), 0.98); assert.equal(run('TURKIYE.duzeltilmisR(-0.3,2)'), 0);
    assert(Math.abs(run('TURKIYE.duzeltilmisR(0.6,2)') - 0.6 * 2 / Math.sqrt(1 - 0.36 + 0.36 * 4)) < 1e-12);
    // A bivariate-normal population (rho 0.85) of 180 schools; each subject lists its own top 100 (so the schools common to both
    // lists are selected on both), the sample the report gives. u comes from each subject's whole list, as on the page.
    let seed = 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const rho = 0.85, SA = 4, SB = 2, pop = Array.from({ length: 180 }, (_, i) => { const a = gauss(), b = rho * a + Math.sqrt(1 - rho * rho) * gauss(); return { ad: 'S' + i, a: SA * a, b: SB * b }; });
    const liste = k => pop.slice().sort((x, y) => y[k] - x[k]).slice(0, 100), la = liste('a'), lb = liste('b');
    const sd = l => run('TURKIYE.sdAl(' + JSON.stringify(l) + ')'), Map_ = run('Map');
    sandbox.A = { sigma: SA, sd: sd(la.map(o => o.a)), net: new Map_(la.map(o => [o.ad, o.a])) }; sandbox.B = { sigma: SB, sd: sd(lb.map(o => o.b)), net: new Map_(lb.map(o => [o.ad, o.b])) };
    const c = get('TURKIYE.ciftKorelasyon(A,B)');
    assert(c.n >= 30 && c.n < 100); assert(c.r < 0.75, 'the observed r is attenuated: ' + c.r); assert(c.u > 1.3, 'u ' + c.u); assert(Math.abs(c.R - rho) < 0.1, 'corrected R ' + c.R + ' vs ' + rho); assert(c.R - c.r > 0.08, 'clearly above the observed r');
    assert.equal(get('(()=>{const a={...A,net:new Map([...A.net].slice(0,20))};return TURKIYE.ciftKorelasyon(a,B)})()'), null, 'fewer than 30 schools in common');
    // The total sigma follows R: the corrected matrix gives a larger sigma than the observed r, and 0.8 is just a default.
    const s1 = run('TURKIYE.toplamSigma([4,2],[[1,' + c.R + '],[' + c.R + ',1]])'), s0 = run('TURKIYE.toplamSigma([4,2],[[1,' + c.r + '],[' + c.r + ',1]])');
    assert(Math.abs(s1 - Math.sqrt(16 + 4 + 2 * c.R * 8)) < 1e-12); assert(s1 > s0 + 0.05);
    // Fallbacks: a pair with fewer than 30 schools in common takes the median of the other pairs; with none, 0.8 and "varsayılan".
    const mk = (kod, adlar) => ({ kod, soru: 40, genel: 20, satir: siraNetleri(100, 180, 20, 3.5).map((r, i) => ({ ...r, ad: adlar(i) })) });
    put('S', { id: 'k1|kolej', ts: 1, dersler: [mk('TÜRKÇE-T', i => 'a' + i), mk('MATEMATİK-T', i => i < 50 ? 'a' + i : 'b' + i), mk('FİZİK-T', i => 'c' + i)] });
    const kk = get("(()=>{const d=TURKIYE.dagilimAl(S);const k=[...d.dersler.keys()];const t=TURKIYE.toplamKorelasyon(k,d.cift);return {R:t.R,o:t.ortanca,v:t.varsayilan,adet:t.adet,c:[...d.cift].map(([a,x])=>[a,x&&x.n])}})()");
    assert.equal(kk.adet, 1); assert.equal(kk.v, false); assert.equal(kk.R[0][1], 0.98); assert.equal(kk.R[0][2], 0.98, 'a pair with no common schools takes the median'); assert.equal(kk.R[1][2], 0.98); assert.equal(kk.o, 0.98);
    put('S', { id: 'k2|kolej', ts: 1, dersler: [mk('TÜRKÇE-T', i => 'a' + i), mk('MATEMATİK-T', i => 'm' + i), mk('FİZİK-T', i => 'c' + i)] });
    const k2 = get("(()=>{const d=TURKIYE.dagilimAl(S);return TURKIYE.toplamKorelasyon([...d.dersler.keys()],d.cift)})()"); assert.equal(k2.varsayilan, true); assert.equal(k2.ortanca, 0.8); assert.equal(k2.R[0][1], 0.8);
    assert.equal(run('TURKIYE.toplamKorelasyon(["x"],new Map()).varsayilan'), false, 'one subject needs no correlation');
    // On the page: the schools of the fixture are in the same order in every subject, so the correlation is as high as allowed.
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    const m = model(), pt = m.toplam.tseri[0], sg = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'].map(k => m.dersler.find(d => d.kod === k).seri[0].dg.sigma);
    assert.equal(pt.rVarsayilan, false); assert.equal(pt.rOrt, 0.98); assert(Math.abs(pt.sigma - run('TURKIYE.toplamSigma(' + JSON.stringify(sg) + ',0.98)')) < 1e-9);
    assert(pt.sigma > run('TURKIYE.toplamSigma(' + JSON.stringify(sg) + ',0.8)'), 'the corrected total sigma differs from the fixed 0.8 one');
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const g = run('TURKIYE.grafikT(ST,600)');
    assert.match(g.ipucu[1].satir.map(x => x.slice(1, 3).join(' ')).join(' | '), /Derslerarası r ≈ 0,98 \(düzeltilmiş\)/);
    assert.match(g.svg, /text-anchor="start">Türkiye’nin ortasındaki okul/);
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm');
  });
  // ---- complete lists, ΔT ranking, range, table ---------------------------------------------------------------------------------------
  // A list of 80 schools plus the followed one (81 rows, fewer than the nominal 100): the whole population, not a truncated top.
  const tamListe = e => liste(e, { normal: { N: 80, oran: 0.09 } });
  const ozelListe = (e, mut, o = { normal: { N: 180, oran: 0.09 } }) => { const L = kurumListesi(e, o); mut(L); return coz(kurumRaporu(L).pages, dosya(e)); };
  const ort = l => l.reduce((a, v) => a + v, 0) / l.length, sapma = l => { const m = ort(l); return Math.sqrt(ort(l.map(v => (v - m) ** 2))); };
  const T0 = (x, l) => 50 + 10 * (x - ort(l)) / sapma(l);
  const icinde = code => get('(()=>{const m=TURKIYE.model(D.turkiye,{mod:"tpuan",aralik:"tum"});' + code + '})()');
  await check('complete lists (fewer than 100 rows): N is the row count, mu and sigma are empirical, T and the place are exact, the total comes from the school sums', async () => {
    await ekle(tamListe(1), tamListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const L = tamListe(1), tur = L.dersler.find(d => d.kod === 'TÜRKÇE-T'), nets = tur.satir.map(r => r.net), biz = tur.satir.find(r => r.ad === BIZ);
    assert.equal(tur.satir.length, 81);
    const m = model({ mod: 'tpuan' }), p = m.dersler.find(d => d.kod === 'TÜRKÇE-T').seri[0];
    assert.equal(m.sinavlar[0].dag.n, 81); assert.equal(p.dg.tam, true); assert.equal(p.dg.n, 81); assert(Math.abs(p.dg.mu - ort(nets)) < 1e-9, 'the school-level mean, not Genel Net'); assert(Math.abs(p.dg.sigma - sapma(nets)) < 1e-9);
    assert(Math.abs(p.t - T0(biz.net, nets)) < 1e-9); assert.equal(p.sira, biz.sira); assert.equal(p.tahmin, null); assert.equal(p.kaynak, 'liste');
    // The total: every school's nets summed over the TYT subjects, matched by name; the exact place from that ranking.
    const tyt = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'].map(k => L.dersler.find(d => d.kod === k)), toplam = new Map();
    for (const d of tyt) for (const r of d.satir) toplam.set(r.ad, (toplam.get(r.ad) || 0) + r.net);
    const sums = [...toplam.values()], x = toplam.get(BIZ), tp = m.toplam.tseri[0];
    assert.equal(tp.tam, true); assert.equal(tp.n, 81); assert(Math.abs(tp.sigma - sapma(sums)) < 1e-9); assert(Math.abs(tp.genel - ort(sums)) < 1e-9); assert(Math.abs(tp.t - T0(x, sums)) < 1e-9);
    assert.equal(tp.sira, 1 + sums.filter(v => v > x + 1e-9).length); assert.equal(tp.tahmin, null); assert.equal(tp.rOrt, null);
    // The page says so on hover: "tam liste · 81 okul".
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const g = run('TURKIYE.grafikT(ST,600)');
    assert.match(g.ipucu[0].satir.map(x => x.slice(1, 3).join(' ')).join(' | '), /N tam liste · 81 okul/); assert.match(g.ipucu[0].satir.map(x => x.slice(1, 3).join(' ')).join(' | '), /Okul ortalaması \(tam liste\)/);
  });
  await check('ΔT ranking: schools in both exams, ties share a place, the total, and the followed school placed with "≈" when it is missing from a list', async () => {
    const esit = L => { for (const d of L.dersler) { const a = d.satir.find(r => r[0] === okulAd(40)), b = d.satir.find(r => r[0] === okulAd(41)); b[1] = a[1]; } };   // two schools with equal nets in every exam
    await ekle(ozelListe(1, esit, { normal: { N: 80, oran: 0.09 } }), ozelListe(2, esit, { normal: { N: 80, oran: 0.09 } })); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const nets = e => { const L = kurumListesi(e, { normal: { N: 80, oran: 0.09 } }); esit(L); return L.dersler.find(d => d.kod === 'TÜRKÇE-T').satir; };
    const a = nets(1), b = nets(2), ta = new Map(a.map(r => [r[0], T0(r[1], a.map(x => x[1]))])), tb = new Map(b.map(r => [r[0], T0(r[1], b.map(x => x[1]))]));
    const bek = [...ta].filter(([k]) => tb.has(k)).map(([k, v]) => [k, Math.round((tb.get(k) - v) * 100) / 100]).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'tr'));
    const sira = new Map(); bek.forEach(([k, f], j) => sira.set(k, j && Math.abs(bek[j - 1][1] - f) < 1e-9 ? sira.get(bek[j - 1][0]) : j + 1));
    const r = icinde('const d=m.dersler.find(x=>x.kod==="TÜRKÇE-T");const R=TURKIYE.artisT(m,d,0,1);return {satir:R.satir.map(r=>[r.ad,r.fark,r.sira]),biz:[R.biz.fark,R.biz.sira,R.yaklasik],n:R.nOrtak}');
    assert.equal(r.n, 81); assert.equal(r.satir.length, 81); for (const [ad, f, si] of r.satir) { assert(Math.abs(f - bek.find(x => x[0] === ad)[1]) < 1e-9); assert.equal(si, sira.get(ad), ad); }
    assert.equal(r.biz[2], false); assert.equal(r.biz[1], sira.get(BIZ));
    const e5 = r.satir.find(x => x[0] === okulAd(40)), e6 = r.satir.find(x => x[0] === okulAd(41)); assert.equal(e5[2], e6[2], 'equal increases share a place'); assert.equal(e5[1], e6[1]);
    const sonraki = r.satir.find(x => x[2] > e5[2]); assert(sonraki[2] >= e5[2] + 2, 'the next place skips the tie');
    // The total (sum over the TYT subjects) is ranked the same way, over the schools in every list.
    const t = icinde('const R=TURKIYE.artisT(m,"toplam",0,1);return {n:R.nOrtak,biz:[R.biz.fark,R.biz.sira,R.yaklasik]}'); assert.equal(t.n, 81); assert.equal(t.biz[2], false); assert(t.biz[1] >= 1 && t.biz[1] <= 81);
    // The measure in the chart: the transitions, 1 at the top.
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const g = run('TURKIYE.grafikTArtis(ST,600)'); assert.equal(g.xs.length, 1); assert.match(g.ipucu[0].satir[0].slice(1, 3).join(' '), /artış sırası \d+\./); assert.equal(g.seriler, undefined, 'the main chart has one series'); assert.equal(run('TURKIYE.grafikDTArtis(ST,600)').seriler.length, 3);
    assert.match(g.svg, /1201→1202|1→1202|201→1202/);
  });
  await check('ΔT ranking: the followed school outside the lists is placed by its own T and marked ≈, with the schools common to both lists counted', async () => {
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const u = () => icinde('const d=m.dersler.find(x=>x.kod==="MATEMATİK-T");const R=TURKIYE.artisT(m,d,0,1);return {biz:R.biz&&[R.biz.fark,R.biz.sira,!!R.biz.yaklasik],n:R.nOrtak,top:R.satir.length}');
    assert.equal(u().biz, null, 'no net for the school: no place');
    sl({ MAT: 12.4, FİZ: 2.3 }); const v = u(); assert.equal(v.biz[2], true); assert.equal(v.top, v.n + 1); assert(v.n >= 90);
    // Its ΔT is its own T in the later exam against the earlier one, placed among the others.
    const t = icinde('const d=m.dersler.find(x=>x.kod==="MATEMATİK-T");return [d.seri[0].t,d.seri[1].t]'); assert(Math.abs(v.biz[0] - Math.round((t[1] - t[0]) * 100) / 100) < 1e-9);
    // In the table it is the pinned, marked row; its place column says ≈.
    run('EK.tgDers="MATEMATİK-T"'); const h = run('TURKIYE.icerik()'); assert.match(h, /<tr class="tg-biz tg-pin"[^>]*>[\s\S]*?≈ \d+\./);
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm');
  });
  await check('complete and truncated lists together: per exam, and inside one exam', async () => {
    await ekle(normalListe(1), tamListe(2), normalListe(3)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    const m = icinde('return {n:m.sinavlar.map(s=>s.dag.n),tam:m.dersler[0].seri.map(p=>p&&p.dg&&p.dg.tam),tt:m.toplam.tseri.map(p=>p&&{tam:!!p.tam,t:p.t,sigma:p.sigma,n:p.n})}');
    assert(Math.abs(m.n[0] - 180) <= 10); assert.equal(m.n[1], 81); assert(Math.abs(m.n[2] - 180) <= 10); assert.deepEqual(m.tam, [false, true, false]);
    assert.equal(m.tt[1].tam, true); assert.equal(m.tt[0].tam, false); assert(m.tt.every(x => x.t !== null && x.sigma > 0));
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); for (const f of ['grafikT', 'grafikTSira', 'grafikTArtis']) { const g = run('TURKIYE.' + f + '(ST,600)'); assert(g, f); assert(g.xs.length >= 2); }
    assert.match(run('TURKIYE.icerik()'), /id="tgOkullar"/);
    // One exam with a complete subject and a truncated one: each keeps its own N.
    const mk = (kod, n, N) => ({ kod, soru: 40, genel: 20, satir: siraNetleri(n, N, 20, 3.5).map((r, i) => ({ ...r, ad: kod + i })) });
    put('S', { id: 'q|kolej', ts: 1, dersler: [mk('TÜRKÇE-T', 100, 180), mk('MATEMATİK-T', 80, 80), mk('FİZİK-T', 100, 180)] });
    const dg = get('(()=>{const d=TURKIYE.dagilimAl(S);return {n:d.n,d:[...d.dersler].map(([k,v])=>[k,v.tam,v.n])}})()');
    assert(Math.abs(dg.n - 180) <= 10); const dd = k => dg.d.find(x => x[0].startsWith(k)); assert.equal(dd('TÜRKÇE')[1], false); assert.equal(dd('MATEMATİK')[1], true); assert.equal(dd('FİZİK')[1], false); assert.equal(dd('MATEMATİK')[2], 80); assert(Math.abs(dd('TÜRKÇE')[2] - 180) <= 10);
  });
  await check('subject cards: the change over the range as a green / red / grey pill with arrow and sign, "—" when an end is missing', async () => {
    assert.deepEqual([[1, 99], [33, 99], [34, 99], [66, 99], [67, 99], [99, 99]].map(([a, b]) => run('TURKIYE.artisSinifi(' + a + ',' + b + ')')), [1, 1, 0, 0, -1, -1]);
    await ekle(liste(1, { normal: { N: 80, oran: 0.09 }, dersler: DERSLER.filter(d => d[0] !== 'MATEMATİK-T') }), tamListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const c = icinde('const f=(k,g)=>TURKIYE.degisimKart(m,m.dersler.find(x=>x.kod===k),g);const d=m.dersler.find(x=>x.kod==="TÜRKÇE-T");return {t:f("TÜRKÇE-T","t"),s:f("TÜRKÇE-T","sira"),a:f("TÜRKÇE-T","artis"),mt:f("MATEMATİK-T","t"),ms:f("MATEMATİK-T","sira"),ma:f("MATEMATİK-T","artis"),dt:d.seri[1].t-d.seri[0].t,ds:d.seri[0].sira-d.seri[1].sira}');
    const sinif = h => /et-hap (yukari|asagi|esit)/.exec(h)[1], yazi = h => h.replace(/<[^>]+>/g, '').trim();
    assert.equal(sinif(c.t), c.dt > 0.5 ? 'yukari' : c.dt < -0.5 ? 'asagi' : 'esit'); assert.match(yazi(c.t), /^[▲▼]? ?%\d+(,\d)? → %\d+(,\d)?$/, 'the card says the dilim change, colour still from ΔT'); assert(!/ T$/.test(yazi(c.t)));
    assert.equal(/▲/.test(c.t), c.dt > 0.5); assert.equal(/▼/.test(c.t), c.dt < -0.5);
    assert.equal(sinif(c.s), c.ds > 0 ? 'yukari' : c.ds < 0 ? 'asagi' : 'esit'); assert.match(yazi(c.s), c.ds === 0 ? /^0 sıra$/ : c.ds > 0 ? /^▲ ?\d+ sıra$/ : /^▼ ?\d+ sıra$/);
    assert.match(yazi(c.a), /^[▲▼]? ?Artış \d+\. \/ \d+$/); assert.match(c.a, /Okullar arasında ΔT sırası/);
    for (const k of ['mt', 'ms', 'ma']) { assert.match(c[k], /et-hap esit tg-yok[^>]*>—</); assert(!/▲|▼/.test(c[k])); }
  });
  await check('Karşılaştır range, the KPI strip, the schools table (sorting, the followed school, rows without both exams) and the toggle state', async () => {
    const degis = L => { for (const d of L.dersler) d.satir[99][0] = 'SENTETİK DEĞİŞEN OKUL'; };
    await ekle(ozelListe(1, () => {}), ozelListe(2, () => {}), ozelListe(3, degis)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    const r = a => get('(()=>{const m=TURKIYE.model(D.turkiye,{mod:"tpuan",aralik:"' + a + '",onceki:"27-YKS-1201|kolej",simdi:"27-YKS-1203|kolej"});return [m.onceki,m.simdi]})()');
    assert.deepEqual(r('tum'), [0, 2]); assert.deepEqual(r('1'), [1, 2]); assert.deepEqual(r('3'), [0, 2]); assert.deepEqual(r('sec'), [0, 2]);
    let h = run('TURKIYE.icerik()');
    assert.match(h, /<span class="et-seg-label">Karşılaştır<\/span>/); for (const k of ['tum', '1', '3', '5', 'sec']) assert(h.includes('data-tg-aralik="' + k + '"'), k);
    assert.match(h, /data-tg-aralik="5"[^>]*disabled/); assert(!h.includes('id="tgOnceki"')); run("EK.tgAralik='sec'"); assert.match(run('TURKIYE.icerik()'), /id="tgOnceki"[\s\S]*id="tgSimdi"/); run("EK.tgAralik=undefined");
    // KPI strip: the change in T with its increase place first, the supporting tiles with comparisons.
    assert.match(h, /id="tgKpi"/); assert.match(h, /dp-kpi-ana[\s\S]*Değişim · TYT toplam[\s\S]*ilk %\d+(,\d)? → ilk %\d+(,\d)?[\s\S]*Artış sırası (≈ )?\d+\. \/ \d+ okul/); assert.match(h, /Ortalamanın üstünde[\s\S]*Okul sayısı/);
    // Table: default by ΔT, largest first; rows missing from an exam show "—"; the followed school is pinned and marked.
    const tbody = x => /<tbody>([\s\S]*?)<\/tbody>/.exec(x.slice(x.indexOf('id="tgOkullar"')))[1], satirlar = x => [...tbody(x).matchAll(/<tr class="([^"]*)"[^>]*data-okul="([^"]*)">([\s\S]*?)<\/tr>/g)].map(m => ({ biz: /tg-biz/.test(m[1]), td: [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(z => z[1].replace(/<[^>]+>/g, '').trim()) }));
    let l = satirlar(h); const farkHam = [...tbody(h).matchAll(/<td class="sayi[^"]*"(?: data-fark="([^"]*)")?>/g)].map(m => m[1]); assert(l.every(x => x.td[3] === '—' || /^ilk %\d+(,\d)? → ilk %\d+(,\d)?$/.test(x.td[3])), 'the change is said as dilim → dilim');
    const fark = [...tbody(h).matchAll(/data-fark="([^"]*)"/g)].map(m => Number(m[1]));
    assert(fark.length > 90); assert.deepEqual(fark, fark.slice().sort((a, b) => b - a), 'sorted by ΔT, largest first');
    const eksik = l.filter(x => x.td[3] === '—'); assert(eksik.some(x => /Sentetik Değişen Okul/.test(x.td[0])) && eksik.some(x => /Sentetik Koleji? ?/.test(x.td[0]) || /Sentetik Kolej 100/.test(x.td[0])), 'schools in only one exam: ΔT "—"');
    assert.equal(l.filter(x => x.biz).length, 1); assert.match(h, /<tfoot><tr class="tg-biz tg-pin"/); assert.match(h, /id="tgBizSatir"/); assert.match(h, /data-tg-biz="1">Bizim okul/);
    run("EK.tgSira='ad';EK.tgSiraYon='artan'"); l = satirlar(run('TURKIYE.icerik()')); const adlar = l.map(x => x.td[0].replace(/ · bizim okul/, '')); assert.deepEqual(adlar, adlar.slice().sort((a, b) => a.localeCompare(b, 'tr')), 'sorted by name');
    run("EK.tgSira='t';EK.tgSiraYon=undefined"); l = satirlar(run('TURKIYE.icerik()')); const ts = l.map(x => x.td[1]).filter(v => v !== '—').map(v => Number(v.replace('ilk %', '').replace(',', '.'))); assert.deepEqual(ts, ts.slice().sort((a, b) => a - b), 'dilim, smallest (best) first');
    run('EK.tgSira=undefined;EK.tgSiraYon=undefined');
    // One subject: the table and the ranking follow it.
    run('EK.tgDers="TÜRKÇE-T"'); h = run('TURKIYE.icerik()'); assert.match(h, /Okullar · Türkçe/); assert.match(h, /Artış sıralaması · Türkçe/); assert.match(h, /Sıra, okulun kendi düzeyine göre ne kadar ilerlediğine göredir; üst dilimlerde ilerlemek daha zordur\./); assert.match(h, /data-tg-grafik="t"/);
  });
  await check('T view: default page, sentence, charts, cards and table; hover text carries ≈ and N; Artış and Sıra stay reachable', async () => {
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    let h = run('TURKIYE.icerik()');
    assert.match(h, /data-tg-mod="tpuan" aria-pressed="true">Dilim ve sıra/); assert.match(h, /data-tg-mod="artis" aria-pressed="false">Artış/); assert.match(h, /data-tg-mod="sira" aria-pressed="false">Sıra/);
    assert.match(h, /data-tg-grafik="t"/); assert(!h.includes('data-tg-grafik="tsira"') && h.includes('data-tg-grafik="dt"'), 'the main chart and the Dersler chart, one measure at a time'); assert(!h.includes('id="tgOnceki"') && !h.includes('id="tgSimdi"'), 'the exam pickers only appear under Seç');
    assert.match(h, /data-tg-gor="t" aria-pressed="true">Dilim/); assert.match(h, /data-tg-gor="sira" aria-pressed="false">Sıra/); assert.match(h, /data-tg-gor="artis" aria-pressed="false">Artış sırası/);
    assert.match(h, /Dilim · TYT toplam/); assert.match(h, /<h2 class="et-bolum" id="tgDersler">Dersler · TYT toplam<\/h2>/); assert.match(h, /Dilim · dersler/); assert.match(h, /Türkiye’nin ortasındaki okul/); assert.match(h, /▲ yeşil: üst dilime çıktı \(iyileşti\) · ▼ kırmızı: alt dilime düştü/); assert.match(h, /Kaynaklar ve hesaplama[\s\S]*Dilim, okulun Türkiye’deki okulların yüzde kaçının gerisinde kaldığını gösterir: ilk %12 = okulların %88’inden iyi\./);
    assert(h.indexOf('id="tgTPanel"') < h.indexOf('id="tgDersler"') && h.indexOf('id="tgDPanel"') < h.indexOf('class="et-dersler"') && h.indexOf('class="et-dersler"') < h.indexOf('id="tgArtisSira"') && h.indexOf('id="tgArtisSira"') < h.indexOf('id="tgOkullar"'), 'order: main chart, Dersler chart, cards, ranking, table');
    run("EK.tgGrafik='sira'"); let hs = run('TURKIYE.icerik()'); assert.match(hs, /data-tg-grafik="tsira"/); assert.match(hs, /data-tg-grafik="dtsira"/); assert(!hs.includes('data-tg-grafik="t"')); assert.match(hs, /Sıra · TYT toplam/); assert.match(hs, /Sıra · dersler/);
    run("EK.tgGrafik='artis'"); hs = run('TURKIYE.icerik()'); assert.match(hs, /data-tg-grafik="tartis"/); assert.match(hs, /data-tg-grafik="dtartis"/); assert.match(hs, /Artış sırası · TYT toplam/); run('EK.tgGrafik=undefined');
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.match(cumle, /^27-YKS-1202 \(14 Eki\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: Türkiye’de ilk %\d+(,\d)? \(27-YKS-1201 ile: ilk %\d+(,\d)? → ilk %\d+(,\d)?\) · ≈ \d+ okul içinde ≈ \d+\. · (Türkiye’nin en üst okulları arasında|Ortalamanın belirgin üstünde|Ortalamanın üstünde|Türkiye ortalaması civarında|Ortalamanın altında|Ortalamanın belirgin altında)\.$/);
    assert.equal((h.match(/class="et-ders"/g) || []).length, 3); assert.match(h, /≈ \d+\. sıra/); assert.match(h, /\d+\. sıra/);
    assert.match(h, /<h2>Dersler · 27-YKS-1202<\/h2>/); assert.match(h, /<th class="sayi">Dilim<\/th>/); assert.match(h, /<strong>ilk %\d+(,\d)?<\/strong>/); assert(!/<th class="sayi">T<\/th>|<strong>[\d,]+<span class="tg-bolu"> T/.test(h), 'no headline T');
    // The charts: the 50 line with its label; Turkish decimals; the estimate in the tooltip, N too; hollow markers outside the list.
    const st = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); put('ST', st); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)');
    const g = run('TURKIYE.grafikT(ST,600)'), r = run('TURKIYE.grafikTSira(ST,600)');
    assert.match(g.svg, /Türkiye’nin ortasındaki okul<\/text>/); assert.match(g.svg, /Türkiye yüzdelik dilimi \(küçük = daha iyi\)/);
    { const yy = e => Number(new RegExp('y="([\\d.]+)"[^>]*dy="0.32em">' + e + '</text>').exec(g.svg)[1]), T = d => run('TURKIYE.dilimdenT(' + d + ')');
      assert(yy('ilk %1') < yy('ilk %5') && yy('ilk %5') < yy('ilk %95'), 'ilk %1 at the top'); assert.equal(T(50), 50);
      assert(Math.abs((yy('ilk %5') - yy('ilk %1')) / (yy('ilk %95') - yy('ilk %5')) - (T(1) - T(5)) / (T(5) - T(95))) < .02, 'z scale, not a linear dilim axis'); }
    assert.equal(g.ipucu.length, 2); const satirlar = i => g.ipucu[i].satir.map(x => x.slice(1, 3).join(' ')).join(' | ');
    assert.match(satirlar(1), /Türkiye dilimi ilk %\d+/); assert.match(satirlar(1), /Hesap T \d+,\d · net \d+,\d\d · σ \d+,\d\d/); assert.match(satirlar(1), /N ≈ 1[6-9]\d okul \(derslerde \d+–\d+\)/);
    assert.match(r.ipucu[1].satir.map(x => x.slice(1, 3).join(' ')).join(' | '), /tahmini sıra ≈ \d+\./); assert.match(r.svg, /tg-disi-nokta/); assert.match(r.svg, /kesik/);
    // One subject: its own pair. A listed subject draws a solid line of filled points; Matematik is outside the list and estimated.
    run('EK.tgDers="TÜRKÇE-T"'); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const rt = run('TURKIYE.grafikDTSira(ST,600)');
    assert.match(rt.ipucu[0].satir[0].slice(1, 3).join(' '), /^TÜRKÇE-T|Türkçe · sıra \d+\.$/); assert(!/tg-disi-nokta/.test(rt.svg), 'listed in both exams: no hollow markers');
    run('EK.tgDers="MATEMATİK-T"'); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const rm = run('TURKIYE.grafikDTSira(ST,600)');
    assert.match(rm.svg, /tg-disi-nokta/); assert.match(rm.ipucu[0].satir[0].slice(1, 3).join(' '), /Matematik · tahmini sıra ≈ \d+\./);
    // The y-axis of the place chart runs from 1 to about N, with 1 at the top.
    assert.match(rm.svg, />1\.<\/text>/); assert.match(rm.svg, />200\.<\/text>|>150\.<\/text>/);
    // Without Sıralamalar, Matematik has no T: the tooltip says why, nothing is drawn for it.
    run('SIRALAMA.oku=__so;SIRALAMA.model=__sm'); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); assert.equal(run('TURKIYE.grafikT(ST,600)'), null);
    run('EK.tgDers=undefined'); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const gu = run('TURKIYE.grafikDT(ST,600)'); assert(gu && !gu.ipucu[0].satir.some(x => /Matematik/.test(x[1])), 'a subject without T leaves a gap in the all-lines chart');
    run('EK.tgDers="MATEMATİK-T"'); h = run('TURKIYE.icerik()'); assert.match(h, /Dilim hesaplanamıyor/); assert.match(h, /Derslerin dilimi hesaplanamıyor/);
    // The old views are the same as before.
    run("EK.tgDers=undefined;EK.tgMod='artis'"); h = run('TURKIYE.icerik()'); assert.match(h, /data-tg-grafik="toplam"/); assert(!h.includes('data-tg-grafik="t"'));
    run("EK.tgMod='sira'"); h = run('TURKIYE.icerik()'); assert.match(h, /data-tg-grafik="sira"/);
    sl({ MAT: 12.4, FİZ: 2.3 }); run("EK.tgMod='bilinmeyen'"); assert.match(run('TURKIYE.icerik()'), /data-tg-grafik="t"/, 'an unknown view falls back to T'); run('SIRALAMA.oku=__so;SIRALAMA.model=__sm');
  });
  await check('a list that is most of its schools (most printed below the Türkiye average): centre and spread fitted from the list, one N per session; the Türkiye average a separate line (hand-worked)', async () => {
    // 140 schools per subject, centre half a spread below the Türkiye average, the first 100 printed: like the publisher's Kolej lists.
    const kolej = e => liste(e, { normal: { N: 140, oran: 0.12, kayma: 0.5 } });
    const L = kolej(1), tur = L.dersler.find(d => d.kod === 'TÜRKÇE-T');
    const alt = tur.satir.filter(r => r.net < tur.genel - 1e-9).length; assert(alt >= 40 && alt <= 70, 'most of the printed schools are below the average: ' + alt);
    put('S', { id: 'k|kolej', ts: 1, dersler: L.dersler.map(d => ({ kod: d.kod, soru: d.soru, genel: d.genel, satir: d.satir })) });
    const dg = get('(()=>{const d=TURKIYE.dagilimAl(S);return {serbestN:d.serbestN,dersler:[...d.dersler]}})()');
    // One N per session (the same schools sit every subject of a session), near the generated 140 (one extra school, BIZ, is in the lists).
    assert(Math.abs(dg.serbestN.TYT - 141) <= 8 && Math.abs(dg.serbestN.AYT - 141) <= 8, JSON.stringify(dg.serbestN));
    for (const [k, g] of dg.dersler) {
      const d = L.dersler.find(x => run('denemeAdAnahtari')(x.kod) === k), sigma = d.soru * 0.12, merkez = d.genel - 0.5 * sigma;
      assert.equal(g.serbest, true, k); assert.equal(g.genel, d.genel, k + ': the Türkiye average is kept'); assert.equal(g.n, dg.serbestN[d.kod.endsWith('-A') ? 'AYT' : 'TYT']);
      assert(Math.abs(g.mu - merkez) < 0.12 * sigma, k + ' centre ' + g.mu + ' ≈ ' + merkez); assert(Math.abs(g.sigma / sigma - 1) < 0.08, k + ' σ ' + g.sigma + ' ≈ ' + sigma);
      assert(g.uyum < 0.2, k + ' fits: ' + g.uyum);
    }
    // On the page: T and the share use the fitted centre; the Türkiye average is carried as turkiye, for the chart’s own line.
    await ekle(kolej(1), kolej(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    const m = model(), p = m.dersler.find(d => d.kod === 'TÜRKÇE-T').seri[0];
    assert.equal(p.dg.serbest, true); assert(Math.abs(p.t - (50 + 10 * (p.tNet - p.dg.mu) / p.dg.sigma)) < 1e-9); assert.equal(p.genel, tur.genel);
    const q = m.toplam.tseri[0], ps = m.dersler.map(d => d.seri[0]);
    assert(q.t !== null, 'the total has a value: ' + q.yok); assert(Math.abs(q.genel - ps.reduce((a, x) => a + x.dg.mu, 0)) < 1e-9, 'the total’s centre is the sum of the centres'); assert(Math.abs(q.turkiye - ps.reduce((a, x) => a + x.genel, 0)) < 1e-9);
    assert.equal(q.serbest, true); assert(q.turkiye > q.genel, 'the Türkiye average stands above the middle school');
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)'); const D = get('TURKIYE.dagilimVerisi(ST)');
    assert(Math.abs(D.satirlar[0].mu - q.genel) < 1e-9 && Math.abs(D.satirlar[0].turkiye - q.turkiye) < 1e-9);
    const g = run('TURKIYE.grafikDagilim(ST,900)'), xs = [...g.svg.matchAll(/<line class="tg-dg-genel" x1="([\d.]+)"/g)].map(x => +x[1]);
    const x = v => 900 >= 560 ? 104 + (v - g.lo) / (g.hi - g.lo) * (900 - 92 - 104) : 0;
    assert(Math.abs(xs[1] - x(D.satirlar[0].turkiye)) < 0.2, 'the line is at the Türkiye average, not at the curve’s peak');
    const h = run('TURKIYE.icerik()'); assert.match(h, /<th scope="col" class="sayi">Okulların ortası μ<\/th><th scope="col" class="sayi">Türkiye ort\. \(Genel Net\)<\/th>/); assert.match(h, /Türkiye ortalaması \(Genel Net\) eğrinin ortası mı\?/);
    // A list that is only the top of many schools (≈10 % printed below the average) keeps the centre at the Türkiye average.
    await ekle(normalListe(1)); const m2 = model(), p2 = m2.dersler.find(d => d.kod === 'TÜRKÇE-T').seri.find(Boolean);
    assert.equal(!!p2.dg.serbest, false); assert.equal(p2.dg.mu, p2.genel);
  });
  await check('Dağılımda yeriniz: each exam’s fitted curve (dotted projection), the printed schools, the Türkiye average and the school; the all-exams row; formulas and raw numbers (hand-worked)', async () => {
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)');
    const D = JSON.parse(run('JSON.stringify(TURKIYE.dagilimVerisi(ST))')), T = JSON.parse(run('JSON.stringify(ST.m.toplam.tseri)'));
    assert.equal(D.ad, 'TYT toplam'); assert.equal(D.satirlar.length, 2);
    D.satirlar.forEach((r, i) => {
      const p = T[i];
      // The curve is the page's own fit for the total: centre μ = the summed Türkiye averages, spread σ; the school's net is its summed net.
      assert.equal(r.mu, p.genel); assert.equal(r.sigma, p.sigma); assert.equal(r.net, p.net); assert.equal(r.n, p.n);
      assert(Math.abs(r.z - (p.net - p.genel) / p.sigma) < 1e-12, 'z = (net − μ) / σ');
      assert(Math.abs(r.dilim - 100 * (1 - run('TURKIYE.normCdf')(r.z))) < 1e-9, 'ilk % = 100·(1 − Φ(z))');
      // The printed schools of a total are those in every subject list of the total, by their summed nets.
      const s = run('ST.m.sinavlar[' + i + ']'), kod = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK-T'], L = kod.map(k => s.dersler.find(d => d.kod === k));
      const ortak = L[0].satir.filter(r0 => L.every(d => d.satir.some(q => q.ad === r0.ad)));
      assert.equal(r.gozlenen.length, ortak.length); assert(r.gozlenen.length > 0 && r.gozlenen.length <= 100);
    });
    // Tüm denemeler: the mean of the school's nets on the mean centre, σ = √(mean σ²).
    const [a, b] = D.satirlar, o = D.ort;
    assert.equal(o.adet, 2); assert(Math.abs(o.net - (a.net + b.net) / 2) < 1e-12); assert(Math.abs(o.mu - (a.mu + b.mu) / 2) < 1e-12);
    assert(Math.abs(o.sigma - Math.sqrt((a.sigma ** 2 + b.sigma ** 2) / 2)) < 1e-12); assert(Math.abs(o.dilim - 100 * (1 - run('TURKIYE.normCdf')((o.net - o.mu) / o.sigma))) < 1e-9);
    // The drawing: the curve dotted, the printed schools as ticks, the Türkiye average, the school's dots joined by one line, ≈ on the projected shares.
    const g = run('TURKIYE.grafikDagilim(ST,900)').svg;
    assert.equal((g.match(/class="tg-dg-egri"/g) || []).length, 3, 'a dotted curve per exam and for the mean');
    assert.equal((g.match(/class="tg-dg-liste"/g) || []).length, a.gozlenen.length + b.gozlenen.length);
    assert.equal((g.match(/class="tg-dg-genel"/g) || []).length, 3); assert.equal((g.match(/<circle class="tg-dg-okul/g) || []).length, 3); assert.equal((g.match(/class="tg-dg-yol"/g) || []).length, 1);
    assert(g.indexOf('class="tg-dg-yol"') < g.indexOf('<circle class="tg-dg-okul'), 'the dots sit on top of the joining line');
    assert.equal((g.match(/class="tg-dg-yuzde"[^>]*>≈ ilk %[\d,]+<\/text>/g) || []).length, 3, 'every share is marked as a projection');
    assert.match(g, /<text class="tg-dg-ad" x="\d+(\.\d)?" y="[\d.]+" text-anchor="end">Ortalama/);
    // Every x coordinate inside the plot.
    for (const m of g.matchAll(/\b(?:cx|x1|x2)="(-?[\d.]+)"/g)) assert(+m[1] >= 0 && +m[1] <= 900, 'inside ' + m[1]);
    // The panel: in the Dilim ve sıra view, after the headline strip; the legend says what is projected; formulas and raw numbers fold out.
    const h = run('TURKIYE.icerik()');
    assert(h.indexOf('id="tgKpi"') < h.indexOf('id="tgDagilim"') && h.indexOf('id="tgDagilim"') < h.indexOf('id="tgTPanel"'));
    assert.match(h, /<h2>Dağılımda yeriniz · TYT toplam<\/h2>/); assert.match(h, /Tahmini okul dağılımı \(ilk 100’den yansıtma\)/); assert.match(h, /Listede basılan okullar/);
    assert.match(h, /<details class="tg-formul"><summary>Nasıl hesaplanır · ham veriler<\/summary>/);
    assert.match(h, /k\. sıradaki okulun neti ≈ μ \+ σ · Φ⁻¹\(1 − \(k − 0,5\) \/ N\)/); assert.match(h, /z = \(okul neti − μ\) \/ σ/); assert.match(h, /100 · \(1 − Φ\(z\)\)/);
    assert.equal((h.match(/<tr( class="tg-dg-ort-satir")?><td>/g) || []).length, 3, 'one raw row per exam and the mean');
    assert.match(h, new RegExp('<td>27-YKS-1201</td><td class="sayi">' + a.mu.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', '\\.') + '</td>'));
    // A subject chosen on the page: the distribution follows it; the subjects’ mean T (no net scale) draws none.
    run("EK.tgDers='TÜRKÇE-T'"); sandbox.ST = run('TURKIYE.durumAl(TURKIYE.oku().veri)');
    const Dd = JSON.parse(run('JSON.stringify(TURKIYE.dagilimVerisi(ST))')); if (sandbox.ST.odak) { assert.equal(Dd.ad, 'Türkçe'); assert.equal(Dd.satirlar[0].gozlenen.length, run('ST.m.sinavlar[0].dersler.find(d=>d.kod==="TÜRKÇE-T").satir.length')); }
    run('EK.tgDers=undefined');
  });
  await check('dilim: the same fit said in words (formula, format, bands), exact place ÷ N on complete lists, and no headline T in the page body', async () => {
    await ekle(normalListe(1), normalListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')'); sl({ MAT: 12.4, FİZ: 2.3 });
    const d = run('(()=>{const m=TURKIYE.model(D.turkiye,{mod:"tpuan",aralik:"tum"});const p=m.toplam.tseri[1];return {t:p.t,dilim:TURKIYE.dilimNokta(p),sira:p.tahmin,n:p.n}})()');
    assert(Math.abs(d.dilim - 100 * (1 - run('TURKIYE.normCdf')((d.t - 50) / 10))) < 1e-9, '100·(1−Φ(z)), z = (T−50)/10');
    assert(Math.abs(d.sira - (1 + (d.n - 1) * d.dilim / 100)) <= .5, 'agrees with the estimated place 1 + (N−1)(1−Φ(z))');
    for (const [x, y] of [[12.4, 'ilk %12'], [9.96, 'ilk %10'], [8.43, 'ilk %8,4'], [0.55, 'ilk %0,6'], [0, 'ilk %0,1']]) assert.equal(run('TURKIYE.dilimYazi(' + x + ')'), y);
    for (const [x, y] of [[2.3, 'Türkiye’nin en üst okulları arasında'], [15.9, 'Ortalamanın belirgin üstünde'], [30.9, 'Ortalamanın üstünde'], [69.09, 'Türkiye ortalaması civarında'], [69.1, 'Ortalamanın altında'], [84.1, 'Ortalamanın belirgin altında']]) assert.equal(run('TURKIYE.dilimBandi(' + x + ')'), y);
    let h = run('TURKIYE.icerik()'); const govde = h.replace(/<details[\s\S]*?<\/details>/g, '').replace(/ (title|aria-label)="[^"]*"/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
    assert(!/(^|[^\p{L}])T([^\p{L}]|$)/u.test(govde) && !govde.includes('ΔT') && !govde.includes('T puanı'), 'no headline T in the page body: ' + (/.{30}(^|[^\p{L}])T([^\p{L}]|$).{20}/u.exec(govde) || [''])[0]);
    // A complete list: the dilim is sıra / N · 100, so it never disagrees with the place beside it.
    await ekle(tamListe(1), tamListe(2)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const k = icinde('const p=m.dersler.find(x=>x.kod==="TÜRKÇE-T").seri[1],q=m.toplam.tseri[1];return {a:[TURKIYE.dilimNokta(p),p.sira,p.dg.n],b:[TURKIYE.dilimNokta(q),q.sira,q.n],r:TURKIYE.okulSatirlari({m,odak:null,mod:"tpuan"}).filter(r=>r.sira!==null).map(r=>[r.dilim,r.sira])}');
    assert.equal(k.a[0], k.a[1] / k.a[2] * 100); assert.equal(k.b[0], k.b[1] / k.b[2] * 100); assert(k.r.length > 50 && k.r.every(([di, si]) => Math.abs(di - si / 81 * 100) < 1e-9 || Math.abs(di - si / k.b[2] * 100) < 1e-9));
    h = run('TURKIYE.icerik()'); assert.match(h, /81 okul içinde \d+\./, 'a complete list has no ≈ before the number of schools');
  });
  console.log(passed + ' Türkiye geneli checks passed');
})();
