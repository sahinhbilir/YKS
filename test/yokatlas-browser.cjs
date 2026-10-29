// Synthetic students, real public catalogue; intercept every network request.
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
  page.on('pageerror',e=>errors.push(e.message));
  let fail=true;
  await context.route('**/*',r=>{
   const u=r.request().url();requests.push(u);
   if(u==='http://localhost/data/yokatlas.json')return r.fulfill({status:fail?503:200,contentType:'application/json',body:catalog});
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   return r.abort();
  });
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof varsayilan==='function');
  await page.evaluate(()=>{
   D=varsayilan();D.rol='ogrenci';D.ogr=[{no:1,ad:'SENTETİK ADA',sube:'12-C',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true}];
   EK.ogr=0;EK.sekme='universite';kaydet=async()=>true;ogrenciEsitlemePlanla=()=>{};
   D.ogr[0].denemeOkul=['TYT','AYT'].map((ot,i)=>({id:'p:'+ot,ad:'Tarama '+ot,tarih:i?'2026-10-16':'2026-10-09',tur:ot,oturum:ot,sinavTuru:'tarama',alan:'SAY',sure:null,puan:300,ts:1,dersler:DENEME_DERSLER[ot].map(([kod,,soru])=>({kod,soru,dogru:kod==='sf'?0:Math.floor(soru*.65),yanlis:0}))}));
   ciz();
  });
  await page.locator('[data-ya-retry]').waitFor();fail=false;await page.locator('[data-ya-retry]').click();
  await page.locator('.ya-results .ya-program').first().waitFor();
  assert.equal(await page.locator('.ya-results .ya-program').count(),20);
  assert.match(await page.locator('.ya-heading').nth(1).innerText(),/Net eksiğine göre/);
  await page.locator('.ya-results summary').first().click();
  assert.equal(await page.locator('.ya-results details[open] .ya-bar-row').count(),8);
  assert(!/NaN|undefined/.test(await page.locator('#yaKok').innerText()));
  await page.locator('.ya-results details[open] [data-ya-target]').click();
  await page.locator('.ya-selected').waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(D.ogr[0].universiteHedef).sort().join(',')),'alan,id,surum,yil');
  assert(await page.evaluate(()=>D.ogr[0].denemeHedef.TYT>0&&D.ogr[0].denemeHedef.AYT>0));
  assert(!await page.evaluate(()=>JSON.stringify(ogrenciCalismaPaketi()).includes('catalogYear')));
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'yokatlas-'+width+'.png'),fullPage:false});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');
  await page.locator('[data-ya-clear]').click();assert.equal(await page.evaluate(()=>D.ogr[0].universiteHedef),null);
  await page.locator('#yaSearch').fill('bilgisayar');assert((await page.locator('.ya-results').innerText()).toLocaleLowerCase('tr-TR').includes('bilgisayar'));
  await page.locator('#yaCity').selectOption('35');assert((await page.locator('.ya-results').innerText()).includes('İzmir'));
  await page.locator('#yaSearch').fill('');await page.locator('#yaCity').selectOption('');
  await page.locator('#yaType').selectOption('VAKIF');assert(!/Devlet/.test(await page.locator('.ya-results').innerText()));
  await page.locator('#yaField').selectOption('EA');await page.locator('.ya-results summary').first().click();
  assert.equal(await page.locator('.ya-results details[open] .ya-bar-row').count(),8);
  assert.equal(await page.locator('.ya-results details[open] [data-ya-target]').count(),0);
  await page.locator('#yaField').selectOption('SÖZ');await page.locator('.ya-results summary').first().click();
  assert.equal(await page.locator('.ya-results details[open] .ya-bar-row').count(),11);
  await page.locator('#yaTYT').selectOption('');assert.match(await page.locator('.ya-panel').innerText(),/Eksik dersler sıfır sayılmaz/);
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.screenshot({path:path.join(out,'yokatlas-dark-'+width+'.png'),fullPage:false});
  assert(!requests.some(u=>u.includes('yokatlas.yok.gov.tr')),'no student data sent to YÖK');
  await page.evaluate(()=>{D.rol='rehber';ciz()});await page.locator('#yaStudent').waitFor();
  await page.locator('.ya-results summary').first().click();assert.equal(await page.locator('[data-ya-target]').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS university picker, target, filters, empty profile, failure/retry and teacher view',width);await context.close();
 }}finally{await browser.close()}
 console.log('Screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
