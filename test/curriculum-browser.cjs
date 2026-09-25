const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-curriculum-'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.YKS_CHROMIUM ? {executablePath:process.env.YKS_CHROMIUM} : {})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],dialogs=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message);});page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
   await context.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
   await page.goto('http://localhost/?dev=1');await page.getByText('Kimsiniz?',{exact:true}).waitFor();
   await page.evaluate(()=>{D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';ciz();});
   await page.locator('#kOgrAd').fill('Test Öğrenci');await page.locator('#kOgrSinif').selectOption('11');
   assert(await page.locator('#kOgrSube').isDisabled());
   await page.locator('#kMufredatBaslangic').fill('2026-09-21');await page.locator('#kOgrBaslat').click();
   await page.waitForFunction(()=>D.ogr.length===1&&D.ogr[0].sinif===11);
   assert.equal(await page.evaluate(()=>D.konuPlani.benim[0].Matematik[0].startsWith('11. sınıf')),true);
   // A real schedule upload must fill the Grade 11 course and separate TYT cells.
   const openAdvanced=async()=>{
    const details=page.locator('details').filter({has:page.getByText('Gelişmiş ayarlar',{exact:true})});
    if(await details.getAttribute('open')===null)await details.locator('summary').click();
   };
   await page.locator('[data-sekme="ayarlar"]').first().click();await openAdvanced();
   await page.locator('#dpCiktiYapistir').fill(JSON.stringify({saatler:['09:00','10:00'],
    gunler:[['MATEMATİK','TYT MATEMATİK'],['AYT MATEMATİK',''],[],[],[],[],[]]}));
   await page.locator('#dpCiktiUygula').click();
   await page.waitForFunction(()=>D.konuPlani.benim[0]['Matematik TYT']?.length);
   await openAdvanced();
   const mathCell=page.locator('td').filter({has:page.locator('.progHucre[data-g="0"][data-s="0"]')});
   const tytCell=page.locator('td').filter({has:page.locator('.progHucre[data-g="0"][data-s="1"]')});
   assert.equal(await mathCell.locator('select.progHucre').inputValue(),'MATEMATİK');
   assert.equal(await tytCell.locator('select.progHucre').inputValue(),'TYT MATEMATİK');
   assert((await mathCell.locator('.konuKutu').innerText()).includes('İki Nicel Değişkenli'));
   assert(!(await mathCell.locator('.konuKutu').innerText()).includes('11. sınıf'));
   assert(await tytCell.locator('.konuCip').count()>0);
   assert(!(await tytCell.locator('.konuCip').first().innerText()).includes('11. sınıf'));
   assert.equal(await page.locator('#donemBasi').inputValue(),'2026-09-21');
   await page.locator('#haftaSec').selectOption('3');
   await page.waitForFunction(()=>planHaftasi('benim',gunNo('2026-09-21'))===3);
   await openAdvanced();
   assert.equal(await page.locator('#donemBasi').inputValue(),'2026-09-07');
   await page.screenshot({path:path.join(out,'grade11-timetable-'+width+'.png'),fullPage:true});
   await page.locator('[data-sekme="mufredat"]').first().click();
   await page.getByRole('heading',{name:'Müfredat ve kaynaklar'}).waitFor();
   await page.locator('summary').filter({hasText:'Matematik'}).click();
   assert((await page.locator('#ana').innerText()).includes('İstatistiksel Araştırma Süreci'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'curriculum viewport overflow');
   await page.screenshot({path:path.join(out,'curriculum-'+width+'.png'),fullPage:true});
   await page.locator('#mufredatSinif').selectOption('12');assert((await page.locator('#ana').innerText()).includes('önceki öğretim programı'));
   // A student who uploads a timetable after auto-freeze needs a visible repair.
   // Synthetic notebook only: no account or personal data from the reported backup.
   await page.evaluate(()=>{
    D=varsayilan();D.elle={};D.rol='ogrenci';D.ayar.testTarih='2026-09-25';
    D.ogr=[{ad:'Synthetic Grade Eleven',no:1,sube:'11-X',alan:'EA',sinif:11,mufredatBaslangic:'2026-09-21',kap:6,off:[6],aktif:true}];
    D.konuPlani['11-X']=okulKonuPlani(11);EK.ogr=0;EK.sube='11-X';EK.hafta=null;EK.sekme='plan';
    programYaz('11-X',buHafta(),{saatler:['09:00','10:00','11:00'],gunler:[
     ['TÜRK DİLİ VE EDEBİYATI','TARİH','COĞRAFYA'],['MATEMATİK'],['FELSEFE','MATEMATİK TYT'],['DİN KÜLTÜRÜ'],['GEOMETRİ','TÜRKÇE'],[],[]]});
    programDegistiTetikle('11-X');
    const ki=+Object.keys(D.subeIslenis['11-X']).find(k=>konuAl(+k)[3].includes('Web Tabanlı'));
    D.ogr[0].cikti=buHafta();D.ogr[0].ilkAktif=bugunNo();
    D.elle['0|'+buHafta()]={ek:[],sil:[],yer:{[ki]:[3,0]},soru:{[ki]:24},degisim:{},konuSlot:{},sabit:buHafta(),ogrenciOtomatik:true,
     plan:{surum:2,slotlar:[[],[],[],[String(ki)],[],[],[]],off:[6],kap:6,devreden:0,tasan:[]}};
    ciz();
   });
   await page.locator('#ogrProgramYenile').waitFor();
   assert.equal(await page.evaluate(()=>planHesapla(0,buHafta()).toplam),1);
   await page.locator('#ogrProgramYenile').click();
   await page.waitForFunction(()=>planHesapla(0,buHafta()).toplam>1);
   assert.equal(await page.locator('#ogrProgramYenile').count(),0);
   assert(await page.locator('#ogrProgramYedek').isVisible());
   assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('yks_program_yenile_oncesi')).elle['0|'+buHafta()].plan.slotlar.flat().length===1));
   await page.getByText('Bu haftanın okul konuları · 1. plan haftası',{exact:true}).click();
   assert((await page.locator('#ana').innerText()).includes('İki Nicel Değişkenli Veriler'));
   assert((await page.locator('#ana').innerText()).includes('GEOMETRİ, TÜRKÇE'));
   assert(!(await page.locator('#ana').innerText()).includes('11. sınıf ·'));
   await page.screenshot({path:path.join(out,'grade11-current-week-repaired-'+width+'.png'),fullPage:true});
   await page.getByText('Konu Planı’nı aç',{exact:true}).click();
   await page.locator('.kpYeniAd[data-ders="GEOMETRİ"]').fill('Geometrik Şekiller');
   await page.locator('.kpEkle[data-ders="GEOMETRİ"]').click();
   await page.waitForFunction(()=>D.konuPlani['11-X'][0]['GEOMETRİ']?.[0]==='Geometrik Şekiller');
   assert.equal(await page.evaluate(()=>D.konuPlani['11-X'].length),36,'new course must not be appended in week 37');
   // Teacher adds grade11 to a notebook containing existing grade12 students.
   await page.evaluate(()=>{D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-23';
    D.ogr=[{no:1,ad:'Mevcut Öğrenci',sube:'12-A',alan:'SAY',aktif:false}];
    D.konuPlani['12-A']=JSON.parse(JSON.stringify(VARSAYILAN_KONU_PLANI.SAY));window.oldPlan=JSON.stringify(D.konuPlani['12-A']);
    EK.ogr=0;EK.sekme='ogrenciler';EK.sube=null;ciz();});
   await page.locator('#yAd').fill('Yeni Öğrenci');await page.locator('#ySinif').selectOption('11');await page.locator('#ogrEkle').click();
   assert.equal(await page.evaluate(()=>D.ogr.length),1,'mixed grade branch rejected');assert(dialogs.some(x=>x.includes('farklı sınıf')));
   await page.locator('#ySube').selectOption('__yeni');await page.locator('#ySubeYeni').fill('11-A');await page.locator('#ySinif').selectOption('11');
   await page.locator('#yMufredatBaslangic').fill('2026-09-21');await page.locator('#ogrEkle').click();
   await page.waitForFunction(()=>D.ogr.length===2);
   assert.equal(await page.evaluate(()=>D.ogr[1].sinif),11);
   assert.equal(await page.evaluate(()=>JSON.stringify(D.konuPlani['12-A'])===window.oldPlan),true);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yks_veri')).ogr[1].sinif),11);
   await page.locator('[data-sekme="konuplani"]').first().click();await page.locator('#subeSec').selectOption('12-A');
   await page.locator('#yksEksikleriEkle').click();await page.waitForFunction(()=>yksPlanEksikleri('12-A').length===0,null,{timeout:5000});
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS desktop/mobile: enrollment, mixed-grade guard, persistence, source browsing and legacy repair. Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
