const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-tyt-metot-'));
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{}),args:['--no-sandbox']});try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof varsayilan==='function');
  await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-01';D.ogr=[{ad:'SENTETİK',no:1,sube:'benim',sinif:12,alan:'SAY',okul:false,kap:6,off:[6],aktif:true}];EK.ogr=0;EK.sekme='ayarlar';kendiPlanKur(0,{},'2027-04-01');kaydet=async()=>true;ciz()});
  await page.locator('#tmStart').click();await page.evaluate(()=>{EK.sekme='plan';ciz()});
  await page.locator('#tmKok').waitFor();assert.equal(await page.locator('#tmKok').getByText('Hatırlama testi',{exact:true}).count(),0);
  assert(!(await page.locator('#tmKok').innerText()).includes('AYT çalışma'));
  const overview=page.locator('[data-tm-done^="g|TYT|"]');assert.equal(await overview.count(),2);
  await overview.first().click();
  const video=page.locator('[data-tm-done^="v|"]').first();await video.waitFor();await video.click();
  assert((await page.locator('#tmKok details').textContent()).includes(await page.evaluate(()=>ggyy(gunNo('2026-11-04')))));
  await page.evaluate(()=>{D.ayar.testTarih='2026-11-04';ciz()});
  await page.locator('[data-tm-done^="r|"]').first().waitFor();
  assert.match(await page.locator('#tmKok').innerText(),/Video/);
  assert(!/NaN|undefined/.test(await page.locator('#tmKok').innerText()));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'tyt-metot-'+width+'.png')});
  await page.locator('[data-tm-done^="r|"]').first().click();
  await page.evaluate(()=>{EK.sekme='ayarlar';ciz()});await page.locator('#tmButce').fill('360');await page.locator('#tmBudget').click();assert.equal(await page.evaluate(()=>D.ogr[0].kendiPlan.metot.dakika),360);
  assert.deepEqual(errors,[]);console.log('PASS no-school method start, +3 recall, budget and layout',width);await context.close();
 }
}finally{await browser.close()}console.log('Screenshots: '+out)})().catch(e=>{console.error(e);process.exitCode=1});
