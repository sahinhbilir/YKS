// Embedded in index.html by scripts/embed-etutetkisi.cjs. No student data belongs here.
// Etüt etkisi (teacher only): did the students who took etüts of a lesson in the days before a mock exam
// gain more net in that lesson than the students who took none? It reads the merged students of Öğrenci
// raporları' base (OGRENCI_RAPOR.temelOgrenciler: exams with every lesson's net, etüt sessions with date, lesson and teacher),
// so nothing is stored, uploaded or sent to students. An exam pair of one grade and one session (by default the
// grade's first exam and its latest) gives each student's change in the lesson's net; the etüts taken in the window
// before the later exam (every day between the two, or the last 7 or 14 days) sort the students by teacher and by
// how many they took. The headline difference compares students of similar starting net.
// It shows an association, not proof: students who come to etüt may differ to begin with, so the starting
// nets sit beside the changes. See docs/etut-etkisi.md.
const ETUT_ETKI = (() => {
const PENCERELER=[[0,'Tüm aralık'],[7,'Son 7 gün'],[14,'Son 14 gün']];
const OTURUMLAR=['TYT','AYT'];
const EN_AZ=5;
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
// The keys of a lesson's net in a student's exam (Öğrenci raporları), by session.
const NET={
  TYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['turkce'],'Coğrafya':['cografya'],Tarih:['tarih'],Felsefe:['felsefe'],'Din Kültürü':['din']},
  AYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['edebiyat'],'Coğrafya':['cografya1','cografya2'],Tarih:['tarih1','tarih2'],Felsefe:['felsefe'],'Din Kültürü':['din']}};
// Student's t for a 95 % interval by degrees of freedom (beyond 30 the normal 1.96).
const T95=[12.71,4.3,3.18,2.78,2.57,2.45,2.36,2.31,2.26,2.23,2.2,2.18,2.16,2.14,2.13,2.12,2.11,2.1,2.09,2.09,2.08,2.07,2.07,2.06,2.06,2.06,2.05,2.05,2.05,2.04];

/* ---------------- small helpers ---------------- */
const U=s=>String(s??'').replace(/\s+/g,' ').trim().normalize('NFKC').toLocaleUpperCase('tr-TR');
const kisiAdi=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const r2=x=>Math.round(x*100)/100;
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const isaret=v=>(v>0?'+':v<0?'−':'')+f2(Math.abs(v));
const ok=v=>v===null||v===undefined?'—':(v>0?'▲':v<0?'▼':'')+f2(Math.abs(v));
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const gunAy=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const duzeyAl=c=>{const m=/^(\d{1,2})\s*[/-]/.exec(String(c||'').trim());return m?Number(m[1]):null};

