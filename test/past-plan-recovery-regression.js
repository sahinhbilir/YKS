'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync('index.html','utf8'),marker='<script id="uygulama">',start=html.indexOf(marker)+marker.length;
const source=html.slice(start,html.indexOf('// ---------------------------------------------------------------- başlangıç',start));
const store={},listeners={},messages=[];
const sandbox={console,JSON,Date,Math,Intl,TextEncoder,Blob,URL,URLSearchParams,crypto:webcrypto,
  setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t;},clearTimeout,
  location:{search:'?dev=1'},navigator:{},fetch:async()=>({ok:false}),alert:m=>messages.push(m),confirm:()=>true,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  window:{scrollTo(){},addEventListener(){}},document:{activeElement:null,addEventListener(k,fn){(listeners[k]||=[]).push(fn);},
    getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],contains:()=>true,
    createElement:()=>({style:{},classList:{add(){},remove(){}},remove(){},setAttribute(){}}),body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document;vm.createContext(sandbox);
vm.runInContext(source,sandbox);const run=code=>vm.runInContext(code,sandbox);
function reset(){
  run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-20';D.ogr=[{ad:'Ada',no:1,sube:'12A',alan:'EA',kap:6,off:[],ogrenciBulutId:'identity',syncId:'slot',hesapUid:'account'},
    {ad:'Bora',no:2,sube:'12A',alan:'EA',kap:6,off:[]}];D.islenis={};D.subeIslenis={};D.ogrIslenis={};D.elle={};D.log=[];D.kart={};D.konuPlani={};D.dersProgrami={};D.programHafta={};EK.ogr=0;EK.hafta=null;GECMIS_PLAN=null;`);
  sandbox.localStorage.setItem=(k,v)=>{store[k]=v;};for(const k of Object.keys(store))delete store[k];
}
function row(ki=0,extra={}){return {tarih:'2026-09-08',ders:run(`konuDersAdi(${ki})`),konu:run(`konuAl(${ki})[3]`),ki,tur:'test',durum:'tamamlandi',soru:10,dogru:8,not:null,dahil:true,...extra};}
function prepare(rows,replace=false){sandbox.rows=rows;return run(`gecmisPlanHazirla(0,'2026-09-07',rows,${replace})`);}
function save(rows,replace=false){sandbox.rows=rows;return run(`gecmisPlaniKaydet(0,'2026-09-07',rows,${replace})`);}
function parse(y){sandbox.text=typeof y==='string'?y:JSON.stringify(y);return run('gecmisPlanJsonAyristir(text)');}
const packet=rows=>({tur:'yks-gecmis-plan',surum:1,hafta:'2026-09-07',ogrenci:{ad:'Ada',no:1},satirlar:rows});
const checks=[];function check(name,fn){reset();fn();checks.push(name);}

check('fenced-ai-output-preserves-real-topic-and-observed-values',()=>{
  const p=parse('```json\n'+JSON.stringify(packet([row()]))+'\n```');assert.equal(p.satirlar[0].ki,0);assert.equal(p.satirlar[0].dogru,8);
});
check('uncertain-topic-never-silently-matches-a-subject-or-ai-id',()=>{
  const p=parse(packet([row(0,{ki:1,konu:'Unreadable'})]));assert.equal(p.satirlar[0].ki,null);
  assert.throws(()=>prepare(p.satirlar),/listeden/);
});
check('mixed-practice-from-old-ai-output-needs-no-catalog-topic',()=>{
  const activities=[['TÜRKÇE','Karışık Paragraf'],['MATEMATİK TYT','Karışık Problem'],['GEOMETRİ','KARIŞIK   GEOMETRİ']];
  const rows=activities.map(([ders,konu],i)=>row(0,{ders,konu,tarih:'2026-09-'+String(8+i).padStart(2,'0'),soru:20,dogru:null,durum:['tamamlandi','planlandi','yapilmadi'][i]}));
  const p=parse(packet(rows));
  p.satirlar.forEach((r,i)=>{assert.equal(r.tur,'serbest');assert.equal(r.ki,null);
    for(const k of ['ders','konu','tarih','soru','durum'])assert.equal(r[k],rows[i][k]);});
  save(p.satirlar);
  assert.equal(run('D.log.length'),0);assert.equal(run('Object.keys(D.kart).length'),0);
  assert.equal(run('Object.keys(gecmisPlanCalismalari(0)).length'),0);
  assert.equal(run('D.ekKonular.length'),0);
  const plan=run("planHesapla(0,gunNo('2026-09-07'))");
  activities.forEach(([,name],i)=>{const item=plan.gunler[i+1][0];assert.equal(item.ad,name);assert.equal(item.soru,20);assert.equal(item.serbest,true);});
  const h=run("planTablosu(0,gunNo('2026-09-07'),planHesapla(0,gunNo('2026-09-07')),false,false)");
  assert(h.includes('✓ Tamamlandı'));assert(!h.includes('puan bilinmiyor'));assert(h.includes('Yapılmadı'));assert(h.includes('tamamlanma bilinmiyor'));
  assert.equal(save(p.satirlar,true).tekrar,true);
});
check('real-literature-deneme-topic-and-explicit-lessons-remain-topics',()=>{
  const ki=run("KATALOG.findIndex(k=>k[3]==='6. Ünite: Deneme')");assert(ki>=0);
  const p=parse(packet([row(ki),row(0,{konu:'Karışık Paragraf',tur:'anlatim',dogru:null})]));
  assert.equal(p.satirlar[0].tur,'test');assert.equal(p.satirlar[0].ki,ki);
  assert.equal(p.satirlar[1].tur,'anlatim');assert.equal(p.satirlar[1].ki,null);
});
check('an-exact-custom-topic-is-not-reclassified-by-its-name',()=>{
  run("D.ekKonular=[[0,12,'Own','Karışık Problem',0,'']]");const ki=run('KATALOG.length');
  const p=parse(packet([row(ki)]));assert.equal(p.satirlar[0].tur,'test');assert.equal(p.satirlar[0].ki,ki);
});
check('arbitrary-free-activities-keep-their-name-and-are-not-added-to-the-catalog',()=>{
  const p=parse(packet([row(0,{tur:'serbest',ders:'Genel',konu:'Süre tutarak hız çalışması',soru:30,dogru:null})]));
  save(p.satirlar);assert.equal(run('D.ekKonular.length'),0);assert.equal(run('D.log.length'),0);
  assert.equal(run("planHesapla(0,gunNo('2026-09-07')).gunler[1][0].ad"),'Süre tutarak hız çalışması');
  assert.throws(()=>prepare([row(0,{tur:'serbest',konu:'  ',dogru:null})]),/adını girin/);
});
check('converting-a-manual-row-preserves-typed-name-and-observed-values',()=>{
  const r=row(0,{ki:null,konu:'',konuArama:'  Haftalık ödev  ',soru:20});sandbox.manual=r;
  run("gecmisPlanTurunuDegistir(manual,'serbest')");
  assert.equal(r.konu,'Haftalık ödev');assert.equal(r.ki,null);assert.equal(r.soru,20);assert.equal(r.dogru,8);
  assert.equal(r.tarih,'2026-09-08');assert.equal(r.durum,'tamamlandi');assert.equal(r.konuArama,undefined);
});
check('mixed-practice-scores-are-never-silently-discarded-or-applied-to-a-topic',()=>{
  const p=parse(packet([row(0,{konu:'Karışık Paragraf',ders:'Türkçe',soru:20,dogru:17,not:3})]));
  assert.equal(p.satirlar[0].dogru,17);assert.equal(p.satirlar[0].not,3);
  assert.throws(()=>save(p.satirlar),/karışık \/ serbest çalışma/);assert.equal(run('D.log.length'),0);
  sandbox.parsed=p;run("gecmisPlanDurumu().satirlar=parsed.satirlar");
  const h=run('gorunumPlanKurtarma()');assert(h.includes('data-gp-alan="dogru"'));assert(h.includes('value="17"'));assert(h.includes('bu alanları boş bırakın'));
});
check('recovered-weeks-do-not-gain-extra-daily-targets-or-duplicate-mixed-practice',()=>{
  const p=parse(packet([row(0,{konu:'Karışık Paragraf',ders:'Türkçe',soru:20,dogru:null})]));save(p.satirlar);
  run("D.ogr[0].gunlukEk={paragraf:[{gun:gunNo('2026-09-01'),soru:40}],problem:[{gun:gunNo('2026-09-01'),soru:30}]}");
  const old=run("gunlukEkliPlan(0,gunNo('2026-09-07'),planHesapla(0,gunNo('2026-09-07')))");
  assert.equal(old.gunler.flat().length,1);assert.equal(old.gunler[1][0].soru,20);
  const current=run('gunlukEkliPlan(0,buHafta(0),planHesapla(0,buHafta(0)))');
  assert(current.gunler.flat().some(x=>x.gunlukEk&&x.ad==='Karışık Paragraf'&&x.soru===40));
});
check('mixed-practice-survives-student-package-and-teacher-delivery',()=>{
  const p=parse(packet([row(0,{konu:'Karışık Problem',ders:'Matematik TYT',soru:20,dogru:null,durum:'planlandi'})]));save(p.satirlar);
  run('teacherNotebook=D;D=paketiYukle(ogrenciPaketi(0));');
  p.satirlar[0].durum='tamamlandi';save(p.satirlar,true);
  run('studentWork=ogrenciCalismaPaketi();studentWork.ts=Date.now()+10000;D=teacherNotebook;ogrenciCalismasiniUygula(studentWork,0)');
  assert.equal(run("D.elle['0|'+gunNo('2026-09-07')].kurtarma.satirlar[0].durum"),'tamamlandi');
  const item=run("planHesapla(0,gunNo('2026-09-07')).gunler[1][0]");assert.equal(item.ad,'Karışık Problem');assert.equal(item.soru,20);
  assert.equal(run('D.log.length'),0);assert.equal(run('Object.keys(D.kart).length'),0);assert.equal(run('D.ogr[1].cikti'),undefined);
});
check('recovery-ui-offers-free-work-without-sending-students-to-topics',()=>{
  const p=parse(packet([row(0,{konu:'Karışık Problem',dogru:null}),row(0,{konu:'Hız çalışması',dogru:null})]));
  sandbox.parsed=p;run('D=paketiYukle(ogrenciPaketi(0));gecmisPlanDurumu().satirlar=parsed.satirlar');
  const h=run('gorunumPlanKurtarma()');assert(h.includes('Karışık / serbest çalışma'));assert(h.includes('id="gpSerbest_1"'));
  assert(!h.includes('Konular bölümünden'));assert(h.includes('data-gp-alan="konu"'));assert(!h.includes('data-gp-i="0" data-gp-alan="dogru"'));
});
check('multiple-ai-plans-are-rejected-without-picking-one',()=>{
  assert.throws(()=>parse(JSON.stringify(packet([row()]))+'\n'+JSON.stringify(packet([row(1)]))),/Birden fazla/);
});
check('missing-dates-remain-missing-for-teacher-review',()=>{
  const p=parse({...packet([row(0,{tarih:null})]),hafta:null});assert.equal(p.hafta,'');assert.equal(p.satirlar[0].tarih,'');assert.throws(()=>prepare(p.satirlar),/tarihini/);
});
check('invalid-status-and-invented-grade-shapes-are-rejected',()=>{
  assert.throws(()=>parse(packet([row(0,{durum:'probably_done'})])),/durumu/);
  assert.throws(()=>parse(packet([row(0,{not:5})])),/geçersiz/);
});
check('future-or-out-of-week-work-cannot-alter-the-notebook',()=>{
  const before=run('JSON.stringify(D)');assert.throws(()=>save([row(0,{tarih:'2026-09-21'})]),/tarihi/);assert.equal(run('JSON.stringify(D)'),before);
});
check('preview-is-read-only-and-restores-student-isolation',()=>{
  const before=run('JSON.stringify(D)');const p=prepare([row()]);assert.equal(p.rapor.sonuc,1);assert.equal(run('JSON.stringify(D)'),before);
  assert.equal(p.yeni.log[0][1],0);assert.equal(p.yeni.ogr[1].cikti,undefined);
});
check('historical-results-rebuild-learning-in-date-order',()=>{
  run("sonucIsle(0,[{ki:0,gun:gunNo('2026-09-15'),not:4}])");
  const later=run('D.log[0][6]');save([row()]);assert.equal(run('D.kart["0:0"].n'),2);assert.equal(run('D.kart["0:0"].son'),run("gunNo('2026-09-15')"));
  assert.equal(run("D.log.find(l=>l[0]===gunNo('2026-09-15'))[6]"),later);
});
check('existing-result-is-preserved-even-when-photo-disagrees',()=>{
  run("sonucIsle(0,[{ki:0,gun:gunNo('2026-09-08'),dogru:2,soru:10}])");
  const before=run('JSON.stringify(D.log)');const p=save([row()]);assert.equal(p.rapor.korunan,1);assert.equal(run('JSON.stringify(D.log)'),before);
});
check('same-photo-import-is-idempotent',()=>{
  save([row()]);const before=run('JSON.stringify(D)'),backup=store.yks_plan_kurtarma_oncesi;
  assert.equal(save([row()],true).tekrar,true);assert.equal(run('JSON.stringify(D)'),before);assert.equal(store.yks_plan_kurtarma_oncesi,backup);
});
check('issued-plan-requires-explicit-replacement-and-preserves-other-weeks',()=>{
  run("D.elle['0|'+gunNo('2026-09-07')]={sabit:1,yer:{}};D.elle['0|'+gunNo('2026-09-14')]={sabit:2,yer:{}};");
  assert.throws(()=>save([row()]),/kayıt var/);const other=run("JSON.stringify(D.elle['0|'+gunNo('2026-09-14')])");save([row()],true);
  assert.equal(run("JSON.stringify(D.elle['0|'+gunNo('2026-09-14')])"),other);
});
check('overlapping-reporting-week-cannot-be-silently-replaced',()=>{
  run("D.elle['0|'+gunNo('2026-09-09')]={sabit:1,yer:{}}");assert.throws(()=>save([row()],true),/çakışıyor/);
});
check('unscored-completion-schedules-a-check-without-inventing-a-result',()=>{
  save([row(0,{dogru:null,soru:null})]);assert.equal(run('D.log.length'),0);assert.equal(run('Object.keys(D.kart).length'),0);
  assert(run('planHesapla(0,buHafta(0)).gunler.flat().some(x=>x.ki===0)'),run('JSON.stringify({p:planHesapla(0,buHafta(0)),k:gecmisPlanCalismalari(0),o:D.ogr[0],today:bugunNo()})'));
});
check('planned-only-test-is-kept-as-awaiting-evidence',()=>{
  save([row(0,{dogru:null,durum:'planlandi'})]);assert.equal(run('D.log.length'),0);
  assert(run('planHesapla(0,buHafta(0)).bekleyen.some(x=>x.ki===0)'));
});
check('missed-work-reenters-the-schedule-without-a-failing-grade',()=>{
  save([row(0,{dogru:null,durum:'yapilmadi'})]);assert.equal(run('D.log.length'),0);assert(run('planHesapla(0,buHafta(0)).gunler.flat().some(x=>x.ki===0)'));
});
check('old-completion-does-not-excuse-a-later-unanswered-issued-test',()=>{
  save([row(0,{dogru:null})]);run("D.elle['0|'+buHafta(0)]={sabit:1,yer:{0:[0,0]}}");
  assert(run('sonucBekliyor(0,0,null,gunNo("2026-09-08"),buHafta(0)+7)'));
});
check('completed-lesson-retains-its-original-slot-and-starts-first-review',()=>{
  save([row(0,{tur:'anlatim',dogru:null,soru:null})]);assert.equal(run('D.log.length'),0);
  assert.equal(run('D.ogrIslenis[0][0]'),run("gunNo('2026-09-08')"));assert(run("planHesapla(0,gunNo('2026-09-07')).gunler[1][0].anlatim"));
  assert(run('planHesapla(0,buHafta(0)).gunler.flat().some(x=>x.ki===0)'));
});
check('lesson-and-test-of-the-same-topic-keep-separate-historical-slots',()=>{
  save([row(0,{tur:'anlatim',dogru:null,soru:null}),row(0,{tarih:'2026-09-09'})]);
  assert(run("planHesapla(0,gunNo('2026-09-07')).gunler[1][0].anlatim"));assert(!run("planHesapla(0,gunNo('2026-09-07')).gunler[2][0].anlatim"));
});
check('storage-failure-keeps-the-entire-original-notebook',()=>{
  const before=run('JSON.stringify(D)');store.yks_veri=before;sandbox.localStorage.setItem=(k,v)=>{if(k==='yks_veri')throw Error('quota');store[k]=v;};
  // Ham QuotaExceededError yerine ne olduğunu ve ne yapılacağını anlatan bir ileti
  // bekleriz; tarayıcının asıl hatası hata ayıklama için `sebep` altında korunur.
  assert.throws(()=>save([row()]),e=>/depolama alanı dolu/.test(e.message)&&/Yedek indir/.test(e.message)&&e.sebep&&e.sebep.message==='quota');
  assert.equal(run('JSON.stringify(D)'),before);assert.equal(store.yks_veri,before);assert.equal(store.yks_plan_kurtarma_oncesi,before);
});
check('row-errors-name-the-row-the-user-sees-even-when-rows-are-excluded',()=>{
  // Ekranda satırlar elenmeden numaralanır ve dahil edilmeyenler (soluk da olsa) durur.
  // Bu yüzden 1. satır dışarıda bırakılsa bile hatalı satır "3. satır" olarak bildirilmeli.
  const rows=[row(0,{dahil:false}),row(1),row(2,{durum:'planlandi',dogru:null,not:1})];
  assert.throws(()=>prepare(rows),e=>/^3\. satırda sonuç var/.test(e.message));
  // Sonuç taşıyan satır tamamlanmış test olmalı; ileti ne yapılacağını da söylemeli.
  assert.throws(()=>prepare(rows),/doğru sayısı ve değerlendirme boş olmalı/);
});
check('a-planned-row-without-any-score-is-accepted',()=>{
  const p=prepare([row(),row(1,{durum:'planlandi',dogru:null,not:null})]);
  assert.equal(p.satir,2);assert.equal(p.rapor.bekleyen,1);assert.equal(p.rapor.sonuc,1);
});
check('every-row-check-reports-a-row-number',()=>{
  // assert.throws(fn, /re/) sicimlestirilmis hatayla eslesir; satir numarasinin iletinin
  // BASINDA oldugunu dogrulamak icin e.message'a bakan bir dogrulayici kullanilir.
  const ikinciSatir=e=>/^2\. satır/.test(e.message);
  assert.throws(()=>prepare([row(),row(1,{tarih:'not-a-date'})]),ikinciSatir);
  assert.throws(()=>prepare([row(),row(1,{tur:'bilinmiyor'})]),ikinciSatir);
  assert.throws(()=>prepare([row(),row(1,{dogru:99,soru:10})]),ikinciSatir);
  assert.throws(()=>prepare([row(),row(1,{tur:'serbest',konu:''})]),ikinciSatir);
});
check('the-ai-prompt-states-both-hard-rules',()=>{
  const t=run('gecmisPlanPromptMetni()');
  assert(/KATI KURAL 1/.test(t)&&/hem dogru hem not MUTLAKA null/.test(t));
  assert(/KATI KURAL 2/.test(t)&&/BİREBİR AYNI/.test(t));
  assert(t.includes('Karışık Paragraf, Karışık Problem, Karışık Geometri'));
  assert(t.includes('tur="serbest", ki=null'));assert(t.includes('gerçek bir konu testini serbest çalışmaya çevirme'));
});
check('student-role-rejects-a-multiple-student-notebook',()=>{
  run("D.rol='ogrenci'");assert.throws(()=>save([row()]),/öğrenci seçin/);assert.equal(run('gorunumPlanKurtarma()'),'');
});
check('student-can-recover-only-their-own-plan-and-use-the-interface',()=>{
  run("D=paketiYukle(ogrenciPaketi(0));EK.ogr=0;");save([row()]);
  assert.equal(run('D.log.length'),1);assert.equal(run('D.rol'),'ogrenci');
  assert(run('SEKMELER().some(x=>x[0]==="kurtarma")'));
  const h=run('gorunumPlanKurtarma()');assert(h.includes('gpFoto'));assert(!h.includes('id="gpOgrenci"'));assert(!h.includes('gpYayinla'));
  assert.throws(()=>run("gecmisPlanHazirla(1,'2026-09-07',rows,false)"),/kendi planını/);
});
check('student-recovery-updates-reach-teacher-without-touching-other-students',()=>{
  save([row()]);run('teacherNotebook=D;D=paketiYukle(ogrenciPaketi(0));');
  save([row(),row(1,{dogru:null,durum:'yapilmadi'})],true);
  // More than one offline edit retains the lineage of the teacher's known copy.
  save([row(),row(1,{dogru:null,durum:'planlandi'})],true);
  run('studentWork=ogrenciCalismaPaketi();studentWork.ts=Date.now()+10000;D=teacherNotebook;ogrenciCalismasiniUygula(studentWork,0)');
  assert.equal(run("D.elle['0|'+gunNo('2026-09-07')].kurtarma.satirlar.length"),2);
  assert.equal(run("D.elle['0|'+gunNo('2026-09-07')].kurtarma.satirlar[1].durum"),'planlandi');
  assert.equal(run('D.ogr[1].cikti'),undefined);
});
check('missed-lesson-is-rescheduled-and-frozen-without-a-made-up-result',()=>{
  save([row(0,{tur:'anlatim',dogru:null,durum:'yapilmadi'})]);
  run('p=planHesapla(0,buHafta());haftayiSabitle(0,buHafta(),p)');
  assert(run('planHesapla(0,buHafta()).gunler.flat().some(x=>x.ki===0&&x.anlatim)'));assert.equal(run('D.log.length'),0);
});
check('completed-ordinary-lesson-remains-in-the-issued-plan',()=>{
  run("const hb=buHafta();anlatimEkle(0,hb,0,'',0,0);haftayiSabitle(0,hb);anlatimTamam(0,0,hb)");
  assert(run('planHesapla(0,buHafta()).gunler[0].some(x=>x.ki===0&&x.anlatim)'));
  assert(run("planCalismaEtiketi(0,buHafta(),{ki:0,anlatim:true},buHafta()).includes('Anlatım tamamlandı')"));
  assert(run('planHesapla(0,buHafta()+7).gunler.flat().some(x=>x.ki===0&&!x.anlatim)'));
});
check('teacher-week-map-opens-frozen-photo-plan-and-shows-status',()=>{
  save([row(),row(1,{dogru:null,durum:'yapilmadi'}),row(2,{dogru:null,durum:'planlandi'})]);
  const before=run("JSON.stringify(D.elle['0|'+gunNo('2026-09-07')])");
  assert(run('gorunumHaritasi()').includes('data-harita-plan='));
  assert(run("haritaPlaniniAc(gunNo('2026-09-07'))"));
  run("D.ayar.soru=99;D.ayar.tekEsik=.1;sonucIsle(0,[{ki:0,gun:gunNo('2026-09-19'),not:1}]);");
  const p=run('planHesapla(0,haftaBasi())');assert.equal(p.gunler[1][0].soru,10);
  assert.equal(run("JSON.stringify(D.elle['0|'+gunNo('2026-09-07')])"),before);
  const h=run('planTablosu(0,haftaBasi(),planHesapla(0,haftaBasi()),false,false)');
  assert(h.includes('8/10'));assert(h.includes('Yapılmadı'));assert(h.includes('tamamlanma bilinmiyor'));
});
check('student-map-includes-recovered-weeks-before-the-current-term',()=>{
  save([row()]);run("D=paketiYukle(ogrenciPaketi(0));D.ayar.donemBasi='2026-09-14'");
  assert(run("haritaHaftalari(0).includes(gunNo('2026-09-07'))"));
  assert(run("ogrenciYksYolu(true).includes('data-ogr-hafta=\"'+gunNo('2026-09-07')+'\"')"));
  assert(run("haritaPlaniniAc(gunNo('2026-09-07'))"));assert.equal(run('EK.sekme'),'plan');
});
check('recovery-metadata-remaps-custom-topics-in-student-packages',()=>{
  run("D.ekKonular=[[0,12,'Own','Unrelated',0,''],[0,12,'Own','Recovered custom topic',0,'']]");const ki=run('KATALOG.length+1');
  save([row(ki,{dogru:null})]);const p=run('paketiYukle(ogrenciPaketi(0))');
  const v=p.elle['0|'+run("gunNo('2026-09-07')")];assert.equal(v.kurtarma.satirlar[0].ki,run('KATALOG.length'));assert.equal(v.konuSlot.KURT_0.ki,run('KATALOG.length'));
});
check('stale-student-snapshot-cannot-replace-a-teacher-recovered-week',()=>{
  run("D.elle['0|'+gunNo('2026-09-07')]={sabit:1,yer:{},plan:{surum:2,slotlar:[[],[],[],[],[],[],[]],off:[],kap:6}}");
  const old=run('paketiYukle(ogrenciPaketi(0))');save([row()],true);
  const week=run("JSON.stringify(D.elle['0|'+gunNo('2026-09-07')])");sandbox.old=old;
  run('old.ogrCalismaTs=Date.now()+10000;ogrenciCalismasiniUygula({ts:old.ogrCalismaTs,veri:JSON.stringify(old)},0)');
  assert.equal(run("JSON.stringify(D.elle['0|'+gunNo('2026-09-07')])"),week);
});
check('malformed-recovery-metadata-is-rejected-on-backup-validation',()=>{
  save([row()]);run("D.elle['0|'+gunNo('2026-09-07')].kurtarma.satirlar[0].ki=999999");assert.throws(()=>run('yedekDogrula(D)'),/satırı/);
});
check('preview-escapes-photo-text-and-has-manual-review-controls',()=>{
  run("EK.sekme='kurtarma';gecmisPlanDurumu().ogrenci={ad:'<img src=x onerror=alert(1)>'};");const h=run('gorunumPlanKurtarma()');
  assert(h.includes('&lt;img'));assert(!h.includes('<img src=x'));assert(h.includes('gpFoto'));assert(h.includes('gpKimlik'));assert(h.includes('gpSatirEkle'));
});
check('prompt-forbids-reading-assigned-work-as-completed-or-inventing-scores',()=>{
  const p=run('gecmisPlanPromptMetni()');assert(p.includes('yapıldığı anlamına GELMEZ'));assert(p.includes('not veya doğru sayısı uydurma'));
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
