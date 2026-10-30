// Yanlışlar defteri in a real browser: a synthetic two-column booklet PDF, cevap raporu .xlsx and çözüm PDF written in the test,
// read by the real pdf.js (served from the local npm copy in place of the jsdelivr import), cropped on canvas, filtered and printed.
// Synthetic data only. Set YKS_UI_ARTIFACTS to keep screenshots.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),Y=require('./yanlislar-fixtures.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad+' (see .github/workflows/verify.yml)')};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.worker.min.mjs','text/javascript']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out_dir=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-yanlislar-'));fs.mkdirSync(out_dir,{recursive:true});
const kitap={name:'kitapcik-A.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.kitapcikSpec())};
const cozum={name:'cozum.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.cozumSpec())};
const rapor={name:'cevap-raporu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Y.raporXlsx({shared:true,method:8})};
const sayfaSayisi=pdf=>(pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length;
(async()=>{
 const browser=await chromium.launch();
 try{for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme}),page=await context.newPage(),errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>{const u=r.request().url();
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
   outside.push(u);return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
  await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()});
  assert.equal(await page.locator('#denemelerMenusu [data-sekme="yanlislar"]').count(),1,'menu entry next to Konu takibi');
  assert.equal(await page.locator('#denemelerMenusu button').allInnerTexts().then(t=>t.includes('Yanlışlar defteri')),true);
  const noScroll=async msg=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+msg+' at '+width);
  const hazir=()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent});
  const secOgr=async ad=>{await page.locator('[data-yd-f="ogr"]').selectOption({label:ad});await hazir()};
  await noScroll('empty page');
  // ---- upload: three inputs, a short ✓ status each; the çözüm file waits for the other two
  await page.locator('#ydCoz').setInputFiles(cozum);
  await page.waitForFunction(()=>YANLISLAR.durumu().hata.coz);
  assert.match(await page.locator('.yd-hata').innerText(),/Önce soru kitapçığını ve cevap raporunu yükleyin/);
  await page.locator('#ydKit').setInputFiles(kitap);
  await page.waitForFunction(()=>YANLISLAR.durumu().durum.kit);
  assert.equal(await page.locator('.yd-dosya').nth(0).locator('.yd-durum').innerText(),'✓ 6 sayfa · 10 soru');
  await page.locator('#ydRapor').setInputFiles(rapor);
  await page.waitForFunction(()=>YANLISLAR.durumu().durum.rapor);
  assert.equal(await page.locator('.yd-dosya').nth(1).locator('.yd-durum').innerText(),'✓ 3 öğrenci · SENTETİK-1203');
  // ---- without the çözüm file: A student has cut-outs, B student numbers only with the note
  await page.locator('[data-yd-f="ogr"]').waitFor();
  assert.equal(await page.locator('.yd-ogr').count(),3);
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert.equal(await page.locator('.yd-ogr').count(),1);
  assert.deepEqual(await page.locator('.yd-soru figcaption b').allInnerTexts(),['Soru 2','Soru 3','Soru 4']);
  assert.deepEqual(await page.locator('.yd-soru .yd-isaret').allInnerTexts(),['Senin cevabın: C','Boş','Boş']);
  assert.match(await page.locator('.yd-say').innerText(),/1 yanlış · 2 boş/);
  assert.match(await page.locator('.yd-kimlik').first().innerText(),/Öğrenci No 9001 · 205 12\/A · SENTETİK-1203/);
  assert.deepEqual(await page.locator('.yd-ders h3').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' '))),['Türkçe 2','Din Kültürü 1']);
  assert.match(await page.locator('.yd-anahtar').innerText(),/Doğru cevaplar[\s\S]*Türkçe[\s\S]*2 B\s*3 C[\s\S]*Din Kültürü[\s\S]*4 D/);
  // the cut-outs are real pictures of the page text and the figure, not blank
  const ink=await page.evaluate(()=>[...document.querySelectorAll('#ydBaski img')].map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]<200)n++;return {w:i.naturalWidth,h:i.naturalHeight,ink:n}}));
  assert(ink.every(i=>i.ink>200&&i.w>=520&&i.w<=560&&i.h>40&&i.h<700),JSON.stringify(ink));
  await noScroll('A student');
  await secOgr('SENTETİK ÖĞRENCİ 2 · 9002');
  assert.equal(await page.locator('.yd-ogr img').count(),0);
  assert.match(await page.locator('.yd-not').innerText(),/^B kitapçığı: sorular kendi kitapçığından çözülecek$/);
  assert.deepEqual(await page.locator('.yd-satir b').allInnerTexts(),['Soru 4','Soru 2','Soru 6']);
  assert.match(await page.locator('.yd-anahtar').innerText(),/4 C[\s\S]*6 E/);
  await noScroll('B student without the map');
  // ---- çözüm file: B student gets the A cut-outs labelled with the B number
  await page.locator('#ydCoz').setInputFiles(cozum);
  await page.waitForFunction(()=>YANLISLAR.durumu().durum.coz);
  assert.equal(await page.locator('.yd-dosya').nth(2).locator('.yd-durum').innerText(),'✓ 10 soru eşleşmesi');
  await hazir();
  assert.deepEqual(await page.locator('.yd-soru figcaption > span:first-child').allInnerTexts(),['Soru 3 (B kitapçığında 4)','Soru 1 (B kitapçığında 2)','Soru 5 (B kitapçığında 6)']);
  assert.equal(await page.locator('.yd-ogr img').count(),3);
  assert.equal(await page.locator('.yd-not').count(),0);
  assert.match(await page.locator('.yd-anahtar').innerText(),/Türkçe\s*4 C[\s\S]*Tarih\s*2 A[\s\S]*S\.Felsefe\s*6 E/,'key page uses the B numbers');
  // the shared passage (5 - 6) is part of the picture: question 5's cut-out is taller than question 1's
  const hs=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#ydBaski img')].map(i=>[i.alt,i.naturalHeight])));
  assert(hs['Soru 5']>hs['Soru 1']*1.8,JSON.stringify(hs));
  await noScroll('B student with the map');
  // ---- filters: şube, one student, ders
  await page.locator('[data-yd-f="ogr"]').selectOption({label:'Tüm öğrenciler (3)'});await hazir();
  assert.equal(await page.locator('.yd-ogr').count(),3);
  await page.locator('[data-yd-f="sube"]').selectOption('205 12/B');
  assert.equal(await page.locator('.yd-ogr').count(),1);assert.match(await page.locator('.yd-ozet').first().innerText(),/1 öğrenci · 0 soru/);
  assert.equal(await page.locator('[data-yd-yazdir]').isDisabled(),true);
  await page.locator('[data-yd-f="sube"]').selectOption('205 12/A');
  assert.equal(await page.locator('.yd-ogr').count(),2);
  assert.equal(await page.locator('[data-yd-f="ogr"] option').count(),3,'all + two students of the şube');
  await page.locator('[data-yd-ders="0"]').uncheck();await hazir();   // Türkçe off
  assert.deepEqual(await page.locator('.yd-ogr').nth(0).locator('.yd-ders h3').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' '))),['Din Kültürü 1']);
  await page.locator('[data-yd-ders="0"]').check();await hazir();
  // ---- the screen shows one column
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.yd-sorular')).gridTemplateColumns.split(' ').length),1);
  await page.locator('[data-yd-f="ogr"]').selectOption({label:'SENTETİK ÖĞRENCİ 1 · 9001'});await hazir();
  await page.screenshot({path:path.join(out_dir,'yanlislar-'+width+'.png'),fullPage:true});
  // ---- privacy: nothing stored, nothing sent
  const kayit=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage,D,Object.keys(indexedDB.databases?{}:{})]));
  assert(!kayit.includes('SENTETİK ÖĞRENCİ')&&!kayit.includes('9001')&&!kayit.includes('Sentetik Turkce'),'nothing of the files is stored');
  assert.deepEqual(outside,[],'nothing leaves the page');
  // ---- print (checked once, at the wide size): A4 portrait, defter pages only, a page per student, key on its own page
  if(width===1280){
   await page.locator('[data-yd-f="sube"]').selectOption('');await page.locator('[data-yd-f="ogr"]').selectOption({label:'Tüm öğrenciler (3)'});await hazir();
   await page.emulateMedia({media:'print'});
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await page.evaluate(()=>document.getElementById('ydSayfaStili').textContent),'@media print{@page{size:A4 portrait;margin:12mm}}');
   const st=await page.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {ray:g('#ray').display,menu:g('.yd-dosyalar').display,filtre:g('.yd-filtre').display,ogr:g('.yd-ogr').breakBefore,anahtar:g('.yd-anahtar').breakBefore,soru:g('.yd-soru').breakInside,yok:g('.yd-yok').display,kolon:g('.yd-sorular').gridTemplateColumns.split(' ').length}});
   assert.deepEqual(st,{ray:'none',menu:'none',filtre:'none',ogr:'page',anahtar:'page',soru:'avoid',yok:'none',kolon:2});
   const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
   if(process.env.YKS_UI_ARTIFACTS)fs.writeFileSync(path.join(out_dir,'yanlislar-baski.pdf'),pdf);
   assert.match(pdf.toString('latin1'),/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/,'A4 portrait');
   assert.equal(sayfaSayisi(pdf),4,'two students with questions: a page each plus a key page each; the one without questions is not printed');
   // two questions per row when they fit (A4 content width)
   await page.setViewportSize({width:702,height:1100});
   const satir=await page.evaluate(()=>[...document.querySelectorAll('.yd-ogr')[0].querySelectorAll('.yd-ders:first-of-type .yd-soru')].map(f=>{const r=f.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width)]}));
   assert.equal(satir.length,2);assert.equal(satir[0][1],satir[1][1],'same row');assert(satir[1][0]>satir[0][0]+200,'side by side');
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.evaluate(()=>document.body.classList.contains('yd-yazdir')),false);
   await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1280,height:950});
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }}finally{await browser.close()}
 console.log('Yanlışlar defteri browser: upload, cut-outs, B numbers, filters, print and no sideways scroll passed at 1280 and 390.');
})().catch(e=>{console.error(e);process.exit(1)});
