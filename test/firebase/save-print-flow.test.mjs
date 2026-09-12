// Actual app handlers + two Firebase clients + deployed-rule equivalent in the emulator.
// Authentication uses emulator identities; no production token exchange or private data is used.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, runTransaction, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));
const env = await initializeTestEnvironment({ projectId:'demo-yks-test',
  firestore:{ host:'127.0.0.1',port:8081,rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8') } });
const teacherUid='teacher-delivery', studentUid='student-delivery', slot='delivery-slot';
const teacherDb=env.authenticatedContext(teacherUid,{firebase:{sign_in_provider:'google.com'}}).firestore();
const studentDb=env.authenticatedContext(studentUid,{firebase:{sign_in_provider:'password'}}).firestore();
const apps=[];
const element=()=>({style:{},dataset:{},hidden:false,value:'',innerHTML:'',textContent:'',
  classList:{add(){},remove(){},contains(){return false;}},setAttribute(){},appendChild(){},remove(){},focus(){},
  getClientRects(){return [1];},closest(){return null;}});
function app(db,user) {
  const listeners={},store={},timers=new Set(),windowEvents={},messages=[];
  const nodes={ray:element(),ana:element(),stil:{textContent:''},veri:{textContent:'null'},uygulama:{textContent:source}};
  let rows=[];
  const s={console,JSON,Date,Math,Intl,TextEncoder,crypto:webcrypto,URL,URLSearchParams,Blob,
    location:{search:'?dev=1'},navigator:{onLine:true},fetch:async()=>({ok:false}),
    setTimeout(fn,ms){const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);return timer;},
    clearTimeout(timer){clearTimeout(timer);timers.delete(timer);},
    alert:m=>messages.push(m),confirm:()=>true,prompt:()=>'',
    localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    window:{scrollTo(){},open:()=>null,print(){},addEventListener(k,fn){(windowEvents[k] ||= []).push(fn);},
      bulut:{db,doc,getDoc,getDocFromServer,setDoc,updateDoc,runTransaction,onSnapshot,collection,getDocs,yapilandirilmis:true,
        mevcutKullanici:()=>user,girisOgretmen:async()=>user,girisOgrenci:async()=>user,girisOgrenciHesabi:async()=>user}},
    document:{activeElement:null,title:'YKS',visibilityState:'visible',
      addEventListener(k,fn){(listeners[k] ||= []).push(fn);},getElementById:id=>nodes[id]||null,
      querySelector:()=>null,querySelectorAll:q=>q==='[data-sonuc-row]'?rows:[],contains:()=>true,
      createElement:()=>element(),body:{appendChild(){},insertAdjacentHTML(){}}}
  };
  s.window.document=s.document;vm.createContext(s);vm.runInContext(source,s);
  const run=code=>vm.runInContext(code,s);
  run("D=varsayilan();D.rol=null;D.ayar.testTarih='2026-09-12';EK.ogr=0;EK.hafta=null;");
  // Keep actual cloud callbacks/handlers; avoid unrelated DOM rendering in this data-flow test.
  run('ciz=()=>rayCiz();');
  async function click(id) {
    const target=Object.assign(element(),{id,closest:sel=>sel.includes('#'+id)?target:null});
    for(const fn of listeners.click||[]) await fn({target});
    await run('KAYIT_ZINCIRI');
  }
  function result(ki,correct) {
    const numeric={hidden:false},correctEl={value:String(correct)},questions={value:'10'};
    rows=[{dataset:{ki:String(ki),gun:String(run('bugunNo()')),slot:String(ki),deferred:'0'},
      querySelector:q=>q==='.sonuc-sayisal'?numeric:q==='[data-sonuc-dogru]'?correctEl:q==='[data-sonuc-soru]'?questions:null}];
    run("EK.sekme='giris';EK.hafta=buHafta();");
  }
  const a={s,run,click,result,store,messages,close(){run('ogretmenDinlemeyiDurdur()');timers.forEach(clearTimeout);}};
  apps.push(a);return a;
}
async function eventually(fn,label) {
  const end=Date.now()+15000;
  while(Date.now()<end) { if(await fn()) return; await new Promise(resolve=>setTimeout(resolve,30)); }
  throw new Error(label+' timed out; '+apps.map(a=>a.run('JSON.stringify({student:EK.ogrSyncHata,teacher:EK.ogretmenSyncDurum,backup:EK.bulutYedekHata})')).join(' | '));
}
let passed=0;
function check(name,fn) { fn();passed++;console.log('PASS',name); }
try {
  await env.clearFirestore();
  const teacher=app(teacherDb,{uid:teacherUid,isAnonymous:false,email:'teacher@example.test'});
  teacher.run(`D.rol='rehber';D.kurum='Delivery School';D.ogr=[{no:42,ad:'Delivery Student',alan:'SAY',sube:'12A',
    kap:6,off:[6],syncId:'${slot}',ogrenciBulutId:'delivery-identity',hesapUid:'${studentUid}',aktif:true}];
    D.islenis={0:bugunNo()-3,1:bugunNo()-3};`);
  const packet=teacher.run('ogrenciPaketi(0)');
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'ogretmenler',teacherUid),{});
    await setDoc(doc(ctx.firestore(),'ogrenciHesaplari',studentUid),{veri:JSON.stringify(packet),syncId:slot,aktif:true,ts:Date.now(),surum:1});
    await setDoc(doc(ctx.firestore(),'ogrenciler',slot),{ogretmenUid:teacherUid,ogrenciNo:42,ogrenciAd:'Delivery Student',
      ogrenciSube:'12A',ogrenciBulutId:'delivery-identity',bagliUid:studentUid,paket:null,sunucuTs:null,durum:'aktif'});
  });
  teacher.run('ogretmenDinlemeyiBaslat()');
  const student=app(studentDb,{uid:studentUid,isAnonymous:false,email:'ogr-delivery@student.ykstekrar.app'});
  await student.run('ogrenciHesabindanYukle("Delivery Student",42)');
  student.run('anlatimTamam(0,1,bugunNo());');
  student.result(0,8);await student.click('sonucKaydet');
  const studentRef=doc(studentDb,'ogrenciler',slot),teacherRef=doc(teacherDb,'ogretmenYedek',teacherUid);
  await eventually(async()=>((await getDocFromServer(studentRef)).data()?.paket?.kayit?.length||0)===1,'result upload');
  await eventually(()=>teacher.run('D.log.length')===1,'automatic teacher receipt');
  await eventually(async()=>{const d=await getDocFromServer(teacherRef);return d.exists()&&JSON.parse(d.data().veri).log.length===1;},'teacher backup');
  check('result-click-reaches-student-slot-teacher-view-and-teacher-backup',()=>assert.equal(teacher.run('D.log[0][3]'),8));
  check('lesson-completion-reaches-teacher-without-a-result-row',()=>assert.equal(teacher.run('D.ogrIslenis[0][1]'),student.run('bugunNo()')));
  check('server-keeps-the-issued-week',()=>assert.ok(teacher.run("D.elle['0|'+buHafta()].sabit")));

  student.s.navigator.onLine=false;student.result(1,9);await student.click('sonucKaydet');
  check('offline-results-remain-in-local-storage',()=>assert.equal(JSON.parse(student.store.yks_veri).log.length,2));
  await student.run('ogrenciHesabindanYukle("Delivery Student",42)');
  check('relogin-keeps-unsent-local-work-and-a-recovery-copy',()=>{
    assert.equal(student.run('D.log.length'),2);assert.equal(JSON.parse(student.store.yks_ogrenci_kurtarma).log.length,2);
  });
  student.s.navigator.onLine=true;await student.run('ogrenciEsitlemeBosalt()');
  await eventually(()=>teacher.run('D.log.length')===2,'retry delivery');
  const reopened=app(studentDb,{uid:studentUid,isAnonymous:false,email:'ogr-delivery@student.ykstekrar.app'});
  await reopened.run('ogrenciHesabindanYukle("Delivery Student",42)');
  check('fresh-browser-recovers-results-issued-plan-and-completed-lesson',()=>{
    assert.equal(reopened.run('D.log.length'),2);assert.ok(reopened.run("D.elle['0|'+buHafta()].sabit"));
    assert.equal(reopened.run('D.ogrIslenis[0][1]'),student.run('bugunNo()'));
  });
  reopened.run('D.ogr[0].kap=3;');let prints=0;
  reopened.s.window.print=()=>{prints++;assert.equal(JSON.parse(reopened.store.yks_veri).ogr[0].kap,3);};
  await reopened.click('yazdirOnizle');
  await eventually(()=>teacher.run('D.ogr[0].kap')===3,'print-only work delivery');
  check('pdf-click-saves-before-print-and-reaches-teacher-without-new-results',()=>assert.equal(prints,1));
  teacher.run("D.kurum='Teacher print saved';");teacher.s.window.print=()=>{};
  await teacher.click('yazdir');
  await eventually(async()=>{const d=await getDocFromServer(teacherRef);return d.exists()&&JSON.parse(d.data().veri).kurum==='Teacher print saved';},'teacher print backup');
  check('teacher-print-also-flushes-the-complete-server-backup',()=>assert.equal(teacher.run('D.log.length'),2));
  console.log(`SAVE/PRINT DELIVERY: ${passed} checks passed`);
} finally {
  apps.forEach(a=>a.close());
  await env.cleanup();
}
