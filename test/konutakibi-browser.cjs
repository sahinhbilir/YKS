// No live accounts or student data. UI upload uses synthetic PDF text items; parser fixtures
// exercise the publisher geometry separately. Local private PDF checks are never committed.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),F=require('./konutakibi-fixtures.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-konutakibi-'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
  await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='konutakibi';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()});
  assert.equal(await page.locator('#denemelerMenusu [data-sekme="konutakibi"]').count(),1);
  assert(await page.locator('#ktKok').innerText().then(t=>t.includes('Konuların gelişimini görün')));
  await page.evaluate(p=>{denemePdfSayfalari=async()=>({pages:p})},F.pages({continuation:true}));
  await page.locator('#ktPdf').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic')});
  await page.waitForFunction(()=>D.konutakibi?.exams.length===1);
  await page.waitForFunction(()=>document.querySelector('#ktStatus').textContent.includes('kaydedildi'));
  assert.match(await page.locator('#ktStatus').innerText(),/1 PDF kaydedildi · 1 sınav \(SENTETİK-1\) · 1 öğrenci\./);
  await page.locator('[data-kt-date]').fill('2026-10-07');await page.locator('[data-kt-date]').press('Tab');
  await page.waitForFunction(()=>D.konutakibi.exams[0].date==='2026-10-07');
  await page.evaluate(reports=>{const v=KONU_TAKIBI.merge(KONU_TAKIBI.blank(),reports);v.exams.forEach((e,i)=>e.date='2026-10-'+String(7+7*i).padStart(2,'0'));D.konutakibi=v;ciz()},F.reports);
  const topic=page.locator('.kt-topic').filter({has:page.locator(':scope > summary .kt-topic-name',{hasText:'Sözcükte Anlam'})});
  await topic.locator(':scope > summary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.kt-chart svg')].some(s=>s.querySelectorAll('circle').length===8));
  assert.equal(await topic.locator(':scope > .kt-detail > .kt-table-wrap tbody tr').count(),4);
  assert.match(await topic.locator(':scope > summary strong').innerText(),/%63,6/);
  assert.match(await topic.locator('.kt-range').innerText(),/%45,5 – %100/);
  await topic.locator('.kt-outcome').first().locator('summary').click();
  await page.waitForFunction(()=>document.querySelector('.kt-outcome[open] svg'));
  assert.equal(await topic.locator('.kt-outcome').first().locator('tbody tr').count(),4);
  // Sorting and the combined Matematik + Geometri course (synthetic 30 + 10 questions).
  const order=()=>page.locator('.kt-topics > .kt-topic > summary .kt-topic-name').evaluateAll(n=>n.map(x=>x.firstChild.textContent));
  await page.evaluate(()=>{const v=D.konutakibi;const T=(r)=>({student:{...v.exams[0].blocks[0].student},course:'TÜRKÇE-T',kind:'topic',rows:r});
    D.konutakibi=KONU_TAKIBI.merge(v,[{ad:'SIRA-1',blocks:[T([{code:'',name:'YÜKSELEN',c:[10,2,8,0]},{code:'',name:'DÜŞEN',c:[10,9,1,0]}])]},{ad:'SIRA-2',blocks:[T([{code:'',name:'YÜKSELEN',c:[10,9,1,0]},{code:'',name:'DÜŞEN',c:[10,3,7,0]}])]}]);
    D.konutakibi.exams.find(e=>e.ad==='SIRA-1').date='2026-11-01';D.konutakibi.exams.find(e=>e.ad==='SIRA-2').date='2026-11-08';EK.ktSira='soru';ciz()});
  const before=await order(),sorted={};
  for(const [id,label] of [['soru','En çok soru'],['dusen','Düşenler'],['yukselen','Yükselenler'],['son','Son denemede iyi'],['ad','Ada göre (A–Z)']]){
    await page.locator('[data-kt-sort]').selectOption(id);sorted[id]=await order();
    assert.equal(await page.locator('[data-kt-sort] option:checked').innerText(),label);
  }
  assert.deepEqual(before,sorted.soru);
  assert(sorted.dusen.indexOf('Düşen')<sorted.dusen.indexOf('Yükselen')&&sorted.yukselen.indexOf('Yükselen')<sorted.yukselen.indexOf('Düşen'));
  assert.notDeepEqual(sorted.dusen,sorted.yukselen);assert.deepEqual(sorted.ad,[...sorted.ad].sort((a,b)=>a.localeCompare(b,'tr')));
  await page.locator('[data-kt-sort]').selectOption('son');
  assert.match(await page.locator('.kt-topics').innerText(),/Son deneme %90 · 9\/10/);
  await page.evaluate(()=>{const v=D.konutakibi,s=v.exams[0].blocks[0].student,B=(course,rows)=>({student:{...s},course,kind:'topic',rows});
    D.konutakibi=KONU_TAKIBI.merge(v,[{ad:'MG-1',blocks:[B('MATEMATİK-T',[{code:'',name:'PROBLEMLER',c:[30,8,18,4]}]),B('GEOMETRİ-T',[{code:'',name:'ÜÇGENLER',c:[10,4,5,1]}])]}]);ciz()});
  assert.equal(await page.locator('[data-kt-filter="course"] option').first().innerText(),'Matematik + Geometri');
  await page.locator('[data-kt-filter="course"]').selectOption({label:'Matematik + Geometri'});
  assert.match(await page.locator('.kt-summary').innerText(),/^Tüm şube · 1 öğrenci · 1 deneme · 40 soru/);
  await page.locator('[data-kt-filter="student"]').selectOption({index:2});
  const summary=await page.locator('.kt-summary').innerText();assert.match(summary,/^Matematik \+ Geometri · 1 deneme · 40 soru · 12 doğru \(%30\)/);
  assert.equal(await page.locator('.kt-topics > .kt-topic').count(),2);
  assert.equal(await page.locator('.kt-fixed').innerText(),'TYT');
  await page.locator('[data-kt-sort]').selectOption('dusen');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll after sorting');
  await page.locator('[data-kt-filter="course"]').selectOption({label:'Türkçe'});
  await page.locator('[data-kt-sort]').selectOption('son');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll, latest-exam sort');
  await page.screenshot({path:path.join(out,'konutakibi-sirala-'+width+'.png'),fullPage:true});
  const layout=await page.evaluate(()=>({page:document.documentElement.scrollWidth,screen:innerWidth,fonts:[...document.querySelectorAll('#ktKok svg text')].map(n=>parseFloat(getComputedStyle(n).fontSize)),spills:[...document.querySelectorAll('#ktKok summary')].filter(n=>n.scrollWidth>n.clientWidth+1).length}));
  assert(layout.page<=layout.screen+1,'no page overflow '+JSON.stringify(layout));assert(layout.fonts.every(f=>f>=12));assert.equal(layout.spills,0);
  await page.screenshot({path:path.join(out,'konutakibi-'+width+'.png'),fullPage:true});
  // Whole class / whole grade (synthetic pupils in three classes, two grades).
  await page.evaluate(()=>{
    const P=(cls,no)=>({name:'SENTETİK '+no,no,cls}),A=[P('301 12/A','1'),P('301 12/A','2'),P('301 12/A','3')],B=[P('205 12/B','4'),P('205 12/B','5')],C=[P('101 11/A','6')];
    const blk=(st,k1,k2)=>({student:st,course:'TÜRKÇE-T',kind:'topic',rows:[{code:'',name:'SÖZCÜKTE ANLAM',c:[10,k1,10-k1,0]},{code:'',name:'CÜMLEDE ANLAM',c:[8,k2,8-k2,0]}]});
    D.konutakibi=KONU_TAKIBI.merge(KONU_TAKIBI.blank(),[{ad:'27-YKS-1203',blocks:[...A.slice(0,2).map((x,i)=>blk(x,4+i,6)),blk(B[0],5,4),blk(C[0],9,8)]},{ad:'27-YKS-1210',blocks:[...A.map((x,i)=>blk(x,6+i,5)),...B.map(x=>blk(x,7,6))]}]);
    D.konutakibi.exams[0].date='2026-10-07';D.konutakibi.exams[1].date='2026-10-14';EK.ktSelection=undefined;EK.ktSira='soru';ciz()});
  assert.equal(await page.locator('[data-kt-filter="student"] option:checked').innerText(),'Tüm şube (3 öğrenci)');
  assert.match(await page.locator('.kt-summary').innerText(),/^Tüm şube · 3 öğrenci · 2 deneme · 90 soru · /);
  assert.match(await page.locator('.kt-exams').innerText(),/^TYT: 27-YKS-1203 \(2\), 27-YKS-1210 \(3\)$/);
  await page.locator('[data-kt-filter="student"]').selectOption({label:'Tüm 12. sınıflar (5 öğrenci)'});
  assert.match(await page.locator('.kt-summary').innerText(),/^Tüm 12\. sınıflar · 5 öğrenci · 2 deneme · 144 soru · /);
  assert.match(await page.locator('.kt-exams').innerText(),/^TYT: 27-YKS-1203 \(3\), 27-YKS-1210 \(5\)$/);
  await page.locator('[data-kt-sort]').selectOption('son');
  await page.locator('.kt-topic').first().locator(':scope > summary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.kt-chart svg')].some(s=>s.querySelectorAll('circle').length===4));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll, grade view');
  await page.screenshot({path:path.join(out,'konutakibi-sinif-'+width+'.png'),fullPage:true});
  // Repeated import updates rather than doubles; read-only users can expand and filter but cannot edit.
  await page.evaluate(()=>{yalnizcaGoruntuleme=()=>true;ciz()});assert.equal(await page.locator('#ktPdf').count(),0);assert.equal(await page.locator('[data-kt-delete]').count(),0);assert.equal(await page.locator('[data-kt-filter]').count(),3);
  await page.evaluate(()=>{D.rol='ogrenci';EK.sekme='konutakibi';ciz()});assert.equal(await page.locator('#ktKok').count(),0);assert.equal(await page.locator('#ray [data-sekme="konutakibi"]').count(),0);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS Konu Takibi '+width+' '+theme);
 }}finally{await browser.close()}
 console.log('Screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
