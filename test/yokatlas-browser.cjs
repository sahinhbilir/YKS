// Synthetic students and exams, real public catalogue; intercept every network request.
// Teacher view at 1280 and 390, plus the student menu/route check; no horizontal scroll.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const catalog=fs.readFileSync('data/yokatlas.json','utf8');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-yokatlas-'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  let fail=true;
  await context.route('**/*',r=>{
   const u=r.request().url();requests.push(u);
   if(u==='http://localhost/data/yokatlas.json')return r.fulfill({status:fail?503:200,contentType:'application/json',body:catalog});
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   return r.abort();
  });
  const sigmaz=()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof varsayilan==='function'&&ACILIS_KAYIT>=0);
  await page.evaluate(()=>{
   D=varsayilan();D.rol='ogrenci';D.ogr=[{no:1,ad:'SENTETİK ADA',sube:'12-C',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,denemeHedef:{TYT:50}}];
   EK.ogr=0;EK.sekme='plan';kaydet=async()=>true;ogrenciEsitlemePlanla=()=>{};
   const kayit=(ot,ad,tarih,tur,oran,atla=[])=>({id:'p:'+ad,ad,tarih,tur:ot,oturum:ot,sinavTuru:tur,alan:'SAY',sure:null,puan:300,ts:1,
    dersler:DENEME_DERSLER[ot].filter(d=>!atla.includes(d[0])&&(ot==='TYT'||DENEME_ALAN.SAY.includes(d[0]))).map(([kod,,soru])=>({kod,soru,dogru:kod==='sf'?0:Math.floor(soru*oran),yanlis:0}))});
   D.ogr[0].denemeOkul=[kayit('TYT','Tarama TYT 1','2026-10-02','tarama',.5),kayit('AYT','Tarama AYT 1','2026-10-09','tarama',.45),kayit('TYT','Genel TYT 2','2026-10-16','genel',.7),kayit('AYT','Genel AYT 2','2026-10-23','genel',.6),kayit('TYT','Eksik TYT 3','2026-10-30','tarama',.8,['fizik'])];
   ciz();
  });
  // 0) Students have no Üniversite Hedefi: not in the menu, and a restored/typed route lands on the plan.
  assert.equal(await page.locator('#ray [data-sekme="universite"]').count(),0,'student menu has no Üniversite Hedefi');
  assert(!(await page.locator('#ray').innerText()).includes('Üniversite Hedefi'));
  await page.evaluate(()=>{EK.sekme='universite';ciz()});
  assert.equal(await page.evaluate(()=>EK.sekme),'plan','student route redirects to the plan');assert.equal(await page.locator('#yaKok').count(),0);
  // The teacher reaches the page from the Denemeler menu and sees the selected student.
  await page.evaluate(()=>{D.rol='rehber';EK.sekme='plan';ciz()});
  assert.equal(await page.locator('#denemelerMenusu [data-sekme="universite"]').count(),1,'teacher menu has the page');
  await page.locator('#denemelerMenusu [data-sekme="universite"]').evaluate(el=>el.click());
  await page.locator('#yaKok').waitFor();assert.equal(await page.evaluate(()=>EK.sekme),'universite');
  await page.locator('[data-ya-retry]').waitFor();fail=false;await page.locator('[data-ya-retry]').click();
  await page.locator('.ya-liste .ya-row').first().waitFor();
  const lists=()=>page.locator('.ya-liste');
  assert.equal(await page.locator('.ya-liste').nth(0).locator('.ya-row').count(),24);assert.equal(await page.locator('.ya-liste').nth(1).locator('.ya-row').count(),24);
  const tahmin=await page.locator('.ya-tahmin').innerText();
  assert.match(tahmin,/Tahmini SAY puanın ≈ \d{3},\d ± \d,\d puan · başarı sırası ≈ [\d.]+/);assert.match(tahmin,/\(diploma notu girilmedi, 95 \(OBP 475\) sayıldı\)/);
  assert(!/NaN|undefined/.test(await page.locator('#yaKok').innerText()));
  assert.match(await page.locator('#yaKok h2').allInnerTexts().then(t=>t.join('|')),/Yükselirsen\|Düşersen \/ şu an/);
  // the latest usable exams (Genel ones) are the centre; the incomplete newest TYT is skipped
  assert.match(await page.locator('.ya-kaynak-net').innerText(),/23\.10\.2026/);
  // order: above list, the line, below list; each above row shows +X puan and sits above the estimate
  const kutu=async s=>page.locator(s).first().boundingBox();
  const ustSon=await page.locator('.ya-liste').nth(0).locator('.ya-row').last().boundingBox(),cizgi=await kutu('.ya-cizgi'),altIlk=await page.locator('.ya-liste').nth(1).locator('.ya-row').first().boundingBox();
  assert(ustSon.y<cizgi.y&&cizgi.y<altIlk.y,'line sits between the lists');
  assert.equal(await page.locator('.ya-liste').nth(0).locator('.ya-fark').count(),24);assert.equal(await page.locator('.ya-liste').nth(1).locator('.ya-fark').count(),0);
  const puanlar=await page.locator('.ya-liste').nth(0).locator('.ya-puan b').allInnerTexts();const sayi=t=>+t.replace(',','.');
  assert(puanlar.every((t,i,l)=>!i||sayi(l[i-1])>=sayi(t)),'nearest last');
  assert(await sigmaz(),'no horizontal overflow (teacher)');
  // 1) Centre: every exam, Genel and Tarama, unusable ones disabled with the reason
  await page.locator('#yaMerkez').selectOption('sec');
  const tytSecenek=await page.locator('#yaTYT option').evaluateAll(l=>l.map(o=>[o.textContent,o.disabled]));
  assert.equal(tytSecenek.length,3);assert(tytSecenek.some(([t])=>/Genel TYT 2/.test(t))&&tytSecenek.some(([t])=>/Tarama TYT 1/.test(t)));
  assert(tytSecenek.some(([t,d])=>d&&/Eksik TYT 3 · eksik: Fizik/.test(t)),'an exam with a missing test is shown, disabled');
  const once=await page.locator('.ya-tahmin').innerText();
  await page.locator('#yaTYT').selectOption('p:Tarama TYT 1');await page.locator('#yaAYT').selectOption('p:Tarama AYT 1');
  assert.notEqual(await page.locator('.ya-tahmin').innerText(),once,'an earlier exam moves the estimate');
  assert.equal(await page.locator('.ya-liste .ya-row').count(),48);
  // Gidişat (the Öğrenci kartı projection) is offered when the model can compute it
  await page.locator('#yaMerkez').selectOption('son');
  assert.equal(await page.locator('#yaMerkez option[value="gidisat"]').evaluate(o=>o.disabled),true,'no school lists: Gidişat is disabled with its reason');
  assert.match(await page.locator('#yaMerkez option[value="gidisat"]').innerText(),/sıralama/);
  await page.evaluate(()=>{D.ayar.sinav='2027-06-20';ANALIZ.kart=(no,key)=>({durum:'tamam',oturum:{key},gidisat:{var:true,yks:{net:key==='TYT'?100:60}}})});
  await page.locator('#yaSearch').fill('x');await page.locator('#yaSearch').fill('');
  await page.locator('#yaMerkez').selectOption('gidisat');
  assert.match(await page.locator('.ya-cizgi').innerText(),/YKS günü: TYT netin: 100 · AYT netin: 60/);
  await page.locator('#yaMerkez').selectOption('son');
  // 2) Alan: disabled where the AYT lacks the alan's tests
  assert.equal(await page.locator('#yaField option[value="EA"]').evaluate(o=>o.disabled),true);assert.match(await page.locator('#yaField option[value="EA"]').innerText(),/eksik:/);
  // 3) Daha fazla reveals 24 more each way
  await page.locator('[data-ya-more]').first().click();
  assert.equal(await page.locator('.ya-liste').nth(0).locator('.ya-row').count(),48);assert.equal(await page.locator('.ya-liste').nth(1).locator('.ya-row').count(),48);
  // 4) Diploma notu moves the estimate, saved on the student
  const t80=await page.locator('.ya-tahmin').innerText();
  await page.locator('#yaDiploma').fill('92,5'.replace(',','.'));await page.locator('#yaDiploma').blur();
  await page.waitForFunction(()=>D.ogr[0].diplomaNotu===92.5);
  assert(!/diploma notu girilmedi/.test(await page.locator('.ya-tahmin').innerText()));assert.notEqual(await page.locator('.ya-tahmin').innerText(),t80);
  await page.locator('#yaDiploma').fill('120');await page.locator('#yaDiploma').blur();
  await page.waitForFunction(()=>/50 ile 100/.test(document.getElementById('yaStatus').textContent));assert.equal(await page.evaluate(()=>D.ogr[0].diplomaNotu),92.5);
  await page.locator('.ya-cizgi').evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.top-window.innerHeight/2)});
  await page.screenshot({path:path.join(out,'universite-'+width+'.png'),fullPage:false});
  // 5) Hedef (set by the teacher): pinned, highlighted, the net goals untouched until the explicit button
  const ilk=page.locator('.ya-liste').nth(1).locator('.ya-row').first();const hedefId=await ilk.getAttribute('data-ya-id');
  assert.equal(await ilk.locator('[data-ya-target]').innerText(),'Hedef olarak seç');
  await page.evaluate(()=>{D.ogr[0].ogrCalismaTs=1});
  await ilk.locator('[data-ya-target]').click();await page.locator('.ya-hedef').waitFor();
  assert.equal(await page.evaluate(()=>D.ogr[0].ogrCalismaTs),1,'a teacher-owned target leaves the student work clock alone, so the next student packet still applies');
  assert.equal(await page.evaluate(()=>Object.keys(D.ogr[0].universiteHedef).sort().join(',')),'alan,id,surum,yil');
  assert.equal(await page.evaluate(()=>JSON.stringify(D.ogr[0].denemeHedef)),'{"TYT":50}','selecting a target leaves denemeHedef alone');
  assert.match(await page.locator('.ya-hedef').innerText(),/hedefin üstünde|Hedefe \+[\d,]+ puan/);
  assert(await page.locator('.ya-secili').count()>=2,'highlighted in the list and pinned');
  assert.equal(await page.locator('[data-ya-netler]').innerText(),'Net hedeflerini bu programa göre ayarla');assert.equal(await page.locator('[data-ya-clear]').innerText(),'Hedefi kaldır');
  await page.locator('[data-ya-netler]').click();
  await page.waitForFunction(()=>D.ogr[0].denemeHedef.TYT>50&&D.ogr[0].denemeHedef.AYT>0);
  assert(!await page.evaluate(()=>JSON.stringify(ogrenciCalismaPaketi()).includes('catalogYear')));
  assert(await sigmaz(),'no horizontal overflow (target)');
  // 6) Filters apply to both lists; a search finds programmes without puan data
  await page.locator('#yaSearch').fill('bilgisayar');
  for(const i of [0,1])assert((await page.locator('.ya-liste').nth(i).innerText()).toLocaleLowerCase('tr-TR').includes('bilgisayar'));
  await page.locator('#yaSearch').fill('');
  await page.locator('#yaCity').selectOption('35');
  assert((await page.locator('.ya-liste .ya-uni').allInnerTexts()).every(t=>/\(İzmir\)/.test(t)));
  await page.locator('#yaCity').selectOption('');
  await page.locator('#yaType').selectOption('VAKIF');assert(!(await page.locator('.ya-liste .ya-uni').allInnerTexts()).some(t=>/Devlet/.test(t)));await page.locator('#yaType').selectOption('');
  assert(await sigmaz(),'no horizontal overflow (filters)');
  assert(!requests.some(u=>u.includes('yokatlas.yok.gov.tr')),'no student data sent to YÖK');
  // 7) Teacher: clears the target; a read-only teacher cannot change anything
  await page.locator('[data-ya-clear]').click();await page.waitForFunction(()=>D.ogr[0].universiteHedef===null);assert.equal(await page.locator('.ya-hedef').count(),0);
  await page.evaluate(()=>{yalnizcaGoruntuleme=()=>true;ciz()});await page.locator('#yaStudent').waitFor();
  assert.equal(await page.locator('[data-ya-target]').count(),0);assert.equal(await page.locator('#yaDiploma').isDisabled(),true);
  await page.evaluate(()=>{yalnizcaGoruntuleme=()=>false;ciz()});await page.locator('#yaStudent').waitFor();
  assert.equal(await page.locator('[data-ya-target]').count()>0,true);
  assert(await sigmaz(),'no horizontal overflow (teacher)');
  await page.evaluate(()=>window.scrollTo(0,0));if(width===1280)await page.screenshot({path:path.join(out,'universite-ogretmen-'+width+'.png'),fullPage:false});
  assert.deepEqual(errors,[]);console.log('PASS university lists, centre, estimate, target, diploma notu, filters and teacher view',width);await context.close();
 }}finally{await browser.close()}
 console.log('Screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
