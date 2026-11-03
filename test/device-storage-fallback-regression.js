'use strict';
// Device storage cannot be opened after migration: the app continues in memory mode against the cloud copy only.
const assert=require('node:assert/strict'),{app,gzKodla}=require('./logout-memory-regression.js');
async function scenario(name,fn){
 const a=app('rehber'),idb=[];
 const cloudJson=a.run('JSON.stringify(D)'),teacherJson=JSON.stringify({...JSON.parse(cloudJson),rol:'rehber'});
 a.cloud['ogretmenYedek/teacher']={veri:gzKodla(teacherJson),ts:1,surum:1,boyut:1};
 // Device state before the failed start: migration marker, a managed legacy value and an unrelated preference.
 a.store.yks_idb_migrated='1';a.sandbox.indexedDB={open(){idb.push('open');throw new Error('IndexedDB unavailable');},deleteDatabase(){idb.push('delete');throw new Error('must not delete');}};
 const device=()=>JSON.stringify(a.store),before=device();   // includes the cloud conflict base: memory mode keeps it in this session only
 try{
  await assert.rejects(a.run('LOCAL_STORE.ready()'));await a.run('LOCAL_STORE.gecici()');
  assert.equal(a.run('LOCAL_STORE.mode()'),'memory');
  a.run('D=null;veriyiHazirla(varsayilan());EK.sekme="ana"');
  assert.equal(a.run('D.rol'),'');assert.equal(a.run('D.ogr.length'),0,'fresh empty in-memory notebook');
  await fn(a,{before,idb,teacherJson,device});
 }finally{a.close();}
 console.log('PASS '+name);
}
(async()=>{
 await scenario('empty in-memory notebook never overwrites the cloud notebook',async(a,{before,idb,device})=>{
  const cloudBefore=JSON.stringify(a.cloud);
  a.run("D.rol='rehber'");   // e.g. teacher logged in without opening the cloud notebook
  const r=await a.run('bulutaYedekle()');
  assert.equal(r.tur,'hata',JSON.stringify(r));assert.equal(JSON.stringify(a.cloud),cloudBefore,'cloud notebook and history unchanged');
  const forced=await a.run('bulutaYedekle(JSON.stringify(D))');assert.equal(forced.tur,'hata','an empty notebook is not accepted even as an approved replacement of a different copy');assert.equal(JSON.stringify(a.cloud),cloudBefore);
  assert.equal(device(),before,'localStorage untouched');assert.deepEqual(idb.filter(x=>x!=='open'),[]);
 });
 await scenario('opening the cloud notebook works in memory mode and later backups proceed',async(a,{before,device})=>{
  const ok=await a.run('bulutDefteriniAc(window.bulut.mevcutKullanici())');
  assert.notEqual(ok,false);assert.equal(a.run('D.ogr.length'),1);assert.equal(a.run('D.rol'),'rehber');
  assert.equal(device(),before,'device storage untouched after opening the cloud notebook');
  a.run("D.kurum='Changed in memory mode'");const r=await a.run('bulutaYedekle()');assert.equal(r.tur,'tamam',JSON.stringify(r));
  assert(a.cloud['ogretmenYedek/teacher'].veri&&a.run('D.kurum')==='Changed in memory mode');
  assert.equal(device(),before,'the conflict base for the new cloud copy is not written to disk, so a later stale device copy cannot pass the conflict check');
 });
 await scenario('logout in memory mode leaves the device copy alone',async(a,{before,idb})=>{
  await a.run('bulutDefteriniAc(window.bulut.mevcutKullanici())');
  const r=await a.run('kaydedipCikisYap()');assert.equal(r,true,a.nodes.cikisDurum.innerHTML);
  assert.equal(a.store.yks_idb_migrated,'1','migration marker kept');assert.equal(a.store.yks_veri,JSON.parse(before).yks_veri,'managed localStorage value kept');assert.equal(a.store.other_app,'keep');
  assert(!a.events.some(e=>/^local:remove:yks_(veri|plan_kurtarma_oncesi|kazanim_plani_oncesi|program_yenile_oncesi|ogrenci_kurtarma|bulut_geri_alma_oncesi|bulut_geri_alma_hedefi|izleme_veri|idb_migrated)$/.test(e)),'no managed key removed');assert.deepEqual(idb.filter(x=>x!=='open'),[],'IndexedDB never deleted');
  assert.equal(idb.filter(x=>x==='open').length,1,'IndexedDB only attempted once, at startup');
 });
 console.log('PASS device-storage fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
