// Teacher top menu and main screen on desktop and mobile: grouped menu (hover, click, Esc, inside
// the screen on a phone), main screen numbers and links, and the class mock exam average chart.
// Synthetic data only; nothing leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-teacher-home-'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,scheme] of [[1280,'light'],[390,'light'],[1440,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.clock.setFixedTime(new Date('2026-10-14T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(()=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';
    const ders=n=>DENEME_DERSLER.TYT.map(d=>({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const k=(id,ad,tarih,n)=>({id,ad,tarih,tur:'TYT',oturum:'TYT',dersler:ders(n),sure:null,puan:null,ts:1});
    const ilk=gunNo('2026-10-05');
    D.ogr=[{ad:'SENTETİK ADA',no:1,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:ilk,cikti:bugunNo(),denemeOkul:[k('p:a1','Deneme 1','2026-09-20',30),k('p:a2','Deneme 2','2026-10-04',36)]},
     {ad:'SENTETİK BORA',no:2,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ilkAktif:ilk,cikti:gunNo('2026-10-06'),denemeOkul:[k('p:b1','Deneme 1','2026-09-20',20)]},
     {ad:'SENTETİK CEM',no:3,sube:'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:ilk,denemeOkul:[k('p:c1','Deneme 1','2026-09-20',10),k('p:c2','Deneme 2','2026-10-04',30)]}];
    // Last week's plans were printed (saved) for Ada and Bora, but no result came back.
    const sabit=()=>({ek:[],sil:[],yer:{},soru:{},degisim:{},konuSlot:{},sabit:ilk});D.elle={['0|'+ilk]:sabit(),['1|'+ilk]:sabit()};
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};ciz();
   });
   const ray=page.locator('#ray');
   // 1) The menu is a top bar like the student's: compact on every width, no sideways scroll.
   assert.equal(await ray.getAttribute('class'),'ray ust rehber');
   const yukseklik=await ray.evaluate(e=>e.getBoundingClientRect().height);
   assert(yukseklik<=(width<820?125:70),'top bar height '+yukseklik+' at '+width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal scroll at '+width);
   assert.deepEqual(await ray.locator('.menu-grup>button[data-sekme]').allTextContents(),['Haftalık plan','Öğrenciler','Denemeler']);
   assert.deepEqual(await page.locator('#ray > button[data-sekme]').evaluateAll(b=>b.map(x=>x.dataset.sekme)),['ana','mufredat','ayarlar'],'Müfredat and Ayarlar top right');
   assert.deepEqual(await page.locator('#planMenusu button').allTextContents(),['Sonuç girişi','Haftalar haritası']);
   const liste=page.locator('#ogrencilerMenusu'),ok=page.locator('[aria-controls="ogrencilerMenusu"]');
   assert.equal(await liste.isVisible(),false,'menu folded');
   if(width>=820){await ok.hover();assert.equal(await liste.isVisible(),true,'hovering opens it');await page.mouse.move(width-20,780);assert.equal(await liste.isVisible(),false);}
   await ok.click();await page.mouse.move(width-20,780);assert.equal(await liste.isVisible(),true,'a click keeps it open');assert.equal(await ok.getAttribute('aria-expanded'),'true');
   // On a phone a list near the right edge opens leftwards and stays on screen.
   const kutu=await liste.boundingBox();
   assert(kutu.x>=0 && kutu.x+kutu.width<=width,'Öğrenciler list inside the screen: '+JSON.stringify(kutu));
   await page.screenshot({path:path.join(out,'teacher-menu-'+width+'-'+scheme+'.png')});
   await page.keyboard.press('Escape');assert.equal(await liste.isVisible(),false,'Esc closes it');
   await page.locator('#ray > [data-sekme="mufredat"]').click();
   assert.equal(await page.evaluate(()=>EK.sekme),'mufredat');
   assert.equal(await page.locator('#ray > [data-sekme="mufredat"][aria-current="page"]').count(),1);
   // A class's curriculum opens from the list and keeps Müfredat marked in the menu.
   await page.locator('[data-mufredat-sube="12-A"]').click();
   assert.deepEqual(await page.evaluate(()=>[EK.sekme,EK.sube]),['konuplani','12-A']);
   assert.equal(await page.getByRole('heading',{name:'Özel tasarlanmış müfredat'}).count(),1);
   assert.equal(await page.locator('#ray > [data-sekme="mufredat"][aria-current="page"]').count(),1);
   // 2) The brand opens the main screen: this week per class, then the class average chart.
   await ray.locator('button.marka').click();await page.getByRole('heading',{name:'Bu hafta'}).waitFor();
   const sayilar=await page.locator('#rehberHafta .rh-sayi').allInnerTexts();
   assert.deepEqual(sayilar.map(s=>s.replace(/\s+/g,' ').trim()),['1/3 Plan verildi','0/3 PDF istedi','0/3 Geçen haftanın sonucu','2 Karar bekleyen']);
   // Ada and Bora were given last week's plan and entered nothing for it.
   // The name opens the student's view; the number beside it opens the weeks map.
   assert.deepEqual(await page.locator('.rh-ad .ogr-ad').allInnerTexts(),['SENTETİK ADA','SENTETİK BORA']);
   assert.deepEqual(await page.locator('.rh-ad [data-ra-harita]').allInnerTexts(),['1','1']);
   assert.deepEqual(await page.locator('#rehberHafta tbody th').allInnerTexts().then(l=>l.map(s=>s.replace(/\s+/g,' ').trim())),['12-A 2 öğrenci','12-B 1 öğrenci']);
   if(width<1100){const a=await page.locator('#rehberHafta').boundingBox(),b=await page.locator('.rehber-pano>.dn-yol').boundingBox();assert(a.y<b.y,'one column: the week first, then the chart');}
   await page.screenshot({path:path.join(out,'teacher-home-'+width+'-'+scheme+'.png'),fullPage:true});
   // Chart: two TYT exams, average of the students who took each.
   assert.deepEqual(await page.evaluate(()=>denemeOrtalamaVerisi().noktalar.map(n=>n.v)),[20,33]);
   await page.locator('#dnOrtSube').selectOption('12-B');assert.deepEqual(await page.evaluate(()=>denemeOrtalamaVerisi().noktalar.map(n=>n.v)),[10,30]);
   assert.equal(await page.locator('#dnOrtSube').inputValue(),'12-B');
   await page.locator('[data-dn-ort-tur="AYT"]').click();assert.equal(await page.locator('[data-dn-ort-alan]').count(),3);
   assert.match(await page.locator('.rehber-pano .yg-alan').innerText(),/Henüz AYT SAY denemesi yok/);
   await page.locator('[data-dn-ort-tur="TYT"]').click();await page.locator('#dnOrtSube').selectOption('');
   await page.locator('circle[data-dn-yol]').last().click();
   assert.deepEqual(await page.evaluate(()=>[EK.sekme,EK.denemeTur]),['denemeler','TYT'],'a point opens Denemeler');
   // 3) A class row opens that class's weekly plan; a name awaiting a decision opens the weeks map.
   await ray.locator('button.marka').click();
   await page.locator('[data-ra-sube="12-B"]').click();
   assert.deepEqual(await page.evaluate(()=>[EK.sekme,EK.ogr]),['plan',2]);
   assert.equal(await ray.locator('.menu-grup>[data-sekme="plan"][aria-current="page"]').count(),1);
   await ray.locator('button.marka').click();
   await page.locator('[data-ra-harita="1"]').click();
   assert.deepEqual(await page.evaluate(()=>[EK.sekme,EK.ogr]),['harita',1]);
   assert.deepEqual(errors,[]);console.log('PASS teacher top menu and main screen',width,scheme);await context.close();
  }
  console.log('Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
