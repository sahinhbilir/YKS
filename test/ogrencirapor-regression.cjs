'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('<script id="uygulama">')+23,b=html.indexOf('// ---------------------------------------------------------------- başlangıç',a),source=html.slice(a,b);
const {okulListesi,sinifListesi,SINAVLAR,SINIFLAR}=require('./fixtures/siralama-pdf.cjs'),{etutRaporu,GUNLER}=require('./fixtures/etut-pdf.cjs'),{homework,attendance}=require('./fixtures/ogrencirapor-pdf.cjs'),{ornekRapor,yoklamaRaporu}=require('./fixtures/yoklama-pdf.cjs');
const ctx={console,Date,Math,Intl,JSON,URL,URLSearchParams,setTimeout,clearTimeout,TextEncoder,Blob,location:{search:'?dev=1'},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},navigator:{},window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},getClientRects:()=>[]})}};
vm.createContext(ctx);vm.runInContext(source+';this.R=OGRENCI_RAPOR;',ctx);const R=ctx.R,plain=x=>JSON.parse(JSON.stringify(x));let passed=0;
const parse=p=>R.parse(p.pages,p.boylar),check=(name,f)=>{try{f();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}};
check('deneme lists come only from Sıralamalar, each grade with its own lessons, all dates and both sessions',()=>{
 assert.equal(parse(okulListesi(SINAVLAR.sonra.F)).kind,'exam');assert.equal(parse(sinifListesi(SINIFLAR.dokuz2)).kind,'exam');
 const old=structuredClone(SINAVLAR.once.T);old.tarih='27.05.2024';ctx.L=[okulListesi(SINAVLAR.sonra.F),okulListesi(old),sinifListesi(SINIFLAR.dokuz2)];
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[];D.siralama=SIRALAMA.oku().veri;for(const l of L)SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(l.pages,l.boylar));",ctx);
 const m=R.model(),ada=m.students.find(s=>s.no==='1001'),firat=m.students.find(s=>s.no==='2002');
 assert(ada.exams.some(e=>e.date==='2024-05-27'));assert(ada.exams.some(e=>e.session==='AYT'&&e.nets.edebiyat===17.5));assert(ada.exams.every(e=>Object.values(e.nets).every(Number.isFinite)));
 assert.equal(firat.cls,'9/A');assert.deepEqual(Object.keys(firat.exams[0].nets),['turkce','tarih','cografya','din','mat','fizik','kimya','biyoloji']);assert.equal(firat.exams[0].nets.mat,-1);
});
check('homework continues on another page; report date is never assignment date',()=>{const r=parse(homework());assert.equal(r.homework.length,3);assert(r.homework.every(h=>h.reportDate==='2026-10-24'&&h.assignmentDate===null));assert.equal(r.homework[1].course,'T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK');assert.equal(r.homework[2].no,'1001')});
check('attendance wrapped name, continuation, half day and excused absences',()=>{const r=parse(attendance());assert.equal(r.attendance.length,4);assert(r.attendance.every(a=>a.name==='SENTETİK ADA'));const a=R.attendanceSummary(r.attendance);assert.deepEqual(plain(a),{present:2,half:1,full:1,missed:2,unknown:0,days:4,percent:50})});
check('1–2 missed lessons means present; blank cells are not absence; unknown stays unknown',()=>{const a=R.attendanceSummary([{statuses:['Gelmedi','Geldi','']},{statuses:['Gelmedi','Gelmedi','']},{statuses:['','','']}]);assert.equal(a.present,2);assert.equal(a.unknown,1);assert.equal(a.percent,100);assert.equal(R.attendanceSummary([{statuses:['']}]).percent,null)});
check('missed days include excused and reported absences, with one matching attendance percentage',()=>{
 const rows=[['Gelmedi','Gelmedi','Gelmedi'],['Mazeretli','Mazeretli','Mazeretli'],['Raporlu','Raporlu','Raporlu'],['Gelmedi','Raporlu','Mazeretli','Geldi'],['Gelmedi','Raporlu','Geldi'],['','','']].map((statuses,i)=>({date:'2026-10-'+(10+i),statuses})),a=R.attendanceSummary(rows);
 assert.deepEqual(plain(a),{present:1,half:1,full:3,missed:4,unknown:1,days:6,percent:20});
 const person={no:'81',name:'SENTETİK DEVAM',cls:'9/A'},s=R.merge([{students:[person],attendance:rows.map(r=>({...r,...person}))}]).students[0];
 s.teachers=[{teacher:'DİN HOCASI',courses:['Adab-ı muaşeret','DİN KÜLTÜRÜ']},{teacher:'YALNIZ ADAB HOCASI',courses:['ADAB-I MUAŞERET']}];const before=JSON.stringify(s),svg=R.svgReport(s,'2026-10-25'),attendance=svg.split('aria-label="Yoklama"')[1].split('<!--')[0];
 assert(svg.includes('aria-label="Kaçırdığı günler · 4"'));assert(svg.includes('aria-label="Okulda · 1"'));assert(svg.includes('aria-label="Devam yüzdesi · %20"'));assert(!attendance.includes('Yarım gün'));assert(!attendance.includes('Tam gün yok'));assert(!/Adab|ADAB/.test(svg));assert(svg.includes('aria-label="Ders öğretmeni · DİN HOCASI"'));assert(svg.includes('>Din</text>'));assert.equal(JSON.stringify(s),before,'report filtering never removes saved timetable data');
});
check('etut source parser and complete weekly/course reconciliation including zero weeks',()=>{const r=parse(etutRaporu(GUNLER)),w=R.weekly(r.sessions,r.start,r.end);assert.equal(w.reduce((n,x)=>n+x.count,0),r.sessions.length);assert(w.some(x=>x.count===0));assert(w.every(x=>Object.values(x.courses).reduce((a,b)=>a+b,0)===x.count))});
check('re-imports replace instead of duplicating; sources match by name, number and class',()=>{const ex={kind:'exam',students:[{no:'1001',name:'SENTETİK ADA',cls:'12/A'}],exams:[{no:'1001',name:'SENTETİK ADA',cls:'12/A',exam:'Sentetik Deneme 2',date:'2026-10-09',session:'TYT',nets:{turkce:32}}]},hw=parse(homework()),att=parse(attendance()),et=parse(etutRaporu(GUNLER));const one=R.merge([ex,hw,att,et]),two=R.merge([ex,hw,att,et,ex,hw,att,et]);assert.deepEqual(plain(two),plain(one));const s=one.students.find(s=>s.no==='1001');assert.equal(s.homework.length,3);assert.equal(s.exams.length,1);assert.equal(s.attendance.length,4);assert(s.sessions.length)});
check('a classroom code in the notebook (302) and the class in Yoklama and the lists (11/A) are one class',()=>{
 // The notebook keeps Myexamy's code as şube; the 11. sınıf list prints "302 11/A", Yoklama "11/A".
 ctx.l=sinifListesi(SINIFLAR.onbir);ctx.y=yoklamaRaporu([{no:'302',sinif:'11/A',ogrenciler:[{ad:'SENTETİK JALE',gunler:[['22/09/2026','PPPPPPPP']]},{ad:'SENTETİK SONAT',gunler:[['22/09/2026','AAAAAAAA']]}]}]);
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:4001,ad:'SENTETİK JALE',sube:'302',sinif:11},{no:4003,ad:'SENTETİK SONAT',sube:'302',sinif:11}];D.siralama=SIRALAMA.oku().veri;SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(l.pages,l.boylar));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(y.pages));",ctx);
 const m=R.model(),ad=n=>m.students.filter(s=>s.name===n);
 assert.deepEqual(plain([...new Set(m.students.map(s=>s.cls))].sort()),['11/A','11/B']);
 assert.equal(ad('SENTETİK JALE').length,1);assert(ad('SENTETİK JALE')[0].exams.length&&ad('SENTETİK JALE')[0].attendance.length);
 // SONAT is in no deneme list: the code the list taught still makes the class 11/A, one student with the yoklama.
 assert.equal(ad('SENTETİK SONAT').length,1);assert.equal(ad('SENTETİK SONAT')[0].cls,'11/A');assert(ad('SENTETİK SONAT')[0].attendance.length);
 assert.deepEqual(plain(parse(homework()).derslikler),['301 12/A']);
});
check('a notebook student whose number is missing or different is the one student of that name in the class',()=>{
 // The notebook writes the name its own way and keeps the classroom code; the list has the school number.
 ctx.l=okulListesi(SINAVLAR.sonra.F);ctx.y=yoklamaRaporu([{no:'205',sinif:'12/C',ogrenciler:[{ad:'SENTETİK EGE',gunler:[['22/09/2026','PPPPPPPP']]}]}]);
 for(const [no,uyari] of [['',false],[99,true]]){
  ctx.no=no;vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no,ad:'Sentetik Ege',sube:'205',sinif:12}];D.siralama=SIRALAMA.oku().veri;SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(l.pages,l.boylar));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(y.pages));",ctx);
  const m=R.model(),ege=m.students.filter(s=>s.cls==='12/C');
  assert.equal(ege.length,1,String(no));assert.equal(ege[0].name,'Sentetik Ege');assert(ege[0].exams.length&&ege[0].attendance.length);
  assert(!m.warnings.some(w=>/birden fazla/.test(w)));assert.equal(m.warnings.some(w=>w.includes('numarası defterde 99, raporda 1005')),uyari);
  if(!uyari)assert.equal(ege[0].no,'1005');
 }
});
check('homework: every status is drawn; homework the report has not marked counts as not given',()=>{
 const s=R.merge([parse(homework())]).students.find(s=>s.no==='1001'),svg=R.svgReport(s,'2026-10-24');
 // Toplam 11 printed: Tamamladı 6, Eksik 1, Yapmadı 2, Gelmedi 1 and one not marked, which is left out.
 assert.deepEqual(plain(s.homework.map(h=>h.values[0])),[4,2,4]);
 for(const t of ['6 / 10','Tamamladı 6','Eksik 1','Yapmadı 2','Gelmedi 1','Matematik TYT','İnkılap tarihi','Kimya','Matematik TYT · Toplam 4 · Tamamladı 3 · Eksik 1'])assert(svg.includes(t),t);
 assert(!/Getirmedi 0|6 \/ 11|şaretlenmemiş/.test(svg));
 // The same lesson printed twice (FİZİK and Fizik) is one row; a lesson with nothing marked is not shown.
 const h=(course,values)=>({no:'7',name:'SENTETİK EFE',cls:'10/B',course,values,reportDate:'2026-10-24',assignmentDate:null});
 const r=parse(homework());r.students=[{no:'7',name:'SENTETİK EFE',cls:'10/B'}];r.homework=[h('FİZİK',[7,7,0,0,0,0,0]),h('Fizik',[1,1,0,0,0,0,0])];
 const ev=R.svgReport(R.merge([r]).students[0],'2026-10-24');assert.equal((ev.match(/>Fizik</g)||[]).length,1);assert(ev.includes('>8/8<')&&ev.includes('8 / 8'));
 const q=homework();for(const pg of q.pages)for(const o of pg)if(/^[0-9]$/.test(o.s)&&o.x>300)o.s='0';
 assert.throws(()=>parse(q),/Ödev satırı bulunamadı/);
});
check('homework and weekly etut group subject variants, preserve all statuses and totals, and leave exam subjects intact',()=>{
 const person={no:'8',name:'SENTETİK DENİZ',cls:'12/A'},courses=['KİMYA TYT','Kimya AYT','FİZİK','FİZİK 1','Fizik 2','GEOMETRİ','GEOMETRİ SORU ÇÖZÜMÜ','TYT MATEMATİK','MATEMATİK AYT','BİYOLOJİ TYT','BİYOLOJİ AYT','TARİH 1','TARİH 2','TÜRKÇE','TÜRK DİLİ VE EDEBİYATI'];
 const r={students:[person],homework:courses.map(course=>({...person,course,values:[21,1,2,3,4,5,6],reportDate:'2026-10-25'})),
  sessions:courses.map(course=>({...person,course,date:'2026-10-19'})),start:'2026-10-19',end:'2026-11-01',
  exams:['TYT','AYT'].map(session=>({...person,session,exam:'Sentetik Deneme',date:'2026-10-20',nets:{mat:12,geo:4,fizik:5,kimya:3}}))};
 const before=JSON.stringify(r),s=R.merge([r]).students[0],svg=R.svgReport(s,'2026-10-25'),hw=svg.slice(svg.indexOf('Ödevler'),svg.indexOf('Etüt Talepleri'));
 assert.deepEqual(plain(s.weeks[0].courses),{Kimya:2,Fizik:3,Geometri:2,Matematik:2,Biyoloji:2,Tarih:2,Türkçe:1,Edebiyat:1});assert.equal(s.weeks[1].count,0);
 assert(hw.includes('Fizik · Toplam 63 · Tamamladı 3 · Eksik 6 · Getirmedi 9 · Geç getirdi 12 · Yapmadı 15 · Gelmedi 18'));
 for(const label of ['Kimya','Fizik','Geometri','Matematik TYT','Matematik AYT','Biyoloji','Tarih','Türkçe','Edebiyat'])assert.equal((hw.match(new RegExp('>'+label+'<','g'))||[]).length,1,label);
 assert(hw.includes('15 / 315'));assert(!/Kimya TYT|Fizik 1|Geometri soru/.test(svg));assert.deepEqual(plain(s.exams),r.exams);assert.equal(JSON.stringify(r),before);
});
check('only homework mathematics keeps TYT and AYT separate; Turkish and literature stay distinct for EA',()=>{
 const person={no:'20',name:'SENTETİK EA',cls:'12/EA'},courses=['TYT MATEMATİK','MATEMATİK TYT SORU ÇÖZÜMÜ','AYT MATEMATİK','MATEMATİK AYT 2','MATEMATİK','TÜRKÇE TYT','TÜRKÇE SORU ÇÖZÜMÜ','EDEBİYAT AYT','TÜRK DİLİ VE EDEBİYATI'];
 const source={students:[person],homework:courses.map(course=>({...person,course,values:[6,1,1,1,1,1,1],reportDate:'2026-10-25'}))},before=JSON.stringify(source),s=R.merge([source]).students[0],svg=R.svgReport(s,'2026-10-25');
 for(const label of ['Matematik TYT','Matematik AYT','Türkçe','Edebiyat'])assert(svg.includes(label+' · Toplam 12 · Tamamladı 2 · Eksik 2 · Getirmedi 2 · Geç getirdi 2 · Yapmadı 2 · Gelmedi 2'),label);
 assert(svg.includes('Matematik · Toplam 6'));assert(svg.includes('9 / 54'));assert.equal(JSON.stringify(source),before);
});
check('teacher totals count every etut once across lessons, merge spacing/case, and preserve missing teachers',()=>{
 const person={no:'21',name:'SENTETİK ÖĞRENCİ',cls:'12/A'},teachers=['SENTETİK IŞIK','  sentetik   ışık  ','SENTETİK IŞIK','SENTETİK İPEK',''],source={students:[person],start:'2026-10-01',end:'2026-10-25',sessions:teachers.map((teacher,i)=>({...person,teacher,course:i%2?'FİZİK 2':'FİZİK 1',date:'2026-10-'+(20+i)}))};
 const before=JSON.stringify(source),s=R.merge([source]).students[0],svg=R.svgReport(s,'2026-10-25');
 assert(svg.includes('Öğretmenler'));for(const t of ['SENTETİK IŞIK · 3 etüt','SENTETİK İPEK · 1 etüt','Öğretmen belirtilmemiş · 1 etüt'])assert(svg.includes('aria-label="'+t+'"'),t);
 assert.equal([...svg.matchAll(/aria-label="[^"]* · (\d+) etüt"/g)].reduce((n,m)=>n+Number(m[1]),0),s.sessions.length);assert.equal(s.weeks.reduce((n,w)=>n+w.count,0),5);assert.equal(JSON.stringify(source),before);
 const safe=R.svgReport({...s,sessions:[{...s.sessions[0],teacher:'<script>&"'}]},'2026-10-25');assert(safe.includes('&lt;script&gt;&amp;&quot;'));assert(!safe.includes('<script>'));
});
check('exam labels honor saved Tarama/Genel overrides in both sessions; manual exams use the existing name rule',()=>{
 ctx.l=okulListesi(SINAVLAR.sonra.F);
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',denemeler:[{id:'m:t',ad:'Konu Tarama',tarih:'2026-10-20',tur:'TYT',oturum:'TYT',dersler:[{kod:'mat',dogru:8,yanlis:0}]}]}];D.siralama=SIRALAMA.oku().veri;SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(l.pages,l.boylar));D.siralama.sinavlar[0].tur='tarama';",ctx);
 let s=R.model().students.find(s=>s.no==='1001');assert(s.exams.every(e=>e.examType==='tarama'));assert.equal((R.svgReport(s,'2026-10-25').match(/>Tarama</g)||[]).length,3);
 vm.runInContext("D.siralama.sinavlar[0].tur='genel';",ctx);s=R.model().students.find(s=>s.no==='1001');const svg=R.svgReport(s,'2026-10-25');assert.equal((svg.match(/>Genel</g)||[]).length,2);assert.equal((svg.match(/>Tarama</g)||[]).length,1);
});
check('same names in different classes never share attendance or sessions; ambiguous matches are flagged',()=>{const a={no:'1',name:'AYNI AD',cls:'12/A'},b={no:'2',name:'AYNI AD',cls:'12/B'},r={students:[a,b],attendance:[{name:'AYNI AD',cls:'12/B',date:'2026-10-23',statuses:['Geldi']}]};const m=R.merge([r]);assert.equal(m.students.length,1);assert.equal(m.students[0].no,'2');r.students[0].cls='12/B';assert.equal(R.merge([r]).warnings.length,1)});
check('SVG escapes text, keeps historical dates, and has no ranking or advice',()=>{const r=parse(okulListesi(SINAVLAR.sonra.F)),m=R.merge([r,parse(homework()),parse(attendance()),parse(etutRaporu(GUNLER))]),s=m.students.find(s=>s.no==='1001');s.name='<script>alert(1)</script>';const svg=R.svgReport(s,'2026-10-24');assert(svg.includes('&lt;script&gt;'));assert(!svg.includes('<script>'));assert(svg.includes('Ödev tarihi: belirtilmemiş'));assert(svg.includes('AYT EA Neti'));assert(!/Şube sırası|Ortalama|Sıradaki|Tekrar et|öneri/i.test(svg));assert(!/NaN|Infinity/.test(svg))});
check('teacher-only menu, empty roster page, imports do not mutate notebook and clear on notebook switch',()=>{
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogrencirapor';",ctx);assert(R.view().includes('Ödev raporu ekle'));const before=JSON.stringify(ctx.D);R.model();assert.equal(JSON.stringify(ctx.D),before);
 vm.runInContext("D=varsayilan();D.rol='ogrenci';",ctx);assert.equal(R.view(),'');assert.throws(()=>R.model(),/rehber/);assert(!vm.runInContext('JSON.stringify(SEKME_OGRENCI)',ctx).includes('ogrencirapor'));
});
check('existing website exams and etut feed reports without re-importing PDFs or saving notebook',()=>{
 ctx.exam=okulListesi(SINAVLAR.sonra.F);ctx.etut=etutRaporu(GUNLER);
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A',denemeler:[{id:'m:1',ad:'Elle deneme',tarih:'2026-10-20',tur:'TYT',oturum:'TYT',dersler:[{kod:'turkce',dogru:20,yanlis:4}]}]}];D.siralama=SIRALAMA.oku().veri;SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(exam.pages,exam.boylar));D.etut=ETUT.birlestir(null,ETUT.pdfCoz(etut.pages));",ctx);
 const before=vm.runInContext('JSON.stringify(D)',ctx),s=R.model().students.find(s=>s.no==='1001');assert.equal(s.school,'SENTETİK ANADOLU LİSESİ');assert(s.sessions.length>0);assert(s.exams.some(e=>e.exam==='Elle deneme'&&e.nets.turkce===19));assert(s.exams.some(e=>e.session==='AYT'&&e.nets.edebiyat===17.5));assert.equal(vm.runInContext('JSON.stringify(D)',ctx),before);
 vm.runInContext("D.siralama.sinavlar[0].tarih='03.10.2026';",ctx);assert.equal(R.model().students.find(s=>s.no==='1001').exams.find(e=>e.session==='AYT').date,'2026-10-03');
});
check('Etütler and Yoklama feed the report: lesson codes as statuses, students without an exam appear, sources and their pages are shown',()=>{
 ctx.etut=etutRaporu(GUNLER);ctx.yk=ornekRapor();
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:1001,ad:'SENTETİK ADA',sube:'12-A'}];D.etut=ETUT.birlestir(null,ETUT.pdfCoz(etut.pages));D.yoklama=YOKLAMA.birlestir(null,YOKLAMA.pdfCoz(yk.pages));EK.sekme='ogrencirapor';",ctx);
 const before=vm.runInContext('JSON.stringify(D)',ctx),m=R.model(),ada=m.students.find(s=>s.no==='1001');
 assert.deepEqual(plain(ada.attendance.find(a=>a.date==='2026-09-29').statuses.slice(0,3)),['Gecikti','Geldi','Geldi'],'G is Gecikti, P is Geldi');
 assert.deepEqual(plain(ada.attendance.find(a=>a.date==='2026-09-22').statuses),Array(8).fill('Gelmedi'));
 assert.equal(ada.daily.full,1,'22 Eyl');assert.equal(ada.daily.half,1,'8 Eki: four lessons missed');
 const feride=m.students.find(s=>s.name==='SENTETİK UZUNADLI FERİDE İKİNCİ');assert.deepEqual(plain(feride.attendance.find(a=>a.date==='2026-09-16').statuses),Array(6).fill('Raporlu'),'R is Raporlu');
 assert(m.students.some(s=>s.name==='SENTETİK CEM'&&s.cls==='11/B'&&s.attendance.length&&!s.exams.length),'a student only in Yoklama has a report');
 const etutAdlari=[...new Set(vm.runInContext('ETUT.ac(D.etut).map(r=>r.ad)',ctx))];assert(etutAdlari.length>1);
 for(const ad of etutAdlari)assert(m.students.some(s=>s.name===ad&&s.sessions.length),'a student only in Etütler has a report: '+ad);
 assert.equal(m.sources.yoklama.students.length,7);assert.equal(m.sources.etut.sessions.length,vm.runInContext('ETUT.ac(D.etut).length',ctx));
 const h=R.view();assert.match(h,/<b>Yoklama<\/b><span>7 öğrenci · 14\.09\.2026 – 16\.10\.2026<\/span><button type="button" class="dugme" data-sekme="yoklama">/);
 assert(h.includes('data-sekme="etutler"')&&h.includes('data-sekme="siralamalar"')&&h.includes('Öğrenci Ev Ödev Durum Raporu eklenmedi'));
 assert.equal(vm.runInContext('JSON.stringify(D)',ctx),before,'nothing is written to the notebook');
 // A class written another way still finds the one student of that name in the grade; two such students stay apart.
 const r=R.merge([{students:[{no:'1',name:'TEK AD',cls:'12/A'}],exams:[]},{kind:'attendance',students:[{name:'TEK AD',no:'',cls:'12 A'}],attendance:[{name:'TEK AD',no:'',cls:'12 A',date:'2026-10-01',statuses:['Geldi']}]}]);
 assert.equal(r.students.length,1);assert.equal(r.students[0].attendance.length,1);
});
check('grades 9 and 10 show English instead of AYT; grades 11 and 12 retain both sessions',()=>{
 const base=R.merge([{students:[{no:'9',name:'SENTETİK İPEK',cls:'9/A'}],exams:['TYT','AYT'].map(session=>({no:'9',name:'SENTETİK İPEK',cls:'9/A',exam:'Deneme',date:'2026-10-20',session,nets:{mat:10}}))}]).students[0];
 for(const cls of ['9/A','10-B','102 9/A','10 B']){const s={...base,cls},before=JSON.stringify(s),svg=R.svgReport(s,'2026-10-25');assert(!svg.includes('AYT'),cls);assert(svg.includes('x="26" y="96" width="558"'));assert(svg.includes('İngilizce puan grafiği'));assert.equal(JSON.stringify(s),before)}
 for(const [cls,track] of [['11/A','EA'],['12/C','SAY']])assert(R.svgReport({...base,cls},'2026-10-25').includes('AYT '+track+' Neti'));
 ctx.exams=base.exams;vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:'9',ad:'SENTETİK İPEK',sube:'102',sinif:9,denemeler:[{id:'m:9',ad:'Deneme',tarih:'2026-10-20',tur:'TYT',oturum:'TYT',dersler:[{kod:'mat',dogru:10,yanlis:0}]}]}];",ctx);
 const s=R.model().students[0];assert.equal(s.grade,9);assert(!R.svgReport(s,'2026-10-25').includes('AYT'),'notebook grade works even without a classroom-code mapping');
});
check('no etut uses the requested message both with and without a source date range',()=>{
 const s=R.merge([parse(homework())]).students[0];
 for(const weeks of [[],R.weekly([],'2026-10-01','2026-10-25')]){const svg=R.svgReport({...s,weeks,sessionStart:'2026-10-01',sessionEnd:'2026-10-25'},'2026-10-25');assert(svg.includes('Öğrencinin Etüt Talebi Olmamıştır'));assert(!svg.includes('Etüt kaydı yok'));assert(!svg.includes('01.10.2026'))}
 const withEtut=R.merge([parse(homework()),parse(etutRaporu(GUNLER))]).students.find(s=>s.no==='1001');assert(withEtut.sessions.length);assert(!R.svgReport(withEtut,'2026-10-25').includes('Öğrencinin Etüt Talebi Olmamıştır'));
});
check('AYT class tracks use only their own net lessons and groups stay in the requested vertical order',()=>{
 const person={no:'31',name:'SENTETİK ALAN',cls:'12/A'},exam={...person,exam:'Alan denemesi',date:'2026-10-23',session:'AYT',nets:{mat:20,geo:5,fizik:10,kimya:9,biyoloji:8,edebiyat:15,tarih1:6,cografya1:4,tarih2:7,cografya2:8,felsefe:9,din:3,sf:1.25},scores:{SAY:350.25,EA:321.5,'SÖZ':290.75}},s=R.merge([{students:[person],exams:[exam]}]).students[0],before=JSON.stringify(s);
 for(const [cls,track,net] of [['11/A','EA',50],['12/A','EA',50],['11 A','EA',50],['12-A','EA',50],['301 12/A','EA',50],['11A','EA',50],['11/B','SAY',52],['12/C','SAY',52],['12/AA','SAY',52]]){
  const svg=R.svgReport({...s,cls},'2026-10-25'),start=svg.indexOf('aria-label="AYT '+track+' net grafiği"'),main=svg.slice(start,svg.indexOf('Son AYT Netleri'));
  assert(start>=0,cls);assert(main.includes(' · '+net+' net</title>'),cls);assert(!main.includes('105,25 net'));for(const [k,v] of [['SAY','52'],['EA','50'],['SÖZ','53,25']])assert(svg.includes('aria-label="'+k+' neti · '+v+'"'));assert(!svg.includes('puanı'));
  const positions=['AYT Fen','AYT Matematik','AYT Türk Dili ve Edebiyatı · Sosyal 1','AYT Sosyal 2'].map(label=>svg.indexOf('aria-label="'+label+'"'));assert(positions.every((v,i)=>v>=0&&(!i||v>positions[i-1])));
 }
 assert(R.svgReport({...s,cls:'A',grade:11},'2026-10-25').includes('AYT EA Neti'));assert.equal(JSON.stringify(s),before);
 const missing=R.svgReport({...s,cls:'12/B',exams:[{...exam,nets:{edebiyat:12}}]},'2026-10-25');assert(!missing.slice(missing.indexOf('AYT SAY net grafiği'),missing.indexOf('Son AYT Netleri')).includes('net</title>'));
 const zero=R.svgReport({...s,exams:[{...exam,nets:{mat:0}}]},'2026-10-25');assert(zero.includes(' · 0 net</title>'));
});
check('AYT scores come from the result list and latest exam, with no invented or stale score',()=>{
 ctx.exam=okulListesi(SINAVLAR.sonra.F);vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[];D.siralama=SIRALAMA.oku().veri;SIRALAMA.ekle(D.siralama,SIRALAMA.pdfCoz(exam.pages,exam.boylar));",ctx);
 const before=vm.runInContext('JSON.stringify(D)',ctx),s=R.model().students.find(s=>s.no==='1001'),ex=s.exams.find(e=>e.session==='AYT');assert.deepEqual(plain(ex.scores),{SAY:300,EA:330,'SÖZ':290});assert.deepEqual(plain(ex.fields),{SAY:20.5,EA:47.5,'SÖZ':27});assert.equal(vm.runInContext('JSON.stringify(D)',ctx),before);
 const latest={...ex,exam:'Yeni sınav',date:'2026-10-24',scores:{EA:0}},svg=R.svgReport({...s,exams:[...s.exams,latest]},'2026-10-25');
 for(const label of ['SAY neti · 20,5','EA neti · 47,5','SÖZ neti · 27'])assert(svg.includes('aria-label="'+label+'"'));assert(!svg.includes('puanı'));assert(svg.includes('24.10.2026'));
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:'1',ad:'SENTETİK ELLE',sube:'12/A',sinif:12,denemeler:[{id:'m:alan',ad:'Elle AYT',tarih:'2026-10-24',tur:'AYT',oturum:'AYT',alan:'EA',puan:345.75,dersler:[{kod:'mat',dogru:10,yanlis:0}]}]}];",ctx);
 const manual=R.model().students[0];assert.deepEqual(plain(manual.exams[0].scores),{EA:345.75});assert(R.svgReport(manual,'2026-10-25').includes('EA neti · 10'));
});
check('English PDFs preserve all participants and dates, convert placement scores, and keep original printed data',()=>{
 const {englishResults}=require('./fixtures/english-pdf.cjs'),starter=englishResults({perPage:1}),r=parse(starter);assert.equal(r.kind,'english');assert.equal(r.exams.length,2);assert(r.exams.every(e=>e.session==='ENGLISH'&&e.date==='2026-10-05'));assert.equal(r.exams[0].scores.ENGLISH,85);assert.equal(r.exams[1].name,'SENTETİK UZUNADLI FIRAT İKİNCİ');
 const placement=englishResults({name:'FLY HIGHER PLACEMENT TEST',date:'02.09.2026',students:[{no:'2001',name:'SENTETİK ECE',cls:'9/A',code:'102',net:54.67,score:.55,correct:56,wrong:4},{no:'3001',name:'SENTETİK ON',cls:'10/B',code:'105',net:0,score:0,correct:12,wrong:36}]}),p=parse(placement);assert.equal(p.exams[0].scores.ENGLISH,91.12);assert.equal(p.exams[0].printedScore,.55);assert.equal(p.exams[0].maxNet,60);assert.equal(p.exams[0].nets.english,54.67);assert.equal(p.exams[1].scores.ENGLISH,0);
 const before=JSON.stringify([r,p]),m=R.merge([r,p,r]),s=m.students.find(s=>s.no==='2001');assert.equal(s.exams.length,2);assert.equal(s.exams[0].date,'2026-09-02');assert(R.svgReport(s,'2026-10-25').includes('91,12 puan</title>'));assert(!R.svgReport(s,'2026-10-25').includes('AYT'));assert.equal(JSON.stringify([r,p]),before);
 const truncated=structuredClone(starter);truncated.pages.pop();assert.throws(()=>parse(truncated),/katılımcı sayısı/);
 const changedName={...r,students:r.students.map(s=>s.no==='2001'?{...s,name:'SENTETİK E C E'}:s),exams:r.exams.map(e=>e.no==='2001'?{...e,name:'SENTETİK E C E'}:e)};assert.equal(R.merge([r,changedName]).students.length,2,'English matches a unique number and class despite a name layout difference');
});
check('the weekly timetable supplies every teacher and lesson for the matching class, including zero-etut lessons',()=>{
 const {dersProgrami}=require('./fixtures/ders-programi-pdf.cjs');ctx.program=vm.runInContext('ETUTPLANI.programCoz',ctx)(dersProgrami({kod:'102',sinif:'9/A',hucreler:[[0,0,'MATEMATİK','SENTETİK HOCA'],[1,0,'MATEMATİK','SENTETİK HOCA'],[2,0,'REHBERLİK','SENTETİK HOCA'],[3,0,'BEDEN EĞİTİMİ','SENTETİK SPOR'],[4,0,'İNGİLİZCE','SENTETİK DİL']]}));
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:'91',ad:'SENTETİK DOKUZ',sube:'102',sinif:9,denemeler:[{id:'m:91',ad:'Deneme',tarih:'2026-10-20',tur:'TYT',oturum:'TYT',dersler:[{kod:'mat',dogru:10,yanlis:0}]}]}];D.etutPlani={surum:1,ts:1,gunler:[[],[],[],[],[]],programlar:{'9/A':{...program,ts:1},'10/B':{...program,kod:'105',ts:1,dersler:[[0,program.saatler[0],'KİMYA','BAŞKA SINIF HOCASI']]}}};",ctx);
 const before=vm.runInContext('JSON.stringify(D)',ctx),m=R.model(),s=m.students[0];assert.equal(s.cls,'9/A');assert(s.hasTimetable);assert.equal(s.teachers.length,3);assert.deepEqual(plain(s.teachers.find(t=>t.teacher==='SENTETİK HOCA').courses),['MATEMATİK','REHBERLİK']);
 const svg=R.svgReport(s,'2026-10-25');for(const name of ['SENTETİK HOCA','SENTETİK SPOR','SENTETİK DİL'])assert(svg.includes('aria-label="Ders öğretmeni · '+name+'"'));assert(svg.includes('Beden eğitimi'));assert(!svg.includes('BAŞKA SINIF HOCASI'));assert(!svg.includes('Haftalık ders programı eklenmemiş'));assert.equal(vm.runInContext('JSON.stringify(D)',ctx),before);assert.equal(m.sources.programs,2);
});
check('class teachers and etut requests are separate sections, with plain capitalized headings',()=>{
 const person={no:'71',name:'SENTETİK AYRI',cls:'9/A'},r={students:[person],start:'2026-10-01',end:'2026-10-25',sessions:[{...person,teacher:'YALNIZ ETÜT HOCASI',course:'FİZİK',date:'2026-10-20'}]},s=R.merge([r]).students[0];s.teachers=[{teacher:'YALNIZ SINIF HOCASI',courses:['BEDEN EĞİTİMİ']}];s.hasTimetable=true;
 const svg=R.svgReport(s,'2026-10-25'),etut=svg.slice(svg.indexOf('aria-label="Etüt Talepleri"'),svg.indexOf('aria-label="Öğretmenler"')),teachers=svg.slice(svg.indexOf('aria-label="Öğretmenler"'));
 assert(etut.includes('YALNIZ ETÜT HOCASI · 1 etüt'));assert(!etut.includes('YALNIZ SINIF HOCASI'));assert(teachers.includes('YALNIZ SINIF HOCASI')&&teachers.includes('Beden eğitimi'));assert(!teachers.includes('YALNIZ ETÜT HOCASI'));assert(!teachers.includes('etüt'));
 for(const heading of ['Yoklama','Ödevler','Öğretmenler','Etüt Talepleri','İngilizce Sınav Puanları','TYT Toplam Net'])assert(svg.includes('>'+heading+'</text>'));assert(!/Öğretmenlerim|derslere göre|Gün bazında devam/.test(svg));
});
check('teacher labels are short, deduplicated, and resolve practical lessons by the teacher own subject',()=>{
 const rows=[['BEDEN EĞİTİMİ','SPOR HOCASI'],['TEMEL DİNİ BİLGİLER','DİN HOCASI'],['SEÇMELİ İNGİLİZCE','DİL HOCASI'],['SAĞLIK BİLGİSİ VE TRAFİK KÜLTÜRÜ','BİYOLOJİ HOCASI'],['FEN BİLİMİ UYGULAMALARI','FİZİK HOCASI'],['UYGULAMALI DENEY','KİMYA HOCASI'],['MATEMATİK UYGULAMALARI','MATEMATİK HOCASI'],['MATEMATİK AYT','MATEMATİK HOCASI'],['TÜRK DİLİ VE EDEBİYATI','EDEBİYAT HOCASI'],['REHBERLİK','TARİH HOCASI'],['T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK','TARİH HOCASI'],['GÖRSEL SANATLAR','SANAT HOCASI']];
 ctx.teacherRows=rows;vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[{no:'91',ad:'SENTETİK DOKUZ',sube:'102',sinif:9,denemeler:[{id:'m:91',ad:'Deneme',tarih:'2026-10-20',tur:'TYT',oturum:'TYT',dersler:[{kod:'mat',dogru:10,yanlis:0}]}]}];D.etutPlani={surum:1,ts:1,gunler:[[],[],[],[],[]],programlar:{'9/A':{...program,ts:1,dersler:teacherRows.map(([c,t])=>[0,program.saatler[0],c,t])},'12/C':{...program,kod:'205',ts:1,dersler:[[0,program.saatler[0],'FİZİK TYT','FİZİK HOCASI'],[0,program.saatler[0],'KİMYA AYT','KİMYA HOCASI']]}}};",ctx);
 const before=vm.runInContext('JSON.stringify(D)',ctx),s=R.model().students[0],svg=R.svgReport(s,'2026-10-25');
 const expected={'SPOR HOCASI':'Beden','DİN HOCASI':'Din','DİL HOCASI':'İngilizce','BİYOLOJİ HOCASI':'Biyoloji','FİZİK HOCASI':'Fizik','KİMYA HOCASI':'Kimya','MATEMATİK HOCASI':'Matematik','EDEBİYAT HOCASI':'Edebiyat','TARİH HOCASI':'Tarih','SANAT HOCASI':'Görsel sanatlar'};
 for(const [name,label] of Object.entries(expected)){const part=svg.split('aria-label="Ders öğretmeni · '+name+'"')[1];assert(part,JSON.stringify({name,cls:s.cls,teachers:s.teachers}));const group=part.split('</g>')[0].replace(/<title>.*?<\/title>/g,'');assert.equal([...group.matchAll(/<text [^>]*>(.*?)<\/text>/g)].map(m=>m[1]).join(' '),name+' '+label);assert(!group.includes('…'));}
 assert.equal(vm.runInContext('JSON.stringify(D)',ctx),before);assert(s.teachers.find(t=>t.teacher==='FİZİK HOCASI').courses.includes('FEN BİLİMİ UYGULAMALARI'));
});
check('a full 60-question placement result is 100/100; half is 50, independent of the cohort maximum',()=>{
 const {englishResults}=require('./fixtures/english-pdf.cjs'),person={no:'61',name:'SENTETİK TAM',cls:'9/A',code:'102'},input=englishResults({name:'FLY HIGHER PLACEMENT TEST',students:[{...person,net:60,score:.60,correct:60,wrong:0},{...person,no:'62',name:'SENTETİK YARIM',net:30,score:.30,correct:35,wrong:15}]}),before=JSON.stringify(input),r=parse(input);
 assert.equal(r.exams[0].scores.ENGLISH,100);assert.equal(r.exams[0].nets.english,60);assert.equal(r.exams[0].printedScore,.60);assert.equal(r.exams[0].scoreBasis,'net');assert.equal(r.exams[0].maxNet,60);assert.equal(r.exams[1].scores.ENGLISH,50);
 const svg=R.svgReport(R.merge([r]).students[0],'2026-10-25');assert(svg.includes('100 puan</title>'));assert(!svg.includes('60 puan</title>'));assert.equal(JSON.stringify(input),before);
 const halfOnly=englishResults({name:'FLY HIGHER PLACEMENT TEST',students:[{...person,net:30,score:.30,correct:35,wrong:15}]});assert.equal(parse(halfOnly).exams[0].scores.ENGLISH,50,'do not scale the strongest student in the file to 100');
});
check('source embedding is current and idempotent',()=>{require('child_process').execFileSync(process.execPath,['scripts/embed-ogrencirapor.cjs','--check']);const before=fs.readFileSync('index.html','utf8');require('child_process').execFileSync(process.execPath,['scripts/embed-ogrencirapor.cjs']);assert.equal(fs.readFileSync('index.html','utf8'),before)});
console.log(passed+' student report checks passed');
