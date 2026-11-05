// Kurum raporu in the browser: the Öğrenci raporu | Kurum raporu toggle, the Kapsam select, the live preview (the SVG the PDF uses),
// Türkiye geneli / etüt / ödev / devamsızlık / şube blocks, one-page and all-levels PDF downloads, light and dark, 1280 and 390 px.
// Screenshots go to YKS_UI_ARTIFACTS (kurum-*.png). Every record is invented.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const {okulListesi,sinifListesi,SINAVLAR,SINIFLAR}=require('./fixtures/siralama-pdf.cjs');
const {homework}=require('./fixtures/ogrencirapor-pdf.cjs');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {ornekRapor}=require('./fixtures/yoklama-pdf.cjs');
const {kurumListesi,kurumRaporu,BIZ,BIZIM}=require('./fixtures/kurum-pdf.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad)};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-kurumrapor-'));fs.mkdirSync(out,{recursive:true});
const old=structuredClone(SINAVLAR.once.T);old.tarih='27.05.2024';
const files={'tyt-ayt.pdf':okulListesi(SINAVLAR.sonra.F),'eski.pdf':okulListesi(old),'9a.pdf':sinifListesi(SINIFLAR.dokuz2),'11.pdf':sinifListesi(SINIFLAR.onbir),'odev.pdf':homework(),'etut.pdf':etutRaporu(GUNLER)};
// Türkiye geneli: four exams of 12. sınıf with every TYT and AYT subject, the school above the Türkiye average and rising.
const DERS=[['TÜRKÇE-T',40],['TARİH-T',5],['COĞRAFYA-T',5],['FELSEFE-T',5],['DİN KÜLTÜRÜ-T',5],['MATEMATİK-T',30],['GEOMETRİ-T',10],['FİZİK-T',7],['KİMYA-T',7],['BİYOLOJİ-T',6],
 ['TÜRK DİLİ VE EDB-A',24],['TARİH.1-A',10],['COĞRAFYA.1-A',6],['TARİH.2-A',11],['COĞRAFYA.2-A',11],['FELSEFE GR.-A',12],['DİN KÜLTÜRÜ-A',6],['MATEMATİK-A',30],['GEOMETRİ-A',10],['FİZİK-A',14],['KİMYA-A',13],['BİYOLOJİ-A',13]];
