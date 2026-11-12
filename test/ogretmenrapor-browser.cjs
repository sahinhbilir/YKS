// Öğretmen raporu on desktop and phone, light and dark: a section per teacher, the net chart drawn at its box's width, the topic
// grid in red (behind) and green (ahead), no sideways scrolling, the teacher filter, and the print layout (one teacher per page,
// no toolbar). Synthetic school only: the timetables, the school lists and Konu Takibi are built in the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-ogretmenrapor-'));fs.mkdirSync(out,{recursive:true});
const kur=()=>{
  D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-30';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
  const p=ETUTPLANI.oku().plan,SA=['09.00','10.00'];
  p.programlar={'12/A':{kod:'301',ts:1,saatler:SA,dersler:[[0,'09.00','TYT MATEMATİK','SENTETİK ÖĞRETMEN AY'],[0,'10.00','TÜRK DİLİ VE EDEBİYATI','SENTETİK ÖĞRETMEN DE']]},
    '12/B':{kod:'201',ts:1,saatler:SA,dersler:[[0,'09.00','MATEMATİK','SENTETİK ÖĞRETMEN AY'],[0,'10.00','TÜRK DİLİ VE EDEBİYATI','SENTETİK ÖĞRETMEN DE']]}};
  D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)));
  // School lists as ANALIZ.kaynak gives them: six exams, 20 students in two classes.
  const kisi=new Map(),sinavlar=[],tr={};
  for(let i=0;i<20;i++){const no=String(1001+i);kisi.set(no,{no,ad:'SENTETİK ÖĞRENCİ '+i,sinif:i%2?'12/B':'12/A'})}
  for(let e=0;e<6;e++){const ad=e===5?'SENTETİK YAYINLARI TÜRKİYE GENELİ TYT 27-YKS-1206':'27-YKS-120'+(e+1),tyt={};tr[ad]={'MATEMATİK-T':10+e*.4,'TÜRKÇE-T':22+e*.3};
    for(let i=0;i<20;i++){const no=String(1001+i);tyt[no]={no,net:{MAT:9+(i%7)+e*.6,TÜR:21+(i%5)+e*.2}}}
    sinavlar.push({id:'s'+e,ad,g:gunNo('2026-09-0'+1)+e*14,tyt,ayt:{}})}
  const K={t:{sinavlar,kisi},trFn:ad=>tr[ad]?{genel:k=>tr[ad][k]??null}:null};ANALIZ.kaynak=()=>K;
  // Konu Takibi: three exams, Türkçe; the class answers differ by topic so the grid has red and green rows.
  const kt=KONU_TAKIBI,reps=[],parts=[],kodlar=['T.12.1.1','T.12.1.1','T.12.1.2','T.12.1.2','T.12.3.1','T.12.3.1','T.12.5.1','T.12.5.1'],p0=[.5,.5,.9,.9,.2,.2,.6,.6];
  for(let e=1;e<=3;e++){const ad=e===3?'SENTETİK YAYINLARI TÜRKİYE GENELİ KONU-3':'SENTETİK-KONU-'+e,blocks=[];
    for(let i=0;i<20;i++){const s={name:'SENTETİK ÖĞRENCİ '+i,no:String(1001+i),cls:(i%2?'201 12/B':'301 12/A')};
      const d=[[2,i%3?0:1],[2,i%4?0:1],[2,2],[2,i%2?2:1]];
      blocks.push({student:s,course:'TÜRKÇE-T',kind:'outcome',rows:[{code:'T.12.1.1',name:'a',c:[2,d[0][1],2-d[0][1],0]},{code:'T.12.1.2',name:'b',c:[2,d[1][1],2-d[1][1],0]},{code:'T.12.3.1',name:'c',c:[2,d[2][1],2-d[2][1],0]},{code:'T.12.5.1',name:'d',c:[2,d[3][1],2-d[3][1],0]}]})}
    reps.push({ad,blocks});parts.push({tur:'ozet',ad,oturum:'TYT',dersler:{'TÜRKÇE-T':kodlar.map(k=>[k])}},{tur:'turkiye',ad,oturum:'TYT',dersler:{'TÜRKÇE-T':p0}})}
  const v=kt.merge(kt.blank(),reps,parts);v.exams.forEach((x,i)=>x.date='2026-10-0'+(i+1));D.konutakibi=v;
  OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]});
  EK.sekme='ogretmenrapor';ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(kur);
   await page.locator('#ogrKok').waitFor();await page.waitForFunction(()=>document.querySelectorAll('#ogrKok .ogr-grafik svg').length>=2);
   assert.equal(await page.locator('.ogr-ogretmen').count(),2);assert.deepEqual(await page.locator('.ogr-ogretmen h2').allInnerTexts(),['Sentetik Öğretmen Ay','Sentetik Öğretmen De']);
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#ogrKok .ogr-grafik')].every(k=>{const s=k.querySelector('svg');return s&&Math.abs(Number(s.getAttribute('width'))-k.clientWidth)<=1})),true,'charts at their box width');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways scrolling');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#ogrKok .et-panel')].every(p=>p.scrollWidth<=p.clientWidth+1)),true,'panels do not overflow (the grid scrolls inside its box)');
   // The grid: a red row and a green row, the red one first; the deepest cells have white text.
   const iz=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#ogrKok .ogr-iz tbody tr')];
     const rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number);
     return rows.map(r=>{const c=r.querySelector('td.ogr-iz-h'),b=rgb(getComputedStyle(c).backgroundColor);return {ad:r.querySelector('th').textContent,metin:c.textContent,r:b[0],g:b[1],renk:getComputedStyle(c).color}})});
   assert(iz.length>=3,JSON.stringify(iz));assert(iz[0].metin.startsWith('−'),'most behind first: '+JSON.stringify(iz[0]));
   assert(iz[0].r>iz[0].g,'behind is red: '+JSON.stringify(iz[0]));const yesil=iz.find(x=>x.metin.startsWith('+'));assert(yesil&&yesil.g>yesil.r,'ahead is green: '+JSON.stringify(yesil));
   // The takeaway and reading guide are visible without hovering or opening the formulas, including on phones.
   const report=page.locator('.ogr-ogretmen').nth(1);
   assert.match(await report.locator('.ogr-ozet').innerText(),/avantajınız azaldı\. Tekrar önceliği: Sözcükte Anlam\./);
   assert.deepEqual(await report.locator('.ogr-iz-sinav>span').allTextContents(),['SENTETİK-KONU-1','SENTETİK-KONU-2','SENTETİK YAYINLARI TÜRKİYE GENELİ KONU-3']);
   assert.equal(await report.locator('.ogr-sinav-adi').last().getAttribute('aria-label'),'SENTETİK YAYINLARI TÜRKİYE GENELİ TYT 27-YKS-1206');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.ogr-net')].every(svg=>{
    const labels=[...svg.querySelectorAll('.ogr-sinav-adi')],w=svg.viewBox.baseVal.width,h=svg.viewBox.baseVal.height;
    return labels.every((el,i)=>{
     const box=el.getBBox(),previous=i?labels[i-1].getBBox():null;
     return [...el.querySelectorAll('tspan')].map(x=>x.textContent).join('').replace(/\s/g,'')===el.getAttribute('aria-label').replace(/\s/g,'')&&
      box.x>=0&&box.x+box.width<=w&&box.y+box.height<=h&&(!previous||previous.x+previous.width<=box.x);
    });
   })),true,'full exam names fit without overlapping on desktop and phones');
   for(const selector of ['.ogr-ozet','.ogr-iz-aciklama','.ogr-olcek','.ogr-iz-not']){
    const item=report.locator(selector);assert(await item.isVisible(),selector+' visible');
    const box=await item.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,selector+' readable without sideways scrolling');
   }
   // A tall element screenshot scrolls the fixed menu over the report; hide it only in the captured image.
   await page.locator('.ogr-ogretmen').nth(1).screenshot({path:path.join(out,'ogretmen-raporu-'+width+'-'+tema+'.png'),style:'#ray{visibility:hidden}'});
   // The formulas and raw numbers fold out.
   const det=page.locator('.ogr-ogretmen').nth(1).locator('.ogr-formul').first();await det.locator('summary').click();
   assert.match(await det.innerText(),/Fark = 100 · \(d − b\) \/ n puan/);
   // The raw topic table is built when the box opens.
   await det.locator('.ogr-ham-konu table tbody tr').first().waitFor();assert((await det.locator('.ogr-ham-konu table tbody tr').count())>=3,'raw topic rows');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'formulas open: no sideways scrolling');
   await det.locator('summary').click();
   // One teacher.
   await page.locator('#ogrHoca').selectOption({label:'Sentetik Öğretmen De'});await page.waitForFunction(()=>document.querySelectorAll('.ogr-ogretmen').length===1);
   assert.equal(await page.locator('.ogr-ogretmen h2').innerText(),'Sentetik Öğretmen De');
   await page.locator('#ogrHoca').selectOption('');await page.waitForFunction(()=>document.querySelectorAll('.ogr-ogretmen').length===2);
   // Sınıf düzeyi: 12. sınıf (every synthetic class is a 12th-grade one).
   await page.locator('#ogrDuzey').selectOption('12');await page.waitForFunction(()=>/12\. sınıf/.test(document.querySelector('#ogrKok .et-baslik').textContent));
   assert.equal(await page.locator('.ogr-ogretmen').count(),2);await page.locator('#ogrDuzey').selectOption('');
   await page.waitForFunction(()=>document.querySelectorAll('#ogrKok .ogr-grafik svg').length>=2);
   // Every value is written on the chart: the gaps and both nets.
   assert(await page.locator('#ogrKok .ogr-grafik text.ogr-deger').count()>=12,'values on the chart');
   // Print: no toolbar, each teacher on a new page.
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('#ogrKok .et-arac').isVisible(),false,'no toolbar in print');
   for(const selector of ['.ogr-ozet','.ogr-iz-aciklama','.ogr-olcek','.ogr-iz-not'])assert(await report.locator(selector).isVisible(),selector+' kept in print');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelectorAll('.ogr-ogretmen')[1]).breakBefore),'page','each teacher on its own page');
   // In print the charts are drawn again at the paper's width and keep the subject's colour (the screen theme's colours do not
   // reach print); the topic cells keep their fills.
   await page.evaluate(()=>OGRETMEN_RAPOR.grafikleriCiz());
   const yaz=await page.evaluate(()=>{const k=document.querySelector('#ogrKok .ogr-grafik'),svg=k.querySelector('svg'),yol=svg.querySelector('path.ogr-okul'),nokta=svg.querySelector('circle.ogr-okul-nokta'),h=document.querySelector('#ogrKok td.ogr-iz-h');
     return {w:Number(svg.getAttribute('width')),kutu:Math.round(k.clientWidth),cizgi:getComputedStyle(yol).stroke,nokta:getComputedStyle(nokta).fill,hucre:getComputedStyle(h).printColorAdjust||getComputedStyle(h).webkitPrintColorAdjust,deger:svg.querySelectorAll('text.ogr-deger').length}});
   assert(Math.abs(yaz.w-yaz.kutu)<=1,'chart at its printed width: '+JSON.stringify(yaz));
   assert(!/none|rgb\(0, 0, 0\)/.test(yaz.cizgi)&&!/rgb\(0, 0, 0\)/.test(yaz.nokta),'the students’ line keeps its colour in print: '+JSON.stringify(yaz));
   assert.equal(yaz.hucre,'exact');assert(yaz.deger>=6,'values in print');
   await page.emulateMedia({media:'screen'});
   assert.deepEqual(errors,[]);await context.close();console.log('PASS Öğretmen raporu at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
