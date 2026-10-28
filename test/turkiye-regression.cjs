#!/usr/bin/env node
'use strict';
// Türkiye geneli: reading the "Ders Ortalamaları İlk 100 Kurum (Kolej)" report, the list kind, notebook
// storage (compact, validated, replaced, limits), the model (exam order, grade and list, the followed
// school, places, ties, outside the list), the charts, the page, the viewing teacher and privacy.
// Synthetic data only (test/fixtures/kurum-pdf.cjs).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const { kurumListesi, kurumRaporu, BIZ, UZUN, KURS } = require('./fixtures/kurum-pdf.cjs');
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
  for(const k of ['tgListe','tgDuzey','tgOturum','tgDers','tgSimdi','tgOkul'])EK[k]=undefined;KAYIT=0;kaydet=async()=>{KAYIT++;return true};`);
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
    assert.deepEqual(r.dersler.map(d => d.kod), L.dersler.map(d => d.kod));
    for (const [i, d] of L.dersler.entries()) {
      const p = r.dersler[i];
      assert.equal(p.soru, d.soru); assert.equal(p.genel, d.genel);
      assert.deepEqual(p.satir, d.satir.map(([ad, net], j) => ({ sira: j + 1, ad, net })), d.kod);
    }
    // The long name stays one name; 100 rows run over two pages; short pages read the same.
    assert(r.dersler[0].satir.some(x => x.ad === UZUN));
    assert.deepEqual(coz(kurumRaporu(L, { ilkSatir: 9, sonraki: 14 }).pages).dersler, r.dersler);
    assert.equal(get('TURKIYE.sinifDuzeyi("27-YKS-1202")'), 12); assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT-901")'), 9);
    assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT-1001")'), 10); assert.equal(get('TURKIYE.sinifDuzeyi("27-TYT_SIFIR_POZİTİF")'), null);
    assert.deepEqual(get('TURKIYE.dersBilgi("TARİH.1-A")'), { oturum: 'AYT', ad: 'Tarih-1', sira: 12 });
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
  await check('limits: the notebook cloud backup, a failed save and the list count leave the data as it was', async () => {
    await ekle(liste(1)); const once = run('JSON.stringify(D.turkiye)');
    run('D.buyuk="x".repeat(BULUT_YEDEK_UST_SINIR)');
    await assert.rejects(() => ekle(liste(2)), /bulut yedeği sınırının üstüne/); assert.equal(run('JSON.stringify(D.turkiye)'), once);
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
    assert.deepEqual(m.duzeyler, [12, 11]); assert.equal(m.duzey, 12);
    assert.deepEqual(m.sinavlar.map(s => s.ad), ['27-YKS-1201', '27-YKS-1202']); assert.equal(m.simdi, 1); assert.equal(m.onceki, 0);
    assert.deepEqual(m.oturumlar, ['TYT', 'AYT']); assert.equal(m.oturum, 'TYT');
    assert.equal(m.okul, null); assert.equal(m.okulKaynak, null); assert(m.okullar.includes(BIZ));
    assert.deepEqual(model({ duzey: 11 }).sinavlar.map(s => s.ad), ['27-YKS-1101']);
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
    assert.deepEqual(m.dersler.map(d => d.ad), ['Türkçe', 'Ek Felsefe', 'Matematik', 'Fizik']); assert.equal(m.N, 100);
    for (const [ad, kod] of [['Türkçe', 'TÜRKÇE-T'], ['Matematik', 'MATEMATİK-T'], ['Fizik', 'FİZİK-T']])
      assert.deepEqual(ders(ad).seri.map(p => p.sira), L.map(l => yerimiz(l, kod)), ad);
    const fiz = ders('Fizik').seri[1];
    assert.equal(fiz.sira, null); assert.equal(fiz.net, null); assert.equal(fiz.k, -1); assert.equal(fiz.son.net, L[1].dersler[2].satir[99][1]);
    // Tied nets share a span of places.
    const ek = ders('Ek Felsefe').seri[0], esitler = L[0].dersler[3].satir.map((r, i) => [r[1], i + 1]).filter(r => r[0] === 3).map(r => r[1]);
    assert.deepEqual(ek.esit, [Math.min(...esitler), Math.max(...esitler)]); assert.equal(ek.sira, yerimiz(L[0], 'S.FELSEFE-T'));
    const tr = ders('Türkçe').seri[2], ustu = L[2].dersler[0].satir.filter(r => r[1] > 26 + 1).length;
    assert.equal(tr.birNet, ustu + 1); assert.equal(tr.net, 26); assert.equal(tr.genel, L[2].dersler[0].genel);
    // Outside the list counts as N + 1 in the average place; places moved compare the two exams.
    const yer = (e, kod) => yerimiz(L[e], kod) ?? 101, tyt = ['TÜRKÇE-T', 'S.FELSEFE-T', 'MATEMATİK-T', 'FİZİK-T'];
    const ort = e => tyt.reduce((t, k) => t + yer(e, k), 0) / 4;
    assert.equal(m.ozet[1].ort, ort(1)); assert.equal(m.ozet[1].ilk, 3); assert.equal(m.ozet[2].ilk, 4); assert.equal(m.ozet[2].ort, ort(2));
    assert.equal(m.ozet[2].enIyi.ad, 'Türkçe');
    assert.equal(m.ozet[2].ustu, tyt.filter((k, i) => { const d = L[2].dersler.find(x => x.kod === k); return d.satir.find(r => r[0] === BIZ)[1] > d.genel; }).length);
    assert.equal(run('(()=>{const s=TURKIYE.model(D.turkiye);return [...s.dersler].map(d=>d.seri[2].sira)})()').length, 4);
    put('KOD', 'FİZİK-T'); run('EK.tgDers=KOD');
    assert.equal(run('TURKIYE.durumAl(D.turkiye).odak.ad'), 'Fizik');
  });
  await check('charts: Sıra upside down with the dışı lane, a line per subject and the bold average; Net with the band and the Türkiye average', async () => {
    await ekle(liste(1), liste(2), liste(3)); await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    const g = run('TURKIYE.grafikSira(TURKIYE.durumAl(D.turkiye),900)'), J = x => JSON.parse(JSON.stringify(x));
    for (let k = 0; k < 4; k++) assert(g.svg.includes('data-seri="' + k + '"'), 'line ' + k);
    assert.match(g.svg, /class="tg-ort"/); assert.match(g.svg, />İlk 100 dışı<\/text>/); assert.match(g.svg, /class="tg-disi-nokta" data-seri="3"/);
    assert.match(g.svg, /class="et-cizgi ince kesik" data-seri="3"/, 'to and from the lane is dashed');
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
    assert.deepEqual(get('TURKIYE.kisaAdlar([{ad:"27-TYT_SIFIR_POZİTİF"},{ad:"27-YKS-1201"}])'), ['TYT_SIFIR_POZİTİF', 'YKS-1201']);
  });
  await check('page: empty state, school prompt, sentence, cards, the Türkiye comparison, the subject view and the exam table', async () => {
    let h = run('TURKIYE.icerik()');
    assert.match(h, /Henüz liste yok/); assert.match(h, /Ders Ortalamaları İlk 100 Kurum \(Kolej\)/); assert.match(h, /id="tgPdf"/);
    await ekle(liste(1), liste(2));
    h = run('TURKIYE.icerik()');
    assert.match(h, /Okulunuzu seçin/); assert.match(h, /<option value="">Okulunuzu seçin<\/option>/); assert(!h.includes('data-tg-grafik'));
    assert.match(h, /id="tgKaynak"/);
    await run('TURKIYE.okulKaydet(' + JSON.stringify(BIZ) + ')');
    h = run('TURKIYE.icerik()');
    const m = model(), o = m.ozet[1], p = m.ozet[0];
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.equal(cumle, '27-YKS-1202 (14 Eki) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT: ilk 100’de 3 / 4 ders, ortalama sıra ' +
      o.ort.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' (önceki denemeye göre ' + (p.ort > o.ort ? '▲' : '▼') +
      Math.abs(p.ort - o.ort).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '). En iyi ders: Türkçe, ' + m.dersler[0].seri[1].sira + '. sıra. Türkiye ortalamasının üstünde ' + o.ustu + ' ders.');
    assert.match(h, /<option value="SENTETİK KARTAL ANADOLU LİSESİ" selected>Sentetik Kartal Anadolu Lisesi<\/option>/);
    assert.match(h, /data-tg-grafik="sira"/); assert.equal((h.match(/class="et-ders"/g) || []).length, 4);
    assert.match(h, /Türkiye ortalamasına göre · 27-YKS-1202/); assert.match(h, /ilk 100 dışı<\/b>/);
    assert.match(h, /Dersler · 27-YKS-1202/); assert.match(h, /data-tg-oturum="AYT" aria-pressed="false">/);
    assert.match(h, /id="tgSimdi"/); assert.match(h, /data-tg-sil="27-YKS-1201\|kolej"/); assert.match(h, /7 Eki 2026 <span class="mini tg-dar-gizle">rapor<\/span>/);
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
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='denemeler')[1]"), ['siralamalar', 'turkiye']);
    assert.equal(get("SEKME_REHBER.find(s=>s[0]==='turkiye')[1]"), 'Türkiye geneli');
    run('cizIc()'); assert.match(nodes.ana.innerHTML, /<div id="tgKok">/);
    run('yalnizcaGoruntuleme=()=>true');
    let h = run('TURKIYE.icerik()');
    assert(!h.includes('id="tgPdf"') && !h.includes('id="tgSilHepsi"') && !h.includes('data-tg-sil')); assert(h.includes('data-tg-grafik="sira"'));
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
  console.log(passed + ' Türkiye geneli checks passed');
})();
