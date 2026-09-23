const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-logout-'));fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const role of ['rehber','ogrenci']){
   const context=await browser.newContext({viewport:role==='ogrenci'?{width:390,height:844}:{width:1280,height:950}});
   const errors=[],records=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
   await context.route('**/*',route=>route.request().url().startsWith('http://localhost/')?
     route.fulfill({status:route.request().url().includes('/data/')?404:200,contentType:'text/html',body:html}):route.abort());
   await page.exposeFunction('__record',x=>records.push(x));
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   await page.evaluate(role=>{
     D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-20';D.ogr=[{ad:'Example Student',no:42,sube:'12A',alan:'EA',kap:6,off:[],syncId:'slot',hesapUid:'student',ogrenciBulutId:'identity'}];
     D.islenis={};D.ogrIslenis={};D.log=[];D.kart={};D.elle={};D.konuPlani={};D.dersProgrami={};
     sonucIsle(0,[{ki:0,gun:bugunNo(),not:4}]);if(role==='ogrenci')D=paketiYukle(ogrenciPaketi(0));
     EK.ogr=0;EK.sekme=role==='ogrenci'?'ayarlar':'ogrenciler';EK.hafta=null;ciz();
     localStorage.setItem('yks_veri',JSON.stringify(D));localStorage.setItem('yks_plan_kurtarma_oncesi','backup');localStorage.setItem('other-app','keep');
     window.__cloud={'ogrenciler/slot':{bagliUid:'student',ogrenciBulutId:'identity',ogretmenUid:'teacher',ogrenciNo:42,ogrenciAd:'Example Student',ogrenciSube:'12A',durum:'aktif',paket:null}};
     let user={uid:role==='ogrenci'?'student':'teacher',isAnonymous:false,email:role==='ogrenci'?'x@student.ykstekrar.app':'teacher@example.test'};
     const snap=x=>({exists:()=>!!x,data:()=>structuredClone(x)});
     window.bulut={yapilandirilmis:true,db:{},doc:(_db,...p)=>p.join('/'),mevcutKullanici:()=>user,oturumHazir:async()=>{},girisOgrenci:async()=>user,
       async runTransaction(_db,fn){if(window.__failWrite)throw Error('Test: sunucu kaydı reddetti');const writes=[];
         await fn({get:async ref=>snap(window.__cloud[ref]),set:(ref,data)=>writes.push([ref,data]),update:(ref,data)=>writes.push([ref,{...window.__cloud[ref],...data}])});
         for(const [ref,data] of writes){window.__cloud[ref]=structuredClone(data);await window.__record({event:'write',ref,data});}},
       setDoc:async(ref,data)=>{window.__cloud[ref]=structuredClone(data);},
       async getDocFromServer(ref){await window.__record({event:'readback',ref});return snap(window.__cloud[ref]);},
       async oturumuKapat(){if(!localStorage.getItem('yks_veri'))throw Error('Device data was cleared before sign-out');await window.__record({event:'signout'});user=null;}};
   },role);
   await page.locator('.oHafiza').selectOption('cok-guclu');
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[0].hafizaSeviyesi==='cok-guclu');
   assert.equal(await page.evaluate(()=>D.log.length),1);assert.equal(await page.evaluate(()=>D.kart['0:0'].s),28);
   await page.locator('.oAytOncelik').check();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[0].aytOncelik===true);
   assert.equal(await page.locator('.oAytOncelik').isChecked(),true);
   await page.locator('.oAytOncelik').uncheck();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[0].aytOncelik===false);
   await page.locator('.oAytOncelik').check();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[0].aytOncelik===true);
   if(role==='ogrenci'){
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'student settings overflow');
     await page.screenshot({path:path.join(out,'memory-setting-mobile.png'),fullPage:true});
   }
   // Unsaved teacher settings must not vanish when logout is clicked.
   if(role==='rehber'){
     await page.getByRole('button',{name:'Ayarlar',exact:true}).click();await page.locator('#aSoru').fill('25');
     await page.locator('#oturumKapat').click();await page.getByText('Değiştirdiğiniz ayarları önce Kaydet düğmesiyle kaydedin.',{exact:true}).waitFor();
     assert(await page.evaluate(()=>!!localStorage.getItem('yks_veri')));await page.locator('#cikisKapat').click();await page.locator('#ayarKaydet').click();
   }
   await context.setOffline(true);await page.locator('#oturumKapat').click();
   await page.waitForFunction(()=>document.getElementById('cikisDurum')?.textContent.includes('İnternet bağlantısı yok'));
   assert(await page.evaluate(()=>!!localStorage.getItem('yks_veri')));await context.setOffline(false);await page.locator('#cikisKapat').click();
   const second=await context.newPage();await second.goto('http://localhost/?dev=1');await second.waitForFunction(()=>!!D?.rol);
   assert.equal(await second.evaluate(()=>D.ogr[0].aytOncelik),true,'AYT setting survives fresh page load');
   await page.locator('#oturumKapat').click();await page.waitForFunction(()=>document.getElementById('cikisDurum')?.textContent.includes('başka bir sekmede'));
   assert(await page.evaluate(()=>!!localStorage.getItem('yks_veri')));await second.close();await page.locator('#cikisKapat').click();
   await page.evaluate(()=>{window.__failWrite=true;});await page.locator('#oturumKapat').click();
   await page.waitForFunction(()=>document.getElementById('cikisDurum')?.textContent.includes('sunucu kaydı reddetti'));
   assert(await page.evaluate(()=>!!localStorage.getItem('yks_veri')));assert.equal(await page.evaluate(()=>document.querySelector('.kabuk').inert),false);
   await page.screenshot({path:path.join(out,'logout-retry-'+role+'.png'),fullPage:true});
   await page.evaluate(()=>{window.__failWrite=false;});await page.locator('#cikisTekrar').click();
   await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('yks_veri')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('yks_plan_kurtarma_oncesi')),null);
   assert.equal(await page.evaluate(()=>localStorage.getItem('other-app')),'keep');
   const written=records.filter(r=>r.event==='write').at(-1).data;
   const saved=JSON.parse(role==='ogrenci'?written.paket.calisma.veri:written.veri);
   assert.equal(saved.log.length,1);assert.equal(saved.ogr[0].hafizaSeviyesi,'cok-guclu');assert.equal(saved.ogr[0].aytOncelik,true);
   assert(records.findIndex(r=>r.event==='readback')<records.findIndex(r=>r.event==='signout'));assert.deepEqual(errors,[]);
   await context.close();
 }
 const timetableContext=await browser.newContext({viewport:{width:1280,height:950}});
 await timetableContext.route('**/*',route=>route.request().url().startsWith('http://localhost/')?
   route.fulfill({status:route.request().url().includes('/data/')?404:200,contentType:'text/html',body:html}):route.abort());
 const timetable=await timetableContext.newPage(),timetableErrors=[];timetable.on('pageerror',e=>timetableErrors.push(e.message));
 await timetable.goto('http://localhost/?dev=1');await timetable.getByText('Kimsiniz?',{exact:true}).waitFor();
 await timetable.evaluate(()=>{
   D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-23';D.ayar.donemBasi='2026-08-24';D.ayar.donemElle=true;
   D.ogr=['201','205','301'].map((sube,i)=>({ad:'Example '+i,no:40+i,sube,alan:sube==='301'?'EA':'SAY',kap:6,off:[]}));
   D.dersProgrami={};D.programHafta={};D.konuPlani={};EK.ogr=0;EK.sekme='program';EK.sube='201';EK.hafta=null;ciz();
 });
 for(const su of ['201','205','301']){
   await timetable.evaluate(su=>{EK.sube=su;ciz();},su);
   await timetable.getByText('15:30',{exact:true}).waitFor();
   assert.equal(await timetable.evaluate(su=>programAl(su,gunNo('2026-11-02')).prog.gunler.flat().filter(Boolean).length,su),40);
   await timetable.screenshot({path:path.join(out,'timetable-'+su+'.png'),fullPage:true});
 }
 assert.deepEqual(timetableErrors,[]);await timetableContext.close();
 console.log('Browser checks passed: teacher/student memory and persistent AYT settings, three updated timetables, offline and rejected saves, unsaved forms, real multi-tab locks, retry, server readback and clean logout.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
