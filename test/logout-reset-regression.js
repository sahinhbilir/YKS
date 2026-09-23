'use strict';
const assert=require('node:assert/strict');
const {app}=require('./logout-memory-regression.js');
const checks=[];
async function check(name,fn,role='rehber',options={}) {
  const a=app(role,options);try{await fn(a);checks.push(name);}finally{a.close();}
}
const raw=a=>a.run('JSON.stringify(D)');
async function seed(a) {
  a.run("D.kurum='previous';sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}]);");
  a.sandbox.past=JSON.parse(raw(a));
  a.run("D.kurum='today';sonucIsle(0,[{ki:1,gun:bugunNo(),not:2}]);");
  const current=raw(a);
  a.cloud['ogretmenYedek/teacher']={veri:current,ts:Date.now(),surum:10,boyut:current.length};
  await a.run('bulutYedekTemeliniHatirla("teacher",JSON.stringify(D))');
  a.sandbox.selection={uid:'teacher',mevcut:current};
  return current;
}
const restore=a=>a.run('bulutSurumuneDon(past,"previous",selection)');
(async()=>{
  for(const role of ['rehber','ogrenci'])await check(role+'-logout-finishes-hidden-week-editor',async a=>{
    a.run("D.islenis[0]=buHafta(0);duzenlemeBaslat(0,buHafta(0)+7);EK.sekme='ayarlar';");
    const key=a.run('"0|"+(buHafta(0)+7)');
    assert.equal(await a.run('kaydedipCikisYap()'),true,a.nodes.cikisDurum.innerHTML);
    const saved=JSON.parse(role==='rehber'?a.cloud['ogretmenYedek/teacher'].veri:a.cloud['ogrenciler/slot'].paket.calisma.veri);
    assert.equal(saved.duzenleHafta,undefined);assert(saved.elle[key].plan);assert(saved.elle[key].sabit);
  },role);
  await check('read-only-preview-and-empty-picker-do-not-block-logout',async a=>{
    a.run("DISARI_AKTAR={baslik:'preview'};PENCERE={g:0,s:0};");
    assert.equal(await a.run('kaydedipCikisYap()'),true,a.nodes.cikisDurum.innerHTML);
  });
  await check('typed-free-work-is-not-lost',async a=>{
    a.nodes.pSerbestAd={value:'Karışık paragraf'};a.run('PENCERE={g:0,s:0}');
    assert.equal(await a.run('kaydedipCikisYap()'),false);assert.match(a.nodes.cikisDurum.innerHTML,/Ekle/);assert(a.store.yks_veri);
  });
  await check('failed-upload-retains-finalized-week-on-device',async a=>{
    a.run('duzenlemeBaslat(0,buHafta(0)+7)');
    assert.equal(await a.run('kaydedipCikisYap()'),false);
    const saved=JSON.parse(a.store.yks_veri);assert.equal(saved.duzenleHafta,undefined);assert(Object.values(saved.elle).some(x=>x.plan));
  },'rehber',{writeFailure:true});
  for(const role of ['rehber','ogrenci'])await check(role+'-browser-reset-clears-only-local-without-upload-even-offline',async a=>{
    a.sandbox.navigator.onLine=false;const cloud=JSON.stringify(a.cloud);
    assert.equal(await a.run('tarayiciVerileriniSifirla()'),true);
    assert.equal(JSON.stringify(a.cloud),cloud);assert(!a.events.includes('write'));
    assert.equal(a.store.yks_veri,undefined);assert.equal(a.store.other_app,'keep');assert.equal(a.user(),null);
    assert(a.events.indexOf('signout')<a.events.indexOf('local:remove:yks_veri'));
  },role);
  for(const options of [{otherTab:true},{signoutFailure:true},{removeFailure:'yks_plan_kurtarma_oncesi'}])
    await check('failed-browser-reset-retains-notebook-'+JSON.stringify(options),async a=>{
      assert.equal(await a.run('tarayiciVerileriniSifirla()'),false);assert(a.store.yks_veri);assert(!a.events.includes('write'));
    },'rehber',options);
  await check('browser-reset-waits-for-already-running-save',async a=>{
    let finish;a.sandbox.pending=new Promise(r=>{finish=r;});a.run('KAYIT_ZINCIRI=pending');
    const p=a.run('tarayiciVerileriniSifirla()');await new Promise(r=>setImmediate(r));
    assert(a.store.yks_veri);assert(!a.events.includes('signout'));finish(true);assert.equal(await p,true);
  });
  await check('day-start-keeps-original-cloud-copy-across-multiple-saves',async a=>{
    const before=await seed(a);a.run("D.kurum='save one'");assert.equal((await a.run('bulutaYedekle()')).tur,'tamam');
    const ref='ogretmenYedek/teacher/geriNoktalari/'+a.run('bulutGunBaslangiciKimligi()');assert.equal(a.cloud[ref].veri,before);
    a.run("D.kurum='save two'");assert.equal((await a.run('bulutaYedekle()')).tur,'tamam');assert.equal(a.cloud[ref].veri,before);
    assert.equal(JSON.parse(a.cloud['ogretmenYedek/teacher'].veri).kurum,'save two');
  });
  await check('day-start-protection-failure-prevents-main-overwrite',async a=>{
    const before=await seed(a);a.run("D.kurum='new'");
    a.b.runTransaction=async(_db,fn)=>{const writes=[];await fn({get:async ref=>({exists:()=>!!a.cloud[ref],data:()=>a.cloud[ref]}),set:(ref,data)=>writes.push({ref,data})});
      if(writes.some(x=>x.ref.includes('gun-baslangici')))throw Error('archive denied');throw Error('expected day-start protection');};
    assert.equal((await a.run('bulutaYedekle()')).tur,'hata');assert.equal(a.cloud['ogretmenYedek/teacher'].veri,before);
  });
  await check('cloud-rollback-restores-both-copies-and-archives-exact-previous-states',async a=>{
    const before=await seed(a);a.run("D.kurum='unsent local'");const local=raw(a);
    assert.equal(await restore(a),true,a.nodes.cikisDurum.innerHTML);
    const restored=JSON.parse(a.cloud['ogretmenYedek/teacher'].veri);
    assert.equal(restored.kurum,'previous');assert.equal(restored.log.length,1);assert(restored.bulutGeriAlma);
    assert.equal(JSON.parse(a.store.yks_veri).kurum,'previous');
    const history=Object.entries(a.cloud).filter(([ref])=>ref.includes('/geriNoktalari/')).map(([,x])=>x.veri);
    assert(history.includes(local));assert(history.includes(before));assert.equal(a.store.yks_bulut_geri_alma_oncesi,local);
    assert(a.events.includes('readback'));assert(!a.events.includes('signout'));
    let subscribed=0;a.b.onSnapshot=()=>{subscribed++;return()=>{};};a.run('ogretmenDinlemeyiBaslat(true)');assert.equal(subscribed,0);
    a.run('veriyiHazirla(JSON.parse(localStorage.getItem("yks_veri")))');a.run('ogretmenDinlemeyiBaslat(true)');assert.equal(subscribed,0);
  });
  await check('rollback-itself-can-be-undone-from-protected-copy',async a=>{
    const before=await seed(a);assert.equal(await restore(a),true);
    a.sandbox.past=JSON.parse(before);a.sandbox.selection={uid:'teacher',mevcut:a.cloud['ogretmenYedek/teacher'].veri};
    assert.equal(await restore(a),true);assert.equal(a.run('D.kurum'),'today');assert.equal(a.run('D.log.length'),2);
  });
  for(const failure of ['writeFailure','readFailure','mismatch'])await check('rollback-'+failure+'-retains-local-state',async a=>{
    const before=await seed(a);assert.equal(await restore(a),false);assert.equal(raw(a),before);assert.equal(a.run('CIKIS_DURUMU'),'');
    assert(a.store.yks_bulut_geri_alma_oncesi);assert.equal(a.run('bulutYedekTemelleri.teacher'),undefined);
    if(failure==='writeFailure')assert.equal(a.cloud['ogretmenYedek/teacher'].veri,before);
  },'rehber',{[failure]:true});
  await check('stale-selection-does-not-overwrite-other-device',async a=>{
    const before=await seed(a);a.cloud['ogretmenYedek/teacher'].veri=JSON.stringify({...JSON.parse(before),kurum:'other device'});
    assert.equal(await restore(a),false);assert.equal(JSON.parse(a.cloud['ogretmenYedek/teacher'].veri).kurum,'other device');assert.equal(raw(a),before);
  });
  await check('local-backup-quota-failure-makes-no-cloud-change',async a=>{
    const before=await seed(a),set=a.sandbox.localStorage.setItem;
    a.sandbox.localStorage.setItem=(k,v)=>{if(k==='yks_bulut_geri_alma_hedefi')throw Error('quota');return set(k,v);};
    assert.equal(await restore(a),false);assert.equal(a.cloud['ogretmenYedek/teacher'].veri,before);assert(!a.events.includes('write'));
  });
  await check('offline-rollback-keeps-both-copies',async a=>{
    const before=await seed(a);a.sandbox.navigator.onLine=false;
    assert.equal(await restore(a),false);assert.equal(a.cloud['ogretmenYedek/teacher'].veri,before);assert.equal(raw(a),before);
  });
  await check('another-tab-prevents-rollback',async a=>{
    const before=await seed(a);assert.equal(await restore(a),false);assert.equal(raw(a),before);assert(!a.events.includes('write'));
  },'rehber',{otherTab:true});
  await check('student-cannot-replace-teacher-cloud-notebook',async a=>{
    a.sandbox.past=JSON.parse(raw(a));a.sandbox.selection={uid:'student',mevcut:raw(a)};
    await assert.rejects(()=>restore(a),/Öğretmen/);assert(!a.events.includes('write'));
  },'ogrenci');
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
