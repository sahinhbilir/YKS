// Synthetic identities only. Firebase is replaced with a transactional in-memory server.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8'));
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-exams-'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-09-28T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   await page.evaluate(()=>{
    D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-28';D.ogr=[{ad:'SENTETİK ADA',no:1,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];EK.ogr=0;EK.sekme='denemeler';ciz();
   });
   // The add form is a popup dialog, separate from the chart filters; Escape and × close it.
   await page.getByRole('button',{name:'+ Deneme ekle',exact:true}).click();
   assert(await page.getByRole('dialog',{name:'Deneme ekle'}).isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),'dnAd');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#dnOrtu').count(),0);
   await page.getByRole('button',{name:'+ Deneme ekle',exact:true}).click();await page.locator('#dnKapat').click();assert.equal(await page.locator('#dnOrtu').count(),0);
   await page.getByRole('button',{name:'+ Deneme ekle',exact:true}).click();
   await page.locator('#dnAd').fill('İlk TYT');await page.locator('#dnTarih').fill('2026-09-18');await page.locator('#dnSure').fill('145');
   await page.locator('[data-dn-ders="turkce"] [data-dn-value="dogru"]').fill('30');await page.locator('[data-dn-ders="turkce"] [data-dn-value="yanlis"]').fill('8');
   await page.getByRole('button',{name:'Denemeyi kaydet',exact:true}).click();
   await page.waitForFunction(()=>D.ogr[0].denemeler?.length===1 && DENEME_FORM===null);
   assert.equal(await page.locator('.dn-dot').count(),1);await page.locator('.dn-dot').hover();assert((await page.locator('#dnDetay').innerText()).includes('28 net'));assert((await page.locator('#dnDetay').innerText()).includes('145 dk'));
   await page.getByRole('button',{name:'Düzenle',exact:true}).click();await page.locator('[data-dn-ders="turkce"] [data-dn-value="dogru"]').fill('31');await page.getByRole('button',{name:'Denemeyi kaydet',exact:true}).click();await page.waitForFunction(()=>DENEME_FORM===null);
   assert.equal(await page.evaluate(()=>D.ogr[0].denemeler.length),1);
   await page.getByRole('button',{name:'Branş denemeleri',exact:true}).click();await page.getByRole('button',{name:'+ Deneme ekle',exact:true}).click();await page.locator('#dnAd').fill('Türkçe branş');await page.locator('[data-dn-ders="turkce"] [data-dn-value="soru"]').fill('20');await page.locator('[data-dn-ders="turkce"] [data-dn-value="dogru"]').fill('15');await page.locator('[data-dn-ders="turkce"] [data-dn-value="yanlis"]').fill('4');await page.getByRole('button',{name:'Denemeyi kaydet',exact:true}).click();await page.waitForFunction(()=>DENEME_FORM===null);
   // The branş exam (solid) and the earlier TYT exam's Türkçe section (hollow).
   assert.equal(await page.locator('.dn-dot:not(.genel)').count(),1);assert.equal(await page.locator('.dn-dot.genel').count(),1);assert((await page.locator('#dnDetay').innerText()).includes('14 net'));
   // Matematik was left blank in that TYT exam: still 30 questions, so it is a 0 net point.
   await page.locator('#dnFiltreBrans').selectOption('mat');assert.equal(await page.locator('.dn-dot.genel').count(),1);assert.equal(await page.locator('.dn-dot:not(.genel)').count(),0);
   assert((await page.locator('#dnDetay').innerText()).includes('0 D / 0 Y / 30 B'));
   await page.getByRole('button',{name:'AYT',exact:true}).click();await page.getByRole('button',{name:'+ Deneme ekle',exact:true}).click();await page.locator('#dnAd').fill('AYT sayısal');await page.locator('[data-dn-ders="mat"] [data-dn-value="dogru"]').fill('20');await page.locator('[data-dn-ders="geo"] [data-dn-value="dogru"]').fill('8');await page.getByRole('button',{name:'Denemeyi kaydet',exact:true}).click();await page.waitForFunction(()=>DENEME_FORM===null);assert.equal(await page.locator('.dn-dot').count(),1);
   await page.getByRole('button',{name:'TYT',exact:true}).click();assert.equal(await page.locator('.dn-dot').count(),1);
   // Reload persistence, escaping, zero and negative nets, same day dots.
   await page.reload();await page.getByRole('button',{name:'Denemelerim',exact:true}).click();assert.equal(await page.locator('.dn-dot').count(),1);
   await page.evaluate(()=>{const r=D.ogr[0].denemeler.find(r=>r.tur==='TYT');for(let i=0;i<6;i++)D.ogr[0].denemeler.push({...r,id:'m:chart'+i,tarih:'2026-09-'+String(20+i).padStart(2,'0'),ad:'Deneme '+(i+2),sure:130-i*3,dersler:[{kod:'turkce',dogru:20+i*2,yanlis:6,soru:40}]});ciz();});
   await page.locator('.dn-dot').last().focus();assert((await page.locator('#dnDetay').innerText()).includes('Deneme 7'));
   // Net per minute (net D − Y/4 ÷ completion time) exists only for branş denemeleri.
   assert.equal(await page.locator('#dnMetrik option[value="hiz"]').count(),0,'no net/dk on TYT');
   assert(!(await page.locator('#dnDetay').innerText()).includes('Net/dk'));
   await page.evaluate(()=>{const r=D.ogr[0].denemeler.find(r=>r.tur==='BRANS');D.ogr[0].denemeler.push({...r,id:'m:brans2',tarih:'2026-09-24',ad:'Türkçe branş 2',sure:25,dersler:[{kod:'turkce',dogru:16,yanlis:4,soru:20}]});ciz();});
   await page.getByRole('button',{name:'Branş denemeleri',exact:true}).click();await page.locator('#dnMetrik').selectOption('hiz');
   assert.equal(await page.locator('.dn-dot').count(),1,'only the timed branş exam is plotted');
   assert((await page.locator('.dn-stats').innerText()).includes('Ortalama net/dk'));
   await page.locator('.dn-dot').focus();assert((await page.locator('#dnDetay').innerText()).includes('Net/dk: 0,6'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'branş overflow');
   await page.screenshot({path:path.join(out,'mock-exam-net-per-minute-'+width+'.png'),fullPage:true});
   await page.getByRole('button',{name:'TYT',exact:true}).click();assert.equal(await page.locator('#dnMetrik').inputValue(),'net');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'student overflow');await page.screenshot({path:path.join(out,'mock-exam-'+width+'.png'),fullPage:true});
   // A TYT course tile opens that course in Branş denemeleri; TYT sections are hollow dots there.
   const tytTurkce=await page.evaluate(()=>denemeListe().filter(r=>r.tur==='TYT' && r.dersler.some(d=>d.kod==='turkce' && d.dogru+d.yanlis>0)).length);
   const bransTurkce=await page.evaluate(()=>denemeListe().filter(r=>r.tur==='BRANS' && r.brans==='turkce').length);
   assert(tytTurkce>1 && bransTurkce>0);
   await page.locator('#dnDetay').getByRole('button',{name:'Türkçe gelişimini Branş denemelerinde gör'}).click();
   assert.equal(await page.getByRole('button',{name:'Branş denemeleri',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#dnFiltreBrans').inputValue(),'turkce');assert.equal(await page.locator('#dnMetrik').inputValue(),'net');
   assert.equal(await page.locator('.dn-dot.genel').count(),tytTurkce);assert.equal(await page.locator('.dn-dot:not(.genel)').count(),bransTurkce);
   assert((await page.locator('#dnDetay').innerText()).includes('TYT denemesinden'));
   assert((await page.locator('.dn-chart').innerText()).includes('İçi boş nokta'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'course chart overflow');
   await page.screenshot({path:path.join(out,'mock-exam-course-sections-'+width+'.png'),fullPage:true});
   await page.locator('#dnGenel').uncheck();assert.equal(await page.locator('.dn-dot.genel').count(),0);assert.equal(await page.locator('.dn-dot').count(),bransTurkce);
   await page.locator('#dnGenel').check();await page.locator('.dn-dot.genel').first().focus();
   await page.locator('#dnDetay').getByRole('button',{name:'TYT denemesini aç'}).click();
   assert.equal(await page.getByRole('button',{name:'TYT',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>JSON.stringify(D).includes('"g:')),false,'sections are never stored');
   // Teacher report preview, strict matching, one missing student, and publication failures/retry.
   await page.evaluate(fixture=>{
    window.testFixture=fixture;D.rol='rehber';D.ogr.push({ad:'SENTETİK ECE',no:2,sube:'12-B',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-2'});
    EK.sekme='denemeler';DENEME_IMPORT=denemeImportHazirla([{...denemePdfCoz(fixture.tyt),dosya:'sentetik-sonuclar.pdf'}]);ciz();
   },fixture);
   assert.equal(await page.locator('[data-dn-import]:checked').count(),2);assert.equal(await page.locator('[data-dn-match]').last().inputValue(),'-1');
   await page.getByRole('button',{name:'Seçilen sonuçları kaydet ve yayınla',exact:true}).click();await page.waitForFunction(()=>!DENEME_ISLEM);
   assert.equal(await page.evaluate(()=>D.ogr[0].denemeOkul.length),1);assert.equal(await page.evaluate(()=>D.ogr[1].denemeOkul.length),1);assert((await page.locator('#dnDurum').innerText()).includes('yayın bekliyor'));
   await page.evaluate(()=>{
    window.testDocs={};window.testTeacher={uid:'teacher',isAnonymous:false};
    window.bulut={yapilandirilmis:true,mevcutKullanici:()=>window.testTeacher,doc:(db,col,id)=>col+'/'+id,getDoc:async ref=>({exists:()=>!!testDocs[ref],data:()=>testDocs[ref]}),setDoc:async(ref,v)=>{testDocs[ref]=structuredClone(v)},runTransaction:async(db,cb)=>cb({get:async ref=>({exists:()=>!!testDocs[ref],data:()=>structuredClone(testDocs[ref])}),update:(ref,v)=>{testDocs[ref]={...testDocs[ref],...structuredClone(v)}}})};
    // Disable unrelated notebook backup during this isolated UI test.
    bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
   });
   await page.getByRole('button',{name:'Bekleyen sonuçları yayınla',exact:true}).click();await page.waitForFunction(()=>!DENEME_ISLEM);
   assert((await page.locator('#dnDurum').innerText()).includes('2 öğrenciye yayınlandı'));
   assert.equal(await page.evaluate(()=>Object.values(testDocs).filter(v=>v.denemeOkul).length),2);
   assert.equal(await page.evaluate(()=>D.ogr.some(o=>o.denemeYayinBekliyor)),false);
   await page.evaluate(()=>{DENEME_IMPORT=denemeImportHazirla([{...denemePdfCoz(testFixture.tyt),dosya:'sentetik-sonuclar.pdf'}]);ciz()});assert.equal(await page.locator('[data-dn-import]:checked').count(),0);
   await page.screenshot({path:path.join(out,'mock-import-'+width+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'teacher overflow');await page.screenshot({path:path.join(out,'mock-import-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS mock-exam browser',width);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
