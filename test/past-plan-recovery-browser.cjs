const fs=require('node:fs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-photo-ui-'));fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
 await page.route('**/*',route=>route.request().url().startsWith('http://yks.test/') ? route.fulfill({status:route.request().url().includes('/data/')?404:200,contentType:'text/html',body:html}):route.abort());
 await page.goto('http://yks.test/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
 await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-20';D.ogr=[{ad:'Örnek Öğrenci',no:42,sube:'12A',alan:'EA',kap:6,off:[]}];D.islenis={};D.konuPlani={};D.elle={};EK.ogr=0;EK.sekme='kurtarma';ciz();});
 const rows=await page.evaluate(()=>[0,1,2].map((ki,i)=>({tarih:'2026-09-'+(8+i).toString().padStart(2,'0'),ders:konuDersAdi(ki),konu:konuAl(ki)[3],ki,tur:i===2?'anlatim':'test',durum:i===1?'planlandi':'tamamlandi',soru:i===0?10:null,dogru:i===0?8:null,not:null})));
 rows.push(...[['Türkçe','Karışık Paragraf','tamamlandi'],['Matematik TYT','Karışık Problem','planlandi'],['Genel','Süre tutarak hız çalışması','yapilmadi']].map(([ders,konu,durum])=>({tarih:'2026-09-12',ders,konu,ki:null,tur:'test',durum,soru:20,dogru:null,not:null})));
 const packet={tur:'yks-gecmis-plan',surum:1,hafta:'2026-09-07',ogrenci:{ad:'Örnek Öğrenci',no:42},satirlar:rows};
 async function reviewMixedPractice(sourceRows){
   assert.equal(await page.locator('.gpSatir').count(),6);
   for(const i of [3,4]){
     const row=page.locator('.gpSatir').nth(i);
     assert.equal(await row.locator('[data-gp-alan="tur"]').inputValue(),'serbest');
     assert.equal(await row.locator('[data-gp-alan="konuSecim"]').count(),0);
     assert.equal(await row.locator('[data-gp-alan="dogru"]').count(),0);
   }
   await page.locator('#gpSerbest_5').click();
   for(const i of [3,4,5]){
     const row=page.locator('.gpSatir').nth(i);
     for(const field of ['tarih','ders','konu','durum','soru'])assert.equal(await row.locator('[data-gp-alan="'+field+'"]').inputValue(),String(sourceRows[i][field]));
   }
 }
 // Use a synthetic photo fixture; the app does not call an OCR/AI service.
 const fixture=await browser.newPage({viewport:{width:900,height:650}});await fixture.setContent('<html lang="tr"><body style="font:24px sans-serif;padding:24px"><h1>ÖRNEK HAFTALIK PLAN</h1><p>Örnek Öğrenci · 42 · 7–13 Eylül 2026</p><p>Salı: Edebiyat · 1. Ünite: Giriş · 8 / 10</p><p>Çarşamba: Edebiyat · 2. Ünite: Hikâye</p><p>Perşembe: Edebiyat · 3. Ünite: Şiir · Anlatım ✓</p><p>Cumartesi: Türkçe · Karışık Paragraf · 20 soru ✓</p><p>Cumartesi: Matematik TYT · Karışık Problem · 20 soru</p><p>Cumartesi: Genel · Süre tutarak hız çalışması · 20 soru · Yapılmadı</p></body></html>');await fixture.screenshot({path:path.join(out,'photo-plan-fixture.png')});await fixture.close();
 await page.locator('#gpFoto').setInputFiles(path.join(out,'photo-plan-fixture.png'));
 await page.locator('#gpJson').fill(JSON.stringify(packet));await page.locator('#gpAyristir').click();
 await reviewMixedPractice(rows);await page.locator('#gpOnizle').click();assert.match(await page.locator('#gpOzet').innerText(),/1 yeni sonuç/);
 await page.screenshot({path:path.join(out,'photo-recovery-desktop.png'),fullPage:true});
 await page.locator('#gpKimlik').check();await page.locator('#gpKaydet').click();
 await page.waitForFunction(()=>D.log.length===1);assert.equal(await page.evaluate(()=>Object.keys(D.elle).length),1);
 assert.ok(await page.evaluate(()=>localStorage.getItem('yks_plan_kurtarma_oncesi')));
 await page.evaluate(()=>{D.ogr[0].gunlukEk={paragraf:[{gun:gunNo('2026-08-01'),soru:40}],problem:[{gun:gunNo('2026-08-01'),soru:40}]};});
 await page.locator('#gpHaftayiAc').click();assert.ok(await page.evaluate(()=>!!elleAl(0,gunNo('2026-09-07')).sabit));
 await page.getByRole('button',{name:'Haftalar Haritası',exact:true}).click();
 const week=await page.evaluate(()=>gunNo('2026-09-07'));
 await page.locator('[data-harita-plan="'+week+'"]').click();
 assert.equal(await page.evaluate(()=>EK.hafta),week);assert.match(await page.locator('#ana').innerText(),/8\/10/);
 const weekText=await page.locator('#ana').innerText();assert.equal((weekText.match(/Karışık Paragraf/g)||[]).length,1);assert.equal((weekText.match(/Karışık Problem/g)||[]).length,1);
 assert.match(weekText,/✓ Tamamlandı/);assert.match(weekText,/Süre tutarak hız çalışması/);
 await page.getByRole('button',{name:'Geçmiş plan kurtar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'photo-recovery-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'mobile overflow');
 await page.locator('#gpSatirEkle').click();assert.equal(await page.locator('.gpSatir').count(),7);
 const last=page.locator('.gpSatir').last();await last.locator('[data-gp-alan="konuSecim"]').fill('Haftalık ödev');
 await last.locator('[data-gp-alan="tur"]').selectOption('serbest');assert.equal(await last.locator('[data-gp-alan="konu"]').inputValue(),'Haftalık ödev');
 await page.evaluate(()=>{D=paketiYukle(ogrenciPaketi(0));EK.ogr=0;EK.hafta=null;EK.sekme='kurtarma';GECMIS_PLAN=null;ciz();});
 assert.equal(await page.locator('#gpOgrenci').count(),0);
 const studentPacket={...packet,hafta:'2026-08-31',satirlar:rows.map((r,i)=>({...r,tarih:'2026-09-0'+(i+1)}))};
 await page.locator('#gpFoto').setInputFiles(path.join(out,'photo-plan-fixture.png'));
 await page.locator('#gpJson').fill(JSON.stringify(studentPacket));await page.locator('#gpAyristir').click();
 await reviewMixedPractice(studentPacket.satirlar);
 await page.locator('#gpOnizle').click();await page.locator('#gpKimlik').check();await page.locator('#gpKaydet').click();
 await page.waitForFunction(()=>D.log.length===2);assert.equal(await page.locator('#gpYayinla').count(),0);assert.equal(await page.locator('#gpSunucu').count(),1);
 await page.screenshot({path:path.join(out,'student-photo-recovery-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'student mobile overflow');
 await page.getByRole('button',{name:'Haftalar haritası',exact:true}).click();
 const past=await page.evaluate(()=>gunNo('2026-08-31'));await page.locator('[data-ogr-hafta="'+past+'"]').click();
 assert.equal(await page.evaluate(()=>EK.hafta),past);assert.match(await page.locator('#ana').innerText(),/8\/10/);
 // The student's daily-target settings also mention this name; count only plan tasks.
 assert.equal(await page.locator('.plan-liste .pl-oge .k').filter({hasText:'Karışık Paragraf'}).count(),1);
 assert.deepEqual(errors,[]);console.log('Browser checks passed: photo preview, mixed practice recognition, free activity conversion, teacher/student save, archive, past-week opening, manual row and mobile width.');await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
