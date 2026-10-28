// Embedded in index.html by scripts/embed-etutetkisi.cjs. No student data belongs here.
// Etüt etkisi (teacher only): how did every student progress through ALL their mock exams in a lesson, and how does
// that relate to the etüts of that lesson they took? It reads the merged students of Öğrenci raporları' base
// (OGRENCI_RAPOR.temelOgrenciler: exams with every lesson's net, etüt sessions with date, lesson and teacher), so
// nothing is stored, uploaded or sent to students.
// A student's progress is the slope of the least-squares line through their nets in the lesson over the exams of the
// chosen period (net per exam; the exam's place in the grade's list is the x, so a missed exam keeps its spacing);
// the total progress is that slope times the exams between their first and last. Students with two or more exams in
// the lesson count; the rest are listed apart with the reason. The etüts of the lesson over the period (exam days
// themselves not counted) sort the counted students into four fixed groups (none, 1–2, 3–5, 6+) and by teacher.
// The page is a comparison, not proof: see docs/etut-etkisi.md.
const ETUT_ETKI = (() => {
const OTURUMLAR=['TYT','AYT'];
const EN_AZ=5;
const SON_DENEME=4;
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
// The four fixed groups by the number of etüts of the lesson over the period; c is the colour token of the chart line.
const GRUPLAR=[
  {k:'yok',ad:'Etüt yok',kisa:'etüt almayan',c:1,uygun:n=>n===0},
  {k:'1-2',ad:'1–2 etüt',kisa:'1–2',c:2,uygun:n=>n>=1&&n<=2},
  {k:'3-5',ad:'3–5 etüt',kisa:'3–5',c:3,uygun:n=>n>=3&&n<=5},
  {k:'6+',ad:'6+ etüt',kisa:'6+',c:4,uygun:n=>n>=6}];
const DONEMLER=[['tum','Tümü'],['son4','Son '+SON_DENEME+' deneme']];
// The keys of a lesson's net in a student's exam (Öğrenci raporları), by session.
const NET={
  TYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['turkce'],'Coğrafya':['cografya'],Tarih:['tarih'],Felsefe:['felsefe'],'Din Kültürü':['din']},
  AYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['edebiyat'],'Coğrafya':['cografya1','cografya2'],Tarih:['tarih1','tarih2'],Felsefe:['felsefe'],'Din Kültürü':['din']}};

