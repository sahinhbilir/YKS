// Teacher-only "Yanlışlar defteri". Embedded by scripts/embed-yanlislar.cjs. See docs/yanlislar-defteri.md.
// Three files of one exam are read in the browser and printed as one defter per student. Nothing from them is stored:
// not in localStorage, not in the notebook D, not in Firestore, and nothing is sent anywhere. No personal data belongs in this file.
const YANLISLAR = (() => {
const clean=s=>String(s??'').replace(/\s+/gu,' ').trim();
// Upper case without Turkish marks, letters and digits only: "TC Kimlik No" and "T.C. KİMLİK NO" both give TCKIMLIKNO.
const key=s=>clean(s).toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^A-Z0-9]/gu,'');
const title=s=>clean(s).toLocaleLowerCase('tr-TR').replace(/(^|[\s(])\p{L}/gu,m=>m.toLocaleUpperCase('tr-TR'));
const harfOK=s=>/^[A-E]$/u.test(s);

/* ---------------------------------------------------------------- Soru kitapçığı (A), cut into questions
   pages: [{w,h,items:[{s,x,y,w,h}]}] in PDF units (y grows upwards), as pdf.js reports text.
   A question start is an item "12." at the left edge of a column, first on its line, and the next number in the test's
   sequence. Numbers inside tables ("1.", "1. sıra") fail one of those three. A question's region runs from its number to the
   next start in the same column (or to the footer). A shared passage ("35 - 36. soruları aşağıdaki parçaya göre …") is added
   in front of each question it belongs to. */
const KOD=/^\d{4}-\d{2}-[A-Z]+\/(.+)-\d{3,5}$/u;
const NO=/^(\d{1,3})\.$/u;
const GRUP=/^\(?\s*(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*\.\s*soru/iu;
const SAYIM=/(\d{1,3})\s+soru\s+vard[ıi]r/iu;
const lines=items=>{const out=[];for(const i of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){const l=out.find(l=>Math.abs(l.y-i.y)<3);if(l)l.items.push(i);else out.push({y:i.y,items:[i]})}return out.map(l=>l.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ')).join(' ')};
// The most common x among candidates (densest 4 unit window), so a stray number elsewhere cannot move the column edge.
function kenar(xs){
  xs=[...xs].sort((a,b)=>a-b);let best=[];
  for(let i=0;i<xs.length;i++){let j=i;while(j<xs.length&&xs[j]-xs[i]<=4)j++;if(j-i>best.length)best=xs.slice(i,j)}
  return best.length>=3?best[best.length>>1]:null;
}
function kitapcikCoz(pages){
  const fail=m=>{throw new Error(m+' Soru kitapçığı eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>100)fail('PDF sayfaları okunamadı.');
  const P=pages.map(p=>({w:+p.w,h:+p.h,ox:+p.ox||0,oy:+p.oy||0,items:(Array.isArray(p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({s:clean(i.s),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:0,h:Number.isFinite(i.h)&&i.h>0?i.h:9})).filter(i=>i.s)}));
  if(P.some(p=>!(p.w>200&&p.h>200)))fail('Sayfa boyutu okunamadı.');
  // Pages of one test share the header code (2026-27-TYT/TÜR-1203); the cover has none.
  const runs=[];
  P.forEach((p,i)=>{
    const c=p.items.find(x=>KOD.test(x.s)&&x.y>p.h-70);p.kod=c?KOD.exec(c.s)[1]:null;p.kodItem=c||null;
    if(!p.kod)return;const last=runs.at(-1);
    if(last&&last.kod===p.kod&&last.son===i-1)last.son=i;
    else{if(runs.some(r=>r.kod===p.kod))fail('Test sayfaları kesintili ('+p.kod+').');runs.push({kod:p.kod,ilk:i,son:i})}
  });
  if(!runs.length)fail('Bu PDF bir soru kitapçığına benzemiyor (sayfa üst bilgisi bulunamadı).');
  const inRun=runs.flatMap(r=>P.slice(r.ilk,r.son+1)),W=P[0].w;
  const cand=inRun.flatMap(p=>p.items.filter(i=>NO.test(i.s)&&i.y<p.h-70&&i.y>60));
  const sol=kenar(cand.filter(i=>i.x<W/2).map(i=>i.x)),sag=kenar(cand.filter(i=>i.x>=W/2).map(i=>i.x));
  if(sol===null||sag===null)fail('Soru numaraları sütun kenarında bulunamadı.');
  const bolun=sag-15,side=x=>x<bolun?0:1,EDGE=3.5;
  const out={w:W,h:P[0].h,testler:[]};
  for(const run of runs){
    const pg=P.slice(run.ilk,run.son+1);
    const cols=pg.map(p=>[0,1].map(s=>({s,x0:s?sag-11:sol-12,x1:s?p.w-24:sag-19,mk:[]})));
    // Page number sits in the footer; the footer rule is about 20 above it. Questions end above that.
    pg.forEach((p,k)=>{
      const no=p.items.filter(i=>/^\d{1,3}$/u.test(i.s)&&i.y<250&&Math.abs(i.x+i.w/2-p.w/2)<25).sort((a,b)=>a.y-b.y)[0];
      const bottom=no?no.y+22:75;cols[k].forEach(c=>c.bottom=bottom);
    });
    // 1) question starts, in booklet order, sequential from 1
    let expected=1;const starts=[];
    pg.forEach((p,k)=>{
      for(const s of [0,1]){
        const c=p.items.filter(i=>NO.test(i.s)&&i.y<p.h-70&&i.y>60&&side(i.x)===s&&Math.abs(i.x-(s?sag:sol))<=EDGE&&
          !p.items.some(o=>o!==i&&Math.abs(o.y-i.y)<3&&o.x<i.x-1&&side(o.x)===s&&o.x>=cols[k][s].x0)).sort((a,b)=>b.y-a.y);
        for(const i of c)if(+NO.exec(i.s)[1]===expected){const m={t:'s',no:expected,y:i.y,h:i.h};cols[k][s].mk.push(m);starts.push({m,k,s});expected++}
      }
    });
    // 2) test title and the declared question count
    const first=pg[0],head=first.items.filter(i=>i.y>first.h-70&&i!==first.kodItem&&!/^[A-Z]$/u.test(i.s));
    const top=Math.max(...starts.filter(x=>x.k===0).map(x=>x.m.y),0),ad=lines(head)||run.kod;
    const sayi=SAYIM.exec(lines(first.items.filter(i=>i.y<first.h-70&&i.y>top+12)));
    if(!sayi)fail(ad+': soru sayısı ("Bu testte N soru vardır") okunamadı.');
    const N=+sayi[1];
    if(N<1||N>200)fail(ad+': soru sayısı geçersiz.');
    if(starts.length!==N)fail(ad+': kitapçıkta '+N+' soru yazıyor, '+starts.length+' soru bulundu'+(starts.length<N?' ('+(starts.length+1)+'. soru bulunamadı)':'')+'.');
    // 3) shared-passage and section notices ("35 - 36. soruları …"): they end the question above and open a preface
    const heads=[];
    pg.forEach((p,k)=>{
      for(const i of p.items){
        const g=GRUP.exec(i.s);if(!g||i.y>=p.h-70||i.y<80)continue;
        const s=side(i.x),text=lines(p.items.filter(o=>side(o.x)===s&&o.x>=i.x-3&&o.y<=i.y+3&&o.y>=i.y-30));
        const m={t:'h',a:+g[1],b:+g[2],y:i.y,h:i.h,ortak:/cevaplay[ıi]n[ıi]z|yan[ıi]tlay[ıi]n[ıi]z/iu.test(text)};
        cols[k][s].mk.push(m);heads.push({m,k,s});
      }
    });
    for(const c of cols.flat())c.mk.sort((a,b)=>b.y-a.y);
    const flat=cols.flatMap((cs,k)=>cs.map(c=>({...c,k})));
    const bnd=(m)=>m.t==='s'?m.y+0.9*m.h+1:m.y+17;
    const seg=(ci,y1,y0)=>({p:run.ilk+flat[ci].k+1,x0:flat[ci].x0,x1:flat[ci].x1,y0,y1});
    const sorular=Array.from({length:N},(_,i)=>({no:i+1,own:[],pre:[]}));
    flat.forEach((c,ci)=>c.mk.forEach((m,j)=>{
      if(m.t!=='s')return;
      const next=c.mk[j+1],y1=m.y+0.9*m.h+3,y0=next?bnd(next):c.bottom;
      if(y1-y0<8)fail(ad+': '+m.no+'. soru bölgesi okunamadı.');
      sorular[m.no-1].own.push(seg(ci,y1,y0));
    }));
    flat.forEach((c,ci)=>c.mk.forEach((m,j)=>{
      if(m.t!=='h')return;
      // the group's first question is the next start after the notice; a notice that does not match one is only a divider
      let fc=ci,fj=j+1,fs=null;
      for(;fc<flat.length&&!fs;fc++,fj=0)fs=flat[fc].mk.slice(fj).find(x=>x.t==='s')||null;
      if(!fs||fs.no!==m.a||m.b<m.a||m.b>N)return;
      const y1=m.y+18.5,pk=pg[c.k],segs=[];
      // A band crossing the column divider (tables across both columns) is cut across the page, above both first questions.
      const stIn=cc=>flat[cc].mk.find((x,jj)=>x.t==='s'&&(cc!==ci||jj>j)&&x.y<m.y);
      const sol2=ci%2===0?stIn(ci):null,sag2=ci%2===0&&ci+1<flat.length?flat[ci+1].mk.find(x=>x.t==='s'):null;
      const low=Math.max(...[sol2,sag2].filter(Boolean).map(bnd),-1);
      const wide=ci%2===0&&sol2&&pk.items.some(o=>o.y<m.y&&o.y>low&&o.y<pk.h-70&&o.x<bolun-12&&o.x+o.w>bolun+12);
      if(wide)segs.push({p:run.ilk+c.k+1,x0:sol-12,x1:pk.w-24,y0:low,y1});
      else{
        let cur=ci,top=y1,from=j+1;
        for(let guard=0;guard<4&&cur<flat.length;guard++,cur++,from=0){
          const cc=flat[cur],nx=cc.mk.slice(from)[0],y0=nx?bnd(nx):cc.bottom;
          if(cur>ci){
            const body=pg[cc.k].items.some(o=>o.y<pg[cc.k].h-70&&o.y>y0&&side(o.x)===cc.s);
            if(!body||top-y0<14)break;
          }
          segs.push(seg(cur,top,y0));
          if(nx)break;
          top=pg[flat[Math.min(cur+1,flat.length-1)].k].h-70;
        }
      }
      for(let n=m.a;n<=(m.ortak?m.b:m.a);n++)sorular[n-1].pre.push(...segs);
    }));
    out.testler.push({kod:run.kod,ad,soru:N,ilk:run.ilk+1,son:run.son+1,sorular:sorular.map(q=>({no:q.no,parcalar:[...q.pre,...q.own],genis:[...q.pre,...q.own].some(g=>g.x1-g.x0>(sag-sol)*1.3)}))});
  }
  return out;
}
/* ---------------------------------------------------------------- Cevap raporu (.xlsx), read in memory
   The report carries each student's TC kimlik no. The header row is located first; the cells of that column are never read
   (not even their shared strings), and any 11 digit number found elsewhere is dropped. The parsed object has no TC field. */
const EXCEL_HATA='Bu dosya geçerli bir Excel (.xlsx) dosyası değil. Dosya eklenmedi.';
const colNo=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
const xmlEl=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
const xmlKids=el=>Array.from(el.children);
const siMetin=el=>xmlKids(el).map(c=>c.localName==='t'?c.textContent:c.localName==='r'?xmlKids(c).filter(x=>x.localName==='t').map(x=>x.textContent).join(''):'').join('');
function xmlAc(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(!doc.documentElement||doc.getElementsByTagName('parsererror').length)throw new Error(EXCEL_HATA);
  return doc;
}
const tcSutunu=k=>/^(TC|TCNO|TCKN|TCKIMLIK|TCKIMLIKNO|KIMLIKNO)$/u.test(k)||k.includes('KIMLIK');
const SAYFA_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
async function raporCoz(bytes){
  const KT=KONU_TAKIBI,bad=()=>new Error(EXCEL_HATA);
  const fail=m=>{throw new Error(m+' Cevap raporu eklenmedi.')};
  const files=KT.zipListe(bytes),read=async n=>{const e=files.get(n);return e?new TextDecoder().decode(await KT.zipDosya(bytes,e)):null};
  const wbx=await read('xl/workbook.xml'),rx=await read('xl/_rels/workbook.xml.rels');if(!wbx||!rx)throw bad();
  const sheets=xmlEl(xmlAc(wbx),'sheet').map(s=>({name:s.getAttribute('name'),rid:s.getAttribute('r:id')||s.getAttributeNS(SAYFA_REL,'id')}));
  if(!sheets.length||sheets.length>8)throw bad();
  const rels=new Map(xmlEl(xmlAc(rx),'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')||'']));
  const sx=await read('xl/sharedStrings.xml'),sstEl=sx?xmlEl(xmlAc(sx),'si'):[],sstCache=new Map();
  const sst=i=>{if(!sstCache.has(i))sstCache.set(i,sstEl[i]?siMetin(sstEl[i]):'');return sstCache.get(i)};
  const deger=c=>{
    const t=c.getAttribute('t'),kids=xmlKids(c),v=kids.find(x=>x.localName==='v'),is=kids.find(x=>x.localName==='is');
    const s=clean(t==='inlineStr'&&is?siMetin(is):t==='s'&&v?sst(+v.textContent):v?v.textContent:'');
    return /^\d{11}$/u.test(s)?'':s;
  };
  // First sheet that has the report's header row.
  let bulundu=null;
  for(const sh of sheets){
    const t=rels.get(sh.rid),x=t?await read(t.startsWith('/')?t.slice(1):'xl/'+t):null;if(x===null)throw bad();
    const cells=xmlEl(xmlAc(x),'c');if(cells.length>300000)throw bad();
    const byRow=new Map();
    for(const c of cells){const m=/^([A-Z]{1,3})(\d{1,6})$/u.exec(c.getAttribute('r')||'');if(!m)continue;const r=+m[2];if(!byRow.has(r))byRow.set(r,[]);byRow.get(r).push({col:m[1],el:c})}
    const pre=new Map(),post=new Map();let hdr=null,tc=new Set();
    for(const r of [...byRow.keys()].sort((a,b)=>a-b)){
      const row=new Map();
      for(const {col,el} of byRow.get(r)){if(hdr&&tc.has(col))continue;const s=deger(el);if(s)row.set(col,s)}
      if(!hdr){
        const ks=[...row.values()].map(key);
        if(ks.includes('OGRENCINO')&&ks.includes('ADSOYAD')){hdr={r,row};tc=new Set([...row].filter(([,v])=>tcSutunu(key(v))).map(([c])=>c))}
        else pre.set(r,row);
      }else post.set(r,row);
    }
    if(hdr){bulundu={hdr,pre,post};break}
  }
  if(!bulundu)fail('Bu dosya bir cevap raporu değil (Öğrenci No ve Ad Soyad başlıkları bulunamadı).');
  const {hdr,pre,post}=bulundu,H=new Map([...hdr.row].map(([c,v])=>[key(v),c]));
  const cNo=H.get('OGRENCINO'),cAd=H.get('ADSOYAD'),cSube=H.get('SUBE'),cKit=H.get('KITAPCIK');
  if(!cSube||!cKit)fail('Şube veya Kitapçık sütunu bulunamadı.');
  const qcols=[...hdr.row].filter(([,v])=>/^S\d{1,3}$/u.test(key(v))).map(([c,v])=>({c,n:+key(v).slice(1)})).sort((a,b)=>colNo(a.c)-colNo(b.c));
  // The row above the header names the sections at the first column of each.
  let secRow=null;
  for(let r=hdr.r-1;r>=Math.max(1,hdr.r-4);r--)if(pre.has(r)&&[...pre.get(r).values()].some(v=>/-[TA]$/u.test(v))){secRow=pre.get(r);break}
  if(!secRow)fail('Bölüm adları (TÜRKÇE-T gibi) bulunamadı.');
  const sec=[...secRow].map(([c,v])=>({c:colNo(c),ad:v})).sort((a,b)=>a.c-b.c),bolumler=[];let bas=0;
  const sutunlar=[];
  sec.forEach((s,i)=>{
    if(key(s.ad)==='TOPLAM')return;
    const son=sec[i+1]?sec[i+1].c:Infinity,qs=qcols.filter(q=>colNo(q.c)>=s.c&&colNo(q.c)<son);
    if(!qs.length||qs.some((q,k)=>q.n!==k+1))fail(s.ad+' bölümünün soru sütunları (S1, S2, …) okunamadı.');
    bolumler.push({ad:s.ad,ders:title(s.ad.replace(/-[TA]$/u,'')).replace(/\.\p{L}/gu,m=>m.toLocaleUpperCase('tr-TR')),n:qs.length,bas});bas+=qs.length;sutunlar.push(...qs.map(q=>q.c));
  });
  if(!bolumler.length)fail('Soru bölümü bulunamadı.');
  const anahtar={},ogrenciler=[];
  const dizi=row=>sutunlar.map(c=>{const v=clean(row.get(c)).toUpperCase();return harfOK(v)?v:''});
  for(const r of [...post.keys()].sort((a,b)=>a-b)){
    const row=post.get(r),etiket=key(row.get(cAd)||'');
    const km=/^CEVAPANAHTARI([AB])$/u.exec(etiket);
    if(km){anahtar[km[1]]=dizi(row);continue}
    if(!row.get(cNo))continue;
    const kit=clean(row.get(cKit)).toUpperCase();
    if(kit!=='A'&&kit!=='B')fail('Kitapçık türü A veya B olmayan öğrenci satırı var.');
    ogrenciler.push({id:ogrenciler.length,sira:clean(row.get(H.get('SIRA'))).replace(/\.0+$/u,''),no:row.get(cNo).replace(/\.0+$/u,''),ad:clean(row.get(cAd)),sube:clean(row.get(cSube)),kit,cev:dizi(row)});
  }
  if(!ogrenciler.length)fail('Öğrenci satırı bulunamadı.');
  for(const k of new Set(ogrenciler.map(o=>o.kit)))if(!anahtar[k])fail('Cevap Anahtarı - '+k+' satırı bulunamadı.');
  let ad='';
  for(const row of pre.values())for(const v of row.values()){const m=/S[ıi]nav\s*:\s*([^|]+)/iu.exec(v);if(m&&!ad)ad=clean(m[1])}
  return {ad,bolumler,T:bas,anahtar,ogrenciler};
}

/* ---------------------------------------------------------------- Report sections -> booklet tests
   The report's sections run in booklet order. Each test takes consecutive sections until its question count is full. */
function esle(rapor,kit){
  const fail=m=>{throw new Error(m)};
  const ozet='Rapor: '+rapor.bolumler.map(b=>b.ders+' '+b.n).join(', ')+'. Kitapçık: '+kit.testler.map(t=>t.ad+' '+t.soru).join(', ')+'.';
  let ti=0,off=0;const bolumler=[];
  for(const b of rapor.bolumler){
    const t=kit.testler[ti];
    if(!t||off+b.n>t.soru)fail('Cevap raporundaki bölümler soru kitapçığındaki testlerle eşleşmiyor. '+ozet);
    bolumler.push({...b,test:ti,off});off+=b.n;if(off===t.soru){ti++;off=0}
  }
  if(ti!==kit.testler.length||off!==0)fail('Cevap raporundaki bölümler soru kitapçığındaki testlerle eşleşmiyor. '+ozet);
  // Din Kültürü and S.Felsefe are alternatives; a student sits one of them.
  const din=bolumler.findIndex(b=>key(b.ad).startsWith('DIN')),alt=bolumler.findIndex(b=>/^(SFELSEFE|SOSYALFELSEFE)/u.test(key(b.ad)));
  return {bolumler,testler:kit.testler.map(t=>t.soru),cift:din>=0&&alt>=0?[din,alt]:null};
}

/* ---------------------------------------------------------------- Çözüm kitapçığı: the A <-> B question map */
const ETIKET=/^A\s*[-–]\s*(\d{1,3})\s*\/\s*B\s*[-–]\s*(\d{1,3})$/u;
// pages: [{w,items:[{s,x,y}]}]. Labels are read left column top to bottom, then the right column, page after page.
function cozumEtiketleri(pages){
  const fail=m=>{throw new Error(m+' Çözüm kitapçığı eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>200)fail('PDF sayfaları okunamadı.');
  const pairs=[];
  for(const p of pages){
    const items=(Array.isArray(p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)&&ETIKET.test(clean(i.s)));
    const w=p.w||600;
    items.map(i=>({m:ETIKET.exec(clean(i.s)),c:i.x<w/2?0:1,y:i.y})).sort((a,b)=>a.c-b.c||b.y-a.y).forEach(i=>pairs.push([+i.m[1],+i.m[2]]));
  }
  if(!pairs.length)fail('Bu PDF’de "A-1 / B-5" biçiminde soru eşleşmesi bulunamadı.');
  return pairs;
}
function haritaKur(pairs,es,rapor){
  const fail=m=>{throw new Error(m+' Çözüm kitapçığı eklenmedi.')};
  const toplam=es.testler.reduce((a,b)=>a+b,0);
  if(pairs.length!==toplam)fail('Çözüm kitapçığında '+pairs.length+' soru eşleşmesi var, soru kitapçığında '+toplam+' soru var.');
  const testler=[];let at=0;
  es.testler.forEach((N,t)=>{
    const part=pairs.slice(at,at+N);at+=N;
    const aToB=Array(N+1).fill(null),bToA=Array(N+1).fill(null),ad='Test '+(t+1);
    for(const [a,b] of part){
      if(a<1||a>N||b<1||b>N)fail(ad+': soru numarası 1-'+N+' aralığı dışında (A-'+a+' / B-'+b+').');
      if(aToB[a]!==null)fail(ad+': A-'+a+' birden fazla kez geçiyor.');
      if(bToA[b]!==null)fail(ad+': B-'+b+' birden fazla kez geçiyor.');
      aToB[a]=b;bToA[b]=a;
    }
    testler.push({aToB,bToA});
  });
  const sec=(t,n)=>es.bolumler.findIndex(b=>b.test===t&&n>b.off&&n<=b.off+b.n);
  const harf=(k,t,n)=>{const i=sec(t,n);return rapor.anahtar[k]?.[es.bolumler[i].bas+n-es.bolumler[i].off-1]};
  testler.forEach(({aToB},t)=>{
    for(let a=1;a<aToB.length;a++){
      const b=aToB[a],sa=sec(t,a),sb=sec(t,b);
      if(sa!==sb)fail('A-'+a+' / B-'+b+' farklı derslere ait ('+es.bolumler[sa].ders+' ve '+es.bolumler[sb].ders+').');
      if(rapor.anahtar.A&&rapor.anahtar.B&&harf('A',t,a)!==harf('B',t,b))fail('A-'+a+' / B-'+b+' cevap anahtarlarıyla uyuşmuyor.');
    }
  });
  return {testler,adet:pairs.length};
}

/* ---------------------------------------------------------------- One student's defter */
// Wrong or empty questions per ders, in booklet order. a = number in the A booklet, b = number in the student's own B booklet.
function defterKur(rapor,es,harita,ogr,acik){
  const say=i=>{const b=es.bolumler[i];return ogr.cev.slice(b.bas,b.bas+b.n).filter(Boolean).length};
  const atla=new Set();
  if(es.cift){const [d,f]=es.cift,sd=say(d),sf=say(f);if(sd===0&&sf>0)atla.add(d);if(sf===0&&sd>0)atla.add(f)}
  const anahtar=rapor.anahtar[ogr.kit],bolumler=[];let yanlis=0,bos=0;
  es.bolumler.forEach((b,i)=>{
    if(atla.has(i)||(acik&&!acik.has(i)))return;
    const sorular=[];
    for(let k=0;k<b.n;k++){
      const g=b.bas+k,isaret=ogr.cev[g],dogru=anahtar[g];
      if(!harfOK(dogru)||isaret===dogru)continue;
      const own=b.off+k+1,a=ogr.kit==='A'?own:(harita?harita.testler[b.test].bToA[own]:null);
      sorular.push({test:b.test,own,a,b:ogr.kit==='B'?own:null,isaret,dogru,durum:isaret?'yanlis':'bos'});
    }
    if(!sorular.length)return;
    sorular.sort((x,y)=>(x.a??x.own)-(y.a??y.own));
    yanlis+=sorular.filter(s=>s.durum==='yanlis').length;bos+=sorular.filter(s=>s.durum==='bos').length;
    bolumler.push({i,ders:b.ders,sorular});
  });
  return {ogr,yanlis,bos,bolumler,gorsel:ogr.kit==='A'||!!harita};
}
/* ---------------------------------------------------------------- Screen and print. State lives only in this page's memory. */
const OLCEK=2,BOSLUK=8;
const S={kit:null,rapor:null,es:null,pairs:null,harita:null,durum:{kit:'',rapor:'',coz:''},hata:{kit:'',rapor:'',coz:''},sube:'',ogr:'',kapali:new Set(),mesgul:'',crops:new Map(),jeton:0,hazir:Promise.resolve(),ilerleme:''};
const h=s=>kacis(String(s??''));
const rehber=()=>typeof rehberMi==='function'&&rehberMi();
const etkin=()=>EK.sekme==='yanlislar'&&rehber()&&!!document.getElementById('ydKok');
function kitapBirak(kit){if(kit?.pdf){try{kit.pdf.destroy()}catch(e){}}}
function resimleriBirak(){for(const c of S.crops.values())try{URL.revokeObjectURL(c.url)}catch(e){}S.crops=new Map()}
// pdf.js text per page with its size; the document stays open only for the booklet (it is rendered later).
async function pdfOku(file,tut){
  if(file.size>60*1024*1024)throw new Error('PDF en fazla 60 MB olabilir.');
  const pdfjs=await denemePdfjs(),task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  let pdf=null,ok=false;
  try{
    pdf=await task.promise;if(pdf.numPages>200)throw new Error('PDF en fazla 200 sayfa olabilir.');
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),v=page.view,t=await page.getTextContent();
      pages.push({w:vp.width,h:vp.height,ox:v[0],oy:v[1],items:t.items.filter(x=>x.str?.trim()).map(x=>({s:x.str.trim(),x:x.transform[4]-v[0],y:x.transform[5]-v[1],w:x.width,h:x.height}))});
      page.cleanup();
    }
    ok=true;return {pages,pdf:tut?pdf:null};
  }finally{if(!(ok&&tut))await task.destroy()}
}
const sayfaDizi=kit=>kit.testler.map(t=>t.ad+' '+t.soru).join(', ');
const adet=kit=>kit.testler.reduce((a,t)=>a+t.soru,0);
// A new file is accepted only if it fits the others; otherwise nothing changes except the message.
async function yukle(tur,file){
  S.hata[tur]='';
  try{
    if(tur==='kit'){
      const {pages,pdf}=await pdfOku(file,true);let kit;
      try{kit=kitapcikCoz(pages)}catch(e){await pdf.destroy();throw e}
      kit.pdf=pdf;kit.onbellek=new Map();kit.sayfa=pages.length;kit.ofset=pages.map(p=>[p.ox,p.oy]);
      let es=null;if(S.rapor){try{es=esle(S.rapor,kit)}catch(e){await pdf.destroy();throw new Error(e.message+' Soru kitapçığı eklenmedi.')}}
      kitapBirak(S.kit);resimleriBirak();S.kit=kit;S.es=es;S.durum.kit='✓ '+kit.sayfa+' sayfa · '+adet(kit)+' soru';
      yenidenDogrula();
    }else if(tur==='rapor'){
      if(file.size>15*1024*1024)throw new Error('Excel dosyası en fazla 15 MB olabilir.');
      const rapor=await raporCoz(new Uint8Array(await file.arrayBuffer()));
      let es=null;if(S.kit){try{es=esle(rapor,S.kit)}catch(e){throw new Error(e.message+' Cevap raporu eklenmedi.')}}
      S.rapor=rapor;S.es=es;S.sube='';S.ogr='';S.kapali=new Set();S.durum.rapor='✓ '+rapor.ogrenciler.length+' öğrenci'+(rapor.ad?' · '+rapor.ad:'');
      yenidenDogrula();
    }else{
      if(!S.kit||!S.rapor||!S.es)throw new Error('Önce soru kitapçığını ve cevap raporunu yükleyin.');
      const {pages}=await pdfOku(file,false),pairs=cozumEtiketleri(pages),harita=haritaKur(pairs,S.es,S.rapor);
      S.pairs=pairs;S.harita=harita;S.durum.coz='✓ '+harita.adet+' soru eşleşmesi';
    }
  }catch(e){S.hata[tur]=e.message}
}
// The çözüm file is checked against whatever booklet and report are current; it is dropped when it no longer fits.
function yenidenDogrula(){
  if(!S.pairs)return;
  try{S.harita=S.es?haritaKur(S.pairs,S.es,S.rapor):null}catch(e){S.harita=null;S.hata.coz=e.message}
  if(!S.harita){S.pairs=null;S.durum.coz=''}
}
const ogrenciler=()=>S.rapor.ogrenciler.filter(o=>(!S.sube||o.sube===S.sube)&&(!S.ogr||String(o.id)===S.ogr)).sort((a,b)=>a.sube.localeCompare(b.sube,'tr',{numeric:true})||a.ad.localeCompare(b.ad,'tr'));
const defterler=()=>ogrenciler().map(o=>defterKur(S.rapor,S.es,S.harita,o,new Set(S.es.bolumler.map((b,i)=>i).filter(i=>!S.kapali.has(i)))));

/* Cropping: each page is rendered once at OLCEK and every question is copied out of it. */
async function sayfaCiz(kit,n){
  if(kit.onbellek.has(n)){const v=kit.onbellek.get(n);kit.onbellek.delete(n);kit.onbellek.set(n,v);return v}
  const page=await kit.pdf.getPage(n),vp=page.getViewport({scale:OLCEK}),cv=document.createElement('canvas');
  cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
  const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:cx,viewport:vp}).promise;page.cleanup();
  const v={cv,vp};kit.onbellek.set(n,v);
  while(kit.onbellek.size>3)kit.onbellek.delete(kit.onbellek.keys().next().value);
  return v;
}
async function soruKirp(kit,t,no){
  const q=kit.testler[t].sorular[no-1],parcalar=[];
  for(const g of q.parcalar){
    const {cv,vp}=await sayfaCiz(kit,g.p),of=kit.ofset[g.p-1]||[0,0],a=vp.convertToViewportPoint(g.x0+of[0],g.y1+of[1]),b=vp.convertToViewportPoint(g.x1+of[0],g.y0+of[1]);
    const x=Math.max(0,Math.floor(Math.min(a[0],b[0]))),y=Math.max(0,Math.floor(Math.min(a[1],b[1]))),w=Math.min(cv.width-x,Math.ceil(Math.abs(b[0]-a[0]))),hh=Math.min(cv.height-y,Math.ceil(Math.abs(b[1]-a[1])));
    const p=document.createElement('canvas');p.width=Math.max(1,w);p.height=Math.max(1,hh);
    const cx=p.getContext('2d');cx.drawImage(cv,x,y,w,hh,0,0,w,hh);parcalar.push(p);
  }
  const W=Math.max(...parcalar.map(p=>p.width)),H=parcalar.reduce((a,p)=>a+p.height,0)+BOSLUK*(parcalar.length-1);
  const out=document.createElement('canvas');out.width=W;out.height=H;
  const cx=out.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,W,H);
  let yy=0,sonTop=0;for(const p of parcalar){sonTop=yy;cx.drawImage(p,0,yy);yy+=p.height+BOSLUK}
  // trailing white of the last piece (the question's column continues to the footer) is cut off
  const last=parcalar[parcalar.length-1],d=cx.getImageData(0,sonTop,W,last.height).data;let end=last.height-1;
  for(;end>20;end--){let ink=false;for(let x=0,o=end*W*4;x<W;x++,o+=4)if(d[o]<235||d[o+1]<235||d[o+2]<235){ink=true;break}if(ink)break}
  const keep=Math.min(H,sonTop+end+1+10*OLCEK/2),res=document.createElement('canvas');res.width=W;res.height=keep;
  res.getContext('2d').drawImage(out,0,0);
  const blob=await new Promise(r=>res.toBlob(r,'image/png'));
  return {url:URL.createObjectURL(blob),w:W,h:keep,genis:q.genis};
}
async function calis(my,liste){
  let n=0;const kit=S.kit;
  for(const [t,no] of liste){
    if(my!==S.jeton||kit!==S.kit)return;
    const k=t+':'+no;
    if(!S.crops.has(k)){try{S.crops.set(k,await soruKirp(kit,t,no))}catch(e){S.hata.kit='Soru '+no+' kesilemedi: '+e.message;break}}
    n++;S.ilerleme=n<liste.length?'Sorular hazırlanıyor… '+n+'/'+liste.length:'';
    if(my!==S.jeton)return;
    for(const img of document.querySelectorAll('img[data-yd="'+k+'"]')){const c=S.crops.get(k);if(c){img.src=c.url;img.removeAttribute('data-bekle')}}
    const st=document.getElementById('ydIlerleme');if(st)st.textContent=S.ilerleme;
  }
}
function hazirla(){
  if(!S.kit||!S.rapor||!S.es||typeof document==='undefined')return S.hazir;
  const my=++S.jeton,gerek=new Map();
  for(const d of defterler())if(d.gorsel)for(const b of d.bolumler)for(const s of b.sorular){const k=s.test+':'+s.a;if(!S.crops.has(k)&&!gerek.has(k))gerek.set(k,[s.test,s.a])}
  const liste=[...gerek.values()].sort((x,y)=>S.kit.testler[x[0]].sorular[x[1]-1].parcalar[0].p-S.kit.testler[y[0]].sorular[y[1]-1].parcalar[0].p||x[0]-y[0]||x[1]-y[1]);
  S.hazir=S.hazir.then(()=>calis(my,liste)).catch(()=>{});
  return S.hazir;
}

/* Markup */
const isaretYazi=s=>s.durum==='bos'?'Boş':'Senin cevabın: '+s.isaret;
function soruHTML(s,gorsel){
  const etiket='Soru '+(s.a??s.own),ek=s.b!==null&&s.a!==null?' (B kitapçığında '+s.b+')':'';
  const isaret='<span class="yd-isaret '+(s.durum==='bos'?'yd-b':'yd-y')+'">'+h(isaretYazi(s))+'</span>';
  if(!gorsel)return '<li class="yd-satir"><b>Soru '+s.own+'</b>'+isaret+'</li>';
  const c=S.crops.get(s.test+':'+s.a),genis=S.kit.testler[s.test].sorular[s.a-1].genis;
  return '<figure class="yd-soru'+(genis?' yd-genis':'')+'"><figcaption><span><b>'+etiket+'</b>'+ek+'</span>'+isaret+'</figcaption><img alt="'+etiket+'" data-yd="'+s.test+':'+s.a+'"'+(c?' src="'+c.url+'"':' data-bekle="1"')+'></figure>';
}
function ogrHTML(d){
  const o=d.ogr,toplam=d.bolumler.reduce((a,b)=>a+b.sorular.length,0),gorsel=d.gorsel&&!!S.kit;
  const kimlik='Öğrenci No <b>'+h(o.no)+'</b> · '+h(o.sube)+(S.rapor.ad?' · '+h(S.rapor.ad):'');
  const sayi='<b>'+d.yanlis+'</b> yanlış · <b>'+d.bos+'</b> boş';
  const ust='<header class="yd-ust"><h2>'+h(o.ad)+'</h2><p class="yd-kimlik">'+kimlik+'</p><p class="yd-say">'+sayi+'</p></header>';
  if(!toplam)return '<article class="yd-ogr yd-yok" data-yd-ogr="'+o.id+'">'+ust+'<p class="yd-not">Yanlış veya boş soru yok.</p></article>';
  const dersler=d.bolumler.map(b=>'<section class="yd-ders"><h3>'+h(b.ders)+' <span>'+b.sorular.length+'</span></h3>'+(gorsel?'<div class="yd-sorular">'+b.sorular.map(s=>soruHTML(s,true)).join('')+'</div>':'<ul class="yd-liste">'+b.sorular.map(s=>soruHTML(s,false)).join('')+'</ul>')+'</section>').join('');
  const not=gorsel?'':'<p class="yd-not">'+o.kit+' kitapçığı: sorular kendi kitapçığından çözülecek</p>';
  const anahtar='<section class="yd-anahtar"><h2>Doğru cevaplar</h2><p class="yd-kimlik">'+h(o.ad)+' · '+kimlik+'</p>'+d.bolumler.map(b=>'<div class="yd-ak"><b>'+h(b.ders)+'</b><span class="yd-harfler">'+b.sorular.map(s=>'<span><i>'+s.own+'</i> '+s.dogru+'</span>').join('')+'</span></div>').join('')+'</section>';
  return '<article class="yd-ogr" data-yd-ogr="'+o.id+'">'+ust+not+dersler+anahtar+'</article>';
}
const durumSatiri=(tur,ad,id)=>'<div class="yd-dosya"><label class="et-dugme'+(S.durum[tur]?'':' birincil')+'">'+ad+'<input id="'+id+'" type="file" accept="'+(tur==='rapor'?'.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf,.pdf')+'" class="yd-file"'+(S.mesgul?' disabled':'')+'></label><span class="yd-durum">'+(S.mesgul===tur?'Okunuyor…':h(S.durum[tur]))+'</span>'+(S.hata[tur]?'<span class="yd-hata" role="alert">'+h(S.hata[tur])+'</span>':'')+'</div>';
function content(){
  const top='<div class="yd-bas et-bas"><h1 class="et-baslik">Yanlışlar defteri</h1></div><div class="yd-dosyalar">'+durumSatiri('kit','Soru kitapçığı (A)','ydKit')+durumSatiri('rapor','Cevap raporu','ydRapor')+durumSatiri('coz','Çözüm kitapçığı','ydCoz')+'</div>';
  if(!S.kit||!S.rapor||!S.es)return top;
  const subeler=[...new Set(S.rapor.ogrenciler.map(o=>o.sube))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  const inSube=S.rapor.ogrenciler.filter(o=>!S.sube||o.sube===S.sube).sort((a,b)=>a.ad.localeCompare(b.ad,'tr'));
  const opt=(v,t,sec)=>'<option value="'+h(v)+'"'+(sec?' selected':'')+'>'+h(t)+'</option>';
  const sel=(label,f,opts)=>'<label class="yd-sec">'+label+'<select data-yd-f="'+f+'">'+opts+'</select></label>';
  const list=defterler(),soru=list.reduce((a,d)=>a+d.bolumler.reduce((x,b)=>x+b.sorular.length,0),0);
  const filtre='<div class="yd-filtre">'+sel('Şube','sube',opt('','Tüm şubeler',!S.sube)+subeler.map(s=>opt(s,s,s===S.sube)).join(''))+sel('Öğrenci','ogr',opt('','Tüm öğrenciler ('+inSube.length+')',!S.ogr)+inSube.map(o=>opt(o.id,o.ad+' · '+o.no,String(o.id)===S.ogr)).join(''))+'</div>';
  const dersler='<div class="yd-dersler" role="group" aria-label="Dersler">'+S.es.bolumler.map((b,i)=>'<label><input type="checkbox" data-yd-ders="'+i+'"'+(S.kapali.has(i)?'':' checked')+'>'+h(b.ders)+'</label>').join('')+'</div>';
  const arac='<div class="yd-arac"><button type="button" class="et-dugme birincil" data-yd-yazdir'+(soru?'':' disabled')+'>Yazdır</button><span class="yd-ozet">'+list.length+' öğrenci · '+soru+' soru</span><span id="ydIlerleme" class="yd-ozet" role="status">'+h(S.ilerleme)+'</span></div>';
  return top+filtre+dersler+arac+'<div class="yd-baski" id="ydBaski">'+list.map(ogrHTML).join('')+'</div>';
}
function gorunum(){
  if(!rehber())return '<p>Bu sayfa rehber öğretmen içindir.</p>';
  setTimeout(()=>{if(etkin())hazirla()},0);
  return '<div id="ydKok">'+content()+'</div>';
}
function render(focus){
  const root=document.getElementById('ydKok');if(!etkin()||!root)return;
  root.innerHTML=content();hazirla();if(focus)root.querySelector(focus)?.focus();
}
async function dosyaYukle(tur,file){
  if(S.mesgul)return;S.mesgul=tur;render();
  try{await yukle(tur,file)}finally{S.mesgul='';render()}
}

/* Print: only the defter pages, A4 portrait. The wait lets every crop finish first. */
function baskiBitir(){
  if(typeof document==='undefined'||!document.body)return;
  document.body.classList?.remove('yd-yazdir');document.getElementById('ydSayfaStili')?.remove();
}
function baskiHazirla(){
  if(!document.getElementById('ydBaski'))return false;
  const stil=document.createElement('style');stil.id='ydSayfaStili';stil.textContent='@media print{@page{size:A4 portrait;margin:12mm}}';
  baskiBitir();document.head.appendChild(stil);document.body.classList.add('yd-yazdir');
  window.addEventListener('afterprint',baskiBitir,{once:true});
  return true;
}
async function yazdir(){
  await hazirla();
  if(!baskiHazirla())return false;
  const imgs=[...document.querySelectorAll('#ydBaski img')];
  await Promise.all(imgs.map(i=>i.complete&&i.naturalWidth?0:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});setTimeout(r,5000)})));
  try{window.print();return true}catch(e){baskiBitir();return false}
}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeprint',()=>{if(etkin()&&!document.body.classList.contains('yd-yazdir'))baskiHazirla()});

document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  const dosya={ydKit:'kit',ydRapor:'rapor',ydCoz:'coz'}[el.id];
  if(dosya){const f=el.files&&el.files[0];el.value='';if(f)dosyaYukle(dosya,f);return}
  if(el.dataset?.ydF==='sube'){S.sube=el.value;if(S.ogr&&S.rapor.ogrenciler.find(o=>String(o.id)===S.ogr)?.sube!==S.sube&&S.sube)S.ogr='';render('[data-yd-f="sube"]');return}
  if(el.dataset?.ydF==='ogr'){S.ogr=el.value;render('[data-yd-f="ogr"]');return}
  if(el.dataset?.ydDers!==undefined){const i=+el.dataset.ydDers;if(el.checked)S.kapali.delete(i);else S.kapali.add(i);render('[data-yd-ders="'+i+'"]')}
});
document.addEventListener('click',ev=>{if(!etkin())return;if(ev.target.closest?.('[data-yd-yazdir]'))yazdir()});
const durumu=()=>S;
return {kitapcikCoz,raporCoz,esle,cozumEtiketleri,haritaKur,defterKur,soruKirp,yukle,gorunum,yazdir,hazirla,durumu,key,title};
})();
function gorunumYanlislar(){return YANLISLAR.gorunum()}
