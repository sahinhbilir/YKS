'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync('index.html','utf8'),marker='<script id="uygulama">',start=html.indexOf(marker)+marker.length;
const source=html.slice(start,html.indexOf('// ---------------------------------------------------------------- başlangıç',start));
function app(role='rehber',options={}) {
  const events=[],store={other_app:'keep'},session={other_session:'keep'},cloud={},timers=new Set(),listeners={};
  const el=()=>({style:{},dataset:{},innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},remove(){},appendChild(){}});
  const nodes={ray:el(),ana:el(),veri:el(),cikisDurum:el()},shell=el();
  let user={uid:role==='ogrenci'?'student':'teacher',isAnonymous:false,email:role==='ogrenci'?'x@student.ykstekrar.app':'teacher@example.test'};
  const storage=(data,prefix)=>({get length(){return Object.keys(data).length;},key:i=>Object.keys(data)[i]??null,
    getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{events.push(prefix+':remove:'+k);if(options.removeFailure===k)throw Error('storage blocked');delete data[k];}});
  const snap=data=>({exists:()=>!!data,data:()=>structuredClone(data)});
  const b={yapilandirilmis:true,db:{},doc:(_db,...p)=>p.join('/'),mevcutKullanici:()=>user,oturumHazir:async()=>{},girisOgrenci:async()=>user,
    async runTransaction(_db,fn){events.push('write');if(options.writeFailure)throw Error('write rejected');const writes=[];
      await fn({get:async ref=>snap(cloud[ref]),set:(ref,data)=>writes.push([ref,data]),update:(ref,data)=>writes.push([ref,{...cloud[ref],...data}])});
      for(const [ref,data] of writes)cloud[ref]=JSON.parse(JSON.stringify(data));},
    setDoc:async(ref,data)=>{cloud[ref]=JSON.parse(JSON.stringify(data));},
    async getDocFromServer(ref){events.push('readback');if(options.readFailure)throw Error('read rejected');
      if(options.onRead)options.onRead(a);
      return snap(options.mismatch?{veri:'{}'}:cloud[ref]);},
    async oturumuKapat(){events.push('signout');if(options.signoutFailure)throw Error('auth rejected');user=null;}};
  const sandbox={console,JSON,Date,Math,Intl,TextEncoder,Blob,URL,URLSearchParams,crypto:webcrypto,
    location:{search:'?dev=1'},navigator:{onLine:true,locks:{request:async(_name,opts,fn)=>fn(opts.mode==='exclusive'&&options.otherTab?null:{})}},
    localStorage:storage(store,'local'),sessionStorage:storage(session,'session'),fetch:async()=>({ok:false}),alert(){},confirm:()=>true,
    setTimeout(fn,ms){const t=setTimeout(()=>{timers.delete(t);fn();},ms);t.unref();timers.add(t);return t;},clearTimeout(t){clearTimeout(t);timers.delete(t);},
    window:{bulut:b,scrollTo(){},addEventListener(){},location:{reload(){events.push('reload');}}},
    document:{activeElement:null,addEventListener(k,fn){(listeners[k]||=[]).push(fn);},getElementById:id=>nodes[id]||null,
      querySelector:q=>q==='.kabuk'?shell:null,querySelectorAll:()=>[],contains:()=>true,createElement:el,body:{...el(),insertAdjacentHTML(){}}}};
  sandbox.window.document=sandbox.document;vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const run=code=>vm.runInContext(code,sandbox);
  run(`D=varsayilan();D.rol='${role}';D.ayar.testTarih='2026-09-20';D.ogr=[{ad:'Example',no:42,sube:'12A',alan:'EA',kap:6,off:[],
    syncId:'slot',hesapUid:'student',ogrenciBulutId:'identity'}];D.islenis={};D.ogrIslenis={};D.log=[];D.kart={};D.elle={};D.konuPlani={};D.dersProgrami={};EK.sekme='plan';EK.ogr=0;EK.hafta=null;`);
  store.yks_veri=run('JSON.stringify(D)');store.yks_plan_kurtarma_oncesi='backup';session.yks_ek='screen';
  cloud['ogrenciler/slot']={bagliUid:'student',ogrenciBulutId:'identity',ogretmenUid:'teacher',ogrenciNo:42,ogrenciAd:'Example',ogrenciSube:'12A',durum:'aktif',paket:null};
  const a={run,sandbox,b,store,session,cloud,events,nodes,options,close(){timers.forEach(clearTimeout);},user:()=>user};return a;
}
const checks=[];
async function check(name,fn,role='rehber',options={}) {const a=app(role,options);try{await fn(a);checks.push(name);}finally{a.close();}}
const retained=a=>{assert(a.store.yks_veri);assert(a.run('D.ogr.length')===1);assert(!a.events.some(e=>e.startsWith('local:remove:')));};
(async()=>{
  for(const role of ['rehber','ogrenci'])await check(role+'-logout-verifies-server-before-clearing-only-app-data',async a=>{
    a.run("sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}]);hafizaSeviyesiniUygula(0,'guclu');");
    assert.equal(await a.run('kaydedipCikisYap()'),true,a.nodes.cikisDurum.innerHTML);
    const data=role==='rehber'?JSON.parse(a.cloud['ogretmenYedek/teacher'].veri):JSON.parse(a.cloud['ogrenciler/slot'].paket.calisma.veri);
    assert.equal(data.log.length,1);assert.equal(data.ogr[0].hafizaSeviyesi,'guclu');
    assert.equal(a.store.yks_veri,undefined);assert.equal(a.store.yks_plan_kurtarma_oncesi,undefined);assert.equal(a.session.yks_ek,undefined);
    assert.equal(a.store.other_app,'keep');assert.equal(a.session.other_session,'keep');assert.equal(a.user(),null);assert.equal(a.run('D.rol'),'');
    assert(a.events.indexOf('readback')<a.events.indexOf('signout'));assert(a.events.indexOf('signout')<a.events.indexOf('local:remove:yks_veri'));
    assert.equal(await a.run('kaydet(true)'),false);assert.equal(a.store.yks_veri,undefined);
  },role);
  for(const role of ['rehber','ogrenci'])for(const failure of ['writeFailure','readFailure','mismatch','signoutFailure'])
    await check(role+'-'+failure+'-keeps-local-data',async a=>{assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert.equal(a.run('CIKIS_DURUMU'),'');},role,{[failure]:true});
  await check('offline-logout-does-not-clear-or-sign-out',async a=>{a.sandbox.navigator.onLine=false;assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert(!a.events.includes('signout'));});
  await check('failed-save-can-be-retried',async a=>{assert.equal(await a.run('kaydedipCikisYap()'),false);a.options.writeFailure=false;assert.equal(await a.run('kaydedipCikisYap()'),true);},'rehber',{writeFailure:true});
  await check('timed-out-upload-keeps-device-and-auth-session',async a=>{
    a.run('originalTimeout=sureSinirli;sureSinirli=(p,ms,message)=>originalTimeout(p,25,message)');
    a.b.runTransaction=()=>new Promise(()=>{});const keepAlive=setTimeout(()=>{},1000);
    try{assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert(a.user());}finally{clearTimeout(keepAlive);}
  });
  await check('another-tab-prevents-storage-cleanup',async a=>{assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert(!a.events.includes('write'));},'rehber',{otherTab:true});
  await check('concurrent-logout-attempts-keep-the-shared-tab-lock',async a=>{
    a.sandbox.navigator.locks.query=async()=>({held:[{name:'yks-defter-oturumu'},{name:'yks-defter-oturumu'}]});
    assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert.equal(a.run("typeof CIKIS_SEKME_BIRAK"),'function');
  });
  await check('unsupported-locks-do-not-break-notebook-or-erase-data',async a=>{delete a.sandbox.navigator.locks;assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);});
  await check('anonymous-and-unlinked-accounts-cannot-erase-the-only-recoverable-copy',async a=>{a.user().isAnonymous=true;assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);},'ogrenci');
  await check('unlinked-file-student-keeps-data',async a=>{a.run('delete D.ogr[0].hesapUid');assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);},'ogrenci');
  await check('changes-during-server-verification-stop-logout',async a=>{assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert(!a.events.includes('signout'));},'rehber',{onRead:a=>a.run("D.kurum='new work'")});
  await check('an-older-in-flight-backup-is-followed-by-a-fresh-save',async a=>{
    let finish;a.sandbox.pending=new Promise(r=>{finish=r;});a.run('bulutYedekIsi=pending');const p=a.run('kaydedipCikisYap()');
    await new Promise(r=>setImmediate(r));assert(!a.events.includes('signout'));
    a.run("D.kurum='latest';bulutYedekIsi=null");finish({tur:'tamam'});assert.equal(await p,true);assert.equal(JSON.parse(a.cloud['ogretmenYedek/teacher'].veri).kurum,'latest');
  });
  await check('unfinished-photo-recovery-remains-visible-and-local',async a=>{
    a.run("EK.sekme='kurtarma';gecmisPlanDurumu().metin='unreviewed photo'");assert.equal(await a.run('kaydedipCikisYap()'),false);retained(a);assert(!a.events.includes('write'));
  });
  await check('storage-removal-failure-keeps-main-notebook',async a=>{
    assert.equal(await a.run('kaydedipCikisYap()'),false);assert(a.store.yks_veri);assert(!a.events.includes('local:remove:yks_veri'));
  },'rehber',{removeFailure:'yks_plan_kurtarma_oncesi'});
  await check('memory-level-is-optional-and-creates-no-results',a=>{
    assert.equal(a.run('parametreAl(0,0)'),null);assert.equal(a.run('ilkTekrarAraligi(0,0)'),a.run('D.ayar.ilk'));
    a.run("hafizaSeviyesiniUygula(0,'guclu')");assert.equal(a.run('ilkTekrarAraligi(0,0)'),7);assert.equal(a.run('D.log.length'),0);assert.equal(a.run('Object.keys(D.kart).length'),0);
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu')");assert.equal(a.run('ilkTekrarAraligi(0,0)'),14);
  });
  await check('strong-start-reduces-first-review-load',a=>{
    a.run("D.islenis[0]=buHafta(0)-7;hafizaSeviyesiniUygula(0,'guclu')");
    const item=a.run('planHesapla(0,buHafta(0)).gunler.flat().find(x=>x.ki===0)');assert(item);assert.equal(item.test,1);assert.equal(item.soru,a.run('D.ayar.soru'));
  });
  await check('actual-hard-and-failed-initial-results-override-confidence',a=>{
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu');sonucIsle(0,[{ki:0,gun:bugunNo(),not:1},{ki:1,gun:bugunNo(),not:2}])");
    assert.equal(a.run('D.kart["0:0"].due-bugunNo()'),a.run('D.ayar.relearn'));assert.equal(a.run('D.kart["0:1"].s'),a.run('W[1]'));
  });
  await check('confidence-adjusts-actual-easy-cards-without-rewriting-results-or-issued-weeks',a=>{
    a.run("D.islenis[0]=bugunNo()-3;haftayiSabitle(0,buHafta(0));sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}])");
    const logs=a.run('JSON.stringify(D.log)'),weeks=a.run('JSON.stringify(D.elle)'),normal=a.run('D.kart["0:0"].due');
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu')");assert(a.run('D.kart["0:0"].due')>normal);
    assert.equal(a.run('JSON.stringify(D.log)'),logs);assert.equal(a.run('JSON.stringify(D.elle)'),weeks);
    a.run("hafizaSeviyesiniUygula(0,'normal')");assert.equal(a.run('D.kart["0:0"].due'),normal);
  });
  await check('lesson-calibration-wins-over-self-reported-prior',a=>{
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu');D.par={0:{[dersAnahtari(0)]:W.slice()}};sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}])");assert.equal(a.run('D.kart["0:0"].s'),a.run('W[3]'));
  });
  await check('memory-choice-respects-maximum-spacing-and-exam-date',a=>{
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu');D.ayar.maks=5;D.ayar.sinav=isoDan(bugunNo()+3);sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}])");
    assert.equal(a.run('D.kart["0:0"].due-bugunNo()'),2);assert.equal(a.run('ilkTekrarAraligi(0,1)'),5);
    assert.equal(a.run('ilkTekrarAraligi(0,1,bugunNo())'),2);
  });
  await check('memory-confidence-does-not-delay-an-explicit-relearning-date',a=>{
    a.run("hafizaSeviyesiniUygula(0,'cok-guclu');D.konuAnlatilmadi=[{si:0,ki:0,gun:bugunNo(),ilkTekrarGunu:bugunNo()+3}]");
    assert.equal(a.run('ilkTekrarAraligi(0,0)'),a.run('D.ayar.ilk'));assert.equal(a.run('resetIlkTekrarGunu(0,0)'),a.run('bugunNo()+3'));
  });
  await check('invalid-memory-setting-and-other-student-edit-are-rejected',a=>{
    assert.equal(a.run("hafizaSeviyesiniUygula(0,'unlimited')"),false);a.run("D.ogr[0].hafizaSeviyesi='unlimited'");assert.throws(()=>a.run('yedekDogrula(D)'),/hafıza/);
    a.run("delete D.ogr[0].hafizaSeviyesi;D.rol='ogrenci';D.ogr.push({...D.ogr[0],no:43})");assert.equal(a.run("hafizaSeviyesiniUygula(1,'guclu')"),false);
  });
  await check('memory-choice-reaches-teacher-and-return-to-normal-syncs',a=>{
    a.run("sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}]);teacher=D;D=paketiYukle(ogrenciPaketi(0));hafizaSeviyesiniUygula(0,'guclu');work=ogrenciCalismaPaketi();work.ts=Date.now()+1000;D=teacher;ogrenciCalismasiniUygula(work,0)");
    assert.equal(a.run('D.ogr[0].hafizaSeviyesi'),'guclu');assert.equal(a.run('D.kart["0:0"].s'),14);
    a.run("D=paketiYukle(ogrenciPaketi(0));hafizaSeviyesiniUygula(0,'normal');work=ogrenciCalismaPaketi();work.ts=Date.now()+2000;D=teacher;ogrenciCalismasiniUygula(work,0)");
    assert.equal(a.run('D.ogr[0].hafizaSeviyesi'),'normal');assert.equal(a.run('D.kart["0:0"].s'),a.run('W[3]'));
  });
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
