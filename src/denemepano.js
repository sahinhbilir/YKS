// Embedded in index.html by scripts/embed-denemepano.cjs. No student data belongs here.
// Deneme panosu (teacher only): the teacher's Denemeler page as a stock-style board, drawn from
// the school's own result lists that Denemeler and Sıralamalar already keep in D.siralama. It
// adds no storage of its own: "PDF’den toplu aktar" is the existing import, and the classic
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
  const sinavlar=SIRALAMA.modeller(veri).map(e=>({id:e.id,ad:e.name,tarih:e.dates[0]||'',g:gunDan(e.dates[0]),
    tyt:e.tyt?e.tyt.students:{},ayt:e.ayt?e.ayt.students:{},listeler:[e.T?'Net Sayısı Sıralı':'',e.F?'Öğrenci Adı Sıralı':''].filter(Boolean)}));
  const kisi=new Map();
  for(const s of sinavlar)for(const o of [...Object.values(s.tyt),...Object.values(s.ayt)]){
    const k=kisi.get(o.no)||{no:o.no,ad:o.name,sinif:''},c=sinifAdi(o.cls);
    if(c)k.sinif=c;if(o.name)k.ad=o.name;kisi.set(o.no,k);
  }
  return {sinavlar,kisi};
}
function olcu(key){
  const S=SIRALAMA,renkli=list=>{const sira=list.slice().sort((a,b)=>ONCELIK.indexOf(a[1])-ONCELIK.indexOf(b[1]));return list.map(d=>({kod:d[0],ad:d[1],soru:d[2],renk:PALET[sira.indexOf(d)]||'var(--e-muted)'}))};
  if(key==='TYT')return {key,ad:'TYT',oturum:'tyt',ust:S.SIRA_UST.TYT,deger:s=>S.hasTYT(s)?S.tytTotal(s):null,dersler:renkli(S.SIRA_DERS.TYT)};
  const f=key.split(':')[1];
  if(f==='Toplam')return {key,ad:'AYT toplam',oturum:'ayt',ust:S.SIRA_UST.Toplam,deger:s=>S.hasAYT(s)?S.aytTotal(s):null,dersler:renkli(S.SIRA_DERS.AYT)};
  return {key,ad:'AYT '+f,oturum:'ayt',ust:S.SIRA_UST[f],deger:s=>S.took(s,f)?S.fnet(s,f):null,dersler:renkli(S.SIRA_DERS.AYT.filter(d=>S.FCOLS[f].includes(d[0])))};
}
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
function gorunumModeli(t,O,K){
  const sinavlar=[];
  for(const s of t.sinavlar){
    const satir=[];
    for(const o of Object.values(O.oturum==='tyt'?s.tyt:s.ayt)){if(!K.uyar(t.kisi.get(o.no)))continue;const v=O.deger(o);if(v!==null)satir.push({no:o.no,v,o})}
    if(!satir.length)continue;
    const vs=satir.map(r=>r.v).sort((a,b)=>a-b),en=satir.reduce((a,b)=>b.v>a.v?b:a);
    const sira=new Map();satir.slice().sort((a,b)=>b.v-a.v).forEach((r,i,l)=>sira.set(r.no,i&&l[i-1].v===r.v?sira.get(l[i-1].no):i+1));
    sinavlar.push({id:s.id,ad:s.ad,tarih:s.tarih,g:s.g,n:satir.length,ort:ort(vs),medyan:yuzdelik(vs,.5),p25:yuzdelik(vs,.25),p75:yuzdelik(vs,.75),max:en.v,enIyi:en.no,
      ders:O.dersler.map(d=>ort(satir.map(r=>r.o.net[d.kod]??0))),deger:new Map(satir.map(r=>[r.no,r])),sira});
  }
  const n=sinavlar.length,pencere={};
  for(const k of ARALIKLAR)if(n>=2*k)pencere[k]={once:[n-2*k,n-k-1],son:[n-k,n-1]};
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
    ozet[kk]={once,son,fark:son-once,artan:ogrenciler.filter(o=>o.k[kk].durum==='Yükseliyor').length,azalan:ogrenciler.filter(o=>o.k[kk].durum==='Düşüyor').length}}
  return {O,K,sinavlar,pencere,ogrenciler,dersler,ozet,yil:sinavlar.length?new Date(sinavlar[n-1].g*864e5).getUTCFullYear():null};
}
let ONBELLEK={imza:null,t:null};
function veriAl(){
  const {veri,hata}=SIRALAMA.oku();if(!veri)return {hata};
  const imza=veri.sinavlar.map(s=>s.id+':'+s.ts+':'+(s.tarih||'')).join('|');
  if(ONBELLEK.imza!==imza)ONBELLEK={imza,t:temel(veri)};
  return {t:ONBELLEK.t,veri};
}
function durumAl(t){
  const ks=kapsamlar(t),K=ks.find(k=>k.key===EK.dpKapsam)||varsayilanKapsam(t,ks);
  const olcular=OLCULER.map(([key,ad])=>{const O=olcu(key);return {key,ad,O,m:gorunumModeli(t,O,K)}});
  const sec=olcular.find(o=>o.key===EK.dpOlcu&&o.m.sinavlar.length)||olcular.find(o=>o.m.sinavlar.length)||olcular[0],m=sec.m;
  const s=ARALIKLAR.includes(EK.dpAralik)&&m.pencere[EK.dpAralik]?EK.dpAralik:m.pencere[1]?1:null;
  const ogr=m.ogrenciler.find(o=>o.no===EK.dpOgr)||m.ogrenciler[0]||null;
  return {ks,K,olcular,sec,m,s,ders:m.dersler.some(d=>d.kod===EK.dpDers)?EK.dpDers:null,ogr};
}

