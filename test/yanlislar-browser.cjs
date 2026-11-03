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
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme}),page=await context.newPage(),errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>{const u=r.request().url();
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
   outside.push(u);return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
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
  assert.equal(await page.locator('.yd-dosya').nth(0).locator('.yd-durum').innerText(),'✓ TYT · 6 sayfa · 10 soru');
  await page.locator('#ydRapor').setInputFiles(rapor);
  await page.waitForFunction(()=>YANLISLAR.durumu().durum.rapor);
  assert.equal(await page.locator('.yd-dosya').nth(1).locator('.yd-durum').innerText(),'✓ 3 öğrenci · SENTETİK-1203');
  // ---- without the çözüm file: A student has cut-outs, B student numbers only with the note
  await page.locator('[data-yd-f="ogr"]').waitFor();
  assert.equal(await page.locator('.yd-ogr').count(),3);
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert.equal(await page.locator('.yd-ogr').count(),1);
  assert.deepEqual(await page.locator('.yd-soru figcaption b').allInnerTexts(),['Soru 2','Soru 3','Soru 4']);
  assert.equal(await page.locator('.yd-isaret').count(),0,'the answers are not next to the questions any more');
  assert.equal(await page.locator('.yd-soru figcaption').evaluateAll(l=>l.some(f=>/Senin cevabın/.test(f.textContent))),false);
  assert.match(await page.locator('.yd-say').innerText(),/1 yanlış · 2 boş/);
  assert.match(await page.locator('.yd-kimlik').first().innerText(),/Öğrenci No 9001 · 205 12\/A · SENTETİK-1203/);
  assert.deepEqual(await page.locator('.yd-ders h3').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' '))),['Türkçe 2','Din Kültürü 1']);
  // the last page: soru · senin cevabın (or Boş) · doğru cevap, one table per ders
  const tablo=()=>page.locator('.yd-anahtar .yd-cevap').evaluateAll(l=>l.map(t=>[t.querySelector('caption').textContent,...[...t.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent).join(' '))]));
  assert.deepEqual(await page.locator('.yd-anahtar thead').first().innerText().then(t=>t.split(/\s+/).filter(Boolean).join(' ')),'Soru Senin cevabın Doğru cevap');
  assert.deepEqual(await tablo(),[['Türkçe','2 C B','3 Boş C'],['Din Kültürü','4 Boş D']]);
  // the cut-outs are real pictures of the page text and the figure, not blank
  const ink=await page.evaluate(()=>[...document.querySelectorAll('#ydBaski img')].map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]<200)n++;return {w:i.naturalWidth,h:i.naturalHeight,ink:n}}));
  assert(ink.every(i=>i.ink>200&&i.w>=520&&i.w<=560&&i.h>40&&i.h<700),JSON.stringify(ink));
  await noScroll('A student');
  await secOgr('SENTETİK ÖĞRENCİ 2 · 9002');
  assert.equal(await page.locator('.yd-ogr img').count(),0);
  assert.match(await page.locator('.yd-not').innerText(),/^B kitapçığı: sorular kendi kitapçığından çözülecek$/);
  assert.deepEqual(await page.locator('.yd-satir b').allInnerTexts(),['Soru 4','Soru 2','Soru 6']);
  assert.deepEqual(await tablo(),[['Türkçe','4 Boş C'],['Tarih','2 Boş A'],['Ek Felsefe','6 A E']]);
  await noScroll('B student without the map');
  // ---- çözüm file: B student gets the A cut-outs labelled with the B number
  await page.locator('#ydCoz').setInputFiles(cozum);
  await page.waitForFunction(()=>YANLISLAR.durumu().durum.coz);
  assert.equal(await page.locator('.yd-dosya').nth(2).locator('.yd-durum').innerText(),'✓ TYT · 10 soru eşleşmesi');
  await hazir();
  assert.deepEqual(await page.locator('.yd-soru figcaption > span:first-child').allInnerTexts(),['Soru 3 (B kitapçığında 4)','Soru 1 (B kitapçığında 2)','Soru 5 (B kitapçığında 6)']);
  assert.equal(await page.locator('.yd-ogr img').count(),3);
  assert.equal(await page.locator('.yd-not').count(),0);
  assert.deepEqual(await tablo(),[['Türkçe','4 Boş C'],['Tarih','2 Boş A'],['Ek Felsefe','6 A E']],'last page uses the B numbers');
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
  // The school's own Madde Analizi (Konu Takibi) is only a validity check now: one rank correlation in the section line, nothing else changes.
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert.equal(await page.locator('[data-yd-f="difficulty"],[data-yd-f="zexam"]').count(),0,'the old difficulty select is gone');
  const once=await page.locator('.yd-kalite summary').allInnerTexts();assert(once.every(t=>!/okul verisi/.test(t)));
  await page.evaluate(()=>{
   const s=YANLISLAR.durumu(),madde={};
   for(const b of s.es.bolumler)madde[b.ad]=Array.from({length:b.n},(_,i)=>[(i+1)/(b.n+1),1,1,0,'']);
   D.konutakibi=KONU_TAKIBI.blank();D.konutakibi.zorluk={sentetik:{ad:s.rapor.ad,oturum:'TYT',ogrenci:5,ts:Date.now(),ozet:null,madde}};ciz();
  });
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert((await page.locator('.yd-kalite summary').allInnerTexts()).some(t=>/okul verisi ρ [−\d,]+$/.test(t)),'the school correlation appears in the section line');
  assert.equal(await page.locator('.yd-soru').count(),3,'and no question was dropped');
  await noScroll('validity line');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 // ---- Soru zorluğu: two sessions (TYT + AYT booklets and sheets), difficulty chips, Kendi seviyesi, the last page, Madde kalitesi. Made-up students.
 const SIM=Y.simule(),buyuk={name:'tyt-A.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.kitapcikSpecBuyuk())},aytKit={name:'ayt-A.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.kitapcikSpecAyt())};
 const aytEski={name:'ayt-1202.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.kitapcikSpecAyt('1202'))};
 const cozumBuyuk={name:'tyt-cozum.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.cozumSpec(SIM.pairs,10))};
 const rapor2={name:'cevap-raporu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Y.raporBuyuk(SIM)};
 const bulunan=Y.kademeOgrencileri({N:24,seed:21});
 for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme}),page=await context.newPage(),errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>{const u=r.request().url();
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
   outside.push(u);return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
  // the school results of 24 students stand in the notebook: they give some of the report's students an ability (Kendi seviyesi)
  await page.evaluate(({l,sim})=>{D=varsayilan();D.rol='rehber';D.ogr=l.map((o,i)=>({...o,no:i<16?sim[i]:o.no}));EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()},{l:bulunan,sim:SIM.ogr.map(o=>o.no)});
  const noScroll=async msg=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+msg+' at '+width);
  const hazir=()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent});
  const secOgr=async ad=>{await page.locator('[data-yd-f="ogr"]').selectOption({label:ad});await hazir()};
  // a booklet of another exam is refused in Turkish, with the number of the exam
  await page.locator('#ydRapor').setInputFiles(rapor2);await page.waitForFunction(()=>YANLISLAR.durumu().durum.rapor);
  assert.equal(await page.locator('.yd-dosya').nth(1).locator('.yd-durum').innerText(),'✓ 63 öğrenci · SENTETİK-1203 · TYT + AYT');
  await page.locator('#ydKit').setInputFiles([buyuk,aytEski]);
  await page.waitForFunction(()=>YANLISLAR.durumu().hata.kit);
  assert.match(await page.locator('.yd-hata').first().innerText(),/AYT soru kitapçığı 1202 numaralı sınava ait, cevap raporu 1203 numaralı sınav/);
  assert.equal(await page.locator('.yd-dosya').nth(0).locator('.yd-durum').innerText(),'✓ TYT · 5 sayfa · 40 soru','the TYT booklet of the same upload was accepted, the old AYT one not');
  // the right AYT booklet: one A booklet per session, a status line each
  await page.locator('#ydKit').setInputFiles(aytKit);await page.waitForFunction(()=>YANLISLAR.durumu().durum.kit.includes('AYT'));
  assert.equal(await page.locator('.yd-dosya').nth(0).locator('.yd-durum').innerText(),'✓ TYT · 5 sayfa · 40 soru\n✓ AYT · 6 sayfa · 8 soru'.replace('\n','\n'));
  assert.equal(await page.locator('.yd-hata').count(),0);
  // the çözüm of the TYT only (40 pairs): it goes to the TYT; AYT B students keep the numbers-only list
  await page.locator('#ydCoz').setInputFiles(cozumBuyuk);await page.waitForFunction(()=>YANLISLAR.durumu().durum.coz);
  assert.equal(await page.locator('.yd-dosya').nth(2).locator('.yd-durum').innerText(),'✓ TYT · 40 soru eşleşmesi');
  await page.locator('[data-yd-f="ogr"]').waitFor();await hazir();
  assert.equal(await page.locator('[data-yd-ders]').count(),5,'two TYT sections and three AYT ones');
  await noScroll('both sessions loaded');
  // ---- Madde kalitesi: one compact table per ders, on screen only; the section line says how many takers and how reliable
  const satirlar=await page.locator('.yd-kalite summary').allInnerTexts();
  assert(satirlar.length>=4,satirlar.join('|'));
  assert.match(satirlar[0],/^Türkçe · 60 öğrenci · KR-20 0,\d\d · (\d+ madde işaretli|işaretli madde yok)$/);
  assert(satirlar.some(t=>/Güvenilirlik düşük/.test(t)),'the tiny AYT sections say so');
  assert.equal(await page.locator('.yd-kalite').first().evaluate(d=>d.open),false);
  await page.locator('.yd-kalite summary').first().click();
  assert.deepEqual(await page.locator('.yd-kalite').first().locator('thead th').allInnerTexts(),['Soru','p','b','rit','İşaret']);
  assert.equal(await page.locator('.yd-kalite').first().locator('tbody tr').count(),20);
  await noScroll('Madde kalitesi open');
  // ---- chips: the five bands and Kendi seviyesi
  assert.deepEqual(await page.locator('.yd-chips button').allInnerTexts(),['Çok kolay','Kolay','Orta','Zor','Çok zor','Kendi seviyesi']);
  assert.deepEqual(await page.locator('.yd-chips button').evaluateAll(l=>l.map(b=>b.getAttribute('aria-pressed'))),['true','true','true','true','true','false']);
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9300');
  const etiketler=()=>page.locator('.yd-soru .yd-zorluk').allInnerTexts();
  const tum=await page.locator('.yd-soru').count(),hepsi=await etiketler();
  assert(tum>=8&&hepsi.length===tum,'every question has its label: '+hepsi.length+'/'+tum);
  assert(hepsi.every(t=>/^(Çok kolay|Kolay|Orta|Zor|Çok zor)\??$/.test(t)));assert(new Set(hepsi.map(t=>t.replace('?',''))).size>=3,'several bands: '+[...new Set(hepsi)]);
  assert.equal(await page.locator('.yd-soru figcaption').evaluateAll(l=>l.some(f=>/Senin cevabın/.test(f.textContent))),false);
  // the answers are on the last page, with the key
  const cevap=await page.locator('.yd-anahtar .yd-cevap tbody tr').count();assert.equal(cevap,tum);
  assert.deepEqual(await page.locator('.yd-anahtar thead').first().innerText().then(t=>t.split(/\s+/).filter(Boolean).join(' ')),'Soru Senin cevabın Doğru cevap');
  assert(await page.locator('.yd-anahtar .yd-cevap td:nth-child(2)').evaluateAll(l=>l.every(c=>c.textContent==='Boş'||/^[A-E]$/.test(c.textContent))));
  const ozetMetni=()=>page.locator('.yd-arac .yd-ozet').first().innerText();
  const sayiTum=await ozetMetni();assert.equal(sayiTum,'1 öğrenci · '+tum+' soru');
  if(process.env.YKS_UI_ARTIFACTS&&width===1280)await page.screenshot({path:path.join(out_dir,'zorluk-defter-1280.png'),fullPage:true});
  // selecting only Zor and Çok zor makes a smaller print set; the header counts follow it
  for(const k of ['cok-kolay','kolay','orta'])await page.locator('[data-yd-z="'+k+'"]').click();
  await hazir();
  const zor=await page.locator('.yd-soru').count();assert(zor>0&&zor<tum,zor+' of '+tum);
  assert.deepEqual(await page.locator('.yd-chips button').evaluateAll(l=>l.map(b=>b.getAttribute('aria-pressed'))),['false','false','false','true','true','false']);
  assert((await etiketler()).every(t=>/^(Zor|Çok zor)\??$/.test(t)),'Zor includes Zor?, nothing else');
  assert.equal(await ozetMetni(),'1 öğrenci · '+zor+' soru');
  assert.match(await page.locator('.yd-ust').innerText(),/Zor · Çok zor/);
  assert.equal(await page.locator('.yd-anahtar .yd-cevap tbody tr').count(),zor,'the last page lists the same questions');
  const [ya,bo]=await page.locator('.yd-say').innerText().then(t=>/(\d+) yanlış · (\d+) boş/.exec(t).slice(1).map(Number));assert.equal(ya+bo,zor);
  await noScroll('Zor chips');
  // Kendi seviyesi: only the questions in the student's weight class (a student with an ability from the notebook)
  for(const k of ['cok-kolay','kolay','orta'])await page.locator('[data-yd-z="'+k+'"]').click();
  await hazir();assert.equal(await page.locator('.yd-soru').count(),tum,'back to all five');
  await page.locator('[data-yd-z="kendi"]').click();await hazir();
  const kendi=await page.locator('.yd-soru').count();assert(kendi>0&&kendi<tum,'Kendi seviyesi '+kendi+' of '+tum);assert.match(await page.locator('.yd-ust').innerText(),/Kendi seviyesi/);
  assert.equal(await page.locator('[data-yd-z="kendi"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-yd-z="kendi"]').click();await hazir();
  // a B student: TYT cut-outs through the map (A numbers, B number in brackets), the AYT sections as numbers only
  await secOgr('SENTETİK ÖĞRENCİ 3 · 9302');
  assert(await page.locator('.yd-soru figcaption span:first-child').allInnerTexts().then(l=>l.length>0&&l.every(t=>/^Soru \d+ \(B kitapçığında \d+\)$/.test(t))));
  assert.match(await page.locator('.yd-not').first().innerText(),/^B kitapçığı: sorular kendi kitapçığından çözülecek$/);
  assert(await page.locator('.yd-liste .yd-satir').count()>0);
  assert.deepEqual(await page.locator('.yd-anahtar .yd-cevap caption').allInnerTexts().then(l=>l.filter(t=>/Türkçe|Matematik/.test(t)).length>=2),true);
  await noScroll('B student, two sessions');
  // print: the analysis is not printed, the answer table is the last page of each student
  if(width===1280){
   await secOgr('SENTETİK ÖĞRENCİ 1 · 9300');
   const sayfa=async()=>{const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length};
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.yd-analiz')).display),'none','Madde kalitesi is not printed');
   const hepsiSayfa=await sayfa();
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
   for(const k of ['cok-kolay','kolay','orta'])await page.locator('[data-yd-z="'+k+'"]').click();await hazir();
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   const zorSayfa=await sayfa();
   assert(zorSayfa<hepsiSayfa,'the filtered print set is shorter: '+zorSayfa+' < '+hepsiSayfa+' pages');
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
  }
  const kayit=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]));
  assert(!kayit.includes('SENTETİK ÖĞRENCİ 1')&&!kayit.includes('9300')&&!kayit.includes('Sentetik TUR'),'nothing of the files is stored');
  assert.deepEqual(outside,[],'nothing leaves the page');assert.deepEqual(errors,[]);
  await context.close();
 }
 }finally{await browser.close()}
 console.log('Yanlışlar defteri browser: upload, cut-outs, B numbers, filters, print and no sideways scroll passed at 1280 and 390; difficulty chips, Kendi seviyesi, two sessions and the last page passed.');
})().catch(e=>{console.error(e);process.exit(1)});
