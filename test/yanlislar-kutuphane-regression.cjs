// Yanlışlar defteri, Deneme kütüphanesi: the device-only library (IndexedDB adapter contract, here an in-memory adapter that outlives a "page"),
// bulk grouping of mixed files by exam code, refusals shown in the exam row, the multi-exam defter, the PDF plan and the logout wipe.
// Synthetic data only (test/yanlislar-fixtures.cjs). No npm package: the module's own adapter stands in for IndexedDB; the real one runs in the browser test.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const F = require('./konutakibi-fixtures.cjs'), Y = require('./yanlislar-fixtures.cjs');
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const T = run('YANLISLAR'), K = run('DENEME_KUTUPHANE'), S = T.durumu();
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const bytes = b => new Uint8Array(b);
const copy = x => JSON.parse(JSON.stringify(x));

/* ---- three synthetic exams (test/yanlislar-fixtures.cjs): 1203 (default keys), 1204 and 1205; each has its own A <-> B permutation and shifted letters, so a çözüm file fits only its own exam ---- */
const L5 = 'ABCDE', SINAV = Y.DENEMELER;
const kitPdf = kod => new Blob([Y.pdfYaz(Y.kitapcikSpec(kod))]), cozPdf = kod => new Blob([Y.pdfYaz(Y.cozumSpec(SINAV[kod].pairs, 5, kod))]);
async function ogeler(kod) {
  const s = SINAV[kod], xlsx = Y.raporXlsx({sinav: s.ad, tarih: s.tarih, anahtarA: s.keyA, anahtarB: s.keyB, ogrenciler: s.ogr, method: 8});
  return {
    rapor: {tur: 'rapor', ad: 'rapor-' + kod + '.xlsx', rapor: await T.raporCoz(bytes(xlsx))},
    kit: {tur: 'kit', ad: 'kitapcik-' + kod + '.pdf', kit: T.kitapcikCoz(Y.itemlere(Y.kitapcikSpec(kod))), blob: kitPdf(kod)},
    coz: {tur: 'coz', ad: 'cozum-' + kod + '.pdf', pairs: T.cozumEtiketleri(Y.itemlere(Y.cozumSpec(SINAV[kod].pairs, 5, kod))), kodIpucu: '', blob: cozPdf(kod)},
    ort: {tur: 'ort', ad: 'ort-' + kod + '.pdf', ort: T.ortalamaCoz(Y.itemlere(Y.ortalamaSpec({kod: '27-YKS-' + kod, dersler: [['TÜRKÇE-T', 4, 2.5], ['TARİH-T', 2, 1.25]]})))}
  };
}
const dosya = o => ({name: o.ad, size: 1, o});
const okuyucu = async f => { if (f.o instanceof Error) throw f.o; return f.o };
const sayfaHazirla = () => run("D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar'");
const yeniDisk = () => ({meta: new Map(), dosya: new Map()});
const kutu = (uid, disk, opt) => T.kutuphaneKur(uid, K.bellekAdaptor(disk, opt));
const ogeCache = {};
const al = async kod => ogeCache[kod] || (ogeCache[kod] = await ogeler(kod));
// a fresh set of parsed items (the parsers return objects that the page keeps and changes, so every use gets its own)
const taze = async kod => { const o = await ogeler(kod); return o };
const hepsi = async kodlar => { const out = []; for (const k of kodlar) { const o = await taze(k); out.push(o.rapor, o.kit, o.coz) } return out };

