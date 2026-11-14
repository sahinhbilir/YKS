#!/usr/bin/env node
'use strict';
// Okul dışı öğrenci: a student under the rehber öğretmen who sits the school's mock exams but follows no class timetable or school
// topic plan, and does their own konu anlatımı with their own plan (o.okul === false, şube OKUL_DISI_SUBE). Synthetic students only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const F = require('./konutakibi-fixtures.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox), get = code => JSON.parse(JSON.stringify(run(code)));
let passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
const kur = () => run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'SENTETİK OKULDA',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}},
         {no:2,ad:'SENTETİK DIŞARIDA',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}}];
  varsayilanKonuPlaniniHazirla('12-A','SAY',12);kaydet=async()=>true`);

(async () => {
  await check('a student becomes okul dışı: no class, no school topic plan; the şube lists stay the classes', () => {
    kur();
    assert.equal(run('okulDisiYap(1,true)'), true);
    assert.deepEqual(get('[D.ogr[1].okul,D.ogr[1].sube,D.ogr[1].sinif]'), [false, 'Okul dışı', 12]);
    assert.deepEqual(get('subeListesi()'), ['12-A'], 'Okul dışı is not a class');
    assert.deepEqual(get("varsayilanKonuPlaniniHazirla(OKUL_DISI_SUBE,'SAY',12)"), { olustu: false }); assert.equal(run("D.konuPlani[OKUL_DISI_SUBE]"), undefined);
    assert.equal(run('okulDisiYap(1,true)'), false, 'already');
  });
  await check('its week holds no school topic; its own plan (Kendi YKS planın) gives the konu anlatımları', () => {
    kur(); run('okulDisiYap(1,true)');
    const bu = run('buHafta(1)'), okulda = get(`planHesapla(0,${bu}).gunler.flat().map(x=>x.ki)`), disarida = get(`planHesapla(1,${bu}).gunler.flat().filter(x=>!x.serbest).map(x=>x.ki)`);
    void okulda; assert.deepEqual(disarida, [], 'no school topic before the own plan starts');
    assert.equal(run('kendiPlanTuru(D.ogr[1])'), 'YKS', 'the full YKS plan, like a student who does not go to school');
    run(`kendiPlanKur(1,Object.fromEntries(kendiPlanDersleri('SAY','YKS').map(d=>[d,'biraz'])),'2027-06-19')`);
    const hafta = get(`planHesapla(1,${bu}).gunler.flat()`);
    // The own plan starts as for any student who does not go to school: its genel tekrar weeks first, then the konu anlatımları.
    assert(hafta.length && hafta.every(x => x.gt || x.anlatim || x.serbest || run(`D.ogr[1].kendiPlan.sira.includes(${+x.ki})`)), 'every study of the week comes from the own plan');
    const sonra = get(`(()=>{for(let h=${bu},i=0;i<40;h=sonrakiHafta(1,h),i++){const l=kendiPlanHaftasi(1,h);if(l.length)return l}return []})()`);
    assert(sonra.length && sonra.every(k => run(`D.ogr[1].kendiPlan.sira.includes(${+(k.ki ?? k)})`)), 'its konu anlatımları come from the own plan');
  });
  await check('the student keeps the school number for the mock exam lists; the package carries okul: false; back to a class', () => {
    kur(); run('okulDisiYap(1,true)');
    assert.equal(run('D.ogr[1].no'), 2, 'the school number stays: the exam lists match by it');
    run("D.ogr[1].syncId='s';D.ogr[1].ogrenciBulutId='b'"); const pk = run('ogrenciPaketi(1)');
    assert.equal(pk.ogr.okul, false); assert.equal(pk.konuPlani, null, 'no school topic plan in the package');
    assert.equal(run("okulDisiYap(1,false,'12-A')"), true);
    assert.equal(run('D.ogr[1].okul'), undefined); assert.equal(run('D.ogr[1].sube'), '12-A');
  });
  await check('the Öğrenciler page offers it when adding and on each row; only the teacher can change it', () => {
    kur(); run('okulDisiYap(1,true)'); const h = run('gorunumOgrenciler()');
    assert.match(h, /<input type="checkbox" id="yOkulDisi"> Okul dışı<\/label>/);
    assert.match(h, /<span class="mini"[^>]*>Okul dışı<\/span><label[^>]*><input type="checkbox" class="oOkulDisi" data-i="1" checked> okul dışı<\/label>/);
    assert.match(h, /<input class="oSube" data-i="0" value="12-A"[^>]*><label[^>]*><input type="checkbox" class="oOkulDisi" data-i="0"> okul dışı<\/label>/);
    run("D.rol='ogrenci'"); assert.equal(run('okulDisiYap(0,true)'), false); run("D.rol='rehber'");
    run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
  });
  console.log(passed + ' okul dışı checks passed');
})();
