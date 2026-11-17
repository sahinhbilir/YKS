'use strict';
// Haritam (connected-memory map) inside the app: who gets the tab, how a student's topics reach the map (plan topics by
// name, school units for every YKS topic they cover), and what the page draws. Synthetic students only.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

function app() {
  const store = {}, listeners = {};
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el() };
  const sandbox = { console, setTimeout: () => 0, clearTimeout() {}, Blob, URL, URLSearchParams, crypto, TextEncoder, structuredClone,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl, alert() {}, confirm: () => true, prompt: () => '',
    fetch: async () => ({ ok: false }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: {}, innerWidth: 1280,
    matchMedia: q => ({ matches: /dark/.test(q) }),
    window: { scrollTo() {}, addEventListener() {}, bulut: null },
    document: { activeElement: null, addEventListener(k, fn) { (listeners[k] ||= []).push(fn); }, contains: () => true,
      getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
      body: { appendChild() {}, insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  const json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  return { run, json, nodes, listeners, sandbox };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
const ogrenci = (a, alan, sinif) => {
  a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;");
  a.run(`D.ogr=[{no:1,ad:'Sentetik',sube:'201',${alan ? `alan:'${alan}',` : ''}sinif:${sinif},kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];` +
    "EK={ogr:0,sekme:'haritam',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};");
  if (alan) a.run(`kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('${alan}').map(d=>[d,'bilir'])),'2027-04-23')`);
};

test('the embedded module and the map are in index.html', () => {
  assert.match(source, /const HARITA_VERI = \{/); assert.match(source, /const HAFIZA_AG = /); assert.match(source, /const HARITAM = /);
  assert.match(html, /\/\* BEGIN HARITAM \*\/[\s\S]*\.hm-svg/);
});

test('who gets Haritam: students with Mathematics, Physics only for SAY (or before a field is chosen)', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), ['Geometri', 'Matematik TYT', 'Matematik AYT', 'Fizik']);
  assert(a.json('SEKMELER().map(s=>s[0])').includes('haritam'));
  a.run("D.ogr[0].alan='EA'"); assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), ['Geometri', 'Matematik TYT', 'Matematik AYT']);
  a.run("D.ogr[0].alan='SÖZ'"); assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), []);
  assert(!a.json('SEKMELER().map(s=>s[0])').includes('haritam'), 'no Mathematics: no tab');
  a.run("delete D.ogr[0].alan;D.ogr[0].sinif=10"); assert.equal(a.json('HARITAM.dersleri(D.ogr[0]).length'), 4);
  a.run("D.ogr[0].sinavTuru='LGS'"); assert.deepEqual(a.json('HARITAM.dersleri(D.ogr[0])'), []);
  assert(a.json('ETKINLIK_SEKMELER').includes('haritam'), 'visits are counted like other pages');
  a.run("D.rol='rehber'"); assert(!a.json('SEKMELER().map(s=>s[0])').includes('haritam'), 'not a teacher page');
});

test('a plan topic and a school unit both reach the map', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const kaynak = a.json('[...HARITAM.kaynaklar()].map(([id,k])=>[id,k])'), K = new Map(kaynak);
  assert(K.get('geoDik').length >= 1, 'the plan topic Dik Üçgen');
  const trig = a.run("KATALOG.findIndex(k=>k[0]===1&&k[1]===11&&k[3]==='Trigonometrik Fonksiyonlar')");
  for (const id of ['aytBirim', 'aytOzdeslik', 'aytIsaret', 'aytDonusum', 'aytPeriyot', 'aytTersTrig']) assert(K.get(id).includes(trig), id + ' fed by the grade-11 unit');
  const dik = K.get('geoDik')[0];
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-6,not:3,dogru:null,soru:null},{ki:${trig},gun:bugunNo()-4,not:3,dogru:null,soru:null}])`);
  const d = a.json('(()=>{const d=HARITAM.durum(0);return {r:[...d.satir].map(([id,s])=>[id,s.sonOz,s.r])}})()'), R = new Map(d.r.map(([id, g, r]) => [id, {g, r}]));
  const bugun = a.run('bugunNo()');
  assert.equal(R.get('geoDik').g, bugun - 6); assert.equal(R.get('pOranlar').g, bugun - 6, 'its hidden part is tested with it');
  for (const id of ['aytBirim', 'aytOzdeslik', 'aytPeriyot']) assert.equal(R.get(id).g, bugun - 4, id);
  assert(R.get('pOranlar').r > 0 && R.get('aytBirim').r > 0);
});

test('the page: one point per topic of the student\'s subjects, the real Hafızam card when a topic is chosen', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const dik = a.json("HARITAM.kaynaklar().get('geoDik')[0]");
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-6,not:3,dogru:null,soru:null}])`);
  let h = a.run('HARITAM.gorunum()');
  assert.match(h, /<svg class="hm-svg"/);
  assert.equal((h.match(/class="hm-d[ "]/g) || []).length, a.run('HARITA_VERI.konular.length'), 'every map topic of SAY');
  assert.doesNotMatch(h, /data-hm-kart>[^<]*<div class="hf-oge/, 'no card before a topic is chosen');
  a.run("EK.haritamSecili='geoDik'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /hm-kart-yer hm-sabit/); assert.match(h, new RegExp('data-hf-ac="' + dik + '"'), 'Hafızam’s own Çalıştım button');
  assert.match(h, /hm-svg hm-odak/, 'neighbours lit, the rest dimmed');
  a.run("EK.haritamSecili='pOranlar'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /Dik Üçgen konusunun parçası/, 'a hidden part shows its topic’s card');
  a.run("D.ogr[0].alan='EA';EK.haritamSecili=undefined"); h = a.run('HARITAM.gorunum()');
  assert.doesNotMatch(h, /data-hm="fizVektor"/, 'EA: no physics points'); assert.doesNotMatch(h, /FİZİK/);
  a.run("D.ogr[0].alan='SAY';EK.haritamDers='Fizik'"); h = a.run('HARITAM.gorunum()');
  assert.match(h, /data-hm="fizVektor"/); assert.doesNotMatch(h, /data-hm="geoDik"/, 'subject filter');
});

test('the student\'s FSRS settings and only real results go in', () => {
  const a = app();
  ogrenci(a, 'SAY', 12);
  const dik = a.json("HARITAM.kaynaklar().get('geoDik')[0]");
  a.run(`sonucIsle(0,[{ki:${dik},gun:bugunNo()-20,not:3,dogru:null,soru:null}])`);
  const r1 = a.json("HARITAM.durum(0).satir.get('geoDik').rOz");
  a.run(`D.ogr[0].unutmaDers={[dersAnahtari(${dik})]:2}`);
  const r2 = a.json("HARITAM.durum(0).satir.get('geoDik').rOz");
  assert(r2 > r1, 'slower forgetting set for the lesson keeps the recall higher: ' + r1 + ' → ' + r2);
  a.run(`D.log.push([bugunNo()+3,0,${dik},9,10,null])`);
  assert.equal(a.json("HARITAM.durum(0).satir.get('geoDik').sonOz"), a.run('bugunNo()') - 20, 'a future row is ignored');
});

console.log(passed + ' passed');
