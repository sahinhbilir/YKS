'use strict';
// Synthetic student and teacher views; no account, school data or network writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const strip=s=>s.replace(/<script type="module">[\s\S]*?<\/script>/,'');
const html=strip(fs.readFileSync('index.html','utf8'));
const oldHtml=html.replace(/\/\* BEGIN REPORT_THEME \*\/[\s\S]*?\/\* END REPORT_THEME \*\//,'');
assert.notEqual(oldHtml,html,'embedded report theme marker missing');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-report-theme-'));fs.mkdirSync(out,{recursive:true});
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=s=>{const [r,g,b]=rgb(s).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b};
const contrast=(a,b)=>{const x=[lum(a),lum(b)].sort((a,b)=>a-b);return (x[1]+.05)/(x[0]+.05)};
async function load(browser,content,width){const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light'}),page=await context.newPage();await page.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:content}):r.abort());await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');return {context,page}}
const seed=role=>{
 D=varsayilan();D.rol=role;D.ayar.testTarih='2026-10-16';D.ayar.planBasi=D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
 D.ogr=[{no:1,ad:'Sentetik Öğrenci',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3,sonucBilgiOkundu:true}];
 EK={ogr:0,sekme:'ana',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
 if(role==='ogrenci')kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2026-12-21');ciz();
};
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});try{
 for(const width of [1440,390]){
  const {context,page}=await load(browser,html,width),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const role of ['ogrenci','rehber']){
   await page.evaluate(seed,role);
   const views=role==='ogrenci'?['ana','plan','ayarlar']:['ana','yoklama','etutler','konutakibi','ayarlar'];
   for(const view of views){
    await page.evaluate(v=>{EK.sekme=v;ciz()},view);
    const info=await page.evaluate(()=>({w:document.documentElement.scrollWidth,viewport:innerWidth,body:getComputedStyle(document.body).backgroundColor,ink:getComputedStyle(document.body).color,font:getComputedStyle(document.body).fontFamily,title:[...document.querySelectorAll('h1')].filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>({text:e.textContent,size:parseFloat(getComputedStyle(e).fontSize)}))[0]}));
    assert(info.w<=info.viewport+1,role+' '+view+' horizontal overflow '+JSON.stringify(info));
    assert.deepEqual(rgb(info.body),[246,245,240],role+' '+view+' cream canvas');
    assert(contrast(info.ink,info.body)>=4.5,role+' '+view+' text contrast');
    assert(!/serif(?![\w-])/i.test(info.font)||/sans-serif/i.test(info.font),role+' '+view+' uses sans serif');
    if(info.title)assert(info.title.size>=18,role+' '+view+' title scale');
    if(['ana','yoklama'].includes(view))await page.screenshot({path:path.join(out,role+'-'+view+'-'+width+'.png'),fullPage:true});
   }
  }
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark'});
  const dark=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color}));
  assert(contrast(dark.fg,dark.bg)>=4.5,'dark text contrast');assert(lum(dark.bg)<.08,'dark background remains dark');
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';const b=document.createElement('button');b.className='dugme birincil';b.textContent='Sentetik';b.id='themeTestButton';document.body.appendChild(b)});
  const button=await page.locator('#themeTestButton').evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,fg:s.color,r:parseFloat(s.borderRadius)}});
  assert(contrast(button.fg,button.bg)>=4.5,'primary button contrast');assert(button.r>=6,'primary button rounded');
  assert.deepEqual(errors,[]);await context.close();
 }
 // A media switch must produce identical print computed styles to the same document with the report theme removed.
 const a=await load(browser,html,1440),b=await load(browser,oldHtml,1440);
 for(const p of [a.page,b.page]){await p.evaluate(seed,'rehber');await p.emulateMedia({media:'print'})}
 const printStyles=p=>p.evaluate(()=>{const e=document.createElement('div');e.className='kart';document.body.appendChild(e);const s=getComputedStyle(e),body=getComputedStyle(document.body);return {bg:s.backgroundColor,color:s.color,border:s.borderColor,body:body.backgroundColor,font:body.fontFamily}});
 assert.deepEqual(await printStyles(a.page),await printStyles(b.page),'print styles unchanged from same document without report theme');
 await a.context.close();await b.context.close();console.log('PASS synthetic theme views and print; screenshots: '+out);
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
