// Yanlışlar defteri, Deneme kütüphanesi in a real browser: bulk upload of mixed synthetic files for two exams, kept in IndexedDB across a reload,
// the exam table, per-account isolation, Sil / Tümünü bu cihazdan sil, the logout wipe, no-IndexedDB and quota fallbacks, print preview of several exams and
// the PDF download (real pdf-lib), at 1280 light and 390 dark. Synthetic data only. Set YKS_UI_ARTIFACTS to keep the screenshots (yd-*.png).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib'),Y=require('./yanlislar-fixtures.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad+' (see .github/workflows/verify.yml)')};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.worker.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out_dir=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-yd-kutuphane-'));fs.mkdirSync(out_dir,{recursive:true});
const pdf=(name,buffer)=>({name,mimeType:'application/pdf',buffer});
const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const D=Y.DENEMELER;
const dosya={
 kit:kod=>pdf('kitapcik-'+kod+'.pdf',Y.pdfYaz(Y.kitapcikSpec(kod))),
 rapor:kod=>({name:'cevap-raporu-'+kod+'.xlsx',mimeType:XLSX,buffer:Y.denemeRaporu(kod)}),
 coz:kod=>pdf('cozum-'+kod+'.pdf',Y.pdfYaz(Y.cozumSpec(D[kod].pairs,5,kod))),
 perf:kod=>pdf('performans-analizi-'+kod+'.pdf',Y.pdfYaz(Y.performansSpec({ascii:true,kod:'27-YKS-'+kod}))),
 ort:kod=>pdf('ders-ortalamalari-'+kod+'.pdf',Y.pdfYaz(Y.ortalamaSpec({ascii:true,satir:12,kod:'27-YKS-'+kod,dersler:[['TÜRKÇE-T',4,2.5],['TARİH-T',2,1.25]]})))
};
// two exams, every kind of file, in the worst order: çözüm first, an ortalamalar file before its report, a booklet before its report, reports last
const KARISIK=()=>[dosya.coz('1204'),dosya.perf('1203'),dosya.ort('1203'),dosya.kit('1204'),dosya.rapor('1203'),dosya.kit('1203'),dosya.rapor('1204'),dosya.coz('1203')];
const sayfaSayisi=b=>(b.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length;
const IDB_OKU=()=>new Promise((ok,red)=>{
  indexedDB.databases().then(l=>{
    if(!l.some(d=>d.name==='yks-deneme-kutuphanesi'))return ok(null);
    const r=indexedDB.open('yks-deneme-kutuphanesi');r.onerror=()=>red(r.error);
    r.onsuccess=()=>{const db=r.result,t=db.transaction(['meta','dosya']),m=t.objectStore('meta').getAll(),mk=t.objectStore('meta').getAllKeys(),dk=t.objectStore('dosya').getAllKeys(),dv=t.objectStore('dosya').getAll();
      t.oncomplete=()=>{db.close();const dec=new TextDecoder('latin1');ok({meta:m.result.map(x=>JSON.stringify(x)),metaKeys:mk.result,dosyaKeys:dk.result,dosya:dv.result.map(b=>{const u=new Uint8Array(b);return {len:u.length,head:dec.decode(u.slice(0,4)),tc:/\d{11}/.test(dec.decode(u))}})})}};
  });
});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const yeniBaglam=async(ek)=>{
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme,acceptDownloads:true}),outside=[],errors=[];
   if(ek)await context.addInitScript(ek);
   await context.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
    if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
    outside.push(u);return r.abort()});
   return {context,outside,errors};
  };
  const baslat=async(page,uid='sentetik-ogretmen-1')=>{
   await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(u=>{window.bulut={mevcutKullanici:()=>({uid:u,isAnonymous:false})};D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()},uid);
   await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi);
  };
  const ac=async(b,ek)=>{const page=await b.context.newPage();page.on('pageerror',e=>b.errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('http://localhost/?dev=1');await baslat(page);return page};
  const yardimcilar=page=>({
   noScroll:async msg=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+msg+' at '+width),
   hazir:()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent}),
   yukle:async(f)=>{await page.locator('#ydDosya').setInputFiles(f);await page.waitForFunction(()=>YANLISLAR.durumu().mesgul===''&&!YANLISLAR.durumu().kilit)},
   hucreler:kod=>page.locator('tr[data-yd-satir="'+kod+'"] td.yd-h span').allInnerTexts(),
   satirlar:()=>page.locator('tr[data-yd-satir]').evaluateAll(l=>l.map(r=>r.dataset.ydSatir)),
   durumSatiri:()=>page.locator('.yd-kut-ana').innerText(),
   indir:async(tikla)=>{const [dl]=await Promise.all([page.waitForEvent('download'),tikla()]);return {ad:dl.suggestedFilename(),buf:fs.readFileSync(await dl.path())}}
  });

  /* ---------- 1. bulk upload of mixed files for two exams, kept across a reload ---------- */
  let b=await yeniBaglam(),page=await ac(b),H=yardimcilar(page);
  assert.match(await H.durumSatiri(),/^Bu cihazda saklanır, sunucuya gönderilmez · 0 deneme$/);
  await H.noScroll('empty library');
  await page.evaluate(()=>{window.__ydIs=[];new MutationObserver(()=>{const t=document.getElementById('ydIs')?.textContent;if(t&&window.__ydIs.at(-1)!==t)window.__ydIs.push(t)}).observe(document.getElementById('ydKok'),{subtree:true,childList:true,characterData:true})});
  await H.yukle(KARISIK());
  const ilerleme=await page.evaluate(()=>window.__ydIs);
  assert(ilerleme.includes('1 / 8 dosya okunuyor…')&&ilerleme.includes('8 / 8 dosya okunuyor…'),'progress while reading one by one: '+ilerleme.join(' | '));
  assert.deepEqual(await H.satirlar(),['1203','1204']);
  assert.equal(await page.locator('.yd-hata').count(),0,'no file refused');
  assert.deepEqual(await H.hucreler('1203'),['✓','–','✓','✓','✓','✓']);assert.deepEqual(await H.hucreler('1204'),['✓','–','✓','✓','✗','✗']);
  assert.equal(await page.locator('[data-yd-sec]:checked').count(),2,'all selected by default');
  assert.deepEqual(await page.locator('.yd-tablo thead th').allInnerTexts().then(t=>t.map(x=>x.trim()).filter(Boolean)),['Deneme','TYT kitapçık','AYT kitapçık','Cevap raporu','Çözüm','Ders ort.','Performans analizi','Sil']);
  assert.deepEqual(await page.locator('tr[data-yd-satir] .yd-ad').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' '))),['SENTETİK-1203 03.10.2026','SENTETİK-1204 10.10.2026']);
  assert.match(await H.durumSatiri(),/^Bu cihazda saklanır, sunucuya gönderilmez · 2 deneme · \d+(,\d)? (KB|MB)$/);
  await H.hazir();await H.noScroll('two exams');
  if(width===1280||true)await page.screenshot({path:path.join(out_dir,'yd-tablo-'+width+'-'+theme+'.png'),fullPage:true});
  // what is on the device: models and PDFs, nothing else; keyed by the teacher's uid
  let idb=await page.evaluate(IDB_OKU);
  assert.equal(idb.meta.length,2);assert.deepEqual(idb.metaKeys.map(decodeURIComponent).sort(),['sentetik-ogretmen-1|1203','sentetik-ogretmen-1|1204']);
  assert.deepEqual(idb.dosyaKeys.map(decodeURIComponent).sort(),['sentetik-ogretmen-1|1203|coz-TYT','sentetik-ogretmen-1|1203|kit-TYT','sentetik-ogretmen-1|1204|coz-TYT','sentetik-ogretmen-1|1204|kit-TYT']);
  assert(idb.dosya.every(d=>d.head==='%PDF'&&!d.tc&&d.len>500),'only PDFs, no 11 digit number');
  assert(idb.meta.every(m=>!/\d{11}/.test(m)&&!/12345678901|10987654321|11111111111/.test(m)),'no 11 digit number in any stored model');
  assert.doesNotMatch(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage,D])),/SENTETİK ÖĞRENCİ|9001|Sentetik Turkce/,'nothing in localStorage or the notebook');
  assert.deepEqual(b.outside,[],'nothing leaves the page: the files stay on this device');
  // reload: the exams are there without uploading again, and the pictures are cut from the stored PDFs
  await page.reload();await baslat(page);H=yardimcilar(page);
  assert.deepEqual(await H.satirlar(),['1203','1204']);assert.deepEqual(await H.hucreler('1203'),['✓','–','✓','✓','✓','✓']);
  assert.match(await H.durumSatiri(),/· 2 deneme ·/);
  await H.hazir();assert(await page.locator('#ydBaski img').count()>0,'pictures after the reload');
  const tinta=await page.evaluate(()=>[...document.querySelectorAll('#ydBaski img')].slice(0,6).map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]<200)n++;return n}));
  assert(tinta.every(n=>n>200),'cut-outs of the reloaded exams are real: '+tinta);
  await page.screenshot({path:path.join(out_dir,'yd-yenilendikten-sonra-'+width+'-'+theme+'.png'),fullPage:true});

  /* ---------- 2. both exams selected: one defter per student over both ---------- */
  const ogrSay=await page.locator('.yd-ogr').count();
  assert.equal(ogrSay,4,'9001, 9002, 9003, 9004');
  assert.deepEqual(await page.locator('.yd-ogr').evaluateAll(l=>l.map(a=>a.dataset.ydOgr)),['9001','9002','9003','9004']);
  const a1=page.locator('.yd-ogr[data-yd-ogr="9001"]');
  assert.deepEqual(await a1.locator('.yd-ust .yd-kimlik').allInnerTexts(),['Öğrenci No 9001 · 205 12/A','Denemeler: SENTETİK-1203 · SENTETİK-1204']);
  assert.match(await a1.locator('.yd-say').innerText(),/^2 deneme · \d+ yanlış · \d+ boş$/);
  assert.deepEqual(await a1.locator('.yd-deneme > .yd-deneme-baslik').allInnerTexts(),['SENTETİK-1203','SENTETİK-1204']);
  assert.deepEqual(await a1.locator('.yd-anahtar .yd-deneme-baslik').allInnerTexts(),['SENTETİK-1203','SENTETİK-1204'],'the key is grouped by exam');
  assert.match(await page.locator('.yd-ogr[data-yd-ogr="9002"] .yd-say').innerText(),/^1 deneme /,'9002 sat only 1203 of the two');
  assert.match(await page.locator('.yd-ogr[data-yd-ogr="9004"]').innerText(),/Yanlış veya boş soru yok/,'a student with nothing to print is only noted on screen');
  assert.match(await page.locator('.yd-arac .yd-ozet').first().innerText(),/^4 öğrenci · \d+ soru · 2 deneme$/);
  assert.deepEqual(await page.locator('.yd-arac button').allInnerTexts(),['Seçili denemeler için yazdır','PDF indir']);
  // the ders ticks are the union by name; the exams' options apply together
  assert.deepEqual(await page.locator('[data-yd-ders]').evaluateAll(l=>l.map(c=>c.dataset.ydDers)),['Türkçe','Tarih','Din Kültürü','Ek Felsefe']);
  assert.deepEqual(await page.locator('[data-yd-f="sube"] option').allInnerTexts(),['Tüm şubeler','205 12/A','205 12/B']);
  await page.locator('[data-yd-f="sube"]').selectOption('205 12/B');await H.hazir();
  assert.deepEqual(await page.locator('.yd-ogr').evaluateAll(l=>l.map(a=>a.dataset.ydOgr)),['9003','9004']);
  await page.locator('[data-yd-f="sube"]').selectOption('');await H.hazir();
  // unticking one exam leaves it in the library but out of the defter
  await page.locator('[data-yd-sec="1204"]').uncheck();await H.hazir();
  assert.equal(await page.locator('.yd-deneme-baslik').count(),0);assert.match(await page.locator('.yd-ogr[data-yd-ogr="9001"] .yd-kimlik').first().innerText(),/SENTETİK-1203$/,'one selected exam: the old single-exam page');
  await page.locator('[data-yd-sec="1204"]').check();await H.hazir();
  await H.noScroll('both selected');
  await page.screenshot({path:path.join(out_dir,'yd-secili-'+width+'-'+theme+'.png'),fullPage:true});

  /* ---------- 3. print preview of the selection (once, at the wide size) ---------- */
  if(width===1280){
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   const st=await page.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {ray:g('#ray').display,yukle:g('.yd-yukle').display,tablo:g('.yd-tablo-kap').display,filtre:g('.yd-filtre').display,ogr:g('.yd-ogr').breakBefore,anahtar:g('.yd-anahtar').breakBefore,kolon:g('.yd-sorular').columnCount,baslik:g('.yd-deneme-baslik').breakAfter}});
   assert.deepEqual(st,{ray:'none',yukle:'none',tablo:'none',filtre:'none',ogr:'page',anahtar:'page',kolon:'2',baslik:'avoid'});
   const pdfBaski=await page.pdf({preferCSSPageSize:true,printBackground:true});
   assert.match(pdfBaski.toString('latin1'),/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/,'A4 portrait');
   const yazilan=await page.locator('.yd-ogr:not(.yd-yok)').count();assert.equal(yazilan,3);
   assert.equal(sayfaSayisi(pdfBaski),yazilan*2,'each student with questions: a page and a key page, the one without questions is not printed');
   const basHtml=await page.evaluate(()=>document.getElementById('ydBaski').innerHTML+' '+document.getElementById('ydBaski').textContent);
   assert.doesNotMatch(basHtml,/Kendi seviyesi|kademe|tier|Madde kalitesi/i);
   fs.writeFileSync(path.join(out_dir,'yd-baski.pdf'),pdfBaski);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
   // a preview shorter than the selection: print still holds every student
   await page.evaluate(()=>{YANLISLAR.durumu().onizleme=1;ciz()});await H.hazir();
   assert.equal(await page.locator('.yd-ogr').count(),1);assert.match(await page.locator('.yd-onizleme').innerText(),/^Önizleme ilk 1 öğrenciyi gösterir; yazdırma ve PDF 3 öğrencinin hepsini içerir\.$/);
   await page.evaluate(()=>YANLISLAR.hazirla(true));await H.hazir();
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await page.locator('.yd-ogr').count(),4,'the print pages hold every student');
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('.yd-ogr').count(),1,'back to the short preview');
   await page.evaluate(()=>{YANLISLAR.durumu().onizleme=3000;ciz()});await H.hazir();
  }

  /* ---------- 4. PDF download ---------- */
  let d=await H.indir(()=>page.locator('[data-yd-pdf]').click());
  assert.equal(d.ad,'Yanlislar_defteri_2_deneme.pdf');
  assert.equal(d.buf.slice(0,5).toString('latin1'),'%PDF-');
  let belge=await PDFDocument.load(d.buf);const sonPdf=await page.evaluate(()=>YANLISLAR.durumu().sonPdf);
  assert.equal(belge.getPageCount(),sonPdf.sayfa);assert.equal(sonPdf.kisi,3,'three students with questions');
  assert.equal(belge.getPageCount(),6,'each of the three students: one page of questions and one key page');
  const [pw,ph]=[belge.getPage(0).getWidth(),belge.getPage(0).getHeight()];assert(Math.abs(pw-595.28)<.1&&Math.abs(ph-841.89)<.1,'A4 portrait');
  assert(d.buf.length<2.5e6,'JPEG pictures, shared between students: '+d.buf.length);
  fs.writeFileSync(path.join(out_dir,'yd-defter-'+width+'.pdf'),d.buf);
  assert.equal(await page.locator('#ydIs').innerText(),'','progress cleared');assert.equal(await page.locator('.yd-hatalar').count(),0);
  // look at the pages: render the downloaded PDF with pdf.js
  const sayfaResmi=async(n)=>page.evaluate(async({b64,n})=>{const pdfjs=await denemePdfjs(),doc=await pdfjs.getDocument({data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}).promise,p=await doc.getPage(n),vp=p.getViewport({scale:1.4}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;await p.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;return cv.toDataURL('image/png').split(',')[1]},{b64:d.buf.toString('base64'),n});
  for(const n of [1,2])fs.writeFileSync(path.join(out_dir,'yd-pdf-sayfa'+n+'-'+width+'.png'),Buffer.from(await sayfaResmi(n),'base64'));
  // too many pages for one file: the page offers one PDF per şube, or says how to narrow the selection
  await page.evaluate(()=>{YANLISLAR.durumu().pdfSinir=2});
  await page.locator('[data-yd-pdf]').click();await page.waitForSelector('.yd-oneri');
  assert.match(await page.locator('.yd-oneri').innerText(),/Bu seçim yaklaşık 6 sayfa; tek PDF için çok büyük \(en fazla 2 sayfa\)\./);
  assert.match(await page.locator('.yd-oneri').innerText(),/Şube, Öğrenci, Soru durumu, Zorluk veya ders kutularıyla seçimi daraltın/);
  assert.deepEqual(await page.locator('[data-yd-pdf-sube]').allInnerTexts(),['205 12/B · 2 sayfa'],'a button only for the şube that fits (12/A needs 4 pages)');
  await H.noScroll('PDF too large');
  await page.screenshot({path:path.join(out_dir,'yd-pdf-cok-buyuk-'+width+'-'+theme+'.png'),fullPage:true});
  d=await H.indir(()=>page.locator('[data-yd-pdf-sube="205 12/B"]').click());
  assert.equal(d.ad,'Yanlislar_defteri_2_deneme_12B.pdf');belge=await PDFDocument.load(d.buf);assert.equal(belge.getPageCount(),2,'9003 only: 9004 has nothing to print');
  await page.evaluate(()=>{YANLISLAR.durumu().pdfSinir=400});
  // the file is named after the selection: the şube filter shows in the name
  await page.locator('[data-yd-f="sube"]').selectOption('205 12/A');await H.hazir();
  d=await H.indir(()=>page.locator('[data-yd-pdf]').click());assert.equal(d.ad,'Yanlislar_defteri_2_deneme_12A.pdf');assert.equal((await PDFDocument.load(d.buf)).getPageCount(),4,'9001 and 9002: two pages each');
  await page.locator('[data-yd-f="sube"]').selectOption('');await H.hazir();

  /* ---------- 5. drag and drop ---------- */
  await page.locator('[data-yd-hepsini-sil]').click();await page.waitForFunction(()=>YANLISLAR.durumu().denemeler.size===0);
  assert.equal(await page.locator('tr[data-yd-satir]').count(),0);assert.match(await H.durumSatiri(),/· 0 deneme$/);
  assert.equal(await page.evaluate(IDB_OKU).then(x=>x.meta.length+x.dosya.length),0,'Tümünü bu cihazdan sil emptied the device');
  await page.evaluate(async({a,b})=>{
   const dt=new DataTransfer();for(const [ad,tip,b64] of [a,b])dt.items.add(new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],ad,{type:tip}));
   document.getElementById('ydKok').dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));
   document.getElementById('ydKok').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
  },{a:[dosya.kit('1203').name,'application/pdf',dosya.kit('1203').buffer.toString('base64')],b:[dosya.rapor('1203').name,XLSX,dosya.rapor('1203').buffer.toString('base64')]});
  await page.waitForFunction(()=>YANLISLAR.durumu().denemeler.size===1&&YANLISLAR.durumu().mesgul==='');
  assert.deepEqual(await H.hucreler('1203'),['✓','–','✓','✗','✗','✗'],'two files dropped: recognised and grouped');

  /* ---------- 6. Sil, accounts, the logout wipe ---------- */
  await H.yukle([dosya.kit('1204'),dosya.rapor('1204'),dosya.coz('1204'),dosya.coz('1203')]);
  assert.deepEqual(await H.satirlar(),['1203','1204']);
  await page.locator('[data-yd-sil="1204"]').click();await page.waitForFunction(()=>YANLISLAR.durumu().denemeler.size===1);
  idb=await page.evaluate(IDB_OKU);assert.equal(idb.meta.length,1);assert.equal(idb.dosyaKeys.filter(k=>k.includes('|1204|')).length,0,'Sil removed the files of the exam too');
  await page.reload();await baslat(page);H=yardimcilar(page);assert.deepEqual(await H.satirlar(),['1203']);
  // another account on the same browser sees nothing of it, and gets its own library
  await page.evaluate(()=>{window.bulut={mevcutKullanici:()=>({uid:'sentetik-ogretmen-2',isAnonymous:false})};return YANLISLAR.kutAc()});
  await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi&&YANLISLAR.durumu().kutUid==='sentetik-ogretmen-2');await page.evaluate(()=>ciz());
  assert.equal(await page.locator('tr[data-yd-satir]').count(),0,'account 2 sees no exam of account 1');
  await H.yukle([dosya.kit('1204'),dosya.rapor('1204')]);
  assert.deepEqual((await page.evaluate(IDB_OKU)).metaKeys.map(decodeURIComponent).sort(),['sentetik-ogretmen-1|1203','sentetik-ogretmen-2|1204']);
  await page.evaluate(()=>{window.bulut={mevcutKullanici:()=>({uid:'sentetik-ogretmen-1',isAnonymous:false})};return YANLISLAR.kutAc()});
  await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi&&YANLISLAR.durumu().kutUid==='sentetik-ogretmen-1');await page.evaluate(()=>ciz());
  assert.deepEqual(await H.satirlar(),['1203'],'back to account 1: only its own exam');
  // logout / browser reset: the cleanup function of the app wipes the whole database, with the notebook's local copy
  assert.notEqual(await page.evaluate(IDB_OKU),null);
  await page.evaluate(()=>cikisYerelVerisiniTemizle());
  assert.equal(await page.evaluate(IDB_OKU),null,'the database is gone after the logout cleanup, for every account');
  assert.equal(await page.evaluate(()=>YANLISLAR.durumu().denemeler.size),0,'and the page copies');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.outside,[]);
  await b.context.close();

  /* ---------- 7. no IndexedDB at all ---------- */
  b=await yeniBaglam(()=>{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true})});page=await ac(b);H=yardimcilar(page);
  const SATIR='Bu tarayıcı dosyaları saklamaya izin vermiyor; sayfa kapanınca yeniden yüklemeniz gerekir.';
  assert.equal(await page.locator('.yd-uyari').innerText(),SATIR);
  await H.yukle(KARISIK());
  assert.deepEqual(await H.satirlar(),['1203','1204']);assert.equal(await page.locator('.yd-uyari').count(),1,'one line');assert.equal(await page.locator('.yd-uyari').innerText(),SATIR);
  assert.match(await H.durumSatiri(),/^Bu oturumda tutulur, sunucuya gönderilmez · 2 deneme/);
  assert.equal(await page.locator('.yd-rozet').count(),0);
  await H.hazir();assert(await page.locator('#ydBaski img').count()>0,'pictures are cut from the PDFs held in memory');
  await H.noScroll('no IndexedDB');await page.screenshot({path:path.join(out_dir,'yd-izin-yok-'+width+'-'+theme+'.png'),fullPage:true});
  d=await H.indir(()=>page.locator('[data-yd-pdf]').click());assert.equal((await PDFDocument.load(d.buf)).getPageCount(),6,'bulk export still works');
  await page.reload();await baslat(page);H=yardimcilar(page);assert.equal(await page.locator('tr[data-yd-satir]').count(),0,'a reload forgets');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.outside,[]);await b.context.close();

  /* ---------- 8. quota exceeded while saving ---------- */
  b=await yeniBaglam(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(window.__kota&&this.name==='dosya')throw new DOMException('The quota has been exceeded.','QuotaExceededError');return put.apply(this,arguments)}});page=await ac(b);H=yardimcilar(page);
  await H.yukle([dosya.kit('1203'),dosya.rapor('1203')]);assert.equal(await page.locator('.yd-uyari').count(),0,'the first exam fits');
  await page.evaluate(()=>{window.__kota=true});
  await H.yukle([dosya.kit('1204'),dosya.rapor('1204'),dosya.coz('1204')]);
  assert.equal(await page.locator('.yd-uyari').innerText(),'SENTETİK-1204 cihaza sığmadı; bu oturumda bellekte tutuluyor. Yer açmak için eski denemeleri silin.');
  assert.equal(await page.locator('tr[data-yd-satir="1204"] .yd-rozet').innerText(),'Yalnız bu oturumda');assert.equal(await page.locator('tr[data-yd-satir="1203"] .yd-rozet').count(),0);
  assert.deepEqual(await H.hucreler('1204'),['✓','–','✓','✓','✗','✗'],'the exam works this session');assert.equal((await page.evaluate(IDB_OKU)).meta.length,1,'only the first exam is on the device');
  await H.hazir();await H.noScroll('quota');await page.screenshot({path:path.join(out_dir,'yd-kota-'+width+'-'+theme+'.png'),fullPage:true});
  await page.evaluate(()=>{window.__kota=false});await page.locator('[data-yd-sil="1203"]').click();await page.waitForFunction(()=>YANLISLAR.durumu().denemeler.size===1);
  await H.yukle([dosya.kit('1204')]);await page.waitForFunction(()=>[...YANLISLAR.durumu().denemeler.values()][0].kalici===true);
  assert.equal(await page.locator('.yd-uyari').count(),0,'room made: the next save is on the device');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.outside,[]);await b.context.close();
 }}finally{await browser.close()}
 console.log('Yanlışlar defteri, Deneme kütüphanesi (browser): bulk upload, reload, selection, print, PDF, accounts, logout wipe, no-IndexedDB and quota passed at 1280 light and 390 dark.');
})().catch(e=>{console.error(e);process.exit(1)});
