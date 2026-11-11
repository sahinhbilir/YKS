// Personal board must render only the selected student's merged results.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
const out=process.env.YKS_UI_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'yks-student-board-'));fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.YKS_CHROMIUM?{executablePath:process.env.YKS_CHROMIUM}:{})});
try {for(const width of [1280,390]) {const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('http://localhost/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
await page.goto('http://localhost/?dev=1');await page.getByRole('heading',{name:/^YKS \d{4}$/}).waitFor();
await page.evaluate(()=>{const row=(id,ad,tarih)=>({id,ad,tarih,tur:'TYT',oturum:'TYT',alan:'SAY',ts:10,sure:null,puan:null,dersler:[{kod:'turkce',dogru:20,yanlis:4,soru:40}]});
 D=varsayilan();D.rol='ogrenci';D.ogr=[{ad:'KENDİ ÖĞRENCİ',no:1,alan:'SAY',aktif:true,denemeler:[row('m:own','Kişisel sonuç','2026-09-01')],denemeOkul:[row('p:own','Okul sonucu','2026-09-02')],denemeSure:[{id:'p:own',ts:11,sure:123}]},{ad:'GİZLİ ARKADAŞ',no:2,alan:'SAY',aktif:true,denemeler:[row('m:other','Gizli sonuç','2026-09-03')]}];D.ogr[0].denemeOkul[0].dersler[0].dogru=24;EK.ogr=0;EK.sekme='denemeler';ciz()});
assert(await page.locator('#dpKok.dn-kisisel').isVisible());assert(await page.getByRole('heading',{name:'Deneme Panosu'}).isVisible());
const text=await page.locator('#dpKok').innerText();assert(text.includes('Kişisel sonuç')&&text.includes('Okul sonucu'));assert(!text.includes('GİZLİ ARKADAŞ')&&!text.includes('Gizli sonuç'));
// A student cannot reach the teacher's controls or another student's board, even with stale state.
assert.equal(await page.evaluate(()=>{EK.denemeKisi=true;EK.ogr=1;const r=denemeKisiAc(1);EK.ogr=0;EK.denemeKisi=undefined;return r}),false);
assert.equal(await page.locator('#dpSinifaDon,#dpOgrAc,[data-dn-kisi],#dnPdf').count(),0);assert(text.includes('123 dk'));assert((await page.locator('.et-ozet-kart').last().innerText()).includes('+4'));
await page.locator('#dnBas').fill('2026-09-02');assert((await page.locator('.et-ozet-kart').last().innerText()).includes('veri yok'));await page.locator('#dnBas').fill('');
assert.equal(await page.locator('.dn-dot').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
const number=await page.locator('.et-ozet-kart strong').first().evaluate(e=>{const s=getComputedStyle(e);return {font:s.fontFamily,weight:s.fontWeight}});
assert(number.font.startsWith('Arial')&&Number(number.weight)>=700,'report number typography');
await page.screenshot({path:path.join(out,'student-deneme-'+width+'.png'),fullPage:true});
// Shared cards also work in the teacher's per-student view, outside the board root.
await page.evaluate(()=>{D.rol='rehber';EK.sekme='denemeler';denemeKisiAc(0)});
const panel=await page.locator('.dn-panel').first().evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,font:s.fontFamily}});
assert.equal(panel.bg,'rgb(255, 255, 255)','teacher personal cards keep a white surface');
assert.equal(await page.locator('#dpSinifaDon').count(),1,'the teacher has the way back');{const t=await page.locator('#dpKok').innerText();assert(t.includes('Kişisel sonuç')&&!t.includes('Gizli sonuç'),'the teacher sees only the opened student');}
await page.locator('#dpSinifaDon').click();assert.equal(await page.locator('#dpKok.dn-ogretmen').count(),0,'back on the class view');assert(panel.font.startsWith('Arial'));

// ---- the student's home chart is the Denemelerim chart: same list, real dates, one line, TYT / AYT / Branş, Hedef ----
await page.evaluate(()=>{
 const dersler=(kod,dogru,yanlis=0,kod2,d2=0,y2=0)=>[{kod,dogru,yanlis,soru:null},...(kod2?[{kod:kod2,dogru:d2,yanlis:y2,soru:null}]:[])];
 const row=(ad,tarih,oturum,dr)=>({id:'p:'+encodeURIComponent([denemeAdAnahtari(ad),tarih,oturum].join('|')),ad,tarih,tur:oturum,oturum,brans:'',alan:'SAY',ts:10,sure:null,puan:null,sinavTuru:'genel',dersler:dr});
 D=varsayilan();D.rol='ogrenci';D.ayar.donemBasi='2026-08-31';D.ayar.sinav='2027-06-19';
 D.ogr=[{ad:'SENTETİK ÖĞRENCİ',no:1,sube:'12-A',alan:'SAY',sinif:12,aktif:true,
  denemeOkul:[row('Hazırbulunuşluk-2','2026-08-18','TYT',dersler('turkce',40,0,'mat',1,1)),row('27-YKS-1201','2026-09-25','TYT',dersler('turkce',40,0,'mat',5,0)),
   row('27-YKS-1203','2026-10-23','TYT',dersler('turkce',40,0,'mat',14,2)),row('27-YKS-1201','2026-09-26','AYT',dersler('mat',10,0)),row('27-YKS-1203','2026-10-30','AYT',dersler('mat',20,4))],
  // The student's own entry of 1203 under another spelling and the AYT day: it must not appear as a fourth TYT exam.
  denemeler:[{...row('27 YKS 1203 TYT','2026-10-30','TYT',dersler('turkce',40,0,'mat',14,2)),id:'m:own'}]}];
 EK.ogr=0;EK.sekme='ana';delete EK.denemeTur;delete EK.denemeBrans;delete EK.denemeOturum;delete EK.denemeAlan;ciz();
});
const kart=page.locator('.ana-pano .dn-yol.dn-ana');await kart.waitFor();
await page.waitForFunction(()=>document.querySelectorAll('.dn-ana circle.dn-dot').length===3);
assert.equal(await page.locator('.dn-ana .dn-chart').count(),1,'the panosu renderer');assert.equal(await page.locator('.dn-ana .yg-yks,.dn-ana .yg-cizgi').count(),0,'not the old term chart');
assert.equal(await page.locator('.dn-ana polyline.dn-cizgi').count(),1,'one continuous line');
{const x=await page.locator('.dn-ana circle.dn-dot').evaluateAll(l=>l.map(c=>[c.dataset.dnYol,Number(c.getAttribute('cx'))]));
 assert.deepEqual(x.map(a=>a[0]),['p:'+encodeURIComponent('HAZIRBULUNUŞLUK-2|2026-08-18|TYT'),'p:'+encodeURIComponent('27-YKS-1201|2026-09-25|TYT'),'p:'+encodeURIComponent('27-YKS-1203|2026-10-23|TYT')],'3 TYT exams, the own 1203 hidden');
 const g=d=>Date.parse(d)/864e5;assert(Math.abs((x[1][1]-x[0][1])/(x[2][1]-x[0][1])-(g('2026-09-25')-g('2026-08-18'))/(g('2026-10-23')-g('2026-08-18')))<.01,'x follows the real dates; the August exam is not folded onto the term start');}
{const t=await page.locator('.dn-ana svg text').evaluateAll(l=>l.map(e=>e.textContent));assert(t.includes('18 Ağu')&&t.includes('23 Eki'),'the axis names the first and last real dates, written as the teacher’s boards write them: '+t.join(','));}
assert.equal(await page.locator('.dn-ana svg').evaluate(e=>Math.abs(e.getBoundingClientRect().width-e.parentElement.clientWidth)<2),true);
// The same exams and nets as Denemelerim.
const anaNetler=await page.locator('.dn-ana circle.dn-dot').evaluateAll(l=>l.map(c=>c.getAttribute('aria-label').match(/ (\S+) net/)?.[1]));
if(width===1280)await page.screenshot({path:path.join(out,'ogrenci-ana-'+width+'.png'),fullPage:true});
// TYT / AYT / Branş.
await page.locator('[data-dn-ana-tur="AYT"]').click();
await page.waitForFunction(()=>document.querySelector('[data-dn-ana-tur="AYT"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.dn-ana circle.dn-dot').length===2);
assert.equal(await page.locator('.dn-ana polyline.dn-cizgi').count(),1);assert.equal(await page.locator('[data-dn-ana-alan="SAY"]').getAttribute('aria-pressed'),'true','own field preselected');
await page.locator('[data-dn-ana-alan="EA"]').click();await page.waitForFunction(()=>document.querySelector('[data-dn-ana-alan="EA"]').getAttribute('aria-pressed')==='true'&&EK.denemeAlan==='EA');
await page.locator('[data-dn-ana-alan="SAY"]').click();await page.waitForFunction(()=>document.querySelector('[data-dn-ana-alan="SAY"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.dn-ana circle.dn-dot').length===2);
await page.locator('[data-dn-ana-tur="BRANS"]').click();await page.locator('#dnAnaBrans').waitFor();
await page.locator('#dnAnaBrans').selectOption('TYT:mat');
await page.waitForFunction(()=>document.querySelectorAll('.dn-ana circle.dn-dot').length===3&&document.querySelector('#dnAnaBrans').value==='TYT:mat');
assert.equal(await page.evaluate(()=>[EK.denemeTur,EK.denemeOturum,EK.denemeBrans].join()),'BRANS,TYT,mat','the choice is Denemelerim’s too');
await page.locator('[data-dn-ana-tur="TYT"]').click();await page.waitForFunction(()=>document.querySelector('[data-dn-ana-tur="TYT"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.dn-ana circle.dn-dot').length===3);
// Hedef is a line of the chart.
assert.equal(await page.locator('.dn-ana .dn-hedef').count(),0);
await page.locator('#dnHedef').fill('70');await page.locator('#dnHedef').press('Enter');await page.locator('#dnHedef').blur();
await page.waitForFunction(()=>D.ogr[0].denemeHedef===70&&document.querySelectorAll('.dn-ana .dn-hedef').length===1);
assert((await page.locator('.dn-ana svg').evaluate(e=>e.textContent)).includes('Hedef 70'));
{const yH=Number(await page.locator('.dn-ana .dn-hedef').getAttribute('y1')),ys=await page.locator('.dn-ana circle.dn-dot').evaluateAll(l=>l.map(c=>Number(c.getAttribute('cy'))));assert(ys.every(y=>y>yH),'the goal sits above the exams');}
await page.locator('#dnHedef').fill('');await page.locator('#dnHedef').press('Enter');await page.locator('#dnHedef').blur();
await page.waitForFunction(()=>D.ogr[0].denemeHedef===undefined&&document.querySelectorAll('.dn-ana .dn-hedef').length===0);
await page.locator('#dnHedef').fill('70');await page.locator('#dnHedef').press('Enter');await page.locator('#dnHedef').blur();await page.waitForFunction(()=>document.querySelectorAll('.dn-ana .dn-hedef').length===1);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'home does not scroll sideways');
// The title and a point open Denemelerim with the same exams.
await page.locator('.pano-sag-bas .baslik-link').click();await page.locator('#dpKok.dn-kisisel').waitFor();
assert.equal(await page.evaluate(()=>EK.sekme),'denemeler');
assert.equal(await page.locator('#dpKok circle.dn-dot').count(),3,'the same three exams in Denemelerim');
assert.deepEqual(await page.locator('#dpKok circle.dn-dot').evaluateAll(l=>l.map(c=>c.getAttribute('aria-label').match(/ (\S+) net/)?.[1])),anaNetler);
if(width===390)await page.screenshot({path:path.join(out,'ogrenci-denemelerim-'+width+'.png'),fullPage:true});
await page.evaluate(()=>{EK.sekme='ana';ciz()});await page.locator('.dn-ana circle.dn-dot').last().click();
await page.locator('#dpKok.dn-kisisel').waitFor();assert((await page.locator('#dnDetay').innerText()).includes('27-YKS-1203'),'a point opens that exam in Denemelerim');

assert.deepEqual(errors,[]);await page.close();console.log('PASS personal board privacy and typography',width);
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
