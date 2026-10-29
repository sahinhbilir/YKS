// Öğrenci kartı on desktop and mobile: opened from a name in Deneme panosu, the five figure cards, the chart drawn at its real
// width with its lines named at their right ends, the tables (every numeric header sits over its numbers), the student
// selector, the TYT / AYT switch, the way back, and no sideways scrolling on a phone. Synthetic school only: the school lists,
// Türkiye lists, etüt, Yoklama and Konu Takibi data are stored the way the site stores them.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const F=require('./konutakibi-fixtures.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-ogrencikarti-'));fs.mkdirSync(out,{recursive:true});
const KEYS=['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'],AKEYS=['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY'];
const SORU={'TÜR':40,TAR:5,'COĞ':5,FEL:5,'DİN':5,MAT:30,GEO:10,'FİZ':7,'KİM':7,'BİY':6};
const KOD={'TÜR':'TÜRKÇE-T',TAR:'TARİH-T','COĞ':'COĞRAFYA-T',FEL:'FELSEFE-T','DİN':'DİN KÜLTÜRÜ-T',MAT:'MATEMATİK-T',GEO:'GEOMETRİ-T','FİZ':'FİZİK-T','KİM':'KİMYA-T','BİY':'BİYOLOJİ-T'};
const AKOD={AMAT:'MATEMATİK-A',AGEO:'GEOMETRİ-A','AFİZ':'FİZİK-A','AKİM':'KİMYA-A','ABİY':'BİYOLOJİ-A'};
const ADLAR=['27-YKS-1201','27-YKS-1202','27-YKS-1203','27-YKS-1204','27-YKS-1205','27-YKS-1206'];
const TARIH=['24.09.2026','01.10.2026','08.10.2026','15.10.2026','22.10.2026','29.10.2026'],ISO=['2026-09-24','2026-10-01','2026-10-08','2026-10-15','2026-10-22','2026-10-29'];
// Students 1001–1030: 12/A for the odd numbers, 12/B for the even. Nets are whole numbers (no wrong answers).
const netler=(i,e)=>{
  const v={'TÜR':Math.min(40,14+i%7+e+((i*e)%4)),MAT:Math.min(30,7+i%9+e+((i+e)%3)),'FİZ':2+i%4,'KİM':1+(i+e)%4,'BİY':1+(i%3)+(e%2),TAR:1+i%3,'COĞ':1+(i+e)%3,FEL:1+i%2,'DİN':2+e%3,GEO:Math.min(10,1+(i+e)%5)};
  if(i===1)Object.assign(v,{'TÜR':[24,26,25,28,27,31][e],MAT:[12,13,15,14,17,16][e]});
  return v;
};
const aytNet=(i,e)=>({AMAT:Math.min(30,10+i%8+e),AGEO:Math.min(10,3+i%4),'AFİZ':Math.min(14,4+i%6),'AKİM':Math.min(13,3+i%5),'ABİY':Math.min(13,3+(i+e)%5)});
const satir=(i,e,tur)=>{
  const no=1000+i,all={...netler(i,e),...(tur==='F'&&e>=3&&i<=12?aytNet(i,e):{})},keys=tur==='F'?[...KEYS,...AKEYS]:KEYS;
  return {no:String(no),ad:i===1?'SENTETİK ADA':'SENTETİK ÖĞRENCİ '+String(i).padStart(2,'0'),snf:(i%2?'301 12/A':'201 12/B'),n:keys.map(k=>all[k]??null),dy:keys.map(k=>all[k]?all[k]+'/0':null),p:[0,0,0,0],r:['','','','']};
};
const katilim=['30','30','30'];
const siralama=(anahtar)=>({surum:1,sinavlar:ADLAR.map((ad,e)=>{
  const slot=tur=>({tarih:TARIH[e],katilim,kurum:null,ogr:Array.from({length:30},(_,k)=>k+1).filter(i=>!(i===2&&e===3)&&!(i===3&&e<2)&&!(tur==='F'&&i>12)).map(i=>satir(i,e,tur))});
  return {id:anahtar(ad),ad,okul:'SENTETİK ANADOLU LİSESİ',ts:100+e,T:slot('T'),...(e>=3?{F:slot('F')}:{})};
})});
const rapor=e=>({ad:ADLAR[e],liste:'kolej',yaz:null,dersler:[...Object.entries(KOD).map(([k,kod])=>[kod,SORU[k],Math.round((SORU[k]*(.42+e*.012))*100)/100]),...(e>=3?Object.entries(AKOD).map(([k,kod])=>[kod,30,Math.round((12+e*.5+Object.keys(AKOD).indexOf(k))*100)/100]):[])]
  .map(([kod,soru,genel])=>({kod,soru,genel,satir:[{sira:1,ad:'SENTETİK OKUL',net:Math.min(soru,genel+4)},{sira:2,ad:'SENTETİK KOLEJ',net:genel}]}))});
