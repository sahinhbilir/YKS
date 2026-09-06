const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const source = html.slice(start, boot);

const listeners = {}; const saved = {}; const timers = []; const windowEvents = {}; let inputRows = []; const alerts = [];
const nodes = {
  ray: { innerHTML: '' }, ana: { innerHTML: '' },
  stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' }
};
const element = () => ({
  style: {}, hidden: false, textContent: '', innerHTML: '', value: '', checked: false,
  classList: { contains() { return false; }, add() {}, remove() {} }, dataset: {},
  setAttribute() {}, appendChild() {}, click() {}, remove() {}, focus() {}, select() {},
  getClientRects() { return [1]; }, closest() { return null; }
});
const sandbox = {
  console, setTimeout(fn,ms) { timers.push({fn,ms}); return timers.length; }, clearTimeout(id) { if(timers[id-1]) timers[id-1].cancelled=true; }, Blob, URL, URLSearchParams,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert(m) { alerts.push(m); }, confirm() { return true; }, prompt() { return ''; },
  fetch: async () => ({ ok: false }),
  localStorage: { getItem(k) { return saved[k] || null; }, setItem(k,v) { saved[k]=v; } },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollTo() {}, open() { return {document:{write(){},close(){}}}; }, addEventListener(k,fn) { windowEvents[k]=fn; } },
  document: {
    activeElement: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '.gDogru' ? inputRows : selector === '.oRutin' ? (nodes.__routines || []) : []; },
    createElement() { return element(); },
    body: { appendChild() {}, insertAdjacentHTML(_where, markup) { this.lastHTML = markup; } }
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(source, { filename: target }).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const checks = [], weeks = [];
function check(name, ok) { assert(ok,name); checks.push(name); }
function init(date='2026-09-06',joined='2026-08-31') {
  sandbox.date=date; sandbox.joined=joined; inputRows=[]; sandbox.window.bulut=null;
  run(`D=null; D=varsayilan(); D.rol='ogrenci'; D.ayar.testTarih=date;
    D.ayar.ilk=3; D.ayar.planBasi='2026-08-31'; D.ayar.donemBasi='2026-08-31'; D.ayar.donemElle=true;
    D.ogr=[{no:1699,ad:'Şahin Bilir',sube:'201',alan:'SAY',kap:6,off:[6],aktif:true,
      ilkAktif:gunNo(joined),maddeler:[],rutin:{}}];
    EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}}; OGRENCI_SYNC_IS=null; OGRENCI_SYNC_ZAMAN=null; OGRENCI_SYNC_DENEME=0;`);
}
function layout(p) { return JSON.stringify(p.gunler.map(l=>l.map(x=>[x.ki,x.slotKi??x.ki,x.soru]))); }
const getPlan = h => run('planHesapla(0,'+h+')');
async function draw() { run('ciz()'); await run('KAYIT_ZINCIRI'); }
async function click(id) {
  const target=Object.assign(element(),{id,closest(s){return s.includes('#'+id)?this:null;}});
  for(const fn of listeners.click||[]) await fn({target});
  await run('KAYIT_ZINCIRI');
}
function fillPlan(p,h,week=0,limit=Infinity) {
  inputRows=[];
  p.gunler.forEach((a,g)=>a.forEach(x=>{
    if(x.anlatim||x.serbest||inputRows.length>=limit)return;
    const profile=x.ki%5, pct=profile===0?.35:profile===1?Math.min(.95,.50+week*.06):profile===2?.8:profile===3?.96:week===4?.25:.85;
    inputRows.push(Object.assign(element(),{value:String(Math.round(x.soru*pct)),
      dataset:{ki:String(x.ki),gun:String(h+g),slot:String(x.slotKi??x.ki)},
      parentElement:{querySelector(){return {value:String(x.soru)};}}}));
  }));
}
(async()=>{
 init(); await draw();
 check('learning-map-in-student-navigation',run('SEKMELER().some(t=>t[0]==="harita")'));
 check('student-controls-are-simple',!/(planiSabitle|Taslak gör|katilmadanOnceGetir|data-hucre)/.test(run('gorunumPlan()')));
 const settings=run('gorunumAyarlar()');
 check('advanced-settings-collapsed',settings.includes('<details')&&!settings.includes('padding:20px" open'));
 check('manual-cloud-send-removed',!settings.includes('id="bulutGonder"'));
 check('teacher-controls-preserved',run(`(()=>{D.rol='rehber';const h=gorunumPlan(),t=SEKMELER().length;D.rol='ogrenci';return h.includes('id="yazdir"')&&t===9;})()`));
 const savedLayouts=[];
 for(let w=0;w<8;w++) {
   const h=run("gunNo('2026-09-07')")+w*7;
   run('EK.hafta='+h); await draw();
   const draft=getPlan(h), expected=layout(draft);
   check('week-'+w+'-future-is-a-preview',!run('elleAl(0,'+h+').sabit'));
   const beforePrint=run('JSON.stringify(D)'); await click('yazdirOnizle');
   check('week-'+w+'-download-does-not-lock',run('JSON.stringify(D)')===beforePrint);
   run('D.ayar.testTarih=isoDan('+(h+6)+');EK.hafta=null;EK.sekme="giris";EK.girisAcik={};');
   await draw();
   const p=getPlan(h);
   check('week-'+w+'-sunday-keeps-prepared-plan',p.toplam>0&&layout(p)===expected);
   fillPlan(p,h,w); const count=inputRows.length, before=run('D.log.length');
   await click('sonucKaydet'); inputRows=[];
   check('week-'+w+'-results-saved',run('D.log.length')-before===count);
   check('week-'+w+'-next-week-opens',run('EK.hafta')===h+7&&run('EK.sekme')==='plan');
   const next=getPlan(h+7);
   check('week-'+w+'-capacity-and-rest-day',next.gunYuk.every(n=>n<=next.kap)&&next.gunler[6].length===0);
   check('week-'+w+'-local-persistence',JSON.parse(saved.yks_veri).log.length===run('D.log.length'));
   savedLayouts.push({h,layout:expected});
   weeks.push({sunday:run('isoDan('+(h+6)+')'),results:count,nextTopics:next.toplam,nextTests:next.testToplam});
   const log=run('JSON.stringify(D.log)');
   run('veriyiHazirla(JSON.parse(localStorage.getItem("yks_veri")))'); await draw();
   check('week-'+w+'-reload-preserves-results',run('JSON.stringify(D.log)')===log);
 }
 check('all-eight-historical-plans-stable',savedLayouts.every(x=>layout(getPlan(x.h))===x.layout));
 check('fsrs-cards-valid',run('Object.values(D.kart).every(c=>Number.isFinite(c.s)&&c.s>0&&c.d>=1&&c.d<=10&&c.due>c.son)'));
 check('no-false-results',alerts.length===0);

 init(); await draw();
 run("D.ayar.testTarih='2026-09-13';EK.hafta=null;EK.sekme='giris';"); await draw();
 const h=run('buHafta()'), p=getPlan(h); fillPlan(p,h,0,1); await click('sonucKaydet'); inputRows=[];
 check('partial-results-stay-on-current-week',run('haftaBasi()')===h&&run('EK.sekme')==='giris');
 check('blank-results-not-invented',run('D.log.length')===1);

 init('2026-09-21','2026-09-21'); await draw();
 check('late-join-catchup-is-automatic',run('(D.ogr[0].otoTelafiEklenen||[]).length')>0);
 const before=run('JSON.stringify(D)'); await draw();
 check('automation-is-idempotent',run('JSON.stringify(D)')===before);
 const history=run('JSON.stringify(D.log)'), oldPlan=layout(getPlan(run('buHafta()')));
 run('ogrenciTelafiyiGeriAl(0)'); await run('kaydet(true)'); await draw();
 check('catchup-undo-preserves-history',run('JSON.stringify(D.log)')===history&&layout(getPlan(run('buHafta()')))===oldPlan);
 check('catchup-undo-removes-unstarted-future-topics',run('planHesapla(0,buHafta()+7).gunler.flat().every(x=>!D.ogr[0].otoTelafiHaric.includes(x.ki)||!!D.kart["0:"+x.ki])'));

 init(); await draw();
 const missed=run('D.ogrTaslak["0|"+(buHafta()+7)].gunler.flat().map(x=>x.ki)');
 run("D.ayar.testTarih='2026-09-21';EK.hafta=null;"); await draw();
 check('skipped-week-does-not-generate-grades',run('D.log.length')===0);
 check('missed-tasks-enter-catchup',getPlan(run('buHafta()')).gunler.flat().some(x=>missed.includes(x.ki)));
 check('skip-keeps-old-week-snapshot',!!run('elleAl(0,gunNo("2026-09-07")).sabit'));

 init('2026-09-07'); run('D.ogr[0].kap=1'); await draw();
 check('one-test-capacity-does-not-starve-new-topics',getPlan(run('buHafta()')).toplam>0&&getPlan(run('buHafta()')).gunYuk.every(n=>n<=1));
 const current=layout(getPlan(run('buHafta()')));
 run('D.ogr[0].kap=3;D.ogr[0].off=[5,6]'); await run('kaydet(true)'); await draw();
 check('settings-change-future-not-issued-plan',layout(getPlan(run('buHafta()')))===current&&getPlan(run('buHafta()+7')).kap===3&&getPlan(run('buHafta()+7')).gunler[5].length===0);

 // Actual queue, read/merge/write transaction, retries and identity changes.
 init('2026-09-07'); await draw();
 run("D.ogr[0].syncId='slot';D.ogr[0].ogrenciBulutId='identity';sonucIsle(0,[{ki:0,gun:bugunNo(),dogru:8,soru:10}]);");
 let write=null, calls=0, fail=true;
 const remote={durum:'aktif',bagliUid:'uid',ogrenciBulutId:'identity',ogrenciNo:1699,ogrenciAd:'Şahin Bilir',ogrenciSube:'201',paket:null};
 sandbox.window.bulut={yapilandirilmis:true,db:{},doc:()=> 'slot',girisOgrenci:async()=>({uid:'uid'}),
   runTransaction:async(_db,fn)=>{calls++;if(fail)throw new Error('offline');return fn({get:async()=>({exists:()=>true,data:()=>remote}),update:(_ref,v)=>{write=v;}});}};
 sandbox.navigator.onLine=false; await run('ogrenciEsitlemeyiDene()');
 check('offline-never-writes',calls===0&&run('D.log.length')===1);
 sandbox.navigator.onLine=true; await run('ogrenciEsitlemeyiDene()');
 check('failed-sync-retains-results-and-retries',run('D.log.length')===1&&timers.some(t=>t.ms===30000&&!t.cancelled));
 fail=false; await run('ogrenciEsitlemeyiDene()');
 check('retry-uploads-existing-results',write&&write.paket.kayit.length===1&&run('D.ogrSonEsitlenen===ogrenciEsitlemeImzasi()'));
 const length=timers.length;run('ogrenciEsitlemePlanla()');
 check('unchanged-results-not-reuploaded',timers.length===length);
 remote.paket=JSON.parse(JSON.stringify(write.paket));
 remote.paket.kayit.push({g:run('bugunNo()'),k:1,d:9,s:10,t:Date.now()+100});
 await run('ogrenciEsitlemeyiDene()');
 check('other-device-results-merged-before-upload',write.paket.kayit.length===2&&run('D.log.length')===2);
 let binding=null;
 sandbox.window.bulut.girisOgrenci=async()=>({uid:'uid',isAnonymous:true});
 sandbox.window.bulut.updateDoc=async(_ref,v)=>{binding=v;};
 await run('ogrenciEsitlemeyiDene()');
 check('legacy-anonymous-binding-keeps-server-results',binding&&Object.keys(binding).sort().join(',')==='bagliUid,sunucuTs'&&write.paket.kayit.length===2);
 const goodWrite=write;
 remote.ogrenciBulutId='wrong-identity';await run('ogrenciEsitlemeyiDene()');
 check('mismatched-student-identity-never-uploads',write===goodWrite);
 remote.ogrenciBulutId='identity';
 let release; sandbox.window.bulut.girisOgrenci=()=>new Promise(r=>release=r);
 const pending=run('ogrenciEsitlemeyiDene()'); const count=calls;
 run('D=JSON.parse(JSON.stringify(D));D.ogr[0].syncId="other";'); release({uid:'uid'}); await pending;
 check('account-change-cancels-stale-sync',calls===count);

 init('2026-09-07'); await draw();
 run('D.rol="rehber"');
 const packet=run('ogrenciPaketi(0)'); sandbox.packet=packet;
 check('teacher-packet-carries-class-program',run('JSON.stringify(paketiYukle(packet).konuPlani["201"])===JSON.stringify(D.konuPlani["201"])')&&!!packet.dersProgrami);
 run('D.rol="ogrenci";D.ayar.sinav="2026-09-10";');
 check('no-new-work-on-or-after-exam',getPlan(run('gunNo("2026-09-14")')).toplam===0);
 init('2026-09-07');
 run('sonucIsle(0,[{ki:0,gun:bugunNo(),dogru:8,soru:10}]); savedDistributor=ileriDagit; ileriDagit=()=>{D.log=[];throw new Error("broken timetable");};');
 await run('kaydet(true)');
 check('automation-error-does-not-lose-results',JSON.parse(saved.yks_veri).log.length===1&&run('D.log.length')===1&&!!run('EK.ogrOtoHata'));
 run('ileriDagit=savedDistributor');await draw();
 // Learning context must remain accurate as later FSRS reviews arrive.
 init('2026-09-28');
 run(`sonucIsle(0,[{ki:0,gun:gunNo('2026-09-07'),dogru:8,soru:10},
   {ki:0,gun:gunNo('2026-09-14'),dogru:9,soru:10},
   {ki:0,gun:gunNo('2026-09-21'),dogru:10,soru:10}]);`);
 const historyBefore=run('JSON.stringify([D.log,D.kart])');
 check('historical-first-review-stays-first',run(`tekrarBilgisi(0,{ki:0,kart:D.kart['0:0']},gunNo('2026-09-07')).n===1`));
 check('historical-second-review-stays-second',run(`tekrarBilgisi(0,{ki:0,kart:D.kart['0:0']},gunNo('2026-09-14')).n===2`));
 check('previous-score-is-relative-to-scheduled-day',run(`tekrarBilgisi(0,{ki:0,kart:D.kart['0:0']},gunNo('2026-09-14')).aciklama.includes('%80')`));
 check('upcoming-review-is-fourth',run(`tekrarBilgisi(0,{ki:0,kart:D.kart['0:0']},bugunNo()).n===4`));
 check('same-day-result-is-shown-without-incrementing-stage',run(`tekrarBilgisi(0,{ki:0},gunNo('2026-09-14')).cevap==='9/10'`));
 check('routine-is-not-a-repetition',run(`tekrarBilgisi(0,{ki:'S1',serbest:true},bugunNo()).tur==='diger'`));
 check('learning-labels-never-change-fsrs',historyBefore===run('JSON.stringify([D.log,D.kart])'));
 const fakePlan={gunler:[[{ki:0,kart:run('D.kart["0:0"]'),ad:'Konu',dersAd:'Matematik',test:2,soru:24},{ki:1,ad:'Yeni konu',dersAd:'Fizik',test:2,soru:24},{ki:'S1',serbest:true,ad:'Rutin',soru:20}],[],[],[],[],[],[]],off:[6],gunYuk:[5,0,0,0,0,0,0],kap:6};
 sandbox.learningPlan=fakePlan;
 const summary=run(`ogrenciHaftaOzeti(0,gunNo('2026-09-14'),learningPlan)`);
 check('summary-counts-topics-not-test-units-or-routines',summary.toplam===2&&summary.ilk===1&&summary.tekrar===1&&summary.girilen===1);
 check('read-only-desktop-plan-shows-stage',run(`planTablosu(0,gunNo('2026-09-14'),learningPlan,false,true)`).includes('2. tekrar'));
 check('mobile-plan-shows-stage',run(`planListesi(0,gunNo('2026-09-14'),learningPlan,true)`).includes('2. tekrar'));
 check('weeks-map-does-not-infer-completion',run('gorunumHaritasi()').includes('1 sonuç')&&!run('gorunumHaritasi()').includes('hafta tamamlandı'));
 check('weeks-map-is-not-a-manual-catch-up-form',!run('gorunumHaritasi()').includes('haritaNeden'));
 const mapTarget=Object.assign(element(),{dataset:{ogrHafta:String(run("gunNo('2026-09-14')"))},closest(s){return s==='[data-ogr-hafta]'?this:null;}});
 for(const fn of listeners.click||[]) await fn({target:mapTarget});
 check('map-opens-historical-plan',run(`EK.sekme==='plan'&&EK.hafta===gunNo('2026-09-14')`));
 run('D.ayar.testTarih=D.ayar.sinav');
 check('exam-day-countdown-is-not-negative',run('ogrenciYksYolu(false)').includes('Sınav günü geldi'));
 init(); await draw(); run('EK.hafta=buHafta()+7');
 check('printout-retains-repetition-labels',run('yazdirSayfa(0,haftaBasi())').includes('1. tekrar'));
 // Optional private fixture: inspect a supplied backup locally; never include it in git or upload it.
 if(process.env.YKS_BACKUP){
   sandbox.privateBackup=JSON.parse(fs.readFileSync(process.env.YKS_BACKUP,'utf8'));
   run(`yedekDogrula(privateBackup);D=JSON.parse(JSON.stringify(privateBackup));D.ayar.testTarih='2026-09-06';
     EK={ogr:0,sekme:'plan',hafta:gunNo('2026-09-07'),girisAcik:{}};`);
   const unchanged=run('JSON.stringify([D.kart,D.log,D.elle])');
   const realPlan=getPlan(run('haftaBasi()')), realSummary=run('ogrenciHaftaOzeti(0,haftaBasi(),planHesapla(0,haftaBasi()))');
   check('supplied-backup-has-first-and-later-reviews',realSummary.ilk>0&&realSummary.tekrar>0);
   check('supplied-backup-print-and-screen-show-second-review',run('gorunumPlan()').includes('2. tekrar')&&run('yazdirSayfa(0,haftaBasi())').includes('2. tekrar'));
   check('supplied-backup-reading-preserves-history',unchanged===run('JSON.stringify([D.kart,D.log,D.elle])'));
   console.error(JSON.stringify({realBackup:{...realSummary,testUnits:realPlan.testToplam,results:run('D.log.length')}}));
 }
 // Optional static render output for visual QA, no live services in this document.
 if(process.env.YKS_PREVIEW_DIR){
   run('D.rol="ogrenci";EK.ogrenciDetay=false;EK.sekme="plan";');
   const css=html.match(/<style[^>]*id="stil"[^>]*>([\s\S]*?)<\/style>/)[1];
   for(const [file,view] of [['student-plan','gorunumPlan()'],['student-settings','gorunumAyarlar()']])
     fs.writeFileSync(process.env.YKS_PREVIEW_DIR+'/'+file+'.html','<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><nav id="ray"></nav><main>'+run(view)+'</main></body></html>');
 }
 console.log(JSON.stringify({passed:checks.length,checks,weeks,totalResults:weeks.reduce((s,w)=>s+w.results,0)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
