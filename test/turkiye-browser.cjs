// Türkiye geneli on desktop and mobile: the page under Denemeler, "PDF ekle" with synthetic reports, the
// school picker, the sentence and cards, the Sıra chart's hover, keyboard and line highlight, a subject's
// net chart and nearby schools, TYT/AYT, the exam picker, deleting a list and no sideways scrolling on a
// phone. Synthetic data only; the PDF read itself is pdf.js, so its text items are stubbed with
// test/fixtures/kurum-pdf.cjs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {kurumListesi,kurumRaporu,BIZ}=require('./fixtures/kurum-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-turkiye-'));fs.mkdirSync(out,{recursive:true});
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
const ad=e=>'27-YKS-120'+e+' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-28T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   const raporlar=Object.fromEntries([1,2,3].map(e=>[ad(e),kurumRaporu(kurumListesi(e)).pages]));
   await page.evaluate(r=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-28';
    D.ogr=[{ad:'Sentetik Ada',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    denemePdfSayfalari=async f=>{if(!r[f.name])throw new Error('bilinmeyen dosya');return {pages:structuredClone(r[f.name])}};ciz();
   },raporlar);
   // The page sits under Denemeler in the teacher menu.
   assert.equal(await page.locator('#ray #denemelerMenusu [data-sekme="turkiye"]').count(),1);
   await page.evaluate(()=>{EK.sekme='turkiye';ciz()});
   assert.match(await page.locator('#tgKok').innerText(),/Henüz liste yok/);
   await page.locator('#tgPdf').setInputFiles([dosya(ad(1)),dosya(ad(2)),dosya('notlar.pdf')]);
   await page.waitForFunction(()=>/Eklendi/.test(document.getElementById('tgDurum')?.textContent||''));
   const durum=await page.locator('#tgDurum').innerText();
   assert.match(durum,/Eklendi: 27-YKS-1201 · Kolej · 5 ders, 27-YKS-1202 · Kolej · 5 ders\./);assert.match(durum,/notlar\.pdf: bilinmeyen dosya/);
   // No school yet: the picker asks for it, no charts.
   assert.match(await page.locator('#tgKok').innerText(),/Okulunuzu seçin/);assert.equal(await page.locator('[data-tg-grafik]').count(),0);
   await page.locator('#tgOkul').selectOption(BIZ);
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="toplam"] svg'));
   assert.equal(await page.evaluate(()=>D.turkiye.okul),BIZ);
   const cumle=()=>page.locator('#tgKok .et-cumle').innerText();
   // Artış is the default view. Fizik is outside the list in 1202, so the TYT total cannot be compared; a subject can.
   assert.equal(await page.locator('[data-tg-mod="artis"]').getAttribute('aria-pressed'),'true');
   assert.match(await cumle(),/^27-YKS-1201 → 27-YKS-1202 · Kolej listesi · Sentetik Kartal Anadolu Lisesi: TYT toplam iki denemede de hesaplanamıyor\./);
   await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="net"] svg'));
   assert.match(await cumle(),/· Türkçe: Türkiye’ye göre [+−]\d+,\d\d net \(okul \d+,\d\d → \d+,\d\d, [▲▼]\d+,\d\d; Türkiye ortalaması [▲▼]\d+,\d\d\)\. Artış sırası \d+\. \/ \d+ kurum\./);
   assert.match(await page.locator('#tgArtisSira').innerText(),/Artış sıralaması · Türkçe[\s\S]*Sentetik Kartal Anadolu Lisesi[\s\S]*kurum iki denemede de listede/);
   await page.locator('.tg-ders-geri [data-tg-ders=""]').click();
   // The rank view.
   await page.locator('[data-tg-mod="sira"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="sira"] svg'));
   assert.match(await cumle(),/^27-YKS-1202 \(14 Eki\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT: ilk 100’de 2 \/ 3 ders, ortalama sıra/);
   assert.equal(await page.locator('.et-ders[data-tg-ders]').count(),3);
   // A third exam moves the chart on: it becomes the şimdiki exam.
   await page.locator('#tgPdf').setInputFiles([dosya(ad(3))]);
   await page.waitForFunction(()=>/1203/.test(document.getElementById('tgDurum')?.textContent||''));
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="sira"] svg'));
   assert.match(await cumle(),/^27-YKS-1203 \(21 Eki\)/);assert.match(await cumle(),/ilk 100’de 3 \/ 3 ders/);
   assert.equal(await page.locator('#tgSimdi').inputValue(),'27-YKS-1203|kolej');
   // Artış reads the whole run by default (first exam → latest, with the steps between), without choosing Önceki.
   await page.locator('[data-tg-mod="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="toplam"] svg'));
   assert.match(await cumle(),/^27-YKS-1201 → 27-YKS-1203 \(3 deneme\) · /);
   assert.equal(await page.locator('#tgAdimlar tbody tr').count(),4);assert.match(await page.locator('#tgAdimlar').innerText(),/Toplam[\s\S]*Deneme başına ortalama/);
   await page.locator('[data-tg-mod="sira"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="sira"] svg'));
   // Hover reads the exam; the keyboard walks exams and lines; Enter opens the highlighted subject.
   const sira=page.locator('[data-tg-grafik="sira"]');await sira.scrollIntoViewIfNeeded();
   const kutu=await sira.boundingBox();
   await page.mouse.move(kutu.x+kutu.width*0.45,kutu.y+20);
   await page.waitForFunction(()=>!document.querySelector('[data-tg-grafik="sira"] .et-ipucu').hidden);
   assert.match(await sira.locator('.et-ipucu').innerText(),/27-YKS-1202 · 14 Eki[\s\S]*Ortalama sıra[\s\S]*İlk 100’de\s*2 \/ 3 ders[\s\S]*Fizik\s*İlk 100 dışı/);
   await sira.focus();await page.keyboard.press('Home');
   assert.match(await sira.locator('.et-ipucu').innerText(),/^27-YKS-1201 · 7 Eki/);
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.querySelector('[data-tg-grafik="sira"] svg').classList.contains('odakli')),true);
   assert.match(await sira.locator('.et-ipucu .dp-vurgu').innerText(),/Türkçe/);
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="net"] svg'));
   assert.match(await page.locator('#tgSiraPanel h2').innerText(),/Sıra · Türkçe \(TYT\)/);
   assert.equal(await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('.tg-cevre-panel').innerText(),/Sıralamada yakın · Türkçe · 27-YKS-1203[\s\S]*Türkiye ortalaması[\s\S]*1 net daha ile \d+\. sıra/);
   assert.equal(await page.locator('.tg-cevre-satir.tg-biz').count(),1);
   // A card switches the subject; the net chart reads outside the list.
   await page.locator('.et-ders[data-tg-ders="FİZİK-T"]').click();
   await page.waitForFunction(()=>/Fizik/.test(document.querySelector('#tgSiraPanel h2').textContent));
   const net=page.locator('[data-tg-grafik="net"]');await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="net"] svg'));
   await net.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
   assert.match(await net.locator('.et-ipucu').innerText(),/27-YKS-1202[\s\S]*Sentetik Kartal Anadolu Lisesi\s*İlk 100 dışı[\s\S]*Türkiye ortalaması[\s\S]*İlk 100 aralığı/);
   await page.screenshot({path:path.join(out,'turkiye-'+width+'-ders.png'),fullPage:true});
   await page.locator('#tgSiraPanel [data-tg-ders=""]').click();
   await page.waitForFunction(()=>!document.querySelector('[data-tg-grafik="net"]'));
   assert.match(await page.locator('#tgKok').innerText(),/Türkiye ortalamasına göre · 27-YKS-1203/);
   // A line under the pointer takes the stage; clicking it opens that subject (not on touch).
   if(width>600){
    await sira.scrollIntoViewIfNeeded();await page.waitForTimeout(700);
    const g=await page.evaluate(()=>{const k=document.querySelector('[data-tg-grafik="sira"]'),s=k.querySelector('svg'),r=s.getBoundingClientRect(),o=r.width/s.viewBox.baseVal.width,
      p=[...s.querySelectorAll('path[data-seri="0"]')][0].getPointAtLength(40);return {x:r.left+p.x*o,y:r.top+p.y*o}});
    await page.mouse.move(g.x,g.y);await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="sira"]').dataset.seri==='0');
    await page.mouse.click(g.x,g.y);await page.waitForFunction(()=>/Türkçe/.test(document.querySelector('#tgSiraPanel h2').textContent));
    await page.locator('#tgSiraPanel [data-tg-ders=""]').click();
   }
   // AYT and an earlier exam.
   await page.locator('[data-tg-oturum="AYT"]').click();
   await page.waitForFunction(()=>/AYT dersleri/.test(document.querySelector('#tgSiraPanel h2')?.textContent||''));
   assert.equal(await page.locator('.et-ders[data-tg-ders]').count(),2);
   await page.locator('[data-tg-oturum="TYT"]').click();
   // Önceki: compare 1203 with 1201 instead of 1202.
   await page.locator('#tgOnceki').selectOption('27-YKS-1201|kolej');
   await page.waitForFunction(()=>/27-YKS-1201 ile:/.test(document.querySelector('#tgKok .et-cumle').textContent));
   await page.locator('[data-tg-cizgi="yumusak"]').click();
   await page.waitForFunction(()=>/C/.test(document.querySelector('[data-tg-grafik="sira"] path.tg-ort')?.getAttribute('d')||''));
   await page.locator('[data-tg-cizgi="kose"]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   // Back to Artış: 1201 → 1203 has the TYT total; the chart reads it exam by exam.
   await page.locator('[data-tg-mod="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="toplam"] svg'));
   assert.match(await cumle(),/^27-YKS-1201 → 27-YKS-1203 \(3 deneme\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: Türkiye’ye göre toplam/);
   assert.equal(await page.locator('#tgArtisSira .tg-biz').count(),1);
   const top=page.locator('[data-tg-grafik="toplam"]');await top.focus();await page.keyboard.press('End');
   assert.match(await top.locator('.et-ipucu').innerText(),/^27-YKS-1203 · 21 Eki[\s\S]*Sentetik Kartal Anadolu Lisesi[\s\S]*Türkiye ortalaması[\s\S]*Türkiye’ye göre/);
   assert.equal(await page.locator('.tg-fark-satir').count(),3);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling in Artış');
   await page.screenshot({path:path.join(out,'turkiye-'+width+'.png'),fullPage:true});
   // Deleting one list; the others stay.
   await page.locator('[data-tg-sil="27-YKS-1202|kolej"]').click();
   await page.waitForFunction(()=>/Liste silindi/.test(document.getElementById('tgDurum')?.textContent||''));
   assert.deepEqual(await page.evaluate(()=>D.turkiye.sinavlar.map(s=>s.ad)),['27-YKS-1201','27-YKS-1203']);
   await page.locator('#tgSilHepsi').click();
   await page.waitForFunction(()=>/Henüz liste yok/.test(document.getElementById('tgKok').textContent));
   assert.equal(await page.evaluate(()=>D.turkiye),undefined);
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Türkiye geneli at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
