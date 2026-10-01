// "Test hesabı aç" in a real browser: bottom-right placement on desktop and phone,
// Google sign-in (faked), nickname setup and the first cloud save. No real Firebase.
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
  window.bulut={yapilandirilmis:true,db:{},doc:(_db,...p)=>p.join('/'),mevcutKullanici:()=>user,oturumHazir:async()=>{},
    girisOgretmen:async()=>(user={uid:'google-1',isAnonymous:false,email:'tester@example.test'}),
    getDocFromServer:async ref=>snap(bulut[ref]),setDoc:async(ref,v)=>{bulut[ref]=JSON.parse(JSON.stringify(v));},
    async runTransaction(_db,fn){const w=[];await fn({get:async ref=>snap(bulut[ref]),set:(ref,v)=>w.push([ref,v])});
      w.forEach(([ref,v])=>{bulut[ref]=JSON.parse(JSON.stringify(v));});},
    oturumuKapat:async()=>{user=null;}};
};
const kesisir=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});
   page.on('dialog',async d=>{errors.push('dialog: '+d.message());await d.dismiss();});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await context.addInitScript(sahteBulut);
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   const dugme=page.locator('#testHesapAc');
   await dugme.waitFor();
   const kutu=await dugme.boundingBox(),kapsayici=await page.locator('.test-hesap').boundingBox();
   assert(Math.abs(width-(kapsayici.x+kapsayici.width)-16)<=1,'16px from the right edge');
   assert(Math.abs(800-(kapsayici.y+kapsayici.height)-16)<=1,'16px from the bottom edge');
   for(const kart of await page.locator('.kur-kart').all())
     assert(!kesisir(kutu,await kart.boundingBox()),'button must not cover a role card');
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
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('test account browser checks passed; screenshots in '+out);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
