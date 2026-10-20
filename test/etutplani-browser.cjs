// Etüt planı on desktop (light) and phone (dark): the page in the teacher menu, filling a weekday
// from the etüt report, the teacher view (adding, branş filled from the report, copying a day,
// deleting, empty rows dropped), writing students and the twice-written mark, all days, printing
// (only the sheets, one portrait page per day, from the button or Ctrl+P) and clearing the
// students. Synthetic names only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-etutplani-'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(async pages=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-19';
    D.ogr=[{ad:'Sentetik Ada',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    await ETUT.raporEkle([ETUT.pdfCoz(pages)]);ciz();
   },etutRaporu(GUNLER).pages);
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="etutplani"]').count(),1);
   await page.evaluate(()=>{EK.sekme='etutplani';ciz()});
   const kagit=page.locator('.ep-kagit');
   // Monday 19 Eki opens Pazartesi; the empty day offers the report's Monday teachers.
   assert.equal(await page.locator('[data-ep-gun="0"]').getAttribute('aria-pressed'),'true');
   assert.match(await kagit.locator('.ep-baslik').innerText(),/PAZARTESİ — ETÜT PLANI/);
   await page.locator('[data-ep-rapor="0"]').click();
   await page.waitForFunction(()=>D.etutPlani&&D.etutPlani.gunler[0].length===2);
   assert.match(await page.locator('#epDurum').innerText(),/Etüt raporundan: 2 öğretmen eklendi/);
   assert.match(await kagit.innerText(),/MATEMATİK\s+Sentetik Öğretmen Bir[\s\S]*FİZİK\s+Sentetik Öğretmen Üç/);
   // Teacher view: a new row gets its branş from the report; an empty row is dropped on leaving.
   await page.locator('[data-ep-mod="ogretmen"]').click();
   await page.locator('[data-ep-ekle="0"]').click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.epR+':'+document.activeElement.dataset.epAlan),'2:0','the new row is ready to type in');
   await page.locator('input[data-ep-r="2"][data-ep-alan="1"]').fill('Sentetik Öğretmen Dört');await page.keyboard.press('Tab');
   await page.waitForFunction(()=>D.etutPlani.gunler[0][2][0]==='Kimya');
   assert.equal(await page.locator('input[data-ep-r="2"][data-ep-alan="0"]').inputValue(),'Kimya');
   await page.locator('[data-ep-ekle="0"]').click();await page.waitForFunction(()=>D.etutPlani.gunler[0].length===4);
   await page.locator('[data-ep-mod="ogrenci"]').click();await page.waitForFunction(()=>D.etutPlani.gunler[0].length===3);
   assert.match(await kagit.innerText(),/MATEMATİK[\s\S]*FİZİK[\s\S]*KİMYA\s+Sentetik Öğretmen Dört/);
   // Students: typed or picked from the list; a name written twice on the day turns red on both.
   assert.equal(await page.locator('#epOgrenciler option[value="Sentetik Ada"]').count(),1);
   await page.locator('input[data-ep-r="0"][data-ep-k="0"]').fill('Sentetik Ada');
   await page.locator('input[data-ep-r="0"][data-ep-k="1"]').fill('Sentetik Bora');
   await page.locator('input[data-ep-r="2"][data-ep-k="0"]').fill('sentetik ada');await page.keyboard.press('Tab');
   await page.waitForFunction(()=>D.etutPlani.gunler[0][2][2][0]==='sentetik ada');
   assert.equal(await page.locator('input.ep-cift').count(),2);
   assert.deepEqual(await page.evaluate(()=>D.etutPlani.gunler[0][0][2]),['Sentetik Ada','Sentetik Bora','','']);
   await page.locator('input[data-ep-r="2"][data-ep-k="0"]').fill('Sentetik Cem');await page.keyboard.press('Tab');
   await page.waitForFunction(()=>D.etutPlani.gunler[0][2][2][0]==='Sentetik Cem');assert.equal(await page.locator('input.ep-cift').count(),0);
   await page.evaluate(()=>{EK.sekme='etutler';ciz();EK.sekme='etutplani';ciz()});
   assert.equal(await page.locator('input[data-ep-r="0"][data-ep-k="1"]').inputValue(),'Sentetik Bora','the plan is kept in the notebook');
   if(width<500)assert.equal(await page.locator('.ep-tablo thead').evaluate(e=>getComputedStyle(e).display),'none','the phone shows each teacher as a block');
   await page.screenshot({path:path.join(out,'etutplani-'+width+'-'+tema+'.png'),fullPage:true});
   // Salı: copy Pazartesi's teachers (without students), then delete one.
   await page.locator('[data-ep-gun="1"]').click();await page.locator('[data-ep-mod="ogretmen"]').click();
   await page.locator('select[data-ep-kopya="1"]').selectOption('0');
   await page.waitForFunction(()=>D.etutPlani.gunler[1].length===3);
   assert.match(await page.locator('#epDurum').innerText(),/Pazartesi gününden: 3 öğretmen eklendi/);
   assert.deepEqual(await page.evaluate(()=>D.etutPlani.gunler[1].map(s=>s[1]+':'+s[2].join(''))),['Sentetik Öğretmen Bir:','Sentetik Öğretmen Üç:','Sentetik Öğretmen Dört:']);
   await page.locator('[data-ep-sil="1:1"]').click();await page.waitForFunction(()=>D.etutPlani.gunler[1].length===2);
   // Every day, then print: only the sheets, one portrait page per day with teachers.
   await page.locator('[data-ep-gun="hepsi"]').click();await page.locator('[data-ep-mod="ogrenci"]').click();
   assert.equal(await kagit.count(),5);
   await page.evaluate(()=>{window.__baski=[];window.print=()=>window.__baski.push({sinif:document.body.classList.contains('ep-yazdir'),
     sayfa:document.querySelectorAll('#epBaski .ep-sayfa').length,stil:(document.getElementById('epSayfaStili')||{}).textContent})});
   await page.locator('#epYazdir').click();
   const baski=await page.evaluate(()=>window.__baski);
   assert.equal(baski.length,1);assert.equal(baski[0].sinif,true);assert.equal(baski[0].sayfa,2);assert.match(baski[0].stil,/A4 portrait/);
   await page.emulateMedia({media:'print'});
   const gorunen=await page.evaluate(()=>['#epBaski','.ep-gunler','#ray','.et-arac'].map(s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0}));
   assert.deepEqual(gorunen,[true,false,false,false],'print shows the sheets only');
   assert.match(await page.locator('#epBaski').innerText(),/PAZARTESİ — ETÜT PLANI[\s\S]*BRANŞ\s+ÖĞRETMEN\s+ÖĞRENCİ 1[\s\S]*MATEMATİK\s+Sentetik Öğretmen Bir\s+Sentetik Ada\s+Sentetik Bora[\s\S]*SALI — ETÜT PLANI/);
   assert.equal(await page.locator('#epBaski thead th').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');
   assert.equal(await page.locator('#epBaski tbody th').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(217, 217, 217)');
   if(width>500){
    const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync(path.join(out,'etutplani.pdf'),pdf);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)||[]).length,2,'two days, two pages');
   }
   await page.screenshot({path:path.join(out,'etutplani-baski-'+width+'.png'),fullPage:true});
   await page.emulateMedia({media:'screen'});
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.deepEqual(await page.evaluate(()=>[document.body.classList.contains('ep-yazdir'),!!document.getElementById('epSayfaStili')]),[false,false]);
   // The browser's own print command (Ctrl+P) prints the sheets the same way.
   assert.deepEqual(await page.evaluate(()=>{document.getElementById('epBaski').innerHTML='';window.dispatchEvent(new Event('beforeprint'));
     const r=[document.body.classList.contains('ep-yazdir'),document.querySelectorAll('#epBaski .ep-sayfa').length];window.dispatchEvent(new Event('afterprint'));return r.concat(document.body.classList.contains('ep-yazdir'))}),[true,2,false]);
   // Clearing the students keeps the teachers.
   await page.locator('#epTemizle').click();
   await page.waitForFunction(()=>D.etutPlani.gunler.every(g=>g.every(s=>s[2].every(a=>a===''))));
   assert.equal(await page.evaluate(()=>D.etutPlani.gunler[0].length+D.etutPlani.gunler[1].length),5);
   assert.equal(await page.locator('#epTemizle').isDisabled(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal scroll at '+width);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Etüt planı browser checks passed; screenshots in '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
