// Drag to measure and the Çizgi switch on Etütler and the Deneme panosu, on desktop (light) and at
// 390 px (dark, touch): the readout from the earlier point to the later one, the faded outside, the
// same dates on every other chart and mini graph, release and Esc, a short press that stays a click,
// a touch hold that measures and a swipe that does not, the Seç handles, the distribution chart left
// out, nothing saved, and köşeli / yumuşak lines. Synthetic data only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs');
const {okulListesi,SINAVLAR}=require('./fixtures/siralama-pdf.cjs');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-grafik-'));fs.mkdirSync(out,{recursive:true});
const listeler=['once','sonra'].flatMap(e=>['T','F'].map(t=>okulListesi(SINAVLAR[e][t]))).concat(['T','F'].map(t=>okulListesi({...SINAVLAR.once[t],ad:'Sentetik Tarama 1',tarih:'25.09.2026'})));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,tema] of [[1280,'light'],[390,'dark']]){
   const dokunmatik=width<500,context=await browser.newContext({viewport:{width,height:950},colorScheme:tema,hasTouch:dokunmatik}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-19T18:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(async([rapor,l])=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-19';D.ogr=[];EK.sekme='etutler';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};
    denemePdfSayfalari=async()=>structuredClone(rapor);await siralamaKaydet(l.map(x=>siralamaPdfCoz(x.pages,x.boylar)));ciz();
   },[etutRaporu(GUNLER),listeler]);
   await page.locator('#etPdf').setInputFiles([{name:'etut.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')}]);
   await page.waitForFunction(()=>document.querySelectorAll('#etKok .et-grafik svg').length===5);
   // Where point i of a chart is on the screen (sayfa: ETUT or DPANO; seri: one line's own point).
   const nokta=(sayfa,ad,i,seri)=>page.evaluate(([sayfa,ad,i,seri])=>{
    const P=sayfa==='ETUT'?ETUT:DPANO,k=document.querySelector('[data-'+(sayfa==='ETUT'?'et':'dp')+'-grafik="'+ad+'"]'),svg=k.querySelector('svg'),r=svg.getBoundingClientRect(),o=r.width/svg.viewBox.baseVal.width,g=P.CIZIMLER.get(ad);
    // Without a line: as far from every line as the plot allows, so none takes the stage.
    const bos=()=>{let en=[g.xs[i],150],ed=-1;for(let y=40;y<=260;y+=4){const d=Math.min(1e9,...(g.seriler||[]).map(s=>s.pts[i]?Math.abs(s.pts[i][1]-y):1e9));if(d>ed){ed=d;en=[g.xs[i],y]}}return en};
    const p=seri===undefined?bos():g.seriler[seri].pts[i];return {x:r.left+p[0]*o,y:r.top+p[1]*o}},[sayfa,ad,i,seri]);
   // Charts are brought to the middle of the screen: on a phone the menu stays on top.
   const goster=sel=>page.evaluate(sel=>document.querySelector(sel).scrollIntoView({block:'center'}),sel);
   const izler=()=>page.locator('g.olc-ortu,.olc-yazi,.olc-mini').count();
   const surukle=async(sayfa,ad,a,b,{birak=true}={})=>{await goster('[data-'+(sayfa==='ETUT'?'et':'dp')+'-grafik="'+ad+'"]');
    const p=await nokta(sayfa,ad,a),q=await nokta(sayfa,ad,b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,p.y,{steps:8});
    const yazi=await page.locator('.olc-yazi').innerText();if(birak)await page.mouse.up();return yazi.replace(/\s+/g,' ')};
   const ek=()=>page.evaluate(()=>JSON.stringify([EK.etSecA,EK.etSecB,EK.etDers,EK.etHoca,EK.etOgr,EK.dpOnceki,EK.dpSimdiki,EK.dpOgr,EK.dpDers]));

   /* ---------- Etütler ---------- */
   const once=await ek();
   // 14 Eyl → 12 Eki on the main chart: earlier to later, whichever way the pointer goes.
   let yazi=await surukle('ETUT','genel',1,5,{birak:false});
   assert.equal(yazi,'14 Eyl → 12 Eki · 2 → 11 etüt ▲ +9 (+%450,0)');
   assert.equal(await page.locator('[data-et-grafik="genel"] .et-ipucu').isHidden(),true,'no hover readout while measuring');
   assert.equal(await page.locator('[data-et-grafik="genel"] .olc-solgun').count(),2,'both sides fade');
   assert.equal(await page.locator('[data-et-grafik="genel"] .olc-ortu.yukari .olc-alan').count(),1,'a rise is tinted green');
   for(const ad of ['ders','hoca','ogrenci','kisi'])assert.equal(await page.locator('[data-et-grafik="'+ad+'"] g.olc-ortu').count(),1,ad+' shades the same weeks');
   assert.equal(await page.locator('.et-dersler .olc-mini').count(),12,'every subject and teacher card shows its change');
   assert.match(await page.locator('.et-ders[data-et-ders="Matematik"] .olc-mini').innerText(),/\+2/);
   assert(await page.locator('.et-tablo svg[data-olc-donem] g.olc-ortu').count()>0,'the table\'s mini graphs too');
   await page.screenshot({path:path.join(out,'grafik-etut-'+width+'.png')});
   await page.mouse.up();
   assert.equal(await izler(),0,'released: back to normal');assert.equal(await ek(),once,'nothing chosen or saved');
   assert.equal(await surukle('ETUT','genel',5,1),yazi,'dragged right to left: the same');
   // A chosen subject from a week with no etüt: the change without a percentage.
   await page.locator('.et-ders[data-et-ders="Geometri"]').click();await page.waitForFunction(()=>document.querySelectorAll('#etKok .et-grafik svg').length===5);
   assert.equal(await surukle('ETUT','ders',0,1),'Geometri · 7 Eyl → 14 Eyl · 0 → 1 etüt ▲ +1');
   await page.locator('[data-et-ders=""]').click();await page.waitForFunction(()=>document.querySelectorAll('#etKok .et-grafik svg').length===5);
   // With every subject drawn, a highlighted line is the one measured; a short press is still a click on it.
   const mat=await page.evaluate(()=>ETUT.CIZIMLER.get('ders').seriler.findIndex(s=>s.k==='Matematik'));
   await goster('[data-et-grafik="ders"]');
   let p=await nokta('ETUT','ders',5,mat),q=await nokta('ETUT','ders',1,mat);
   await page.mouse.move(p.x,p.y);await page.waitForFunction(()=>document.querySelector('[data-et-grafik="ders"]').dataset.seri!==undefined);
   await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:8});
   assert.equal((await page.locator('.olc-yazi').innerText()).replace(/\s+/g,' '),'Matematik · 14 Eyl → 12 Eki · 1 → 3 etüt ▲ +2 (+%200,0)');
   // Esc cancels; the release after it is not a click on the line.
   await page.keyboard.press('Escape');assert.equal(await izler(),0);await page.mouse.up();
   assert.equal(await page.evaluate(()=>EK.etDers??null),null,'Esc: no subject opened');
   await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+2,p.y);await page.mouse.up();
   await page.waitForFunction(()=>EK.etDers==='Matematik');
   assert.equal(await izler(),0);
   await page.locator('[data-et-ders=""]').click();await page.waitForFunction(()=>document.querySelectorAll('#etKok .et-grafik svg').length===5);
   if(dokunmatik){
    // Touch: a hold of 300 ms measures and the page does not scroll; a swipe without the hold does not measure.
    const cdp=await context.newCDPSession(page),dokun=(type,pt)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:Math.round(pt.x),y:Math.round(pt.y)}]:[]});
    await goster('[data-et-grafik="genel"]');
    p=await nokta('ETUT','genel',1);q=await nokta('ETUT','genel',5);const kaydir=await page.evaluate(()=>scrollY);
    await dokun('touchStart',p);await page.waitForTimeout(400);
    assert.match((await page.locator('.olc-yazi').innerText()).replace(/\s+/g,' '),/^14 Eyl · 2 etüt$/,'the hold shows its point');
    for(let k=1;k<=6;k++)await dokun('touchMove',{x:p.x+(q.x-p.x)*k/6,y:p.y+k*4});
    assert.equal((await page.locator('.olc-yazi').innerText()).replace(/\s+/g,' '),yazi);
    assert.equal(await page.evaluate(()=>scrollY),kaydir,'no scroll while measuring');
    await dokun('touchEnd');assert.equal(await izler(),0);
    await dokun('touchStart',p);for(let k=1;k<=6;k++)await dokun('touchMove',{x:p.x+(q.x-p.x)*k/6,y:p.y});
    assert.equal(await page.locator('.olc-yazi').count(),0,'a swipe is not a measurement');await page.waitForTimeout(400);
    assert.equal(await page.locator('.olc-yazi').count(),0);await dokun('touchEnd');
    assert.equal(await ek(),once);
   }
   // The Seç handles keep their own dragging.
   await page.locator('[data-et-aralik="sec"]').click();await page.waitForFunction(()=>document.querySelector('[data-tutamak="once"]'));
   await goster('[data-et-grafik="genel"]');
   const tut=await page.locator('[data-tutamak="once"] .et-tutamak-tut').boundingBox();p=await nokta('ETUT','genel',0);
   await page.mouse.move(tut.x+tut.width/2,tut.y+tut.height/2);await page.mouse.down();await page.mouse.move(p.x,tut.y+40,{steps:6});
   assert.equal(await izler(),0,'a handle is not a measurement');await page.mouse.up();
   await page.waitForFunction(()=>EK.etSecA===ETUT.model(ETUT.oku().veri).haftalar[0]);
   // Köşeli / yumuşak, remembered on the device and shared with the Deneme panosu.
   assert.equal(await page.locator('[data-et-cizgi="kose"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-et-grafik="genel"] path.et-cizgi:not(.kesik)').getAttribute('d').then(d=>/C/.test(d)),false);
   await page.locator('[data-et-cizgi="yumusak"]').click();await page.waitForFunction(()=>/C/.test(document.querySelector('[data-et-grafik="genel"] path.et-cizgi:not(.kesik)')?.getAttribute('d')||''));
   assert.equal(await page.evaluate(()=>localStorage.getItem('yks_grafik_cizgi')),'yumusak');
   assert(await page.locator('.et-dersler .et-kucuk[d*="C"]').count()>0,'mini graphs too');
   assert.equal(await surukle('ETUT','genel',1,5),yazi,'measuring is the same on curves');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');

   /* ---------- Deneme panosu ---------- */
   await page.evaluate(()=>{EK.sekme='denemeler';ciz()});await page.waitForFunction(()=>document.querySelectorAll('#dpKok .et-grafik svg').length>=5);
   assert.equal(await page.locator('[data-dp-cizgi="yumusak"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('[data-dp-grafik="genel"] path.et-cizgi').getAttribute('d'),/C/);
   await page.locator('[data-dp-cizgi="kose"]').click();await page.waitForFunction(()=>!/C/.test(document.querySelector('[data-dp-grafik="genel"] path.et-cizgi')?.getAttribute('d')||'C'));
   const dpOnce=await ek();
   yazi=await surukle('DPANO','genel',0,2,{birak:false});
   assert.equal(yazi,'18 Eyl → 2 Eki · 54,8 → 59,1 net ▲ +4,2 (+%7,7)');
   for(const ad of ['ders','ogrenci','kisi'])assert.equal(await page.locator('[data-dp-grafik="'+ad+'"] g.olc-ortu').count(),1,ad+' shades the same exams');
   assert.equal(await page.locator('[data-dp-grafik="dagilim"] g.olc-ortu').count(),0,'the distribution is left out');
   assert.equal(await page.locator('#dpKok .et-dersler .olc-mini').count(),await page.locator('#dpKok .et-dersler .et-ders').count());
   await page.screenshot({path:path.join(out,'grafik-pano-'+width+'.png')});
   await page.mouse.up();assert.equal(await izler(),0);assert.equal(await ek(),dpOnce,'Önceki and Şimdiki stay');
   assert.equal(await surukle('DPANO','genel',2,0),yazi);
   assert.equal(await surukle('DPANO','ders',0,2),'TYT toplam ortalaması · 18 Eyl → 2 Eki · 54,8 → 59,1 net ▲ +4,2 (+%7,7)');
   // The distribution chart does not measure; a short press on a student's line opens the student.
   await goster('[data-dp-grafik="dagilim"]');
   const dk=await page.locator('[data-dp-grafik="dagilim"]').boundingBox();
   await page.mouse.move(dk.x+dk.width*.2,dk.y+120);await page.mouse.down();await page.mouse.move(dk.x+dk.width*.7,dk.y+120,{steps:6});
   assert.equal(await izler(),0);await page.mouse.up();
   const [no,k]=await page.evaluate(()=>{const s=DPANO.CIZIMLER.get('ogrenci').seriler,k=s.findIndex(x=>x.no!==EK.dpOgr&&x.pts[2]);return [s[k].no,k]});
   await goster('[data-dp-grafik="ogrenci"]');p=await nokta('DPANO','ogrenci',2,k);
   await page.mouse.move(p.x-6,p.y);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x-2,p.y);await page.mouse.up();
   await page.waitForFunction(n=>EK.dpOgr===n,no);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Drag to measure and Çizgi browser checks passed (desktop and 390 px)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