/* ---------------- small helpers ---------------- */
const U=s=>String(s??'').replace(/\s+/g,' ').trim().normalize('NFKC').toLocaleUpperCase('tr-TR');
const kisiAdi=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const r2=x=>Math.round(x*100)/100;
const r1=x=>Math.round(x*10)/10;
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const ok=v=>v===null||v===undefined?'—':(v>0?'▲':v<0?'▼':'')+f2(Math.abs(v));
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const ort=l=>l.length?l.reduce((t,x)=>t+x,0)/l.length:null;
const ortR=l=>l.length?r2(ort(l)):null;
const gunAy=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const duzeyAl=c=>{const m=/^(\d{1,2})\s*[/-]/.exec(String(c||'').trim());return m?Number(m[1]):null};
// "24'ü", "7'si", "15'i": the number with its possessive ending, by how the number is read.
function sahip(n){
  const son=n%10,onlar=Math.floor(n/10)%10;let ek;
  if(n>0&&n%100===0)ek='ü';
  else if(son)ek=['','i','si','ü','ü','i','sı','si','i','u'][son];
  else ek=onlar?['','u','si','u','ı','si','ı','i','i','ı'][onlar]:'ı';
  return n+'’'+ek;
}

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
// The least-squares slope through points [[x, y], …]: y gained per unit of x. null with fewer than two points.
function egim(points){
  const l=(points||[]).filter(p=>p&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(l.length<2)return null;
  const mx=ort(l.map(p=>p[0])),my=ort(l.map(p=>p[1]));let sxy=0,sxx=0;
  for(const p of l){sxy+=(p[0]-mx)*(p[1]-my);sxx+=(p[0]-mx)**2}
  return sxx?sxy/sxx:null;
}
// One student's progress in a lesson over the exams ex: the nets by exam (null = no net), the slope per exam, the
// total (slope × exams between the first and last they took), the first and last net, and the exams they sat.
function ogrenciGelisim(s,ex,oturum,ders){
  const netler=ex.map(e=>netAl(s,e,oturum,ders)),noktalar=[];netler.forEach((v,i)=>{if(v!==null)noktalar.push([i,v])});
  const anahtar=new Set(ex.map(e=>e.key)),girdi=new Set((s.exams||[]).filter(e=>e.session===oturum&&e.date&&anahtar.has(sinavAnahtari(e))).map(sinavAnahtari)).size;
  const e=egim(noktalar),ilk=noktalar.length?noktalar[0]:null,son=noktalar.length?noktalar[noktalar.length-1]:null;
  return {netler,girdi,deneme:noktalar.length,egim:e,toplam:e===null?null:e*(son[0]-ilk[0]),ilk:ilk&&ilk[1],son:son&&son[1]};
}
// The etüts of a lesson a student took strictly between two days (the exam days themselves are not counted),
// in total and by teacher.
function ogrenciEtut(s,oturum,ders,bas,son){
  const hoca={};let n=0;
  for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date);
    if(g<=bas||g>=son||ETUT.dersAdi(x.course)!==ders||!etutOturum(x.course,oturum))continue;
    const k=U(x.teacher)||'?';n++;hoca[k]=(hoca[k]||0)+1;
  }
  return {n,hoca};
}
// The days of the weeks (Monday first) from the first to the last exam, each with the etüts of the lesson in it.
function haftalikEtut(ogr,oturum,ders,bas,son){
  const hafta=new Map();
  for(let g=bas-haftaGunu(bas);g<=son;g+=7)hafta.set(g,0);
  for(const s of ogr)for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date);
    if(g<=bas||g>=son||ETUT.dersAdi(x.course)!==ders||!etutOturum(x.course,oturum))continue;
    const h=g-haftaGunu(g);hafta.set(h,(hafta.get(h)||0)+1);
  }
  return [...hafta].map(([h,n])=>({bas:h,son:h+6,n}));
}
// sec: {duzey, oturum, ders, donem ('tum' or 'son4'), hoca}; kapsam: the [first, last] days of the added etüt reports.
// The default period is every exam of the grade and session; 'son4' keeps the last four.
function model(ogr,sec={},kapsam){
  const L=(ogr||[]).filter(s=>s&&Array.isArray(s.exams)),say=new Map();
  for(const s of L){const d=duzeyAl(s.cls);if(!d||!s.exams.length)continue;const o=say.get(d)||{d,etut:0};o.etut+=(s.sessions||[]).length;say.set(d,o)}
  const duzeyler=[...say.keys()].sort((a,b)=>b-a);
  if(!duzeyler.length)return {durum:'bos'};
  // The grade whose students took the most etüts is the default.
  const duzey=duzeyler.includes(sec.duzey)?sec.duzey:[...say.values()].sort((a,b)=>b.etut-a.etut||b.d-a.d)[0].d;
  const ogrD=L.filter(s=>duzeyAl(s.cls)===duzey),oturumlar=OTURUMLAR.filter(o=>sinavListesi(ogrD,o).length>=2);
  if(!oturumlar.length)return {durum:'az',duzeyler,duzey,oturumlar,oturum:null};
  const oturum=oturumlar.includes(sec.oturum)?sec.oturum:oturumlar[0],tum=sinavListesi(ogrD,oturum);
  const donem=sec.donem==='son4'?'son4':'tum',ex=donem==='son4'?tum.slice(-SON_DENEME):tum,bas=ex[0].gun,son=ex[ex.length-1].gun;
  // The lessons with an etüt in the period, most first.
  const ara=new Map();
  for(const s of ogrD)for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date),d=ETUT.dersAdi(x.course);
    if(g>bas&&g<son&&NET[oturum][d]&&etutOturum(x.course,oturum))ara.set(d,(ara.get(d)||0)+1);
  }
  const dersler=[...ara].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(([ders,n])=>({ders,n}));
  const taban={durum:'tamam',duzeyler,duzey,oturumlar,oturum,donem,sinavlar:ex,dersler};
  if(!dersler.length)return {...taban,durum:'etutyok',ders:null};
  const ders=dersler.some(x=>x.ders===sec.ders)?sec.ders:dersler[0].ders;
  const satir=[],disarida=[],adlar=new Map();
  for(const s of ogrD){
    const g=ogrenciGelisim(s,ex,oturum,ders);
    if(g.egim===null){
      disarida.push({id:s.id,ad:s.name,sinif:s.cls,neden:g.girdi<2?(g.girdi?'yalnızca 1 denemeye girdi':'bu dönemde denemeye girmedi'):'bu dersin neti yok'});continue;
    }
    const e=ogrenciEtut(s,oturum,ders,bas,son);
    for(const k of Object.keys(e.hoca))if(!adlar.has(k)){
      const x=(s.sessions||[]).find(y=>(U(y.teacher)||'?')===k);adlar.set(k,kisiAdi(x&&x.teacher)||'Öğretmen belirtilmemiş');
    }
    satir.push({id:s.id,ad:s.name,sinif:s.cls,n:e.n,hoca:e.hoca,deneme:g.deneme,netler:g.netler,ilk:g.ilk,son:g.son,ham:g});
  }
  const seriOrt=l=>ex.map((_,i)=>{const v=l.map(r=>r.netler[i]).filter(x=>x!==null);return v.length?{ort:r2(ort(v)),n:v.length}:null});
  const sinifEgim=ort(satir.map(r=>r.ham.egim));
  const gruplar=GRUPLAR.map(t=>{
    const l=satir.filter(r=>t.uygun(r.n));
    return {k:t.k,ad:t.ad,kisa:t.kisa,c:t.c,n:l.length,az:l.length<EN_AZ,etut:ortR(l.map(r=>r.n)),ilk:ortR(l.map(r=>r.ilk)),son:ortR(l.map(r=>r.son)),
      egim:ortR(l.map(r=>r.ham.egim)),toplam:ortR(l.map(r=>r.ham.toplam)),seri:seriOrt(l)};
  });
  // Each teacher who gave the lesson in the period: the counted students who took it from them.
  const hocalar=[...adlar].map(([key,ad])=>{
    const l=satir.filter(r=>r.hoca[key]);
    return {key,ad,n:l.length,etut:r2(l.reduce((t,r)=>t+r.hoca[key],0)/l.length),egim:ortR(l.map(r=>r.ham.egim)),
      fark:sinifEgim===null?null:r2(ort(l.map(r=>r.ham.egim))-sinifEgim),ortak:l.filter(r=>Object.keys(r.hoca).length>1).length};
  });
  // Ranked by the difference from the class, largest first; ties share a rank (1, 1, 3). A teacher with fewer than EN_AZ
  // counted students has no rank and comes after the ranked ones.
  const farkSayi=h=>h.fark===null?-Infinity:h.fark;
  hocalar.sort((a,b)=>(a.n<EN_AZ)-(b.n<EN_AZ)||farkSayi(b)-farkSayi(a)||b.n-a.n||a.ad.localeCompare(b.ad,'tr'));
  hocalar.forEach((h,i)=>{h.az=h.n<EN_AZ;h.sira=h.az?null:i>0&&!hocalar[i-1].az&&hocalar[i-1].fark===h.fark?hocalar[i-1].sira:i+1});
  const ogrenciler=satir.map(({ham,...r})=>({...r,egim:r2(ham.egim),toplam:r2(ham.toplam),_egim:ham.egim}));
  return {...taban,ders,ogrenciler,disarida,toplamOgrenci:ogrD.length,
    sinif:{n:satir.length,egim:sinifEgim===null?null:r2(sinifEgim),toplam:ortR(satir.map(r=>r.ham.toplam)),seri:seriOrt(satir)},
    gruplar,hocalar,haftalik:haftalikEtut(ogrD,oturum,ders,bas,son),eksik:eksikGun(bas,son,kapsam)};
}

