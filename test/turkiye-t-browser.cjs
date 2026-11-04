// Türkiye geneli, T ve sıra (the default view) on desktop and phone, in light and dark: the T chart with its 50 line,
// the place chart (real places filled, estimates hollow, 1 at the top), the subject cards and charts, the tooltips
// ("≈" and "N ≈ … okul"), and switching to Artış and Sıra and back. Synthetic data only: every subject is drawn from a
// Normal(Türkiye average, 9 % of the questions) over 180 schools (test/fixtures/kurum-pdf.cjs); Sıralamalar' school
// average is stubbed for the subjects the followed school is outside of.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {kurumListesi,kurumRaporu,BIZ}=require('./fixtures/kurum-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-turkiye-t-'));fs.mkdirSync(out,{recursive:true});
const dosya=ad=>({name:ad,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
const ad=e=>'27-YKS-120'+e+' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[1280,'dark'],[390,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-28T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   const raporlar=Object.fromEntries([1,2,3].map(e=>[ad(e),kurumRaporu(kurumListesi(e,{normal:{N:180,oran:0.09}})).pages]));
   await page.evaluate(([r,biz])=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-28';
    D.ogr=[{ad:'Sentetik Ada',no:1001,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'synthetic-1'}];
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    // Sıralamalar: the school's own average in the subjects it is outside of (Matematik, Fizik), a different figure per exam.
    SIRALAMA.oku=()=>({veri:{sinavlar:[1,2,3].map(e=>({ad:'27-YKS-120'+e,okul:'ÖZEL '+biz,T:{tarih:'0'+(e*7)+'.10.2026'}}))}});
    SIRALAMA.model=s=>{const e=Number(s.ad.slice(-1));return {sinif:12,tyt:{kurum:{net:{MAT:11.6+e*0.9,FİZ:2.2+e*0.5,TÜR:25}}},ayt:{kurum:{net:{}}}}};
    denemePdfSayfalari=async f=>{if(!r[f.name])throw new Error('bilinmeyen dosya');return {pages:structuredClone(r[f.name])}};ciz();
   },[raporlar,BIZ]);
   await page.evaluate(()=>{EK.sekme='turkiye';ciz()});
   await page.locator('#tgPdf').setInputFiles([dosya(ad(1)),dosya(ad(2)),dosya(ad(3))]);
   await page.waitForFunction(()=>/Eklendi/.test(document.getElementById('tgDurum')?.textContent||''));
   await page.locator('#tgOkul').selectOption(BIZ);
   // The default view: T ve sıra, the T chart and the place chart side by side (stacked on a phone).
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"] svg')&&document.querySelector('[data-tg-grafik="tsira"] svg'));
   assert.equal(await page.locator('[data-tg-mod="tpuan"]').getAttribute('aria-pressed'),'true');
   const kok=page.locator('#tgKok');
   assert.match(await kok.innerText(),/T puanı · TYT toplam/i);assert.match(await kok.innerText(),/Tahmini sıra · TYT toplam/i);
   assert.match(await page.locator('[data-tg-grafik="t"] svg').innerHTML(),/Türkiye ortalaması \(okullar\)/);
   assert.equal(await page.locator('.et-ders[data-tg-ders]').count(),3);
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/^27-YKS-1203 \(21 Eki\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: T puanı \d+,\d/);
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/ · tahmini sıra ≈ \d+\. · okullar ortalamasının üstünde\.$/);
   // Hover: T, σ and N ("≈", "okul") only in the tooltip.
   const t=page.locator('[data-tg-grafik="t"]');await t.scrollIntoViewIfNeeded();
   const kutu=await t.boundingBox();await page.mouse.move(kutu.x+kutu.width*0.8,kutu.y+kutu.height*0.4);
   await page.waitForFunction(()=>!document.querySelector('[data-tg-grafik="t"] .et-ipucu').hidden);
   const ip=await t.locator('.et-ipucu').innerText();
   assert.match(ip,/T puanı \(okullar arası\)\s*\d+,\d/);assert.match(ip,/Okullar arası σ\s*\d+,\d\d net/);assert.match(ip,/N\s*≈ \d+ okul \(derslerde \d+–\d+\)/);
   assert.equal((await kok.innerText()).includes('N ≈'),false,'N is not in the page text, only in the tooltip');
   const s=page.locator('[data-tg-grafik="tsira"]');await s.focus();await page.keyboard.press('End');
   assert.match(await s.locator('.et-ipucu').innerText(),/^27-YKS-1203[\s\S]*tahmini sıra\s*≈ \d+\.[\s\S]*N\s*≈ \d+ okul/);
   assert.equal(await page.locator('[data-tg-grafik="tsira"] svg .tg-disi-nokta').count()>0,true,'estimates are hollow markers');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   await page.screenshot({path:path.join(out,'turkiye-t-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   // A subject: Türkçe is in the list in every exam (real places, no hollow markers); Matematik is outside it (estimates).
   await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').click();
   await page.waitForFunction(()=>/Sıra · Türkçe/.test(document.querySelector('#tgTSiraPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="tsira"] svg'));
   assert.match(await page.locator('#tgTPanel h2').innerText(),/T puanı · Türkçe/i);
   assert.equal(await page.locator('[data-tg-grafik="tsira"] svg .tg-disi-nokta').count(),0);
   await page.locator('.et-ders[data-tg-ders="MATEMATİK-T"]').click();
   await page.waitForFunction(()=>/Sıra · Matematik/.test(document.querySelector('#tgTSiraPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="tsira"] .tg-disi-nokta'));
   const s2=page.locator('[data-tg-grafik="tsira"]');await s2.focus();await page.keyboard.press('Home');
   assert.match(await s2.locator('.et-ipucu').innerText(),/Matematik · tahmini sıra\s*≈ \d+\./);
   await page.screenshot({path:path.join(out,'turkiye-t-ders-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('.tg-ders-geri [data-tg-ders=""]').click();
   await page.waitForFunction(()=>/TYT toplam/.test(document.querySelector('#tgTPanel h2')?.textContent||''));
   // Artış and Sıra still work.
   await page.locator('[data-tg-mod="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="toplam"] svg')&&!document.querySelector('[data-tg-grafik="t"]'));
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/^27-YKS-1201 → 27-YKS-1203 \(3 deneme\)/);
   await page.locator('[data-tg-mod="sira"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="sira"] svg'));
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/^27-YKS-1203 \(21 Eki\) · Kolej listesi/);
   await page.locator('[data-tg-mod="tpuan"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"] svg'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling after switching');
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Türkiye geneli T ve sıra at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
