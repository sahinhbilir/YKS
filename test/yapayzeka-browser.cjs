// Gemini reading on desktop and phone with a stubbed model (window.bulut.yapayZeka): a timetable photo
// into Ders programı, another publisher's result photo into Denemeler, and a paper plan photo into
// Geçmiş planı kurtar. Synthetic data only; nothing leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-yapayzeka-'));fs.mkdirSync(out,{recursive:true});
const foto=ad=>({name:ad,mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')});
// The stub answers by the instructions it receives, like the real model would by its prompt.
const stub=()=>{
  window.__yzIstek=[];
  window.bulut={yapilandirilmis:true,mevcutKullanici:()=>null,oturumHazir:async()=>{},
   yapayZeka:async a=>{window.__yzIstek.push(a);await new Promise(r=>setTimeout(r,60));const t=a.parcalar[0].text,c=window.__yzCevap;
    const y=/ders programı/.test(t)?c.program:/deneme sınavının/.test(t)?c.deneme:c.plan;return {metin:JSON.stringify(y),model:'stub-model'}}};
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message)});page.on('dialog',d=>d.accept());
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
   await page.evaluate(()=>{window.__yzCevap={
    program:{saatler:['08:30','09:20','10:10'],gunler:[['MATEMATİK','FİZİK','TÜRKÇE'],['KİMYA','BİYOLOJİ',''],['TARİH','',''],['','',''],['COĞRAFYA','FELSEFE',''],[],[]]},
    deneme:{sinavAdi:'Sentetik Yayın 4',sinavTarihi:'2026-10-04',ogrenciler:[
     {ad:'SENTETİK ADA',tyt:{turkce:'30/8',mat:'20/10',geo:'5/1'},tytNet:50.25},
     {ad:'Sentetik Bora',tyt:{turkce:'30/8',mat:'20/10',geo:'5/1'},tytNet:55}]},
    plan:{tur:'yks-gecmis-plan',surum:1,hafta:'2026-09-07',ogrenci:{ad:'Sentetik Ada',no:1001},satirlar:[
     {tarih:'2026-09-08',ders:'Türkçe',konu:'Karışık Paragraf',ki:null,tur:'serbest',durum:'tamamlandi',soru:20,dogru:null,not:null}]}}});

   // 1) A student reads the school timetable photo; it waits in the box until it is used.
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';ciz();});
   await page.locator('#kOgrAd').fill('Sentetik Öğrenci');await page.locator('#kOgrSinif').selectOption('11');
   await page.locator('#kMufredatBaslangic').fill('2026-09-21');await page.locator('#kOgrBaslat').click();
   await page.waitForFunction(()=>D.ogr.length===1);await page.locator('#dpCiktiYapistir').waitFor();
   assert.equal(await page.locator('#dpYzDosya').count(),0,'no AI read without the cloud');
   await page.evaluate(stub);await page.evaluate(()=>ciz());
   await page.locator('#dpYzDosya').setInputFiles(foto('program.png'));
   await page.waitForFunction(()=>EK.dpYz&&EK.dpYz.tablo);
   assert.match(await page.locator('.yz-durum').innerText(),/Program okundu/);
   assert.equal(await page.locator('.yz-tablo tbody tr').count(),4,'four school days have lessons');
   assert.match(await page.locator('.yz-tablo').innerText(),/Pzt\s+MATEMATİK\s+FİZİK\s+TÜRKÇE/i);
   assert.equal(JSON.parse(await page.locator('#dpCiktiYapistir').inputValue()).saatler.length,3);
   assert.equal(await page.evaluate(()=>Object.keys(D.programHafta||{}).length),0,'nothing is used before the button');
   // A hand correction updates the preview in place.
   const t=await page.locator('#dpCiktiYapistir').inputValue();
   await page.locator('#dpCiktiYapistir').fill(t.replace('"TARİH"','"GEOMETRİ"'));
   assert.match(await page.locator('.yz-tablo').innerText(),/Çar\s+GEOMETRİ/i);
   await page.screenshot({path:path.join(out,'yz-program-'+width+'.png'),fullPage:true});
   await page.locator('#dpCiktiUygula').click();
   await page.waitForFunction(()=>Object.values(D.programHafta?.benim||{}).length===1);
   assert.equal(await page.evaluate(()=>Object.values(D.programHafta.benim)[0].gunler[2][0]),'GEOMETRİ');
   assert.equal(await page.evaluate(()=>EK.dpYz),null);
   assert.equal(await page.evaluate(()=>window.__yzIstek[0].parcalar[1].inlineData.mimeType),'image/png');

   // 2) The teacher imports another publisher's result photo; only the row its printed net confirms is ticked.
   await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-12';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ogrenciBulutId:'s-1'},{ad:'SENTETİK BORA',no:1002,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'s-2'}];
    EK.ogr=0;EK.sekme='denemeler';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};ciz();});
   assert.match(await page.locator('#dnPdf').getAttribute('accept'),/image\/png.*\.xlsx/);
   await page.locator('#dnPdf').setInputFiles(foto('sonuc.png'));
   await page.waitForFunction(()=>DENEME_IMPORT&&!DENEME_ISLEM);
   const onizleme=page.locator('.dn-import');
   assert.match(await onizleme.innerText(),/Yapay zekâ ile okundu/);
   assert.equal(await onizleme.locator('tbody tr').count(),2);
   assert.equal(await onizleme.locator('input[data-dn-import="0:0"]').isChecked(),true);
   assert.equal(await onizleme.locator('input[data-dn-import="0:1"]').isChecked(),false);
   assert.match(await onizleme.locator('tbody tr').nth(1).innerText(),/Dosyadaki net \(55\).*uyuşmuyor/);
   assert.match(await onizleme.locator('tbody tr').nth(0).innerText(),/— · SENTETİK ADA[\s\S]*adla eşleşti/);
   await page.screenshot({path:path.join(out,'yz-deneme-'+width+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scroll');
   await page.getByRole('button',{name:'Seçilen sonuçları kaydet ve yayınla',exact:true}).click();await page.waitForFunction(()=>!DENEME_ISLEM);
   assert.deepEqual(await page.evaluate(()=>[D.ogr[0].denemeOkul?.length,D.ogr[1].denemeOkul?.length??0]),[1,0]);
   assert.equal(await page.evaluate(()=>D.ogr[0].denemeOkul[0].ad+' '+D.ogr[0].denemeOkul[0].tarih),'Sentetik Yayın 4 2026-10-04');
   assert.equal(await page.evaluate(()=>D.siralama??null),null,'an unconfirmed, numberless list stays out of Sıralamalar');

   // 3) A paper plan photo is read only when "Yapay zekâ ile oku" is pressed.
   await page.evaluate(()=>{D.ogr[0].ilkAktif=gunNo('2026-08-24');EK.sekme='kurtarma';GECMIS_PLAN=null;ciz();});
   assert.equal(await page.locator('#gpYzOku').isDisabled(),true);
   const once=await page.evaluate(()=>window.__yzIstek.length);
   await page.locator('#gpFoto').setInputFiles(foto('plan.png'));
   assert.equal(await page.evaluate(()=>window.__yzIstek.length),once,'opening the photo sends nothing');
   assert.match(await page.locator('#ana').innerText(),/yalnızca “Yapay zekâ ile oku”ya basarsan/);
   await page.locator('#gpYzOku').click();
   await page.waitForFunction(()=>GECMIS_PLAN&&GECMIS_PLAN.satirlar.length===1);
   assert.match(await page.locator('#gpOzet').innerText(),/Yapay zekâ 1 satır okudu/);
   assert.equal(await page.locator('.gpSatir').count(),1);assert.equal(await page.locator('#gpHafta').inputValue(),'2026-09-07');
   assert.match(await page.locator('#gpJson').inputValue(),/yks-gecmis-plan/);
   await page.screenshot({path:path.join(out,'yz-plan-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();console.log('PASS yapay zekâ browser',width);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
