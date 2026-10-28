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
  const layout=await page.evaluate(()=>({page:document.documentElement.scrollWidth,screen:innerWidth,fonts:[...document.querySelectorAll('#ktKok svg text')].map(n=>parseFloat(getComputedStyle(n).fontSize)),spills:[...document.querySelectorAll('#ktKok summary')].filter(n=>n.scrollWidth>n.clientWidth+1).length}));
  assert(layout.page<=layout.screen+1,'no page overflow '+JSON.stringify(layout));assert(layout.fonts.every(f=>f>=12));assert.equal(layout.spills,0);
  await page.screenshot({path:path.join(out,'konutakibi-'+width+'.png'),fullPage:true});
  // Repeated import updates rather than doubles; read-only users can expand and filter but cannot edit.
  await page.evaluate(()=>{yalnizcaGoruntuleme=()=>true;ciz()});assert.equal(await page.locator('#ktPdf').count(),0);assert.equal(await page.locator('[data-kt-delete]').count(),0);assert.equal(await page.locator('[data-kt-filter]').count(),4);
  await page.evaluate(()=>{D.rol='ogrenci';EK.sekme='konutakibi';ciz()});assert.equal(await page.locator('#ktKok').count(),0);assert.equal(await page.locator('#ray [data-sekme="konutakibi"]').count(),0);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS Konu Takibi '+width+' '+theme);
 }}finally{await browser.close()}
 console.log('Screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