/* ---------------- chart ---------------- */
// Ticks for a range: about n steps of 1, 2, 2.5 or 5 (times a power of ten).
function tikler(lo,hi,n){
  const ham=(hi-lo||1)/n,us=10**Math.floor(Math.log10(ham)),adim=[1,2,2.5,5,10].map(k=>k*us).find(a=>a>=ham)||10*us,l=[];
  for(let v=Math.floor(lo/adim)*adim;v<hi+adim*.999;v+=adim){l.push(Math.round(v*1e6)/1e6);if(l.length>12)break}
  return l;
}
const yaziGen=t=>String(t).length*6.8+4;
// One line per group with etüts (the groups' mean net in each exam) and the grade's mean dashed, on the real spacing
// of the exam dates; each line is named at its right end with its latest value. Beneath, on the same dates, the
// weekly etüt count of the lesson from zero. W is the box's real width in pixels, so the type is real pixels too.
function grafikSvg(m,W){
  const ex=m.sinavlar,g0=ex[0].gun,g1=ex[ex.length-1].gun,dar=W<520;
  const seriler=m.gruplar.filter(g=>g.n>0).map(g=>({ad:g.ad,renk:'var(--e-c'+g.c+')',az:g.az,not:g.az?'('+g.n+' öğrenci)':'',deger:g.seri.map(s=>s&&s.ort)}));
  seriler.push({ad:'Sınıf',renk:'var(--e-ref)',kesik:true,az:false,not:'',deger:m.sinif.seri.map(s=>s&&s.ort)});
  for(const s of seriler){const i=s.deger.map(v=>v!==null).lastIndexOf(true);s.son=i;s.sonDeger=s.deger[i];s.yazi=s.ad+' · '+f2(s.sonDeger)}
  const hepsi=seriler.flatMap(s=>s.deger).filter(v=>v!==null),lo0=Math.min(...hepsi),hi0=Math.max(...hepsi),pay=Math.max(.5,(hi0-lo0)*.12);
  const tik=tikler(lo0-pay,hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1];
  const etiketGen=Math.max(...seriler.map(s=>Math.max(yaziGen(s.yazi),s.not?yaziGen(s.not):0))),L=Math.max(...tik.map(t=>yaziGen(Number.isInteger(t)?fi(t):String(t).replace('.',',')))) +8,
    R=Math.max(L+120,W-etiketGen-26),ust=14,ph=dar?200:240,alt=ust+ph;
  const x=g=>L+(g1===g0?.5:(g-g0)/(g1-g0))*(R-L),y=v=>alt-(v-lo)/(hi-lo)*ph;
  const sol=ust+ph+22,sUst=sol+14,taban=sUst+54,H=taban+10;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Denemelere göre ortalama net ve haftalık etüt sayısı">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+(Number.isInteger(t)?fi(t):String(t).replace('.',','))+'</text>').join('');
  // The exam dates: a faint line each and a label that is skipped when it would touch its neighbour.
  let sonX=-99;const yazilan=[];
  ex.forEach(e=>{const cx=x(e.gun);if(cx-sonX>=48){yazilan.push(e);sonX=cx}else if(e===ex[ex.length-1]){yazilan.pop();yazilan.push(e);sonX=cx}});
  svg+=ex.map(e=>'<line class="et-izgara ee-sinav" x1="'+r1(x(e.gun))+'" x2="'+r1(x(e.gun))+'" y1="'+ust+'" y2="'+taban+'"/>').join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+=yazilan.map(e=>'<text class="et-tik" x="'+r1(x(e.gun))+'" y="'+(alt+17)+'" text-anchor="middle">'+gunAy(e.gun)+'</text>').join('');
  // Lines: gaps where a group has no mean in an exam.
  const cizgi=s=>{
    const pts=s.deger.map((v,i)=>v===null?null:[x(ex[i].gun),y(v)]);let out='',run=[];
    const bitir=()=>{if(run.length>1)out+='<path class="ee-cizgi'+(s.kesik?' kesik':'')+(s.az?' az':'')+'" style="stroke:'+s.renk+'" d="'+GRAFIK_CIZGI.yol(run)+'"/>';run=[]};
    pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
    return out+pts.map((p,i)=>p?'<circle class="ee-nokta'+(s.az?' az':'')+'" cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="'+(s.kesik?3:4)+'" style="fill:'+s.renk+'"><title>'+kacis(ex[i].etiket+' · '+s.ad+' · '+f2(s.deger[i])+' net')+'</title></circle>':'').join('');
  };
  svg+=seriler.filter(s=>s.kesik).map(cizgi).join('')+seriler.filter(s=>!s.kesik).map(cizgi).join('');
  // Direct labels at the right end, pushed apart when two lines end close together.
  const blok=seriler.map(s=>({s,h:s.not?28:15,ideal:y(s.sonDeger)})).sort((a,b)=>a.ideal-b.ideal);
  let alta=ust-8;for(const b of blok){b.ust=Math.max(b.ideal-7.5,alta+3);alta=b.ust+b.h}
  const tasma=alta-(alt+8);if(tasma>0)for(let i=blok.length-1;i>=0;i--){const kalan=i===blok.length-1?alt+8:blok[i+1].ust-3;blok[i].ust=Math.min(blok[i].ust,kalan-blok[i].h)}
  for(const b of blok){
    const s=b.s,ly=b.ust+7.5,ex_=x(ex[s.son].gun);
    if(Math.abs(ly-b.ideal)>2||ex_<R-1)svg+='<line class="ee-bag" style="stroke:'+s.renk+'" x1="'+r1(ex_+5)+'" y1="'+r1(b.ideal)+'" x2="'+r1(R+10)+'" y2="'+r1(ly)+'"/>';
    svg+='<g class="ee-etiket'+(s.az?' az':'')+'"><circle cx="'+r1(R+14)+'" cy="'+r1(ly)+'" r="'+(s.kesik?0:4)+'" style="fill:'+s.renk+'"/>'+(s.kesik?'<line x1="'+r1(R+9)+'" x2="'+r1(R+19)+'" y1="'+r1(ly)+'" y2="'+r1(ly)+'" style="stroke:'+s.renk+';stroke-width:2;stroke-dasharray:3 2"/>':'')+
      '<text class="ee-ad" x="'+r1(R+24)+'" y="'+r1(ly)+'" dy="0.32em">'+kacis(s.yazi)+'</text>'+(s.not?'<text class="et-tik" x="'+r1(R+24)+'" y="'+r1(ly+13)+'" dy="0.32em">'+kacis(s.not)+'</text>':'')+'</g>';
  }
  // Weekly etüts, from zero, a bar for the days of the week that fall inside the exams' span.
  const hafta=m.haftalik,en=Math.max(1,...hafta.map(h=>h.n)),bh=34,bas=taban-bh;
  svg+='<text class="ee-baslik" x="'+r1(L)+'" y="'+(sUst-2)+'">Haftalık etüt</text>';
  svg+=hafta.map(h=>{
    const a=x(Math.max(h.bas,g0)),b=x(Math.min(h.son+1,g1)),hh=h.n/en*bh;if(b-a<3||!h.n)return '';
    return '<rect class="ee-cubuk" x="'+r1(a+1)+'" y="'+r1(taban-hh)+'" width="'+r1(b-a-2)+'" height="'+r1(hh)+'" rx="2"><title>'+kacis(gunAy(Math.max(h.bas,g0))+' – '+gunAy(Math.min(h.son,g1))+' · '+fi(h.n)+' etüt')+'</title></rect>'+
      (b-a>=22?'<text class="et-tik" x="'+r1((a+b)/2)+'" y="'+r1(taban-hh-4)+'" text-anchor="middle">'+fi(h.n)+'</text>':'');
  }).join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+taban+'" y2="'+taban+'"/>';
  return svg+'</svg>';
}
let SON=null,ZAMAN=null;
const etkin=()=>EK.sekme==='etutetki'&&rehberMi()&&!!document.getElementById?.('eeKok');
function grafikleriCiz(){
  if(!etkin()||!SON)return;
  const kutu=document.querySelector('#eeGrafik .et-grafik');if(!kutu)return;
  const W=Math.round(kutu.clientWidth);if(W<200)return;
  const m=SON,imza=[W,m.duzey,m.oturum,m.ders,m.donem,m.ogrenciler.length,m.sinif.egim,m.gruplar.map(g=>g.n+':'+g.egim).join(),m.haftalik.map(h=>h.n).join(),GRAFIK_CIZGI.tur()].join('|');
  if(kutu.dataset.imza===imza)return;
  kutu.dataset.imza=imza;kutu.innerHTML=grafikSvg(m,W);
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-ee-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const yonlu=v=>v===null||v===undefined?'':v>0?' et-yukari':v<0?' et-asagi':'';
function secimler(){return {duzey:EK.eeDuzey,oturum:EK.eeOturum,ders:EK.eeDers,donem:EK.eeDonem}}
function arac(m){
  const sel=(id,ad,l,deger)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+'">'+
    l.map(([v,yazi])=>'<option value="'+kacis(v)+'"'+(String(v)===String(deger)?' selected':'')+'>'+kacis(yazi)+'</option>').join('')+'</select></label>';
  return '<div class="et-arac">'+(m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (m.dersler.length?sel('eeDers','Ders',m.dersler.map(x=>[x.ders,x.ders+' · '+fi(x.n)+' etüt']),m.ders):'')+
    secim('donem',m.donem,DONEMLER,'Dönem')+'</div>';
}
// The finding in everyday words: the grade's progress per exam, then the group with the most etüts and the group with none.
function cumle(m){
  const e=m.sinavlar,b=t=>'<b>'+t+'</b>',s=m.sinif;
  const bas=m.duzey+'. sınıf · '+kacis(m.ders)+' · '+fi(e.length)+' deneme ('+gunAy(e[0].gun)+' – '+gunAy(e[e.length-1].gun)+') · ';
  if(!s.n)return bas+'bu derste en az iki denemesi olan öğrenci yok.';
  let t=bas+b(fi(s.n)+' öğrenci')+(r2(s.egim)===0?' her denemede ortalama '+b('aynı kaldı')+'.':' her denemede ortalama '+b(ok(s.egim)+' net')+' '+(s.egim>0?'arttı':'azaldı')+'.');
  const cok=[...m.gruplar].reverse().find(g=>g.k!=='yok'&&g.n>0),yok=m.gruplar[0].n>0?m.gruplar[0]:null,parca=[];
  if(cok)parca.push('en çok etüt alan ('+cok.kisa+') '+b(fi(cok.n)+' öğrenci')+' '+b(ok(cok.egim)));
  if(yok)parca.push('etüt almayan '+b(fi(yok.n)+' öğrenci')+' '+b(ok(yok.egim)));
  if(parca.length){const x=parca.join(', ');t+=' '+x[0].toLocaleUpperCase('tr-TR')+x.slice(1)+'.'}
  return t;
}
function sayimYazisi(m){
  const d=m.disarida.length;
  return d?fi(m.toplamOgrenci)+' öğrenciden '+sahip(m.sinif.n)+' sayıldı; '+sahip(d)+' dışarıda (aşağıda listelenir).':fi(m.toplamOgrenci)+' öğrencinin hepsi sayıldı.';
}
function sutunlar(l){return '<colgroup>'+l.map(c=>'<col class="'+c+'">').join('')+'</colgroup>'}
const baslikSatiri=l=>'<thead><tr>'+l.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead>';
function grafikPaneli(m){
  if(!m.sinif.n)return '';
  return '<section class="et-panel" id="eeGrafik"><div class="et-kart-bas"><h2>'+kacis('Denemelerde ortalama net · '+m.ders)+'</h2></div><div class="et-grafik ee-grafik" role="group" aria-label="Denemelere göre ortalama net"></div></section>';
}
function grupTablosu(m){
  const g=m.gruplar,bos='<td class="sayi">—</td>';
  const satir=x=>'<tr'+(x.az&&x.n?' class="ee-az"':'')+'><td class="tg-ad"><span class="et-renk" style="background:var(--e-c'+x.c+')"></span> '+kacis(x.ad)+(x.az&&x.n?' <span class="mini">('+fi(x.n)+' öğrenci)</span>':'')+'</td><td class="sayi">'+fi(x.n)+'</td>'+
    (x.n?'<td class="sayi et-dar-gizle">'+f2(x.etut)+'</td><td class="sayi et-dar-gizle">'+f2(x.ilk)+'</td><td class="sayi et-dar-gizle">'+f2(x.son)+'</td><td class="sayi'+yonlu(x.egim)+'">'+ok(x.egim)+'</td><td class="sayi'+yonlu(x.toplam)+'">'+ok(x.toplam)+'</td>':bos.repeat(2).replace(/class="sayi"/g,'class="sayi et-dar-gizle"')+'<td class="sayi et-dar-gizle">—</td>'+bos.repeat(2))+'</tr>';
  return '<section class="et-panel" id="eeGruplar"><div class="et-kart-bas"><h2>Etüt sayısına göre</h2></div><div class="et-tablo-kutu"><table class="et-tablo ee-tablo">'+sutunlar(['ad','s1','s2 et-dar-gizle','s3 et-dar-gizle','s3 et-dar-gizle','s4','s4'])+
    baslikSatiri([['Grup'],['Öğrenci','sayi'],['Etüt / öğrenci','sayi et-dar-gizle'],['İlk denemelerde net','sayi et-dar-gizle'],['Son denemelerde net','sayi et-dar-gizle'],['Deneme başına artış (net)','sayi'],['Toplam artış (net)','sayi']])+
    '<tbody>'+g.map(satir).join('')+'</tbody></table></div></section>';
}
function hocaTablosu(m,secili){
  const satir=h=>'<tr'+(secili===h.key?' class="secili'+(h.az?' ee-az':'')+'"':h.az?' class="ee-az"':'')+'><td class="sayi ee-sira">'+(h.sira===null?'—':fi(h.sira))+'</td><td class="tg-ad"><button type="button" class="ee-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button>'+
    (h.ortak?'<div class="mini">'+kacis(sahip(h.ortak))+' başka öğretmenden de aldı</div>':'')+'</td><td class="sayi">'+fi(h.n)+'</td><td class="sayi et-dar-gizle">'+f2(h.etut)+'</td><td class="sayi'+yonlu(h.egim)+'">'+ok(h.egim)+'</td><td class="sayi'+yonlu(h.fark)+'">'+ok(h.fark)+'</td></tr>';
  return '<section class="et-panel" id="eeHocalar"><div class="et-kart-bas"><h2>Öğretmenlere göre</h2><span class="mini">bir öğretmene basınca öğrenciler aşağıda o öğretmenin etüt verdikleriyle sınırlanır</span></div><div class="et-tablo-kutu"><table class="et-tablo ee-tablo">'+sutunlar(['sira','ad','s1','s2 et-dar-gizle','s4','s4'])+
    baslikSatiri([['Sıra','sayi ee-sira'],['Öğretmen'],['Öğrenci','sayi'],['Etüt / öğrenci','sayi et-dar-gizle'],['Deneme başına artış (net)','sayi'],['Sınıftan fazla / az (net)','sayi']])+
    '<tbody>'+(m.hocalar.length?m.hocalar.map(satir).join(''):'<tr><td colspan="6" class="mini">Bu dönemde etüt alan sayılan öğrenci yok.</td></tr>')+'</tbody></table></div></section>';
}
// A student's nets over the exams of the period as a small line, green when rising and red when falling.
function kucukCizgi(r){
  const v=r.netler.filter(x=>x!==null),n=r.netler.length,G=84,Y=22,lo=Math.min(...v),hi=Math.max(...v);
  const x=i=>2+(G-4)*(n>1?i/(n-1):.5),y=a=>Y-3-(hi===lo?.5:(a-lo)/(hi-lo))*(Y-6),renk=r.egim>0?'var(--e-ok)':r.egim<0?'var(--e-bad)':'var(--e-muted)';
  const pts=r.netler.map((a,i)=>a===null?null:[x(i),y(a)]);let yol_='',run=[];
  const bitir=()=>{if(run.length>1)yol_+='<path class="et-kucuk" style="stroke:'+renk+'" d="M'+run.map(p=>r1(p[0])+','+r1(p[1])).join('L')+'"/>';run=[]};
  pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
  return '<svg viewBox="0 0 '+G+' '+Y+'" width="'+G+'" height="'+Y+'" aria-hidden="true">'+yol_+pts.map(p=>p?'<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="2" style="fill:'+renk+'"/>':'').join('')+'</svg>';
}
function ogrenciTablosu(m,secili){
  const hoca=new Map(m.hocalar.map(h=>[h.key,h.ad]));
  const l=m.ogrenciler.filter(r=>!secili||r.hoca[secili]).sort((a,b)=>b.n-a.n||b._egim-a._egim||a.ad.localeCompare(b.ad,'tr'));
  const satir=r=>'<tr><td class="tg-ad">'+kacis(kisiAdi(r.ad))+'</td><td class="et-dar-gizle">'+kacis(r.sinif||'—')+'</td><td class="sayi">'+fi(r.n)+'</td><td class="sayi et-dar-gizle">'+fi(r.deneme)+'</td>'+
    '<td class="sayi'+yonlu(r.egim)+'">'+ok(r.egim)+'</td><td class="sayi et-dar-gizle'+yonlu(r.toplam)+'">'+ok(r.toplam)+'</td><td class="et-trend">'+kucukCizgi(r)+'</td></tr>';
  const disarida=m.disarida.length?'<details id="eeDisarida"><summary>Dışarıda kalan '+fi(m.disarida.length)+' öğrenci</summary><ul>'+
    m.disarida.slice().sort((a,b)=>a.ad.localeCompare(b.ad,'tr')).map(d=>'<li>'+kacis(kisiAdi(d.ad))+' · '+kacis(d.sinif||'—')+' · '+kacis(d.neden)+'</li>').join('')+'</ul></details>':'';
  return '<section class="et-panel" id="eeOgrenciler"><div class="et-kart-bas"><h2>'+kacis('Öğrenciler'+(secili?' · '+(hoca.get(secili)||''):''))+'</h2>'+
    (secili?'<button type="button" class="et-dugme" data-ee-hoca="">Tüm öğretmenler</button>':'<span class="mini">'+fi(l.length)+' öğrenci</span>')+'</div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo ee-tablo ee-ogr">'+sutunlar(['ad','s5 et-dar-gizle','s1','s1 et-dar-gizle','s4','s4 et-dar-gizle','s6'])+
    baslikSatiri([['Öğrenci'],['Şube','et-dar-gizle'],['Etüt sayısı','sayi'],['Deneme sayısı','sayi et-dar-gizle'],['Deneme başına artış (net)','sayi'],['Toplam artış (net)','sayi et-dar-gizle'],['Netler']])+
    '<tbody>'+(l.length?l.map(satir).join(''):'<tr><td colspan="7" class="mini">Öğrenci yok.</td></tr>')+'</tbody></table></div>'+disarida+'</section>';
}
function icerik(){
  const baslik='<h1 class="et-baslik">Etüt etkisi</h1>',git=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
  let t;try{t=OGRENCI_RAPOR.temelOgrenciler()}catch(e){SON=null;return '<header class="et-bas">'+baslik+'</header><p class="et-uyari">'+kacis(e.message)+'</p>'}
  const m=model(t.students,secimler(),t.etutKapsam);SON=m.durum==='tamam'?m:null;
  const uyari=(t.warnings||[]).length?'<p class="mini ee-durum" id="eeDurum">Eşleştirme: '+kacis(t.warnings.slice(0,3).join(' '))+(t.warnings.length>3?' (+'+fi(t.warnings.length-3)+')':'')+'</p>':'';
  const bos=(yazi)=>'<header class="et-bas">'+baslik+'</header><section class="et-panel et-bos"><b>'+yazi[0]+'</b><p>'+yazi[1]+'</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+git('etutler','Etütler')+'</div></section>';
  if(m.durum==='bos')return bos(['Henüz veri yok','Etüt etkisi için deneme sonuç listelerini Sıralamalar’a, etüt raporunu Etütler’e ekleyin.']);
  if(m.durum==='az')return '<header class="et-bas">'+baslik+'</header>'+(m.duzeyler.length>1?'<div class="et-arac">'+secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf')+'</div>':'')+
    '<section class="et-panel et-bos"><b>İki deneme gerekli</b><p>'+m.duzey+'. sınıf için aynı oturumda en az iki deneme sonucu olmalı.</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+'</div></section>';
  if(m.durum==='etutyok'){
    const e=m.sinavlar;
    return '<header class="et-bas">'+baslik+'</header>'+arac(m)+uyari+
      '<section class="et-panel et-bos"><b>Dönemde etüt kaydı yok</b><p>'+kacis(e[0].etiket)+' – '+kacis(e[e.length-1].etiket)+' arasında bu oturumun derslerinden etüt alan öğrenci bulunamadı. Etüt raporunun tarih aralığını ve öğrenci adlarının denemelerle eşleştiğini kontrol edin.</p><div class="et-arac">'+git('etutler','Etütler')+'</div></section>';
  }
  const kapsamUyari=m.eksik?'<p class="et-uyari" id="eeKapsam">Etüt raporları bu dönemin '+fi(m.eksik)+' iş gününü kapsamıyor; o günlerin etütleri kayıtlı değil, etüt sayıları eksik olabilir.</p>':'';
  const secili=m.hocalar.some(h=>h.key===EK.eeHoca)?EK.eeHoca:'';
  cizimPlanla();
  return '<header class="et-bas">'+baslik+'<p class="et-cumle" id="eeCumle">'+cumle(m)+'</p>'+(m.sinif.n?'<p class="et-cumle" id="eeSayim">'+sayimYazisi(m)+'</p>':'')+
    '<p class="mini" id="eeSinir">Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.</p></header>'+arac(m)+uyari+kapsamUyari+
    (m.sinif.n?grafikPaneli(m)+grupTablosu(m)+hocaTablosu(m,secili)+ogrenciTablosu(m,secili):ogrenciTablosu(m,secili));
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etüt etkisi</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="eeKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('eeKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
document.addEventListener('click',ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-ee-duzey],[data-ee-oturum],[data-ee-donem],button[data-ee-hoca]');if(!el||el.disabled)return;
  if(el.dataset.eeDuzey){EK.eeDuzey=Number(el.dataset.eeDuzey);EK.eeOturum=EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-duzey="'+EK.eeDuzey+'"]');return}
  if(el.dataset.eeOturum){EK.eeOturum=el.dataset.eeOturum;EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-oturum="'+EK.eeOturum+'"]');return}
  if(el.dataset.eeDonem){EK.eeDonem=el.dataset.eeDonem;EK.eeHoca=undefined;yenidenCiz('[data-ee-donem="'+EK.eeDonem+'"]');return}
  if(el.dataset.eeHoca!==undefined){EK.eeHoca=el.dataset.eeHoca&&EK.eeHoca!==el.dataset.eeHoca?el.dataset.eeHoca:undefined;yenidenCiz();document.getElementById('eeOgrenciler')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='eeDers'){EK.eeDers=el.value;EK.eeHoca=undefined;yenidenCiz('#eeDers')}
});
return {model,egim,ogrenciGelisim,netAl,etutOturum,eksikGun,icerik,gorunum,grafikSvg,grafikleriCiz,sahip,NET,EN_AZ,GRUPLAR};
})();
function gorunumEtutEtki(){return ETUT_ETKI.gorunum()}
