// Okul dışı öğrenci picks one of the rehber's designed curricula (Tasarlanmış müfredatlar) as the topic order of
// Kendi YKS planın, starts it, then switches while it runs; on the method week a konu anlatımı dragged into Hafızam →
// Sepetin shows on its day, in the plan and in the report. Synthetic notebook built in the page, no Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-okul-disi-mufredat-'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});
  let onay=0;page.on('dialog',async d=>{if(onay>0&&d.type()==='confirm'){onay--;await d.accept();return;}errors.push('dialog: '+d.message());await d.accept();});
  await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
  await page.evaluate(()=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
    D.ogr=[{no:1,ad:'SENTETİK OKULDA',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}},
           {no:2,ad:'Sentetik Dışarıda',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}}];
    varsayilanKonuPlaniniHazirla('12-A','SAY',12);okulDisiYap(1,true);
    D.konuPlani['12-Fen hızlı']=JSON.parse(JSON.stringify(D.konuPlani['12-A'])).slice(0,20);D.konuPlani['9-Z']=sinifaGoreKonuPlani(9,'SAY');D.mufredatSinif={'9-Z':9,'12-Fen hızlı':12};
    D.ogr[1].syncId='s';D.ogr[1].ogrenciBulutId='b';
    D=paketiYukle(JSON.parse(JSON.stringify(ogrenciPaketi(1))));EK={ogr:0,sekme:'ayarlar',hafta:null,girisAcik:{}};ciz();
  });
  await page.getByRole('heading',{name:'Kendi YKS planın'}).waitFor();
  const secim=page.locator('#kpMufredat');
  assert.deepEqual(await secim.locator('option').allInnerTexts(),['Hazır YKS planı','12-A müfredatı · 12. sınıf · SAY','12-Fen hızlı müfredatı · 12. sınıf','9-Z müfredatı · 9. sınıf']);
  await secim.selectOption('12-Fen hızlı');
  await page.waitForFunction(()=>EK.kpMufredat==='12-Fen hızlı');
  await page.screenshot({path:path.join(out,'okul-disi-mufredat-secim-'+width+'.png'),fullPage:false});
  await page.locator('#kpBaslat').click();
  await page.waitForFunction(()=>D.ogr[0].kendiPlan&&D.ogr[0].kendiPlan.mufredat==='12-Fen hızlı');
  await page.evaluate(()=>{EK.sekme='ayarlar';ciz();});
  assert.equal(await page.locator('#kpMufredat').inputValue(),'12-Fen hızlı');
  const once=await page.evaluate(()=>D.ogr[0].kendiPlan.sira.length);
  onay=1;await page.locator('#kpMufredat').selectOption('9-Z');
  await page.waitForFunction(()=>D.ogr[0].kendiPlan.mufredat==='9-Z');
  assert.deepEqual(await page.evaluate(()=>[D.ogr[0].kendiPlan.sira.length>50,D.ogr[0].kendiPlan.sira.every(ki=>konuAl(ki)[1]===9)]),[true,true],'the grade-9 curriculum’s topics');
  assert(once>50);
  await page.getByText(/Konu sırası: 9-Z müfredatı\. \d+ konu kaldı\./).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'overflow');
  await page.screenshot({path:path.join(out,'okul-disi-mufredat-calisan-'+width+'.png'),fullPage:false});
  await page.evaluate(()=>{EK.sekme='plan';EK.hafta=null;ciz();});
  await page.getByRole('heading',{name:'Haftalık planın'}).waitFor();
  await page.screenshot({path:path.join(out,'okul-disi-mufredat-plan-'+width+'.png'),fullPage:false});
  // Hafızam → Sepetin on a method week: a dragged konu anlatımı lands on the day, in the weekly plan and in Raporum (PDF).
  await page.evaluate(()=>{EK.sekme='hafiza';EK.hafizaAnlatimAcik=true;ciz();});
  const cip=page.locator('#hfAnlatim .hf-anl').first(),ad=(await cip.innerText()).trim(),ki=+(await cip.getAttribute('data-hf-surukle')).split(':')[1];
  const pazar=page.locator('#hfSepet [data-hf-gun]').filter({hasText:'Pazar'});
  await page.evaluate(()=>{const c=document.querySelector('#hfAnlatim .hf-anl'),g=[...document.querySelectorAll('#hfSepet [data-hf-gun]')].find(e=>/Pazar/.test(e.textContent));
    const dt=new DataTransfer();c.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
    g.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));g.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));});
  await pazar.locator('li').filter({hasText:ad}).waitFor();
  assert.match(await pazar.locator('li').filter({hasText:ad}).innerText(),/konu anlatımı/);
  assert.equal(await page.evaluate(ki=>planHesapla(0,buHafta(0)).gunler[6].some(x=>x.ki===ki&&x.anlatim),ki),true,'the lesson is in the weekly plan');
  assert.match(await page.evaluate(()=>hafizaRaporu(0)),/konu anlatımı · sepette/,'and in the PDF report');
  await page.screenshot({path:path.join(out,'okul-disi-mufredat-sepet-'+width+'.png'),fullPage:false});
  await pazar.locator('li').filter({hasText:ad}).locator('[data-hf-cikar]').click();
  await page.waitForFunction(ki=>!planHesapla(0,buHafta(0)).gunler[6].some(x=>x.ki===ki),ki);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 await browser.close();console.log('okul dışı müfredat seçimi browser checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
