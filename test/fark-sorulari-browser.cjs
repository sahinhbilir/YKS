// Yanlışlar defteri → Ders öğretmenleri: fark soruları in a real browser (real pdf.js cut-outs, real pdf-lib PDF), at 1280 light and 390 dark.
// A 60-student TYT (Türkçe and Matematik, 20 questions each) whose Performans analizi puts a few questions 22-30 points above our students (behind
// beyond chance) and the rest within 3-5 points (chance), and the small AYT group of the fixture (three A students) with two near-certain questions
// they missed once. Timetables give each subject one teacher over 12/A and 12/B: a sheet per teacher and subject, the data in words, no points and
// no colours; the questions are picked by the chance test (z ≤ −1,96), with no threshold to set. Synthetic data only. Set YKS_UI_ARTIFACTS to keep the files.
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
const out_dir=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-fark-'));fs.mkdirSync(out_dir,{recursive:true});
const pdf=(name,buffer)=>({name,mimeType:'application/pdf',buffer});

/* ---- the exam: our students' rate per A question (everyone sat the TYT; B students through the map), and the network's set above it on a few ---- */
const sim=Y.simule({N:60,seed:4242});
const okulP=(t,a)=>{const off=t*20;let d=0;for(const o of sim.ogr){const own=o.kit==='A'?a:sim.perm[t][a-1],k=(o.kit==='A'?sim.keyA:sim.keyB)[off+own-1];if(o.cev[off+own-1]===k)d++}return d/sim.ogr.length};
const GERI={0:[],1:[]};
const p=[0,1].map(t=>Array.from({length:20},(_,i)=>{
  const ps=okulP(t,i+1);let tr=Math.min(.97,Math.max(.03,ps+(i%3?.04:-.03)));
  if(ps>.15&&ps<.6&&GERI[t].length<(t?2:3)){tr=Math.min(.97,ps+.22+.04*GERI[t].length);GERI[t].push(i+1)}
  return Math.round(tr*100)/100;
}));
const perfDersler=[{ad:'TÜRKÇE-T',n:20,anahtar:sim.keyA.slice(0,20),p:p[0]},{ad:'MATEMATİK-T',n:20,anahtar:sim.keyA.slice(20,40),p:p[1]},
  {ad:'TÜRK DİLİ VE EDB-A',n:3,anahtar:Y.AYT_KEY_A.slice(0,3),p:[.85,.99,.25]},{ad:'TARİH.1-A',n:2,anahtar:Y.AYT_KEY_A.slice(3,5),p:[.98,.45]},{ad:'MATEMATİK-A',n:3,anahtar:Y.AYT_KEY_A.slice(5,8),p:[.6,.35,.1]}];
