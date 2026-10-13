// Sıralamalar on desktop and mobile: lists captured by the Denemeler import and by "PDF ekle",
// the four reports drawn with pdf-lib, preview, per-class sort and delete. Synthetic data only.
// The pinned CDN files are served from local npm copies (pdf-lib@1.17.1, @pdf-lib/fontkit@1.1.1,
// pdfjs-dist@5.6.205, roboto-fontface@0.10.0) found on NODE_PATH; nothing else leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad+' (see .github/workflows/verify.yml)')};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.worker.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-siralama-'));fs.mkdirSync(out,{recursive:true});
const listeler={'sonra-tyt.pdf':okulListesi(SINAVLAR.sonra.T),'sonra-ayt.pdf':okulListesi(SINAVLAR.sonra.F),'once-tyt.pdf':okulListesi(SINAVLAR.once.T),'once-ayt.pdf':okulListesi(SINAVLAR.once.F)};
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:950},acceptDownloads:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-12T12:00:00+03:00'));
   await context.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
    if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
    return r.abort()});
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(l=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-12';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'},{ad:'SENTETİK BORA',no:1002,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-2'}];
    EK.ogr=0;EK.sekme='denemeler';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    // The PDF read itself is pdf.js; the lists stand in for its text items.
    denemePdfSayfalari=async f=>{if(!l[f.name])throw new Error('bilinmeyen dosya');return structuredClone(l[f.name])};ciz();
   },listeler);
   // 1) The Denemeler import keeps the school's whole list for Sıralamalar.
   await page.locator('#dnPdf').setInputFiles([dosya('sonra-tyt.pdf'),dosya('sonra-ayt.pdf')]);
   await page.waitForFunction(()=>DENEME_IMPORT&&!DENEME_ISLEM);
   await page.getByRole('button',{name:'Seçilen sonuçları kaydet ve yayınla',exact:true}).click();await page.waitForFunction(()=>!DENEME_ISLEM);
   assert((await page.locator('#dnDurum').innerText()).includes('Sıralama listesi Sıralamalar’a eklendi'));
   assert.equal(await page.evaluate(()=>D.siralama.sinavlar.map(s=>s.ad+':'+!!s.T+!!s.F).join()),'Sentetik Deneme 2:truetrue');
   assert.equal(await page.evaluate(()=>D.ogr[0].denemeOkul.length),2,'the student import itself is unchanged');
   // 2) The teacher menu opens Sıralamalar; an older exam is added there.
   assert.equal(await page.locator('#ray [data-sekme="siralamalar"]').count(),1);
   await page.evaluate(()=>{EK.sekme='siralamalar';ciz()});
   assert.equal(await page.locator('[data-sr-indir]:not([disabled])').count(),0,'one exam: nothing to compare yet');
   await page.locator('#srPdf').setInputFiles([dosya('once-tyt.pdf'),dosya('once-ayt.pdf'),dosya('notlar.pdf')]);
   await page.waitForFunction(()=>/Kaydedildi/.test(document.getElementById('srDurum')?.textContent||''));
   const durum=await page.locator('#srDurum').innerText();assert(durum.includes('Sentetik Deneme 1 (TYT)')&&durum.includes('notlar.pdf: bilinmeyen dosya'),durum);
   assert.equal(await page.locator('.sr-sinavlar tbody tr').count(),2);
   assert.equal(await page.locator('#srOnceki').inputValue(),'SENTETİK DENEME 1');assert.equal(await page.locator('#srSimdiki').inputValue(),'SENTETİK DENEME 2');
   assert.equal(await page.locator('[data-sr-indir]:not([disabled])').count(),4);
   // 3) Every report downloads as a PDF with the school layout and the change boxes.
   const metin=async b=>page.evaluate(async b64=>{const pdfjs=await denemePdfjs(),d=await pdfjs.getDocument({data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}).promise,s=[];
     for(let n=1;n<=d.numPages;n++){const t=await (await d.getPage(n)).getTextContent();s.push(t.items.map(i=>i.str).join('|'))}return s},b.toString('base64'));
   const raporlar={};
   assert.deepEqual(await page.evaluate(()=>SIRALAMA.RAPORLAR.map(r=>r.dosya({name:'Sentetik Deneme 2'}))),['Sentetik Deneme 2_Toplu.pdf','Sentetik Deneme 2_Sınıf.pdf','Sentetik Deneme 2_AYT_Toplu.pdf','Sentetik Deneme 2_AYT_Sınıf.pdf']);
   for(const id of ['tyt-toplu','tyt-sinif','ayt-toplu','ayt-sinif']){
    const [d]=await Promise.all([page.waitForEvent('download'),page.locator('[data-sr-indir="'+id+'"]').click()]);
    const f=path.join(out,id+'-'+width+'.pdf');await d.saveAs(f);const b=fs.readFileSync(f);
    assert.equal(b.subarray(0,5).toString(),'%PDF-');raporlar[id]=await metin(b);
   }
   assert.equal(raporlar['tyt-toplu'].length,1);assert.equal(raporlar['tyt-sinif'].length,3);assert.equal(raporlar['ayt-sinif'].length,3);
   const tt=raporlar['tyt-toplu'][0];
   assert(tt.includes('DENEME SINAVI TOPLU SONUÇ LİSTESİ Net Sayısı Sıralı')&&tt.includes('Sentetik Deneme 2')&&tt.includes('Kurum Ortalamaları'));
   assert(tt.includes('1001 / SENTETİK ADA')&&tt.includes('+4.00')&&tt.includes('N/A')&&tt.includes('-1.50'));
   assert(raporlar['tyt-sinif'][0].includes('Şube Ortalamaları'));
   assert(raporlar['ayt-toplu'][0].includes('SAY Net')&&raporlar['ayt-toplu'][0].includes('+8.00')&&raporlar['ayt-toplu'][0].includes('+5.75'));
   assert(raporlar['ayt-sinif'][0].includes('AYT EA Net Sayısı Sıralı')&&raporlar['ayt-sinif'][1].includes('AYT SAY Net Sayısı Sıralı'));
   const [hepsi]=await Promise.all([page.waitForEvent('download'),page.locator('#srHepsi').click()]);
   const hf=path.join(out,'hepsi-'+width+'.pdf');await hepsi.saveAs(hf);assert.equal((await metin(fs.readFileSync(hf))).length,8);
   // 4) Preview, and a per-class sort that persists and redraws the preview.
   await page.locator('[data-sr-onizle="ayt-sinif"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#srSayfalar canvas').length===3);
   assert((await page.locator('#srOnizlemeAlt').innerText()).includes('Sentetik Deneme 1 → Sentetik Deneme 2'));
   await page.locator('select[data-sr-sinif="301 12/A"]').selectOption('Toplam');
   await page.waitForFunction(()=>D.siralama.tercih['301 12/A']==='Toplam'&&document.querySelectorAll('#srSayfalar canvas').length===3);
   assert.equal(await page.locator('select[data-sr-sinif="301 12/A"]').inputValue(),'Toplam');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'overflow at '+width);
   await page.screenshot({path:path.join(out,'siralamalar-'+width+'.png'),fullPage:true});
   // 5) Deleting an exam keeps the students' imported results.
   await page.locator('[data-sr-sil="SENTETİK DENEME 1"]').click();
   await page.waitForFunction(()=>D.siralama.sinavlar.length===1);
   assert.equal(await page.evaluate(()=>D.ogr[0].denemeOkul.length),2);
   assert.equal(await page.locator('[data-sr-indir]:not([disabled])').count(),0);
   assert.deepEqual(errors,[]);console.log('PASS Sıralamalar browser',width);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
