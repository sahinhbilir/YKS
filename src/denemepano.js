// Embedded in index.html by scripts/embed-denemepano.cjs. No student data belongs here.
// Deneme panosu (teacher only): the teacher's Denemeler page as a stock-style board, drawn from
// the school's own result lists that Denemeler and Sıralamalar already keep in D.siralama. It
// adds no storage of its own: "Dosyadan toplu aktar" is the existing import, and the classic
// per-student page stays one click away. Looks like Etütler (shared tokens in etutler.css).
// See docs/deneme-panosu.md.
const DPANO = (() => {
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const ESIK=1, ARALIKLAR=[1,2,3];
const OLCULER=[['TYT','TYT'],['AYT:SAY','AYT · SAY'],['AYT:EA','AYT · EA'],['AYT:SÖZ','AYT · SÖZ'],['AYT:Toplam','AYT · Toplam']];
const ONCELIK=['Matematik','Türkçe','Edebiyat','Fizik','Kimya','Biyoloji','Geometri','Tarih','Tarih-1','Coğrafya','Coğrafya-1','Tarih-2','Coğrafya-2','Felsefe','Felsefe Grubu','Din Kültürü'];
const PALET=['var(--e-c1)','var(--e-c2)','var(--e-c3)','var(--e-c7)','var(--e-c5)','var(--e-c6)','var(--e-c4)','var(--e-c8)','var(--e-fg2)','var(--e-chart-muted)'];
const DURUM={Yükseliyor:'Rising',Düşüyor:'Falling',Aynı:'Steady',Yeni:'New',Girmedi:'Quiet','—':'Quiet'};

/* ---------------- small helpers ---------------- */
const anahtar=s=>denemeAdAnahtari(s);
const kisiAdi=s=>String(s||'').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const f1=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=x=>Number(x).toLocaleString('tr-TR',{maximumFractionDigits:2});
const f2s=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const isaret=(v,f=f1)=>(v>0?'+':v<0?'−':'')+f(Math.abs(v));
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const ok=v=>v>0?'▲':v<0?'▼':'';
const r1=x=>Math.round(x*10)/10;
const ort=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const yuzdelik=(s,p)=>{if(!s.length)return null;const i=(s.length-1)*p,a=Math.floor(i),b=Math.ceil(i);return s[a]+(s[b]-s[a])*(i-a)};
const gunDan=t=>{const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t||'');return m?Math.round(Date.UTC(+m[3],+m[2]-1,+m[1])/864e5):null};
const gunAy=(g,yil)=>{if(g===null)return '—';const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]+(yil&&t.getUTCFullYear()!==yil?' ’'+String(t.getUTCFullYear()).slice(2):'')};
const sinifAdi=c=>{const m=/(\d{1,2})\s*\/\s*([A-ZÇĞİÖŞÜ]{1,3})\s*$/u.exec(String(c||'').trim());return m?m[1]+'/'+m[2]:''};
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();

/* ---------------- model ---------------- */
// Every stored list, as exams with their students by school number; a student's class is the
// last one any list printed for that number.
function temel(veri){
  const sinavlar=SIRALAMA.modeller(veri).map(e=>({id:e.id,ad:e.name,tarih:e.dates[0]||'',g:gunDan(e.dates[0]),dates:e.dates,pdfDates:e.pdfDates,tur:e.tur,turElle:e.turElle,
    tyt:e.tyt?e.tyt.students:{},ayt:e.ayt?e.ayt.students:{},listeler:[e.T?'Net Sayısı Sıralı':'',e.F?'Öğrenci Adı Sıralı':''].filter(Boolean)}));
  const kisi=new Map();
  for(const s of sinavlar)for(const o of [...Object.values(s.tyt),...Object.values(s.ayt)]){
    const k=kisi.get(o.no)||{no:o.no,ad:o.name,sinif:''},c=sinifAdi(o.cls);
    if(c)k.sinif=c;if(o.name)k.ad=o.name;kisi.set(o.no,k);
  }
  return {sinavlar,kisi};
}
// A session's subjects are its lessons, then its tests (Matematik + Geometri, Fen Bilimleri…: "uyeler"
// holds their lessons, coloured as the first one). Tests are cards, Net choices and card rows; the
// all-subjects chart, the sentence and Kolaydan zora use the lessons only.
function olcu(key){
  const S=SIRALAMA,renkli=(list,gruplar)=>{const sira=list.slice().sort((a,b)=>ONCELIK.indexOf(a[1])-ONCELIK.indexOf(b[1]));
    const l=list.map(d=>({kod:d[0],ad:d[1],soru:d[2],renk:PALET[sira.indexOf(d)]||'var(--e-muted)'}));
    return l.concat(gruplar.map(g=>({kod:g[0],ad:g[1],soru:g[2],uyeler:g[3],renk:(l.find(d=>d.kod===g[3][0])||{renk:'var(--e-muted)'}).renk})))};
  if(key==='TYT')return {key,ad:'TYT',oturum:'tyt',ust:S.SIRA_UST.TYT,deger:s=>S.hasTYT(s)?S.tytTotal(s):null,dersler:renkli(S.SIRA_DERS.TYT,S.SIRA_GRUP.TYT)};
  const f=key.split(':')[1];
  if(f==='Toplam')return {key,ad:'AYT toplam',oturum:'ayt',ust:S.SIRA_UST.Toplam,deger:s=>S.hasAYT(s)?S.aytTotal(s):null,dersler:renkli(S.SIRA_DERS.AYT,S.SIRA_GRUP.AYT)};
  return {key,ad:'AYT '+f,oturum:'ayt',ust:S.SIRA_UST[f],deger:s=>S.took(s,f)?S.fnet(s,f):null,
    dersler:renkli(S.SIRA_DERS.AYT.filter(d=>S.FCOLS[f].includes(d[0])),S.SIRA_GRUP.AYT.filter(g=>g[3].every(k=>S.FCOLS[f].includes(k))))};
}
const dersNeti=(o,d)=>d.uyeler?d.uyeler.reduce((t,k)=>t+(o.net[k]??0),0):(o.net[d.kod]??0);
const derslerYalniz=l=>l.filter(d=>!d.uyeler);
// One subject's net (as Sıralamalar ranks by a ders): every student who has the session counts.
const dersOlcusu=(O,d)=>({key:O.key+'|'+d.kod,ad:d.ad,oturum:O.oturum,ust:d.soru,deger:s=>O.deger(s)===null?null:dersNeti(s,d),dersler:[d]});
const toplamAdi=O=>O.key==='TYT'?'TYT toplam':O.ad;
const turAdi=t=>t==='tarama'?'Tarama':'Genel';
// Who the board looks at: one grade (never mixed), one class, or everyone when lists print no class.
function kapsamlar(t){
  const siniflar=[...new Set([...t.kisi.values()].map(k=>k.sinif).filter(Boolean))].sort((a,b)=>parseInt(b,10)-parseInt(a,10)||a.localeCompare(b,'tr'));
  const out=[];
  for(const d of [...new Set(siniflar.map(c=>parseInt(c,10)))]){
    out.push({key:'g'+d,ad:d+'. sınıflar',uyar:k=>!!k&&parseInt(k.sinif,10)===d});
    for(const c of siniflar.filter(c=>parseInt(c,10)===d))out.push({key:c,ad:c,uyar:k=>!!k&&k.sinif===c});
  }
  if(!siniflar.length||[...t.kisi.values()].some(k=>!k.sinif))out.push({key:'hepsi',ad:'Tüm öğrenciler',uyar:()=>true});
  return out;
}
function varsayilanKapsam(t,ks){
  const son=t.sinavlar[t.sinavlar.length-1];if(!son)return ks[0];
  const say=new Map();for(const o of Object.values(son.tyt).concat(Object.values(son.ayt))){const d=parseInt((t.kisi.get(o.no)||{}).sinif,10);if(d)say.set(d,(say.get(d)||0)+1)}
  const d=[...say].sort((a,b)=>b[1]-a[1])[0];return (d&&ks.find(k=>k.key==='g'+d[0]))||ks[0];
}
// A grade's own exam has fewer lessons (9. sınıf: no Felsefe or Geometri) and its own question
// counts: lessons no list of the view printed are left out, and counts come from the most questions
// a student answered (denemeSoruTahmini). The 12. sınıf lessons keep their counts.
function dersleriAyarla(O,rows){
  const var_=k=>rows.some(r=>r.o.dy[k]!=null),tek=O.dersler.filter(d=>!d.uyeler);
  if(!tek.some(d=>!/^S\.F/.test(d.kod)&&!var_(d.kod)))return O;
  const enCok=k=>Math.max(0,...rows.map(r=>{const p=String(r.o.dy[k]||'').split('/').map(Number);return p.length===2&&p.every(Number.isFinite)?p[0]+p[1]:0}));
  // A test with one printed lesson is that lesson (9. sınıf Matematik + Geometri is Matematik).
  const dersler=O.dersler.filter(d=>(d.uyeler||[d.kod]).filter(var_).length>(d.uyeler?1:0)).map(d=>({...d,soru:(d.uyeler||[d.kod]).filter(var_).reduce((a,k)=>a+denemeSoruTahmini(DENEME_SIRA_KODU[k],enCok(k)),0)}));
  return {...O,dersler,ust:dersler.filter(d=>!d.uyeler).reduce((a,d)=>a+d.soru,0)};
}
function gorunumModeli(t,O,K,sec){
  const sinavlar=[],satirlar=[];
  for(const s of t.sinavlar){
    const satir=[];
    for(const o of Object.values(O.oturum==='tyt'?s.tyt:s.ayt)){if(!K.uyar(t.kisi.get(o.no)))continue;const v=O.deger(o);if(v!==null)satir.push({no:o.no,v,o})}
    if(satir.length)satirlar.push([s,satir]);
  }
  O=dersleriAyarla(O,satirlar.flatMap(x=>x[1]));
  for(const [s,satir] of satirlar){
    const vs=satir.map(r=>r.v).sort((a,b)=>a-b),en=satir.reduce((a,b)=>b.v>a.v?b:a);
    const sira=new Map();satir.slice().sort((a,b)=>b.v-a.v).forEach((r,i,l)=>sira.set(r.no,i&&l[i-1].v===r.v?sira.get(l[i-1].no):i+1));
    sinavlar.push({id:s.id,ad:s.ad,tarih:s.tarih,g:s.g,dates:s.dates,pdfDates:s.pdfDates,tur:s.tur,turElle:s.turElle,n:satir.length,ort:ort(vs),medyan:yuzdelik(vs,.5),p25:yuzdelik(vs,.25),p75:yuzdelik(vs,.75),max:en.v,enIyi:en.no,
      ders:O.dersler.map(d=>ort(satir.map(r=>dersNeti(r.o,d)))),deger:new Map(satir.map(r=>[r.no,r])),sira});
  }
  const n=sinavlar.length,pencere={};
  for(const k of ARALIKLAR)if(n>=2*k)pencere[k]={once:[n-2*k,n-k-1],son:[n-k,n-1]};
  // Seç: any two exams, as in Sıralamalar. Şimdiki defaults to the last, Önceki to the one before it.
  if(n>=2){const ids=sinavlar.map(s=>s.id),si=sec&&ids.includes(sec.simdi)?ids.indexOf(sec.simdi):n-1;
    const oi=sec&&ids.includes(sec.onceki)&&ids.indexOf(sec.onceki)!==si?ids.indexOf(sec.onceki):si>0?si-1:si+1;
    pencere.sec={once:[oi,oi],son:[si,si]}}
  const dilim=(seri,[a,b])=>ort(seri.slice(a,b+1).filter(v=>v!==null));
  const ogrenciler=[...new Set(sinavlar.flatMap(s=>[...s.deger.keys()]))].map(no=>{
    const k=t.kisi.get(no)||{no,ad:'',sinif:''},seri=sinavlar.map(s=>s.deger.has(no)?s.deger.get(no).v:null),girdi=seri.filter(v=>v!==null);
    const sonI=seri.map((v,i)=>v===null?-1:i).filter(i=>i>=0).pop();
    const o={no,ad:k.ad,sinif:k.sinif,seri,deneme:girdi.length,enIyi:Math.max(...girdi),sonNet:seri[sonI],sonSinav:sonI,sira:sinavlar[n-1].sira.get(no)??null,k:{}};
    for(const kk in pencere){const w=pencere[kk],once=dilim(seri,w.once),son=dilim(seri,w.son),fark=once!==null&&son!==null?son-once:null;
      o.k[kk]={once,son,fark,durum:son===null&&once!==null?'Girmedi':once===null&&son!==null?'Yeni':son===null?'—':fark>=ESIK?'Yükseliyor':fark<=-ESIK?'Düşüyor':'Aynı'}}
    return o;
  }).sort((a,b)=>(b.seri[n-1]??-999)-(a.seri[n-1]??-999)||a.ad.localeCompare(b.ad,'tr'));
  const genel=sinavlar.map(s=>s.ort),dersler=O.dersler.map((d,i)=>{const seri=sinavlar.map(s=>s.ders[i]),o={...d,seri,k:{}};
    for(const kk in pencere){const once=dilim(seri,pencere[kk].once),son=dilim(seri,pencere[kk].son);o.k[kk]={once,son,fark:son-once}}return o});
  const ozet={};
  for(const kk in pencere){const w=pencere[kk],once=dilim(genel,w.once),son=dilim(genel,w.son);
    // The participants' mean moves when different students take part; the same students' own changes do not.
    const ayni=ogrenciler.map(o=>o.k[kk].fark).filter(v=>v!==null);
    ozet[kk]={once,son,fark:son-once,ayni:ayni.length?ayni.reduce((a,b)=>a+b,0)/ayni.length:null,ayniN:ayni.length,artan:ogrenciler.filter(o=>o.k[kk].durum==='Yükseliyor').length,azalan:ogrenciler.filter(o=>o.k[kk].durum==='Düşüyor').length}}
  return {O,K,sinavlar,pencere,ogrenciler,dersler,ozet,yil:sinavlar.length?new Date(sinavlar[n-1].g*864e5).getUTCFullYear():null};
}
let ONBELLEK={imza:null,t:null};
function veriAl(){
  const {veri,hata}=SIRALAMA.oku();if(!veri)return {hata};
  const imza=veri.sinavlar.map(s=>s.id+':'+s.ts+':'+(s.tarih||'')+':'+(s.tur||'')).join('|');
  if(ONBELLEK.imza!==imza)ONBELLEK={imza,t:temel(veri)};
  return {t:ONBELLEK.t,veri};
}
// Şimdiki and önceki exam of the comparison: the two chosen in Seç, otherwise the last two. Ranks
// and the table order follow the şimdiki exam.
function odakla(m,s){
  const n=m.sinavlar.length,w=s==='sec'?m.pencere.sec:null;
  m.simdi=w?w.son[0]:n-1;m.onceki=w?w.once[0]:n>1?n-2:null;
  const S=m.sinavlar[m.simdi],P=m.onceki===null?null:m.sinavlar[m.onceki];
  // Places moved since the önceki exam (positive: up), for students ranked in both.
  for(const o of m.ogrenciler){o.sira=S?S.sira.get(o.no)??null:null;o.siraOnce=P?P.sira.get(o.no)??null:null;o.siraFark=o.sira!==null&&o.siraOnce!==null?o.siraOnce-o.sira:null}
  m.ogrenciler.sort((a,b)=>(b.seri[m.simdi]??-999)-(a.seri[m.simdi]??-999)||a.ad.localeCompare(b.ad,'tr'));
}
// Sıralamalar's measures of change: net artışı, % artış (needs a positive earlier net) and the closed
// gap ln((tam − önceki + 1) / (tam − şimdiki + 1)). Ranking by one of them numbers the students again;
// equal values share a rank, students without a value have none.
const OLCUTLER=[['net','Net'],['artis','Net artışı'],['yuzde','% artış'],['fark','Kapanan fark (log)']];
const OLCUT_ALAN={artis:'fark',yuzde:'yuzde',fark:'logFark'};
function olcutUygula(m,s,olcut){
  if(!s)return;
  for(const o of m.ogrenciler){const c=o.k[s];if(!c)continue;
    c.yuzde=c.fark!==null&&c.once>0?c.fark/c.once*100:null;
    c.logFark=c.fark!==null?Math.log((m.O.ust-c.once+1)/(m.O.ust-c.son+1)):null}
  const k=OLCUT_ALAN[olcut];if(!k)return;
  const l=m.ogrenciler.filter(o=>o.k[s][k]!==null).sort((a,b)=>b.k[s][k]-a.k[s][k]);
  for(const o of m.ogrenciler){o.sira=null;o.siraFark=null}
  l.forEach((o,i)=>{o.sira=i&&Math.abs(l[i-1].k[s][k]-o.k[s][k])<1e-9?l[i-1].sira:i+1});
}
function durumAl(t){
  // Tür: genel or tarama exams only (from the name, or as the teacher set it).
  const turler=new Set(t.sinavlar.map(s=>s.tur)),tur=SIRALAMA.SINAV_TURLERI.includes(EK.dpTur)&&turler.has(EK.dpTur)?EK.dpTur:'';
  const tt=tur?{...t,sinavlar:t.sinavlar.filter(s=>s.tur===tur)}:t;
  const ks=kapsamlar(t),K=ks.find(k=>k.key===EK.dpKapsam)||varsayilanKapsam(tt,ks),secilen={onceki:EK.dpOnceki,simdi:EK.dpSimdiki};
  const olcular=OLCULER.map(([key,ad])=>{const O=olcu(key);return {key,ad,O,m:gorunumModeli(tt,O,K,secilen)}});
  const sec=olcular.find(o=>o.key===EK.dpOlcu&&o.m.sinavlar.length)||olcular.find(o=>o.m.sinavlar.length)||olcular[0],m=sec.m;
  const s=EK.dpAralik==='sec'&&m.pencere.sec?'sec':ARALIKLAR.includes(EK.dpAralik)&&m.pencere[EK.dpAralik]?EK.dpAralik:m.pencere[1]?1:null;
  // The students' part may follow one subject's net; the top of the board stays on the session total.
  const ogrDers=m.dersler.find(d=>d.kod===EK.dpOgrNet)||null,mo=ogrDers?gorunumModeli(tt,dersOlcusu(sec.O,ogrDers),K,secilen):m;
  const olcut=s&&OLCUT_ALAN[EK.dpOlcut]?EK.dpOlcut:'net';
  odakla(m,s);if(mo!==m)odakla(mo,s);olcutUygula(mo,s,olcut);
  const ogr=mo.ogrenciler.find(o=>o.no===EK.dpOgr)||mo.ogrenciler[0]||null,ogrKart=ogr&&m.ogrenciler.find(o=>o.no===ogr.no)||null;
  return {ks,K,olcular,sec,m,mo,s,tur,turler,ogrDers,olcut,ders:m.dersler.some(d=>d.kod===EK.dpDers)?EK.dpDers:null,ogr,ogrKart};
}

