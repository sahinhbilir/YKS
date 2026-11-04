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
assert.deepEqual(errors,[]);await page.close();console.log('PASS personal board privacy and typography',width);
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
