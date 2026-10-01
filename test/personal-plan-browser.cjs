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
  if(kur)kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2026-12-21');
  ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});
   page.on('dialog',async d=>{errors.push('dialog: '+d.message());await d.accept();});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   // 1. Start from the settings card.
   await page.evaluate(ogrenci,false);
   await page.getByRole('heading',{name:'Kendi TYT planın · isteğe bağlı'}).waitFor();
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
   assert(/Konu anlatımı\s+Kendi YKS planın/.test(await page.locator('#ana').innerText()),'this week carries YKS lessons');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no-school plan overflow');
   await page.screenshot({path:path.join(out,'no-school-plan-'+width+'.png'),fullPage:true});
   // 4. Another exam (KPSS): no school or field questions, the date is the student's own.
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};ciz();});
   await page.locator('#kOgrAd').fill('Aday');
   await page.locator('#kOgrSinavTuru').selectOption('KPSS');
   assert.equal(await page.locator('#kOgrOkul').isVisible(),false,'school question is hidden');
   assert.equal(await page.locator('#kOgrAlan').isVisible(),false,'field is hidden');
   assert.equal(await page.locator('#kOgrSinav').inputValue(),'','the YKS date is not offered for KPSS');
   await page.locator('.kDigerSinavNotu').waitFor();
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
   assert(/Konu anlatımı\s+Kendi KPSS planın/.test(metin),'this week carries KPSS lessons');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'exam plan overflow');
   await page.screenshot({path:path.join(out,'exam-plan-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('personal plan browser checks passed; screenshots in '+out);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
