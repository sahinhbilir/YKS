// Etüt etkisi on desktop and mobile: the page under Öğrenciler, the sentence and cards, the teacher table and its
// filter on the students, the etüt window, the lesson and exam pickers, the grade switch and no sideways scrolling
// on a phone. Synthetic merged students only (the same shape Öğrenci raporları gives the page); the merge itself
// is tested with its own page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-etutetki-'));fs.mkdirSync(out,{recursive:true});
// 24 students of 12. sınıf, three exams a week apart. 1–10 took Matematik etüts of A, 11–16 of B, 17–24 none (17, 18 took Fizik).
const E=[['27-YKS-1201','2026-10-07'],['27-YKS-1202','2026-10-14'],['27-YKS-1203','2026-10-21']];
const CHG=[3,2.5,3.5,2,4,3,2.8,3.2,2.2,3.8,1,0.5,1.5,1,0.8,1.2,0.5,1,0,0.8,0.2,0.7,0.4,0.4];
const oturum=(c,t,...d)=>d.map(x=>({date:x,course:c,teacher:t,minutes:40,time:900}));
const ogrenciler=CHG.map((chg,k)=>{const i=k+1,once=10+i*0.3,nets=[once-1,once,once+chg];
  const sessions=i<=10?oturum('MATEMATİK TYT','SENTETİK ÖĞRETMEN A','2026-10-16',...(i>4?['2026-10-19']:[])):i<=16?oturum('MATEMATİK TYT','SENTETİK ÖĞRETMEN B','2026-10-17'):i<=18?oturum('FİZİK','SENTETİK ÖĞRETMEN F','2026-10-16'):[];
  return {id:'o'+i,name:'SENTETİK ÖĞRENCİ '+String(i).padStart(2,'0'),cls:'12/'+(i%2?'A':'B'),sessions,
    exams:E.map(([exam,date],j)=>({exam,date,session:'TYT',nets:{mat:Math.round(nets[j]*100)/100,fizik:5+j}}))};});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-28T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(s=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-28';D.ogr=[];EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    OGRENCI_RAPOR.temelOgrenciler=()=>({students:structuredClone(s),warnings:[],etutKapsam:[[gunNo('2026-10-01'),gunNo('2026-10-31')]]});ciz();
   },ogrenciler);
   // The page sits under Öğrenciler, after Etütler.
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="etutetki"]').count(),1);
   assert.deepEqual(await page.locator('#ray #ogrencilerMenusu [data-sekme]').evaluateAll(l=>l.map(x=>x.dataset.sekme)),['takip','etutler','etutetki','etutplani','yoklama','ogrencirapor']);
   await page.evaluate(()=>{EK.sekme='etutetki';ciz()});
   await page.waitForSelector('#eeKok #eeHocalar');
   const cumle=()=>page.locator('#eeKok .et-cumle').innerText();
   // By default the whole run: the first exam against the latest, every etüt between.
   assert.match(await cumle(),/^27-YKS-1201 → 27-YKS-1203 \(7 Eki → 21 Eki\) · Matematik · iki deneme arasında etüt alan 16 öğrencinin neti ▲\d+,\d\d \(başta \d+,\d\d\), almayan 8 öğrencinin ▲\d+,\d\d \(başta \d+,\d\d\)\. Başlangıç netine göre fark [+−]?[\d,—]+ net \(ham \+\d+,\d\d\)\.$/);
   assert.equal(await page.locator('#eeKok .et-ozet-kart').count(),4);assert.equal(await page.locator('#eeKapsam').count(),0);
   // Teachers: a row for any etüt and one each; their students.
   assert.equal(await page.locator('#eeHocalar tbody tr').count(),3);
   assert.deepEqual(await page.locator('#eeHocalar .ee-ad').allInnerTexts(),['Sentetik Öğretmen A','Sentetik Öğretmen B']);
   assert.equal(await page.locator('#eeOgrenciler tbody tr').count(),16);
   assert.equal(await page.locator('#eeDoz tbody tr').count(),4);assert.equal(await page.locator('#eeSeri tbody tr').count(),2);
   assert.match(await page.locator('#eeSeri thead').innerText(),/İlk → son[\s\S]*Aralık ortalaması/);
   await page.locator('#eeHocalar .ee-ad',{hasText:'Öğretmen B'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('#eeOgrenciler tbody tr').length===6);
   assert.match(await page.locator('#eeOgrenciler h2').innerText(),/Etüt alan öğrenciler · Matematik · Sentetik Öğretmen B/);
   assert.equal(await page.locator('#eeHocalar tr.secili').count(),1);
   await page.locator('#eeOgrenciler [data-ee-hoca=""]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#eeOgrenciler tbody tr').length===16);
   // The window: the last 7 days, then back to the whole interval.
   await page.locator('[data-ee-pencere="7"]').click();
   await page.waitForFunction(()=>/son 7 günde/.test(document.querySelector('#eeKok .et-cumle').textContent));
   assert.equal(await page.locator('[data-ee-pencere="7"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-ee-pencere="0"]').click();
   await page.waitForFunction(()=>/iki deneme arasında/.test(document.querySelector('#eeKok .et-cumle').textContent));
   // A lesson and another exam pair.
   await page.locator('#eeDers').selectOption('Fizik');
   await page.waitForFunction(()=>/Öğretmenlere göre · Fizik/.test(document.querySelector('#eeHocalar h2').textContent));
   assert.deepEqual(await page.locator('#eeHocalar .ee-ad').allInnerTexts(),['Sentetik Öğretmen F']);
   await page.locator('#eeDers').selectOption('Matematik');
   await page.locator('#eeOnceki').selectOption('27-YKS-1202|2026-10-14');
   await page.waitForFunction(()=>/^27-YKS-1202 → 27-YKS-1203/.test(document.querySelector('#eeKok .et-cumle').textContent));
   assert.equal(await page.locator('#eeSimdi').inputValue(),'27-YKS-1203|2026-10-21');
   // A pair with no etüt between keeps the run's history.
   await page.locator('#eeSimdi').selectOption('27-YKS-1202|2026-10-14');
   await page.waitForFunction(()=>/^27-YKS-1201 → 27-YKS-1202[\s\S]*etüt alan öğrenci yok/.test(document.querySelector('#eeKok .et-cumle').textContent));
   assert.equal(await page.locator('#eeSeri tbody tr').count(),2);
   await page.locator('#eeSimdi').selectOption('27-YKS-1203|2026-10-21');
   await page.waitForFunction(()=>document.querySelectorAll('#eeOgrenciler tbody tr').length===16);
   // No page scrolls sideways (wide tables scroll in their own box).
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   await page.screenshot({path:path.join(out,'etutetkisi-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Etüt etkisi at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
