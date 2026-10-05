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
    oturumuKapat:async()=>{user=null;}};
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
   const [baslik,girisKart,giris,rehber,test,cizim]=await Promise.all(['.giris-baslik','#ogrenciGirisAlan','#ogrenciBulutGiris','#rolRehber','#testHesapAc','.giris-cizim'].map(kutu));
   assert(baslik.y+baslik.height<=girisKart.y && girisKart.y+girisKart.height<=cizim.y,'login sits between the headline and the drawing');
   for(const b of [rehber,test])assert(kesisir(b,girisKart) && b.y>=giris.y+giris.height,'teacher and test account sit under Giriş yap');
   assert(giris.y+giris.height<=800,'Giriş yap is visible without scrolling');
   assert.equal(await page.evaluate(()=>['#ogrenciGirisAd','#ogrenciGirisNo','#ogrenciBulutGiris','#rolRehber','#testHesapAc'].every(s=>{
     const r=document.querySelector(s).getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest(s);})),true,'no decoration covers a control');
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
   await page.locator('[data-sekme="ayarlar"]').first().click();
   await page.getByRole('heading',{name:'Test hesabın'}).waitFor();
   assert((await page.locator('#ana').innerText()).includes('tester@example.test'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'settings overflow');
   await page.screenshot({path:path.join(out,'test-account-settings-'+width+'.png'),fullPage:true});
   // Reset: typed confirmation, then cloud notebook, history and device copy are gone.
   // The reset sits where people look for it: Gelişmiş ayarlar → Verileri sıfırla.
   await page.getByText('Baştan başlamak için: Gelişmiş ayarlar → Verileri sıfırla').waitFor();
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
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('test account browser checks passed; screenshots in '+out);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
