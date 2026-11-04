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
   const raporlar=Object.fromEntries([1,2,3].map(e=>{const L=kurumListesi(e,{normal:{N:180,oran:0.09}});if(e===3)for(const d of L.dersler)d.satir[99][0]='SENTETİK DEĞİŞEN OKUL';return [ad(e),kurumRaporu(L).pages]}));
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
   // The default view: T ve sıra, one full-width chart (the toggle picks T puanı / Sıra / Artış sırası), the KPI strip, the cards and the table.
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"] svg'));
   assert.equal(await page.locator('[data-tg-mod="tpuan"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-tg-gor="t"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-tg-grafik]').count(),1,'one chart at a time');
   const kok=page.locator('#tgKok');
   assert.match(await kok.innerText(),/T puanı · TYT toplam ve dersler/i);
   assert.match(await page.locator('#tgKpi').innerText(),/T puanı değişimi[\s\S]*Artış sırası/);assert.match(await page.locator('#tgKpi').innerText(),/Ortalamanın üstünde[\s\S]*Okul sayısı/);
   assert.equal(await page.locator('.et-ders[data-tg-ders]').count(),3);
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/^27-YKS-1203 \(21 Eki\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: T puanı \d+,\d/);
   // All lines in one chart: a thin line per subject plus the bold total, with the 50 line and its label.
   const cizgiler=()=>page.evaluate(()=>({ince:document.querySelectorAll('[data-tg-grafik] svg path.tg-cok').length,kalin:document.querySelectorAll('[data-tg-grafik] svg path.tg-ort').length,ders:new Set([...document.querySelectorAll('[data-tg-grafik] svg path[data-seri]')].map(e=>e.dataset.seri)).size}));
   let c=await cizgiler();assert.equal(c.ders,3,'a line per subject');assert(c.ince>=3);assert(c.kalin>=1,'the total is the bold line');
   assert.match(await page.locator('[data-tg-grafik="t"] svg').innerHTML(),/Türkiye ortalaması \(okullar\)/);
   // Hover: the line under the pointer takes the stage and the tooltip lists the total and every subject (sorted).
   const t=page.locator('[data-tg-grafik="t"]');await t.scrollIntoViewIfNeeded();
   const g=await page.evaluate(()=>{const k=document.querySelector('[data-tg-grafik="t"]'),sv=k.querySelector('svg'),r=sv.getBoundingClientRect(),o=r.width/sv.viewBox.baseVal.width,
     p=[...sv.querySelectorAll('path[data-seri="0"]')][0].getPointAtLength(30);return {x:r.left+p.x*o,y:r.top+p.y*o}});
   await page.mouse.move(g.x,g.y);await page.waitForFunction(()=>!document.querySelector('[data-tg-grafik="t"] .et-ipucu').hidden);
   if(width>600){await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"]').dataset.seri==='0');assert.equal(await page.evaluate(()=>document.querySelector('[data-tg-grafik="t"] svg').classList.contains('odakli')),true)}
   const ip=await t.locator('.et-ipucu').innerText();
   assert.match(ip,/TYT toplam · T puanı \(okullar arası\)\s*\d+,\d/);assert.match(ip,/Okullar arası σ\s*\d+,\d\d net/);assert.match(ip,/N\s*≈ \d+ okul \(derslerde \d+–\d+\)/);assert.match(ip,/Türkçe\s*\d+,\d[\s\S]*Matematik\s*\d+,\d/);
   assert.equal((await page.locator('#tgKok .et-ozet,#tgKok .et-cumle,#tgTPanel .et-kart-bas').allInnerTexts()).join(' ').includes('N ≈'),false,'N ≈ only in the tooltip');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   await page.screenshot({path:path.join(out,'turkiye-t-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   // Sıra: the places of every subject, estimates hollow; Artış sırası: x is the transition.
   await page.locator('[data-tg-gor="sira"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="tsira"] svg'));
   assert.equal(await page.locator('[data-tg-grafik]').count(),1);assert.match(await kok.innerText(),/Sıra · TYT toplam ve dersler/i);
   assert.equal(await page.locator('[data-tg-grafik="tsira"] svg .tg-disi-nokta').count()>0,true,'estimates are hollow markers');
   c=await cizgiler();assert.equal(c.ders,3);assert(c.kalin>=1);
   const s=page.locator('[data-tg-grafik="tsira"]');await s.focus();await page.keyboard.press('End');
   assert.match(await s.locator('.et-ipucu').innerText(),/^27-YKS-1203[\s\S]*tahmini sıra\s*≈ \d+\.[\s\S]*N\s*≈ \d+ okul/);
   await page.screenshot({path:path.join(out,'turkiye-t-sira-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('[data-tg-gor="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="tartis"] svg'));
   assert.match(await kok.innerText(),/Artış sırası · TYT toplam ve dersler/i);
   assert.match(await page.locator('[data-tg-grafik="tartis"] svg').innerHTML(),/1201→1202|→1202/);
   c=await cizgiler();assert.equal(c.ders,3);
   const a=page.locator('[data-tg-grafik="tartis"]');await a.focus();await page.keyboard.press('Home');
   assert.match(await a.locator('.et-ipucu').innerText(),/artış sırası\s*(≈ )?\d+\.[\s\S]*ΔT\s*[+−]\d+,\d T/);
   await page.screenshot({path:path.join(out,'turkiye-t-artis-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('[data-tg-gor="t"]').click();await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"] svg'));
   // A subject: its own line alone; clicking its card again (or Tüm dersler) goes back to all lines.
   await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').click();
   await page.waitForFunction(()=>/T puanı · Türkçe/.test(document.querySelector('#tgTPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="t"] svg'));
   assert.equal((await cizgiler()).ders,0,'one line only');assert.equal(await page.locator('[data-tg-grafik="t"] svg .tg-genel').count(),1,'with the 50 line');
   await page.locator('[data-tg-gor="sira"]').click();await page.waitForFunction(()=>/Sıra · Türkçe/.test(document.querySelector('#tgTPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="tsira"] svg'));
   await page.locator('.et-ders[data-tg-ders="MATEMATİK-T"]').click();
   await page.waitForFunction(()=>/Sıra · Matematik/.test(document.querySelector('#tgTPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="tsira"] .tg-disi-nokta'));
   const s2=page.locator('[data-tg-grafik="tsira"]');await s2.focus();await page.keyboard.press('Home');
   assert.match(await s2.locator('.et-ipucu').innerText(),/Matematik · tahmini sıra\s*≈ \d+\./);
   await page.locator('[data-tg-gor="artis"]').click();await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="tartis"] svg'));
   await page.screenshot({path:path.join(out,'turkiye-t-ders-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('.tg-ders-geri [data-tg-ders=""]').click();
   await page.waitForFunction(()=>/TYT toplam/.test(document.querySelector('#tgTPanel h2')?.textContent||'')&&document.querySelector('[data-tg-grafik="tartis"] svg'));
   assert.equal((await cizgiler()).ders,3);
   await page.locator('[data-tg-gor="t"]').click();await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"] svg'));
   // Click a line (desktop): that subject.
   if(width>600){
    const gg=await page.evaluate(()=>{const sv=document.querySelector('[data-tg-grafik="t"] svg'),r=sv.getBoundingClientRect(),o=r.width/sv.viewBox.baseVal.width,p=[...sv.querySelectorAll('path[data-seri="0"]')][0].getPointAtLength(30);return {x:r.left+p.x*o,y:r.top+p.y*o}});
    await page.mouse.move(gg.x,gg.y);await page.waitForFunction(()=>document.querySelector('[data-tg-grafik="t"]').dataset.seri==='0');
    await page.mouse.click(gg.x,gg.y);await page.waitForFunction(()=>/T puanı · Türkçe/.test(document.querySelector('#tgTPanel h2')?.textContent||''));
    await page.locator('.tg-ders-geri [data-tg-ders=""]').click();await page.waitForFunction(()=>/TYT toplam/.test(document.querySelector('#tgTPanel h2')?.textContent||''));
   }
   // Karşılaştır: the range chips drive first → latest; Seç shows the two exam pickers.
   await page.locator('[data-tg-aralik="1"]').click();await page.waitForFunction(()=>/27-YKS-1202 → 27-YKS-1203/.test(document.querySelector('#tgKpi')?.textContent||''));
   await page.locator('[data-tg-aralik="sec"]').click();await page.waitForFunction(()=>document.getElementById('tgOnceki')&&document.getElementById('tgSimdi'));
   await page.locator('[data-tg-aralik="tum"]').click();await page.waitForFunction(()=>/27-YKS-1201 → 27-YKS-1203/.test(document.querySelector('#tgKpi')?.textContent||'')&&!document.getElementById('tgOnceki'));
   // The schools table: sorted by ΔT, the followed school pinned and marked, sortable, the jump scrolls to it, rows missing an exam show "—".
   const tablo=page.locator('#tgOkullar');await tablo.scrollIntoViewIfNeeded();
   const farklar=await page.locator('#tgOkullar tbody tr td:nth-child(4)').allInnerTexts();
   const sayilar=farklar.filter(v=>v.trim()!=='—').map(v=>Number(v.replace('−','-').replace('+','').replace(',','.')));
   assert(sayilar.length>50);assert.deepEqual(sayilar,sayilar.slice().sort((x,y)=>y-x),'sorted by ΔT, largest first');
   assert.equal(await page.locator('#tgOkullar tfoot tr.tg-pin').count(),1);assert.equal(await page.locator('#tgOkullar tbody tr.tg-biz').count(),1);
   assert.equal(await page.evaluate(()=>{const kutu=document.querySelector('#tgOkullar .tg-okul-kutu'),pin=document.querySelector('#tgOkullar tfoot tr.tg-pin td').getBoundingClientRect(),kr=kutu.getBoundingClientRect();return pin.top>=kr.top-1&&pin.bottom<=kr.bottom+1}),true,'the pinned row is inside the table box');
   await page.locator('#tgOkullar [data-tg-sira="ad"]').click();
   await page.waitForFunction(()=>document.querySelector('#tgOkullar thead th[aria-sort="ascending"] [data-tg-sira="ad"]'));
   const adlar=await page.locator('#tgOkullar tbody tr td:nth-child(1)').allInnerTexts(),duz=adlar.map(v=>v.replace(/\s*· bizim okul/,'').trim());
   assert.deepEqual(duz,duz.slice().sort((x,y)=>x.localeCompare(y,'tr')),'sorted by name');
   await page.locator('#tgOkullar [data-tg-sira="ad"]').click();await page.waitForFunction(()=>document.querySelector('#tgOkullar thead th[aria-sort="descending"] [data-tg-sira="ad"]'));
   await page.locator('#tgOkullar [data-tg-sira="fark"]').click();await page.waitForFunction(()=>document.querySelector('#tgOkullar thead th[aria-sort="descending"] [data-tg-sira="fark"]'));
   await page.locator('#tgOkullar [data-tg-biz]').click();
   await page.waitForFunction(()=>document.querySelector('#tgBizSatir.tg-isik'));
   assert.equal(await page.evaluate(()=>{const r=document.getElementById('tgBizSatir').getBoundingClientRect(),k=document.querySelector('#tgOkullar .tg-okul-kutu').getBoundingClientRect();return r.bottom>k.top-1&&r.top<k.bottom+1}),true,'the jump brings the school into view');
   await page.screenshot({path:path.join(out,'turkiye-t-tablo-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   // Artış and Sıra (the old views) still work.
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
