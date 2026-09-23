const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.split('<script id="uygulama">')[1].split('// ---------------------------------------------------------------- başlangıç')[0];
const sandbox={console,Date,JSON,Math,Intl,Blob,URL,URLSearchParams,TextEncoder,crypto,
  setTimeout(){return 1;},clearTimeout(){},location:{search:'?dev=1'},navigator:{},
  alert(){},confirm(){return true;},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null;},setItem(){}},sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  window:{addEventListener(){},scrollTo(){}},document:{addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}}};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const run=s=>vm.runInContext(s,sandbox),plain=s=>JSON.parse(run('JSON.stringify('+s+')'));
let passed=0;
function init(){run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-09-23';D.ayar.gecmisSerbest=true;
 D.ayar.donemBasi='2026-08-24';D.ayar.donemElle=true;D.ayar.sinav='2027-06-19';
 D.ogr=[{ad:'Example',no:42,sube:'201',alan:'SAY',kap:6,off:[],ogrenciBulutId:'example'}];
 D.islenis={};D.subeIslenis={};D.ogrIslenis={};D.kart={};D.log=[];D.elle={};D.konuPlani={};D.dersProgrami={};D.programHafta={};D.ogrTaslak={};
 EK.ogr=0;EK.hafta=null;EK.sekme='plan';`);}
function check(name,fn){init();fn();passed++;console.log('PASS '+name);}
function topic(ders,ad){return run('kullaniciKonusuTam('+run('dersEsle('+JSON.stringify(ders)+')')+','+JSON.stringify(ad)+','+JSON.stringify(ders)+')');}
function seed(){
 const t=topic('Matematik TYT','Temel Kavramlar'),a=topic('Matematik AYT','Fonksiyon Çeşitleri');
 run(`D.islenis[${t}]=buHafta(0)-D.ayar.ilk;D.islenis[${a}]=buHafta(0)-D.ayar.ilk;`);
 return {t,a};
}
const plan=()=>plain('planHesapla(0,buHafta(0))');
const fixture=JSON.parse(fs.readFileSync('test/fixtures/school-timetables-2026-09-23.json','utf8'));
for(const su of ['201','205','301'])check(su+'-matches-all-source-pdf-cells-and-40-lessons',()=>{
 const p=plain('OKUL_SUBE_PROGRAMLARI['+JSON.stringify(su)+'].prog');assert.deepEqual(p,fixture[su]);
 assert.equal(p.gunler.flat().filter(Boolean).length,40);assert.equal(p.saatler.at(-1),'15:30');
});
check('existing-class-migrates-with-old-weeks-preserved-and-no-results-created',()=>{
 run("programYaz('201',gunNo('2026-08-24'),JSON.parse(JSON.stringify(ESKI_OKUL_SUBE_PROGRAMLARI['201'].prog)))");
 const before=plain("programAl('201',gunNo('2026-09-14')).prog");assert(run('okulProgramlariniGuncelle()'));
 assert.deepEqual(plain("programAl('201',gunNo('2026-09-14')).prog"),before);
 assert.deepEqual(plain("programAl('201',gunNo('2026-09-21')).prog"),fixture['201']);
 assert.equal(run('D.log.length'),0);const saved=plain('D');assert.equal(run('okulProgramlariniGuncelle()'),false);assert.deepEqual(plain('D'),saved);
});
check('new-student-and-teacher-package-include-both-dated-programs',()=>{
 run("okulPrograminiHazirla('201');packet=ogrenciPaketi(0);D=paketiYukle(packet)");
 assert.equal(run("programAl('201',gunNo('2026-09-14')).prog.saatler.length"),7);
 assert.deepEqual(plain("programAl('201',gunNo('2026-09-28')).prog"),fixture['201']);
});
check('new-program-repeats-every-week-until-an-explicit-change',()=>{
 run("okulPrograminiHazirla('201')");
 for(let week=0;week<36;week++) assert.deepEqual(plain("programAl('201',gunNo('2026-09-21')+"+week*7+").prog"),fixture['201']);
 run("programYaz('201',gunNo('2026-10-12'),{saatler:['10:00'],gunler:[['KİMYA'],[],[],[],[],[],[]]});okulProgramlariniGuncelle()");
 assert.deepEqual(plain("programAl('201',gunNo('2026-10-05')).prog"),fixture['201']);
 assert.equal(run("programAl('201',gunNo('2026-11-02')).prog.saatler[0]"),'10:00');
});
check('edits-after-installation-and-later-custom-timetables-survive',()=>{
 run("okulProgramlariniGuncelle();programYaz('201',gunNo('2026-09-21'),BOS_PROGRAM())");assert.equal(run('okulProgramlariniGuncelle()'),false);
 run('D=paketiYukle(ogrenciPaketi(0))');assert.equal(run('okulProgramlariniGuncelle()'),false);
 assert.equal(run("programAl('201',gunNo('2026-09-21')).prog.saatler.length"),0);
 init();run("programYaz('201',gunNo('2026-10-05'),{saatler:['11:00'],gunler:[['FİZİK'],[],[],[],[],[],[]]});okulProgramlariniGuncelle()");
 assert.equal(run("programAl('201',gunNo('2026-10-05')).prog.saatler[0]"),'11:00');
 assert.equal(run("D.dersProgrami['201'].saatler[0]"),'11:00');
});
check('old-timetable-saved-for-current-week-is-upgraded-once',()=>{
 run("programYaz('201',gunNo('2026-09-21'),ESKI_OKUL_SUBE_PROGRAMLARI['201'].prog);okulProgramlariniGuncelle()");
 assert.deepEqual(plain("programAl('201',gunNo('2026-09-21')).prog"),fixture['201']);
 assert.equal(run('okulProgramlariniGuncelle()'),false);
});
check('migration-not-applied-before-effective-week-or-to-other-schools',()=>{
 run("D.ayar.testTarih='2026-09-20'");assert.equal(run('okulProgramlariniGuncelle()'),false);
 run("D.ayar.testTarih='2026-09-23';D.ogr[0].sube='another'");assert.equal(run('okulProgramlariniGuncelle()'),false);
});
check('future-auto-dates-follow-new-timetable-while-manual-and-personal-dates-survive',()=>{
 run("varsayilanKonuPlaniniHazirla('201','SAY');programYaz('201',gunNo('2026-08-24'),ESKI_OKUL_SUBE_PROGRAMLARI['201'].prog);ileriDagit(gunNo('2026-09-28'),'201',1)");
 const ki=run("konuBulTamEslesme(1,'Ortalama Değişim Hızı','Matematik AYT')");assert(ki>=0);
 const old=run(`D.subeIslenis['201'][${ki}]`);assert.equal(old,run("gunNo('2026-09-28')"));
 run(`D.ogrIslenis[0]={[${ki}]:oldPersonal=gunNo('2026-10-09')};D.subeIslenis['201'][0]=gunNo('2026-10-02');okulProgramlariniGuncelle()`);
 assert.equal(run(`D.subeIslenis['201'][${ki}]`),run("gunNo('2026-09-30')"));
 assert.equal(run(`D.ogrIslenis[0][${ki}]`),run('oldPersonal'));
 assert.equal(run("D.subeIslenis['201'][0]"),run("gunNo('2026-10-02')"));
});
check('migration-keeps-current-started-draft-but-refreshes-future-drafts',()=>{
 run("D.ogrTaslak={['0|'+buHafta(0)]:{saved:true},['0|'+(buHafta(0)+7)]:{saved:true}}");
 run('okulProgramlariniGuncelle()');assert(run("D.ogrTaslak['0|'+buHafta(0)].saved"));assert.equal(run("D.ogrTaslak['0|'+(buHafta(0)+7)]"),undefined);
});
check('AYT-mode-is-opt-in-and-reversible-without-fake-results',()=>{
 seed();const normal=plan();assert.equal(run('D.ogr[0].aytOncelik'),undefined);
 run('aytOnceliginiUygula(0,true)');assert.equal(run('D.log.length'),0);assert.equal(run('Object.keys(D.kart).length'),0);
 run('aytOnceliginiUygula(0,false)');assert.deepEqual(plan(),normal);
});
check('new-AYT-keeps-two-tests-while-new-TYT-gets-one',()=>{
 const {t,a}=seed();run('aytOnceliginiUygula(0,true)');const rows=plan().gunler.flat();
 assert.equal(rows.find(x=>x.ki===t).test,1);assert.equal(rows.find(x=>x.ki===a).test,2);
});
check('AYT-gets-scarce-capacity-before-easy-TYT-and-backlog-is-visible',()=>{
 const {t,a}=seed();run('D.ogr[0].kap=2;D.ogr[0].off=[1,2,3,4,5,6];aytOnceliginiUygula(0,true)');
 const p=plan();assert(p.gunler.flat().some(x=>x.ki===a));assert(!p.gunler.flat().some(x=>x.ki===t));assert(p.tasan.includes(t));assert(p.gunYuk.every(n=>n<=2));
});
check('weak-TYT-remains-two-tests-and-is-not-displaced-by-AYT',()=>{
 const {t}=seed();run(`sonucIsle(0,[{ki:${t},gun:buHafta(0)-1,not:1}]);D.ogr[0].kap=2;D.ogr[0].off=[1,2,3,4,5,6];aytOnceliginiUygula(0,true)`);
 const x=plan().gunler.flat().find(x=>x.ki===t);assert(x);assert.equal(x.test,2);
});
check('overdue-TYT-moves-ahead-of-new-AYT-to-prevent-starvation',()=>{
 const {t}=seed();run(`D.islenis[${t}]-=8;D.ogr[0].kap=2;D.ogr[0].off=[1,2,3,4,5,6];aytOnceliginiUygula(0,true)`);
 assert(plan().gunler.flat().some(x=>x.ki===t));
});
check('later-due-AYT-does-not-block-earlier-free-days',()=>{
 const {t,a}=seed();run(`D.islenis[${a}]+=3;aytOnceliginiUygula(0,true)`);assert(plan().gunler[0].some(x=>x.ki===t));
});
check('frozen-plans-logs-cards-and-manual-question-counts-stay-identical',()=>{
 const {t}=seed();run(`elleAl(0,buHafta(0),true).soru[${t}]=30;haftayiSabitle(0,buHafta(0))`);
 const before=plan(),data=plain('[D.elle,D.log,D.kart]');run('aytOnceliginiUygula(0,true)');
 assert.deepEqual(plain('[D.elle,D.log,D.kart]'),data);assert.deepEqual(plan(),before);
});
check('mixed-science-topics-classified-by-content-not-lesson-alone',()=>{
 for(const [d,n,e] of [['Fizik','Basınç','TYT'],['Fizik','Tork ve Tork Dengesi','AYT'],['Kimya','Mol Kavramı','TYT'],['Kimya','Piller','AYT'],['Biyoloji','Hücre','TYT'],['Biyoloji','DNA Replikasyonu','AYT'],['Coğrafya','Ekosistem (AYT)','AYT'],['Geometri','Üçgende Açılar',''],['Fizik','Öğretmenin özel konusu','']]){
  const ki=topic(d,n);assert.equal(run(`konuSinavTuru(${ki})`),e,d+' '+n);
 }
});
check('setting-roundtrips-to-teacher-and-can-be-turned-off-again',()=>{
 run('teacher=D;D=paketiYukle(ogrenciPaketi(0));aytOnceliginiUygula(0,true);work=ogrenciCalismaPaketi();work.ts=Date.now()+1000;D=teacher;ogrenciCalismasiniUygula(work,0)');
 assert.equal(run('D.ogr[0].aytOncelik'),true);
 run('D=paketiYukle(ogrenciPaketi(0));aytOnceliginiUygula(0,false);work=ogrenciCalismaPaketi();work.ts=Date.now()+2000;D=teacher;ogrenciCalismasiniUygula(work,0)');assert.equal(run('D.ogr[0].aytOncelik'),false);
});
check('invalid-values-and-editing-another-student-are-rejected',()=>{
 assert.equal(run("aytOnceliginiUygula(0,'yes')"),false);
 run("D.ogr[0].aytOncelik='yes'");assert.throws(()=>run('yedekDogrula(D)'),/AYT/);
 run("delete D.ogr[0].aytOncelik;D.rol='ogrenci';D.ogr.push({...D.ogr[0],no:43})");assert.equal(run('aytOnceliginiUygula(1,true)'),false);
});
console.log(JSON.stringify({passed}));
