const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-curriculum-'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM ? {executablePath:process.env.YKS_CHROMIUM} : {})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],dialogs=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';ciz();});
   await page.locator('#kOgrAd').fill('Test Öğrenci');await page.locator('#kOgrSinif').selectOption('11');
   assert(await page.locator('#kOgrSube').isDisabled());
   await page.locator('#kMufredatBaslangic').fill('2026-09-21');await page.locator('#kOgrBaslat').click();
   await page.waitForFunction(()=>D.ogr.length===1&&D.ogr[0].sinif===11);
   assert.equal(await page.evaluate(()=>D.konuPlani.benim[0].Matematik[0].startsWith('11. sınıf')),true);
   await page.locator('[data-sekme="mufredat"]').first().click();
   await page.getByRole('heading',{name:'Müfredat ve kaynaklar'}).waitFor();
   await page.locator('summary').filter({hasText:'Matematik'}).click();
   assert((await page.locator('#ana').innerText()).includes('İstatistiksel Araştırma Süreci'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'curriculum viewport overflow');
   await page.screenshot({path:path.join(out,'curriculum-'+width+'.png'),fullPage:true});
   await page.locator('#mufredatSinif').selectOption('12');assert((await page.locator('#ana').innerText()).includes('önceki öğretim programı'));
   // Teacher adds grade11 to a notebook containing existing grade12 students.
   await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-23';
    D.ogr=[{no:1,ad:'Mevcut Öğrenci',sube:'12-A',alan:'SAY',aktif:false}];
    D.konuPlani['12-A']=JSON.parse(JSON.stringify(VARSAYILAN_KONU_PLANI.SAY));window.oldPlan=JSON.stringify(D.konuPlani['12-A']);
    EK.ogr=0;EK.sekme='ogrenciler';EK.sube=null;ciz();});
   await page.locator('#yAd').fill('Yeni Öğrenci');await page.locator('#ySinif').selectOption('11');await page.locator('#ogrEkle').click();
   assert.equal(await page.evaluate(()=>D.ogr.length),1,'mixed grade branch rejected');assert(dialogs.some(x=>x.includes('farklı sınıf')));
   await page.locator('#ySube').selectOption('__yeni');await page.locator('#ySubeYeni').fill('11-A');await page.locator('#ySinif').selectOption('11');
   await page.locator('#yMufredatBaslangic').fill('2026-09-21');await page.locator('#ogrEkle').click();
   await page.waitForFunction(()=>D.ogr.length===2);
   assert.equal(await page.evaluate(()=>D.ogr[1].sinif),11);
   assert.equal(await page.evaluate(()=>JSON.stringify(D.konuPlani['12-A'])===window.oldPlan),true);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[1].sinif),11);
   await page.locator('[data-sekme="konuplani"]').first().click();await page.locator('#subeSec').selectOption('12-A');
   await page.locator('#yksEksikleriEkle').click();await page.waitForFunction(()=>yksPlanEksikleri('12-A').length===0,null,{timeout:5000});
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS desktop/mobile: enrollment, mixed-grade guard, persistence, source browsing and legacy repair. Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
