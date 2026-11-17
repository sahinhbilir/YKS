// Haritam in a real browser: the tab, every map topic drawn, hover shows the real Hafızam card and lights the
// neighbours, a click pins it and "Çalıştım" opens Hafızam's own slider in the map, no page errors; 1280 px dark and
// light, 390 px dark with the card under the map and no sideways scrolling. Synthetic student, no Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-haritam-'));fs.mkdirSync(out,{recursive:true});
const kur=()=>{
  D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'Sentetik Öğrenci',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];
  EK={ogr:0,sekme:'haritam',hafta:null,girisAcik:{}};bulutYedekPlanla=()=>{};
  kendiPlanKur(0,Object.fromEntries(kendiPlanDersleri('SAY').map(d=>[d,'bilir'])),'2027-04-23');
  const k=HARITAM.kaynaklar(),b=bugunNo(),plan={geoAci:[[-75,3],[-60,3],[-30,3]],geoDik:[[-55,3],[-35,2],[-10,3]],tytKok:[[-80,3],[-50,3],[-15,3],[-2,4]],
    aytBirim:[[-16,3],[-6,3]],aytOzdeslik:[[-10,2],[-3,1]],fizVektor:[[-60,3],[-30,3]],fizAtis:[[-12,3]]},satir=[];
  for(const [id,l] of Object.entries(plan)){const ki=k.get(id)[0];for(const [g,n] of l)satir.push({ki,gun:b+g,not:n,dogru:null,soru:null})}
  sonucIsle(0,satir);ciz();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'dark'],[1280,'light'],[390,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:tema}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('dialog: '+d.message());d.accept()});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(kur);await page.locator('.hm-sayfa').waitFor();
   assert.equal(await page.locator('button[data-sekme="haritam"]').count(),1,'Haritam in the menu');
   assert.equal(await page.locator('.hm-d').count(),await page.evaluate(()=>HARITA_VERI.konular.length),'every map topic drawn');
   const zemin=await page.evaluate(()=>getComputedStyle(document.querySelector('.hm-svg')).backgroundColor);
   assert.equal(zemin,tema==='dark'?'rgb(14, 14, 15)':'rgb(255, 255, 255)','neutral sky, never blue');
   if(width>600){
    await page.locator('.hm-d[data-hm="aytBirim"]').hover();
    await page.locator('[data-hm-kart] .hf-oge').waitFor();
    assert.equal(await page.locator('.hm-svg.hm-odak').count(),1,'neighbours lit');
    assert.equal(await page.locator('.hm-d.hm-yakin[data-hm="aytOzdeslik"]').count(),1,'a topic using it is lit');
    await page.screenshot({path:path.join(out,`haritam-${width}-${tema}-hover.png`)});
    await page.locator('.hm-d[data-hm="aytBirim"]').click();await page.waitForFunction(()=>EK.haritamSecili==='aytBirim');
    await page.locator('[data-hm-kart] [data-hf-ac]').click();await page.locator('[data-hm-kart] .ps-surgu').waitFor();
    await page.screenshot({path:path.join(out,`haritam-${width}-${tema}-pin.png`)});
    await page.locator('.hm-d[data-hm="aytBirim"]').click();await page.waitForFunction(()=>EK.haritamSecili===undefined);
    await page.locator('[data-hm-ders="Fizik"]').click();await page.waitForFunction(()=>EK.haritamDers==='Fizik');
    assert.equal(await page.locator('.hm-d[data-hm="geoDik"]').count(),0,'subject filter');
   } else {
    await page.locator('.hm-d[data-hm="aytOzdeslik"]').click();await page.locator('[data-hm-kart] .hf-oge').waitFor();
    const kart=await page.locator('[data-hm-kart]').boundingBox(),svg=await page.locator('.hm-svg').boundingBox();
    assert(kart.y>=svg.y+svg.height-1,'on a phone the card is under the map');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways scrolling');
    await page.screenshot({path:path.join(out,`haritam-${width}-${tema}.png`),fullPage:true});
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  // Teacher: Ayarlar → Öğrenci kalibrasyonu → Bağlantılı hafıza. "Bağları güncelle" learns over the notebook with a
  // progress bar and keeps the values in the notebook; the teacher opens a student's map from the same box.
  {
   const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'dark'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('dialog: '+d.message());d.accept()});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object'&&ACILIS_KAYIT>=0);
   await page.evaluate(()=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-11';bulutYedekPlanla=()=>{};
    const b=bugunNo(),dik=KATALOG.findIndex(k=>k[0]===1&&k[1]===9&&k[3]==='Dik Üçgen ve Trigonometri'),trig=KATALOG.findIndex(k=>k[0]===1&&k[1]===11&&k[3]==='Trigonometrik Fonksiyonlar');
    D.ogr=[];D.log=[];
    for(let s=0;s<12;s++){D.ogr.push({no:s+1,ad:'Öğrenci '+(s+1),sube:'12A',alan:'SAY',sinif:12,aktif:true});
      D.log.push([b-90,s,dik,null,null,3],[b-90,s,trig,null,null,3]);for(let g=b-84;g<b;g+=7)D.log.push([g,s,trig,null,null,3]);for(let g=b-80;g<b;g+=20)D.log.push([g,s,dik,null,null,s%3?3:1]);}
    EK={sekme:'ayarlar',ayarBolum:'kalibrasyon',hafta:null,girisAcik:{}};ciz();
   });
   await page.locator('#hmOgretmen').waitFor();assert.match(await page.locator('#hmOgretmen').innerText(),/Henüz güncellenmedi/);
   await page.locator('#hmOgren').click();await page.waitForFunction(()=>D.hafizaAg&&D.hafizaAg.son,null,{timeout:120000});
   await page.locator('#hmOgretmen').waitFor();assert.match(await page.locator('#hmOgretmen').innerText(),/12 öğrenci/);
   const p=await page.evaluate(()=>D.hafizaAg.parametreler.paylasilan['tytTrig>aytTrig']||D.hafizaAg.parametreler.paylasilan['geoDik>geoAlan']);
   assert(p&&Number.isFinite(p.kredi),'shared values stored in the notebook');
   await page.selectOption('#hmOgrSec','2');await page.locator('#hmOgrAc').click();
   await page.locator('.hm-sayfa').waitFor();assert.match(await page.locator('.hm-sayfa h1').innerText(),/Haritası · Öğrenci 3/);
   assert(await page.locator('.hm-d').count()>0);await page.screenshot({path:path.join(out,'haritam-ogretmen.png')});
   await page.locator('#hmGeri').click();await page.locator('#hmOgretmen').waitFor();
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Haritam browser: passed ('+out+')');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
