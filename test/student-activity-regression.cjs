#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm');
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
const reset=()=>run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-25';
 D.ogr=[{no:1,ad:'Synthetic Ada',sube:'11-A',alan:'EA',sinif:11,kap:6,off:[6],aktif:true,
 ogrenciBulutId:'d70ec14d-ab10-43e5-b63f-0dd990c3626b'}];EK.ogr=0;EK.hafta=null;
 kaydet=async()=>true;ogrenciEsitlemePlanla=()=>{};`);
const checks=[];
function check(name,fn){try{reset();fn();checks.push({name,ok:true});}catch(e){checks.push({name,ok:false,error:e.stack});}}
check('repeated clicks count one named student in only the selected week',()=>{
 run(`etkinlikKaydet('acildi',buHafta());etkinlikKaydet('acildi',buHafta());D.rol='rehber';`);
 assert.equal(run('etkinlikSatirlari(pazartesi(bugunNo())).filter(r=>r.acildi).length'),1);
 assert.equal(run('etkinlikSatirlari(pazartesi(bugunNo())-7).filter(r=>r.acildi).length'),0);
 assert.match(run('gorunumEtkinlik()'),/Synthetic Ada/);
 assert.equal(run('D.ogr[0].etkinlik.kayit.length'),1);
});
check('next-week PDF keeps the source result week across reload and merge',()=>{
 run(`etkinlikKaydet('acildi',buHafta());etkinlikKaydet('kaydedildi',buHafta());D=JSON.parse(JSON.stringify(D));
 etkinlikKaydet('pdf',sonrakiHafta(0,buHafta()));D.rol='rehber';`);
 assert.equal(run('etkinlikSatirlari(pazartesi(bugunNo()))[0].pdf.hafta'),run('buHafta()+7'));
 assert.equal(run('etkinlikSatirlari(pazartesi(bugunNo()))[0].akis'),true);
 assert.equal(run('etkinlikSatirlari(pazartesi(bugunNo())+7)[0].pdf'),undefined);
});
check('unrelated PDF does not borrow a previous result week',()=>{
 run(`etkinlikKaydet('kaydedildi',buHafta()-14);etkinlikKaydet('pdf',buHafta());`);
 assert.equal(run("D.ogr[0].etkinlik.kayit.find(r=>r.tur==='pdf').sonucHafta"),run('buHafta()'));
});
check('teacher actions never create student events or Analytics calls',()=>{
 let events=0;sandbox.window.yksAnalitik=()=>events++;
 run(`D.rol='rehber';etkinlikKaydet('acildi',buHafta());etkinlikKaydet('kaydedildi',buHafta());etkinlikKaydet('pdf',buHafta());`);
 assert.equal(events,0);assert.equal(run('D.ogr[0].etkinlik'),undefined);
});
check('student events carry opaque identity and separate source and target weeks',()=>{
 const events=[];sandbox.window.yksAnalitik=(name,p)=>events.push({name,p});
 run(`etkinlikKaydet('acildi',buHafta());etkinlikKaydet('kaydedildi',buHafta());etkinlikKaydet('pdf',buHafta()+7);`);
 assert.deepEqual(events.map(x=>x.name),['student_results_opened','student_results_saved','student_pdf_requested']);
 assert.equal(events[2].p.report_week,'2026-09-21');assert.equal(events[2].p.plan_week,'2026-09-28');
 assert(!JSON.stringify(events).includes('Synthetic'));assert(!JSON.stringify(events).includes('11-A'));
});
check('cross-device merging is commutative, idempotent and preserves first/last times',()=>{
 const result=run(`(()=>{const e=(tur,ilk,son)=>({v:1,baslangic:10,kayit:[{tur,hafta:20717,sonucHafta:20717,ilk,son}]});
 const a=e('acildi',20,30),b=e('acildi',15,25),c=e('pdf',40,40);
 const m=etkinlikBirlestir(etkinlikBirlestir(a,b),c);
 return [JSON.stringify(m),JSON.stringify(etkinlikBirlestir(c,etkinlikBirlestir(b,a))),JSON.stringify(etkinlikBirlestir(m,m)),m.kayit.find(r=>r.tur==='acildi')];})()`);
 assert.equal(result[0],result[1]);assert.equal(result[0],result[2]);assert.equal(result[3].ilk,15);assert.equal(result[3].son,30);
});
check('activity-only result packet reaches teacher and stale packets cannot erase it',()=>{
 run(`etkinlikKaydet('acildi',buHafta());saved=sonucPaketi();delete saved.calisma;D.ogr[0].etkinlik=undefined;
 D.rol='rehber';sonucPaketiUygula(saved,0);old={...saved};delete old.etkinlik;sonucPaketiUygula(old,0);`);
 assert.equal(run('D.ogr[0].etkinlik.kayit.length'),1);assert.equal(run('D.log.length'),0);
 assert.equal(run('bulutSonucPaketiniYerellestir({paket:{...saved,kayit:[]}}).etkinlik.kayit.length'),1);
});
check('malformed activity rejects the whole result import atomically',()=>{
 run(`saved=sonucPaketi();delete saved.calisma;saved.etkinlik={v:1,baslangic:10,kayit:[{tur:'pdf',hafta:20700,sonucHafta:20720,ilk:20,son:20}]};before=JSON.stringify(D);`);
 assert.throws(()=>run('sonucPaketiUygula(saved,0)'),/etkinlik/);
 assert.equal(run('JSON.stringify(D)'),run('before'));
});
check('activity stays out of the duplicate working snapshot and survives backup restore',()=>{
 run(`etkinlikKaydet('pdf',buHafta());saved=sonucPaketi();`);
 assert.equal(run('JSON.parse(saved.calisma.veri).ogr[0].etkinlik'),undefined);
 assert.equal(run('JSON.parse(JSON.stringify(D)).ogr[0].etkinlik.kayit.length'),1);
 assert(run('yedekDogrula(D)'));
});
check('student cycle and roster identity control weekly grouping',()=>{
 run(`ogrenciHaftaGunuAyarla(2);D.ayar.testTarih='2026-09-30';etkinlikKaydet('acildi',buHafta());
 D.rol='rehber';D.ogr.push({...D.ogr[0]});D.ogr.push({...D.ogr[0],ogrenciBulutId:'different',ad:'Other Student',etkinlik:undefined,haftaDuzeni:undefined});`);
 assert.equal(run("etkinlikSatirlari(gunNo('2026-09-30')).length"),2);
 assert.equal(run("etkinlikSatirlari(gunNo('2026-09-30')).filter(r=>r.acildi).length"),1);
});
check('unknown activity is not reported as confirmed inactivity',()=>{
 run("D.rol='rehber';");const markup=run('gorunumEtkinlik()');
 assert.match(markup,/Kayıt ulaşmadı/);assert.match(markup,/Henüz etkinlik verisi yok/);assert.match(markup,/çevrimdışı/);
});
check('retention is bounded and newest observations survive',()=>{
 assert.equal(run(`(()=>{const e={v:1,baslangic:1,kayit:Array.from({length:600},(_,i)=>({tur:'acildi',hafta:20000+i,sonucHafta:20000+i,ilk:i+1,son:i+1}))};
 const b={v:1,baslangic:1,kayit:[{tur:'pdf',hafta:22000,sonucHafta:22000,ilk:999,son:999}]};const m=etkinlikBirlestir(e,b);return m.kayit.length===600 && m.kayit.some(r=>r.son===999);})()`),true);
});
console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,checks},null,2));
process.exitCode=checks.every(x=>x.ok)?0:1;
