// Etüt etkisi on desktop and mobile: the page under Öğrenciler; the sentence, the chart drawn at its real width with
// its lines named at their right ends, the groups, teachers and students tables (every numeric header sits over its
// numbers), a teacher's filter, the Ders and Dönem controls, the students left out, and no sideways scrolling on a
// phone. Synthetic merged students only (the shape Öğrenci raporları gives the page); the merge has its own tests.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-etutetki-'));fs.mkdirSync(out,{recursive:true});
// Five exams a week apart. Grade 12: 30 students (1–8 no etüt, 9–16 one or two, 17–23 three to five, 24–27 six or more, 28–30 Fizik only),
// teacher A for most, B for some; plus one student with a single exam and one without Matematik nets. Grade 9: six students.
const DATES=['2026-10-07','2026-10-14','2026-10-21','2026-10-28','2026-11-04'];
const GUN=['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-15','2026-10-16','2026-10-19','2026-10-20','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-29','2026-10-30','2026-11-02','2026-11-03'];
const et=(c,t,n,k=0)=>Array.from({length:n},(_,j)=>({date:GUN[(j*3+k)%GUN.length],course:c,teacher:t,minutes:40,time:900}));
const exams=(nets,cls)=>DATES.map((date,k)=>nets[k]===null?null:{exam:'27-YKS-12'+String(k+1).padStart(2,'0'),date,session:'TYT',nets:{mat:nets[k],fizik:6+k*.5}}).filter(Boolean);
const ogrenciler=[];
for(let i=1;i<=30;i++){
  const n=i<=8?0:i<=16?1+i%2:i<=23?3+i%3:i<=27?6+i%2:0,egim=0.3+(n?Math.min(n,7)*.12:0)+((i*7)%5-2)*.15,taban=8+(i*5)%9;
  const mat=[0,1,2,3,4].map(k=>Math.round((taban+egim*k+((i+k)%3-1)*.6)*100)/100);
  const sessions=i>=28?et('FİZİK','SENTETİK ÖĞRETMEN F',2,i):[...et('MATEMATİK TYT',i%4===0?'SENTETİK ÖĞRETMEN B':'SENTETİK ÖĞRETMEN A',n,i),...(i>=20&&i%2?et('MATEMATİK TYT','SENTETİK ÖĞRETMEN B',1,i+5):[])];
  ogrenciler.push({id:'o'+i,name:'SENTETİK ÖĞRENCİ '+String(i).padStart(2,'0'),cls:'12/'+(i%2?'A':'B'),sessions,exams:exams(i===5?[mat[0],mat[1],null,mat[3],mat[4]]:mat)});
}
ogrenciler.push({id:'x1',name:'SENTETİK TEK DENEME',cls:'12/A',sessions:et('MATEMATİK TYT','SENTETİK ÖĞRETMEN A',1,2),exams:exams([10,null,null,null,null])});
ogrenciler.push({id:'x2',name:'SENTETİK NETSİZ',cls:'12/B',sessions:[],exams:DATES.map((date,k)=>({exam:'27-YKS-12'+String(k+1).padStart(2,'0'),date,session:'TYT',nets:{fizik:5}}))});
for(let i=1;i<=6;i++)ogrenciler.push({id:'k'+i,name:'SENTETİK KÜÇÜK '+i,cls:'9/A',sessions:et('MATEMATİK TYT','SENTETİK ÖĞRETMEN A',i%2,i),exams:DATES.map((date,k)=>({exam:'27-TYT-09'+String(k+1).padStart(2,'0'),date,session:'TYT',nets:{mat:5+k+i%3}}))});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-11-05T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(s=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-05';D.ogr=[];EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    OGRENCI_RAPOR.temelOgrenciler=()=>({students:structuredClone(s),warnings:[],etutKapsam:[[gunNo('2026-10-01'),gunNo('2026-11-30')]]});ciz();
   },ogrenciler);
   // The page sits under Öğrenciler, after Etütler.
   assert.equal(await page.locator('#ray #ogrencilerMenusu [data-sekme="etutetki"]').count(),1);
   assert.deepEqual(await page.locator('#ray #ogrencilerMenusu [data-sekme]').evaluateAll(l=>l.map(x=>x.dataset.sekme)),['takip','etutler','etutetki','etutplani','yoklama','ogrencirapor']);
   await page.evaluate(()=>{EK.sekme='etutetki';ciz()});
   await page.waitForSelector('#eeKok #eeGrafik svg path.ee-cizgi');
   const cumle=()=>page.locator('#eeCumle').innerText();
   // The sentence and the counts, in everyday words, with no manual.
   assert.match(await cumle(),/^12\. sınıf · Matematik · 5 deneme \(7 Eki – 4 Kas\) · \d+ öğrenci her denemede ortalama ▲\d,\d\d net arttı\. En çok etüt alan \(6\+\) \d+ öğrenci ▲\d,\d\d, etüt almayan \d+ öğrenci ▲\d,\d\d\.$/);
   assert.match(await page.locator('#eeSayim').innerText(),/^32 öğrenciden \d+’\w+ sayıldı; 2’si dışarıda \(aşağıda listelenir\)\.$/);
   assert.equal(await page.locator('#eeSinir').innerText(),'Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.');
   const yazi=await page.locator('#eeKok').innerText();
   assert(!/Nasıl okunur|Gözlem|±|\bham\b|eğim|\(%95\)/i.test(yazi),'no method words');
   assert.equal(await page.locator('#eeKok .et-arac button, #eeKok .et-arac select').count()>=4,true);
   // The sections, in order.
   const sira=await page.evaluate(()=>['eeCumle','eeGrafik','eeGruplar','eeHocalar','eeOgrenciler','eeDisarida'].map(id=>document.getElementById(id).getBoundingClientRect().top+scrollY));
   assert.deepEqual([...sira].sort((a,b)=>a-b),sira,'sections in order: '+sira);
   // The chart is drawn at the box's real width, its lines are named at their right ends and nothing overlaps or leaves the box.
   const g=await page.evaluate(()=>{
    const kutu=document.querySelector('#eeGrafik .et-grafik'),svg=kutu.querySelector('svg'),s=svg.getBoundingClientRect(),k=kutu.getBoundingClientRect();
    const yazilar=[...svg.querySelectorAll('text.ee-ad')].map(t=>{const r=t.getBoundingClientRect();return {t:t.textContent,top:r.top,bottom:r.bottom,right:r.right,left:r.left,font:parseFloat(getComputedStyle(t).fontSize)}});
    const tum=[...svg.querySelectorAll('text')].map(t=>parseFloat(getComputedStyle(t).fontSize));
    return {w:s.width,attr:Number(svg.getAttribute('width')),kw:kutu.clientWidth,sag:s.right,kutuSag:k.right,yollar:svg.querySelectorAll('path.ee-cizgi').length,noktalar:svg.querySelectorAll('circle.ee-nokta').length,
      cubuk:svg.querySelectorAll('rect.ee-cubuk').length,yazilar,enKucuk:Math.min(...tum),lejant:document.querySelectorAll('#eeGrafik .et-lejant').length};
   });
   assert(Math.abs(g.w-g.kw)<=1&&g.attr===g.kw,'drawn at the real width '+JSON.stringify([g.w,g.attr,g.kw]));
   assert(g.yollar>=4,'a line per group and the class: '+g.yollar);assert(g.noktalar>=15);assert(g.cubuk>=4,'weekly bars');assert.equal(g.lejant,0);assert(g.enKucuk>=12,'type is real pixels: '+g.enKucuk);
   assert(g.yazilar.length>=4&&g.yazilar.every(y=>/ · \d+,\d\d$/.test(y.t)),'direct labels: '+g.yazilar.map(y=>y.t));
   const siralı=[...g.yazilar].sort((a,b)=>a.top-b.top);for(let i=1;i<siralı.length;i++)assert(siralı[i].top>=siralı[i-1].bottom-2,'labels overlap: '+siralı.map(y=>y.t));
   assert(g.yazilar.every(y=>y.right<=g.kutuSag+1),'labels stay inside the box');
   assert(await page.locator('#eeGrafik svg text',{hasText:'Haftalık etüt'}).count()===1);
   // Tables: every numeric header ends where its numbers end, in every table of the page.
   for(const id of ['eeGruplar','eeHocalar','eeOgrenciler']){
    const sonuc=await page.evaluate(id=>{
     const tablo=document.querySelector('#'+id+' table'),basl=[...tablo.querySelectorAll('thead th')].filter(th=>th.getBoundingClientRect().width>0),ilk=tablo.querySelector('tbody tr'),sat=[...ilk.children].filter(td=>td.getBoundingClientRect().width>0);
     return basl.map((th,i)=>({ad:th.textContent,sayi:th.classList.contains('sayi'),thSag:th.getBoundingClientRect().right,tdSag:sat[i].getBoundingClientRect().right,thAlign:getComputedStyle(th).textAlign,tdAlign:getComputedStyle(sat[i]).textAlign,n:basl.length===sat.length}));
    },id);
    assert(sonuc.every(c=>c.n),id+' header and row have the same columns');assert(sonuc.filter(c=>c.sayi).length>=(width<=640?2:4),id+' has numeric columns');
    for(const c of sonuc.filter(c=>c.sayi)){assert(Math.abs(c.thSag-c.tdSag)<=2,id+' · '+c.ad+': header right '+c.thSag+' vs numbers '+c.tdSag);assert.equal(c.thAlign,'right');assert.equal(c.tdAlign,'right')}
    for(const c of sonuc.filter(c=>!c.sayi))assert(['left','start'].includes(c.thAlign)&&['left','start'].includes(c.tdAlign),id+' · '+c.ad+': names are left-aligned');
   }
   assert.equal(await page.locator('#eeGruplar tbody tr').count(),4);
   assert.deepEqual(await page.locator('#eeGruplar thead th').allTextContents(),['Grup','Öğrenci','Etüt / öğrenci','İlk denemelerde net','Son denemelerde net','Deneme başına artış (net)','Toplam artış (net)']);
   assert.deepEqual((await page.locator('#eeHocalar .ee-ad').allInnerTexts()).sort(),['Sentetik Öğretmen A','Sentetik Öğretmen B']);
   // Teachers are ranked by "Sınıftan fazla / az" (largest first): the first row is rank 1 and the column is right-aligned like the other numbers.
   assert.deepEqual(await page.locator('#eeHocalar thead th').first().evaluate(th=>[th.textContent,th.classList.contains('sayi'),getComputedStyle(th).textAlign,th.getBoundingClientRect().width>0]),['Sıra',true,'right',true]);
   const hocaSatirlari=await page.locator('#eeHocalar tbody tr').evaluateAll(l=>l.map(r=>({sira:r.children[0].textContent,az:r.classList.contains('ee-az'),fark:parseFloat(r.children[r.children.length-1].textContent.replace(/[▲▼]/g,'').replace(',','.'))*(r.children[r.children.length-1].textContent.includes('▼')?-1:1),sag:r.children[0].getBoundingClientRect().right,thSag:document.querySelector('#eeHocalar thead th').getBoundingClientRect().right})));
   assert.equal(hocaSatirlari[0].sira,'1');assert(Math.abs(hocaSatirlari[0].sag-hocaSatirlari[0].thSag)<=2,'rank sits under its header');
   for(let i=1;i<hocaSatirlari.length;i++){const a=hocaSatirlari[i-1],b=hocaSatirlari[i];assert(a.az<=b.az,'small groups last');if(a.az===b.az)assert(a.fark>=b.fark,'largest difference first')}
   for(const r of hocaSatirlari)assert.equal(r.sira==='—',r.az,'only small groups lose their rank');
   assert.deepEqual(await page.locator('#eeOgrenciler thead th').allTextContents(),['Öğrenci','Şube','Etüt sayısı','Deneme sayısı','Deneme başına artış (net)','Toplam artış (net)','Netler']);
   const hepsi=await page.locator('#eeOgrenciler tbody tr').count();assert.equal(hepsi,30);
   assert.match(await page.locator('#eeDisarida summary').innerText(),/^Dışarıda kalan 2 öğrenci$/);
   assert.equal(await page.locator('#eeDisarida').evaluate(d=>d.open),false);
   await page.locator('#eeDisarida summary').click();
   assert.match(await page.locator('#eeDisarida').innerText(),/Sentetik Netsiz · 12\/B · bu dersin neti yok[\s\S]*Sentetik Tek Deneme · 12\/A · yalnızca 1 denemeye girdi/);
   // A teacher filters the students; "Tüm öğretmenler" resets.
   await page.locator('#eeHocalar .ee-ad',{hasText:'Öğretmen B'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('#eeOgrenciler tbody tr').length<30);
   const nB=await page.locator('#eeOgrenciler tbody tr').count();assert(nB>0&&nB<hepsi);
   assert.match(await page.locator('#eeOgrenciler h2').innerText(),/Öğrenciler · Sentetik Öğretmen B/);assert.equal(await page.locator('#eeHocalar tr.secili').count(),1);
   await page.locator('#eeOgrenciler [data-ee-hoca=""]').click();
   await page.waitForFunction(n=>document.querySelectorAll('#eeOgrenciler tbody tr').length===n,hepsi);
   // Dönem: the last four exams.
   await page.locator('[data-ee-donem="son4"]').click();
   await page.waitForFunction(()=>/ 4 deneme \(14 Eki – 4 Kas\)/.test(document.querySelector('#eeCumle').textContent));
   assert.equal(await page.locator('[data-ee-donem="son4"]').getAttribute('aria-pressed'),'true');
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');
   await page.locator('[data-ee-donem="tum"]').click();
   await page.waitForFunction(()=>/ 5 deneme \(7 Eki – 4 Kas\)/.test(document.querySelector('#eeCumle').textContent));
   // Ders: another lesson, another page.
   await page.locator('#eeDers').selectOption('Fizik');
   await page.waitForFunction(()=>/· Fizik ·/.test(document.querySelector('#eeCumle').textContent));
   assert.deepEqual(await page.locator('#eeHocalar .ee-ad').allInnerTexts(),['Sentetik Öğretmen F']);assert.equal(await page.locator('#eeHocalar tbody tr td').first().innerText(),'—','one teacher with 3 students is unranked');
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');
   await page.locator('#eeDers').selectOption('Matematik');
   await page.waitForFunction(()=>/· Matematik ·/.test(document.querySelector('#eeCumle').textContent));
   // Grade 9 is a page of its own.
   await page.locator('[data-ee-duzey="9"]').click();
   await page.waitForFunction(()=>/^9\. sınıf/.test(document.querySelector('#eeCumle').textContent));
   await page.locator('[data-ee-duzey="12"]').click();
   await page.waitForFunction(()=>/^12\. sınıf/.test(document.querySelector('#eeCumle').textContent));
   await page.waitForSelector('#eeGrafik svg path.ee-cizgi');
   // No page scrolls sideways (the student table scrolls in its own box).
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   // On a phone the tables show their essential columns and nothing scrolls sideways, not even inside a table's box.
   if(width<=640){
    const kolonlar=await page.evaluate(()=>Object.fromEntries(['eeGruplar','eeHocalar','eeOgrenciler'].map(id=>[id,{
     gorunen:[...document.querySelectorAll('#'+id+' thead th')].filter(th=>th.getBoundingClientRect().width>0).map(th=>th.textContent),
     tasma:(k=>k.scrollWidth-k.clientWidth)(document.querySelector('#'+id+' .et-tablo-kutu')),tablo:(t=>t.scrollWidth-t.clientWidth)(document.querySelector('#'+id+' table')),
     kesik:[...document.querySelectorAll('#'+id+' td,#'+id+' th')].filter(c=>c.getBoundingClientRect().width>0&&c.scrollWidth>c.clientWidth+1).map(c=>c.textContent+':'+c.scrollWidth+'/'+c.clientWidth)}])));
    assert.deepEqual(kolonlar.eeGruplar.gorunen,['Grup','Öğrenci','Deneme başına artış (net)','Toplam artış (net)']);
    assert.deepEqual(kolonlar.eeHocalar.gorunen,['Sıra','Öğretmen','Öğrenci','Deneme başına artış (net)','Sınıftan fazla / az (net)']);
    assert.deepEqual(kolonlar.eeOgrenciler.gorunen,['Öğrenci','Etüt sayısı','Deneme başına artış (net)','Netler']);
    for(const [id,k] of Object.entries(kolonlar)){assert(k.tasma<=1,id+' scrolls sideways by '+k.tasma);assert(k.tablo<=1,id+' table wider than its box by '+k.tablo);assert.deepEqual(k.kesik,[],id+' has cut-off cells')}
    assert.equal(await page.locator('#eeHocalar td .mini').first().evaluate(e=>getComputedStyle(e).textOverflow),'clip');
   }
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#eeKok .et-panel')].every(p=>p.scrollWidth<=p.clientWidth+1)),true,'panels do not overflow');
   // A resize redraws the chart at the new width.
   if(width===1280){await page.setViewportSize({width:900,height:950});await page.waitForFunction(()=>{const k=document.querySelector('#eeGrafik .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth});await page.setViewportSize({width:1280,height:950});await page.waitForFunction(()=>{const k=document.querySelector('#eeGrafik .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth&&k.clientWidth>800})}
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'etutetkisi-'+width+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Etüt etkisi at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
