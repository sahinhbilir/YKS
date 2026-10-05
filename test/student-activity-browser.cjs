// Synthetic UI only; the Firebase module is removed. CI supplies Playwright.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-activity-'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   await page.clock.setFixedTime(new Date('2026-09-28T08:52:00+03:00'));
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>d.accept());
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
   await page.evaluate(()=>{
    D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-28';D.elle={};D.islenis={};
    const hb=gunNo('2026-09-21');
    D.ogr=[{ad:'Synthetic Ada',no:42,sube:'11-A',sinif:11,alan:'EA',kap:6,off:[6],aktif:true,
     ogrenciBulutId:'d70ec14d-ab10-43e5-b63f-0dd990c3626b',ilkAktif:hb,sonucBilgiOkundu:true}];
    D.islenis[0]=hb-3;
    D.elle['0|'+hb]={ek:[],sil:[],yer:{0:[0,0]},soru:{0:12},degisim:{},konuSlot:{},sabit:hb,ogrenciOtomatik:true,
     plan:{surum:2,slotlar:[['0'],[],[],[],[],[],[]],off:[6],kap:6,devreden:0,tasan:[]}};
    EK.ogr=0;EK.hafta=hb;EK.sekme='plan';window.analyticsTest=[];
    window.yksAnalitik=(name,p)=>window.analyticsTest.push({name,p});window.print=()=>{};ciz();
   });
   await page.locator('#ana [data-sekme="giris"]').first().click();
   assert.equal(await page.evaluate(()=>D.ogr[0].etkinlik.kayit.filter(r=>r.tur==='acildi').length),1);
   await page.locator('#sonucKaydet').click(); // Empty form is not a saved result.
   assert.equal(await page.evaluate(()=>D.ogr[0].etkinlik.kayit.filter(r=>r.tur==='kaydedildi').length),0);
   await page.locator('[data-sonuc-row]').first().locator('.sonuc-not').last().click();
   await page.locator('#sonucKaydet').click();
   await page.waitForFunction(()=>D.ogr[0].etkinlik.kayit.some(r=>r.tur==='kaydedildi'));
   assert.equal(await page.evaluate(()=>EK.hafta),await page.evaluate(()=>gunNo('2026-09-28')));
   await page.locator('#yazdirOnizle').click();
   assert.deepEqual(await page.evaluate(()=>window.analyticsTest.map(x=>x.name)),['student_results_opened','student_results_saved','student_pdf_requested']);
   assert.equal(await page.evaluate(()=>D.ogr[0].etkinlik.kayit.find(r=>r.tur==='pdf').sonucHafta),await page.evaluate(()=>gunNo('2026-09-21')));
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[0].etkinlik.kayit.length),3);
   await page.evaluate(()=>{
    disariAktarmayiKapat();D.rol='rehber';
    D.ogr.push({ad:'Synthetic Ece',no:43,sube:'11-B',sinif:11,alan:'EA',kap:6,off:[6],aktif:true});
    localStorage.setItem('yks_veri',JSON.stringify(D));
   });
   await page.reload();await page.getByRole('heading',{name:'Haftalık öğrenci takibi'}).waitFor();
   assert.equal(await page.locator('#takipHafta').inputValue(),'2026-09-28');
   assert.equal(await page.locator('#takipOlcut').inputValue(),'islem');
   const rows=page.locator('.etkinlik-satir:not(.etkinlik-baslik)');
   assert.equal(await rows.count(),2);
   const ada=rows.filter({hasText:'Synthetic Ada'});
   assert((await ada.innerText()).includes('Kaydetti'));assert((await ada.innerText()).includes('28.09.2026'));
   assert.equal(await page.locator('.etkinlik-ozet strong').first().innerText(),'1 / 2');
   assert((await ada.innerText()).includes('Sonuç: 21.09.2026'));
   await page.locator('#takipOlcut').selectOption('sonuc');
   assert.equal(await page.locator('.etkinlik-ozet strong').first().innerText(),'0 / 2');
   await page.getByRole('button',{name:'Önceki takip haftası'}).click();
   assert.equal(await page.locator('.etkinlik-ozet strong').first().innerText(),'1 / 2');
   await page.locator('#takipOlcut').selectOption('islem');
   assert.equal(await page.locator('.etkinlik-ozet strong').first().innerText(),'0 / 2');
   await page.getByRole('button',{name:'Bu hafta',exact:true}).click();
   await page.locator('#takipSube').selectOption('11-B');assert.equal(await rows.count(),1);
   assert.equal(await page.locator('.etkinlik-ozet strong').first().innerText(),'0 / 1');
   await page.locator('#takipSube').selectOption('');
   await page.locator('#takipFiltre').selectOption('akis');assert.equal(await rows.count(),1);
   await page.getByRole('button',{name:'Önceki takip haftası'}).click();assert.equal(await rows.count(),0);
   await page.getByRole('button',{name:'Bu hafta',exact:true}).click();assert.equal(await rows.count(),1);
   await page.locator('#takipFiltre').selectOption('hepsi');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'dashboard overflow');
   await page.screenshot({path:path.join(out,'student-activity-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS weekly activity UI',width);await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
