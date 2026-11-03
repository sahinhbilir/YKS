'use strict';
// Diagnostic only: actual app backup handlers against an instrumented in-memory transport.
// Counts SDK document operations; NOT a billing emulator (rules reads/retries/listeners excluded).
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const prefix=fs.readFileSync('test/cloud-sync-resilience.js','utf8').split('// ---------------------------------------------------------------- test koşucusu')[0].replace(/^#![^\n]*\n/,'');
const {loadAppSandbox}=new Function('require','process',prefix+'\nreturn {loadAppSandbox};')(require,{argv:[]});
const {run,sandbox}=loadAppSandbox(),docs=new Map(),events=[];
const clone=x=>JSON.parse(JSON.stringify(x));
const snapshot=ref=>({exists:()=>docs.has(ref),data:()=>clone(docs.get(ref)),id:ref.split('/').at(-1)});
const read=ref=>{events.push({kind:'read',ref,bytes:Buffer.byteLength(JSON.stringify(docs.get(ref)||{}))});return snapshot(ref)};
const write=(ref,data)=>{events.push({kind:'write',ref,bytes:Buffer.byteLength(JSON.stringify(data))});docs.set(ref,clone(data))};
sandbox.window.bulut={db:{},yapilandirilmis:true,mevcutKullanici:()=>({uid:'capacity-audit',isAnonymous:false}),
 doc:(_db,...parts)=>parts.join('/'),collection:(_db,...parts)=>parts.join('/'),
 runTransaction:async(_db,fn)=>{const pending=[];await fn({get:async ref=>read(ref),set:(ref,data)=>pending.push([ref,data])});pending.forEach(([ref,data])=>write(ref,data))},
 setDoc:async(ref,data)=>write(ref,data),
 getDocFromServer:async ref=>read(ref),
 getDocs:async collection=>{const all=[...docs.keys()].filter(ref=>ref.startsWith(collection+'/')&&!ref.slice(collection.length+1).includes('/')).map(read);return {forEach:fn=>all.forEach(fn)}}};
run("D=varsayilan();D.rol='rehber';D.kurum='Capacity Audit';D.ayar.testTarih='2026-11-02';D.ogr=[{no:1,ad:'SENTETİK KAPASİTE',sube:'12/A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true}];__day='2026-11-02';bulutGercekGun=()=>__day;yedekDogrula(D)");
(async()=>{
 const rows=[];
 for(const [name,change] of [['initial',''],['unchanged',''],['changed-first-of-day',"D.kurum='Capacity Audit Changed'"],['changed-again',"D.kurum='Capacity Audit Again'"],['next-day',"__day='2026-11-03';D.ayar.testTarih=__day;D.kurum='Capacity Audit Next Day'"]]){
  if(change)run(change);events.length=0;const result=await run('bulutaYedekle()');assert.equal(result.tur,'tamam',JSON.stringify(result));
  rows.push({name,reads:events.filter(e=>e.kind==='read').length,writes:events.filter(e=>e.kind==='write').length,readPayloadBytes:events.filter(e=>e.kind==='read').reduce((n,e)=>n+e.bytes,0)});
 }
 assert.deepEqual(rows.map(r=>[r.reads,r.writes]),[[2,4],[1,0],[2,5],[2,4],[2,5]]);
 events.length=0;const list=await run('bulutYedekGecmisi()');assert.equal(list.tur,'tamam');
 const historyListing={documents:events.length,entries:list.liste.length,payloadBytes:events.reduce((n,e)=>n+e.bytes,0),downloadsFullSnapshots:false};
 assert.equal(historyListing.documents,1);assert.equal(historyListing.entries,3);
 let projectedSnapshotBackup=null;const si=process.argv.indexOf('--snapshot');
 if(si>=0){
  const json=fs.readFileSync(process.argv[si+1],'utf8');sandbox.__snapshot=json;
  run('D=JSON.parse(__snapshot);yedekDogrula(D)');events.length=0;
  const outcome=await run('bulutaYedekle()');assert.equal(outcome.tur,'tamam',JSON.stringify(outcome));
  const saved=docs.get('ogretmenYedek/capacity-audit');sandbox.__saved=saved.veri;
  assert.equal(await run('bulutVeriCoz(__saved)'),json);
  projectedSnapshotBackup={rawBytes:Buffer.byteLength(json),storedBytes:Buffer.byteLength(saved.veri),result:outcome.tur,roundTrip:true,
   caveat:'Synthetic projection: backup codec/size guard passes against mock transport, not a production Firebase write.'};
 }
 const result={sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),transport:'instrumented in-memory; not production, not a Firebase billing emulator',rows,historyListing,
  retainedDocuments:docs.size,projectedSnapshotBackup,limits:{rawNotebookBytes:run('DEFTER_HAM_UST_SINIR'),storedSnapshotBytes:run('BULUT_YEDEK_UST_SINIR')},
  caveats:['SDK document operations only; security-rule dependent reads, listener delivery, reconnects and transaction retries add usage.','Firestore free quotas are not enforced by this transport or by the local emulator.']};
 const oi=process.argv.indexOf('--out');if(oi>=0)fs.writeFileSync(process.argv[oi+1],JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
