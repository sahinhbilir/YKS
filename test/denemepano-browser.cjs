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
   await page.waitForFunction(()=>document.querySelectorAll('#dpKok .et-grafik svg').length===4);
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
   await page.locator('#dpAra').fill('bora');assert.equal(await page.locator('#dpTablo tbody tr:not([hidden])').count(),1);
   await page.locator('#dpAra').fill('');
   await page.locator('[data-dp-sira="ad"]').click();
   assert.match(await page.locator('#dpTablo tbody tr').first().innerText(),/Sentetik Ada/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal scroll at '+width);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(out,'denemepano-'+width+'-'+tema+'.png'),fullPage:true});
   // The per-student page and back.
   await page.locator('#dpKlasik').click();await page.waitForSelector('#dpPanoya');
   assert.equal(await page.locator('#dpKok').count(),0);
   await page.locator('#dpPanoya').click();await page.waitForSelector('#dpKok');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Deneme panosu browser checks passed; screenshots in '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
