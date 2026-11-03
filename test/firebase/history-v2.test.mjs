import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, runTransaction, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({projectId:'demo-yks-test',firestore:{rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8081}});
const token={firebase:{sign_in_provider:'google.com',identities:{}}};
const owner=env.authenticatedContext('owner',token).firestore();
const co=env.authenticatedContext('co',token).firestore();
const viewer=env.authenticatedContext('viewer',token).firestore();
const student=env.authenticatedContext('student',{firebase:{sign_in_provider:'password',identities:{}}}).firestore();
const anonymous=env.unauthenticatedContext().firestore();
const main=db=>doc(db,'ogretmenYedek','owner');
const hist=(db,id)=>doc(db,'ogretmenYedek','owner','gecmis',id);
const lock=db=>doc(db,'defterKilidi','owner');
const mainData=veri=>({veri,ts:1,surum:1,boyut:veri.length});
const slotData=veri=>({...mainData(veri),ogrenciSayisi:1,sonucSayisi:0});
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
try {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'ogretmenler','owner'),{});await setDoc(doc(db,'izleyiciler','co'),{sahipUid:'owner',yetki:'ortak'});await setDoc(doc(db,'izleyiciler','viewer'),{sahipUid:'owner'});});
 const atomic=async(db,value)=>runTransaction(db,async tx=>{const entry={kind:'day',slot:'_v2-d00',gun:'2026-11-03',ts:1,boyut:value.length,sha:createHash('sha256').update(value).digest('hex'),kaynak:'',ogrenciSayisi:1,sonucSayisi:0};const index=JSON.stringify({version:2,seq:1,entries:[entry]});await tx.get(main(db));tx.set(main(db),mainData(value));tx.set(hist(db,'_v2-d00'),slotData(value));tx.set(hist(db,'_v2-index'),slotData(index));});
 await check('owner writes primary, slot and index with own lock',async()=>{await assertSucceeds(setDoc(lock(owner),{uid:'owner',ad:'Owner',ts:serverTimestamp()}));await assertSucceeds(atomic(owner,'owner snapshot'));assert.equal((await getDoc(hist(owner,'_v2-d00'))).data().veri,'owner snapshot');});
 await check('other editor lock rejects co-teacher atomic write',async()=>{await assertFails(atomic(co,'blocked'));assert.equal((await getDoc(main(owner))).data().veri,'owner snapshot');});
 await check('co-teacher writes all three with own lock',async()=>{await assertSucceeds(deleteDoc(lock(owner)));await assertSucceeds(setDoc(lock(co),{uid:'co',ad:'Co',ts:serverTimestamp()}));await assertSucceeds(atomic(co,'co snapshot'));assert.equal((await getDoc(main(co))).data().veri,'co snapshot');});
 await check('owner cannot write while co-teacher holds lock',async()=>{await assertFails(atomic(owner,'blocked owner'));assert.equal((await getDoc(main(co))).data().veri,'co snapshot');});
 for(const [name,db] of [['student',student],['unauthenticated',anonymous],['viewer',viewer]]) await check(name+' cannot read, list or write history',async()=>{await assertFails(getDoc(hist(db,'_v2-d00')));await assertFails(getDocs(collection(db,'ogretmenYedek','owner','gecmis')));await assertFails(setDoc(hist(db,'_v2-r00'),slotData('forbidden')));});
 await check('rules reject extra fields and oversized slot/index',async()=>{for(const id of ['_v2-d01','_v2-index']){await assertFails(setDoc(hist(co,id),{...slotData('valid'),extra:true}));await assertFails(setDoc(hist(co,id),slotData('x'.repeat(900001))));}});
 await check('invalid slot in atomic batch preserves primary and index',async()=>{const beforeMain=(await getDoc(main(co))).data();const beforeIndex=(await getDoc(hist(co,'_v2-index'))).data();const batch=writeBatch(co);batch.set(main(co),mainData('must not commit'));batch.set(hist(co,'_v2-index'),slotData('changed'));batch.set(hist(co,'_v2-d01'),{...slotData('invalid'),extra:true});await assertFails(batch.commit());assert.deepEqual((await getDoc(main(co))).data(),beforeMain);assert.deepEqual((await getDoc(hist(co,'_v2-index'))).data(),beforeIndex);assert.equal((await getDoc(hist(co,'_v2-d01'))).exists(),false);});
 console.log('HISTORY V2 RULES:',checks,'checks passed');
} finally {await env.cleanup();}
