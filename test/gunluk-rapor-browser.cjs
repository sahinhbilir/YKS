// Günlük rapor on desktop (1280) and phone (390) with stubbed Firebase (window.bulut) and a stubbed model:
// the student writes, adds a generated photo, picks the choice, sends and sees the reply card (nothing is
// put into the notebook D); the teacher sees the list, enlarges a photo, marks Gördüm (the document is
// deleted), and a viewer sees the list without buttons. Synthetic data only; nothing leaves the page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-gunluk-'));fs.mkdirSync(out,{recursive:true});
const OGR_UID='UidOgrenci1',SAHIP='owner-uid';
const ON_OVGU='Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün:';
const ON_ELE='Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte eleştirin:';
// A stand-in for Firestore and the model; everything the page sends is recorded on window.__gr.
function stub({ogretmen}){
  const kayit={yz:[],yazilan:[],silinen:[],liste:0,docs:new Map()};window.__gr=kayit;
  const izin=()=>Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'});
  window.bulut={yapilandirilmis:true,db:'db',oturumHazir:async()=>{},
   mevcutKullanici:()=>({uid:ogretmen?'owner-uid':'UidOgrenci1',isAnonymous:false}),
   girisOgrenci:async()=>({uid:'UidOgrenci1',isAnonymous:false}),
   doc:(db,...y)=>({yol:y.join('/')}),collection:(db,...y)=>({yol:y.join('/')}),
   getDoc:async r=>({exists:()=>true,data:()=>({ogretmenUid:'owner-uid',bagliUid:'UidOgrenci1',durum:'aktif',ogrenciBulutId:'bulut-1'})}),
   setDoc:async(r,v)=>{kayit.yazilan.push({yol:r.yol,veri:JSON.parse(JSON.stringify(v))});if(kayit.docs.has(r.yol))throw izin();kayit.docs.set(r.yol,v)},
   getDocs:async()=>{kayit.liste++;return {docs:[...kayit.docs].map(([y,v])=>({id:y.split('/').pop(),data:()=>v}))}},
   deleteDoc:async r=>{kayit.silinen.push(r.yol);kayit.docs.delete(r.yol)},
   yapayZeka:async a=>{kayit.yz.push(a);await new Promise(r=>setTimeout(r,80));
    const ele=/ELEŞTİRİ istedi/.test(a.parcalar[0].text);
    return {metin:JSON.stringify({yanit:(ele?'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte eleştirin: ':'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün: ')+(ele?'Yarın yanlış yaptığın soruların nedenini yanına yaz, böylece aynı hatayı tekrarlamazsın.':'Bugün paragraf sorularına düzenli çalışman ve fotoğrafını göndermen çok değerli.'),onemli:false}),model:'stub'}}};
}
// A small picture with detail, made in the page and handed to the file input as PNG bytes.
const png=page=>page.evaluate(async()=>{const c=document.createElement('canvas');c.width=2000;c.height=1500;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,2000,1500);gr.addColorStop(0,'#f6f5f0');gr.addColorStop(1,'#11766a');g.fillStyle=gr;g.fillRect(0,0,2000,1500);
  let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;for(let i=0;i<500;i++){g.fillStyle='hsl('+Math.floor(r()*360)+',60%,50%)';g.fillRect(r()*2000,r()*1500,r()*120,r()*90)}
  g.fillStyle='#213d40';g.font='64px sans-serif';g.fillText('Sentetik defter sayfası',100,200);
  const b=await new Promise(res=>c.toBlob(res,'image/png'));const a=new Uint8Array(await b.arrayBuffer());let t='';for(let i=0;i<a.length;i+=0x8000)t+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(t)});