(async () => {
  await test('cevap raporu: the report date is read (not personal), the exam code comes from the exam name', async () => {
    const o = await taze('1204');
    assert.equal(o.rapor.rapor.tarih, '2026-10-10'); assert.equal(o.rapor.rapor.sinavNo, '1204'); assert.equal(o.kit.kit.sinav, '1204');
    assert.equal(T.pdfTuru(Y.itemlere(Y.kitapcikSpec('1204'))), 'kit'); assert.equal(T.pdfTuru(Y.itemlere(Y.cozumSpec(Y.HARITA, 5, '1204'))), 'coz');
    assert.equal(T.pdfTuru(Y.itemlere(Y.ortalamaSpec({}))), 'ort'); assert.equal(T.pdfTuru([{w: 600, h: 800, items: [{s: 'Sentetik', x: 1, y: 1}]}]), null);
  });

  await test('bulk: mixed files of three exams in any order are grouped by exam code; a çözüm before its booklet and report in the same batch succeeds', async () => {
    S.kut?.kapat?.(); T.sifirla(); sayfaHazirla(); await kutu('u1', yeniDisk());
    const a = await taze('1203'), b = await taze('1204'), c = await taze('1205');
    // the worst order: çözüm and ortalamalar first, booklets before reports of other exams, reports last
    const sira = [a.coz, c.coz, a.ort, b.kit, c.kit, b.coz, a.kit, c.rapor, a.rapor, b.rapor];
    await T.dosyalarEkle(sira.map(dosya), okuyucu);
    assert.deepEqual([...S.denemeler.keys()].sort(), ['1203', '1204', '1205']);
    assert.equal(S.genel.length, 0);
    for (const [kod, e] of S.denemeler) {
      assert.deepEqual(copy(e.hatalar), [], kod); assert(e.rapor && e.es && e.kitlar.TYT, kod + ' report and booklet');
      assert.equal(e.harita?.adet, 10, kod + ' çözüm map'); assert.equal(e.kalici, true);
    }
    assert.equal(S.denemeler.get('1203').ort.dersler.length, 2); assert.equal(S.denemeler.get('1204').ort, null);
    assert.equal(S.denemeler.get('1203').ad, 'SENTETİK-1203'); assert.equal(S.denemeler.get('1203').tarih, '2026-10-03');
  });

  await test('bulk: a çözüm that is alone in its batch, with no booklet and report yet, is refused in Turkish; the same file succeeds once they are there', async () => {
    T.sifirla(); await kutu('u1', yeniDisk());
    const a = await taze('1203');
    await T.dosyalarEkle([dosya(a.coz)], okuyucu);
    assert.equal(S.denemeler.size, 0); assert.match(S.genel[0].mesaj, /Önce soru kitapçığını ve cevap raporunu yükleyin/); assert.equal(S.genel[0].dosya, 'cozum-1203.pdf');
    await T.dosyalarEkle([dosya((await taze('1203')).kit), dosya((await taze('1203')).rapor)], okuyucu);
    await T.dosyalarEkle([dosya((await taze('1203')).coz)], okuyucu);
    assert.equal(S.denemeler.get('1203').harita.adet, 10); assert.equal(S.genel.length, 0);
  });

  await test('bulk: with equal question counts the çözüm goes to the exam whose answer keys it fits; one that fits none is refused with a message', async () => {
    T.sifirla(); await kutu('u1', yeniDisk());
    const a = await taze('1203'), b = await taze('1204');
    await T.dosyalarEkle([a.kit, a.rapor, b.kit, b.rapor].map(dosya), okuyucu);
    await T.dosyalarEkle([dosya((await taze('1204')).coz)], okuyucu);
    assert.equal(S.denemeler.get('1204').harita?.adet, 10); assert.equal(S.denemeler.get('1203').harita, null, '1203 keeps no map: the file was not its own');
    await T.dosyalarEkle([dosya((await taze('1203')).coz)], okuyucu);
    assert.equal(S.denemeler.get('1203').harita?.adet, 10); assert.equal(S.denemeler.get('1204').harita?.adet, 10);
    assert.equal(S.genel.length, 0);
    // a permutation that contradicts the answer keys of every exam is refused and named in no row
    const bad = (await taze('1203')).coz; bad.pairs = bad.pairs.map(([x, y], i) => i === 0 ? [1, 2] : i === 1 ? [2, 1] : [x, y]); bad.pairs[0] = [1, 2]; bad.pairs[1] = [2, 3]; bad.pairs[2] = [3, 1]; bad.pairs[3] = [4, 4];
    await T.dosyalarEkle([dosya(bad)], okuyucu);
    assert.equal(S.genel.length, 1); assert.match(S.genel[0].mesaj, /\.$/); assert.equal(S.genel[0].dosya, 'cozum-1203.pdf');
    assert.equal(S.denemeler.get('1203').harita.adet, 10, 'the old map stays');
    // the exam number in the file title settles a tie (two exams with identical keys and map)
    T.sifirla(); await kutu('u1', yeniDisk());
    const x = await taze('1203'), y = await taze('1203'); y.rapor.rapor.ad = 'SENTETİK-1299'; y.rapor.rapor.sinavNo = '1299'; y.kit.kit.sinav = '1299';
    await T.dosyalarEkle([x.kit, x.rapor, y.kit, y.rapor].map(dosya), okuyucu);
    assert.deepEqual([...S.denemeler.keys()].sort(), ['1203', '1299']);
    const iki = (await taze('1203')).coz; await T.dosyalarEkle([dosya(iki)], okuyucu);
    assert.equal(S.genel.length, 1); assert.match(S.genel[0].mesaj, /birden fazla denemeye uyuyor/);
    const uc = (await taze('1203')).coz; uc.kodIpucu = '1299'; await T.dosyalarEkle([dosya(uc)], okuyucu);
    assert.equal(S.denemeler.get('1299').harita?.adet, 10); assert.equal(S.denemeler.get('1203').harita, null); assert.equal(S.genel.length, 0);
  });

  await test('a refused file puts its Turkish error in its own exam row; an unrecognised file is listed on its own; replacing a file re-validates it', async () => {
    T.sifirla(); sayfaHazirla(); await kutu('u1', yeniDisk());
    const a = await taze('1203'), b = await taze('1204');
    await T.dosyalarEkle([a.rapor, a.kit, b.rapor, b.kit, dosya(new Error('Bu PDF tanınmadı: soru kitapçığı, çözüm kitapçığı veya ders ortalamaları dosyasına benzemiyor.'))].map(x => x.tur ? dosya(x) : x), okuyucu);
    assert.equal(S.genel.length, 1); assert.match(S.genel[0].mesaj, /tanınmadı/);
    // ders ortalamaları with counts that differ from the report: refused, with the file name, in the 1203 row
    const kotu = (await taze('1203')).ort; kotu.ort = T.ortalamaCoz(Y.itemlere(Y.ortalamaSpec({kod: '27-YKS-1203', dersler: [['TÜRKÇE-T', 6, 2.5], ['TARİH-T', 2, 1.25]]})));
    await T.dosyalarEkle([dosya(kotu)], okuyucu);
    const e = S.denemeler.get('1203'); assert.equal(e.ort, null); assert.equal(e.hatalar.length, 1); assert.match(e.hatalar[0].mesaj, /Soru sayıları uyuşmuyor/); assert.equal(S.denemeler.get('1204').hatalar.length, 0);
    const out = T.gorunum(), satir = out.slice(out.indexOf('data-yd-satir="1203"'), out.indexOf('data-yd-satir="1204"'));
    assert.match(satir, /class="yd-hata" role="alert">ort-1203\.pdf: Soru sayıları uyuşmuyor/); assert.doesNotMatch(out.slice(out.indexOf('data-yd-satir="1204"'), out.indexOf('</tbody>')), /yd-hata/);
    // a report of exam 1204 whose sections do not fit its booklet is refused in the 1204 row and the old report stays
    const eski = S.denemeler.get('1204').rapor, k2 = await taze('1204'); k2.rapor.rapor.bolumler[0].n = 5;
    await T.dosyalarEkle([dosya(k2.rapor)], okuyucu);
    assert.equal(S.denemeler.get('1204').rapor, eski); assert.match(S.denemeler.get('1204').hatalar[0].mesaj, /eşleşmiyor.*Cevap raporu eklenmedi/);
    // a new report whose keys no longer fit the çözüm map drops the map, with the reason in the row; the row shows ✗ for it
    await T.dosyalarEkle([dosya((await taze('1203')).coz)], okuyucu);
    assert.equal(S.denemeler.get('1203').harita.adet, 10);
    const anahtar4 = SINAV['1204'], yeniRapor = {tur: 'rapor', ad: 'rapor-1203-yeni.xlsx', rapor: await T.raporCoz(bytes(Y.raporXlsx({sinav: 'SENTETİK-1203', anahtarA: anahtar4.keyA, anahtarB: anahtar4.keyB, ogrenciler: SINAV['1203'].ogr, method: 8})))};
    await T.dosyalarEkle([dosya(yeniRapor)], okuyucu);
    const e3 = S.denemeler.get('1203');
    assert.equal(e3.harita, null); assert(e3.hatalar.some(h => /cevap anahtarlarıyla uyuşmuyor/.test(h.mesaj)), 'reason in the row'); assert(e3.silinecek.size === 0, 'the dropped file was already removed from the library');
    assert.equal(S.kut.mod(), 'kalici');
    assert.equal(await S.kut.dosya('1203', 'coz-TYT'), null, 'its çözüm bytes are gone from the device too');
  });

  await test('the exam table: one row per exam, name, code, date, ✓ or ✗ per input, a checkbox (selected), Sil; labels are plain Turkish', async () => {
    T.sifirla(); sayfaHazirla(); await kutu('u1', yeniDisk());
    const a = await taze('1203'), b = await taze('1204');
    await T.dosyalarEkle([a.rapor, a.kit, a.coz, a.ort, b.rapor].map(dosya), okuyucu);
    const out = T.gorunum(), tablo = out.slice(out.indexOf('<table class="et-tablo yd-tablo"'), out.indexOf('</table>'));
    assert.deepEqual([...tablo.matchAll(/<th scope="col"[^>]*>([^<]*)</g)].map(m => m[1]).filter(Boolean), ['Deneme', 'TYT kitapçık', 'AYT kitapçık', 'Cevap raporu', 'Çözüm', 'Ders ort.']);
    const satir = kod => { const i = tablo.indexOf('data-yd-satir="' + kod + '"'); return tablo.slice(i, tablo.indexOf('</tr>', i)) };
    const isaret = s => [...s.matchAll(/role="img" aria-label="([^"]*)">([^<]*)</g)].map(m => m[2]);
    assert.deepEqual(isaret(satir('1203')), ['✓', '–', '✓', '✓', '✓'], 'TYT booklet, no AYT sheet, report, çözüm, ortalamalar');
    assert.deepEqual(isaret(satir('1204')), ['✗', '–', '✓', '✗', '✗'], 'report only');
    assert.match(satir('1203'), /<b>SENTETİK-1203<\/b>[^]*03\.10\.2026/); assert.match(satir('1203'), /data-yd-sec="1203" checked/); assert.match(satir('1204'), /data-yd-sec="1204" checked/);
    assert.match(satir('1203'), /data-yd-sil="1203"[^>]*>Sil</);
    // an exam without a booklet cannot be printed: only 1203 gives students
    assert.equal(T.birlesik().length, 3); S.denemeler.get('1203').sec = false; assert.equal(T.birlesik().length, 0); S.denemeler.get('1203').sec = true;
  });

  await test('library: files and models survive a simulated page reload, bytes come back unchanged', async () => {
    const disk = yeniDisk();
    T.sifirla(); await kutu('u1', disk);
    await T.dosyalarEkle((await hepsi(['1203', '1204'])).map(dosya), okuyucu);
    const orijinal = Buffer.from(await kitPdf('1203').arrayBuffer());
    // the page is gone; a new one opens the same disk
    T.sifirla(); assert.equal(S.denemeler.size, 0);
    await kutu('u1', disk);
    assert.deepEqual([...S.denemeler.keys()].sort(), ['1203', '1204']);
    const e = S.denemeler.get('1203');
    assert(e.rapor && e.es && e.harita && e.kitlar.TYT, 'ready without uploading again'); assert.equal(e.harita.adet, 10); assert.equal(e.ad, 'SENTETİK-1203'); assert.equal(e.kalici, true);
    assert.equal(T.birlesik().length, 4);
    const geri = Buffer.from(await S.kut.dosya('1203', 'kit-TYT')); assert(geri.equals(orijinal), 'booklet bytes are the same'); assert.equal(geri.slice(0, 4).toString('latin1'), '%PDF');
    assert.equal(await S.kut.dosya('1203', 'kit-AYT'), null);
    // the reloaded booklet geometry gives the same question regions (rounded to 0.01)
    const k0 = (await taze('1203')).kit.kit.testler, k1 = e.kitlar.TYT.testler;
    assert.equal(k1[1].sorular[4].parcalar.length, k0[1].sorular[4].parcalar.length); assert(Math.abs(k1[0].sorular[0].parcalar[0].y1 - k0[0].sorular[0].parcalar[0].y1) < 0.006);
    // the screen of the reloaded page lists both exams
    sayfaHazirla(); const out = T.gorunum(); assert.match(out, /data-yd-satir="1203"/); assert.match(out, /data-yd-satir="1204"/);
  });

  await test('library: another account on the same browser never sees it; each account has its own', async () => {
    const disk = yeniDisk();
    T.sifirla(); await kutu('ogretmen-a', disk);
    await T.dosyalarEkle((await hepsi(['1203'])).map(dosya), okuyucu);
    T.sifirla(); await kutu('ogretmen-b', disk);
    assert.equal(S.denemeler.size, 0, 'account B sees nothing'); assert.equal(await S.kut.dosya('1203', 'kit-TYT'), null);
    await T.dosyalarEkle((await hepsi(['1204'])).map(dosya), okuyucu);
    assert.deepEqual([...S.denemeler.keys()], ['1204']);
    // B removing everything leaves A's exams alone
    await T.hepsiniSil(); assert.equal(disk.meta.size, 1);
    T.sifirla(); await kutu('ogretmen-a', disk); assert.deepEqual([...S.denemeler.keys()], ['1203']);
    // the key of one uid is not a prefix of another's
    T.sifirla(); await kutu('ogretmen', disk); assert.equal(S.denemeler.size, 0);
  });

  await test('Sil removes one exam (meta and files), Tümünü bu cihazdan sil all of the account; the status line counts', async () => {
    const disk = yeniDisk();
    T.sifirla(); sayfaHazirla(); await kutu('u1', disk);
    await T.dosyalarEkle((await hepsi(['1203', '1204', '1205'])).map(dosya), okuyucu);
    assert.equal(disk.meta.size, 3); assert.equal(disk.dosya.size, 6);
    sandbox.navigator.storage = {estimate: async () => ({usage: 84 * 1048576, quota: 1e12}), persist: async () => true};
    await T.dosyalarEkle([], okuyucu); await S.kut.boyut([]);
    S.boyut = await S.kut.boyut([...S.denemeler.values()]);
    let out = T.gorunum(); assert.match(out, /Bu cihazda saklanır, sunucuya gönderilmez · 3 deneme · 84 MB/); assert.match(out, /Tümünü bu cihazdan sil/);
    await T.denemeSil('1204');
    assert.deepEqual([...disk.meta.keys()].map(decodeURIComponent).sort(), ['u1|1203', 'u1|1205']); assert.equal(disk.dosya.size, 4);
    assert(![...disk.dosya.keys()].some(k => k.includes('1204')), 'no file of the deleted exam is left');
    assert.match(T.gorunum(), /· 2 deneme/);
    await T.hepsiniSil(); assert.equal(disk.meta.size, 0); assert.equal(disk.dosya.size, 0); assert.equal(S.denemeler.size, 0); assert.match(T.gorunum(), /· 0 deneme/);
    // no estimate: the size is the sum of the bytes
    delete sandbox.navigator.storage;
    await T.dosyalarEkle((await hepsi(['1203'])).map(dosya), okuyucu); S.boyut = await S.kut.boyut([...S.denemeler.values()]);
    assert.match(T.gorunum(), /Bu cihazda saklanır, sunucuya gönderilmez · 1 deneme · \d+ KB/);
  });

  await test('navigator.storage.persist() is asked once, with the first save, and a failing persist never matters', async () => {
    let n = 0; sandbox.navigator.storage = {persist() { n++; return Promise.reject(new Error('no')) }};
    T.sifirla(); await kutu('u9', yeniDisk());
    await T.dosyalarEkle((await hepsi(['1203'])).map(dosya), okuyucu); await T.dosyalarEkle((await hepsi(['1204'])).map(dosya), okuyucu);
    assert(n <= 1, 'asked at most once per page: ' + n); delete sandbox.navigator.storage;
    sandbox.navigator.storage = {persist() { throw new Error('boom') }}; T.sifirla(); await kutu('u9', yeniDisk());
    await T.dosyalarEkle((await hepsi(['1205'])).map(dosya), okuyucu); assert.equal(S.denemeler.get('1205').kalici, true); delete sandbox.navigator.storage;
  });

  await test('nothing stored holds an 11 digit number, a TC, the raw .xlsx, or anything but PDFs and models', async () => {
    const disk = yeniDisk();
    T.sifirla(); await kutu('u1', disk);
    // the xlsx has a TC column; the files given to the library are the parsed items only
    await T.dosyalarEkle((await hepsi(['1203', '1204', '1205'])).concat([(await taze('1203')).ort]).map(dosya), okuyucu);
    for (const [k, m] of disk.meta) { const t = JSON.stringify(m); assert.doesNotMatch(t, /\d{11}/, 'meta ' + k); for (const tc of Y.SENTETIK_TC) assert(!t.includes(tc)); assert(!/PK\u0003\u0004/.test(t)); assert.doesNotMatch(t, /xlsx|sharedStrings/i) }
    for (const [k, v] of disk.dosya) {
      assert.match(decodeURIComponent(k), /^u1\|\d{4}\|(kit|coz)-(TYT|AYT)$/, 'only booklet and çözüm slots'); const b = Buffer.from(v);
      assert.equal(b.slice(0, 4).toString('latin1'), '%PDF', k); assert.notEqual(b.slice(0, 2).toString('latin1'), 'PK');
      assert(!b.includes(Buffer.from('12345678901')) && !/\d{11}/.test(b.toString('latin1')), 'no 11 digit number in ' + k);
    }
    // the module itself refuses what it must not keep
    const lib = K.olustur({uid: 'x', adaptor: K.bellekAdaptor(yeniDisk())}); await lib.yukle();
    assert.equal((await lib.kaydet('1', {kod: '1', rapor: {ogrenciler: [{no: '12345678901'}]}})).hata, 'tc');
    assert.equal((await lib.kaydet('1', {kod: '1'}, {'kit-TYT': new Blob([Buffer.from('PK\u0003\u0004 a zip')])})).hata, 'pdf');
    assert.equal((await lib.kaydet('1', {kod: '1'}, {'rapor': new Blob([Buffer.from('%PDF-1.4')])})).hata, 'slot');
    assert.equal((await lib.kaydet('1', {kod: '1'}, {'kit-TYT': new Blob([Buffer.from('%PDF-1.4')])})).kalici, true);
    // the page's own stored model of every exam
    for (const e of S.denemeler.values()) assert.doesNotMatch(JSON.stringify(T.metaOf(e)), /\d{11}/);
  });

  await test('no IndexedDB: everything stays in memory, one clear line says so, bulk upload and the exam table still work, a reload forgets', async () => {
    const disk = yeniDisk();
    T.sifirla(); sayfaHazirla(); await kutu('u1', disk, {acHata: true});
    assert.equal(S.kut.mod(), 'gecici');
    await T.dosyalarEkle((await hepsi(['1203', '1204'])).map(dosya), okuyucu);
    assert.equal(S.denemeler.size, 2); assert.equal(disk.meta.size, 0, 'nothing was written');
    let out = T.gorunum();
    assert.equal((out.match(/Bu tarayıcı dosyaları saklamaya izin vermiyor; sayfa kapanınca yeniden yüklemeniz gerekir\./g) || []).length, 1, 'one line');
    assert.match(out, /Bu oturumda tutulur, sunucuya gönderilmez · 2 deneme/); assert.doesNotMatch(out, /Bu cihazda saklanır/);
    assert.equal(T.birlesik().length, 4, 'the defter works');
    assert.notEqual(await S.kut.dosya('1203', 'kit-TYT'), null, 'the bytes are held for cropping this session');
    assert.doesNotMatch(out, /Yalnız bu oturumda/, 'no per-row badge: the single line says it');
    T.sifirla(); await kutu('u1', disk, {acHata: true}); assert.equal(S.denemeler.size, 0);
    // no signed-in account: kept in memory, with its own line
    T.sifirla(); await T.kutuphaneKur(null, K.bellekAdaptor(yeniDisk())); await T.dosyalarEkle((await hepsi(['1203'])).map(dosya), okuyucu);
    assert.equal(S.denemeler.size, 1); assert.match(T.gorunum(), /Hesap bilgisi alınamadığı için dosyalar saklanmıyor/);
  });

  await test('quota exceeded while saving: the exam stays in memory and the page says so and suggests deleting old exams; earlier exams stay stored', async () => {
    const olc = yeniDisk(); T.sifirla(); await kutu('u1', olc); const a0 = await taze('1203'); await T.dosyalarEkle([a0.rapor, a0.kit].map(dosya), okuyucu);
    let tot = 0; for (const m of Object.values(olc)) for (const v of m.values()) tot += v.byteLength ?? JSON.stringify(v).length;
    const disk = yeniDisk();
    T.sifirla(); sayfaHazirla(); await kutu('u1', disk, {kotaBayt: Math.round(tot * 1.25)});
    const a = await taze('1203');
    await T.dosyalarEkle([a.rapor, a.kit].map(dosya), okuyucu);
    assert.equal(S.denemeler.get('1203').kalici, true, 'the first one fits');
    const b = await taze('1204');
    await T.dosyalarEkle([b.rapor, b.kit, b.coz].map(dosya), okuyucu);
    const e = S.denemeler.get('1204');
    assert.equal(e.kalici, false); assert.equal(e.kota, true); assert(e.rapor && e.es && e.harita, 'still usable this session');
    assert.equal(disk.meta.size, 1, 'the failed write left nothing behind'); assert.equal(S.kut.mod(), 'kalici');
    const out = T.gorunum();
    assert.match(out, /SENTETİK-1204 cihaza sığmadı; bu oturumda bellekte tutuluyor\. Yer açmak için eski denemeleri silin\./); assert.match(out, /Yalnız bu oturumda/);
    assert.doesNotMatch(out, /saklamaya izin vermiyor/);
    assert.equal(T.birlesik().length, 4); assert.notEqual(await S.kut.dosya('1204', 'kit-TYT'), null);
    // deleting the old exam makes room: the next save fits
    await T.denemeSil('1203'); await T.dosyalarEkle([(await taze('1204')).kit].map(dosya), okuyucu);
    assert.equal(S.denemeler.get('1204').kalici, true);
  });

  await test('logout wipe: the whole database goes (every account), the open libraries and the page are emptied; the code is wired into the logout reset', async () => {
    const disk = yeniDisk();
    T.sifirla(); await kutu('u1', disk); await T.dosyalarEkle((await hepsi(['1203'])).map(dosya), okuyucu);
    T.sifirla(); await kutu('u2', disk); await T.dosyalarEkle((await hepsi(['1204'])).map(dosya), okuyucu);
    assert.equal(disk.meta.size, 2);
    const silinen = []; let ad = null;
    const sahteIdb = {deleteDatabase(n) { ad = n; const r = {}; setTimeout(() => { disk.meta.clear(); disk.dosya.clear(); silinen.push(n); r.onsuccess() }, 0); return r }};
    await K.hepsiniTemizle(sahteIdb);
    assert.equal(ad, K.DB); assert.equal(disk.meta.size, 0); assert.equal(disk.dosya.size, 0);
    assert.equal(S.kut.mod(), 'gecici', 'a library that was open can no longer write to the deleted database');
    T.bellekiBosalt(); assert.equal(S.denemeler.size, 0); assert.equal(S.kut, null);
    // without IndexedDB the cleanup is a no-op that succeeds
    await K.hepsiniTemizle(null);
    const fn = source.slice(source.indexOf('async function cikisYerelVerisiniTemizle()'), source.indexOf('function kaydedipCikisYap()'));
    // In memory mode (no usable IndexedDB) the device is left alone, as the notebook does; only the page's copies are emptied.
    const call = "DENEME_KUTUPHANE.hepsiniTemizle(LOCAL_STORE.mode()==='memory'?null:undefined)";
    assert(fn.indexOf(call) > 0 && fn.indexOf('YANLISLAR.bellekiBosalt()') > 0, 'wired into the logout / browser reset cleanup');
    assert(fn.indexOf(call) < fn.indexOf('LOCAL_STORE.clear()'), 'before the notebook, which is removed last');
    assert.equal(run('typeof cikisYerelVerisiniTemizle'), 'function');
  });

  await test('the database wipe through the module\'s IndexedDB adapter: closes its connection first and waits for the delete', async () => {
    const olaylar = [];
    const sahte = {
      open() { const r = {}; setTimeout(() => { const db = {objectStoreNames: {contains() { return false }}, createObjectStore() {}, close() { olaylar.push('close') }}; r.result = db; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess() }, 0); return r },
      deleteDatabase(n) { olaylar.push('delete ' + n); const r = {}; setTimeout(() => r.onsuccess(), 0); return r }
    };
    const ad = K.idbAdaptor(sahte); await ad.ac(); await ad.veritabaniniSil();
    assert.deepEqual(olaylar, ['close', 'delete ' + K.DB]);
    const hata = {deleteDatabase() { const r = {}; setTimeout(() => r.onerror(), 0); r.error = new Error('x'); return r }};
    await assert.rejects(K.hepsiniTemizle(hata), /x/);
  });

  /* ---- the multi-exam defter ---- */
  async function uc() {
    T.sifirla(); sayfaHazirla(); await kutu('u1', yeniDisk());
    await T.dosyalarEkle((await hepsi(['1203', '1204', '1205'])).map(dosya), okuyucu);
    for (const e of S.denemeler.values()) for (const [ti, t] of e.kitlar.TYT.testler.entries()) t.sorular.forEach(q => e.crops.set(ti + ':' + q.no, {url: 'blob:s-' + e.kod + '-' + ti + '-' + q.no, blob: null, w: 540, h: 160 + 40 * (q.no % 3), genis: false}));
    Object.assign(S, {onizleme: 1e9, sube: '', ogr: '', status: 'all', bantlar: null, kendi: false, kapali: new Set()});
  }
  const nos = l => [...l].map(m => m.ogr.no);
  const makale = (out, no) => { const i = out.indexOf('data-yd-ogr="' + no + '"'); if (i < 0) return null; const j = out.indexOf('<article', i); return out.slice(out.lastIndexOf('<article', i), j < 0 ? undefined : j) };
  await test('multi-exam defter: one article per student over the selected exams, in exam order; a student of 2 of 3 exams gets those; totals add up', async () => {
    await uc();
    const out = T.gorunum(), liste = T.birlesik();
    assert.deepEqual(nos(liste), ['9001', '9002', '9003', '9004'], 'students matched across exams by Öğrenci No, sorted by şube and name');
    const a1 = makale(out, '9001'), a2 = makale(out, '9002');
    // 9001 sat all three
    assert.match(a1, /<b>3<\/b> deneme · <b>\d+<\/b> yanlış · <b>\d+<\/b> boş/); assert.match(a1, /Denemeler: SENTETİK-1203 · SENTETİK-1204 · SENTETİK-1205/);
    assert.match(a1, /Öğrenci No <b>9001<\/b> · 205 12\/A<\/p>/, 'no exam name in the identity line when several are selected');
    const basliklar = [...a1.matchAll(/<h2 class="yd-deneme-baslik">([^<]*)</g)].map(m => m[1]); assert.deepEqual(basliklar, ['SENTETİK-1203', 'SENTETİK-1204', 'SENTETİK-1205']);
    const anahtar = a1.slice(a1.indexOf('class="yd-anahtar"')), kb = [...anahtar.matchAll(/<h3 class="yd-deneme-baslik">([^<]*)</g)].map(m => m[1]);
    assert.deepEqual(kb, ['SENTETİK-1203', 'SENTETİK-1204', 'SENTETİK-1205'], 'the key is grouped by exam, each exam its own key');
    assert(a1.indexOf('yd-deneme-baslik">SENTETİK-1203') < a1.indexOf('<img') && a1.indexOf('<img') < a1.indexOf('class="yd-anahtar"'));
    // the totals are the sum of the exams' own counts
    const ex = n => S.denemeler.get(n), say = (kod, no) => { const e = ex(kod), o = e.rapor.ogrenciler.find(x => x.no === no); return o ? T.defterKur(e.rapor, e.es, e.harita, o, T.acikBolumler(e.es, o, {})) : {yanlis: 0, bos: 0} };
    const y = ['1203', '1204', '1205'].reduce((s, k) => s + say(k, '9001').yanlis, 0), b = ['1203', '1204', '1205'].reduce((s, k) => s + say(k, '9001').bos, 0);
    assert.match(a1, new RegExp('<b>3</b> deneme · <b>' + y + '</b> yanlış · <b>' + b + '</b> boş'));
    // 9002 sat 1203 and 1205 but not 1204: two sections, two keys
    assert.match(a2, /<b>2<\/b> deneme · /); assert.deepEqual([...a2.matchAll(/<h2 class="yd-deneme-baslik">([^<]*)</g)].map(m => m[1]), ['SENTETİK-1203', 'SENTETİK-1205']);
    assert.doesNotMatch(a2, /SENTETİK-1204/);
    // B booklet handling is per exam: 9002 is a B student in both exams and is labelled with the B number of the exam's own map
    assert.match(a2, /\(B kitapçığında \d+\)/);
    // 9003: perfect in 1203 (left out), one blank in 1204 (not sitting 1205)
    const a3 = makale(out, '9003'); assert.match(a3, /<b>1<\/b> deneme · <b>0<\/b> yanlış · <b>1<\/b> boş/); assert.deepEqual([...a3.matchAll(/<h2 class="yd-deneme-baslik">([^<]*)</g)].map(m => m[1]), ['SENTETİK-1204']);
  });
  await test('multi-exam defter: a student with nothing to print is on screen as "no questions" and is skipped in print and PDF', async () => {
    await uc();
    const out = T.gorunum(), a4 = makale(out, '9004'); assert.match(a4, /yd-yok/); assert.match(a4, /Yanlış veya boş soru yok/); assert.doesNotMatch(a4, /<img|yd-anahtar/);
    const plan = T.pdfPlan(T.birlesik(), [...S.denemeler.values()], (s, z) => s.length * z * .5);
    assert.deepEqual([...plan.kisiler].map(k => k.no), ['9001', '9002', '9003']); assert(!plan.kisiler.some(k => k.no === '9004'));
    // one exam on its own is just a library with one row: the old page, with the exam name in the identity line and no exam heading
    for (const e of S.denemeler.values()) e.sec = e.kod === '1203';
    const tek = T.gorunum(), t1 = makale(tek, '9001');
    assert.match(t1, /Öğrenci No <b>9001<\/b> · 205 12\/A · SENTETİK-1203<\/p>/); assert.doesNotMatch(t1, /yd-deneme-baslik|deneme ·/); assert.match(t1, /<b>1<\/b> yanlış · <b>2<\/b> boş/);
    assert.deepEqual(nos(T.birlesik()), ['9001', '9002', '9003']);
  });
  await test('multi-exam filters: Şube and Öğrenci across the selection, the ders ticks are the union by name, a closed ders closes it in every exam', async () => {
    await uc();
    let out = T.gorunum();
    assert.deepEqual([...out.matchAll(/data-yd-ders="([^"]*)"/g)].map(m => m[1]), ['Türkçe', 'Tarih', 'Din Kültürü', 'Ek Felsefe'], 'union by name, once');
    assert.match(out, /<option value="9001">SENTETİK ÖĞRENCİ 1 · 9001<\/option>/); assert.match(out, /Tüm öğrenciler \(4\)/);
    S.sube = '205 12/B'; assert.deepEqual(nos(T.birlesik()), ['9003', '9004']);
    S.sube = ''; S.kapali = new Set(['Türkçe']);
    for (const m of T.birlesik()) for (const x of m.denemeler) assert(!x.d.bolumler.some(b => b.ders === 'Türkçe'), 'Türkçe closed in ' + x.e.kod);
    S.kapali = new Set(); S.ogr = '9002'; assert.deepEqual(nos(T.birlesik()), ['9002']); assert.equal(T.birlesik()[0].denemeler.length, 2);
    S.ogr = ''; S.status = 'bos'; assert(T.birlesik().every(m => m.yanlis === 0), 'Soru durumu applies to every exam'); S.status = 'all';
    // the student of one exam only keeps the right name and şube of the latest exam (1205 is later than 1203)
    assert.equal(T.birlesik().find(m => m.ogr.no === '9001').ogr.sube, '205 12/A');
    // unticking an exam row removes it from the print set but not from the library
    S.denemeler.get('1204').sec = false; assert.equal(T.birlesik().find(m => m.ogr.no === '9001').denemeler.length, 2); assert.equal(S.denemeler.size, 3);
  });

  /* ---- PDF plan (the layout the downloaded file is drawn from) ---- */
  await test('PDF plan: A4 pages, a page for each student\'s questions plus the key, nothing split or outside the margins, expected page count for the small set', async () => {
    await uc();
    const olcu = (s, z) => s.length * z * .5, ex = [...S.denemeler.values()], plan = T.pdfPlan(T.birlesik(), ex, olcu);
    assert.deepEqual([...plan.kisiler].map(k => k.sayfalar.length), [2, 2, 2], 'three students, each one page of questions and one key page');
    assert.equal(plan.sayfa, 6);
    const {W, H, M} = {W: 595.28, H: 841.89, M: 34.02};
    for (const k of plan.kisiler) for (const [i, p] of k.sayfalar.entries()) {
      for (const op of p.ops) {
        if (op.t === 'i') { assert(op.x >= M - .01 && op.x + op.w <= W - M + .01 && op.y >= M - .01 && op.y + op.h <= H - M + .01, 'picture inside the margins'); assert(op.w <= (W - 2 * M) * .82 + .01) }
        if (op.t === 't' && op.y < H - 30) assert(op.x >= M - .01 && op.y <= H - M + 1, 'text inside the margins');
      }
      assert.match(p.ops.at(-1).s, new RegExp(' ' + (i + 1) + ' / 2$'), 'footer with the page number of the student');
    }
    const ilk = plan.kisiler[0].sayfalar[0].ops.filter(o => o.t === 't').map(o => o.s);
    assert.equal(ilk[0], 'SENTETİK ÖĞRENCİ 1'); assert(ilk.some(s => /^Denemeler: SENTETİK-1203 · SENTETİK-1204 · SENTETİK-1205$/.test(s))); assert(ilk.some(s => /^3 deneme · \d+ yanlış · \d+ boş$/.test(s)));
    const idx = n => ilk.indexOf(n); assert(idx('SENTETİK-1203') > 0 && idx('SENTETİK-1203') < idx('SENTETİK-1204') && idx('SENTETİK-1204') < idx('SENTETİK-1205'), 'exam headings in order');
    const anahtar = plan.kisiler[0].sayfalar.at(-1).ops.filter(o => o.t === 't').map(o => o.s); assert.equal(anahtar[0], 'Cevaplar'); assert(anahtar.includes('Senin cevabın') && anahtar.includes('Boş'));
    // pictures are shared: a crop used by several students is one object
    const resimler = new Set(plan.kisiler.flatMap(k => k.sayfalar.flatMap(p => p.ops.filter(o => o.t === 'i').map(o => o.c)))); assert(resimler.size > 0 && resimler.size < 60);
    // two columns: pictures sit at the left edge or the right column, never in between
    const xs = new Set(plan.kisiler.flatMap(k => k.sayfalar.flatMap(p => p.ops.filter(o => o.t === 'i').map(o => Math.round(o.x))))); assert([...xs].every(x => x === Math.round(M) || x === Math.round(M + (W - 2 * M - 14.17) / 2 + 14.17)), [...xs].join());
  });
  await test('PDF plan: a large set breaks across pages without splitting a picture or leaving the margins; a wide passage takes the full width; the page count is told before drawing', async () => {
    const sim = Y.simule({N: 6, seed: 3}), rapor = await T.raporCoz(bytes(Y.raporBuyuk(sim, {ayt: false}))), kitSpec = Y.kitapcikSpecBuyuk([['TUR', 20], ['MAT', 20]], '1203'), k = T.kitapcikCoz(Y.itemlere(kitSpec));
    T.sifirla(); const crops = new Map(); k.testler.forEach((t, ti) => t.sorular.forEach(q => crops.set(ti + ':' + q.no, {url: 'x', blob: null, w: 540, h: 140 + 70 * (q.no % 5) + (q.no === 7 ? 1500 : 0), genis: false})));
    const e = T.denemeKoy({kitlar: {TYT: k}, rapor, crops}); k.testler[0].sorular[2].genis = true; Object.assign(S, {onizleme: 1e9, sube: '', ogr: '', status: 'all', bantlar: null, kendi: false, kapali: new Set(), oturum: 'TYT+AYT'});
    const plan = T.pdfPlan(T.birlesik(), [e], (s, z) => s.length * z * .5);
    assert(plan.sayfa > plan.kisiler.length * 2, 'several pages per student: ' + plan.sayfa);
    const H = 841.89, M = 34.02;
    for (const kp of plan.kisiler) for (const p of kp.sayfalar) for (const op of p.ops) if (op.t === 'i') assert(op.y + op.h <= H - M + .01 && op.y >= M - .01, 'inside the margins (tall picture scaled to the page)');
    const genis = plan.kisiler.flatMap(kp => kp.sayfalar.flatMap(p => p.ops.filter(o => o.t === 'i' && o.w > 300)));
    assert(genis.length > 0 && genis.every(o => Math.abs(o.x - M) < .01), 'wide pictures start at the left margin and use the full width');
    assert.equal(T.pdfDosyaAdi(3, '205 12/A'), 'Yanlislar_defteri_3_deneme_12A.pdf'); assert.equal(T.pdfDosyaAdi(1, ''), 'Yanlislar_defteri_1_deneme.pdf'); assert.equal(T.pdfDosyaAdi(2, '11-Ş'), 'Yanlislar_defteri_2_deneme_11S.pdf');
  });

  await test('the module keeps files only through the library: no localStorage, no notebook field, no network in the Yanlışlar code; the library has no network or localStorage either', async () => {
    const yd = source.slice(source.indexOf('const YANLISLAR'), source.indexOf('// END YANLISLAR')), lib = source.slice(source.indexOf('const DENEME_KUTUPHANE'), source.indexOf('// END DENEMEKUTUPHANE'));
    assert.doesNotMatch(yd, /localStorage|sessionStorage|indexedDB|firebase|\bfetch\(|XMLHttpRequest|sendBeacon/);
    assert.doesNotMatch(lib, /localStorage|sessionStorage|firebase|\bfetch\(|XMLHttpRequest|sendBeacon|window\.bulut/);
    assert.match(lib, /indexedDB/);
    run("D=varsayilan();D.rol='rehber'"); assert.equal(run('Object.keys(D).filter(k=>/yanlis|deneme.*kutuphane|kitap|rapor/i.test(k)).length'), 0);
  });
  console.log('Yanlışlar defteri, Deneme kütüphanesi: ' + passed + ' tests passed.');
})().catch(e => { console.error(e); process.exit(1) });
