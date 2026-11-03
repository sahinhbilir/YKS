'use strict';
// One combined synthetic year through actual import/save and IndexedDB persistence paths.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const F=require('./annual-data-capacity.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1');
  await page.waitForFunction(()=>typeof LOCAL_STORE==='object'&&typeof SIRALAMA==='object'&&ACILIS_KAYIT>=0);
  await page.evaluate(async people=>{await LOCAL_STORE.ready();D=varsayilan();D.rol='rehber';D.kurum='Sentetik Okul';D.ogr=people;EK.sekme='plan';if(!await kaydet(true))throw Error('Initial save failed')},F.roster(99));
  const sizes=await page.evaluate(()=>[SIRALAMA.TYT_KEYS.length,SIRALAMA.TYT_KEYS.length+SIRALAMA.AYT_KEYS.length]);
  const people=F.roster(99);
  const serialAttendance=(people,w)=>{const r=F.attendance(people,w);r.ogrenciler.forEach(o=>o.gun=[...o.gun]);return r};
  for(let w=0;w<36;w++){
   const examPeople=w%4===0?people:people.slice(0,31);
   const lists=F.lists(examPeople,w,...sizes);
   await page.evaluate(async item=>{
    for(const o of item.attendance.ogrenciler)o.gun=new Map(o.gun);
    await YOKLAMA.raporEkle([item.attendance]);
    await ETUT.raporEkle([item.study]);
    await SIRALAMA.kaydetListeler(item.lists);
    for(const list of item.lists)for(const source of list.ogr){
     const student=D.ogr.find(o=>String(o.no)===source.no);if(!student)throw Error('Synthetic student missing');
     for(const ot of list.tur==='F'?['TYT','AYT']:['TYT']){
      const keys=ot==='TYT'?SIRALAMA.TYT_KEYS:SIRALAMA.AYT_KEYS,offset=ot==='TYT'?0:SIRALAMA.TYT_KEYS.length;
      const dersler=keys.map((k,j)=>{const kod=DENEME_SIRA_KODU[k],def=DENEME_DERSLER[ot].find(x=>x[0]===kod),[dogru,yanlis]=source.dy[offset+j].split('/').map(Number);return {kod,dogru,yanlis,soru:def[2]}}).filter(d=>d.kod!=='sf');
      const tarih=list.tarih.split('.').reverse().join('-'),kayit=denemePdfKaydi({ad:list.ad,tarih},{oturum:ot,puan:null,dersler});
      student.denemeOkul=[...(student.denemeOkul||[]),kayit];denemeDogrula(student.denemeOkul);
     }
    }
    if(!await kaydet(true))throw Error('Synthetic school results failed to save');
   },{attendance:serialAttendance(people,w),study:F.study(people,w,4),lists});
  }
  // Import actual Konu Takibi report blocks for 31 students across three exams.
  const reports=Array.from({length:3},(_,w)=>({ad:'Sentetik konu denemesi '+(w+1),blocks:people.slice(0,31).map(o=>({student:{name:o.ad,no:String(o.no),cls:o.sube},course:'TÜRKÇE-T',kind:'outcome',rows:[{code:'T.12.1.1',name:'Sözcüğün anlamını belirler.',c:[4,2,1,1]},{code:'T.12.3.1',name:'Cümlenin anlamını yorumlar.',c:[5,3,1,1]}]}))}));
  await page.evaluate(async reports=>{await KONU_TAKIBI.ekle(reports)},reports);
  const extra=await page.evaluate(async base=>{
   D.ayar.testTarih='2026-11-03';let frozen=0,logs=0;
   for(let si=0;si<10;si++)for(let w=0;w<4;w++){
    const hb=base+w*7,gunler=Array.from({length:7},()=>[]),rows=[];
    for(let j=0;j<25;j++){
     const ki=j,k=konuAl(ki);if(!k)throw Error('Synthetic plan topic missing '+ki);
     gunler[j%5].push({ki,ad:k[3],dersAd:'Sentetik ders',soru:20,test:1});
     rows.push({ki,gun:hb+j%5,dogru:12+j%7,soru:20,not:3});
    }
    frozen+=haftayiSabitle(si,hb,{gunler,toplam:25,off:[],kap:6,devreden:0,tasan:[]})>0?1:0;
    logs+=sonucIsle(si,rows);
   }
   if(!await kaydet(true))throw Error('Synthetic plans/results save failed');
   yedekDogrula(JSON.parse(JSON.stringify(D)));
   return {frozen,logs,topics:D.konutakibi.exams.length,blocks:D.konutakibi.exams.reduce((n,e)=>n+e.blocks.length,0)};
  },F.BASE);
  assert.deepEqual(extra,{frozen:40,logs:1000,topics:3,blocks:93});
  const result=await page.evaluate(async()=>{
   const saved=await LOCAL_STORE.get('yks_veri'),doc=JSON.parse(saved),now=JSON.stringify(D),encoded=await bulutVeriKodla(now);
   return {matches:saved===now,students:doc.ogr.length,days:doc.yoklama.gunler.length,etuts:doc.etut.satir.length,exams:doc.siralama.sinavlar.length,schoolResults:doc.ogr.reduce((n,o)=>n+(o.denemeOkul||[]).length,0),raw:new TextEncoder().encode(now).length,encoded:new TextEncoder().encode(encoded).length};
  });
  assert(result.matches,'persisted IndexedDB record matches current D');assert.equal(result.students,99);assert.equal(result.days,180);assert.equal(result.etuts,14256);assert.equal(result.exams,54);assert(result.schoolResults>2000);assert(result.raw<=5000000&&result.encoded<=900000);assert.deepEqual(errors,[]);
  console.log('PASS persisted combined year and representative extras',JSON.stringify({...result,...extra}));
  // Export is the same JSON download used by the application. Reload, then restore through the actual file input.
  await page.evaluate(()=>{EK.sekme='ayarlar';ciz()});
  const downloadPromise=page.waitForEvent('download');await page.locator('#yedekIndir').click();const download=await downloadPromise;
  const stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(part);const exported=Buffer.concat(parts);
  assert.equal(JSON.parse(exported).log.length,1000,'export includes synthetic history');
  await page.reload();await page.waitForFunction(()=>ACILIS_KAYIT>=0);
  assert.equal(await page.evaluate(()=>D.log.length),1000,'reload restores year');
  await page.evaluate(async()=>{D.log=[];if(!await kaydet(true))throw Error('pre-restore save failed');EK.sekme='ayarlar';ciz()});
  page.on('dialog',d=>d.accept());await page.locator('#yedekYukle').setInputFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:exported});
  await page.waitForFunction(()=>D.log.length===1000);
  assert.equal(await page.evaluate(async()=>JSON.parse(await LOCAL_STORE.get('yks_veri')).log.length),1000,'restored export persisted');
  console.log('PASS browser reload and exported JSON restore');
  // A compressibility failure must reject a growing import before any mutation or persisted write.
  const noise=crypto.randomBytes(360000).toString('base64');
  const guard=await page.evaluate(async({noise,attendance})=>{
   D.syntheticPadding=noise;const before=JSON.stringify(D),saved=await LOCAL_STORE.get('yks_veri');let failure='';
   for(const o of attendance.ogrenciler)o.gun=new Map(o.gun);
   try{await YOKLAMA.raporEkle([attendance])}catch(e){failure=e.message}
   return {failure,unchanged:before===JSON.stringify(D),persisted:saved===await LOCAL_STORE.get('yks_veri'),raw:new TextEncoder().encode(before).length,encoded:new TextEncoder().encode(await bulutVeriKodla(before)).length};
  },{noise,attendance:serialAttendance(people,36)});
  assert(guard.raw<5000000&&guard.encoded>900000,'synthetic input specifically exceeds encoded cap');assert(guard.failure,'growing import must fail');assert(guard.unchanged&&guard.persisted,'failed import must leave memory and persistence intact');
  console.log('PASS encoded-cap rejection and rollback',JSON.stringify(guard));
  const reduced=await page.evaluate(async()=>{await YOKLAMA.sil();return {removed:D.yoklama===undefined,saved:JSON.parse(await LOCAL_STORE.get('yks_veri')).yoklama===undefined}});
  assert(reduced.removed&&reduced.saved,'oversize legacy data must allow a real reducing cleanup');
  console.log('PASS oversize cleanup');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