for(const [kod,soru] of DERS)BIZIM[kod]=[1,2,3,4].map(e=>Math.round((soru*.5+e*.1+(.35+.17*e+(kod.length%3)*.08)*soru*.09)*100)/100);
// 1201 and 1203 are Tarama, 1202 and 1204 Genel: ΔT compares 1201 → 1203.
const ADLAR=['27-YKS-1201 TARAMA','27-YKS-1202','27-YKS-1203 TARAMA','27-YKS-1204'];
const turkiye=ADLAR.map((ad,i)=>kurumRaporu(kurumListesi(i+1,{ad,normal:{N:180,oran:.09},dersler:DERS})).pages);
const upload=name=>({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const [width,theme] of [[1280,'light'],[1280,'dark'],[390,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},colorScheme:theme,acceptDownloads:true,deviceScaleFactor:width===1280?2:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+03:00'));
  await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://localhost/'))return r.fulfill({contentType:'text/html',body:html});if(CDN[u])return r.fulfill({path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof OGRENCI_RAPOR==='object'&&ACILIS_KAYIT>=0);
  await page.evaluate(([f,t,biz])=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogrencirapor';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
   denemePdfSayfalari=async file=>{if(!f[file.name])throw new Error('Geçersiz PDF');return structuredClone(f[file.name])};
   D.siralama=SIRALAMA.oku().veri;for(const k of ['tyt-ayt.pdf','eski.pdf','9a.pdf','11.pdf'])SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(f[k].pages,f[k].boylar));
   D.etut=ETUT.birlestir(null,ETUT.pdfCoz(f['etut.pdf'].pages));
   let a={okul:biz,sinavlar:[]};t.forEach((pages,i)=>{a=TURKIYE.birlestir(a,TURKIYE.pdfCoz(pages,'27-YKS-120'+(i+1)+' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf'));a.sinavlar.at(-1).duzey=12});D.turkiye=TURKIYE.paketle(a,5);ciz()},[files,turkiye,BIZ]);
  // Yoklama: a few missed days for the synthetic students so every band has a story.
  await page.evaluate(yk=>{D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(yk.pages));ciz()},ornekRapor());
  const names=await page.evaluate(()=>OGRENCI_RAPOR.model().students.map(s=>s.name));assert(names.length>=6);
  // The toggle sits at the top; the student mode is the default and keeps its controls.
  assert.equal(await page.locator('.or-mod button').count(),2);assert.equal(await page.locator('.or-mod button[aria-pressed="true"]').innerText(),'Öğrenci raporu');
  assert.equal(await page.locator('#orStudent').count(),1);assert.equal(await page.locator('#krOne').count(),0);
  const first=await page.evaluate(()=>[...document.querySelector('.or-workspace').children].slice(0,2).map(e=>e.className));assert.equal(first[0],'arac');assert.equal(first[1],'or-kaynaklar','toggle first, then the unchanged sources');
  const sourcesStudent=await page.locator('.or-kaynaklar').innerText();
  await page.locator('[data-or-mod="kurum"]').click();
  assert.equal(await page.locator('.or-mod button[aria-pressed="true"]').innerText(),'Kurum raporu');
  assert.equal(await page.locator('#orStudent').count(),0);assert.equal(await page.locator('#orScope').count(),1);assert.match(await page.locator('#krOne').innerText(),/^Kurum PDF \(\d+ sayfa\)$/);
  assert.equal(await page.locator('.or-kaynaklar').innerText(),sourcesStudent,'the data sources block is the same in both modes');
  const options=await page.locator('#orScope option').allInnerTexts();assert(options[0].startsWith('Tüm okul'));assert(options.some(o=>o.startsWith('12. sınıf')),options.join('|'));assert(options.some(o=>o.startsWith('9. sınıf')));
  const toplamSayfa=Number((await page.locator('#krAll').innerText()).match(/Tüm düzeyler PDF \((\d+) sayfa\)/)[1]);assert(toplamSayfa>=options.length,'every scope has at least one page');
  const sayfa=()=>page.locator('.or-preview svg').count();assert.equal(Number((await page.locator('#krOne').innerText()).match(/\((\d+) sayfa\)/)[1]),await sayfa(),'the button counts the pages in the preview');
  // Colour of the pressed toggle differs from the other in both themes (the control works in light and dark).
  const colours=await page.evaluate(()=>[...document.querySelectorAll('.or-mod button')].map(b=>{const c=getComputedStyle(b);return [c.backgroundColor,c.color]}));assert.notDeepEqual(colours[0],colours[1]);
  // Whole school first: one row per grade; the grade with a Türkiye list shows its dilim, the others say so.
  const okul=await page.locator('.or-preview').innerText();for(const t of ['Kurum raporu · Tüm okul','Türkiye geneli · sınıf düzeylerine göre','TYT dilimi','Dilim gelişimi','Etütler','Ödevler','Devamsızlık','Şube karşılaştırması','12. sınıf','Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'])assert(okul.replace(/\s+/g,' ').includes(t),t);
  for(const n of names)assert(!okul.includes(n),'the report names '+n);
  assert(okul.replace(/\s+/g,' ').includes('TYT ort. (son deneme)')&&!okul.includes('…'));
  assert.equal(await page.locator('.or-preview g[aria-label^="Ödev tamamlama"]').count(),0,'no homework report yet');
  await page.screenshot({path:path.join(out,'kurum-okul-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum-a4-okul-s'+(i+1)+'.png')});
  // 12. sınıf: the Türkiye block with a chart, the dashed 50 line, tiles and the per-ders table.
  await page.locator('#orScope').selectOption('12');
  const p12=(await page.locator('.or-preview').innerText()).replace(/\s+/g,' ');
  for(const t of ['Kurum raporu · 12. sınıf','TYT toplam · Türkiye dilimi','AYT toplam · Türkiye dilimi','Türkiye yüzdelik dilimi (küçük = daha iyi)','Türkiye’nin ortasındaki okul','ilk %1','ilk %50','ilk %95','TYT toplam','SAY toplam','EA toplam','SÖZ toplam','TYT dersleri · Türkiye dilimi','AYT dersleri · Türkiye dilimi','Değişim: 1201 → 1203 (tarama → tarama)','▲ yeşil: üst dilime çıktı (iyileşti) · ▼ kırmızı: alt dilime düştü','Ders karşılaştırması: 1201 → 1203 (tarama)','Sayfa 1 / ','Sayfa 2 / ','Haftalık etüt sayısı','Derse göre etüt','Öğretmene göre etüt','Ödev kaydı yok','Öğrenci sayısı, kaçırdığı güne göre','Şube karşılaştırması','12/A'])assert(p12.includes(t),t);
  for(const n of names)assert(!p12.includes(n),'the report names '+n);
  assert(!p12.includes('…'),'no name is cut with an ellipsis');assert(!/(^|[^\p{L}])T([^\p{L}]|$)/u.test(p12)&&!p12.includes('ΔT')&&!p12.includes('T puanı'),'no headline T text on the Kurum page');assert(p12.includes('TYT ort.'));
  assert.equal(await page.locator('.or-preview g[aria-label="TYT dilim grafiği"]').count(),1);assert.equal(await page.locator('.or-preview g[aria-label="AYT dilim grafiği"]').count(),1,'TYT and AYT are separate charts');assert.equal(await page.locator('.or-preview svg').first().locator('g[data-kart="Türkiye geneli"]').count(),1,'the Türkiye block is on page 1');assert.equal(await page.locator('.or-preview g[aria-label^="TYT toplam · ilk %"]').count(),1);
  await page.screenshot({path:path.join(out,'kurum-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum-a4-12-s'+(i+1)+'.png')});
  // Layout: no text leaves the page or its card, and no two texts overprint.
  const LAYOUT=(sel)=>{const res={bad:[],over:[]};for(const svg of document.querySelectorAll(sel||'.or-preview svg')){const texts=[...svg.querySelectorAll('text')].map(t=>({t,b:t.getBBox()}));
   for(const {t,b} of texts){if(b.x<-.5||b.y<-.5||b.x+b.width>1190.55+.5||b.y+b.height>841.89+.5)res.bad.push('page:'+t.textContent);if(/…/.test(t.textContent))res.bad.push('ellipsis:'+t.textContent);
    // Every text of a block lies inside one of the block's white cards.
    const kart=t.closest('g[data-kart]');
    if(kart){const cards=[...kart.querySelectorAll('rect[fill="#fff"]')].map(r=>r.getBBox());if(!cards.some(c=>b.x>=c.x-.5&&b.x+b.width<=c.x+c.width+.5&&b.y>=c.y-.5&&b.y+b.height<=c.y+c.height+.5))res.bad.push(kart.getAttribute('data-kart')+':'+t.textContent+' '+[b.x,b.y,b.width,b.height].map(Math.round))}}
   for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].b,c=texts[j].b,w=Math.min(a.x+a.width,c.x+c.width)-Math.max(a.x,c.x),h=Math.min(a.y+a.height,c.y+c.height)-Math.max(a.y,c.y);if(w>1.5&&h>2.5)res.over.push(texts[i].t.textContent+' / '+texts[j].t.textContent)}}
   return res};
  const layout=await page.evaluate(LAYOUT);
  assert.deepEqual(layout.bad,[],'text outside its card: '+layout.bad.join(' | '));assert.deepEqual(layout.over,[],'overprinted text: '+layout.over.join(' | '));
  // The ödev report added on this page counts for the kurum report too (same sources as the student mode).
  await page.locator('#orFiles').setInputFiles([upload('odev.pdf')]);await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent.includes('1 dosya eklendi.'));
  assert.equal(await page.locator('#orScope').inputValue(),'12','the scope survives adding a file');
  assert.equal(await page.locator('.or-preview g[aria-label^="Ödev tamamlama"]').count(),1);const odev=(await page.locator('.or-preview g[data-kart="Ödevler ve devamsızlık"]').textContent()).replace(/\s+/g,' ');assert(odev.includes('Rapor: 24.10.2026')&&odev.includes('Tamamladı')&&odev.includes('Matematik'),odev);
  await page.screenshot({path:path.join(out,'kurum-odev-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum-a4-12-odev-s'+(i+1)+'.png')});
  assert.deepEqual(await page.evaluate(LAYOUT),{bad:[],over:[]},'layout with the ödev report');
  // 9. sınıf has no Türkiye geneli list: the school's own TYT average is drawn with the plain notice.
  await page.locator('#orScope').selectOption('9');const p9=(await page.locator('.or-preview').innerText()).replace(/\s+/g,' ');assert(p9.includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.')&&p9.includes('Okulun kendi TYT ortalaması'),p9);
  await page.screenshot({path:path.join(out,'kurum-9-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum-a4-9-s'+(i+1)+'.png')});
  // A long school: 14 teachers, 13 ödev dersler, 40 şubes. Every one is listed, on as many pages as needed, nothing overlaps or is cut.
  const uzun=await page.evaluate(()=>{const R=OGRENCI_RAPOR,ppl=[],C=['MATEMATİK TYT','MATEMATİK AYT','FİZİK','KİMYA','BİYOLOJİ','TÜRKÇE','EDEBİYAT','TARİH','COĞRAFYA','FELSEFE','DİN KÜLTÜRÜ','GEOMETRİ','İNGİLİZCE'];
   for(const g of [9,10,11,12])for(const s of 'ABCDEFGHIJ')ppl.push({no:g+s,name:'SENTETİK '+g+s,cls:g+'/'+s,grade:g});
   const T=Array.from({length:14},(_,i)=>'SENTETİK ÖĞRETMEN NUMARA '+(i+1)+(i===13?' UZUNCA SOYADLI':'')),ses=ppl.slice(0,28).map((p,i)=>({...p,date:'2026-09-'+String(15+i%10).padStart(2,'0'),course:C[i%C.length],teacher:T[i%T.length],time:'16:00',minutes:40})),hw=ppl.slice(0,13).map((p,i)=>({...p,course:C[i],values:[4,2,1,0,0,1,0],reportDate:'2026-10-24'}));
   const ms=R.merge([{kind:'exam',students:ppl,exams:ppl.map(p=>({...p,exam:'Sentetik Deneme',date:'2026-10-01',session:'TYT',nets:{turkce:20}})),school:'Sentetik Kartal Anadolu Lisesi'},{kind:'homework',students:ppl,homework:hw,reportDate:'2026-10-24'},{kind:'sessions',students:ppl,sessions:ses,start:'2026-09-14',end:'2026-10-16'}],[]).students;
   const pages=R.svgKurum(R.kurumRapor(ms,R.kurumKapsamlari(ms)[0],()=>({var:false,neden:'liste'})),'2026-10-25');const box=document.createElement('div');box.className='test-sayfalar';box.id='or-uzun';box.innerHTML=pages.join('');document.body.append(box);
   return {pages:pages.length,teachers:T,courses:C,text:box.textContent}});
  assert(uzun.pages>=3,'a long school needs more pages: '+uzun.pages);for(const t of uzun.teachers)assert(uzun.text.includes(t),t);for(const c of uzun.courses)assert(uzun.text.toLocaleLowerCase('tr-TR').includes(c.toLocaleLowerCase('tr-TR')),c);
  assert.deepEqual(await page.evaluate(LAYOUT,'#or-uzun svg'),{bad:[],over:[]},'the long school lays out cleanly');await page.locator('#or-uzun').evaluate(e=>e.remove());
  // PDFs: one page for the chosen scope, and one page per level plus the school.
  async function download(id,count,label){const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.locator(id).click()]);const file=path.join(out,'kurum-'+label+'-'+width+'-'+theme+'.pdf');await d.saveAs(file);const pdf=await PDFDocument.load(fs.readFileSync(file));assert.equal(pdf.getPageCount(),count);for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-841.89)<.01);assert(Math.abs(p.getHeight()-595.28)<.01)}await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='PDF hazır.');return d.suggestedFilename()}
  await page.locator('#orScope').selectOption('12');
  assert.match(await download('#krOne',await sayfa(),'12'),/12_sinif_Kurum_Raporu\.pdf$/);
  assert.match(await download('#krAll',toplamSayfa,'tum'),/Tum_duzeyler_Kurum_Raporu\.pdf$/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scrolling');
  // Back to the student mode: its controls and preview are untouched.
  await page.locator('[data-or-mod="ogrenci"]').click();assert.equal(await page.locator('#orStudent').count(),1);assert.equal(await page.locator('#orOne').innerText(),'Öğrenci PDF');assert((await page.locator('.or-preview').innerText()).includes('Yoklama'));
  await page.locator('[data-or-mod="kurum"]').click();assert.equal(await page.locator('#orScope').inputValue(),'12','the scope is remembered');
  // Only the guidance teacher: a student sees neither mode.
  await page.evaluate(()=>{D.rol='ogrenci';ciz()});assert.equal(await page.locator('.or-mod').count(),0);assert.equal(await page.locator('#krOne').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS kurum report browser',width,theme);await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
