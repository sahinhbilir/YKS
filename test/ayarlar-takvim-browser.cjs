// Ayarlar sections, school holidays, the class-average chart's target and groups, the weekly
// tracking "Plan verildi" count and the alt konu picker, on desktop and a phone. Synthetic data only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-ayarlar-'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const [width,scheme] of [[1280,'light'],[390,'light'],[1280,'dark']]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme}),page=await context.newPage(),errors=[],dialogs=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
   await page.clock.setFixedTime(new Date('2026-10-14T12:00:00+03:00'));
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.waitForFunction(()=>typeof ciz==='function'&&typeof D==='object');
   await page.evaluate(()=>{
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';D.ayar.donemBasi='2026-09-07';D.ayar.donemElle=true;
    const ders=n=>DENEME_DERSLER.TYT.map(d=>({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const k=(id,tarih,n)=>({id,ad:'Deneme '+tarih,tarih,tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:1});
    D.ogr=Array.from({length:5},(_,i)=>({ad:'SENTETİK '+'ABCDE'[i],no:i+1,sube:i<3?'12-A':'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05'),
      cikti:i<2?bugunNo():null,denemeOkul:[k('p:'+i+'a','2026-09-20',10+i*5),k('p:'+i+'b','2026-10-04',20+i*5)]}));
    D.konuPlani={'12-A':Array.from({length:40},(_,w)=>({'Fizik':['Fizik konu '+(w+1)]}))};
    const prog={saatler:['09:00'],gunler:[['Fizik'],[],['Fizik'],[],[],[],[]]};D.programHafta={'12-A':{[gunNo('2026-09-07')]:prog}};D.dersProgrami={'12-A':prog};
    EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};ciz();
   });
   const genis=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
   // 1) Main screen chart: group and target. Then the same chart on the Denemeler page.
   assert.deepEqual(await page.evaluate(()=>denemeOrtalamaVerisi().noktalar.map(n=>n.v)),[20,30]);
   await page.locator('#dnOrtGrup').selectOption('ust40');
   assert.deepEqual(await page.evaluate(()=>denemeOrtalamaVerisi().noktalar.map(n=>n.v)),[27.5,37.5],'top 2 of 5');
   await page.locator('[data-dn-ort-mod="genel"]').click();
   assert.equal(await page.locator('[data-dn-ort-mod="genel"]').getAttribute('aria-pressed'),'true');
   await page.locator('#dnOrtHedef').fill('33');await page.locator('#dnOrtHedef').press('Enter');
   await page.waitForFunction(()=>D.denemeOrtHedef?.TYT?.['']===33);
   assert.equal(await page.locator('.rehber-pano .yg-hedef').count(),1,'target line drawn');
   assert.equal(await page.evaluate(()=>{const t=document.querySelector('.rehber-pano text.yg-hedef-yazi').getBoundingClientRect();
     return [...document.querySelectorAll('.rehber-pano circle.yg-nokta')].filter(c=>{const b=c.getBoundingClientRect();
       return b.right>t.left && b.left<t.right && b.bottom>t.top && b.top<t.bottom;}).length;}),0,'the target label clears the data points');
   await page.locator('#dnOrtSube').selectOption('12-B');
   assert.equal(await page.locator('#dnOrtHedef').getAttribute('placeholder'),'33','the class shows the school target until it sets its own');
   await page.screenshot({path:path.join(out,'ortalama-hedef-'+width+'-'+scheme+'.png'),fullPage:true});
   await page.locator('#ray .menu-grup>button[data-sekme="denemeler"]').click();
   await page.locator('#ana section[aria-label="Deneme ortalaması"]').waitFor();
   assert.equal(await page.locator('#ana section[aria-label="Deneme ortalaması"] .yg-hedef').count(),1,'same chart, same target on Denemeler');
   assert(await genis(),'Denemeler fits at '+width);
   // 2) Weekly tracking counts "Plan verildi" like the main screen.
   await page.locator('#ray button.marka').click();
   await page.getByRole('heading',{name:'Bu hafta'}).getByRole('button').click();
   await page.getByRole('heading',{name:'Haftalık öğrenci takibi'}).waitFor();
   assert.equal((await page.locator('.etkinlik-ozet .kart').first().innerText()).replace(/\s+/g,' ').trim(),'2 / 5 Plan verildi');
   // 3) Ayarlar sections; holidays in Ders programı.
   await page.evaluate(()=>{EK.sekme='ayarlar';ciz();});
   assert.deepEqual(await page.locator('[data-ayar-bolum]').allInnerTexts(),['Genel','Ders programı','Öğrenci kalibrasyonu']);
   assert.equal(await page.locator('#ayarKaydet').count(),1);
   await page.locator('#aSoru').fill('15');
   await page.locator('[data-ayar-bolum="program"]').click();
   assert.match(dialogs.at(-1),/Kaydedilmemiş ayar değişiklikleri/);
   await page.getByRole('heading',{name:'Tatiller'}).waitFor();
   assert.equal(await page.locator('.tatil-kart tbody tr').count(),4);
   const once=await page.evaluate(()=>planHaftasi('12-A',gunNo('2026-12-07')));
   await page.locator('#tatilAd').fill('Deneme tatili');await page.locator('#tatilBas').fill('2026-11-30');await page.locator('#tatilBit').fill('2026-12-04');
   await page.locator('#tatilEkle').click();
   await page.waitForFunction(()=>D.ayar.tatiller.length===5);
   assert.equal(await page.evaluate(()=>planHaftasi('12-A',gunNo('2026-12-07'))),once-1,'the new holiday week shifts the plan');
   await page.locator('[data-tatil-sil]').nth(1).click();
   await page.waitForFunction(()=>D.ayar.tatiller.length===4 && !D.ayar.tatiller.some(t=>t.ad==='Deneme tatili'));
   assert(await genis(),'Ders programı fits at '+width);
   await page.screenshot({path:path.join(out,'ayarlar-program-'+width+'-'+scheme+'.png'),fullPage:true});
   await page.locator('[data-ayar-bolum="kalibrasyon"]').click();
   await page.getByRole('heading',{name:'Ders profilleri'}).waitFor();
   assert.match(await page.locator('#ana').innerText(),/İlk tekrar: \d+ gün/);
   // 4) Alt konu: a student's Sonuç gir lists the parts of a compound topic; a click splits one.
   await page.evaluate(()=>{
    D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-14';
    D.ogr=[{ad:'SENTETİK ÖĞRENCİ',no:1,sube:'',alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05'),sonucBilgiOkundu:true}];
    D.ekKonular=[[1,12,'Sayılar','Asal Sayılar, Ardışık Sayılar, Faktöriyel',0,'',0]];const ki=KATALOG.length;
    D.islenis={[ki]:gunNo('2026-10-09')};D.ayar.ilk=2;EK.ogr=0;EK.sekme='giris';EK.hafta=null;ciz();
   });
   const kutu=page.locator('details.altKutu').first();
   await kutu.locator('summary').click();
   await kutu.getByRole('button',{name:'Ardışık Sayılar'}).click();
   await page.waitForFunction(()=>Object.keys(D.altKonu||{}).length===1);
   assert.equal(await page.locator('details.altKutu .rozet').first().innerText(),'✓ Ardışık Sayılar');
   assert(await genis(),'Sonuç gir fits at '+width);
   await page.screenshot({path:path.join(out,'alt-konu-'+width+'-'+scheme+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   console.log('PASS ayarlar, holidays, chart target/groups, tracking, alt konu',width,scheme);
   await context.close();
  }
  console.log('Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