// Etüt, Yoklama and Konu Takibi for ADA (1001): inside the last 30 days of 5 Kasım.
const etutSatir=[['2026-10-08','MATEMATİK TYT','SENTETİK ÖĞRETMEN A'],['2026-10-12','MATEMATİK TYT','SENTETİK ÖĞRETMEN A'],['2026-10-19','MATEMATİK TYT','SENTETİK ÖĞRETMEN B'],['2026-10-21','FİZİK TYT','SENTETİK ÖĞRETMEN C'],['2026-11-02','TÜRKÇE TYT','SENTETİK ÖĞRETMEN D'],['2026-10-02','KİMYA TYT','SENTETİK ÖĞRETMEN E']];
const yoklama=[['2026-10-09','AAAAAAAA'],['2026-10-20','AAAAPPPP'],['2026-10-27','MMMPPPPP'],['2026-11-03','RRRRRRRR'],['2026-10-26','PPPPPPPP']];
const S1={name:'SENTETİK ADA',no:'1001',cls:'301 12/A'},NZ=100;
const spec={'TÜRKÇE-T':[['T.12.1.1',.11],['T.12.1.1',.07],['T.12.1.2',.93],['T.12.1.2',.89],['T.12.3.1',.9],['T.12.5.1',.6],['T.12.5.1',.4]],'MATEMATİK-T':[['E.M.9.3.4',.9],['E.M.9.3.4',.8],['E.M.9.3.6',.85],['E.M.9.3.6',.7]]};
const zpart=(tur,ad)=>{const dersler={};for(const [c,qs] of Object.entries(spec))dersler[c]=tur==='ozet'?qs.map(q=>q[0].split(',')):qs.map(q=>{const D=Math.round(q[1]*NZ);return [q[1],D,NZ-D,0,F.zorlukEtiketi(q[1])]});return {tur,ad,oturum:'TYT',...(tur==='madde'?{ogrenci:NZ}:{}),dersler}};
const konuRapor={ad:ADLAR[5],blocks:[F.block([F.row('T.12.1.1','a',[2,0,2,0]),F.row('T.12.1.2','b',[2,1,1,0]),F.row('T.12.3.1','c',[1,0,1,0]),F.row('T.12.5.1','d',[2,1,1,0])],'outcome','TÜRKÇE-T',S1),
  F.block([F.row('E.M.9.3.4','e',[2,0,2,0]),F.row('E.M.9.3.6','f',[2,0,2,0])],'outcome','MATEMATİK-T',S1)]};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:950},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-11-05T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   // The stored lists are built in the page from plain values. The latest exam (29 Ekim) has no Türkiye list.
   const veri={sir:siralama(s=>String(s||'').normalize('NFKC').toLocaleUpperCase('tr-TR').replace(/\s+/g,' ').trim()),raporlar:ADLAR.slice(0,5).map((_,e)=>rapor(e)),etut:etutSatir,yoklama,konu:konuRapor,
     zo:zpart('ozet',konuRapor.ad),zm:zpart('madde',konuRapor.ad)};
   await page.evaluate(async d=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-05';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};kaydet=async()=>true;
    D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',sinif:12,kap:6,off:[6],aktif:true}];
    D.siralama=d.sir;
    await TURKIYE.raporEkle(d.raporlar);
    const g=iso=>gunNo(iso),satirlar=d.etut.map(([iso,brans,hoca])=>({g:g(iso),brans,ogretmen:hoca,ad:'SENTETİK ADA',sinif:'12/A',saat:900,sure:40}));
    D.etut=ETUT.paketle(satirlar,[{bas:g('2026-10-01'),bit:g('2026-11-04'),n:satirlar.length,yaz:null,ts:3}],3);
    D.yoklama=YOKLAMA.paketle([{ad:'SENTETİK ADA',sinif:'12/A',gun:new Map(d.yoklama.map(([iso,k])=>[g(iso),k]))}],[{bas:g('2026-10-01'),bit:g('2026-11-04'),n:1,yaz:null,ts:3}],3);
    const K=KONU_TAKIBI,v=K.merge(K.blank(),[d.konu],[d.zo,d.zm]);v.exams[0].date='2026-10-29';D.konutakibi=v;
    D.denemeOrtHedef={TYT:{'':70,'12-A':75},'AYT:SAY':{'':60}};
    EK.sekme='denemeler';EK.denemeKlasik=undefined;ciz();
   },veri);
   // From Deneme panosu: a student's name opens the card; the page is not in the top menu but marks Öğrenciler.
   await page.waitForSelector('#dpKok #dpTablo');
   assert.equal(await page.locator('#ray [data-sekme="ogrencikarti"]').count(),0,'not a menu item');
   await page.locator('#dpTablo .et-ad[data-ogrenci-karti="1001"]').click();
   await page.waitForSelector('#okKok #okGrafik svg path.ok-cizgi',{state:'attached'});
   assert.equal(await page.evaluate(()=>[EK.sekme,EK.okKim,EK.okGeri]).then(a=>a.join()),'ogrencikarti,1001,denemeler');
   assert.equal(await page.locator('#okAd').innerText(),'Sentetik Ada');
   assert.match(await page.locator('#okKimlik').innerText(),/^12\/A · Alan: SAY · No 1001 · 6 TYT denemesi$/);
   assert.equal(await page.locator('#ray .menu-grup button[data-sekme="ogrenciler"][aria-current="page"]').count(),1,'Öğrenciler marks where the card opens from');
   // The figure cards, each with a label that explains its number.
   const kartlar=await page.locator('#okKartlar .et-ozet-kart').evaluateAll(l=>l.map(k=>({ad:k.querySelector('.mini').textContent,deger:k.querySelector('strong').textContent,alt:k.querySelector('.et-ozet-alt').textContent})));
   assert.deepEqual(kartlar.map(k=>k.ad),['Son TYT neti','Türkiye’ye göre','Beklenenden','İstikrar','Hedef · son deneme','Aralıkta değişim · 24 Eyl → 29 Eki','Şube hedefi · 12-A']);
   assert.match(kartlar[0].deger,/^\d+,\d\d$/);assert.match(kartlar[0].alt,/^Okulda \d+\. \/ \d+ öğrenci$/);
   // The latest exam has no Türkiye list: the cards use the tahmini Türkiye ortalaması and say so.
   assert.match(kartlar[1].deger,/^[▲▼]\d+,\d\d net$/);assert.match(kartlar[1].alt,/^tahmini Türkiye ortalaması \(okul ortalamasından\) \d+,\d\d net$/);
   assert.match(kartlar[2].deger,/^[▲▼]\d+,\d\d net$/);assert.equal(kartlar[2].alt,'tahmini Türkiye ortalamasına göre her zamanki yerinden');
   assert.match(kartlar[3].alt,/^± \d+,\d\d net · son 6 deneme$/);
   assert.match(kartlar[4].deger,/^\d+,\d\d net$/);assert.match(kartlar[4].alt,/^tahmini Türkiye [+−]\d+,\d\d · [▲▼]\d+,\d\d net hedefin (altında|üstünde)$/);
   assert.match(kartlar[5].deger,/^[▲▼]\d+,\d\d net$/);assert.match(kartlar[5].alt,/^6 deneme · deneme başına [▲▼]\d+,\d\d$/);
   assert.match(kartlar[6].deger,/^75,00 net$/);assert.match(kartlar[6].alt,/^Son net hedefin \d+,\d\d net (altında|üstünde)$/);
   const yazi=await page.locator('#okKok').innerText();assert(!/Nasıl okunur|Gözlem|\bham\b|\(%95\)/i.test(yazi),'no manual words');
   // The sections, in order.
   const sira=await page.evaluate(()=>['okAd','okKartlar','okGrafik','okDersler','okZayif','okEtut','okDevam'].map(id=>document.getElementById(id).getBoundingClientRect().top+scrollY));
   assert.deepEqual([...sira].sort((a,b)=>a-b),sira,'sections in order: '+sira);
   // The chart is drawn at the box's real width; lines are named at their right ends, none overlaps, nothing leaves the box.
   const g=await page.evaluate(()=>{
    const kutu=document.querySelector('#okGrafik .et-grafik'),svg=kutu.querySelector('svg'),s=svg.getBoundingClientRect(),k=kutu.getBoundingClientRect();
    const yazilar=[...svg.querySelectorAll('text.ok-ad')].map(t=>{const r=t.getBoundingClientRect();return {t:t.textContent,top:r.top,bottom:r.bottom,left:r.left,right:r.right,font:parseFloat(getComputedStyle(t).fontSize)}});
    const tum=[...svg.querySelectorAll('text')].map(t=>parseFloat(getComputedStyle(t).fontSize));
    return {w:s.width,attr:Number(svg.getAttribute('width')),kw:kutu.clientWidth,kutuSag:k.right,yollar:svg.querySelectorAll('path.ok-cizgi').length,noktalar:svg.querySelectorAll('circle.ok-nokta:not(.bos)').length,bos:svg.querySelectorAll('circle.ok-nokta.bos').length,yazilar,enKucuk:Math.min(...tum)};
   });
   assert(Math.abs(g.w-g.kw)<=1&&g.attr===g.kw,'drawn at the real width '+JSON.stringify([g.w,g.attr,g.kw]));
   assert.equal(g.noktalar,6);assert.equal(g.bos,1,'the one estimated Türkiye point is hollow');assert(g.enKucuk>=12,'type is real pixels: '+g.enKucuk);
   assert.deepEqual(g.yazilar.map(y=>y.t).sort(),(width<520?['Gidişat','Hedef yolu','Okul','Türkiye','Öğrenci','Şube hedefi']:['Gidişat','Hedef yolu','Okul ortalaması','Türkiye ortalaması','Öğrenci','Şube hedefi']).sort());
   // Labels in one column (the YKS end, the end of the data) stand apart; a label's block is its name and value, 28 px.
   for(const x of new Set(g.yazilar.map(y=>Math.round(y.left)))){const srl=g.yazilar.filter(y=>Math.round(y.left)===x).sort((a,b)=>a.top-b.top);for(let i=1;i<srl.length;i++)assert(srl[i].top>=srl[i-1].top+27,'labels overlap: '+srl.map(y=>y.t+':'+y.top))}
   assert(g.yazilar.every(y=>y.right<=g.kutuSag+1),'labels stay inside the box: '+g.yazilar.map(y=>y.right)+' / '+g.kutuSag);
   // Tables: every numeric header ends where its numbers end.
   for(const id of ['okDersler','okZayif','okEtut']){
    const sonuc=await page.evaluate(id=>{
     const tablo=document.querySelector('#'+id+' table'),basl=[...tablo.querySelectorAll('thead th')],ilk=tablo.querySelector('tbody tr'),sat=[...ilk.children];
     return basl.map((th,i)=>({ad:th.textContent,sayi:th.classList.contains('sayi'),thSag:th.getBoundingClientRect().right,tdSag:sat[i].getBoundingClientRect().right,thAlign:getComputedStyle(th).textAlign,tdAlign:getComputedStyle(sat[i]).textAlign,n:basl.length===sat.length}));
    },id);
    assert(sonuc.every(c=>c.n),id+' header and row have the same columns');assert(sonuc.filter(c=>c.sayi).length>=1,id+' has numeric columns');
    for(const c of sonuc.filter(c=>c.sayi)){assert(Math.abs(c.thSag-c.tdSag)<=2,id+' · '+c.ad+': header right '+c.thSag+' vs numbers '+c.tdSag);assert.equal(c.thAlign,'right');assert.equal(c.tdAlign,'right')}
   }
   assert.deepEqual(await page.locator('#okDersler thead th').allTextContents(),['Ders','Başta','Sonda','Değişim','Deneme başına','Türkiye’ye göre (son)']);
   assert.equal(await page.locator('#okDersler tbody tr').count(),10);
   assert.deepEqual(await page.locator('#okZayif thead th').allTextContents(),['Konu','Zorluğa göre (soru)','Son deneme (%)']);
   const zayif=await page.locator('#okZayif tbody tr .ok-konu').allInnerTexts();assert(zayif.length>=2&&zayif.length<=5&&zayif.some(t=>/Üslü İfadeler/.test(t)),zayif.join('|'));
   // Etüt: Matematik 3 (A twice, B once), Fizik 1, Türkçe 1; the 2 Kasım Türkçe and 19 Ekim count, the 2 Ekim Kimya is 34 days back.
   assert.deepEqual(await page.locator('#okEtut tbody tr').evaluateAll(l=>l.map(r=>[r.children[0].textContent,r.children[1].textContent])),[['Matematik','3'],['Fizik','1'],['Türkçe','1']]);
   assert.match(await page.locator('#okEtut .et-kart-bas .mini').innerText(),/^5 etüt · son kayıt 4 Kas$/);
   // Devamsızlık: 9 Ekim (whole), 20 and 27 Ekim (half: four and three lessons missed) and 3 Kasım (whole); 26 Ekim is a full day at school.
   assert.deepEqual(await page.locator('#okDevam .ok-gunler li').allInnerTexts(),['9 Eki tam gün','20 Eki yarım gün','27 Eki yarım gün','3 Kas tam gün']);
   // Selector: another student by name.
   await page.locator('#okAra').fill('Sentetik Öğrenci 04 · 12/B · 1004');await page.locator('#okAra').dispatchEvent('change');
   await page.waitForFunction(()=>document.getElementById('okAd').textContent==='Sentetik Öğrenci 04');
   assert.match(await page.locator('#okEtut').innerText(),/Son 30 günde etüt yok/);assert.match(await page.locator('#okDevam').innerText(),/Yoklama kaydı yok/);
   assert.match(await page.locator('#okZayif').innerText(),/Konu Takibi’nde bu öğrenci yok/);
   assert.match(await page.locator('#okKartlar .et-ozet-kart:last-child .mini').first().innerText(),/^Sınıf hedefi$/);
   await page.locator('#okAra').fill('1001');await page.locator('#okAra').press('Enter');
   await page.waitForFunction(()=>document.getElementById('okAd').textContent==='Sentetik Ada');
   // TYT / AYT: the switch appears for a student with both.
   assert.deepEqual(await page.locator('[data-ok-oturum]').allInnerTexts(),['TYT','AYT · SAY']);
   await page.locator('[data-ok-oturum="AYT:SAY"]').click();
   await page.waitForFunction(()=>/Son AYT · SAY neti/.test(document.getElementById('okKartlar').textContent));
   await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   assert.equal(await page.locator('[data-ok-oturum="AYT:SAY"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#okGrafik svg circle.ok-nokta:not(.bos)').count(),3);
   await page.locator('[data-ok-oturum="TYT"]').click();
   await page.waitForFunction(()=>/Son TYT neti/.test(document.getElementById('okKartlar').textContent));
   await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   // The chart: nothing outside the box, every leader horizontal and no vertical tick, and every line over its own points only.
   const grafikDenetle=async ad=>{
    const r=await page.evaluate(()=>{
     const kutu=document.querySelector('#okGrafik .et-grafik'),svg=kutu.querySelector('svg'),sr=svg.getBoundingClientRect(),kr=kutu.getBoundingClientRect();
     const disarida=[...svg.querySelectorAll('*')].filter(e=>!e.closest('defs')&&!e.matches('line.et-kural')).filter(e=>{const b=e.getBoundingClientRect();return b.width+b.height>0&&(b.left<sr.left-1||b.right>sr.right+1||b.top<sr.top-1||b.bottom>sr.bottom+1)}).map(e=>e.tagName+'.'+e.getAttribute('class'));
     const bag=[...svg.querySelectorAll('line.ok-bag')].map(l=>[l.getAttribute('y1')===l.getAttribute('y2'),l.getAttribute('x1')!==l.getAttribute('x2')]);
     const dikey=[...svg.querySelectorAll('.ok-etiket line,line.ok-bag')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')).length;
     const yazilar=[...svg.querySelectorAll('text')].map(t=>t.getBoundingClientRect().right);
     const cx=[...svg.querySelectorAll('circle.ok-nokta:not(.bos)')].map(c=>c.getBoundingClientRect().left+c.getBoundingClientRect().width/2);
     const kutuAra=id=>{const l=[...svg.querySelectorAll('path[data-ok="'+id+'"]:not([data-gelecek]):not([data-tahmini])')].map(p=>p.getBoundingClientRect());return l.length?[Math.min(...l.map(b=>b.left)),Math.max(...l.map(b=>b.right))]:null};
     return {disarida,bag,dikey,sag:Math.max(...yazilar)<=kr.right+1,cx:[Math.min(...cx),Math.max(...cx)],okul:kutuAra('okul'),ogr:kutuAra('ogr'),tr:kutuAra('tr'),hedef:kutuAra('hedef'),
      etiket:[...svg.querySelectorAll('text.ok-ad')].map(t=>t.textContent)};
    });
    assert.deepEqual(r.disarida,[],ad+': nothing outside the chart box');assert(r.bag.every(([a,b])=>a&&b),ad+': leaders are horizontal');assert.equal(r.dikey,0,ad+': no vertical ticks on the labels');assert(r.sag,ad+': labels stay inside the box');
    for(const k of ['okul','ogr','hedef'])assert(r[k]&&r[k][0]>=r.cx[0]-3&&r[k][1]<=r.cx[1]+3,ad+': '+k+' is drawn over its own points only '+JSON.stringify([r[k],r.cx]));
    return r;
   };
   assert.deepEqual(await page.locator('[data-ok-aralik]').allInnerTexts(),['Son 1 ay','Son 3 ay','Tümü']);
   assert.equal(await page.locator('[data-ok-aralik="tumu"]').getAttribute('aria-pressed'),'true','Tümü is the default');
   let gr=await grafikDenetle('Tümü');assert(gr.etiket.includes('Gidişat'),'the trend runs to the YKS date');
   assert.match(await page.locator('#okGrafik .et-tik.ok-yks').textContent(),width<520?/^YKS$/:/^YKS · 19 Haz$/);
   assert.match(await page.locator('#okNotlar').innerText(),/^Gidişat · YKS’de ~\d+ net[\s\S]*\nGidişat hedefin [\d,]+ net (altında|üstünde) · hedef yolu YKS’de \d+ net\nOkul ortalaması 27-YKS-1205 denemesinde Türkiye’ye göre her zamankinden [▲▼][\d,]+ net (iyi|kötü)$/);
   // The x-axis is the order of the exams: the six exams (a week apart) are equally spaced, each dated under its point; the YKS is one separate column after a gap.
   const geo=await page.evaluate(()=>{
    const svg=document.querySelector('#okGrafik .et-grafik svg'),c=e=>{const b=e.getBoundingClientRect();return b.left+b.width/2},sr=svg.getBoundingClientRect();
    const ogr=[...svg.querySelectorAll('circle.ok-nokta[data-ok="ogr"]')].map(c),yks=[...svg.querySelectorAll('circle.ok-yks-nokta')].map(c);
    const axis=[...svg.querySelectorAll('line.et-eksen:not(.ok-ayrac)')],R=Math.max(...axis.map(a=>a.getBoundingClientRect().right));
    const ticks=[...svg.querySelectorAll('text.et-tik:not(.ok-tarih):not(.ok-yks)')].filter(t=>/^\d+$/.test(t.textContent)&&t.getAttribute('text-anchor')==='end').map(t=>({t:Number(t.textContent),y:t.getBoundingClientRect().top}));
    const gridTop=Math.min(...[...svg.querySelectorAll('line.et-izgara:not(.ok-sinav)')].map(l=>l.getBoundingClientRect().top)),son=ogr[ogr.length-1];
    // Past her last exam only the YKS column may hold anything but the margin labels: lines over data end at her last exam.
    const veri=[...svg.querySelectorAll('path.ok-cizgi:not([data-gelecek]),circle.ok-nokta')].map(e=>e.getBoundingClientRect().right);
    const dates=[...svg.querySelectorAll('text.ok-tarih')].map(t=>t.textContent);
    return {ogr,yks,R,ticks,top:Math.max(...ticks.map(t=>t.t)),topY:Math.min(...ticks.map(t=>t.y)),gridTop,veriSag:Math.max(...veri),son,dates,ayrac:svg.querySelector('line.ok-ayrac')?.getBoundingClientRect().left,sutun:!!svg.querySelector('rect.ok-yks-sutun'),sr:sr.right};
   });
   assert.equal(geo.ogr.length,6);const fark=geo.ogr.slice(1).map((x,i)=>x-geo.ogr[i]);assert(Math.max(...fark)-Math.min(...fark)<=0.5,'equally spaced exams: '+fark);
   assert.equal(geo.yks.length,2,'two end markers in the YKS column');assert(geo.yks.every(x=>Math.abs(x-geo.yks[0])<=0.5),'both at the same x');
   assert(Math.abs(geo.yks[0]-geo.son-2*fark[0])<=1,'the YKS column is two slots after the last exam');assert(geo.ayrac>geo.son&&geo.ayrac<geo.yks[0],'a divider in the gap');assert(geo.sutun);
   assert(geo.veriSag<=geo.son+6,'no data line runs past her last exam (only the two short dashed segments do)');assert(geo.yks[0]<=geo.R,'the column is inside the plot');
   assert.equal(geo.top,120,'the top tick is the maximum');assert(Math.abs(geo.topY-geo.gridTop)<=8,'and it is at the top of the plot');
   assert.deepEqual(geo.dates.slice(-1),['29 Eki'],'the last exam is always dated: '+geo.dates);if(width>=1280)assert.deepEqual(geo.dates,['24 Eyl','1 Eki','8 Eki','15 Eki','22 Eki','29 Eki']);
   assert.equal(await page.locator('#okGrafik svg path.ok-cizgi[data-gelecek]').count(),2,'one short dashed segment per end marker');
   // Son 1 ay: the earliest exam within a month of the latest (1 Ekim) → the latest; the lesson table and the change card follow.
   await page.locator('[data-ok-aralik="1ay"]').click();await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   assert.equal(await page.locator('[data-ok-aralik="1ay"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#okKartlar .et-ozet-kart').nth(5).innerText(),/^Aralıkta değişim · 1 Eki → 29 Eki\n[▲▼]\d+,\d\d net\n5 deneme · deneme başına [▲▼]\d+,\d\d$/);
   assert.match(await page.locator('#okDersler .et-kart-bas .mini').innerText(),/^ders neti · 1 Eki → 29 Eki · 5 deneme$/);
   const hucreler=()=>page.evaluate(()=>[...document.querySelector('#okDersler tbody tr').children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.textContent));
   assert.deepEqual(await hucreler(),width<640?['Türkçe','26,00','31,00','▲5,00','—']:['Türkçe','26,00','31,00','▲5,00','▲1,25','—'],'Başta, Sonda, Değişim, Deneme başına (not on a phone), Türkiye’ye göre (son)');
   gr=await grafikDenetle('Son 1 ay');assert(gr.etiket.includes('Gidişat'),'a range that ends at her last exam keeps the YKS column');
   await page.locator('#okGrafik').screenshot({path:path.join(out,'ogrencikarti-grafik-1ay-'+width+'.png')});
   await page.locator('[data-ok-aralik="3ay"]').click();await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   assert.match(await page.locator('#okKartlar .et-ozet-kart').nth(5).innerText(),/^Aralıkta değişim · 24 Eyl → 29 Eki[\s\S]*6 deneme/);
   // Dragging on the chart measures and, on release, becomes the range: 1 Ekim → 15 Ekim (the second to the fourth exam).
   await page.locator('[data-ok-aralik="tumu"]').click();await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   const nokta=i=>page.evaluate(i=>{const c=document.querySelectorAll('#okGrafik svg circle.ok-nokta:not(.bos)')[i].getBoundingClientRect();return {x:c.left+c.width/2,y:c.top+c.height/2}},i);
   await page.locator('#okGrafik').scrollIntoViewIfNeeded();
   const a=await nokta(1),b=await nokta(3);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
   assert.match((await page.locator('#okGrafik .olc-yazi').innerText()).replace(/\s+/g,' '),/^Öğrenci · 1 Eki → 15 Eki · [\d,]+ → [\d,]+ net [▲▼]/);
   assert.equal(await page.locator('#okGrafik .olc-ortu').count(),1,'the range is shaded while measuring');
   await page.mouse.up();
   await page.waitForFunction(()=>/1 Eki → 15 Eki/.test(document.getElementById('okKartlar').textContent));
   assert.equal(await page.locator('[data-ok-aralik][aria-pressed="true"]').count(),1);assert.equal(await page.locator('[data-ok-aralik="sec"]').innerText(),'1 Eki → 15 Eki');
   assert.match(await page.locator('#okKartlar .et-ozet-kart').nth(5).innerText(),/^Aralıkta değişim · 1 Eki → 15 Eki[\s\S]*3 deneme · deneme başına/);
   assert.deepEqual((await hucreler()).slice(0,4),['Türkçe','26,00','28,00','▲2,00']);
   await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});gr=await grafikDenetle('dragged range');assert(!gr.etiket.includes('Gidişat'));
   assert.equal(await page.locator('#okGrafik .olc-ortu').count(),0,'nothing left over from measuring');
   // Another student: the dragged range is dropped, the presets stay.
   await page.locator('[data-ok-aralik="tumu"]').click();await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   assert.equal(await page.locator('[data-ok-aralik="sec"]').count(),0);
   await page.waitForSelector('#okGrafik svg path.ok-cizgi',{state:'attached'});
   // No page scrolls sideways; no panel overflows; tables fit their boxes.
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no sideways scrolling');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#okKok .et-panel')].every(p=>p.scrollWidth<=p.clientWidth+1)),true,'panels do not overflow');
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#okKok .et-tablo-kutu')].filter(k=>k.scrollWidth>k.clientWidth+1).map(k=>k.parentElement.id)),[],'tables fit');
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#okKok th,#okKok td')].filter(c=>c.getBoundingClientRect().width>0&&c.scrollWidth>c.clientWidth+1).map(c=>c.textContent)),[],'no cut-off cells');
   // A resize redraws the chart at the new width.
   if(width===1280){await page.setViewportSize({width:900,height:950});await page.waitForFunction(()=>{const k=document.querySelector('#okGrafik .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth});await page.setViewportSize({width:1280,height:950});await page.waitForFunction(()=>{const k=document.querySelector('#okGrafik .et-grafik');return Number(k.querySelector('svg').getAttribute('width'))===k.clientWidth})}
   await page.evaluate(()=>scrollTo(0,0));
   await page.locator('#okGrafik').screenshot({path:path.join(out,'ogrencikarti-grafik-'+width+'.png')});
   await page.screenshot({path:path.join(out,'ogrencikarti-'+width+'.png'),fullPage:true});
   // The way back.
   await page.locator('[data-sekme="denemeler"]',{hasText:'← Denemeler'}).click();
   await page.waitForSelector('#dpKok #dpTablo');assert.equal(await page.evaluate(()=>EK.sekme),'denemeler');
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS Öğrenci kartı at '+width+' px ('+tema+')');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
