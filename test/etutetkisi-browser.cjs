// Etüt etkisi on desktop and mobile: the page under Öğrenciler; the headline and the verdict, the "Etüt sonrası fark" chart (a bar per student), the collapsed
// "Ayrıntı: deneme aralarına göre" block with the "Etüt aldıkça artış" bars, and the
// school's Türkiye standing drawn at their real width (the standing named at its right end in "ilk %…" wording, the weekly etüts
// beneath), the teachers and students tables (every numeric header sits over its numbers), a teacher's filter, the Ders and Dönem
// controls, the students left out, the collapsed method block, the missing-list banner, and no sideways scrolling on a phone.
// Synthetic merged students only (the shape Öğrenci raporları gives the page; the merge has its own tests) and the synthetic
// Türkiye geneli lists of test/fixtures/kurum-pdf.cjs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {kurumListesi,kurumRaporu,BIZIM,BIZ}=require('./fixtures/kurum-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-etutetki-'));fs.mkdirSync(out,{recursive:true});
// Five exams a week apart. Grade 12: 30 students (1–8 no etüt, 9–16 one or two, 17–23 three to five, 24–27 six or more, 28–30 Fizik only),
// teacher A for most, B for some; each interval gains 0,4 net per etüt on top of a student's own pace (the Türkiye average of the list
// is added back, as a student's net is); plus one student with a single exam and one without Matematik nets. Grade 9: six students.
const DATES=['2026-10-07','2026-10-14','2026-10-21','2026-10-28','2026-11-04'];
const GUN=['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-15','2026-10-16','2026-10-19','2026-10-20','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-29','2026-10-30','2026-11-02','2026-11-03'];
const et=(c,t,n,k=0)=>Array.from({length:n},(_,j)=>({date:GUN[(j*3+k)%GUN.length],course:c,teacher:t,minutes:40,time:900}));
const ad=k=>'27-YKS-12'+String(k+1).padStart(2,'0');
const GENEL_MAT=[1,2,3,4,5].map(e=>30*.5+e*.1);   // the Türkiye average of MATEMATİK-T in the fixture lists
const mulberry=s=>{let a=s>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}};
const rnd=mulberry(11);
const ogrenciler=[];
for(let i=1;i<=30;i++){
  const n=i<=8?0:i<=16?1+i%2:i<=23?3+i%3:i<=27?6+i%2:0,taban=-3+(i*5)%9,hiz=((i*7)%5-2)*.15;
  const sessions=i>=28?et('FİZİK','SENTETİK ÖĞRETMEN F',2,i):[...et('MATEMATİK TYT',i%4===0?'SENTETİK ÖĞRETMEN B':'SENTETİK ÖĞRETMEN A',n,i),...(i>=20&&i%2?et('MATEMATİK TYT','SENTETİK ÖĞRETMEN B',1,i+5):[]),
    ...(i>=24&&i<=27?['2026-10-15','2026-10-16','2026-10-19','2026-10-20'].map(date=>({date,course:'MATEMATİK TYT',teacher:'SENTETİK ÖĞRETMEN A',minutes:40,time:900})):[])];   // 6+ etüt students: four in one week
  const d=[taban];
  for(let t=0;t<4;t++){const e=sessions.filter(s=>s.date>DATES[t]&&s.date<DATES[t+1]&&/MATEMATİK/.test(s.course)).length;d.push(d[t]+hiz+.4*e+(rnd()-.5)*1.2)}
  const mat=d.map((v,k)=>Math.round((v+GENEL_MAT[k])*100)/100);
  const exams=DATES.map((date,k)=>(i===5&&k===2)?null:{exam:ad(k),date,session:'TYT',nets:{mat:mat[k],fizik:6+k*.5}}).filter(Boolean);
  ogrenciler.push({id:'o'+i,name:'SENTETİK ÖĞRENCİ '+String(i).padStart(2,'0'),cls:'12/'+(i%2?'A':'B'),sessions,exams});
}
ogrenciler.push({id:'x1',name:'SENTETİK TEK DENEME',cls:'12/A',sessions:et('MATEMATİK TYT','SENTETİK ÖĞRETMEN A',1,2),exams:[{exam:ad(0),date:DATES[0],session:'TYT',nets:{mat:10}}]});
ogrenciler.push({id:'x2',name:'SENTETİK NETSİZ',cls:'12/B',sessions:[],exams:DATES.map((date,k)=>({exam:ad(k),date,session:'TYT',nets:{fizik:5}}))});
for(let i=1;i<=6;i++)ogrenciler.push({id:'k'+i,name:'SENTETİK KÜÇÜK '+i,cls:'9/A',sessions:et('MATEMATİK TYT','SENTETİK ÖĞRETMEN A',i%2,i),exams:DATES.map((date,k)=>({exam:'27-TYT-09'+String(k+1).padStart(2,'0'),date,session:'TYT',nets:{mat:5+k+i%3}}))});
// The synthetic Türkiye geneli lists of the five exams (the followed school gets two more nets for the exams the fixture stops at).
for(const k of Object.keys(BIZIM))while(BIZIM[k].length<5)BIZIM[k].push(BIZIM[k][BIZIM[k].length-1]+.3);
const listeler=[1,2,3,4,5].map(e=>{const L=kurumListesi(e);if(e===5)L.yazdirma='04.11.2026';return {file:ad(e-1)+' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf',pages:kurumRaporu(L).pages}});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-11-05T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(({s,l,biz})=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-05';D.ogr=[];EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    window.__ogr=s;OGRENCI_RAPOR.temelOgrenciler=()=>({students:structuredClone(window.__ogr),warnings:[],etutKapsam:[[gunNo('2026-10-01'),gunNo('2026-11-30')]]});
    window.__tr=l.map(x=>TURKIYE.pdfCoz(x.pages,x.file)).reduce((a,r)=>TURKIYE.birlestir(a,r),{okul:biz,sinavlar:[]});D.turkiye=TURKIYE.paketle(window.__tr,1);ciz();
   },{s:ogrenciler,l:listeler,biz:BIZ});
   // The page sits under Öğrenciler, after Etütler.
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="etutetki"]').count(),1);
   assert.deepEqual(await page.locator('#ray #ogrencilerMenusu [data-sekme]').evaluateAll(l=>l.map(x=>x.dataset.sekme)),['takip','etutler','etutetki','etutplani','yoklama','ogrencirapor','gunlukrapor']);
   await page.evaluate(()=>{EK.sekme='etutetki';ciz()});
   await page.waitForSelector('#eeKok #eeGrafik svg path.ee-cizgi');await page.waitForSelector('#eeFark svg rect.ee-fark');
   const cumle=()=>page.locator('#eeCumle').innerText();
   // The headline, the verdict and the counts, in everyday words.
   assert.match(await cumle(),/^12\. sınıf · Matematik · 5 deneme \(7 Eki – 4 Kas\)$/);
   assert.match(await page.locator('#eeOzet').innerText(),/^Etüt alan \d+ öğrenci, ilk etütten bu yana Türkiye farkında ortalama [+−]\d,\d net (arttı|azaldı); benzer başlangıçtaki etüt almayanlar (değişmedi|[+−]\d,\d net (arttı|azaldı))\. Fark: [+−]\d,\d net \(olası aralık [+−]\d,\d … [+−]\d,\d\)\.$/);
   const karar=await page.locator('#eeKarar').innerText();
   assert.match(karar,/^Etüt aldıktan sonra artış belirgin: etüt alanlar beklenenden ortalama \+\d,\d net fazla arttı\.$/,karar);
   assert.match(await page.locator('#eeSayim').innerText(),/^32 öğrenciden 19’u etüt alan, \d+’\w+ etüt almayan \(karşılaştırma için\) olarak sayıldı; 2’si dışarıda \(aşağıda listelenir\)\.$/);
   assert.equal(await page.locator('#eeSinir').innerText(),'Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.');
   assert.equal(await page.locator('#eeHamUyari, #eeListesiz').count(),0,'the lists exist for every exam');
   const yazi=await page.locator('#eeKok').innerText();
   assert(!/Gözlem|±|\bham\b|eğim|\(%95\)|Etüt yok|1–2 etüt|3–5 etüt|6\+ etüt|Etüt sayısına göre/i.test(yazi),'no tiers and no jargon');
   assert.equal(await page.locator('#eeKok .et-arac button, #eeKok .et-arac select').count()>=4,true);
   // The sections, in order; the method block is collapsed and says it in plain words.
   const sira=await page.evaluate(()=>['eeCumle','eeOzet','eeKarar','eeFark','eeGrafik','eeHocalar','eeOgrenciler','eeDisarida','eeAralik','eeNasil'].map(id=>document.getElementById(id).getBoundingClientRect().top+scrollY));
   assert.deepEqual([...sira].sort((a,b)=>a-b),sira,'sections in order: '+sira);
   assert.equal(await page.locator('#eeNasil').evaluate(d=>d.open),false);assert.equal(await page.locator('#eeAralik').evaluate(d=>d.open),false);
   // The main chart: a bar per student with etüts, drawn at the box's real width, the zero line and the mean named at the right.
   const f=await page.evaluate(()=>{
    const kutu=document.querySelector('#eeFark .et-grafik'),svg=kutu.querySelector('svg'),s=svg.getBoundingClientRect();
    const txt=[...svg.querySelectorAll('text')].map(t=>({t:t.textContent,size:parseFloat(getComputedStyle(t).fontSize),r:t.getBoundingClientRect()}));
    return {w:s.width,attr:Number(svg.getAttribute('width')),kw:kutu.clientWidth,bars:svg.querySelectorAll('rect.ee-fark').length,up:svg.querySelectorAll('rect.ee-yukari').length,sifir:svg.querySelectorAll('.ee-sifir').length,ort:svg.querySelectorAll('.ee-ortcizgi').length,
      enKucuk:Math.min(...txt.map(x=>x.size)),etiket:txt.map(x=>x.t).filter(t=>/^ortalama |^beklenen$/.test(t)),tasan:txt.filter(x=>x.r.left<s.left-1||x.r.right>s.right+1).map(x=>x.t),
      renk:getComputedStyle(svg.querySelector('rect.ee-yukari')).fill};
   });
   assert(Math.abs(f.w-f.kw)<=1&&f.attr===f.kw,'fark chart at the real width '+JSON.stringify([f.w,f.attr,f.kw]));assert.equal(f.bars,19,'a bar per student with etüts');assert(f.up>=12&&f.up<=19);assert.equal(f.sifir,1);assert.equal(f.ort,1);
   assert.equal(f.etiket.length,2);assert(f.enKucuk>=11);assert.deepEqual(f.tasan,[]);
   // The earlier view sits in a collapsed block: open it and its bars are drawn at the real width.
   await page.locator('#eeAralik summary').click();await page.waitForSelector('#eeArtis svg rect.ee-sutun');
   assert.match(await page.locator('#eeAralikKarar').innerText(),/^(Etüt aldıkça artış belirgin|Belirgin bir fark yok|Yeterli veri yok|Etüt alınan aralıklarda)/);
   assert.match(await page.locator('#eeEslesme').innerText(),/^Hem etüt aldığı hem almadığı deneme arası olan \d+ öğrenci: etüt alınan aralarda ortalama/);
   // The bars: five of them, drawn at the box's real width, the zero line, whiskers, n under each, faint small ones, real-pixel type.
   const b=await page.evaluate(()=>{
    const kutu=document.querySelector('#eeArtis .et-grafik'),svg=kutu.querySelector('svg'),s=svg.getBoundingClientRect(),k=kutu.getBoundingClientRect();
    const txt=[...svg.querySelectorAll('text')].map(t=>({t:t.textContent,size:parseFloat(getComputedStyle(t).fontSize),r:t.getBoundingClientRect()}));
    return {w:s.width,attr:Number(svg.getAttribute('width')),kw:kutu.clientWidth,sag:s.right,kutuSag:k.right,sutun:svg.querySelectorAll('rect.ee-sutun').length,faint:svg.querySelectorAll('.ee-kova.az').length,biyik:svg.querySelectorAll('line.ee-biyik').length,
      sifir:svg.querySelectorAll('.ee-sifir').length,enKucuk:Math.min(...txt.map(x=>x.size)),sayilar:txt.filter(x=>/^n = /.test(x.t)).length,adlar:[...svg.querySelectorAll('text.ee-kova-ad')].map(t=>t.textContent),
      tasan:txt.filter(x=>x.r.left<s.left-1||x.r.right>s.right+1).map(x=>x.t)};
   });
   assert(Math.abs(b.w-b.kw)<=1&&b.attr===b.kw,'bars drawn at the real width '+JSON.stringify([b.w,b.attr,b.kw]));
   assert.equal(b.sutun,5);assert.equal(b.sifir,1);assert(b.biyik>=6&&b.biyik%3===0,'whiskers '+b.biyik);assert(b.faint>=1,'small bars are faint');assert.equal(b.sayilar,5);assert.deepEqual(b.adlar,['0','1','2','3','4+']);assert(b.enKucuk>=11,'type is real pixels: '+b.enKucuk);assert.deepEqual(b.tasan,[],'nothing leaves the box');
   // The standing: the school's line, named at its right end in the "ilk %…" wording, the weekly etüts beneath on the same dates.
   const g=await page.evaluate(()=>{
    const kutu=document.querySelector('#eeGrafik .et-grafik'),svg=kutu.querySelector('svg'),s=svg.getBoundingClientRect(),k=kutu.getBoundingClientRect();
    const yazilar=[...svg.querySelectorAll('text.ee-ad')].map(t=>{const r=t.getBoundingClientRect();return {t:t.textContent,top:r.top,bottom:r.bottom,right:r.right,font:parseFloat(getComputedStyle(t).fontSize)}});
    const tum=[...svg.querySelectorAll('text')].map(t=>parseFloat(getComputedStyle(t).fontSize));
    return {w:s.width,attr:Number(svg.getAttribute('width')),kw:kutu.clientWidth,kutuSag:k.right,yollar:svg.querySelectorAll('path.ee-cizgi').length,noktalar:svg.querySelectorAll('circle.ee-nokta').length,
      cubuk:svg.querySelectorAll('rect.ee-cubuk').length,yazilar,enKucuk:Math.min(...tum),lejant:document.querySelectorAll('#eeGrafik .et-lejant').length,ticks:[...svg.querySelectorAll('text.et-tik')].map(t=>t.textContent)};
   });
   assert(Math.abs(g.w-g.kw)<=1&&g.attr===g.kw,'standing drawn at the real width '+JSON.stringify([g.w,g.attr,g.kw]));
   assert.equal(g.yollar,1);assert.equal(g.noktalar,5);assert(g.cubuk>=3,'weekly bars');assert.equal(g.lejant,0);assert(g.enKucuk>=11,'type is real pixels: '+g.enKucuk);
   assert.equal(g.yazilar.length,1);assert.match(g.yazilar[0].t,/^ilk %\d+(,\d)?$/,'named with the dilim wording: '+g.yazilar[0].t);assert(g.yazilar[0].right<=g.kutuSag+1,'label stays inside the box');
   assert(g.ticks.some(t=>/^%\d+(,\d)?$/.test(t)),'dilim ticks: '+g.ticks);
   assert(await page.locator('#eeGrafik svg text',{hasText:'Haftalık etüt'}).count()===1);
   // Tables: every numeric header ends where its numbers end, in every table of the page.
   for(const id of ['eeHocalar','eeOgrenciler']){
    const sonuc=await page.evaluate(id=>{
     const tablo=document.querySelector('#'+id+' table'),basl=[...tablo.querySelectorAll('thead th')].filter(th=>th.getBoundingClientRect().width>0),ilk=tablo.querySelector('tbody tr'),sat=[...ilk.children].filter(td=>td.getBoundingClientRect().width>0);
     return basl.map((th,i)=>({ad:th.textContent,sayi:th.classList.contains('sayi'),thSag:th.getBoundingClientRect().right,tdSag:sat[i].getBoundingClientRect().right,thAlign:getComputedStyle(th).textAlign,tdAlign:getComputedStyle(sat[i]).textAlign,n:basl.length===sat.length}));
    },id);
    assert(sonuc.every(c=>c.n),id+' header and row have the same columns');assert(sonuc.filter(c=>c.sayi).length>=(width<=640?2:3),id+' has numeric columns');
    for(const c of sonuc.filter(c=>c.sayi)){assert(Math.abs(c.thSag-c.tdSag)<=2,id+' · '+c.ad+': header right '+c.thSag+' vs numbers '+c.tdSag);assert.equal(c.thAlign,'right');assert.equal(c.tdAlign,'right')}
    for(const c of sonuc.filter(c=>!c.sayi))assert(['left','start'].includes(c.thAlign)&&['left','start'].includes(c.tdAlign),id+' · '+c.ad+': names are left-aligned');
   }
   assert.deepEqual((await page.locator('#eeHocalar .ee-ad').allInnerTexts()).sort(),['Sentetik Öğretmen A','Sentetik Öğretmen B']);
   assert.deepEqual(await page.locator('#eeHocalar thead th').allTextContents(),['Sıra','Öğretmen','Öğrenci','Etüt','Toplam katkı (net)','Öğrenci başına (net)']);
   // Teachers are ranked by their estimate (largest first): the first row is rank 1 and the column is right-aligned like the other numbers.
   assert.deepEqual(await page.locator('#eeHocalar thead th').first().evaluate(th=>[th.textContent,th.classList.contains('sayi'),getComputedStyle(th).textAlign,th.getBoundingClientRect().width>0]),['Sıra',true,'right',true]);
   const hocaSatirlari=await page.locator('#eeHocalar tbody tr').evaluateAll(l=>l.map(r=>{const son=r.children[r.children.length-1],kat=r.children[r.children.length-2],say=kat.textContent;return {sira:r.children[0].textContent,az:r.classList.contains('ee-az'),tahmin:parseFloat(say.replace(/[▲▼]/g,'').replace(',','.'))*(say.includes('▼')?-1:1),aralik:son.querySelector('.mini')?.textContent||''}}));
   assert.equal(hocaSatirlari[0].sira,'1');assert.match(hocaSatirlari[0].aralik,/^[+−]?\d,\d\d … [+−]?\d,\d\d$/,'the interval is written under the estimate');
   for(let i=1;i<hocaSatirlari.length;i++){const a=hocaSatirlari[i-1],c=hocaSatirlari[i];assert(a.az<=c.az,'small groups last');if(a.az===c.az)assert(a.tahmin>=c.tahmin,'largest pocket first')}
   for(const r of hocaSatirlari)assert.equal(r.sira==='—',r.az,'only small groups lose their rank');
   assert.deepEqual(await page.locator('#eeOgrenciler thead th').allTextContents(),['Öğrenci','Etütten önce','Son deneme','Toplam değişim (net)','Beklenen (net)','Etüt sonrası fark (net)','Öğretmenler','Türkiye farkı']);
   const hepsi=await page.locator('#eeOgrenciler tbody tr').count();assert.equal(hepsi,19);
   assert.equal(await page.locator('#eeOgrenciler tbody tr svg').count(),19,'a small line each');assert.equal(await page.locator('#eeOgrenciler tbody tr line.ee-etutim').count(),19,'the first etüt is marked on each');
   assert.match(await page.locator('#eeDisarida summary').innerText(),/^Dışarıda kalan 2 öğrenci$/);
   assert.equal(await page.locator('#eeDisarida').evaluate(d=>d.open),false);
   await page.locator('#eeDisarida summary').click();
   assert.match(await page.locator('#eeDisarida').innerText(),/Sentetik Netsiz · 12\/B · bu dersin neti yok[\s\S]*Sentetik Tek Deneme · 12\/A · yalnızca 1 denemeye girdi/);
   // The method block opens and is plain.
   await page.locator('#eeNasil summary').click();assert.equal(await page.locator('#eeNasil').evaluate(d=>d.open),true);
   const nasil=await page.locator('#eeNasil').innerText();for(const k of ['Türkiye farkı','Toplam değişim','Beklenen değişim','Öğretmen cebi'])assert(nasil.includes(k),k);
   await page.locator('#eeNasil summary').click();
   // A teacher filters the students; "Tüm öğretmenler" resets.
   await page.locator('#eeHocalar .ee-ad',{hasText:'Öğretmen B'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('#eeOgrenciler tbody tr').length<19);
   const nB=await page.locator('#eeOgrenciler tbody tr').count();assert(nB>0&&nB<hepsi);
   assert.match(await page.locator('#eeOgrenciler h2').innerText(),/Öğrenciler · Sentetik Öğretmen B/);assert.equal(await page.locator('#eeHocalar tr.secili').count(),1);
   await page.locator('#eeOgrenciler [data-ee-hoca=""]').click();
   await page.waitForFunction(n=>document.querySelectorAll('#eeOgrenciler tbody tr').length===n,hepsi);
   // Dönem: the last four exams.
   await page.locator('[data-ee-donem="son4"]').click();
   await page.waitForFunction(()=>/ 4 deneme \(14 Eki – 4 Kas\)/.test(document.querySelector('#eeCumle').textContent));
   assert.equal(await page.locator('[data-ee-donem="son4"]').getAttribute('aria-pressed'),'true');
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');await page.waitForSelector('#eeFark svg rect.ee-fark');
   await page.locator('[data-ee-donem="tum"]').click();
   await page.waitForFunction(()=>/ 5 deneme \(7 Eki – 4 Kas\)/.test(document.querySelector('#eeCumle').textContent));
   // Ders: another lesson, another page (three students, so no verdict and the one teacher is unranked).
   await page.locator('#eeDers').selectOption('Fizik');
   await page.waitForFunction(()=>/· Fizik ·/.test(document.querySelector('#eeCumle').textContent));
   assert.match(await page.locator('#eeKarar').innerText(),/^Yeterli veri yok/);assert.equal(await page.locator('#eeFark svg rect.ee-fark').count(),3);
   assert.deepEqual(await page.locator('#eeHocalar .ee-ad').allInnerTexts(),['Sentetik Öğretmen F']);assert.equal(await page.locator('#eeHocalar tbody tr td').first().innerText(),'—','one teacher with 3 students is unranked');
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');
   await page.locator('#eeDers').selectOption('Matematik');
   await page.waitForFunction(()=>/· Matematik ·/.test(document.querySelector('#eeCumle').textContent));
   // Grade 9 is a page of its own (no list for it: the standing says so, with the button).
   await page.locator('[data-ee-duzey="9"]').click();
   await page.waitForFunction(()=>/^9\. sınıf/.test(document.querySelector('#eeCumle').textContent));
   assert.match(await page.locator('#eeGrafik').innerText(),/Türkiye geneli listesi eklenmemiş/);assert.equal(await page.locator('#eeGrafik [data-sekme="turkiye"]').count(),1);
   await page.locator('[data-ee-duzey="12"]').click();
   await page.waitForFunction(()=>/^12\. sınıf/.test(document.querySelector('#eeCumle').textContent));
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');
   // No page scrolls sideways (the student table scrolls in its own box).
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   // On a phone the tables show their essential columns and nothing scrolls sideways, not even inside a table's box.
   if(width<=640){
    const kolonlar=await page.evaluate(()=>Object.fromEntries(['eeHocalar','eeOgrenciler'].map(id=>[id,{
     gorunen:[...document.querySelectorAll('#'+id+' thead th')].filter(th=>th.getBoundingClientRect().width>0).map(th=>th.textContent),
     tasma:(k=>k.scrollWidth-k.clientWidth)(document.querySelector('#'+id+' .et-tablo-kutu')),tablo:(t=>t.scrollWidth-t.clientWidth)(document.querySelector('#'+id+' table')),
     kesik:[...document.querySelectorAll('#'+id+' td,#'+id+' th')].filter(c=>c.getBoundingClientRect().width>0&&c.scrollWidth>c.clientWidth+1).map(c=>c.textContent+':'+c.scrollWidth+'/'+c.clientWidth)}])));
    assert.deepEqual(kolonlar.eeHocalar.gorunen,['Sıra','Öğretmen','Toplam katkı (net)','Öğrenci başına (net)']);
    assert.deepEqual(kolonlar.eeOgrenciler.gorunen,['Öğrenci','Toplam değişim (net)','Etüt sonrası fark (net)','Türkiye farkı']);
    for(const [id,k] of Object.entries(kolonlar)){assert(k.tasma<=1,id+' scrolls sideways by '+k.tasma);assert(k.tablo<=1,id+' table wider than its box by '+k.tablo);assert.deepEqual(k.kesik,[],id+' has cut-off cells')}
   }
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#eeKok .et-panel')].every(p=>p.scrollWidth<=p.clientWidth+1)),true,'panels do not overflow');
   // A resize redraws both charts at the new width.
   if(width===1280){
    const genis=()=>page.evaluate(()=>['#eeFark','#eeGrafik'].every(s=>{const k=document.querySelector(s+' .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth}));
    await page.setViewportSize({width:900,height:950});await page.waitForFunction(()=>['#eeFark','#eeGrafik'].every(s=>{const k=document.querySelector(s+' .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth}));
    await page.setViewportSize({width:1280,height:950});await page.waitForFunction(()=>['#eeFark','#eeGrafik'].every(s=>{const k=document.querySelector(s+' .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth&&k.clientWidth>800}));
    assert(await genis());
   }
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'etki-'+width+'-'+tema+'.png'),fullPage:true});
   // Without any Türkiye geneli list the raw net stands in and the page says so, with a button to the lists.
   await page.evaluate(()=>{delete D.turkiye;EK.eeHoca=undefined;ciz()});
   await page.waitForSelector('#eeHamUyari');
   assert.equal(await page.locator('#eeHamUyari').innerText(),'Türkiye geneli listesi yok: ham net artışı kullanıldı; deneme zorluğu ayıklanmadı. Türkiye geneli sayfasından ekleyin.');
   assert.equal(await page.locator('.ee-uyari-satir [data-sekme="turkiye"]').count(),1);
   assert.match(await page.locator('#eeGrafik').innerText(),/Türkiye geneli listesi eklenmemiş/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling without lists');
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'etki-yok-'+width+'-'+tema+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Etüt etkisi at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
