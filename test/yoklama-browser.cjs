// Yoklama on desktop and mobile: the tab in the teacher menu, "PDF ekle" with a synthetic report, the
// chart's hover and keyboard readout, the date range (inputs and presets), the scope, a chart per class,
// rankings, the day, the grid, the student card, sorting and search, no sideways scrolling on a phone,
// and delete. Synthetic data only; the PDF read itself is pdf.js, so its text items are stubbed with
// test/fixtures/yoklama-pdf.cjs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {ornekRapor}=require('./fixtures/yoklama-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-yoklama-'));fs.mkdirSync(out,{recursive:true});
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-16T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(rapor=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-16';
    D.ogr=[{ad:'Sentetik Ada',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    denemePdfSayfalari=async f=>{if(f.name!=='yoklama.pdf')throw new Error('bilinmeyen dosya');return structuredClone(rapor)};ciz();
   },ornekRapor());
   // The tab sits under Öğrenciler in the teacher menu.
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="yoklama"]').count(),1);
   await page.evaluate(()=>{EK.sekme='yoklama';ciz()});
   assert.match(await page.locator('#ykKok').innerText(),/Henüz yoklama raporu yok/);
   await page.locator('#ykPdf').setInputFiles([dosya('yoklama.pdf'),dosya('notlar.pdf')]);
   await page.waitForFunction(()=>/Eklendi/.test(document.getElementById('ykDurum')?.textContent||''));
   const durum=await page.locator('#ykDurum').innerText();
   assert.match(durum,/14 Eyl 2026 – 16 Eki 2026 · 7 öğrenci\. 14 Eyl 2026 öncesi alınmadı\./);assert.match(durum,/notlar\.pdf: bilinmeyen dosya/);
   assert.equal(await page.evaluate(()=>D.yoklama.ogrenci.length),7);
   await page.waitForFunction(()=>document.querySelector('[data-yk-grafik="donem"] svg'));
   const cumle=()=>page.locator('#ykKok .et-cumle').innerText();
   assert.match(await cumle(),/Tüm okul · 14 Eyl – 16 Eki · 25 okul günü · 7 öğrenci\. Gelme oranı %90,7\. Gelmedi 10 kez \(4 öğrenci\), geç geldi 3 kez \(2 öğrenci\)\./);
   // The key says what each colour means, in the colours of the page.
   assert.equal(await page.locator('.yk-lejant-oge').count(),5);
   const renk=k=>page.evaluate(k=>getComputedStyle(document.querySelector('.yk-lejant .yk-kare.'+k)).backgroundColor,k);
   const [geldi,gec,gelmedi,raporlu,diger]=await Promise.all(['geldi','gec','gelmedi','raporlu','diger'].map(renk));
   const rgb=s=>s.match(/\d+/g).map(Number);
   assert(rgb(gelmedi)[0]>200&&rgb(gelmedi)[1]<120,'Gelmedi is red: '+gelmedi);assert(rgb(gec)[0]>200&&rgb(gec)[1]>150&&rgb(gec)[2]<60,'Geç is yellow: '+gec);
   assert(rgb(raporlu)[2]>200&&rgb(raporlu)[0]<100,'Raporlu is blue: '+raporlu);assert(rgb(diger)[1]>150&&rgb(diger)[0]<100,'Diğer is green: '+diger);
   const g=rgb(geldi);assert(Math.max(...g)-Math.min(...g)<12,'Geldi is grey: '+geldi);
   if(tema==='light')assert(g[0]>210,'light Geldi is close to white');
   // Hover on the chart shows the week; the keyboard walks it.
   const donem=page.locator('[data-yk-grafik="donem"]');await donem.scrollIntoViewIfNeeded();const kutu=await donem.boundingBox();
   await page.mouse.move(kutu.x+kutu.width*0.12,kutu.y+120);
   await page.waitForFunction(()=>!document.querySelector('[data-yk-grafik="donem"] .et-ipucu').hidden);
   assert.match(await donem.locator('.et-ipucu').innerText(),/14 Eyl haftası · 5 gün[\s\S]*Gelmedi\s*2[\s\S]*Geç geldi\s*1[\s\S]*Raporlu\s*1[\s\S]*Diğer\s*2[\s\S]*Geldi\s*24[\s\S]*Gelme oranı\s*%83,3/);
   await donem.focus();await page.keyboard.press('End');
   assert.match(await donem.locator('.et-ipucu').innerText(),/12 Eki haftası · devam ediyor[\s\S]*Gelmedi\s*3/);
   await page.keyboard.press('Escape');assert.equal(await donem.locator('.et-ipucu').isHidden(),true);
   await page.locator('[data-yk-tur="gun"]').click();await page.waitForFunction(()=>document.querySelector('[data-yk-grafik="donem"] svg'));
   assert.match(await page.locator('#ykGrafik h2').innerText(),/Günlere göre/);
   await page.locator('[data-yk-tur="hafta"]').click();
   // A chart per class, on one scale; a class's name opens that class.
   await page.locator('[data-yk-grup="sube"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-yk-grafik^="grup:"] svg').length===3);
   assert.deepEqual(await page.locator('.yk-coklu-bas b').allInnerTexts(),['12/A','11/B','9/A']);
   await page.locator('.yk-coklu-bas [data-yk-kapsam="11/B"]').click();
   assert.match(await cumle(),/^11\/B · 14 Eyl – 16 Eki · 25 okul günü · 3 öğrenci/);
   assert.equal(await page.locator('[data-yk-grup]').count(),0);assert.equal(await page.locator('#ykSubeler').count(),0);
   await page.locator('#ykKapsam').selectOption('');
   // The range: presets and the two dates; every part follows.
   await page.locator('[data-yk-aralik="hafta"]').click();
   assert.match(await cumle(),/12 Eki – 16 Eki · 5 okul günü · 6 öğrenci\..*Gelmedi 3 kez/);
   assert.equal(await page.locator('[data-yk-aralik="hafta"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-yk-aralik="tum"]').click();
   await page.locator('#ykBas').fill('2026-09-21');
   await page.waitForFunction(()=>/21 Eyl – 16 Eki/.test(document.querySelector('#ykKok .et-cumle').textContent));
   await page.locator('#ykBit').fill('2026-10-02');
   await page.waitForFunction(()=>/21 Eyl – 2 Eki · 10 okul günü/.test(document.querySelector('#ykKok .et-cumle').textContent));
   assert.match(await cumle(),/Gelmedi 4 kez \(3 öğrenci\)/);
   assert.equal(await page.locator('.yk-cz-bas .yk-cz-gun').count(),10);
   await page.locator('[data-yk-aralik="tum"]').click();
   // Rankings: absence and lateness apart; a name opens the student.
   assert.deepEqual((await page.locator('.yk-sira').first().locator('.et-kim>span:first-child').allInnerTexts()),['Sentetik Cem','Sentetik Uzunadlı Feride İkinci','Sentetik Ege','Sentetik Ada']);
   assert.deepEqual((await page.locator('.yk-sira').nth(1).locator('.et-kim>span:first-child').allInnerTexts()),['Sentetik Ada','Sentetik Cem']);
   assert.deepEqual(await page.locator('.yk-sira').first().locator('.et-sira-no').allInnerTexts(),['1','2','3','3']);
   await page.locator('.yk-sira').nth(1).locator('.yk-sira-satir').first().click();
   const kart=page.locator('#ykKisi');
   assert.match(await kart.locator('h3').innerText(),/Sentetik Ada/);
   assert.equal(await kart.locator('.ogr-ad[data-ogr-gor="0"]').count(),1,'the notebook student opens in student view');
   assert.equal(await kart.locator('.yk-tk:not(.yok)').count(),25);
   assert.equal(await kart.locator('.yk-tk.gelmedi').count(),1);assert.equal(await kart.locator('.yk-tk.gec').count(),2);
   assert.match(await kart.locator('.yk-olaylar').innerText(),/Sal 13 Eki[\s\S]*Geldi[\s\S]*3\. ders gelmedi[\s\S]*Per 8 Eki[\s\S]*5–8\. ders gelmedi[\s\S]*Sal 6 Eki[\s\S]*Geç geldi[\s\S]*1–2\. ders gelmedi · 3–8\. ders geldi/);
   // The day: the last one is incomplete; EGE’s absence is unexpected, FERİDE’s is not.
   const gunP=page.locator('#ykGun');
   assert.match(await gunP.locator('h2').innerText(),/Cum 16 Eki/);assert.match(await gunP.innerText(),/Rapor bu gün bitmeden alındı/);
   assert.match(await gunP.locator('.yk-gun-grup').first().innerText(),/Gelmedi\s*\(2\)[\s\S]*Sentetik Ege[\s\S]*Beklenmedik[\s\S]*Sentetik Uzunadlı Feride İkinci/);
   assert.equal(await gunP.locator('.yk-beklenmedik').count(),1);
   await gunP.locator('[aria-label="Önceki gün"]').click();
   assert.match(await page.locator('#ykGun h2').innerText(),/Per 15 Eki/);assert.match(await page.locator('#ykGun').innerText(),/Bu gün herkes geldi/);
   await page.locator('#ykGunSec').selectOption({label:'Sal 22 Eyl'});
   assert.match(await page.locator('#ykGun .yk-gun-grup').first().innerText(),/Gelmedi\s*\(1\)[\s\S]*Sentetik Ada[\s\S]*Beklenmedik/);
   assert.equal(await page.locator('[aria-label="Sonraki gün"]').isDisabled(),false);
   // Every-day students, and the grid of days.
   assert.deepEqual(await page.locator('#ykTam .yk-ad-cip').evaluateAll(l=>l.map(e=>e.firstChild.textContent)),['Sentetik Bora','Sentetik Deniz']);
   assert.equal(await page.locator('#ykCizelge .yk-cz-satir:not(.yk-cz-bas)').count(),7);
   assert.equal(await page.locator('#ykCizelge .yk-h.gec').count(),3);
   assert.equal(await page.locator('#ykCizelge .yk-h.gec').first().getAttribute('title'),'Sal 29 Eyl · Geç geldi · 1. ders gecikti · 2–8. ders geldi');
   // The student table: sort by lateness, search.
   await page.locator('[data-yk-sira="gec"]').click();
   assert.equal(await page.locator('.yk-tablo tbody tr').first().getAttribute('data-ara'),await page.evaluate(()=>denemeAdAnahtari('SENTETİK ADA')));
   await page.locator('#ykAra').fill('ege');
   assert.equal(await page.locator('.yk-tablo tbody tr:not([hidden])').count(),1);assert.equal(await page.locator('#ykSayac').innerText(),'1 / 7 öğrenci');
   await page.locator('#ykAra').fill('');
   // On a phone nothing scrolls sideways but the grid and the tables inside their boxes.
   if(width<500)assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways page scroll');
   await page.locator('#ykKok').screenshot({path:path.join(out,'yoklama-'+width+'-'+tema+'.png')});
   // Delete asks first and leaves the empty page.
   await page.locator('#ykSil').click();
   await page.waitForFunction(()=>/Henüz yoklama raporu yok/.test(document.getElementById('ykKok').textContent));
   assert.equal(await page.evaluate(()=>D.yoklama),undefined);
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Yoklama '+width+' '+tema);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
