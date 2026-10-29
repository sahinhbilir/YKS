// Deneme panosu on desktop and mobile: the teacher's Denemeler opens the board, the four charts
// and their hover/keyboard readouts, Oturum / Karşılaştır / Öğrenciler, subject focus, student
// selection, search and sorting, and the per-student page and back. Synthetic lists only
// (test/fixtures/siralama-pdf.cjs), read by the site's own parser.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
// Reports use pdf-lib and pdf.js: the pinned CDN files come from local npm copies on NODE_PATH, as in siralama-browser.
const paket=ad=>{for(const d of [...(process.env.NODE_PATH||'').split(path.delimiter),path.join(__dirname,'..','node_modules')].filter(Boolean)){const p=path.join(d,ad);if(fs.existsSync(path.join(p,'package.json')))return p}throw new Error(ad+' bulunamadı (NODE_PATH)')};
const CDN={
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs':[paket('pdfjs-dist'),'legacy/build/pdf.worker.min.mjs','text/javascript'],
 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js':[paket('pdf-lib'),'dist/pdf-lib.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js':[paket('@pdf-lib/fontkit'),'dist/fontkit.umd.min.js','text/javascript'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Regular.woff','font/woff'],
 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff':[paket('roboto-fontface'),'fonts/roboto/Roboto-Medium.woff','font/woff']};
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-denemepano-'));fs.mkdirSync(out,{recursive:true});
const listeler=['once','sonra'].flatMap(e=>['T','F'].map(t=>okulListesi(SINAVLAR[e][t])));
const taramaListeleri=['T','F'].map(t=>okulListesi({...SINAVLAR.once[t],ad:'Sentetik Tarama 1',tarih:'25.09.2026'}));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema,acceptDownloads:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('http://localhost/'))return r.fulfill({status:200,contentType:'text/html',body:html});
    if(CDN[u])return r.fulfill({status:200,path:path.join(CDN[u][0],CDN[u][1]),contentType:CDN[u][2],headers:{'access-control-allow-origin':'*'}});
    return r.abort()});
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(async l=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-19';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    await siralamaKaydet(l.map(x=>siralamaPdfCoz(x.pages,x.boylar)));ciz();
   },listeler);
   // The teacher's Denemeler opens the board.
   await page.evaluate(()=>{EK.sekme='denemeler';ciz()});
   await page.waitForFunction(()=>document.querySelectorAll('#dpKok .et-grafik svg').length===5);
   // The default comparison is the whole period: the first exam against the latest, named with its dates.
   assert.match(await page.locator('#dpKok .et-cumle').innerText(),/^12\. sınıflar · Tüm dönem \(18 Eyl → 2 Eki\): TYT ortalaması [\d,]+ net, başlangıçtaki denemeye göre [+−][\d,]+ /);
   assert.equal(await page.locator('[data-dp-aralik="tum"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-dp-aralik="1"]').click();await page.waitForFunction(()=>/Son deneme \(/.test(document.querySelector('#dpKok .et-cumle').textContent));
   assert.match(await page.locator('#dpKok .et-cumle').innerText(),/12\. sınıflar · Son deneme \(Sentetik Deneme 2, .+\): TYT ortalaması [\d,]+ net, önceki denemeye göre [+−][\d,]+ \(iki dönemde de giren \d+ öğrencinin kendi değişimi [+−]?[\d,]+\)\./);
   assert.equal(await page.locator('#dpKok .et-ders').count(),13,'ten lessons and three tests');
   assert.equal(await page.locator('#dpZorluk .dp-zor-satir').count(),10,'Kolaydan zora ranks the lessons');
   // Hover and keys on the main chart.
   const genel=page.locator('[data-dp-grafik="genel"]');await genel.scrollIntoViewIfNeeded();const kutu=await genel.boundingBox();
   await page.mouse.move(kutu.x+kutu.width*0.7,kutu.y+120);
   await page.waitForFunction(()=>!document.querySelector('[data-dp-grafik="genel"] .et-ipucu').hidden);
   assert.match(await genel.locator('.et-ipucu').innerText(),/Sentetik Deneme 2[\s\S]*Ortalama[\s\S]*Ortadaki %50[\s\S]*Katılım/);
   await genel.focus();await page.keyboard.press('Home');assert.match(await genel.locator('.et-ipucu').innerText(),/Sentetik Deneme 1/);
   await page.keyboard.press('Escape');assert.equal(await genel.locator('.et-ipucu').isHidden(),true);
   // Oturum, Öğrenciler and subject focus redraw in place.
   await page.locator('[data-dp-olcu="AYT:Toplam"]').click();
   await page.waitForFunction(()=>/AYT toplam ortalaması/.test(document.querySelector('#dpKok .et-cumle').textContent));
   assert.equal(await page.locator('#dpKok .et-ders').count(),16,'twelve AYT lessons and four tests');
   await page.locator('[data-dp-olcu="TYT"]').click();
   await page.locator('#dpKapsam').selectOption('12/A');
   await page.waitForFunction(()=>/^12\/A · /.test(document.querySelector('#dpKok .et-cumle').textContent));
   assert.equal(await page.locator('#dpTablo tbody tr').count(),await page.evaluate(()=>[...document.querySelectorAll('#dpTablo tbody tr')].filter(tr=>tr.textContent.includes('12/A')).length));
   await page.locator('#dpKapsam').selectOption('g12');
   await page.locator('.et-ders[data-dp-ders="MAT"]').click();
   assert.match(await page.locator('[data-dp-grafik="ders"]').locator('..').locator('h2').innerText(),/Matematik · ortalama net/);
   await page.locator('.et-ders[data-dp-ders="MAT"]').click();
   assert.match(await page.locator('[data-dp-grafik="ders"]').locator('..').locator('h2').innerText(),/Derslere göre başarı/);
   // Students: table selection, search and sort.
   // A row selects the student (a click on its numbers); the name itself opens Öğrenci kartı (test/analiz-browser.cjs).
   assert.equal(await page.locator('#dpTablo tbody tr[data-dp-ogr="1002"] .et-ad').getAttribute('data-ogrenci-karti'),'1002');
   await page.locator('#dpTablo tbody tr[data-dp-ogr="1002"] td.sayi').first().click();
   assert.match(await page.locator('#dpKisi').innerText(),/Sentetik Bora[\s\S]*No 1002/);
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="kisi"] svg'));
   await page.locator('#dpTablo tbody tr[data-dp-ogr="1001"] td.sayi').first().click();
   assert.equal(await page.locator('#dpKisi [data-ogr-gor="0"]').count(),1,'a notebook student opens in student view');
   await page.locator('#dpAra').fill('bora');assert.equal(await page.locator('#dpTablo tbody tr[data-dp-ogr]:not([hidden])').count(),1);
   await page.locator('#dpAra').fill('');
   await page.locator('[data-dp-sira="ad"]').click();
   assert.match(await page.locator('#dpTablo tbody tr[data-dp-ogr]').first().innerText(),/Sentetik Ada/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal scroll at '+width);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(out,'denemepano-'+width+'-'+tema+'.png'),fullPage:true});
   // The per-student page and back.
   await page.locator('#dpKlasik').click();await page.waitForSelector('#dpPanoya');
   assert.equal(await page.locator('#dpKok').count(),0);
   await page.locator('#dpPanoya').click();await page.waitForSelector('#dpKok');
   // Every student as a line: the one under the pointer takes the stage, the others lose their colour.
   const seriNoktasi=async(grafik,k)=>page.evaluate(([g,k])=>{const p=document.querySelector('[data-dp-grafik="'+g+'"] path[data-seri="'+k+'"]');
     const q=p.getPointAtLength(p.getTotalLength()*0.5),s=q.matrixTransform(p.getScreenCTM());return {x:s.x,y:s.y}},[grafik,k]);
   const sira=no=>page.evaluate(no=>{const {t}=DPANO.veriAl();return DPANO.durumAl(t).mo.ogrenciler.findIndex(o=>o.no===no)},no);
   const ogrCizgi=page.locator('[data-dp-grafik="ogrenci"]');await ogrCizgi.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelectorAll('[data-dp-grafik="ogrenci"] [data-seri]').length===5);
   const cemre=await sira('1003');let n=await seriNoktasi('ogrenci',cemre);await page.mouse.move(n.x,n.y);
   await page.waitForFunction(k=>document.querySelector('[data-dp-grafik="ogrenci"] path[data-seri="'+k+'"]').classList.contains('aktif'),cemre);
   await page.waitForFunction(k=>{const p=[...document.querySelectorAll('[data-dp-grafik="ogrenci"] path[data-seri]')].find(p=>p.dataset.seri!==String(k));return Number(getComputedStyle(p).opacity)<0.5},cemre);
   const soluk=await page.evaluate(k=>{const svg=document.querySelector('[data-dp-grafik="ogrenci"] svg'),diger=[...svg.querySelectorAll('path[data-seri]')].find(p=>p.dataset.seri!==String(k));
     return {odakli:svg.classList.contains('odakli'),opaklik:Number(getComputedStyle(diger).opacity),renk:getComputedStyle(diger).stroke,ozgun:diger.style.stroke}},cemre);
   assert(soluk.odakli&&soluk.opaklik<0.5,'the other lines fade');
   assert.match(await ogrCizgi.locator('.et-ipucu').innerText(),/Sentetik Cemre Uzunadlı İkinci · 12\/B[\s\S]*Sıra/);
   await page.mouse.move(1,1);await page.waitForFunction(()=>!document.querySelector('[data-dp-grafik="ogrenci"] svg').classList.contains('odakli'));
   // A click on a line opens that student's card; ↓ and Enter do the same from the keyboard.
   const bora=await sira('1002');n=await seriNoktasi('ogrenci',bora);await page.mouse.click(n.x,n.y);
   await page.waitForFunction(()=>/Sentetik Bora/.test(document.querySelector('#dpKisi h3').textContent));
   // Opening a card redraws the page; its charts are drawn a frame later (a key pressed before that lands on the
   // old chart, whose highlight the redraw wipes), so wait for the frame first.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.locator('[data-dp-grafik="ogrenci"]').focus();await page.keyboard.press('ArrowDown');
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="ogrenci"] svg')?.classList.contains('odakli'));
   const ust=await page.evaluate(()=>{const {t}=DPANO.veriAl(),st=DPANO.durumAl(t),i=st.mo.sinavlar.length-1;return st.mo.ogrenciler.filter(o=>o.seri[i]!==null).sort((a,b)=>b.seri[i]-a.seri[i])[0].ad});
   await page.keyboard.press('Enter');await page.waitForFunction(ad=>document.querySelector('#dpKisi h3').textContent.toLocaleLowerCase('tr-TR')===ad.toLocaleLowerCase('tr-TR'),ust);
   // The same on Derslere göre başarı (after the card's redraw frame, as above).
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const ders=page.locator('[data-dp-grafik="ders"]');await ders.scrollIntoViewIfNeeded();n=await seriNoktasi('ders',0);await page.mouse.move(n.x,n.y);
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="ders"] svg')?.classList.contains('odakli'));
   assert.equal(await ders.locator('.et-ipucu .dp-vurgu').count(),1,'its subject is marked in the readout');
   await page.mouse.move(1,1);
   // Genel / tarama, Seç and the Sıralamalar measures.
   await page.evaluate(async l=>{await siralamaKaydet(l.map(x=>siralamaPdfCoz(x.pages,x.boylar)));ciz()},taramaListeleri);
   await page.locator('[data-dp-tur="tarama"]').click();
   await page.waitForFunction(()=>/^Tarama denemeleri · /.test(document.querySelector('#dpKok .et-cumle').textContent));
   await page.locator('[data-dp-tur=""]').click();
   await page.locator('[data-dp-aralik="sec"]').click();await page.locator('#dpOnceki').waitFor();
   await page.locator('#dpOnceki').selectOption({label:(await page.locator('#dpOnceki option',{hasText:'Sentetik Deneme 1'}).innerText())});
   await page.waitForFunction(()=>/Sentetik Deneme 1 → Sentetik Deneme 2/.test(document.querySelector('#dpKok .et-cumle').textContent));
   // The pair is two lines on the main chart: dragging Önceki onto the tarama in between compares it with Deneme 2.
   const pg=page.locator('[data-dp-grafik="genel"]');await pg.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="genel"] [data-tutamak="once"]'));
   const pt=await page.locator('[data-dp-grafik="genel"] [data-tutamak="once"] .et-tutamak-tut').boundingBox(),pk=await pg.boundingBox();
   await page.mouse.move(pt.x+pt.width/2,pt.y+pt.height/2);await page.mouse.down();await page.mouse.move(pk.x+pk.width*0.45,pt.y+40,{steps:6});
   assert.match(await pg.locator('.et-surukle').innerText(),/→/);
   await page.mouse.up();
   await page.waitForFunction(()=>/Sentetik Tarama 1 → Sentetik Deneme 2/.test(document.querySelector('#dpKok .et-cumle').textContent));
   assert.match(await page.locator('#dpOnceki option:checked').innerText(),/Sentetik Tarama 1/);
   await page.locator('#dpOnceki').selectOption({label:(await page.locator('#dpOnceki option',{hasText:'Sentetik Deneme 1'}).innerText())});
   await page.waitForFunction(()=>/Sentetik Deneme 1 → Sentetik Deneme 2/.test(document.querySelector('#dpKok .et-cumle').textContent));
   await page.locator('#dpSinavlar select[aria-label="Sentetik Tarama 1 türü"]').selectOption('genel');
   await page.waitForFunction(()=>D.siralama.sinavlar.find(s=>s.ad==='Sentetik Tarama 1').tur==='genel');
   await page.locator('[data-dp-olcut="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('#dpTablo th[aria-sort="ascending"] [data-dp-sira="sira"]'));
   assert.equal(await page.locator('#dpTablo tr.dp-ort').count(),4,'grade and class averages');
   await page.locator('#dpOgrNet').selectOption('MAT');
   await page.waitForFunction(()=>/Öğrencilere göre · TYT Matematik/.test(document.querySelector('#dpOgrCizgi h2').textContent));
   // Tüm öğrenciler carries Sıralamalar's three measures; Sırala sits in its header.
   assert.deepEqual(await page.locator('#dpTablo thead [data-dp-sira]').evaluateAll(l=>l.map(b=>b.textContent)),['Öğrenci','Şube','Şimdiki','Önceki','Net artışı','% artış','Kapanan fark (log)','Sıra','Durum']);
   // On a phone the measure it is not ranked by folds away; the ranked one (Net artışı) stays.
   if(width<700)assert.deepEqual(await page.locator('#dpTablo thead th:visible').evaluateAll(l=>l.map(t=>t.textContent)),['Öğrenci','Şimdiki','Net artışı','Sıra','Durum']);
   assert.equal(await page.locator('#dpTablo .et-kart-bas [data-dp-olcut="artis"][aria-pressed="true"]').count(),1);
   // Raporlar at the bottom: Sıralamalar's reports for the board's pair, downloaded and previewed here.
   const rap=page.locator('#dpRaporlar');await rap.scrollIntoViewIfNeeded();
   assert.equal(await rap.locator('[data-sr-indir]:not([disabled])').count(),4);
   const [indirilen]=await Promise.all([page.waitForEvent('download'),rap.locator('[data-sr-indir="tyt-toplu"]').click()]);
   assert.equal(indirilen.suggestedFilename(),'Sentetik Deneme 2_Toplu.pdf');
   await rap.locator('[data-sr-onizle="tyt-sinif"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#dpRaporlar #srSayfalar canvas').length>0);
   assert.match(await page.locator('#srOnizlemeAlt').innerText(),/Sentetik Deneme 1 → Sentetik Deneme 2/);
   // The exam table corrects a date with Sıralamalar's field (and its confirmation).
   const tarih=page.locator('#dpSinavlar input[data-sr-tarih]').nth(1);await tarih.scrollIntoViewIfNeeded();
   await tarih.fill('2026-09-26');
   await page.waitForFunction(()=>D.siralama.sinavlar.find(s=>s.ad==='Sentetik Tarama 1').tarih==='26.09.2026');
   await page.waitForFunction(()=>/Sentetik Tarama 1 tarihi 26\.09\.2026 oldu/.test(document.getElementById('srDurum')?.textContent||''));
   // Sil removes an exam's lists (students' results stay); PDF ekle brings a list back without importing results.
   await page.locator('#dpSinavlar [data-sr-sil]').nth(1).click();
   await page.waitForFunction(()=>!D.siralama.sinavlar.some(s=>s.ad==='Sentetik Tarama 1'));
   await page.evaluate(l=>{denemePdfSayfalari=async f=>structuredClone(l[f.name])},{'tarama-tyt.pdf':taramaListeleri[0],'tarama-ayt.pdf':taramaListeleri[1]});
   await page.locator('#srPdf').setInputFiles(['tarama-tyt.pdf','tarama-ayt.pdf'].map(name=>({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')})));
   await page.waitForFunction(()=>D.siralama.sinavlar.some(s=>s.ad==='Sentetik Tarama 1')&&/Kaydedildi/.test(document.getElementById('srDurum')?.textContent||''));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'new controls fit at '+width);
   await page.locator('#dpOgrCizgi').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'denemepano-ek-'+width+'-'+tema+'.png'),fullPage:true});
   // Değişimin kaynağı and Isı haritası: the same students' change split into lessons and şubeler.
   const kaynak=page.locator('#dpKaynak'),isi=page.locator('#dpIsi');await kaynak.scrollIntoViewIfNeeded();
   assert.match(await kaynak.locator('.dp-kaynak-cumle').innerText(),/^12\. sınıflar [▲▼][\d,]+ net \(aynı \d+ öğrenci\): /);
   assert.match(await kaynak.locator('.dp-toplam-yazi').first().innerText(),/^Toplam [▲▼][\d,]+ net = /);
   assert.equal(await kaynak.locator('h3').count(),2,'by lesson and by şube');
   assert.equal(await kaynak.locator('.dp-kaynak-tablo').first().locator('tbody tr').count(),10,'ten TYT lessons');
   assert(await kaynak.locator('.dp-cubuk').first().evaluate(e=>e.getBoundingClientRect().width>0),'bars are drawn');
   const sayiHiza=async sel=>page.locator(sel).evaluateAll(l=>l.map(e=>getComputedStyle(e).textAlign));
   for(const sel of ['#dpKaynak td.sayi','#dpKaynak th.sayi','#dpIsi td.sayi','#dpIsi th.sayi']){const h=await sayiHiza(sel);assert(h.length>0&&h.every(x=>x==='right'),sel+' right-aligned')}
   assert.equal(await page.locator('#dpKaynak td.sayi:not(.dp-isi-hucre)').evaluateAll(l=>l.every(e=>/^[+−\d]|^—$/.test(e.textContent.trim()))),true,'numbers carry a sign');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'Değişimin kaynağı fits at '+width);
   await kaynak.screenshot({path:path.join(out,'denemepano-kaynak-'+width+'.png')});
   await isi.scrollIntoViewIfNeeded();
   assert.match(await isi.locator('.et-lejant').innerText(),/renk: değişim \(net\)/);
   assert.equal(await isi.locator('thead th').count(),12,'Şube, ten lessons and Toplam');assert.equal(await isi.locator('thead th').first().innerText(),'Şube');
   assert.equal(await isi.locator('thead th').last().innerText(),'Toplam');
   assert.equal(await isi.locator('tbody tr').count(),4,'the grade’s mean and its three şubeler');
   const boyali=await isi.locator('td.dp-isi-hucre').evaluateAll(l=>l.filter(e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'&&/color-mix/.test(e.getAttribute('style')||'')).length);
   assert(boyali>=10,'cells are coloured by change ('+boyali+')');
   const renkler=await isi.locator('td.dp-isi-hucre').evaluateAll(l=>l.map(e=>[e.textContent.trim(),getComputedStyle(e).backgroundColor]));
   assert(new Set(renkler.map(x=>x[1])).size>3,'a scale, not one colour');
   // The first column stays while the table scrolls inside its own box; the page itself does not move sideways.
   const isiKutu=isi.locator('.dp-isi-kutu'),tasma=await isiKutu.evaluate(e=>e.scrollWidth>e.clientWidth);
   if(width<700)assert(tasma,'the table scrolls inside its box on a phone');
   assert.equal(await isi.locator('tbody th.dp-isi-ad').first().evaluate(e=>getComputedStyle(e).position),'sticky');
   if(tasma){const once=await isi.locator('tbody th.dp-isi-ad').first().evaluate(e=>e.getBoundingClientRect().left);
     await isiKutu.evaluate(e=>{e.scrollLeft=e.scrollWidth});const sonra=await isi.locator('tbody th.dp-isi-ad').first().evaluate(e=>e.getBoundingClientRect().left);
     assert(Math.abs(once-sonra)<2,'the first column is sticky');await isiKutu.evaluate(e=>{e.scrollLeft=0})}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'Isı haritası fits at '+width);
   await isi.screenshot({path:path.join(out,'denemepano-isi-'+width+'.png')});
   // One şube: its students are the rows and their names open Öğrenci kartı.
   await page.locator('#dpKapsam').selectOption('12/A');await page.waitForFunction(()=>document.querySelectorAll('#dpIsi tbody tr').length===3);
   assert.equal(await page.locator('#dpKaynak h3').count(),1,'no şube split inside one şube');
   assert.equal(await page.locator('#dpIsi tbody th .et-ad[data-ogrenci-karti]').count(),2);
   await page.locator('#dpKapsam').selectOption('g12');await page.waitForFunction(()=>document.querySelectorAll('#dpIsi tbody tr').length===4);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Deneme panosu browser checks passed; screenshots in '+out);
 }finally{}
 // Tüm dönem / Son 1 ay / Son 3 ay: four exams (10 Haz, 5 Ağu, 18 Eyl, 2 Eki); the default compares the first with the latest.
 try{
   const eski=(ad,tarih)=>['T','F'].map(t=>okulListesi({...SINAVLAR.once[t],ad,tarih}));
   const dort=[...eski('Sentetik Tarama 0','10.06.2026'),...eski('Sentetik Tarama 00','05.08.2026'),...listeler];
   const context=await browser.newContext({viewport:{width:1280,height:950},colorScheme:'light'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(async l=>{D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-19';D.ogr=[];EK.ogr=0;EK.sekme='denemeler';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
     await siralamaKaydet(l.map(x=>siralamaPdfCoz(x.pages,x.boylar)));ciz()},dort);
   await page.waitForFunction(()=>document.querySelectorAll('#dpKok .et-grafik svg').length===5);
   const aralik=()=>page.locator('[data-dp-aralik]').evaluateAll(l=>l.map(b=>[b.dataset.dpAralik,b.textContent,b.getAttribute('aria-pressed'),b.disabled]));
   assert.deepEqual(await aralik(),[['tum','Tüm dönem','true',false],['1ay','Son 1 ay','false',false],['3ay','Son 3 ay','false',false],['1','Son deneme','false',false],['2','Son 2 deneme','false',false],['3','Son 3 deneme','false',true],['sec','Seç','false',false]]);
   const cumle=()=>page.locator('#dpKok .et-cumle').innerText();
   assert.match(await cumle(),/^12\. sınıflar · Tüm dönem \(10 Haz → 2 Eki\): TYT ortalaması [\d,]+ net, başlangıçtaki denemeye göre [+−][\d,]+ /);
   assert.match(await page.locator('#dpKaynak .et-kart-bas .mini').innerText(),/^Tüm dönem: 10 Haz → 2 Eki \(Sentetik Tarama 0 → Sentetik Deneme 2\) · TYT$/);
   assert.deepEqual(await page.locator('#dpGenel .et-bant-yazi').evaluateAll(l=>l.map(t=>t.textContent)),['Başta','Sonda']);
   await page.locator('[data-dp-aralik="1ay"]').click();await page.waitForFunction(()=>/Son 1 ay \(18 Eyl → 2 Eki\)/.test(document.querySelector('#dpKok .et-cumle').textContent));
   await page.locator('[data-dp-aralik="3ay"]').click();await page.waitForFunction(()=>/Son 3 ay \(5 Ağu → 2 Eki\)/.test(document.querySelector('#dpKok .et-cumle').textContent));
   assert.equal(await page.locator('[data-dp-aralik="3ay"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#dpTablo thead').innerText(),/Başta[\s\S]*Sonda|Sonda[\s\S]*Başta/);
   assert.match(await page.locator('#dpRaporlar .et-kart-bas .mini').first().innerText(),/^Sentetik Tarama 00 → Sentetik Deneme 2$/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'denemepano-aralik-1280.png')});
   // Seç still works next to them.
   await page.locator('[data-dp-aralik="sec"]').click();await page.locator('#dpOnceki').waitFor();
   assert.equal(await page.locator('#dpGenel [data-tutamak]').count(),2,'the Seç lines are there');
   assert.deepEqual(errors,[]);await context.close();
   console.log('PASS Deneme panosu ranges at 1280 px');
 }finally{await browser.close()}

})().catch(e=>{console.error(e);process.exit(1)});