/* ---------------- charts (SVG strings, sized to their box) ---------------- */
const CIZIMLER=new Map();
function tikler(lo,hi,n){
  const span=Math.max(1e-9,hi-lo),ham=span/n,us=Math.pow(10,Math.floor(Math.log10(ham))),adim=[1,2,2.5,5,10].map(k=>k*us).find(k=>k>=ham-1e-9);
  const a=Math.floor(lo/adim)*adim,out=[];for(let v=a;v<hi+adim-1e-9;v+=adim)out.push(Math.round(v*1000)/1000);return out;
}
function tiklerSayi(max,n){const ham=max/n,us=Math.pow(10,Math.floor(Math.log10(Math.max(ham,1)))),adim=Math.max(1,[1,2,5,10].map(k=>k*us).find(k=>k>=ham-1e-9)),out=[];for(let v=0;v<max;v+=adim)out.push(v);out.push(out[out.length-1]+adim);return out}
const yaziGen=s=>String(s).length*7;
const yol=pts=>pts.length?'M'+pts.map(p=>r1(p[0])+','+r1(p[1])).join('L'):'';
function egim(id,renk){return '<defs><linearGradient id="'+id+'" x1="0" x2="0" y1="0" y2="1">'+[[0,.26],[.25,.16],[.5,.08],[.75,.03],[1,0]].map(([o,a])=>'<stop offset="'+o+'" style="stop-color:'+renk+';stop-opacity:'+a+'"/>').join('')+'</linearGradient></defs>'}
const imlec=(ust,alt)=>'<line class="et-kural" y1="'+ust+'" y2="'+alt+'" x1="0" x2="0" visibility="hidden"/><g class="et-imlecler"></g>';
function eksenY(tik,y,L,R,f){f=f===f1?(t=>Number.isInteger(t)?fi(t):f1(t)):f;return tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+f(t)+'</text>').join('')}
function eksenX(m,x,step,W,y0){
  const her=Math.max(1,Math.ceil(56/step)),n=m.sinavlar.length;let out='';
  m.sinavlar.forEach((s,i)=>{if((n-1-i)%her)return;const t=gunAy(s.g,m.yil),w=yaziGen(t);let xx=x(i),a='middle';
    if(xx-w/2<0){xx=0;a='start'}else if(xx+w/2>W){xx=W;a='end'}out+='<text class="et-tik" x="'+r1(xx)+'" y="'+y0+'" text-anchor="'+a+'">'+t+'</text>'});
  return out;
}
function bantlar(m,x,step,k,ust,alt){
  const w=m.pencere[k];if(!w)return '';let out='';
  for(const [sinif,[a,b],etiket] of [['once',w.once,k===1?'Önceki':'Önceki '+k],['son',w.son,k===1?'Son':'Son '+k]]){
    const xa=x(a)-step/2,xb=x(b)+step/2;
    out+='<rect class="et-bant '+sinif+'" x="'+r1(xa)+'" y="'+ust+'" width="'+r1(xb-xa)+'" height="'+(alt-ust)+'"/>';
    if(xb-xa>58)out+='<text class="et-bant-yazi" x="'+r1(xa+6)+'" y="'+(ust+13)+'">'+etiket+'</text>';
  }
  return out;
}
const sinavBasligi=(s,m)=>s.ad+' · '+gunAy(s.g,m.yil);
function grafikGenel(st,W){
  const m=st.m,d=m.sinavlar,H=300,lo=Math.min(...d.map(s=>s.p25),...d.map(s=>s.ort)),hi=Math.max(...d.map(s=>s.p75),...d.map(s=>s.ort));
  const tik=tikler(Math.max(lo-(hi-lo)*.15-1,Math.min(0,lo)),hi+(hi-lo)*.15+1,5);
  const R=W-(Math.max(...tik.map(t=>yaziGen(f1(t))),yaziGen(f1(d[d.length-1].ort)))+22),L=2,ust=26,hacimH=50,alt=H-26,fiyatAlt=alt-hacimH-18;
  const step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>fiyatAlt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(fiyatAlt-ust);
  const nMax=Math.max(...d.map(s=>s.n)),yv=v=>alt-v/nMax*hacimH;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+egim('dpEgimGenel','var(--e-c1)');
  svg+=bantlar(m,x,step,st.s,4,alt)+eksenY(tik,y,L,R,f1)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
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
  svg+=eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=d.map(s=>({bas:sinavBasligi(s,m),satir:[['var(--e-c1)','Ortalama',f1(s.ort)+' net','cizgi'],[null,'Medyan',f1(s.medyan)],['var(--e-c1)','Ortadaki %50',f1(s.p25)+' – '+f1(s.p75),'bant'],
    [null,'En yüksek',f2(s.max)],[null,'Katılım',fi(s.n)+' öğrenci']]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:pts.map(p=>p[1]),noktalar:pts.map(p=>[[p[1],'var(--e-c1)']]),ipucu};
}
function grafikDers(st,W){
  const m=st.m,d=m.sinavlar,H=300,odak=st.ders?m.dersler.find(x=>x.kod===st.ders):null,seri=odak?[odak]:m.dersler;
  const deger=(x,i)=>odak?x.seri[i]:x.seri[i]/x.soru*100,fmt=odak?f1:(v=>(v<0?'−':'')+'%'+fi(Math.abs(Math.round(v))));
  const vals=seri.flatMap(x=>d.map((_,i)=>deger(x,i))),tik=tikler(Math.min(0,...vals),Math.max(...vals,odak?1:10),5);
  const R=W-(Math.max(...tik.map(t=>yaziGen(fmt(t))))+22),L=2,ust=26,alt=H-26,step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,st.s,4,alt)+eksenY(tik,y,L,R,fmt)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  if(odak){const pts=d.map((_,i)=>[x(i),y(deger(odak,i))]);svg+=egim('dpEgimDers',odak.renk)+'<path d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+alt+'L'+r1(pts[0][0])+','+alt+'Z" style="fill:url(#dpEgimDers)"/>'}
  for(const s of seri.slice().reverse()){const pts=d.map((_,i)=>[x(i),y(deger(s,i))]);
    svg+='<path class="et-cizgi '+(odak?'kalin':'ince')+'" style="stroke:'+s.renk+'" d="'+yol(pts)+'"/>'+(odak||d.length<2?pts.map(p=>'<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3" style="fill:'+s.renk+'"/>').join(''):'')}
  svg+=eksenX(m,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=d.map((s,i)=>({bas:sinavBasligi(s,m),satir:seri.map(x=>[x.renk,x.ad,odak?f1(x.seri[i])+' / '+x.soru:'%'+fi(Math.round(deger(x,i)))+' · '+f1(x.seri[i])+' net',deger(x,i)]).sort((a,b)=>b[3]-a[3]).map(([c,a,v])=>[c,a,v,'cizgi'])}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>odak?y(deger(odak,i)):ust+40),noktalar:d.map((_,i)=>seri.map(s=>[y(deger(s,i)),s.renk])),ipucu};
}
function grafikDagilim(st,W){
  const m=st.m,d=m.sinavlar,son=d[d.length-1],once=d.length>1?d[d.length-2]:null,H=240,gen=m.O.ust>100?20:m.O.ust>60?10:5;
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
  const m=st.m,o=st.ogr;if(!o)return null;
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
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((s,i)=>y(o.seri[i]??s.ort)),noktalar:d.map((s,i)=>o.seri[i]===null?[]:[[y(o.seri[i]),'var(--e-c1)']]),ipucu};
}
const GRAFIKLER={genel:grafikGenel,ders:grafikDers,dagilim:grafikDagilim,kisi:grafikKisi};
let ZAMAN=null;
const etkin=()=>EK.sekme==='denemeler'&&rehberMi()&&!!document.getElementById?.('dpKok');
function grafikleriCiz(){
  if(!etkin())return;const {t}=veriAl();if(!t)return;const st=durumAl(t);if(!st.m.sinavlar.length)return;
  document.querySelectorAll('.et-grafik[data-dp-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const imza=W+'|'+ONBELLEK.imza+'|'+st.sec.key+'|'+st.K.key+'|'+st.s+'|'+st.ders+'|'+(st.ogr&&st.ogr.no);if(kutu.dataset.imza===imza)return;
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
  svg.querySelector('.et-imlecler').innerHTML=g.noktalar[i].map(([yy,c])=>'<circle cx="'+r1(cx)+'" cy="'+r1(yy)+'" r="4.5" class="et-imlec" style="fill:'+c+'"/>').join('');
  const p=g.ipucu[i];
  tip.innerHTML='<div class="et-ipucu-bas">'+kacis(p.bas)+'</div>'+p.satir.map(([c,ad,v,tur])=>'<div class="et-ipucu-satir">'+(c?'<i class="et-renk'+(tur==='cizgi'?' cizgi':'')+(tur==='bant'?' dp-renk-bant':'')+'" style="background:'+c+'"></i>':'')+'<span>'+kacis(ad)+'</span><b>'+kacis(v)+'</b></div>').join('');
  tip.hidden=false;
  const olcek=kutu.clientWidth/Number(svg.viewBox.baseVal.width||kutu.clientWidth),px=cx*olcek,py=g.ys[i]*olcek,bw=kutu.clientWidth,tw=tip.offsetWidth,th=tip.offsetHeight;
  let sol=px+14;if(sol+tw>bw)sol=px-tw-14;sol=Math.max(0,Math.min(sol,bw-tw));
  tip.style.left=sol+'px';tip.style.top=Math.max(0,Math.min(py-th/2,kutu.clientHeight-th))+'px';
}
function ipucuGizle(kutu){
  const tip=kutu.querySelector('.et-ipucu'),svg=kutu.querySelector('svg');if(tip)tip.hidden=true;delete kutu.dataset.i;
  if(svg){svg.querySelector('.et-kural')?.setAttribute('visibility','hidden');svg.querySelector('.et-vurgu-bant')?.setAttribute('visibility','hidden');const im=svg.querySelector('.et-imlecler');if(im)im.innerHTML=''}
}
function enYakin(kutu,clientX){
  const g=CIZIMLER.get(kutu.dataset.dpGrafik),svg=kutu.querySelector('svg');if(!g||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;g.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(g.xs[en]-vx))en=i});return en;
}

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-dp-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(ok(v)?'<span aria-hidden="true">'+ok(v)+'</span>':'')+yazi+'</span>';
function kucukCizgi(vals,renk,son,G,Y,id){
  const n=vals.length,var_=vals.filter(v=>v!==null),mx=Math.max(...var_),mn=Math.min(...var_),x=i=>2+(G-6)*(n>1?i/(n-1):.5),y=v=>Y-3-(mx===mn?.5:(v-mn)/(mx-mn))*(Y-7);
  const pts=vals.map((v,i)=>v===null?null:[x(i),y(v)]).filter(Boolean);
  let s='<svg viewBox="0 0 '+G+' '+Y+'" width="100%" height="'+Y+'" preserveAspectRatio="none" aria-hidden="true">';
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
const pencereAdi=k=>k===1?'son deneme':'son '+k+' deneme';
function cumle(st){
  const m=st.m,o=m.ozet[st.s],son=m.sinavlar[m.sinavlar.length-1],b=t=>'<b>'+t+'</b>';
  const kapsam=st.K.key==='hepsi'?'':kacis(st.K.ad)+' · ';
  if(!o)return kapsam+'Tek deneme var: '+kacis(son.ad)+' ('+gunAy(son.g,m.yil)+'), '+kacis(m.O.ad)+' ortalaması '+b(f1(son.ort))+' net. Karşılaştırma için ikinci deneme gerekir.';
  const en=m.dersler.slice().sort((a,c)=>Math.abs(c.k[st.s].fark)-Math.abs(a.k[st.s].fark))[0];
  return kapsam+(st.s===1?'Son deneme ('+kacis(son.ad)+', '+gunAy(son.g,m.yil)+'): ':'Son '+st.s+' deneme: ')+kacis(m.O.ad)+' ortalaması '+b(f1(o.son))+' net, '+
    (st.s===1?'önceki denemeye':'önceki '+st.s+' denemeye')+' göre '+b(isaret(o.fark))+'. En çok değişen ders: '+kacis(en.ad)+' '+b(isaret(en.k[st.s].fark))+'. '+
    b(fi(o.artan))+' öğrenci en az '+ESIK+' net yükseldi, '+b(fi(o.azalan))+' öğrenci düştü.';
}
function ozetKartlari(st){
  const m=st.m,son=m.sinavlar[m.sinavlar.length-1],once=m.sinavlar.length>1?m.sinavlar[m.sinavlar.length-2]:null,o=m.ozet[st.s];
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const enIyi=m.ogrenciler.find(x=>x.no===son.enIyi);
  return '<div class="et-ozet">'+
    (o?kart('Ortalama net · '+pencereAdi(st.s),f1(o.son),hap(o.fark,isaret(o.fark).replace(/^[+−]/,''))+'<span class="mini">önceki: '+f1(o.once)+'</span>')
      :kart('Ortalama net · son deneme',f1(son.ort),'<span class="mini">'+kacis(son.ad)+'</span>'))+
    kart('Ortadaki %50 · son deneme',f1(son.p25)+'–'+f1(son.p75),'<span class="mini">medyan '+f1(son.medyan)+' net</span>')+
    kart('En yüksek net · son deneme',f2(son.max),'<span class="mini">'+kacis(enIyi?kisiAdi(enIyi.ad):'')+'</span>')+
    (o?kart('Yükselen öğrenci · '+pencereAdi(st.s),fi(o.artan),'<span class="mini">düşen: '+fi(o.azalan)+' · en az '+ESIK+' net</span>'):'')+
    kart('Katılım · son deneme',fi(son.n),once?hap(son.n-once.n,fi(Math.abs(son.n-once.n)))+'<span class="mini">önceki: '+fi(once.n)+'</span>':'<span class="mini">öğrenci</span>')+'</div>';
}
function dersKartlari(st){
  const m=st.m,w=m.pencere[st.s],son=w?w.son:null;
  return '<div class="et-dersler">'+m.dersler.map((d,di)=>{const k=d.k[st.s],f=k?k.fark:0,deger=k?k.son:d.seri[d.seri.length-1];
    return '<button type="button" class="et-ders" data-dp-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.ders===d.kod)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ad)+'</b><span class="mini">'+fi(d.soru)+' soru</span></span>'+
      '<strong>'+f1(deger)+'</strong>'+(k?'<span class="et-ders-alt">'+hap(f,isaret(f).replace(/^[+−]/,''))+'<span class="mini">önceki: '+f1(k.once)+'</span></span>':'<span class="et-ders-alt"><span class="mini">%'+fi(Math.round(deger/d.soru*100))+' başarı</span></span>')+
      '<span class="et-kucuk-kutu">'+kucukCizgi(d.seri,egilimRengi(f),son,160,38,'dpSg'+di)+'</span></button>'}).join('')+'</div>';
}
function hareketliler(st){
  const s=st.s,m=st.m;if(!m.pencere[s])return '<p class="mini">Karşılaştırma için en az iki deneme gerekir.</p>';
  const art=m.ogrenciler.filter(o=>o.k[s].fark!==null&&o.k[s].fark>0).sort((a,b)=>b.k[s].fark-a.k[s].fark).slice(0,6);
  const az=m.ogrenciler.filter(o=>o.k[s].fark!==null&&o.k[s].fark<0).sort((a,b)=>a.k[s].fark-b.k[s].fark).slice(0,6);
  const sutun=(baslik,liste)=>'<div class="et-hareket"><h3>'+baslik+'</h3>'+(liste.length?liste.map(o=>
    '<button type="button" class="et-hareket-satir" data-dp-ogr="'+kacis(o.no)+'" aria-pressed="'+(st.ogr&&st.ogr.no===o.no)+'"><span class="et-kim"><span>'+kacis(kisiAdi(o.ad))+'</span><span class="mini">'+kacis(o.sinif||'—')+'</span></span>'+
    '<span class="mini">'+f1(o.k[s].once)+' → '+f1(o.k[s].son)+'</span>'+hap(o.k[s].fark,f2(Math.abs(o.k[s].fark)))+'</button>').join(''):'<p class="mini">Bu aralıkta kimse yok.</p>')+'</div>';
  return '<div class="et-hareketler">'+sutun('En çok yükselenler',art)+sutun('En çok düşenler',az)+'</div>';
}
const SUTUNLAR=[['ad','Öğrenci'],['sinif','Şube'],['son','Son'],['once','Önceki'],['fark','Değişim'],['seri','Denemeler'],['sira','Sıra'],['durum','Durum']];
function tablo(st){
  const m=st.m,s=st.s,w=m.pencere[s],son=w?w.son:null,kol=SUTUNLAR.filter(([k])=>w||!['once','fark','durum'].includes(k));
  const sira=kol.some(([k])=>k===EK.dpSira)&&EK.dpSira!=='seri'?EK.dpSira:'son',yonu=EK.dpSiraYon==='artan'?1:-1;
  const deger=(o,c)=>c==='ad'?kisiAdi(o.ad):c==='sinif'?o.sinif:c==='no'?Number(o.no):c==='enIyi'?o.enIyi:c==='sira'?(o.sira===null?1e9:o.sira):c==='son'?(w?o.k[s].son:o.sonNet):c==='durum'?(w?o.k[s].durum:''):(w?o.k[s][c]:null);
  const liste=m.ogrenciler.slice().sort((a,b)=>{const x=deger(a,sira),y=deger(b,sira);if(x===null&&y===null)return 0;if(x===null)return 1;if(y===null)return -1;
    const f=typeof x==='number'?x-y:String(x).localeCompare(String(y),'tr');return f*yonu||String(a.ad).localeCompare(b.ad,'tr')});
  const ara=anahtar(EK.dpAra||''),gor=o=>!ara||anahtar(o.ad).includes(ara)||String(o.no).includes(ara);
  const gizli=k=>['sinif','once','seri'].includes(k)?' class="et-dar-gizle"':'';
  const bas=kol.map(([k,ad])=>{const yazi=k==='son'?(st.s>1&&w?'Son '+st.s+' ort.':'Son'):k==='once'?(st.s>1?'Önceki '+st.s+' ort.':'Önceki'):ad;
    return k==='seri'?'<th scope="col"'+gizli(k)+'>'+yazi+'</th>':'<th scope="col"'+gizli(k)+' aria-sort="'+(sira===k?(yonu>0?'ascending':'descending'):'none')+'"><button type="button" data-dp-sira="'+k+'">'+yazi+'</button></th>'}).join('');
  const satir=o=>{const c=w?o.k[s]:null,f=c?c.fark:null,sonDeger=c?c.son:o.sonNet;
    return '<tr data-dp-ogr="'+kacis(o.no)+'" data-ara="'+kacis(anahtar(o.ad)+' '+o.no)+'"'+(st.ogr&&st.ogr.no===o.no?' class="secili"':'')+(gor(o)?'':' hidden')+'>'+
      '<td><button type="button" class="et-ad" data-dp-ogr="'+kacis(o.no)+'">'+kacis(kisiAdi(o.ad))+'</button></td><td class="et-dar-gizle">'+kacis(o.sinif||'—')+'</td>'+
      '<td class="sayi">'+(sonDeger===null||sonDeger===undefined?'—':f2(sonDeger))+'</td>'+
      (w?'<td class="sayi et-dar-gizle">'+(c.once===null?'—':f2(c.once))+'</td><td class="sayi et-'+yon(f||0)+'">'+(f===null?'—':isaret(f,f2))+'</td>':'')+
      '<td class="et-dar-gizle et-trend">'+kucukCizgi(o.seri,egilimRengi(f||0),son,84,26)+'</td>'+
      '<td class="sayi">'+(o.sira===null?'—':fi(o.sira))+'</td>'+(w?'<td><span class="et-durum '+DURUM[c.durum]+'">'+c.durum+'</span></td>':'')+'</tr>'};
  const gorunen=m.ogrenciler.filter(gor).length;
  return '<div class="et-filtre"><input type="search" id="dpAra" placeholder="Öğrenci ya da numara ara" aria-label="Öğrenci ara" value="'+kacis(EK.dpAra||'')+'">'+
    '<span class="mini" id="dpSayac">'+(gorunen===m.ogrenciler.length?fi(m.ogrenciler.length)+' öğrenci':fi(gorunen)+' / '+fi(m.ogrenciler.length)+' öğrenci')+'</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo"><thead><tr>'+bas+'</tr></thead><tbody>'+liste.map(satir).join('')+'</tbody></table></div>';
}
function kisiKarti(st,es){
  const m=st.m,o=st.ogr;if(!o)return '';
  const si=es(o.no,o.ad),ad=kisiAdi(o.ad),c=m.pencere[st.s]?o.k[st.s]:null,son=m.sinavlar[o.sonSinav];
  const onceI=o.seri.slice(0,o.sonSinav).map((v,i)=>v===null?-1:i).filter(i=>i>=0).pop(),onceS=onceI===undefined?null:m.sinavlar[onceI];
  const r=son.deger.get(o.no).o,ro=onceS?onceS.deger.get(o.no).o:null;
  const dersler=m.dersler.map((d,i)=>({...d,net:r.net[d.kod]??0,once:ro?(ro.net[d.kod]??0):null,okul:son.ders[i]}));
  return '<div class="et-kisi-bas"><h3>'+(si===undefined?kacis(ad):ogrAdDugmesi(si,ad))+'</h3><span class="mini">No '+kacis(o.no)+' · '+kacis(o.sinif||'şube yok')+' · '+fi(o.deneme)+' deneme</span></div>'+
    '<div class="et-kisi-sayilar"><div><span class="mini">Son net</span><strong>'+f2(o.sonNet)+'</strong><span class="mini">'+kacis(son.ad)+'</span></div>'+
    '<div><span class="mini">Sıra · son deneme</span><strong>'+(o.sira===null?'—':fi(o.sira))+'</strong><span class="mini">'+(o.sira===null?'girmedi':'/ '+fi(m.sinavlar[m.sinavlar.length-1].n))+'</span></div>'+
    (c&&c.fark!==null?'<div><span class="mini">Değişim · '+pencereAdi(st.s)+'</span>'+hap(c.fark,f2(Math.abs(c.fark)))+'<span class="et-durum '+DURUM[c.durum]+'">'+c.durum+'</span></div>'
      :'<div><span class="mini">En iyi</span><strong>'+f2(o.enIyi)+'</strong></div>')+'</div>'+
    '<div class="et-grafik kucuk" data-dp-grafik="kisi" tabindex="0" role="img" aria-label="'+kacis(ad+': denemelerdeki net, okul ortalamasıyla')+'"></div>'+
    '<div class="et-lejant"><span><i class="et-renk cizgi" style="background:var(--e-c1)"></i>'+kacis(ad)+'</span><span><i class="et-renk cizgi" style="background:var(--e-muted)"></i>Ortalama</span><span><i class="et-renk dp-renk-bant" style="background:var(--e-c1)"></i>Ortadaki %50</span></div>'+
    '<span class="mini">'+kacis(son.ad)+' · derslere göre'+(onceS?', önceki denemeye göre değişim':'')+'</span><div class="dp-dersler">'+dersler.map(d=>{const fark=d.once===null?null:d.net-d.once,yz=Math.max(0,Math.min(100,d.net/d.soru*100)),ok_=Math.max(0,Math.min(100,d.okul/d.soru*100));
      return '<div class="dp-ders"><span><i class="et-renk nokta" style="background:'+d.renk+'"></i>'+kacis(d.ad)+'</span><span class="dp-iz" title="Okul ortalaması '+f1(d.okul)+'"><i style="width:'+r1(yz)+'%;background:'+d.renk+'"></i><em style="left:'+r1(ok_)+'%"></em></span><b>'+f2(d.net)+'<small>/'+fi(d.soru)+'</small></b>'+(fark===null?'<span></span>':hap(fark,f2(Math.abs(fark))))+'</div>'}).join('')+'</div>'+
    '<span class="mini dp-not"><em class="dp-cizik"></em> çizgi: '+kacis(st.K.ad)+' ortalaması</span>';
}
function sinavTablosu(st){
  const m=st.m;
  return '<section class="et-panel" id="dpSinavlar"><div class="et-kart-bas"><h2>Denemeler · '+kacis(m.O.ad)+'</h2><button type="button" class="et-dugme" data-sekme="siralamalar">Sıralamalar ve raporlar</button></div>'+
    '<div class="et-kaydir"><table class="et-kaynak"><thead><tr><th>Deneme</th><th>Tarih</th><th>Öğrenci</th><th>Ortalama</th><th>Medyan</th><th>En yüksek</th></tr></thead><tbody>'+
    m.sinavlar.slice().reverse().map(s=>'<tr><td>'+kacis(s.ad)+'</td><td>'+kacis(s.tarih)+'</td><td>'+fi(s.n)+'</td><td>'+f1(s.ort)+'</td><td>'+f1(s.medyan)+'</td><td>'+f2(s.max)+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function araclar(salt){
  const bekleyen=!salt&&(D.ogr||[]).some(o=>o&&!o.silindi&&o.denemeYayinBekliyor);
  return (salt?'':'<label class="et-dugme birincil">PDF’den toplu aktar<input type="file" id="dnPdf" accept="application/pdf,.pdf" multiple hidden></label>')+
    (bekleyen?'<button type="button" class="et-dugme" id="dnYayinla">Bekleyen sonuçları yayınla</button>':'')+
    '<button type="button" class="et-dugme" id="dpKlasik">Öğrenci bazında</button>';
}
function icerik(){
  const salt=izleme(),{t,hata}=veriAl();
  const durumSatiri='<p id="dnDurum" role="status" aria-live="polite">'+kacis(EK.denemeDurum||'')+'</p>'+(typeof denemeImportHtml==='function'?denemeImportHtml():'');
  if(hata)return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1></header><p class="et-uyari">'+kacis(hata)+'</p><div class="et-arac">'+araclar(salt)+'</div>'+durumSatiri;
  const st=t?durumAl(t):null;
  if(!st||!st.m.sinavlar.length)return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1><p class="et-cumle">Okulun deneme sonuç listelerinden deneme panosu</p></header><div class="et-arac">'+araclar(salt)+'</div>'+durumSatiri+
    '<section class="et-panel et-bos"><b>Henüz deneme listesi yok</b>'+(salt?'':'<p>Okulun “Öğrenci Adı Sıralı” ya da “Net Sayısı Sıralı” sonuç listesini “PDF’den toplu aktar” ile ekleyin.</p>')+'</section>';
  const m=st.m,es=defterEslesme(),odak=st.ders?m.dersler.find(d=>d.kod===st.ders):null;
  cizimPlanla();
  return '<header class="et-bas"><h1 class="et-baslik">Denemeler</h1><p class="et-cumle">'+cumle(st)+'</p></header>'+
    '<div class="et-arac">'+araclar(salt)+
      secim('olcu',st.sec.key,st.olcular.map(o=>[o.key,o.ad,!o.m.sinavlar.length]),'Oturum')+
      secim('aralik',st.s,ARALIKLAR.map(k=>[k,k===1?'Son deneme':'Son '+k,!m.pencere[k]]),'Karşılaştır')+
      '<label class="et-seg"><span class="et-seg-label">Öğrenciler</span><select id="dpKapsam" aria-label="Öğrenciler">'+st.ks.map(k=>'<option value="'+kacis(k.key)+'"'+(k.key===st.K.key?' selected':'')+'>'+kacis(k.ad)+'</option>').join('')+'</select></label></div>'+
    durumSatiri+ozetKartlari(st)+
    '<section class="et-panel" id="dpGenel"><div class="et-kart-bas"><h2>'+kacis(m.O.ad)+' net · deneme deneme</h2><div class="et-lejant"><span><i class="et-renk cizgi" style="background:var(--e-c1)"></i>Ortalama</span>'+
      '<span><i class="et-renk dp-renk-bant" style="background:var(--e-c1)"></i>Ortadaki %50</span><span><i class="et-renk" style="background:var(--e-ok)"></i>Katılım arttı</span><span><i class="et-renk" style="background:var(--e-bad)"></i>azaldı</span></div></div>'+
      '<div class="et-grafik" data-dp-grafik="genel" tabindex="0" role="img" aria-label="'+kacis(m.O.ad+' ortalama net, ortadaki yüzde elli ve katılım, deneme deneme')+'"></div></section>'+
    '<h2 class="et-bolum" id="dpDersler">Dersler</h2>'+dersKartlari(st)+
    '<section class="et-panel"><div class="et-kart-bas"><h2>'+(odak?kacis(odak.ad)+' · ortalama net':'Derslere göre başarı (%)')+'</h2>'+(odak?'<button type="button" class="et-dugme" data-dp-ders="">Tüm dersler</button>':'')+'</div>'+
      '<div class="et-grafik" data-dp-grafik="ders" tabindex="0" role="img" aria-label="'+kacis(odak?odak.ad+' ortalama net':'Derslerin başarı yüzdesi, deneme deneme')+'"></div></section>'+
    '<h2 class="et-bolum" id="dpOgrenciler">Öğrenciler</h2>'+
    '<div class="et-iki"><section class="et-panel"><div class="et-kart-bas"><h2>Net dağılımı · son deneme</h2><div class="et-lejant"><span><i class="et-renk" style="background:var(--e-c1)"></i>'+kacis(m.sinavlar[m.sinavlar.length-1].ad)+'</span>'+
      (m.sinavlar.length>1?'<span><i class="et-renk cizgi" style="background:var(--e-fg2)"></i>Önceki deneme</span>':'')+'</div></div>'+
      '<div class="et-grafik orta" data-dp-grafik="dagilim" tabindex="0" role="img" aria-label="Son denemede net dağılımı, önceki denemeyle"></div></section>'+
    '<section class="et-panel"><div class="et-kart-bas"><h2>En çok değişenler</h2><span class="mini">'+(st.s?(st.s===1?'Son deneme, öncekine göre':'Son '+st.s+' deneme ortalaması, önceki '+st.s+' denemeye göre'):'')+'</span></div>'+hareketliler(st)+'</section></div>'+
    '<div class="et-bolunmus"><section class="et-panel" id="dpTablo"><div class="et-kart-bas"><h2>Tüm öğrenciler</h2></div>'+tablo(st)+'</section>'+
    '<section class="et-panel et-kisi" id="dpKisi">'+kisiKarti(st,es)+'</section></div>'+sinavTablosu(st);
}
function gorunum(){return '<div id="dpKok">'+icerik()+'</div>'}
function yenidenCiz(odak){
  const kok=document.getElementById('dpKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();cizimPlanla();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
document.addEventListener('click',ev=>{
  if(EK.sekme!=='denemeler'||!rehberMi())return;
  const el=ev.target.closest?.('[data-dp-olcu],[data-dp-aralik],[data-dp-ders],[data-dp-ogr],[data-dp-sira],#dpKlasik,#dpPanoya');if(!el||el.disabled)return;
  if(el.id==='dpKlasik'){EK.denemeKlasik=true;ciz();return}
  if(el.id==='dpPanoya'){EK.denemeKlasik=false;ciz();return}
  if(!document.getElementById('dpKok'))return;
  const q=v=>typeof CSS!=='undefined'&&CSS.escape?CSS.escape(v):v;
  if(el.dataset.dpOlcu){EK.dpOlcu=el.dataset.dpOlcu;EK.dpDers=null;yenidenCiz('[data-dp-olcu="'+q(EK.dpOlcu)+'"]');return}
  if(el.dataset.dpAralik){EK.dpAralik=Number(el.dataset.dpAralik);yenidenCiz('[data-dp-aralik="'+EK.dpAralik+'"]');return}
  if(el.dataset.dpDers!==undefined){const d=el.dataset.dpDers;EK.dpDers=d&&EK.dpDers!==d?d:null;yenidenCiz(d?'.et-ders[data-dp-ders="'+q(d)+'"]':null);return}
  if(el.dataset.dpSira){const k=el.dataset.dpSira;if(EK.dpSira===k)EK.dpSiraYon=EK.dpSiraYon==='artan'?'azalan':'artan';else{EK.dpSira=k;EK.dpSiraYon=['ad','sinif','no','sira','durum'].includes(k)?'artan':'azalan'}
    yenidenCiz('[data-dp-sira="'+k+'"]');return}
  if(el.dataset.dpOgr){EK.dpOgr=el.dataset.dpOgr;yenidenCiz();const kart=document.getElementById('dpKisi');
    if(kart&&getComputedStyle(kart).position!=='sticky')kart.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',ev=>{if(etkin()&&ev.target.id==='dpKapsam'){EK.dpKapsam=ev.target.value;EK.dpOgr=null;yenidenCiz('#dpKapsam')}});
document.addEventListener('input',ev=>{if(etkin()&&ev.target.id==='dpAra'){EK.dpAra=ev.target.value;filtrele()}});
function filtrele(){
  const ara=anahtar(EK.dpAra||'');let n=0,t=0;
  document.querySelectorAll('#dpTablo .et-tablo tbody tr').forEach(tr=>{t++;const g=!ara||tr.dataset.ara.includes(ara);tr.hidden=!g;if(g)n++});
  const s=document.getElementById('dpSayac');if(s)s.textContent=n===t?fi(t)+' öğrenci':fi(n)+' / '+fi(t)+' öğrenci';
}
document.addEventListener('pointermove',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu)ipucuGoster(kutu,enYakin(kutu,ev.clientX))});
document.addEventListener('pointerdown',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu)ipucuGoster(kutu,enYakin(kutu,ev.clientX))});
document.addEventListener('pointerout',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu&&!kutu.contains(ev.relatedTarget)&&document.activeElement!==kutu)ipucuGizle(kutu)});
document.addEventListener('keydown',ev=>{
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(!kutu||!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(ev.key))return;
  const g=CIZIMLER.get(kutu.dataset.dpGrafik);if(!g)return;ev.preventDefault();
  if(ev.key==='Escape'){ipucuGizle(kutu);return}
  const i=kutu.dataset.i===undefined?g.xs.length-1:Number(kutu.dataset.i);
  ipucuGoster(kutu,ev.key==='Home'?0:ev.key==='End'?g.xs.length-1:Math.max(0,Math.min(g.xs.length-1,i+(ev.key==='ArrowLeft'?-1:1))));
});
document.addEventListener('focusout',ev=>{const kutu=ev.target.closest?.('.et-grafik[data-dp-grafik]');if(kutu)ipucuGizle(kutu)});
return {temel,olcu,kapsamlar,gorunumModeli,veriAl,durumAl,icerik,gorunum,grafikleriCiz,GRAFIKLER,ESIK};
})();
function gorunumDenemePanosu(){return DPANO.gorunum()}