const yatayTasma=page=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message)});page.on('dialog',d=>d.accept());
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();

   // ---------------- the student
   await page.evaluate(stub,{ogretmen:false});
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-12';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-09-14'),ogrenciBulutId:'bulut-1',syncId:'sync-1',hesapUid:'UidOgrenci1'}];
    EK.ogr=0;EK.sekme='plan';ogrenciEsitlemeyiDene=async()=>{};denemeDinlemeyiBaslat=()=>{};kaydet=async()=>true;ciz()});
   const menu=page.locator('#ray [data-sekme="gunlukrapor"]');
   assert.equal(await menu.count(),1,'student menu entry');assert.equal((await menu.innerText()).trim(),'Günlük rapor');
   assert.equal(await yatayTasma(page),true,'no sideways scroll with the new menu entry');
   await menu.click();await page.locator('#grMetin').waitFor();
   assert.equal(await page.getByText('Bugün ne yaptın?').count(),1);
   assert.equal(await page.getByRole('button',{name:'Övgü istiyorum'}).count(),1);assert.equal(await page.getByRole('button',{name:'Eleştiri istiyorum'}).count(),1);
   assert.equal(await page.getByText('Raporun yapay zekâ ile değerlendirilir ve rehber öğretmenine iletilir.').count(),1);
   assert.equal(await page.locator('#grFotoCek').getAttribute('capture'),'environment');assert.equal(await page.locator('#grFotoCek').getAttribute('accept'),'image/*');
   assert.equal(await page.locator('#grKok .mini').filter({hasText:/yardım|nasıl/i}).count(),0,'no help boxes');
   const defterOnce=await page.evaluate(()=>JSON.stringify(D));
   // Nothing to send yet / no choice yet.
   await page.getByRole('button',{name:'Gönder',exact:true}).click();assert.match(await page.locator('#grDurum').innerText(),/yaz ya da fotoğraf ekle/);
   await page.locator('#grMetin').fill('Bugün 40 paragraf sorusu çözdüm, yanlışlarımı deftere yazdım.');
   await page.getByRole('button',{name:'Gönder',exact:true}).click();assert.match(await page.locator('#grDurum').innerText(),/Övgü mü eleştiri mi/);
   assert.equal(await page.evaluate(()=>window.__gr.yz.length),0,'nothing is sent without a choice');
   assert.equal(await page.locator('#grMetin').inputValue(),'Bugün 40 paragraf sorusu çözdüm, yanlışlarımı deftere yazdım.','the text survives a re-render');
   // A photo that cannot be decoded.
   await page.locator('#grFotoSec').setInputFiles({name:'IMG_0001.heic',mimeType:'image/heic',buffer:Buffer.from('not an image')});
   await page.waitForFunction(()=>/açılamadı/.test(document.getElementById('grDurum').textContent));
   assert.equal(await page.locator('#grDurum').innerText(),'Bu fotoğraf açılamadı; JPEG/PNG deneyin.');
   // A real one is compressed to a JPEG data URL that fits the rules.
   const foto=Buffer.from(await png(page),'base64');
   await page.locator('#grFotoSec').setInputFiles({name:'defter.png',mimeType:'image/png',buffer:foto});
   await page.locator('.gr-fotolar .gr-kucuk img').first().waitFor();
   const bilgi=await page.evaluate(()=>{const s=GUNLUKRAPOR.durum.S.fotos[0];return {bas:s.slice(0,23),uzunluk:s.length}});
   assert.equal(bilgi.bas,'data:image/jpeg;base64,');assert(bilgi.uzunluk<=280000,'photo is '+bilgi.uzunluk);
   const boyut=await page.locator('.gr-fotolar img').first().evaluate(i=>[i.naturalWidth,i.naturalHeight]);assert(Math.max(...boyut)<=1280,'longest side '+boyut);
   // Add and remove.
   await page.locator('#grFotoCek').setInputFiles({name:'ikinci.png',mimeType:'image/png',buffer:foto});
   await page.waitForFunction(()=>GUNLUKRAPOR.durum.S.fotos.length===2);
   await page.locator('[data-gr-sil="1"]').click();assert.equal(await page.locator('.gr-fotolar .gr-kucuk').count(),1);
   // The choice is a toggle.
   const ele=page.getByRole('button',{name:'Eleştiri istiyorum'}),ovgu=page.getByRole('button',{name:'Övgü istiyorum'});
   await ovgu.click();assert.equal(await ovgu.getAttribute('aria-pressed'),'true');await ele.click();
   assert.equal(await ele.getAttribute('aria-pressed'),'true');assert.equal(await ovgu.getAttribute('aria-pressed'),'false');
   assert.equal(await yatayTasma(page),true,'no sideways scroll on the form');
   await page.screenshot({path:path.join(out,'gunluk-rapor-form-'+width+'.png'),fullPage:true});
   await page.getByRole('button',{name:'Gönder',exact:true}).click();
   await page.locator('.gr-yanit').waitFor();
   const kart=(await page.locator('.gr-yanit').innerText()).replace(/\s+/g,' ');
   assert.match(kart,new RegExp('Raporun gönderildi.*'+ON_ELE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(kart,/Bugün 1\/3 rapor gönderdin/);
   // What was sent: one document under the owner, id with the uid, today's Istanbul day and slot 1, the model got the report and photo only.
   const g=await page.evaluate(()=>window.__gr);
   assert.equal(g.yazilan.length,1);
   assert.match(g.yazilan[0].yol,new RegExp('^ogretmenYedek/owner-uid/gunlukRapor/UidOgrenci1-\\d{8}-1$'));
   const gun=await page.evaluate(()=>bulutGercekGun().replace(/-/g,''));assert(g.yazilan[0].yol.endsWith('UidOgrenci1-'+gun+'-1'));
   const v=g.yazilan[0].veri;assert.equal(v.tercih,'elestiri');assert.equal(v.ogrenciUid,OGR_UID);assert.equal(v.ogrenciBulutId,'bulut-1');assert.equal(v.fotograflar.length,1);
   assert(v.yzYanit.startsWith(ON_ELE));assert.equal(v.onemli,false);
   assert.equal(g.yz.length,1);assert.equal(g.yz[0].parcalar.length,3);
   assert(!/SENTETİK|1001|12-A|bulut-1/.test(JSON.stringify(g.yz[0]).replace(/"data":"[^"]*"/,'')),'no notebook data to the model');
   assert.equal(await page.locator('#grMetin').inputValue(),'','the form is empty after sending');assert.equal(await page.locator('.gr-fotolar .gr-kucuk').count(),0);
   assert.equal(await page.evaluate(()=>JSON.stringify(D)),defterOnce,'nothing was put into the notebook');
   assert.equal(await yatayTasma(page),true,'no sideways scroll with the reply card');
   await page.screenshot({path:path.join(out,'gunluk-rapor-ogrenci-'+width+'.png'),fullPage:true});
   // A second report with Övgü counts 2/3; the card survives a menu round trip.
   await page.locator('#grMetin').fill('Kimya testi çözdüm.');await ovgu.click();await page.getByRole('button',{name:'Gönder',exact:true}).click();
   await page.waitForFunction(()=>/2\/3/.test(document.querySelector('.gr-yanit')?.textContent||''));
   assert.match(await page.locator('.gr-yanit').innerText(),new RegExp(ON_OVGU));
   // The AI is down: the report is still sent with the fixed sentence.
   await page.evaluate(()=>{window.bulut.yapayZeka=async()=>{throw new Error('quota')}});
   await page.locator('#grMetin').fill('Biyoloji tekrarı yaptım.');await ovgu.click();await page.getByRole('button',{name:'Gönder',exact:true}).click();
   await page.waitForFunction(()=>/3\/3/.test(document.querySelector('.gr-yanit')?.textContent||''));
   assert.match(await page.locator('.gr-yanit').innerText(),/Yapay zekâ şu an yanıt veremedi; rehber öğretmenin değerlendirecek\./);
   // The fourth: stopped, no AI call.
   await page.evaluate(()=>{window.__gr.yz.length=0;window.bulut.yapayZeka=async a=>{window.__gr.yz.push(a);throw new Error('x')}});
   await page.locator('#grMetin').fill('Bir tane daha.');await ovgu.click();await page.getByRole('button',{name:'Gönder',exact:true}).click();
   await page.waitForFunction(()=>/3 rapor gönderdin\. Yarın/.test(document.getElementById('grDurum').textContent));
   assert.equal(await page.evaluate(()=>window.__gr.yz.length),0);
   // Rules not published yet.
   await page.evaluate(()=>{sessionStorage.clear();GUNLUKRAPOR.sifirla();window.bulut.setDoc=async()=>{throw Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'})};ciz()});
   await page.locator('#grMetin').fill('Rapor.');await page.getByRole('button',{name:'Övgü istiyorum'}).click();await page.getByRole('button',{name:'Gönder',exact:true}).click();
   await page.waitForFunction(()=>/Günlük rapor henüz açık değil\./.test(document.getElementById('grDurum').textContent));

   // ---------------- the teacher
   await page.evaluate(stub,{ogretmen:true});
   await page.evaluate(()=>{
    const f='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const t=Date.now(),d=(id,v)=>window.__gr.docs.set('ogretmenYedek/owner-uid/gunlukRapor/'+id,v);
    d('U1-20261103-1',{ogrenciUid:'U1',ogrenciBulutId:'bulut-1',ts:t-3600e3,metin:'Bugün 40 paragraf sorusu çözdüm.',fotograflar:[f],tercih:'ovgu',yzYanit:'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün: Düzenli çalışman çok değerli.',onemli:false});
    d('U2-20261103-1',{ogrenciUid:'U2',ogrenciBulutId:'bulut-2',ts:t-7200e3,metin:'Kendimi çok yorgun ve çaresiz hissediyorum.',fotograflar:[],tercih:'elestiri',yzYanit:'Bunu paylaştığın için teşekkürler. Bugün rehber öğretmenine ya da güvendiğin bir yetişkine mutlaka söyle.',onemli:true});
    d('U3-20261103-2',{ogrenciUid:'U3',ogrenciBulutId:'bulut-yok',ts:t-60e3,metin:'',fotograflar:[f,f],tercih:'elestiri',yzYanit:'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte eleştirin: Yanlışlarını yazmayı ihmal etme.',onemli:false});
    D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-12';
    D.ogr=[{ad:'SENTETİK ADA',no:1001,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ogrenciBulutId:'bulut-1'},{ad:'SENTETİK BORA',no:1002,sube:'12-B',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ogrenciBulutId:'bulut-2'}];
    GUNLUKRAPOR.sifirla();EK.ogr=0;EK.sekme='ana';bulutYedekPlanla=()=>{};ogretmenDinlemeyiBaslat=()=>{};ciz()});
   // The count is fetched once when the menu renders.
   await page.locator('#ray .gr-sayi').first().waitFor();
   assert.equal((await page.locator('#ray .menu-grup>button[data-sekme="ogrenciler"] .gr-sayi').innerText()).trim(),'3');
   assert.equal(await page.evaluate(()=>window.__gr.liste),1);
   await page.evaluate(()=>{ciz();ciz()});assert.equal(await page.evaluate(()=>window.__gr.liste),1,'re-rendering the menu does not fetch again');
   assert.equal(await yatayTasma(page),true,'no sideways scroll with the badge');
   await page.locator('[aria-controls="ogrencilerMenusu"]').click();
   assert.equal((await page.locator('#ogrencilerMenusu [data-sekme="gunlukrapor"]').innerText()).replace(/\s+/g,' ').trim(),'Günlük raporlar 3');
   await page.locator('#ogrencilerMenusu [data-sekme="gunlukrapor"]').click();
   await page.locator('.gr-oge').first().waitFor();
   assert.equal(await page.evaluate(()=>window.__gr.liste),1,'the page uses the list fetched for the count');
   assert.equal(await page.locator('.gr-oge').count(),3);
   // Önemli first, then newest.
   const sirasi=await page.locator('.gr-oge').evaluateAll(l=>l.map(x=>x.dataset.grOge));assert.deepEqual(sirasi,['U2-20261103-1','U3-20261103-2','U1-20261103-1']);
   const ilk=(await page.locator('.gr-oge').nth(0).innerText()).replace(/\s+/g,' ');
   assert.match(ilk,/SENTETİK BORA 12-B/);assert.match(ilk,/Önemli/);assert.match(ilk,/Eleştiri istedi/);assert.match(ilk,/çaresiz hissediyorum/);assert.match(ilk,/Yapay zekâ yanıtı/);
   const son=(await page.locator('.gr-oge').nth(2).innerText()).replace(/\s+/g,' ');
   assert.match(son,/SENTETİK ADA 12-A/);assert.match(son,/Övgü istedi/);assert.match(son,/\d{1,2} \p{L}+ \d{2}:\d{2}/u,'date and time');assert.match(son,/işte övgün:/);
   assert.match(await page.locator('.gr-oge').nth(1).innerText(),/Tanınmayan öğrenci/);
   assert.equal(await page.locator('.gr-oge').nth(1).locator('.gr-kucuk').count(),2);
   assert.equal(await page.locator('[data-gr-gordum]').count(),3);
   // A photo opens large and closes.
   await page.locator('.gr-oge').nth(2).locator('.gr-kucuk').click();await page.locator('#grOrtu img').waitFor();
   await page.keyboard.press('Escape');assert.equal(await page.locator('#grOrtu').count(),0);
   assert.equal(await yatayTasma(page),true,'no sideways scroll on the list');
   await page.screenshot({path:path.join(out,'gunluk-rapor-ogretmen-'+width+'.png'),fullPage:true});
   // Gördüm deletes the document, then the item leaves the list and the badge drops.
   await page.locator('[data-gr-oge="U1-20261103-1"] [data-gr-gordum]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.gr-oge').length===2);
   assert.deepEqual(await page.evaluate(()=>window.__gr.silinen),['ogretmenYedek/owner-uid/gunlukRapor/U1-20261103-1']);
   assert.equal(await page.evaluate(()=>window.__gr.docs.size),2);
   assert.equal((await page.locator('#ray .menu-grup>button[data-sekme="ogrenciler"] .gr-sayi').innerText()).trim(),'2');
   // Yenile fetches again; another report that arrived shows up.
   await page.evaluate(()=>window.__gr.docs.set('ogretmenYedek/owner-uid/gunlukRapor/U4-20261103-1',{ogrenciUid:'U4',ogrenciBulutId:'bulut-2',ts:Date.now(),metin:'Yeni rapor',fotograflar:[],tercih:'ovgu',yzYanit:'x',onemli:false}));
   await page.getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.gr-oge').length===3);
   assert.equal(await page.evaluate(()=>window.__gr.liste),2);
   // Tümünü gördüm asks first (the dialog is accepted) and deletes all.
   await page.getByRole('button',{name:'Tümünü gördüm',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.gr-oge').length===0);
   assert.equal(await page.evaluate(()=>window.__gr.docs.size),0);assert.equal(await page.evaluate(()=>window.__gr.silinen.length),4);
   assert.match(await page.locator('#grKok').innerText(),/Okunmamış günlük rapor yok/);assert.equal(await page.locator('#ray .gr-sayi').count(),0);
   // Declining the confirmation deletes nothing.
   await page.evaluate(()=>{window.__gr.docs.set('ogretmenYedek/owner-uid/gunlukRapor/U5-20261103-1',{ogrenciUid:'U5',ogrenciBulutId:'bulut-1',ts:Date.now(),metin:'Son',fotograflar:[],tercih:'ovgu',yzYanit:'y',onemli:false})});
   await page.getByRole('button',{name:'Yenile',exact:true}).click();await page.locator('.gr-oge').waitFor();
   page.removeAllListeners('dialog');page.on('dialog',d=>d.dismiss());
   await page.getByRole('button',{name:'Tümünü gördüm',exact:true}).click();await page.waitForTimeout(150);
   assert.equal(await page.locator('.gr-oge').count(),1);page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());

   // ---------------- a viewer sees the list but has no buttons
   await page.evaluate(()=>{IZLEME={sahipUid:'owner-uid'};GUNLUKRAPOR.sifirla();bulutYedekPlanla=()=>{};ciz()});
   await page.locator('.gr-oge').waitFor();
   assert.equal(await page.locator('[data-gr-gordum]').count(),0);assert.equal(await page.getByRole('button',{name:'Tümünü gördüm'}).count(),0);
   assert.equal(await page.getByRole('button',{name:'Yenile',exact:true}).count(),1);
   await page.screenshot({path:path.join(out,'gunluk-rapor-izleyici-'+width+'.png'),fullPage:true});
   await page.evaluate(()=>{IZLEME=null});
   // Before the rules are published the teacher gets one line about it.
   await page.evaluate(()=>{window.bulut.getDocs=async()=>{throw Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'})};GUNLUKRAPOR.sifirla();ciz()});
   await page.locator('.gr-uyari').waitFor();
   assert.match(await page.locator('.gr-uyari').innerText(),/firestore\.rules dosyası yayınlanmalı: Firebase konsolu → Firestore Database → Rules → Publish\./);
   assert.equal(await yatayTasma(page),true,'no sideways scroll on the note');
   assert.deepEqual(errors,[]);
   await context.close();console.log('PASS günlük rapor browser',width);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
