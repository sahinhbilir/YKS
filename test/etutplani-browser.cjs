// Etüt planı on desktop (light) and phone (dark): the page in the teacher menu, filling a weekday
// from the etüt report, the teacher view (adding, branş filled from the report, copying a day,
// deleting, empty rows dropped, a pasted list), writing students and the twice-written mark, all
// days, the sheet in the school's Excel colours, printing (only the sheets, A4 landscape with two days
// to a page, from the button or Ctrl+P), Sınıf dağıtımı (dated sheets, a class in Öğrenci 1, printed
// per week), the classes' timetables (Ders programları: read, shown, used to give each class's etüts
// to its own teachers) and clearing the students. Synthetic names only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {dersProgrami}=require('./fixtures/ders-programi-pdf.cjs');
const ders=(l)=>{const h=[];let i=0;for(const [d,hoca,n] of l)for(let k=0;k<n;k++,i++)h.push([i%5,Math.floor(i/5),d,hoca]);return h};
const PROGRAMLAR={'11A.pdf':dersProgrami({kod:'302',sinif:'11/A',hucreler:ders([['MATEMATİK','SENTETİK ÖĞRETMEN BİR',6],['GEOMETRİ','SENTETİK MAT SEKİZ',3],['FİZİK','SENTETİK ÖĞRETMEN ÜÇ',4],['KİMYA','SENTETİK ÖĞRETMEN DÖRT',3]])}),
  '12A.pdf':dersProgrami({kod:'301',sinif:'12/A',hucreler:ders([['MATEMATİK AYT','SENTETİK MAT SEKİZ',6]])})};
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
   assert.match(await kagit.innerText(),/MATEMATİK\s+SENTETİK ÖĞRETMEN BİR[\s\S]*FİZİK\s+SENTETİK ÖĞRETMEN ÜÇ/);
   // The sheet is the Excel page: navy title, blue header, light blue branş, light yellow student cells.
   const renk=(sel)=>page.locator(sel).first().evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).color]);
   assert.deepEqual(await renk('.ep-kagit thead th'),['rgb(47, 85, 151)','rgb(255, 255, 255)']);
   assert.deepEqual((await renk('.ep-kagit th.ep-brans'))[0],'rgb(217, 226, 243)');
   assert.deepEqual((await renk('.ep-kagit td.ep-ogr'))[0],'rgb(255, 242, 204)');
   assert.equal(await page.locator('.ep-kagit .ep-baslik').evaluate(e=>getComputedStyle(e).color),'rgb(31, 56, 100)');
   // Teacher view: a new row gets its branş from the report; an empty row is dropped on leaving.
   await page.locator('[data-ep-mod="ogretmen"]').click();
   await page.locator('[data-ep-ekle="0"]').click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.epR+':'+document.activeElement.dataset.epAlan),'2:0','the new row is ready to type in');
   await page.locator('input[data-ep-r="2"][data-ep-alan="1"]').fill('Sentetik Öğretmen Dört');await page.keyboard.press('Tab');
   await page.waitForFunction(()=>D.etutPlani.gunler[0][2][0]==='Kimya');
   assert.equal(await page.locator('input[data-ep-r="2"][data-ep-alan="0"]').inputValue(),'Kimya');
   await page.locator('[data-ep-ekle="0"]').click();await page.waitForFunction(()=>D.etutPlani.gunler[0].length===4);
   await page.locator('[data-ep-mod="ogrenci"]').click();await page.waitForFunction(()=>D.etutPlani.gunler[0].length===3);
   assert.match(await kagit.innerText(),/MATEMATİK[\s\S]*FİZİK[\s\S]*KİMYA\s+SENTETİK ÖĞRETMEN DÖRT/);
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
   // Every day, then print: only the sheets, A4 landscape, Pazartesi and Salı on one page.
   await page.locator('[data-ep-gun="hepsi"]').click();await page.locator('[data-ep-mod="ogrenci"]').click();
   assert.equal(await kagit.count(),5);
   await page.evaluate(()=>{window.__baski=[];window.print=()=>window.__baski.push({sinif:document.body.classList.contains('ep-yazdir'),
     sayfa:document.querySelectorAll('#epBaski .ep-sayfa').length,stil:(document.getElementById('epSayfaStili')||{}).textContent})});
   await page.locator('#epYazdir').click();
   const baski=await page.evaluate(()=>window.__baski);
   assert.equal(baski.length,1);assert.equal(baski[0].sinif,true);assert.equal(baski[0].sayfa,1);assert.match(baski[0].stil,/A4 landscape/);
   await page.emulateMedia({media:'print'});
   const gorunen=await page.evaluate(()=>['#epBaski','.ep-gunler','#ray','.et-arac'].map(s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0}));
   assert.deepEqual(gorunen,[true,false,false,false],'print shows the sheets only');
   assert.match(await page.locator('#epBaski').innerText(),/PAZARTESİ — ETÜT PLANI[\s\S]*BRANŞ\s+ÖĞRETMEN\s+ÖĞRENCİ 1[\s\S]*MATEMATİK\s+SENTETİK ÖĞRETMEN BİR\s+SENTETİK ADA\s+SENTETİK BORA[\s\S]*SALI — ETÜT PLANI/);
   assert.equal(await page.locator('#epBaski thead th').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(47, 85, 151)');
   assert.equal(await page.locator('#epBaski tbody th').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(217, 226, 243)');
   assert.equal(await page.locator('#epBaski td.ep-ogr').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 242, 204)');
   if(width>500){
    const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync(path.join(out,'etutplani.pdf'),pdf);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)||[]).length,1,'Pazartesi and Salı on one page');
    assert.match(pdf.toString('latin1'),/\/MediaBox\s*\[\s*0 0 84[12](\.\d+)? 59[45](\.\d+)?\s*\]/,'A4 landscape');
   }
   await page.screenshot({path:path.join(out,'etutplani-baski-'+width+'.png'),fullPage:true});
   await page.emulateMedia({media:'screen'});
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.deepEqual(await page.evaluate(()=>[document.body.classList.contains('ep-yazdir'),!!document.getElementById('epSayfaStili')]),[false,false]);
   // The browser's own print command (Ctrl+P) prints the sheets the same way.
   assert.deepEqual(await page.evaluate(()=>{document.getElementById('epBaski').innerHTML='';window.dispatchEvent(new Event('beforeprint'));
     const r=[document.body.classList.contains('ep-yazdir'),document.querySelectorAll('#epBaski .ep-sayfa').length];window.dispatchEvent(new Event('afterprint'));return r.concat(document.body.classList.contains('ep-yazdir'))}),[true,1,false]);
   // A pasted list fills other days at once; the box empties after use.
   await page.locator('[data-ep-mod="ogretmen"]').click();await page.locator('#epYapistir summary').click();
   await page.locator('#epListe').fill('ÇARŞAMBA\nMatematik: Sentetik Mat Bir, Sentetik Mat Sekiz\nPERŞEMBE\nFizik: Sentetik Öğretmen Üç');
   await page.locator('#epListeUygula').click();
   await page.waitForFunction(()=>D.etutPlani.gunler[2].length===2&&D.etutPlani.gunler[3].length===1);
   assert.match(await page.locator('#epDurum').innerText(),/Yapıştırıldı: Çarşamba 2 · Perşembe 1 öğretmen/);
   assert.equal(await page.locator('#epYapistir[open]').count(),0);
   await page.locator('[data-ep-mod="ogrenci"]').click();
   assert.match(await page.locator('.ep-kagit').nth(3).innerText(),/PERŞEMBE — ETÜT PLANI[\s\S]*FİZİK\s+SENTETİK ÖĞRETMEN ÜÇ/);
   // Sınıf dağıtımı: 22 Eki – 6 Kas, a class (never 12th grade) in every teacher's Öğrenci 1.
   const dagitim=page.locator('#epDagitim');if(!await dagitim.evaluate(e=>e.open))await dagitim.locator('summary').click();
   await page.locator('#epDonemBas').fill('2026-10-22');await page.locator('#epDonemBit').fill('2026-11-06');
   await page.locator('#epSiniflar').fill('9/A, 9-b, 10/A, 12/A');await page.locator('#epYok').fill('28.10.2026, 29.10.2026');
   await page.locator('#epDagit').click();await page.waitForFunction(()=>D.etutPlani.donem);
   assert.deepEqual(await page.evaluate(()=>D.etutPlani.donem),{bas:'2026-10-22',bit:'2026-11-06',siniflar:['9/A','9/B','10/A'],yok:['2026-10-28','2026-10-29']});
   assert.match(await page.locator('#epDurum').innerText(),/Dağıtıldı: 22 Eki – 6 Kas · 10 gün · 3 sınıf \(12\. sınıflar alınmadı\)/);
   assert.equal(await page.locator('#epTarih').inputValue(),String(await page.evaluate(()=>gunNo('2026-10-22'))),'the next date opens');
   assert.match(await kagit.first().innerText(),/PERŞEMBE 22 EKİM — ETÜT PLANI[\s\S]*FİZİK\s+SENTETİK ÖĞRETMEN ÜÇ\s+9\/B/);
   await page.locator('#epTarih').selectOption('hepsi');await page.waitForFunction(()=>document.querySelectorAll('.ep-kagit').length===10);
   // A name written on one Pazartesi shows on the other Pazartesi too.
   await page.locator('.ep-kagit[data-ep-tarih="'+await page.evaluate(()=>gunNo('2026-10-26'))+'"] input[data-ep-r="0"][data-ep-k="1"]').fill('Sentetik Ege');await page.keyboard.press('Tab');
   await page.waitForFunction(()=>D.etutPlani.gunler[0][0][2][1]==='Sentetik Ege');
   assert.equal(await page.locator('.ep-kagit[data-ep-tarih="'+await page.evaluate(()=>gunNo('2026-11-02'))+'"] input[data-ep-r="0"][data-ep-k="1"]').inputValue(),'Sentetik Ege');
   await page.screenshot({path:path.join(out,'etutplani-dagitim-'+width+'-'+tema+'.png'),fullPage:true});
   await page.locator('#epYazdir').click();
   const sayfalar=await page.evaluate(()=>[...document.querySelectorAll('#epBaski .ep-sayfa')].map(s=>[...s.querySelectorAll('h1')].map(h=>h.textContent.replace(' — ETÜT PLANI',''))));
   assert.deepEqual(sayfalar,[['PERŞEMBE 22 EKİM'],['PAZARTESİ 26 EKİM','SALI 27 EKİM'],['PAZARTESİ 2 KASIM','SALI 3 KASIM'],['ÇARŞAMBA 4 KASIM','PERŞEMBE 5 KASIM']],'two days to a page, per week; days off and days without teachers left out');
   if(width>500){await page.emulateMedia({media:'print'});const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync(path.join(out,'etutplani-dagitim.pdf'),pdf);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)||[]).length,4);await page.emulateMedia({media:'screen'})}
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('#epBaski .ep-sayfa').first().locator('td.ep-sinif').first().textContent(),'9/B','the class is printed in Öğrenci 1');
   // Clearing the students keeps the teachers.
   await page.locator('#epTemizle').click();
   await page.waitForFunction(()=>D.etutPlani.gunler.every(g=>g.every(s=>s[2].every(a=>a===''))));
   assert.equal(await page.evaluate(()=>D.etutPlani.gunler[0].length+D.etutPlani.gunler[1].length),5);
   // Kaldır returns to the weekly sheets.
   if(!await dagitim.evaluate(e=>e.open))await dagitim.locator('summary').click();
   await page.locator('#epDagitimKaldir').click();await page.waitForFunction(()=>!D.etutPlani.donem);
   assert.equal(await page.locator('#epTarih').count(),0);assert.equal(await page.locator('[data-ep-gun="hepsi"]').count(),1);
   // Ders programları: the school's timetable PDFs (a file that is not one is named); the class's week is shown.
   await page.evaluate(dp=>{denemePdfSayfalari=async f=>{if(!dp[f.name])throw new Error('bilinmeyen dosya');return {pages:structuredClone(dp[f.name]),boylar:[842]}}},PROGRAMLAR);
   const prog=page.locator('#epProgramlar');if(!await prog.evaluate(e=>e.open))await prog.locator('summary').click();
   await page.locator('#epProgramPdf').setInputFiles(['11A.pdf','12A.pdf','notlar.pdf'].map(name=>({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')})));
   await page.waitForFunction(()=>D.etutPlani.programlar&&Object.keys(D.etutPlani.programlar).length===2);
   assert.match(await page.locator('#epDurum').innerText(),/Ders programı eklendi: 11\/A \(16 saat\), 12\/A \(6 saat\)\. Okunamayan: notlar\.pdf: bilinmeyen dosya/);
   assert.match(await page.locator('.ep-program caption').innerText(),/11\/A/);
   assert.match(await page.locator('.ep-program tbody tr').first().innerText(),/09\.00\s+MATEMATİK\s+SENTETİK ÖĞRETMEN BİR/);
   // With the timetables the class's etüts go to its own teachers; a mathematician teaching it Geometri is written beside it.
   if(!await dagitim.evaluate(e=>e.open))await dagitim.locator('summary').click();
   assert.equal(await page.locator('#epSiniflar').inputValue(),'11/A','the classes with a timetable, without the 12th grade');
   await page.locator('#epDonemBas').fill('2026-10-26');await page.locator('#epDonemBit').fill('2026-11-06');await page.locator('#epYok').fill('');
   await page.locator('#epDagit').click();await page.waitForFunction(()=>D.etutPlani.donem);
   assert.match(await page.locator('#epDagitim summary').innerText(),/ders programına göre/);
   await page.locator('#epTarih').selectOption('hepsi');await page.waitForFunction(()=>document.querySelectorAll('.ep-kagit').length===10);
   const siniflar=await page.locator('.ep-kagit td.ep-sinif').allInnerTexts();
   assert(siniflar.includes('11/A (GEOMETRİ)'),'Geometri beside the class: '+siniflar.join(','));
   assert(siniflar.filter(Boolean).every(c=>/^11\/A( \(GEOMETRİ\))?$/.test(c)),'only 11/A, with its own teachers');
   // Geometri (3 hours) gets one etüt while Matematik (6 hours) has four: never more per hour.
   assert.equal(siniflar.filter(c=>c==='11/A (GEOMETRİ)').length,1);assert.equal(siniflar.filter(c=>c==='11/A').length>=4,true);
   await page.screenshot({path:path.join(out,'etutplani-program-'+width+'-'+tema+'.png'),fullPage:true});
   assert.equal(await page.locator('#epTemizle').isDisabled(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal scroll at '+width);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Etüt planı browser checks passed; screenshots in '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
