// Student visual reports. Source PDFs stay in this browser session; nothing is written to
// the notebook or uploaded. Keep real student data out of this source and its tests.
const OGRENCI_RAPOR = (() => {
'use strict';
const TYT=[['turkce','Türkçe'],['tarih','Tarih'],['cografya','Coğrafya'],['felsefe','Felsefe'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const AYT=[['edebiyat','Edebiyat'],['tarih1','Tarih 1'],['cografya1','Coğrafya 1'],['tarih2','Tarih 2'],['cografya2','Coğrafya 2'],['felsefe','Felsefe grubu'],['din','Din kültürü'],['sf','Ek felsefe'],['mat','Matematik'],['geo','Geometri'],['fizik','Fizik'],['kimya','Kimya'],['biyoloji','Biyoloji']];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim(),nameKey=s=>clean(s).normalize('NFKC').toLocaleUpperCase('tr-TR');
const cls=s=>{const m=nameKey(s).match(/(\d{1,2})\s*[-/]\s*([A-ZÇĞİÖŞÜ]+)/u);return m?m[1]+'/'+m[2]:clean(s)};
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
 const students=[],homework=[],reportDate=printedDate(pages);let current=null,columns=null;
 for(const raw of pages){const p=normItems(raw),heads=p.filter(o=>o.s==='Öğrenci Adı Soyadı').sort((a,b)=>b.y-a.y);
  const people=heads.map(h=>{const n=join(p.filter(o=>Math.abs(o.y-h.y)<1&&o.x>h.x+h.w+2)).replace(/^:\s*/,''),sh=p.find(o=>o.s==='Şube / No.'&&o.y<h.y&&h.y-o.y<22);
   const cl=sh&&join(p.filter(o=>Math.abs(o.y-sh.y)<1&&o.x>sh.x+sh.w+2)).replace(/^:\s*/,'');const m=cl&&cl.match(/^(.*?)\s*\/\s*(\d+)$/);
   if(!n||!m)throw new Error('Ödev öğrenci kimliği okunamadı.');const s={no:m[2],name:n,cls:cls(m[1])};students.push(s);return {y:h.y,s};});
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
 return {kind:'homework',students,homework,reportDate};
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
function parse(pages,boylar){
 const text=pages[0].map(o=>o.s).join(' ');
 if(/DENEME SINAVI TOPLU SONUÇ/.test(text))return {kind:'exam'};
 if(/Öğrenci Ev Ödev Durum Raporu/.test(text))return homeworkPdf(pages);
 if(/Yoklama Raporu/.test(text))return attendancePdf(pages);
 if(/Tarih Bazlı Etüt Raporu/.test(text)){const r=ETUT.pdfCoz(pages);if(r.atlanan)throw new Error(r.atlanan+' etüt satırı okunamadı; eksik rapor eklenmedi.');return {kind:'sessions',students:[],sessions:r.satirlar.map(s=>({name:s.ad,cls:cls(s.sinif),date:iso(s.g),course:s.brans,teacher:s.ogretmen,time:s.saat,minutes:s.sure})),start:iso(r.bas),end:iso(r.bit)}}
 throw new Error('Öğrenci Ev Ödev Durum Raporu seçin.');
}
function attendanceSummary(rows){
 const out={present:0,half:0,full:0,unknown:0,days:rows.length,percent:null};
 for(const r of rows){const recorded=r.statuses.filter(Boolean),missed=recorded.filter(v=>v==='Gelmedi'||v.startsWith('Mazeretli')).length;
  if(!recorded.length)out.unknown++;else if(missed===recorded.length&&missed>=3)out.full++;else if(missed>=3)out.half++;else out.present++;
 }
 const known=out.days-out.unknown;out.percent=known?100*(out.present+out.half/2)/known:null;return out;
}
function weekly(rows,start,end){
 if(!start&&!rows.length)return [];
 const days=rows.map(s=>day(s.date));let first=start?day(start):Math.min(...days),last=end?day(end):Math.max(...days);
 first-=(new Date(first*86400000).getUTCDay()+6)%7;const weeks=[];
 if(last-first>3660)throw new Error('Etüt tarih aralığı 10 yıldan uzun.');
 for(let d=first;d<=last;d+=7){const r=rows.filter(s=>day(s.date)>=d&&day(s.date)<d+7),courses={};r.forEach(s=>courses[s.course]=(courses[s.course]||0)+1);weeks.push({date:iso(d),count:r.length,courses})}return weeks;
}
function merge(reports,roster=[]){
 const map=new Map(),loose=[],warnings=[];
 const ensure=s=>{const id=key(s);if(!map.has(id))map.set(id,{...s,id,exams:[],homework:[],attendance:[],sessions:[]});else if(!map.get(id).cls&&s.cls)map.get(id).cls=s.cls;return map.get(id)};
 roster.forEach(ensure);
 reports.forEach(r=>(r.students||[]).forEach(s=>{if(s.no)ensure(s);else loose.push(s)}));
 // Records without a number match by name and class; a class written another way ("12 A") still matches
 // the one student of that name in the same grade.
 const grade=c=>parseInt(cls(c),10),yazili=c=>/^\d{1,2}\/[A-ZÇĞİÖŞÜ]+$/u.test(cls(c));
 const named=s=>{const a=[...map.values()].filter(x=>nameKey(x.name)===nameKey(s.name)&&cls(x.cls)===cls(s.cls));if(a.length)return a;
  const b=[...map.values()].filter(x=>nameKey(x.name)===nameKey(s.name));
  return b.length===1&&(!b[0].cls||!s.cls||!(yazili(b[0].cls)&&yazili(s.cls))&&grade(b[0].cls)===grade(s.cls))?b:[]};
 for(const s of loose)if(!named(s).length)ensure(s);
 const find=s=>{if(s.no)return map.get(key(s));const a=named(s);if(a.length>1)warnings.push(s.name+': ad/şube birden fazla öğrenciye ait; kaydı eşleştirilmedi.');return a.length===1?a[0]:null};
 for(const r of reports){
  for(const e of r.exams||[]){const s=find(e);if(s){const id=nameKey(e.exam)+'|'+e.date+'|'+e.session;const n=s.exams.findIndex(x=>nameKey(x.exam)+'|'+x.date+'|'+x.session===id);if(n<0)s.exams.push(e);else s.exams[n]=e}}
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
function svgReport(s,reportDate){
 const out=[];
 const text=(x,y,t,size=12,color=C.ink,bold=false,anchor='start')=>out.push('<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="'+color+'" font-weight="'+(bold?700:400)+'" text-anchor="'+anchor+'">'+esc(t)+'</text>');
 const rect=(x,y,w,h,fill='#fff',r=12)=>out.push('<rect x="'+x+'" y="'+y+'" width="'+Math.max(0,w)+'" height="'+Math.max(0,h)+'" rx="'+Math.min(r,h/2,w/2)+'" fill="'+fill+'"/>');
 const line=(x1,y1,x2,y2,color=C.gray,width=1)=>out.push('<path d="M'+x1+','+y1+' L'+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="'+width+'"/>');
 const dot=(x,y,r=3,color=C.green)=>out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" stroke="'+color+'" stroke-width="1.7"/>');
 const ring=(x,y,r,percent)=>{out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.gray+'" stroke-width="13"/>');if(percent!==null){const circumference=2*Math.PI*r;out.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+C.green+'" stroke-width="13" stroke-dasharray="'+circumference*percent/100+' '+circumference+'" transform="rotate(-90 '+x+' '+y+')"/>')}};
 function graph(exams,values,x,y,w,h,large=false){
  const valid=values.filter(v=>v!==null&&v!==undefined);
  if(!valid.length){text(x+w/2,y+h/2,'Sonuç yok',large?16:11,C.muted,false,'middle');return}
  const lo=Math.min(0,...valid),hi=Math.max(5,Math.ceil(Math.max(...valid)/5)*5),yy=v=>y+h-(v-lo)/(hi-lo)*h,xx=i=>x+(exams.length>1?w*i/(exams.length-1):w/2);
  [lo,(lo+hi)/2,hi].forEach(v=>{line(x,yy(v),x+w,yy(v),'#e5ebe7',.7);if(large)text(x-8,yy(v)+3,fmt(v),10,C.muted,false,'end')});
  // Missing sessions break the line; explicit zero results remain visible points.
  let run=[];const flush=()=>{if(run.length>1){const p=run.map(i=>xx(i)+','+yy(values[i]));out.push('<path d="M'+xx(run[0])+','+yy(0)+' L'+p.join(' L')+' L'+xx(run.at(-1))+','+yy(0)+' Z" fill="'+C.pale+'"/>');out.push('<polyline points="'+p.join(' ')+'" fill="none" stroke="'+C.green+'" stroke-width="2.2"/>')}run=[]};
  values.forEach((v,i)=>{if(v===null||v===undefined)flush();else run.push(i)});flush();
  const step=large?Math.max(1,Math.ceil(exams.length/7)):Math.max(1,exams.length-1);
  values.forEach((v,i)=>{if(v===null||v===undefined)return;out.push('<g><title>'+esc(exams[i].exam+' · '+display(exams[i].date)+' · '+fmt(v)+' net')+'</title>');dot(xx(i),yy(v),large?4:2.8);out.push('</g>');
   if(i%step===0||i===exams.length-1)text(xx(i),yy(v)-8,fmt(v),large?12:10,C.green,true,i===0&&exams.length>1?'start':i===exams.length-1&&exams.length>1?'end':'middle');
  });
  if(large)exams.forEach((e,i)=>{if(i%step&&i!==exams.length-1)return;const name=e.exam.replace(/^27-/,'').replace(/TYT_SIFIR_POZİTİF/g,'Sıfır Pozitif');text(xx(i),y+h+20,display(e.date),10,C.muted,false,'middle');text(xx(i),y+h+36,name.length>20?name.slice(0,19)+'…':name,10,C.muted,false,'middle')});
 }
 function lessonCharts(session,x,w){
  const exams=s.exams.filter(e=>e.session===session),lessons=(session==='TYT'?TYT:AYT).filter(([k])=>exams.some(e=>e.nets[k]!==undefined)&&(k!=='sf'||exams.some(e=>(e.nets[k]||0)!==0)));
  text(x,290,session+' · ders netleri',13,C.muted,true);
  if(!lessons.length){rect(x,302,w,190);text(x+w/2,400,'Bu oturumda ders sonucu yok',15,C.muted,false,'middle');return}
  const columns=lessons.length>10?4:5,rows=Math.ceil(lessons.length/columns),cw=(w-(columns-1)*8)/columns,ch=(190-(rows-1)*8)/rows;
  lessons.forEach(([code,label],i)=>{const bx=x+(i%columns)*(cw+8),by=302+Math.floor(i/columns)*(ch+8);rect(bx,by,cw,ch);text(bx+9,by+17,label,11,C.ink,true);graph(exams,exams.map(e=>e.nets[code]??null),bx+10,by+36,cw-20,ch-48)});
 }
 rect(0,0,W,H,C.bg,0);text(28,28,s.school||'ÖĞRENCİ RAPORU',11,C.muted,true);text(28,59,s.name,27,C.ink,true);text(28,80,[s.cls,s.no].filter(Boolean).join(' / '),12,C.muted);text(W-28,47,display(reportDate),12,C.muted,false,'end');
 for(const [session,x,w] of [['TYT',26,558],['AYT',600,564]]){
  rect(x,96,w,174);text(x+18,121,session+(session==='AYT'?' · tüm derslerin neti':' · toplam net'),17,C.ink,true);
  const ex=s.exams.filter(e=>e.session===session);graph(ex,ex.map(e=>Object.values(e.nets).reduce((a,b)=>a+(b||0),0)),x+42,150,w-78,71,true);lessonCharts(session,x,w);
 }
 // Attendance percentage is based on the same day classifications shown below it.
 rect(26,508,244,308);text(44,535,'Gün bazında devam',17,C.ink,true);
 if(s.attendance.length){text(44,556,display(s.attendance[0].date)+' - '+display(s.attendance.at(-1).date),11,C.muted);ring(148,641,59,s.daily.percent);text(148,648,s.daily.percent===null?'—':'%'+fmt(Math.round(s.daily.percent*10)/10),27,C.green,true,'middle');
  const entries=[['Okulda',s.daily.present,C.green],['Yarım gün',s.daily.half,C.amber],['Tam gün yok',s.daily.full,C.red]];
  entries.forEach(([label,n,color],i)=>{const x=69+i*78;text(x,756,n,25,color,true,'middle');text(x,780,label,11,C.muted,false,'middle')});
 }else text(148,650,'Yoklama kaydı yok',15,C.muted,false,'middle');
 // Homework rows remain attached to their source report date. No due date is invented.
 rect(284,508,382,308);text(301,535,'Ödevler · derslere göre',17,C.ink,true);
 if(s.homework.length){const rd=s.homework[0].reportDate;text(301,556,'Rapor: '+display(rd)+' · Ödev tarihi: belirtilmemiş',11,C.muted);
  // Every status the report prints is drawn, in its column order.
  const totals=s.homework.reduce((a,h)=>a.map((v,i)=>v+h.values[i]),[0,0,0,0,0,0,0]);
  text(648,535,totals[1]+' / '+totals[0],14,C.green,true,'end');
  const courses=new Map();s.homework.forEach(h=>{const k=nameKey(h.course),o=courses.get(k)||{course:h.course,values:[0,0,0,0,0,0,0]};o.values=o.values.map((v,i)=>v+h.values[i]);courses.set(k,o)});
  let lx=301,ly=567;ODEV_DURUM.forEach(([ad,renk],i)=>{const n=totals[i+1];if(!n&&i)return;const t=ad+' '+n,w=t.length*5.3+18;
   if(lx+w>660){lx=301;ly+=13}rect(lx,ly,7,7,renk,2);text(lx+10,ly+7,t,9.5,C.muted);lx+=w});
  const top=ly+17,rh=Math.min(16,(806-top)/courses.size);
  [...courses.values()].forEach((h,i)=>{const y=top+i*rh,label=dersAdi(h.course),v=h.values;
   out.push('<g><title>'+esc(h.course+' · Toplam '+v[0]+ODEV_DURUM.map(([ad],j)=>v[j+1]?' · '+ad+' '+v[j+1]:'').join(''))+'</title>');
   text(301,y+9,label.length>24?label.slice(0,23)+'…':label,10.5,C.muted);rect(471,y,124,8,C.gray,4);
   let x=471;ODEV_DURUM.forEach(([,renk],j)=>{const w=v[0]?124*v[j+1]/v[0]:0;if(w)rect(x,y,w,8,renk,w<8?0:4);x+=w});
   text(648,y+9,v[1]+'/'+v[0],11,C.ink,true,'end');out.push('</g>');
  });
 }else text(475,650,'Ödev kaydı yok',15,C.muted,false,'middle');
 // Weekly chart plus course/weekly heatmap: every session contributes exactly once.
 rect(680,508,484,308);text(697,535,'Etüt · hafta ve ders',17,C.ink,true);text(1146,535,s.sessions.length+' etüt',15,C.green,true,'end');
 if(s.weeks.length){text(697,556,display(s.sessionStart||s.weeks[0].date)+' - '+display(s.sessionEnd||iso(day(s.weeks.at(-1).date)+6)),11,C.muted);
  const n=s.weeks.length,left=800,cw=345/n,max=Math.max(1,...s.weeks.map(w=>w.count));
  s.weeks.forEach((w,i)=>{const x=left+(i+.5)*cw,height=42*w.count/max;rect(x-cw*.3,619-height,cw*.6,height,C.green,3);if(n<=20||i%Math.ceil(n/10)===0)text(x,611-height,w.count,10,C.green,true,'middle');if(i%Math.max(1,Math.ceil(n/10))===0)text(x,636,display(w.date).slice(0,5),10,C.muted,false,'middle')});
  const courses=[...new Set(s.sessions.map(e=>e.course))].sort((a,b)=>a.localeCompare(b,'tr'));
  if(!courses.length)text(922,710,'Etüt kaydı yok',15,C.muted,false,'middle');
  const rh=Math.min(20,156/Math.max(1,courses.length));courses.forEach((c,j)=>{const yy=653+j*rh;out.push('<g><title>'+esc(c)+'</title>');text(697,yy+11,c.length>15?c.slice(0,14)+'…':c,10,C.muted);
   s.weeks.forEach((w,i)=>{const v=w.courses[c]||0,x=left+i*cw;rect(x+1,yy,cw-2,rh-3,v?'#c7e5d7':'#f0f3f0',3);if(v&&n<=20)text(x+cw/2,yy+11,v,10,C.green,true,'middle')});out.push('</g>');
  });
 }else text(922,650,'Etüt kaydı yok',15,C.muted,false,'middle');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(s.name+' bireysel raporu')+'" font-family="Arial, sans-serif">'+out.join('')+'</svg>';
}
/* ---------------- teacher workspace and download ---------------- */
let OWNER=null,FILES=new Map(),BUSY=false,STATUS='',FILTER='',SELECTED='',GEN=0;
function allowed(){return typeof rehberMi==='function'&&rehberMi()&&!(typeof CIKIS_DURUMU!=='undefined'&&CIKIS_DURUMU)}
function reset(){FILES=new Map();BUSY=false;STATUS='';FILTER='';SELECTED='';GEN++;OWNER=typeof D==='undefined'?null:D}
function guard(){if(!allowed()){reset();throw new Error('Öğrenci raporları yalnızca rehber öğretmen içindir.')}if(OWNER!==D)reset()}
const unique=rows=>[...new Map(rows.map(r=>[nameKey(r.name)+'|'+r.cls,{name:r.name,no:'',cls:r.cls}])).values()];
function siteReports(){
 const reports=[],roster=(D.ogr||[]).filter(o=>!o.silindi).map(o=>({no:String(o.no||''),name:o.ad,cls:cls(o.sube||'')}));
 const {veri,hata}=SIRALAMA.oku();if(hata)throw new Error(hata);
 if(veri){const exams=[],students=[];let school='';const keys={TYT:['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'],AYT:['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY']};
  for(const e of SIRALAMA.modeller(veri))for(const session of ['TYT','AYT']){const data=e[session.toLowerCase()];if(!data)continue;
   school=school||e.school;const corrected=e.dates.join()!==e.pdfDates.join();
   for(const p of Object.values(data.students)){const nets={};keys[session].forEach((k,i)=>{if(p.net[k]!==null&&p.net[k]!==undefined)nets[(session==='TYT'?TYT:AYT)[i][0]]=p.net[k]});if(!Object.keys(nets).length)continue;const s={no:p.no,name:p.name,cls:cls(p.cls)};students.push(s);exams.push({...s,exam:e.name,date:date(corrected?e.dates[0]:data.meta.date),session,nets})}
  }reports.push({kind:'exam',students,exams,school});
 }
 const manual=[];(D.ogr||[]).forEach((o,i)=>{if(o.silindi)return;for(const r of denemeListe(i)){if(!['TYT','AYT'].includes(r.tur))continue;manual.push({no:String(o.no||''),name:o.ad,cls:cls(o.sube||''),exam:r.ad,date:r.tarih,session:r.oturum,nets:Object.fromEntries(r.dersler.map(d=>[d.kod,denemeNet(d)]))})}});
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
 return {reports,roster,sources:{exams:exams.size,etut,yoklama}};
}
function model(){guard();const site=siteReports();return {...merge(site.reports.concat([...FILES.values()]),site.roster),sources:site.sources}}
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
 return '<div class="baslik"><h1>Öğrenci raporları</h1><p>Her öğrenciye tek sayfa: TYT, AYT, dersler, haftalık etüt, devam ve ödev.</p></div><section class="or-workspace">'+
 '<ul class="or-kaynaklar">'+
  kaynak('Denemeler',src.exams?esc(fmt(src.exams))+' sınav':'Sınav yok',git('siralamalar','Sıralamalar'))+
  kaynak('Etütler',src.etut?esc(fmt(src.etut.sessions.length))+' etüt'+esc(aralik(src.etut)):'Etüt raporu yok',git('etutler','Etütler'))+
  kaynak('Yoklama',src.yoklama?esc(fmt(src.yoklama.students.length))+' öğrenci'+esc(aralik(src.yoklama)):'Yoklama raporu yok',git('yoklama','Yoklama'))+
  kaynak('Ödev takibi',dosyalar('homework').length?esc(dosyalar('homework').join(', ')):'Öğrenci Ev Ödev Durum Raporu eklenmedi',
   '<label class="dugme">Ödev raporu ekle<input id="orFiles" type="file" accept="application/pdf,.pdf" multiple hidden'+disable+'></label>'+(FILES.size?'<button class="dugme" id="orClear"'+disable+'>Temizle</button>':''))+
 '</ul>'+
 '<details class="or-sources"><summary>Kaynaklar ve hesaplama</summary><p>Denemeler Sıralamalar’dan ve öğrencilerin sonuçlarından, etütler Etütler’den, devam Yoklama’dan gelir; bu sayfalara eklenen raporlar burada kendiliğinden görünür. Ödev raporu bu sayfada eklenir ve sayfa yenilenene kadar tutulur. Ödev raporunda görev/teslim tarihi yoksa rapor tarihi ayrı gösterilir. Ödevlerde her durum (tamamladı, eksik, getirmedi, geç getirdi, yapmadı, gelmedi) ayrı renktedir. Raporun henüz durum yazmadığı ödevler verilmemiş sayılır: toplam, durumların toplamıdır.</p><p>En az 3 ders kayıtlı ve hepsinde yok: tam gün. Diğer günlerde en az 3 ders yok: yarım gün. 0–2 ders yok: okulda. Mazeretli kayıtlar dahil, boş hücreler hariç. Devam yüzdesi = (okulda + yarım gün / 2) / durumu bilinen gün.</p><p>Grafiklerde her öğrencinin kendi sonuçları yer alır. AYT grafiği kaynakta bulunan tüm AYT derslerinin toplam netini gösterir. Etüt sayıları rapor kayıtlarıdır. Haftalar pazartesi başlar.</p><ul>'+[...FILES.entries()].map(([n,r])=>'<li>'+esc(n)+' <button type="button" class="dugme" data-or-remove="'+esc(n)+'"'+disable+'>Kaldır</button></li>').join('')+'</ul></details>'+
 '<div class="arac"><label>Sınıf <select id="orClass"'+disable+'><option value="">Tüm sınıflar</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(c===FILTER?' selected':'')+'>'+esc(c||'Şube belirtilmemiş')+'</option>').join('')+'</select></label><label>Öğrenci <select id="orStudent"'+disable+'>'+list.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===SELECTED?' selected':'')+'>'+esc(s.name+' · '+s.cls)+'</option>').join('')+'</select></label></div>'+
 '<div class="arac"><button class="dugme birincil" id="orOne"'+(BUSY||!selected?' disabled':'')+'>Öğrenci PDF</button><button class="dugme" id="orAll"'+(BUSY||!list.length?' disabled':'')+'>Sınıf / tümü PDF ('+list.length+')</button></div>'+
 '<p id="orStatus" role="status" aria-live="polite">'+esc([STATUS,...m.warnings].filter(Boolean).join(' '))+'</p>'+
 (selected?'<div class="or-preview" aria-label="PDF önizlemesi">'+svgReport(selected,today())+'</div>':'<p>Sitede kayıt yok. Denemeleri Sıralamalar’a, etüt raporunu Etütler’e, yoklama raporunu Yoklama’ya ekleyin.</p>')+'</section>';
}
// Only the homework report is added here; the others have their pages and come from there.
const YER={exam:'deneme sonuç listesi; Sıralamalar sayfasından ekleyin.',sessions:'etüt raporu; Etütler sayfasından ekleyin.',attendance:'yoklama raporu; Yoklama sayfasından ekleyin.'};
async function addFiles(files){
 guard();if(BUSY)return;if(files.length>30)throw new Error('Bir seferde en fazla 30 PDF seçin.');const owner=D,gen=GEN;BUSY=true;STATUS='PDF’ler okunuyor…';refresh();const results=[],errors=[];
 try{for(const f of files){try{const p=await denemePdfSayfalari(f);if(owner!==D||gen!==GEN||!allowed())return;const r=parse(p.pages,p.boylar);
    if(r.kind!=='homework')throw new Error(YER[r.kind]);results.push([f.name,r])}catch(e){errors.push(f.name+': '+e.message)}}
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
  if(el.id==='orClass'){FILTER=el.value;SELECTED='';refresh()}else if(el.id==='orStudent'){SELECTED=el.value;refresh()}else if(el.id==='orFiles'){try{await addFiles([...el.files])}catch(e){STATUS=e.message;refresh()}}
 });
 document.addEventListener('click',async ev=>{if(!allowed()||EK.sekme!=='ogrencirapor')return;const el=ev.target.closest?.('button');if(!el)return;guard();if(BUSY)return;
  if(el.id==='orOne'||el.id==='orAll')await download(el.id==='orAll');else if(el.id==='orClear'){reset();refresh()}else if(el.hasAttribute('data-or-remove')){FILES.delete(el.getAttribute('data-or-remove'));refresh()}
 });
}
return {parse,homeworkPdf,attendancePdf,attendanceSummary,weekly,merge,svgReport,view,model,addFiles,pdfBytes,reset};
})();
function gorunumOgrenciRapor(){return OGRENCI_RAPOR.view()}
