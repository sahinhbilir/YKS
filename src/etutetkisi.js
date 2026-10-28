// Embedded in index.html by scripts/embed-etutetkisi.cjs. No student data belongs here.
// Etüt etkisi (teacher only): did the students who took etüts of a lesson in the days before a mock exam
// gain more net in that lesson than the students who took none? It reads the merged students of Öğrenci
// raporları (their exams with the net of every lesson, and their etüt sessions with date, lesson and teacher),
// so nothing is stored, uploaded or sent to students. An exam pair (Önceki → Şimdiki) of one grade and one
// session gives each student's change in the lesson's net; the etüts taken in the window before Şimdiki (the
// last 7 or 14 days, or every day between the two exams) sort the students by teacher and by how many they took.
// It shows an association, not proof: students who come to etüt may differ to begin with, so the starting
// nets sit beside the changes. See docs/etut-etkisi.md.
const ETUT_ETKI = (() => {
const PENCERELER=[[7,'Son 7 gün'],[14,'Son 14 gün'],[0,'İki deneme arası']];
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
// The exams of one grade and session, by date.
function sinavListesi(ogr,oturum){
  const m=new Map();
  for(const s of ogr)for(const e of s.exams||[])if(e.session===oturum&&e.date){
    const key=U(e.exam),o=m.get(key)||{key,ad:e.exam,tarih:e.date,n:0};o.n++;if(e.date<o.tarih)o.tarih=e.date;m.set(key,o);
  }
  return [...m.values()].map(o=>({...o,gun:gunNo(o.tarih)})).sort((a,b)=>a.gun-b.gun||a.ad.localeCompare(b.ad,'tr',{numeric:true}));
}
// A student's net in a lesson in an exam; null when the exam or the lesson is missing.
function netAl(s,ex,oturum,ders){
  const e=(s.exams||[]).find(x=>x.session===oturum&&U(x.exam)===ex.key);if(!e||!e.nets)return null;
  const v=(NET[oturum][ders]||[]).map(k=>e.nets[k]).filter(Number.isFinite);
  return v.length?r2(v.reduce((a,b)=>a+b,0)):null;
}
// An etüt of "MATEMATİK TYT" counts for TYT only, "… AYT" for AYT only, a lesson without either for both.
function etutOturum(course,oturum){
  const k=U(course),t=/\bTYT\b/.test(k),a=/\bAYT\b/.test(k);
  return (!t&&!a)||(oturum==='TYT'?t:a);
}
function ozet(l){
  const n=l.length;if(!n)return {n:0,ort:null,once:null,simdi:null,sd:null};
  const ort=x=>r2(l.reduce((t,r)=>t+r[x],0)/n),m=l.reduce((t,r)=>t+r.fark,0)/n;
  return {n,ort:ort('fark'),once:ort('once'),simdi:ort('simdi'),sd:n>1?Math.sqrt(l.reduce((t,r)=>t+(r.fark-m)**2,0)/(n-1)):null};
}
// A group against the students with no etüt: the difference of the mean changes and its 95 % half-width.
function karsilastir(alan,kontrol,key){
  const a=ozet(alan),k=ozet(kontrol),fark=a.n&&k.n?r2(a.ort-k.ort):null;
  let yari=null;if(a.n>1&&k.n>1){const se=Math.sqrt(a.sd**2/a.n+k.sd**2/k.n),df=Math.min(a.n,k.n)-1;yari=r2((df>=30?1.96:T95[df-1])*se)}
  const yeterli=a.n>=EN_AZ&&k.n>=EN_AZ;
  return {alan:a,kontrol:k,etut:a.n?r2(alan.reduce((t,r)=>t+(key?r.hoca[key]:r.n),0)/a.n):null,fark,yari,yeterli,anlamli:yeterli&&yari!==null&&Math.abs(fark)>yari};
}
// One exam pair: the students with the lesson in both exams, the etüts each took in the window before
// Şimdiki (pencere days, or every day since Önceki when 0), and the groups by teacher and by number of etüts.
function cift(ogr,oturum,once,simdi,ders,pencere){
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
  const hocalar=[...adlar].map(([key,ad])=>({key,ad,...karsilastir(satir.filter(r=>r.hoca[key]),kontrol,key)})).sort((x,y)=>y.alan.n-x.alan.n||x.ad.localeCompare(y.ad,'tr'));
  const doz=[[0,'0'],[1,'1'],[2,'2'],[3,'3 ve üstü']].map(([k,ad])=>{const l=satir.filter(r=>k===3?r.n>=3:r.n===k);return {k,ad,...ozet(l)}});
  return {bas,satir,kontrol:ozet(kontrol),hocalar,hepsi:karsilastir(satir.filter(r=>r.n>0),kontrol),doz};
}
// sec: {duzey, oturum, ders, simdi and onceki (exam keys), pencere (7, 14 or 0)}.
function model(ogr,sec={}){
  const L=(ogr||[]).filter(s=>s&&Array.isArray(s.exams)),say=new Map();
  for(const s of L){const d=duzeyAl(s.cls);if(!d||!s.exams.length)continue;const o=say.get(d)||{d,etut:0};o.etut+=(s.sessions||[]).length;say.set(d,o)}
  const duzeyler=[...say.keys()].sort((a,b)=>b-a);
  if(!duzeyler.length)return {durum:'bos'};
  // The grade whose students took the most etüts is the default.
  const duzey=duzeyler.includes(sec.duzey)?sec.duzey:[...say.values()].sort((a,b)=>b.etut-a.etut||b.d-a.d)[0].d;
  const ogrD=L.filter(s=>duzeyAl(s.cls)===duzey),oturumlar=OTURUMLAR.filter(o=>sinavListesi(ogrD,o).length>=2);
  if(!oturumlar.length)return {durum:'az',duzeyler,duzey,oturumlar,oturum:null};
  const oturum=oturumlar.includes(sec.oturum)?sec.oturum:oturumlar[0],ex=sinavListesi(ogrD,oturum);
  let simdi=ex.findIndex(e=>e.key===sec.simdi);if(simdi<1)simdi=ex.length-1;
  let once=ex.findIndex(e=>e.key===sec.onceki);if(once<0||once>=simdi)once=simdi-1;
  const pencere=PENCERELER.some(p=>p[0]===sec.pencere)?sec.pencere:7;
  // The lessons with an etüt between the two exams.
  const ara=new Map();
  for(const s of ogrD)for(const x of s.sessions||[]){
    const g=gunNo(x.date),d=ETUT.dersAdi(x.course);
    if(g>ex[once].gun&&g<ex[simdi].gun&&NET[oturum][d]&&etutOturum(x.course,oturum))ara.set(d,(ara.get(d)||0)+1);
  }
  const dersler=[...ara].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(([ders,n])=>({ders,n}));
  const taban={durum:'tamam',duzeyler,duzey,oturumlar,oturum,sinavlar:ex,simdi,onceki:once,pencere,dersler};
  if(!dersler.length)return {...taban,durum:'etutyok',ders:null};
  const ders=dersler.some(x=>x.ders===sec.ders)?sec.ders:dersler[0].ders,c=cift(ogrD,oturum,ex[once],ex[simdi],ders,pencere);
  // The same groups for every pair of neighbouring exams: each teacher's difference per exam and its mean.
  const cs=[];for(let i=1;i<ex.length;i++)cs.push(cift(ogrD,oturum,ex[i-1],ex[i],ders,pencere));
  const anahtar=new Map();for(const p of cs)for(const h of p.hocalar)if(!anahtar.has(h.key))anahtar.set(h.key,h.ad);
  const seri={sinavlar:ex.slice(1).map((e,i)=>({ad:e.ad,onceki:ex[i].ad,tarih:e.gun})),satirlar:[...anahtar].map(([key,ad])=>{
    const hucre=cs.map(p=>{const h=p.hocalar.find(x=>x.key===key);return h?{fark:h.fark,n:h.alan.n,k:h.kontrol.n,yeterli:h.yeterli}:null});
    const g=hucre.filter(x=>x&&x.fark!==null),n=g.reduce((t,x)=>t+x.n,0);
    return {key,ad,hucre,n,ort:n?r2(g.reduce((t,x)=>t+x.fark*x.n,0)/n):null};
  }).sort((x,y)=>y.n-x.n||x.ad.localeCompare(y.ad,'tr'))};
  return {...taban,ders,...c,seri};
}

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-ee-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(v>0?'<span aria-hidden="true">▲</span>':v<0?'<span aria-hidden="true">▼</span>':'')+yazi+'</span>';
const yonlu=v=>v===null||v===undefined?'':v>0?' et-yukari':v<0?' et-asagi':'';
const pencereYazi=p=>p?'son '+fi(p)+' günde':'iki deneme arasında';
function secimler(){return {duzey:EK.eeDuzey,oturum:EK.eeOturum,ders:EK.eeDers,simdi:EK.eeSimdi,onceki:EK.eeOnceki,pencere:EK.eePencere}}
function arac(m){
  const sel=(id,ad,l,deger)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+'">'+
    l.map(([v,yazi])=>'<option value="'+kacis(v)+'"'+(String(v)===String(deger)?' selected':'')+'>'+kacis(yazi)+'</option>').join('')+'</select></label>';
  const e=m.sinavlar;
  return '<div class="et-arac">'+(m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (m.dersler.length?sel('eeDers','Ders',m.dersler.map(x=>[x.ders,x.ders+' · '+fi(x.n)+' etüt']),m.ders):'')+
    '<div class="ee-ikili">'+sel('eeOnceki','Önceki',e.slice(0,m.simdi).map(x=>[x.key,x.ad]).reverse(),e[m.onceki].key)+'<span class="ee-ok" aria-hidden="true">→</span>'+
    sel('eeSimdi','Şimdiki',e.slice(1).map(x=>[x.key,x.ad]).reverse(),e[m.simdi].key)+'</div>'+
    secim('pencere',m.pencere,PENCERELER,'Etüt aralığı')+'</div>';
}
function cumle(m){
  const e=m.sinavlar[m.simdi],o=m.sinavlar[m.onceki],h=m.hepsi,k=m.kontrol,b=t=>'<b>'+t+'</b>';
  const bas=kacis(o.ad)+' → '+kacis(e.ad)+' ('+gunAy(o.gun)+' → '+gunAy(e.gun)+') · '+kacis(m.ders)+' · '+pencereYazi(m.pencere)+' ';
  if(!h.alan.n)return bas+'hiçbir öğrenci etüt almamış; iki denemede de neti olan öğrenci için etüt kaydı yok.';
  if(!k.n)return bas+b(fi(h.alan.n))+' öğrenci etüt aldı; etüt almayan öğrenci kalmadığı için karşılaştırma yok.';
  return bas+'etüt alan '+b(fi(h.alan.n))+' öğrencinin neti '+b(ok(h.alan.ort))+' (önceki '+f2(h.alan.once)+'), almayan '+b(fi(k.n))+' öğrencinin neti '+b(ok(k.ort))+' (önceki '+f2(k.once)+'): fark '+b(isaret(h.fark)+' net')+
    (h.yeterli?'':' · gruplardan biri '+EN_AZ+' öğrenciden az, dikkatli yorumlayın')+'.';
}
function ozetKartlari(m){
  const h=m.hepsi,k=m.kontrol,kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const net=(g,yazi)=>g.n?hap(g.ort,f2(Math.abs(g.ort))+' net')+'<span class="mini">'+yazi+f2(g.once)+' → '+f2(g.simdi)+'</span>':'<span class="mini">öğrenci yok</span>';
  return '<div class="et-ozet">'+
    kart('Etüt alan öğrenci',fi(h.alan.n),net(h.alan,'önceki → şimdiki: '))+
    kart('Etüt almayan öğrenci',fi(k.n),net(k,'önceki → şimdiki: '))+
    kart('Fark (alan − almayan)',h.fark===null?'—':isaret(h.fark),h.fark===null?'<span class="mini">karşılaştırma yok</span>':hap(h.fark,h.anlamli?'belirgin fark':h.yeterli?'belirgin değil':'az öğrenci')+'<span class="mini">±'+(h.yari===null?'—':f2(h.yari))+' (%95)</span>')+
    kart('Etüt alan başına etüt',h.alan.n?f2(h.etut):'—','<span class="mini">'+kacis(m.ders)+' · '+pencereYazi(m.pencere)+'</span>')+'</div>';
}
// A bar either side of zero, scaled to the largest difference on the page.
const cubuk=(v,ust)=>v===null?'':'<span class="ee-fark" aria-hidden="true"><span class="eksi">'+(v<0?'<i style="width:'+Math.round(Math.min(1,-v/ust)*100)+'%"></i>':'')+'</span><span class="arti">'+(v>0?'<i style="width:'+Math.round(Math.min(1,v/ust)*100)+'%"></i>':'')+'</span></span>';
// Fark comes right after the number who took etüt, so a narrow screen shows it before the wide columns hide.
function hocaTablosu(m,secili){
  const ust=Math.max(1,...m.hocalar.map(h=>Math.abs(h.fark??0))),n=v=>v===null||v===undefined?'—':f2(v);
  const hucreler=h=>'<td class="sayi">'+fi(h.alan.n)+'</td><td class="sayi'+yonlu(h.fark)+'"><b>'+(h.fark===null?'—':isaret(h.fark))+'</b>'+cubuk(h.fark,ust)+'</td>'+
    '<td class="sayi'+yonlu(h.alan.ort)+'">'+ok(h.alan.ort)+'</td><td class="sayi">'+fi(h.kontrol.n)+'</td><td class="sayi et-dar-gizle'+yonlu(h.kontrol.ort)+'">'+ok(h.kontrol.ort)+'</td>'+
    '<td class="sayi et-dar-gizle">'+(h.yari===null?'—':'±'+f2(h.yari))+(h.yeterli?'':' <span class="mini" title="'+EN_AZ+' öğrenciden az">az</span>')+'</td><td class="sayi et-dar-gizle">'+n(h.etut)+'</td>'+
    '<td class="sayi et-dar-gizle">'+n(h.alan.once)+'</td><td class="sayi et-dar-gizle">'+n(h.kontrol.once)+'</td>';
  const satir=h=>'<tr'+(secili===h.key?' class="secili"':'')+'><td class="tg-ad"><button type="button" class="ee-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button></td>'+hucreler(h)+'</tr>';
  const sutun=[['Öğretmen'],['Etüt alan','sayi'],['Fark','sayi'],['Net değişimi','sayi'],['Almayan','sayi'],['Net değişimi','sayi et-dar-gizle'],['±%95','sayi et-dar-gizle'],['Etüt / öğrenci','sayi et-dar-gizle'],['Önceki net (alan)','sayi et-dar-gizle'],['Önceki net (almayan)','sayi et-dar-gizle']];
  return '<section class="et-panel" id="eeHocalar"><div class="et-kart-bas"><h2>'+kacis('Öğretmenlere göre · '+m.ders)+'</h2><span class="mini">bir öğretmene basınca öğrenciler o öğretmenin etüt alanlarıyla sınırlanır</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+sutun.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead><tbody>'+
    (m.hocalar.length?'<tr class="ee-hepsi"><td class="tg-ad">Herhangi bir etüt</td>'+hucreler(m.hepsi)+'</tr>'+m.hocalar.map(satir).join(''):'<tr><td colspan="10" class="mini">Bu aralıkta etüt alan öğrenci yok.</td></tr>')+
    '</tbody></table></div></section>';
}
function dozTablosu(m){
  const k=m.kontrol;
  return '<section class="et-panel" id="eeDoz"><div class="et-kart-bas"><h2>'+kacis('Etüt sayısına göre · '+m.ders)+'</h2><span class="mini">'+pencereYazi(m.pencere)+' alınan etüt</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr><th>Etüt sayısı</th><th class="sayi">Öğrenci</th><th class="sayi et-dar-gizle">Önceki net</th><th class="sayi et-dar-gizle">Şimdiki net</th><th class="sayi">Net değişimi</th><th class="sayi">Etüt almayanlara göre</th></tr></thead><tbody>'+
    m.doz.map(d=>'<tr><td>'+kacis(d.ad)+'</td><td class="sayi">'+fi(d.n)+'</td><td class="sayi et-dar-gizle">'+(d.once===null?'—':f2(d.once))+'</td><td class="sayi et-dar-gizle">'+(d.simdi===null?'—':f2(d.simdi))+'</td><td class="sayi'+yonlu(d.ort)+'">'+ok(d.ort)+'</td>'+
      '<td class="sayi'+(d.k&&d.n&&k.n?yonlu(r2(d.ort-k.ort)):'')+'">'+(d.k&&d.n&&k.n?isaret(r2(d.ort-k.ort)):'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
// Every exam pair of the grade and session: each teacher's difference per exam, then its mean over the exams.
function seriTablosu(m){
  const s=m.seri;if(!s.satirlar.length)return '';
  const ust=Math.max(1,...s.satirlar.flatMap(r=>r.hucre.map(x=>x&&x.fark!==null?Math.abs(x.fark):0)));
  return '<section class="et-panel" id="eeSeri"><div class="et-kart-bas"><h2>'+kacis('Denemeler boyunca · '+m.ders)+'</h2><span class="mini">her sütun, o denemeyle önceki deneme arasındaki fark (etüt alan − almayan)</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo ee-seri"><thead><tr><th>Öğretmen</th>'+s.sinavlar.map(e=>'<th class="sayi" title="'+kacis(e.onceki+' → '+e.ad)+'">'+kacis(e.ad)+'</th>').join('')+'<th class="sayi">Ortalama</th><th class="sayi et-dar-gizle">Öğrenci</th></tr></thead><tbody>'+
    s.satirlar.map(r=>'<tr><td class="tg-ad">'+kacis(r.ad)+'</td>'+r.hucre.map(x=>x&&x.fark!==null?'<td class="sayi'+yonlu(x.fark)+(x.yeterli?'':' ee-az')+'" title="'+fi(x.n)+' etüt alan, '+fi(x.k)+' almayan">'+isaret(x.fark)+'</td>':'<td class="sayi mini">—</td>').join('')+
      '<td class="sayi'+yonlu(r.ort)+'"><b>'+(r.ort===null?'—':isaret(r.ort))+'</b></td><td class="sayi et-dar-gizle">'+fi(r.n)+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="mini">Ortalama, denemelerin farklarının etüt alan öğrenci sayısıyla ağırlıklı ortalamasıdır; soluk sayılar '+EN_AZ+' öğrenciden az bir gruba aittir.</p></section>';
}
function ogrenciTablosu(m,secili){
  const hoca=new Map(m.hocalar.map(h=>[h.key,h.ad]));
  const l=m.satir.filter(r=>secili?r.hoca[secili]:r.n>0).sort((a,b)=>b.n-a.n||b.fark-a.fark||a.ad.localeCompare(b.ad,'tr'));
  return '<section class="et-panel" id="eeOgrenciler"><div class="et-kart-bas"><h2>'+kacis('Etüt alan öğrenciler · '+m.ders)+(secili?' · '+kacis(hoca.get(secili)||''):'')+'</h2>'+
    (secili?'<button type="button" class="et-dugme" data-ee-hoca="">Tüm öğretmenler</button>':'<span class="mini">'+fi(l.length)+' öğrenci</span>')+'</div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr><th>Öğrenci</th><th class="et-dar-gizle">Şube</th><th>Etüt</th><th class="sayi et-dar-gizle">Önceki</th><th class="sayi et-dar-gizle">Şimdiki</th><th class="sayi">Net değişimi</th></tr></thead><tbody>'+
    (l.length?l.map(r=>'<tr><td class="tg-ad">'+kacis(kisiAdi(r.ad))+'</td><td class="et-dar-gizle">'+kacis(r.sinif||'—')+'</td><td>'+fi(r.n)+' <span class="mini et-dar-gizle">'+kacis(Object.keys(r.hoca).map(k=>(hoca.get(k)||k)+(r.hoca[k]>1?' ×'+r.hoca[k]:'')).join(', '))+'</span></td>'+
      '<td class="sayi et-dar-gizle">'+f2(r.once)+'</td><td class="sayi et-dar-gizle">'+f2(r.simdi)+'</td><td class="sayi'+yonlu(r.fark)+'">'+ok(r.fark)+'</td></tr>').join(''):'<tr><td colspan="6" class="mini">Öğrenci yok.</td></tr>')+
    '</tbody></table></div></section>';
}
function notPaneli(){
  return '<section class="et-panel ee-not" id="eeNot"><h2>Nasıl okunur?</h2><ul>'+
    '<li>Her öğrencinin seçilen dersteki neti iki denemede karşılaştırılır; ikisinde de neti olan öğrenciler sayılır.</li>'+
    '<li><b>Etüt alan</b>, seçilen aralıkta o dersten (o öğretmenden) en az bir etüt almış; <b>almayan</b> o dersten hiç etüt almamıştır. Etüt günü sınav günü sayılmaz.</li>'+
    '<li>Fark, iki grubun ortalama net değişiminin farkıdır; denemenin zorluğu iki grubu da aynı etkilediği için fark bunu dışarıda bırakır. ±, farkın yaklaşık %95 aralığıdır: fark bunu aşmıyorsa tesadüf olabilir.</li>'+
    '<li>Bu bir ilişkidir, kesin neden-sonuç değil: etüte gelen öğrenciler baştan farklı olabilir (örneğin daha düşük netten başlayanlar daha çok yükselir). Başlangıç netleri bunun için yan yana yazılır.</li></ul></section>';
}
function icerik(){
  const baslik='<h1 class="et-baslik">Etüt etkisi</h1>',git=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
  let ogr;try{ogr=OGRENCI_RAPOR.model().students}catch(e){return '<header class="et-bas">'+baslik+'</header><p class="et-uyari">'+kacis(e.message)+'</p>'}
  const m=model(ogr,secimler());
  const bos=(yazi)=>'<header class="et-bas">'+baslik+'</header><section class="et-panel et-bos"><b>'+yazi[0]+'</b><p>'+yazi[1]+'</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+git('etutler','Etütler')+'</div></section>';
  if(m.durum==='bos')return bos(['Henüz veri yok','Etüt etkisi için deneme sonuç listelerini Sıralamalar’a, etüt raporunu Etütler’e ekleyin.']);
  if(m.durum==='az')return '<header class="et-bas">'+baslik+'</header>'+(m.duzeyler.length>1?'<div class="et-arac">'+secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf')+'</div>':'')+
    '<section class="et-panel et-bos"><b>İki deneme gerekli</b><p>'+m.duzey+'. sınıf için aynı oturumda en az iki deneme sonucu olmalı.</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+'</div></section>';
  const ust='<header class="et-bas">'+baslik+(m.durum==='tamam'?'<p class="et-cumle">'+cumle(m)+'</p>':'')+'</header>';
  if(m.durum==='etutyok'){
    const e=m.sinavlar;
    return ust+arac(m)+
      '<section class="et-panel et-bos"><b>Bu iki deneme arasında etüt kaydı yok</b><p>'+kacis(e[m.onceki].ad)+' → '+kacis(e[m.simdi].ad)+' arasında bu oturumun derslerinden etüt alan öğrenci bulunamadı. Etüt raporunun tarih aralığını ve öğrenci adlarının denemelerle eşleştiğini kontrol edin.</p><div class="et-arac">'+git('etutler','Etütler')+'</div></section>';
  }
  const secili=m.hocalar.some(h=>h.key===EK.eeHoca)?EK.eeHoca:'';
  return ust+arac(m)+ozetKartlari(m)+hocaTablosu(m,secili)+dozTablosu(m)+seriTablosu(m)+ogrenciTablosu(m,secili)+notPaneli();
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
return {model,cift,netAl,etutOturum,icerik,gorunum,PENCERELER,NET,EN_AZ};
})();
function gorunumEtutEtki(){return ETUT_ETKI.gorunum()}
