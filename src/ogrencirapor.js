// Student visual reports. Source PDFs stay in this browser session; nothing is written to
// the notebook or uploaded. Keep real student data out of this source and its tests.
const OGRENCI_RAPOR = (() => {
'use strict';
const TYT=[['turkce','Türkçe'],['tarih','Tarih'],['cografya','Coğrafya'],['felsefe','Felsefe'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const AYT=[['edebiyat','Edebiyat'],['tarih1','Tarih 1'],['cografya1','Coğrafya 1'],['tarih2','Tarih 2'],['cografya2','Coğrafya 2'],['felsefe','Felsefe grubu'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const AYT_GROUPS=[
 {label:['Fen'],keys:['fizik','kimya','biyoloji']},
 {label:['Matematik'],keys:['mat','geo']},
 {label:['Türk Dili ve Edebiyatı','Sosyal 1'],keys:['edebiyat','tarih1','cografya1']},
 {label:['Sosyal 2'],keys:['tarih2','cografya2','felsefe','din','sf']}
];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim(),nameKey=s=>clean(s).normalize('NFKC').toLocaleUpperCase('tr-TR');
// A classroom code ("302") stands for its class ("11/A"): the notebook keeps the code as şube (toplu
// öğrenci ekle stores Myexamy's "302"), Etütler and Yoklama write the class. Lists that print both
// ("302 11/A") teach the pairs, so a class is never split in two.
const DERSLIK=new Map();
const dersligiOgren=s=>{const m=nameKey(s).match(/^(\d{3})\s+(\d{1,2})\s*[-/]\s*([A-ZÇĞİÖŞÜ]+)$/u);if(m)DERSLIK.set(m[1],m[2]+'/'+m[3])};
const cls=s=>{const m=nameKey(s).match(/(\d{1,2})\s*[-/]\s*([A-ZÇĞİÖŞÜ]+)/u);return m?m[1]+'/'+m[2]:DERSLIK.get(clean(s))||clean(s)};
// A student without a school number is told apart by name and class: same names in two classes are two students.
const key=s=>s.no?String(s.no)+'|'+nameKey(s.name):'|'+nameKey(s.name)+'|'+cls(s.cls),cx=o=>o.x+o.w/2;
function date(s){const m=clean(s).match(/^(\d{2})[./](\d{2})[./](\d{4})$/);const iso=m?m[3]+'-'+m[2]+'-'+m[1]:s;if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')||new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso)throw new Error('Geçersiz tarih: '+s);return iso}
const day=s=>Math.floor(Date.parse(date(s)+'T00:00:00Z')/86400000),iso=g=>new Date(g*86400000).toISOString().slice(0,10),display=s=>s?date(s).split('-').reverse().join('.'):'Tarih yok';
const normItems=p=>p.filter(o=>clean(o.s)).map(o=>({...o,s:clean(o.s)}));
function join(items){return items.slice().sort((a,b)=>Math.abs(a.y-b.y)>2?b.y-a.y:a.x-b.x).map(o=>o.s).join(' ').replace(/\s+/g,' ').trim()}
function printedDate(pages){
 const months={Oca:'01',Şub:'02',Mar:'03',Nis:'04',May:'05',Haz:'06',Tem:'07',Ağu:'08',Eyl:'09',Eki:'10',Kas:'11',Ara:'12'};
 for(const page of pages){const m=join(page.filter(o=>o.y<40)).match(/(\d{1,2})\s+(Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)\s+(\d{4})/u);if(m)return date(m[3]+'-'+months[m[2]]+'-'+m[1].padStart(2,'0'))}return null;
}
function homeworkPdf(pages){
 const students=[],homework=[],reportDate=printedDate(pages),derslikler=new Set();let current=null,columns=null;
 for(const raw of pages){const p=normItems(raw),heads=p.filter(o=>o.s==='Öğrenci Adı Soyadı').sort((a,b)=>b.y-a.y);
  const people=heads.map(h=>{const n=join(p.filter(o=>Math.abs(o.y-h.y)<1&&o.x>h.x+h.w+2)).replace(/^:\s*/,''),sh=p.find(o=>o.s==='Şube / No.'&&o.y<h.y&&h.y-o.y<22);
   const cl=sh&&join(p.filter(o=>Math.abs(o.y-sh.y)<1&&o.x>sh.x+sh.w+2)).replace(/^:\s*/,'');const m=cl&&cl.match(/^(.*?)\s*\/\s*(\d+)$/);
   if(!n||!m)throw new Error('Ödev öğrenci kimliği okunamadı.');dersligiOgren(m[1]);derslikler.add(m[1]);const s={no:m[2],name:n,cls:cls(m[1])};students.push(s);return {y:h.y,s};});
  const header=p.find(o=>o.s==='Toplam');if(header)columns=['Toplam','Tamamladı','Eksik','Getirmedi','Geç Getirdi','Yapmadı','Gelmedi'].map(t=>{const h=p.find(o=>o.s===t&&Math.abs(o.y-header.y)<1);if(!h)throw new Error('Ödev sütunu eksik: '+t);return cx(h)});
  if(!columns)throw new Error('Ödev sütunları okunamadı.');
  const anchors=p.filter(o=>o.x<45&&o.y>35&&/^\d+$/.test(o.s)).sort((a,b)=>b.y-a.y);
  anchors.forEach((a,i)=>{
   const person=people.filter(h=>h.y>a.y).at(-1);if(person)current=person.s;if(!current)throw new Error('Ödev satırının öğrencisi bulunamadı.');
   const top=Math.min(a.y+10,i?(anchors[i-1].y+a.y)/2:Infinity),bottom=Math.max(a.y-10,i+1<anchors.length?(a.y+anchors[i+1].y)/2:-Infinity),band=p.filter(o=>o.y<=top&&o.y>=bottom);
   const course=join(band.filter(o=>o.x>=48&&cx(o)<columns[0]-35)),values=columns.map(x=>{const n=band.filter(o=>Math.abs(cx(o)-x)<20&&/^\d+$/.test(o.s));if(n.length!==1)throw new Error('Ödev sayısı okunamadı.');return Number(n[0].s)});
   if(!course||values[0]<values.slice(1).reduce((a,b)=>a+b,0))throw new Error('Ödev toplamı uyuşmuyor.');
   // Homework the report has not marked yet (Toplam above its statuses) counts as not given.
   const verilen=values.slice(1).reduce((x,y)=>x+y,0);if(verilen)homework.push({...current,course,values:[verilen,...values.slice(1)],reportDate,assignmentDate:null,row:a.s});
  });
  if(people.length)current=people.at(-1).s;
 }
 if(!homework.length)throw new Error('Ödev satırı bulunamadı.');
 return {kind:'homework',students,homework,reportDate,derslikler:[...derslikler]};
}
function attendancePdf(pages){
 const students=[],attendance=[];let currentClass='',currentName='';
 for(const raw of pages){const p=normItems(raw),title=p.find(o=>o.s.includes('Yoklama Raporu'));if(title)currentClass=cls(title.s);
  const headers=p.filter(o=>/^\d+\. Ders$/.test(o.s)).sort((a,b)=>a.x-b.x);if(!headers.length)continue;
  const dates=p.filter(o=>/^\d{2}\/\d{2}\/\d{4}$/.test(o.s)).sort((a,b)=>b.y-a.y);if(!dates.length)continue;
  const dx=Math.min(...dates.map(o=>o.x)),nameItems=p.filter(o=>o.x<dx-10&&o.y<headers[0].y&&o.y>35),blocks=[];
  for(const d of dates){if(!blocks.length||date(d.s)<=date(blocks.at(-1).at(-1).s))blocks.push([]);blocks.at(-1).push(d)}
  blocks.forEach((block,bi)=>{
   const top=bi?(blocks[bi-1].at(-1).y+block[0].y)/2:headers[0].y-2,bottom=bi+1<blocks.length?(block.at(-1).y+blocks[bi+1][0].y)/2:35;
   const name=join(nameItems.filter(o=>o.y<top&&o.y>bottom));if(name)currentName=name;
   if(!currentName||!currentClass)throw new Error('Yoklama öğrenci adı/şubesi okunamadı.');const s={name:currentName,no:'',cls:currentClass};students.push(s);
   for(const d of block){const statuses=headers.map((h,j)=>{const half=j?Math.abs(cx(h)-cx(headers[j-1]))/2:22;
     const cell=p.filter(o=>Math.abs(cx(o)-cx(h))<half&&Math.abs(o.y-d.y)<10),text=join(cell);
     if(!text)return '';
     if(/Raporlu/.test(text))return 'Raporlu';if(/Mazeretli/.test(text))return 'Mazeretli';if(/Gelmedi/.test(text))return 'Gelmedi';if(/Gecikti/.test(text))return 'Gecikti';if(/Geldi/.test(text))return 'Geldi';throw new Error('Yoklama durumu okunamadı: '+text);
    });attendance.push({...s,date:date(d.s),statuses});}
  });
 }
 if(!attendance.length)throw new Error('Yoklama kaydı bulunamadı.');return {kind:'attendance',students,attendance};
}
function englishPdf(pages){
 const first=normItems(pages[0]||[]),meta=label=>{const h=first.find(o=>o.s===label);if(!h)throw new Error('İngilizce sınav başlığı okunamadı: '+label);return h},nameHead=meta('Sınav Adı:'),dateHead=meta('Sınav Tarihi:');
 const exam=join(first.filter(o=>Math.abs(o.y-nameHead.y)<2&&o.x>nameHead.x+nameHead.w&&o.x<dateHead.x)),examDate=date(join(first.filter(o=>Math.abs(o.y-dateHead.y)<2&&o.x>dateHead.x+dateHead.w)));
 if(!exam)throw new Error('İngilizce sınav adı okunamadı.');
 const countHead=meta('Toplam Katılımcı:'),declared=Number(join(first.filter(o=>Math.abs(o.y-countHead.y)<2&&o.x>countHead.x+countHead.w&&o.x<160))),schoolHead=meta('Okul:');
 const school=join(first.filter(o=>o!==schoolHead&&o.x<160&&o.y<=schoolHead.y+2&&o.y>countHead.y+3)),students=[],exams=[],derslikler=new Set(),maxNet=/\bFLY HIGHER PLACEMENT TEST\b/i.test(exam)?60:null,questionCount=maxNet||(/\bSTARTER TEST\b/i.test(exam)?20:null);
 for(const raw of pages){const p=normItems(raw).flatMap(o=>{const m=o.x<31&&o.s.match(/^(\d+)\s+(\d+\s*\/\s*.+)$/);return m?[{...o,s:m[1],w:10},{...o,s:m[2],x:32.6,w:Math.max(0,o.w-15)}]:[o]}),header=p.find(o=>o.s.includes('NO/İsim')),netHead=p.find(o=>o.s==='İNG'),scoreHead=p.find(o=>o.s==='Puan');if(!header||!netHead||!scoreHead)throw new Error('İngilizce sonuç sütunları okunamadı.');
  const anchors=p.filter(o=>o.x<32&&/^\d+$/.test(o.s)&&o.y<header.y-15).sort((a,b)=>b.y-a.y);
  anchors.forEach((a,i)=>{const limit=Math.max(12,(a.z||8)*1.6),top=i?(anchors[i-1].y+a.y)/2:a.y+limit,bottom=i+1<anchors.length?(a.y+anchors[i+1].y)/2:a.y-limit,band=p.filter(o=>o.y<top&&o.y>bottom);
   const identity=join(band.filter(o=>o.x>=31&&o.x<102)),m=identity.match(/^(\d+)\s*\/\s*(.+)$/),classItems=band.filter(o=>o.x>=102&&cx(o)<135),classText=join(classItems),c=classText.match(/(?:(\d{3})\s+)?(9|10)\s*\/\s*([A-ZÇĞİÖŞÜ]+)/u);
   if(!m||!c)throw new Error('İngilizce öğrenci adı / sınıfı okunamadı.');if(c[1]){dersligiOgren(c[1]+' '+c[2]+'/'+c[3]);derslikler.add(c[1]+' '+c[2]+'/'+c[3])}
   const readAt=head=>{const v=band.filter(o=>Math.abs(cx(o)-cx(head))<22&&/^-?\d+(?:[.,]\d+)?$/.test(o.s)).sort((a,b)=>b.y-a.y);if(v.length!==1)throw new Error('İngilizce sonuç sayısı okunamadı.');return Number(v[0].s.replace(',','.'))},net=readAt(netHead),printedScore=readAt(scoreHead),dy=band.find(o=>Math.abs(cx(o)-cx(netHead))<25&&/^\d+\/\d+$/.test(o.s));
   const score=maxNet?Math.round(net/maxNet*10000)/100:printedScore;
   if(!dy||!Number.isFinite(net)||!Number.isFinite(printedScore)||printedScore<0||!Number.isFinite(score)||score<0||score>100.01)throw new Error('İngilizce puanı geçersiz.');
   const [correct,wrong]=dy.s.split('/').map(Number),totalQuestions=questionCount??correct+wrong,s={no:m[1],name:m[2],cls:c[2]+'/'+c[3]};if(correct+wrong>totalQuestions)throw new Error('İngilizce doğru/yanlış sayısı soru sayısını aşıyor.');students.push(s);exams.push({...s,exam,date:examDate,session:'ENGLISH',nets:{english:net},scores:{ENGLISH:score},printedScore,scoreBasis:maxNet?'net':'printed',maxNet,questionCount:totalQuestions,correct,wrong});
  });
 }
 if(!exams.length||!Number.isInteger(declared)||exams.length!==declared||new Set(students.map(key)).size!==exams.length)throw new Error('İngilizce katılımcı sayısı uyuşmuyor; eksik liste eklenmedi.');
 return {kind:'english',students,exams,school,derslikler:[...derslikler]};
}
function parse(pages,boylar){
 const text=pages[0].map(o=>o.s).join(' ');
 if(/DENEME SINAVI TOPLU SONUÇ/.test(text)&&pages[0].some(o=>o.s==='İNG')&&pages[0].some(o=>o.s==='İNGİLİZCE'))return englishPdf(pages);
 if(/DENEME SINAVI TOPLU SONUÇ/.test(text))return {kind:'exam'};
 if(/Öğrenci Ev Ödev Durum Raporu/.test(text))return homeworkPdf(pages);
 if(/Yoklama Raporu/.test(text))return attendancePdf(pages);
 if(/Tarih Bazlı Etüt Raporu/.test(text)){const r=ETUT.pdfCoz(pages);if(r.atlanan)throw new Error(r.atlanan+' etüt satırı okunamadı; eksik rapor eklenmedi.');return {kind:'sessions',students:[],sessions:r.satirlar.map(s=>({name:s.ad,cls:cls(s.sinif),date:iso(s.g),course:s.brans,teacher:s.ogretmen,time:s.saat,minutes:s.sure})),start:iso(r.bas),end:iso(r.bit)}}
 throw new Error('Ödev veya İngilizce sonuç raporu seçin.');
}
// A day's statuses as Yoklama's lesson codes, so both pages use one missed-day rule (YOKLAMA.kacirma).
const KOD={Geldi:'P',Gecikti:'G',Gelmedi:'A',Raporlu:'R'};
const yoklamaKodu=statuses=>statuses.filter(Boolean).map(v=>KOD[v]||(v.startsWith('Mazeretli')?'M':'')).join('');
function attendanceSummary(rows){
 const out={present:0,half:0,full:0,missed:0,unknown:0,days:rows.length,percent:null};
 for(const r of rows){const k=yoklamaKodu(r.statuses),d=YOKLAMA.kacirma(k);
  if(!k)out.unknown++;else if(d==='tam')out.full++;else if(d==='yarim')out.half++;else out.present++;
 }
 out.missed=out.full+out.half;const known=out.days-out.unknown;out.percent=known?100*out.present/known:null;return out;
}
// Report-only grouping: keep the original sources and all deneme subject keys intact.
function courseName(course){
 const k=nameKey(course).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'I')
  .replace(/[-–—_/()]+/g,' ').replace(/(?:^|\s)(?:TYT|AYT|\d+)(?=\s|$)/g,' ')
  .replace(/\bSORU COZUMU?\b/g,' ').replace(/\s+/g,' ').trim();
 const names={KIMYA:'Kimya',FIZIK:'Fizik',BIYOLOJI:'Biyoloji',MATEMATIK:'Matematik',GEOMETRI:'Geometri',TURKCE:'Türkçe',EDEBIYAT:'Edebiyat',
  'TURK DILI VE EDEBIYATI':'Edebiyat',TARIH:'Tarih',COGRAFYA:'Coğrafya',FELSEFE:'Felsefe','FELSEFE GRUBU':'Felsefe',
  'DIN KULTURU':'Din kültürü','DIN KULTURU VE AHLAK BILGISI':'Din kültürü',INGILIZCE:'İngilizce'};
 return names[k]||dersAdi(course);
}
function weekly(rows,start,end){
 if(!start&&!rows.length)return [];
 const days=rows.map(s=>day(s.date));let first=start?day(start):Math.min(...days),last=end?day(end):Math.max(...days);
 first-=(new Date(first*86400000).getUTCDay()+6)%7;const weeks=[];
 if(last-first>3660)throw new Error('Etüt tarih aralığı 10 yıldan uzun.');
 for(let d=first;d<=last;d+=7){const r=rows.filter(s=>day(s.date)>=d&&day(s.date)<d+7),courses={};r.forEach(s=>{const c=courseName(s.course);courses[c]=(courses[c]||0)+1});weeks.push({date:iso(d),count:r.length,courses})}return weeks;
}
function homeworkCourseName(course){
 const name=courseName(course),sessions=[...new Set(nameKey(course).match(/\b(?:TYT|AYT)\b/g)||[])];
 return name==='Matematik'&&sessions.length?name+' '+sessions.join(' / '):name;
}
function merge(reports,roster=[]){
 const map=new Map(),alias=new Map(),loose=[],warnings=[];
 const yazili=c=>/^\d{1,2}\/[A-ZÇĞİÖŞÜ]+$/u.test(cls(c));
 // A numbered record whose number the notebook does not have (no number, or another one) is the one
 // student of that name in that class; a different number is reported so the notebook can be fixed.
 const ikiz=s=>{const a=[...map.values()].filter(x=>x.cls&&s.cls&&nameKey(x.name)===nameKey(s.name)&&cls(x.cls)===cls(s.cls));return a.length===1?a[0]:null};
 // A class written as grade/şube wins over a classroom code no list explained.
 const ensure=(s,english=false)=>{const id=key(s);let o=map.get(id)||alias.get(id);
  if(!o&&english&&s.no&&s.cls){const a=[...map.values()].filter(x=>String(x.no)===String(s.no)&&cls(x.cls)===cls(s.cls));if(a.length===1){o=a[0];alias.set(id,o)}}
  if(!o&&s.no&&(o=ikiz(s))){alias.set(id,o);if(!o.no)o.no=s.no;else if(o.no!==s.no)warnings.push(o.name+': numarası defterde '+o.no+', raporda '+s.no+'; aynı öğrenci sayıldı.')}
  if(!o)map.set(id,o={...s,id,exams:[],homework:[],attendance:[],sessions:[]});else if(s.cls&&(!o.cls||!yazili(o.cls)&&yazili(s.cls)))o.cls=cls(s.cls);
  return o};
 roster.forEach(s=>ensure(s));
 reports.filter(r=>r.kind!=='english').concat(reports.filter(r=>r.kind==='english')).forEach(r=>(r.students||[]).forEach(s=>{if(s.no)ensure(s,r.kind==='english');else loose.push(s)}));
 // Records without a number match by name and class; a class written another way ("12 A") still matches
 // the one student of that name in the same grade.
 const grade=c=>parseInt(cls(c),10);
 const named=s=>{const a=[...map.values()].filter(x=>nameKey(x.name)===nameKey(s.name)&&cls(x.cls)===cls(s.cls));if(a.length)return a;
  const b=[...map.values()].filter(x=>nameKey(x.name)===nameKey(s.name));
  return b.length===1&&(!b[0].cls||!s.cls||!(yazili(b[0].cls)&&yazili(s.cls))&&grade(b[0].cls)===grade(s.cls))?b:[]};
 for(const s of loose)if(!named(s).length)ensure(s);
 const find=s=>{if(s.no)return map.get(key(s))||alias.get(key(s));const a=named(s);if(a.length>1)warnings.push(s.name+': ad/şube birden fazla öğrenciye ait; kaydı eşleştirilmedi.');return a.length===1?a[0]:null};
 for(const r of reports){
  // The same exam and session can arrive from two sources (the student's imported results and the stored
  // Sıralamalar lists) under different dates: a combined TYT+AYT list prints the AYT day for its TYT part.
  // Identical nets within a week are one result, kept on the earlier (real) date; the later source wins otherwise.
  const sameNets=(a,b)=>[...new Set([...Object.keys(a.nets||{}),...Object.keys(b.nets||{})])].every(k=>Math.abs(((a.nets||{})[k]??0)-((b.nets||{})[k]??0))<0.011);
  for(const e of r.exams||[]){const s=find(e);if(s){const n=s.exams.findIndex(x=>x.session===e.session&&nameKey(x.exam)===nameKey(e.exam)&&(x.date===e.date||sameNets(x,e)&&Math.abs(day(x.date)-day(e.date))<=7));
   if(n<0)s.exams.push(e);else{const old=s.exams[n];s.exams[n]={...e,date:old.date<e.date?old.date:e.date}}}}
  const grouped=new Map();for(const h of r.homework||[]){const s=find(h);if(s){if(!grouped.has(s))grouped.set(s,[]);grouped.get(s).push(h)}}
  for(const [s,rows] of grouped){if(!s.homework.length||(r.reportDate||'')>=(s.homework[0].reportDate||''))s.homework=rows}
  for(const a of r.attendance||[]){const s=find(a);if(s){const n=s.attendance.findIndex(x=>x.date===a.date);if(n<0)s.attendance.push(a);else s.attendance[n]=a}}
  if(r.sessions){for(const s of map.values())s.sessions=s.sessions.filter(x=>x.date<r.start||x.date>r.end);for(const e of r.sessions){const s=find(e);if(s)s.sessions.push(e)}}
 }
 const sessionReports=reports.filter(r=>r.sessions),start=sessionReports.length?sessionReports.map(r=>r.start).sort()[0]:null,end=sessionReports.length?sessionReports.map(r=>r.end).sort().at(-1):null;
 const students=[...map.values()].filter(s=>s.exams.length||s.homework.length||s.attendance.length||s.sessions.length);
 for(const s of students){s.exams.sort((a,b)=>a.date.localeCompare(b.date)||a.exam.localeCompare(b.exam));s.attendance.sort((a,b)=>a.date.localeCompare(b.date));s.sessions.sort((a,b)=>a.date.localeCompare(b.date));s.daily=attendanceSummary(s.attendance);s.weeks=weekly(s.sessions,start,end);s.sessionStart=start;s.sessionEnd=end;s.school=reports.find(r=>r.school)?.school||''}
 students.sort((a,b)=>a.cls.localeCompare(b.cls,'tr',{numeric:true})||a.name.localeCompare(b.name,'tr'));return {students,warnings:[...new Set(warnings)]};
}
/* ---------------- visual, one-page report (shared by preview and export) ---------------- */
// The homework report's statuses after Toplam, in its column order, with their colours.
const ODEV_DURUM=[['Tamamladı','#168d7d'],['Eksik','#e5a044'],['Getirmedi','#d27c4c'],['Geç getirdi','#6799c5'],['Yapmadı','#bf6951'],['Gelmedi','#657878']];
// Lesson names as the report prints them, in sentence case ("KİMYA TYT" → "Kimya TYT").
const dersAdi=c=>{const k=nameKey(c).replace('T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK','İNKILAP TARİHİ').replace('DİN KÜLTÜRÜ VE AHLAK BİLGİSİ','DİN KÜLTÜRÜ').toLocaleLowerCase('tr-TR').replace(/\b(tyt|ayt)\b/g,x=>x.toUpperCase());
 return k.charAt(0).toLocaleUpperCase('tr-TR')+k.slice(1)};
// Short subject labels for Öğretmenler only. Practical/support lessons use that teacher's own subject.
function teacherSubject(course){
 const k=nameKey(course).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'I');
 const names=[[/BEDEN/,'Beden'],[/GORSEL.*SANAT/,'Görsel sanatlar'],[/TEMEL DIN|^DIN/,'Din'],[/SAGLIK.*TRAFIK/,'Biyoloji'],[/MATEMATIK/,'Matematik'],[/GEOMETRI/,'Geometri'],[/EDEBIYAT/,'Edebiyat'],[/TURKCE/,'Türkçe'],[/FIZIK/,'Fizik'],[/KIMYA/,'Kimya'],[/BIYOLOJI/,'Biyoloji'],[/TARIH|INKILAP/,'Tarih'],[/COGRAFYA/,'Coğrafya'],[/FELSEFE|MANTIK|PSIKOLOJI|SOSYOLOJI/,'Felsefe'],[/INGILIZCE|YABANCI DIL/,'İngilizce']];
 return names.find(([re])=>re.test(k))?.[1]||'';
}
const teacherCourseVisible=c=>!/ADAB.*MUASERET/.test(nameKey(c).normalize('NFD').replace(/[\u0300-\u036f]/g,''));
function teacherLabels(t){
 const labels=[...new Set(t.courses.filter(teacherCourseVisible).map(c=>teacherSubject(c)||(/REHBERLİK|FEN BİLİM|UYGULAMALI DENEY/i.test(nameKey(c))&&t.mainSubject)||dersAdi(c)))];
 return labels.filter(c=>c!=='Rehberlik'||labels.length===1).join(', ');
}
const C={ink:'#213d40',muted:'#657878',green:'#168d7d',amber:'#e5a044',red:'#bf6951',blue:'#6799c5',gray:'#d9dfdc',bg:'#f6f5f0',pale:'#e6f2ec'},W=1190.55,H=841.89;
const PAGE_W=841.89,PAGE_H=595.28,RASTER_SCALE=3; // A4 landscape; one opaque image at about 300 dpi.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
// Net of an AYT field (SAY / EA / SÖZ) in one exam record: the sum of the field's lessons, as the school's list adds
// them (a lesson the student did not answer counts 0). A published list supplies the figure; "—" when no lesson is recorded.
const fieldNet=(e,f)=>{if(e.fields&&f in e.fields)return e.fields[f];
 const n=DENEME_ALAN[f].map(k=>e.nets[k]).filter(Number.isFinite);return n.length?n.reduce((a,b)=>a+b,0):null};
function svgReport(s,reportDate){
 const out=[],grade=Number(s.grade)||parseInt(cls(s.cls),10),showAYT=![9,10].includes(grade),section=nameKey(cls(s.cls)).replace(/\s+/g,''),track=/^(11|12)[/-]?A$/.test(section)||[11,12].includes(grade)&&section==='A'?'EA':'SAY';
 const text=(x,y,t,size=12,color=C.ink,bold=false,anchor='start',center=false)=>out.push('<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="'+color+'" font-weight="'+(bold?700:400)+'" text-anchor="'+anchor+'"'+(center?' dominant-baseline="central"':'')+'>'+esc(t)+'</text>');
 const measure=typeof document!=='undefined'?document.createElement('canvas').getContext?.('2d'):null;
 const width=(label,size)=>{if(measure){measure.font=size+'px Arial';return measure.measureText(label).width}return [...label].length*size*.6};
 const fit=(value,maxWidth,size)=>{const label=String(value);if(width(label,size)<=maxWidth)return label;const chars=[...label];let lo=0,hi=chars.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(width(chars.slice(0,mid).join('')+'…',size)<=maxWidth)lo=mid;else hi=mid-1}return chars.slice(0,lo).join('').trimEnd()+'…'};
 const wrap=(value,maxWidth,size)=>{const lines=[];let line='';for(const word of String(value).trim().split(/\s+/)){const next=line?line+' '+word:word;if(width(next,size)<=maxWidth){line=next;continue}if(line){lines.push(line);line=''}for(const char of word){if(line&&width(line+char,size)>maxWidth){lines.push(line);line=''}line+=char}}if(line)lines.push(line);return lines.length?lines:['']};
 const staff=(s.teachers||[]).map(t=>({...t,courses:t.courses.filter(teacherCourseVisible)})).filter(t=>t.courses.length).sort((a,b)=>a.teacher.localeCompare(b.teacher,'tr')),staffPad=18,staffGap=24,staffSubjectGap=16,staffCols=2,staffWidth=(640-staffPad*2-staffGap)/staffCols,subjectWidth=88,staffNameWidth=staffWidth-staffSubjectGap-subjectWidth,staffFont=11,staffLine=13;
 const staffRows=[];for(let i=0;i<staff.length;i+=staffCols){const cells=staff.slice(i,i+staffCols).map(t=>({t,names:wrap(t.teacher,staffNameWidth,staffFont),subjects:wrap(teacherLabels(t),subjectWidth,staffFont)}));staffRows.push({cells,height:Math.max(...cells.map(c=>Math.max(c.names.length,c.subjects.length)))*staffLine})}
 const staffHeight=staffPad*2+20+6+(staffRows.length?staffRows.reduce((n,r)=>n+r.height,0):staffLine),staffTop=816-staffHeight,leftBottom=staffTop-12,leftHeight=leftBottom-478,attendanceTop=540,attendanceBottom=leftBottom-18,ringY=(attendanceTop+attendanceBottom)/2,ringRadius=Math.min(38,Math.max(18,(attendanceBottom-attendanceTop-13)/2));
 const rect=(x,y,w,h,fill='#fff',r=12)=>out.push('<rect x="'+x+'" y="'+y+'" width="'+Math.max(0,w)+'" height="'+Math.max(0,h)+'" rx="'+Math.min(r,h/2,w/2)+'" fill="'+fill+'"/>');
 const line=(x1,y1,x2,y2,color=C.gray,width=1)=>out.push('<path d="M'+x1+','+y1+' L'+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="'+width+'"/>');
 const dot=(x,y,r=3,color=C.green)=>out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="'+color+'" stroke-width="1.7"/>');
 const ring=(x,y,r,percent)=>{out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.gray+'" stroke-width="13"/>');if(percent!==null){const circumference=2*Math.PI*r;out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.green+'" stroke-width="13" stroke-dasharray="'+circumference*percent/100+' '+circumference+'" transform="rotate(-90 '+x+' '+y+')"/>')}};
 // Doğru (green), yanlış (red) and boş (grey) match the Yoklama and mock-exam rings.
 const DYB=[['Doğru',C.green],['Yanlış',C.red],['Boş',C.gray]];
 const donut=(cx,cy,r,stroke,d,y,total)=>{out.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+C.gray+'" stroke-width="'+stroke+'"/>');const c=2*Math.PI*r;let start=0;
  for(const [n,color] of [[d,C.green],[y,C.red]]){if(n>0&&total>0){out.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-dasharray="'+c*n/total+' '+c+'" stroke-dashoffset="'+(-c*start/total)+'" transform="rotate(-90 '+cx+' '+cy+')"/>')}start+=n}};
 const counts=(e,k)=>{const v=e.dy?.[k];if(!v)return null;const q=Math.max(e.q?.[k]??0,v[0]+v[1]);return {d:v[0],y:v[1],b:q-v[0]-v[1],q}};
 const englishCounts=e=>{const d=Number(e.correct)||0,y=Number(e.wrong)||0,q=Math.max(d+y,Number(e.questionCount)||Number(e.maxNet)||d+y);return {d,y,b:q-d-y,q}};
 const ringLessons=e=>TYT.filter(([k])=>{const c=counts(e,k);return c&&(k!=='sf'||c.d+c.y>0)});
 function graph(exams,values,x,y,w,h,large=false,pointLabels=true,unit='net',examKinds=true,fixedMax=null){
  const valid=values.filter(v=>v!==null&&v!==undefined);
  if(!valid.length){text(x+w/2,y+h/2,'Sonuç yok',large?16:11,C.muted,false,'middle');return}
  const lo=Math.min(0,...valid),hi=fixedMax||Math.max(5,Math.ceil(Math.max(...valid)/5)*5),yy=v=>y+h-(v-lo)/(hi-lo)*h,xx=i=>x+(exams.length>1?w*i/(exams.length-1):w/2);
  [lo,(lo+hi)/2,hi].forEach(v=>{line(x,yy(v),x+w,yy(v),'#e5ebe7',.7);if(large)text(x-8,yy(v)+3,fmt(v),10,C.muted,false,'end')});
  // Missing sessions break the line; explicit zero results remain visible points.
  let run=[];const flush=()=>{if(run.length>1){const p=run.map(i=>xx(i)+','+yy(values[i]));out.push('<path d="M'+xx(run[0])+','+yy(0)+' L'+p.join(' L')+' L'+xx(run.at(-1))+','+yy(0)+' Z" fill="'+C.pale+'"/>');out.push('<polyline points="'+p.join(' ')+'" fill="none" stroke="'+C.green+'" stroke-width="2.2"/>')}run=[]};
  values.forEach((v,i)=>{if(v===null||v===undefined)flush();else run.push(i)});flush();
  const step=large?Math.max(1,Math.ceil(exams.length/7)):Math.max(1,exams.length-1);
  values.forEach((v,i)=>{if(v===null||v===undefined)return;out.push('<g><title>'+esc(exams[i].exam+' · '+display(exams[i].date)+' · '+fmt(v)+' '+unit)+'</title>');dot(xx(i),yy(v),large?4:2.8);out.push('</g>');
   if(pointLabels&&(i%step===0||i===exams.length-1))text(xx(i),yy(v)-8,fmt(v),large?12:10,C.green,true,i===0&&exams.length>1?'start':i===exams.length-1&&exams.length>1?'end':'middle');
  });
  if(large)exams.forEach((e,i)=>{if(i%step&&i!==exams.length-1)return;const name=e.exam.replace(/^27-/,'').replace(/TYT_SIFIR_POZİTİF/g,'Sıfır Pozitif').replace(/FLY HIGHER /i,'').replace(/ LEVEL UNIT STARTER TEST/i,' Starter').replace(/ UNIT STARTER TEST/i,' Starter'),anchor=i===0&&exams.length>1?'start':i===exams.length-1&&exams.length>1?'end':'middle';text(xx(i),y+h+20,display(e.date),10,C.muted,false,anchor);text(xx(i),y+h+36,name.length>20?name.slice(0,19)+'…':name,10,C.muted,false,anchor);if(examKinds)text(xx(i),y+h+49,(e.examType||SIRALAMA.addanTur(e.exam))==='tarama'?'Tarama':'Genel',10,C.muted,false,anchor)});
 }
 function lessonCharts(session,x,w){
  const exams=s.exams.filter(e=>e.session===session),lessons=(session==='TYT'?TYT:AYT).filter(([k])=>exams.some(e=>e.nets[k]!==undefined)&&(k!=='sf'||exams.some(e=>(e.nets[k]||0)!==0)));
  text(x,260,session+' Ders Netleri',13,C.muted,true);
  if(!lessons.length){rect(x,272,w,190);text(x+w/2,370,'Bu oturumda ders sonucu yok',15,C.muted,false,'middle');return}
  const columns=lessons.length>10?4:5,rows=Math.ceil(lessons.length/columns),cw=(w-(columns-1)*8)/columns,ch=(190-(rows-1)*8)/rows;
  lessons.forEach(([code,label],i)=>{const bx=x+(i%columns)*(cw+8),by=272+Math.floor(i/columns)*(ch+8);rect(bx,by,cw,ch);text(bx+9,by+17,label,11,C.ink,true);graph(exams,exams.map(e=>e.nets[code]??null),bx+10,by+36,cw-20,ch-48)});
 }
 // 9. and 10. sınıf have one exam, so the TYT result is rings: the total, then each lesson.
 function examRing(e,x,w){
  const rows=ringLessons(e).map(([k,label])=>({label,...counts(e,k),net:e.nets[k]})),sum=f=>rows.reduce((a,r)=>a+r[f],0),d=sum('d'),y=sum('y'),b=sum('b'),net=rows.reduce((a,r)=>a+(Number.isFinite(r.net)?r.net:0),0),cx=x+88,cy=186,r=34;
  out.push('<g aria-label="TYT toplam · doğru '+d+', yanlış '+y+', boş '+b+'"><title>'+esc(e.exam+' · '+display(e.date)+' · net '+fmt(net))+'</title>');
  text(x+18,139,e.exam+' · '+display(e.date),11,C.muted);donut(cx,cy,r,14,d,y,d+y+b);
  const label=fmt(net);text(cx,cy-4,label,Math.min(20,20*(r*2-14)*.88/width(label,20)),C.ink,true,'middle',true);text(cx,cy+12,'net',9,C.muted,false,'middle');
  DYB.forEach(([name,color],i)=>{const n=[d,y,b][i],px=x+230+i*100;text(px,cy-2,n,23,i===2?C.muted:color,true,'middle');text(px,cy+14,name,10.5,C.muted,false,'middle')});out.push('</g>');
 }
 function englishRing(e,x,w){
  const c=englishCounts(e),score=fmt(e.scores?.ENGLISH),cx=x+154,cy=286,r=70,values=[c.d,c.y,c.b];
  text(x+18,158,e.exam+' · '+display(e.date),11,C.muted);
  out.push('<g aria-label="İngilizce toplam · doğru '+c.d+', yanlış '+c.y+', boş '+c.b+'"><title>'+esc(e.exam+' · '+display(e.date)+' · '+score+' puan')+'</title>');
  donut(cx,cy,r,18,c.d,c.y,c.q);text(cx,cy-5,score,Math.min(24,24*(r*2-18)*.88/width(score,24)),C.ink,true,'middle',true);text(cx,cy+14,'puan',10,C.muted,false,'middle');
  DYB.forEach(([name,color],i)=>{const y=cy-43+i*43;rect(x+294,y-6,10,10,color,5);text(x+314,y+4,values[i],22,i===2?C.muted:color,true);text(x+362,y+4,name,12,C.muted)});out.push('</g>');
 }
 function lessonRings(e,x,w){
  const lessons=ringLessons(e);text(x,260,'TYT Ders Netleri',13,C.muted,true);
  let lx=x+w-DYB.reduce((a,[name])=>a+24+width(name,10.5),0);DYB.forEach(([name,color])=>{rect(lx,252,8,8,color,4);text(lx+13,260,name,10.5,C.muted);lx+=24+width(name,10.5)});
  const columns=lessons.length>10?4:5,rows=Math.ceil(lessons.length/columns),cw=(w-(columns-1)*8)/columns,ch=(190-(rows-1)*8)/rows,r=Math.min(26,(ch-22)/2-12);
  lessons.forEach(([k,label],i)=>{const bx=x+(i%columns)*(cw+8),by=272+Math.floor(i/columns)*(ch+8),c=counts(e,k),cx=bx+10+r+4,cy=by+22+(ch-22)/2,net=fmt(e.nets[k]);
   out.push('<g aria-label="TYT ders · '+esc(label)+' · doğru '+c.d+', yanlış '+c.y+', boş '+c.b+'"><title>'+esc(label+' · net '+net)+'</title>');rect(bx,by,cw,ch);text(bx+9,by+17,label,11,C.ink,true);
   donut(cx,cy,r,8,c.d,c.y,c.d+c.y+c.b);text(cx,cy,net,Math.min(11,11*(r*2-8)*.88/width(net,11)),C.ink,true,'middle',true);
   [c.d,c.y,c.b].forEach((n,j)=>{const ry=cy+(j-1)*15;out.push('<circle cx="'+(bx+cw-34)+'" cy="'+ry+'" r="3.5" fill="'+DYB[j][1]+'"/>');text(bx+cw-26,ry,n,11,C.ink,true,'start',true)});out.push('</g>');
  });
 }
 function aytLessons(exams,x,w){
  text(x,260,'AYT Ders Netleri',13,C.muted,true);
  AYT_GROUPS.forEach((group,i)=>{const y=272+i*49;out.push('<g aria-label="AYT '+esc(group.label.join(' · '))+'">');rect(x,y,w,43);
   group.label.forEach((label,j)=>text(x+12,y+(group.label.length===1?25:18)+j*13,label,10.5,C.ink,true));
   const lessons=group.keys.filter(k=>exams.some(e=>e.nets[k]!=null)&&(k!=='sf'||exams.some(e=>(e.nets[k]||0)!==0))),left=x+136,cw=(w-148)/Math.max(1,lessons.length);
   if(!lessons.length)text(left+(w-148)/2,y+25,'Sonuç yok',11,C.muted,false,'middle');
   lessons.forEach((code,j)=>{const bx=left+j*cw,full=AYT.find(d=>d[0]===code)[1],label=code==='felsefe'?'Felsefe':code==='din'?'Din':code==='sf'?'Ek fel.':code==='cografya2'&&lessons.length>4?'Coğ. 2':full,values=exams.map(e=>e.nets[code]??null);out.push('<g aria-label="AYT ders · '+esc(full)+'"><title>'+esc(full)+'</title>');
    if(j)line(bx-5,y+8,bx-5,y+35,'#e5ebe7',.7);text(bx,y+13,label,10,C.muted);text(bx+cw-14,y+13,fmt(values.at(-1)),10,C.green,true,'end');
    graph(exams,values,bx+3,y+23,cw-20,13,false,false);out.push('</g>');
   });out.push('</g>');
  });
 }
 rect(0,0,W,H,C.bg,0);text(28,28,s.school||'ÖĞRENCİ RAPORU',11,C.muted,true);text(28,59,s.name,27,C.ink,true);text(28,80,[s.cls,s.no].filter(Boolean).join(' / '),12,C.muted);text(W-28,47,display(reportDate),12,C.muted,false,'end');
 for(const [session,x,w] of showAYT?[['TYT',26,558],['AYT',600,564]]:[['TYT',26,558]]){
  const ex=s.exams.filter(e=>e.session===session),rings=!showAYT&&session==='TYT'&&ex.length&&ringLessons(ex.at(-1)).length?ex.at(-1):null;
  rect(x,96,w,144);text(x+18,121,rings?'TYT Doğru · Yanlış · Boş':session+(session==='AYT'?' '+track+' Neti':' Toplam Net'),17,C.ink,true);
  if(rings){examRing(rings,x,w);lessonRings(rings,x,w);continue}
  const values=ex.map(e=>{const keys=session==='AYT'?DENEME_ALAN[track]:Object.keys(e.nets),nets=keys.map(k=>e.nets[k]).filter(Number.isFinite);return nets.length?nets.reduce((a,b)=>a+b,0):null});
  out.push('<g aria-label="'+session+(session==='AYT'?' '+track:'')+' net grafiği">');graph(ex,values,x+42,140,w-(session==='AYT'?230:78),42,true);out.push('</g>');
  if(session==='AYT'){
   const last=ex.at(-1),sx=x+w-136;line(sx-10,112,sx-10,229);text(sx+2,121,'Son AYT Netleri',11,C.muted,true);if(last)text(sx+2,136,display(last.date),10,C.muted);
   (track==='EA'?['EA','SAY','SÖZ']:['SAY','EA','SÖZ']).forEach((field,i)=>{const y=145+i*28,value=last?fieldNet(last,field):null;out.push('<g aria-label="'+esc(field+' neti · '+fmt(value))+'">');if(field===track)rect(sx-4,y-2,126,26,C.pale,7);text(sx+3,y+17,field,11,C.muted,true);text(x+w-18,y+18,fmt(value),20,field===track?C.green:C.ink,true,'end');out.push('</g>')});
   aytLessons(ex,x,w);
  }else lessonCharts(session,x,w);
 }
 if(!showAYT){rect(600,96,564,366);text(618,121,'İngilizce Sınav Puanları',17,C.ink,true);const ex=s.exams.filter(e=>e.session==='ENGLISH');out.push('<g aria-label="İngilizce puan grafiği">');if(ex.length===1&&Number.isFinite(ex[0].correct)&&Number.isFinite(ex[0].wrong))englishRing(ex[0],600,564);else graph(ex,ex.map(e=>e.scores.ENGLISH),642,157,486,235,true,true,'puan',false,100);out.push('</g>')}
 // Attendance percentage is based on the same day classifications shown below it.
 out.push('<g aria-label="Yoklama">');rect(26,478,244,leftHeight);text(44,505,'Yoklama',17,C.ink,true);
 if(s.attendance.length){text(44,526,display(s.attendance[0].date)+' - '+display(s.attendance.at(-1).date),11,C.muted);const percent=s.daily.percent===null?'—':'%'+fmt(Math.round(s.daily.percent*10)/10),percentSize=Math.min(23,23*(ringRadius*2-13)*.88/width(percent,23));
  out.push('<g aria-label="Devam yüzdesi · '+esc(percent)+'">');ring(96,ringY,ringRadius,s.daily.percent);text(96,ringY,percent,percentSize,C.green,true,'middle',true);out.push('</g>');
  const entries=[['Okulda',s.daily.present,C.green],['Kaçırdığı günler',s.daily.missed,C.red]],step=Math.min(48,(attendanceBottom-attendanceTop)/2);
  entries.forEach(([label,n,color],i)=>{const y=ringY+(i-.5)*step;out.push('<g aria-label="'+esc(label+' · '+n)+'">');text(202,y-2,n,23,color,true,'middle');text(202,y+13,label,10.5,C.muted,false,'middle');out.push('</g>')});
 }else text(148,ringY,'Yoklama kaydı yok',15,C.muted,false,'middle');out.push('</g>');
 // Homework rows remain attached to their source report date. No due date is invented.
 rect(284,478,382,leftHeight);text(301,505,'Ödevler',17,C.ink,true);
 if(s.homework.length){const rd=s.homework[0].reportDate;text(301,526,'Rapor: '+display(rd)+' · Ödev tarihi: belirtilmemiş',11,C.muted);
  // Every status the report prints is drawn, in its column order.
  const totals=s.homework.reduce((a,h)=>a.map((v,i)=>v+h.values[i]),[0,0,0,0,0,0,0]);
  text(648,505,totals[1]+' / '+totals[0],14,C.green,true,'end');
  const courses=new Map();s.homework.forEach(h=>{const k=homeworkCourseName(h.course),o=courses.get(k)||{course:k,values:[0,0,0,0,0,0,0]};o.values=o.values.map((v,i)=>v+h.values[i]);courses.set(k,o)});
  let lx=301,ly=537;ODEV_DURUM.forEach(([ad,renk],i)=>{const n=totals[i+1];if(!n&&i)return;const t=ad+' '+n,w=t.length*5.3+18;
   if(lx+w>660){lx=301;ly+=13}rect(lx,ly,7,7,renk,2);text(lx+10,ly+7,t,9.5,C.muted);lx+=w});
  const top=ly+17,rh=Math.min(16,(leftBottom-10-top)/courses.size);
  [...courses.values()].forEach((h,i)=>{const y=top+i*rh,label=dersAdi(h.course),v=h.values;
   out.push('<g><title>'+esc(h.course+' · Toplam '+v[0]+ODEV_DURUM.map(([ad],j)=>v[j+1]?' · '+ad+' '+v[j+1]:'').join(''))+'</title>');
   text(301,y+9,label.length>24?label.slice(0,23)+'…':label,10.5,C.muted);rect(471,y,124,8,C.gray,4);
   let x=471;ODEV_DURUM.forEach(([,renk],j)=>{const w=v[0]?124*v[j+1]/v[0]:0;if(w)rect(x,y,w,8,renk,w<8?0:4);x+=w});
   text(648,y+9,v[1]+'/'+v[0],11,C.ink,true,'end');out.push('</g>');
  });
 }else text(475,600,'Ödev kaydı yok',15,C.muted,false,'middle');
 // Weekly chart plus course/weekly heatmap: every session contributes exactly once.
 out.push('<g aria-label="Etüt Talepleri">');rect(680,478,484,338);text(697,505,'Etüt Talepleri',17,C.ink,true);text(1146,505,s.sessions.length+' etüt',15,C.green,true,'end');
 if(s.sessions.length&&s.weeks.length){text(697,526,display(s.sessionStart||s.weeks[0].date)+' - '+display(s.sessionEnd||iso(day(s.weeks.at(-1).date)+6)),11,C.muted);
  const n=s.weeks.length,left=800,cw=345/n,max=Math.max(1,...s.weeks.map(w=>w.count));
  s.weeks.forEach((w,i)=>{const x=left+(i+.5)*cw,height=32*w.count/max;rect(x-cw*.3,589-height,cw*.6,height,C.green,3);if(n<=20||i%Math.ceil(n/10)===0)text(x,581-height,w.count,10,C.green,true,'middle');if(i%Math.max(1,Math.ceil(n/10))===0)text(x,606,display(w.date).slice(0,5),10,C.muted,false,'middle')});
  const courses=[...new Set(s.sessions.map(e=>courseName(e.course)))].sort((a,b)=>a.localeCompare(b,'tr'));
  const rh=Math.min(18,98/Math.max(1,courses.length)),font=Math.min(10.5,rh-3),cellHeight=rh-2;
  courses.forEach((c,j)=>{const yy=619+j*rh;out.push('<g><title>'+esc(c)+'</title>');text(697,yy+cellHeight/2,c.length>15?c.slice(0,14)+'…':c,font,C.muted,false,'start',true);
   s.weeks.forEach((w,i)=>{const v=w.courses[c]||0,x=left+i*cw;out.push('<g aria-label="Etüt Hücresi · '+esc(c+' · '+w.date+' · '+v)+'">');rect(x+1,yy,cw-2,cellHeight,v?'#c7e5d7':'#f0f3f0',3);if(v&&n<=20)text(x+cw/2,yy+cellHeight/2,v,font,C.green,true,'middle',true);out.push('</g>')});out.push('</g>');
  });
 }else text(922,600,'Öğrencinin Etüt Talebi Olmamıştır',15,C.muted,false,'middle');
 // Etut totals belong only to this section; timetable teachers are a separate list below.
 const etutTeachers=new Map();for(const e of s.sessions){const name=clean(e.teacher)||'Öğretmen belirtilmemiş',k=nameKey(name),t=etutTeachers.get(k)||{name,count:0};t.count++;etutTeachers.set(k,t)}
 const totals=[...etutTeachers.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'tr')),etCols=totals.length>11?3:2,etWidth=450/etCols,etRows=totals.length?1+Math.ceil((totals.length-1)/etCols):0,etRh=Math.min(17,78/Math.max(1,etRows));
 if(totals.length)text(697,727,'Öğretmen',11,C.ink,true);
 totals.forEach((t,i)=>{const first=i===0,x=697+(first?0:(i-1)%etCols)*etWidth,y=735+(first?0:1+Math.floor((i-1)/etCols))*etRh,w=first?450:etWidth,fs=11,maxWidth=w-50,cy=y+(etRh-2)/2;
  out.push('<g aria-label="'+esc(t.name+' · '+t.count+' etüt')+'"><title>'+esc(t.name+' · '+t.count+' etüt')+'</title>');
  rect(x,y,w-8,etRh-2,first?C.pale:'#f3f5f2',3);text(x+6,cy,fit(t.name,maxWidth,fs),fs,C.ink,false,'start',true);rect(x+w-35,y+1,23,etRh-4,'#fff',3);text(x+w-23.5,cy,t.count,11,C.green,true,'middle',true);out.push('</g>');
 });out.push('</g>');
 // Only the actual weekly timetable supplies this list; there are no etut counts here.
 out.push('<g aria-label="Öğretmenler">');rect(26,staffTop,640,staffHeight);text(26+staffPad,staffTop+staffPad+15,'Öğretmenler',17,C.ink,true);
 let staffY=staffTop+staffPad+20+6+10;
 if(!staff.length)text(26+staffPad,staffY,s.hasTimetable?'Programda öğretmen kaydı yok':'Haftalık ders programı eklenmemiş',staffFont,C.muted);
 for(const row of staffRows){row.cells.forEach(({t,names,subjects},col)=>{const x=26+staffPad+col*(staffWidth+staffGap),subjectX=x+staffNameWidth+staffSubjectGap;
  out.push('<g aria-label="Ders öğretmeni · '+esc(t.teacher)+'"><title>'+esc(t.teacher+' · '+t.courses.map(dersAdi).join(', '))+'</title>');names.forEach((label,i)=>text(x,staffY+i*staffLine,label,staffFont,C.ink));subjects.forEach((label,i)=>text(subjectX,staffY+i*staffLine,label,staffFont,C.muted));out.push('</g>');
 });staffY+=row.height}out.push('</g>');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(s.name+' bireysel raporu')+'" font-family="Arial, sans-serif">'+out.join('')+'</svg>';
}
/* ---------------- Kurum raporu: the institution-level twin (aggregate only, no student names) ---------------- */
// A scope is the whole school or one grade. Everything below reads the students merge() produced, so the
// sources (site reports plus the homework / English PDFs added on the page) are the same as the student report's.
const gradeOf=s=>Number(s.grade)||parseInt(cls(s.cls),10)||null;
function kurumKapsamlari(students){
 const g=new Map();for(const s of students){const n=gradeOf(s);if(n)g.set(n,(g.get(n)||0)+1)}
 return [{key:'okul',label:'Tüm okul',grade:null,count:students.length}].concat([...g].sort((a,b)=>b[0]-a[0]).map(([n,c])=>({key:String(n),label:n+'. sınıf',grade:n,count:c})));
}
const LISTE_ADI={kolej:'Kolej',kurum:'Tüm kurumlar',kurs:'Kurs'};
// The school's own TYT average per exam (all TYT nets added, as the student report's TYT line does), oldest first.
function kurumDenemeler(list){
 const map=new Map();
 for(const s of list)for(const e of s.exams){if(e.session!=='TYT')continue;const nets=Object.values(e.nets).filter(Number.isFinite);if(!nets.length)continue;
  const k=nameKey(e.exam),o=map.get(k)||{key:k,ad:e.exam,date:e.date,sum:0,n:0};o.sum+=nets.reduce((a,b)=>a+b,0);o.n++;if(e.date<o.date)o.date=e.date;map.set(k,o)}
 return [...map.values()].map(o=>({...o,avg:o.sum/o.n})).sort((a,b)=>a.date.localeCompare(b.date)||a.ad.localeCompare(b.ad,'tr'));
}
// The model is slow-ish: while pages are being built for several scopes (the preview and its page counts) one result per grade is shared.
let KT_ONBELLEK=null;
function kurumTurkiye(grade){
 if(KT_ONBELLEK&&KT_ONBELLEK.has(grade))return KT_ONBELLEK.get(grade);
 let r;try{r=kurumTurkiyeAl(grade)}catch(e){r={var:false,neden:'hata'}}
 if(KT_ONBELLEK)KT_ONBELLEK.set(grade,r);return r;
}
function kurumOnbellekli(f){KT_ONBELLEK=new Map();try{return f()}finally{KT_ONBELLEK=null}}
// The school's Türkiye geneli standing for one grade, from the Türkiye geneli page's own model (nothing is re-computed here).
// {var:false, neden} when no list / school. Else every exam (with its kind: Tarama or Genel, Sıralamalar' choice for that exam,
// else from its name) and two cards, TYT and AYT: the total T series (shown as the yüzdelik dilim, "ilk %12", dil / dilNow; the colour and arrow of
// a change still come from ΔT) (TYT toplam; SAY, EA, SÖZ), every ders's T series and the
// comparison pair. The totals' ΔT is first → latest exam with a value. A ders's ΔT is the latest Tarama against the Tarama before it
// (a Genel exam between them is skipped), so two kinds of exam are never mixed; with fewer than two Tarama exams a ders has no ΔT.
function kurumTurkiyeAl(grade){
 const yok=neden=>({var:false,neden});
 if(typeof TURKIYE==='undefined'||typeof D==='undefined')return yok('liste');
 const {veri}=TURKIYE.oku();if(!veri)return yok('liste');
 // The list kind and school the teacher chose on the Türkiye geneli page (EK.tgListe / EK.tgOkul) come first, so the
 // charts are the page's own; only when that list kind has nothing for the grade does the old order (kolej, kurum, kurs) apply.
 const ek=typeof EK!=='undefined'&&EK?EK:{},SIRA=['kolej','kurum','kurs'],secili=SIRA.includes(ek.tgListe)?ek.tgListe:null,okulSec=ek.tgOkul||undefined;
 const duzey='d'+grade,al=(liste,oturum,toplam)=>TURKIYE.model(veri,{liste,duzey,oturum,toplam,okul:okulSec,mod:'tpuan',aralik:'tum'});
 let liste=null,temel=null;
 for(const l of secili?[secili,...SIRA.filter(x=>x!==secili)]:SIRA){const m=al(l,'TYT');if(m.liste===l&&m.duzey===duzey){liste=l;temel=m;break}}
 if(!temel)return yok('liste');
 const sl=(()=>{try{return SIRALAMA.oku().veri?.sinavlar||[]}catch(e){return []}})();
 const tur=ad=>{const k=denemeAdAnahtari(ad),s=sl.find(x=>denemeAdAnahtari(x.ad)===k);return s?(s.tur||SIRALAMA.addanTur(s.ad)):SIRALAMA.addanTur(ad)};
 const sinavlar=temel.sinavlar,kisa=TURKIYE.kisaAdlar(sinavlar);
 const exams=sinavlar.map((s,i)=>({ad:s.ad,kisa:kisa[i].replace(/[\s_-]*tarama[\s_-]*/giu,' ').trim()||kisa[i],date:s.g===null||s.g===undefined?null:iso(s.g),tur:tur(s.ad)}));
 const tOf=seri=>seri.map(p=>p&&Number.isFinite(p.t)?p.t:null),lastIdx=t=>{for(let i=t.length-1;i>=0;i--)if(t[i]!==null)return i;return -1};
 // The two latest Tarama exams in which this card has a T.
 const pairOf=ts=>{const ok=exams.map((e,i)=>e.tur==='tarama'&&ts.some(t=>t[i]!==null)?i:-1).filter(i=>i>=0);return ok.length>=2?{once:ok.at(-2),son:ok.at(-1)}:null};
 const card=(series,lessons)=>{
  const ts=series.map(s=>s.t).concat(lessons.map(d=>d.t)),pair=pairOf(ts);if(!series.length&&!lessons.length)return null;
  const at=t=>{const i=pair?pair.son:lastIdx(t);return i>=0?t[i]:null},dl=t=>pair&&t[pair.once]!==null&&t[pair.son]!==null?t[pair.son]-t[pair.once]:null;
  return {pair,pairText:pair?exams[pair.once].kisa+' → '+exams[pair.son].kisa+' (tarama → tarama)':null,
   series:series.map(s=>{const li=lastIdx(s.t),fi=s.t.findIndex(v=>v!==null),p=s.tseri[li];return {key:s.key,label:s.label,color:s.color,t:s.t,dil:s.dil,dilNow:s.dil[li],dilFirst:fi>=0?s.dil[fi]:null,dilLast:li>=0?s.dil[li]:null,tNow:s.t[li],first:fi,last:li,delta:li>fi?s.t[li]-s.t[fi]:null,n:p&&p.n!=null?p.n:null,tam:!!(p&&p.tam),sira:p&&p.sira!=null?{v:p.sira,yak:false}:p&&p.tahmin!=null?{v:p.tahmin,yak:true}:null}}),
   lessons:lessons.map(d=>({ad:d.ad,t:d.t,dil:d.dil,dilNow:(i=>i>=0?d.dil[i]:null)(pair?pair.son:lastIdx(d.t)),dilOnce:pair?d.dil[pair.once]:null,dilSon:pair?d.dil[pair.son]:null,tNow:at(d.t),delta:dl(d.t)}))};
 };
 const cards={};
 for(const oturum of ['TYT','AYT']){
  const series=[],lessons=[];let aytDone=false;
  for(const [key,label,o,color] of [['TYT','TYT toplam','TYT','#213d40'],['SAY','SAY toplam','AYT',C.blue],['EA','EA toplam','AYT','#78629f'],['SÖZ','SÖZ toplam','AYT',C.amber]]){
   if(o!==oturum)continue;
   const m=key==='TYT'?temel:al(liste,'AYT',key);if(m.oturum!==o)continue;
   if(m.toplam&&m.toplam.key===key){const t=tOf(m.toplam.tseri);if(lastIdx(t)>=0)series.push({key,label,color,t,tseri:m.toplam.tseri,dil:m.toplam.tseri.map(p=>TURKIYE.dilimNokta(p))})}
   if(!aytDone){aytDone=true;for(const d of m.dersler){const t=tOf(d.seri);if(lastIdx(t)>=0)lessons.push({ad:d.ad,t,dil:d.seri.map(p=>TURKIYE.dilimNokta(p))})}}
  }
  cards[oturum]=card(series,lessons);
 }
 if(!cards.TYT&&!cards.AYT)return {var:false,neden:temel.okul?'okul':'okulyok',liste,exams,okul:temel.okul||null};
 if(!(cards.TYT&&cards.TYT.series.length)&&!(cards.AYT&&cards.AYT.series.length))return {var:false,neden:temel.okul?'okul':'okulyok',liste,exams,okul:temel.okul||null};
 return {var:true,liste,listeAdi:LISTE_ADI[liste],secilen:secili,yedek:!!secili&&secili!==liste,okul:temel.okul,exams,cards};
}
// ---- Etüt etkisi: ETUT_ETKI's own model, once per ders of the grade and session (nothing is re-computed here) ----
// Only the pooled, school-level gain per etüt (γ) is read. The per-teacher estimates the model also returns are never used,
// and no student or teacher name is kept. {var:false, neden} when there is nothing to show: no etüt report ('etut'), no Türkiye
// list ('liste'), no two exams ('deneme'), no etüt between the exams ('etutyok'), an unexpected error ('hata').
// Else one block per session: rows {ders, n (students counted), uc (extreme results left out), b, ci, karar:{k,yazi}, ham, pts}.
// The model is slow (a bootstrap per ders), so a result is kept while its inputs stay the same: the grade's exams and etüts and the
// Türkiye averages the model reads. The key is built from those inputs, so a changed list or report gives a fresh result.
const EE_ONBELLEK=new Map(),eeHash=t=>{let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)+'.'+t.length};
function kurumEtutEtkisiAl(students,grade){
 const yok=neden=>({var:false,neden});
 if(typeof ETUT_ETKI==='undefined')return yok('hata');
 const list=students.filter(s=>gradeOf(s)===grade);
 if(!list.some(s=>s.sessions.length))return yok('etut');
 let trFn=null;try{const tv=typeof TURKIYE!=='undefined'?TURKIYE.oku().veri:null;if(tv)trFn=TURKIYE.ortalamalar(tv)}catch(e){trFn=null}
 if(!trFn)return yok('liste');
 const kodlar=Object.values(ETUT_ETKI.TR_KOD).flatMap(o=>Object.values(o).flat()),adlar=[...new Set(list.flatMap(s=>s.exams.map(e=>e.exam)))].sort();
 const imza=grade+'|'+eeHash(JSON.stringify([list.map(s=>[s.cls,s.exams.map(e=>[e.exam,e.date,e.session,e.nets]),s.sessions.map(x=>[x.date,x.course,x.teacher])]),adlar.map(a=>{const o=trFn(a);return o?kodlar.map(c=>o.genel(c)):null})]));
 if(EE_ONBELLEK.has(imza))return EE_ONBELLEK.get(imza);
 const sonuc=kurumEtutEtkisiHesapla(list,grade,trFn);
 EE_ONBELLEK.set(imza,sonuc);if(EE_ONBELLEK.size>40)EE_ONBELLEK.delete(EE_ONBELLEK.keys().next().value);
 return sonuc;
}
function kurumEtutEtkisiHesapla(list,grade,trFn){
 const yok=neden=>({var:false,neden});
 const oturumlar={};
 for(const oturum of ['TYT','AYT']){
  const m0=ETUT_ETKI.model(list,{duzey:grade,oturum,donem:'tum'},null,trFn);
  if(m0.durum==='etutyok'&&m0.duzey===grade&&m0.oturum===oturum){oturumlar[oturum]={neden:'etutyok',satirlar:[]};continue}
  if(m0.durum!=='tamam'||m0.duzey!==grade||m0.oturum!==oturum){oturumlar[oturum]={neden:'deneme',satirlar:[]};continue}
  const satirlar=m0.dersler.map(({ders})=>{
   const m=ders===m0.ders?m0:ETUT_ETKI.model(list,{duzey:grade,oturum,ders,donem:'tum'},null,trFn);
   // Without a Türkiye average for the ders the model falls back to raw nets (difficulty not taken out): that is no answer here.
   const ham=m.kip==='ham',o=!ham&&m.ozet?m.ozet:null,counted=m.ogrenciler.filter(x=>!x.aykiri);
   return {ders,oturum,ham,n:counted.length,uc:m.uc.filter(u=>u.tur!=='ozet').length,b:o?o.b:null,ci:o&&o.ci?o.ci:null,karar:ham?{k:'veri',yazi:'Yeterli veri yok.'}:m.karar,
    pts:o&&o.b!==null?counted.filter(x=>Number.isFinite(x.fark)).map(x=>({x:x.n,y:x.fark})):[]};
  });
  // A ders whose net no student has in these exams (its etüts belong to the other session) is not a row.
  oturumlar[oturum]=satirlar.some(r=>r.n)?{neden:null,satirlar:satirlar.filter(r=>r.n)}:{neden:'net',satirlar:[]};
 }
 const rows=['TYT','AYT'].flatMap(o=>oturumlar[o].satirlar);
 if(!rows.length)return yok(['TYT','AYT'].some(o=>oturumlar[o].neden==='etutyok')?'etutyok':['TYT','AYT'].some(o=>oturumlar[o].neden==='net')?'net':'deneme');
 if(rows.every(r=>r.ham))return yok('liste');
 // The ders with the most students gets the small scatter.
 let enCok=null;for(const r of rows)if(!r.ham&&r.b!==null&&r.pts.length>=3&&(!enCok||r.n>enCok.n))enCok=r;
 return {var:true,oturumlar,enCok};
}
function kurumEtutEtkisi(students,grade){
 const key='e'+grade;
 if(KT_ONBELLEK&&KT_ONBELLEK.has(key))return KT_ONBELLEK.get(key);
 let r;try{r=kurumEtutEtkisiAl(students,grade)}catch(e){r={var:false,neden:'hata'}}
 if(KT_ONBELLEK)KT_ONBELLEK.set(key,r);return r;
}
// What the report keeps of a scope: the school's own TYT averages (the fallback chart), the homework totals, the Türkiye geneli
// standing and the Etüt etkisi block. No etüt counts, no teachers, no attendance and no per-şube figures.
function kurumRapor(students,scope,turkiye=kurumTurkiye,etutEtki=kurumEtutEtkisi){
 const list=scope.grade?students.filter(s=>gradeOf(s)===scope.grade):students,denemeler=kurumDenemeler(list);
 const start=list.find(s=>s.sessionStart)?.sessionStart||null,end=list.find(s=>s.sessionEnd)?.sessionEnd||null;
 // Ödev: the homework report's statuses summed; the completion rate is Tamamladı / all given homework.
 const hw=list.flatMap(s=>s.homework),totals=hw.reduce((a,h)=>a.map((v,i)=>v+h.values[i]),[0,0,0,0,0,0,0]),hc=new Map();
 for(const h of hw){const k=homeworkCourseName(h.course),o=hc.get(k)||{course:dersAdi(k),values:[0,0,0,0,0,0,0]};o.values=o.values.map((v,i)=>v+h.values[i]);hc.set(k,o)}
 const odev={total:totals[0],statuses:totals.slice(1),rate:totals[0]?100*totals[1]/totals[0]:null,students:list.filter(s=>s.homework.length).length,date:hw.map(h=>h.reportDate).filter(Boolean).sort().at(-1)||null,
  courses:[...hc.values()].sort((a,b)=>b.values[0]-a.values[0]||a.course.localeCompare(b.course,'tr')).map(o=>({...o,rate:o.values[0]?100*o.values[1]/o.values[0]:null}))};
 const grades=[...new Set(list.map(gradeOf).filter(Boolean))].sort((a,b)=>b-a),perGrade=g=>({grade:g,count:list.filter(s=>gradeOf(s)===g).length});
 const tur=scope.grade?turkiye(scope.grade):{grades:grades.map(perGrade).map(({grade,count})=>{const d=kurumDenemeler(list.filter(s=>gradeOf(s)===grade));return {grade,count,block:turkiye(grade),avgNet:d.at(-1)?{ad:d.at(-1).ad,avg:d.at(-1).avg}:null}})};
 const ee=scope.grade?{grade:scope.grade,sonuc:etutEtki(students,scope.grade)}:{grades:grades.map(perGrade).map(({grade,count})=>({grade,count,sonuc:etutEtki(students,grade)}))};
 return {scope,school:list.find(s=>s.school)?.school||'',count:list.length,subeCount:new Set(list.map(s=>s.cls||'Şube belirtilmemiş')).size,
  sources:{etut:start?{start,end}:null,odev:odev.date,deneme:denemeler.length?{start:denemeler[0].date,end:denemeler.at(-1).date}:null},
  odev,denemeler,turkiye:tur,etutEtki:ee};
}

// The one-page A4 landscape Kurum raporu (same canvas, palette and raster pipeline as the student report).
const KURUM_MESAJ={
 etut:'Etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.',
 odev:'Ödev kaydı yok. Öğrenci raporları sayfasında “Ödev raporu ekle” ile Öğrenci Ev Ödev Durum Raporu ekleyin.',
 deneme:'Deneme sonucu yok. Sıralamalar sayfasından deneme listesi ekleyin.',
 liste:'Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.',
 eeListe:'Etüt etkisi için Türkiye geneli listesi gerekir; Türkiye geneli sayfasından ekleyin.',
 eeDeneme:'Etüt etkisi için aynı oturumda en az iki deneme gerekir. Sıralamalar sayfasından deneme listesi ekleyin.',
 eeNet:'Etüt alan derslerin bu oturumdaki deneme neti yok. Sıralamalar sayfasından deneme listesi ekleyin.',
 eeEtutyok:'Denemeler arasına düşen etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.',
 eeHata:'Etüt etkisi hesaplanamadı; Etüt etkisi sayfasını kontrol edin.',
 okul:'Okulunuz bu listelerde bulunamadı; Türkiye geneli sayfasında okulu seçin.',
 okulyok:'Okulunuz bu listelerde bulunamadı; Türkiye geneli sayfasında okulu seçin.',
 hata:'Türkiye geneli verisi okunamadı; Türkiye geneli sayfasını kontrol edin.'
};
// Change colours: green rise, red fall, grey within ±0,5 T of ΔT (the Türkiye geneli page's rule; the words say it in dilim). Text colours keep contrast on the tint.
const DT_ESIK=.5,DT_STIL={1:['#dcf1ea','#0b6a5d','▲ '],'-1':['#f6e0d9','#9a3f2c','▼ '],0:['#e9ecea','#586e70','']};
const f1=n=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const isaret=(v,f=f1)=>(v>0?'+':v<0?'−':'')+f(Math.abs(v));
const yuzde=v=>v===null||v===undefined?'—':'%'+fmt(Math.round(v*10)/10);
function boyaci(out){
 const esc_=esc;
 const text=(x,y,t,size=12,color=C.ink,bold=false,anchor='start',center=false)=>out.push('<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="'+color+'" font-weight="'+(bold?700:400)+'" text-anchor="'+anchor+'"'+(center?' dominant-baseline="central"':'')+'>'+esc_(t)+'</text>');
 const measure=typeof document!=='undefined'?document.createElement('canvas').getContext?.('2d'):null;
 const width=(label,size,bold=false)=>{if(measure){measure.font=(bold?'bold ':'')+size+'px Arial';return measure.measureText(label).width}return [...String(label)].length*size*(bold?.62:.56)};
 const fit=(value,maxWidth,size,bold=false)=>{const label=String(value);if(width(label,size,bold)<=maxWidth)return label;const chars=[...label];let lo=0,hi=chars.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(width(chars.slice(0,mid).join('')+'…',size,bold)<=maxWidth)lo=mid;else hi=mid-1}return chars.slice(0,lo).join('').trimEnd()+'…'};
 const wrap=(value,maxWidth,size)=>{const lines=[];let line='';for(const word of String(value).trim().split(/\s+/)){const next=line?line+' '+word:word;if(width(next,size)<=maxWidth){line=next;continue}if(line)lines.push(line);line=word}if(line)lines.push(line);return lines.length?lines:['']};
 const rect=(x,y,w,h,fill='#fff',r=12,extra='')=>out.push('<rect x="'+x+'" y="'+y+'" width="'+Math.max(0,w)+'" height="'+Math.max(0,h)+'" rx="'+Math.min(r,h/2,w/2)+'" fill="'+fill+'"'+extra+'/>');
 const line=(x1,y1,x2,y2,color=C.gray,w=1,dash='')=>out.push('<path d="M'+x1+','+y1+' L'+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>');
 const dot=(x,y,r,color)=>out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="'+color+'" stroke-width="1.7"/>');
 const ring=(x,y,r,percent,color=C.green,stroke=13)=>{out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.gray+'" stroke-width="'+stroke+'"/>');if(percent!==null&&percent!==undefined){const c=2*Math.PI*r;out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-dasharray="'+c*Math.max(0,Math.min(100,percent))/100+' '+c+'" transform="rotate(-90 '+x+' '+y+')"/>')}};
 // ΔT pill: arrow and sign carry the meaning as well as the colour. v is the raw change; |v| ≤ 0,5 reads as unchanged (grey).
 // label: the words in the pill ("ilk %31 → ilk %12"); the colour and the arrow still come from the raw change v.
 const pill=(x,y,w,h,v,size=10,suffix=' T',label=null)=>{const k=Math.abs(v)<=DT_ESIK?0:v>0?1:-1,[bg,fg,ok]=DT_STIL[k];rect(x,y,w,h,bg,h/2);text(x+w/2,y+h/2+.5,ok+(label!==null?label:isaret(v)+suffix),size,fg,true,'middle',true)};
 const none=(x,y,w,h,size=10)=>{rect(x,y,w,h,'#eef0ee',h/2);text(x+w/2,y+h/2+.5,'—',size,C.muted,false,'middle',true)};
 const card=(x,y,w,h,title,right,rightColor=C.green)=>{rect(x,y,w,h);text(x+18,y+26,title,17,C.ink,true);if(right)text(x+w-18,y+26,right,15,rightColor,true,'end')};
 const message=(x,y,w,h,t,size=12.5)=>{const lines=wrap(t,w-36,size),top=y+h/2-(lines.length-1)*size*.8;lines.forEach((l,i)=>text(x+w/2,top+i*size*1.6,l,size,C.muted,false,'middle',true))};
// A name is never cut: the font shrinks (down to 7 px) until it fits; only then it is clipped with an ellipsis.
 const shrink=(t,maxW,size,bold=false)=>{let f=size;while(f>7&&width(t,f,bold)>maxW)f-=.5;return {t:width(t,f,bold)>maxW?fit(t,maxW,f,bold):String(t),f}};
 const ftext=(x,y,t,maxW,size,color=C.ink,bold=false,anchor='start',center=false)=>{const r=shrink(t,maxW,size,bold);text(x,y,r.t,r.f,color,bold,anchor,center)};
 return {text,ftext,width,fit,wrap,rect,line,dot,ring,pill,none,card,message};
}
// A line chart in a box. series: values (null = no result in that exam). A missing exam between two points is bridged: one
// continuous line from the previous point to the next, dots only where there is a value. ref: a dashed reference line.
// axis: value grid, y labels and the three x label lines (date, exam, kind); bands: exam indices lightly shaded (the compared pair).
// ticks: [[value, label]] replaces the even grid; a series' labels / titles (one text per exam) replace the plain numbers (dilim texts).
function kurumGrafik(P,{x,y,w,h,xs,series,lo,hi,ref,tick,unit,axis=true,bands=[],endLabels=true,dotR=3.2,lw=2.3,pad=14,labelAll=false,ticks=null}){
 const {text,line,dot,rect}=P,out=P.out,n=xs.length,yy=v=>y+h-(v-lo)/(hi-lo)*h,xx=i=>n>1?x+pad+(w-2*pad)*i/(n-1):x+w/2,step=n>1?(w-2*pad)/(n-1):w;
 for(const i of bands)rect(xx(i)-step/2,y-6,step,h+12,'#e1efe9',4);
 if(axis)for(const [v,l] of ticks||Array.from({length:Math.floor((hi-lo)/tick+1e-9)+1},(_,j)=>{const v=lo+j*tick;return [v,fmt(v)]})){line(x,yy(v),x+w,yy(v),'#e5ebe7',.8);text(x-6,yy(v)+3,l,10,C.muted,false,'end')}
 if(ref!==null&&ref!==undefined){line(x,yy(ref.value),x+w,yy(ref.value),'#7d9390',1.2,'5 4');if(ref.label)text(x+4,yy(ref.value)+13,ref.label,10,C.muted,false,'start')}
 if(axis){const every=Math.max(1,Math.ceil(n/Math.max(1,Math.floor((w-2*pad)/46))));
  xs.forEach((e,i)=>{if((n-1-i)%every)return;const a=i===0&&n>1?'start':i===n-1&&n>1?'end':'middle',tx=a==='start'?xx(i)-pad:a==='end'?xx(i)+pad:xx(i);
   if(e.top)text(tx,y+h+15,e.top,10,C.muted,false,a);text(tx,y+h+27,e.bottom,10,C.muted,false,a);if(e.kind)text(tx,y+h+39,e.kind,10,e.kind==='Tarama'?C.ink:C.muted,e.kind==='Tarama',a)})}
 const ends=[];
 for(const s of series){
  const idx=s.values.map((v,i)=>v===null||v===undefined?-1:i).filter(i=>i>=0);
  if(idx.length>1)out.push('<polyline data-seri="'+esc(s.label)+'" points="'+idx.map(i=>xx(i)+','+yy(s.values[i])).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+lw+'" stroke-linejoin="round"/>');
  idx.forEach(i=>{out.push('<g><title>'+esc(s.label+' · '+xs[i].bottom+(xs[i].top?' · '+xs[i].top:'')+' · '+(s.titles?s.titles[i]:fmt(Math.round(s.values[i]*10)/10)+' '+unit))+'</title>');dot(xx(i),yy(s.values[i]),dotR,s.color);out.push('</g>')});
  if(idx.length&&endLabels)ends.push({i:idx.at(-1),y:yy(s.values[idx.at(-1)]),v:s.labels?s.labels[idx.at(-1)]:fmt(Math.round(s.values[idx.at(-1)]*10)/10),color:s.color});
  if(labelAll)idx.slice(0,-1).forEach(i=>text(xx(i),yy(s.values[i])-8,s.labels?s.labels[i]:fmt(Math.round(s.values[i]*10)/10),10,s.color,true,'middle'));
 }
 ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<12)ends[i].y=ends[i-1].y+12;
 ends.forEach(e=>text(xx(e.i)+8,e.y+3.5,e.v,11,e.color,true));
}
const KURUM_UST=100,KURUM_ALT=812,KURUM_ARA=14;
// "≈ 183 okul içinde 23.": "≈" before the number of schools when it is estimated, and before the place when the place is.
const siraYazisi=s=>s.sira?(s.n?(s.tam?'':'≈ ')+fmt(s.n)+' okul içinde ':'')+(s.sira.yak?'≈ ':'')+fmt(s.sira.v)+'.':'—';
const dilimTikleri=(lo,hi)=>TURKIYE.DILIM_TIKLARI.filter(d=>d>=1&&d<=95||d===.1&&TURKIYE.dilimdenT(d)<=hi).map(d=>[TURKIYE.dilimdenT(d),'ilk %'+(d===.1?'0,1':d)]);
// The Türkiye dilimi chart is on the T (z) scale, symmetric around ilk %50; only its labels are dilim values.
const dilimAraligi=vals=>{const yarim=Math.max(TURKIYE.dilimdenT(1)-50,...vals.map(v=>Math.abs(v-50)+2));return {lo:50-yarim,hi:50+yarim}};
const dilimEtiketleri=(t,dil)=>({labels:dil.map(d=>TURKIYE.dilimKisa(d)),titles:dil.map((d,i)=>d===null||t[i]===null?'—':TURKIYE.dilimYazi(d)+' (T '+f1(t[i])+')')});
// The Kurum raporu is as many A4 landscape pages as its content needs: the Türkiye geneli block first, then Etüt etkisi and Ödevler.
// It names no student, no teacher and no şube, and has no etüt counts, attendance or comparison between şubes. Returns one SVG string per page.
function svgKurum(k,reportDate){
 const sc=k.scope,sections=[],tp=k.turkiye,W2=1138;
 const aralik=r=>r?display(r.start)+' – '+display(r.end):'yok',src=k.sources;
 const exTxt=e=>({top:e.date?display(e.date).slice(0,5):'',bottom:e.kisa,kind:e.tur==='tarama'?'Tarama':'Genel'});
 /* ---- Türkiye geneli ---- */
 const netGrafik=(P,x,y,w,h)=>{const d=k.denemeler;if(!d.length){P.message(x,y,w,h,KURUM_MESAJ.deneme);return}
  const hi=Math.max(10,Math.ceil(Math.max(...d.map(e=>e.avg))/10)*10),xs=d.map(e=>({top:display(e.date).slice(0,5),bottom:e.ad.replace(/^27-/,'').slice(0,18)}));
  kurumGrafik(P,{x,y,w,h,xs,series:[{label:'Okul ortalaması',color:'#213d40',values:d.map(e=>Math.round(e.avg*100)/100)}],lo:0,hi,tick:hi/2,unit:'net',labelAll:true})};
 const neden=b=>KURUM_MESAJ[b.neden]||KURUM_MESAJ.liste;
 // A change pill sized to its words and right-aligned at rx: colour and arrow from ΔT, the words are the dilim change.
 const degisim=(P,rx,y,h,delta,size,label)=>{
  if(delta===null||label===null){P.none(rx-34,y,34,h,size);return rx-34}
  const w=Math.ceil(P.width('▲ '+label,size,true))+14;P.pill(rx-w,y,w,h,delta,size,'',label);return rx-w;
 };
 // The ders boxes start under the total tiles (three tiles for AYT).
 const dersUst=card=>Math.max(256,62+Math.max(0,(card?card.series.length:0)-1)*72+68+18);
 // One card (TYT or AYT): the total dilim chart with the dashed ilk %50 line, a tile per total, and a small dilim chart per ders beneath.
 const tCard=(P,x,y,w,h,title,card,oturum,b)=>{
  P.rect(x,y,w,h);P.text(x+18,y+26,title,17,C.ink,true);
  if(!card||!card.series.length&&!card.lessons.length){P.message(x,y+30,w,h-30,oturum==='AYT'?'AYT için Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.':KURUM_MESAJ.liste);return}
  const s0=card.series[0],TW=240,TX=x+w-TW-14;
  P.text(x+18,y+44,'Türkiye yüzdelik dilimi (küçük = daha iyi)',11,C.muted);
  if(s0)P.ftext(TX,y+56,'Değişim: ilk → son deneme ('+b.exams[s0.first].kisa+' → '+b.exams[s0.last].kisa+')',TW,10,C.muted);
  const all=card.series.flatMap(s=>s.t.filter(v=>v!==null)).concat(card.lessons.flatMap(d=>d.t.filter(v=>v!==null))),lo=Math.floor((Math.min(40,...all)-2)/10)*10,hi=Math.ceil((Math.max(60,...all)+2)/10)*10;
  const xs=b.exams.map(exTxt),cw=w-44-TW-28;
  if(card.series.length){
   const ar=dilimAraligi(card.series.flatMap(s=>s.t.filter(v=>v!==null)));
   P.out.push('<g aria-label="'+esc(oturum+' dilim grafiği')+'">');
   kurumGrafik(P,{x:x+44,y:y+62,w:cw,h:130,pad:30,xs,series:card.series.map(s=>({label:s.label,color:s.color,values:s.t,...dilimEtiketleri(s.t,s.dil)})),lo:ar.lo,hi:ar.hi,tick:10,ticks:dilimTikleri(ar.lo,ar.hi),ref:{value:50,label:'Türkiye’nin ortasındaki okul'},unit:'T',bands:card.pair?[card.pair.once,card.pair.son]:[],labelAll:oturum==='TYT'&&xs.length<=7});
   P.out.push('</g>');if(card.pair)P.text(x+48,y+58,'Ders karşılaştırması: '+b.exams[card.pair.once].kisa+' → '+b.exams[card.pair.son].kisa+' (tarama)',10,C.ink,true);
   card.series.forEach((s,i)=>{const tx=TX,ty=y+62+i*72,rx=tx+TW-12;
    P.out.push('<g aria-label="'+esc(s.label+' · '+TURKIYE.dilimYazi(s.dilNow)+' · '+TURKIYE.dilimBandi(s.dilNow))+'"><title>'+esc(s.label+' · ilk → son deneme: '+b.exams[s.first].ad+' → '+b.exams[s.last].ad+(s.tNow===null?'':' · T '+f1(s.tNow)))+'</title>');
    P.rect(tx,ty,TW,68,'#f3f5f2',8);P.rect(tx,ty+9,4,50,s.color,2);P.text(tx+14,ty+17,s.label,11.5,C.ink,true);P.text(rx,ty+19,TURKIYE.dilimYazi(s.dilNow),18,C.ink,true,'end');
    P.ftext(tx+14,ty+32,TURKIYE.dilimBandi(s.dilNow),TW-28,9.5,C.ink);P.ftext(tx+14,ty+45,siraYazisi(s),TW-28,9.5,C.muted);
    {const lab=s.delta===null||s.dilFirst==null||s.dilLast==null?null:TURKIYE.dilimGecis(s.dilFirst,s.dilLast);degisim(P,tx+14+(lab===null?34:Math.ceil(P.width('▲ '+lab,9.5,true))+14),ty+50,14,s.delta,9.5,lab)}
    P.out.push('</g>');
   });
  }else P.message(x,y+50,w,100,'Bu oturum için toplam dilimi yok.');
  // Ders ders: one small dilim chart per ders under the total chart, with its latest dilim and its change.
  const L=card.lessons;if(!L.length)return;
  const ty0=y+dersUst(card);P.text(x+18,ty0,oturum+' dersleri · Türkiye dilimi',13,C.ink,true);P.text(x+32+P.width(oturum+' dersleri · Türkiye dilimi',13,true),ty0,card.pair?'  Değişim: '+card.pairText:'  İki tarama denemesi yok (değişim gösterilmez)',11,card.pair?C.ink:C.muted);
  const cols=Math.max(5,Math.ceil(L.length/2)),g=6,bw=(w-28-(cols-1)*g)/cols,bh=100;
  L.forEach((d,i)=>{const bx=x+14+(i%cols)*(bw+g),by=ty0+10+Math.floor(i/cols)*(bh+8);
   P.out.push('<g aria-label="'+esc(oturum+' ders · '+d.ad+' · '+TURKIYE.dilimYazi(d.dilNow))+'"><title>'+esc(d.ad+' · '+TURKIYE.dilimYazi(d.dilNow)+(d.tNow===null?'':' (T '+f1(d.tNow)+')')+(d.delta===null?'':' · ΔT '+isaret(d.delta)))+'</title>');
   P.rect(bx,by,bw,bh,'#f6f8f6',8);P.ftext(bx+8,by+17,d.ad,bw-14,11.5,C.ink,true);P.text(bx+8,by+38,TURKIYE.dilimYazi(d.dilNow),14,C.ink,true);
   degisim(P,bx+bw-8,by+44,14,d.delta,8.5,d.delta===null||d.dilOnce==null||d.dilSon==null?null:TURKIYE.dilimKisa(d.dilOnce)+' → '+TURKIYE.dilimKisa(d.dilSon));
   kurumGrafik(P,{x:bx+8,y:by+64,w:bw-16,h:28,xs:b.exams.map(()=>({})),series:[{label:d.ad,color:'#213d40',values:d.t}],lo,hi,ref:{value:50},tick:10,unit:'T',axis:false,endLabels:false,dotR:2,lw:1.6,pad:3});
   P.out.push('</g>')});
 };
 const tCardH=card=>{const n=card?card.lessons.length:0,cols=Math.max(5,Math.ceil(n/2));return n?dersUst(card)+10+Math.ceil(n/cols)*108+4:290};
 if(sc.key==='okul'){
  const rows=tp.grades;
  sections.push({name:'Türkiye geneli',h:112+Math.max(1,rows.length)*38+34,draw:(P,y)=>{
   const h=112+Math.max(1,rows.length)*38+34;P.card(26,y,W2,h,'Türkiye geneli · sınıf düzeylerine göre');
   P.text(44,y+46,'Okulun Türkiye’deki yeri: ilk %12 = Türkiye’deki okulların en iyi %12’sinde (küçük sayı daha iyi). Değişim = ilk denemeden son denemeye.',11.5,C.muted);
   const cols=[44,150,230,420,610,770,950],heads=['Sınıf düzeyi','Öğrenci','Karşılaştırma (ilk → son)','TYT dilimi','Değişim','Sıra','Dilim gelişimi'];
   heads.forEach((t,i)=>P.text(cols[i],y+72,t,11,C.muted,true));P.line(44,y+80,1146,y+80);
   rows.forEach(({grade,count,block,avgNet},i)=>{const ry=y+84+i*38,cy=ry+19,card=block.var?block.cards.TYT:null,tyt=card&&card.series.find(s=>s.key==='TYT');
    P.out.push('<g aria-label="'+esc(grade+'. sınıf Türkiye geneli')+'">');P.text(cols[0],block.var?cy-6:cy,grade+'. sınıf',14,C.ink,true,'start',true);if(block.var)P.text(cols[0],cy+10,block.listeAdi+' listesi',9.5,C.muted,false,'start',true);P.text(cols[1],cy,count,13,C.ink,false,'start',true);
    if(!tyt){P.text(cols[2],cy,block.var?'TYT toplam dilimi yok':neden(block),12,C.muted,false,'start',true);if(avgNet)P.text(1146,cy,'Okul ort. TYT neti: '+fmt(Math.round(avgNet.avg*10)/10),12,C.ink,false,'end',true)}
    else{P.ftext(cols[2],cy,tyt.delta===null?'Tek deneme':block.exams[tyt.first].kisa+' → '+block.exams[tyt.last].kisa,180,12,tyt.delta===null?C.muted:C.ink,false,'start',true);
     P.text(cols[3],cy-5,TURKIYE.dilimYazi(tyt.dilNow),16,C.ink,true,'start',true);P.ftext(cols[3],cy+11,TURKIYE.dilimBandi(tyt.dilNow),180,9.5,C.muted,false,'start',true);
     {const lab=tyt.delta===null||tyt.dilFirst==null||tyt.dilLast==null?null:TURKIYE.dilimGecis(tyt.dilFirst,tyt.dilLast);degisim(P,cols[4]+(lab===null?34:Math.ceil(P.width('▲ '+lab,11,true))+14),cy-10,20,tyt.delta,11,lab)}
     P.ftext(cols[5],cy,siraYazisi(tyt),170,12,C.ink,true,'start',true);
     const sx=cols[6],sw=1146-sx-6,sh=24,vals=tyt.t,ok_=vals.filter(v=>v!==null),lo=Math.min(40,...ok_)-1,hi=Math.max(60,...ok_)+1;
     kurumGrafik(P,{x:sx,y:cy-sh/2,w:sw,h:sh,xs:vals.map(()=>({})),series:[{label:'TYT toplam',color:'#213d40',values:vals}],lo,hi,ref:{value:50},tick:10,unit:'T',axis:false,endLabels:false,dotR:2.6,lw:2,pad:8})}
    P.out.push('</g>');if(i<rows.length-1)P.line(44,ry+38,1146,ry+38,'#eef1ee',1)});
   if(!rows.length)P.message(26,y+40,W2,h-40,'Sınıf düzeyi belirlenemedi.');
   P.text(44,y+h-12,'Kesik çizgi (sağdaki grafikte): Türkiye’nin ortasındaki okul (%50) · ▲ yeşil: üst dilime çıktı (iyileşti) · ▼ kırmızı: alt dilime düştü · gri: değişmedi',10.5,C.muted)}});
 }else if(!tp.var){
  sections.push({name:'Türkiye geneli',h:262,draw:(P,y)=>{P.card(26,y,W2,262,'Türkiye geneli · yüzdelik dilim');P.text(44,y+46,'Okulun kendi TYT ortalaması (net), deneme deneme',11.5,C.muted);
   netGrafik(P,70,y+74,600,110);P.rect(720,y+60,408,150,'#f3f5f2',10);P.message(720,y+60,408,150,neden(tp),13)}});
 }else{
  const ne=tp.yedek?14:0,hh=Math.max(tCardH(tp.cards.TYT),tCardH(tp.cards.AYT))+48+ne;
  sections.push({name:'Türkiye geneli',h:hh,breakAfter:true,draw:(P,y)=>{const ch=hh-48-ne;
   tCard(P,26,y,558,ch,'TYT toplam · Türkiye dilimi',tp.cards.TYT,'TYT',tp);tCard(P,600,y,564,ch,'AYT toplam · Türkiye dilimi',tp.cards.AYT,'AYT',tp);
   P.rect(26,y+ch+8,W2,40+ne,'#fff',8);
   P.text(40,y+ch+25,tp.listeAdi+' listesi · ilk %12 = Türkiye’deki okulların en iyi %12’sinde (küçük sayı daha iyi) · kesik çizgi: Türkiye’nin ortasındaki okul (%50) · kutularda değişim: ilk → son deneme; ders kutularında: tarama → tarama (açık yeşil sütun)',10.5,C.muted);
   P.text(40,y+ch+41,'▲ yeşil: üst dilime çıktı (iyileşti) · ▼ kırmızı: alt dilime düştü · gri: değişmedi (çok küçük değişim). Ders kutularında “ilk” yazılmaz: %12 = ilk %12.',10.5,C.muted);
   if(ne)P.text(40,y+ch+57,'Seçtiğiniz '+LISTE_ADI[tp.secilen]+' listesinde bu sınıf düzeyi yok; '+tp.listeAdi+' listesi gösterilir.',10.5,C.ink,true)}});
 }
 /* ---- Etüt etkisi (ETUT_ETKI's pooled gain per etüt: no etüt counts, no teachers) ---- */
 const M=boyaci([]),ee=k.etutEtki,COLW=538,GAP=26,X0=[44,44+COLW+GAP],RH=22;
 const EE_BAS='Her etüt için artış: aynı başlangıç düzeyindeki öğrencilere göre, etüt sayısı arttıkça Türkiye farkındaki ek artış (net). Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.';
 const EE_ACIK='Olası aralık: değerin büyük olasılıkla içinde kaldığı bölge. Artış belirgin: aralığın tamamı 0’ın üstünde · Belirgin fark yok: aralık 0’ı içeriyor · Etüt alanlarda daha az: aralığın tamamı 0’ın altında · Yeterli veri yok: öğrenci ya da etüt çeşidi az. Uç sonuç: diğerlerinden çok farklı olduğu için hesaba katılmayan sonuç.';
 const EE_KARAR={var:['artış belirgin','#dcf1ea','#0b6a5d'],yok:['belirgin fark yok','#e9ecea','#586e70'],az:['etüt alanlarda daha az','#f6e0d9','#9a3f2c'],veri:['yeterli veri yok','#eef0ee',C.muted]};
 const eeSayi=v=>{const a=Math.round(Math.abs(v)*10)/10;return (v>0&&a>0?'+':v<0&&a>0?'−':'')+f1(a)};
 const eeAralik=r=>r.ci?'('+eeSayi(r.ci[0])+' ile '+eeSayi(r.ci[1])+')':'';
 const eeGoster=r=>r.b!==null&&r.karar.k!=='veri';
 const eeMesaj=neden=>KURUM_MESAJ[{etut:'etut',liste:'eeListe',deneme:'eeDeneme',net:'eeNet',etutyok:'eeEtutyok'}[neden]||'eeHata'];
 const baslikSatirlari=M.wrap(EE_BAS,W2-36,11.5),aciklama=M.wrap(EE_ACIK,W2-36,10),eeUst=46+baslikSatirlari.length*15+8;
 const eeBaslik=(P,y)=>baslikSatirlari.forEach((l,i)=>P.text(44,y+46+i*15,l,11.5,C.muted));
 const eeKarar=(P,x,cy,r,size=10.5)=>{const [t,bg,fg]=EE_KARAR[r.karar.k],w=Math.ceil(P.width(t,size,true))+14;P.rect(x,cy-8,w,16,bg,8);P.text(x+7,cy+.5,t,size,fg,true,'start',true)};
 const eeBaslikTitle=r=>r.ders+' ('+r.oturum+') · '+(eeGoster(r)?'her etüt ≈ '+eeSayi(r.b)+' net '+eeAralik(r)+' · ':'')+EE_KARAR[r.karar.k][0]+' · '+r.n+' öğrenci'+(r.uc?' · '+r.uc+' uç sonuç hesaba katılmadı':'');
 // One school-level scatter: x = etüts taken, y = the change beyond the start level and the school's trend (net); the fitted line has the slope γ.
 const eeNokta=(P,x,y,w,h,r)=>{
  const pts=r.pts,xmax=Math.max(1,...pts.map(p=>p.x)),ys=pts.map(p=>p.y).concat([0,r.b*xmax]);let lo=Math.min(...ys),hi=Math.max(...ys);const pay=Math.max(.5,(hi-lo)*.1);lo-=pay;hi+=pay;
  const adim=[.5,1,2,5,10,20,50,100].find(a=>(hi-lo)/a<=4)||200,px=v=>x+(v+.5)/(xmax+1)*w,py=v=>y+h-(v-lo)/(hi-lo)*h,ticks=[];
  for(let v=Math.ceil(lo/adim)*adim;v<=hi+1e-9;v+=adim)ticks.push(Math.round(v*100)/100);
  P.out.push('<g aria-label="'+esc('Etüt sayısı ve ek artış grafiği · '+r.ders+' ('+r.oturum+')')+'">');
  ticks.forEach(v=>{P.line(x,py(v),x+w,py(v),v===0?'#9fb0ac':'#e5ebe7',v===0?1.2:.8);P.text(x-6,py(v)+3,v===0?'0':(v<0?'−':'')+fmt(Math.abs(v)),10,C.muted,false,'end')});
  const every=Math.max(1,Math.ceil((xmax+1)/12));for(let v=0;v<=xmax;v+=every)P.text(px(v),y+h+14,v,10,C.muted,false,'middle');
  pts.forEach((p,i)=>P.dot(px(p.x+((i*37)%7-3)*.05),py(p.y),3.2,C.blue));
  P.line(px(0),py(0),px(xmax),py(r.b*xmax),C.green,2.4);
  P.out.push('</g>');
 };
 const eeSinif=()=>{
  const s=ee.sonuc;
  if(!s.var)return {name:'Etüt etkisi',h:140,draw:(P,y)=>{P.card(26,y,W2,140,'Etüt etkisi');P.message(26,y+30,W2,110,eeMesaj(s.neden))}};
  const OT=['TYT','AYT'],n=Math.max(2,...OT.map(o=>s.oturumlar[o].satirlar.length)),r0=eeUst+28,h=r0+n*RH+10+aciklama.length*13+14;
  return {name:'Etüt etkisi',h,draw:(P,y)=>{
   P.card(26,y,W2,h,'Etüt etkisi');eeBaslik(P,y);
   OT.forEach((o,c)=>{const x=X0[c],b=s.oturumlar[o],hy=y+eeUst;
    P.text(x,hy+14,o,13,C.ink,true);P.text(x+96,hy+3,'Her etüt için artış',10,C.muted,true);P.text(x+96,hy+15,'(olası aralık)',10,C.muted);
    P.text(x+252,hy+14,'Karar',10,C.muted,true);P.text(x+436,hy+14,'Öğrenci',10,C.muted,true,'end');P.text(x+COLW,hy+3,'Hesaba',10,C.muted,true,'end');P.text(x+COLW,hy+15,'katılmadı',10,C.muted,true,'end');
    P.line(x,hy+22,x+COLW,hy+22);
    if(!b.satirlar.length){P.message(x,y+r0,COLW,n*RH,eeMesaj(b.neden),11);return}
    b.satirlar.forEach((r,i)=>{const cy=y+r0+i*RH+RH/2;
     P.out.push('<g aria-label="'+esc(eeBaslikTitle(r))+'"><title>'+esc(eeBaslikTitle(r))+'</title>');
     if(i%2)P.rect(x-6,cy-RH/2,COLW+12,RH,'#f6f8f6',4);
     P.ftext(x,cy,r.ders,90,11.5,C.ink,true,'start',true);
     if(eeGoster(r)){const t='≈ '+eeSayi(r.b)+' net';P.text(x+96,cy,t,12,C.ink,true,'start',true);P.text(x+96+P.width(t,12,true)+6,cy,eeAralik(r),10,C.muted,false,'start',true)}else P.text(x+96,cy,'—',12,C.muted,false,'start',true);
     eeKarar(P,x+252,cy,r);P.text(x+436,cy,r.n,12,C.ink,false,'end',true);
     if(r.uc)P.text(x+COLW,cy,r.uc+' uç sonuç',10.5,C.muted,false,'end',true);else P.text(x+COLW,cy,'—',11,C.muted,false,'end',true);
     P.out.push('</g>')});
   });
   aciklama.forEach((l,i)=>P.text(44,y+r0+n*RH+22+i*13,l,10,C.muted));
  }};
 };
 // Whole school: one compact table per session, ders × grade; each cell has the gain per etüt and the verdict phrase.
 const eeOkul=()=>{
  const gr=ee.grades.filter(g=>g.sonuc.var),yok_=ee.grades.filter(g=>!g.sonuc.var);
  if(!gr.length)return {name:'Etüt etkisi',h:140,draw:(P,y)=>{P.card(26,y,W2,140,'Etüt etkisi');P.message(26,y+30,W2,110,eeMesaj(ee.grades[0]?ee.grades[0].sonuc.neden:'etut'))}};
  const OT=['TYT','AYT'],RH2=32,satir=o=>{const m=new Map();for(const g of gr)for(const r of g.sonuc.oturumlar[o].satirlar){const e=m.get(r.ders)||{ders:r.ders,n:0};e.n+=r.n;m.set(r.ders,e)}return [...m.values()].sort((a,b)=>b.n-a.n||a.ders.localeCompare(b.ders,'tr'))};
  const rows={TYT:satir('TYT'),AYT:satir('AYT')},n=Math.max(2,rows.TYT.length,rows.AYT.length),notlar=yok_.flatMap(g=>M.wrap(g.grade+'. sınıf: '+eeMesaj(g.sonuc.neden),W2-36,10)),r0=eeUst+28;
  const h=r0+n*RH2+10+aciklama.length*13+notlar.length*13+14,cw=(COLW-100)/gr.length;
  return {name:'Etüt etkisi',h,draw:(P,y)=>{
   P.card(26,y,W2,h,'Etüt etkisi');eeBaslik(P,y);
   OT.forEach((o,c)=>{const x=X0[c],hy=y+eeUst;
    P.text(x,hy+14,o,13,C.ink,true);P.text(x+100,hy+3,'Her etüt için artış (net) ve karar',10,C.muted,true);
    gr.forEach((g,j)=>P.text(x+100+(j+.5)*cw,hy+15,g.grade+'. sınıf',10.5,C.ink,true,'middle'));P.line(x,hy+22,x+COLW,hy+22);
    if(!rows[o].length){P.message(x,y+r0,COLW,n*RH2,eeMesaj(gr[0].sonuc.oturumlar[o].neden),11);return}
    rows[o].forEach((d,i)=>{const cy=y+r0+i*RH2+RH2/2;
     if(i%2)P.rect(x-6,cy-RH2/2,COLW+12,RH2,'#f6f8f6',4);
     P.ftext(x,cy,d.ders,92,11.5,C.ink,true,'start',true);
     gr.forEach((g,j)=>{const r=g.sonuc.oturumlar[o].satirlar.find(q=>q.ders===d.ders),mx=x+100+(j+.5)*cw;
      if(!r){P.text(mx,cy,'—',12,C.muted,false,'middle',true);return}
      const fg=EE_KARAR[r.karar.k][2];
      P.out.push('<g aria-label="'+esc(g.grade+'. sınıf · '+eeBaslikTitle(r))+'"><title>'+esc(g.grade+'. sınıf · '+eeBaslikTitle(r))+'</title>');
      P.text(mx,cy-6,eeGoster(r)?eeSayi(r.b):'—',12.5,eeGoster(r)?fg:C.muted,true,'middle',true);P.ftext(mx,cy+9,EE_KARAR[r.karar.k][0],cw-6,9,fg,r.karar.k!=='veri','middle',true);
      P.out.push('</g>')});
    });
   });
   const ly=y+r0+n*RH2+22;aciklama.forEach((l,i)=>P.text(44,ly+i*13,l,10,C.muted));notlar.forEach((l,i)=>P.text(44,ly+(aciklama.length+i)*13,l,10,C.ink));
  }};
 };
 sections.push(sc.key==='okul'?eeOkul():eeSinif());
 /* ---- Ödevler (beside the Etüt etkisi scatter when the grade has one) ---- */
 const o=k.odev,listRh=19,pt=sc.key!=='okul'&&ee.sonuc&&ee.sonuc.var?ee.sonuc.enCok:null,wide=!pt,orows=Math.ceil(o.courses.length/(wide?2:1)),oh=Math.max(pt?272:210,100+orows*listRh+20),ow=wide?W2:716;
 // Without an ödev report and without a scatter the card would be an empty page; the header already says "Ödev raporu: yok".
 if(o.total||pt)sections.push({name:pt?'Ödevler ve etüt grafiği':'Ödevler',h:oh,draw:(P,y)=>{const {text,rect,ring,width,ftext}=P;
  P.card(26,y,ow,oh,'Ödevler',o.total?o.total+' ödev':'');
  if(!o.total)P.message(26,y+30,ow,oh-30,KURUM_MESAJ.odev);
  else{
   text(44,y+46,'Rapor: '+display(o.date)+' · Ödev tarihi: belirtilmemiş · '+o.students+' öğrenci',11.5,C.muted);
   P.out.push('<g aria-label="'+esc('Ödev tamamlama · '+yuzde(o.rate))+'">');ring(100,y+130,44,o.rate);const pr=yuzde(o.rate);text(100,y+125,pr,Math.min(22,22*(88-13)*.8/width(pr,22,true)),C.green,true,'middle',true);text(100,y+143,'tamamlandı',10,C.muted,false,'middle',true);P.out.push('</g>');
   ODEV_DURUM.forEach(([ad,renk],i)=>{const v=o.statuses[i],yy=y+86+i*21,pc=o.total?'%'+fmt(Math.round(1000*v/o.total)/10):'';P.out.push('<g aria-label="'+esc(ad+' · '+v)+'">');rect(166,yy-10,11,11,renk,3);text(184,yy,ad,12,v?C.ink:C.muted);text(300,yy,v,12.5,v?C.ink:C.muted,true,'end');text(350,yy,pc,11,C.muted,false,'end');P.out.push('</g>')});
   text(384,y+72,'Derse göre tamamlama',12.5,C.ink,true);
   o.courses.forEach((c,i)=>{const col=Math.floor(i/orows),x0=384+col*370,yy=y+96+(i%orows)*listRh,v=c.values;P.out.push('<g><title>'+esc(c.course+' · Toplam '+v[0]+ODEV_DURUM.map(([ad],j)=>v[j+1]?' · '+ad+' '+v[j+1]:'').join(''))+'</title>');
    ftext(x0,yy,c.course,130,11.5,C.ink);rect(x0+136,yy-9,120,10,C.gray,5);let xx=x0+136;ODEV_DURUM.forEach(([,renk],j)=>{const w=v[0]?120*v[j+1]/v[0]:0;if(w){rect(xx,yy-9,w,10,renk,w<8?0:5);xx+=w}});
    text(x0+342,yy,yuzde(c.rate)+' · '+v[1]+'/'+v[0],11.5,C.ink,true,'end');P.out.push('</g>')});
  }
  if(pt){
   P.card(754,y,410,oh,'Etüt sayısı ve ek artış');
   P.ftext(772,y+46,pt.ders+' ('+pt.oturum+') · '+pt.n+' öğrenci · her nokta bir öğrenci',374,11.5,C.muted);
   text(772,y+66,'Ek artış (net)',10,C.muted);
   const px=804,pw=1146-px,py=y+76,ph=oh-76-62;eeNokta(P,px,py,pw,ph,pt);
   text(px+pw/2,py+ph+29,'Aldığı etüt sayısı',10,C.muted,false,'middle');
   text(772,py+ph+49,'Çizgi: her etüt ≈ '+eeSayi(pt.b)+' net'+(pt.ci?' '+eeAralik(pt):''),11,C.green,true);
  }
 }});
 /* ---- pack the sections into pages ---- */
 const pages=[[]];let y=KURUM_UST;const fresh=()=>{pages.push([]);y=KURUM_UST};
 for(const s of sections){if(y+s.h>KURUM_ALT&&y>KURUM_UST)fresh();pages.at(-1).push({s,y});y+=s.h+KURUM_ARA;if(s.breakAfter)fresh()}
 while(pages.length>1&&!pages.at(-1).length)pages.pop();
 return pages.map((items,i)=>{const out=[],P=boyaci(out);P.out=out;const {text,rect}=P;
  rect(0,0,W,H,C.bg,0);text(28,28,k.school||'KURUM RAPORU',11,C.muted,true);text(28,59,'Kurum raporu · '+sc.label,27,C.ink,true);text(28,80,k.count+' öğrenci · '+k.subeCount+' şube',12,C.muted);
  text(W-28,28,'Rapor tarihi: '+display(reportDate)+' · Sayfa '+(i+1)+' / '+pages.length,12,C.muted,true,'end');
  [['Etüt',aralik(src.etut)],['Ödev raporu',src.odev?display(src.odev):'yok'],['Deneme',aralik(src.deneme)]].forEach(([a,b],j)=>text(W-28,45+j*13,a+': '+b,10,C.muted,false,'end'));
  for(const it of items){out.push('<g data-kart="'+esc(it.s.name)+'">');it.s.draw(P,it.y);out.push('</g>')}
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc('Kurum raporu · '+sc.label+' · sayfa '+(i+1)+' / '+pages.length)+'" font-family="Arial, sans-serif">'+out.join('')+'</svg>';
 });
}
/* ---------------- teacher workspace and download ---------------- */
let OWNER=null,FILES=new Map(),BUSY=false,STATUS='',FILTER='',SELECTED='',GEN=0,MODE='ogrenci',SCOPE='okul';
function allowed(){return typeof rehberMi==='function'&&rehberMi()&&!(typeof CIKIS_DURUMU!=='undefined'&&CIKIS_DURUMU)}
function reset(){FILES=new Map();BUSY=false;STATUS='';FILTER='';SELECTED='';MODE='ogrenci';SCOPE='okul';GEN++;OWNER=typeof D==='undefined'?null:D}
function guard(){if(!allowed()){reset();throw new Error('Öğrenci raporları yalnızca rehber öğretmen içindir.')}if(OWNER!==D)reset()}
const unique=rows=>[...new Map(rows.map(r=>[nameKey(r.name)+'|'+r.cls,{name:r.name,no:'',cls:r.cls}])).values()];
// temel: exams and etüt sessions only, for analysis pages (Etüt etkisi). An unreadable Etüt planı then only
// loses its classroom codes, and attendance and the session-only homework/English files are left out.
function siteReports(temel=false){
 // Classroom codes are learnt first, from the stored deneme lists and the added homework reports.
 DERSLIK.clear();const sr=SIRALAMA.oku().veri,ep=ETUTPLANI.oku();if(ep.hata&&!temel)throw new Error(ep.hata);const programs=ep.hata?{}:ep.plan.programlar||{};
 for(const [c,p] of Object.entries(programs))if(p.kod)dersligiOgren(p.kod+' '+c);
 for(const x of sr?sr.sinavlar:[])for(const sl of [x.T,x.F])for(const o of sl?sl.ogr:[])dersligiOgren(o.snf);
 if(!temel)for(const r of FILES.values())(r.derslikler||[]).forEach(dersligiOgren);
 const reports=[],roster=(D.ogr||[]).filter(o=>!o.silindi).map(o=>({no:String(o.no||''),name:o.ad,cls:cls(o.sube||''),grade:o.sinif}));
 const {veri,hata}=SIRALAMA.oku();if(hata)throw new Error(hata);
 if(veri){const exams=[],students=[];let school='';const keys={TYT:['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'],AYT:['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY']};
  // Doğru/yanlış of a TYT lesson from the list's "D/Y" text, and the question counts of the list: the standard ones,
  // or, for a grade's own exam with fewer lessons (9. sınıf), the most any student answered (as the deneme board does).
  const dyOf=(p,k)=>{const m=/^(\d+)\s*\/\s*(\d+)$/.exec(p.dy[k]||'');return m?[+m[1],+m[2]]:null};
  const questionsOf=data=>{const rows=Object.values(data.students),own=DENEME_DERSLER.TYT.some(d=>d[0]!=='sf'&&!keys.TYT.some((k,i)=>TYT[i][0]===d[0]&&rows.some(p=>dyOf(p,k))));
   return Object.fromEntries(keys.TYT.map((k,i)=>[k,i]).filter(([k])=>rows.some(p=>dyOf(p,k))).map(([k,i])=>{const code=TYT[i][0],std=DENEME_DERSLER.TYT.find(d=>d[0]===code)[2],most=Math.max(0,...rows.map(p=>{const v=dyOf(p,k);return v?v[0]+v[1]:0}));return [code,own?denemeSoruTahmini(code,most):std]}))};
  for(const e of SIRALAMA.modeller(veri))for(const session of ['TYT','AYT']){const data=e[session.toLowerCase()];if(!data)continue;
   school=school||e.school;const corrected=e.dates.join()!==e.pdfDates.join(),q=session==='TYT'?questionsOf(data):null;
   for(const p of Object.values(data.students)){const nets={};keys[session].forEach((k,i)=>{if(p.net[k]!==null&&p.net[k]!==undefined)nets[(session==='TYT'?TYT:AYT)[i][0]]=p.net[k]});if(!Object.keys(nets).length)continue;const s={no:p.no,name:p.name,cls:cls(p.cls)},scores=Object.fromEntries((session==='AYT'?['SAY','EA','SÖZ']:['TYT']).map(k=>[k,Number.isFinite(p.puan[k])?p.puan[k]:null]));students.push(s);exams.push({...s,exam:e.name,examType:e.tur,date:date(corrected?e.dates[0]:data.meta.date),session,nets,scores,...(q?{dy:Object.fromEntries(keys.TYT.map((k,i)=>[TYT[i][0],dyOf(p,k)]).filter(([,v])=>v)),q}:{}),...(session==='AYT'?{fields:Object.fromEntries(['SAY','EA','SÖZ'].map(f=>[f,SIRALAMA.hasAYT(p)?Math.round(SIRALAMA.fnet(p,f)*100)/100:null]))}:{})})}
  }reports.push({kind:'exam',students,exams,school});
 }
 const manual=[];(D.ogr||[]).forEach((o,i)=>{if(o.silindi)return;for(const r of denemeListe(i)){if(!['TYT','AYT'].includes(r.tur))continue;const field=r.oturum==='TYT'?'TYT':r.alan,scores=Number.isFinite(r.puan)&&['TYT','SAY','EA','SÖZ'].includes(field)?{[field]:r.puan}:{};manual.push({no:String(o.no||''),name:o.ad,cls:cls(o.sube||''),exam:r.ad,examType:SIRALAMA.addanTur(r.ad),date:r.tarih,session:r.oturum,nets:Object.fromEntries(r.dersler.map(d=>[d.kod,denemeNet(d)])),scores,...(r.oturum==='TYT'?{dy:Object.fromEntries(r.dersler.map(d=>[d.kod,[d.dogru,d.yanlis]])),q:Object.fromEntries(r.dersler.map(d=>[d.kod,d.soru??DENEME_DERSLER.TYT.find(x=>x[0]===d.kod)?.[2]??d.dogru+d.yanlis]))}:{})})}});
 // Published/manual records are added first; the full source list wins on an identical identity.
 reports.unshift({kind:'exam',students:roster,exams:manual});
 // Etütler: every student of the etüt records, also those without an exam or a notebook entry.
 const et=ETUT.oku();if(et.hata)throw new Error(et.hata);let etut=null;
 if(et.veri){const rows=ETUT.ac(et.veri);if(rows.length){const sessions=rows.map(r=>({name:r.ad,cls:cls(r.sinif),date:iso(r.g),course:r.brans,teacher:r.ogretmen,minutes:r.sure,time:r.saat}));
  etut={kind:'sessions',students:unique(sessions),start:iso(Math.min(...et.veri.kaynak.map(k=>k.bas),...rows.map(r=>r.g))),end:iso(Math.max(...et.veri.kaynak.map(k=>k.bit),...rows.map(r=>r.g))),sessions};reports.push(etut)}}
 // Yoklama: the page's lesson codes as the report's statuses, including excused and medically reported absences.
 let yoklama=null;
 if(!temel&&typeof YOKLAMA!=='undefined'){const yk=YOKLAMA.oku();if(yk.hata)throw new Error(yk.hata);
  if(yk.veri){const DURUM={P:'Geldi',G:'Gecikti',A:'Gelmedi',M:'Mazeretli',R:'Raporlu'},attendance=[];
   for(const o of YOKLAMA.ac(yk.veri))for(const [g,k] of o.gun)attendance.push({name:o.ad,no:'',cls:cls(o.sinif),date:iso(g),statuses:[...k].map(c=>DURUM[c]||'')});
   if(attendance.length){yoklama={kind:'attendance',students:unique(attendance),attendance,start:iso(yk.veri.gunler[0]),end:iso(yk.veri.gunler.at(-1))};reports.push(yoklama)}}}
 const exams=new Set(reports.flatMap(r=>r.exams||[]).map(e=>nameKey(e.exam)+'|'+e.date));
 return {reports,roster,programs,staffBranches:ep.hata?[]:ep.plan.gunler.flat().map(([course,teacher])=>({course,teacher})),sources:{exams:exams.size,etut,yoklama,programs:Object.keys(programs).length}};
}
function model(){guard();const site=siteReports(),m=merge(site.reports.concat([...FILES.values()]),site.roster);
 const known=new Map(),learn=(teacher,course)=>{const subject=teacherSubject(course);if(!clean(teacher)||!subject)return;const k=nameKey(teacher),votes=known.get(k)||new Map();votes.set(subject,(votes.get(subject)||0)+1);known.set(k,votes)};
 for(const p of Object.values(site.programs))for(const [,,course,teacher] of p.dersler)learn(teacher,course);
 const main=new Map([...known].map(([k,v])=>[k,[...v].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr'))[0][0]]));
 for(const r of site.staffBranches.concat(site.reports.flatMap(r=>r.sessions||[])))if(!main.has(nameKey(r.teacher))){const subject=teacherSubject(r.course);if(subject)main.set(nameKey(r.teacher),subject)}
 for(const s of m.students){const p=Object.entries(site.programs).find(([c])=>cls(c)===cls(s.cls))?.[1],teachers=new Map();
  for(const [,,course,teacher] of p?.dersler||[]){const name=clean(teacher)||'Öğretmen belirtilmemiş',k=nameKey(name),t=teachers.get(k)||{teacher:name,courses:[],mainSubject:main.get(k)||''};if(!t.courses.some(c=>nameKey(c)===nameKey(course)))t.courses.push(course);teachers.set(k,t)}s.teachers=[...teachers.values()];s.hasTimetable=!!p;
 }return {...m,sources:site.sources}}
// The students with their exams and etüt sessions only (no attendance, homework or timetables), with the
// matching warnings: the shared base for analysis pages, so a problem in an unrelated source does not stop them.
function temelOgrenciler(){guard();const site=siteReports(true),m=merge(site.reports,site.roster);
 const et=site.sources.etut;return {students:m.students,warnings:m.warnings,etutKapsam:et?ETUT.oku().veri.kaynak.map(k=>[k.bas,k.bit]):[]}}
function selectedModel(){const m=model();return {...m,students:m.students.filter(s=>!FILTER||s.cls===FILTER)}}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function refresh(){if(EK.sekme==='ogrencirapor'&&allowed())ciz()}
function view(){
 if(!allowed())return '';guard();let m;try{m=model()}catch(e){return '<div class="baslik"><h1>Öğrenci raporları</h1></div><p role="alert">'+esc(e.message)+'</p>'}
 const classes=[...new Set(m.students.map(s=>s.cls))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));if(FILTER&&!classes.includes(FILTER))FILTER='';
 const list=m.students.filter(s=>!FILTER||s.cls===FILTER);if(!list.some(s=>s.id===SELECTED))SELECTED=list[0]?.id||'';const selected=list.find(s=>s.id===SELECTED);
 const disable=BUSY?' disabled':'';
 const src=m.sources,aralik=r=>r?' · '+display(r.start)+' – '+display(r.end):'',git=(sekme,ad)=>'<button type="button" class="dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
 const kaynak=(ad,metin,dugme)=>'<li><b>'+ad+'</b><span>'+metin+'</span>'+dugme+'</li>',dosyalar=k=>[...FILES].filter(([,r])=>r.kind===k).map(([n])=>n);
 const kurum=MODE==='kurum',mod='<div class="arac"><div class="or-mod" role="group" aria-label="Rapor türü">'+[['ogrenci','Öğrenci raporu'],['kurum','Kurum raporu']].map(([v,t])=>'<button type="button" class="dugme" data-or-mod="'+v+'" aria-pressed="'+((v==='kurum')===kurum)+'"'+disable+'>'+t+'</button>').join('')+'</div></div>';
 return '<div class="baslik"><h1>Öğrenci raporları</h1><p>'+(kurum?'Okul ya da sınıf düzeyi için: Türkiye geneli (TYT ve AYT), etüt etkisi ve ödev. Öğrenci, öğretmen ve şube adı yazmaz.':'Her öğrenciye tek sayfa: sınavlar, haftalık etüt, devam, ödev ve öğretmenler.')+'</p></div><section class="or-workspace">'+mod+
 '<ul class="or-kaynaklar">'+
  kaynak('Denemeler',src.exams?esc(fmt(src.exams))+' sınav':'Sınav yok',git('siralamalar','Sıralamalar'))+
  kaynak('Etütler',src.etut?esc(fmt(src.etut.sessions.length))+' etüt'+esc(aralik(src.etut)):'Etüt raporu yok',git('etutler','Etütler'))+
  kaynak('Yoklama',src.yoklama?esc(fmt(src.yoklama.students.length))+' öğrenci'+esc(aralik(src.yoklama)):'Yoklama raporu yok',git('yoklama','Yoklama'))+
  kaynak('Ödev takibi',dosyalar('homework').length?esc(dosyalar('homework').join(', ')):'Öğrenci Ev Ödev Durum Raporu eklenmedi',
   '<label class="dugme">Ödev raporu ekle<input id="orFiles" type="file" accept="application/pdf,.pdf" multiple hidden'+disable+'></label>'+(FILES.size?'<button class="dugme" id="orClear"'+disable+'>Temizle</button>':''))+
  kaynak('İngilizce',dosyalar('english').length?esc(dosyalar('english').join(', ')):'İngilizce sınavı eklenmedi','<label class="dugme">İngilizce PDF ekle<input id="orEnglishFiles" type="file" accept="application/pdf,.pdf" multiple hidden'+disable+'></label>')+
  kaynak('Ders programları',src.programs?esc(src.programs)+' sınıfın öğretmenleri ve dersleri':'Haftalık ders programı eklenmedi',git('etutplani','Ders programları'))+
 '</ul>'+
 '<details class="or-sources"><summary>Kaynaklar ve hesaplama</summary><p>Denemeler Sıralamalar’dan ve öğrencilerin sonuçlarından, etütler Etütler’den, devam Yoklama’dan gelir; bu sayfalara eklenen raporlar burada kendiliğinden görünür. Ödev ve İngilizce raporları bu sayfada eklenir ve sayfa yenilenene kadar tutulur. 60 soruluk Fly Higher Placement neti 100 üzerinden gösterilir: net / 60 × 100 (60 net → 100). Starter puanları aynen kullanılır. Öğretmenler sınıfın Etüt planı içindeki haftalık ders programından gelir. Ödev raporunda görev/teslim tarihi yoksa rapor tarihi ayrı gösterilir. Ödevlerde her durum (tamamladı, eksik, getirmedi, geç getirdi, yapmadı, gelmedi) ayrı renktedir. Raporun henüz durum yazmadığı ödevler verilmemiş sayılır: toplam, durumların toplamıdır.</p><p>Bir günde en az 3 ders yoksa kaçırdığı günlere eklenir; mazeretli ve raporlu kayıtlar dahildir. 0–2 ders yoksa okulda sayılır. Boş hücreler devamsızlık sayılmaz; tamamen boş günler yüzdeye katılmaz. Devam yüzdesi = okulda gün / durumu bilinen gün.</p><p>Grafiklerde her öğrencinin kendi sonuçları yer alır. AYT grafiği 11/A ve 12/A için EA, diğer 11. ve 12. sınıflarda SAY netini gösterir. Yandaki SAY, EA ve SÖZ değerleri son AYT sınavının alan netleridir. Etüt sayıları rapor kayıtlarıdır. Haftalar pazartesi başlar.</p><p>Kurum raporu öğrenci, öğretmen ve şube adı içermez; etüt sayısı ve devamsızlık da vermez. Türkiye geneli bölümü Türkiye geneli sayfasında seçtiğiniz listeyi ve okulu kullanır, yüzdelik dilimi ve sırayı oradan alır; seçtiğiniz listede o sınıf düzeyi yoksa sırayla diğer listelere bakılır, hiçbirinde yoksa okulun kendi TYT net ortalaması gösterilir. Etüt etkisi, Etüt etkisi sayfasındaki hesabın okul düzeyindeki sonucudur: her etüt için ortalama artış, olası aralığı ve kararı; öğretmen ayrımı yapılmaz. Bu bir karşılaştırmadır, farkın sebebi etüt olmayabilir. Değişim ilk denemeden son denemeyedir: ▲ yeşil: üst dilime çıktı (iyileşti), ▼ kırmızı: alt dilime düştü, gri: değişmedi (T puanında ±0,5’ten az değişim). Dilim, okulun Türkiye’deki okulların yüzde kaçının gerisinde kaldığını gösterir: ilk %12 = okulların %88’inden iyi. Dilim, Türkiye geneli sayfasındaki T puanının sözle söylenişidir (T = 50 + 10 · (net − Türkiye ortalaması) / σ; dilim = 100 · (1 − Φ((T − 50) / 10))); T ve σ yalnızca grafiklerin üzerine gelince açılan kutularda görünür.</p><ul>'+[...FILES.entries()].map(([n,r])=>'<li>'+esc(n)+' <button type="button" class="dugme" data-or-remove="'+esc(n)+'"'+disable+'>Kaldır</button></li>').join('')+'</ul></details>'+
 (kurum?kurumGorunum(m,disable):ogrenciGorunum(m,classes,list,selected,disable))+'</section>';
}
function ogrenciGorunum(m,classes,list,selected,disable){
 return '<div class="arac"><label>Sınıf <select id="orClass"'+disable+'><option value="">Tüm sınıflar</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(c===FILTER?' selected':'')+'>'+esc(c||'Şube belirtilmemiş')+'</option>').join('')+'</select></label><label>Öğrenci <select id="orStudent"'+disable+'>'+list.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===SELECTED?' selected':'')+'>'+esc(s.name+' · '+s.cls)+'</option>').join('')+'</select></label></div>'+
 '<div class="arac"><button class="dugme birincil" id="orOne"'+(BUSY||!selected?' disabled':'')+'>Öğrenci PDF</button><button class="dugme" id="orAll"'+(BUSY||!list.length?' disabled':'')+'>Sınıf / tümü PDF ('+list.length+')</button></div>'+
 '<p id="orStatus" role="status" aria-live="polite">'+esc([STATUS,...m.warnings].filter(Boolean).join(' '))+'</p>'+
 (selected?'<div class="or-preview" aria-label="PDF önizlemesi">'+svgReport(selected,today())+'</div>':'<p>Sitede kayıt yok. Denemeleri Sıralamalar’a, etüt raporunu Etütler’e, yoklama raporunu Yoklama’ya ekleyin.</p>');
}
// The pages (SVG strings) of one scope, and of every scope in order: the preview and the PDF use the very same pages.
function kurumSayfalar(students,scope){return svgKurum(kurumRapor(students,scope),today())}
function kurumGorunum(m,disable){
 const scopes=kurumKapsamlari(m.students),scope=scopes.find(x=>x.key===SCOPE)||scopes[0];if(scope&&scope.key!==SCOPE)SCOPE=scope.key;
 let pages=[],toplam=0,hata='';
 try{if(m.students.length)kurumOnbellekli(()=>{const all=scopes.map(x=>x===scope?null:kurumSayfalar(m.students,x));pages=kurumSayfalar(m.students,scope);toplam=all.reduce((n,a)=>n+(a?a.length:pages.length),0)})}catch(e){hata=e.message}
 return '<div class="arac"><label>Kapsam <select id="orScope"'+disable+'>'+scopes.map(x=>'<option value="'+esc(x.key)+'"'+(x.key===SCOPE?' selected':'')+'>'+esc(x.label+' · '+x.count+' öğrenci')+'</option>').join('')+'</select></label></div>'+
 '<div class="arac"><button class="dugme birincil" id="krOne"'+(BUSY||!pages.length?' disabled':'')+'>Kurum PDF ('+pages.length+' sayfa)</button><button class="dugme" id="krAll"'+(BUSY||!pages.length?' disabled':'')+'>Tüm düzeyler PDF ('+toplam+' sayfa)</button></div>'+
 '<p id="orStatus" role="status" aria-live="polite">'+esc([STATUS,hata,...m.warnings].filter(Boolean).join(' '))+'</p>'+
 (pages.length?'<div class="or-preview or-sayfalar" aria-label="Kurum raporu önizlemesi">'+pages.join('')+'</div>':hata?'':'<p>Sitede kayıt yok. Denemeleri Sıralamalar’a, etüt raporunu Etütler’e ekleyin.</p>');
}
// Homework and English reports are added here; the other sources have their own pages.
const YER={exam:'deneme sonuç listesi; Sıralamalar sayfasından ekleyin.',sessions:'etüt raporu; Etütler sayfasından ekleyin.',attendance:'yoklama raporu; Yoklama sayfasından ekleyin.'};
async function addFiles(files){
 guard();if(BUSY)return;if(files.length>30)throw new Error('Bir seferde en fazla 30 PDF seçin.');const owner=D,gen=GEN;BUSY=true;STATUS='PDF’ler okunuyor…';refresh();const results=[],errors=[];
 try{for(const f of files){try{const p=await denemePdfSayfalari(f,{sayfa:1000,mb:60,ilerleme:(n,t)=>{STATUS=f.name+' okunuyor · '+n+' / '+t+' sayfa';const el=document.getElementById('orStatus');if(el)el.textContent=STATUS}});if(owner!==D||gen!==GEN||!allowed())return;const r=parse(p.pages,p.boylar);
    if(!['homework','english'].includes(r.kind))throw new Error(YER[r.kind]);results.push([f.name,r])}catch(e){errors.push(f.name+': '+e.message)}}
  if(owner!==D||gen!==GEN||!allowed())return;for(const [name,r] of results)FILES.set(name,r);STATUS=results.length+' dosya eklendi.'+(errors.length?' '+errors.join(' '):'');
 }finally{if(owner===D&&gen===GEN){BUSY=false;refresh()}}
}
async function raster(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error('Rapor görseli oluşturulamadı.'));img.src=url});
  const cv=document.createElement('canvas');cv.width=Math.round(W*RASTER_SCALE);cv.height=Math.round(H*RASTER_SCALE);const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  return await new Promise((ok,bad)=>cv.toBlob(async b=>{if(!b){bad(new Error('PDF görseli hazırlanamadı.'));return}ok(new Uint8Array(await b.arrayBuffer()))},'image/png'));
 }finally{URL.revokeObjectURL(url)}
}
// One raster page per item; render(item, date) gives the SVG. The student and the kurum reports share this pipeline.
async function pdfSayfalar(items,render,title,valid){
 const L=await SIRALAMA.kutuphane(),doc=await L.PDFLib.PDFDocument.create();doc.setTitle(title);const d=today();
 for(const s of items){if(!valid())throw new Error('Oturum değişti.');const bytes=await raster(render(s,d));if(!valid())throw new Error('Oturum değişti.');const img=await doc.embedPng(bytes),p=doc.addPage([PAGE_W,PAGE_H]);p.drawImage(img,{x:0,y:0,width:PAGE_W,height:PAGE_H})}
 return doc.save();
}
async function pdfBytes(students,valid=()=>true){
 if(!students.length)throw new Error('Öğrenci seçilmedi.');if(students.length>300)throw new Error('Bir PDF en fazla 300 öğrenci içerebilir. Sınıf seçerek indirin.');
 return pdfSayfalar(students,svgReport,'Bireysel öğrenci raporları',valid);
}
// Kurum raporu: every scope gives one or more A4 landscape pages, one after the other (the school first, then each grade).
async function kurumPdfBytes(students,scopes,valid=()=>true){
 if(!scopes.length)throw new Error('Kapsam seçilmedi.');
 const pages=kurumOnbellekli(()=>scopes.flatMap(sc=>kurumSayfalar(students,sc)));
 return pdfSayfalar(pages,svg=>svg,'Kurum raporu',valid);
}
async function download(all){
 guard();if(BUSY)return;const owner=D,gen=GEN,m=selectedModel(),list=all?m.students:m.students.filter(s=>s.id===SELECTED);BUSY=true;STATUS='PDF hazırlanıyor…';refresh();
 try{const valid=()=>owner===D&&gen===GEN&&allowed(),bytes=await pdfBytes(list,valid);if(!valid())return;
  const name=(all?(FILTER||'Tum_ogrenciler'):list[0].name).replace(/[^\p{L}\p{N} _-]/gu,'_')+'_Rapor.pdf';const saved=await indir(name,bytes,'pdf');if(valid())STATUS=saved?'PDF hazır.':'İndirme iptal edildi.';
 }catch(e){if(owner===D&&gen===GEN)STATUS=e.message}finally{if(owner===D&&gen===GEN){BUSY=false;refresh()}}
}
async function kurumDownload(all){
 guard();if(BUSY)return;const owner=D,gen=GEN,m=model(),scopes=kurumKapsamlari(m.students),scope=scopes.find(x=>x.key===SCOPE)||scopes[0];BUSY=true;STATUS='PDF hazırlanıyor…';refresh();
 try{const valid=()=>owner===D&&gen===GEN&&allowed(),bytes=await kurumPdfBytes(m.students,all?scopes:[scope],valid);if(!valid())return;
  const name=(all?'Tum_duzeyler':scope.key==='okul'?'Tum_okul':scope.grade+'_sinif')+'_Kurum_Raporu.pdf',saved=await indir(name,bytes,'pdf');if(valid())STATUS=saved?'PDF hazır.':'İndirme iptal edildi.';
 }catch(e){if(owner===D&&gen===GEN)STATUS=e.message}finally{if(owner===D&&gen===GEN){BUSY=false;refresh()}}
}
if(typeof document!=='undefined'&&document.addEventListener){
 document.addEventListener('change',async ev=>{if(!allowed()||EK.sekme!=='ogrencirapor')return;const el=ev.target;guard();if(BUSY)return;
  if(el.id==='orScope'){SCOPE=el.value;refresh()}else if(el.id==='orClass'){FILTER=el.value;SELECTED='';refresh()}else if(el.id==='orStudent'){SELECTED=el.value;refresh()}else if(el.id==='orFiles'||el.id==='orEnglishFiles'){try{await addFiles([...el.files])}catch(e){STATUS=e.message;refresh()}}
 });
 document.addEventListener('click',async ev=>{if(!allowed()||EK.sekme!=='ogrencirapor')return;const el=ev.target.closest?.('button');if(!el)return;guard();if(BUSY)return;
  if(el.id==='orOne'||el.id==='orAll')await download(el.id==='orAll');else if(el.id==='krOne'||el.id==='krAll')await kurumDownload(el.id==='krAll');else if(el.dataset.orMod){MODE=el.dataset.orMod==='kurum'?'kurum':'ogrenci';refresh()}else if(el.id==='orClear'){const mode=MODE,scope=SCOPE;reset();MODE=mode;SCOPE=scope;refresh()}else if(el.hasAttribute('data-or-remove')){FILES.delete(el.getAttribute('data-or-remove'));refresh()}
 });
}
return {parse,englishPdf,homeworkPdf,attendancePdf,attendanceSummary,weekly,merge,svgReport,view,model,temelOgrenciler,addFiles,pdfBytes,reset,kurumKapsamlari,kurumRapor,kurumTurkiye,svgKurum,kurumPdfBytes};
})();
function gorunumOgrenciRapor(){return OGRENCI_RAPOR.view()}
