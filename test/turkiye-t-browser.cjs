// Türkiye geneli, T ve sıra (the default view) on desktop and phone, in light and dark: the T chart with its 50 line,
// the place chart (real places filled, estimates hollow, 1 at the top), the subject cards and charts, the tooltips
// ("≈" and "N ≈ … okul"), and switching to Artış and Sıra and back. Synthetic data only: every subject is drawn from a
// Normal(Türkiye average, 9 % of the questions) over 180 schools (test/fixtures/kurum-pdf.cjs); Sıralamalar' school
// average is stubbed for the subjects the followed school is outside of.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {kurumListesi,kurumRaporu,BIZ,BIZIM}=require('./fixtures/kurum-pdf.cjs');
// The followed school's nets: Türkçe rises, Fizik stays the same distance above the average (in the list: its place and T do not move),
// Matematik is outside the list (Sıralamalar' average, falling).
BIZIM['TÜRKÇE-T']=[22,23,26];BIZIM['FİZİK-T']=[4.53,4.63,4.73];
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
    window.__mat1=true;SIRALAMA.model=s=>{const e=Number(s.ad.slice(-1));return {sinif:12,tyt:{kurum:{net:window.__mat1===false&&e===1?{}:{MAT:[13,12,10][e-1]}}},ayt:{kurum:{net:{}}}}};
    denemePdfSayfalari=async f=>{if(!r[f.name])throw new Error('bilinmeyen dosya');return {pages:structuredClone(r[f.name])}};ciz();
   },[raporlar,BIZ]);
   await page.evaluate(()=>{EK.sekme='turkiye';ciz()});
   await page.locator('#tgPdf').setInputFiles([dosya(ad(1)),dosya(ad(2)),dosya(ad(3))]);
   await page.waitForFunction(()=>/Eklendi/.test(document.getElementById('tgDurum')?.textContent||''));
   await page.locator('#tgOkul').selectOption(BIZ);
   // The default view: T ve sıra. The main chart is the chosen total alone (one bold line); below it "Dersler · TYT toplam" has a line per
   // subject; the toggle (T puanı | Sıra | Artış sırası) drives both; the cards follow, then the ranking and the table.
   const ana=()=>page.evaluate(()=>{const k=document.querySelector('#tgTPanel [data-tg-grafik]');return {tur:k.dataset.tgGrafik,seri:k.querySelectorAll('svg path[data-seri]').length,kalin:k.querySelectorAll('svg path.tg-ort').length,d:[...k.querySelectorAll('svg path.et-cizgi')].map(e=>e.getAttribute('d')).join('|'),svg:k.querySelector('svg').innerHTML}});
   const dersGraf=()=>page.evaluate(()=>{const k=document.querySelector('#tgDPanel [data-tg-grafik]');return {tur:k.dataset.tgGrafik,ders:new Set([...k.querySelectorAll('svg path[data-seri]')].map(e=>e.dataset.seri)).size,yollar:k.querySelectorAll('svg path.et-cizgi').length,kalin:k.querySelectorAll('svg path.tg-ort').length,soluk:k.querySelectorAll('svg path.tg-cok').length,svg:k.querySelector('svg').innerHTML}});
   const kok=page.locator('#tgKok');
   await page.waitForFunction(()=>document.querySelector('#tgTPanel [data-tg-grafik="t"] svg')&&document.querySelector('#tgDPanel [data-tg-grafik="dt"] svg'));
   assert.equal(await page.locator('[data-tg-mod="tpuan"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-tg-gor="t"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-tg-grafik]').count(),2,'the main chart and the Dersler chart');
   assert.match(await page.locator('#tgTPanel h2').innerText(),/^T puanı · TYT toplam$/i);assert.match(await page.locator('#tgDersler').innerText(),/^Dersler · TYT toplam$/i);assert.match(await page.locator('#tgDPanel h2').innerText(),/^T puanı · dersler$/i);
   assert.equal(await page.evaluate(()=>{const q=s=>document.querySelector(s),o=(a,b)=>!!(q(a).compareDocumentPosition(q(b))&Node.DOCUMENT_POSITION_FOLLOWING);return o('#tgTPanel','#tgDersler')&&o('#tgDersler','#tgDPanel')&&o('#tgDPanel','.et-dersler')&&o('.et-dersler','#tgArtisSira')&&o('#tgArtisSira','#tgOkullar')}),true,'order: main chart, Dersler chart, cards, ranking, table');
   assert.match(await page.locator('#tgKpi').innerText(),/T puanı değişimi[\s\S]*Artış sırası/);assert.match(await page.locator('#tgKpi').innerText(),/Ortalamanın üstünde[\s\S]*Okul sayısı/);
   assert.equal(await page.locator('.et-ders[data-tg-ders]').count(),3);
   assert.match(await page.locator('#tgKok .et-cumle').innerText(),/^27-YKS-1203 \(21 Eki\) · Kolej listesi · Sentetik Kartal Anadolu Lisesi · TYT toplam: T puanı \d+,\d/);
   let A=await ana(),Dg=await dersGraf();
   assert.equal(A.seri,0,'the main chart has no subject lines');assert(A.kalin>=1,'the total is the bold line');assert.match(A.svg,/Türkiye ortalaması \(okullar\)/);
   assert.equal(Dg.ders,3,'a line per subject');assert.equal(Dg.kalin,0);assert.equal(Dg.soluk,0,'subjects are drawn at normal weight, not faded');assert.match(Dg.svg,/Türkiye ortalaması \(okullar\)/);
   // Hover on the main chart: the total's figures only. Hover on a subject's line in the Dersler chart: that line takes the stage, the tooltip lists every subject.
   const t=page.locator('#tgTPanel [data-tg-grafik]');await t.scrollIntoViewIfNeeded();
   const tb=await t.boundingBox();await page.mouse.move(tb.x+tb.width*0.5,tb.y+tb.height*0.5);await page.waitForFunction(()=>!document.querySelector('#tgTPanel .et-ipucu').hidden);
   const ip0=await t.locator('.et-ipucu').innerText();assert.match(ip0,/TYT toplam · T puanı \(okullar arası\)\s*\d+,\d/);assert.match(ip0,/Okullar arası σ\s*\d+,\d\d net/);assert.match(ip0,/N\s*≈ \d+ okul \(derslerde \d+–\d+\)/);assert(!/Matematik/.test(ip0),'no subject rows in the main tooltip');
   const d=page.locator('#tgDPanel [data-tg-grafik]');await d.scrollIntoViewIfNeeded();
   const g=await page.evaluate(()=>{const k=document.querySelector('#tgDPanel [data-tg-grafik]'),sv=k.querySelector('svg'),r=sv.getBoundingClientRect(),o=r.width/sv.viewBox.baseVal.width,p=[...sv.querySelectorAll('path[data-seri="0"]')][0].getPointAtLength(30);return {x:r.left+p.x*o,y:r.top+p.y*o}});
   await page.mouse.move(g.x,g.y);await page.waitForFunction(()=>!document.querySelector('#tgDPanel .et-ipucu').hidden);
   if(width>600){await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik]').dataset.seri==='0');assert.equal(await page.evaluate(()=>document.querySelector('#tgDPanel svg').classList.contains('odakli')),true)}
   const ip=await d.locator('.et-ipucu').innerText();{const v=[...ip.matchAll(/(Türkçe|Fizik|Matematik)\s*(\d+,\d)/g)].map(m=>Number(m[2].replace(',','.')));assert.equal(v.length,3);assert.deepEqual(v,v.slice().sort((x,y)=>y-x),'every subject, sorted by T');}
   assert.equal((await page.locator('#tgKok .et-ozet,#tgKok .et-cumle,#tgTPanel .et-kart-bas,#tgDPanel .et-kart-bas').allInnerTexts()).join(' ').includes('N ≈'),false,'N ≈ only in the tooltips');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   await page.screenshot({path:path.join(out,'turkiye-t-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   // Isolating a subject (its card) changes the Dersler chart only; the main chart keeps the total.
   const anaOnce=(await ana()).d;
   await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').click();
   await page.waitForFunction(()=>/T puanı · Türkçe/.test(document.querySelector('#tgDPanel h2')?.textContent||'')&&document.querySelector('#tgDPanel [data-tg-grafik] svg'));
   assert.equal((await dersGraf()).ders,0,'one line only');assert.equal(await page.locator('#tgDPanel svg .tg-genel').count(),1,'with the 50 line');assert.equal(await page.locator('#tgDPanel [data-tg-ders=""]').count(),1);
   assert.match(await page.locator('#tgTPanel h2').innerText(),/^T puanı · TYT toplam$/i);assert.equal((await ana()).d,anaOnce,'the main chart is untouched');
   assert.equal(await page.locator('.et-ders[data-tg-ders="TÜRKÇE-T"]').getAttribute('aria-pressed'),'true');
   // The toggle drives both charts; the subject stays isolated in the Dersler chart.
   await page.locator('[data-tg-gor="sira"]').click();
   await page.waitForFunction(()=>document.querySelector('#tgTPanel [data-tg-grafik="tsira"] svg')&&document.querySelector('#tgDPanel [data-tg-grafik="dtsira"] svg'));
   assert.match(await page.locator('#tgTPanel h2').innerText(),/^Sıra · TYT toplam$/i);assert.match(await page.locator('#tgDPanel h2').innerText(),/^Sıra · Türkçe$/i);
   await page.locator('#tgDPanel [data-tg-ders=""]').click();
   await page.waitForFunction(()=>/Sıra · dersler/.test(document.querySelector('#tgDPanel h2')?.textContent||'')&&document.querySelector('#tgDPanel [data-tg-grafik="dtsira"] svg'));
   A=await ana();Dg=await dersGraf();assert.equal(A.seri,0);assert(A.kalin>=1);assert.equal(Dg.ders,3);
   assert.equal(await page.locator('#tgTPanel [data-tg-grafik="tsira"] svg .tg-disi-nokta').count()>0,true,'the total place is an estimate: hollow markers');
   assert.equal(await page.locator('#tgDPanel [data-tg-grafik="dtsira"] svg .tg-disi-nokta').count()>0,true,'estimated places of a subject outside its list: hollow markers');
   const s=page.locator('#tgTPanel [data-tg-grafik="tsira"]');await s.focus();await page.keyboard.press('End');
   assert.match(await s.locator('.et-ipucu').innerText(),/^27-YKS-1203[\s\S]*tahmini sıra\s*≈ \d+\.[\s\S]*N\s*≈ \d+ okul/);
   await page.screenshot({path:path.join(out,'turkiye-t-sira-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('.et-ders[data-tg-ders="MATEMATİK-T"]').click();
   await page.waitForFunction(()=>/Sıra · Matematik/.test(document.querySelector('#tgDPanel h2')?.textContent||'')&&document.querySelector('#tgDPanel [data-tg-grafik="dtsira"] .tg-disi-nokta'));
   const s2=page.locator('#tgDPanel [data-tg-grafik="dtsira"]');await s2.focus();await page.keyboard.press('Home');
   assert.match(await s2.locator('.et-ipucu').innerText(),/Matematik · tahmini sıra\s*≈ \d+\./);
   await page.locator('[data-tg-gor="artis"]').click();
   await page.waitForFunction(()=>document.querySelector('#tgTPanel [data-tg-grafik="tartis"] svg')&&document.querySelector('#tgDPanel [data-tg-grafik="dtartis"] svg'));
   assert.match(await page.locator('#tgTPanel h2').innerText(),/^Artış sırası · TYT toplam$/i);assert.match(await page.locator('#tgDPanel h2').innerText(),/^Artış sırası · Matematik$/i);
   assert.match(await page.locator('#tgTPanel [data-tg-grafik="tartis"] svg').innerHTML(),/→1202/);
   const a=page.locator('#tgTPanel [data-tg-grafik="tartis"]');await a.focus();await page.keyboard.press('Home');
   assert.match(await a.locator('.et-ipucu').innerText(),/artış sırası\s*(≈ )?\d+\.[\s\S]*ΔT\s*[+−]\d+,\d T/);
   await page.screenshot({path:path.join(out,'turkiye-t-ders-'+width+(tema==='dark'?'-dark':'')+'.png'),fullPage:true});
   await page.locator('#tgDPanel [data-tg-ders=""]').click();
   await page.waitForFunction(()=>/Artış sırası · dersler/.test(document.querySelector('#tgDPanel h2')?.textContent||'')&&document.querySelector('#tgDPanel [data-tg-grafik="dtartis"] svg'));
   assert.equal((await dersGraf()).ders,3);
   await page.locator('[data-tg-gor="t"]').click();await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik="dt"] svg'));
   // Click a line of the Dersler chart (desktop): that subject only.
   if(width>600){
    await page.locator('#tgDPanel [data-tg-grafik]').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
    const gg=await page.evaluate(()=>{const sv=document.querySelector('#tgDPanel [data-tg-grafik] svg'),r=sv.getBoundingClientRect(),o=r.width/sv.viewBox.baseVal.width,p=[...sv.querySelectorAll('path[data-seri="0"]')][0].getPointAtLength(30);return {x:r.left+p.x*o,y:r.top+p.y*o}});
    await page.mouse.move(gg.x,gg.y);await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik]').dataset.seri==='0');
    await page.mouse.click(gg.x,gg.y);await page.waitForFunction(()=>/T puanı · Türkçe/.test(document.querySelector('#tgDPanel h2')?.textContent||''));
    assert.match(await page.locator('#tgTPanel h2').innerText(),/TYT toplam/);
    await page.locator('#tgDPanel [data-tg-ders=""]').click();await page.waitForFunction(()=>/T puanı · dersler/.test(document.querySelector('#tgDPanel h2')?.textContent||''));
   }
   // What each card says about the range, per toggle mode: improving (green ▲ +), worsening (red ▼ −), unchanged (grey), and "—" when an end is missing.
   const kart=k=>page.evaluate(k=>{const e=document.querySelector('.et-ders[data-tg-ders="'+k+'"] .tg-degisim');const h=e.querySelector('.et-hap');return {sinif:[...h.classList].find(c=>['yukari','asagi','esit'].includes(c)),yok:h.classList.contains('tg-yok'),yazi:h.textContent.replace(/\s+/g,' ').trim(),ipucu:e.title,renk:getComputedStyle(h).color}},k);
   let k1=await kart('TÜRKÇE-T'),k2=await kart('MATEMATİK-T'),k3=await kart('FİZİK-T');
   assert.equal(k1.sinif,'yukari');assert.match(k1.yazi,/^▲ ?\+\d+,\d T$/);assert.equal(k2.sinif,'asagi');assert.match(k2.yazi,/^▼ ?−\d+,\d T$/);assert.equal(k3.sinif,'esit');assert.match(k3.yazi,/^[+−]?0,\d T$/);
   assert.notEqual(k1.renk,k2.renk);assert.notEqual(k1.renk,k3.renk);assert.notEqual(k2.renk,k3.renk);
   await page.locator('[data-tg-gor="sira"]').click();await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik="dtsira"] svg'));
   k1=await kart('TÜRKÇE-T');k2=await kart('MATEMATİK-T');k3=await kart('FİZİK-T');
   assert.equal(k1.sinif,'yukari');assert.match(k1.yazi,/^▲ ?\d+ sıra$/);assert.equal(k2.sinif,'asagi');assert.match(k2.yazi,/^▼ ?≈ \d+ sıra$/);assert.match(k2.ipucu,/≈/);assert.equal(k3.sinif,'esit');assert.match(k3.yazi,/^0 sıra$/);
   await page.locator('[data-tg-gor="artis"]').click();await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik="dtartis"] svg'));
   for(const kod of ['TÜRKÇE-T','MATEMATİK-T','FİZİK-T']){const k=await kart(kod),m=/Artış (≈ )?(\d+)\. \/ (\d+)$/.exec(k.yazi);assert(m,kod+' '+k.yazi);const r=Number(m[2]),n=Number(m[3]);
    assert.equal(k.sinif,r<=n/3?'yukari':r>2*n/3?'asagi':'esit',kod+' by position');assert.match(k.ipucu,/ilk üçte biri yeşil, son üçte biri kırmızı/)}
   assert.equal((await kart('TÜRKÇE-T')).sinif,'yukari');assert.equal((await kart('MATEMATİK-T')).sinif,'asagi');
   // The total's change in the KPI tile uses the same rule.
   const kpi=await page.evaluate(()=>{const h=document.querySelector('#tgKpi .dp-kpi-ana .et-hap');return {sinif:[...h.classList].find(c=>['yukari','asagi','esit'].includes(c)),yazi:h.textContent.replace(/\s+/g,' ').trim()}});
   const kv=Number(kpi.yazi.replace(/[▲▼ T]/g,'').replace('−','-').replace('+','').replace(',','.'));assert.equal(kpi.sinif,Math.abs(kv)<=0.5?'esit':kv>0?'yukari':'asagi');
   // A subject without a value at the start of the range: "—", grey, in every mode.
   await page.evaluate(()=>{window.__mat1=false});await page.locator('[data-tg-aralik="1"]').click();await page.locator('[data-tg-aralik="tum"]').click();
   await page.waitForFunction(()=>/27-YKS-1201 → 27-YKS-1203/.test(document.querySelector('#tgKpi')?.textContent||''));
   for(const mod of ['t','sira','artis']){await page.locator('[data-tg-gor="'+mod+'"]').click();await page.waitForFunction(m=>document.querySelector('#tgDPanel [data-tg-grafik="d'+m+'"] svg, #tgDPanel [data-tg-grafik="d'+(m==='t'?'t':m==='sira'?'tsira':'tartis')+'"] svg'),mod);
    const k=await kart('MATEMATİK-T');assert.equal(k.yok,true,mod);assert.equal(k.yazi,'—');assert.equal(k.sinif,'esit');assert(!/▲|▼/.test(k.yazi))}
   await page.evaluate(()=>{window.__mat1=true});await page.locator('[data-tg-aralik="1"]').click();await page.locator('[data-tg-aralik="tum"]').click();
   await page.locator('[data-tg-gor="t"]').click();await page.waitForFunction(()=>document.querySelector('#tgDPanel [data-tg-grafik="dt"] svg'));
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
