// Toplu öğrenci ekle on desktop and mobile: paste a school list, preview it (per-şube
// summary, skipped rows with reasons), add the new students in one step.
// Synthetic data only; nothing leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-toplu-ogrenci-'));fs.mkdirSync(out,{recursive:true});
const satirlar=[[1501,'SENTETİK ADA',9,'','102 9/A'],[1502,'SENTETİK BORA',10,'','105 10/B'],[1503,'SENTETİK CEM',11,'EA','302 11/A'],
 [1504,'SENTETİK DERYA',12,'SAY','201 12/B'],[1505,'SENTETİK EMRE',12,'EA','301 12/A'],[7,'SENTETİK MEVCUT',12,'SAY','201 12/B']];
const liste=['Fotoğraf','No','Adı Soyadı','Kurum Adı','Kademe','Alan','Şube','Kayıt Tarihi',...satirlar.map((_,i)=>String(i+1)),
 ...satirlar.flatMap(([no,ad,sinif,alan,sube])=>[String(no),ad,'ÖRNEK SINAV ANADOLU LİSESİ',sinif+'. Sınıf',...(alan?[alan]:[]),sube,'01.07.2026','Asil','İç Kayıt','ÖRNEK PERSONEL'])].join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,scheme] of [[1280,'light'],[390,'light'],[1440,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme}),page=await context.newPage(),errors=[],dialogs=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
   await page.clock.setFixedTime(new Date('2026-10-14T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(()=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';
    D.ogr=[{ad:'SENTETİK MEVCUT',no:7,sube:'201',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05'),maddeler:[],rutin:{once:'',ara:'',sonra:''}}];
    varsayilanKonuPlaniniHazirla('201','SAY',12);
    EK.ogr=0;EK.sekme='ogrenciler';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};ciz();
   });
   const kart=page.locator('#topluOgrKart');
   assert.equal(await kart.evaluate(e=>e.open),false,'folded until used');
   // The student table already sets the page width; the card must not widen it further.
   const genislik=()=>page.evaluate(()=>document.documentElement.scrollWidth),once=await genislik();
   await kart.locator('summary').click();
   await page.locator('#topluOgrMetin').fill(liste);
   await page.locator('#topluOgrOnizle').click();
   await page.locator('#topluOgrKart p b').first().waitFor();
   assert.equal((await kart.locator('p').first().innerText()).replace(/\s+/g,' ').trim(),'6 satır · 5 eklenecek · 1 atlanacak');
   const ozet=(await kart.locator('p.mini').innerText()).split('\n');
   assert.deepEqual(ozet,['102 · 9. sınıf · 1 öğrenci · yeni şube · plan 12.10.2026','105 · 10. sınıf · 1 öğrenci · yeni şube · plan 12.10.2026',
     '201 · 12. sınıf · 1 öğrenci','301 · 12. sınıf · 1 öğrenci · yeni şube','302 · 11. sınıf · 1 öğrenci · yeni şube · plan 12.10.2026']);
   assert.equal(await kart.locator('tbody tr').count(),6);
   assert.equal(await kart.locator('tbody tr.pasif').innerText().then(t=>t.includes('Zaten listede')&&t.includes('SENTETİK MEVCUT')),true);
   assert(await genislik()<=once,'the preview does not widen the page at '+width);
   assert.equal(await kart.evaluate(k=>{const r=k.getBoundingClientRect();return [...k.querySelectorAll('textarea,.sarma,p')].every(e=>e.getBoundingClientRect().right<=r.right+1);}),true,'contents stay inside the card');
   await page.screenshot({path:path.join(out,'toplu-ogrenci-onizleme-'+width+'-'+scheme+'.png'),fullPage:true});
   // Editing the text after the preview turns the add button off until a new preview.
   await page.locator('#topluOgrMetin').press('End');await page.locator('#topluOgrMetin').type(' ');
   assert.equal(await page.locator('#topluOgrEkle').isDisabled(),true);
   await page.locator('#topluOgrOnizle').click();
   await page.locator('#topluOgrEkle').click();
   await page.waitForFunction(()=>D.ogr.length===6);
   assert.deepEqual(dialogs.slice(-1),['5 öğrenci listeye eklenecek. Devam?']);
   assert.deepEqual(await page.evaluate(()=>D.ogr.map(o=>[o.no,o.sube,o.sinif,o.alan,o.aktif!==false])),
     [[7,'201',12,'SAY',true],[1501,'102',9,'SAY',false],[1502,'105',10,'SAY',false],[1503,'302',11,'EA',false],[1504,'201',12,'SAY',false],[1505,'301',12,'EA',false]]);
   assert.equal(await page.locator('#topluOgrKart').evaluate(e=>e.open),false,'the card folds again after adding');
   assert.equal(await page.locator('#topluOgrMetin').inputValue(),'');
   assert.equal(await page.locator('input.oNo').count(),6,'the list shows the new students');
   await page.screenshot({path:path.join(out,'toplu-ogrenci-eklendi-'+width+'-'+scheme+'.png')});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Toplu öğrenci browser checks passed; screenshots in '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
