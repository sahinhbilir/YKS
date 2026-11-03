// Durable notebook and recovery copies; small UI preferences remain in localStorage.
const LOCAL_STORE=(()=>{
 'use strict';
 const keys=['yks_veri','yks_plan_kurtarma_oncesi','yks_kazanim_plani_oncesi','yks_program_yenile_oncesi','yks_ogrenci_kurtarma','yks_bulut_geri_alma_oncesi','yks_bulut_geri_alma_hedefi','yks_izleme_veri'];
 const allowed=new Set(keys),recovery=new Set(keys.filter(k=>k!=='yks_veri')),cache=new Map();let db=null,opening=null,mode='pending',chain=Promise.resolve();
 const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Cihaz depolaması okunamadı.'));});
 const done=t=>new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error||new Error('Cihaz depolaması yazılamadı.'));});
 const check=k=>{if(!allowed.has(k))throw new Error('Geçersiz cihaz kayıt anahtarı.');};
 async function read(k){const tx=db.transaction('records','readonly'),v=await request(tx.objectStore('records').get(k));return v===undefined?null:v;}
 async function initialize(){
  // The teacher's student-preview iframe is a temporary sandbox, even though its
  // srcdoc inherits the site's origin. It must never open the parent's database.
  if(typeof ONIZLEME_MODU!=='undefined'&&ONIZLEME_MODU){mode='memory';return;}
  if(typeof indexedDB==='undefined'){let migrated=false;try{migrated=localStorage.getItem('yks_idb_migrated')==='1'}catch(_){}if(migrated)throw new Error('Cihazdaki IndexedDB açılamadı; kayıtlı defter korunuyor.');mode='localStorage';return;}
  try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yks-local-store',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('records'))r.result.createObjectStore('records')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Cihaz depolaması başka sekmede açık.'));});}
  catch(e){let migrated=false;try{migrated=localStorage.getItem('yks_idb_migrated')==='1'}catch(_){}if(migrated)throw new Error('Cihazdaki IndexedDB açılamadı; kayıtlı defter korunuyor.');mode='localStorage';return;}
  try{
   let previouslyMigrated=false;try{previouslyMigrated=localStorage.getItem('yks_idb_migrated')==='1'}catch(_){}
   if(previouslyMigrated&&await read('__schema__')!=='1')throw new Error('Cihazdaki IndexedDB kaydı eksik; otomatik boş başlangıç durduruldu.');
   const existing=new Map();for(const k of keys)existing.set(k,await read(k));
   // Marked IDB copies win; before marking, legacy values remain authoritative.
   const migrate=[];for(const k of keys){let v=null;try{v=localStorage.getItem(k)}catch(_){}if(!previouslyMigrated&&v!==null)migrate.push([k,v]);}
   if(migrate.length){const tx=db.transaction('records','readwrite'),s=tx.objectStore('records');for(const [k,v] of migrate)s.put(v,k);await done(tx);for(const [k,v] of migrate)if(await read(k)!==v)throw new Error('Cihaz kopyası doğrulanamadı.');}
   for(const k of keys){const v=await read(k);if(v!==null)cache.set(k,v);}
   // A durable marker prevents silently opening an empty fallback if IDB later fails.
   {const tx=db.transaction('records','readwrite');tx.objectStore('records').put('1','__schema__');await done(tx);if(await read('__schema__')!=='1')throw new Error('Cihaz depolaması doğrulanamadı.');}
   let marked=previouslyMigrated;if(!marked)try{localStorage.setItem('yks_idb_migrated','1');marked=localStorage.getItem('yks_idb_migrated')==='1'}catch(_){}
   // Without a durable marker, future startups cannot distinguish a current IDB copy
   // from an interrupted migration, so keep using the authoritative legacy store.
   if(!marked){db.close();db=null;cache.clear();mode='localStorage';return;}
   // Remove only verified identical copies after marking; leave any changed source.
   for(const [k,v] of migrate)try{if(cache.get(k)===v&&localStorage.getItem(k)===v)localStorage.removeItem(k)}catch(_){}
   mode='indexedDB';
  }catch(e){try{db.close()}catch(_){}db=null;cache.clear();throw e;}
 }
 function ready(){return opening||(opening=typeof ONIZLEME_MODU!=='undefined'&&ONIZLEME_MODU?initialize():typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request('yks-local-migration',{mode:'exclusive'},initialize):initialize());}
 function identity(data,k,legacy){
  try {
   if(k==='yks_izleme_veri') {const v=JSON.parse(localStorage.getItem('yks_izleme')||'null');return v?.sahipUid&&v?.izleyiciUid?'viewer:'+v.izleyiciUid+':'+v.sahipUid:null;}
   if(!data||typeof data!=='object')return null;
   if(data.testHesap?.uid)return 'test:'+data.testHesap.uid;
   if(data.rol==='ogrenci'&&data.ogr?.[0]?.ogrenciBulutId)return 'student:'+data.ogr[0].ogrenciBulutId;
   if(data.rol==='rehber'&&!legacy){const u=window.bulut?.mevcutKullanici?.();if(u&&!u.isAnonymous&&u.uid){const owner=typeof defterUid==='function'?defterUid(u):u.uid;return owner?'teacher:'+owner:null;}}
  }catch(_){}return null;
 }
 function value(k,v){if(v===null)return null;let owner=null,raw=v;if(typeof v==='string'){if(recovery.has(k))try{const parsed=JSON.parse(v);if(parsed?.format==='yks-local-envelope-v1'&&typeof parsed.value==='string'){owner=parsed.owner;raw=parsed.value}else owner=identity(parsed,k,true)}catch(_){}}else{if(!v||v.schema!==1||typeof v.value!=='string')throw new Error('Cihaz kaydı biçimi geçersiz.');owner=v.owner;raw=v.value;}let current=null;try{current=identity(typeof D==='undefined'?null:D,k)}catch(_){}return owner&&current&&owner!==current?null:raw;}
 function getSync(k){check(k);if(mode==='indexedDB'||mode==='memory')return value(k,cache.has(k)?cache.get(k):null);return value(k,localStorage.getItem(k));}
 async function get(k){check(k);await ready();await chain;if(mode!=='indexedDB')return getSync(k);const v=await read(k);if(v===null)cache.delete(k);else cache.set(k,v);return value(k,v);}
 function serialize(fn){const p=chain.then(fn,fn);chain=p.catch(()=>{});return p;}
 function set(k,v,ownerOverride,guard){check(k);if(typeof v!=='string')throw new Error('Cihaz kaydı metin olmalı.');let owner=ownerOverride||null;if(recovery.has(k)&&!owner){try{owner=identity(JSON.parse(v),k)}catch(_){}}const record=recovery.has(k)?{format:'yks-local-envelope-v1',schema:1,owner:owner||null,value:v}:v;return serialize(async()=>{await ready();if(guard&&!guard())throw new Error('Defter değişti; kayıt durduruldu.');if(mode==='memory'){cache.set(k,record);return;}if(mode!=='indexedDB'){const stored=recovery.has(k)?JSON.stringify(record):v;localStorage.setItem(k,stored);if(localStorage.getItem(k)!==stored)throw new Error('Cihaz kaydı doğrulanamadı.');return;}const tx=db.transaction('records','readwrite'),put=tx.objectStore('records').put(record,k);if(guard)put.onsuccess=()=>{if(!guard())tx.abort()};await done(tx);const saved=await read(k);if(JSON.stringify(saved)!==JSON.stringify(record))throw new Error('Cihaz kaydı doğrulanamadı.');cache.set(k,record);});}
 function remove(k){check(k);return serialize(async()=>{await ready();if(mode==='memory'){cache.delete(k);return;}if(mode!=='indexedDB'){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('Cihaz kaydı silinemedi.');return;}const tx=db.transaction('records','readwrite');tx.objectStore('records').delete(k);await done(tx);if(await read(k)!==null)throw new Error('Cihaz kaydı silinemedi.');cache.delete(k);});}
 function clear(){return serialize(async()=>{await ready();if(mode==='memory'){cache.clear();return;}if(mode!=='indexedDB'){
  // An interrupted migration can leave an unmarked IDB copy even while legacy is authoritative.
  // Delete it before local data so a failed cleanup cannot report success or lose the only copy.
  if(typeof indexedDB!=='undefined'){
   const orphan=await new Promise((resolve,reject)=>{const r=indexedDB.open('yks-local-store',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('records'))r.result.createObjectStore('records')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Cihaz depolaması temizlenemedi.'));r.onblocked=()=>reject(new Error('Cihaz depolaması başka sekmede açık.'));});
   try{const tx=orphan.transaction('records','readwrite'),s=tx.objectStore('records');for(const k of keys)s.delete(k);await done(tx);for(const k of keys){const t=orphan.transaction('records','readonly');if(await request(t.objectStore('records').get(k))!==undefined)throw new Error('Cihaz kaydı silinemedi.');}}finally{orphan.close();}
  }
  for(const k of [...keys.filter(k=>k!=='yks_veri'),'yks_veri']){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('Cihaz kaydı silinemedi.');}return;}
  // Legacy copies can remain after an interrupted cleanup. Remove them before the
  // atomic IDB delete, so a legacy failure keeps the authoritative IDB intact.
  for(const k of [...keys.filter(k=>k!=='yks_veri'),'yks_veri']){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('Cihaz kaydı silinemedi.');}
  const tx=db.transaction('records','readwrite'),s=tx.objectStore('records');for(const k of keys)s.delete(k);await done(tx);for(const k of keys)if(await read(k)!==null)throw new Error('Cihaz kaydı silinemedi.');cache.clear();});}
 return {ready,get,getSync,set,remove,clear,isManaged:k=>allowed.has(k),mode:()=>mode};
})();
