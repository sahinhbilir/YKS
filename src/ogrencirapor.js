// Student visual reports. Source PDFs stay in this browser session; nothing is written to
// the notebook or uploaded. Keep real student data out of this source and its tests.
const OGRENCI_RAPOR = (() => {
'use strict';
const TYT=[['turkce','Türkçe'],['tarih','Tarih'],['cografya','Coğrafya'],['felsefe','Felsefe'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const AYT=[['edebiyat','Edebiyat'],['tarih1','Tarih 1'],['cografya1','Coğrafya 1'],['tarih2','Tarih 2'],['cografya2','Coğrafya 2'],['felsefe','Felsefe grubu'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const AYT_GROUPS=[
 {label:['Matematik'],keys:['mat','geo']},
 {label:['Fen'],keys:['fizik','kimya','biyoloji']},
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
     if(/Mazeretli/.test(text))return 'Mazeretli';if(/Gelmedi/.test(text))return 'Gelmedi';if(/Gecikti/.test(text))return 'Gecikti';if(/Geldi/.test(text))return 'Geldi';throw new Error('Yoklama durumu okunamadı: '+text);
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
 const school=join(first.filter(o=>o!==schoolHead&&o.x<160&&o.y<=schoolHead.y+2&&o.y>countHead.y+3)),students=[],exams=[],derslikler=new Set(),maxNet=/\bFLY HIGHER PLACEMENT TEST\b/i.test(exam)?60:null;
 for(const raw of pages){const p=normItems(raw).flatMap(o=>{const m=o.x<31&&o.s.match(/^(\d+)\s+(\d+\s*\/\s*.+)$/);return m?[{...o,s:m[1],w:10},{...o,s:m[2],x:32.6,w:Math.max(0,o.w-15)}]:[o]}),header=p.find(o=>o.s.includes('NO/İsim')),netHead=p.find(o=>o.s==='İNG'),scoreHead=p.find(o=>o.s==='Puan');if(!header||!netHead||!scoreHead)throw new Error('İngilizce sonuç sütunları okunamadı.');
  const anchors=p.filter(o=>o.x<32&&/^\d+$/.test(o.s)&&o.y<header.y-15).sort((a,b)=>b.y-a.y);
  anchors.forEach((a,i)=>{const limit=Math.max(12,(a.z||8)*1.6),top=i?(anchors[i-1].y+a.y)/2:a.y+limit,bottom=i+1<anchors.length?(a.y+anchors[i+1].y)/2:a.y-limit,band=p.filter(o=>o.y<top&&o.y>bottom);
   const identity=join(band.filter(o=>o.x>=31&&o.x<102)),m=identity.match(/^(\d+)\s*\/\s*(.+)$/),classItems=band.filter(o=>o.x>=102&&cx(o)<135),classText=join(classItems),c=classText.match(/(?:(\d{3})\s+)?(9|10)\s*\/\s*([A-ZÇĞİÖŞÜ]+)/u);
   if(!m||!c)throw new Error('İngilizce öğrenci adı / sınıfı okunamadı.');if(c[1]){dersligiOgren(c[1]+' '+c[2]+'/'+c[3]);derslikler.add(c[1]+' '+c[2]+'/'+c[3])}
   const readAt=head=>{const v=band.filter(o=>Math.abs(cx(o)-cx(head))<22&&/^-?\d+(?:[.,]\d+)?$/.test(o.s)).sort((a,b)=>b.y-a.y);if(v.length!==1)throw new Error('İngilizce sonuç sayısı okunamadı.');return Number(v[0].s.replace(',','.'))},net=readAt(netHead),printedScore=readAt(scoreHead),dy=band.find(o=>Math.abs(cx(o)-cx(netHead))<25&&/^\d+\/\d+$/.test(o.s));
   const score=maxNet?Math.round(net/maxNet*10000)/100:printedScore;
   if(!dy||!Number.isFinite(net)||!Number.isFinite(printedScore)||printedScore<0||!Number.isFinite(score)||score<0||score>100.01)throw new Error('İngilizce puanı geçersiz.');
   const [correct,wrong]=dy.s.split('/').map(Number),s={no:m[1],name:m[2],cls:c[2]+'/'+c[3]};if(maxNet&&correct+wrong>maxNet)throw new Error('Placement soru sayısı 60 ile uyuşmuyor.');students.push(s);exams.push({...s,exam,date:examDate,session:'ENGLISH',nets:{english:net},scores:{ENGLISH:score},printedScore,scoreBasis:maxNet?'net':'printed',maxNet,correct,wrong});
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
function attendanceSummary(rows){
 const out={present:0,half:0,full:0,unknown:0,days:rows.length,percent:null};
 for(const r of rows){const recorded=r.statuses.filter(Boolean),missed=recorded.filter(v=>v==='Gelmedi'||v.startsWith('Mazeretli')).length;
  if(!recorded.length)out.unknown++;else if(missed===recorded.length&&missed>=3)out.full++;else if(missed>=3)out.half++;else out.present++;
 }
 const known=out.days-out.unknown;out.percent=known?100*(out.present+out.half/2)/known:null;return out;
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
const C={ink:'#213d40',muted:'#657878',green:'#168d7d',amber:'#e5a044',red:'#bf6951',blue:'#6799c5',gray:'#d9dfdc',bg:'#f6f5f0',pale:'#e6f2ec'},W=1190.55,H=841.89;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
// Net of an AYT field (SAY / EA / SÖZ) in one exam record: the sum of the field's lessons, as the school's list adds
// them (a lesson the student did not answer counts 0). A published list supplies the figure; "—" when no lesson is recorded.
const fieldNet=(e,f)=>{if(e.fields&&f in e.fields)return e.fields[f];
 const n=DENEME_ALAN[f].map(k=>e.nets[k]).filter(Number.isFinite);return n.length?n.reduce((a,b)=>a+b,0):null};
function svgReport(s,reportDate){
 const out=[],grade=Number(s.grade)||parseInt(cls(s.cls),10),showAYT=![9,10].includes(grade),section=nameKey(cls(s.cls)).replace(/\s+/g,''),track=/^(11|12)[/-]?A$/.test(section)||[11,12].includes(grade)&&section==='A'?'EA':'SAY';
 const text=(x,y,t,size=12,color=C.ink,bold=false,anchor='start')=>out.push('<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="'+color+'" font-weight="'+(bold?700:400)+'" text-anchor="'+anchor+'">'+esc(t)+'</text>');
 const rect=(x,y,w,h,fill='#fff',r=12)=>out.push('<rect x="'+x+'" y="'+y+'" width="'+Math.max(0,w)+'" height="'+Math.max(0,h)+'" rx="'+Math.min(r,h/2,w/2)+'" fill="'+fill+'"/>');
 const line=(x1,y1,x2,y2,color=C.gray,width=1)=>out.push('<path d="M'+x1+','+y1+' L'+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="'+width+'"/>');
 const dot=(x,y,r=3,color=C.green)=>out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="'+color+'" stroke-width="1.7"/>');
 const ring=(x,y,r,percent)=>{out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.gray+'" stroke-width="13"/>');if(percent!==null){const circumference=2*Math.PI*r;out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.green+'" stroke-width="13" stroke-dasharray="'+circumference*percent/100+' '+circumference+'" transform="rotate(-90 '+x+' '+y+')"/>')}};
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
  text(x,260,session+' · ders netleri',13,C.muted,true);
  if(!lessons.length){rect(x,272,w,190);text(x+w/2,370,'Bu oturumda ders sonucu yok',15,C.muted,false,'middle');return}
  const columns=lessons.length>10?4:5,rows=Math.ceil(lessons.length/columns),cw=(w-(columns-1)*8)/columns,ch=(190-(rows-1)*8)/rows;
  lessons.forEach(([code,label],i)=>{const bx=x+(i%columns)*(cw+8),by=272+Math.floor(i/columns)*(ch+8);rect(bx,by,cw,ch);text(bx+9,by+17,label,11,C.ink,true);graph(exams,exams.map(e=>e.nets[code]??null),bx+10,by+36,cw-20,ch-48)});
 }
 function aytLessons(exams,x,w){
  text(x,260,'AYT · ders netleri',13,C.muted,true);
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
  rect(x,96,w,144);text(x+18,121,session+(session==='AYT'?' · '+track+' neti':' · toplam net'),17,C.ink,true);
  const ex=s.exams.filter(e=>e.session===session),values=ex.map(e=>{const keys=session==='AYT'?DENEME_ALAN[track]:Object.keys(e.nets),nets=keys.map(k=>e.nets[k]).filter(Number.isFinite);return nets.length?nets.reduce((a,b)=>a+b,0):null});
  out.push('<g aria-label="'+session+(session==='AYT'?' '+track:'')+' net grafiği">');graph(ex,values,x+42,140,w-(session==='AYT'?230:78),42,true);out.push('</g>');
  if(session==='AYT'){
   const last=ex.at(-1),sx=x+w-136;line(sx-10,112,sx-10,229);text(sx+2,121,'Son AYT netleri',11,C.muted,true);if(last)text(sx+2,136,display(last.date),10,C.muted);
   ['SAY','EA','SÖZ'].forEach((field,i)=>{const y=145+i*28,value=last?fieldNet(last,field):null;out.push('<g aria-label="'+esc(field+' neti · '+fmt(value))+'">');if(field===track)rect(sx-4,y-2,126,26,C.pale,7);text(sx+3,y+17,field,11,C.muted,true);text(x+w-18,y+18,fmt(value),20,field===track?C.green:C.ink,true,'end');out.push('</g>')});
   aytLessons(ex,x,w);
  }else lessonCharts(session,x,w);
 }
 if(!showAYT){rect(600,96,564,366);text(618,121,'İngilizce · sınav puanları',17,C.ink,true);const ex=s.exams.filter(e=>e.session==='ENGLISH');out.push('<g aria-label="İngilizce puan grafiği">');graph(ex,ex.map(e=>e.scores.ENGLISH),642,157,486,235,true,true,'puan',false,100);out.push('</g>')}
 // Attendance percentage is based on the same day classifications shown below it.
 rect(26,478,244,230);text(44,505,'Gün bazında devam',17,C.ink,true);
 if(s.attendance.length){text(44,526,display(s.attendance[0].date)+' - '+display(s.attendance.at(-1).date),11,C.muted);ring(148,592,43,s.daily.percent);text(148,599,s.daily.percent===null?'—':'%'+fmt(Math.round(s.daily.percent*10)/10),25,C.green,true,'middle');
  const entries=[['Okulda',s.daily.present,C.green],['Yarım gün',s.daily.half,C.amber],['Tam gün yok',s.daily.full,C.red]];
  entries.forEach(([label,n,color],i)=>{const x=69+i*78;text(x,674,n,23,color,true,'middle');text(x,696,label,11,C.muted,false,'middle')});
 }else text(148,600,'Yoklama kaydı yok',15,C.muted,false,'middle');
 // Homework rows remain attached to their source report date. No due date is invented.
 rect(284,478,382,230);text(301,505,'Ödevler · derslere göre',17,C.ink,true);
 if(s.homework.length){const rd=s.homework[0].reportDate;text(301,526,'Rapor: '+display(rd)+' · Ödev tarihi: belirtilmemiş',11,C.muted);
  // Every status the report prints is drawn, in its column order.
  const totals=s.homework.reduce((a,h)=>a.map((v,i)=>v+h.values[i]),[0,0,0,0,0,0,0]);
  text(648,505,totals[1]+' / '+totals[0],14,C.green,true,'end');
  const courses=new Map();s.homework.forEach(h=>{const k=homeworkCourseName(h.course),o=courses.get(k)||{course:k,values:[0,0,0,0,0,0,0]};o.values=o.values.map((v,i)=>v+h.values[i]);courses.set(k,o)});
  let lx=301,ly=537;ODEV_DURUM.forEach(([ad,renk],i)=>{const n=totals[i+1];if(!n&&i)return;const t=ad+' '+n,w=t.length*5.3+18;
   if(lx+w>660){lx=301;ly+=13}rect(lx,ly,7,7,renk,2);text(lx+10,ly+7,t,9.5,C.muted);lx+=w});
  const top=ly+17,rh=Math.min(16,(698-top)/courses.size);
  [...courses.values()].forEach((h,i)=>{const y=top+i*rh,label=dersAdi(h.course),v=h.values;
   out.push('<g><title>'+esc(h.course+' · Toplam '+v[0]+ODEV_DURUM.map(([ad],j)=>v[j+1]?' · '+ad+' '+v[j+1]:'').join(''))+'</title>');
   text(301,y+9,label.length>24?label.slice(0,23)+'…':label,10.5,C.muted);rect(471,y,124,8,C.gray,4);
   let x=471;ODEV_DURUM.forEach(([,renk],j)=>{const w=v[0]?124*v[j+1]/v[0]:0;if(w)rect(x,y,w,8,renk,w<8?0:4);x+=w});
   text(648,y+9,v[1]+'/'+v[0],11,C.ink,true,'end');out.push('</g>');
  });
 }else text(475,600,'Ödev kaydı yok',15,C.muted,false,'middle');
 // Weekly chart plus course/weekly heatmap: every session contributes exactly once.
 rect(680,478,484,230);text(697,505,'Etüt · hafta ve ders',17,C.ink,true);text(1146,505,s.sessions.length+' etüt',15,C.green,true,'end');
 if(s.sessions.length&&s.weeks.length){text(697,526,display(s.sessionStart||s.weeks[0].date)+' - '+display(s.sessionEnd||iso(day(s.weeks.at(-1).date)+6)),11,C.muted);
  const n=s.weeks.length,left=800,cw=345/n,max=Math.max(1,...s.weeks.map(w=>w.count));
  s.weeks.forEach((w,i)=>{const x=left+(i+.5)*cw,height=32*w.count/max;rect(x-cw*.3,589-height,cw*.6,height,C.green,3);if(n<=20||i%Math.ceil(n/10)===0)text(x,581-height,w.count,10,C.green,true,'middle');if(i%Math.max(1,Math.ceil(n/10))===0)text(x,606,display(w.date).slice(0,5),10,C.muted,false,'middle')});
  const courses=[...new Set(s.sessions.map(e=>courseName(e.course)))].sort((a,b)=>a.localeCompare(b,'tr'));
  const rh=Math.min(18,85/Math.max(1,courses.length)),font=Math.min(10,rh-2),baseline=Math.min(11,rh-1);
  courses.forEach((c,j)=>{const yy=619+j*rh;out.push('<g><title>'+esc(c)+'</title>');text(697,yy+baseline,c.length>15?c.slice(0,14)+'…':c,font,C.muted);
   s.weeks.forEach((w,i)=>{const v=w.courses[c]||0,x=left+i*cw;rect(x+1,yy,cw-2,rh-3,v?'#c7e5d7':'#f0f3f0',3);if(v&&n<=20)text(x+cw/2,yy+baseline,v,font,C.green,true,'middle')});out.push('</g>');
  });
 }else text(922,600,'Öğrencinin Etüt Talebi Olmamıştır',15,C.muted,false,'middle');
 // All timetable teachers, including lessons without etuts. Additional etut teachers are marked explicitly.
 rect(26,720,1138,96);text(44,742,'Öğretmenlerim · dersler · etüt sayısı',16,C.ink,true);
 if(!s.hasTimetable)text(1146,742,'Haftalık ders programı eklenmemiş',11,C.muted,false,'end');
 const teachers=new Map();for(const t of s.teachers||[])teachers.set(nameKey(t.teacher),{name:t.teacher,courses:[...t.courses],count:0,scheduled:true});
 for(const e of s.sessions){const name=clean(e.teacher)||'Öğretmen belirtilmemiş',k=nameKey(name),t=teachers.get(k)||{name,courses:[],count:0,scheduled:false};t.count++;if(!t.scheduled&&!t.courses.includes(courseName(e.course)))t.courses.push(courseName(e.course));teachers.set(k,t)}
 const teacherRows=[...teachers.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr')),columns=teacherRows.length>15?4:3,tw=1102/columns,rh=Math.min(12,54/Math.max(1,Math.ceil(teacherRows.length/columns)));
 teacherRows.forEach((t,i)=>{const x=44+(i%columns)*tw,y=762+Math.floor(i/columns)*rh,label=(t.scheduled?'':'Etüt · ')+t.name+' · '+t.courses.map(dersAdi).join(', '),fs=Math.min(10,rh-1),maxWidth=tw-36;
  out.push('<g aria-label="'+esc(t.name+' · '+t.count+' etüt')+'"><title>'+esc(label+' · '+t.count+' etüt')+'</title>');
  out.push('<text x="'+x+'" y="'+y+'" font-size="'+fs+'" fill="'+C.muted+'"'+(label.length*fs*.55>maxWidth?' textLength="'+maxWidth+'" lengthAdjust="spacingAndGlyphs"':'')+'>'+esc(label)+'</text>');text(x+tw-14,y,t.count,11,C.green,true,'end');out.push('</g>');
 });
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(s.name+' bireysel raporu')+'" font-family="Arial, sans-serif">'+out.join('')+'</svg>';
}
/* ---------------- teacher workspace and download ---------------- */
let OWNER=null,FILES=new Map(),BUSY=false,STATUS='',FILTER='',SELECTED='',GEN=0;
function allowed(){return typeof rehberMi==='function'&&rehberMi()&&!(typeof CIKIS_DURUMU!=='undefined'&&CIKIS_DURUMU)}
function reset(){FILES=new Map();BUSY=false;STATUS='';FILTER='';SELECTED='';GEN++;OWNER=typeof D==='undefined'?null:D}
function guard(){if(!allowed()){reset();throw new Error('Öğrenci raporları yalnızca rehber öğretmen içindir.')}if(OWNER!==D)reset()}
const unique=rows=>[...new Map(rows.map(r=>[nameKey(r.name)+'|'+r.cls,{name:r.name,no:'',cls:r.cls}])).values()];
function siteReports(){
 // Classroom codes are learnt first, from the stored deneme lists and the added homework reports.
 DERSLIK.clear();const sr=SIRALAMA.oku().veri,ep=ETUTPLANI.oku();if(ep.hata)throw new Error(ep.hata);const programs=ep.plan.programlar||{};
 for(const [c,p] of Object.entries(programs))if(p.kod)dersligiOgren(p.kod+' '+c);
 for(const x of sr?sr.sinavlar:[])for(const sl of [x.T,x.F])for(const o of sl?sl.ogr:[])dersligiOgren(o.snf);
 for(const r of FILES.values())(r.derslikler||[]).forEach(dersligiOgren);
 const reports=[],roster=(D.ogr||[]).filter(o=>!o.silindi).map(o=>({no:String(o.no||''),name:o.ad,cls:cls(o.sube||''),grade:o.sinif}));
 const {veri,hata}=SIRALAMA.oku();if(hata)throw new Error(hata);
 if(veri){const exams=[],students=[];let school='';const keys={TYT:['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'],AYT:['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY']};
  for(const e of SIRALAMA.modeller(veri))for(const session of ['TYT','AYT']){const data=e[session.toLowerCase()];if(!data)continue;
   school=school||e.school;const corrected=e.dates.join()!==e.pdfDates.join();
   for(const p of Object.values(data.students)){const nets={};keys[session].forEach((k,i)=>{if(p.net[k]!==null&&p.net[k]!==undefined)nets[(session==='TYT'?TYT:AYT)[i][0]]=p.net[k]});if(!Object.keys(nets).length)continue;const s={no:p.no,name:p.name,cls:cls(p.cls)},scores=Object.fromEntries((session==='AYT'?['SAY','EA','SÖZ']:['TYT']).map(k=>[k,Number.isFinite(p.puan[k])?p.puan[k]:null]));students.push(s);exams.push({...s,exam:e.name,examType:e.tur,date:date(corrected?e.dates[0]:data.meta.date),session,nets,scores,...(session==='AYT'?{fields:Object.fromEntries(['SAY','EA','SÖZ'].map(f=>[f,SIRALAMA.hasAYT(p)?Math.round(SIRALAMA.fnet(p,f)*100)/100:null]))}:{})})}
  }reports.push({kind:'exam',students,exams,school});
 }
 const manual=[];(D.ogr||[]).forEach((o,i)=>{if(o.silindi)return;for(const r of denemeListe(i)){if(!['TYT','AYT'].includes(r.tur))continue;const field=r.oturum==='TYT'?'TYT':r.alan,scores=Number.isFinite(r.puan)&&['TYT','SAY','EA','SÖZ'].includes(field)?{[field]:r.puan}:{};manual.push({no:String(o.no||''),name:o.ad,cls:cls(o.sube||''),exam:r.ad,examType:SIRALAMA.addanTur(r.ad),date:r.tarih,session:r.oturum,nets:Object.fromEntries(r.dersler.map(d=>[d.kod,denemeNet(d)])),scores})}});
 // Published/manual records are added first; the full source list wins on an identical identity.
 reports.unshift({kind:'exam',students:roster,exams:manual});
 // Etütler: every student of the etüt records, also those without an exam or a notebook entry.
 const et=ETUT.oku();if(et.hata)throw new Error(et.hata);let etut=null;
 if(et.veri){const rows=ETUT.ac(et.veri);if(rows.length){const sessions=rows.map(r=>({name:r.ad,cls:cls(r.sinif),date:iso(r.g),course:r.brans,teacher:r.ogretmen,minutes:r.sure,time:r.saat}));
  etut={kind:'sessions',students:unique(sessions),start:iso(Math.min(...et.veri.kaynak.map(k=>k.bas),...rows.map(r=>r.g))),end:iso(Math.max(...et.veri.kaynak.map(k=>k.bit),...rows.map(r=>r.g))),sessions};reports.push(etut)}}
 // Yoklama: the page's lesson codes as the report's statuses (P Geldi, G Gecikti, A Gelmedi, M/R Mazeretli).
 let yoklama=null;
 if(typeof YOKLAMA!=='undefined'){const yk=YOKLAMA.oku();if(yk.hata)throw new Error(yk.hata);
  if(yk.veri){const DURUM={P:'Geldi',G:'Gecikti',A:'Gelmedi',M:'Mazeretli',R:'Mazeretli'},attendance=[];
   for(const o of YOKLAMA.ac(yk.veri))for(const [g,k] of o.gun)attendance.push({name:o.ad,no:'',cls:cls(o.sinif),date:iso(g),statuses:[...k].map(c=>DURUM[c]||'')});
   if(attendance.length){yoklama={kind:'attendance',students:unique(attendance),attendance,start:iso(yk.veri.gunler[0]),end:iso(yk.veri.gunler.at(-1))};reports.push(yoklama)}}}
 const exams=new Set(reports.flatMap(r=>r.exams||[]).map(e=>nameKey(e.exam)+'|'+e.date));
 return {reports,roster,programs,sources:{exams:exams.size,etut,yoklama,programs:Object.keys(programs).length}};
}
function model(){guard();const site=siteReports(),m=merge(site.reports.concat([...FILES.values()]),site.roster);
 for(const s of m.students){const p=Object.entries(site.programs).find(([c])=>cls(c)===cls(s.cls))?.[1],teachers=new Map();
  for(const [,,course,teacher] of p?.dersler||[]){const name=clean(teacher)||'Öğretmen belirtilmemiş',k=nameKey(name),t=teachers.get(k)||{teacher:name,courses:[]};if(!t.courses.some(c=>nameKey(c)===nameKey(course)))t.courses.push(course);teachers.set(k,t)}s.teachers=[...teachers.values()];s.hasTimetable=!!p;
 }return {...m,sources:site.sources}}
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
 return '<div class="baslik"><h1>Öğrenci raporları</h1><p>Her öğrenciye tek sayfa: sınavlar, haftalık etüt, devam, ödev ve öğretmenler.</p></div><section class="or-workspace">'+
 '<ul class="or-kaynaklar">'+
  kaynak('Denemeler',src.exams?esc(fmt(src.exams))+' sınav':'Sınav yok',git('siralamalar','Sıralamalar'))+
  kaynak('Etütler',src.etut?esc(fmt(src.etut.sessions.length))+' etüt'+esc(aralik(src.etut)):'Etüt raporu yok',git('etutler','Etütler'))+
  kaynak('Yoklama',src.yoklama?esc(fmt(src.yoklama.students.length))+' öğrenci'+esc(aralik(src.yoklama)):'Yoklama raporu yok',git('yoklama','Yoklama'))+
  kaynak('Ödev takibi',dosyalar('homework').length?esc(dosyalar('homework').join(', ')):'Öğrenci Ev Ödev Durum Raporu eklenmedi',
   '<label class="dugme">Ödev raporu ekle<input id="orFiles" type="file" accept="application/pdf,.pdf" multiple hidden'+disable+'></label>'+(FILES.size?'<button class="dugme" id="orClear"'+disable+'>Temizle</button>':''))+
  kaynak('İngilizce',dosyalar('english').length?esc(dosyalar('english').join(', ')):'İngilizce sınavı eklenmedi','<label class="dugme">İngilizce PDF ekle<input id="orEnglishFiles" type="file" accept="application/pdf,.pdf" multiple hidden'+disable+'></label>')+
  kaynak('Ders programları',src.programs?esc(src.programs)+' sınıfın öğretmenleri ve dersleri':'Haftalık ders programı eklenmedi',git('etutplani','Ders programları'))+
 '</ul>'+
 '<details class="or-sources"><summary>Kaynaklar ve hesaplama</summary><p>Denemeler Sıralamalar’dan ve öğrencilerin sonuçlarından, etütler Etütler’den, devam Yoklama’dan gelir; bu sayfalara eklenen raporlar burada kendiliğinden görünür. Ödev ve İngilizce raporları bu sayfada eklenir ve sayfa yenilenene kadar tutulur. 60 soruluk Fly Higher Placement neti 100 üzerinden gösterilir: net / 60 × 100 (60 net → 100). Starter puanları aynen kullanılır. Öğretmenler sınıfın Etüt planı içindeki haftalık ders programından gelir. Ödev raporunda görev/teslim tarihi yoksa rapor tarihi ayrı gösterilir. Ödevlerde her durum (tamamladı, eksik, getirmedi, geç getirdi, yapmadı, gelmedi) ayrı renktedir. Raporun henüz durum yazmadığı ödevler verilmemiş sayılır: toplam, durumların toplamıdır.</p><p>En az 3 ders kayıtlı ve hepsinde yok: tam gün. Diğer günlerde en az 3 ders yok: yarım gün. 0–2 ders yok: okulda. Mazeretli kayıtlar dahil, boş hücreler hariç. Devam yüzdesi = (okulda + yarım gün / 2) / durumu bilinen gün.</p><p>Grafiklerde her öğrencinin kendi sonuçları yer alır. AYT grafiği 11/A ve 12/A için EA, diğer 11. ve 12. sınıflarda SAY netini gösterir. Yandaki SAY, EA ve SÖZ değerleri son AYT sınavının alan netleridir. Etüt sayıları rapor kayıtlarıdır. Haftalar pazartesi başlar.</p><ul>'+[...FILES.entries()].map(([n,r])=>'<li>'+esc(n)+' <button type="button" class="dugme" data-or-remove="'+esc(n)+'"'+disable+'>Kaldır</button></li>').join('')+'</ul></details>'+
 '<div class="arac"><label>Sınıf <select id="orClass"'+disable+'><option value="">Tüm sınıflar</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(c===FILTER?' selected':'')+'>'+esc(c||'Şube belirtilmemiş')+'</option>').join('')+'</select></label><label>Öğrenci <select id="orStudent"'+disable+'>'+list.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===SELECTED?' selected':'')+'>'+esc(s.name+' · '+s.cls)+'</option>').join('')+'</select></label></div>'+
 '<div class="arac"><button class="dugme birincil" id="orOne"'+(BUSY||!selected?' disabled':'')+'>Öğrenci PDF</button><button class="dugme" id="orAll"'+(BUSY||!list.length?' disabled':'')+'>Sınıf / tümü PDF ('+list.length+')</button></div>'+
 '<p id="orStatus" role="status" aria-live="polite">'+esc([STATUS,...m.warnings].filter(Boolean).join(' '))+'</p>'+
 (selected?'<div class="or-preview" aria-label="PDF önizlemesi">'+svgReport(selected,today())+'</div>':'<p>Sitede kayıt yok. Denemeleri Sıralamalar’a, etüt raporunu Etütler’e, yoklama raporunu Yoklama’ya ekleyin.</p>')+'</section>';
}
// Homework and English reports are added here; the other sources have their own pages.
const YER={exam:'deneme sonuç listesi; Sıralamalar sayfasından ekleyin.',sessions:'etüt raporu; Etütler sayfasından ekleyin.',attendance:'yoklama raporu; Yoklama sayfasından ekleyin.'};
async function addFiles(files){
 guard();if(BUSY)return;if(files.length>30)throw new Error('Bir seferde en fazla 30 PDF seçin.');const owner=D,gen=GEN;BUSY=true;STATUS='PDF’ler okunuyor…';refresh();const results=[],errors=[];
 try{for(const f of files){try{const p=await denemePdfSayfalari(f);if(owner!==D||gen!==GEN||!allowed())return;const r=parse(p.pages,p.boylar);
    if(!['homework','english'].includes(r.kind))throw new Error(YER[r.kind]);results.push([f.name,r])}catch(e){errors.push(f.name+': '+e.message)}}
  if(owner!==D||gen!==GEN||!allowed())return;for(const [name,r] of results)FILES.set(name,r);STATUS=results.length+' dosya eklendi.'+(errors.length?' '+errors.join(' '):'');
 }finally{if(owner===D&&gen===GEN){BUSY=false;refresh()}}
}
async function raster(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error('Rapor görseli oluşturulamadı.'));img.src=url});
  const cv=document.createElement('canvas');cv.width=Math.round(W*2);cv.height=Math.round(H*2);const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  return await new Promise((ok,bad)=>cv.toBlob(async b=>{if(!b){bad(new Error('PDF görseli hazırlanamadı.'));return}ok(new Uint8Array(await b.arrayBuffer()))},'image/png'));
 }finally{URL.revokeObjectURL(url)}
}
async function pdfBytes(students,valid=()=>true){
 if(!students.length)throw new Error('Öğrenci seçilmedi.');if(students.length>300)throw new Error('Bir PDF en fazla 300 öğrenci içerebilir. Sınıf seçerek indirin.');
 const L=await SIRALAMA.kutuphane(),doc=await L.PDFLib.PDFDocument.create();doc.setTitle('Bireysel öğrenci raporları');const d=today();
 for(const s of students){if(!valid())throw new Error('Oturum değişti.');const bytes=await raster(svgReport(s,d));if(!valid())throw new Error('Oturum değişti.');const img=await doc.embedPng(bytes),p=doc.addPage([W,H]);p.drawImage(img,{x:0,y:0,width:W,height:H})}
 return doc.save();
}
async function download(all){
 guard();if(BUSY)return;const owner=D,gen=GEN,m=selectedModel(),list=all?m.students:m.students.filter(s=>s.id===SELECTED);BUSY=true;STATUS='PDF hazırlanıyor…';refresh();
 try{const valid=()=>owner===D&&gen===GEN&&allowed(),bytes=await pdfBytes(list,valid);if(!valid())return;
  const name=(all?(FILTER||'Tum_ogrenciler'):list[0].name).replace(/[^\p{L}\p{N} _-]/gu,'_')+'_Rapor.pdf';const saved=await indir(name,bytes,'pdf');if(valid())STATUS=saved?'PDF hazır.':'İndirme iptal edildi.';
 }catch(e){if(owner===D&&gen===GEN)STATUS=e.message}finally{if(owner===D&&gen===GEN){BUSY=false;refresh()}}
}
if(typeof document!=='undefined'&&document.addEventListener){
 document.addEventListener('change',async ev=>{if(!allowed()||EK.sekme!=='ogrencirapor')return;const el=ev.target;guard();if(BUSY)return;
  if(el.id==='orClass'){FILTER=el.value;SELECTED='';refresh()}else if(el.id==='orStudent'){SELECTED=el.value;refresh()}else if(el.id==='orFiles'||el.id==='orEnglishFiles'){try{await addFiles([...el.files])}catch(e){STATUS=e.message;refresh()}}
 });
 document.addEventListener('click',async ev=>{if(!allowed()||EK.sekme!=='ogrencirapor')return;const el=ev.target.closest?.('button');if(!el)return;guard();if(BUSY)return;
  if(el.id==='orOne'||el.id==='orAll')await download(el.id==='orAll');else if(el.id==='orClear'){reset();refresh()}else if(el.hasAttribute('data-or-remove')){FILES.delete(el.getAttribute('data-or-remove'));refresh()}
 });
}
return {parse,englishPdf,homeworkPdf,attendancePdf,attendanceSummary,weekly,merge,svgReport,view,model,addFiles,pdfBytes,reset};
})();
function gorunumOgrenciRapor(){return OGRENCI_RAPOR.view()}
