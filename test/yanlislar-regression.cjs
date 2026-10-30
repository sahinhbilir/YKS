// Yanlışlar defteri: booklet question starts, cevap raporu (TC never kept), section -> test mapping, A <-> B map, wrong/empty selection,
// and the printed markup. Synthetic data only (test/yanlislar-fixtures.cjs).
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
const T = run('YANLISLAR');
const copy = x => JSON.parse(JSON.stringify(x));
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
const bytes = b => new Uint8Array(b);
const kit = () => T.kitapcikCoz(Y.kitapcikSayfalari());
async function kur(o) { const rapor = await T.raporCoz(bytes(Y.raporXlsx(o))), k = kit(), es = T.esle(rapor, k); return {rapor, k, es}; }
const pairsOf = (pairs, perPage) => T.cozumEtiketleri(Y.itemlere(Y.cozumSpec(pairs, perPage)));

(async () => {
  await test('booklet: tests, counts and question starts (false numbers and the instruction block are not questions)', () => {
    const k = kit();
    assert.deepEqual(copy(k.testler.map(t => [t.kod, t.soru, t.sorular.length])), [['TUR', 4, 4], ['SOS', 6, 6]]);
    assert.deepEqual(copy(k.testler.map(t => [t.ilk, t.son])), [[2, 3], [4, 6]]);
    assert.equal(k.testler[0].ad, 'TURKCE TESTI');
    // question 1 is alone in its column, so its region runs down to the footer rule
    const q1 = k.testler[0].sorular[0].parcalar;
    assert.equal(q1.length, 1); assert.equal(q1[0].p, 2); assert(Math.abs(q1[0].y1 - (719 + 0.9 * 9 + 3)) < 1e-6); assert(q1[0].y0 < 80 && q1[0].y0 > 70);
    // two questions in one column end where the next starts
    assert.equal(k.testler[1].sorular.length, 6);
  });
  await test('booklet: a shared passage is placed in front of each of its questions; a column with several questions is cut at the next number', () => {
    const k = kit(), q5 = k.testler[1].sorular[4], q6 = k.testler[1].sorular[5], q4 = k.testler[1].sorular[3];
    assert.equal(q5.parcalar.length, 2); assert.equal(q6.parcalar.length, 2);
    assert.deepEqual(copy(q5.parcalar[0]), copy(q6.parcalar[0]), 'both questions get the same passage');
    const pre = q5.parcalar[0];
    assert(pre.y1 > 768 && pre.y1 < 790, 'starts above the notice box'); assert(Math.abs(pre.y0 - (560 + 0.9 * 9 + 1)) < 1e-6, 'ends above question 5');
    assert.equal(q4.parcalar.length, 1, 'a passage belongs only to its own questions');
    assert(q5.parcalar[1].y1 < pre.y0 + 3);
  });
  await test('booklet: errors are clear Turkish messages and nothing is accepted', () => {
    const bad = (mut, re) => { const p = Y.kitapcikSayfalari(); mut(p); assert.throws(() => T.kitapcikCoz(p), re) };
    bad(p => { p[2].items = p[2].items.filter(i => i.s !== '4.') }, /TURKCE TESTI: kitapçıkta 4 soru yazıyor, 3 soru bulundu \(4\. soru bulunamadı\)/);
    bad(p => { p[1].items = p[1].items.filter(i => !/Bu testte/.test(i.s)) }, /soru sayısı .* okunamadı/);
    bad(p => { for (const q of p) q.items = q.items.filter(i => !/^2026-27/.test(i.s)) }, /soru kitapçığına benzemiyor/);
    assert.throws(() => T.kitapcikCoz([]), /PDF sayfaları okunamadı/);
  });
  await test('cevap raporu: students, sections and keys from header text (shared strings, stored entries)', async () => {
    const r = await T.raporCoz(bytes(Y.raporXlsx()));
    assert.equal(r.ad, 'SENTETİK-1203'); assert.equal(r.T, 10);
    assert.deepEqual(copy(r.bolumler.map(b => [b.ad, b.ders, b.n, b.bas])), [['TÜRKÇE-T', 'Türkçe', 4, 0], ['TARİH-T', 'Tarih', 2, 4], ['DİN KÜLTÜRÜ-T', 'Din Kültürü', 2, 6], ['S.FELSEFE-T', 'S.Felsefe', 2, 8]]);
    assert.deepEqual(copy(r.anahtar), {A: Y.KEY_A, B: Y.KEY_B});
    assert.deepEqual(copy(r.ogrenciler.map(o => [o.no, o.ad, o.sube, o.kit])), [['9001', 'SENTETİK ÖĞRENCİ 1', '205 12/A', 'A'], ['9002', 'SENTETİK ÖĞRENCİ 2', '205 12/A', 'B'], ['9003', 'SENTETİK ÖĞRENCİ 3', '205 12/B', 'A']]);
    assert.deepEqual(copy(r.ogrenciler[1].cev), Y.OGRENCILER[1].cev);
    // inline strings and deflated entries read the same
    const r2 = await T.raporCoz(bytes(Y.raporXlsx({shared: false, method: 8})));
    assert.deepEqual(copy(r2.ogrenciler), copy(r.ogrenciler));
  });
  await test('privacy: no TC field and no 11 digit number in the parsed model, with the TC column present', async () => {
    for (const tcBaslik of ['TC Kimlik No', 'T.C. Kimlik No', 'TC']) for (const shared of [true, false]) {
      const r = await T.raporCoz(bytes(Y.raporXlsx({tcBaslik, shared})));
      assert.doesNotMatch(JSON.stringify(r), /\d{11}/);
      assert(!JSON.stringify(Object.keys(r.ogrenciler[0])).match(/tc|kimlik/i));
      for (const n of Y.SENTETIK_TC) assert(!JSON.stringify(r).includes(n));
    }
    // an 11 digit number anywhere else is dropped too: here in the Şube cell
    const rows = Y.raporSatirlari();rows[7][4] = '98765432109';
    const r = await T.raporCoz(bytes(F.xlsx({sheetName: 'TYT', shared: true, method: 0, rows})));
    assert.doesNotMatch(JSON.stringify(r), /\d{11}/); assert.equal(r.ogrenciler[0].sube, '');
    // the page state never holds one either
    assert.doesNotMatch(JSON.stringify(copy(T.durumu().durum)), /\d{11}/);
  });
  await test('privacy: the cells of the TC column (below the header) are never read, only skipped', async () => {
    const touched = [], Real = sandbox.DOMParser;
    sandbox.DOMParser = class { parseFromString(t, m) {
      const doc = new Real().parseFromString(t, m);
      for (const c of doc.documentElement.getElementsByTagNameNS('*', 'c')) {
        const r = c.getAttribute('r') || '';
        if (/^D(\d+)$/.test(r) && +r.slice(1) > 5) for (const el of [c, ...c.all()]) { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'textContent'); Object.defineProperty(el, 'textContent', {get() { touched.push(r); return d.get.call(this) }}) }
      }
      return doc;
    } };
    try { for (const shared of [false, true]) { const r = await T.raporCoz(bytes(Y.raporXlsx({shared, method: 8}))); assert.equal(r.ogrenciler.length, 3) } } finally { sandbox.DOMParser = Real }
    assert.deepEqual(touched, [], 'no TC cell was opened');
  });
  await test('Konu takibi still refuses the same cevap raporu file', async () => {
    await assert.rejects(run('KONU_TAKIBI').ozetCoz(bytes(Y.raporXlsx({method: 8}))), /cevap raporu/);
  });
  await test('cevap raporu: errors', async () => {
    await assert.rejects(T.raporCoz(bytes(Buffer.from('not an xlsx file at all'))), /geçerli bir Excel/);
    await assert.rejects(T.raporCoz(bytes(F.ozetXlsx([['TÜRKÇE-T', 'T.12.1.1']]))), /cevap raporu değil/);
    const rows = Y.raporSatirlari();rows[7][5] = 'C';
    await assert.rejects(T.raporCoz(bytes(F.xlsx({sheetName: 'TYT', method: 0, rows}))), /A veya B olmayan/);
  });
  await test('sections fill the booklet tests in order; counts that do not fit give a Turkish error', async () => {
    const {es} = await kur();
    assert.deepEqual(copy(es.bolumler.map(b => [b.ders, b.test, b.off])), [['Türkçe', 0, 0], ['Tarih', 1, 0], ['Din Kültürü', 1, 2], ['S.Felsefe', 1, 4]]);
    assert.deepEqual(copy(es.cift), [2, 3]); assert.deepEqual(copy(es.testler), [4, 6]);
    const rapor = await T.raporCoz(bytes(Y.raporXlsx()));
    const k = kit();k.testler[1].soru = 7;
    assert.throws(() => T.esle(rapor, k), /bölümler soru kitapçığındaki testlerle eşleşmiyor\. Rapor: Türkçe 4, Tarih 2/);
    const k2 = kit();k2.testler[0].soru = 5;assert.throws(() => T.esle(rapor, k2), /eşleşmiyor/);
    const k3 = kit();k3.testler.pop();assert.throws(() => T.esle(rapor, k3), /eşleşmiyor/);
    const k4 = kit();k4.testler.push({...k4.testler[1], ad: 'FEN'});assert.throws(() => T.esle(rapor, k4), /eşleşmiyor/);
  });
  await test('çözüm: labels read from two columns in order; happy path validates', async () => {
    const p = pairsOf(); assert.deepEqual(copy(p), Y.HARITA);
    const p2 = pairsOf(Y.HARITA, 4); assert.deepEqual(copy(p2), Y.HARITA, 'another page size / split gives the same order');
    const {rapor, es} = await kur(), h = T.haritaKur(p, es, rapor);
    assert.equal(h.adet, 10); assert.deepEqual(copy(h.testler[0].bToA.slice(1)), [2, 4, 1, 3]); assert.deepEqual(copy(h.testler[1].aToB.slice(1)), [2, 1, 4, 3, 6, 5]);
    assert.throws(() => T.cozumEtiketleri([{w: 567, items: [{s: 'Sentetik', x: 1, y: 1}]}]), /soru eşleşmesi bulunamadı/);
  });
  await test('çözüm: every validation failure refuses the file', async () => {
    const {rapor, es} = await kur(), bad = (pairs, re) => assert.throws(() => T.haritaKur(pairs, es, rapor), re);
    const mut = (i, v) => Y.HARITA.map((p, k) => k === i ? v : p);
    bad(Y.HARITA.slice(0, 9), /9 soru eşleşmesi var, soru kitapçığında 10 soru var/);
    bad(mut(1, [2, 3]), /B-3 birden fazla kez/);          // B repeated
    bad(mut(1, [1, 1]), /A-1 birden fazla kez/);          // A repeated
    bad(mut(0, [1, 9]), /aralığı dışında/);                // outside 1..N
    bad(mut(4, [1, 5]), /aralığı dışında|birden/);        // not a permutation
    // crosses a section: Tarih (SOS 1-2) paired with Din (SOS 3-4); keys made equal so only the section rule can fail
    const r2 = copy(rapor);
    const cross = [[1,3],[2,1],[3,4],[4,2],[1,3],[2,1],[3,2],[4,4],[5,6],[6,5]];   // A-1<->B-3 Tarih/Din
    r2.anahtar.B = ['B','D','A','C','C','D','A','B','A','E'];
    assert.throws(() => T.haritaKur(cross, es, r2), /farklı derslere ait/);
    // keyA[a] !== keyB[b]
    const r3 = copy(rapor);r3.anahtar.B[0] = 'E';
    assert.throws(() => T.haritaKur(Y.HARITA, es, r3), /cevap anahtarlarıyla uyuşmuyor/);
    // all valid with the real keys
    assert.equal(T.haritaKur(Y.HARITA, es, rapor).adet, 10);
  });
  await test('wrong and empty selection, own marks and keys; an A student keeps A numbers', async () => {
    const {rapor, es} = await kur(), d = T.defterKur(rapor, es, null, rapor.ogrenciler[0], null);
    assert.deepEqual(copy(d.bolumler.map(b => [b.ders, b.sorular.map(s => [s.a, s.b, s.isaret, s.dogru, s.durum])])), [['Türkçe', [[2, null, 'C', 'B', 'yanlis'], [3, null, '', 'C', 'bos']]], ['Din Kültürü', [[4, null, '', 'D', 'bos']]]]);
    assert.deepEqual([d.yanlis, d.bos, d.gorsel], [1, 2, true]);
    const hepsi = T.defterKur(rapor, es, null, rapor.ogrenciler[2], null);assert.deepEqual([hepsi.yanlis, hepsi.bos, hepsi.bolumler.length], [0, 0, 0]);
    // ders toggle
    const acik = new Set([0]);assert.deepEqual(copy(T.defterKur(rapor, es, null, rapor.ogrenciler[0], acik).bolumler.map(b => b.ders)), ['Türkçe']);
  });
  await test('Din / S.Felsefe: a fully blank one is skipped only when the other has an answer', async () => {
    const {rapor, es} = await kur(), blank = ['', ''], dersler = o => copy(T.defterKur(rapor, es, null, o, null).bolumler.map(b => b.ders));
    const mk = (din, sf) => ({...rapor.ogrenciler[0], cev: ['A', 'B', 'C', 'D', 'A', 'B', ...din, ...sf]});
    assert.deepEqual(dersler(mk(blank, ['A', 'A'])), ['S.Felsefe'], 'Din blank, S.Felsefe answered: Din skipped');
    assert.deepEqual(dersler(mk(['A', ''], blank)), ['Din Kültürü'], 'S.Felsefe blank, Din answered: S.Felsefe skipped');
    assert.deepEqual(dersler(mk(blank, blank)), ['Din Kültürü', 'S.Felsefe'], 'both blank: nothing answered, both shown');
    assert.deepEqual(dersler(mk(['', 'D'], ['E', 'A'])), ['Din Kültürü'], 'both answered: only the one with a wrong or empty question is listed');
  });
  await test('B student without the çözüm file: numbers only, B numbers, a note; with the map: A images, A numbers, B numbers', async () => {
    const {rapor, es} = await kur(), b = rapor.ogrenciler[1];
    const d0 = T.defterKur(rapor, es, null, b, null);
    assert.equal(d0.gorsel, false);
    assert.deepEqual(copy(d0.bolumler.map(x => [x.ders, x.sorular.map(s => [s.a, s.b, s.own, s.isaret, s.dogru, s.durum])])), [['Türkçe', [[null, 4, 4, '', 'C', 'bos']]], ['Tarih', [[null, 2, 2, '', 'A', 'bos']]], ['S.Felsefe', [[null, 6, 6, 'A', 'E', 'yanlis']]]]);
    const h = T.haritaKur(Y.HARITA, es, rapor), d1 = T.defterKur(rapor, es, h, b, null);
    assert.equal(d1.gorsel, true);
    assert.deepEqual(copy(d1.bolumler.map(x => [x.ders, x.sorular.map(s => [s.test, s.a, s.b, s.isaret, s.dogru])])), [['Türkçe', [[0, 3, 4, '', 'C']]], ['Tarih', [[1, 1, 2, '', 'A']]], ['S.Felsefe', [[1, 5, 6, 'A', 'E']]]]);
  });
  // ---- markup ----
  const show = async o => {
    const {rapor, k, es} = await kur(), S = T.durumu();
    Object.assign(S, {kit: k, rapor, es, pairs: null, harita: o.harita ? T.haritaKur(Y.HARITA, es, rapor) : null, sube: '', ogr: '', kapali: new Set(), crops: new Map(), hata: {kit: '', rapor: '', coz: ''}});
    k.testler.forEach((t, ti) => t.sorular.forEach(q => S.crops.set(ti + ':' + q.no, {url: 'blob:sentetik-' + ti + '-' + q.no, w: 10, h: 10, genis: false})));
    run("D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar'");
    return T.gorunum();
  };
  await test('page: A student shows the cut-outs, own marks and the answer key on its own last block', async () => {
    const out = await show({harita: false}), pages = out.split('<article class="yd-ogr').slice(1);
    assert.equal(pages.length, 3);
    const a = pages[0];
    assert.match(a, /<h2>SENTETİK ÖĞRENCİ 1<\/h2>/); assert.match(a, /Öğrenci No <b>9001<\/b> · 205 12\/A · SENTETİK-1203/); assert.match(a, /<b>1<\/b> yanlış · <b>2<\/b> boş/);
    assert.match(a, /<b>Soru 2<\/b><\/span><span class="yd-isaret yd-y">Senin cevabın: C<\/span>/); assert.match(a, /yd-isaret yd-b">Boş</);
    assert.match(a, /src="blob:sentetik-0-2"/);
    assert(a.indexOf('class="yd-anahtar"') > a.lastIndexOf('<img'), 'answer key comes after all questions');
    assert.match(a.slice(a.indexOf('yd-anahtar')), /<b>Türkçe<\/b>.*<i>2<\/i> B.*<i>3<\/i> C/);
    assert.match(pages[2], /yd-yok/); assert.match(pages[2], /Yanlış veya boş soru yok/);
  });
  await test('page: B student with the map gets A cut-outs labelled with the B number, and a B-numbered key; without it numbers only and a note', async () => {
    let out = await show({harita: true}), b = out.split('<article class="yd-ogr').slice(1)[1];
    assert.match(b, /<b>Soru 3<\/b> \(B kitapçığında 4\)/); assert.match(b, /<b>Soru 5<\/b> \(B kitapçığında 6\)/); assert.match(b, /Senin cevabın: A/);
    assert.match(b.slice(b.indexOf('yd-anahtar')), /<i>4<\/i> C/); assert.match(b.slice(b.indexOf('yd-anahtar')), /<i>6<\/i> E/);
    assert.doesNotMatch(b, /kendi kitapçığından/);
    out = await show({harita: false}); b = out.split('<article class="yd-ogr').slice(1)[1];
    assert.doesNotMatch(b, /<img/); assert.match(b, /B kitapçığı: sorular kendi kitapçığından çözülecek/); assert.match(b, /<b>Soru 4<\/b>/); assert.doesNotMatch(b, /B kitapçığında/);
    assert.match(b.slice(b.indexOf('yd-anahtar')), /<i>6<\/i> E/);
  });
  await test('page: nothing about the files is kept anywhere (no storage, no notebook field)', async () => {
    await show({harita: true});
    assert.equal(run('Object.keys(D).filter(k=>/yanlis|defter|kitap|rapor/i.test(k)).length'), 0);
    assert.doesNotMatch(source.slice(source.indexOf('const YANLISLAR')), /localStorage|sessionStorage|indexedDB|firebase|\bfetch\(|XMLHttpRequest|sendBeacon/);
  });
  await test('page: students only see nothing of it; the menu entry is a teacher page', () => {
    run("D=varsayilan();D.rol='ogrenci';D.ogr=[]");
    assert(!T.gorunum().includes('ydKok'));
    assert(run("MENU_REHBER.find(m=>m[0]==='denemeler')[1].includes('yanlislar')"));
    assert(run("SEKME_REHBER.some(s=>s[0]==='yanlislar'&&s[1]==='Yanlışlar defteri')"));
    assert(!run("SEKME_OGRENCI.some(s=>s[0]==='yanlislar')"));
  });
  console.log('Yanlışlar defteri: ' + passed + ' tests passed.');
})();
