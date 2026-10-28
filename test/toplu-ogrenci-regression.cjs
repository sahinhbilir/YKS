#!/usr/bin/env node
'use strict';
// Toplu öğrenci ekle: the school list pasted from Myexamy (one cell per line) or from Excel
// (tabs or semicolons, any column order) becomes a preview, and the new rows are added in
// one save. Existing numbers and names are skipped. Synthetic names only.
const fs = require('fs'), vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const listeners = {};
const element = (extra = {}) => Object.assign({
  style: {}, hidden: false, textContent: '', innerHTML: '', value: '', checked: false, disabled: false, title: '',
  classList: { contains() { return false; }, add() {}, remove() {} }, dataset: {},
  setAttribute() {}, appendChild() {}, click() {}, remove() {}, focus() {}, select() {},
  getClientRects() { return [1]; }, closest() { return null; }
}, extra);
const nodes = { ray: element(), ana: element(), stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' } };
const alerts = [];
const sandbox = {
  console, setTimeout, clearTimeout, Blob, URL, URLSearchParams, TextEncoder,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert(m) { alerts.push(String(m)); }, confirm() { return true; }, prompt() { return ''; },
  fetch: async () => ({ ok: false }),
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollTo() {}, open() { return null; }, addEventListener() {} },
  document: {
    activeElement: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return element(); },
    body: { appendChild() {}, insertAdjacentHTML() {} }
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

// Myexamy's "Öğrenciler" page as text: the column headers, a block of row numbers, then
// one cell per line. 9th and 10th grades have no alan.
const myexamy = rows => ['Öğrenciler', 'Toplam öğrenci sayısı: ' + rows.length, 'Aktif Öğrenciler', 'Pasif Öğrenciler',
  'Sütun başlığını buraya sürükleyin', '1 ile ' + rows.length + ' üzerinden ' + rows.length + '. Sayfa 1 üzerinden 1',
  'Fotoğraf', 'No', 'Adı Soyadı', 'Kurum Adı', 'Kademe', 'Alan', 'Şube', 'Kayıt Tarihi', 'Kayıt Tipi', 'İç/dış Kayıt',
  'Kayıt Notu', 'İşlemi Yapan Personel', ...rows.map((_, i) => String(i + 1)),
  ...rows.flatMap(([no, ad, sinif, alan, sube]) => [String(no), ad, 'ÖRNEK SINAV ANADOLU LİSESİ', sinif + '. Sınıf',
    ...(alan ? [alan] : []), sube, '01.07.2026', 'Asil', 'Dış Kayıt', 'ÖRNEK PERSONEL']),
  'Sayfa Boyutu:', '100', '1 ile ' + rows.length + ' üzerinden ' + rows.length].join('\n');
const okul = [
  [1501, 'ADA DENEME', 9, '', '102 9/A'], [1502, 'BORA ÖRNEK', 9, '', '102 9/A'],
  [1503, 'CEM İKİNCİ', 10, '', '105 10/B'], [1504, 'DERYA ÜÇÜNCÜ', 11, 'EA', '302 11/A'],
  [1505, 'EMRE DÖRDÜNCÜ', 11, 'SAY', '303 11/B'], [1506, 'FUNDA BEŞİNCİ', 12, 'SAY', '201 12/B'],
  [1507, 'GÖKHAN ALTINCI', 12, 'EA', '301 12/A']
];

function reset(ogr = []) {
  sandbox.__ogr = ogr;
  run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';
    EK={sekme:'ogrenciler',ogr:0,hafta:null,kirli:false,son:'',girisAcik:{}};
    D.ogr=__ogr.map(o=>({kap:6,off:[6],hedef:null,aktif:true,cikti:null,maddeler:[],rutin:{once:'',ara:'',sonra:''},...o}));
    D.ogr.filter(o=>!o.silindi).forEach(o=>varsayilanKonuPlaniniHazirla(o.sube,o.alan,o.sinif||12));`);
  alerts.length = 0;
}
const parse = text => { sandbox.__t = text; return json('topluOgrenciAyristir(__t)'); };
const plan = (text, bas = '2026-10-12') => { sandbox.__t = text; sandbox.__b = bas; return json('topluOgrenciPlani(topluOgrenciAyristir(__t), __b)'); };

check('Myexamy page text: number, name, grade, şube code and alan of every row', () => {
  reset();
  const rs = parse(myexamy(okul));
  assert.equal(rs.length, okul.length, 'row numbers and headers are not read as students');
  assert.deepEqual(rs.map(r => [r.no, r.ad, r.sinif, r.sube, r.alan || '']),
    okul.map(([no, ad, sinif, alan, sube]) => [no, ad, sinif, sube.split(' ')[0], alan]));
});

check('Excel paste: header in any order, separate Adı/Soyadı, Kademe and 12/B şube, semicolons', () => {
  reset();
  const tab = 'Sıra\tAdı Soyadı\tNo\tKademe\tŞube\tAlan\n1\tHALE YEDİNCİ\t1601\t12. Sınıf\t205 12/C\tSAY\n2\tIŞIL SEKİZİNCİ\t1602\t11. Sınıf\t303 11/B\tSayısal\n';
  assert.deepEqual(parse(tab).map(r => [r.no, r.ad, r.sinif, r.sube, r.alan]),
    [[1601, 'HALE YEDİNCİ', 12, '205', 'SAY'], [1602, 'IŞIL SEKİZİNCİ', 11, '303', 'SAY']]);
  const ayri = 'Okul No;Adı;Soyadı;Sınıf;Alan\n1603;Jale;Dokuzuncu;12/B;EA\n1604;Kaan;Onuncu;10-A;\n';
  assert.deepEqual(parse(ayri).map(r => [r.no, r.ad, r.sinif, r.sube, r.alan]),
    [[1603, 'Jale Dokuzuncu', 12, '12/B', 'EA'], [1604, 'Kaan Onuncu', 10, '10/A', null]]);
  // Without a header, rows that start with number + name are still read.
  assert.deepEqual(parse('1605\tLALE ON BİR\t12\tEA\t301 12/A').map(r => [r.no, r.sinif, r.sube, r.alan]), [[1605, 12, '301', 'EA']]);
  assert.deepEqual(parse('Bu metinde öğrenci yok.\n12\n'), []);
});

check('preview: new şubeler, 9–10 default alan, plan start, built-in 12th-grade şube', () => {
  reset();
  const p = plan(myexamy(okul));
  assert(p.every(s => s.durum === 'ekle'), JSON.stringify(p.filter(s => s.durum !== 'ekle')));
  const by = Object.fromEntries(p.map(s => [s.no, s]));
  assert.equal(by[1501].alan, 'SAY', '9th grade without alan gets a valid default');
  assert.equal(by[1501].mufredatBaslangic, '2026-10-12');
  assert.equal(by[1506].mufredatBaslangic, undefined, '12th grade has no curriculum start');
  assert(by[1501].yeniSube && by[1506].yeniSube);
});

check('preview skips numbers, names and class levels that clash with the list', () => {
  reset([
    { no: 1501, ad: 'Ada  deneme', sube: '102', sinif: 9, alan: 'SAY', mufredatBaslangic: '2026-09-07' },
    { no: 1503, ad: 'Başka Öğrenci', sube: '105', sinif: 10, alan: 'SAY', mufredatBaslangic: '2026-09-07' },
    { no: 77, ad: 'Derya Üçüncü', sube: '302', sinif: 11, alan: 'EA', mufredatBaslangic: '2026-09-07' },
    { no: 1505, ad: 'Silinmiş Kayıt', sube: '303', sinif: 11, alan: 'SAY', silindi: true },
    { no: 90, ad: 'Eski On İki', sube: '112', sinif: 12, alan: 'SAY' }
  ]);
  const rows = [...okul, [1502, 'BORA İKİZ', 9, '', '102 9/A'], [1508, 'HAKAN YEDİNCİ', 11, 'SAY', '205 11/B'], [1512, 'LEYLA ON İKİ', 11, 'SAY', '201 11/B'],
    [1509, 'İPEK SEKİZ', 11, '', '303 11/B'], [1510, 'JALE DOKUZ', 11, '', '304 11/C'], [1511, 'KEMAL ON', 10, '', '112 10/X']];
  const p = Object.fromEntries(plan(myexamy(rows)).map(s => [s.no + ':' + s.ad, s]));
  assert.equal(p['1501:ADA DENEME'].neden, 'Zaten listede', 'same number and name (case and spaces ignored)');
  assert.equal(p['1503:CEM İKİNCİ'].neden, 'Bu numara Başka Öğrenci adına kayıtlı');
  assert.equal(p['1504:DERYA ÜÇÜNCÜ'].neden, 'Aynı adla kayıtlı (No 77)');
  assert.equal(p['1505:EMRE DÖRDÜNCÜ'].durum, 'ekle', 'a deleted student does not block the number');
  assert.equal(p['1502:BORA İKİZ'].neden, 'Listede iki kez var');
  assert.equal(p['1508:HAKAN YEDİNCİ'].neden, '205 hazır 12. sınıf şubesi');
  assert.equal(p['1512:LEYLA ON İKİ'].neden, '201 şubesi 12. sınıf', 'a şube filled earlier in the same paste counts');
  assert.equal(p['1509:İPEK SEKİZ'].alan, 'SAY', 'alan comes from the şube when the row has none');
  assert.equal(p['1510:JALE DOKUZ'].neden, 'Alan yok', '11th grade needs an alan');
  assert.equal(p['1511:KEMAL ON'].neden, '112 şubesi 12. sınıf');
  assert.equal(p['1502:BORA ÖRNEK'].mufredatBaslangic, '2026-09-07', 'an existing şube keeps its curriculum start');
  assert.equal(p['1502:BORA ÖRNEK'].yeniSube, false);
});

check('rows without number, grade or şube are shown with a reason, not added', () => {
  reset();
  const p = plan('Adı Soyadı\tNo\tSınıf\tŞube\tAlan\nNUMARASIZ ÖĞRENCİ\t\t12\t201\tSAY\nSINIFSIZ ÖĞRENCİ\t1700\t\t\tSAY\n' +
    'UYUMSUZ ÖĞRENCİ\t1701\t11\t201 12/B\tSAY\nŞUBESİZ ÖĞRENCİ\t1702\t12\t\tSAY\n');
  assert.deepEqual(p.map(s => [s.durum, s.neden]), [['atla', 'Numara yok'], ['atla', 'Sınıf okunamadı'],
    ['atla', 'Sınıf ile şube uyuşmuyor'], ['atla', 'Şube okunamadı']]);
});

check('apply: one push per new row, not yet "kullanıyor", topic plans only for new şubeler', () => {
  reset([{ no: 90, ad: 'Mevcut Öğrenci', sube: '201', sinif: 12, alan: 'SAY' }]);
  run(`D.konuPlani['201'] = [['dokunulmadı']];`);
  sandbox.__t = myexamy(okul);
  const n = run(`topluOgrenciUygula(topluOgrenciPlani(topluOgrenciAyristir(__t), '2026-10-12'), 4)`);
  assert.equal(n, okul.length);
  const ogr = json('D.ogr.slice(1)');
  assert.deepEqual(ogr.map(o => [o.no, o.sube, o.sinif, o.alan, o.kap, o.aktif]),
    okul.map(([no, , sinif, alan, sube]) => [no, sube.split(' ')[0], sinif, alan || 'SAY', 4, false]));
  assert(ogr.filter(o => o.sinif < 12).every(o => o.mufredatBaslangic === '2026-10-12'));
  assert(ogr.filter(o => o.sinif === 12).every(o => !('mufredatBaslangic' in o)));
  assert.deepEqual(json(`D.konuPlani['201']`), [['dokunulmadı']], 'an existing şube plan is not rebuilt');
  for (const su of ['102', '105', '302', '303', '301']) assert(run(`Object.hasOwn(D.konuPlani, '${su}')`), su + ' gets a topic plan');
  run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
  // A second paste of the same list adds nobody.
  assert(plan(myexamy(okul)).every(s => s.durum === 'atla'));
});

check('apply refuses view-only and rolls back when the notebook would pass the cloud limit', () => {
  reset();
  sandbox.__t = myexamy(okul);
  run(`IZLEME = {sahipUid:'a', izleyiciUid:'b'}`);
  assert.throws(() => run(`topluOgrenciUygula(topluOgrenciPlani(topluOgrenciAyristir(__t), '2026-10-12'), 6)`), /görüntüleme/);
  assert.equal(run('topluOgrenciKarti()'), '', 'view-only hides the card');
  run('IZLEME = null');
  run(`D.dolgu = 'x'.repeat(DEFTER_HAM_UST_SINIR - JSON.stringify(D).length - 200)`);
  const once = run('JSON.stringify([D.ogr, D.konuPlani])');
  assert.throws(() => run(`topluOgrenciUygula(topluOgrenciPlani(topluOgrenciAyristir(__t), '2026-10-12'), 6)`), /boyut sınırını/);
  assert.equal(run('JSON.stringify([D.ogr, D.konuPlani])'), once, 'nothing is left half-added');
  run('delete D.dolgu');
});

check('card: summary per şube, escaped names, add button only when something is new', () => {
  reset();
  run(`EK.topluOgr = null`);
  let h = run('topluOgrenciKarti()');
  assert.match(h, /<details class="kart" id="topluOgrKart"[^>]*><summary><b>Toplu öğrenci ekle<\/b>/);
  assert(!/ open/.test(h.slice(0, h.indexOf('>'))), 'closed until used');
  sandbox.__m = 'Adı Soyadı\tNo\tSınıf\tŞube\tAlan\nA<b>B ÇİZGİ\t1800\t12\t201 12/B\tSAY\n' + 'ATLANAN\t\t12\t201\tSAY\n';
  run(`EK.topluOgr = {metin:__m, onizle:true, bas:'2026-10-12', kap:6}`);
  h = run('topluOgrenciKarti()');
  assert.match(h, /<p><b>2<\/b> satır · <b>1<\/b> eklenecek · <b>1<\/b> atlanacak<\/p>/);
  assert.match(h, /201 · 12\. sınıf · 1 öğrenci · yeni şube/);
  assert(h.includes('A&lt;b&gt;B ÇİZGİ') && !h.includes('A<b>B'), 'names are escaped');
  assert.match(h, /id="topluOgrEkle">1 öğrenciyi ekle<\/button>/);
  assert(h.includes('A&lt;b&gt;B ÇİZGİ</textarea>') || h.includes('A&lt;b&gt;B ÇİZGİ\t'), 'the pasted text stays in the box');
  sandbox.__m = 'Bu metinde öğrenci yok';
  run(`EK.topluOgr = {metin:__m, onizle:true, bas:'2026-10-12', kap:6}`);
  h = run('topluOgrenciKarti()');
  assert.match(h, /Öğrenci satırı bulunamadı/);
  assert(!h.includes('topluOgrEkle'));
  run(`EK.sekme='ogrenciler'`);
  assert(run('gorunumOgrenciler()').includes('id="topluOgrKart"'), 'the Öğrenciler page shows the card');
});

check('buttons: Önizle keeps the text and settings, editing blocks the old preview, Ekle saves', async () => {
  reset([{ no: 90, ad: 'Mevcut Öğrenci', sube: '201', sinif: 12, alan: 'SAY' }]);
  const dugme = id => element({ id, closest(sel) { return sel.split(',').includes('#' + id) ? this : null; } });
  nodes.topluOgrMetin = element({ id: 'topluOgrMetin', value: myexamy(okul) });
  nodes.yMufredatBaslangic = element({ id: 'yMufredatBaslangic', value: '2026-09-07' });
  nodes.yKap = element({ id: 'yKap', value: '5' });
  await listeners.click[0]({ target: dugme('topluOgrOnizle') });
  assert.deepEqual(json('[EK.topluOgr.onizle, EK.topluOgr.bas, EK.topluOgr.kap, EK.topluOgr.metin.length]'),
    [true, '2026-09-07', 5, myexamy(okul).length]);
  // Typing after the preview: the add button turns off and a click asks for a new preview.
  nodes.topluOgrEkle = element({ id: 'topluOgrEkle' });
  for (const f of listeners.input) f({ target: Object.assign(nodes.topluOgrMetin, { value: myexamy(okul.slice(0, 2)) }) });
  assert.equal(nodes.topluOgrEkle.disabled, true);
  await listeners.click[0]({ target: dugme('topluOgrEkle') });
  assert.equal(run('D.ogr.length'), 1);
  assert.match(alerts.at(-1), /yeniden önizleyin/);
  await listeners.click[0]({ target: dugme('topluOgrOnizle') });
  await listeners.click[0]({ target: dugme('topluOgrEkle') });
  assert.deepEqual(json('D.ogr.map(o => [o.no, o.kap, o.mufredatBaslangic || ""])'),
    [[90, 6, ''], [1501, 5, '2026-09-07'], [1502, 5, '2026-09-07']]);
  assert.equal(run('EK.topluOgr'), null, 'the box empties after adding');
  // Nothing new: the button explains instead of saving.
  await listeners.click[0]({ target: dugme('topluOgrOnizle') });
  await listeners.click[0]({ target: dugme('topluOgrEkle') });
  assert.equal(run('D.ogr.length'), 3);
  assert.match(alerts.at(-1), /Eklenecek yeni öğrenci yok/);
});

(async () => {
  let passed = 0;
  for (const [name, fn] of checks) {
    try { await fn(); passed++; console.log('✓ ' + name); }
    catch (e) { console.error('✗ ' + name + '\n  ' + (e && e.stack || e)); process.exitCode = 1; }
  }
  console.log(passed + '/' + checks.length + ' toplu öğrenci checks passed');
})();