/* ---------------- charts (SVG strings, sized to their box) ---------------- */
const CIZIMLER=new Map();
function tikler(lo,hi,n){
  const span=Math.max(1e-9,hi-lo),ham=span/n,us=Math.pow(10,Math.floor(Math.log10(ham))),adim=[1,2,2.5,5,10].map(k=>k*us).find(k=>k>=ham-1e-9);
  const a=Math.floor(lo/adim)*adim,out=[];for(let v=a;v<hi+adim-1e-9;v+=adim)out.push(Math.round(v*1000)/1000);return out;
}
function tiklerSayi(max,n){const ham=max/n,us=Math.pow(10,Math.floor(Math.log10(Math.max(ham,1)))),adim=Math.max(1,[1,2,5,10].map(k=>k*us).find(k=>k>=ham-1e-9)),out=[];for(let v=0;v<max;v+=adim)out.push(v);out.push(out[out.length-1]+adim);return out}
const yaziGen=s=>String(s).length*7;
// Köşeli or yumuşak, as the viewer chose (src/grafik.js).
const yol=pts=>GRAFIK_CIZGI.yol(pts);
function egim(id,renk){return '<defs><linearGradient id="'+id+'" x1="0" x2="0" y1="0" y2="1">'+[[0,.26],[.25,.16],[.5,.08],[.75,.03],[1,0]].map(([o,a])=>'<stop offset="'+o+'" style="stop-color:'+renk+';stop-opacity:'+a+'"/>').join('')+'</linearGradient></defs>'}
const imlec=(ust,alt)=>'<line class="et-kural" y1="'+ust+'" y2="'+alt+'" x1="0" x2="0" visibility="hidden"/><g class="et-imlecler"></g>';
function eksenY(tik,y,L,R,f){f=f===f1?(t=>Number.isInteger(t)?fi(t):f1(t)):f;return tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+f(t)+'</text>').join('')}
function eksenX(m,x,step,W,y0){
  const her=Math.max(1,Math.ceil(56/step)),n=m.sinavlar.length;let out='';
  m.sinavlar.forEach((s,i)=>{if((n-1-i)%her)return;const t=gunAy(s.g,m.yil),w=yaziGen(t);let xx=x(i),a='middle';
    if(xx-w/2<0){xx=0;a='start'}else if(xx+w/2>W){xx=W;a='end'}out+='<text class="et-tik" x="'+r1(xx)+'" y="'+y0+'" text-anchor="'+a+'">'+t+'</text>'});
  return out;
}
function bantlar(m,x,step,k,ust,alt,yazi=true){
  const w=m.pencere[k];if(!w)return '';let out='';
  for(const [sinif,[a,b],etiket] of [['once',w.once,k===1||k==='sec'?'Önceki':'Önceki '+k],['son',w.son,k==='sec'?'Şimdiki':k===1?'Son':'Son '+k]]){
    const xa=x(a)-step/2,xb=x(b)+step/2;
    out+='<rect class="et-bant '+sinif+'" data-bant="'+sinif+'" x="'+r1(xa)+'" y="'+ust+'" width="'+r1(xb-xa)+'" height="'+(alt-ust)+'"/>';
    if(yazi&&xb-xa>58)out+='<text class="et-bant-yazi" x="'+r1(xa+6)+'" y="'+(ust+13)+'">'+etiket+'</text>';
  }
  return out;
}
const sinavBasligi=(s,m)=>s.ad+' · '+gunAy(s.g,m.yil);
// Measuring (src/grafik.js) matches the board's charts and mini graphs by exam: its place among the
// board's exams (st.m; the students' part has the same exams). Points are labelled by the exam's date.
const olcSira=(st,d)=>{const yer=new Map(st.m.sinavlar.map((s,i)=>[s.id,i]));return d.map(s=>yer.get(s.id)??-1)};
const olcMeta=(st,d,ek)=>({donem:olcSira(st,d),etiket:d.map(s=>s.g===null?s.ad:gunAy(s.g,st.m.yil)),birim:'net',...ek});
function grafikGenel(st,W){
  const m=st.m,d=m.sinavlar,H=300,lo=Math.min(...d.map(s=>s.p25),...d.map(s=>s.ort)),hi=Math.max(...d.map(s=>s.p75),...d.map(s=>s.ort));
  const tik=tikler(Math.max(lo-(hi-lo)*.15-1,Math.min(0,lo)),hi+(hi-lo)*.15+1,5);
  const R=W-(Math.max(...tik.map(t=>yaziGen(f1(t))),yaziGen(f1(d[d.length-1].ort)))+22),L=2,ust=26,hacimH=50,alt=H-26,fiyatAlt=alt-hacimH-18;
  const step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>fiyatAlt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(fiyatAlt-ust);
  const nMax=Math.max(...d.map(s=>s.n)),yv=v=>alt-v/nMax*hacimH;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+egim('dpEgimGenel','var(--e-c1)');
  const w=st.s==='sec'?m.pencere.sec:null;
  svg+=bantlar(m,x,step,st.s,4,alt,!w)+eksenY(tik,y,L,R,f1)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  const bw=Math.max(2,Math.min(22,step*.45));
  d.forEach((s,i)=>{const o=i?d[i-1].n:null,c=o===null||s.n===o?'esit':s.n>o?'yukari':'asagi';
    svg+='<rect class="et-hacim '+c+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(yv(s.n))+'" width="'+r1(bw)+'" height="'+r1(alt-yv(s.n))+'" rx="'+r1(Math.min(3,bw/2))+'"/>'});
  const ust50=d.map((s,i)=>[x(i),y(s.p75)]),alt50=d.map((s,i)=>[x(i),y(s.p25)]).reverse(),pts=d.map((s,i)=>[x(i),y(s.ort)]);
  if(d.length>1)svg+='<path class="dp-bant50" d="'+yol(ust50.concat(alt50))+'Z"/>';
  else svg+='<rect class="dp-bant50" x="'+r1(x(0)-6)+'" y="'+r1(y(d[0].p75))+'" width="12" height="'+r1(y(d[0].p25)-y(d[0].p75))+'" rx="3"/>';
  svg+='<path d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+fiyatAlt+'L'+r1(pts[0][0])+','+fiyatAlt+'Z" style="fill:url(#dpEgimGenel)"/>';
  svg+='<path class="et-cizgi" d="'+yol(pts)+'"/>'+pts.map(p=>'<circle class="et-nokta" cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3"/>').join('');
  const [lx,ly]=pts[pts.length-1],deger=f1(d[d.length-1].ort),tw=yaziGen(deger)+12;
  svg+='<line class="et-ref" x1="'+r1(lx)+'" x2="'+R+'" y1="'+r1(ly)+'" y2="'+r1(ly)+'"/><rect class="et-etiket" x="'+(R+3)+'" y="'+r1(ly-9)+'" width="'+tw+'" height="18" rx="4"/><text class="et-etiket-yazi" x="'+r1(R+3+tw/2)+'" y="'+r1(ly)+'" dy="0.32em" text-anchor="middle">'+deger+'</text>';
  // Seç: Önceki and Şimdiki are vertical lines with a handle, dragged to any exam (as in Etütler).
  // Close lines put their handles side by side, the left one's to the left.
  let tutamak='';
  if(w){const ia=w.once[0],ib=w.son[0],yakin=Math.abs(x(ib)-x(ia))<60,sol=ia<ib?'once':'son';
    tutamak=[['once','Önceki',ia],['son','Şimdiki',ib]].map(([ad,yazi,i])=>{const dx=yakin?(ad===sol?-54:0):-27;
      return '<g class="et-tutamak" data-tutamak="'+ad+'" transform="translate('+r1(x(i))+',0)"><rect class="et-tutamak-alan" x="-11" y="2" width="22" height="'+(alt-2)+'"/>'+
        '<line class="et-tutamak-cizgi" x1="0" x2="0" y1="20" y2="'+alt+'"/><rect class="et-tutamak-tut" x="'+dx+'" y="2" width="54" height="18" rx="9"/>'+
        '<text class="et-tutamak-yazi" x="'+(dx+27)+'" y="11" dy="0.32em" text-anchor="middle">'+yazi+'</text></g>'}).join('')}
  svg+=eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+tutamak+'</svg>';
  const ipucu=d.map(s=>({bas:sinavBasligi(s,m),satir:[['var(--e-c1)','Ortalama',f1(s.ort)+' net','cizgi'],[null,'Medyan',f1(s.medyan)],['var(--e-c1)','Ortadaki %50',f1(s.p25)+' – '+f1(s.p75),'bant'],
    [null,'En yüksek',f2(s.max)],[null,'Katılım',fi(s.n)+' öğrenci']]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:pts.map(p=>p[1]),noktalar:pts.map(p=>[[p[1],'var(--e-c1)']]),ipucu,step,
    ...(w?{tutamak:true,deger:d.map(s=>s.ort),ids:d.map(s=>s.id),g:d.map(s=>s.g),yil:m.yil}:{}),
    olc:olcMeta(st,d,{ana:{v:d.map(s=>s.ort),y:pts.map(p=>p[1]),renk:'var(--e-c1)'}})};
}
function grafikDers(st,W){
  const m=st.m,d=m.sinavlar,H=300,odak=st.ders?m.dersler.find(x=>x.kod===st.ders):null,seri=odak?[odak]:derslerYalniz(m.dersler);
  const deger=(x,i)=>odak?x.seri[i]:x.seri[i]/x.soru*100,fmt=odak?f1:(v=>(v<0?'−':'')+'%'+fi(Math.abs(Math.round(v))));
  const vals=seri.flatMap(x=>d.map((_,i)=>deger(x,i))),tik=tikler(Math.min(0,...vals),Math.max(...vals,odak?1:10),5);
  const R=W-(Math.max(...tik.map(t=>yaziGen(fmt(t))))+22),L=2,ust=26,alt=H-26,step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,st.s,4,alt)+eksenY(tik,y,L,R,fmt)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  if(odak){const pts=d.map((_,i)=>[x(i),y(deger(odak,i))]);svg+=egim('dpEgimDers',odak.renk)+'<path d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+alt+'L'+r1(pts[0][0])+','+alt+'Z" style="fill:url(#dpEgimDers)"/>'}
  // With every subject drawn, the line under the pointer takes the stage (data-seri, see seriVurgula).
  const coklu=!odak&&seri.length>1,veri_=k=>coklu?' data-seri="'+k+'"':'';
  for(const s of seri.slice().reverse()){const pts=d.map((_,i)=>[x(i),y(deger(s,i))]),k=seri.indexOf(s);
    svg+='<path class="et-cizgi '+(odak?'kalin':'ince')+'"'+veri_(k)+' style="stroke:'+s.renk+'" d="'+yol(pts)+'"/>'+(odak||d.length<2?pts.map(p=>'<circle'+veri_(k)+' cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3" style="fill:'+s.renk+'"/>').join(''):'')}
  svg+=eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const satirlar=i=>seri.map(x=>[x.renk,x.ad,odak?f1(x.seri[i])+' / '+x.soru:'%'+fi(Math.round(deger(x,i)))+' · '+f1(x.seri[i])+' net',deger(x,i)]).sort((a,b)=>b[3]-a[3]);
  const ipucu=d.map((s,i)=>({bas:sinavBasligi(s,m),satir:satirlar(i).map(([c,a,v])=>[c,a,v,'cizgi'])}));
  const noktalar=d.map((_,i)=>seri.map(s=>[y(deger(s,i)),s.renk]));
  // Measured in net: a highlighted lesson, the chosen one, or the session's average net.
  const olcSeri=s=>({ad:s.ad,v:s.seri,y:d.map((_,i)=>y(deger(s,i))),renk:s.renk});
  const olc=olcMeta(st,d,{seriler:coklu?seri.map(olcSeri):null,ana:odak?olcSeri(odak):{ad:toplamAdi(m.O)+' ortalaması',v:d.map(s=>s.ort),y:null}});
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>odak?y(deger(odak,i)):ust+40),noktalar,ipucu,olc,
    ...(coklu?{seriler:seri.map(s=>({ad:s.ad,pts:d.map((_,i)=>[x(i),y(deger(s,i))])})),seriNokta:(k,i)=>[noktalar[i][k]],
      seriIpucu:(k,i)=>({bas:ipucu[i].bas,satir:satirlar(i).map(([c,a,v])=>[c,a,v,'cizgi',a===seri[k].ad])})}:{})};
}
// Every student as a line (as Derslere göre draws every subject); the class average is dashed.
// Lines take their class's colour when the scope has several classes. The student under the pointer
// takes the stage; a click opens the student's card.
function grafikOgrenci(st,W){
  const m=st.mo,d=m.sinavlar,ogr=m.ogrenciler,H=320;if(!ogr.length||!d.length)return null;
  const vals=ogr.flatMap(o=>o.seri.filter(v=>v!==null)).concat(d.map(s=>s.ort)),lo=Math.min(...vals),hi=Math.max(...vals);
  const tik=tikler(Math.min(0,lo-(hi-lo)*.05),hi+(hi-lo)*.05+1,5),R=W-(Math.max(...tik.map(t=>yaziGen(f1(t))))+22),L=2,ust=26,alt=H-26;
  const step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  const subeler=[...new Set(ogr.map(o=>o.sinif||'—'))].sort((a,b)=>a.localeCompare(b,'tr')),renk=(o,k)=>PALET[(subeler.length>1?subeler.indexOf(o.sinif||'—'):k)%PALET.length];
  const seriler=ogr.map((o,k)=>({no:o.no,ad:kisiAdi(o.ad),sinif:o.sinif,renk:renk(o,k),pts:o.seri.map((v,i)=>v===null?null:[x(i),y(v)])}));
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,st.s,4,alt)+eksenY(tik,y,L,R,f1)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+='<path class="et-ort kesik" d="'+yol(d.map((s,i)=>[x(i),y(s.ort)]))+'"/><g class="dp-seriler">';
  seriler.forEach((s,k)=>{
    const parca=[];let p=[];s.pts.forEach(q=>{if(q)p.push(q);else{if(p.length)parca.push(p);p=[]}});if(p.length)parca.push(p);
    const sec=st.ogr&&st.ogr.no===s.no?' kalin':' ince',yolu=parca.filter(q=>q.length>1).map(yol).join('');
    if(yolu)svg+='<path class="et-cizgi dp-seri'+sec+'" data-seri="'+k+'" style="stroke:'+s.renk+'" d="'+yolu+'"/>';
    for(const q of parca.filter(q=>q.length===1))svg+='<circle class="dp-seri" data-seri="'+k+'" cx="'+r1(q[0][0])+'" cy="'+r1(q[0][1])+'" r="3" style="fill:'+s.renk+'"/>';
  });
  svg+='</g>'+eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=d.map(s=>({bas:sinavBasligi(s,m),satir:[['var(--e-muted)','Ortalama',f1(s.ort)+' net','cizgi'],[null,'Katılım',fi(s.n)+' öğrenci']]}));
  const seriIpucu=(k,i)=>{const s=seriler[k],o=ogr[k],v=o.seri[i];
    return {bas:s.ad+(s.sinif?' · '+s.sinif:''),satir:v===null?[[null,d[i].ad,'girmedi']]:[[s.renk,d[i].ad,f2(v)+' net','cizgi'],[null,'Sıra',fi(d[i].sira.get(o.no))+' / '+fi(d[i].n)],['var(--e-muted)','Ortalama',f1(d[i].ort),'cizgi']]}};
  const olc=olcMeta(st,d,{seriler:ogr.map((o,k)=>({ad:seriler[k].ad,v:o.seri,y:o.seri.map(v=>v===null?null:y(v)),renk:seriler[k].renk})),
    ana:{ad:'Ortalama',v:d.map(s=>s.ort),y:d.map(s=>y(s.ort)),renk:'var(--e-muted)'}});
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map(s=>y(s.ort)),noktalar:d.map(s=>[[y(s.ort),'var(--e-muted)']]),ipucu,seriler,olc,
    seriNokta:(k,i)=>seriler[k].pts[i]?[[seriler[k].pts[i][1],seriler[k].renk]]:[],seriIpucu,subeler:subeler.length>1?subeler.map(c=>[c,PALET[subeler.indexOf(c)%PALET.length]]):[]};
}
function grafikDagilim(st,W){
  const m=st.mo,d=m.sinavlar,son=d[m.simdi],once=m.onceki===null?null:d[m.onceki],H=240,u=m.O.ust,gen=u>100?20:u>60?10:u>20?5:u>8?2:1;
  const deg=s=>[...s.deger.values()].map(r=>r.v),tum=deg(son).concat(once?deg(once):[]),lo=Math.min(0,Math.floor(Math.min(...tum)/gen)*gen),hi=m.O.ust;
  const kutular=[];for(let a=lo;a<hi;a+=gen)kutular.push(a);
  const say=s=>{const c=kutular.map(()=>0);for(const v of deg(s)){const i=Math.min(kutular.length-1,Math.max(0,Math.floor((v-lo)/gen)));c[i]++}return c};
  const cs=say(son),co=once?say(once):null,tik=tiklerSayi(Math.max(1,...cs,...(co||[])),4);
  const R=W-(Math.max(...tik.map(t=>yaziGen(fi(t))))+20),L=2,ust=26,alt=H-26,step=(R-L)/kutular.length,x=i=>L+step*(i+.5),y=v=>alt-v/tik[tik.length-1]*(alt-ust),bw=Math.max(2,step*.78);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+eksenY(tik,y,L,R,fi);
  cs.forEach((c,i)=>{if(c)svg+='<rect class="dp-kutu" x="'+r1(x(i)-bw/2)+'" y="'+r1(y(c))+'" width="'+r1(bw)+'" height="'+r1(alt-y(c))+'" rx="3"/>'});
  if(co)svg+='<path class="dp-once" d="'+co.map((c,i)=>(i?'L':'M')+r1(x(i)-bw/2)+','+r1(y(c))+'L'+r1(x(i)+bw/2)+','+r1(y(c))).join('')+'"/>';
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  const her=Math.max(1,Math.ceil(30/step));kutular.forEach((a,i)=>{if(i%her===0)svg+='<text class="et-tik" x="'+r1(x(i)-step/2)+'" y="'+(H-6)+'" text-anchor="'+(i?'middle':'start')+'">'+fi(a)+'</text>'});
  svg+=imlec(ust-6,alt)+'</svg>';
  const ipucu=kutular.map((a,i)=>({bas:fi(a)+' – '+fi(a+gen)+' net',satir:[['var(--e-c1)',son.ad,fi(cs[i])+' öğrenci'],...(co?[['var(--e-fg2)',once.ad,fi(co[i])+' öğrenci','cizgi']]:[])]}));
  return {svg,xs:kutular.map((_,i)=>x(i)),ys:cs.map(c=>y(c)),noktalar:kutular.map(()=>[]),bant:step,ipucu};
}
function grafikKisi(st,W){
  const m=st.m,o=st.ogrKart;if(!o)return null;
  const d=m.sinavlar,H=220,vals=o.seri.filter(v=>v!==null).concat(d.map(s=>s.p25),d.map(s=>s.p75)),lo=Math.min(...vals),hi=Math.max(...vals);
  const tik=tikler(Math.min(0,lo-(hi-lo)*.1),hi+(hi-lo)*.1+1,4),R=W-(Math.max(...tik.map(t=>yaziGen(f1(t))))+20),L=2,ust=26,alt=H-26,step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,st.s,4,alt)+eksenY(tik,y,L,R,f1)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  if(d.length>1)svg+='<path class="dp-bant50 soluk" d="'+yol(d.map((s,i)=>[x(i),y(s.p75)]).concat(d.map((s,i)=>[x(i),y(s.p25)]).reverse()))+'Z"/>';
  svg+='<path class="et-ort kesik" d="'+yol(d.map((s,i)=>[x(i),y(s.ort)]))+'"/>';
  let parca=[];const parcalar=[];o.seri.forEach((v,i)=>{if(v===null){if(parca.length)parcalar.push(parca);parca=[]}else parca.push([x(i),y(v)])});if(parca.length)parcalar.push(parca);
  const hepsi=o.seri.map((v,i)=>v===null?null:[x(i),y(v)]).filter(Boolean);
  if(hepsi.length>1)svg+='<path class="et-cizgi kesik ince" d="'+yol(hepsi)+'"/>';
  for(const p of parcalar)svg+='<path class="et-cizgi kalin" d="'+yol(p)+'"/>';
  svg+=hepsi.map(p=>'<circle class="et-nokta" cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3.5"/>').join('');
  svg+=eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=d.map((s,i)=>({bas:sinavBasligi(s,m),satir:o.seri[i]===null?[[null,'Girmedi','']]:[['var(--e-c1)',kisiAdi(o.ad),f2(o.seri[i])+' net','cizgi'],[null,'Sıra',fi(s.sira.get(o.no))+' / '+fi(s.n)],['var(--e-muted)','Ortalama',f1(s.ort),'cizgi']]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((s,i)=>y(o.seri[i]??s.ort)),noktalar:d.map((s,i)=>o.seri[i]===null?[]:[[y(o.seri[i]),'var(--e-c1)']]),ipucu,
    olc:olcMeta(st,d,{ana:{v:o.seri,y:o.seri.map(v=>v===null?null:y(v)),renk:'var(--e-c1)'}})};
}
const GRAFIKLER={genel:grafikGenel,ders:grafikDers,ogrenci:grafikOgrenci,dagilim:grafikDagilim,kisi:grafikKisi};
let ZAMAN=null;
const etkin=()=>EK.sekme==='denemeler'&&rehberMi()&&!!document.getElementById?.('dpKok');
function grafikleriCiz(){
  if(!etkin())return;const {t}=veriAl();if(!t)return;const st=durumAl(t);if(!st.m.sinavlar.length)return;
  document.querySelectorAll('.et-grafik[data-dp-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const imza=[W,ONBELLEK.imza,st.sec.key,st.K.key,st.s,st.ders,st.ogr&&st.ogr.no,st.tur,st.ogrDers&&st.ogrDers.kod,st.m.onceki+'>'+st.m.simdi].join('|');if(kutu.dataset.imza===imza)return;
    const g=GRAFIKLER[kutu.dataset.dpGrafik](st,Math.max(260,W));if(!g)return;
    kutu.dataset.imza=imza;kutu.innerHTML=g.svg+'<div class="et-ipucu" hidden></div>';CIZIMLER.set(kutu.dataset.dpGrafik,g);
  });
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);
function ipucuGoster(kutu,i){
  const g=CIZIMLER.get(kutu.dataset.dpGrafik);if(!g||i<0||i>=g.xs.length)return;
  const svg=kutu.querySelector('svg'),tip=kutu.querySelector('.et-ipucu');if(!svg||!tip)return;
  kutu.dataset.i=String(i);const kural=svg.querySelector('.et-kural'),cx=g.xs[i];
  if(g.bant){kural.setAttribute('visibility','hidden');let hl=svg.querySelector('.et-vurgu-bant');
    if(!hl){hl=document.createElementNS('http://www.w3.org/2000/svg','rect');hl.setAttribute('class','et-vurgu-bant');svg.insertBefore(hl,svg.firstChild)}
    hl.setAttribute('x',r1(cx-g.bant/2));hl.setAttribute('width',r1(g.bant));hl.setAttribute('y','20');hl.setAttribute('height',String(Number(kural.getAttribute('y2'))-20));hl.setAttribute('visibility','visible')}
  else{kural.setAttribute('x1',r1(cx));kural.setAttribute('x2',r1(cx));kural.setAttribute('visibility','visible')}
  const k=kutu.dataset.seri===undefined||!g.seriler?null:Number(kutu.dataset.seri);
  svg.querySelector('.et-imlecler').innerHTML=(k===null?g.noktalar[i]:g.seriNokta(k,i)).map(([yy,c])=>'<circle cx="'+r1(cx)+'" cy="'+r1(yy)+'" r="4.5" class="et-imlec" style="fill:'+c+'"/>').join('');
  const p=k===null?g.ipucu[i]:g.seriIpucu(k,i);
  tip.innerHTML='<div class="et-ipucu-bas">'+kacis(p.bas)+'</div>'+p.satir.map(([c,ad,v,tur,vurgu])=>'<div class="et-ipucu-satir'+(vurgu?' dp-vurgu':'')+'">'+(c?'<i class="et-renk'+(tur==='cizgi'?' cizgi':'')+(tur==='bant'?' dp-renk-bant':'')+'" style="background:'+c+'"></i>':'')+'<span>'+kacis(ad)+'</span><b>'+kacis(v)+'</b></div>').join('');
  tip.hidden=false;
  const olcek=kutu.clientWidth/Number(svg.viewBox.baseVal.width||kutu.clientWidth),px=cx*olcek,py=g.ys[i]*olcek,bw=kutu.clientWidth,tw=tip.offsetWidth,th=tip.offsetHeight;
  let sol=px+14;if(sol+tw>bw)sol=px-tw-14;sol=Math.max(0,Math.min(sol,bw-tw));
  tip.style.left=sol+'px';tip.style.top=Math.max(0,Math.min(py-th/2,kutu.clientHeight-th))+'px';
}
// One line takes the stage: the others lose their colour and fade (CSS: svg.odakli), and the line
// is drawn last so nothing crosses it. k null clears.
function seriVurgula(kutu,k){
  const svg=kutu.querySelector('svg');if(!svg)return;
  if(k===null||k===undefined||k<0){svg.classList.remove('odakli');svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));delete kutu.dataset.seri;return}
  if(kutu.dataset.seri===String(k))return;
  svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));
  svg.querySelectorAll('[data-seri="'+k+'"]').forEach(e=>{e.classList.add('aktif');e.parentNode.appendChild(e)});
  svg.classList.add('odakli');kutu.dataset.seri=String(k);
}
// The line nearest the pointer, if one passes within a few pixels of it.
function enYakinSeri(kutu,clientX,clientY){
  const g=CIZIMLER.get(kutu.dataset.dpGrafik),svg=kutu.querySelector('svg');if(!g||!g.seriler||!svg)return null;
  const r=svg.getBoundingClientRect(),o=(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1),px=(clientX-r.left)*o,py=(clientY-r.top)*o;
  const uzak=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/l)):0;return Math.hypot(a[0]+t*dx-px,a[1]+t*dy-py)};
  let en=null,ed=14*o;
  g.seriler.forEach((s,k)=>{s.pts.forEach((p,i)=>{if(!p)return;const q=s.pts[i+1];const dd=q?uzak(p,q):Math.hypot(p[0]-px,p[1]-py);if(dd<ed){ed=dd;en=k}})});
  return en;
}
// The readout, rule and points go; a highlighted line stays (measuring keeps it, src/grafik.js).
function ipucuSakla(kutu){
  const tip=kutu.querySelector('.et-ipucu'),svg=kutu.querySelector('svg');if(tip)tip.hidden=true;delete kutu.dataset.i;
  if(svg){svg.querySelector('.et-kural')?.setAttribute('visibility','hidden');svg.querySelector('.et-vurgu-bant')?.setAttribute('visibility','hidden');const im=svg.querySelector('.et-imlecler');if(im)im.innerHTML=''}
}
function ipucuGizle(kutu){seriVurgula(kutu,null);ipucuSakla(kutu)}
function enYakin(kutu,clientX){
  const g=CIZIMLER.get(kutu.dataset.dpGrafik),svg=kutu.querySelector('svg');if(!g||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;g.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(g.xs[en]-vx))en=i});return en;
}
// Drag to measure (src/grafik.js): the highlighted line, else the chart's own (g.olc). The net
// distribution has no time axis and no g.olc.
function olcBilgi(kutu){
  const g=CIZIMLER.get(kutu.dataset.dpGrafik);if(!g||!g.olc)return null;
  const o=g.olc,s=kutu.dataset.seri!==undefined&&o.seriler?o.seriler[Number(kutu.dataset.seri)]||o.ana:o.ana;
  return {xs:g.xs,deger:s.v,ys:s.y,renk:s.renk,ad:s.ad||'',donem:o.donem,uzunluk:1,birim:o.birim,fmt:f1,etiket:i=>o.etiket[i]};
}

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-dp-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(ok(v)?'<span aria-hidden="true">'+ok(v)+'</span>':'')+yazi+'</span>';
// ▲3 / ▼2 / =: places moved; nothing when there is no earlier place.
const siraOk=f=>f===null||f===undefined?'':'<span class="et-sira-ok '+yon(f)+'" role="img" aria-label="'+(f>0?fi(f)+' sıra yükseldi':f<0?fi(-f)+' sıra düştü':'sıra aynı')+'">'+(f>0?'▲'+fi(f):f<0?'▼'+fi(-f):'=')+'</span>';
// donem (olcSira) lets measuring (src/grafik.js) shade the same exams and show the change.
function kucukCizgi(vals,renk,son,G,Y,id,donem){
  const n=vals.length,var_=vals.filter(v=>v!==null),mx=Math.max(...var_),mn=Math.min(...var_),x=i=>2+(G-6)*(n>1?i/(n-1):.5),y=v=>Y-3-(mx===mn?.5:(v-mn)/(mx-mn))*(Y-7);
  const pts=vals.map((v,i)=>v===null?null:[x(i),y(v)]).filter(Boolean);
  let s='<svg viewBox="0 0 '+G+' '+Y+'" width="100%" height="'+Y+'" preserveAspectRatio="none" aria-hidden="true"'+
    (donem?' data-olc-donem="'+donem.join(',')+'" data-olc-uzunluk="1" data-olc-v="'+vals.map(v=>v===null?'':Math.round(v*100)/100).join(',')+'"':'')+'>';
  if(son&&n>1){const h=(G-6)/(n-1)/2;s+='<rect class="et-bant son" x="'+r1(x(son[0])-h)+'" y="0" width="'+r1(x(son[1])-x(son[0])+2*h)+'" height="'+Y+'"/>'}
  if(id&&pts.length>1)s+=egim(id,renk)+'<path style="fill:url(#'+id+')" d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+Y+'L'+r1(pts[0][0])+','+Y+'Z"/>';
  s+='<path class="et-kucuk" vector-effect="non-scaling-stroke" style="stroke:'+renk+'" d="'+yol(pts)+'"/>';
  return s+'</svg>';
}
const egilimRengi=v=>v>0?'var(--e-ok)':v<0?'var(--e-bad)':'var(--e-muted)';
function defterEslesme(){
  const m=new Map();(D.ogr||[]).forEach((o,i)=>{if(o&&!o.silindi&&o.no)m.set(Number(o.no)+'|'+anahtar(o.ad),i)});
  return (no,ad)=>m.get(Number(no)+'|'+anahtar(ad));
}
const pencereAdi=k=>k==='sec'?'şimdiki deneme':k===1?'son deneme':'son '+k+' deneme';
const simdiAdi=st=>st.s==='sec'?'şimdiki deneme':'son deneme';
const turOnEki=st=>st.tur?(st.tur==='tarama'?'Tarama denemeleri':'Genel denemeler')+' · ':'';
function cumle(st){
  const m=st.m,o=m.ozet[st.s],son=m.sinavlar[m.simdi],b=t=>'<b>'+t+'</b>';
  const kapsam=turOnEki(st)+(st.K.key==='hepsi'?'':kacis(st.K.ad)+' · ');
  if(!o)return kapsam+'Tek deneme var: '+kacis(son.ad)+' ('+gunAy(son.g,m.yil)+'), '+kacis(m.O.ad)+' ortalaması '+b(f1(son.ort))+' net. Karşılaştırma için ikinci deneme gerekir.';
  const en=derslerYalniz(m.dersler).sort((a,c)=>Math.abs(c.k[st.s].fark)-Math.abs(a.k[st.s].fark))[0];
  const bas=st.s==='sec'?kacis(m.sinavlar[m.onceki].ad)+' → '+kacis(son.ad)+' ('+gunAy(son.g,m.yil)+'): ':st.s===1?'Son deneme ('+kacis(son.ad)+', '+gunAy(son.g,m.yil)+'): ':'Son '+st.s+' deneme: ';
  return kapsam+bas+kacis(m.O.ad)+' ortalaması '+b(f1(o.son))+' net, '+
    (st.s==='sec'?'öncekine':st.s===1?'önceki denemeye':'önceki '+st.s+' denemeye')+' göre '+b(isaret(o.fark))+
    (o.ayni===null?'':' (iki dönemde de giren '+fi(o.ayniN)+' öğrencinin kendi değişimi '+b(isaret(o.ayni))+')')+'. En çok değişen ders: '+kacis(en.ad)+' '+b(isaret(en.k[st.s].fark))+'. '+
    b(fi(o.artan))+' öğrenci en az '+ESIK+' net yükseldi, '+b(fi(o.azalan))+' öğrenci düştü.';
}
function ozetKartlari(st){
  const m=st.m,son=m.sinavlar[m.simdi],once=m.onceki===null?null:m.sinavlar[m.onceki],o=m.ozet[st.s],sa=simdiAdi(st);
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const enIyi=m.ogrenciler.find(x=>x.no===son.enIyi);
  return '<div class="et-ozet">'+
    (o?kart('Katılımcı ortalaması · '+pencereAdi(st.s),f1(o.son),hap(o.fark,isaret(o.fark).replace(/^[+−]/,''))+'<span class="mini">önceki: '+f1(o.once)+'</span>')+
      kart('Aynı öğrencilerin değişimi',o.ayni===null?'—':isaret(o.ayni),'<span class="mini">'+fi(o.ayniN)+' öğrenci iki dönemde de girdi</span>')
      :kart('Katılımcı ortalaması · '+sa,f1(son.ort),'<span class="mini">'+kacis(son.ad)+'</span>'))+
    kart('Ortadaki %50 · '+sa,f1(son.p25)+'–'+f1(son.p75),'<span class="mini">medyan '+f1(son.medyan)+' net</span>')+
    kart('En yüksek net · '+sa,f2(son.max),'<span class="mini">'+kacis(enIyi?kisiAdi(enIyi.ad):'')+'</span>')+
    (o?kart('Yükselen öğrenci · '+pencereAdi(st.s),fi(o.artan),'<span class="mini">düşen: '+fi(o.azalan)+' · en az '+ESIK+' net</span>'):'')+
    (once?kart('Sırası yükselen · '+sa,fi(m.ogrenciler.filter(x=>x.siraFark>0).length),'<span class="mini">düşen: '+fi(m.ogrenciler.filter(x=>x.siraFark<0).length)+' · aynı: '+fi(m.ogrenciler.filter(x=>x.siraFark===0).length)+'</span>'):'')+
    kart('Katılım · '+sa,fi(son.n),once?hap(son.n-once.n,fi(Math.abs(son.n-once.n)))+'<span class="mini">önceki: '+fi(once.n)+'</span>':'<span class="mini">öğrenci</span>')+'</div>';
}
function dersKartlari(st){
  const m=st.m,w=m.pencere[st.s],son=w?w.son:null,donem=olcSira(st,m.sinavlar);
  return '<div class="et-dersler">'+m.dersler.map((d,di)=>{const k=d.k[st.s],f=k?k.fark:0,deger=k?k.son:d.seri[d.seri.length-1];
    return '<button type="button" class="et-ders'+(d.uyeler?' et-grup-kart':'')+'" data-dp-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.ders===d.kod)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ad)+'</b><span class="mini">'+fi(d.soru)+' soru</span></span>'+
      '<strong>'+f1(deger)+'</strong>'+(k?'<span class="et-ders-alt">'+hap(f,isaret(f).replace(/^[+−]/,''))+'<span class="mini">önceki: '+f1(k.once)+'</span></span>':'<span class="et-ders-alt"><span class="mini">%'+fi(Math.round(deger/d.soru*100))+' başarı</span></span>')+
      '<span class="et-kucuk-kutu">'+kucukCizgi(d.seri,egilimRengi(f),son,160,38,'dpSg'+di,donem)+'</span></button>'}).join('')+'</div>';
}
// Kolaydan zora: the lessons by the class's success (average net ÷ questions) in the şimdiki exam, with
// the change since the önceki exam in points and places, and the success over every exam. A row
// focuses the subject chart on that lesson.
function zorluk(st){
  const m=st.m,l=derslerYalniz(m.dersler);if(!l.length)return '';
  const yuzde=(d,i)=>d.seri[i]/d.soru*100;
  const sirala=i=>{const r=l.map(d=>[d,yuzde(d,i)]).sort((a,b)=>b[1]-a[1]||a[0].ad.localeCompare(b[0].ad,'tr')),yer=new Map();
    r.forEach(([d,v],j)=>yer.set(d.kod,j&&Math.abs(r[j-1][1]-v)<1e-9?yer.get(r[j-1][0].kod):j+1));return {r,yer}};
  const S=sirala(m.simdi),P=m.onceki===null?null:sirala(m.onceki),son=m.sinavlar[m.simdi],donem=olcSira(st,m.sinavlar);
  const satir=([d,v])=>{const sf=P?P.yer.get(d.kod)-S.yer.get(d.kod):null,pf=P?v-yuzde(d,m.onceki):null;
    return '<button type="button" class="dp-zor-satir" data-dp-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.ders===d.kod)+'"><span class="dp-zor-sira">'+fi(S.yer.get(d.kod))+'</span>'+
      '<span class="dp-zor-ad"><i class="et-renk nokta" style="background:'+d.renk+'"></i>'+kacis(d.ad)+'</span><b>%'+fi(Math.round(v))+'</b>'+
      (pf===null?'<span></span>':hap(pf,f1(Math.abs(pf))+' puan'))+'<span>'+siraOk(sf)+'</span>'+
      '<span class="dp-zor-iz">'+kucukCizgi(m.sinavlar.map((_,i)=>yuzde(d,i)),d.renk,null,84,24,null,donem)+'</span></button>'};
  const ilk=S.r[0][0],sonD=S.r[S.r.length-1][0];
  return '<section class="et-panel" id="dpZorluk"><div class="et-kart-bas"><h2>Kolaydan zora · '+kacis(son.ad)+'</h2><span class="mini">En kolay '+kacis(ilk.ad)+' · en zor '+kacis(sonD.ad)+
      (P?' · '+kacis(m.sinavlar[m.onceki].ad)+' denemesine göre':'')+'</span></div><div class="dp-zor">'+S.r.map(satir).join('')+'</div></section>';
}
// Değişimin kaynağı and Isı haritası: the same students' change from the önceki to the şimdiki
// window (those with a value in both, the "Aynı öğrencilerin değişimi" population) split exactly.
// A student's change in a lesson is the lesson's window mean (over the exams the student took) now
// minus before, so a student's lessons add up to their total change and so do the means over the
// students. A şube's part is its share of the students times its own mean change, so the şubeler add
// up to the grade. Whatever the printed lessons do not cover (e.g. Ek Felsefe) is shown as "Diğer
// dersler", so the parts always add up to the total.
const BOLUNME=1e-9;
function degisimKaynagi(m,s){
  const w=m.pencere&&m.pencere[s];if(!w)return null;
  const dersler=derslerYalniz(m.dersler),sinavlar=m.sinavlar;
  const dilim=(o,[a,b],d)=>{let t=0,c=0;for(let i=a;i<=b;i++){const r=sinavlar[i].deger.get(o.no);if(r){t+=d?dersNeti(r.o,d):r.v;c++}}return c?t/c:null};
  const aynilar=[];
  for(const o of m.ogrenciler){const c=o.k[s];if(!c||c.fark===null)continue;
    aynilar.push({no:o.no,ad:o.ad,sinif:o.sinif,toplam:c.fark,ders:dersler.map(d=>dilim(o,w.son,d)-dilim(o,w.once,d))})}
  const N=aynilar.length;if(!N)return null;
  const parcalar=dersler.map((d,i)=>({kod:d.kod,ad:d.ad,renk:d.renk,katki:ort(aynilar.map(r=>r.ders[i]))}));
  const kalan=ort(aynilar.map(r=>r.toplam))-parcalar.reduce((a,p)=>a+p.katki,0);
  if(Math.abs(kalan)>BOLUNME)parcalar.push({kod:'diger',ad:'Diğer dersler',renk:'var(--e-muted)',katki:kalan,diger:true});
  const toplam=parcalar.reduce((a,p)=>a+p.katki,0);
  // Şubeler of a grade; a scope of one şube or of everyone has no split.
  const subeAdlari=/^g\d+$/.test(m.K.key)?[...new Set(m.ogrenciler.map(o=>o.sinif).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')):[];
  const subeler=subeAdlari.length>1?subeAdlari.map(ad=>{const l=aynilar.filter(r=>r.sinif===ad),ortalama=l.length?ort(l.map(r=>r.toplam)):null;
    return {ad,n:l.length,ort:ortalama,katki:l.length?l.length/N*ortalama:0,ders:dersler.map((_,i)=>l.length?ort(l.map(r=>r.ders[i])):null)}}):null;
  return {n:N,toplam,parcalar,subeler,aynilar,dersler,ders:dersler.map((_,i)=>ort(aynilar.map(r=>r.ders[i])))};
}
// Isı haritası: rows are the grade's şubeler under the scope's own mean, or the students when the
// scope is one şube (or has no şubeler to split); columns are the session's lessons and Toplam.
function isiHaritasi(k,K){
  const kolonlar=k.dersler.map(d=>({kod:d.kod,ad:d.ad})).concat([{kod:'toplam',ad:'Toplam'}]);
  const satirlar=[{ad:K.ad+' ortalaması',n:k.n,ort:true,v:k.ders.concat([k.toplam])}];
  if(k.subeler)for(const x of k.subeler)satirlar.push({ad:x.ad,n:x.n,sube:true,v:x.n?x.ders.concat([x.ort]):kolonlar.map(()=>null)});
  else for(const r of k.aynilar.slice().sort((a,b)=>b.toplam-a.toplam||String(a.ad).localeCompare(String(b.ad),'tr')))satirlar.push({ad:kisiAdi(r.ad),no:r.no,n:1,v:r.ders.concat([r.toplam])});
  const mutlak=satirlar.flatMap(r=>r.v).filter(v=>v!==null).map(Math.abs).sort((a,b)=>a-b);
  return {kolonlar,satirlar,cap:yuzdelik(mutlak,.9)||0};
}
// A diverging scale around 0: the share of --e-ok (rising) or --e-bad (falling) mixed into the panel
// colour grows with |change| and stops at the cap (the 90th percentile of |values|).
const ISI_EN_COK=55;
function isiRengi(v,cap){
  if(v===null||v===undefined||!(cap>0)||v===0)return '';
  const pay=Math.round(Math.min(1,Math.abs(v)/cap)*ISI_EN_COK);
  return pay?'background:color-mix(in srgb,var(--'+(v>0?'e-ok':'e-bad')+') '+pay+'%,var(--e-panel))':'';
}
const yonlu=(v,f=f1)=>ok(v)+f(Math.abs(v));
// "12. sınıflar ▲3,4 net (aynı 58 öğrenci): en çok Matematik ▲1,6 ve 12/A ▲1,9 katkı verdi; Fizik ▼0,4 düşürdü."
function kaynakCumlesi(k,K){
  const buyuk=l=>l.filter(x=>Math.abs(x.katki)>=.05),ders=buyuk(k.parcalar.filter(p=>!p.diger)),sube=buyuk(k.subeler||[]);
  const en=(l,yonu)=>l.filter(x=>yonu*x.katki>0).sort((a,b)=>yonu*(b.katki-a.katki))[0];
  const ac=yonu=>[en(ders,yonu),en(sube,yonu)].filter(Boolean).map(x=>kacis(x.ad)+' '+yonlu(x.katki)).join(' ve ');
  const artan=ac(1),azalan=ac(-1),parca=[artan?'en çok '+artan+' katkı verdi':'',azalan?azalan+' düşürdü':''].filter(Boolean);
  return kacis(K.ad)+' '+yonlu(k.toplam)+' net (aynı '+fi(k.n)+' öğrenci)'+(parca.length?': '+parca.join('; '):'')+'.';
}
const donemYazisi=st=>{const m=st.m,S=m.sinavlar[m.simdi],P=m.onceki===null?null:m.sinavlar[m.onceki];
  return st.s==='sec'||st.s===1?(P?kacis(P.ad)+' → ':'')+kacis(S.ad):'önceki '+st.s+' deneme → son '+st.s+' deneme (ortalamalar)'};
// Rows sorted by size of the part; the bar grows from the middle to the right (up) or left (down).
function katkiSatiri(ad,katki,olcek,onek,ek=''){
  const g=olcek>0?Math.min(100,Math.abs(katki)/olcek*100):0;
  return '<tr><th scope="row">'+onek+kacis(ad)+'</th>'+ek+'<td class="dp-cubuk-hucre"><span class="dp-eksen" aria-hidden="true"><span class="dp-cubuk '+yon(katki)+'" style="--g:'+r1(g)+'%"></span></span></td><td class="sayi et-'+yon(katki)+'">'+isaret(katki,f2s)+'</td></tr>';
}
function kaynakBolumleri(st){
  const k=st.s?degisimKaynagi(st.m,st.s):null;if(!k)return '';
  const m=st.m,K=st.K,sirali=k.parcalar.slice().sort((a,b)=>Math.abs(b.katki)-Math.abs(a.katki)||a.ad.localeCompare(b.ad,'tr')),olcek=Math.max(...sirali.map(p=>Math.abs(p.katki)));
  const toplamYazisi='Toplam '+yonlu(k.toplam,f2s)+' net = '+sirali.map((p,i)=>(i?(p.katki<0?' − ':' + '):(p.katki<0?'−':''))+f2s(Math.abs(p.katki))).join('');
  const dersTablosu='<div class="dp-kaynak-blok"><h3>Derslere göre</h3><span class="mini dp-toplam-yazi">'+toplamYazisi+'</span><div class="et-kaydir"><table class="et-tablo dp-kaynak-tablo"><thead><tr><th scope="col">Ders</th><th scope="col"></th><th scope="col" class="sayi">Katkı (net)</th></tr></thead><tbody>'+
    sirali.map(p=>katkiSatiri(p.ad,p.katki,olcek,'<i class="et-renk nokta" style="background:'+p.renk+'"></i>')).join('')+
    '</tbody><tfoot><tr><th scope="row">Toplam</th><td></td><td class="sayi et-'+yon(k.toplam)+'">'+isaret(k.toplam,f2s)+'</td></tr></tfoot></table></div></div>';
  let subeTablosu='';
  if(k.subeler){const o2=Math.max(...k.subeler.map(x=>Math.abs(x.katki)));
    subeTablosu='<div class="dp-kaynak-blok"><h3>Şubelere göre</h3><span class="mini dp-toplam-yazi">Toplam '+yonlu(k.toplam,f2s)+' net = '+k.subeler.map((x,i)=>(i?(x.katki<0?' − ':' + '):(x.katki<0?'−':''))+f2s(Math.abs(x.katki))).join('')+'</span><div class="et-kaydir"><table class="et-tablo dp-kaynak-tablo"><thead><tr><th scope="col">Şube</th><th scope="col" class="sayi">Öğrenci</th><th scope="col" class="sayi">Ortalama değişim</th><th scope="col"></th><th scope="col" class="sayi">Katkı (net)</th></tr></thead><tbody>'+
      k.subeler.map(x=>katkiSatiri(x.ad,x.katki,o2,'','<td class="sayi">'+fi(x.n)+'</td><td class="sayi et-'+yon(x.ort||0)+'">'+(x.ort===null?'—':isaret(x.ort,f2s))+'</td>')).join('')+
      '</tbody><tfoot><tr><th scope="row">'+kacis(K.ad)+'</th><td class="sayi">'+fi(k.n)+'</td><td class="sayi et-'+yon(k.toplam)+'">'+isaret(k.toplam,f2s)+'</td><td></td><td class="sayi et-'+yon(k.toplam)+'">'+isaret(k.toplam,f2s)+'</td></tr></tfoot></table></div></div>'}
  const kaynak='<section class="et-panel" id="dpKaynak"><div class="et-kart-bas"><h2>Değişimin kaynağı</h2><span class="mini">'+donemYazisi(st)+' · '+kacis(m.O.ad)+'</span></div>'+
    '<p class="dp-kaynak-cumle">'+kaynakCumlesi(k,K)+'</p><div class="dp-kaynak-iki">'+dersTablosu+subeTablosu+'</div></section>';
  const h=isiHaritasi(k,K),ogrenci=!k.subeler,bas=h.kolonlar.map(c=>'<th scope="col" class="sayi'+(c.kod==='toplam'?' dp-isi-toplam':'')+'">'+kacis(c.ad)+'</th>').join('');
  const govde=h.satirlar.map(r=>'<tr'+(r.ort?' class="dp-isi-ort"':'')+'><th scope="row" class="dp-isi-ad">'+
    (r.no!==undefined&&typeof ANALIZ!=='undefined'?ANALIZ.adDugmesi(r.no,r.ad):kacis(r.ad))+(r.ort||r.sube?' <span class="mini">'+fi(r.n)+' öğrenci</span>':'')+'</th>'+
    r.v.map((v,i)=>v===null?'<td class="sayi dp-isi-hucre bos"></td>':'<td class="sayi dp-isi-hucre'+(i===r.v.length-1?' dp-isi-toplam':'')+'" style="'+isiRengi(v,h.cap)+'" title="'+kacis(r.ad+' · '+h.kolonlar[i].ad+': '+isaret(v,f2s)+' net')+'">'+isaret(v)+'</td>').join('')+'</tr>').join('');
  const isi='<section class="et-panel" id="dpIsi"><div class="et-kart-bas"><h2>Isı haritası</h2><span class="mini">'+(ogrenci?'Öğrenciler':'Şubeler')+' · '+donemYazisi(st)+'</span></div>'+
    '<div class="et-lejant"><span>renk: değişim (net)</span><span><i class="dp-isi-renk" style="background:color-mix(in srgb,var(--e-bad) '+ISI_EN_COK+'%,var(--e-panel))"></i>−'+f1(h.cap)+' ve altı</span><span><i class="dp-isi-renk"></i>0</span><span><i class="dp-isi-renk" style="background:color-mix(in srgb,var(--e-ok) '+ISI_EN_COK+'%,var(--e-panel))"></i>+'+f1(h.cap)+' ve üstü</span></div>'+
    '<div class="et-tablo-kutu dp-isi-kutu"><table class="et-tablo dp-isi"><thead><tr><th scope="col">'+(ogrenci?'Öğrenci':'Şube')+'</th>'+bas+'</tr></thead><tbody>'+govde+'</tbody></table></div></section>';
  return kaynak+isi;
}
function hareketliler(st){
  const s=st.s,m=st.mo;if(!m.pencere[s])return '<p class="mini">Karşılaştırma için en az iki deneme gerekir.</p>';
  const art=m.ogrenciler.filter(o=>o.k[s].fark!==null&&o.k[s].fark>0).sort((a,b)=>b.k[s].fark-a.k[s].fark).slice(0,6);
  const az=m.ogrenciler.filter(o=>o.k[s].fark!==null&&o.k[s].fark<0).sort((a,b)=>a.k[s].fark-b.k[s].fark).slice(0,6);
  const sutun=(baslik,liste)=>'<div class="et-hareket"><h3>'+baslik+'</h3>'+(liste.length?liste.map(o=>
    '<button type="button" class="et-hareket-satir" data-dp-ogr="'+kacis(o.no)+'" aria-pressed="'+(st.ogr&&st.ogr.no===o.no)+'"><span class="et-kim"><span>'+kacis(kisiAdi(o.ad))+'</span><span class="mini">'+kacis(o.sinif||'—')+'</span></span>'+
    '<span class="mini">'+f1(o.k[s].once)+' → '+f1(o.k[s].son)+'</span>'+hap(o.k[s].fark,f2(Math.abs(o.k[s].fark)))+'</button>').join(''):'<p class="mini">Bu aralıkta kimse yok.</p>')+'</div>';
  return '<div class="et-hareketler">'+sutun('En çok yükselenler',art)+sutun('En çok düşenler',az)+'</div>';
}
// As in Sıralamalar's table: the earlier and current net and the three measures of change side by side.
const SUTUNLAR=[['ad','Öğrenci'],['sinif','Şube'],['son','Son'],['once','Önceki'],['fark','Net artışı'],['yuzde','% artış'],['logFark','Kapanan fark (log)'],['seri','Denemeler'],['sira','Sıra'],['durum','Durum']];
const yuzdeYazi=v=>v===null?'—':(v>0?'+':v<0?'−':'')+'%'+f1(Math.abs(v));
const logYazi=v=>v===null?'—':(v>0?'+':v<0?'−':'')+Math.abs(v).toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3});
// Average rows above the students, as in Sıralamalar: the scope and, for a grade, each class. The
// change is the current average minus the earlier average of those who have one.
function ortalamaSatirlari(st){
  const m=st.mo,s=st.s,w=s?m.pencere[s]:null,u=m.O.ust;
  const grup=(ad,l)=>{const sonlar=l.map(o=>w?o.k[s].son:o.sonNet).filter(v=>v!==null&&v!==undefined),oncel=w?l.map(o=>o.k[s].once).filter(v=>v!==null):[];
    if(!sonlar.length)return null;const son=ort(sonlar),once=oncel.length?ort(oncel):null,fark=once===null?null:son-once;
    return {ad,n:sonlar.length,son,once,fark,yuzde:fark!==null&&once>0?fark/once*100:null,logFark:fark===null?null:Math.log((u-once+1)/(u-son+1)),
      seri:m.sinavlar.map((_,i)=>ort(l.map(o=>o.seri[i]).filter(v=>v!==null)))}};
  const subeler=[...new Set(m.ogrenciler.map(o=>o.sinif).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  return [grup(st.K.ad,m.ogrenciler),...(subeler.length>1?subeler.map(c=>grup(c,m.ogrenciler.filter(o=>o.sinif===c))):[])].filter(Boolean);
}
function tablo(st){
  const m=st.mo,s=st.s,w=s?m.pencere[s]:null,son=w?w.son:null,donem=olcSira(st,m.sinavlar);
  const kol=SUTUNLAR.filter(([k])=>w||!['once','fark','durum','yuzde','logFark'].includes(k)),secKol=OLCUT_ALAN[st.olcut]||null;
  const sira=kol.some(([k])=>k===EK.dpSira)&&EK.dpSira!=='seri'?EK.dpSira:'son',yonu=EK.dpSiraYon==='artan'?1:-1;
  const deger=(o,c)=>c==='ad'?kisiAdi(o.ad):c==='sinif'?o.sinif:c==='no'?Number(o.no):c==='enIyi'?o.enIyi:c==='sira'?(o.sira===null?1e9:o.sira):c==='son'?(w?o.k[s].son:o.sonNet):c==='durum'?(w?o.k[s].durum:''):(w?o.k[s][c]:null);
  const liste=m.ogrenciler.slice().sort((a,b)=>{const x=deger(a,sira),y=deger(b,sira);if(x===null&&y===null)return 0;if(x===null)return 1;if(y===null)return -1;
    const f=typeof x==='number'?x-y:String(x).localeCompare(String(y),'tr');return f*yonu||String(a.ad).localeCompare(b.ad,'tr')});
  const ara=anahtar(EK.dpAra||''),gor=o=>!ara||anahtar(o.ad).includes(ara)||String(o.no).includes(ara);
  // On a phone the table keeps the name, current net, net artışı, the measure it is ranked by, rank and status.
  const dar=k=>['sinif','once','seri'].includes(k)||(k==='yuzde'||k==='logFark')&&k!==secKol,gizli=k=>dar(k)||k===secKol?' class="'+[dar(k)?'et-dar-gizle':'',k===secKol?'dp-secili':''].filter(Boolean).join(' ')+'"':'';
  const bas=kol.map(([k,ad])=>{const yazi=k==='son'?(s==='sec'?'Şimdiki':s>1&&w?'Son '+s+' ort.':'Son'):k==='once'?(s>1?'Önceki '+s+' ort.':'Önceki'):ad;
    return k==='seri'?'<th scope="col"'+gizli(k)+'>'+yazi+'</th>':'<th scope="col"'+gizli(k)+' aria-sort="'+(sira===k?(yonu>0?'ascending':'descending'):'none')+'"><button type="button" data-dp-sira="'+k+'">'+yazi+'</button></th>'}).join('');
  const sayi=v=>v===null||v===undefined?'—':f2(v);
  const hucre={
    sinif:o=>'<td class="et-dar-gizle">'+kacis(o.sinif||'')+'</td>',
    son:o=>'<td class="sayi">'+sayi(o.son)+'</td>',once:o=>'<td class="sayi et-dar-gizle">'+sayi(o.once)+'</td>',
    fark:o=>'<td class="sayi et-'+yon(o.fark||0)+'">'+(o.fark===null?'—':isaret(o.fark,f2))+'</td>',
    yuzde:o=>'<td class="sayi et-'+yon(o.yuzde||0)+(dar('yuzde')?' et-dar-gizle':'')+'">'+yuzdeYazi(o.yuzde)+'</td>',logFark:o=>'<td class="sayi et-'+yon(o.logFark||0)+(dar('logFark')?' et-dar-gizle':'')+'">'+logYazi(o.logFark)+'</td>',
    seri:o=>'<td class="et-dar-gizle et-trend">'+kucukCizgi(o.seri,egilimRengi(o.fark||0),son,84,26,null,donem)+'</td>'};
  const ortSatir=g=>'<tr class="dp-ort">'+kol.map(([k])=>k==='ad'?'<td><b>'+kacis(g.ad)+' ortalaması</b> <span class="mini">'+fi(g.n)+' öğrenci</span></td>':
    hucre[k]?hucre[k]({...g,sinif:''}):'<td></td>').join('')+'</tr>';
  const satir=o=>{const c=w?o.k[s]:null,v={sinif:o.sinif||'—',son:c?c.son:o.sonNet,once:c?c.once:null,fark:c?c.fark:null,yuzde:c?c.yuzde:null,logFark:c?c.logFark:null,seri:o.seri};
    return '<tr data-dp-ogr="'+kacis(o.no)+'" data-ara="'+kacis(anahtar(o.ad)+' '+o.no)+'"'+(st.ogr&&st.ogr.no===o.no?' class="secili"':'')+(gor(o)?'':' hidden')+'>'+kol.map(([k])=>
      k==='ad'?'<td>'+ANALIZ.adDugmesi(o.no,kisiAdi(o.ad))+'</td>':
      k==='sira'?'<td class="sayi">'+(o.sira===null?'—':fi(o.sira))+siraOk(o.siraFark)+'</td>':k==='durum'?'<td><span class="et-durum '+DURUM[c.durum]+'">'+c.durum+'</span></td>':hucre[k](v)).join('')+'</tr>'};
  const gorunen=m.ogrenciler.filter(gor).length;
  return '<div class="et-filtre"><input type="search" id="dpAra" placeholder="Öğrenci ya da numara ara" aria-label="Öğrenci ara" value="'+kacis(EK.dpAra||'')+'">'+
    '<span class="mini" id="dpSayac">'+(gorunen===m.ogrenciler.length?fi(m.ogrenciler.length)+' öğrenci':fi(gorunen)+' / '+fi(m.ogrenciler.length)+' öğrenci')+'</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo"><thead><tr>'+bas+'</tr></thead><tbody>'+ortalamaSatirlari(st).map(ortSatir).join('')+liste.map(satir).join('')+'</tbody></table></div>';
}
function kisiKarti(st,es){
  const m=st.m,o=st.ogrKart;if(!o)return '';
  const si=es(o.no,o.ad),ad=kisiAdi(o.ad),c=m.pencere[st.s]?o.k[st.s]:null,son=m.sinavlar[o.sonSinav],S=m.sinavlar[m.simdi],sira=S.sira.get(o.no)??null;
  const onceI=o.seri.slice(0,o.sonSinav).map((v,i)=>v===null?-1:i).filter(i=>i>=0).pop(),onceS=onceI===undefined?null:m.sinavlar[onceI];
  const r=son.deger.get(o.no).o,ro=onceS?onceS.deger.get(o.no).o:null;
  const dersler=m.dersler.map((d,i)=>({...d,net:dersNeti(r,d),once:ro?dersNeti(ro,d):null,okul:son.ders[i]}));
  return '<div class="et-kisi-bas"><h3>'+(si===undefined?kacis(ad):ogrAdDugmesi(si,ad))+'</h3><span class="mini">No '+kacis(o.no)+' · '+kacis(o.sinif||'şube yok')+' · '+fi(o.deneme)+' deneme</span></div>'+
    '<div class="et-kisi-sayilar"><div><span class="mini">Son net</span><strong>'+f2(o.sonNet)+'</strong><span class="mini">'+kacis(son.ad)+'</span></div>'+
    '<div><span class="mini">Sıra · '+simdiAdi(st)+'</span><strong>'+(sira===null?'—':fi(sira))+'</strong><span class="mini">'+(sira===null?'girmedi':'/ '+fi(S.n))+(o.siraOnce!==null&&sira!==null?' · önceki '+fi(o.siraOnce):'')+'</span>'+siraOk(o.siraFark)+'</div>'+
    (c&&c.fark!==null?'<div><span class="mini">Değişim · '+pencereAdi(st.s)+'</span>'+hap(c.fark,f2(Math.abs(c.fark)))+'<span class="et-durum '+DURUM[c.durum]+'">'+c.durum+'</span></div>'
      :'<div><span class="mini">En iyi</span><strong>'+f2(o.enIyi)+'</strong></div>')+'</div>'+
    '<div class="et-grafik kucuk" data-dp-grafik="kisi" tabindex="0" role="img" aria-label="'+kacis(ad+': denemelerdeki net, okul ortalamasıyla')+'"></div>'+
    '<div class="et-lejant"><span><i class="et-renk cizgi" style="background:var(--e-c1)"></i>'+kacis(ad)+'</span><span><i class="et-renk cizgi" style="background:var(--e-muted)"></i>Ortalama</span><span><i class="et-renk dp-renk-bant" style="background:var(--e-c1)"></i>Ortadaki %50</span></div>'+
    '<span class="mini">'+kacis(son.ad)+' · derslere göre'+(onceS?', önceki denemeye göre değişim':'')+'</span><div class="dp-dersler">'+dersler.map(d=>{const fark=d.once===null?null:d.net-d.once,yz=Math.max(0,Math.min(100,d.net/d.soru*100)),ok_=Math.max(0,Math.min(100,d.okul/d.soru*100));
      return '<div class="dp-ders'+(d.uyeler?' dp-grup':'')+'"><span><i class="et-renk nokta" style="background:'+d.renk+'"></i>'+kacis(d.ad)+'</span><span class="dp-iz" title="Okul ortalaması '+f1(d.okul)+'"><i style="width:'+r1(yz)+'%;background:'+d.renk+'"></i><em style="left:'+r1(ok_)+'%"></em></span><b>'+f2(d.net)+'<small>/'+fi(d.soru)+'</small></b>'+(fark===null?'<span></span>':hap(fark,f2(Math.abs(fark))))+'</div>'}).join('')+'</div>'+
    '<span class="mini dp-not"><em class="dp-cizik"></em> çizgi: '+kacis(st.K.ad)+' ortalaması</span>';
}
// The teacher sets an exam's type (genel or tarama) and corrects its date here, with Sıralamalar's own
// date field: the change also moves the students' results of that exam (src/siralamalar.js). "PDF ekle"
// stores a school list without sending results to students, "Sil" removes an exam's lists (both
// Sıralamalar's own). A viewing teacher only reads.
function sinavTablosu(st,salt){
  const m=st.m,tur=s=>salt?turAdi(s.tur):'<select class="dp-tur-sec" data-dp-sinav-tur="'+kacis(s.id)+'" aria-label="'+kacis(s.ad+' türü')+'">'+
    SIRALAMA.SINAV_TURLERI.map(t=>'<option value="'+t+'"'+(t===s.tur?' selected':'')+'>'+turAdi(t)+'</option>').join('')+'</select>';
  return '<section class="et-panel" id="dpSinavlar"><div class="et-kart-bas"><h2>Denemeler · '+kacis(m.O.ad)+'</h2><div class="et-arac">'+
      (salt?'':'<label class="et-dugme" title="Yalnızca okul listesi; sonuçlar öğrencilere aktarılmaz">PDF ekle<input type="file" id="srPdf" accept="'+yzDosyaKabul()+'" multiple hidden></label>')+
      '<button type="button" class="et-dugme" data-sekme="siralamalar">Sıralamalar ve raporlar</button></div></div>'+
    '<div class="et-kaydir"><table class="et-kaynak"><thead><tr><th>Deneme</th><th>Tür</th><th>Tarih</th><th>Öğrenci</th><th>Ortalama</th><th>Medyan</th><th>En yüksek</th>'+(salt?'':'<th></th>')+'</tr></thead><tbody>'+
    m.sinavlar.slice().reverse().map(s=>'<tr><td>'+kacis(s.ad)+'</td><td>'+tur(s)+'</td><td>'+SIRALAMA.tarihHucresi({id:s.id,name:s.ad,dates:s.dates||[],pdfDates:s.pdfDates||[]},salt)+'</td><td>'+fi(s.n)+'</td><td>'+f1(s.ort)+'</td><td>'+f1(s.medyan)+'</td><td>'+f2(s.max)+'</td>'+(salt?'':'<td><button type="button" class="et-dugme" data-sr-sil="'+kacis(s.id)+'" aria-label="'+kacis(s.ad+' listelerini sil')+'">Sil</button></td>')+'</tr>').join('')+'</tbody></table></div><p id="srDurum" role="status" aria-live="polite">'+kacis(SIRALAMA.durumYazisi||'')+'</p></section>';
}
// Sıralamalar's PDF reports for the board's Önceki → Şimdiki pair (data-sr-simdi / data-sr-onceki);
// the buttons and the preview are handled by src/siralamalar.js.
function raporlar(st){
  const {veri}=SIRALAMA.oku();if(!veri)return '';
  const m=st.m,S=m.sinavlar[m.simdi],P=m.onceki===null?null:m.sinavlar[m.onceki];
  const {cur,prev}=SIRALAMA.secim(SIRALAMA.modeller(veri),{simdi:S&&S.id,onceki:P&&P.id});if(!cur)return '';
  const satir=R=>{const why=SIRALAMA.neden(R,cur,prev);let sirala='';
    if(R.sirala&&!why)sirala='<div class="dp-rapor-sirala" role="group" aria-label="AYT şube sıralaması">'+SIRALAMA.classGroups(Object.values(cur.ayt.students).filter(SIRALAMA.hasAYT)).map(([c,ss],i)=>{
      const v=SIRALAMA.SIRALA.includes(veri.tercih[c])?veri.tercih[c]:SIRALAMA.defaultSort(ss),ad=SIRALAMA.clsShort(c);
      return '<label class="et-seg"><span class="et-seg-label">'+kacis(ad)+'</span><select data-sr-sinif="'+kacis(c)+'" id="srSinif'+i+'" aria-label="'+kacis(ad+' sıralaması')+'">'+
        SIRALAMA.SIRALA.map(o=>'<option value="'+o+'"'+(o===v?' selected':'')+'>'+(o==='Toplam'?'AYT toplam':o+' net')+'</option>').join('')+'</select></label>'}).join('')+'</div>';
    return '<div class="sr-rapor dp-rapor"><div class="dp-rapor-ad"><b>'+kacis(R.ad)+'</b><span class="mini">'+kacis(why||R.aciklama)+'</span></div><div class="dp-rapor-dugmeler">'+
      '<button type="button" class="et-dugme" data-sr-onizle="'+R.id+'"'+(why?' disabled':'')+'>Önizle</button><button type="button" class="et-dugme birincil" data-sr-indir="'+R.id+'"'+(why?' disabled':'')+'>PDF indir</button></div>'+sirala+'</div>'};
  const herhangi=SIRALAMA.RAPORLAR.some(R=>!SIRALAMA.neden(R,cur,prev));
  return '<section class="et-panel" id="dpRaporlar" data-sr-simdi="'+kacis(cur.id)+'" data-sr-onceki="'+kacis(prev?prev.id:'')+'"><div class="et-kart-bas"><h2>Raporlar</h2><span class="mini">'+
      (prev?kacis(prev.name)+' → '+kacis(cur.name):kacis(cur.name))+'</span></div>'+
    '<div class="dp-raporlar">'+SIRALAMA.RAPORLAR.map(satir).join('')+'</div>'+
    '<div class="et-arac"><button type="button" class="et-dugme" id="srHepsi"'+(herhangi?'':' disabled')+'>Hepsini tek PDF’te indir</button></div>'+
    '<div class="dp-onizleme"><div class="et-kart-bas"><h3 id="srOnizlemeBaslik">Önizleme</h3><span class="mini" id="srOnizlemeAlt">Bir raporda “Önizle”ye basın.</span></div><div id="srSayfalar" class="sr-sayfalar"></div></div></section>';
}
function araclar(salt){
  const bekleyen=!salt&&(D.ogr||[]).some(o=>o&&!o.silindi&&o.denemeYayinBekliyor);
  return (salt?'':'<label class="et-dugme birincil">Dosyadan toplu aktar<input type="file" id="dnPdf" accept="'+yzDosyaKabul()+'" multiple hidden></label>')+
    (bekleyen?'<button type="button" class="et-dugme" id="dnYayinla">Bekleyen sonuçları yayınla</button>':'')+
    '<button type="button" class="et-dugme" id="dpKlasik">Öğrenci bazında</button>';
}
// Seç: Önceki and Şimdiki from every exam of the view, newest first, as Sıralamalar lists them.
function ikiDeneme(m){
  const secenek=secili=>m.sinavlar.map((s,i)=>'<option value="'+kacis(s.id)+'"'+(i===secili?' selected':'')+'>'+kacis(s.ad+' · '+gunAy(s.g,m.yil)+' · '+turAdi(s.tur))+'</option>').reverse().join('');
  return '<label class="et-seg"><span class="et-seg-label">Önceki</span><select id="dpOnceki" aria-label="Önceki deneme">'+secenek(m.onceki)+'</select></label>'+
    '<label class="et-seg"><span class="et-seg-label">Şimdiki</span><select id="dpSimdiki" aria-label="Şimdiki deneme">'+secenek(m.simdi)+'</select></label>';
}
const subeRenkleri=m=>{const l=[...new Set(m.ogrenciler.map(o=>o.sinif||'—'))].sort((a,b)=>a.localeCompare(b,'tr'));return l.length>1?l.map((c,i)=>[c,PALET[i%PALET.length]]):[]};
function icerik(){
  const salt=izleme(),{t,hata}=veriAl();
  const durumSatiri='<p id="dnDurum" role="status" aria-live="polite">'+kacis(EK.denemeDurum||'')+'</p>'+(typeof denemeImportHtml==='function'?denemeImportHtml():'');
  if(hata)return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1></header><p class="et-uyari">'+kacis(hata)+'</p><div class="et-arac">'+araclar(salt)+'</div>'+durumSatiri;
  const st=t?durumAl(t):null;
  if(!st||!st.m.sinavlar.length)return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1><p class="et-cumle">Okulun deneme sonuç listelerinden deneme panosu</p></header><div class="et-arac">'+araclar(salt)+'</div>'+durumSatiri+
    '<section class="et-panel et-bos"><b>Henüz deneme listesi yok</b>'+(salt?'':'<p>Okulun “Öğrenci Adı Sıralı” ya da “Net Sayısı Sıralı” sonuç listesini “Dosyadan toplu aktar” ile ekleyin.</p>')+'</section>';
  const m=st.m,mo=st.mo,es=defterEslesme(),odak=st.ders?m.dersler.find(d=>d.kod===st.ders):null;
  const netAdi=st.ogrDers?(m.O.oturum==='tyt'?'TYT ':'AYT ')+st.ogrDers.ad:toplamAdi(m.O),S=mo.sinavlar[mo.simdi],P=mo.onceki===null?null:mo.sinavlar[mo.onceki];
  cizimPlanla();
  return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1><p class="et-cumle">'+cumle(st)+'</p></header>'+
    '<div class="et-arac">'+araclar(salt)+
      secim('olcu',st.sec.key,st.olcular.map(o=>[o.key,o.ad,!o.m.sinavlar.length]),'Oturum')+
      secim('tur',st.tur,[['','Tümü'],['genel','Genel'],['tarama','Tarama']].map(([k,a])=>[k,a,!!k&&!st.turler.has(k)]),'Tür')+
      secim('aralik',st.s,ARALIKLAR.map(k=>[k,k===1?'Son deneme':'Son '+k,!m.pencere[k]]).concat([['sec','Seç',!m.pencere.sec]]),'Karşılaştır')+
      (st.s==='sec'?ikiDeneme(m):'')+
      '<label class="et-seg"><span class="et-seg-label">Öğrenciler</span><select id="dpKapsam" aria-label="Öğrenciler">'+st.ks.map(k=>'<option value="'+kacis(k.key)+'"'+(k.key===st.K.key?' selected':'')+'>'+kacis(k.ad)+'</option>').join('')+'</select></label>'+
      secim('cizgi',GRAFIK_CIZGI.tur(),GRAFIK_CIZGI.SECENEKLER,'Çizgi')+'</div>'+
    durumSatiri+ozetKartlari(st)+
    '<section class="et-panel" id="dpGenel"><div class="et-kart-bas"><h2>'+kacis(m.O.ad)+' net · deneme deneme</h2><div class="et-lejant"><span><i class="et-renk cizgi" style="background:var(--e-c1)"></i>Ortalama</span>'+
      '<span><i class="et-renk dp-renk-bant" style="background:var(--e-c1)"></i>Ortadaki %50</span><span><i class="et-renk" style="background:var(--e-ok)"></i>Katılım arttı</span><span><i class="et-renk" style="background:var(--e-bad)"></i>azaldı</span></div></div>'+
      '<div class="et-grafik" data-dp-grafik="genel" tabindex="0" role="img" aria-label="'+kacis(m.O.ad+' ortalama net, ortadaki yüzde elli ve katılım, deneme deneme')+'"></div></section>'+
    '<h2 class="et-bolum" id="dpDersler">Dersler</h2>'+dersKartlari(st)+
    '<section class="et-panel"><div class="et-kart-bas"><h2>'+(odak?kacis(odak.ad)+' · ortalama net':'Derslere göre başarı (%)')+'</h2>'+(odak?'<button type="button" class="et-dugme" data-dp-ders="">Tüm dersler</button>':'')+'</div>'+
      '<div class="et-grafik" data-dp-grafik="ders" tabindex="0" role="img" aria-label="'+kacis(odak?odak.ad+' ortalama net':'Derslerin başarı yüzdesi, deneme deneme')+'"></div></section>'+zorluk(st)+kaynakBolumleri(st)+
    '<div class="dp-bolum-bas"><h2 class="et-bolum" id="dpOgrenciler">Öğrenciler</h2><div class="et-arac">'+
      '<label class="et-seg"><span class="et-seg-label">Net</span><select id="dpOgrNet" aria-label="Öğrencilerde gösterilen net"><option value="">'+kacis(toplamAdi(m.O))+'</option>'+
        [['Dersler',derslerYalniz(m.dersler)],['Toplam',m.dersler.filter(d=>d.uyeler)]].filter(([,l])=>l.length).map(([ad,l])=>'<optgroup label="'+ad+'">'+
          l.map(d=>'<option value="'+kacis(d.kod)+'"'+(st.ogrDers&&st.ogrDers.kod===d.kod?' selected':'')+'>'+kacis(d.ad)+'</option>').join('')+'</optgroup>').join('')+'</select></label></div></div>'+
    '<section class="et-panel" id="dpOgrCizgi"><div class="et-kart-bas"><h2>Öğrencilere göre · '+kacis(netAdi)+'</h2><div class="et-lejant">'+
      subeRenkleri(mo).map(([c,r])=>'<span><i class="et-renk cizgi" style="background:'+r+'"></i>'+kacis(c)+'</span>').join('')+'<span><i class="et-renk cizgi" style="background:var(--e-muted)"></i>Ortalama</span></div></div>'+
      '<div class="et-grafik" data-dp-grafik="ogrenci" tabindex="0" role="img" aria-label="'+kacis('Her öğrencinin '+netAdi+' neti, deneme deneme. Yukarı ve aşağı oklarla öğrenci, Enter ile öğrenci kartı')+'"></div></section>'+
    '<div class="et-iki"><section class="et-panel"><div class="et-kart-bas"><h2>Net dağılımı · '+simdiAdi(st)+(st.ogrDers?' · '+kacis(st.ogrDers.ad):'')+'</h2><div class="et-lejant"><span><i class="et-renk" style="background:var(--e-c1)"></i>'+kacis(S.ad)+'</span>'+
      (P?'<span><i class="et-renk cizgi" style="background:var(--e-fg2)"></i>Önceki deneme</span>':'')+'</div></div>'+
      '<div class="et-grafik orta" data-dp-grafik="dagilim" tabindex="0" role="img" aria-label="'+kacis('Net dağılımı, '+S.ad+(P?', önceki denemeyle':''))+'"></div></section>'+
    '<section class="et-panel"><div class="et-kart-bas"><h2>En çok değişenler</h2><span class="mini">'+(st.s==='sec'?kacis(P.ad)+' → '+kacis(S.ad):st.s?(st.s===1?'Son deneme, öncekine göre':'Son '+st.s+' deneme ortalaması, önceki '+st.s+' denemeye göre'):'')+'</span></div>'+hareketliler(st)+'</section></div>'+
    '<div class="et-bolunmus"><section class="et-panel" id="dpTablo"><div class="et-kart-bas"><h2>Tüm öğrenciler</h2>'+(st.s?secim('olcut',st.olcut,OLCUTLER,'Sırala'):'')+'</div>'+tablo(st)+'</section>'+
    '<section class="et-panel et-kisi" id="dpKisi">'+kisiKarti(st,es)+'</section></div>'+sinavTablosu(st,salt)+raporlar(st);
}
function gorunum(){return '<div id="dpKok">'+icerik()+'</div>'}
function yenidenCiz(odak){
  const kok=document.getElementById('dpKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();cizimPlanla();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
document.addEventListener('click',ev=>{
  if(EK.sekme!=='denemeler'||!rehberMi()||ev.target.closest?.('[data-ogrenci-karti]'))return;
  const el=ev.target.closest?.('[data-dp-olcu],[data-dp-tur],[data-dp-aralik],[data-dp-cizgi],[data-dp-olcut],[data-dp-ders],[data-dp-ogr],[data-dp-sira],#dpKlasik,#dpPanoya');if(!el||el.disabled)return;
  if(el.id==='dpKlasik'){EK.denemeKlasik=true;ciz();return}
  if(el.id==='dpPanoya'){EK.denemeKlasik=false;ciz();return}
  if(!document.getElementById('dpKok'))return;
  const q=v=>typeof CSS!=='undefined'&&CSS.escape?CSS.escape(v):v;
  if(el.dataset.dpOlcu){EK.dpOlcu=el.dataset.dpOlcu;EK.dpDers=null;EK.dpOgrNet=null;yenidenCiz('[data-dp-olcu="'+q(EK.dpOlcu)+'"]');return}
  if(el.dataset.dpTur!==undefined){EK.dpTur=el.dataset.dpTur;yenidenCiz('[data-dp-tur="'+q(EK.dpTur)+'"]');return}
  if(el.dataset.dpCizgi){GRAFIK_CIZGI.sec(el.dataset.dpCizgi);yenidenCiz('[data-dp-cizgi="'+GRAFIK_CIZGI.tur()+'"]');return}
  if(el.dataset.dpAralik){const a=el.dataset.dpAralik;EK.dpAralik=a==='sec'?'sec':Number(a);yenidenCiz('[data-dp-aralik="'+a+'"]');return}
  // Ranking by a change measure orders the table by that rank; Net returns to the default order.
  if(el.dataset.dpOlcut){EK.dpOlcut=el.dataset.dpOlcut;if(EK.dpOlcut==='net'){EK.dpSira='son';EK.dpSiraYon='azalan'}else{EK.dpSira='sira';EK.dpSiraYon='artan'}
    yenidenCiz('[data-dp-olcut="'+EK.dpOlcut+'"]');return}
  if(el.dataset.dpDers!==undefined){const d=el.dataset.dpDers,satir=el.classList.contains('dp-zor-satir');EK.dpDers=d&&EK.dpDers!==d?d:null;
    yenidenCiz(d?(satir?'.dp-zor-satir':'.et-ders')+'[data-dp-ders="'+q(d)+'"]':null);return}
  if(el.dataset.dpSira){const k=el.dataset.dpSira;if(EK.dpSira===k)EK.dpSiraYon=EK.dpSiraYon==='artan'?'azalan':'artan';else{EK.dpSira=k;EK.dpSiraYon=['ad','sinif','no','sira','durum'].includes(k)?'artan':'azalan'}
    yenidenCiz('[data-dp-sira="'+k+'"]');return}
  if(el.dataset.dpOgr){EK.dpOgr=el.dataset.dpOgr;yenidenCiz();const kart=document.getElementById('dpKisi');
    if(kart&&getComputedStyle(kart).position!=='sticky')kart.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target,id=el.id;
  if(id==='dpKapsam'){EK.dpKapsam=el.value;EK.dpOgr=null;yenidenCiz('#dpKapsam');return}
  if(id==='dpOnceki'||id==='dpSimdiki'){EK[id]=el.value;yenidenCiz('#'+id);return}
  if(id==='dpOgrNet'){EK.dpOgrNet=el.value||null;yenidenCiz('#dpOgrNet');return}
  if(el.dataset&&el.dataset.dpSinavTur){
    try{await SIRALAMA.turDegistir(el.dataset.dpSinavTur,el.value);EK.denemeDurum=''}catch(e){EK.denemeDurum=e.message||String(e)}
    yenidenCiz();return}
});
document.addEventListener('input',ev=>{if(etkin()&&ev.target.id==='dpAra'){EK.dpAra=ev.target.value;filtrele()}});
function filtrele(){
  const ara=anahtar(EK.dpAra||'');let n=0,t=0;
  document.querySelectorAll('#dpTablo .et-tablo tbody tr[data-ara]').forEach(tr=>{t++;const g=!ara||tr.dataset.ara.includes(ara);tr.hidden=!g;if(g)n++});
  const s=document.getElementById('dpSayac');if(s)s.textContent=n===t?fi(t)+' öğrenci':fi(n)+' / '+fi(t)+' öğrenci';
}
function imlecGoster(ev){
  if(!etkin()||GRAFIK_OLCUM.olcuyor())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(!kutu)return;
  if(CIZIMLER.get(kutu.dataset.dpGrafik)?.seriler)seriVurgula(kutu,enYakinSeri(kutu,ev.clientX,ev.clientY));
  ipucuGoster(kutu,enYakin(kutu,ev.clientX));
}
document.addEventListener('pointermove',imlecGoster);
document.addEventListener('pointerdown',imlecGoster);
// A click (or Enter) on a student's line opens that student's card.
function ogrenciSec(kutu){
  const g=CIZIMLER.get('ogrenci');if(!g||kutu.dataset.seri===undefined)return;
  EK.dpOgr=g.seriler[Number(kutu.dataset.seri)].no;yenidenCiz();
  const kart=document.getElementById('dpKisi');if(kart&&getComputedStyle(kart).position!=='sticky')kart.scrollIntoView({block:'nearest',behavior:'smooth'});
}
document.addEventListener('click',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik="ogrenci"]');if(kutu)ogrenciSec(kutu)});
document.addEventListener('pointerout',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu&&!kutu.contains(ev.relatedTarget)&&document.activeElement!==kutu)ipucuGizle(kutu)});
document.addEventListener('keydown',ev=>{
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(!kutu||!['ArrowLeft','ArrowRight','Home','End','Escape','ArrowUp','ArrowDown','Enter'].includes(ev.key))return;
  const g=CIZIMLER.get(kutu.dataset.dpGrafik);if(!g)return;
  if(['ArrowUp','ArrowDown','Enter'].includes(ev.key)&&!g.seriler)return;
  ev.preventDefault();
  if(ev.key==='Escape'){ipucuGizle(kutu);return}
  const i=kutu.dataset.i===undefined?g.xs.length-1:Number(kutu.dataset.i);
  if(ev.key==='Enter'){if(kutu.dataset.dpGrafik==='ogrenci')ogrenciSec(kutu);return}
  // ↑/↓ walk the lines from top to bottom at the current exam.
  if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){
    const sira=g.seriler.map((s,k)=>[k,s.pts[i]]).filter(x=>x[1]).sort((a,b)=>a[1][1]-b[1][1]).map(x=>x[0]);if(!sira.length)return;
    const j=sira.indexOf(Number(kutu.dataset.seri)),yeni=j<0?(ev.key==='ArrowDown'?0:sira.length-1):Math.max(0,Math.min(sira.length-1,j+(ev.key==='ArrowDown'?1:-1)));
    seriVurgula(kutu,sira[yeni]);ipucuGoster(kutu,i);return;
  }
  ipucuGoster(kutu,ev.key==='Home'?0:ev.key==='End'?g.xs.length-1:Math.max(0,Math.min(g.xs.length-1,i+(ev.key==='ArrowLeft'?-1:1))));
});
document.addEventListener('focusout',ev=>{const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu)ipucuGizle(kutu)});
// Seç: a line is dragged to any exam but the other line's; the tooltip and an "Önceki → Şimdiki"
// readout follow it; on release the board compares the two exams (EK.dpOnceki / EK.dpSimdiki).
let SURUKLE=null;
function surukleYaz(){
  const {kutu,g}=SURUKLE,a=g.deger[SURUKLE.once],b=g.deger[SURUKLE.son];
  let el=kutu.querySelector('.et-surukle');if(!el){el=document.createElement('div');el.className='et-surukle';kutu.appendChild(el)}
  el.innerHTML=gunAy(g.g[SURUKLE.once],g.yil)+' → '+gunAy(g.g[SURUKLE.son],g.yil)+': <b>'+f1(a)+' → '+f1(b)+'</b> net '+hap(b-a,f1(Math.abs(b-a)));
}
document.addEventListener('pointerdown',ev=>{
  if(!etkin())return;const t=ev.target.closest?.('.et-grafik[data-dp-grafik="genel"] [data-tutamak]');if(!t)return;
  const kutu=t.closest('.et-grafik'),g=CIZIMLER.get('genel'),svg=kutu.querySelector('svg');if(!g||!g.tutamak||!svg)return;
  const yer=ad=>{const v=/translate\(([\d.-]+)/.exec(svg.querySelector('[data-tutamak="'+ad+'"]').getAttribute('transform'));return g.xs.reduce((en,x,i)=>Math.abs(x-v[1])<Math.abs(g.xs[en]-v[1])?i:en,0)};
  ev.preventDefault();SURUKLE={kutu,g,svg,hangi:t.dataset.tutamak,once:yer('once'),son:yer('son')};
  try{kutu.setPointerCapture(ev.pointerId)}catch(e){}
  kutu.classList.add('suruklen');surukleYaz();
});
document.addEventListener('pointermove',ev=>{
  if(!SURUKLE)return;const {kutu,g,svg,hangi}=SURUKLE,i=enYakin(kutu,ev.clientX);
  if(i<0||i===SURUKLE[hangi==='once'?'son':'once'])return;
  SURUKLE[hangi]=i;svg.querySelector('[data-tutamak="'+hangi+'"]').setAttribute('transform','translate('+r1(g.xs[i])+',0)');
  const bant=svg.querySelector('[data-bant="'+hangi+'"]');if(bant){bant.setAttribute('x',r1(g.xs[i]-g.step/2));bant.setAttribute('width',r1(g.step))}
  surukleYaz();ipucuGoster(kutu,i);
});
function birak(){
  if(!SURUKLE)return;const {g}=SURUKLE;EK.dpOnceki=g.ids[SURUKLE.once];EK.dpSimdiki=g.ids[SURUKLE.son];SURUKLE=null;
  yenidenCiz();
}
document.addEventListener('pointerup',birak);document.addEventListener('pointercancel',birak);
GRAFIK_OLCUM.kur({secici:'.et-grafik[data-dp-grafik]',kok:'#dpKok',etkin,bilgi:olcBilgi,yakin:enYakin,ipucuGizle:ipucuSakla,hap,fmt:f1});
return {temel,olcu,kapsamlar,gorunumModeli,veriAl,durumAl,icerik,gorunum,grafikleriCiz,GRAFIKLER,CIZIMLER,ESIK,degisimKaynagi,isiHaritasi,isiRengi,kaynakCumlesi,kaynakBolumleri};
})();
function gorunumDenemePanosu(){return DPANO.gorunum()}