/* ---------------- model ---------------- */
// An exam is its title and its date: equal titles on different dates stay apart.
const sinavAnahtari=e=>U(e.exam)+'|'+e.date;
// The exams of one grade and session, by date; a title used on more than one date carries its date.
function sinavListesi(ogr,oturum){
  const m=new Map();
  for(const s of ogr)for(const e of s.exams||[])if(e.session===oturum&&e.date){
    const key=sinavAnahtari(e),o=m.get(key)||{key,ad:e.exam,tarih:e.date,n:0};o.n++;m.set(key,o);
  }
  const l=[...m.values()].map(o=>({...o,gun:gunNo(o.tarih)})).sort((a,b)=>a.gun-b.gun||a.ad.localeCompare(b.ad,'tr',{numeric:true}));
  const say=new Map();for(const e of l)say.set(U(e.ad),(say.get(U(e.ad))||0)+1);
  for(const e of l)e.etiket=say.get(U(e.ad))>1?e.ad+' ('+gunAy(e.gun)+')':e.ad;
  return l;
}
// A student's net in a lesson in an exam; null when the exam or the lesson is missing.
function netAl(s,ex,oturum,ders){
  const e=(s.exams||[]).find(x=>x.session===oturum&&sinavAnahtari(x)===ex.key);if(!e||!e.nets)return null;
  const v=(NET[oturum][ders]||[]).map(k=>e.nets[k]).filter(Number.isFinite);
  return v.length?r2(v.reduce((a,b)=>a+b,0)):null;
}
// An etüt of "MATEMATİK TYT" counts for TYT only, "… AYT" for AYT only, a lesson without either for both.
function etutOturum(course,oturum){
  const k=U(course),t=/\bTYT\b/.test(k),a=/\bAYT\b/.test(k);
  return (!t&&!a)||(oturum==='TYT'?t:a);
}
// Weekdays after bas and before son that no added etüt report covers; null when the coverage is unknown.
function eksikGun(bas,son,kapsam){
  if(!Array.isArray(kapsam))return null;let n=0;
  for(let g=bas+1;g<son;g++)if(haftaGunu(g)<5&&!kapsam.some(([a,b])=>g>=a&&g<=b))n++;
  return n;
}
function ozet(l){
  const n=l.length;if(!n)return {n:0,ort:null,once:null,simdi:null,sd:null};
  const ort=x=>r2(l.reduce((t,r)=>t+r[x],0)/n),m=l.reduce((t,r)=>t+r.fark,0)/n;
  return {n,ort:ort('fark'),once:ort('once'),simdi:ort('simdi'),sd:n>1?Math.sqrt(l.reduce((t,r)=>t+(r.fark-m)**2,0)/(n-1)):null};
}
const yariGenislik=(a,k)=>{if(a.n<2||k.n<2)return null;const se=Math.sqrt(a.sd**2/a.n+k.sd**2/k.n),df=Math.min(a.n,k.n)-1;return r2((df>=30?1.96:T95[df-1])*se)};
// Etüt takers often start lower, and low starters rise more anyway. The adjusted difference compares students
// of similar starting net: the pair's students fall into thirds by their earlier net, the difference is taken
// within each third that has both groups, and the thirds are weighted by their etüt takers.
function duzeltilmis(alan,kontrol,tum){
  if(!alan.length||!kontrol.length)return {fark:null,yari:null,kapsanan:0};
  const s=tum.map(r=>r.once).sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor(p*s.length))],c1=q(1/3),c2=q(2/3);
  const bant=r=>r.once<c1?0:r.once<c2?1:2;let w=0,t=0,v=0,tamam=true;
  for(const b of [0,1,2]){
    const a=alan.filter(r=>bant(r)===b),k=kontrol.filter(r=>bant(r)===b);if(!a.length||!k.length)continue;
    const oa=ozet(a),ok_=ozet(k);t+=a.length*(oa.ort-ok_.ort);w+=a.length;
    if(a.length>1&&k.length>1)v+=a.length**2*(oa.sd**2/a.length+ok_.sd**2/k.length);else tamam=false;
  }
  return w?{fark:r2(t/w),yari:tamam?r2(1.96*Math.sqrt(v)/w):null,kapsanan:w}:{fark:null,yari:null,kapsanan:0};
}
// A group against the students with no etüt: the raw and the adjusted difference of the mean changes.
function karsilastir(alan,kontrol,tum,key){
  const a=ozet(alan),k=ozet(kontrol);
  return {alan:a,kontrol:k,etut:a.n?r2(alan.reduce((t,r)=>t+(key?r.hoca[key]:r.n),0)/a.n):null,fark:a.n&&k.n?r2(a.ort-k.ort):null,yari:yariGenislik(a,k),
    duz:duzeltilmis(alan,kontrol,tum),yeterli:a.n>=EN_AZ&&k.n>=EN_AZ,ortak:key?alan.filter(r=>Object.keys(r.hoca).length>1).length:null};
}
// One exam pair: the students with the lesson in both exams, the etüts each took in the window before
// Şimdiki (pencere days, or every day since Önceki when 0), and the groups by teacher and by number of etüts.
function cift(ogr,oturum,once,simdi,ders,pencere,kapsam){
  const bas=pencere?Math.max(once.gun,simdi.gun-pencere):once.gun,adlar=new Map(),satir=[];
  for(const s of ogr){
    const a=netAl(s,once,oturum,ders),b=netAl(s,simdi,oturum,ders);if(a===null||b===null)continue;
    const hoca={};let n=0;
    for(const x of s.sessions||[]){
      const g=gunNo(x.date);if(g<=bas||g>=simdi.gun||ETUT.dersAdi(x.course)!==ders||!etutOturum(x.course,oturum))continue;
      const k=U(x.teacher)||'?';n++;hoca[k]=(hoca[k]||0)+1;if(!adlar.has(k))adlar.set(k,kisiAdi(x.teacher)||'Öğretmen belirtilmemiş');
    }
    satir.push({id:s.id,ad:s.name,sinif:s.cls,once:a,simdi:b,fark:r2(b-a),n,hoca});
  }
  const kontrol=satir.filter(r=>r.n===0);
  const hocalar=[...adlar].map(([key,ad])=>({key,ad,...karsilastir(satir.filter(r=>r.hoca[key]),kontrol,satir,key)})).sort((x,y)=>y.alan.n-x.alan.n||x.ad.localeCompare(y.ad,'tr'));
  const doz=[[0,'0'],[1,'1'],[2,'2'],[3,'3 ve üstü']].map(([k,ad])=>{const l=satir.filter(r=>k===3?r.n>=3:r.n===k);return {k,ad,...ozet(l)}});
  return {bas,eksik:eksikGun(bas,simdi.gun,kapsam),satir,kontrol:ozet(kontrol),hocalar,hepsi:karsilastir(satir.filter(r=>r.n>0),kontrol,satir),doz};
}
// sec: {duzey, oturum, ders, simdi and onceki (exam keys), pencere (0 = every day between, 7 or 14)};
// kapsam: the [first, last] days of the added etüt reports. The default is the whole run: the grade's first
// exam against its latest, with every etüt between them.
function model(ogr,sec={},kapsam){
  const L=(ogr||[]).filter(s=>s&&Array.isArray(s.exams)),say=new Map();
  for(const s of L){const d=duzeyAl(s.cls);if(!d||!s.exams.length)continue;const o=say.get(d)||{d,etut:0};o.etut+=(s.sessions||[]).length;say.set(d,o)}
  const duzeyler=[...say.keys()].sort((a,b)=>b-a);
  if(!duzeyler.length)return {durum:'bos'};
  // The grade whose students took the most etüts is the default.
  const duzey=duzeyler.includes(sec.duzey)?sec.duzey:[...say.values()].sort((a,b)=>b.etut-a.etut||b.d-a.d)[0].d;
  const ogrD=L.filter(s=>duzeyAl(s.cls)===duzey),oturumlar=OTURUMLAR.filter(o=>sinavListesi(ogrD,o).length>=2);
  if(!oturumlar.length)return {durum:'az',duzeyler,duzey,oturumlar,oturum:null};
  const oturum=oturumlar.includes(sec.oturum)?sec.oturum:oturumlar[0],ex=sinavListesi(ogrD,oturum),son=ex.length-1;
  let simdi=ex.findIndex(e=>e.key===sec.simdi);if(simdi<1)simdi=son;
  let once=ex.findIndex(e=>e.key===sec.onceki);if(once<0||once>=simdi)once=0;
  const pencere=PENCERELER.some(p=>p[0]===sec.pencere)?sec.pencere:0;
  // The lessons with an etüt anywhere in the grade's run of exams, most first.
  const ara=new Map();
  for(const s of ogrD)for(const x of s.sessions||[]){
    const g=gunNo(x.date),d=ETUT.dersAdi(x.course);
    if(g>ex[0].gun&&g<ex[son].gun&&NET[oturum][d]&&etutOturum(x.course,oturum))ara.set(d,(ara.get(d)||0)+1);
  }
  const dersler=[...ara].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(([ders,n])=>({ders,n}));
  const taban={durum:'tamam',duzeyler,duzey,oturumlar,oturum,sinavlar:ex,simdi,onceki:once,pencere,dersler};
  if(!dersler.length)return {...taban,durum:'etutyok',ders:null};
  const ders=dersler.some(x=>x.ders===sec.ders)?sec.ders:dersler[0].ders,c=cift(ogrD,oturum,ex[once],ex[simdi],ders,pencere,kapsam);
  // Every pair of neighbouring exams, then the whole run (first exam against the latest). Observations are
  // student-intervals; the distinct students are counted apart.
  const cs=[];for(let i=1;i<ex.length;i++)cs.push(cift(ogrD,oturum,ex[i-1],ex[i],ders,pencere,kapsam));
  const donem=cift(ogrD,oturum,ex[0],ex[son],ders,0,kapsam);
  const anahtar=new Map();for(const p of [...cs,donem])for(const h of p.hocalar)if(!anahtar.has(h.key))anahtar.set(h.key,h.ad);
  const seri={sinavlar:ex.slice(1).map((e,i)=>({ad:e.etiket,onceki:ex[i].etiket,tarih:e.gun})),ilk:ex[0].etiket,son:ex[son].etiket,satirlar:[...anahtar].map(([key,ad])=>{
    const hucre=cs.map(p=>{const h=p.hocalar.find(x=>x.key===key);return h?{fark:h.fark,n:h.alan.n,k:h.kontrol.n,yeterli:h.yeterli}:null});
    const g=hucre.filter(x=>x&&x.fark!==null),gozlem=g.reduce((t,x)=>t+x.n,0),d=donem.hocalar.find(x=>x.key===key);
    const farkli=new Set(cs.flatMap(p=>p.satir.filter(r=>r.hoca[key]).map(r=>r.id))).size;
    return {key,ad,hucre,gozlem,farkli,ort:gozlem?r2(g.reduce((t,x)=>t+x.fark*x.n,0)/gozlem):null,donem:d?{fark:d.fark,duz:d.duz.fark,n:d.alan.n}:null};
  }).sort((x,y)=>y.farkli-x.farkli||x.ad.localeCompare(y.ad,'tr'))};
  return {...taban,ders,...c,seri};
}

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-ee-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(v>0?'<span aria-hidden="true">▲</span>':v<0?'<span aria-hidden="true">▼</span>':'')+yazi+'</span>';
const yonlu=v=>v===null||v===undefined?'':v>0?' et-yukari':v<0?' et-asagi':'';
const pencereYazi=p=>p?'son '+fi(p)+' günde':'iki deneme arasında';
const farkYaz=v=>v===null||v===undefined?'—':isaret(v);
function secimler(){return {duzey:EK.eeDuzey,oturum:EK.eeOturum,ders:EK.eeDers,simdi:EK.eeSimdi,onceki:EK.eeOnceki,pencere:EK.eePencere}}
function arac(m){
  const sel=(id,ad,l,deger)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+'">'+
    l.map(([v,yazi])=>'<option value="'+kacis(v)+'"'+(String(v)===String(deger)?' selected':'')+'>'+kacis(yazi)+'</option>').join('')+'</select></label>';
  const e=m.sinavlar;
  return '<div class="et-arac">'+(m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (m.dersler.length?sel('eeDers','Ders',m.dersler.map(x=>[x.ders,x.ders+' · '+fi(x.n)+' etüt']),m.ders):'')+
    '<div class="ee-ikili">'+sel('eeOnceki','İlk',e.slice(0,m.simdi).map(x=>[x.key,x.etiket]).reverse(),e[m.onceki].key)+'<span class="ee-ok" aria-hidden="true">→</span>'+
    sel('eeSimdi','Son',e.slice(1).map(x=>[x.key,x.etiket]).reverse(),e[m.simdi].key)+'</div>'+
    secim('pencere',m.pencere,PENCERELER,'Etüt aralığı')+'</div>';
}
function cumle(m){
  const e=m.sinavlar[m.simdi],o=m.sinavlar[m.onceki],h=m.hepsi,k=m.kontrol,b=t=>'<b>'+t+'</b>';
  const bas=kacis(o.etiket)+' → '+kacis(e.etiket)+' ('+gunAy(o.gun)+' → '+gunAy(e.gun)+') · '+kacis(m.ders)+' · '+pencereYazi(m.pencere)+' ';
  if(!h.alan.n)return bas+'etüt alan öğrenci yok; aşağıda denemeler boyunca tablosu bütün dönemi gösterir.';
  if(!k.n)return bas+b(fi(h.alan.n))+' öğrenci etüt aldı; etüt almayan öğrenci kalmadığı için karşılaştırma yok.';
  return bas+'etüt alan '+b(fi(h.alan.n))+' öğrencinin neti '+b(ok(h.alan.ort))+' (başta '+f2(h.alan.once)+'), almayan '+b(fi(k.n))+' öğrencinin '+b(ok(k.ort))+' (başta '+f2(k.once)+'). '+
    'Başlangıç netine göre fark '+b(farkYaz(h.duz.fark)+' net')+' (ham '+farkYaz(h.fark)+')'+(h.yeterli?'':' · gruplardan biri '+EN_AZ+' öğrenciden az')+'.';
}
function ozetKartlari(m){
  const h=m.hepsi,k=m.kontrol,kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const net=g=>g.n?hap(g.ort,f2(Math.abs(g.ort))+' net')+'<span class="mini">başta '+f2(g.once)+' → '+f2(g.simdi)+'</span>':'<span class="mini">öğrenci yok</span>';
  return '<div class="et-ozet">'+
    kart('Etüt alan öğrenci',fi(h.alan.n),net(h.alan))+
    kart('Etüt almayan öğrenci',fi(k.n),net(k))+
    kart('Fark · başlangıç netine göre',farkYaz(h.duz.fark),'<span class="mini">±'+(h.duz.yari===null?'—':f2(h.duz.yari))+' (%95) · ham '+farkYaz(h.fark)+(h.duz.kapsanan&&h.duz.kapsanan<h.alan.n?' · '+fi(h.duz.kapsanan)+' / '+fi(h.alan.n)+' öğrenci karşılaştırılabildi':'')+'</span>')+
    kart('Etüt alan başına etüt',h.alan.n?f2(h.etut):'—','<span class="mini">'+kacis(m.ders)+' · '+pencereYazi(m.pencere)+'</span>')+'</div>';
}
// A bar either side of zero, scaled to the largest difference on the page.
const cubuk=(v,ust)=>v===null||v===undefined?'':'<span class="ee-fark" aria-hidden="true"><span class="eksi">'+(v<0?'<i style="width:'+Math.round(Math.min(1,-v/ust)*100)+'%"></i>':'')+'</span><span class="arti">'+(v>0?'<i style="width:'+Math.round(Math.min(1,v/ust)*100)+'%"></i>':'')+'</span></span>';
// The adjusted difference comes right after the number who took etüt, so a narrow screen shows it first.
function hocaTablosu(m,secili){
  const ust=Math.max(1,...m.hocalar.map(h=>Math.abs(h.duz.fark??0))),n=v=>v===null||v===undefined?'—':f2(v);
  const hucreler=h=>'<td class="sayi">'+fi(h.alan.n)+'</td><td class="sayi'+yonlu(h.duz.fark)+(h.yeterli?'':' ee-az')+'"><b>'+farkYaz(h.duz.fark)+'</b>'+cubuk(h.duz.fark,ust)+'</td>'+
    '<td class="sayi'+yonlu(h.fark)+'">'+farkYaz(h.fark)+'</td><td class="sayi'+yonlu(h.alan.ort)+'">'+ok(h.alan.ort)+'</td><td class="sayi">'+fi(h.kontrol.n)+'</td>'+
    '<td class="sayi et-dar-gizle'+yonlu(h.kontrol.ort)+'">'+ok(h.kontrol.ort)+'</td><td class="sayi et-dar-gizle">'+(h.duz.yari===null?'—':'±'+f2(h.duz.yari))+(h.yeterli?'':' <span class="mini" title="'+EN_AZ+' öğrenciden az">az</span>')+'</td>'+
    '<td class="sayi et-dar-gizle">'+(h.ortak===null?'':fi(h.ortak))+'</td><td class="sayi et-dar-gizle">'+n(h.etut)+'</td><td class="sayi et-dar-gizle">'+n(h.alan.once)+'</td><td class="sayi et-dar-gizle">'+n(h.kontrol.once)+'</td>';
  const satir=h=>'<tr'+(secili===h.key?' class="secili"':'')+'><td class="tg-ad"><button type="button" class="ee-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button></td>'+hucreler(h)+'</tr>';
  const sutun=[['Öğretmen'],['Etüt alan','sayi'],['Fark','sayi'],['Ham fark','sayi'],['Net değişimi','sayi'],['Almayan','sayi'],['Net değişimi','sayi et-dar-gizle'],['±%95','sayi et-dar-gizle'],['Başka öğretmenden de','sayi et-dar-gizle'],['Etüt / öğrenci','sayi et-dar-gizle'],['Başta (alan)','sayi et-dar-gizle'],['Başta (almayan)','sayi et-dar-gizle']];
  return '<section class="et-panel" id="eeHocalar"><div class="et-kart-bas"><h2>'+kacis('Öğretmenlere göre · '+m.ders)+'</h2><span class="mini">fark başlangıç netine göre; bir öğretmene basınca öğrenciler o öğretmenin etüt alanlarıyla sınırlanır</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+sutun.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead><tbody>'+
    (m.hocalar.length?'<tr class="ee-hepsi"><td class="tg-ad">Herhangi bir etüt</td>'+hucreler(m.hepsi)+'</tr>'+m.hocalar.map(satir).join(''):'<tr><td colspan="12" class="mini">Bu aralıkta etüt alan öğrenci yok.</td></tr>')+
    '</tbody></table></div></section>';
}
function dozTablosu(m){
  const k=m.kontrol;
  return '<section class="et-panel" id="eeDoz"><div class="et-kart-bas"><h2>'+kacis('Etüt sayısına göre · '+m.ders)+'</h2><span class="mini">'+pencereYazi(m.pencere)+' alınan etüt</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr><th>Etüt sayısı</th><th class="sayi">Öğrenci</th><th class="sayi et-dar-gizle">Başta</th><th class="sayi et-dar-gizle">Sonda</th><th class="sayi">Net değişimi</th><th class="sayi">Etüt almayanlara göre</th></tr></thead><tbody>'+
    m.doz.map(d=>'<tr><td>'+kacis(d.ad)+'</td><td class="sayi">'+fi(d.n)+'</td><td class="sayi et-dar-gizle">'+(d.once===null?'—':f2(d.once))+'</td><td class="sayi et-dar-gizle">'+(d.simdi===null?'—':f2(d.simdi))+'</td><td class="sayi'+yonlu(d.ort)+'">'+ok(d.ort)+'</td>'+
      '<td class="sayi'+(d.k&&d.n&&k.n?yonlu(r2(d.ort-k.ort)):'')+'">'+(d.k&&d.n&&k.n?isaret(r2(d.ort-k.ort)):'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
// Every pair of neighbouring exams, each teacher's raw difference; the mean of those intervals; and the whole run
// (first exam against the latest, adjusted to the starting net). Observations and distinct students are apart.
function seriTablosu(m){
  const s=m.seri;if(!s.satirlar.length)return '';
  return '<section class="et-panel" id="eeSeri"><div class="et-kart-bas"><h2>'+kacis('Denemeler boyunca · '+m.ders)+'</h2><span class="mini">'+kacis(s.ilk+' → '+s.son)+'</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo ee-seri"><thead><tr><th>Öğretmen</th><th class="sayi">İlk → son</th>'+s.sinavlar.map(e=>'<th class="sayi" title="'+kacis(e.onceki+' → '+e.ad)+'">'+kacis(e.ad)+'</th>').join('')+
    '<th class="sayi">Aralık ortalaması</th><th class="sayi et-dar-gizle">Farklı öğrenci</th><th class="sayi et-dar-gizle">Gözlem</th></tr></thead><tbody>'+
    s.satirlar.map(r=>'<tr><td class="tg-ad">'+kacis(r.ad)+'</td><td class="sayi'+yonlu(r.donem&&r.donem.duz)+'"><b>'+(r.donem?farkYaz(r.donem.duz):'—')+'</b></td>'+
      r.hucre.map(x=>x&&x.fark!==null?'<td class="sayi'+yonlu(x.fark)+(x.yeterli?'':' ee-az')+'" title="'+fi(x.n)+' etüt alan, '+fi(x.k)+' almayan">'+isaret(x.fark)+'</td>':'<td class="sayi mini">—</td>').join('')+
      '<td class="sayi'+yonlu(r.ort)+'">'+farkYaz(r.ort)+'</td><td class="sayi et-dar-gizle">'+fi(r.farkli)+'</td><td class="sayi et-dar-gizle">'+fi(r.gozlem)+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="mini">İlk → son: dönemin ilk ve son denemesi, başlangıç netine göre. Deneme sütunları: o denemeyle bir önceki arasındaki ham fark. Aralık ortalaması bu farkların, etüt alan öğrenci sayısıyla ağırlıklı ortalamasıdır; dönem değişimi değildir. Gözlem, bir öğrenciyi her aralıkta yeniden sayar; soluk sayılar '+EN_AZ+' öğrenciden az bir gruba aittir.</p></section>';
}
function ogrenciTablosu(m,secili){
  const hoca=new Map(m.hocalar.map(h=>[h.key,h.ad]));
  const l=m.satir.filter(r=>secili?r.hoca[secili]:r.n>0).sort((a,b)=>b.n-a.n||b.fark-a.fark||a.ad.localeCompare(b.ad,'tr'));
  return '<section class="et-panel" id="eeOgrenciler"><div class="et-kart-bas"><h2>'+kacis('Etüt alan öğrenciler · '+m.ders)+(secili?' · '+kacis(hoca.get(secili)||''):'')+'</h2>'+
    (secili?'<button type="button" class="et-dugme" data-ee-hoca="">Tüm öğretmenler</button>':'<span class="mini">'+fi(l.length)+' öğrenci</span>')+'</div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr><th>Öğrenci</th><th class="et-dar-gizle">Şube</th><th>Etüt</th><th class="sayi et-dar-gizle">Başta</th><th class="sayi et-dar-gizle">Sonda</th><th class="sayi">Net değişimi</th></tr></thead><tbody>'+
    (l.length?l.map(r=>'<tr><td class="tg-ad">'+kacis(kisiAdi(r.ad))+'</td><td class="et-dar-gizle">'+kacis(r.sinif||'—')+'</td><td>'+fi(r.n)+' <span class="mini et-dar-gizle">'+kacis(Object.keys(r.hoca).map(k=>(hoca.get(k)||k)+(r.hoca[k]>1?' ×'+r.hoca[k]:'')).join(', '))+'</span></td>'+
      '<td class="sayi et-dar-gizle">'+f2(r.once)+'</td><td class="sayi et-dar-gizle">'+f2(r.simdi)+'</td><td class="sayi'+yonlu(r.fark)+'">'+ok(r.fark)+'</td></tr>').join(''):'<tr><td colspan="6" class="mini">Öğrenci yok.</td></tr>')+
    '</tbody></table></div></section>';
}
function notPaneli(){
  return '<section class="et-panel ee-not" id="eeNot"><h2>Nasıl okunur?</h2><ul>'+
    '<li>Her öğrencinin seçilen dersteki neti iki denemede karşılaştırılır; ikisinde de neti olan öğrenciler sayılır. Varsayılan, dönemin ilk denemesinden son denemesine kadar bütün aralıktır.</li>'+
    '<li><b>Etüt alan</b>, aralıkta o dersten (o öğretmenden) en az bir etüt almış; <b>almayan</b> o dersten hiç etüt almamıştır. Sınav günleri sayılmaz. Etüt raporu aralığın bir kısmını kapsamıyorsa “almayan” grubu yanlış olabilir; sayfa bunu yazar.</li>'+
    '<li><b>Fark</b>, benzer netle başlayan öğrenciler arasında (başlangıç netine göre üç gruba ayırarak) etüt alanların net değişimi eksi almayanlarınkidir. Etüte gelenler çoğu zaman daha düşük netten başlar ve düşük netten başlayanlar zaten daha çok yükselir; <b>ham fark</b> bunu düzeltmez.</li>'+
    '<li>±, yaklaşık %95 aralıktır. Çok sayıda öğretmen ve deneme yan yana olduğundan bazı farklar tesadüfen bu aralığın dışına çıkar: tek bir hücreye değil, denemeler boyunca tekrar eden farklara bakın.</li>'+
    '<li>Birden çok öğretmenden etüt alan öğrenci her öğretmenin satırında sayılır (“Başka öğretmenden de”).</li>'+
    '<li>Bu bir ilişkidir, kesin neden-sonuç değil: motivasyon, başka dersler ve sınav farkları da rol oynar.</li></ul></section>';
}
function icerik(){
  const baslik='<h1 class="et-baslik">Etüt etkisi</h1>',git=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
  let t;try{t=OGRENCI_RAPOR.temelOgrenciler()}catch(e){return '<header class="et-bas">'+baslik+'</header><p class="et-uyari">'+kacis(e.message)+'</p>'}
  const m=model(t.students,secimler(),t.etutKapsam);
  const uyari=(t.warnings||[]).length?'<p class="mini ee-durum" id="eeDurum">Eşleştirme: '+kacis(t.warnings.slice(0,3).join(' '))+(t.warnings.length>3?' (+'+fi(t.warnings.length-3)+')':'')+'</p>':'';
  const bos=(yazi)=>'<header class="et-bas">'+baslik+'</header><section class="et-panel et-bos"><b>'+yazi[0]+'</b><p>'+yazi[1]+'</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+git('etutler','Etütler')+'</div></section>';
  if(m.durum==='bos')return bos(['Henüz veri yok','Etüt etkisi için deneme sonuç listelerini Sıralamalar’a, etüt raporunu Etütler’e ekleyin.']);
  if(m.durum==='az')return '<header class="et-bas">'+baslik+'</header>'+(m.duzeyler.length>1?'<div class="et-arac">'+secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf')+'</div>':'')+
    '<section class="et-panel et-bos"><b>İki deneme gerekli</b><p>'+m.duzey+'. sınıf için aynı oturumda en az iki deneme sonucu olmalı.</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+'</div></section>';
  if(m.durum==='etutyok'){
    const e=m.sinavlar;
    return '<header class="et-bas">'+baslik+'</header>'+arac(m)+uyari+
      '<section class="et-panel et-bos"><b>Dönemde etüt kaydı yok</b><p>'+kacis(e[0].etiket)+' → '+kacis(e[e.length-1].etiket)+' arasında bu oturumun derslerinden etüt alan öğrenci bulunamadı. Etüt raporunun tarih aralığını ve öğrenci adlarının denemelerle eşleştiğini kontrol edin.</p><div class="et-arac">'+git('etutler','Etütler')+'</div></section>';
  }
  const kapsamUyari=m.eksik?'<p class="et-uyari" id="eeKapsam">Etüt raporları bu aralığın '+fi(m.eksik)+' iş gününü kapsamıyor: o günlerin etütleri bilinmediği için “almayan” grubu yanlış olabilir.</p>':'';
  const secili=m.hocalar.some(h=>h.key===EK.eeHoca)?EK.eeHoca:'';
  return '<header class="et-bas">'+baslik+'<p class="et-cumle">'+cumle(m)+'</p></header>'+arac(m)+uyari+kapsamUyari+ozetKartlari(m)+hocaTablosu(m,secili)+seriTablosu(m)+dozTablosu(m)+ogrenciTablosu(m,secili)+notPaneli();
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etüt etkisi</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="eeKok">'+icerik()+'</div>';
}
const etkin=()=>EK.sekme==='etutetki'&&rehberMi()&&!!document.getElementById?.('eeKok');
function yenidenCiz(odak){
  const kok=document.getElementById('eeKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
document.addEventListener('click',ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-ee-duzey],[data-ee-oturum],[data-ee-pencere],button[data-ee-hoca]');if(!el||el.disabled)return;
  if(el.dataset.eeDuzey){EK.eeDuzey=Number(el.dataset.eeDuzey);EK.eeOturum=EK.eeDers=EK.eeSimdi=EK.eeOnceki=EK.eeHoca=undefined;yenidenCiz('[data-ee-duzey="'+EK.eeDuzey+'"]');return}
  if(el.dataset.eeOturum){EK.eeOturum=el.dataset.eeOturum;EK.eeDers=EK.eeSimdi=EK.eeOnceki=EK.eeHoca=undefined;yenidenCiz('[data-ee-oturum="'+EK.eeOturum+'"]');return}
  if(el.dataset.eePencere!==undefined){EK.eePencere=Number(el.dataset.eePencere);EK.eeHoca=undefined;yenidenCiz('[data-ee-pencere="'+EK.eePencere+'"]');return}
  if(el.dataset.eeHoca!==undefined){EK.eeHoca=el.dataset.eeHoca&&EK.eeHoca!==el.dataset.eeHoca?el.dataset.eeHoca:undefined;yenidenCiz();document.getElementById('eeOgrenciler')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='eeDers'){EK.eeDers=el.value;EK.eeHoca=undefined;yenidenCiz('#eeDers');return}
  if(el.id==='eeSimdi'){EK.eeSimdi=el.value;EK.eeOnceki=EK.eeHoca=undefined;yenidenCiz('#eeSimdi');return}
  if(el.id==='eeOnceki'){EK.eeOnceki=el.value;EK.eeHoca=undefined;yenidenCiz('#eeOnceki')}
});
return {model,cift,netAl,etutOturum,eksikGun,duzeltilmis,icerik,gorunum,PENCERELER,NET,EN_AZ};
})();
function gorunumEtutEtki(){return ETUT_ETKI.gorunum()}
