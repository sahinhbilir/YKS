// Hafızam in a real browser: every taught topic listed, long silence in red, a topic card dragged onto a day of the basket,
// a mixed study dropped on "Her gün", the Düzenle sliders (live preview, saved state), a lesson's forgetting speed, and on a
// phone the tap path (Sepete → day). 1280 px light and 390 px dark; no sideways scrolling. Synthetic student, no Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-hafizam-'));fs.mkdirSync(out,{recursive:true});
const kur=()=>{
  D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'Sentetik Öğrenci',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},
    dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];
  EK={ogr:0,sekme:'hafiza',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};
  kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2027-04-23');
  const bugun=bugunNo(),bu=buHafta(0),kagit=new Set(planHesapla(0,bu).gunler.flat().map(x=>x.ki));
  const disari=D.ogr[0].kendiPlan.sira.filter(k=>!kagit.has(k));
  // Three topics taught in class (10, 25 and 40 days ago) and one with a result five days ago.
  D.ogrIslenis={0:{[disari[0]]:bugun-10,[disari[1]]:bugun-25,[disari[2]]:bugun-40}};
  sonucIsle(0,[{ki:disari[3],gun:bugun-5,not:3,dogru:null,soru:null}]);
  window.__ki=disari.slice(0,4);ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('dialog: '+d.message());d.accept()});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   // Wait for the app's own start-up (it loads the stored notebook) to finish before setting up the synthetic student.
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(kur);await page.locator('.hafiza-sayfa').waitFor();
   const [kiA,kiB,kiC,kiD]=await page.evaluate(()=>window.__ki);
   // Every taught topic is there; 25 and 40 days without a result are red.
   for(const ki of [kiA,kiB,kiC,kiD])assert.equal(await page.locator(`[data-hf-ki="${ki}"]`).count(),1,'topic '+ki+' listed');
   assert.equal(await page.locator('.hf-oge.hf-eski').count(),2);assert.match(await page.locator(`[data-hf-ki="${kiC}"] .hf-eski-not`).innerText(),/40 gündür hiç sonucun yok/);
   const kirmizi=await page.evaluate(k=>getComputedStyle(document.querySelector(`[data-hf-ki="${k}"] .hf-eski-not`)).color,kiC);
   const [r,g]=kirmizi.match(/\d+/g).map(Number);assert(r>g,'the note is red: '+kirmizi);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways scrolling');
   const bugunG=await page.evaluate(()=>bugunNo()-buHafta(0)),gunKutu=page.locator(`#hfSepet [data-hf-gun="${bugunG}"]`);
   // A real drag with the mouse (HTML5 drag and drop): press on the item, move onto the day, release.
   // The basket docks at the bottom of the window once the drag starts, so the day is measured then.
   const surukle=async(kaynak,hedef)=>{await kaynak.scrollIntoViewIfNeeded();const a=await kaynak.boundingBox();
     await page.mouse.move(a.x+20,a.y+12);await page.mouse.down();await page.mouse.move(a.x+40,a.y+30,{steps:3});
     const sb=await page.locator('#hfSepet').boundingBox();assert(sb.y<900&&sb.y+sb.height<=900+1,'the basket is docked in view while dragging: '+JSON.stringify(sb));
     const h=await hedef.boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2,{steps:8});await page.mouse.up()};
   if(width>600){
    // Drag a topic card onto today: it goes into today's plan and shows in the basket.
    // Onto tomorrow (overdue taught topics are on today's plan by themselves): it becomes the student's own study that day.
    const yarin=bugunG+1,yarinKutu=page.locator(`#hfSepet [data-hf-gun="${yarin}"]`);
    const yarinki=await page.evaluate(g=>planHesapla(0,buHafta(0)).gunler[g].map(x=>x.ki),yarin),ekle=[kiB,kiA,kiC,kiD].find(k=>!yarinki.includes(k));
    await surukle(page.locator(`.hf-oge[data-hf-ki="${ekle}"]`),yarinKutu);
    await page.waitForFunction(([k,g])=>{const hb=buHafta(0),p=planHesapla(0,hb);return p.gunler[g].some(x=>x.ki===k&&(p.elle.ogrEk||{})[planSlotAnahtari(x)])},[ekle,yarin]);
    await page.locator('#hfSepet .hf-gun li').first().waitFor();assert.match(await yarinKutu.innerText(),/×/);
    // A topic that is on today's plan already is not added twice; the page says so.
    const bugunku=await page.evaluate(()=>planHesapla(0,buHafta(0)).gunler[bugunNo()-buHafta(0)].map(x=>x.ki)),zaten=[kiA,kiB,kiC,kiD].find(k=>bugunku.includes(k));
    if(zaten!==undefined){await surukle(page.locator(`.hf-oge[data-hf-ki="${zaten}"]`),gunKutu);await page.getByText('Bu konu seçtiğin planda zaten var').first().waitFor()}
    // A mixed study onto "Her gün".
    await surukle(page.locator('#hfSepet [data-hf-surukle="ek:paragraf"]'),page.locator('#hfSepet [data-hf-gun="her"]'));
    await page.waitForFunction(()=>gunlukEkSorusu(0,'paragraf',bugunNo())===20);
    // Düzenle: the sliders write their result before saving; Kaydet keeps the student's own state.
    await page.locator(`.hf-oge[data-hf-ki="${kiA}"] .hf-diger>summary`).click();   // the extra actions are folded under "Diğer"
    await page.locator(`[data-hf-duzenle="${kiA}"]`).click();const ed=page.locator(`[data-hf-duzen="${kiA}"]`);await ed.waitFor();
    await ed.locator('[data-hf-r]').fill('95');await ed.locator('[data-hf-s]').fill('14');
    assert.equal(await ed.locator('[data-hf-r-yazi]').innerText(),'%95');assert.equal(await ed.locator('[data-hf-s-yazi]').innerText(),'180 günde');
    assert.match(await ed.locator('[data-hf-onizle]').innerText(),/çizginin altına \d+ gün sonra iner/);
    await ed.locator(`[data-hf-kaydet="${kiA}"]`).click();
    await page.waitForFunction(k=>D.ogr[0].hafizaElle&&D.ogr[0].hafizaElle[k]&&D.ogr[0].hafizaElle[k].r===0.95&&D.ogr[0].hafizaElle[k].s===180,kiA);
    // The page is drawn again once the save is done.
    await page.waitForFunction(k=>/%95[\s\S]*kendi ayarın \(bugün\)/.test(document.querySelector(`[data-hf-ki="${k}"] .hf-yazi`)?.innerText||''),kiA);
    // A lesson's speed.
    await page.locator('.hf-ayar>summary').click();   // the settings are folded at the end of the page
    await page.locator('.hf-dersler summary').click();const sec=page.locator('.hf-dersler select').first(),ders=await sec.getAttribute('data-hf-ders');
    await sec.selectOption('2');await page.waitForFunction(d=>(D.ogr[0].unutmaDers||{})[d]===2,ders);
    // Raporum (PDF), as the button prints it: laid out like the weekly plan, A4 landscape, a column per day (a second sheet only
    // when a day's studies do not fit; this notebook's today has more than a dozen).
    await page.evaluate(()=>{const st=document.createElement('style');st.id='hfSayfaStili';st.textContent='@media print{@page{size:A4 landscape;margin:8mm}}';document.head.appendChild(st);document.body.classList.add('hf-yazdir')});
    const pdf=await page.pdf({preferCSSPageSize:true});require('node:fs').writeFileSync(path.join(out,'hafizam-rapor.pdf'),pdf);
    const metin=pdf.toString('latin1');assert((metin.match(/\/Type\s*\/Page\b(?!s)/g)||[]).length<=2,'the report is one or two sheets');
    assert.equal(await page.evaluate(()=>{document.body.classList.remove('hf-yazdir');const t=document.querySelector('#hfRapor table.plan.hf-r-tablo');return t.querySelectorAll('thead th').length===t.querySelectorAll('tbody td').length&&t.querySelectorAll('thead th').length>=5}),true,'a column per day');
    assert(/\/MediaBox\s*\[\s*0\s+0\s+84[12](\.\d+)?\s+59[45](\.\d+)?\s*\]/.test(metin),'A4 landscape');
    await page.evaluate(()=>{document.body.classList.remove('hf-yazdir');document.getElementById('hfSayfaStili')?.remove()});
    await page.screenshot({path:path.join(out,'hafizam-'+width+'-'+tema+'.png'),fullPage:true});
   }else{
    // Phone: no dragging needed. "Sepete" picks the topic, a day takes it.
    const yarin=bugunG+1,yarinki=await page.evaluate(g=>planHesapla(0,buHafta(0)).gunler[g].map(x=>x.ki),yarin),ekle=[kiD,kiC,kiB,kiA].find(k=>!yarinki.includes(k));
    await page.locator(`[data-hf-sec="konu:${ekle}"]`).click();await page.locator('#hfSepet.hf-sepet-secili .hf-gun.hf-hedef').first().waitFor();
    await page.locator(`#hfSepet [data-hf-gun="${yarin}"]`).click();
    await page.waitForFunction(([k,g])=>{const hb=buHafta(0),p=planHesapla(0,hb);return p.gunler[g].some(x=>x.ki===k&&(p.elle.ogrEk||{})[planSlotAnahtari(x)])},[ekle,yarin]);
    await page.locator(`#hfSepet [data-hf-gun="${yarin}"] li`).first().waitFor();   // drawn again after the save
    assert.equal(await page.evaluate(()=>EK.hafizaSepet),undefined,'the pick is cleared');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways scrolling on a phone');
    await page.locator('#hfSepet').screenshot({path:path.join(out,'hafizam-sepet-'+width+'-'+tema+'.png')});
    await page.screenshot({path:path.join(out,'hafizam-'+width+'-'+tema+'.png'),fullPage:true});
   }
   assert.deepEqual(errors,[]);await context.close();console.log('PASS Hafızam at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
