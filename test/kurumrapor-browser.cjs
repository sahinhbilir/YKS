// Kurum raporu in the browser: the Öğrenci raporu | Kurum raporu toggle, the Kapsam select, the live preview (the SVG the PDF uses),
// Türkiye geneli / Etüt etkisi / Ödevler blocks (no Devamsızlık, no Şube karşılaştırması, no teacher or etüt counts), one-page and
// all-levels PDF downloads, light and dark, 1280 and 390 px. Synthetic planted-effect schools are laid out as A4 pages too.
// Screenshots go to YKS_UI_ARTIFACTS (kurum2-*.png). Every record is invented.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const {okulListesi,sinifListesi,SINAVLAR,SINIFLAR}=require('./fixtures/siralama-pdf.cjs');
const {homework}=require('./fixtures/ogrencirapor-pdf.cjs');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {ornekRapor}=require('./fixtures/yoklama-pdf.cjs');
const {kurumListesi,kurumRaporu,BIZ,BIZIM}=require('./fixtures/kurum-pdf.cjs'),fx=require('./fixtures/kurum-etut.cjs');
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
  const teachers=await page.evaluate(()=>[...new Set(OGRENCI_RAPOR.model().students.flatMap(s=>s.sessions.map(x=>x.teacher)).filter(Boolean))]);
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
  const okul=await page.locator('.or-preview').innerText();for(const t of ['Kurum raporu · Tüm okul','Türkiye geneli · sınıf düzeylerine göre','TYT dilimi','Dilim gelişimi','Etüt etkisi','Ödev raporu: yok','12. sınıf','Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.','Kolej listesi'])assert(okul.replace(/\s+/g,' ').includes(t),t);
  for(const t of ['Devamsızlık','Şube karşılaştırması','Öğretmene göre','Derse göre etüt','Haftalık','Yoklama:'])assert(!okul.includes(t),'removed block is back: '+t);
  for(const t of teachers)assert(!okul.includes(t),'the report names the teacher '+t);
  for(const n of names)assert(!okul.includes(n),'the report names '+n);
  assert(!okul.includes('…'));assert(okul.replace(/\s+/g,' ').includes('Etüt etkisi'),'the Etüt etkisi block (rows or what is missing)');
  assert.equal(await page.locator('.or-preview g[aria-label^="Ödev tamamlama"]').count(),0,'no homework report yet');
  await page.screenshot({path:path.join(out,'kurum2-okul-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum2-a4-okul-s'+(i+1)+'.png')});
  // 12. sınıf: the Türkiye block with a chart, the dashed 50 line, tiles and the per-ders table.
  await page.locator('#orScope').selectOption('12');
  const p12=(await page.locator('.or-preview').innerText()).replace(/\s+/g,' ');
  for(const t of ['Kurum raporu · 12. sınıf','TYT toplam · Türkiye dilimi','AYT toplam · Türkiye dilimi','Türkiye yüzdelik dilimi (küçük = daha iyi)','Türkiye’nin ortasındaki okul','ilk %1','ilk %50','ilk %95','TYT toplam','SAY toplam','EA toplam','SÖZ toplam','TYT dersleri · Türkiye dilimi','AYT dersleri · Türkiye dilimi','Değişim: 1201 → 1203 (tarama → tarama)','▲ yeşil: üst dilime çıktı (iyileşti) · ▼ kırmızı: alt dilime düştü','Ders karşılaştırması: 1201 → 1203 (tarama)','Sayfa 1 / ','Sayfa 2 / ','Etüt etkisi','Ödev raporu: yok'])assert(p12.includes(t),t);
  for(const n of names)assert(!p12.includes(n),'the report names '+n);
  assert(!p12.includes('…'),'no name is cut with an ellipsis');assert(!/(^|[^\p{L}])T([^\p{L}]|$)/u.test(p12)&&!p12.includes('ΔT')&&!p12.includes('T puanı'),'no headline T text on the Kurum page');for(const t of ['Devamsızlık','Şube karşılaştırması','Öğretmene göre','Haftalık'])assert(!p12.includes(t),t);for(const t of teachers)assert(!p12.includes(t),'teacher '+t);
  assert.equal(await page.locator('.or-preview g[aria-label="TYT dilim grafiği"]').count(),1);assert.equal(await page.locator('.or-preview g[aria-label="AYT dilim grafiği"]').count(),1,'TYT and AYT are separate charts');assert.equal(await page.locator('.or-preview svg').first().locator('g[data-kart="Türkiye geneli"]').count(),1,'the Türkiye block is on page 1');assert.equal(await page.locator('.or-preview g[aria-label^="TYT toplam · ilk %"]').count(),1);
  await page.screenshot({path:path.join(out,'kurum2-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum2-a4-12-s'+(i+1)+'.png')});
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
  assert.equal(await page.locator('.or-preview g[aria-label^="Ödev tamamlama"]').count(),1);const odev=(await page.locator('.or-preview g[data-kart^="Ödevler"]').textContent()).replace(/\s+/g,' ');assert(odev.includes('Rapor: 24.10.2026')&&odev.includes('Tamamladı')&&odev.includes('Matematik'),odev);
  await page.screenshot({path:path.join(out,'kurum2-odev-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum2-a4-12-odev-s'+(i+1)+'.png')});
  assert.deepEqual(await page.evaluate(LAYOUT),{bad:[],over:[]},'layout with the ödev report');
  // 9. sınıf has no Türkiye geneli list: the school's own TYT average is drawn with the plain notice.
  await page.locator('#orScope').selectOption('9');const p9=(await page.locator('.or-preview').innerText()).replace(/\s+/g,' ');assert(p9.includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.')&&p9.includes('Okulun kendi TYT ortalaması'),p9);
  await page.screenshot({path:path.join(out,'kurum2-9-'+width+'-'+theme+'.png'),fullPage:true});
  if(width===1280&&theme==='light')for(let i=0;i<await sayfa();i++)await page.locator('.or-preview svg').nth(i).screenshot({path:path.join(out,'kurum2-a4-9-s'+(i+1)+'.png')});
  // Synthetic schools with planted effects (the page's own fixtures have no etüt effect to read back): their pages are laid out in the browser,
  // checked for overflow and overprint, and the planted +0,4 net per etüt is read back from the drawn text. Short: 3 grades, 4 + 1 dersler,
  // 10th grade without etüt. Long: ten TYT and four AYT dersler and thirteen ödev dersler.
  const C13=['MATEMATİK TYT','MATEMATİK AYT','FİZİK','KİMYA','BİYOLOJİ','TÜRKÇE','EDEBİYAT','TARİH','COĞRAFYA','FELSEFE','DİN KÜLTÜRÜ','GEOMETRİ','İNGİLİZCE'];
  const uzunOgr=[...fx.ogrenciler({tyt:fx.TYT_UZUN,ayt:fx.AYT_UZUN}),...fx.ogrenciler({sinif:11,tyt:fx.TYT_UZUN.slice(0,3),ayt:[]})];C13.forEach((c,i)=>{uzunOgr[i].homework=[{course:c,values:[4,2,1,0,0,1,0],reportDate:'2026-10-24'}]});
  const senaryolar=[['kisa',[...fx.ogrenciler(),...fx.ogrenciler({sinif:11,tyt:fx.TYT_DERS.slice(0,2),ayt:[]}),...fx.ogrenciler({sinif:10,ucret:false})],fx.tr(fx.TYT_DERS,fx.AYT_DERS)],['uzun',uzunOgr,fx.tr(fx.TYT_UZUN,fx.AYT_UZUN)]];
  for(const [ad,ogr,tr] of senaryolar){
   const sonuc=await page.evaluate(([ogr,tr])=>{const R=OGRENCI_RAPOR,oku=TURKIYE.oku,ort=TURKIYE.ortalamalar;TURKIYE.oku=()=>({veri:{}});TURKIYE.ortalamalar=()=>a=>{const o=tr[a];return o?{genel:k=>k in o?o[k]:null}:null};
    try{const all=[],say=[];for(const s of R.kurumKapsamlari(ogr)){const p=R.svgKurum(R.kurumRapor(ogr,s,()=>({var:false,neden:'liste'})),'2026-10-25');say.push([s.key,p.length]);all.push(...p)}
     const box=document.createElement('div');box.className='or-preview or-sayfalar';box.id='kr-test';box.innerHTML=all.join('');document.querySelector('.or-workspace').append(box);
     return {say,text:[...box.querySelectorAll('text')].map(t=>t.textContent).join(' ').replace(/\s+/g,' ')}}finally{TURKIYE.oku=oku;TURKIYE.ortalamalar=ort}},[ogr,tr]);
   assert(!/öğretmen/i.test(sonuc.text)&&!sonuc.text.includes('SENTETİK ÖĞR')&&!sonuc.text.includes('…'),'no names and no cut text');for(const t of ['Devamsızlık','Şube karşılaştırması','Öğretmene göre'])assert(!sonuc.text.includes(t),t);
   if(ad==='kisa'){for(const t of ['≈ +0,4 net','(+0,4 ile +0,4)','≈ +0,3 net','≈ −0,5 net','artış belirgin','belirgin fark yok','etüt alanlarda daha az','yeterli veri yok','Her etüt için artış: aynı başlangıç düzeyindeki öğrencilere göre, etüt sayısı arttıkça Türkiye farkındaki ek artış (net). Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.','Her etüt için artış (net) ve karar','Etüt sayısı ve ek artış','her nokta bir öğrenci','Aldığı etüt sayısı','10. sınıf: Etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.'])assert(sonuc.text.includes(t),ad+' '+t)}
   else for(const d of ['Türkçe','Coğrafya','Din Kültürü','Geometri'])assert(sonuc.text.includes(d),d);
   assert(sonuc.say.every(([,n])=>n>=1)&&(ad==='kisa'||sonuc.say.some(([,n])=>n>=2)),JSON.stringify(sonuc.say));
   assert.deepEqual(await page.evaluate(LAYOUT,'#kr-test svg'),{bad:[],over:[]},ad+' lays out cleanly');
   if(ad==='kisa')await page.locator('#kr-test').screenshot({path:path.join(out,'kurum2-etut-'+width+'-'+theme+'.png')});
   if(width===1280&&theme==='light'){const n=await page.locator('#kr-test svg').count();for(let i=0;i<n;i++)await page.locator('#kr-test svg').nth(i).screenshot({path:path.join(out,'kurum2-a4-etut-'+ad+'-s'+(i+1)+'.png')})}
   await page.locator('#kr-test').evaluate(e=>e.remove());
  }
  // PDFs: one page for the chosen scope, and one page per level plus the school.
  async function download(id,count,label){const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.locator(id).click()]);const file=path.join(out,'kurum2-'+label+'-'+width+'-'+theme+'.pdf');await d.saveAs(file);const pdf=await PDFDocument.load(fs.readFileSync(file));assert.equal(pdf.getPageCount(),count);for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-841.89)<.01);assert(Math.abs(p.getHeight()-595.28)<.01)}await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='PDF hazır.');return d.suggestedFilename()}
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
