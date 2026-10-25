// Real downloads with local pinned dependencies; all records are invented.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const {okulListesi,sinifListesi,SINAVLAR,SINIFLAR}=require('./fixtures/siralama-pdf.cjs');
const {homework,attendance}=require('./fixtures/ogrencirapor-pdf.cjs');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {ornekRapor}=require('./fixtures/yoklama-pdf.cjs');
const {englishResults}=require('./fixtures/english-pdf.cjs'),{dersProgrami}=require('./fixtures/ders-programi-pdf.cjs');
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error('Install '+ad)};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-ogrencirapor-'));fs.mkdirSync(out,{recursive:true});
const old=structuredClone(SINAVLAR.once.T);old.tarih='27.05.2024';
const files={'tyt-ayt.pdf':okulListesi(SINAVLAR.sonra.F),'eski.pdf':okulListesi(old),'9a.pdf':sinifListesi(SINIFLAR.dokuz2),'odev.pdf':homework(),'yoklama.pdf':attendance(),'etut.pdf':etutRaporu(GUNLER)};
const englishFiles={'english-starter.pdf':englishResults(),'english-placement.pdf':englishResults({name:'FLY HIGHER PLACEMENT TEST',date:'02.09.2026',students:[{no:'2001',name:'SENTETİK ECE',cls:'9/A',code:'102',net:54.67,score:.55,correct:56,wrong:4},{no:'2002',name:'SENTETİK FIRAT',cls:'9/A',code:'102',net:60,score:.60,correct:60,wrong:0}]}),'english-a2.pdf':englishResults({name:'Fly Higher A2 Unit Starter Test',students:[{no:'3001',name:'SENTETİK ON',cls:'10/B',code:'105',net:18,score:90,correct:18,wrong:2}]})};
const programs=[['9/A','102'],['10/B','105'],['12/A','301']].map(([sinif,kod])=>dersProgrami({sinif,kod,hucreler:[[0,0,'MATEMATİK','SENTETİK ÖĞRETMEN BİR'],[1,0,'İNGİLİZCE','SENTETİK DİL HOCASI'],[2,0,'BEDEN EĞİTİMİ','SENTETİK SPOR HOCASI']]}));
const upload=name=>({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950},acceptDownloads:true}),page=await context.newPage(),errors=[];let blockLibrary=true;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+03:00'));
  await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://localhost/'))return r.fulfill({contentType:'text/html',body:html});if(CDN[u]&&!blockLibrary)return r.fulfill({path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});return r.abort()});
  await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof OGRENCI_RAPOR==='object');
  await page.evaluate(f=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogrencirapor';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};denemePdfSayfalari=async file=>{if(!f[file.name])throw new Error('Geçersiz PDF');return structuredClone(f[file.name])};ciz()},{...files,...englishFiles});
  assert(await page.locator('#orOne').isDisabled());
  // Denemeler, etütler and yoklama come from Sıralamalar, Etütler and Yoklama; nothing is uploaded here for them.
  await page.evaluate(([f,yk,programs])=>{D.siralama=SIRALAMA.oku().veri;for(const k of ['tyt-ayt.pdf','eski.pdf','9a.pdf'])SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(f[k].pages,f[k].boylar));
   D.siralama.sinavlar[0].tur='tarama';D.etut=ETUT.birlestir(null,ETUT.pdfCoz(f['etut.pdf'].pages));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(yk.pages));D.etutPlani=ETUTPLANI.oku().plan;D.etutPlani.programlar={};for(const pages of programs){const p=ETUTPLANI.programCoz(pages);D.etutPlani.programlar[p.sinif]={...p,ts:1}}ciz()},[files,ornekRapor(),programs]);
  const kaynaklar=await page.locator('.or-kaynaklar').innerText();for(const t of ['3 sınav','Etütler','7 öğrenci · 14.09.2026 – 16.10.2026','Öğrenci Ev Ödev Durum Raporu eklenmedi'])assert(kaynaklar.includes(t),t);
  assert.equal(await page.locator('.or-kaynaklar [data-sekme="yoklama"]').count(),1);
  const before=await page.evaluate(()=>JSON.stringify(D)),siteCount=await page.locator('#orStudent option').count();assert(siteCount>2,'site data alone gives reports');
  // Here only the homework report is added; the others, every grade's deneme list too, are sent to their pages.
  await page.locator('#orFiles').setInputFiles([...Object.keys(files),'bozuk.pdf'].map(upload));await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent.includes('1 dosya eklendi.'));
  const durum=await page.locator('#orStatus').innerText();
  for(const t of ['bozuk.pdf: Geçersiz PDF','tyt-ayt.pdf: deneme sonuç listesi; Sıralamalar sayfasından ekleyin.','9a.pdf: deneme sonuç listesi; Sıralamalar sayfasından ekleyin.','etut.pdf: etüt raporu; Etütler sayfasından ekleyin.','yoklama.pdf: yoklama raporu; Yoklama sayfasından ekleyin.'])assert(durum.includes(t),t);
  assert.equal(await page.evaluate(()=>JSON.stringify(D)),before);assert((await page.locator('.or-kaynaklar').innerText()).includes('odev.pdf'));
  const initial=await page.evaluate(()=>JSON.stringify(OGRENCI_RAPOR.model()));const allCount=await page.locator('#orStudent option').count();assert.equal(allCount,siteCount,'the homework report adds to students already there');
  await page.locator('#orFiles').setInputFiles(['odev.pdf','9a.pdf'].map(upload));await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent.startsWith('1 dosya eklendi. 9a.pdf: deneme sonuç listesi'));assert.equal(await page.evaluate(()=>JSON.stringify(OGRENCI_RAPOR.model())),initial);
  await page.locator('#orClass').selectOption('12/A');await page.locator('#orStudent').selectOption({label:'SENTETİK ADA · 12/A'});
  const preview=await page.locator('.or-preview').innerText();for(const expected of ['27.05.2024','AYT','24.10.2026','Ödev tarihi: belirtilmemiş','%94','Etüt'])assert(preview.includes(expected),expected);
  assert(!/Şube sırası|Ortalama|Tekrar et/.test(preview));
  assert(preview.includes('Tarama')&&preview.includes('Genel'));assert(!preview.includes('Kimya TYT'));assert(preview.includes('Matematik TYT')&&preview.includes('Öğretmenler'));
  const teacherCheck=await page.evaluate(()=>{const s=OGRENCI_RAPOR.model().students.find(s=>s.name==='SENTETİK ADA'),totals=new Map();for(const e of s.sessions)totals.set(e.teacher,(totals.get(e.teacher)||0)+1);const groups=[...document.querySelectorAll('.or-preview g[aria-label$=" etüt"]')];return {expected:[...totals].map(([name,n])=>name+' · '+n+' etüt').sort(),actual:groups.map(g=>g.getAttribute('aria-label')).sort(),fit:groups.every(g=>{const b=g.getBBox();return b.x>=697&&b.x+b.width<=1147&&b.y>=730&&b.y+b.height<=816})}});
  assert.deepEqual(teacherCheck.actual,teacherCheck.expected);assert(teacherCheck.fit,'teacher totals fit inside the etut card');
  const etutLayout=await page.evaluate(()=>{const box=document.querySelector('.or-preview'),rows=[...box.querySelectorAll('g[aria-label$=" etüt"]')],counts=rows.map(g=>Number(g.querySelectorAll('text')[1].textContent));return {sorted:counts.every((n,i)=>!i||n<=counts[i-1]),highestAbove:rows.slice(1).every(g=>g.getBBox().y>rows[0].getBBox().y),paired:rows.every(g=>{const [name,count]=g.querySelectorAll('text'),pill=g.querySelectorAll('rect')[1],b=count.getBBox(),r=pill.getBBox();return name.getBBox().x+name.getBBox().width<r.x&&Math.abs(b.x+b.width/2-r.x-r.width/2)<1&&Math.abs(b.y+b.height/2-r.y-r.height/2)<1}),cells:[...box.querySelectorAll('g[aria-label^="Etüt Hücresi"]')].filter(g=>g.querySelector('text')).every(g=>{const b=g.querySelector('text').getBBox(),r=g.querySelector('rect').getBBox();return Math.abs(b.x+b.width/2-r.x-r.width/2)<1&&Math.abs(b.y+b.height/2-r.y-r.height/2)<1})}});
  assert(Object.values(etutLayout).every(Boolean),JSON.stringify(etutLayout));
  const denseFit=await page.evaluate(()=>{const s=structuredClone(OGRENCI_RAPOR.model().students.find(s=>s.name==='SENTETİK ADA')),courses=['Türkçe','Matematik','Geometri','Fizik','Kimya','Biyoloji','Coğrafya'];
   s.teachers=Array.from({length:12},(_,i)=>({teacher:i===11?'SENTETİK UZUN ADLI ÖĞRETMEN ONİKİNCİ':'SENTETİK ÖĞRETMEN '+(i+1),courses:[i%2?'MATEMATİK AYT':'TÜRK DİLİ VE EDEBİYATI']}));s.hasTimetable=true;
   for(const e of s.exams.filter(e=>e.session==='AYT'))Object.assign(e.nets,{tarih2:-2.75,cografya2:-2.75,felsefe:-3,din:-1.5,sf:1.25});
   s.sessions=[8,6,6,6,5,3,2,2,1,1].flatMap((count,i)=>Array.from({length:count},(_,j)=>({date:'2026-10-'+['01','06','13','19'][j%4],course:courses[i%courses.length],teacher:'SENTETİK UZUNADLI ÖĞRETMEN '+(i+1)})));s.weeks=OGRENCI_RAPOR.weekly(s.sessions,s.sessionStart,s.sessionEnd);
   const box=document.createElement('div');box.id='or-density-check';box.innerHTML=OGRENCI_RAPOR.svgReport(s,'2026-10-25');document.body.append(box);const groups=[...box.querySelectorAll('g[aria-label$=" etüt"]')],lessons=[...box.querySelectorAll('g[aria-label^="AYT ders ·"]')],classTeachers=[...box.querySelectorAll('g[aria-label^="Ders öğretmeni ·"]')];return {teachers:groups.length===10&&groups.every(g=>{const b=g.getBBox(),texts=g.querySelectorAll('text'),name=texts[0].getBBox(),count=texts[1].getBBox();return b.x>=697&&b.x+b.width<=1147&&b.y>=730&&b.y+b.height<=816&&name.x+name.width<count.x}),lessons:lessons.length===13&&lessons.every(g=>{const t=g.querySelectorAll(':scope > text'),label=t[0].getBBox(),value=t[1].getBBox();return label.x+label.width<value.x}),classTeachers:classTeachers.length===12&&classTeachers.every(g=>{const t=[...g.querySelectorAll('text')],a=t[0].getBBox(),b=t[1].getBBox();return t.every(t=>t.getAttribute('font-size')==='11'&&!t.hasAttribute('textLength'))&&a.x+a.width<b.x&&a.x>=44&&b.x+b.width<=648&&a.y>=734&&Math.max(a.y+a.height,b.y+b.height)<=816})}});
  assert(denseFit.teachers,'ten teacher names and counts fit without overlapping');assert(denseFit.classTeachers,'twelve class teachers use a consistent font and fit within their box');assert(denseFit.lessons,'all AYT lessons, including extra philosophy and negative results, have readable labels');await page.locator('#or-density-check svg').screenshot({path:path.join(out,'ogrenci-teacher-density-'+width+'.png')});await page.locator('#or-density-check').evaluate(e=>e.remove());
  await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-grouped-'+width+'.png')});
  assert(preview.includes('AYT EA Neti'));for(const label of ['SAY neti · 20,5','EA neti · 47,5','SÖZ neti · 27'])assert.equal(await page.locator('.or-preview g[aria-label="'+label+'"]').count(),1);
  assert((await page.locator('.or-preview g[aria-label="EA neti · 47,5"]').boundingBox()).y<(await page.locator('.or-preview g[aria-label="SAY neti · 20,5"]').boundingBox()).y,'EA is above SAY in an EA class');
  const groupLayout=await page.evaluate(()=>{const labels=['AYT Fen','AYT Matematik','AYT Türk Dili ve Edebiyatı · Sosyal 1','AYT Sosyal 2'];const boxes=labels.map(label=>document.querySelector('.or-preview g[aria-label="'+label+'"]').getBBox());return boxes.every((b,i)=>b.x>=600&&b.x+b.width<=1164&&b.y>=272&&b.y+b.height<=462&&(!i||b.y>=boxes[i-1].y+boxes[i-1].height))});assert(groupLayout,'AYT groups are stacked and fit above attendance/homework');
  // A failed dependency fetch must unlock the buttons and allow a successful retry.
  await page.locator('#orOne').click();await page.waitForFunction(()=>!document.querySelector('#orOne').disabled);assert(!(await page.locator('#orStatus').innerText()).includes('PDF hazır.'));blockLibrary=false;
  async function download(id,count,label){const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.locator(id).click()]);const file=path.join(out,'ogrenci-'+label+'-'+width+'.pdf');await d.saveAs(file);const pdf=await PDFDocument.load(fs.readFileSync(file));assert.equal(pdf.getPageCount(),count);for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-841.89)<.01);assert(Math.abs(p.getHeight()-595.28)<.01)}await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='PDF hazır.');return file}
  await download('#orOne',1,'tek');
  await page.locator('#orClass').selectOption('12/B');await page.locator('#orStudent').selectOption({label:'SENTETİK CEMRE UZUNADLI İKİNCİ · 12/B'});assert((await page.locator('.or-preview').innerText()).includes('AYT SAY Neti'));
  assert.equal(await page.locator('.or-preview g[aria-label="SAY neti · 51,75"]').count(),1);await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-say-'+width+'.png')});await download('#orOne',1,'say');
  assert((await page.locator('.or-preview g[aria-label="SAY neti · 51,75"]').boundingBox()).y<(await page.locator('.or-preview g[aria-label="EA neti · 29,75"]').boundingBox()).y,'SAY stays above EA in a SAY class');
  await page.locator('#orClass').selectOption('12/A');await page.locator('#orStudent').selectOption({label:'SENTETİK ADA · 12/A'});await download('#orAll',await page.locator('#orStudent option').count(),'sinif');
  await page.locator('#orClass').selectOption('');await download('#orAll',allCount,'hepsi');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.screenshot({path:path.join(out,'ogrenci-'+width+'.png'),fullPage:true});await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-rapor-'+width+'.png')});
  await page.locator('#orEnglishFiles').setInputFiles(Object.keys(englishFiles).map(upload));await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent==='3 dosya eklendi.');assert.equal(await page.evaluate(()=>JSON.stringify(D)),before,'English imports do not change notebook data');
  // A 9. sınıf list in Sıralamalar: its two 9/A students with their 8 lessons, and a 9/A student from Yoklama.
  await page.locator('#orClass').selectOption('9/A');assert.equal(await page.locator('#orStudent option').count(),3,'the 9. sınıf list and a student from Yoklama');
  await page.locator('#orStudent').selectOption({label:'SENTETİK ECE · 9/A'});const ece=await page.locator('.or-preview').innerText();
  assert(ece.includes('Sentetik 9 Deneme 2')&&ece.includes('Din kültürü')&&!ece.includes('Geometri')&&!ece.includes('Felsefe'));
  assert(!ece.includes('AYT'));assert(ece.includes('Öğrencinin Etüt Talebi Olmamıştır'));
  const englishGraph=await page.locator('.or-preview g[aria-label="İngilizce puan grafiği"]').textContent();assert(ece.includes('İngilizce Sınav Puanları')&&englishGraph.includes('91,12 puan')&&englishGraph.includes('85 puan'),englishGraph);assert(ece.includes('SENTETİK DİL HOCASI')&&ece.includes('Beden eğitimi'));
  assert.equal(await page.locator('.or-preview rect[x="26"][y="96"]').getAttribute('width'),'558');
  await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-grade9-'+width+'.png')});await download('#orOne',1,'grade9');
  const fullId=await page.evaluate(()=>OGRENCI_RAPOR.model().students.find(s=>s.no==='2002').id);await page.locator('#orStudent').selectOption(fullId);const fullGraph=await page.locator('.or-preview g[aria-label="İngilizce puan grafiği"]').textContent();assert(fullGraph.includes('100 puan')&&!fullGraph.includes('60 puan'),'a perfect placement result displays 100/100');await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-placement-full-'+width+'.png')});await download('#orOne',1,'placement-full');
  await page.locator('#orClass').selectOption('10/B');await page.locator('#orStudent').selectOption({label:'SENTETİK ON · 10/B'});const ten=await page.locator('.or-preview').innerText();assert((await page.locator('.or-preview g[aria-label="İngilizce puan grafiği"]').textContent()).includes('90 puan')&&!ten.includes('AYT')&&ten.includes('SENTETİK SPOR HOCASI'));await page.locator('.or-preview svg').screenshot({path:path.join(out,'ogrenci-grade10-'+width+'.png')});await download('#orOne',1,'grade10');
  await page.locator('#orClear').click();await page.locator('#orClass').selectOption('9/A');assert.equal(await page.locator('#orStudent option').count(),3,'site data stays');assert.equal(await page.evaluate(()=>JSON.stringify(D)),before);
  await page.locator('#orFiles').setInputFiles([upload('9a.pdf')]);await page.waitForFunction(()=>document.querySelector('#orStatus')?.textContent.includes('9a.pdf: deneme sonuç listesi'));assert.equal(await page.locator('#orStudent option').count(),3);
  await page.evaluate(()=>{D=varsayilan();D.rol='rehber';ciz()});assert.equal(await page.locator('#orStudent option').count(),0,'notebook switch clears imports');
  await page.evaluate(()=>{D.rol='ogrenci';ciz()});assert.equal(await page.locator('#orFiles').count(),0,'student cannot access imports');assert.deepEqual(errors,[]);
  console.log('PASS student PDF browser',width);await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
