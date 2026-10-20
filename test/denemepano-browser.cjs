// Deneme panosu on desktop and mobile: the teacher's Denemeler opens the board, the four charts
// and their hover/keyboard readouts, Oturum / Karşılaştır / Öğrenciler, subject focus, student
// selection, search and sorting, and the per-student page and back. Synthetic lists only
// (test/fixtures/siralama-pdf.cjs), read by the site's own parser.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-denemepano-'));fs.mkdirSync(out,{recursive:true});
const listeler=['once','sonra'].flatMap(e=>['T','F'].map(t=>okulListesi(SINAVLAR[e][t])));
const taramaListeleri=['T','F'].map(t=>okulListesi({...SINAVLAR.once[t],ad:'Sentetik Tarama 1',tarih:'25.09.2026'}));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
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
   assert.match(await page.locator('#dpKok .et-cumle').innerText(),/12\. sınıflar · Son deneme \(Sentetik Deneme 2, .+\): TYT ortalaması [\d,]+ net, önceki denemeye göre [+−][\d,]+\./);
   assert.equal(await page.locator('#dpKok .et-ders').count(),10);
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
   assert.equal(await page.locator('#dpKok .et-ders').count(),12);
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
   await page.locator('#dpTablo tbody tr[data-dp-ogr="1002"] .et-ad').click();
   assert.match(await page.locator('#dpKisi').innerText(),/Sentetik Bora[\s\S]*No 1002/);
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="kisi"] svg'));
   await page.locator('#dpTablo tbody tr[data-dp-ogr="1001"] .et-ad').click();
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
   await page.locator('[data-dp-grafik="ogrenci"]').focus();await page.keyboard.press('ArrowDown');
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="ogrenci"] svg').classList.contains('odakli'));
   const ust=await page.evaluate(()=>{const {t}=DPANO.veriAl(),st=DPANO.durumAl(t),i=st.mo.sinavlar.length-1;return st.mo.ogrenciler.filter(o=>o.seri[i]!==null).sort((a,b)=>b.seri[i]-a.seri[i])[0].ad});
   await page.keyboard.press('Enter');await page.waitForFunction(ad=>document.querySelector('#dpKisi h3').textContent.toLocaleLowerCase('tr-TR')===ad.toLocaleLowerCase('tr-TR'),ust);
   // The same on Derslere göre başarı.
   const ders=page.locator('[data-dp-grafik="ders"]');await ders.scrollIntoViewIfNeeded();n=await seriNoktasi('ders',0);await page.mouse.move(n.x,n.y);
   await page.waitForFunction(()=>document.querySelector('[data-dp-grafik="ders"] svg').classList.contains('odakli'));
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
   await page.locator('#dpSinavlar select[aria-label="Sentetik Tarama 1 türü"]').selectOption('genel');
   await page.waitForFunction(()=>D.siralama.sinavlar.find(s=>s.ad==='Sentetik Tarama 1').tur==='genel');
   await page.locator('[data-dp-olcut="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('#dpTablo th[aria-sort="ascending"] [data-dp-sira="sira"]'));
   assert.equal(await page.locator('#dpTablo tr.dp-ort').count(),4,'grade and class averages');
   await page.locator('#dpOgrNet').selectOption('MAT');
   await page.waitForFunction(()=>/Öğrencilere göre · TYT Matematik/.test(document.querySelector('#dpOgrCizgi h2').textContent));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'new controls fit at '+width);
   await page.locator('#dpOgrCizgi').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'denemepano-ek-'+width+'-'+tema+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Deneme panosu browser checks passed; screenshots in '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