// Timetables: one teacher per lesson over both classes; Türkçe beside Türk dili ve edebiyatı makes the latter AYT Edebiyat.
const PLAN=Object.fromEntries(['12/A','12/B'].map((c,i)=>[c,{kod:String(301+i),ts:1,saatler:['09.00','10.00','11.00','12.00'],dersler:[[0,'09.00','TÜRKÇE','SENTETİK ÖĞRETMEN AY'],[0,'10.00','TÜRK DİLİ VE EDEBİYATI','SENTETİK ÖĞRETMEN EDB'],[0,'11.00','MATEMATİK','SENTETİK ÖĞRETMEN MAT'],[0,'12.00','TARİH','SENTETİK ÖĞRETMEN TAR']]}]));
const DOSYALAR=()=>[
 pdf('tyt-kitapcik.pdf',Y.pdfYaz(Y.kitapcikSpecBuyuk([['TUR',20],['MAT',20]],'1203','TYT'))),
 pdf('ayt-kitapcik.pdf',Y.pdfYaz(Y.kitapcikSpecAyt('1203'))),
 {name:'cevap-raporu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Y.raporBuyuk(sim,{ayt:true})},
 pdf('cozum.pdf',Y.pdfYaz(Y.cozumSpec(sim.pairs,5,'1203'))),
 pdf('performans-analizi.pdf',Y.pdfYaz(Y.performansSpec({ascii:true,kod:'27-YKS-1203',dersler:perfDersler})))];

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const [width,theme] of [[1280,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme,acceptDownloads:true,deviceScaleFactor:width===1280?1:2}),outside=[],errors=[];
  await context.route('**/*',r=>{const u=r.request().url();
   if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
   if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
   outside.push(u);return r.abort()});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://localhost/?dev=1');
  await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
  await page.evaluate(()=>{window.bulut={mevcutKullanici:()=>({uid:'sentetik-ogretmen-fark',isAnonymous:false})};D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='yanlislar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()});
  await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi);
  const noScroll=async m=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll: '+m+' at '+width);
  const hazir=()=>page.waitForFunction(()=>{const im=[...document.querySelectorAll('#ydBaski img')];return im.length>0&&im.every(i=>i.complete&&i.naturalWidth>0)&&!document.getElementById('ydIlerleme').textContent});
  await page.locator('#ydDosya').setInputFiles(DOSYALAR());
  await page.waitForFunction(()=>YANLISLAR.durumu().mesgul===''&&!YANLISLAR.durumu().kilit);
  assert.equal(await page.locator('.yd-hata').count(),0,'every file accepted: '+await page.locator('.yd-hata').allInnerTexts());
  assert.deepEqual(await page.locator('tr[data-yd-satir="1203"] td.yd-h span').allInnerTexts(),['✓','✓','✓','✓','✗','✓']);

  /* ---------- the switch and the view ---------- */
  await page.evaluate(PL=>{const p=ETUTPLANI.oku().plan;p.programlar=PL;D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)));ciz()},PLAN);
  await page.locator('[data-yd-gorunum="ders"]').click();await hazir();
  assert.equal(await page.locator('[data-yd-gorunum="ders"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-yd-f="esik"]').count(),0,'no threshold to set');
  assert.deepEqual(await page.locator('[data-yd-f="ogretmen"] option').allInnerTexts(),['Bütün öğretmenler','Sentetik Öğretmen Ay','Sentetik Öğretmen Edb','Sentetik Öğretmen Mat','Sentetik Öğretmen Tar']);
  assert.equal(await page.locator('[data-yd-f="alan"],[data-yd-f="sube"],[data-yd-f="ogr"]').count(),0,'no student filters');
  const sayfalar=await page.locator('.yd-fd').evaluateAll(l=>l.map(a=>a.dataset.ydFd));
  assert.deepEqual(sayfalar,['Sentetik Öğretmen Ay · TYT Türkçe','Sentetik Öğretmen Edb · AYT Türk Dili ve Edebiyatı','Sentetik Öğretmen Mat · TYT Matematik','Sentetik Öğretmen Tar · AYT Tarih-1'],'a sheet per teacher and subject');
  assert.match(await page.locator('.yd-fd').first().locator('.yd-ust').innerText(),/^TYT Türkçe\s+Sentetik Öğretmen Ay · 12\/A, 12\/B\s+Bu denemede şubelerinizin sınav okullarının gerisinde kaldığı sorular\s+3 soru$/);
  const sorular=await page.locator('.yd-fd .yd-fs').evaluateAll(l=>l.map(f=>({sayfa:f.closest('.yd-fd').dataset.ydFd,no:f.querySelector('b').textContent,okul:+f.dataset.ydOkul,okullar:+f.dataset.ydOkullar,cumle:f.querySelector('.yd-fs-cumle').innerText,bilgi:f.querySelector('.yd-fs-bilgi').innerText})));
  const of=ad=>sorular.filter(s=>s.sayfa.endsWith(ad));
  assert.deepEqual(of('TYT Türkçe').map(s=>s.no),GERI[0].map(a=>'Soru '+a));assert.deepEqual(of('TYT Matematik').map(s=>s.no),GERI[1].map(a=>'Soru '+a));
  assert(sorular.every(s=>s.okullar>s.okul),'every question behind');
  // the model's own test: every listed question is behind beyond chance, every other compared question is not
  const zler=await page.evaluate(()=>{const M=YANLISLAR.durumu().fark;return M.sayfalar.flatMap(g=>g.denemeler.flatMap(d=>d.sorular.map(x=>x.z)))});
  assert(zler.length===sorular.length&&zler.every(z=>z<=-1.96),'z ≤ −1,96: '+zler);
  for(const s of sorular)assert.match(s.cumle,/^Sınav okullarında öğrencilerin %\d+’(ı|i|u|ü|sı|si|su|sü) bu soruyu doğru cevapladı; şubelerinizde (yalnızca %\d+’(ı|i|u|ü|sı|si|su|sü)|kimse doğru cevaplamadı)\.$/,s.cumle);
  assert.deepEqual(of('AYT Türk Dili ve Edebiyatı').map(s=>[s.no,s.cumle]),[['Soru 2','Sınav okullarında öğrencilerin %99’u bu soruyu doğru cevapladı; şubelerinizde yalnızca %67’si.']],'three A students (the B one has no AYT map); Soru 1 (67 against 85) may be chance');
  assert.deepEqual(of('AYT Tarih-1').map(s=>[s.no,s.okul,s.okullar]),[['Soru 4',67,98]]);
  assert.match(of('AYT Türk Dili ve Edebiyatı')[0].bilgi,/^Doğru cevap: B\s+En çok işaretlenen yanlış: C \(%33\)\s+Boş bırakan: %0$/);
  assert.match(await page.locator('.yd-fd').first().locator('.yd-kimlik').nth(2).innerText(),/^60 öğrenci · 3 \/ 20 soru$/);
  const metin=await page.locator('#ydBaski').innerText();assert.doesNotMatch(metin,/puan|[Ff]ark|tesadüf/,'no points and no gap on the sheets');
  assert.equal(await page.locator('#ydBaski [style*="background"]').count(),0,'no colours on the sheets');
  assert.match(await page.locator('.yd-fs-durum').innerText(),/Listelenen sorular: şubelerin doğru oranının, öğrenci sayısına göre tesadüfle açıklanamayacak kadar sınav okullarının altında kaldığı sorular \(z ≤ −1,96\)\./);
  assert.match(await page.locator('.yd-fs-durum').innerText(),/Belirgin biçimde geride kalınan soru yok: Sentetik Öğretmen Mat · AYT Matematik/);
  // the cut-outs are real pictures of the booklet
  const tinta=await page.evaluate(()=>[...document.querySelectorAll('#ydBaski img')].map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]<200)n++;return n}));
  assert(tinta.length===7&&tinta.every(n=>n>200),'seven real cut-outs: '+tinta);
  await noScroll('fark soruları');
  await page.screenshot({path:path.join(out_dir,'fark-sayfa-'+width+'-'+theme+'.png'),fullPage:true});
  await page.locator('.yd-fd').first().screenshot({path:path.join(out_dir,'fark-ders-'+width+'-'+theme+'.png')});
  // Hangi sorular: at least 20 points behind, whatever the number of students; the default is the chance test
  assert.equal(await page.locator('[data-yd-f="secim"]').inputValue(),'z');
  await page.locator('[data-yd-f="secim"]').selectOption('20');await hazir();
  const yirmi=await page.locator('.yd-fd .yd-fs').evaluateAll(l=>l.map(f=>f.dataset.ydOkullar-f.dataset.ydOkul));
  assert(yirmi.length>0&&yirmi.every(f=>f>=20),'every question at least 20 points behind: '+yirmi);
  assert.match(await page.locator('.yd-fs-durum').innerText(),/en az 20 puan yüksek olduğu sorular \(öğrenci sayısına bakılmaksızın\)/);
  await page.locator('[data-yd-f="secim"]').selectOption('z');await hazir();
  // one teacher's sheets only
  await page.locator('[data-yd-f="ogretmen"]').selectOption('Sentetik Öğretmen Mat');await hazir();
  assert.deepEqual(await page.locator('.yd-fd').evaluateAll(l=>l.map(a=>a.dataset.ydFd)),['Sentetik Öğretmen Mat · TYT Matematik']);
  const [dl1]=await Promise.all([page.waitForEvent('download'),page.locator('[data-yd-pdf]').click()]);
  assert.equal(dl1.suggestedFilename(),'Fark_sorulari_1203_SentetikOgretmenMat.pdf');assert.equal((await PDFDocument.load(fs.readFileSync(await dl1.path()))).getPageCount(),1);
  await page.locator('[data-yd-f="ogretmen"]').selectOption('');await hazir();

  /* ---------- print: a sheet a page ---------- */
  if(width===1280){
   await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   const st=await page.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {filtre:g('.yd-filtre').display,ders:g('.yd-fd').breakBefore,kolon:g('.yd-sorular').columnCount}});
   assert.deepEqual(st,{filtre:'none',ders:'page',kolon:'2'});
   const baski=await page.pdf({preferCSSPageSize:true,printBackground:true});
   assert.equal((baski.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length,4,'four sheets, a page each');
   fs.writeFileSync(path.join(out_dir,'fark-baski.pdf'),baski);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
  }

  /* ---------- PDF indir: the same sheets built in the browser ---------- */
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-yd-pdf]').click()]);
  assert.equal(dl.suggestedFilename(),'Fark_sorulari_1203.pdf');
  const buf=fs.readFileSync(await dl.path()),belge=await PDFDocument.load(buf);
  assert.equal(belge.getPageCount(),4,'one page per sheet here');
  const [w,h]=[belge.getPage(0).getWidth(),belge.getPage(0).getHeight()];assert(Math.abs(w-595.28)<1&&Math.abs(h-841.89)<1,'A4 portrait');
  assert.equal(belge.getTitle(),'Fark soruları');
  fs.writeFileSync(path.join(out_dir,'Fark_sorulari_'+width+'.pdf'),buf);
  // the first sheet as a picture (pdf.js in the page), for a person to look at
  const png=await page.evaluate(async b64=>{
   const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs';
   const doc=await pdfjs.getDocument({data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}).promise,out=[];
   for(const n of [1,3]){const pg=await doc.getPage(n),vp=pg.getViewport({scale:2}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;out.push(cv.toDataURL('image/png'))}
   return out;
  },buf.toString('base64'));
  png.forEach((u,i)=>fs.writeFileSync(path.join(out_dir,'fark-pdf-sayfa'+(i?3:1)+'-'+width+'.png'),Buffer.from(u.split(',')[1],'base64')));
  assert.deepEqual(outside,[],'nothing leaves the page');assert.deepEqual(errors,[],'no page errors');
  await context.close();
 }}finally{await browser.close()}
 console.log('Fark soruları (browser): teacher sheets in words, real cut-outs, the filters, print and PDF passed at 1280 light and 390 dark. Files: '+out_dir);
})().catch(e=>{console.error(e);process.exit(1)});
