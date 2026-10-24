// Real downloads with local pinned dependencies; all records are invented.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
const {homework,attendance,grade9}=require('./fixtures/ogrencirapor-pdf.cjs');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {ornekRapor}=require('./fixtures/yoklama-pdf.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad)};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-ogrencirapor-'));fs.mkdirSync(out,{recursive:true});
const old=structuredClone(SINAVLAR.once.T);old.tarih='27.05.2024';
const files={'tyt-ayt.pdf':okulListesi(SINAVLAR.sonra.F),'eski.pdf':okulListesi(old),'9a.pdf':grade9(),'odev.pdf':homework(),'yoklama.pdf':attendance(),'etut.pdf':etutRaporu(GUNLER)};
const upload=name=>({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950},acceptDownloads:true}),page=await context.newPage(),errors=[];let blockLibrary=true;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+03:00'));
  await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://localhost/'))return r.fulfill({contentType:'text/html',body:html});if(CDN[u]&&!blockLibrary)return r.fulfill({path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof OGRENCI_RAPOR==='object');
  await page.evaluate(f=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogrencirapor';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};denemePdfSayfalari=async file=>{if(!f[file.name])throw new Error('Geçersiz PDF');return structuredClone(f[file.name])};ciz()},files);
  assert(await page.locator('#orOne').isDisabled());
  // Denemeler, etütler and yoklama come from Sıralamalar, Etütler and Yoklama; nothing is uploaded here for them.
  await page.evaluate(([f,yk])=>{D.siralama=SIRALAMA.oku().veri;for(const k of ['tyt-ayt.pdf','eski.pdf'])SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(f[k].pages,f[k].boylar));
   D.etut=ETUT.birlestir(null,ETUT.pdfCoz(f['etut.pdf'].pages));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(yk.pages));ciz()},[files,ornekRapor()]);
  const kaynaklar=await page.locator('.or-kaynaklar').innerText();for(const t of ['2 sınav','Etütler','7 öğrenci · 14.09.2026 – 16.10.2026','Öğrenci Ev Ödev Durum Raporu eklenmedi'])assert(kaynaklar.includes(t),t);
  assert.equal(await page.locator('.or-kaynaklar [data-sekme="yoklama"]').count(),1);
  const before=await page.evaluate(()=>JSON.stringify(D)),siteCount=await page.locator('#orStudent option').count();assert(siteCount>2,'site data alone gives reports');
  // Here only the homework report and 9. sınıf lists Sıralamalar cannot read are added; the others are sent to their pages.
  await page.locator('#orFiles').setInputFiles([...Object.keys(files),'bozuk.pdf'].map(upload));await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent.includes('2 dosya eklendi.'));
  const durum=await page.locator('#orStatus').innerText();
  for(const t of ['bozuk.pdf: Geçersiz PDF','tyt-ayt.pdf: deneme sonuç listesi; Sıralamalar sayfasından ekleyin.','etut.pdf: etüt raporu; Etütler sayfasından ekleyin.','yoklama.pdf: yoklama raporu; Yoklama sayfasından ekleyin.'])assert(durum.includes(t),t);
  assert.equal(await page.evaluate(()=>JSON.stringify(D)),before);assert((await page.locator('.or-kaynaklar').innerText()).includes('odev.pdf'));
  const initial=await page.evaluate(()=>JSON.stringify(OGRENCI_RAPOR.model()));const allCount=await page.locator('#orStudent option').count();assert(allCount>siteCount);
  await page.locator('#orFiles').setInputFiles(['odev.pdf','9a.pdf'].map(upload));await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='2 dosya eklendi.');assert.equal(await page.evaluate(()=>JSON.stringify(OGRENCI_RAPOR.model())),initial);
  await page.locator('#orClass').selectOption('12/A');await page.locator('#orStudent').selectOption({label:'SENTETİK ADA · 12/A'});
  const preview=await page.locator('.or-preview').innerText();for(const expected of ['27.05.2024','AYT','24.10.2026','Ödev tarihi: belirtilmemiş','%94','Etüt'])assert(preview.includes(expected),expected);
  assert(!/Şube sırası|Ortalama|Tekrar et/.test(preview));
  // A failed dependency fetch must unlock the buttons and allow a successful retry.
  await page.locator('#orOne').click();await page.waitForFunction(()=>!document.querySelector('#orOne').disabled);assert(!(await page.locator('#orStatus').innerText()).includes('PDF hazır.'));blockLibrary=false;
  async function download(id,count,label){const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.locator(id).click()]);const file=path.join(out,'ogrenci-'+label+'-'+width+'.pdf');await d.saveAs(file);const pdf=await PDFDocument.load(fs.readFileSync(file));assert.equal(pdf.getPageCount(),count);for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-1190.55)<.01);assert(Math.abs(p.getHeight()-841.89)<.01)}await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='PDF hazır.');return file}
  await download('#orOne',1,'tek');await download('#orAll',await page.locator('#orStudent option').count(),'sinif');
  await page.locator('#orClass').selectOption('');await download('#orAll',allCount,'hepsi');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.screenshot({path:path.join(out,'ogrenci-'+width+'.png'),fullPage:true});await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-rapor-'+width+'.png')});
  await page.locator('#orClass').selectOption('9/A');assert.equal(await page.locator('#orStudent option').count(),2,'the 9. sınıf list and a student from Yoklama');
  await page.locator('#orStudent').selectOption({label:'SENTETİK ECE · 9/A'});assert((await page.locator('.or-preview').innerText()).includes('TYT-901'));
  await page.locator('#orClear').click();await page.locator('#orClass').selectOption('9/A');assert.equal(await page.locator('#orStudent option').count(),1,'the uploaded list goes; Yoklama stays');assert.equal(await page.evaluate(()=>JSON.stringify(D)),before);
  await page.locator('#orFiles').setInputFiles([upload('9a.pdf')]);await page.waitForFunction(()=>document.querySelectorAll('#orStudent option').length===2);
  await page.evaluate(()=>{D=varsayilan();D.rol='rehber';ciz()});assert.equal(await page.locator('#orStudent option').count(),0,'notebook switch clears imports');
  await page.evaluate(()=>{D.rol='ogrenci';ciz()});assert.equal(await page.locator('#orFiles').count(),0,'student cannot access imports');assert.deepEqual(errors,[]);
  console.log('PASS student PDF browser',width);await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
