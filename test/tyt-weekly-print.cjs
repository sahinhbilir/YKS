'use strict';
// Synthetic weekly plan; render the unmodified print document/CSS and inspect its A4 PDF.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const path=require('node:path'),os=require('node:os'),out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-weekly-print-'));fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  const page=await browser.newPage();
  await page.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://localhost/?dev=1');
  const sample=await page.evaluate(()=>{
   D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-30';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
   D.ogr=[{no:1,ad:'Sentetik Öğrenci',sube:'benim',alan:'SAY',sinif:12,kap:6,off:[],aktif:true,okul:false,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:480,hs:480,deneme:false}}];
   EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};kendiPlanKur(0,{},'2027-04-01');
   D.ogr[0].kendiPlan.metot={surum:1,baslangic:'2026-10-30',dakika:480,tamam:{}};
   const hb=buHafta(0), original=planHesapla, p=original(0,hb);
   if(!p.gunler.flat().some(x=>x.anlatim))throw Error('Integration has no video row in weekly plan');
   const normal=yazdirBelgesi([0],hb), title='Sentetik uzun video başlığı: Temel kavramların ayrıntılı anlatımı ve örnek çözümler';
   planHesapla=(...args)=>{const q=original(...args);const x=q.gunler.flat().find(i=>i.anlatim);if(x)x.ad=title;return q};
   const long=yazdirBelgesi([0],hb);planHesapla=original;
   return {normal,long,weeks:Array.from({length:8},(_,i)=>yazdirBelgesi([0],hb+(i+1)*7)),title,css:yazdirCSS()};
  });
  for(const [label,documentHtml] of [['normal',sample.normal],['long video',sample.long],...sample.weeks.map((html,i)=>['full week '+(i+1),html])]){
   const print=await browser.newPage({viewport:{width:1123,height:794}});
   await print.emulateMedia({media:'print'});
   // Suppress print dialog without changing the generated HTML or CSS.
   await print.addInitScript(()=>{window.print=()=>{}});
   await print.setContent(documentHtml,{waitUntil:'load'});
   assert.equal(await print.locator('style').textContent(),sample.css,'actual print CSS is unchanged');
   assert.equal(await print.locator('.syf').count(),1);
   assert.equal(await print.locator('table tr:first-child th').count(),8,'one sequence column and seven days');
   if(label==='long video') assert((await print.locator('.anl-h .k').allTextContents()).includes(sample.title),'long synthetic title appears in video cell');
   const clipped=await print.evaluate(()=>{
    const out=[];
    for(const td of document.querySelectorAll('td:not(.sira)')){
     const box=td.getBoundingClientRect();
     for(const el of td.querySelectorAll('.d,.k,.n')){
      const range=document.createRange();range.selectNodeContents(el);
      for(const rect of range.getClientRects())if(rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1){out.push({text:el.textContent,cell:td.textContent,rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom}});break}
     }
    }
    const table=document.querySelector('table').getBoundingClientRect(),footer=document.querySelector('.rut').getBoundingClientRect();if(table.bottom>footer.top+1)out.push({tableFooterOverlap:table.bottom-footer.top});
    const sheet=document.querySelector('.syf');if(sheet.scrollHeight>sheet.clientHeight+1||sheet.scrollWidth>sheet.clientWidth+1)out.push({sheetOverflow:[sheet.scrollWidth,sheet.clientWidth,sheet.scrollHeight,sheet.clientHeight]});
    return out;
   });
   const pdf=await PDFDocument.load(await print.pdf({preferCSSPageSize:true,printBackground:true}));
   assert.equal(pdf.getPageCount(),1,label+' should fit on one A4 page');
   assert.deepEqual(clipped,[],label+' clipped text: '+JSON.stringify(clipped));
   await print.screenshot({path:path.join(out,'weekly-print-'+label.replace(/ /g,'-')+'.png'),fullPage:true});
   await print.close();console.log('PASS',label,'seven columns, one A4 page and no clipped cell text');
  }
 }finally{await browser.close()}console.log('Print screenshots: '+out);
})().catch(e=>{console.error(e);process.exitCode=1});
