// "Kendi TYT planım" in a real browser: start it from Ayarlar, then mark a one-test check
// "Bu konuyu henüz çalışmadım" in Sonuç gir and save. Synthetic notebook, no Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-personal-plan-'));
fs.mkdirSync(out,{recursive:true});
const ogrenci=(kur)=>{
  D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'Kendi Plan',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},
    dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];
  EK={ogr:0,sekme:'ayarlar',hafta:null,girisAcik:{}};
  if(kur){kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2026-12-21');
    if(D.ogr[0].kendiPlan.genelTekrar)throw new Error('a school student has no genel tekrar');}   // in school: topics start at once
  ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});
   let beklenenOnay=0;                                       // confirm() of “Zaten yaptım” is expected, anything else is not
   page.on('dialog',async d=>{if(beklenenOnay>0&&d.type()==='confirm'){beklenenOnay--;await d.accept();return;}errors.push('dialog: '+d.message());await d.accept();});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
   // 1. Start from the settings card.
   await page.evaluate(ogrenci,false);
   await page.getByRole('heading',{name:'Kendi TYT planın'}).waitFor();
   assert.equal(await page.locator('#testSifirla').count(),0,'a student without a test account has no reset');
   assert.equal(await page.getByText('Test hesabımı sıfırla').count(),0);
   await page.locator('.kpSeviye[data-ders="Türkçe"]').selectOption('bilir');
   await page.locator('#kpHedef').fill('2027-01-15');
   await page.locator('#kpBaslat').click();
   await page.waitForFunction(()=>D.ogr[0].kendiPlan&&D.ogr[0].kendiPlan.hedef==='2027-01-15');
   assert.equal(await page.evaluate(()=>D.ogr[0].kendiPlan.seviye['Türkçe']),'bilir');
   assert.equal(await page.evaluate(()=>D.ogr[0].kendiPlan.seviye['Matematik TYT']),'hic');
   await page.getByText(/\d+ konu kaldı/).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'settings overflow');
   await page.screenshot({path:path.join(out,'personal-plan-settings-'+width+'.png'),fullPage:true});
   // 2. A week that already carries personal checks: "not studied yet" from the result form.
   await page.evaluate(ogrenci,true);
   const kendi=await page.evaluate(()=>{const p=planHesapla(0,buHafta(0));
     return p.gunler.flatMap((l,g)=>l.map(x=>({ki:x.ki,gun:buHafta(0)+g,kendi:!!(p.elle.kendiTest||{})[x.ki]}))).filter(x=>x.kendi&&x.gun<=bugunNo());});
   assert(kendi.length>0,'a personal check is due by today');
   await page.evaluate(()=>{EK.sekme='giris';EK.hafta=null;ciz();});
   const anladim=page.locator('#sonucBilgiAnladim');                 // first-use explanation
   if(await anladim.isVisible())await anladim.click();
   const satir=page.locator('[data-sonuc-row][data-ki="'+kendi[0].ki+'"][data-gun="'+kendi[0].gun+'"]');
   const dugme=satir.locator('[data-sonuc-anlatilmadi]');
   assert.equal((await dugme.innerText()).trim(),'Bu konuyu henüz çalışmadım');
   await dugme.click();
   await satir.getByText('Çalışmadım · konu anlatımı sıraya eklenecek').waitFor();
   await page.locator('#sonucKaydet').first().click();
   await page.waitForFunction(ki=>(D.ogr[0].kendiPlan.anlatimGerek||{})[ki]!==undefined,kendi[0].ki);
   assert.equal(await page.evaluate(()=>D.konuAnlatilmadi.length),0,'the school sequence is not shifted');
   assert.equal(await page.evaluate(ki=>kendiPlanKuyrugu(0)[0].ki===ki&&kendiPlanKuyrugu(0)[0].anlatim,kendi[0].ki),true);
   await page.evaluate(()=>{EK.sekme='plan';EK.hafta=sonrakiHafta(0,buHafta(0));ciz();});
   assert(/Konu anlatımı\s+Kendi TYT planın/.test(await page.locator('#ana').innerText()),'the lesson arrives next week');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'plan overflow');
   await page.screenshot({path:path.join(out,'personal-plan-next-week-'+width+'.png'),fullPage:true});
   // 3. Not in school: the setup asks no timetable, Ayarlar starts the full YKS plan.
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};ciz();});
   await page.locator('#kOgrAd').fill('Mezun');
   await page.locator('#kOgrOkul').selectOption('hayir');
   assert.equal(await page.locator('#kOgrSinif').isVisible(),false,'grade is hidden');
   assert.equal(await page.locator('#kOgrSube').isVisible(),false,'class is hidden');
   await page.locator('#kOgrSinav').waitFor();
   await page.locator('#kOgrAlan').selectOption('EA');
   await page.locator('#kOgrSinav').fill('2027-06-19');
   await page.screenshot({path:path.join(out,'no-school-setup-'+width+'.png'),fullPage:true});
   await page.locator('#kOgrBaslat').click();
   await page.getByRole('heading',{name:'Kendi YKS planın'}).waitFor();
   assert.equal(await page.evaluate(()=>D.ogr[0].okul===false&&D.ogr[0].alan==='EA'&&!D.konuPlani.benim),true);
   await page.locator('.kpSeviye[data-ders="Türkçe"]').selectOption('biraz');
   await page.locator('#kpBaslat').click();
   await page.waitForFunction(()=>D.ogr[0].kendiPlan&&D.ogr[0].kendiPlan.tur==='YKS');
   await page.getByText(/Kendi YKS planın başladı: \d+ konu, haftada yaklaşık \d+ yeni konu\. İlk konular bu haftanın planında\./).waitFor();
   await page.evaluate(()=>{EK.sekme='plan';EK.hafta=null;ciz();});
   // 3a. Genel tekrar comes first: one 2-hour row per subject, no topic yet.
   const ilkMetin=await page.locator('#ana').innerText();
   assert(/GENEL TEKRAR/.test(ilkMetin)&&/AYT Türk Dili ve Edebiyatı/.test(ilkMetin)&&/2 saat/.test(ilkMetin),'genel tekrar rows come first');
   assert((await page.evaluate(()=>gorunumOgrenciPlan())).includes('GENEL TEKRAR · AYT Türk Dili ve Edebiyatı · 2 saat'),'the row reads “GENEL TEKRAR · subject · 2 saat”');
   assert(!/Konu anlatımı\s+Kendi YKS planın/.test(ilkMetin),'no lesson before the genel tekrar items');
   assert(await page.getByText(/Önce genel tekrar: \d+ ders · ~\d+ saat/).count()===0,'the card lives in Ayarlar, not in the plan');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'genel tekrar overflow');
   await page.screenshot({path:path.join(out,'genel-tekrar-'+width+'.png'),fullPage:true});
   // Zaten yaptım on a genel tekrar row: it leaves the plan (confirm, then the page redraws at once).
   const gtSayi=()=>page.evaluate(()=>planHesapla(0,buHafta(0)).gunler.flat().filter(x=>x.genelTekrar).length);
   const once=await gtSayi();
   beklenenOnay=1;
   await page.locator('button[data-yaptim="gt"]:visible').first().click();
   await page.waitForFunction(n=>Object.keys(D.ogr[0].kendiPlan.genelTekrar.tamam).length===n,1);
   assert.equal(await page.evaluate(()=>Object.values(D.ogr[0].kendiPlan.genelTekrar.tamam)[0]===buHafta(0)-1),true,'dated the last day of the previous week');
   assert.equal(await page.locator('button[data-yaptim="gt"]:visible').count(),once-1,'the pressed row has no button any more');
   assert(/✓ Önceden yapıldı/.test(await page.locator('#ana').innerText()));
   // The rest of the genel tekrar items are watched; the week is rebuilt with the topics.
   await page.evaluate(()=>{const g=D.ogr[0].kendiPlan.genelTekrar;g.sira.forEach(k=>{g.tamam[k]=buHafta(0)-1;});
     Object.keys(D.elle).filter(k=>k.startsWith('0|')).forEach(k=>delete D.elle[k]);EK.sekme='plan';EK.hafta=null;ciz();});
   const metinKonu=await page.locator('#ana').innerText();
   assert(/Konu anlatımı\s+Kendi YKS planın/.test(metinKonu),'this week carries YKS lessons');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no-school plan overflow');
   await page.screenshot({path:path.join(out,'no-school-plan-'+width+'.png'),fullPage:true});
   // 3b. Zaten yaptım on a lesson: confirm, the row is done and the first test comes after the last day of the previous week.
   const ders=await page.evaluate(()=>{const p=planHesapla(0,buHafta(0));
     const x=p.gunler.flat().find(x=>x.anlatim);return {ki:x.ki,ad:x.ad};});
   beklenenOnay=1;
   await page.locator('button[data-yaptim="anlatim"][data-ki="'+ders.ki+'"]:visible').first().click();
   await page.waitForFunction(ki=>D.ogrIslenis[0][ki]===buHafta(0)-1,ders.ki);
   assert.equal(await page.locator('button[data-yaptim="anlatim"][data-ki="'+ders.ki+'"]').count(),0,'the lesson row has no button after it');
   assert.equal(await page.evaluate(ki=>anlatimTamamMi(planHesapla(0,buHafta(0)),ki,buHafta(0)+planHesapla(0,buHafta(0)).gunler.findIndex(l=>l.some(x=>x.ki===ki&&x.anlatim))),ders.ki),true);
   // 3c. Zaten yaptım on a test (the “Biraz” Türkçe checks): popup, İyi, saved at the last day of the previous week.
   const test=await page.evaluate(()=>{const p=planHesapla(0,buHafta(0));
     for(const l of p.gunler)for(const x of l)if(!x.anlatim&&!x.serbest&&kendiKonuMu(0,x.ki))return {ki:x.ki,slot:String(planSlotAnahtari(x))};return null;});
   assert(test,'a personal check test is on the paper');
   await page.locator('button[data-yaptim="test"][data-ki="'+test.ki+'"]:visible').first().click();
   const pencere=page.locator('#yaptimOrtu');
   await pencere.waitFor();
   assert(/geçen haftanın son günü sonucu/.test(await pencere.locator('#yaptimBaslik').innerText()));
   assert.equal(await pencere.locator('[data-sonuc-row]').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'popup overflow');
   assert.equal(await page.evaluate(()=>{const r=document.querySelector('#yaptimOrtu .pencere').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true,'popup inside the screen');
   await page.screenshot({path:path.join(out,'zaten-yaptim-'+width+'.png'),fullPage:false});
   await pencere.locator('[data-sonuc-not="3"]').click();
   await pencere.locator('#yaptimKaydet').click();
   await pencere.waitFor({state:'detached'});
   assert.deepEqual(await page.evaluate(ki=>D.log.filter(l=>l[2]===ki).map(l=>[l[0]===buHafta(0)-1,l[5]]),test.ki),[[true,3]],'the İyi result is stored at G');
   assert.equal(await page.evaluate(ki=>D.kart['0:'+ki].son===buHafta(0)-1,test.ki),true);
   assert.equal(await page.locator('button[data-yaptim="test"][data-ki="'+test.ki+'"]').count(),0);
   assert(/✓ Önceden yapıldı/.test(await page.locator('#ana').innerText()));
   // The main Sonuç gir page is untouched by the popup: its rows are its own.
   await page.evaluate(()=>{EK.sekme='giris';EK.hafta=null;ciz();});
   const anladim2=page.locator('#sonucBilgiAnladim');if(await anladim2.isVisible())await anladim2.click();
   assert.equal(await page.locator('#yaptimOrtu').count(),0);
   assert.equal(await page.locator('#ana [data-sade]').count(),0,'no popup row inside Sonuç gir');
   assert(await page.locator('.gAnlatim').count()>=1,'Sonuç gir keeps its own lesson rows');
   assert(/Önceden yapıldı/.test(await page.locator('#ana').innerText()),'the pre-done test shows as done in Sonuç gir');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Sonuç gir overflow');
   await page.evaluate(()=>{EK.sekme='plan';EK.hafta=null;ciz();});
   // 4. Another exam (KPSS): no school or field questions, the date is the student's own.
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};ciz();});
   await page.locator('#kOgrAd').fill('Aday');
   await page.locator('#kOgrSinavTuru').selectOption('KPSS');
   assert.equal(await page.locator('#kOgrOkul').isVisible(),false,'school question is hidden');
   assert.equal(await page.locator('#kOgrAlan').isVisible(),false,'field is hidden');
   assert.equal(await page.locator('#kOgrSinav').inputValue(),'','the YKS date is not offered for KPSS');
   await page.locator('#kOgrSinav').waitFor();
   await page.locator('#kOgrSinavTuru').selectOption('YKS');                       // back and forth keeps YKS intact
   assert.equal(await page.locator('#kOgrOkul').isVisible(),true);
   await page.locator('#kOgrSinavTuru').selectOption('KPSS');
   await page.locator('#kOgrSinav').fill('2027-07-11');
   await page.screenshot({path:path.join(out,'exam-setup-'+width+'.png'),fullPage:true});
   await page.locator('#kOgrBaslat').click();
   await page.getByRole('heading',{name:'Kendi KPSS planın'}).waitFor();
   assert.equal(await page.evaluate(()=>D.ogr[0].sinavTuru==='KPSS'&&D.ayar.sinav==='2027-07-11'),true);
   assert.equal(await page.locator('#ray button[data-sekme="mufredat"]').count(),0,'no Müfredat tab');
   assert.equal(await page.locator('#ray button[data-sekme="denemeler"]').count(),0,'no Denemelerim tab');
   await page.getByText('Kapsam ve kaynaklar').click();
   await page.getByText(/Genel Yetenek/).first().waitFor();
   assert(await page.locator('.kpSeviye[data-ders="Vatandaşlık"]').count()===1,'KPSS courses are listed');
   await page.locator('#kpHedef').fill('2026-12-15');
   await page.locator('#kpBaslat').click();
   await page.waitForFunction(()=>D.ogr[0].kendiPlan&&D.ogr[0].kendiPlan.tur==='KPSS');
   await page.evaluate(()=>{EK.sekme='plan';EK.hafta=null;ciz();});
   const metin=await page.locator('#ana').innerText();
   assert(/KPSS’ye giden yol/.test(await page.locator('.yks-yolu .etiket').first().textContent()),'countdown names KPSS');
   assert(/GENEL TEKRAR/.test(metin)&&/2 saat/.test(metin)&&!/TYT |AYT /.test(metin.split('Günlük soru hedeflerin')[0]),'this week starts with KPSS genel tekrar rows (no TYT/AYT prefix)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'exam plan overflow');
   await page.screenshot({path:path.join(out,'exam-plan-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('personal plan browser checks passed; screenshots in '+out);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
