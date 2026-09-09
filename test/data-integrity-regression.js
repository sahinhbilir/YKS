#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const end = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
assert(start >= marker.length && end > start, 'application script is available');
const source = html.slice(start, end);

function app() {
  const element = () => ({ innerHTML: '', textContent: '', style: {}, setAttribute() {} });
  const nodes = { ray: element(), ana: element(), veri: { textContent: 'null' } };
  const store = {};
  const sandbox = {
    console: { ...console, warn() {} }, setTimeout, clearTimeout, Blob, URL, URLSearchParams,
    crypto, Date, Math, JSON, Intl, location: { search: '?dev=1' }, navigator: {},
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    fetch: async () => ({ ok: false }),
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: { addEventListener() {}, scrollTo() {} },
    document: {
      addEventListener() {}, getElementById: id => nodes[id] || null,
      querySelector() { return null; }, querySelectorAll() { return []; },
      createElement: element, body: { appendChild() {} }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  run(`D = varsayilan(); D.rol = 'rehber'; D.ayar.testTarih = '2026-09-07';
    D.ayar.donemElle = true;
    D.ogr = [{no:42, ad:'Ada', sube:'12-A', alan:'SAY', kap:6, off:[], aktif:true}];
    EK.ogr = 0; EK.hafta = null;`);
  return { run, sandbox, nodes, store };
}

const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const plain = value => JSON.parse(JSON.stringify(value));

test('student package preserves a sparse custom-topic weekly plan and its score', () => {
  const { run } = app();
  run(`D.ekKonular = [[1,12,'Test','Other class topic',0,''], [1,12,'Test','Assigned topic',0,'']];
    D.konuDers[KATALOG.length] = 'Matematik AYT';
    D.konuDers[KATALOG.length+1] = 'Matematik TYT';
    D.ogrIslenis = {0:{[KATALOG.length+1]:buHafta()-3}};
    planaEkle(0,buHafta(),KATALOG.length+1,0,0); haftayiSabitle(0,buHafta());
    globalThis.before = planHesapla(0,buHafta()).gunler.map(l=>l.map(x=>[x.ad,x.dersAd,x.soru]));
    globalThis.packet = JSON.parse(JSON.stringify(ogrenciPaketi(0)));
    veriyiHazirla(paketiYukle(packet));`);
  assert.deepEqual(plain(run('planHesapla(0,buHafta()).gunler.map(l=>l.map(x=>[x.ad,x.dersAd,x.soru]))')), plain(run('before')));
  run(`const row = planHesapla(0,buHafta()).gunler[0][0];
    sonucIsle(0,[{ki:row.ki,gun:buHafta(),not:3,dogru:null,soru:null}]);`);
  assert.equal(run('konuAl(D.log[0][2])[3]'), 'Assigned topic');
});

test('manual-only custom topics and replacement slots survive student-package import', () => {
  const { run } = app();
  run(`D.ekKonular = Array.from({length:4},(_,i)=>[1,12,'Test','Topic '+i,0,'']);
    const a=KATALOG.length+1,b=KATALOG.length+3,hb=buHafta();
    const ov=elleAl(0,hb,true);
    Object.assign(ov,{ek:[a],sil:[b],yer:{[a]:[0,0],OGREK1:[1,0],S1:[2,0]},
      soru:{[a]:24,OGREK1:12},degisim:{[a]:b},konuSlot:{OGREK1:{ki:a}},
      serbest:{S1:{ad:'Read',ders:'Serbest',soru:20,birim:'dk'}},ogrEk:{OGREK1:true}});
    ov.sil=[]; haftayiSabitle(0,hb);
    globalThis.before=planHesapla(0,hb).gunler.map(l=>l.map(x=>[x.ad,x.soru]));
    globalThis.packet=JSON.parse(JSON.stringify(ogrenciPaketi(0)));
    veriyiHazirla(paketiYukle(packet));`);
  assert.deepEqual(plain(run('planHesapla(0,buHafta()).gunler.map(l=>l.map(x=>[x.ad,x.soru]))')), plain(run('before')));
  assert.equal(run('D.elle["0|"+buHafta()].ogrEk.OGREK1'), true);
});

test('topic labels absent from the package cannot overwrite a remapped topic label', () => {
  const { run } = app();
  run(`globalThis.packet=ogrenciPaketi(0);
    packet.ekKonular={2:[1,12,'Test','Assigned',0,'']};
    packet.islenis={[KATALOG.length+2]:buHafta()-3};
    packet.konuDers={[KATALOG.length+2]:'Matematik TYT',[KATALOG.length+7]:'Fizik'};
    packet.konuKaynak={[KATALOG.length+7]:'unrelated'};
    globalThis.imported=paketiYukle(packet);`);
  assert.deepEqual(plain(run('imported.konuDers')), { [run('KATALOG.length')]: 'Matematik TYT' });
  assert.deepEqual(plain(run('imported.konuKaynak')), {});
});

test('package import preserves custom catch-up exclusions and parent relationships', () => {
  const { run } = app();
  run(`D.ekKonular=Array.from({length:4},(_,i)=>[1,12,'Test','Topic '+i,0,'']);
    D.ogr[0].otoTelafiHaric=[KATALOG.length+3];
    D.ogr[0].otoTelafiEklenen=[{ki:KATALOG.length+3,gun:buHafta()}];
    D.altKonu={[KATALOG.length+3]:KATALOG.length+1};
    globalThis.packet=JSON.parse(JSON.stringify(ogrenciPaketi(0)));
    veriyiHazirla(paketiYukle(packet));`);
  assert.equal(run('konuAl(D.ogr[0].otoTelafiHaric[0])[3]'), 'Topic 3');
  assert.equal(run('konuAl(D.altKonu[D.ogr[0].otoTelafiHaric[0]])[3]'), 'Topic 1');
  assert.equal(run('D.ogr[0].otoTelafiEklenen[0].ki'), run('D.ogr[0].otoTelafiHaric[0]'));
});

test('missing custom-topic data rejects the package without changing current data', () => {
  const { run } = app();
  run(`globalThis.packet=ogrenciPaketi(0);
    packet.elle={[buHafta()]:{ek:[KATALOG.length+5],yer:{[KATALOG.length+5]:[0,0]}}};
    globalThis.before=JSON.stringify(D);`);
  assert.throws(() => run('paketiYukle(packet)'), /konu/i);
  assert.equal(run('JSON.stringify(D)'), run('before'));
});

test('result file cannot match another student by number alone', () => {
  const { run } = app();
  run(`globalThis.packet={tur:'yks-sonuc',surum:2,no:42,ad:'Ece',sube:'12-B',konular:{},
    kayit:[[buHafta(),0,8,10,1001]]}; globalThis.before=JSON.stringify(D);`);
  assert.throws(() => run('sonucPaketiUygula(packet)'), /eşleş|bulunamadı/i);
  assert.equal(run('JSON.stringify(D)'), run('before'));
});

test('same student number in different classes resolves using the full identity', () => {
  const { run } = app();
  run(`D.ogr.push({no:42,ad:'Ece',sube:'12-B',alan:'SAY'});
    sonucPaketiUygula({tur:'yks-sonuc',surum:2,no:42,ad:'Ece',sube:'12-B',konular:{},
      kayit:[[buHafta(),0,8,10,1001]]});`);
  assert.equal(run('D.log[0][1]'), 1);
});

test('stable student ID accepts roster edits and does not fall back to a different ID', () => {
  const { run } = app();
  run(`D.rol='ogrenci'; D.ogr[0].ogrenciBulutId='student-a';
    sonucIsle(0,[{ki:0,gun:buHafta(),not:3,dogru:null,soru:null}]);
    globalThis.packet=sonucPaketi(); D.log=[];D.kart={};D.rol='rehber';
    D.ogr[0].no=73; D.ogr[0].ad='Ada New'; D.ogr[0].sube='12-C';
    sonucPaketiUygula(packet);`);
  assert.equal(run('D.log.length'), 1);
  run(`D.ogr[0].ogrenciBulutId='student-b'; globalThis.before=JSON.stringify(D);`);
  assert.throws(() => run('sonucPaketiUygula(packet)'), /eşleş|bulunamadı/i);
  assert.equal(run('JSON.stringify(D)'), run('before'));
});

test('null server data is skipped before sorting and the valid local backup loads', async () => {
  const { run, sandbox, store } = app();
  store.yks_veri = run('JSON.stringify(D)');
  sandbox.fetch = async () => ({ ok: true, json: async () => null });
  await run('durumuYukle()');
  assert.equal(run('D.ogr[0].ad'), 'Ada');
});

test('invalid latest backup falls back to valid embedded data with a warning', async () => {
  const { run, nodes, store } = app();
  nodes.veri.textContent = run('JSON.stringify(D)');
  store.yks_veri = JSON.stringify({ rev: 999, ayar: null, ogr: [] });
  const warnings = await run('durumuYukle()');
  assert.equal(run('D.ogr[0].ad'), 'Ada');
  assert(warnings.some(w => w.includes('cihaz')));
});

(async () => {
  const results = [];
  for (const { name, fn } of cases) {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: e.stack }); }
  }
  const passed = results.filter(r => r.ok).length;
  console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
  process.exitCode = passed === results.length ? 0 : 1;
})();
