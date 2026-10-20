// Etütler on desktop and mobile: the tab in the teacher menu, "PDF ekle" with a synthetic report,
// the five charts and their hover/keyboard readouts, window and period switches, subject and
// teacher focus, student selection, search, sorting, delete and the cloud restore. Synthetic data
// only; the PDF read itself is pdf.js, so its text items are stubbed with test/fixtures/etut-pdf.cjs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-etut-'));fs.mkdirSync(out,{recursive:true});
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(rapor=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-19';
    D.ogr=[{ad:'Sentetik Ada',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    denemePdfSayfalari=async f=>{if(f.name!=='etut.pdf')throw new Error('bilinmeyen dosya');return structuredClone(rapor)};ciz();
   },etutRaporu(GUNLER));
   // The tab sits under Öğrenciler in the teacher menu.
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="etutler"]').count(),1);
   await page.evaluate(()=>{EK.sekme='etutler';ciz()});
   assert.match(await page.locator('#etKok').innerText(),/Henüz etüt raporu yok/);
   await page.locator('#etPdf').setInputFiles([dosya('etut.pdf'),dosya('notlar.pdf')]);
   await page.waitForFunction(()=>/Eklendi/.test(document.getElementById('etDurum')?.textContent||''));
   const durum=await page.locator('#etDurum').innerText();
   assert.match(durum,/16 Ağu 2026 – 19 Eki 2026 · 36 etüt/);assert.match(durum,/notlar\.pdf: bilinmeyen dosya/);
   assert.equal(await page.evaluate(()=>D.etut.satir.length),36);
   await page.waitForFunction(()=>document.querySelectorAll('.et-grafik svg').length===5);
   assert.match(await page.locator('.et-cumle').innerText(),/Son 2 hafta \(5–18 Eki\): 17 etüt, önceki 2 haftaya göre %42 fazla/);
   // Hover on the main chart shows the week's figures; arrow keys move along it.
   const genel=page.locator('[data-et-grafik="genel"]');await genel.scrollIntoViewIfNeeded();const kutu=await genel.boundingBox();
   await page.mouse.move(kutu.x+kutu.width*0.62,kutu.y+120);
   await page.waitForFunction(()=>!document.querySelector('[data-et-grafik="genel"] .et-ipucu').hidden);
   assert.match(await genel.locator('.et-ipucu').innerText(),/haftası[\s\S]*Etüt[\s\S]*Öğrenci/);
   await genel.focus();await page.keyboard.press('End');
   assert.match(await genel.locator('.et-ipucu').innerText(),/19 Eki haftası · devam ediyor[\s\S]*Etüt\s*2/);
   await page.keyboard.press('ArrowLeft');assert.match(await genel.locator('.et-ipucu').innerText(),/12 Eki haftası[\s\S]*Etüt\s*11/);
   await page.keyboard.press('Escape');assert.equal(await genel.locator('.et-ipucu').isHidden(),true);
   // Window and period switches redraw in place; 4 weeks needs eight full weeks.
   assert.equal(await page.locator('[data-et-aralik="4"]').isDisabled(),true);
   await page.locator('[data-et-aralik="1"]').click();
   assert.match(await page.locator('.et-cumle').innerText(),/Geçen hafta \(12–18 Eki\): 11 etüt, önceki haftaya göre %83 fazla/);
   await page.locator('[data-et-tur="gun"]').click();await page.waitForFunction(()=>document.querySelectorAll('.et-grafik svg').length===5);
   assert.match(await page.locator('#etGenel h2').innerText(),/günlük/);assert.equal(await page.locator('#etGenel .et-ort').count(),1);
   await page.locator('[data-et-tur="hafta"]').click();await page.locator('[data-et-aralik="2"]').click();
   // A subject card focuses the subject chart; pressing it again shows every subject.
   await page.locator('.et-ders[data-et-ders="Kimya"]').click();
   assert.match(await page.locator('.et-ders[data-et-ders="Kimya"]').getAttribute('aria-pressed'),/true/);
   assert.match(await page.locator('[data-et-grafik="ders"]').locator('..').locator('h2').innerText(),/Kimya etütleri/);
   await page.locator('.et-ders[data-et-ders="Kimya"]').click();assert.match(await page.locator('[data-et-grafik="ders"]').locator('..').locator('h2').innerText(),/Derslere göre etüt/);
   // A teacher card focuses the teacher chart and lists their students; a student there opens the card.
   const bir=page.locator('.et-hoca-kart').first();
   assert.match(await bir.innerText(),/Sentetik Öğretmen Bir[\s\S]*Matematik · 12 toplam[\s\S]*6/);
   await bir.click();assert.equal(await bir.getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#etHoca h2').first().innerText(),/Sentetik Öğretmen Bir etütleri · haftalık/);
   assert.equal(await page.locator('#etHoca .et-hoca-liste .et-hareket-satir').count(),4);
   await page.waitForFunction(()=>document.querySelector('[data-et-grafik="hoca"] svg'));
   const hoca=page.locator('[data-et-grafik="hoca"]');await hoca.focus();await page.keyboard.press('End');
   assert.match(await hoca.locator('.et-ipucu').innerText(),/19 Eki haftası · devam ediyor[\s\S]*Sentetik Öğretmen Bir\s*1/);
   await page.locator('#etHoca .et-hareket-satir[data-et-ogr^="SENTETİK DENİZ"]').click();
   assert.match(await page.locator('#etKisi').innerText(),/Sentetik Deniz[\s\S]*Öğretmenlere göre[\s\S]*Sentetik Öğretmen Bir/);
   await page.locator('#etHoca [data-et-hoca=""]').click();
   assert.match(await page.locator('#etHoca h2').innerText(),/Öğretmenlere göre etüt/);assert.equal(await page.locator('.et-hoca-kart[aria-pressed="true"]').count(),0);
   // Movers and the table select a student for the detail card.
   assert.match(await page.locator('.et-hareketler').innerText(),/Daha çok alanlar \(3\)[\s\S]*Sentetik Ada[\s\S]*Daha az alanlar \(2\)[\s\S]*Sentetik Bora/);
   await page.locator('.et-tablo tbody tr[data-et-ogr^="SENTETİK CEM"] .et-ad').click();
   assert.match(await page.locator('#etKisi').innerText(),/Sentetik Cem[\s\S]*Bıraktı/);
   await page.waitForFunction(()=>document.querySelector('[data-et-grafik="kisi"] svg'));
   await page.locator('.et-hareket-satir[data-et-ogr^="SENTETİK ADA"]').first().click();
   assert.equal(await page.locator('#etKisi [data-ogr-gor="0"]').count(),1,'a notebook student opens in student view');
   await page.locator('#etAra').fill('bora');assert.equal(await page.locator('.et-tablo tbody tr:not([hidden])').count(),1);
   assert.match(await page.locator('#etSayac').innerText(),/1 \/ 6 öğrenci/);
   await page.locator('#etAra').fill('');await page.locator('#etSinif').selectOption('12/A');assert.equal(await page.locator('.et-tablo tbody tr:not([hidden])').count(),2);
   await page.locator('#etSinif').selectOption('');
   await page.locator('[data-et-sira="fark"]').click();
   assert.match(await page.locator('.et-tablo tbody tr').first().innerText(),/Sentetik Deniz/);
   await page.locator('[data-et-sira="fark"]').click();
   assert.match(await page.locator('.et-tablo tbody tr').first().innerText(),/Sentetik Bora/);
   // The page never scrolls sideways, in either theme.
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal scroll at '+width);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(out,'etutler-'+width+'-'+tema+'.png'),fullPage:true});
   // Delete removes the stored rows; the empty page comes back.
   await page.evaluate(()=>{window.__etut=JSON.parse(JSON.stringify(D.etut))});
   await page.locator('#etSil').click();await page.waitForFunction(()=>D.etut===undefined);
   assert.match(await page.locator('#etKok').innerText(),/Henüz etüt raporu yok/);
   // Signed in to the cloud, the empty page brings the rows back from the newest copy that has them.
   await page.evaluate(()=>{window.bulut={yapilandirilmis:true,mevcutKullanici:()=>({uid:'synthetic',isAnonymous:false})};
     bulutYedekGecmisi=async()=>({tur:'tamam',liste:[{gun:'2026-10-20'},{gun:'2026-10-19'}]});
     buluttanGunAl=async gun=>({tur:'tamam',yedek:gun==='2026-10-20'?{ogr:[],ayar:{}}:{ogr:[],ayar:{},etut:window.__etut}});ciz();delete window.bulut});
   await page.locator('#etGeriGetir').click();
   await page.waitForFunction(()=>D.etut&&D.etut.satir.length===36);
   assert.match(await page.locator('#etDurum').innerText(),/Geri getirildi: 36 etüt \(19 Eki 2026 yedeğinden\)/);
   await page.waitForFunction(()=>document.querySelectorAll('.et-grafik svg').length===5);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Etütler browser checks passed; screenshots in '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
