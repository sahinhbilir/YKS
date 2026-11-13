// Sıralamalar ranking in the page, exam date correction, and "öğrenci gözüyle": a student's name
// opens what that student sees, in an isolated frame that saves nothing. Desktop and mobile.
// Synthetic data only; nothing leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-student-view-'));fs.mkdirSync(out,{recursive:true});
const listeler={'once-tyt.pdf':okulListesi(SINAVLAR.once.T),'once-ayt.pdf':okulListesi(SINAVLAR.once.F),'sonra-tyt.pdf':okulListesi(SINAVLAR.sonra.T),'sonra-ayt.pdf':okulListesi(SINAVLAR.sonra.F)};
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],dialogs=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept()});
   await page.clock.setFixedTime(new Date('2026-10-14T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(l=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';
    const ders=n=>DENEME_DERSLER.TYT.map(d=>({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const kayit=n=>({id:'p:'+encodeURIComponent([denemeAdAnahtari('Sentetik Deneme 1'),'2026-09-18','TYT'].join('|')),ad:'Sentetik Deneme 1',tarih:'2026-09-18',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:5});
    const ilk=gunNo('2026-10-05');
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:ilk,cikti:bugunNo(),ogrenciBulutId:'s1',denemeOkul:[kayit(30)]},
     {ad:'SENTETİK BORA',no:1002,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ilkAktif:ilk,ogrenciBulutId:'s2',denemeOkul:[kayit(20)]}];
    EK.ogr=0;EK.sekme='siralamalar';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    denemePdfSayfalari=async f=>{if(!l[f.name])throw new Error('bilinmeyen dosya');return structuredClone(l[f.name])};ciz();
   },listeler);
   // 1) Ranking in the page: Net, Net artışı, % artış, Kapanan fark (log); TYT/AYT; class filter.
   await page.locator('#srPdf').setInputFiles(Object.keys(listeler).map(dosya));
   await page.waitForFunction(()=>/Kaydedildi/.test(document.getElementById('srDurum')?.textContent||''));
   const satirlar=page.locator('.sr-sira-tablo tbody tr:not(.sr-ort)'),adlar=async()=>(await satirlar.locator('td:nth-child(2)').allInnerTexts()).map(s=>s.split(' ')[0]);
   assert.deepEqual(await adlar(),['1003','1001','1005','1002','1004'],'by net');
   assert.deepEqual(await satirlar.first().locator('td').allInnerTexts(),['1','1003 SENTETİK CEMRE UZUNADLI İKİNCİ','201-B','76.75','84.25','+7.50','+9.8%','+0.186']);
   await page.locator('[data-sr-sira-olcut="artis"]').click();assert.deepEqual(await adlar(),['1001','1003','1002','1004','1005']);
   await page.locator('[data-sr-sira-olcut="yuzde"]').click();assert.deepEqual(await adlar(),['1001','1003','1002','1004','1005']);
   await page.locator('[data-sr-sira-olcut="fark"]').click();assert.deepEqual(await adlar(),['1003','1001','1002','1004','1005']);
   assert.equal(await page.locator('.sr-sira-tablo th.secili').innerText(),'KAPANAN FARK (LOG)');
   await page.locator('#srSiraSube').selectOption('201 12/B');assert.deepEqual(await adlar(),['1003','1004']);
   await page.locator('#srSiraSube').selectOption('');
   await page.locator('[data-sr-sira-tur="AYT"]').click();assert.deepEqual(await adlar(),['1003','1004','1005'],'AYT SAY by default');
   await page.locator('#srSiraNet').selectOption('Toplam');assert.equal(await satirlar.count(),5);
   // School and class averages open the table; any single TYT or AYT course can be ranked.
   await page.locator('[data-sr-sira-tur="TYT"]').click();await page.locator('#srSiraSube').selectOption('');
   assert.deepEqual((await page.locator('.sr-sira-tablo tr.sr-ort td:nth-child(2)').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')),
     ['Okul ortalaması 5 öğrenci','301-A ortalaması 2 öğrenci','201-B ortalaması 2 öğrenci','205-C ortalaması 1 öğrenci']);
   await page.locator('#srSiraNet').selectOption('TYT:MAT');await page.locator('[data-sr-sira-olcut="fark"]').click();
   assert.deepEqual(await adlar(),['1003','1001','1002','1004','1005'],'TYT Matematik by gap closed');
   assert.equal(await page.locator('.sr-sira-tablo tr.sr-ort').first().locator('td.k-simdi').innerText(),'12.35');
   await page.locator('[data-sr-sira-tur="AYT"]').click();await page.locator('#srSiraNet').selectOption('AYT:EDB');
   assert.deepEqual(await adlar(),['1001','1002'],'AYT Edebiyat: only students who answered TDE-SB1');
   await page.locator('.sr-siralama').screenshot({path:path.join(out,'ranking-'+width+'.png')});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'the table scrolls inside its card');
   await page.locator('[data-sr-sira-tur="TYT"]').click();
   // 2) The exam date is corrected in place; students' school results move with it. (PDF ekle published each student's rows:
   // Deneme 1 moves with its date, Deneme 2 stays on its own TYT and AYT dates.)
   if(width===1280){
    await page.locator('[data-sr-tarih]').last().fill('2026-08-18');
    await page.waitForFunction(()=>/tarihi 18\.08\.2026 oldu/.test(document.getElementById('srDurum')?.textContent||''));
    assert.match(dialogs.at(-1),/Sentetik Deneme 1 sınavının tarihi 18\.08\.2026 olsun mu\?/);
    assert.match(await page.locator('#srDurum').innerText(),/2 öğrencinin sonucu taşındı\..*yayın bekliyor/);
    assert.deepEqual(await page.evaluate(()=>[D.siralama.sinavlar.find(s=>s.ad==='Sentetik Deneme 1').tarih,denemeListe(0).map(r=>r.tarih),D.ogr.map(o=>o.denemeYayinBekliyor)]),
     ['18.08.2026',['2026-08-18','2026-08-18','2026-10-02','2026-10-09'],[true,true]]);
    assert.match(await page.locator('.sr-sinavlar tbody tr').last().innerText(),/PDF’de: 18\.09\.2026/);
   }
   // 3) A name opens the student's own view in an isolated frame; the teacher's notebook is untouched.
   const defter=await page.evaluate(async()=>{await LOCAL_STORE.set('yks_veri',JSON.stringify(D));return LOCAL_STORE.get('yks_veri')});
   const gozuyle=async(tikla,ad)=>{
    await tikla();const ortu=page.locator('#ogrGor');await ortu.waitFor();
    assert.equal(await ortu.locator('.ogr-gor-ust b').innerText(),ad);
    const cerceve=page.frameLocator('#ogrGor iframe');await cerceve.getByRole('heading',{name:'Hafızam'}).waitFor();   // the student's landing page
    assert.equal(await page.locator('#ogrGor iframe').getAttribute('sandbox'),'allow-scripts allow-modals allow-downloads');
    assert.equal(await cerceve.locator('#oturumKapat').count(),0,'no logout inside');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('ogr-gor-acik')),true);
    return cerceve;
   };
   let cerceve=await gozuyle(()=>page.locator('.sr-sira-tablo [data-ogr-gor="0"]').click(),'SENTETİK ADA');
   if(width===1280)await page.screenshot({path:path.join(out,'student-view-'+width+'.png')});
   if(await cerceve.locator('[aria-controls="hesapMenusu"]').isVisible())await cerceve.locator('[aria-controls="hesapMenusu"]').click();
   await cerceve.locator('#ray [data-sekme="ayarlar"]').first().click();
   const icerde=page.frames().find(f=>f!==page.mainFrame());
   assert.equal(await icerde.evaluate(()=>LOCAL_STORE.mode()),'memory','the sandbox never opens persistent storage');
   assert.notEqual(await icerde.evaluate(()=>LOCAL_STORE.get('yks_veri')),defter,'the frame has its own memory storage');
   assert.equal(await icerde.evaluate(()=>D.rol+':'+D.ogr.length+':'+D.ogr[0].ad),'ogrenci:1:SENTETİK ADA');
   await page.locator('#ogrGorKapat').click();assert.equal(await page.locator('#ogrGor').count(),0);
   assert.equal(await page.evaluate(()=>document.body.classList.contains('ogr-gor-acik')),false);
   if(width===1280){
    // The same from every page that names a student.
    const ac=async(sekme,secici,ad)=>{await page.evaluate(s=>{EK.sekme=s;ciz()},sekme);await gozuyle(()=>page.locator(secici).first().click(),ad);
     await page.keyboard.press('Escape');assert.equal(await page.locator('#ogrGor').count(),0,'Esc closes ('+sekme+')');};
    await ac('ana','#rehberHafta .rh-adlar [data-ogr-gor]','SENTETİK ADA');
    await ac('takip','.etkinlik-satir [data-ogr-gor="1"]','SENTETİK BORA');
    await ac('plan','.sayfa-ust .isim [data-ogr-gor]','SENTETİK ADA');
    await ac('ogrenciler','.ogr-gor-dugme[data-ogr-gor="1"]','SENTETİK BORA');
    await page.evaluate(()=>{EK.ogr=0;EK.denemeKisi=true});await ac('denemeler','#dpKok [data-ogr-gor]','SENTETİK ADA');await page.evaluate(()=>{EK.denemeKisi=false});
    await ac('harita','.baslik [data-ogr-gor]','SENTETİK ADA');
   }
   assert.equal(await page.evaluate(()=>LOCAL_STORE.get('yks_veri')),defter,'nothing done in the student view reached the teacher notebook');
   // 4) The lag line and the preview. Student 1's published copies are gone (the lists still print them): the teacher's per-student
   // panosu says how many exams the student's own screen lacks, the preview shows exactly what the student has (nothing yet), and
   // "Öğrencilere gönder" clears the line. Then the same for the whole class.
   const eksikSayi=await page.evaluate(()=>{D.ogr[0].denemeOkul=[];D.ogr[0].denemeler=[];D.ogr[0].denemeYayinBekliyor=false;D.ogr[1].denemeOkul=[];D.ogr[1].denemeYayinBekliyor=false;
     EK.ogr=0;EK.denemeKisi=true;EK.sekme='denemeler';ciz();return [denemeEksikSayisi(0),denemeEksikSayisi(),denemeListe(0).filter(r=>r.okulListe).length]});
   assert(eksikSayi[0]>=3 && eksikSayi[0]===eksikSayi[2],'the lists print exams for this student: '+eksikSayi);assert(eksikSayi[1]>eksikSayi[0]);
   await page.locator('#dnEksik').waitFor();
   assert.equal((await page.locator('#dnEksik').innerText()).replace(/\s+/g,' ').trim(),'Bu öğrencinin ekranında '+eksikSayi[0]+' deneme eksik · Öğrencilere gönder');
   const onizle=await gozuyle(()=>page.locator('#dpKok [data-ogr-gor]').click(),'SENTETİK ADA');
   await onizle.locator('#ray [data-sekme="denemeler"]').first().click().catch(async()=>{await onizle.locator('[aria-controls="hesapMenusu"]').click();await onizle.locator('#ray [data-sekme="denemeler"]').first().click()});
   await onizle.locator('#dpKok').waitFor();
   assert.equal(await page.frames().find(f=>f!==page.mainFrame()).evaluate(()=>JSON.stringify([denemeListe(0).length,denemeListe(0).filter(r=>r.okulListe).length,typeof D.siralama,D.ogr.length])),JSON.stringify([0,0,'undefined',1]),'the student has no copies and sees no teacher-only list rows');
   assert.equal(await onizle.locator('#dpKok circle.dn-dot').count(),0,'nothing is drawn: the student has no published result yet');
   await page.locator('#ogrGorKapat').click();
   // Send to this student: the line goes away once the DOM has redrawn, and the preview now shows the published copies.
   await page.locator('#dnEksikGonder').click();await page.locator('#dnEksik').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>denemeEksikSayisi(0)),0);
   assert.equal(await page.evaluate(()=>denemeEksikSayisi(1)>0),true,'the other student still waits');
   const kopya=await page.evaluate(()=>D.ogr[0].denemeOkul.filter(r=>!r.silindi).length);assert.equal(kopya,eksikSayi[0]);
   const onizle2=await gozuyle(()=>page.locator('#dpKok [data-ogr-gor]').click(),'SENTETİK ADA');
   await onizle2.locator('#ray [data-sekme="denemeler"]').first().click().catch(async()=>{await onizle2.locator('[aria-controls="hesapMenusu"]').click();await onizle2.locator('#ray [data-sekme="denemeler"]').first().click()});
   await onizle2.locator('#dpKok').waitFor();
   assert.equal(await page.frames().find(f=>f!==page.mainFrame()).evaluate(()=>denemeListe(0).filter(r=>r.okulListe).length+':'+denemeListe(0).length),'0:'+kopya,'copies only');
   await page.locator('#ogrGorKapat').click();
   // The class panosu: the same line with the class total, one button.
   await page.evaluate(()=>{EK.denemeKisi=false;EK.sekme='denemeler';ciz()});
   await page.locator('#dnEksik').waitFor();
   assert.match(await page.locator('#dnEksik').innerText(),/^Öğrencilerin ekranında \d+ deneme eksik/);assert.equal(await page.locator('#dnYayinla').count(),1);
   await page.locator('#dnYayinla').click();await page.locator('#dnEksik').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>denemeEksikSayisi()),0);
   // "Tarihleri onar": a copy on the wrong day (the AYT day on the TYT copy) is fixed once.
   await page.evaluate(()=>{const o=D.ogr[0],r=o.denemeOkul.find(x=>!x.silindi&&x.oturum==='TYT');const yanlis=isoDan(gunNo(r.tarih)+3);   // the other session's day, within the 14-day window of a generic name;
     o.denemeOkul=denemeBirlestir(o.denemeOkul,[{...r,silindi:true,ts:r.ts+1},{...r,id:'p:'+encodeURIComponent([denemeAdAnahtari(r.ad),yanlis,'TYT'].join('|')),tarih:yanlis,ts:r.ts+2}]);ciz()});
   await page.locator('#dnTarihOnar').waitFor();assert.equal(await page.locator('#dnTarihFarki').innerText().then(t=>/^1 yayınlanmış sonucun tarihi okul listesinden farklı/.test(t)),true);
   await page.locator('#dnTarihOnar').click();await page.locator('#dnTarihOnar').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>denemeTarihFarklari().length),0);
   assert.deepEqual(errors,[]);console.log('PASS ranking, date correction and student view',width);await context.close();
  }
  console.log('Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
