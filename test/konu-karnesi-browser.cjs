// Deneme karnesi and Denemeye göre ayarla in a real browser, at 1280 light, 1280 dark and 390 dark. The student: the slides on their Yanlışlar
// defteri (konular, denemeler, dersler and the questions with all five bands; all exams or one; ‹ › moves along the slides; no sideways page scroll
// on a phone), and Hafızam's button (press, confirm, Geri al), which never lowers a topic. The rehber: Yanlışlar defteri → Öğrenciye deneme karnesi
// with a student's slides and Öğrenciye yayınla. Synthetic data, no Firebase. Set YKS_UI_ARTIFACTS to keep the screenshots.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),Y=require('./yanlislar-fixtures.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-karne-'));fs.mkdirSync(out,{recursive:true});
const PERF=[{ad:'TÜRKÇE-T',n:4,anahtar:Y.KEY_A.slice(0,4),p:[.9,.8,.2,.1]},{ad:'TARİH-T',n:2,anahtar:Y.KEY_A.slice(4,6),p:[.6,.4]},
  {ad:'DİN KÜLTÜRÜ-T',n:2,anahtar:Y.KEY_A.slice(6,8),p:[.9,.95]},{ad:'S.FELSEFE-T',n:2,anahtar:Y.KEY_A.slice(8,10),p:[.55,.02]}];
// The karne (v2): per exam its konu names and, per ders, every question [no, konu index, band 0–4, result]. kv: a konu's questions from its totals
// (d of n right; kd of kn easy, band 1; zd of zn hard, band 3; the rest orta).
const kv=(k,d,n,kd,kn,zd,zn)=>{const q=[],ekle=(adet,dogru,z)=>{for(let i=0;i<adet;i++)q.push([k,z,i<dogru?1:0])};ekle(kn,kd,1);ekle(zn,zd,3);ekle(n-kn-zn,d-kd-zd,2);return q};
const ders=(ad,qs)=>[ad,'TYT','A',qs.flat().map((q,i)=>[i+1,...q])];
// Eight topics in the newer exam, one in the older; Matematik names reach the map (Sayı Kümeleri, Üslü İfadeler ve Denklemler).
const KARNE={v:2,t:0,s:[['SENTETİK-1205','2026-11-01',['Sayı Kümeleri','Üslü İfadeler ve Denklemler','Bölünebilme Kuralları','Kümelerde Temel Kavramlar','Sözcükte Anlam','Cümlede Anlam','Paragrafta Anlam','Tarih ve Zaman'],
  [ders('Matematik',[kv(0,3,3,2,2,1,1),kv(1,2,2,1,1,1,1),kv(2,3,5,3,3,0,2),kv(3,1,4,1,2,0,2)]),ders('Türkçe',[kv(4,4,5,3,3,1,2),kv(5,2,4,2,2,0,2),kv(6,9,12,5,5,2,4)]),ders('Tarih',[kv(7,1,2,0,0,0,0)])]],
  ['SENTETİK-1203','2026-10-01',['Üslü İfadeler ve Denklemler'],[ders('Matematik',[kv(0,3,3,1,1,2,2)])]]]};
