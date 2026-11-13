// Öğretmen raporu on desktop and phone, light and dark: a section per teacher, the labelled headline boxes, the net chart drawn
// at its box's width, the topic table in red (behind) and green (ahead), no sideways scrolling, the teacher filter, and the
// paper the teachers are handed: a letterhead with the reading notes for each teacher, a page per block, nothing cut across
// pages, no empty page, its own palette whatever the screen theme. Synthetic school only: the timetables, the school lists and
// Konu Takibi are built in the page.
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
   const iz=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#ogrKok .ogr-iz tbody tr:not(.ogr-iz-alt)')];
     const rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number);
     return rows.map(r=>{const c=r.querySelector('td.ogr-iz-h'),b=rgb(getComputedStyle(c).backgroundColor);return {ad:r.querySelector('th').textContent,metin:c.textContent,r:b[0],g:b[1],renk:getComputedStyle(c).color}})});
   assert(iz.length>=3,JSON.stringify(iz));assert(iz[0].metin.startsWith('−'),'most behind first: '+JSON.stringify(iz[0]));
   assert(iz[0].r>iz[0].g,'behind is red: '+JSON.stringify(iz[0]));const yesil=iz.find(x=>x.metin.startsWith('+'));assert(yesil&&yesil.g>yesil.r,'ahead is green: '+JSON.stringify(yesil));
   // The takeaway and reading guide are visible without hovering or opening the formulas, including on phones.
   const report=page.locator('.ogr-ogretmen').nth(1);
   assert.match(await report.locator('.ogr-ozet').innerText(),/avantajınız azaldı\. Tekrar önceliği: Sözcükte Anlam \(son 3 denemede Türkiye’nin gerisinde\)\./);
   // The headline boxes: the students' mean, the Türkiye average and their difference, each under its own label; the block says
   // what it covers.
   assert.deepEqual(await report.locator('.ogr-kutu-ad').allTextContents(),['Öğrencileriniz','Türkiye ortalaması','Fark','Fark nasıl değişti?']);
   assert.deepEqual(await report.locator('.ogr-kutu-ana strong').allInnerTexts(),['24,0 net','23,5 net','+0,5 net']);
   assert.match(await report.locator('.ogr-kapsam').innerText(),/^12\/A, 12\/B sınıfları birlikte · 6 deneme · 1 Eyl – 10 Kas 2026$/);
   // The boxes sit side by side (desktop) or wrap (phone) inside the card; the chart's key is directly above the chart.
   assert.equal(await report.locator('.ogr-kpi').evaluate(k=>[...k.children].every(c=>{const r=c.getBoundingClientRect(),p=k.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1})),true,'boxes inside their row');
   assert.equal(await report.locator('.ogr-sekil').evaluate(f=>f.querySelector('.ogr-lejant').getBoundingClientRect().bottom<=f.querySelector('.ogr-grafik').getBoundingClientRect().top+1),true,'the key above the chart');
   // The reading notes: folded once on screen, not repeated under every teacher.
   assert.equal(await page.locator('details.ogr-rehber-ekran').count(),1);assert.equal(await page.locator('.ogr-rehber.ogr-baski').first().isVisible(),false,'the per-teacher notes are for paper');
   // The topic table: the average gap as a bar from the Türkiye line (left behind, right ahead), the exams in equal columns,
   // the whole subject as the last row.
   const bar=await report.locator('.ogr-iz tbody tr:not(.ogr-iz-alt)').evaluateAll(rows=>rows.map(r=>{const y=r.querySelector('.ogr-ort-yol').getBoundingClientRect(),c=r.querySelector('.ogr-ort-cubuk').getBoundingClientRect(),orta=y.left+y.width/2;
     return {sayi:r.querySelector('.ogr-ort b').textContent,sol:c.right<=orta+1&&c.width>1,sag:c.left>=orta-1&&c.width>1}}));
   assert(bar[0].sayi.startsWith('−')&&bar[0].sol&&!bar[0].sag,'behind: the bar runs left of the Türkiye line '+JSON.stringify(bar[0]));
   const sagda=bar.find(x=>x.sayi.startsWith('+'));assert(sagda&&sagda.sag&&!sagda.sol,'ahead: the bar runs right '+JSON.stringify(bar));
   const kolon=await report.locator('.ogr-iz thead .ogr-iz-sinav').evaluateAll(l=>l.map(x=>Math.round(x.getBoundingClientRect().width)));
   assert(Math.max(...kolon)-Math.min(...kolon)<=1,'exam columns share the width equally: '+kolon);
   assert.equal(await report.locator('.ogr-iz tfoot .ogr-iz-toplam .ogr-iz-konu').evaluate(x=>x.firstChild.textContent),'Bütün konular');
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
   for(const selector of ['.ogr-ozet','.ogr-son','.ogr-kpi','.ogr-lejant','.ogr-iz-aciklama','.ogr-olcek']){
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
   for(const selector of ['.ogr-ozet','.ogr-son','.ogr-kpi','.ogr-lejant','.ogr-iz-aciklama','.ogr-olcek'])assert(await report.locator(selector).isVisible(),selector+' kept in print');
   // Each teacher's sheets stand alone: the report's name and day, the reading notes (whom it covers, where the numbers come
   // from, how to read a sign) beside the name; the page's own title and the folded appendix are not printed.
   assert.match(await report.locator('.ogr-ust-yazi').innerText(),/^ÖĞRETMEN RAPORU · 30 EKİ 2026$/i);
   assert(await report.locator('.ogr-rehber.ogr-baski').isVisible(),'reading notes on paper');
   assert.match(await report.locator('.ogr-rehber.ogr-baski').innerText(),/Kimleri kapsıyor\?[\s\S]*Veriler nereden geliyor\?[\s\S]*okulda uygulanan denemelerin sonuç listelerinden[\s\S]*Nasıl okunur\?/);
   assert.equal(await page.locator('#ogrKok>.et-bas').isVisible(),false);assert.equal(await page.locator('details.ogr-rehber-ekran').isVisible(),false);assert.equal(await report.locator('.ogr-formul').first().isVisible(),false,'the appendix prints only when opened');
   // Nothing is cut across pages; a teacher's first block follows the letterhead, every further block would start a page.
   const kes=await page.evaluate(()=>{const cs=s=>getComputedStyle(document.querySelector(s)),ilk=document.querySelector('.ogr-ogretmen>section.ogr-blok'),ikinci=ilk.cloneNode(true);
     ilk.after(ikinci);const sonraki=getComputedStyle(ikinci).breakBefore;ikinci.remove();
     return {genel:cs('.ogr-genel').breakInside,konu:cs('.ogr-konular').breakInside,satir:cs('.ogr-iz tbody tr:not(.ogr-iz-alt)').breakInside,ilk:getComputedStyle(ilk).breakBefore,sonraki}});
   assert.deepEqual(kes,{genel:'avoid',konu:'avoid',satir:'avoid',ilk:'auto',sonraki:'page'});
   // The topic table fits the paper's width whatever the number of exams, and the page does not depend on the screen theme.
   assert.equal(await report.locator('.ogr-iz-kutu').evaluate(k=>k.scrollWidth<=k.clientWidth+1),true,'the table fits the page');
   assert.equal(await page.evaluate(()=>{const k=document.documentElement,eski=k.getAttribute('data-theme');k.setAttribute('data-theme','dark');
     const r=[getComputedStyle(document.querySelector('#ogrKok')).color,getComputedStyle(document.querySelector('#ogrKok .ogr-kutu')).backgroundColor,getComputedStyle(document.querySelector('#ogrKok .ogr-ogretmen h2')).color].join('|');
     if(eski===null)k.removeAttribute('data-theme');else k.setAttribute('data-theme',eski);return r}),'rgb(23, 41, 44)|rgb(255, 255, 255)|rgb(23, 41, 44)','dark ink on white paper under the dark theme too');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelectorAll('.ogr-ogretmen')[1]).breakBefore),'page','each teacher on its own page');
   // In print the charts are drawn again at the paper's width and keep the subject's colour (the screen theme's colours do not
   // reach print); the topic cells keep their fills.
   await page.evaluate(()=>OGRETMEN_RAPOR.grafikleriCiz());
   const yaz=await page.evaluate(()=>{const k=document.querySelector('#ogrKok .ogr-grafik'),svg=k.querySelector('svg'),yol=svg.querySelector('path.ogr-okul'),nokta=svg.querySelector('circle.ogr-okul-nokta'),h=document.querySelector('#ogrKok td.ogr-iz-h');
     return {w:Number(svg.getAttribute('width')),kutu:Math.round(k.clientWidth),cizgi:getComputedStyle(yol).stroke,nokta:getComputedStyle(nokta).fill,hucre:getComputedStyle(h).printColorAdjust||getComputedStyle(h).webkitPrintColorAdjust,deger:svg.querySelectorAll('text.ogr-deger').length}});
   assert(Math.abs(yaz.w-yaz.kutu)<=1,'chart at its printed width: '+JSON.stringify(yaz));
   assert(!/none|rgb\(0, 0, 0\)/.test(yaz.cizgi)&&!/rgb\(0, 0, 0\)/.test(yaz.nokta),'the students’ line keeps its colour in print: '+JSON.stringify(yaz));
   assert.equal(yaz.hucre,'exact');assert(yaz.deger>=6,'values in print');
   await page.emulateMedia({media:null});   // no emulation: the PDF below is laid out as paper by the browser itself
   // The PDF itself (desktop run): one sheet for the teacher with nets only, two for the teacher with a topic table (the nets,
   // then the topics); no empty sheet, nothing left over. Chromium writes one "/Type /Page" object per sheet.
   if(width===1280){const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync(path.join(out,'ogretmen-raporu.pdf'),pdf);
    const metin=pdf.toString('latin1');assert.equal((metin.match(/\/Type\s*\/Page\b(?!s)/g)||[]).length,3,'three sheets');
    // A4 landscape: about 842 × 595 pt.
    assert(/\/MediaBox\s*\[\s*0\s+0\s+84[12](\.\d+)?\s+59[45](\.\d+)?\s*\]/.test(metin),'A4 landscape')}
   assert.deepEqual(errors,[]);await context.close();console.log('PASS Öğretmen raporu at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
