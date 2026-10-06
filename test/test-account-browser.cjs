// "Test hesabı aç" in a real browser: start screen layout on desktop and phone,
// Google sign-in (faked), nickname setup, the first cloud save and "Test hesabımı sıfırla". No real Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-test-account-'));
fs.mkdirSync(out,{recursive:true});
// Replaces the Firebase module with an in-memory bridge that has the same surface.
const sahteBulut=()=>{
  const bulut={},snap=v=>({exists:()=>!!v,data:()=>v&&JSON.parse(JSON.stringify(v))});
  let user=null;
  window.__bulut=bulut;
  const yansit=()=>window.__yansit&&window.__yansit(Object.keys(bulut));   // survives the reload after a reset
  window.bulut={yapilandirilmis:true,db:{},doc:(_db,...p)=>p.join('/'),mevcutKullanici:()=>user,oturumHazir:async()=>{},
    girisOgretmen:async()=>(user={uid:'google-1',isAnonymous:false,email:'tester@example.test'}),
    getDocFromServer:async ref=>snap(bulut[ref]),setDoc:async(ref,v)=>{bulut[ref]=JSON.parse(JSON.stringify(v));yansit();},
    async runTransaction(_db,fn){const w=[];await fn({get:async ref=>snap(bulut[ref]),set:(ref,v)=>w.push([ref,v]),delete:ref=>w.push([ref,null])});
      w.forEach(([ref,v])=>{if(v===null)delete bulut[ref];else bulut[ref]=JSON.parse(JSON.stringify(v));});yansit();},
    oturumuKapat:async()=>{user=null;},
    // Kaydol accounts: the user name arrives without spaces; the password is kept only here.
    uyeKaydol:async(ad,sifre)=>{window.__uyeKayit=[ad,sifre];return (user={uid:'uye-'+ad,isAnonymous:false,email:'uye-x@uye.ykstekrar.app'});},
    uyeGiris:async()=>{throw Object.assign(new Error('auth'),{code:'auth/invalid-credential'});},
    girisOgrenciHesabi:async()=>{throw Object.assign(new Error('auth'),{code:'auth/invalid-credential'});},
    sifreDegistir:async(m,y,okul,eposta)=>{window.__sifre=[m,y,okul,eposta];},
    okulSifreGirisi:async()=>{throw Object.assign(new Error('auth'),{code:'auth/invalid-credential'});},
    uyeYonu:async()=>null,sifreTalebi:async(...x)=>{window.__talep=x;}};
};
const kesisir=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});
   let sifirla=false,bulutYollari=[];
   page.on('dialog',async d=>{if(sifirla&&d.type()==='prompt'&&/SIFIRLA/.test(d.message()))return d.accept('sıfırla');
     errors.push('dialog: '+d.message());await d.dismiss();});
   await page.exposeFunction('__yansit',k=>{bulutYollari=k;});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await context.addInitScript(sahteBulut);
   await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
   // Start screen: headline → open student login (teacher and test account below it) → cap and books.
   const dugme=page.locator('#testHesapAc');
   await dugme.waitFor();
   assert.equal((await page.locator('.giris-alt').textContent()).trim(),'Hedefine bir adım daha yaklaş');
   assert.equal(await page.locator('#ogrenciGirisAd').isVisible(),true,'student login is open without a click');
   const kutu=async sel=>page.locator(sel).boundingBox();
   const [baslik,girisKart,giris,rehber,kayit,test,cizim]=await Promise.all(['.giris-baslik','#ogrenciGirisAlan','#ogrenciBulutGiris','#rolRehber','#kaydolAc','#testHesapAc','.giris-cizim'].map(kutu));
   assert(baslik.y+baslik.height<=girisKart.y && girisKart.y+girisKart.height<=cizim.y,'login sits between the headline and the drawing');
   for(const b of [rehber,kayit,test])assert(kesisir(b,girisKart) && b.y>=giris.y+giris.height,'teacher, Kaydol and test account sit under Giriş yap');
   // Three buttons do not fit one row: Rehber öğretmeniyim on top, then Kaydol | Test hesabı aç.
   assert(rehber.y+rehber.height<=kayit.y && Math.abs(kayit.y-test.y)<1 && kayit.x+kayit.width<=test.x,'Kaydol sits between Rehber öğretmeniyim and Test hesabı aç');
   assert(Math.abs(kayit.width-test.width)<1 && Math.abs(rehber.width-(test.x+test.width-kayit.x))<1,'balanced rows');
   assert(giris.y+giris.height<=800,'Giriş yap is visible without scrolling');
   assert(girisKart.height<=300 && girisKart.width<=362,'compact login card: '+Math.round(girisKart.width)+'×'+Math.round(girisKart.height));
   assert.equal(await page.getByLabel('Kullanıcı adı ya da ad soyad').getAttribute('id'),'ogrenciGirisAd','labels stay for screen readers');
   assert.equal(await page.getByLabel('Şifre ya da okul numarası').getAttribute('id'),'ogrenciGirisNo');
   assert.equal(await page.locator('#ogrenciGirisAd').getAttribute('placeholder'),'Kullanıcı adı - Ad soyad');
   assert.equal(await page.locator('#ogrenciGirisNo').getAttribute('placeholder'),'Şifre - Okul numarası');
   // The school number / password is hidden like a password, with the usual eye button on its right.
   const sifre=page.locator('#ogrenciGirisNo'),goz=page.locator('[data-sifre-goster="ogrenciGirisNo"]');
   assert.equal(await sifre.getAttribute('type'),'password');
   await sifre.fill('1234');await goz.click();
   assert.equal(await sifre.getAttribute('type'),'text');assert.equal(await goz.getAttribute('aria-label'),'Şifreyi gizle');
   const [sKutu,gKutu]=await Promise.all([sifre.boundingBox(),goz.boundingBox()]);
   assert(gKutu.x>sKutu.x+sKutu.width/2 && gKutu.x+gKutu.width<=sKutu.x+sKutu.width+1 && kesisir(gKutu,sKutu),'the eye sits inside the field, on the right');
   await goz.click();assert.equal(await sifre.getAttribute('type'),'password');await sifre.fill('');
   assert.equal(await page.evaluate(()=>['#ogrenciGirisAd','#ogrenciGirisNo','#ogrenciBulutGiris','#rolRehber','#kaydolAc','#testHesapAc','[data-sifre-goster]'].every(s=>{
     const r=document.querySelector(s).getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest(s);})),true,'no decoration covers a control');
   // On a tall screen the whole start screen is centred vertically.
   await page.setViewportSize({width:1920,height:1080});
   const bosluk=await page.evaluate(()=>({ust:document.querySelector('.giris-baslik').getBoundingClientRect().top,
     alt:innerHeight-document.querySelector('.giris-yedek').getBoundingClientRect().bottom,kaydir:document.documentElement.scrollHeight>innerHeight}));
   assert(!bosluk.kaydir && Math.abs(bosluk.ust-bosluk.alt)<=2 && bosluk.ust>60,'centred vertically: '+JSON.stringify(bosluk));
   // Section gaps open up on a tall screen (capped) and stay at their minimum on a short one.
   const aralik=()=>page.evaluate(()=>['.ara-kart','.ara-cizim','.ara-yedek'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().height)));
   const genis=await aralik();assert(genis[0]>30 && genis[0]<=130 && genis[1]>30 && genis[1]<=130 && genis[2]<=52,'tall screen gaps: '+genis);
   // Symmetric around the login card: subtitle→card equals card→cap (the drawing starts at the cap).
   const simetri=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();
     return [r('.giris-kart').top-r('.giris-alt').bottom,r('.giris-cizim').top-r('.giris-kart').bottom];});
   assert(Math.abs(simetri[0]-simetri[1])<=4,'equal gaps around the login card: '+simetri.map(Math.round));
   await page.setViewportSize({width,height:640});
   assert.deepEqual(await aralik(),[30,30,22],'short screen gaps stay at their minimum');
   await page.setViewportSize({width,height:800});
   assert.equal((await page.locator('#ogrenciGirisDurum').textContent()),'','no hint text until there is something to say');
   await page.locator('#ogrenciBulutGiris').click();
   assert.equal(await page.locator('#ogrenciGirisDurum').textContent(),'Kullanıcı adını ve şifreni ya da ad soyadını ve okul numaranı gir.');
   assert.equal(await page.locator('#parolaUnuttum').count(),0,'no split before a wrong login');
   // A wrong login splits the button: Giriş yap | Parolamı unuttum, side by side, half each.
   await page.locator('#ogrenciGirisAd').fill('Ada Yılmaz');await page.locator('#ogrenciGirisNo').fill('1234');
   await page.locator('#ogrenciBulutGiris').click();
   await page.locator('#parolaUnuttum').waitFor();
   const [gy,pu]=await Promise.all([page.locator('#ogrenciBulutGiris').boundingBox(),page.locator('#parolaUnuttum').boundingBox()]);
   assert(Math.abs(gy.y-pu.y)<1 && gy.x+gy.width<=pu.x && Math.abs(gy.width-pu.width)<2,'two halves of one row');
   await page.screenshot({path:path.join(out,'giris-bolunmus-'+width+'.png')});
   await page.locator('#parolaUnuttum').click();
   const pencere=page.locator('#parolaOrtu [role="dialog"]');await pencere.waitFor();
   assert((await pencere.innerText()).includes('Okul numaranla giriş yaptıysan şifren okul numarana sıfırlanır.'));
   assert((await pencere.innerText()).includes('Kaydol ile hesap açtıysan şifren rastgele rakamlara sıfırlanır ve e-postana gönderilir.'));
   assert.equal(await page.locator('#parolaTurOkul').isChecked(),true);assert.equal(await page.locator('#parolaAd').inputValue(),'Ada Yılmaz');
   await page.locator('#parolaEposta').fill('veli@example.com');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'popup overflow');
   await page.screenshot({path:path.join(out,'parola-unuttum-'+width+'.png')});
   await page.locator('#parolaGonder').click();
   await page.locator('#parolaDurum',{hasText:'Talebin rehber öğretmene iletildi.'}).waitFor();
   assert.deepEqual(await page.evaluate(()=>window.__talep),['okul','Ada Yılmaz','veli@example.com']);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#parolaOrtu').count(),0,'Esc closes it');
   await page.locator('#ogrenciGirisAd').fill('');await page.locator('#ogrenciGirisNo').fill('');
   assert.equal(await page.locator('#kurYapistirAc').isVisible(),false,'backup options are folded');
   await page.locator('summary',{hasText:'Yedekten geri yükle'}).click();await page.locator('#kurYapistirAc').click();
   assert.equal(await page.locator('#yapistirMetin').isVisible(),true,'paste option opens');
   await page.locator('summary',{hasText:'Yedekten geri yükle'}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'start screen overflow');
   await page.screenshot({path:path.join(out,'test-account-start-'+width+'.png')});
   await dugme.click();
   await page.locator('#kOgrAd').waitFor();
   assert.equal(await page.locator('label',{has:page.locator('#kOgrAd')}).textContent().then(t=>t.startsWith('Takma adın')),true);
   assert.equal(await page.locator('#paketYukle').count(),0);
   assert.equal(await page.locator('#testHesapAc').count(),0,'the button belongs to the start screen only');
   await page.evaluate(()=>{D.ayar.testTarih='2026-09-23';});
   await page.locator('#kOgrAd').fill('Kuzey');await page.locator('#kOgrSinif').selectOption('11');
   await page.locator('#kMufredatBaslangic').fill('2026-09-21');await page.locator('#kOgrBaslat').click();
   await page.waitForFunction(()=>D.ogr.length===1&&D.testHesap&&D.testHesap.uid==='google-1');
   assert.equal((await page.evaluate(()=>bulutaYedekle())).tur,'tamam');
   const bulut=await page.evaluate(()=>window.__bulut);
   assert.equal(JSON.parse(bulut['testDefter/google-1'].veri).ogr[0].ad,'Kuzey');
   assert(bulut['testDefter/google-1/gecmis/2'],'Wednesday history slot');
   // Student top menu: "Planım" opens the weekly plan; its arrow (hover or click) lists the other plan pages.
   assert.equal(await page.locator('#ray').getAttribute('class'),'ray ust');
   // The brand (YKS Tekrar Defteri) is the home button; then Planım ▾, Denemelerim, Müfredat, Ayarlar.
   assert.deepEqual(await page.locator('#ray > button[data-sekme]').evaluateAll(b=>b.map(x=>x.dataset.sekme)),['ana','denemeler','mufredat','ayarlar']);
   assert.equal(await page.locator('#ray > button.marka').isVisible(),true,'the brand stays visible at '+width);
   const menu=page.locator('#planMenusu'),ok=page.locator('#ray .menu-ac');
   assert.equal(await menu.isVisible(),false,'menu folded');
   await ok.hover();assert.equal(await menu.isVisible(),true,'hovering the arrow opens it');
   assert.deepEqual(await menu.locator('button').allTextContents(),['Haftalar haritası','Sonuç gir','Karnem','Geçmiş plan kurtar']);
   await page.mouse.move(width-20,780);assert.equal(await menu.isVisible(),false,'leaving closes it');
   await ok.click();await page.mouse.move(width-20,780);
   assert.equal(await menu.isVisible(),true,'a click keeps it open');assert.equal(await ok.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false,'Esc closes it');
   await ok.click();await menu.getByRole('button',{name:'Haftalar haritası'}).click();
   assert.equal(await page.evaluate(()=>EK.sekme),'harita');assert.equal(await menu.isVisible(),false,'choosing closes it');
   await page.locator('.yks-yolu').waitFor();assert.equal(await page.locator('.dn-yol').count(),0,'Haftalar haritası is the map alone');
   // Home (the brand): the weeks map with the mock-exam chart beside it; its axis already reaches YKS.
   await page.locator('#ray > button.marka').click();assert.equal(await page.evaluate(()=>EK.sekme),'ana');
   await page.locator('.ana-pano .dn-yol').waitFor();
   assert((await page.locator('.dn-yol').innerText()).includes('Henüz TYT denemesi yok'));assert.equal(await page.locator('.dn-yol .yg-yks').count(),1);
   if(width>=1280){const [harita,grafik,b1,b2]=await Promise.all(['.ana-pano .yks-yolu','.ana-pano .dn-yol','.pano-sol-bas h1','.pano-sag-bas h2'].map(s=>page.locator(s).boundingBox()));
     assert(grafik.x>harita.x+harita.width+30 && Math.abs(grafik.y-harita.y)<2,'the chart sits beside the map with a clear gap');
     assert(Math.abs((b1.y+b1.height)-(b2.y+b2.height))<4,'"Deneme gelişimi" heading sits on the same row as "Haftalar haritası"');
     assert(Math.abs(grafik.width-harita.width)<2 && Math.abs(grafik.height-harita.height)<2,'map and chart cards are the same size');
     assert.equal(await page.locator('.ana-pano>.dn-yol').evaluate(e=>getComputedStyle(e).borderTopWidth),'3px','the chart card has the map card style');
     // The drawing is rebuilt to the card's free area, so it fills the card instead of leaving bands.
     await page.waitForFunction(()=>document.querySelector('.yg-alan').dataset.h!=='270');
     const [alan,svg]=await Promise.all(['.yg-alan','.yg-alan svg'].map(s=>page.locator(s).boundingBox()));
     const vb=await page.locator('.yg-alan svg').evaluate(e=>e.viewBox.baseVal.height/e.viewBox.baseVal.width);
     assert(Math.abs(svg.height-alan.height)<1 && Math.abs(vb-alan.height/alan.width)<0.02,'chart fills its area: '+vb+' vs '+alan.height/alan.width);}
   // Chart text keeps a readable size at every width (the drawing follows the card, not a fixed 480).
   // The refit runs on the next animation frame after a redraw; measure after it.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const yazi=await page.locator('.yg-alan svg text').first().evaluate(e=>e.getBoundingClientRect().height);
   assert(yazi>=13 && yazi<=22,'axis text height '+yazi);
   // The headings are links: "Deneme gelişimi" → Denemelerim, "Haftalar haritası" → the map.
   await page.locator('.pano-sag-bas .baslik-link').click();assert.equal(await page.evaluate(()=>EK.sekme),'denemeler');
   await page.locator('#ray > button.marka').click();await page.locator('.pano-sol-bas .baslik-link').click();
   assert.equal(await page.evaluate(()=>EK.sekme),'harita');await page.locator('#ray > button.marka').click();
   // Target net: typed by the student, drawn as a dashed line, kept in the notebook per choice.
   await page.locator('#dnHedef').fill('80');await page.locator('#dnHedef').press('Enter');await page.locator('#dnHedef').blur();
   await page.waitForFunction(()=>D.ogr[0].denemeHedef===80);await page.locator('.dn-yol .yg-hedef').waitFor({state:'attached'});
   assert((await page.locator('.dn-yol').innerText()).includes('Hedef 80'));
   // TYT · AYT · Branş: Branş opens a course list; each choice has its own axis and target.
   await page.locator('[data-dn-yol-sec="AYT"]').click();assert.equal(await page.locator('[data-dn-yol-sec="AYT"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.dn-yol .yg-hedef').count(),0,'the TYT target is not drawn on AYT');
   assert.equal(await page.locator('#dnYolBrans').count(),0,'no course list outside Branş');
   await page.locator('[data-dn-yol-sec="BRANS"]').click();await page.locator('#dnYolBrans').selectOption('TYT:turkce');
   assert.equal(await page.evaluate(()=>EK.denemeYolBrans),'TYT:turkce');assert.equal(await page.locator('#dnHedef').getAttribute('max'),'40');
   assert((await page.locator('.dn-yol').innerText()).includes('Henüz TYT Türkçe denemesi yok'));
   await page.locator('#dnHedef').fill('30');await page.locator('#dnHedef').press('Enter');await page.locator('#dnHedef').blur();
   await page.waitForFunction(()=>D.ogr[0].denemeHedef['TYT:turkce']===30&&D.ogr[0].denemeHedef.TYT===80);
   await page.screenshot({path:path.join(out,'student-home-brans-'+width+'.png'),fullPage:true});
   await page.locator('[data-dn-yol-sec="TYT"]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'home overflow');
   await page.screenshot({path:path.join(out,'student-home-'+width+'.png'),fullPage:true});
   await page.locator('#ray [data-sekme="plan"]').click();assert.equal(await page.evaluate(()=>EK.sekme),'plan','Planım opens the weekly plan');
   await page.locator('[data-sekme="ayarlar"]').first().click();
   await page.getByRole('heading',{name:'Test hesabın'}).waitFor();
   assert((await page.locator('#ana').innerText()).includes('tester@example.test'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'settings overflow');
   await page.screenshot({path:path.join(out,'test-account-settings-'+width+'.png'),fullPage:true});
   // Reset: typed confirmation, then cloud notebook, history and device copy are gone.
   // The reset sits where people look for it: Gelişmiş ayarlar → Verileri sıfırla.
   await page.getByRole('heading',{name:'Test hesabın'}).waitFor();
   assert.equal(await page.locator('#testSifirla').isVisible(),false,'folded away until Gelişmiş ayarlar opens');
   await page.locator('summary',{hasText:'Gelişmiş ayarlar'}).click();
   const kart=page.locator('.kart',{has:page.getByRole('heading',{name:'Verileri sıfırla'})});
   assert.equal(await kart.locator('#testSifirla').isVisible(),true,'next to Tarayıcı verilerini sıfırla');
   assert.equal(await kart.locator('#tarayiciSifirla').count(),1);
   await page.screenshot({path:path.join(out,'test-account-reset-'+width+'.png'),fullPage:true});
   assert(bulutYollari.some(k=>k.startsWith('testDefter/google-1')),'the cloud holds the notebook before');
   const yerelSayisi=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>String(localStorage.getItem(k)).includes('Kuzey')).length);
   assert(await yerelSayisi()>0,'the device holds the notebook before');
   sifirla=true;
   await Promise.all([page.waitForEvent('load'),page.locator('#testSifirla').click()]);
   await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
   assert.deepEqual(bulutYollari.filter(k=>k.startsWith('testDefter/google-1')),[],'notebook and history are deleted');
   assert.equal(await page.evaluate(()=>D.rol===''&&!D.testHesap&&D.ogr.length===0),true,'the device copy is gone');
   assert.equal(await yerelSayisi(),0,'no stored copy remains');
   await page.locator('#testHesapAc').waitFor();
   // Kaydol: user name (spaces removed), password with the eye button and the field; the YKS plan
   // starts this week without school, and the student lands on the home page.
   await page.locator('#kaydolAc').click();
   const kayitKart=await page.locator('#kaydolKart').boundingBox();
   assert(kayitKart.height<=320 && kayitKart.width<=362,'compact sign-up card: '+Math.round(kayitKart.width)+'×'+Math.round(kayitKart.height));
   await page.locator('#kaydolAd').fill('Deniz Kaya');
   assert.equal(await page.locator('#kaydolDurum').textContent(),'Kullanıcı adın: denizkaya','spaces are shown removed');
   await page.locator('#kaydolSifre').fill('gizli-123');
   await page.locator('[data-sifre-goster="kaydolSifre"]').click();assert.equal(await page.locator('#kaydolSifre').getAttribute('type'),'text');
   await page.locator('#kaydolBaslat').click();
   assert.equal(await page.locator('#kaydolDurum').textContent(),'Alanını seç.');
   await page.locator('#kaydolAlanSec').selectOption('SAY');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'sign-up overflow');
   await page.screenshot({path:path.join(out,'kaydol-form-'+width+'.png')});
   await page.locator('#kaydolSifre').press('Enter');                     // Enter submits like the button
   await page.locator('.ana-pano').waitFor();
   assert.deepEqual(await page.evaluate(()=>window.__uyeKayit),['denizkaya','gizli-123']);
   assert.equal(await page.evaluate(()=>D.testHesap.tur==='uye'&&D.ogr[0].okul===false&&D.ogr[0].alan==='SAY'&&D.ogr[0].kendiPlan.tur==='YKS'&&
     D.ayar.donemBasi===isoDan(pazartesi(bugunNo()))),true,'YKS without school, own plan, weeks from this Monday');
   assert.equal((await page.evaluate(()=>bulutaYedekle())).tur,'tamam');
   assert(bulutYollari.includes('testDefter/uye-denizkaya'),'the notebook is saved to the cloud');
   await page.screenshot({path:path.join(out,'kaydol-home-'+width+'.png')});
   // Ayarlar → Kullanıcı adını değiştir, then Şifre değiştir (both folded, right under the heading).
   await page.locator('#ray [data-sekme="ayarlar"]').first().click();
   const sifreKart=page.locator('#sifreKart');
   const [ayarBaslik,adKutu,kartKutu]=await Promise.all([page.locator('.baslik h1').first().boundingBox(),page.locator('#adKart').boundingBox(),sifreKart.boundingBox()]);
   assert(adKutu.y>ayarBaslik.y+ayarBaslik.height && adKutu.y-ayarBaslik.y<120 && kartKutu.y>=adKutu.y+adKutu.height-1 && kartKutu.y-adKutu.y<120,'the cards sit under the Ayarlar heading');
   assert.equal(await page.locator('#sdMevcut').isVisible(),false,'folded');
   await sifreKart.locator('summary').click();
   await page.locator('#sdMevcut').fill('gizli-123');await page.locator('#sdYeni').fill('yeni-sifre-1');await page.locator('#sdEposta').fill('deniz@example.com');
   await page.locator('[data-sifre-goster="sdYeni"]').click();assert.equal(await page.locator('#sdYeni').getAttribute('type'),'text');
   await page.locator('#sdYeni').press('Enter');
   await page.locator('#sifreDurum',{hasText:'Şifren değişti.'}).waitFor();
   assert.deepEqual(await page.evaluate(()=>window.__sifre),['gizli-123','yeni-sifre-1',null,'deniz@example.com']);
   assert.equal(await page.locator('#adKart summary').textContent(),'Kullanıcı adını değiştir','Kaydol can change the user name');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'settings overflow');
   await page.screenshot({path:path.join(out,'sifre-degistir-'+width+'.png')});
   // Teacher: requests waiting pop up when the teacher's app opens; a Kaydol reset shows the new password.
   await page.evaluate(()=>{
    disariAktarmayiKapat&&disariAktarmayiKapat();
    D=varsayilan();D.rol='rehber';D.ogr=[{no:42,ad:'Ada Yılmaz',alan:'SAY',sube:'12A',sinif:12,kap:6,off:[6],aktif:true,hesapUid:'okul-1',syncId:'slot-1',maddeler:[],rutin:{}}];
    EK={ogr:0,sekme:'takip',hafta:null,girisAcik:{}};
    Object.assign(window.bulut,{mevcutKullanici:()=>({uid:'ogretmen-1',isAnonymous:false,email:'rehber@example.com'}),
      sifreTalepleriAl:async()=>[{id:'t1',tur:'uye',ad:'denizkaya',eposta:'deniz@example.com',ts:1790000000000},{id:'t2',tur:'okul',ad:'Ada Yılmaz',eposta:'veli@example.com',ts:1790000100000}],
      kurtarmaKayitlari:async tur=>tur==='uye'?[{uid:'uye-denizkaya',eposta:'deniz@example.com'}]:[],
      uyeYonu:async()=>({uid:'uye-denizkaya'}),uyeSifreSifirla:async()=>({sifre:'48213307',uid:'uye-2'}),sifreTalebiSil:async()=>{}});
    ciz();
   });
   const talep=page.locator('#talepOrtu [role="dialog"]');await talep.waitFor();
   assert((await talep.innerText()).includes('E-posta talepleri bekliyor (2)'));
   assert.equal(await talep.locator('.talep').count(),2);
   await talep.locator('[data-talep-uye="t1"]').click();
   await talep.locator('.talep-sifre',{hasText:'48213307'}).waitFor();
   assert.match(await talep.locator('a.dugme',{hasText:'E-posta yaz'}).getAttribute('href'),/^mailto:deniz%40example\.com\?subject=/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'teacher popup overflow');
   await page.screenshot({path:path.join(out,'eposta-talepleri-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#talepOrtu').count(),0);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('test account browser checks passed; screenshots in '+out);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
