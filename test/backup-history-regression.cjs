'use strict';
const assert=require('node:assert/strict'),{app,gzCoz}=require('./logout-memory-regression.js');
const a=app(),{run,b,cloud}=a,reads=[],writes=[];let reject=false;
const clone=x=>JSON.parse(JSON.stringify(x)),snap=ref=>({exists:()=>!!cloud[ref],data:()=>clone(cloud[ref])});
b.runTransaction=async(_db,fn)=>{const staged=[];await fn({get:async ref=>{reads.push(ref);return snap(ref)},set:(ref,data)=>staged.push([ref,clone(data)])});if(reject)throw Error('atomic history/index rejection');staged.forEach(([ref,data])=>{writes.push(ref);cloud[ref]=data});};
b.getDocFromServer=async ref=>{reads.push(ref);return snap(ref)};b.getDoc=b.getDocFromServer;b.collection=(_db,...p)=>p.join('/');
b.getDocs=async path=>{reads.push('LIST '+path);return {forEach:fn=>Object.keys(cloud).filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).forEach(k=>fn({...snap(k),id:k.split('/').at(-1)}))}};
const root='ogretmenYedek/teacher',indexKey=root+'/gecmis/_v2-index',getIndex=()=>JSON.parse(cloud[indexKey].veri);
const backup=async()=>{const r=await run('bulutaYedekle()');assert.equal(r.tur,'tamam',JSON.stringify(r));return r};
(async()=>{
 run("__day='2026-09-14';bulutGercekGun=()=>__day;");await backup();assert.equal(writes.length,4);
 writes.length=0;run('D.ts=Date.now();D.rev=100');const noop=await backup();assert(noop.degismedi);assert.equal(writes.length,0,'semantic no-op must not write a primary, index or history');
 const legacy=clone(cloud[root]);cloud[root+'/gecmis/2025-10-01']={...legacy,ogrenciSayisi:1,sonucSayisi:0};cloud[root+'/geriNoktalari/legacy-point-12345']={...legacy,kaynak:'legacy'};
 for(let day=0;day<400;day++){a.sandbox.nextDay=new Date(Date.UTC(2026,8,14)+day*86400000).toISOString().slice(0,10);run("__day=nextDay;D.kurum='Changed '+nextDay");await backup();}
 for(let n=0;n<14;n++){const r=await run('geriYuklemeNoktasiOlustur("Operation test")');assert.equal(r.tur,'tamam',JSON.stringify(r));}
 const idx=getIndex();assert.equal(idx.entries.filter(e=>e.kind==='day').length,30);assert.equal(idx.entries.filter(e=>e.kind==='month').length,12);assert.equal(idx.entries.filter(e=>e.kind==='operation').length,10);assert.equal(idx.entries.filter(e=>e.kind==='start').length,1);
 assert.equal(Object.keys(cloud).filter(k=>k.startsWith(root+'/gecmis/_v2-')&&k!==indexKey).length,53,'payload footprint stays bounded');
 assert.deepEqual(cloud[root+'/gecmis/2025-10-01'],{...legacy,ogrenciSayisi:1,sonucSayisi:0});assert(cloud[root+'/geriNoktalari/legacy-point-12345']);
 reads.length=0;const days=await run('bulutYedekGecmisi()'),points=await run('bulutGeriYuklemeNoktalari()');assert.equal(days.liste.length,42);assert.equal(points.liste.length,11);assert(reads.every(k=>k===indexKey),'metadata listings fetch no full snapshots');
 a.sandbox.selectedId=days.liste[0].id;const selected=await run('buluttanGunAl(selectedId)');assert.equal(selected.tur,'tamam');assert.equal(selected.yedek.kurum,'Changed '+a.sandbox.nextDay);
 const oldPoint=points.liste.find(e=>e.kind==='operation');for(let n=0;n<11;n++)assert.equal((await run('geriYuklemeNoktasiOlustur("New operation")')).tur,'tamam');
 a.sandbox.staleId=oldPoint.id;assert.equal((await run('buluttanGeriYuklemeNoktasiAl(staleId)')).tur,'hata','overwritten slot must never resolve to a different snapshot');
 const current=getIndex().entries.find(e=>e.kind==='day');a.sandbox.currentId=run('BACKUP_HISTORY.token')(current);const payloadKey=root+'/gecmis/'+current.slot,original=clone(cloud[payloadKey]);cloud[payloadKey].ts++;
 assert.equal((await run('buluttanGunAl(currentId)')).tur,'hata');cloud[payloadKey]=original;
 cloud[payloadKey].veri=cloud[root].veri+' ';assert.equal((await run('buluttanGunAl(currentId)')).tur,'hata');cloud[payloadKey]=original;
 const before=JSON.stringify(cloud);reject=true;run("D.kurum='Rejected atomic update'");assert.equal((await run('bulutaYedekle()')).tur,'hata');assert.equal(JSON.stringify(cloud),before);reject=false;
 const savedIndex=clone(cloud[indexKey]);cloud[indexKey].veri='broken';const corruptBefore=JSON.stringify(cloud);assert.equal((await run('bulutaYedekle()')).tur,'hata');assert.equal(JSON.stringify(cloud),corruptBefore,'corrupt index must not be replaced with an empty index');cloud[indexKey]=savedIndex;
 const legacyDays=await run('bulutYedekGecmisi(true)');assert.equal(legacyDays.liste.length,1);assert.equal(legacyDays.liste[0].gun,'2025-10-01');assert.equal((await run('buluttanGunAl("2025-10-01")')).tur,'tamam');
 assert.equal((await run('bulutGeriYuklemeNoktalari(true)')).liste.length,1);assert.equal((await run('buluttanGeriYuklemeNoktasiAl("legacy-point-12345")')).tur,'tamam');
 assert.equal(JSON.parse(gzCoz(cloud[root].veri)).kurum,'Changed '+a.sandbox.nextDay);
 console.log('PASS bounded 53-slot history, unchanged zero writes, metadata reads, atomic rejection, corruption/stale detection and legacy recovery');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>a.close());
