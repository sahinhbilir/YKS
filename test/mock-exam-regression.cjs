#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('node:path');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes={ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox={console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);


const assert=require('node:assert/strict');
const run=code=>vm.runInContext(code,sandbox);
function clock(iso) {
 const now=Date.parse(iso);
 sandbox.Date=class extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} };
}
const reset=()=>{clock('2026-09-25T10:00:00+03:00');return run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-25';
 D.ogr=[{no:1,ad:'Synthetic Ada',sube:'11-A',alan:'EA',sinif:11,kap:6,off:[6],aktif:true,
 ogrenciBulutId:'d70ec14d-ab10-43e5-b63f-0dd990c3626b'}];EK.ogr=0;EK.hafta=null;
 EK.takipOlcut='islem';EK.takipHafta=null;kaydet=async()=>true;ogrenciEsitlemePlanla=()=>{};`);};
const sample=(over={})=>({id:'m:one',ad:'Örnek deneme',tarih:'2026-09-18',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:[{kod:'turkce',dogru:28,yanlis:8,soru:40},{kod:'mat',dogru:12,yanlis:4,soru:30},{kod:'geo',dogru:4,yanlis:4,soru:10}],sure:150,puan:250,ts:100,...over});
const put=(name,value)=>sandbox[name]=JSON.parse(JSON.stringify(value));
let passed=0;
async function check(name,fn){reset();try{await fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
(async()=>{
 await check('TYT negative nets, AYT area totals, branch isolation',()=>{
  put('r',sample());assert.equal(run('denemeToplam(r)'),40);
  put('r',sample({tur:'AYT',oturum:'AYT',dersler:[{kod:'edebiyat',dogru:20,yanlis:4,soru:24},{kod:'mat',dogru:10,yanlis:4,soru:30},{kod:'geo',dogru:0,yanlis:4,soru:10},{kod:'fizik',dogru:0,yanlis:8,soru:14}]}));
  assert.equal(run("denemeToplam(r,'SAY')"),6);assert.equal(run("denemeToplam(r,'EA')"),27);assert.equal(run("denemeToplam(r,'SÖZ')"),19);
  put('r',sample({tur:'BRANS',brans:'turkce',dersler:[{kod:'turkce',dogru:10,yanlis:4,soru:20}]}));assert.equal(run('denemeToplam(r)'),9);assert(run('denemeDogrula([r])'));
 });
 await check('reject invalid counts, totals, dates, and duplicate subjects',()=>{
  for(const bad of [{sure:-1},{tarih:'2026-02-30'},{dersler:[{kod:'turkce',dogru:41,yanlis:0,soru:40}]},{dersler:[{kod:'mat',dogru:30,yanlis:0,soru:30},{kod:'geo',dogru:11,yanlis:0,soru:11}]}]){put('r',sample(bad));assert.throws(()=>run('denemeDogrula([r])'));}
 });
 await check('edits and deletion tombstones survive stale and repeated sync',()=>{
  put('a',[sample()]);put('b',[sample({sure:140,ts:101})]);
  assert.equal(run('denemeBirlestir(a,b)[0].sure'),140);assert.equal(run('denemeBirlestir(b,a).length'),1);
  put('b',[sample({silindi:true,ts:102})]);assert(run('denemeBirlestir(b,a)[0].silindi'));
  assert.equal(run('JSON.stringify(denemeBirlestir(a,b))'),run('JSON.stringify(denemeBirlestir(b,a))'));
 });
 await check('manual results and duration-only updates round-trip in v4 packet',()=>{
  put('records',[sample()]);run("D.ogr[0].denemeler=records;D.ogr[0].denemeSure=[{id:'p:school',sure:130,ts:100}];saved=sonucPaketi();delete saved.calisma;D.ogr[0].denemeler=[];D.ogr[0].denemeSure=[];D.rol='rehber';sonucPaketiUygula(saved,0)");
  assert.equal(run('saved.surum'),4);assert.equal(run('D.ogr[0].denemeler.length'),1);assert.equal(run('D.ogr[0].denemeSure[0].sure'),130);
  run('sonucPaketiUygula(saved,0)');assert.equal(run('D.ogr[0].denemeler.length'),1);
  run('saved.surum=3;delete saved.denemeler;delete saved.denemeSure;sonucPaketiUygula(saved,0)');assert.equal(run('D.ogr[0].denemeler.length'),1);
 });
 await check('student packet cannot forge teacher-imported scores; malformed packet is atomic',()=>{
  put('records',[sample({id:'p:forged'})]);run('saved=sonucPaketi();delete saved.calisma;saved.denemeler=records;before=JSON.stringify(D)');
  assert.throws(()=>run('sonucPaketiUygula(saved,0)'),/öğretmen/);assert.equal(run('JSON.stringify(D)'),run('before'));
 });
 await check('school results have their own channel; student can add time without editing scores',()=>{
  put('school',[sample({id:'p:one',sure:null})]);run('denemeOkulUygula(0,JSON.stringify(school));D.ogr[0].denemeSure=[{id:"p:one",sure:160,ts:101}];saved=sonucPaketi()');
  assert.equal(run('denemeListe()[0].sure'),160);assert.equal(run('saved.denemeler.length'),0);
  assert.equal(run('JSON.parse(saved.calisma.veri).ogr[0].denemeOkul'),undefined);
  assert.equal(run('paketiYukle(ogrenciPaketi(0)).ogr[0].denemeOkul.length'),1);
 });
 await check('strict matching never assigns a reused number or ambiguous student',()=>{
  assert.equal(run("denemeOgrenciEsle({no:1,ad:'Synthetic Ada'})"),0);
  assert.equal(run("denemeOgrenciEsle({no:1,ad:'Someone Else'})"),-1);
  run('D.ogr.push({...D.ogr[0]})');assert.equal(run("denemeOgrenciEsle({no:1,ad:'Synthetic Ada'})"),-1);
 });
 await check('same named TYT result in combined report is deselected even with different date',()=>{
  put('row',{no:1,ad:'Synthetic Ada',oturum:'TYT',puan:250,dersler:sample().dersler});
  run("reports=denemeImportHazirla([{ad:'Exam',tarih:'2026-09-25',satirlar:[{...row},{...row,oturum:'AYT',dersler:[{kod:'mat',dogru:1,yanlis:0,soru:null}]}]},{ad:'Exam',tarih:'2026-09-18',satirlar:[{...row}]}])");
  assert.equal(run('reports[0].satirlar[0].secili'),true);assert.equal(run('reports[1].satirlar[0].secili'),false);assert.equal(run('reports[1].satirlar[1].secili'),true);
 });
 await check('chart handles zero/negative nets and same-date exams, escapes labels',()=>{
  put('records',[sample({ad:'<img src=x onerror=alert(1)>',dersler:[{kod:'turkce',dogru:0,yanlis:4,soru:40}]}),sample({id:'m:two',dersler:[{kod:'turkce',dogru:0,yanlis:0,soru:40}]})]);
  const svg=run('denemeGrafik(records)');assert(!svg.includes('NaN'));assert(!svg.includes('<img'));assert(svg.includes('tabindex="0"'));
 });
 await check('PDF coordinates: pagination, wrapped name, absent vs zero AYT and negative nets',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8'));
  put('pages',fixture.combined);const report=run('denemePdfCoz(pages)');
  assert.equal(report.satirlar.length,5);assert.equal(report.satirlar.filter(x=>x.oturum==='AYT').length,2);
  assert.equal(report.satirlar.find(x=>x.no===3).ad,'SENTETİK UZUN SOYADI');
  assert.equal(report.satirlar[0].dersler[6].yanlis,1);
  put('pages',fixture.tyt);assert.equal(run('denemePdfCoz(pages).satirlar.length'),3);
  put('pages',[...fixture.combined,...fixture.combined]);assert.equal(run('denemePdfCoz(pages).satirlar.length'),10);
 });
 await check('PDF corruption and unexpected headers fail before assignment',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8'));
  const bad=structuredClone(fixture.tyt);bad[0].find(x=>x.s==='TAR').s='UNKNOWN';put('pages',bad);assert.throws(()=>run('denemePdfCoz(pages)'));
  const bad2=structuredClone(fixture.tyt);bad2[0].find(x=>x.s==='10/4').s='10/8';put('pages',bad2);assert.throws(()=>run('denemePdfCoz(pages)'),/uyuşmuyor/);
 });
 // Optional private local verification. PDFs and extracted student data are never committed.
 if(process.env.YKS_PDF_ITEMS){
  for(const name of ['tyt','combined','readiness'])await check('actual attached PDF '+name,()=>{
   put('pages',JSON.parse(fs.readFileSync(path.join(process.env.YKS_PDF_ITEMS,name+'.json'),'utf8')));
   const report=run('denemePdfCoz(pages)');
   for(const row of report.satirlar){put('row',row);put('report',report);run('denemePdfKaydi(report,row)');}
   const tyt=report.satirlar.filter(x=>x.oturum==='TYT'),ayt=report.satirlar.filter(x=>x.oturum==='AYT');
   assert.equal(tyt.length,29);assert.equal(ayt.length,name==='combined'?22:0);
   console.log('Verified rows: TYT',tyt.length,'AYT',ayt.length);
  });
 }
 console.log(passed+' mock-exam checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
