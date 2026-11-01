'use strict';
// End-to-end contract for the restored weekly plan. Synthetic data; no Firebase.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1',{waitUntil:'load',timeout:15000});
  await page.locator('#rolRehber').waitFor(); await page.evaluate(async()=>{
   D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-26';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
   D.ogr=[{no:1,ad:'Weekly Test',sube:'benim',alan:'SAY',sinif:12,kap:6,off:[],aktif:true,okul:false,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:480,hs:480,deneme:false}}];
   EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};kaydet=async()=>true;kendiPlanKur(0,{},'2027-04-01');await TYT_METOT.start();ciz();
  });
  assert.equal(await page.locator('#tmKok').count(),0,'the daily method page must not replace the weekly plan');
  await page.locator('table.plan').waitFor({state:'attached'});
  assert.equal(await page.locator('table.plan thead th').count(),8,'weekly plan has one sequence column and seven days');
  const printed=await page.evaluate(()=>{const d=document.createElement('div');d.innerHTML=yazdirSayfa(0,buHafta(0));return {headers:d.querySelectorAll('table tr:first-child th').length,text:d.textContent,markup:d.innerHTML};});
  assert.equal(printed.headers,8,'A4 print has seven day columns');
  // The integration should expose both video and three-day recall rows in p.gunler,
  // so screen, snapshot and A4 print all consume the same seven-day plan.
  const plan=await page.evaluate(()=>JSON.parse(JSON.stringify(planHesapla(0,buHafta(0)).gunler)));
  assert.equal(plan.length,7);assert(plan.flat().some(x=>x.anlatim),'weekly plan includes video instruction');
  assert(plan.flat().some(x=>!x.anlatim&&!x.serbest),'weekly plan includes recall test');
  assert(/ANLATIM/i.test(printed.text),'A4 contains video instruction');assert(/soru/i.test(printed.text),'A4 contains recall questions');
  assert.deepEqual(errors,[]);console.log('PASS restored weekly plan and A4 print');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