const ogrenciKur=karne=>{
  D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'Sentetik Öğrenci',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];
  EK={ogr:0,sekme:'yanlisim',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};
  kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2027-04-23');
  karne.t=bugunNo();D.konuKarne=karne;ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[1280,'dark'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:tema,deviceScaleFactor:width>600?1:2}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   /* ---- the student's slides ---- */
   await page.evaluate(ogrenciKur,KARNE);await page.locator('.kk[data-kk-yer="ogrenci"]').waitFor();
   assert.equal(await page.locator('.kk-slayt').count(),8,'one slide per konu');
   assert.equal(await page.locator('.kk-sayac').innerText(),'8 konu');
   const ilk=page.locator('.kk-slayt').first();
   assert.match(await ilk.innerText(),/TYT MATEMATİK\n+Sayı Kümeleri[\s\S]*Kolay sorular\n%100\n2 \/ 2 doğru[\s\S]*Zor sorular\n%100\n1 \/ 1 doğru/i);
   const kutu=await ilk.boundingBox();assert(kutu.width>=240&&kutu.width<=(width>600?300:390),'a slide is a card: '+kutu.width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways page scroll');
   const seri=page.locator('.kk-seri');
   assert(await seri.evaluate(el=>el.scrollWidth>el.clientWidth),'more slides than fit: they scroll');
   assert.equal(await ilk.locator('.kk-bantlar tr').count(),5,'Çok kolay, Kolay, Orta, Zor, Çok zor');
   await page.locator('[data-kk-git="1"]').click();await page.waitForFunction(()=>document.querySelector('.kk-seri').scrollLeft>100);
   await page.screenshot({path:path.join(out,`karne-ogrenci-${width}-${tema}.png`),fullPage:width<600});
   // the other levels: every exam, every ders, and the questions (a slide per exam and ders with each question)
   for(const [duzey,sayac,adet] of [['deneme','2 deneme',2],['ders','3 ders',3],['soru','4 ders',4]]){
    await page.locator(`[data-kk-duzey="${duzey}"]`).click();await page.waitForFunction(s=>document.querySelector('.kk-sayac')?.textContent===s,sayac);
    assert.equal(await page.locator('.kk-slayt').count(),adet,duzey);
    if(duzey!=='soru')assert.equal(await page.locator('.kk-slayt').first().locator('.kk-bantlar tr').count(),5,'all five bands');
    else assert.match(await page.locator('.kk-slayt').first().locator('.kk-soru-tablo tbody tr').first().innerText(),/^1\s+Sayı Kümeleri\s+Kolay\s+Doğru$/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways page scroll: '+duzey);
    await page.locator('.kk').screenshot({path:path.join(out,`karne-ogrenci-${width}-${tema}-${duzey}.png`)});
   }
   await page.locator('[data-kk-duzey="konu"]').click();await page.waitForFunction(()=>document.querySelector('.kk-sayac')?.textContent==='8 konu');
   // only the older exam: one konu
   await page.locator('[data-kk-sinav="1"]').click();await page.waitForFunction(()=>document.querySelector('.kk-sayac')?.textContent==='1 konu');
   assert.equal(await page.locator('[data-kk-sinav="hepsi"]').getAttribute('aria-pressed'),'false');
   await page.locator('[data-kk-sinav="hepsi"]').click();await page.waitForFunction(()=>document.querySelector('.kk-sayac')?.textContent==='8 konu');
   /* ---- Hafızam: Denemeye göre ayarla reads the karne, raises, Geri al ---- */
   await page.evaluate(()=>{EK.sekme='hafiza';ciz()});await page.locator('[data-deneme-ayarla]').waitFor();
   assert.match(await page.locator('.hm-deneme').innerText(),/Hiçbir konu aşağı inmez/);
   const once=await page.evaluate(()=>[...HARITAM.durum(0).satir.values()].filter(s=>s.r!==null).map(s=>[s.id,s.rOz]));
   await page.locator('[data-deneme-ayarla]').click();await page.locator('[data-deneme-geri]').waitFor();
   const sonra=await page.evaluate(()=>Object.fromEntries([...HARITAM.durum(0).satir.values()].map(s=>[s.id,s.rOz])));
   for(const [id,r] of once)assert(sonra[id]>=r-1e-9,id+' never lowered');
   assert.equal(await page.evaluate(()=>HARITAM.durum(0).satir.get('tytUslu').katman),'uzun','hard questions in two exams: long-term');
   assert.equal(sonra.tytKume,Object.fromEntries(once).tytKume??null,'a weak topic (Kümeler, 1 of 4) stays exactly as it was');
   await page.screenshot({path:path.join(out,`karne-hafizam-${width}-${tema}.png`)});
   await page.locator('[data-deneme-geri]').click();await page.waitForFunction(()=>D.ogr[0].hafizaElle===undefined);
   /* ---- the rehber: Öğrenciye konu karnesi ---- */
   if(width>600){
    await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ogr=[];EK={ogr:0,sekme:'yanlislar',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};ciz()});
    await page.waitForFunction(()=>YANLISLAR.durumu().kutYuklendi===true);
    await page.evaluate(async({rapor,kit,perf,harita,ozet})=>{
     const r=await YANLISLAR.raporCoz(Uint8Array.from(atob(rapor),c=>c.charCodeAt(0)));
     YANLISLAR.denemeKoy({kitlar:{TYT:YANLISLAR.kitapcikCoz(kit)},rapor:r,pairs:{TYT:harita},perf:YANLISLAR.performansCoz(perf)});
     D.konutakibi={};KONU_TAKIBI.oku=()=>({veri:{maps:{},zorluk:{x:{ad:r.ad,ozet}}}});ciz();
    },{rapor:Buffer.from(Y.raporXlsx({method:8})).toString('base64'),kit:Y.kitapcikSayfalari(),perf:Y.itemlere(Y.performansSpec({dersler:PERF})),harita:Y.HARITA,
      ozet:{'TÜRKÇE-T':[['T.12.1.1'],['T.12.1.2'],['T.12.3.1'],['T.12.3.2']],'TARİH-T':[['E.TAR.9.1.1'],['E.TAR.9.1.2']]}});
    await page.locator('[data-yd-gorunum="karne"]').click();await page.locator('.kk[data-kk-yer="ogretmen"]').waitFor();
    assert.equal(await page.locator('.kk[data-kk-yer="ogretmen"] .kk-slayt').count(),3);
    assert.match(await page.locator('.yd-kk-durum').innerText(),/Henüz öğrencilere gitmiyor/);
    await page.locator('[data-yd-kk-yayinla]').click();await page.waitForFunction(()=>D.konuKarneYayin&&D.konuKarneYayin.mod==='hepsi');
    assert.match(await page.locator('.yd-kk-durum').innerText(),/Öğrencilere gidiyor: bütün denemeler/);
    await page.locator('[data-yd-f="kkOgr"]').selectOption('9002');await page.waitForFunction(()=>YANLISLAR.durumu().kkOgr==='9002');
    assert.match(await page.locator('.kk[data-kk-yer="ogretmen"] .kk-slayt').first().innerText(),/Sözcükte Anlam[\s\S]*%100\n2 \/ 2 doğru/);
    await page.locator('.yd-kk-yayin').screenshot({path:path.join(out,`karne-ogretmen-${width}-${tema}-yayin.png`)});
    await page.screenshot({path:path.join(out,`karne-ogretmen-${width}-${tema}.png`),fullPage:true});
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS deneme karnesi and Denemeye göre ayarla in the browser · '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
