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
  await page.evaluate(()=>{window.bulut={mevcutKullanici:()=>({uid:'sentetik-ogretmen-1',isAnonymous:false})};D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()});
  await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi);
  assert.equal(await page.locator('#denemelerMenusu [data-sekme="yanlislar"]').count(),1,'menu entry next to Konu takibi');
  assert.equal(await page.locator('#denemelerMenusu button').allInnerTexts().then(t=>t.includes('Yanlışlar defteri')),true);
  const noScroll=async msg=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+msg+' at '+width);
  const hazir=()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent});
  const secOgr=async ad=>{await page.locator('[data-yd-f="ogr"]').selectOption({label:ad});await hazir()};
  // one input takes every kind of file; the page recognises them by content
  const yukle=async(...f)=>{await page.locator('#ydDosya').setInputFiles(f.flat());await page.waitForFunction(()=>YANLISLAR.durumu().mesgul===''&&!YANLISLAR.durumu().kilit)};
  const hucreler=satir=>page.locator('tr[data-yd-satir="'+satir+'"] td.yd-h span').allInnerTexts();
  const hucreBaslik=(satir,etiket)=>page.locator('tr[data-yd-satir="'+satir+'"] td.yd-h[data-label="'+etiket+'"]').getAttribute('title');
  await noScroll('empty page');
  assert.match(await page.locator('.yd-kut-ana').innerText(),/^Bu cihazda saklanır, sunucuya gönderilmez · 0 deneme$/);
  // ---- upload: three inputs, a short ✓ status each; the çözüm file waits for the other two
  await yukle(cozum);
  assert.match(await page.locator('.yd-hatalar .yd-hata').innerText(),/cozum\.pdf: Önce soru kitapçığını ve cevap raporunu yükleyin/);
  await yukle(kitap);
  assert.equal(await hucreBaslik('1203','TYT kitapçık'),'✓ TYT · 6 sayfa · 10 soru');
  await yukle(rapor);
  assert.equal(await hucreBaslik('1203','Cevap raporu'),'✓ 3 öğrenci · SENTETİK-1203');
  assert.deepEqual(await hucreler('1203'),['✓','–','✓','✗','✗'],'booklet, no AYT sheet, report; çözüm and ders ortalamaları are optional');
  assert.equal(await page.locator('tr[data-yd-satir] .yd-ad').innerText().then(t=>t.replace(/\s+/g,' ')),'SENTETİK-1203 01.01.2000');
  assert.match(await page.locator('.yd-kut-ana').innerText(),/^Bu cihazda saklanır, sunucuya gönderilmez · 1 deneme · .+$/);
  // ---- without the çözüm file: A student has cut-outs, B student numbers only with the note
  await page.locator('[data-yd-f="ogr"]').waitFor();
  assert.equal(await page.locator('.yd-ogr').count(),3);
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert.equal(await page.locator('.yd-ogr').count(),1);
  assert.deepEqual(await page.locator('.yd-soru figcaption b').allInnerTexts(),['Soru 2','Soru 3','Soru 4']);
  assert.equal(await page.locator('.yd-isaret').count(),0,'the answers are not next to the questions any more');
  assert.equal(await page.locator('.yd-soru figcaption').evaluateAll(l=>l.some(f=>/Senin cevabın/.test(f.textContent))),false);
  assert.match(await page.locator('.yd-say').innerText(),/1 yanlış · 2 boş/);
  assert.match(await page.locator('.yd-kimlik').first().innerText(),/Öğrenci No 9001 · 205 12\/A · SENTETİK-1203/);assert.equal(await page.locator('.yd-deneme-baslik').count(),0,'one exam: no exam heading');
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
  await yukle(cozum);
  assert.equal(await hucreBaslik('1203','Çözüm'),'✓ TYT · 10 soru eşleşmesi');
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
  assert.equal(await page.locator('.yd-ogr').count(),1);assert.match(await page.locator('.yd-arac .yd-ozet').first().innerText(),/1 öğrenci · 0 soru/);
  assert.equal(await page.locator('[data-yd-yazdir]').isDisabled(),true);
  await page.locator('[data-yd-f="sube"]').selectOption('205 12/A');
  assert.equal(await page.locator('.yd-ogr').count(),2);
  assert.equal(await page.locator('[data-yd-f="ogr"] option').count(),3,'all + two students of the şube');
  await page.locator('[data-yd-ders="Türkçe"]').uncheck();await hazir();   // Türkçe off
  assert.deepEqual(await page.locator('.yd-ogr').nth(0).locator('.yd-ders h3').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' '))),['Din Kültürü 1']);
  await page.locator('[data-yd-ders="Türkçe"]').check();await hazir();
  // ---- the screen shows one column
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.yd-sorular')).gridTemplateColumns.split(' ').length),1);
  await page.locator('[data-yd-f="ogr"]').selectOption({label:'SENTETİK ÖĞRENCİ 1 · 9001'});await hazir();
  await page.screenshot({path:path.join(out_dir,'yanlislar-'+width+'.png'),fullPage:true});
  // ---- privacy: nothing stored, nothing sent
  const kayit=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage,D]));
  assert(!kayit.includes('SENTETİK ÖĞRENCİ')&&!kayit.includes('9001')&&!kayit.includes('Sentetik Turkce'),'nothing of the files is in localStorage or the notebook');
  assert.deepEqual(outside,[],'nothing leaves the page');
  // ---- print (checked once, at the wide size): A4 portrait, defter pages only, a page per student, key on its own page
  if(width===1280){
   await page.locator('[data-yd-f="sube"]').selectOption('');await page.locator('[data-yd-f="ogr"]').selectOption({label:'Tüm öğrenciler (3)'});await hazir();
   await page.emulateMedia({media:'print'});
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await page.evaluate(()=>document.getElementById('ydSayfaStili').textContent),'@media print{@page{size:A4 portrait;margin:12mm}}');
   const st=await page.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {ray:g('#ray').display,menu:g('.yd-yukle').display,filtre:g('.yd-filtre').display,ogr:g('.yd-ogr').breakBefore,anahtar:g('.yd-anahtar').breakBefore,soru:g('.yd-soru').breakInside,yok:g('.yd-yok').display,kolon:g('.yd-sorular').columnCount}});
   assert.deepEqual(st,{ray:'none',menu:'none',filtre:'none',ogr:'page',anahtar:'page',soru:'avoid',yok:'none',kolon:'2'});
   const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
   if(process.env.YKS_UI_ARTIFACTS)fs.writeFileSync(path.join(out_dir,'yanlislar-baski.pdf'),pdf);
   assert.match(pdf.toString('latin1'),/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/,'A4 portrait');
   assert.equal(sayfaSayisi(pdf),4,'two students with questions: a page each plus a key page each; the one without questions is not printed');
   // the printed defter never mentions Kendi seviyesi, tier or kademe (text and markup of every student)
   const basHtml=await page.evaluate(()=>document.getElementById('ydBaski').innerHTML+' '+document.getElementById('ydBaski').textContent);
   assert.doesNotMatch(basHtml,/Kendi seviyesi|kademe|tier/i,'printed HTML has no Kendi seviyesi, kademe or tier');
   // column flow: the questions fill two columns top to bottom, each block half the content width
   await page.setViewportSize({width:702,height:1100});
   const satir=await page.evaluate(()=>[...document.querySelectorAll('.yd-ogr')[0].querySelectorAll('.yd-ders:first-of-type .yd-soru')].map(f=>{const r=f.getBoundingClientRect(),k=document.querySelector('.yd-sorular').getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(k.width)]}));
   assert(satir.length>=2);assert(satir.every(x=>x[2]<=x[3]/2+2),'each question block is one column wide');
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.evaluate(()=>document.body.classList.contains('yd-yazdir')),false);
   await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1280,height:950});
  }
  // The school's own Madde Analizi (Konu Takibi) is only a validity check now: one rank correlation in the section line, nothing else changes.
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert.equal(await page.locator('[data-yd-f="difficulty"],[data-yd-f="zexam"]').count(),0,'the old difficulty select is gone');
  const once=await page.locator('.yd-kalite summary').allInnerTexts();assert(once.every(t=>!/okul verisi/.test(t)));
  await page.evaluate(()=>{
   const s=[...YANLISLAR.durumu().denemeler.values()][0],madde={};
   for(const b of s.es.bolumler)madde[b.ad]=Array.from({length:b.n},(_,i)=>[(i+1)/(b.n+1),1,1,0,'']);
   D.konutakibi=KONU_TAKIBI.blank();D.konutakibi.zorluk={sentetik:{ad:s.rapor.ad,oturum:'TYT',ogrenci:5,ts:Date.now(),ozet:null,madde}};ciz();
  });
  await secOgr('SENTETİK ÖĞRENCİ 1 · 9001');
  assert((await page.locator('.yd-kalite summary').allInnerTexts()).some(t=>/okul verisi ρ [−\d,]+$/.test(t)),'the school correlation appears in the section line');
  assert.equal(await page.locator('.yd-soru').count(),3,'and no question was dropped');
  await noScroll('validity line');
  // ---- optional 4th upload: Ders ortalamaları (İlk 100 Kurum), read by the real pdf.js; the exam code and question counts are checked
  const ortPdf=o=>({name:'ders-ortalamalari.pdf',mimeType:'application/pdf',buffer:Y.pdfYaz(Y.ortalamaSpec({ascii:true,satir:12,...o}))});
  assert.match(await page.locator('th[scope="col"][title="İsteğe bağlı"]').innerText(),/Ders ort\./);assert.equal(await page.locator('#ydDosya').count(),1,'one input for every kind');
  await yukle(ortPdf({kod:'27-YKS-1202',dersler:[['TÜRKÇE-T',4,2.5],['TARİH-T',2,1.25]]}));
  let hata=await page.locator('tr[data-yd-satir="1203"] .yd-hata').innerText();
  assert(hata.startsWith('ders-ortalamalari.pdf: ')&&hata.includes('27-YKS-1202')&&hata.includes('SENTETİK-1203')&&/uyuşmuyor/.test(hata),hata);
  assert.equal((await hucreler('1203'))[4],'✗');
  await yukle(ortPdf({dersler:[['TÜRKÇE-T',6,2.5],['TARİH-T',2,1.25]]}));
  assert.match(await page.locator('tr[data-yd-satir="1203"] .yd-hata').innerText(),/Soru sayıları uyuşmuyor.*TÜRKÇE-T.*4.*6|TÜRKÇE-T.*6/);
  await noScroll('refused ders ortalamaları');
  assert(!(await page.locator('.yd-kalite summary').allInnerTexts()).some(t=>/genel ort\./.test(t)),'a refused file changes nothing');
  await yukle(ortPdf({dersler:[['TÜRKÇE-T',4,2.5],['TARİH-T',2,1.25],['FİZİK-T',7,3.75]]}));
  assert.equal(await hucreBaslik('1203','Ders ort.'),'✓ 3 ders · genel ortalama');assert.deepEqual(await hucreler('1203'),['✓','–','✓','✓','✓']);
  assert.equal(await page.locator('tr[data-yd-satir="1203"] .yd-hata').count(),0,'a good file clears the old error');
  await page.waitForFunction(()=>[...document.querySelectorAll('.yd-kalite summary')].some(s=>/genel ort\. 2,50 net · okul -?\d+,\d\d net · ölçek genele göre$/.test(s.textContent.replace('−','-'))));
  assert((await page.locator('.yd-kalite summary').allInnerTexts()).some(t=>/Tarih · .*genel ort\. 1,25 net/.test(t)));
  await page.locator('.yd-kalite summary').first().click();
  assert.deepEqual(await page.locator('.yd-kalite').first().locator('thead th').allInnerTexts(),['Soru','p','b','rit','Genele göre','İşaret']);
  assert((await page.locator('.yd-kalite').first().locator('tbody tr:first-child td').nth(4).innerText()).match(/^(Çok kolay|Kolay|Orta|Zor|Çok zor)\??$/));
  assert.doesNotMatch(await page.evaluate(()=>document.getElementById('ydBaski').textContent),/genel ort|ölçek|Genele göre/,'nothing about anchoring in the defter');
  await noScroll('with ders ortalamaları');
  // a new cevap raporu of another exam drops the file again
  assert.equal(await page.evaluate(()=>[...YANLISLAR.durumu().denemeler.values()][0].ort.dersler.length),3);assert.equal(await page.evaluate(()=>JSON.stringify([...YANLISLAR.durumu().denemeler.values()][0].ort)).then(t=>/OKUL|LISESI/.test(t)),false,'no school row is kept');
  await page.evaluate(()=>{const s=[...YANLISLAR.durumu().denemeler.values()][0];s.ort=null;s.durum.ort='';s.zOnbellek=null;ciz()});
  await page.waitForFunction(()=>![...document.querySelectorAll('.yd-kalite summary')].some(s=>/genel ort\./.test(s.textContent)));
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
  await page.evaluate(({l,sim})=>{window.bulut={mevcutKullanici:()=>({uid:'sentetik-ogretmen-1',isAnonymous:false})};D=varsayilan();D.rol='rehber';D.ogr=l.map((o,i)=>({...o,no:i<16?sim[i]:o.no}));EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()},{l:bulunan,sim:SIM.ogr.map(o=>o.no)});
  await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi);
  const noScroll=async msg=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+msg+' at '+width);
  const hazir=()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent});
  const secOgr=async ad=>{await page.locator('[data-yd-f="ogr"]').selectOption({label:ad});await hazir()};
  const yukle=async(...f)=>{await page.locator('#ydDosya').setInputFiles(f.flat());await page.waitForFunction(()=>YANLISLAR.durumu().mesgul===''&&!YANLISLAR.durumu().kilit)};
  const hucreler=satir=>page.locator('tr[data-yd-satir="'+satir+'"] td.yd-h span').allInnerTexts();
  const hucreBaslik=(satir,etiket)=>page.locator('tr[data-yd-satir="'+satir+'"] td.yd-h[data-label="'+etiket+'"]').getAttribute('title');
  // a booklet of another exam is refused in Turkish, with the number of the exam
  await yukle(rapor2);
  assert.equal(await hucreBaslik('1203','Cevap raporu'),'✓ 63 öğrenci · SENTETİK-1203 · TYT + AYT');
  // the TYT booklet and a booklet of another exam (1202) come in one batch: they are told apart by the code in their page header, each in its own exam row
  await yukle(buyuk,aytEski);
  assert.deepEqual(await hucreler('1203'),['✓','✗','✓','✗','✗'],'the TYT booklet joined its exam; this exam has an AYT sheet that still lacks its booklet');
  assert.deepEqual(await hucreler('1202'),['✗','✓','✗','✗','✗'],'the old AYT booklet is an exam of its own, without a report');
  assert.equal(await page.locator('tr[data-yd-satir="1202"] .yd-ad').innerText().then(t=>t.replace(/\s+/g,' ')),'Deneme 1202');
  // an exam without a report cannot be printed: only 1203 is selectable for the defter, the 1202 row is removed with Sil
  await page.locator('[data-yd-sil="1202"]').click();await page.waitForFunction(()=>!document.querySelector('[data-yd-satir="1202"]'));
  // the right AYT booklet: one A booklet per session
  await yukle(aytKit);
  assert.deepEqual(await hucreler('1203'),['✓','✓','✓','✗','✗']);assert.equal(await hucreBaslik('1203','TYT kitapçık'),'✓ TYT · 5 sayfa · 40 soru');assert.equal(await hucreBaslik('1203','AYT kitapçık'),'✓ AYT · 6 sayfa · 8 soru');
  assert.equal(await page.locator('.yd-hata').count(),0);
  // the çözüm of the TYT only (40 pairs): it goes to the TYT; AYT B students keep the numbers-only list
  await yukle(cozumBuyuk);
  assert.equal(await hucreBaslik('1203','Çözüm'),'✓ TYT · 40 soru eşleşmesi');
  await page.locator('[data-yd-f="ogr"]').waitFor();await hazir();
  assert.equal(await page.locator('[data-yd-ders]').count(),5,'two TYT sections and three AYT ones');
  await noScroll('both sessions loaded');
  // ---- Oturum and Alan: the booklet slot names both sessions, the selectors appear once both sessions are there
  const sec=(f)=>page.locator('[data-yd-f="'+f+'"]');
  assert.deepEqual(await sec('oturum').locator('option').allInnerTexts(),['TYT + AYT','TYT','AYT']);assert.equal(await sec('oturum').inputValue(),'TYT+AYT','default: both sessions');
  assert.deepEqual(await sec('alan').locator('option').allInnerTexts(),['Öğrencinin alanı','SAY','EA','SÖZ','Tümü']);assert.equal(await sec('alan').inputValue(),'ogr');
  const dersler=()=>page.locator('.yd-ders h3').allInnerTexts().then(t=>t.map(x=>x.replace(/\s+/g,' ')));
  const tikler=()=>page.locator('[data-yd-ders]').evaluateAll(l=>l.map(c=>c.parentElement.textContent.trim()));
  const alanSec=async v=>{await sec('alan').selectOption(v);await hazir()};
  await secOgr('SENTETİK ÖĞRENCİ 4 · 9004');
  assert.deepEqual(await page.locator('.yd-oturum').allInnerTexts(),['AYT','AYT'],'an AYT-only student: the AYT block, and the AYT part of the key');
  await alanSec('SAY');assert.deepEqual(await dersler(),['AYT Matematik 1']);
  assert.equal((await tikler()).filter(t=>/Edebiyat|Tarih-1/.test(t)).length,0,'SAY: the ticks of the other fields are hidden');
  await alanSec('EA');assert.deepEqual(await dersler(),['Türk Dili ve Edebiyatı 1','Tarih-1 1','AYT Matematik 1']);
  await alanSec('SÖZ');assert.deepEqual(await dersler(),['Türk Dili ve Edebiyatı 1','Tarih-1 1']);assert.equal((await tikler()).filter(t=>t==='AYT Matematik').length,0);
  await alanSec('Tümü');assert.deepEqual(await dersler(),['Türk Dili ve Edebiyatı 1','Tarih-1 1','AYT Matematik 1']);
  assert.equal(await page.locator('[data-yd-ders]').count(),5,'Tümü: every ders');
  assert.match(await page.locator('.yd-say').innerText(),/2 yanlış · 1 boş/);
  await alanSec('SÖZ');await page.locator('[data-yd-ders="Tarih-1"]').uncheck();await hazir();
  assert.deepEqual(await dersler(),['Türk Dili ve Edebiyatı 1'],'the ders ticks work on top of the alan');assert.match(await page.locator('.yd-say').innerText(),/1 yanlış · 0 boş/);
  await page.locator('[data-yd-ders]').evaluateAll(l=>l.forEach(c=>{if(!c.checked)c.click()}));await hazir();
  // a student with both sessions: the TYT block first, then the AYT block, each with its ders headings; the key covers both
  await alanSec('Tümü');await secOgr('SENTETİK ÖĞRENCİ 3 · 9302');
  assert.deepEqual(await page.locator('.yd-oturum').allInnerTexts(),['TYT','AYT','TYT','AYT']);
  const sirali=await page.evaluate(()=>[...document.querySelectorAll('.yd-ogr .yd-oturum,.yd-ogr .yd-ders h3,.yd-anahtar .yd-cevap caption')].map(e=>e.className==='yd-oturum'?'#'+e.textContent:e.textContent.replace(/\s+\d+$/,'')));
  assert(sirali.indexOf('#TYT')<sirali.indexOf('#AYT'),'TYT before AYT: '+sirali.join('|'));
  // Oturum: TYT only hides the alan selector and the AYT ticks; AYT only drops the TYT ones
  await sec('oturum').selectOption('TYT');await hazir();
  assert.equal(await sec('alan').count(),0,'no alan for TYT only');assert.deepEqual(await page.locator('.yd-oturum').allInnerTexts(),['TYT','TYT']);
  assert.equal((await tikler()).some(t=>/Edebiyat|Tarih-1/.test(t)),false);
  await sec('oturum').selectOption('AYT');await hazir();
  assert.equal(await sec('alan').count(),1);assert.equal((await tikler()).some(t=>/Türkçe/.test(t)),false);assert.deepEqual(await page.locator('.yd-oturum').allInnerTexts(),['AYT','AYT']);
  // print: session headings and the key are in the printed pages, the selectors and tiers are not
  if(width===1280){
   await sec('oturum').selectOption('TYT+AYT');await hazir();
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.yd-ogr:not(.yd-yok) .yd-oturum')].every(e=>getComputedStyle(e).display!=='none')&&document.querySelectorAll('.yd-ogr:not(.yd-yok) .yd-oturum').length>=4),true);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.yd-filtre')).display),'none','the selectors are not printed');
   assert.doesNotMatch(await page.evaluate(()=>document.querySelector('.yd-ogr:not(.yd-yok)').textContent),/Öğrencinin alanı|SAY|SÖZ|kademe/i);
   const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});assert(sayfaSayisi(pdf)>=2);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
  }
  await noScroll('Oturum and Alan selectors');
  await sec('oturum').selectOption('TYT+AYT');await sec('alan').selectOption('ogr');await secOgr('SENTETİK ÖĞRENCİ 1 · 9300');
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
  for(const k of ['cok-kolay','kolay','orta','zor','cok-zor'])await page.locator('[data-yd-z="'+k+'"]').click();await hazir();
  assert.equal(await page.locator('.yd-soru').count(),0,'no chip, no Kendi seviyesi: nothing');
  await page.locator('[data-yd-z="kendi"]').click();await hazir();
  const kendi=await page.locator('.yd-soru').count();assert(kendi>0&&kendi<tum,'Kendi seviyesi '+kendi+' of '+tum);assert.doesNotMatch(await page.locator('.yd-ust').innerText(),/Kendi seviyesi|kademe/i,'the heading of the defter does not name it');
  assert.equal(await page.locator('[data-yd-z="kendi"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-yd-z="kendi"]').click();await hazir();
  for(const k of ['cok-kolay','kolay','orta','zor','cok-zor'])await page.locator('[data-yd-z="'+k+'"]').click();await hazir();
  assert.equal(await page.locator('.yd-soru').count(),tum,'back to all five');
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
  // compact print: ~20 mixed-height synthetic questions, the former row layout against the column flow
  if(width===1280){
   await secOgr('SENTETİK ÖĞRENCİ 1 · 9300');
   await page.evaluate(()=>{
    const kap=document.querySelector('#ydBaski .yd-ogr:not(.yd-yok) .yd-sorular'),ilk=kap.querySelector('.yd-soru'),H=[170,300,520,230,760,380,210,450];
    kap.querySelectorAll('.yd-soru').forEach(f=>f.remove());
    // only this ders is measured: the session headings and the other dersler are taken out
    const ogr0=kap.closest('.yd-ogr');ogr0.querySelectorAll('.yd-oturum').forEach(x=>x.remove());ogr0.querySelectorAll('.yd-ders').forEach(d=>{if(d!==kap.closest('.yd-ders'))d.remove()});ogr0.querySelectorAll('.yd-anahtar .yd-cevap').forEach((t,i)=>{if(i>0)t.remove()});
    for(let i=0;i<20;i++){const f=ilk.cloneNode(true),c=document.createElement('canvas');c.width=1152;c.height=H[i%H.length];const x=c.getContext('2d');x.fillStyle='#eee';x.fillRect(0,0,c.width,c.height);x.fillStyle='#222';x.font='40px Arial';x.fillText('Sentetik soru '+(i+1),30,60);x.strokeRect(2,2,c.width-4,c.height-4);
     const im=f.querySelector('img');im.removeAttribute('data-bekle');im.src=c.toDataURL();f.querySelector('figcaption b').textContent='Soru '+(i+1);kap.appendChild(f)}
    document.querySelectorAll('#ydBaski .yd-ogr').forEach((o,i)=>{if(i>0)o.remove()});
   });
   await page.evaluate(()=>Promise.all([...document.querySelectorAll('#ydBaski img')].map(i=>i.decode&&i.decode().catch(()=>{}))));
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   const pdfSonra=await page.pdf({preferCSSPageSize:true,printBackground:true});
   const eski=await page.addStyleTag({content:'@media print{#ydKok .yd-sorular{display:grid!important;column-count:auto!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:6mm 5mm}#ydKok .yd-soru{display:block!important;width:auto!important;margin:0!important}#ydKok .yd-genis{column-span:none!important;grid-column:1/-1}#ydKok .yd-soru img{width:100%!important;max-width:576px!important;max-height:none!important;object-fit:fill!important}#ydKok .yd-soru figcaption{font-size:.8125rem!important;padding-bottom:4px!important;line-height:normal!important}#ydKok .yd-zorluk{padding:3px 9px!important;font-size:.75rem!important}#ydKok .yd-ogr{gap:10px!important}#ydKok .yd-ders h3{margin-bottom:8px!important}}'});
   const pdfOnce=await page.pdf({preferCSSPageSize:true,printBackground:true});
   await eski.evaluate(e=>e.remove());
   const once=sayfaSayisi(pdfOnce),sonra=sayfaSayisi(pdfSonra);
   console.log('print pages (20 mixed-height questions + key page): before '+once+', after '+sonra);
   assert(sonra<once,'the column flow prints fewer pages: '+sonra+' < '+once);
   assert.doesNotMatch(await page.evaluate(()=>document.getElementById('ydBaski').textContent),/Kendi seviyesi|kademe/i);
   const dizin=process.env.YKS_PRINT_OUT;if(dizin){fs.mkdirSync(dizin,{recursive:true});fs.writeFileSync(path.join(dizin,'defter-once.pdf'),pdfOnce);fs.writeFileSync(path.join(dizin,'defter-sonra.pdf'),pdfSonra)}
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
