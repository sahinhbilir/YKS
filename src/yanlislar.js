// Teacher-only "Yanlışlar defteri". Embedded by scripts/embed-yanlislar.cjs. See docs/yanlislar-defteri.md.
// The files of many exams are read in the browser and printed (or downloaded as one PDF) as one defter per student over the selected exams.
// They are kept only on this device (src/denemekutuphane.js, IndexedDB, per teacher, wiped at logout): never in the notebook D, not in
// localStorage, not in Firestore, and nothing is sent anywhere. No personal data belongs in this file.
const YANLISLAR = (() => {
const clean=s=>String(s??'').replace(/\s+/gu,' ').trim();
// Upper case without Turkish marks, letters and digits only: "TC Kimlik No" and "T.C. KİMLİK NO" both give TCKIMLIKNO.
const key=s=>clean(s).toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^A-Z0-9]/gu,'');
/* Proper ders names for the report's section names ("TÜRK DİLİ VE EDB-A" -> "Türk Dili ve Edebiyatı", "TARİH.1-A" -> "Tarih-1"). Unknown names are only title-cased. */
const DERS_ADLARI={TURKCE:'Türkçe',TURKDILIVEEDB:'Türk Dili ve Edebiyatı',TURKDILIVEEDEBIYATI:'Türk Dili ve Edebiyatı',EDEBIYAT:'Türk Dili ve Edebiyatı',TARIH:'Tarih',TARIH1:'Tarih-1',TARIH2:'Tarih-2',COGRAFYA:'Coğrafya',COGRAFYA1:'Coğrafya-1',COGRAFYA2:'Coğrafya-2',
  FELSEFE:'Felsefe',FELSEFEGR:'Felsefe Grubu',FELSEFEGRUBU:'Felsefe Grubu',DINKULTURU:'Din Kültürü',DINKULTURUVEAHLAKBILGISI:'Din Kültürü',SFELSEFE:'Ek Felsefe',EKFELSEFE:'Ek Felsefe',SOSYALFELSEFE:'Ek Felsefe',
  MATEMATIK:'Matematik',GEOMETRI:'Geometri',FIZIK:'Fizik',KIMYA:'Kimya',BIYOLOJI:'Biyoloji'};
const dersAdi=ad=>{const t=clean(ad).replace(/-[TA]$/u,'');return DERS_ADLARI[key(t)]||title(t).replace(/\.\p{L}/gu,m=>m.toLocaleUpperCase('tr-TR'))};
function dersOnek(bolumler){
  const say=new Map();for(const b of bolumler){if(!say.has(b.ders))say.set(b.ders,new Set());say.get(b.ders).add(b.oturum)}
  for(const b of bolumler)if(say.get(b.ders).size>1)b.ders=b.oturum+' '+b.ders;
  return bolumler;
}
const title=s=>clean(s).toLocaleLowerCase('tr-TR').replace(/(^|[\s(])\p{L}/gu,m=>m.toLocaleUpperCase('tr-TR'));
const harfOK=s=>/^[A-E]$/u.test(s);

/* ---------------------------------------------------------------- Soru kitapçığı (A), cut into questions
   pages: [{w,h,items:[{s,x,y,w,h}]}] in PDF units (y grows upwards), as pdf.js reports text.
   A question start is an item "12." at the left edge of a column, first on its line, and the next number in the test's
   sequence. Numbers inside tables ("1.", "1. sıra") fail one of those three. A question's region runs from its number to the
   next start in the same column (or to the footer). A shared passage ("35 - 36. soruları aşağıdaki parçaya göre …") is added
   in front of each question it belongs to. */
// The exam's code ends the header: a number ("…/TÜR-1203") or, for a named exam, letters and digits ("2026-27-AYT/TDE-SB1-ÖZEL1").
const KOD=/^\d{4}-\d{2}-[A-Z]+\/(.+)-[\p{Lu}\d]{1,12}$/u;
const KODTAM=/^\d{4}-\d{2}-([A-Z]+)\/.+-([\p{Lu}\d]{1,12})$/u;
const KOD_BAS=/^\d{4}-\d{2}-[A-Z]+\/.+-$/u;
// A test's first page may break the header code over two lines ("2026-27-AYT/TDE-SB1-" above "ÖZEL1", right-aligned under it): joined back.
function kodBirlestir(p){
  for(const i of p.items){
    if(i.y<=p.h-70||!KOD_BAS.test(i.s))continue;
    const alt=p.items.find(o=>o!==i&&o.s&&o.y<i.y&&i.y-o.y<20&&o.y>p.h-70&&o.x>=i.x-2&&o.x<=i.x+Math.max(i.w,40)+10&&/^[\p{Lu}\d]{1,12}$/u.test(o.s));
    if(alt){i.s+=alt.s;alt.s=''}
  }
  p.items=p.items.filter(i=>i.s);
}
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
/* Some booklets (the real AYT one) hand the text over in pieces: "13" and "." as two items, "35 - 40. soruları …" word by word, a word letter by letter.
   Pieces of one line that touch each other (gap under 4 units) are joined back (a gap of a space or more gets a space). A question number is joined with its dot only
   ("13" + "." -> "13."); a finished "13." is never extended, so the text after it stays a separate item and the start test below sees exactly "13.". */
function parcaBirlestir(items){
  const satirlar=[];
  for(const i of [...items].sort((a,b)=>b.y-a.y)){const l=satirlar.find(l=>Math.abs(l.y-i.y)<0.6);if(l)l.items.push(i);else satirlar.push({y:i.y,items:[i]})}
  return satirlar.flatMap(l=>{
    const out=[];
    for(const i of l.items.sort((a,b)=>a.x-b.x)){
      const p=out[out.length-1],aralik=p?i.x-(p.x+p.w):0;
      const olur=p&&p.w>0&&i.w>0&&aralik>=-1&&aralik<4&&!NO.test(p.s)&&(!/^\d{1,3}$/u.test(p.s)||/^[.\-–—]$/u.test(i.s));
      if(olur){p.s+=(aralik<0.8?'':' ')+i.s;p.w=i.x+i.w-p.x;p.h=Math.max(p.h,i.h)}
      else out.push({...i});
    }
    return out;
  });
}
function kitapcikCoz(pages){
  const fail=m=>{throw new Error(m+' Soru kitapçığı eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>100)fail('PDF sayfaları okunamadı.');
  const P=pages.map(p=>({w:+p.w,h:+p.h,ox:+p.ox||0,oy:+p.oy||0,items:(Array.isArray(p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({s:clean(i.s),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:0,h:Number.isFinite(i.h)&&i.h>0?i.h:9})).filter(i=>i.s)}));
  for(const p of P){p.items=parcaBirlestir(p.items);kodBirlestir(p)}
  if(P.some(p=>!(p.w>200&&p.h>200)))fail('Sayfa boyutu okunamadı.');
  // Pages of one test share the header code (2026-27-TYT/TÜR-1203); the cover has none.
  const runs=[];
  P.forEach((p,i)=>{
    const c=p.items.find(x=>KOD.test(x.s)&&x.y>p.h-70);p.kod=c?KOD.exec(c.s)[1]:null;p.kodItem=c||null;p.tam=c?KODTAM.exec(c.s):null;
    if(!p.kod)return;const last=runs.at(-1);
    if(last&&last.kod===p.kod&&last.son===i-1)last.son=i;
    else{if(runs.some(r=>r.kod===p.kod))fail('Test sayfaları kesintili ('+p.kod+').');runs.push({kod:p.kod,ilk:i,son:i})}
  });
  if(!runs.length)fail('Bu PDF bir soru kitapçığına benzemiyor (sayfa üst bilgisi bulunamadı).');
  // The session (TYT / AYT) and the exam code come from the header code of the pages: "2026-27-TYT/TÜR-1203", "2026-27-AYT/MAT-ÖZEL1".
  const oturumlar=new Set(P.filter(p=>p.tam).map(p=>p.tam[1])),sinavlar=new Set(P.filter(p=>p.tam).map(p=>p.tam[2]));
  if(oturumlar.size>1||sinavlar.size>1)fail('Bu PDF birden fazla oturum veya sınav içeriyor ('+[...oturumlar,...sinavlar].join(', ')+').');
  const inRun=runs.flatMap(r=>P.slice(r.ilk,r.son+1)),W=P[0].w;
  const cand=inRun.flatMap(p=>p.items.filter(i=>NO.test(i.s)&&i.y<p.h-70&&i.y>60));
  const sol=kenar(cand.filter(i=>i.x<W/2).map(i=>i.x)),sag=kenar(cand.filter(i=>i.x>=W/2).map(i=>i.x));
  if(sol===null||sag===null)fail('Soru numaraları sütun kenarında bulunamadı.');
  const bolun=sag-15,side=x=>x<bolun?0:1,EDGE=3.5;
  const out={w:W,h:P[0].h,oturum:[...oturumlar][0]||null,sinav:[...sinavlar][0]||null,testler:[]};
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
  // Every sheet that has the report's header row is one session (TYT and AYT sheets of one workbook); other sheets are ignored.
  const bulunanlar=[];
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
    if(hdr)bulunanlar.push({hdr,pre,post});
  }
  if(!bulunanlar.length)fail('Bu dosya bir cevap raporu değil (Öğrenci No ve Ad Soyad başlıkları bulunamadı).');
  const sayfaCoz=({hdr,pre,post})=>{
    const H=new Map([...hdr.row].map(([c,v])=>[key(v),c]));
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
      bolumler.push({ad:s.ad,ders:dersAdi(s.ad),n:qs.length,bas});bas+=qs.length;sutunlar.push(...qs.map(q=>q.c));
    });
    if(!bolumler.length)fail('Soru bölümü bulunamadı.');
    const sonekler=new Set(bolumler.map(b=>/-A$/u.test(b.ad)?'AYT':'TYT'));
    if(sonekler.size!==1)fail('Bir sayfada hem TYT (-T) hem AYT (-A) bölümleri var.');
    const oturum=[...sonekler][0];
    bolumler.forEach(b=>{b.oturum=oturum});
    const anahtar={},ogrenciler=[];
    const dizi=row=>sutunlar.map(c=>{const v=clean(row.get(c)).toUpperCase();return harfOK(v)?v:''});
    for(const r of [...post.keys()].sort((a,b)=>a-b)){
      const row=post.get(r),etiket=key(row.get(cAd)||'');
      const km=/^CEVAPANAHTARI([AB])$/u.exec(etiket);
      if(km){anahtar[km[1]]=dizi(row);continue}
      if(!row.get(cNo))continue;
      const kit=clean(row.get(cKit)).toUpperCase();
      if(kit!=='A'&&kit!=='B')fail('Kitapçık türü A veya B olmayan öğrenci satırı var.');
      ogrenciler.push({sira:clean(row.get(H.get('SIRA'))).replace(/\.0+$/u,''),no:row.get(cNo).replace(/\.0+$/u,''),ad:clean(row.get(cAd)),sube:clean(row.get(cSube)),kit,cev:dizi(row)});
    }
    if(!ogrenciler.length)fail((bulunanlar.length>1?oturum+' sayfasında öğrenci':'Öğrenci')+' satırı bulunamadı.');
    for(const k of new Set(ogrenciler.map(o=>o.kit)))if(!anahtar[k])fail('Cevap Anahtarı - '+k+' satırı bulunamadı.');
    let ad='',tarih='';
    for(const row of pre.values())for(const v of row.values()){const m=/S[ıi]nav\s*:\s*([^|]+)/iu.exec(v);if(m&&!ad)ad=clean(m[1]);const t=/Rapor\s+Tarihi\s*:\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/iu.exec(v);if(t&&!tarih)tarih=t[3]+'-'+t[2].padStart(2,'0')+'-'+t[1].padStart(2,'0')}
    return {oturum,bolumler,T:bas,anahtar,ogrenciler,ad,tarih};
  };
  const parcalar=bulunanlar.map(sayfaCoz);
  const oturumlar=parcalar.map(p=>p.oturum);
  if(new Set(oturumlar).size!==oturumlar.length)fail('Aynı oturum (TYT veya AYT) iki sayfada var.');
  // TYT before AYT, however the sheets are ordered; students are joined by Öğrenci No across the sheets.
  parcalar.sort((a,b)=>(a.oturum==='AYT')-(b.oturum==='AYT'));
  const adlar=[...new Set(parcalar.map(p=>p.ad).filter(Boolean))];
  const sayiOf=s=>(/(\d{3,5})\s*$/u.exec(s)||[])[1]||'';
  if(new Set(adlar.map(a=>sayiOf(a)||a)).size>1)fail('TYT ve AYT sayfaları farklı sınavlara ait ('+adlar.join(' ve ')+').');
  const toplam=parcalar.reduce((a,p)=>a+p.T,0),anahtar={},bolumler=[],ogrenciler=[],byNo=new Map();
  let ofset=0;
  for(const p of parcalar){
    for(const k of Object.keys(p.anahtar)){if(!anahtar[k])anahtar[k]=Array(toplam).fill('');anahtar[k].splice(ofset,p.T,...p.anahtar[k])}
    bolumler.push(...p.bolumler.map(b=>({...b,bas:b.bas+ofset})));
    for(const o of p.ogrenciler){
      let q=byNo.get(o.no);
      if(!q||q.oturumlar.includes(p.oturum)){
        q={id:ogrenciler.length,sira:o.sira,no:o.no,ad:o.ad,sube:o.sube,kit:o.kit,kits:{},oturumlar:[],cev:Array(toplam).fill('')};
        ogrenciler.push(q);if(!byNo.has(o.no))byNo.set(o.no,q);
      }
      if(!q.sube)q.sube=o.sube;
      q.kits[p.oturum]=o.kit;q.oturumlar.push(p.oturum);q.cev.splice(ofset,p.T,...o.cev);
    }
    ofset+=p.T;
  }
  // The same ders name in both sessions ("Matematik") is prefixed with its session; otherwise no prefix.
  dersOnek(bolumler);
  const ad=adlar[0]||'';
  return {ad,tarih:parcalar.map(p=>p.tarih).find(Boolean)||'',sinavNo:sayiOf(ad)||'',oturumlar:parcalar.map(p=>p.oturum),bolumler,T:toplam,anahtar,ogrenciler};
}

/* ---------------------------------------------------------------- One exam, several spellings
   A numbered exam is its number wherever it is written ("27-YKS-1203", "SENTETİK-1203", a booklet's "…/TÜR-1203" → "1203"). A named exam is its name's
   letters and digits without the year and the session ("27_AYT_ÖZEL_1", the Performans analizi's and the Ders ortalamaları's "27_AYT_ÖZEL_1", the booklet's
   "…/MAT-ÖZEL1" → "OZEL1"). */
const sayisalSinav=s=>/\d{3,5}\s*$/u.test(String(s??''));
const sinavAnahtari=s=>{const t=String(s??''),n=(/(\d{3,5})\s*$/u.exec(t)||[])[1];if(n)return n;return key(t).replace(/^(?:\d{4}|\d{2})(?=[A-Z])/u,'').replace(/^(?:TYT|AYT|YKS)(?=[A-Z0-9])/u,'')};
// Two files name different exams: both spelled the same way (numbered or named) and their identities differ. A numbered file against a named report is not
// judged (a report may carry a name where the booklet carries the number).
const farkliSinav=(a,b)=>!!a&&!!b&&sayisalSinav(a)===sayisalSinav(b)&&!!sinavAnahtari(a)&&!!sinavAnahtari(b)&&sinavAnahtari(a)!==sinavAnahtari(b);
const raporSinavi=r=>r.sinavNo||r.ad||'';

/* ---------------------------------------------------------------- Report sections -> booklet tests
   The report's sections run in booklet order. Each test takes consecutive sections until its question count is full.
   One A booklet per session: kitlar = {TYT: kit, AYT: kit}. A session without a booklet has no cut-outs (its sections are left out). */
function esle(rapor,kitlar){
  const fail=m=>{throw new Error(m)};
  const oturumlar=rapor.oturumlar||[...new Set(rapor.bolumler.map(b=>b.oturum||'TYT'))];
  // a single booklet belongs to its own session (the one in its page header)
  if(kitlar&&kitlar.testler)kitlar={[kitlar.oturum&&oturumlar.includes(kitlar.oturum)?kitlar.oturum:oturumlar[0]]:kitlar};
  for(const ses of Object.keys(kitlar))if(kitlar[ses]&&!oturumlar.includes(ses))fail('Cevap raporunda '+ses+' sayfası yok, '+ses+' soru kitapçığı bu rapora eklenemez.');
  const bolumler=[],testler=[],aralik={},ciftler=[];let t0=0;
  for(const ses of oturumlar){
    const kit=kitlar[ses];if(!kit)continue;
    if(farkliSinav(kit.sinav,raporSinavi(rapor)))fail(sayisalSinav(kit.sinav)?ses+' soru kitapçığı '+kit.sinav+' numaralı sınava ait, cevap raporu '+rapor.sinavNo+' numaralı sınav ('+rapor.ad+').':ses+' soru kitapçığı '+kit.sinav+' sınavına ait, cevap raporu '+rapor.ad+' sınavı.');
    const secs=rapor.bolumler.map((b,ri)=>({b,ri})).filter(x=>(x.b.oturum||'TYT')===ses);
    const ozet=(oturumlar.length>1?ses+' · ':'')+'Rapor: '+secs.map(x=>x.b.ders+' '+x.b.n).join(', ')+'. Kitapçık: '+kit.testler.map(t=>t.ad+' '+t.soru).join(', ')+'.';
    let ti=0,off=0;const yerel=[];
    for(const {b,ri} of secs){
      const t=kit.testler[ti];
      if(!t||off+b.n>t.soru)fail('Cevap raporundaki bölümler soru kitapçığındaki testlerle eşleşmiyor. '+ozet);
      yerel.push({...b,ri,test:t0+ti,off});off+=b.n;if(off===t.soru){ti++;off=0}
    }
    if(ti!==kit.testler.length||off!==0)fail('Cevap raporundaki bölümler soru kitapçığındaki testlerle eşleşmiyor. '+ozet);
    // Din Kültürü and S.Felsefe are alternatives; a student sits one of them.
    const din=yerel.findIndex(b=>key(b.ad).startsWith('DIN')),alt=yerel.findIndex(b=>/^(SFELSEFE|SOSYALFELSEFE)/u.test(key(b.ad)));
    if(din>=0&&alt>=0)ciftler.push([bolumler.length+din,bolumler.length+alt]);
    bolumler.push(...yerel);testler.push(...kit.testler.map(t=>t.soru));aralik[ses]=[t0,t0+kit.testler.length];t0+=kit.testler.length;
  }
  if(!bolumler.length)fail('Cevap raporundaki bölümler soru kitapçığındaki testlerle eşleşmiyor.');
  return {bolumler,testler,cift:ciftler[0]||null,ciftler,aralik,oturumlar:Object.keys(aralik)};
}
// The part of a matched report that belongs to one session, with test numbers counted from that session's first test.
function esOturum(es,ses){
  const [a,b]=es.aralik[ses];
  return {testler:es.testler.slice(a,b),bolumler:es.bolumler.filter(x=>x.test>=a&&x.test<b).map(x=>({...x,test:x.test-a}))};
}

/* ---------------------------------------------------------------- Çözüm kitapçığı: the A <-> B question map */
const ETIKET=/^A\s*[-–]\s*(\d{1,3})\s*\/\s*B\s*[-–]\s*(\d{1,3})$/u;
// The labels of one page as {m, x, y}. Some çözüm PDFs write a label as one run ("A-1 / B-3"), others as pieces on one
// line ("A-1", "/", "B-3"): pieces closer than 14 pt on the same line are joined before matching.
function etiketler(p){
  const items=(Array.isArray(p&&p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({s:clean(i.s),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:i.s.length*5}));
  const satir=[];for(const i of items.sort((a,b)=>b.y-a.y||a.x-b.x)){const l=satir.find(l=>Math.abs(l.y-i.y)<2);if(l)l.items.push(i);else satir.push({y:i.y,items:[i]})}
  const out=[];
  for(const l of satir){const it=l.items.sort((a,b)=>a.x-b.x);let kosu=null;
    const bitir=()=>{if(kosu){const m=ETIKET.exec(kosu.s);if(m)out.push({m,x:kosu.x,y:kosu.y})}kosu=null};
    for(const i of it){if(kosu&&i.x-kosu.son<14&&kosu.n<5){kosu.s=clean(kosu.s+' '+i.s);kosu.son=i.x+i.w;kosu.n++}else{bitir();kosu={s:i.s,x:i.x,y:i.y,son:i.x+i.w,n:1}}
      if(ETIKET.test(kosu.s))bitir()}
    bitir()}
  return out;
}
// pages: [{w,items:[{s,x,y}]}]. Labels are read left column top to bottom, then the right column, page after page.
function cozumEtiketleri(pages){
  const fail=m=>{throw new Error(m+' Çözüm kitapçığı eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>200)fail('PDF sayfaları okunamadı.');
  const pairs=[];
  for(const p of pages){
    const w=p.w||600;
    etiketler(p).map(i=>({m:i.m,c:i.x<w/2?0:1,y:i.y})).sort((a,b)=>a.c-b.c||b.y-a.y).forEach(i=>pairs.push([+i.m[1],+i.m[2]]));
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
  const matGeo=i=>['MATEMATIK','GEOMETRI'].includes(courseKey(es.bolumler[i]?.ders||es.bolumler[i]?.ad));
  testler.forEach(({aToB},t)=>{
    for(let a=1;a<aToB.length;a++){
      const b=aToB[a],sa=sec(t,a),sb=sec(t,b);
      if(sa!==sb&&!(matGeo(sa)&&matGeo(sb)))fail('A-'+a+' / B-'+b+' farklı derslere ait ('+es.bolumler[sa].ders+' ve '+es.bolumler[sb].ders+').');
      if(rapor.anahtar.A&&rapor.anahtar.B&&harf('A',t,a)!==harf('B',t,b))fail('A-'+a+' / B-'+b+' cevap anahtarlarıyla uyuşmuyor.');
    }
  });
  return {testler,adet:pairs.length};
}

/* ---------------------------------------------------------------- Who is judged on which test
   One rule for the school's rates (Okulunda doğru, fark soruları) and for Öğrencinin alanı. A blank question is a wrong one ("I could not do it").
   TYT: everyone who sat the session, on every test. AYT: only the booklet tests of the student's field (TDE–Sosyal-1, Sosyal-2, Matematik, Fen),
   blanks included; another test the student happened to answer does not count (it would crowd the defter). The field is the student's alan in
   the notebook, else the alan most of the student's şube has there, else the AYT tests more than half of the şube answered, else the tests the
   student answered. Din Kültürü is compulsory and never skipped; Ek Felsefe (S.FELSEFE) never counts. */
const cevapli=(o,b)=>o.cev.slice(b.bas,b.bas+b.n).some(Boolean);
const ekFelsefe=b=>/^(SFELSEFE|SOSYALFELSEFE|EKFELSEFE)/u.test(key(String(b.ad||'').replace(/-[TA]$/u,'')))||key(b.ders||'')==='EKFELSEFE';
const oturumda=(o,b)=>!o.oturumlar||o.oturumlar.includes(b.oturum||'TYT');
// The notebook's alan by school no (the first entry that is not deleted, as ogrAlani reads it).
function alanHaritasi(){
  const m=new Map();
  if(typeof D!=='undefined'&&Array.isArray(D.ogr))for(const x of D.ogr){if(!x||x.silindi)continue;const id=String(x.no??'').trim();if(id&&!m.has(id))m.set(id,alanAnahtar(x.alan))}
  return m;
}
const KURAL=new WeakMap();
// (rapor, es) -> {f: student -> Set of section indices (es.bolumler) the student is judged on, imza}. Cached per report, matched report and alan list.
function sayilanKural(rapor,es){
  const A=alanHaritasi(),alanOf=o=>A.get(String(o.no??'').trim())||null,imza=rapor.ogrenciler.map(o=>alanOf(o)||'').join(',');
  const c=KURAL.get(rapor);if(c&&c.es===es&&c.imza===imza)return c;
  const ayt=es.bolumler.filter(b=>(b.oturum||'TYT')==='AYT');
  const alanTest=a=>{const kod=typeof DENEME_ALAN!=='undefined'?DENEME_ALAN[a]:null;return new Set(kod?ayt.filter(b=>kod.includes(bolumKodu(b))).map(b=>b.test):[])};
  const cevapTest=o=>new Set(ayt.filter(b=>oturumda(o,b)&&cevapli(o,b)).map(b=>b.test));
  const subeTest=new Map();
  if(ayt.length){
    const subeler=new Map();
    for(const o of rapor.ogrenciler){if(o.oturumlar&&!o.oturumlar.includes('AYT'))continue;const l=subeler.get(o.sube)||[];l.push(o);subeler.set(o.sube,l)}
    for(const [sube,l] of subeler){
      const say=new Map();for(const o of l){const a=alanOf(o);if(a)say.set(a,(say.get(a)||0)+1)}
      const sira=[...say].sort((x,y)=>y[1]-x[1]);
      if(sira.length&&(sira.length===1||sira[0][1]>sira[1][1])){subeTest.set(sube,alanTest(sira[0][0]));continue}
      const n=new Map();for(const o of l)for(const t of cevapTest(o))n.set(t,(n.get(t)||0)+1);
      subeTest.set(sube,new Set([...n].filter(([,k])=>2*k>l.length).map(([t])=>t)));
    }
  }
  const f=o=>{
    const a=alanOf(o),out=new Set();let testler=a?alanTest(a):subeTest.get(o.sube)||new Set();
    if(!testler.size)testler=cevapTest(o);
    es.bolumler.forEach((b,i)=>{
      if(!oturumda(o,b)||ekFelsefe(b))return;
      if((b.oturum||'TYT')==='AYT'&&!testler.has(b.test))return;
      out.add(i);
    });
    return out;
  };
  const k={es,imza,f};KURAL.set(rapor,k);return k;
}

/* ---------------------------------------------------------------- One student's defter */
// Wrong or empty questions per ders, in booklet order. a = number in the A booklet, b = number in the student's own B booklet.
// A student has one booklet per session (kits: {TYT:'A', AYT:'B'}); sections of a session the student did not sit are left out.
// i = the section's index in the report, ai = the A booklet section's index in the report, k = the question's position in the section (own booklet), ak = the same for the A booklet.
// Din Kültürü is compulsory for every student: it is never skipped. Ek Felsefe (S.FELSEFE) never counts.
function defterKur(rapor,es,harita,ogr,acik){
  const atla=new Set();
  es.bolumler.forEach((b,i)=>{if(ekFelsefe(b))atla.add(i)});
  const bolumler=[];let yanlis=0,bos=0;
  es.bolumler.forEach((b,i)=>{
    const ses=b.oturum||ogr.oturumlar?.[0]||'TYT';
    if(atla.has(i)||(acik&&!acik.has(i))||(ogr.oturumlar&&!ogr.oturumlar.includes(ses)))return;
    const kit=ogr.kits?ogr.kits[ses]:ogr.kit,anahtar=rapor.anahtar[kit],sorular=[];
    for(let k=0;k<b.n;k++){
      const g=b.bas+k,isaret=ogr.cev[g],dogru=anahtar[g];
      if(!harfOK(dogru)||isaret===dogru)continue;
      const own=b.off+k+1,a=kit==='A'?own:(harita?.testler[b.test]?.bToA[own]??null);
      const ba=a===null?b:(es.bolumler.find(x=>x.test===b.test&&a>x.off&&a<=x.off+x.n)||b);
      sorular.push({test:b.test,i:b.ri??i,ai:ba.ri??es.bolumler.indexOf(ba),k,ak:a===null?null:a-ba.off-1,own,a,b:kit==='B'?own:null,isaret,dogru,durum:isaret?'yanlis':'bos'});
    }
    if(!sorular.length)return;
    sorular.sort((x,y)=>(x.a??x.own)-(y.a??y.own));
    yanlis+=sorular.filter(s=>s.durum==='yanlis').length;bos+=sorular.filter(s=>s.durum==='bos').length;
    bolumler.push({i,ri:b.ri??i,ders:b.ders,oturum:ses,kit,sorular,gorsel:sorular.every(s=>s.a!==null)});
  });
  return {ogr,yanlis,bos,bolumler,gorsel:bolumler.every(b=>b.gorsel)};
}
/* ---------------------------------------------------------------- Ders ortalamaları (İlk 100 Kurum), optional
   The publisher's "Ders Ortalamaları İlk 100 Kurum" PDF: one section per ders, title "27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_ (İlk 100 Okul)",
   header "Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net", then 100 school rows. Only three things are read: the exam code, the question count of the
   title and the Genel Net column (network-wide average net, constant down the column). The school rows are never looked at: the school name cells are not
   in any column we read, and nothing but {kod, dersler:[{ad,n,genel}]} is kept. pages: [{items:[{s,x,y}]}]; a ders continues over pages that repeat the header without a title. */
// "27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_" or, for a named exam, "27_AYT_ÖZEL_1, TÜRK DİLİ VE EDB-A Dersi …".
const ORT_BASLIK=/^([^,]{1,60}?)\s*,\s*(.+?)\s+Dersi\s+Net\s+S[ıi]ral[ıi]\s+Liste\s*_\s*(\d{1,3})\s*Soru\s*_/iu;
const ORT_SUTUNLAR=['SIRALAMA','OKULADI','OKULNET','OKULBASARI','GENELNET'];
const ORT_SAYI=/^\d{1,3}(?:[.,]\d{1,2})?$/u;
function ortalamaCoz(pages){
  const fail=m=>{throw new Error(m+' Ders ortalamaları dosyası eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>200)fail('PDF sayfaları okunamadı.');
  const dersler=[];let cur=null;
  for(const p of pages){
    const items=(Array.isArray(p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({s:clean(i.s),x:i.x,y:i.y}));
    // header columns of this page (the first header row per title; a continuation page repeats the header at its top)
    const basliklar=items.filter(i=>ORT_SUTUNLAR.includes(key(i.s)));
    for(const i of items.sort((a,b)=>b.y-a.y||a.x-b.x)){
      const t=ORT_BASLIK.exec(i.s);
      if(t){cur={kod:t[1].toUpperCase(),ad:clean(t[2]),n:+t[3],degerler:[]};dersler.push(cur);continue}
      if(!cur||!ORT_SAYI.test(i.s))continue;
      // the header row belonging to this row = the closest column-header row above it; the column is the header nearest by x
      const ust=basliklar.filter(b=>b.y>i.y);
      if(!ust.length)continue;
      const y0=Math.min(...ust.map(b=>b.y)),kolonlar=ust.filter(b=>Math.abs(b.y-y0)<3);
      let en=null;for(const b of kolonlar)if(!en||Math.abs(b.x-i.x)<Math.abs(en.x-i.x))en=b;
      if(en&&key(en.s)==='GENELNET')cur.degerler.push(+i.s.replace(',','.'));
    }
  }
  if(!dersler.length)fail('Bu PDF’de "… Dersi Net Sıralı Liste" başlıklı ders bölümü bulunamadı.');
  if(dersler.length>40)fail('Çok fazla ders bölümü var.');
  const kodlar=[...new Set(dersler.map(d=>d.kod))];
  if(kodlar.length>1)fail('Bu PDF birden fazla sınav kodu içeriyor ('+kodlar.join(', ')+').');
  const gorulen=new Set(),out=[];
  for(const d of dersler){
    if(gorulen.has(key(d.ad)))fail(d.ad+' dersi iki kez geçiyor.');gorulen.add(key(d.ad));
    if(!(d.n>0))fail(d.ad+' dersinin soru sayısı okunamadı.');
    const tek=[...new Set(d.degerler)];
    if(!tek.length)fail(d.ad+' dersinin Genel Net değeri bulunamadı.');
    if(tek.length>1)fail(d.ad+' dersinde Genel Net sütunu tek bir değer değil.');
    if(!(tek[0]>=0&&tek[0]<=d.n))fail(d.ad+' dersinin Genel Net değeri soru sayısını aşıyor.');
    out.push({ad:d.ad,n:d.n,genel:tek[0]});
  }
  return {kod:kodlar[0],dersler:out};
}
// The file must be the report's exam and its question counts must match the report's sections. Sections of the report that the file does not list simply stay unanchored.
function ortalamaDogrula(ort,rapor){
  const fail=m=>{throw new Error(m+' Ders ortalamaları dosyası eklenmedi.')};
  if(farkliSinav(ort.kod,raporSinavi(rapor)))fail('Sınav kodları uyuşmuyor: ders ortalamaları dosyası '+ort.kod+' sınavına ait, cevap raporu '+(rapor.ad||rapor.sinavNo)+' sınavı.');
  const map=new Map(ort.dersler.map(d=>[key(d.ad),d]));let eslesen=0;
  for(const b of rapor.bolumler){
    const d=map.get(key(b.ad));if(!d)continue;
    if(d.n!==b.n)fail('Soru sayıları uyuşmuyor: '+b.ad+' için cevap raporunda '+b.n+', ders ortalamaları dosyasında ('+ort.kod+') '+d.n+' soru var.');
    eslesen++;
  }
  if(!eslesen)fail('Cevap raporundaki derslerin hiçbiri dosyada ('+ort.kod+') bulunamadı.');
  return map;
}
/* ---------------------------------------------------------------- Performans analizi (publisher PDF), optional
   "27-YKS-1202 SINAVI ANALİZLERİ": one page per ders ("TÜRKÇE-T (40 Soru )", section names as in the cevap raporu), one row per question of the A booklet:
   "1. Soru | 73 54 399 15 98 1994 1295 1 95 6 111 … | 0.83 | çok kolay soru | 0.34 | başarılı" = ÜST and ALT counts of A, B, C, D, E, BOŞ, then p, its meaning, r, its meaning.
   Aggregate counts, with a separate reference population for each subject. Option counts are only for the upper and lower groups. */
const PERF_SATIR=/^(\d{1,3})\s*\.\s*Soru\s+(\d+(?:\s+\d+){11})\s+(\d(?:[.,]\d+)?)\s+(?:\S.*?\s+)?(-?\d(?:[.,]\d+)?)(?:\s+\S.*)?$/iu;
const PERF_BASLIK=/^(.+?)\s*\(\s*(\d{1,3})\s*Soru\s*\)\s*$/iu;
const PERF_SAYIM=/^(.+?)\s*:\s*(\d{1,9})$/u;
const basamak=s=>s.split(/[.,]/u)[1]?.length||0;
// the text of each line of a page (items on one baseline joined left to right)
function satirMetinleri(p){
  const items=(Array.isArray(p&&p.items)?p.items:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y));
  const satir=[];for(const i of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){const l=satir.find(l=>Math.abs(l.y-i.y)<3);if(l)l.items.push(i);else satir.push({y:i.y,items:[i]})}
  return satir.map(l=>clean(l.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ')));
}
const perfBaslikMi=s=>{const k=key(s);return k.includes('SINAVIANALIZLERI')||k.includes('MADDEGUCLUKINDEKSI')};
const performansMi=pages=>pages.some(p=>satirMetinleri(p).some(perfBaslikMi));
function performansCoz(pages,{tamAd=false}={}){
  const fail=m=>{throw new Error(m+' Performans analizi dosyası eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>200)fail('PDF sayfaları okunamadı.');
  // The title: "27-YKS-1202 SINAVI ANALİZLERİ" (the code), or a named exam's "27_AYT_ÖZEL_1 SINAVI ANALİZLERİ" (the whole name; tamAd: always the whole name).
  let kod='',adli='',cur=null;const dersler=[],metin=[];
  const tamBaslik=/^(\S.{0,159}?)\s+S[Iİı]NAVI\s+AN[AİI]L[İI]ZLER[İI]$/iu;
  for(const p of pages){
    for(const s of satirMetinleri(p)){
      const k=tamAd?tamBaslik.exec(s):
        /(\d{1,3}-[A-Z]+-\d{3,5})\s+S[Iİı]NAVI/u.exec(s)||/(\d{1,3}-[A-Z]+-\d{3,5}).*AN[AİI]L[İI]ZLER[İI]/iu.exec(s);
      if(k){
        const yeni=tamAd?clean(k[1]):k[1].toUpperCase();
        if(kod&&kod!==yeni)fail('Dosyada birden çok sınav adı var.');
        kod=yeni;
      }else if(!tamAd&&!cur){
        const a=tamBaslik.exec(s);
        if(a){const yeni=clean(a[1]);if(adli&&adli!==yeni)fail('Dosyada birden çok sınav adı var.');adli=yeni}
      }
      const b=PERF_BASLIK.exec(s);
      if(b&&/-[TA]$/u.test(clean(b[1]))){cur={ad:clean(b[1]),n:+b[2],orneklem:null,grupToplam:null,maddeler:[]};dersler.push(cur);continue}
      if(!cur)metin.push(s);
      const sayim=cur&&PERF_SAYIM.exec(s);
      if(sayim){
        const ad=key(sayim[1]),alan=ad==='ISARETLEMEYAPANOGRENCISAYISI'?'orneklem':ad==='USTVEALTGRUPTOPLAMOGRENCISAYISI'?'grupToplam':null;
        if(alan){
          const n=+sayim[2];if(cur[alan]!==null&&cur[alan]!==n)fail(cur.ad+' öğrenci sayıları tutarsız.');
          cur[alan]=n;continue;
        }
      }
      const r=cur&&PERF_SATIR.exec(s);
      if(!r)continue;
      const c=r[2].split(/\s+/).map(Number),no=+r[1];
      const madde={no,p:+r[3].replace(',','.'),r:+r[4].replace(',','.'),pBasamak:basamak(r[3]),rBasamak:basamak(r[4]),ust:c.filter((_,i)=>i%2===0),alt:c.filter((_,i)=>i%2===1)};
      const eski=cur.maddeler.find(m=>m.no===no);
      if(eski){if(JSON.stringify(eski)!==JSON.stringify(madde))fail(cur.ad+' soru '+no+' iki farklı satırda geçiyor.');continue}
      cur.maddeler.push(madde);
    }
  }
  if(!kod&&adli)kod=adli;
  if(!kod)fail('Sınav adı ("27-YKS-1202 SINAVI ANALİZLERİ") bulunamadı.');
  if(!dersler.length)fail('Bu PDF’de "TÜRKÇE-T (40 Soru )" başlıklı ders sayfası bulunamadı.');
  if(dersler.length>40)fail('Çok fazla ders bölümü var.');
  const gorulen=new Set();
  for(const d of dersler){
    if(gorulen.has(key(d.ad)))fail(d.ad+' dersi iki kez geçiyor.');gorulen.add(key(d.ad));
    if(!(d.n>0))fail(d.ad+' dersinin soru sayısı okunamadı.');
    d.maddeler.sort((a,b)=>a.no-b.no);
    if(d.maddeler.length!==d.n||d.maddeler.some((m,i)=>m.no!==i+1))fail(d.ad+' dersinde '+d.n+' soru yazıyor, '+d.maddeler.length+' soru satırı okunabildi.');
    if(d.maddeler.some(m=>!(m.p>=0&&m.p<=1)||!(m.r>=-1&&m.r<=1)))fail(d.ad+' dersinde güçlük veya ayırdedicilik değeri geçersiz.');
  }
  const kitapcik=/\bA\s+kitap[cç][ıi][gğ][ıi](?:n[ıi])?(?!\p{L})/iu.test(metin.join(' '))?'A':null;
  return {kod,kitapcik,dersler};
}
// The file must be this exam's, its question counts must fit the report's sections, and the printed discrimination index r should match (ÜST[key] − ALT[key]) / nGrup for the report's A key.
// A few differences are normal (a cancelled or differently keyed question); more than about 10% means the mapping is wrong and the file is refused.
function performansDogrula(perf,rapor){
  const fail=m=>{throw new Error(m+' Performans analizi dosyası eklenmedi.')};
  if(farkliSinav(perf.kod,raporSinavi(rapor)))fail('Sınav kodları uyuşmuyor: performans analizi dosyası '+perf.kod+' sınavına ait, cevap raporu '+(rapor.ad||rapor.sinavNo)+' sınavı.');
  const map=new Map(perf.dersler.map(d=>[key(d.ad),d]));let eslesen=0,toplam=0,farkli=0;
  for(const b of rapor.bolumler){
    const d=map.get(key(b.ad));if(!d)continue;
    if(d.n!==b.n)fail('Soru sayıları uyuşmuyor: '+b.ad+' için cevap raporunda '+b.n+', performans analizi dosyasında ('+perf.kod+') '+d.n+' soru var.');
    eslesen++;
    d.maddeler.forEach((m,q)=>{
      const dogru=rapor.anahtar.A?.[b.bas+q];if(!harfOK(dogru))return;
      const idx='ABCDE'.indexOf(dogru),nGrup=m.ust.reduce((a,x)=>a+x,0);if(!(nGrup>0))return;
      const hesapR=(m.ust[idx]-m.alt[idx])/nGrup;toplam++;
      if(Math.abs(hesapR-m.r)>0.55*Math.pow(10,-(m.rBasamak||2))+1e-6)farkli++;
    });
  }
  if(!eslesen)fail('Cevap raporundaki derslerin hiçbiri dosyada ('+perf.kod+') bulunamadı.');
  if(toplam&&farkli>toplam*.1)fail(farkli+' soruda ayırdedicilik değeri cevap anahtarıyla uyuşmuyor ('+toplam+' sorudan); dosya bu cevap raporuna ait değil veya sorular eşleşmiyor.');
  return {map,farkli,toplam};
}
/* ---------------------------------------------------------------- Soru zorluğu ve madde kalitesi (src/zorluk.js)
   Computed here, in memory, from the report's own answers: correct = 1, wrong or blank = 0. With a valid A <-> B map the A and B students are pooled on
   A numbering; without it each booklet is analysed on its own numbers. Whoever left the whole section blank did not take it. A cancelled question
   (a key that is not A-E) is left out of the totals. dis = the school's Madde Analizi (difficultyIndex) for the optional rank correlation. */
function zorlukAnaliz(rapor,es,harita,dis,ort,perf){
  const perfMap=perf?new Map(perf.dersler.map(d=>[key(d.ad),d])):null,ortMap=ort?new Map(ort.dersler.map(d=>[key(d.ad),d])):null;
  const map=new Map(),bolumler=[];
  rapor.bolumler.forEach((b,ri)=>{
    const ses=b.oturum||'TYT',eb=es?es.bolumler.find(x=>x.ri===ri):null,hm=eb&&harita?.testler?.[eb.test]||null;
    const kimler=rapor.ogrenciler.filter(o=>(o.oturumlar||[ses]).includes(ses)),kitOf=o=>o.kits?o.kits[ses]:o.kit;
    // pos(o, k): the position in student o's own booklet of the group's k-th question
    const grup=(kit,satirlar,pos)=>{
      const atla=new Set();
      for(let k=0;k<b.n;k++)if(satirlar.some(o=>!harfOK(rapor.anahtar[kitOf(o)]?.[b.bas+pos(o,k)])))atla.add(k);
      const rows=satirlar.map(o=>Array.from({length:b.n},(_,k)=>{if(atla.has(k))return -1;const key=rapor.anahtar[kitOf(o)][b.bas+pos(o,k)],v=o.cev[b.bas+pos(o,k)];return v?(v===key?1:0):-1}));
      const a=ZORLUK.bolum(rows,{k:b.n,atla});if(!a.n)return null;
      let rho=null;
      if(dis&&eb&&kit!=='B'){const x=[],y=[];a.maddeler.forEach(m=>{const q=dis.map.get(eb.test+':'+(eb.off+m.i+1));if(!m.iptal&&q&&m.p!==null){x.push(m.p);y.push(q.p)}});rho=ZORLUK.spearman(x,y)}
      // optional anchoring of the bands to the network average (ZORLUK.capala); the file is trusted only when its question count equals the section's
      // Priority: the publisher's network-wide p (Performans analizi, A numbers), then the school p anchored by Ders ortalamaları, then the school p alone.
      const od=ortMap?ortMap.get(key(b.ad)):null,pd=perfMap&&kit!=='B'?perfMap.get(key(b.ad)):null;
      if(pd&&pd.n===b.n&&ZORLUK.performans(a,pd.maddeler.map(m=>m.p))){}
      else if(od&&od.n===b.n)ZORLUK.capala(a,od.genel,od.n);
      a.maddeler.forEach(m=>map.set(ri+':'+(kit==='B'?'B':'A')+':'+(m.i+1),{...m,ri,no:m.i+1,kit}));
      return {kit,a,rho};
    };
    const gruplar=[];
    if(hm){const g=grup('AB',kimler,(o,k)=>kitOf(o)==='B'?hm.aToB[eb.off+k+1]-eb.off-1:k);if(g)gruplar.push(g)}
    else for(const kit of ['A','B']){const g=grup(kit,kimler.filter(o=>kitOf(o)===kit),(o,k)=>k);if(g)gruplar.push(g)}
    gruplar.forEach(g=>{g.satir=ZORLUK.bolumSatiri(b.ders+(gruplar.length>1?' · '+g.kit+' kitapçığı':''),g.a,g.rho)});
    bolumler.push({ri,ad:b.ad,ders:b.ders,oturum:ses,gruplar});
  });
  return {map,bolumler};
}
/* Read the existing Konu Takibi madde analysis; A-booklet question numbers are the join key.
   Never infer an individual answer from aggregate kazanım counts, nor a difficulty from missing data. */
const level=p=>p>=.75?'kolay':p<.25?'zor':'orta';
function courseKey(s){
  const k=key(clean(s).replace(/-[TA]$/iu,'').replace(/\b(?:TYT|AYT)\b/giu,''));
  const aliases={TUR:'TURKCE',TURK:'TURKCE',TEMELMATEMATIK:'MATEMATIK',COG:'COGRAFYA',TAR:'TARIH',FIZ:'FIZIK',KIM:'KIMYA',BIO:'BIYOLOJI',DIN:'DINKULTURU',DINKULTURUVEAHLAKBILGISI:'DINKULTURU',SFELSEFE:'EKFELSEFE',SOSYALFELSEFE:'EKFELSEFE',TURKDILIVEEDEBIYATI:'EDEBIYAT',TURKDILIVEEDB:'EDEBIYAT',FELSEFEGR:'FELSEFE',FELSEFEGRUBU:'FELSEFE'};
  return aliases[k]||k;
}
function difficultyIndex(rapor,es,source){
  const map=new Map(),issues=[];
  if(!source?.madde)return {map,issues:['Konu Takibi’nde bu sınavın Madde Analizi bulunamadı.']};
  if(!rapor.ad||key(rapor.ad)!==key(source.ad))return {map,issues:['Madde Analizi ile cevap raporunun sınav adları eşleşmiyor.']};
  const named=['TYT','AYT'].filter(s=>new RegExp('\\b'+s+'\\b','iu').test(rapor.ad)),session=named.length===1?named[0]:null;
  const sessions=new Set(String(source.oturum||'').split('+').map(s=>s.trim())),suffix=c=>/-T$/u.test(c)?'TYT':/-A$/u.test(c)?'AYT':null;
  if(session&&!sessions.has(session))return {map,issues:['Madde Analizi ile cevap raporunun oturumları eşleşmiyor.']};
  const sole=sessions.size===1?[...sessions][0]:null;
  const entries=Object.entries(source.madde).map(([c,q])=>({c,k:courseKey(c),session:suffix(c)||sole,q}));
  const valid=e=>Array.isArray(e.q)&&e.q.every(q=>Array.isArray(q)&&typeof q[0]==='number'&&Number.isFinite(q[0])&&q[0]>=0&&q[0]<=1)&&(!source.ozet?.[e.c]||source.ozet[e.c].length===e.q.length);
  for(const [test,N] of es.testler.entries()){
    const bs=es.bolumler.filter(b=>b.test===test),ks=bs.map(b=>courseKey(b.ders));
    const group=ks.every(k=>['MATEMATIK','GEOMETRI'].includes(k))?'MATEMATIK':ks.every(k=>['FIZIK','KIMYA','BIYOLOJI'].includes(k))?'FEN':ks.every(k=>['TARIH','COGRAFYA','FELSEFE','DINKULTURU','EKFELSEFE'].includes(k))?'SOSYAL':null;
    const groupAliases={MATEMATIK:['MATEMATIK','MATEMATIKGEOMETRI'],FEN:['FEN','FENBILIMLERI'],SOSYAL:['SOSYAL','SOSYALBILIMLER','SOSYALBILIMLERI']};
    for(const b of bs){
      const bsess=suffix(b.ad)||session||sole;
      if(!bsess||!sessions.has(bsess)||(session&&session!==bsess)){issues.push(b.ders+': oturum eşleşmedi.');continue}
      const compatible=entries.filter(e=>e.session===bsess);
      const full=group?compatible.filter(e=>groupAliases[group].includes(e.k)&&valid(e)&&e.q.length===N):[];
      const direct=compatible.filter(e=>e.k===courseKey(b.ders)&&valid(e)&&e.q.length===b.n);
      const candidates=direct.length?direct:full;
      if(candidates.length!==1){issues.push(b.ders+': soru numaraları veya soru sayısı eşleşmedi.');continue}
      const e=candidates[0],whole=!direct.length;
      for(let n=0;n<b.n;n++){const p=e.q[whole?b.off+n:n][0];map.set(test+':'+(b.off+n+1),{p,level:level(p)})}
    }
  }
  return {map,issues:[...new Set(issues)]};
}
// What is kept for one student: the status, the selected difficulty chips (bantlar: a Set of band keys, null = all five) and Kendi seviyesi
// (options.kendi(ogr, bolum) -> the band keys of the student's window in that ders). index.map holds the section analysis; a question without a label is kept only while all five bands are selected.
// With Kendi seviyesi the included bands of a ders = the selected chips ∪ the student's window for that ders.
const zAnahtar=s=>(s.a!==null?(s.ai??s.i)+':A:'+(s.ak+1):s.i+':B:'+(s.k+1));
const BANT_ANAHTAR=()=>ZORLUK.BANTLAR.map(x=>x[0]);
function filterDefter(d,options={},index={map:new Map()}){
  let yanlis=0,bos=0,unknown=0;
  const tum=!options.bantlar||BANT_ANAHTAR().every(k=>options.bantlar.has(k));
  // Kendi seviyesi lists the kept questions easiest first (Rasch b ascending; an extreme item without b sits at its end of the scale).
  const kolaylik=s=>s.z&&Number.isFinite(s.z.rel)?s.z.rel:(s.z&&s.z.bant==="cok-kolay"?-1e9:s.z&&s.z.bant==='cok-zor'?1e9:0);
  const bolumler=d.bolumler.map(b=>{
   const pencere=options.kendi?new Set(options.kendi(d.ogr,b)||[]):null;
   return {...b,sorular:b.sorular.flatMap(s=>{
    if(options.status&&options.status!=='all'&&s.durum!==options.status)return [];
    const z=index.map.get(zAnahtar(s))||null;
    if(!z||!z.bant)unknown++;
    if(!tum&&!(z&&z.bant&&(options.bantlar.has(z.bant)||(pencere&&pencere.has(z.bant)))))return [];
    if(s.durum==='yanlis')yanlis++;else bos++;
    return [{...s,z}];
  }).map((s,i)=>[s,i]).sort((x,y)=>options.kendi?kolaylik(x[0])-kolaylik(y[0])||x[1]-y[1]:0).map(x=>x[0])}}).filter(b=>b.sorular.length);
  // The printed header never names Kendi seviyesi or the tiers: with it on, the band names are left out too (the set is a union the student need not see).
  const adlar=tum||options.kendi?[]:ZORLUK.BANTLAR.filter(([k])=>options.bantlar.has(k)).map(x=>x[1]);
  return {...d,bolumler,yanlis,bos,unknown,gorsel:bolumler.every(b=>b.gorsel),
    filtreli:!tum||!!options.kendi||(!!options.status&&options.status!=='all'),
    filterText:[...adlar,options.status==='bos'?'Yalnızca boş':options.status==='yanlis'?'Yalnızca yanlış':null].filter(Boolean).join(' · ')};
}
/* ---------------------------------------------------------------- Deneme kütüphanesi: many exams, kept on this device
   Every exam is one entry keyed by its code ("1203"): the booklets' header code, the cevap raporu's exam name, the Ders ortalamaları title ("27-YKS-1203").
   Files of any kind are recognised by their content and grouped into their exam. The library (DENEME_KUTUPHANE, IndexedDB on this device, per teacher)
   keeps the PDFs as bytes and the parsed models; this page only holds the models and opens a booklet when a picture has to be cut. */
const OLCEK=2,BOSLUK=8,ONIZLEME=3000,PDF_SAYFA_SINIR=400;   // ONIZLEME: pictures the screen preview holds; print and PDF always take every student
const S={denemeler:new Map(),genel:[],kut:null,kutUid:undefined,kutYuklendi:false,kutHazir:Promise.resolve(),boyut:null,sube:'',ogr:'',status:'all',oturum:'TYT+AYT',alan:'ogr',bantlar:null,kendi:false,kapali:new Set(),
  jeton:0,hazir:Promise.resolve(),ilerleme:'',is:'',mesgul:'',kilit:'',liste:[],onizleme:ONIZLEME,pdfOneri:null,pdfSinir:PDF_SAYFA_SINIR,gorunum:'ogrenci',ogretmen:'',secim:'z',fark:null};
const h=s=>kacis(String(s??''));
const rehber=()=>typeof rehberMi==='function'&&rehberMi();
const etkin=()=>EK.sekme==='yanlislar'&&rehber()&&!!document.getElementById('ydKok');
const tick=()=>new Promise(r=>setTimeout(r,0));
const raporKodu=r=>r.sinavNo||key(r.ad)||'0';
// The exam a file belongs to: the same key, else the one exam whose identity matches (a named exam's files spell it differently); oturum narrows it to the
// exam whose report has that session.
function denemeBul(kod,oturum){
  if(!kod)return null;
  if(S.denemeler.has(kod))return S.denemeler.get(kod);
  const a=sinavAnahtari(kod);if(!a)return null;
  const l=[...S.denemeler.values()].filter(e=>sinavAnahtari(e.kod)===a||(e.rapor&&sinavAnahtari(raporSinavi(e.rapor))===a));
  const o=oturum?l.filter(e=>!e.rapor||(e.rapor.oturumlar||[]).includes(oturum)):l;
  return o.length===1?o[0]:l.length===1?l[0]:null;
}
const dosyaOturumu=dersler=>{const s=new Set(dersler.map(d=>/-A$/u.test(clean(d.ad))?'AYT':/-T$/u.test(clean(d.ad))?'TYT':'').filter(Boolean));return s.size===1?[...s][0]:null};
const adOf=e=>e.ad||('Deneme '+e.kod);
const tarihYaz=t=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(t||'');return m?m[3]+'.'+m[2]+'.'+m[1]:''};
const boyutYaz=b=>{const f=(v,k)=>(v>=10?String(Math.round(v)):v.toFixed(1).replace('.',','))+' '+k;return b<1048576?Math.max(1,Math.round(b/1024))+' KB':b<1073741824?f(b/1048576,'MB'):f(b/1073741824,'GB')};
function yeniDeneme(kod){
  return {kod,ad:'',tarih:'',kitlar:{},kitDurum:{},rapor:null,es:null,pairs:{},cozum:{},cozDurum:{},harita:null,ort:null,perf:null,durum:{rapor:'',coz:'',ort:'',perf:''},zOnbellek:null,crops:new Map(),sec:true,hatalar:[],
    bekleyen:{},silinecek:new Set(),boyut:{},kalici:null,kota:false};
}
const hataKod=(kod,m)=>Object.assign(new Error(m),{kod});
function resimleriBirak(e){for(const c of e.crops.values())try{URL.revokeObjectURL(c.url)}catch(x){}e.crops=new Map()}
function kitapBirak(kit){if(kit?.pdf){try{kit.pdf.destroy()}catch(x){}kit.pdf=null}}
// Release the canvases of an exam's booklets (and the open pdf.js documents) once its pictures are cut.
function kitKapat(e){
  for(const kit of Object.values(e.kitlar)){
    kitapBirak(kit);
    for(const v of kit.onbellek?.values()||[])try{v.cv.width=v.cv.height=0}catch(x){}
    kit.onbellek?.clear();
  }
}
const kitVar=e=>Object.keys(e.kitlar).length>0;
const adet=kit=>kit.testler.reduce((a,t)=>a+t.soru,0);
const cozDurumYaz=e=>{e.durum.coz=Object.keys(e.cozum).sort((a,b)=>(a==='AYT')-(b==='AYT')).map(ses=>e.cozDurum[ses]).join('\n')};
const siraliDenemeler=()=>[...S.denemeler.values()].sort((a,b)=>(a.tarih&&b.tarih&&a.tarih!==b.tarih?(a.tarih<b.tarih?-1:1):0)||a.kod.localeCompare(b.kod,'tr',{numeric:true}));
// Selected exams that have a report and a booklet; kullanilan: with an Oturum choice, only those that have that session.
const hazirlar=()=>siraliDenemeler().filter(e=>e.sec&&e.rapor&&e.es);
const kullanilan=()=>hazirlar().filter(e=>S.oturum==='TYT+AYT'||e.es.oturumlar.includes(S.oturum));
// The booklet of a (merged) test number of an exam: its session's kit and the test's number inside that kit.
function testBul(e,t){for(const [ses,[a,b]] of Object.entries(e.es.aralik))if(t>=a&&t<b)return {kit:e.kitlar[ses],t:t-a,ses};return null}
// The çözüm maps of the sessions as one table indexed by the merged test number (null where a session has none).
function haritaBirlestir(e){
  const ks=Object.keys(e.cozum);
  if(!ks.length||!e.es){e.harita=null;return}
  const testler=Array(e.es.testler.length).fill(null);let n=0;
  for(const ses of ks){const [a]=e.es.aralik[ses];e.cozum[ses].testler.forEach((t,i)=>{testler[a+i]=t});n+=e.cozum[ses].adet}
  e.harita={testler,adet:n};
}
// Files that no longer fit the others are dropped (with the reason in the exam row).
function yenidenDogrula(e){
  if(e.ort){try{ortalamaDogrula(e.ort,e.rapor)}catch(x){e.hatalar.push({dosya:'',mesaj:x.message});e.ort=null;e.durum.ort='';e.zOnbellek=null}}
  if(e.perf){try{performansDogrula(e.perf,e.rapor)}catch(x){e.hatalar.push({dosya:'',mesaj:x.message});e.perf=null;e.durum.perf='';e.zOnbellek=null}}
  for(const ses of Object.keys(e.pairs)){
    try{if(!e.es||!e.es.aralik[ses])throw new Error('');e.cozum[ses]=haritaKur(e.pairs[ses],esOturum(e.es,ses),e.rapor);e.cozDurum[ses]='✓ '+ses+' · '+e.cozum[ses].adet+' soru eşleşmesi'}
    catch(x){if(x.message)e.hatalar.push({dosya:'',mesaj:x.message});delete e.pairs[ses];delete e.cozum[ses];delete e.cozDurum[ses];delete e.bekleyen['coz-'+ses];delete e.boyut['coz-'+ses];e.silinecek.add('coz-'+ses)}
  }
  haritaBirlestir(e);cozDurumYaz(e);
}
/* The four kinds of file, applied to the library. Each throws a Turkish message (with .kod = the exam it concerns, when known) and then changes nothing. */
function raporEkle(it){
  const rapor=it.rapor,var_=S.denemeler.get(raporKodu(rapor))||denemeBul(raporSinavi(rapor),rapor.oturumlar?.length===1?rapor.oturumlar[0]:null),kod=var_?var_.kod:raporKodu(rapor),e=var_||yeniDeneme(kod);
  let es=null;if(kitVar(e)){try{es=esle(rapor,e.kitlar)}catch(x){throw hataKod(var_?kod:null,x.message+' Cevap raporu eklenmedi.')}}
  e.rapor=rapor;e.es=es;e.ad=rapor.ad||e.ad;e.tarih=rapor.tarih||e.tarih;e.zOnbellek=null;
  e.durum.rapor='✓ '+rapor.ogrenciler.length+' öğrenci'+(rapor.ad?' · '+rapor.ad:'')+(rapor.oturumlar.length>1?' · '+rapor.oturumlar.join(' + '):'');
  yenidenDogrula(e);S.denemeler.set(kod,e);return e;
}
function kitapEkle(it){
  const kit=it.kit,bulunan=kit.sinav?denemeBul(kit.sinav,kit.oturum):(S.denemeler.size===1?[...S.denemeler.values()][0]:null);
  const kod=bulunan?bulunan.kod:kit.sinav?(sayisalSinav(kit.sinav)?sinavAnahtari(kit.sinav):kit.sinav):'0',var_=bulunan||S.denemeler.get(kod),e=var_||yeniDeneme(kod);
  const ses=kit.oturum||(e.rapor?.oturumlar.length===1?e.rapor.oturumlar[0]:'TYT');kit.oturum=ses;
  const kitlar={...e.kitlar,[ses]:kit};
  let es=null;if(e.rapor){try{es=esle(e.rapor,kitlar)}catch(x){throw hataKod(var_?kod:null,x.message+' Soru kitapçığı eklenmedi.')}}
  kitapBirak(e.kitlar[ses]);resimleriBirak(e);
  e.kitlar=kitlar;e.es=es;e.kitDurum[ses]='✓ '+ses+' · '+kit.sayfa+' sayfa · '+adet(kit)+' soru';
  if(it.blob){e.bekleyen['kit-'+ses]=it.blob;e.boyut['kit-'+ses]=it.blob.size}
  delete kit.blob;
  yenidenDogrula(e);S.denemeler.set(kod,e);return e;
}
function ortEkle(it){
  const ort=it.ort;let e=denemeBul(sinavAnahtari(ort.kod),dosyaOturumu(ort.dersler))||denemeBul(ort.kod,dosyaOturumu(ort.dersler));
  // an exam the library does not know: with exactly one report in the library the usual "Sınav kodları uyuşmuyor" message is given in its row
  if(!e){const tek=[...S.denemeler.values()].filter(x=>x.rapor);if(tek.length===1)e=tek[0]}
  if(!e||!e.rapor)throw hataKod(null,'Bu ders ortalamaları dosyası '+ort.kod+' sınavına ait; bu sınavın cevap raporu yüklü değil. Ders ortalamaları dosyası eklenmedi.');
  try{ortalamaDogrula(ort,e.rapor)}catch(x){throw hataKod(e.kod,x.message)}
  e.ort=ort;e.zOnbellek=null;e.durum.ort='✓ '+ort.dersler.length+' ders · genel ortalama';return e;
}
function perfEkle(it){
  const perf=it.perf;let e=denemeBul(sinavAnahtari(perf.kod),dosyaOturumu(perf.dersler))||denemeBul(perf.kod,dosyaOturumu(perf.dersler));
  if(!e){const tek=[...S.denemeler.values()].filter(x=>x.rapor);if(tek.length===1)e=tek[0]}
  if(!e||!e.rapor)throw hataKod(null,'Bu performans analizi dosyası '+perf.kod+' sınavına ait; bu sınavın cevap raporu yüklü değil. Performans analizi dosyası eklenmedi.');
  let v;try{v=performansDogrula(perf,e.rapor)}catch(x){throw hataKod(e.kod,x.message)}
  e.perf=perf;e.zOnbellek=null;e.durum.perf='✓ '+perf.dersler.length+' ders · Türkiye geneli p'+(v.farkli?' · '+v.farkli+' soruda anahtardan farklı':'');return e;
}
function cozumEkle(it){
  const pairs=it.pairs,hazir=[...S.denemeler.values()].filter(e=>e.rapor&&e.es);
  if(!hazir.length)throw hataKod(null,'Önce soru kitapçığını ve cevap raporunu yükleyin.');
  // The file belongs to the exam and session whose question count it matches and whose answer keys it fits (keyA[a] = keyB[b] for every pair).
  const bulunan=[];let ilk=null,sayiUyan=0;
  for(const e of hazir){
    const adaylar=e.es.oturumlar.filter(ses=>esOturum(e.es,ses).testler.reduce((a,b)=>a+b,0)===pairs.length);
    sayiUyan+=adaylar.length;
    for(const ses of adaylar.length||hazir.length>1?adaylar:e.es.oturumlar.slice(0,1)){
      try{bulunan.push({e,ses,harita:haritaKur(pairs,esOturum(e.es,ses),e.rapor)})}catch(x){ilk=ilk||{e,x}}
    }
  }
  let secilen=bulunan.length===1?bulunan[0]:null;
  if(bulunan.length>1){
    const ipucu=bulunan.filter(b=>b.e.kod===it.kodIpucu);
    if(ipucu.length===1)secilen=ipucu[0];
    else throw hataKod(null,'Bu çözüm kitapçığı birden fazla denemeye uyuyor ('+[...new Set(bulunan.map(b=>adOf(b.e)))].join(', ')+'); hangisine ait olduğu anlaşılamadı. Çözüm kitapçığı eklenmedi.');
  }
  if(!secilen){
    if(!ilk)throw hataKod(null,'Çözüm kitapçığında '+pairs.length+' soru eşleşmesi var; bu sayıda sorusu olan bir oturum yok. Çözüm kitapçığı eklenmedi.');
    throw hataKod(hazir.length===1?ilk.e.kod:null,(hazir.length>1?adOf(ilk.e)+': ':'')+ilk.x.message);
  }
  const {e,ses,harita}=secilen;
  e.pairs[ses]=pairs;e.cozum[ses]=harita;e.cozDurum[ses]='✓ '+ses+' · '+harita.adet+' soru eşleşmesi';
  if(it.blob){e.bekleyen['coz-'+ses]=it.blob;e.boyut['coz-'+ses]=it.blob.size;e.silinecek.delete('coz-'+ses)}
  haritaBirlestir(e);cozDurumYaz(e);return e;
}
const UYGULA={rapor:raporEkle,kit:kitapEkle,coz:cozumEkle,ort:ortEkle,perf:perfEkle};
// Dependency order inside one batch: reports and booklets first, then çözüm and ortalamalar, whatever order the files were chosen in.
function topluUygula(items){
  const sira={rapor:0,kit:1,coz:2,ort:3,perf:3},dokunulan=new Set();
  for(const it of items.map((x,i)=>[x,i]).sort((a,b)=>sira[a[0].tur]-sira[b[0].tur]||a[1]-b[1]).map(x=>x[0])){
    try{dokunulan.add(UYGULA[it.tur](it))}
    catch(x){const e=x.kod&&S.denemeler.get(x.kod);(e?e.hatalar:S.genel).push({dosya:it.ad||'',mesaj:x.message})}
  }
  return dokunulan;
}

/* ---------------------------------------------------------------- Reading one file: PDF or .xlsx, recognised by its content */
// pdf.js text per page with its size. The document is closed by the caller; the bytes come back as a Blob for the library.
async function pdfOku(file){
  if(file.size>60*1024*1024)throw new Error('PDF en fazla 60 MB olabilir.');
  const pdfjs=await denemePdfjs(),ab=await file.arrayBuffer(),task=pdfjs.getDocument({data:new Uint8Array(ab.slice(0)),isEvalSupported:false,useSystemFonts:true});
  try{
    const pdf=await task.promise;if(pdf.numPages>200)throw new Error('PDF en fazla 200 sayfa olabilir.');
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),v=page.view,t=await page.getTextContent();
      pages.push({w:vp.width,h:vp.height,ox:v[0],oy:v[1],items:t.items.filter(x=>x.str?.trim()).map(x=>({s:x.str.trim(),x:x.transform[4]-v[0],y:x.transform[5]-v[1],w:x.width,h:x.height}))});
      page.cleanup();
    }
    return {pages,pdf,blob:new Blob([ab],{type:'application/pdf'})};
  }catch(e){try{await task.destroy()}catch(x){}throw e}
}
function pdfTuru(pages){
  const hepsi=pages.flatMap(p=>p.items.map(i=>clean(i.s)));
  if(hepsi.some(s=>ORT_BASLIK.test(s)))return 'ort';
  if(performansMi(pages))return 'perf';
  if(hepsi.some(s=>ETIKET.test(s))||pages.some(p=>etiketler(p).length))return 'coz';
  if(pages.some(p=>p.items.some(i=>(KOD.test(clean(i.s))||KOD_BAS.test(clean(i.s)))&&i.y>p.h-70)))return 'kit';
  return null;
}
// A çözüm title can carry the exam number ("1203 TYT ÇÖZÜMLERİ"); only a hint for choosing between exams that fit equally.
function cozumKodu(pages){
  for(const p of pages.slice(0,3))for(const i of p.items){const m=/(?:^|\s)(\d{3,5})\s+(?:TYT\s+|AYT\s+)?[ÇC][ÖO]Z[ÜU]M/iu.exec(clean(i.s));if(m)return m[1]}
  return '';
}
async function dosyaTani(file){
  const ad=file.name||'dosya',bas=String.fromCharCode(...new Uint8Array(await file.slice(0,4).arrayBuffer()));
  if(bas.startsWith('PK')||(/\.xls[xm]$/iu.test(ad)&&!bas.startsWith('%PDF'))){
    if(file.size>15*1024*1024)throw new Error('Excel dosyası en fazla 15 MB olabilir.');
    return {tur:'rapor',ad,rapor:await raporCoz(new Uint8Array(await file.arrayBuffer()))};
  }
  if(!bas.startsWith('%PDF')&&!/\.pdf$/iu.test(ad))throw new Error('Bu dosya tanınmadı; PDF (kitapçık, çözüm, ders ortalamaları) veya .xlsx (cevap raporu) olmalı.');
  const {pages,pdf,blob}=await pdfOku(file);
  try{
    const tur=pdfTuru(pages);
    if(tur==='kit'){const kit=kitapcikCoz(pages);kit.sayfa=pages.length;kit.ofset=pages.map(p=>[p.ox,p.oy]);kit.onbellek=new Map();kit.pdf=null;return {tur,ad,kit,blob}}
    if(tur==='coz')return {tur,ad,pairs:cozumEtiketleri(pages),kodIpucu:cozumKodu(pages),blob};
    if(tur==='ort')return {tur,ad,ort:ortalamaCoz(pages)};
    if(tur==='perf')return {tur,ad,perf:performansCoz(pages)};
    throw new Error('Bu PDF tanınmadı: soru kitapçığı, çözüm kitapçığı veya ders ortalamaları dosyasına benzemiyor.');
  }finally{try{await pdf.destroy()}catch(x){}}
}

/* ---------------------------------------------------------------- The library on this device */
function kutUid(){
  try{const u=window.bulut?.mevcutKullanici?.();if(u&&!u.isAnonymous&&u.uid)return String(u.uid)}catch(x){}
  return (typeof D!=='undefined'&&D?.testHesap?.uid)?String(D.testHesap.uid):null;
}
const kitSerile=kit=>JSON.parse(JSON.stringify(kit,(k,v)=>k==='pdf'||k==='onbellek'||k==='blob'?undefined:typeof v==='number'&&!Number.isInteger(v)?Math.round(v*100)/100:v));
const metaOf=e=>({v:1,kod:e.kod,ad:e.ad,tarih:e.tarih,kaydedildi:new Date().toISOString(),rapor:e.rapor,ort:e.ort,perf:e.perf,pairs:e.pairs,kitlar:Object.fromEntries(Object.entries(e.kitlar).map(([s,k])=>[s,kitSerile(k)])),boyut:{...e.boyut}});
function geriYukle(m){
  try{
    const e=yeniDeneme(String(m.kod));e.ad=m.ad||'';e.tarih=m.tarih||'';e.rapor=m.rapor||null;e.ort=m.ort||null;e.perf=m.perf||null;e.pairs=m.pairs||{};e.boyut=m.boyut||{};e.kalici=true;
    for(const [ses,k] of Object.entries(m.kitlar||{})){k.onbellek=new Map();k.pdf=null;k.oturum=k.oturum||ses;e.kitlar[ses]=k;e.kitDurum[ses]='✓ '+ses+' · '+k.sayfa+' sayfa · '+adet(k)+' soru'}
    if(e.rapor){
      if(kitVar(e))e.es=esle(e.rapor,e.kitlar);
      e.durum.rapor='✓ '+e.rapor.ogrenciler.length+' öğrenci'+(e.rapor.ad?' · '+e.rapor.ad:'')+(e.rapor.oturumlar.length>1?' · '+e.rapor.oturumlar.join(' + '):'');
    }
    yenidenDogrula(e);e.hatalar=[];e.silinecek=new Set();
    return e;
  }catch(x){return null}
}
// Opens the library of the signed-in teacher (once per account) and fills the page with the exams kept on this device.
function kutAc(){
  const uid=kutUid();
  if(S.kut&&S.kutUid===uid)return S.kutHazir;
  if(S.kut)S.kut.kapat();
  for(const e of S.denemeler.values())resimleriBirak(e);
  S.denemeler=new Map();S.genel=[];S.boyut=null;S.kutYuklendi=false;S.kutUid=uid;
  const kut=S.kut=DENEME_KUTUPHANE.olustur({uid});
  S.kutHazir=(async()=>{
    const metalar=await kut.yukle();
    if(S.kut!==kut)return;
    for(const m of metalar){const e=geriYukle(m);if(e)S.denemeler.set(e.kod,e);else S.genel.push({dosya:'',mesaj:'Cihazda kayıtlı bir deneme okunamadı ve atlandı.'})}
    S.kutYuklendi=true;await boyutYenile();render();
  })().catch(x=>{S.kutYuklendi=true;S.genel.push({dosya:'',mesaj:'Kütüphane açılamadı: '+(x.message||x)});render()});
  return S.kutHazir;
}
async function boyutYenile(){
  if(!S.kut)return;
  S.boyut=await S.kut.boyut([...S.denemeler.values()]);
}
// Write what changed in an exam. A refused write (no storage, quota) keeps the exam in memory; the page says so.
async function sakla(e){
  if(!S.kut)return;
  const r=await S.kut.kaydet(e.kod,metaOf(e),e.bekleyen,[...e.silinecek]);
  e.kalici=r.kalici;e.kota=!!r.kota;e.saklamaHata=r.hata||'';
  if(!['tc','pdf','slot'].includes(r.hata)){e.bekleyen={};e.silinecek=new Set()}
}
async function bayt(e,slot){
  if(e.bekleyen[slot]){const b=e.bekleyen[slot];return b.arrayBuffer?b.arrayBuffer():b}
  return S.kut?S.kut.dosya(e.kod,slot):null;
}
async function kitAc(e,ses){
  const kit=e.kitlar[ses];if(kit.pdf)return kit;
  const ab=await bayt(e,'kit-'+ses);if(!ab)throw new Error('Kitapçık dosyası cihazda bulunamadı; yeniden ekleyin.');
  const pdfjs=await denemePdfjs();
  kit.pdf=await pdfjs.getDocument({data:new Uint8Array(ab.slice(0)),isEvalSupported:false,useSystemFonts:true}).promise;
  return kit;
}
async function denemeSil(kod){
  const e=S.denemeler.get(kod);if(!e)return;
  S.is='';
  try{if(S.kut)await S.kut.sil(kod)}catch(x){S.genel.push({dosya:'',mesaj:'Silinemedi: '+(x.message||x)});render();return}
  resimleriBirak(e);kitKapat(e);S.denemeler.delete(kod);S.pdfOneri=null;await boyutYenile();render();
}
async function hepsiniSil(){
  try{if(S.kut)await S.kut.hepsiniSil()}catch(x){S.genel.push({dosya:'',mesaj:'Silinemedi: '+(x.message||x)});render();return}
  for(const e of S.denemeler.values()){resimleriBirak(e);kitKapat(e)}
  S.denemeler=new Map();S.genel=[];S.pdfOneri=null;S.sube='';S.ogr='';await boyutYenile();render();
}
// The browser is asked to keep the files on this device (called with the first save, once). Logout / reset empties the whole database.
function bellekiBosalt(){
  for(const e of S.denemeler.values()){resimleriBirak(e);kitKapat(e)}
  S.denemeler=new Map();S.genel=[];S.boyut=null;S.liste=[];S.pdfOneri=null;if(S.kut)S.kut.kapat();S.kut=null;S.kutUid=undefined;S.kutYuklendi=false;
}
function sifirla(){bellekiBosalt();Object.assign(S,{sube:'',ogr:'',status:'all',oturum:'TYT+AYT',alan:'ogr',bantlar:null,kendi:false,kapali:new Set(),mesgul:'',kilit:'',is:'',ilerleme:'',onizleme:ONIZLEME,pdfSinir:PDF_SAYFA_SINIR,gorunum:'ogrenci',ogretmen:'',secim:'z',fark:null})}
// Test hook: a library over a given adapter, loaded like the page does.
function kutuphaneKur(uid,adaptor){
  if(S.kut)S.kut.kapat();
  S.kutUid=uid;S.kut=DENEME_KUTUPHANE.olustur({uid,adaptor});S.denemeler=new Map();S.kutYuklendi=false;
  const kut=S.kut;
  return S.kutHazir=(async()=>{const metalar=await kut.yukle();for(const m of metalar){const e=geriYukle(m);if(e)S.denemeler.set(e.kod,e)}S.kutYuklendi=true;await boyutYenile()})();
}
// One batch of files (a file input or a drop): read one by one, then applied in dependency order, then written to the library.
async function dosyalarEkle(files,okuyucu=dosyaTani){
  files=[...files];
  if(S.mesgul||S.kilit||!files.length)return;
  S.mesgul='okuma';S.kilit='okuma';S.genel=[];S.pdfOneri=null;for(const e of S.denemeler.values())e.hatalar=[];
  const yaz=m=>{S.is=m;const el=typeof document!=='undefined'&&document.getElementById('ydIs');if(el)el.textContent=m};
  try{
    const okunan=[];
    for(let i=0;i<files.length;i++){
      yaz((i+1)+' / '+files.length+' dosya okunuyor…');await tick();
      try{okunan.push(await okuyucu(files[i]))}catch(x){S.genel.push({dosya:files[i].name||'',mesaj:x.message||String(x)})}
    }
    const dokunulan=topluUygula(okunan);
    let n=0;
    for(const e of dokunulan){yaz('Cihaza kaydediliyor… '+(++n)+' / '+dokunulan.size);await tick();try{await sakla(e)}catch(x){e.kalici=false;e.hatalar.push({dosya:'',mesaj:'Cihaza kaydedilemedi: '+(x.message||x)})}}
    await boyutYenile();
  }finally{S.mesgul='';S.kilit='';yaz('');render()}
}

const siraAd=(a,b)=>a.sube.localeCompare(b.sube,'tr',{numeric:true})||a.ad.localeCompare(b.ad,'tr');
// The school's own per-question success rates (Konu Takibi → Madde Analizi) of the same exam, only for the rank correlation in the section line.
const difficultySources=()=>Object.entries(D?.konutakibi?.zorluk||{}).filter(([,e])=>e?.madde);
function selectedDifficulty(e){const matches=difficultySources().filter(([,x])=>key(x.ad)===key(e.rapor?.ad));return matches.length===1?matches[0][1]:null}
function zorlukBilgi(e){
  if(!e.rapor)return null;
  const kaynak=e.es?selectedDifficulty(e):null,c=e.zOnbellek;
  if(c&&c.rapor===e.rapor&&c.es===e.es&&c.harita===e.harita&&c.kaynak===kaynak&&c.ort===e.ort&&c.perf===e.perf)return c.v;
  const dis=e.es&&kaynak?difficultyIndex(e.rapor,e.es,kaynak):null;
  const v=zorlukAnaliz(e.rapor,e.es,e.harita,dis&&dis.map.size?dis:null,e.ort,e.perf);e.zOnbellek={rapor:e.rapor,es:e.es,harita:e.harita,kaynak,ort:e.ort,perf:e.perf,v};return v;
}
// Kendi seviyesi: the student's tier in the ders (within the grade) picks a window of difficulty bands (ZORLUK.kademePenceresi), added to the chips; without a tier, the Orta band.
const kendiSeviyesi=e=>(ogr,b)=>{
  const kd=typeof KADEME!=='undefined'?KADEME.kodDers(e.rapor.bolumler[b.ri].ad):null,t=kd?KADEME.kademeBilgi(ogr.no,kd.oturum,kd.kod):null;
  return ZORLUK.kademePenceresi(t?t.kademe:null,t?t.H:null).map(i=>ZORLUK.BANTLAR[i][0]);
};
/* Oturum and Alan. The sessions that can be printed are those with both a sheet in the report and a booklet (es.oturumlar). A student's AYT tests outside the
   chosen alan are left out of the defter, so their blank answers are not counted as "boş". Fields are the app's own (DENEME_ALAN, report sections -> ders codes by KADEME.kodDers). */
const ALANLAR=['SAY','EA','SÖZ'];
const alanAnahtar=a=>ALANLAR.find(x=>key(x)===key(a))||null;
// The field written in the teacher notebook for a student, matched by school no (like the Kademeler); null when unknown.
function ogrAlani(no){
  const id=String(no??'').trim();if(!id||typeof D==='undefined'||!Array.isArray(D.ogr))return null;
  const o=D.ogr.find(x=>x&&!x.silindi&&String(x.no??'').trim()===id);
  return o?alanAnahtar(o.alan):null;
}
function oturumKume(es,secim){
  const hepsi=es.oturumlar||[...new Set(es.bolumler.map(b=>b.oturum||'TYT'))];
  return new Set(secim==='TYT'||secim==='AYT'?(hepsi.includes(secim)?[secim]:hepsi):hepsi);
}
const bolumKodu=b=>{const kd=typeof KADEME!=='undefined'?KADEME.kodDers(b.ad):null;return kd?kd.kod:null};
// The indices (into es.bolumler) that go into one student's defter: the chosen sessions, the ticked dersler, and for AYT the alan.
// alan: 'ogr' (Öğrencinin alanı: the tests the student is judged on, see sayilanKural: the field's tests only), 'SAY' | 'EA' | 'SÖZ' (exactly that
// field), or 'Tümü'. kural: sayilanKural(rapor, es).f, which knows the student's şube; without it (ogrAlan given or read from the notebook) the
// field's tests, an unknown field giving the tests the student answered.
function acikBolumler(es,ogr,{oturum='TYT+AYT',alan='ogr',kapali=new Set()}={},ogrAlan,kural){
  const ses=oturumKume(es,oturum),a=alan==='ogr'?(ogrAlan===undefined?ogrAlani(ogr.no):ogrAlan):alanAnahtar(alan),alanKod=a&&typeof DENEME_ALAN!=='undefined'?DENEME_ALAN[a]:null;
  const kendi=alan==='ogr'?(kural&&ogrAlan===undefined?kural(ogr):null):null;
  const testler=alan==='ogr'&&!kendi?new Set(es.bolumler.filter(b=>(b.oturum||'TYT')==='AYT'&&(alanKod?alanKod.includes(bolumKodu(b)):cevapli(ogr,b))).map(b=>b.test)):null;
  const out=new Set();
  es.bolumler.forEach((b,i)=>{
    const o=b.oturum||'TYT';
    if(kapali.has(i)||!ses.has(o))return;
    if(o==='AYT'&&alan!=='Tümü'){
      if(kendi){if(!kendi.has(i))return}
      else if(testler){if(!testler.has(b.test))return}
      else if(alanKod){const kod=bolumKodu(b);if(kod&&!alanKod.includes(kod))return}
    }
    out.add(i);
  });
  return out;
}
// The ders tick boxes are shared by name across the selected exams; an exam's closed sections are the ones with a closed name.
const kapaliIdx=e=>new Set(e.es.bolumler.map((b,i)=>S.kapali.has(b.ders)?i:-1).filter(i=>i>=0));
function dersGorunur(e,b){
  const alanKod=alanAnahtar(S.alan)&&typeof DENEME_ALAN!=='undefined'?DENEME_ALAN[alanAnahtar(S.alan)]:null;
  return oturumKume(e.es,S.oturum).has(b.oturum||'TYT')&&!((b.oturum||'TYT')==='AYT'&&alanKod&&bolumKodu(b)&&!alanKod.includes(bolumKodu(b)));
}
function dersListesi(ex){
  const gorulen=new Set(),out=[];
  for(const e of ex)for(const b of e.es.bolumler)if(!ekFelsefe(b)&&dersGorunur(e,b)&&!gorulen.has(b.ders)){gorulen.add(b.ders);out.push(b.ders)}
  return out;
}
// Students of the selected exams, joined by Öğrenci No; name and şube come from the latest exam they sat.
function kisiTemel(ex){
  const m=new Map();
  for(const e of ex){
    const ses=oturumKume(e.es,S.oturum);
    for(const o of e.rapor.ogrenciler){
      if(o.oturumlar&&!o.oturumlar.some(x=>ses.has(x)))continue;
      let k=m.get(o.no);if(!k){k={no:o.no,ad:o.ad,sube:o.sube,kayit:[]};m.set(o.no,k)}
      k.ad=o.ad||k.ad;k.sube=o.sube||k.sube;k.kayit.push({e,o});
    }
  }
  return [...m.values()].sort(siraAd);
}
// One defter per student over all selected exams: [{ogr, denemeler:[{e, d}], yanlis, bos, ...}]. An exam without a wrong or empty question for the student is left out.
function birlesik(){
  const ex=kullanilan(),ctx=new Map(ex.map(e=>[e,{za:zorlukBilgi(e),kapali:kapaliIdx(e),kendi:S.kendi?kendiSeviyesi(e):null,kural:sayilanKural(e.rapor,e.es).f}]));
  return kisiTemel(ex).filter(k=>(!S.sube||k.sube===S.sube)&&(!S.ogr||k.no===S.ogr)).map(k=>{
    const m={ogr:{id:k.no,no:k.no,ad:k.ad,sube:k.sube},denemeler:[],yanlis:0,bos:0,unknown:0,filtreli:false,filterText:''};
    for(const {e,o} of k.kayit){
      const c=ctx.get(e),d=filterDefter(defterKur(e.rapor,e.es,e.harita,o,acikBolumler(e.es,o,{oturum:S.oturum,alan:S.alan,kapali:c.kapali},undefined,c.kural)),{status:S.status,bantlar:S.bantlar,kendi:c.kendi},c.za);
      m.filtreli=d.filtreli;m.filterText=d.filterText;
      if(d.bolumler.length){m.denemeler.push({e,d});m.yanlis+=d.yanlis;m.bos+=d.bos;m.unknown+=d.unknown}
    }
    m.gorsel=m.denemeler.every(x=>x.d.gorsel);
    return m;
  });
}
const soruSayisi=m=>m.denemeler.reduce((a,x)=>a+x.d.bolumler.reduce((y,b)=>y+b.sorular.length,0),0);
// The students the screen preview shows: from the start until about S.onizleme pictures; the rest is only in the print and the PDF.
function onizleme(list){
  let n=0;const out=[];
  for(const m of list){if(out.length&&n>=S.onizleme)break;out.push(m);n+=soruSayisi(m)}
  return out;
}

/* Cropping: each page is rendered once at OLCEK and every question is copied out of it. */
async function sayfaCiz(kit,n){
  if(kit.onbellek.has(n)){const v=kit.onbellek.get(n);kit.onbellek.delete(n);kit.onbellek.set(n,v);return v}
  const page=await kit.pdf.getPage(n),vp=page.getViewport({scale:OLCEK}),cv=document.createElement('canvas');
  cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
  const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:cx,viewport:vp}).promise;page.cleanup();
  const v={cv,vp};kit.onbellek.set(n,v);
  // a page canvas is released as soon as it falls out of the small cache
  while(kit.onbellek.size>3){const k0=kit.onbellek.keys().next().value;try{kit.onbellek.get(k0).cv.width=0}catch(x){}kit.onbellek.delete(k0)}
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
  // the working canvases are released at once; only the small picture stays
  for(const c of [...parcalar,out,res])c.width=c.height=0;
  return {url:URL.createObjectURL(blob),blob,w:W,h:keep,genis:q.genis};
}
// Pictures of one exam, one exam at a time; the exam's booklets are opened for it and closed again (canvases released) when its list is done.
async function calis(my,e,liste,ilerle){
  const kitlar=e.kitlar;
  try{
    for(const [t,no] of liste){
      if(my!==S.jeton||kitlar!==e.kitlar)return false;
      const k=t+':'+no;
      if(!e.crops.has(k)){
        try{const f=testBul(e,t);await kitAc(e,f.ses);e.crops.set(k,await soruKirp(f.kit,f.t,no))}
        catch(x){e.hatalar=e.hatalar.filter(y=>y.dosya!=='kesim');e.hatalar.push({dosya:'kesim',mesaj:'Soru '+no+' kesilemedi: '+x.message});break}
      }
      ilerle();
      if(my!==S.jeton)return false;
      const c=e.crops.get(k);
      if(c)for(const img of document.querySelectorAll('img[data-yd="'+e.kod+'|'+k+'"]')){img.src=c.url;img.removeAttribute('data-bekle')}
    }
  }finally{kitKapat(e)}
  return true;
}
// tum: every student of the selection (print, PDF); otherwise only the students shown on screen.
// The pictures still to cut, per exam: the students' defter (tum: all of them, else the screen preview) or the fark soruları (always all).
function kesilecekler(tum){
  const gruplar=new Map(),ekle=(e,t,a)=>{const k=t+':'+a;if(e.crops.has(k))return;if(!gruplar.has(e))gruplar.set(e,new Map());gruplar.get(e).set(k,[t,a])};
  if(S.gorunum==='ders'){for(const g of S.fark?.geride||[])for(const d of g.denemeler)for(const s of d.sorular)ekle(d.e,s.test,s.a)}
  else for(const m of tum?S.liste:onizleme(S.liste))for(const {e,d} of m.denemeler)for(const b of d.bolumler)if(b.gorsel)for(const s of b.sorular)ekle(e,s.test,s.a);
  return gruplar;
}
function hazirla(tum){
  if(typeof document==='undefined')return S.hazir;
  if(S.kilit&&!tum)return S.hazir;
  const my=++S.jeton,gruplar=kesilecekler(tum);
  let toplam=0;for(const g of gruplar.values())toplam+=g.size;
  S.hazir=S.hazir.then(async()=>{
    let n=0;
    for(const [e,g] of gruplar){
      const sayfa=x=>{const f=testBul(e,x[0]);return f.kit.testler[f.t].sorular[x[1]-1].parcalar[0].p};
      const liste=[...g.values()].sort((x,y)=>testBul(e,x[0]).ses===testBul(e,y[0]).ses?sayfa(x)-sayfa(y)||x[0]-y[0]||x[1]-y[1]:x[0]-y[0]);
      const ok=await calis(my,e,liste,()=>{n++;S.ilerleme=n<toplam?'Sorular hazırlanıyor… '+n+'/'+toplam:'';const st=document.getElementById('ydIlerleme');if(st)st.textContent=S.ilerleme});
      if(!ok)return;
    }
    S.ilerleme='';const st=document.getElementById('ydIlerleme');if(st)st.textContent='';
  }).catch(()=>{});
  return S.hazir;
}

/* Markup */
// A small label next to the question: "Zor", or "Zor?" where the band is not certain. A question without a label shows nothing.
const zHap=z=>z&&z.bant?'<span class="yd-zorluk yd-z-'+z.bant+(z.belirsiz?' yd-belirsiz':'')+(z.dusuk?' yd-dusuk':'')+'"'+(z.dusuk?' title="Güvenilirlik düşük"':'')+'>'+h(ZORLUK.etiketYazi(z.bant,z.belirsiz))+'</span>':'';
function soruHTML(e,s,gorsel){
  const etiket='Soru '+(s.a??s.own),ek=s.b!==null&&s.a!==null?' (B kitapçığında '+s.b+')':'',hap=zHap(s.z);
  if(!gorsel)return '<li class="yd-satir"><b>Soru '+s.own+'</b>'+hap+'</li>';
  const k=s.test+':'+s.a,c=e.crops.get(k),f=testBul(e,s.test),genis=f.kit.testler[f.t].sorular[s.a-1].genis;
  return '<figure class="yd-soru'+(genis?' yd-genis':'')+'"><figcaption><span><b>'+etiket+'</b>'+ek+'</span>'+hap+'</figcaption><img alt="'+etiket+'" data-yd="'+h(e.kod)+'|'+k+'"'+(c?' src="'+c.url+'"':' data-bekle="1"')+'></figure>';
}
// The last page: the student's own answers next to the key, one small table per ders (the student's own question numbers).
const cevapTablosu=b=>'<table class="yd-cevap"><caption>'+h(b.ders)+'</caption><thead><tr><th scope="col">Soru</th><th scope="col">Senin cevabın</th><th scope="col">Doğru cevap</th></tr></thead><tbody>'+
  b.sorular.map(s=>'<tr><td>'+s.own+'</td><td>'+(s.durum==='bos'?'Boş':h(s.isaret))+'</td><td>'+h(s.dogru)+'</td></tr>').join('')+'</tbody></table>';
const oturumBaslik=(e,d,b,i)=>e.es.oturumlar.length>1&&(i===0||d.bolumler[i-1].oturum!==b.oturum)?'<h3 class="yd-oturum">'+h(b.oturum)+'</h3>':'';
// One exam inside a student's defter: the TYT block, then the AYT block, each under its session heading with its ders headings.
function denemeHTML(e,d){
  const dersler=d.bolumler.map((b,i)=>oturumBaslik(e,d,b,i)+'<section class="yd-ders"><h3>'+h(b.ders)+' <span>'+b.sorular.length+'</span></h3>'+(b.gorsel?'<div class="yd-sorular">'+b.sorular.map(s=>soruHTML(e,s,true)).join('')+'</div>':'<ul class="yd-liste">'+b.sorular.map(s=>soruHTML(e,s,false)).join('')+'</ul>')+'</section>').join('');
  const notlar=[...new Set(d.bolumler.filter(b=>!b.gorsel).map(b=>b.kit))];
  return (notlar.length?'<p class="yd-not">'+notlar.join(', ')+' kitapçığı: sorular kendi kitapçığından çözülecek</p>':'')+dersler;
}
function ogrHTML(m,ex){
  const o=m.ogr,toplam=soruSayisi(m),coklu=ex.length>1;
  const kimlik='Öğrenci No <b>'+h(o.no)+'</b> · '+h(o.sube)+(!coklu&&ex[0]?.rapor.ad?' · '+h(ex[0].rapor.ad):'');
  const sayi=(coklu&&toplam?'<b>'+m.denemeler.length+'</b> deneme · ':'')+'<b>'+m.yanlis+'</b> yanlış · <b>'+m.bos+'</b> boş';
  const ust='<header class="yd-ust"><h2>'+h(o.ad)+'</h2><p class="yd-kimlik">'+kimlik+'</p>'+(coklu&&toplam?'<p class="yd-kimlik">Denemeler: '+m.denemeler.map(x=>h(adOf(x.e))).join(' · ')+'</p>':'')+'<p class="yd-say">'+sayi+'</p>'+(m.filterText?'<p class="yd-kimlik">'+h(m.filterText)+'</p>':'')+'</header>';
  if(!toplam)return '<article class="yd-ogr yd-yok" data-yd-ogr="'+h(o.no)+'">'+ust+'<p class="yd-not">'+(m.filtreli?'Seçilen filtrelerde soru yok.':'Yanlış veya boş soru yok.')+'</p></article>';
  const govde=m.denemeler.map(({e,d})=>coklu?'<section class="yd-deneme"><h2 class="yd-deneme-baslik">'+h(adOf(e))+'</h2>'+denemeHTML(e,d)+'</section>':denemeHTML(e,d)).join('');
  const cevap='<section class="yd-anahtar"><h2>Cevaplar</h2><p class="yd-kimlik">'+h(o.ad)+' · '+kimlik+'</p><div class="yd-cevaplar">'+
    m.denemeler.map(({e,d})=>(coklu?'<h3 class="yd-deneme-baslik">'+h(adOf(e))+'</h3>':'')+d.bolumler.map((b,i)=>oturumBaslik(e,d,b,i)+cevapTablosu(b)).join('')).join('')+'</div></section>';
  return '<article class="yd-ogr" data-yd-ogr="'+h(o.no)+'">'+ust+govde+cevap+'</article>';
}
const f2=v=>ZORLUK.sayi(v);
// Madde kalitesi: on screen only (not printed). One compact table per ders and booklet group; the row of a flagged question is marked.
function analizHTML(ex){
  const bloklar=ex.map(e=>{
    const za=zorlukBilgi(e),gruplar=za.bolumler.flatMap(b=>b.gruplar.map(g=>({b,g})));
    if(!gruplar.length)return '';
    const satir=(m,capa,perf)=>'<tr'+(m.bayrak.length?' class="yd-isaretli"':'')+'><td>'+(m.i+1)+'</td>'+(m.iptal?'<td colspan="'+(4+(capa?1:0)+(perf?1:0))+'">İptal</td>':'<td>'+f2(m.p)+'</td><td>'+f2(m.rel)+'</td><td>'+f2(m.rit)+'</td>'+(capa?'<td>'+(m.bant?h(ZORLUK.etiketYazi(m.bant,m.belirsiz)):'—')+'</td>':'')+(perf?'<td>'+f2(m.pYayin)+'</td>':'')+'<td>'+h(m.bayrak.join(' · '))+'</td>')+'</tr>';
    return (ex.length>1?'<h3 class="yd-deneme-baslik">'+h(adOf(e))+'</h3>':'')+gruplar.map(({b,g})=>'<details class="yd-kalite"><summary>'+h(g.satir)+'</summary><div class="et-kaydir"><table class="et-tablo" aria-label="Madde kalitesi · '+h(b.ders)+'"><thead><tr><th scope="col">Soru</th><th scope="col">p</th><th scope="col">b</th><th scope="col">r<sub>it</sub></th>'+(g.a.capa?'<th scope="col">Genele göre</th>':'')+(g.a.perf?'<th scope="col">Türkiye p</th>':'')+'<th scope="col">İşaret</th></tr></thead><tbody>'+
      g.a.maddeler.map(m=>satir(m,!!g.a.capa,!!g.a.perf)).join('')+'</tbody></table></div></details>').join('');
  }).join('');
  return bloklar?'<section class="yd-analiz"><h2>Madde kalitesi</h2>'+bloklar+'</section>':'';
}
const chipHtml=(k,ad,secili)=>'<button type="button" class="yd-chip" data-yd-z="'+k+'" aria-pressed="'+secili+'">'+h(ad)+'</button>';

/* The exam table: one row per exam, a ✓ or ✗ per input, the refusal text of a file in its row. */
function hucre(durum,etiket,baslik,istege){
  const simge=durum===1?'✓':durum===0?'✗':'–',ad=durum===1?'var':durum===0?'eksik':'bu denemede yok';
  return '<td class="yd-h yd-h'+(durum===1?'1':durum===0?(istege?'o':'0'):'n')+'" data-label="'+h(etiket)+'" title="'+h(baslik||etiket+': '+ad)+'"><span role="img" aria-label="'+h(etiket+' '+ad)+'">'+simge+'</span></td>';
}
function satirHTML(e){
  const var1=x=>x?1:0,sesler=e.rapor?e.rapor.oturumlar:['TYT','AYT'];
  const kit=ses=>!e.rapor||sesler.includes(ses)?hucre(var1(e.kitlar[ses]),ses+' kitapçık',e.kitlar[ses]?e.kitDurum[ses]:null):hucre(null,ses+' kitapçık');
  const coz=e.rapor?hucre(var1(Object.keys(e.cozum).length),'Çözüm',Object.keys(e.cozum).length?e.durum.coz.replace(/\n/g,' · '):'Çözüm: yok (isteğe bağlı; B kitapçığı öğrencileri için)',true):hucre(0,'Çözüm',null,true);
  const ad=adOf(e),kodMetni=ad.includes(e.kod)||key(ad)===e.kod?'':' <span class="yd-kod">'+h(e.kod)+'</span>',tarih=tarihYaz(e.tarih);
  const hatalar=e.hatalar.map(x=>'<span class="yd-hata" role="alert">'+(x.dosya&&x.dosya!=='kesim'?h(x.dosya)+': ':'')+h(x.mesaj)+'</span>').join('');
  const gecici=S.kut&&S.kut.mod()==='kalici'&&e.kalici===false?' <span class="yd-rozet">Yalnız bu oturumda</span>':'';
  return '<tr class="yd-satir-d" data-yd-satir="'+h(e.kod)+'"><td class="yd-sec-h"><input type="checkbox" data-yd-sec="'+h(e.kod)+'"'+(e.sec?' checked':'')+' aria-label="Seç: '+h(ad)+'"></td>'+
    '<th scope="row" class="yd-ad"><b>'+h(ad)+'</b>'+kodMetni+(tarih?' <span class="yd-tarih">'+tarih+'</span>':'')+gecici+hatalar+'</th>'+
    kit('TYT')+kit('AYT')+hucre(var1(e.rapor),'Cevap raporu',e.rapor?e.durum.rapor:null)+coz+hucre(e.rapor?var1(e.ort):0,'Ders ort.',e.ort?e.durum.ort:'Ders ortalamaları: yok (isteğe bağlı)',true)+hucre(e.rapor?var1(e.perf):0,'Performans analizi',e.perf?e.durum.perf:'Performans analizi: yok (isteğe bağlı)',true)+
    '<td class="yd-sil-h"><button type="button" class="et-dugme" data-yd-sil="'+h(e.kod)+'" aria-label="Sil: '+h(ad)+'">Sil</button></td></tr>';
}
function tabloHTML(){
  const liste=siraliDenemeler();
  if(!liste.length)return '<p class="yd-bos">Henüz deneme yok. “Dosya ekle” ile soru kitapçığını ve cevap raporunu seçin.</p>';
  const hepsi=liste.every(e=>e.sec);
  return '<div class="et-kaydir yd-tablo-kap"><table class="et-tablo yd-tablo"><caption class="yd-gizli">Yüklenen denemeler</caption><thead><tr><th scope="col"><input type="checkbox" data-yd-sec-hepsi aria-label="Tüm denemeleri seç"'+(hepsi?' checked':'')+'></th><th scope="col">Deneme</th><th scope="col">TYT kitapçık</th><th scope="col">AYT kitapçık</th><th scope="col">Cevap raporu</th><th scope="col" title="İsteğe bağlı; B kitapçığı öğrencileri için">Çözüm</th><th scope="col" title="İsteğe bağlı">Ders ort.</th><th scope="col" title="İsteğe bağlı; yayınevinin soru güçlüğü (Türkiye geneli)">Performans analizi</th><th scope="col"><span class="yd-gizli">Sil</span></th></tr></thead><tbody>'+liste.map(satirHTML).join('')+'</tbody></table></div>';
}
function kutBilgiHTML(){
  if(!S.kutYuklendi)return '<p class="yd-kut" role="status">Kütüphane açılıyor…</p>';
  const gecici=!S.kut||S.kut.mod()!=='kalici',n=S.denemeler.size;
  const bayt=S.boyut&&S.boyut.bayt?S.boyut.bayt:0;
  const ana=(gecici?'Bu oturumda tutulur':'Bu cihazda saklanır')+', sunucuya gönderilmez · '+n+' deneme'+(n&&bayt?' · '+boyutYaz(bayt):'');
  const uyari=[];
  if(gecici)uyari.push(S.kut&&S.kut.neden()==='hesap'?'Hesap bilgisi alınamadığı için dosyalar saklanmıyor; sayfa kapanınca yeniden yüklemeniz gerekir.':'Bu tarayıcı dosyaları saklamaya izin vermiyor; sayfa kapanınca yeniden yüklemeniz gerekir.');
  else for(const e of S.denemeler.values())if(e.kalici===false)uyari.push(e.kota?adOf(e)+' cihaza sığmadı; bu oturumda bellekte tutuluyor. Yer açmak için eski denemeleri silin.':adOf(e)+' cihaza kaydedilemedi; bu oturumda bellekte tutuluyor.');
  return '<div class="yd-kut"><p class="yd-kut-ana" role="status">'+h(ana)+'</p>'+uyari.map(u=>'<p class="yd-uyari" role="status">'+h(u)+'</p>').join('')+'</div>';
}
function content(){
  const kapali=S.mesgul||S.kilit||!S.kutYuklendi;
  const ust='<div class="yd-bas et-bas"><h1 class="et-baslik">Yanlışlar defteri</h1></div>';
  const yukle='<div class="yd-yukle"><div class="yd-yukle-dugmeler"><label class="et-dugme'+(S.denemeler.size?'':' birincil')+'">Dosya ekle<input id="ydDosya" type="file" multiple accept="application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="yd-file"'+(kapali?' disabled':'')+'></label>'+
    (S.denemeler.size?'<button type="button" class="et-dugme" data-yd-hepsini-sil'+(kapali?' disabled':'')+'>Tümünü bu cihazdan sil</button>':'')+'<span id="ydIs" class="yd-ozet" role="status" aria-live="polite">'+h(S.is)+'</span></div>'+
    '<p class="yd-yardim">Soru kitapçığı (PDF), cevap raporu (.xlsx), çözüm kitapçığı, ders ortalamaları ve performans analizi (PDF) dosyalarını birlikte seçebilir ya da bu alana sürükleyebilirsiniz. Hangi denemeye ait olduğu dosyadan anlaşılır.</p></div>';
  const genel=S.genel.length?'<ul class="yd-hatalar" role="alert">'+S.genel.map(x=>'<li class="yd-hata">'+(x.dosya?h(x.dosya)+': ':'')+h(x.mesaj)+'</li>').join('')+'</ul>':'';
  const top=ust+kutBilgiHTML()+yukle+genel+tabloHTML();
  const ex=hazirlar(),exU=kullanilan();
  if(!ex.length){S.liste=[];S.fark=null;return top}
  const opt=(v,t,sec)=>'<option value="'+h(v)+'"'+(sec?' selected':'')+'>'+h(t)+'</option>';
  const sel=(label,f,opts)=>'<label class="yd-sec">'+label+'<select data-yd-f="'+f+'">'+opts+'</select></label>';
  const cokOturum=siraliDenemeler().some(e=>e.sec&&e.es&&e.es.oturumlar.length>1),aytVar=exU.some(e=>oturumKume(e.es,S.oturum).has('AYT'));
  const oturumSel=cokOturum?sel('Oturum','oturum',[['TYT+AYT','TYT + AYT'],['TYT','TYT'],['AYT','AYT']].map(([v,l])=>opt(v,l,S.oturum===v)).join('')):'';
  const dersler='<div class="yd-dersler" role="group" aria-label="Dersler">'+dersListesi(exU).map(ad=>'<label><input type="checkbox" data-yd-ders="'+h(ad)+'"'+(S.kapali.has(ad)?'':' checked')+'>'+h(ad)+'</label>').join('')+'</div>';
  const gor=(v,t)=>'<button type="button" class="yd-chip" data-yd-gorunum="'+v+'" aria-pressed="'+(S.gorunum===v)+'">'+h(t)+'</button>';
  const gorunumSec='<div class="yd-sec yd-gorunum"><span id="ydGorunumEtiket">Defter</span><div class="yd-chips" role="group" aria-labelledby="ydGorunumEtiket">'+gor('ogrenci','Öğrenci defterleri')+gor('ders','Ders öğretmenleri: fark soruları')+gor('karne','Öğrenciye deneme karnesi')+'</div></div>';
  const ilerleme='<span id="ydIlerleme" class="yd-ozet" role="status">'+h(S.ilerleme)+'</span>';
  if(S.gorunum==='karne'){S.liste=[];S.fark=null;return top+gorunumSec+karneGorunum(exU)}
  if(S.gorunum==='ders'){
    S.liste=[];const M=S.fark=farkModeli(),soru=M.geride.reduce((a,g)=>a+g.soru,0),bos=!soru||!!S.kilit;
    const ogrSel=M.ogretmenli?sel('Öğretmen','ogretmen',opt('','Bütün öğretmenler',!S.ogretmen)+M.ogretmenler.map(o=>opt(o,o,o===S.ogretmen)).join('')):'';
    const secimSel=sel('Hangi sorular','secim',opt('z','Tesadüf olamayacak kadar geride',S.secim==='z')+ESIKLER.map(v=>opt(v,'En az '+v+' puan geride',S.secim===v)).join(''));
    const filtre='<div class="yd-filtre">'+oturumSel+ogrSel+secimSel+'</div>';
    const arac='<div class="yd-arac"><button type="button" class="et-dugme birincil" data-yd-yazdir'+(bos?' disabled':'')+'>Yazdır</button><button type="button" class="et-dugme" data-yd-pdf'+(bos?' disabled':'')+'>PDF indir</button><span class="yd-ozet">'+M.geride.length+' sayfa grubu · '+soru+' soru'+(exU.length>1?' · '+exU.length+' deneme':'')+'</span>'+ilerleme+'</div>';
    return top+gorunumSec+filtre+dersler+arac+farkOzetHTML(M)+'<div class="yd-baski" id="ydBaski">'+M.geride.map(farkSayfaHTML).join('')+'</div>';
  }
  S.fark=null;
  const temel=kisiTemel(exU),subeler=[...new Set(temel.map(k=>k.sube))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  if(S.sube&&!subeler.includes(S.sube))S.sube='';
  if(S.ogr&&!temel.some(k=>k.no===S.ogr))S.ogr='';
  const inSube=temel.filter(k=>!S.sube||k.sube===S.sube);
  const list=S.liste=birlesik(),soru=list.reduce((a,m)=>a+soruSayisi(m),0);
  const secili=k=>!S.bantlar||S.bantlar.has(k);
  const chips='<div class="yd-sec yd-zsec"><span id="ydZorlukEtiket">Zorluk</span><div class="yd-chips" role="group" aria-labelledby="ydZorlukEtiket">'+ZORLUK.BANTLAR.map(([k,ad])=>chipHtml(k,ad,secili(k))).join('')+chipHtml('kendi','Kendi seviyesi',S.kendi)+'</div></div>';
  const alanSel=aytVar?sel('Alan (AYT)','alan',[['ogr','Öğrencinin alanı'],['SAY','SAY'],['EA','EA'],['SÖZ','SÖZ'],['Tümü','Tümü']].map(([v,l])=>opt(v,l,S.alan===v)).join('')):'';
  const filtre='<div class="yd-filtre">'+oturumSel+alanSel+sel('Şube','sube',opt('','Tüm şubeler',!S.sube)+subeler.map(s=>opt(s,s,s===S.sube)).join(''))+sel('Öğrenci','ogr',opt('','Tüm öğrenciler ('+inSube.length+')',!S.ogr)+inSube.map(k=>opt(k.no,k.ad+' · '+k.no,k.no===S.ogr)).join(''))+
    sel('Soru durumu','status',[['all','Yanlış ve boş'],['yanlis','Yalnızca yanlış'],['bos','Yalnızca boş']].map(([v,l])=>opt(v,l,S.status===v)).join(''))+chips+'</div>';
  const yazilir=list.filter(m=>soruSayisi(m)>0).length;
  const arac='<div class="yd-arac"><button type="button" class="et-dugme birincil" data-yd-yazdir'+(soru&&!S.kilit?'':' disabled')+'>Seçili denemeler için yazdır</button><button type="button" class="et-dugme" data-yd-pdf'+(soru&&!S.kilit?'':' disabled')+'>PDF indir</button><span class="yd-ozet">'+list.length+' öğrenci · '+soru+' soru'+(exU.length>1?' · '+exU.length+' deneme':'')+'</span>'+ilerleme+'</div>';
  const oneri=S.pdfOneri?oneriHTML():'';
  const gorunen=onizleme(list),gizli=gorunen.length<list.length?'<p class="yd-ozet yd-onizleme">Önizleme ilk '+gorunen.length+' öğrenciyi gösterir; yazdırma ve PDF '+yazilir+' öğrencinin hepsini içerir.</p>':'';
  return top+gorunumSec+filtre+dersler+arac+oneri+analizHTML(exU)+gizli+'<div class="yd-baski" id="ydBaski">'+gorunen.map(m=>ogrHTML(m,exU)).join('')+'</div>';
}
function oneriHTML(){
  const o=S.pdfOneri;
  return '<div class="yd-oneri" role="alert"><p>Bu seçim yaklaşık '+o.sayfa+' sayfa; tek PDF için çok büyük (en fazla '+S.pdfSinir+' sayfa).'+(o.subeler.length?' Şubeye göre ayrı PDF indirebilirsiniz:':'')+'</p>'+
    (o.subeler.length?'<div class="yd-oneri-liste">'+o.subeler.map(x=>'<button type="button" class="et-dugme" data-yd-pdf-sube="'+h(x.sube)+'">'+h(x.sube)+' · '+x.sayfa+' sayfa</button>').join('')+'</div>':'')+
    '<p>Ya da Şube, Öğrenci, Soru durumu, Zorluk veya ders kutularıyla seçimi daraltın; ya da bazı denemelerin işaretini kaldırın.</p></div>';
}
function gorunum(){
  if(!rehber())return '<p>Bu sayfa rehber öğretmen içindir.</p>';
  setTimeout(()=>{if(etkin()){kutAc();hazirla()}},0);
  return '<div id="ydKok">'+content()+'</div>';
}
function render(focus){
  const root=typeof document!=='undefined'&&document.getElementById('ydKok');if(!root||!etkin())return;
  root.innerHTML=content();hazirla();if(focus)root.querySelector(focus)?.focus();
}

/* Print: only the defter pages, A4 portrait. The wait lets every crop finish first. With more students than the screen preview shows, the print pages hold all of them. */
function baskiBitir(){
  if(typeof document==='undefined'||!document.body)return;
  document.body.classList?.remove('yd-yazdir');document.getElementById('ydSayfaStili')?.remove();
  if(S.onizlemeHTML!=null){const el=document.getElementById('ydBaski');if(el)el.innerHTML=S.onizlemeHTML;S.onizlemeHTML=null}
}
function baskiHazirla(){
  const el=document.getElementById('ydBaski');
  if(!el)return false;
  const stil=document.createElement('style');stil.id='ydSayfaStili';stil.textContent='@media print{@page{size:A4 portrait;margin:12mm}}';
  baskiBitir();
  if(S.gorunum!=='ders'&&onizleme(S.liste).length<S.liste.length){const ex=kullanilan();S.onizlemeHTML=el.innerHTML;el.innerHTML=S.liste.map(m=>ogrHTML(m,ex)).join('')}
  document.head.appendChild(stil);document.body.classList.add('yd-yazdir');
  window.addEventListener('afterprint',baskiBitir,{once:true});
  return true;
}
async function yazdir(){
  if(S.kilit)return false;
  S.kilit='yazdir';
  let temiz=false,yazdirildi=false;
  const bitir=()=>{if(temiz)return;temiz=true;S.kilit='';baskiBitir();if(etkin())render()};
  try{
    render();await hazirla(true);
    if(!baskiHazirla())return false;
    const imgs=[...document.querySelectorAll('#ydBaski img')];
    await Promise.all(imgs.map(i=>i.complete&&i.naturalWidth?0:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});setTimeout(r,5000)})));
    // Register before window.print(): desktop browsers fire afterprint synchronously inside print().
    window.addEventListener('afterprint',bitir,{once:true});
    try{yazdirildi=true;window.print();return true}catch(e){yazdirildi=false;window.removeEventListener('afterprint',bitir);return false}
  }finally{
    S.kilit='';
    if(!yazdirildi){window.removeEventListener('afterprint',bitir);bitir()}
  }
}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeprint',()=>{if(etkin()&&!document.body.classList.contains('yd-yazdir'))baskiHazirla()});

/* ---------------------------------------------------------------- PDF indir: the same defter as one PDF file built in the browser (pdf-lib, loaded like the other reports)
   pdfPlan lays every student out on A4 portrait pages (12 mm margins, two columns, pictures at 82% of the column, a question never split, each student on a new page, the key on its own page(s)).
   It only needs a text-width function, so it is the same plan the PDF is drawn from and the page count can be told before anything is drawn. */
const PDF={W:595.28,H:841.89,M:34.02,G:14.17};
const pdfMetin=s=>String(s??'').normalize('NFC');
// The page flow shared by the PDF plans: A4 portrait pages of drawing operations (text, lines, boxes, filled boxes, pictures), a block over the
// full width that is never split, and items in the next free place of an n-column flow. A colour is a grey level (0 black … 1 white) or [r, g, b] in 0..1.
function akis(olcu){
  const {W,H,M,G}=PDF,CW=W-2*M,ALT=H-M-6,A={sayfalar:[],sf:null,CW,COLW:(CW-G)/2,ALT,MAXH:ALT-M-30};
  let y=M,kol=null;
  A.yeni=()=>{A.sf={ops:[]};A.sayfalar.push(A.sf);y=M;kol=null};
  A.yeni();
  A.t=(x,yt,s,size,kalin,renk)=>A.sf.ops.push({t:'t',x,y:yt,s:pdfMetin(s),size,b:!!kalin,c:renk||0});
  A.cizgi=(x,yt,w,lw,renk)=>A.sf.ops.push({t:'l',x,y:yt,w,lw,c:renk||0});
  A.kutu=(x,yt,w,hh,lw,renk)=>A.sf.ops.push({t:'r',x,y:yt,w,h:hh,lw,c:renk||0});
  A.dolu=(x,yt,w,hh,renk)=>A.sf.ops.push({t:'f',x,y:yt,w,h:hh,c:renk});
  A.resim=(c,x,yt,w,hh)=>A.sf.ops.push({t:'i',c,x,y:yt,w,h:hh});
  A.sar=(s,size,kalin,w)=>{
    const out=[];let satir='';
    for(const kelime of pdfMetin(s).split(/\s+/)){const dene=satir?satir+' '+kelime:kelime;if(satir&&olcu(dene,size,kalin)>w){out.push(satir);satir=kelime}else satir=dene}
    if(satir)out.push(satir);return out;
  };
  // short items joined by " · ", a line broken only between items (a label never leaves its value)
  A.parcali=(parcalar,size,kalin,w)=>{
    const out=[];let satir='';
    for(const p of parcalar.map(pdfMetin)){const dene=satir?satir+' · '+p:p;if(satir&&olcu(dene,size,kalin)>w){out.push(satir);satir=p}else satir=dene}
    if(satir)out.push(satir);return out;
  };
  // the text cut to the width, with "…"
  A.kisalt=(s,size,kalin,w)=>{s=pdfMetin(s);if(olcu(s,size,kalin)<=w)return s;while(s&&olcu(s+'…',size,kalin)>w)s=s.slice(0,-1);return s?s.trimEnd()+'…':''};
  // a block over the full width; keep = room that must remain below it (a heading is never left alone at the bottom of a page)
  A.tam=(hh,fn,keep=0)=>{if(kol){y=Math.max(...kol.cy);kol=null}if(y>M&&y+hh+keep>ALT)A.yeni();fn(y);y+=hh};
  // an item that is never split, in the next free place of an n-column flow
  // lim: the height a short set is balanced to (the columns end about level, like newspaper columns); only for the first page of the set
  A.kolonda=(n,w,hh,fn,lim=Infinity)=>{
    if(!kol||kol.n!==n){if(kol)y=Math.max(...kol.cy);kol={n,bas:y,cy:Array(n).fill(y),c:0,lim:y+lim}}
    for(let k=0;k<=n+1;k++){
      const cy=kol.cy[kol.c],doldu=kol.c<n-1&&cy>kol.bas+.01&&cy+hh/2>kol.lim;
      if(!doldu&&(cy+hh<=ALT||(kol.bas<=M+.01&&cy<=M+.01))){fn(M+kol.c*(w+G),cy);kol.cy[kol.c]+=hh;return}
      if(kol.c<n-1)kol.c++;else{A.yeni();kol={n,bas:M,cy:Array(n).fill(M),c:0,lim:Infinity}}
    }
  };
  // the page's footer line on every page: "<text> · 2 / 3"
  A.altBilgi=metin=>A.sayfalar.forEach((p,i)=>p.ops.push({t:'t',x:M,y:H-16,s:pdfMetin(metin+' · '+(i+1)+' / '+A.sayfalar.length),size:7.5,b:false,c:.4}));
  return A;
}
function kisiPlani(m,ex,olcu){
  const {M,G}=PDF,A=akis(olcu),{CW,COLW,ALT,MAXH,t,cizgi,kutu,sar,tam,kolonda,yeni}=A,coklu=ex.length>1,o=m.ogr;
  const chip=(x,yt,metin)=>{const cw=olcu(metin,7,false)+9;kutu(x-cw,yt,cw,10,.6,.35);t(x-cw+4.5,yt+7.6,metin,7,false)};
  // --- the student's heading
  const ad1=!coklu&&ex[0]?.rapor.ad?' · '+ex[0].rapor.ad:'';
  const satirlar=[{l:sar(o.ad,15,true,CW),size:15,b:true,gap:3},{l:sar('Öğrenci No '+o.no+' · '+o.sube+ad1,9.5,false,CW),size:9.5,gap:1}];
  if(coklu)satirlar.push({l:sar('Denemeler: '+m.denemeler.map(x=>adOf(x.e)).join(' · '),9.5,false,CW),size:9.5,gap:1});
  satirlar.push({l:[(coklu?m.denemeler.length+' deneme · ':'')+m.yanlis+' yanlış · '+m.bos+' boş'],size:11,b:true,gap:2});
  if(m.filterText)satirlar.push({l:sar(m.filterText,9.5,false,CW),size:9.5,gap:1});
  const ustH=satirlar.reduce((a,x)=>a+x.l.length*(x.size+3)+x.gap,0)+8;
  tam(ustH,y0=>{let yy=y0;for(const x of satirlar){for(const s of x.l){t(M,yy+x.size,s,x.size,x.b);yy+=x.size+3}yy+=x.gap}cizgi(M,yy+3,CW,1.4)});
  // --- the exams
  for(const {e,d} of m.denemeler){
    if(coklu)tam(28,y0=>{t(M,y0+17,adOf(e),13,true);cizgi(M,y0+22,CW,1)},70);
    const notlar=[...new Set(d.bolumler.filter(b=>!b.gorsel).map(b=>b.kit))];
    if(notlar.length){const l=sar(notlar.join(', ')+' kitapçığı: sorular kendi kitapçığından çözülecek',9,true,CW);tam(l.length*11+4,y0=>l.forEach((s,i)=>t(M,y0+9+i*11,s,9,true)))}
    d.bolumler.forEach((b,i)=>{
      if(e.es.oturumlar.length>1&&(i===0||d.bolumler[i-1].oturum!==b.oturum))tam(26,y0=>{t(M,y0+17,b.oturum,12,true);cizgi(M,y0+21,olcu(b.oturum,12,true)+14,1.6)},70);
      tam(22,y0=>{t(M,y0+14,b.ders,11,true);t(M+olcu(b.ders,11,true)+5,y0+14,String(b.sorular.length),10,false,.3);cizgi(M,y0+18,CW,.6,.55)},60);
      if(b.gorsel){
        const blok=b.sorular.map(s=>{
          const k=s.test+':'+s.a,c=e.crops.get(k),f=testBul(e,s.test),genis=f.kit.testler[f.t].sorular[s.a-1].genis,kolW=genis?CW:COLW,dw=.82*kolW;
          let w=dw,hh=c&&c.w?c.h/c.w*dw:46;if(hh>MAXH){w*=MAXH/hh;hh=MAXH}
          return {s,c,genis,w,hh};
        }),dar=blok.filter(x=>!x.genis),denge=dar.reduce((a,x)=>a+12+x.hh+8.5,0)/2;
        for(const {s,c,genis,w,hh} of blok){
          const et='Soru '+(s.a??s.own)+(s.b!==null&&s.a!==null?' (B kitapçığında '+s.b+')':''),hap=s.z&&s.z.bant?ZORLUK.etiketYazi(s.z.bant,s.z.belirsiz):'';
          const ciz=(x,yt)=>{
            t(x,yt+8,et,8,true);if(hap)chip(x+w,yt,hap);
            if(c)A.resim(c,x,yt+12,w,hh);
            else{kutu(x,yt+12,w,hh,.5,.6);t(x+6,yt+12+hh/2,'Resim kesilemedi',8,false,.4)}
          };
          const blokH=12+hh+8.5;
          if(genis)tam(blokH,y0=>ciz(M,y0));else kolonda(2,COLW,blokH,ciz,dar.length===blok.length?denge:Infinity);
        }
      }else{
        for(let r=0;r<b.sorular.length;r+=2)tam(16,y0=>{
          [0,1].forEach(j=>{const s=b.sorular[r+j];if(!s)return;const x=M+j*(COLW+G);t(x,y0+10,'Soru '+s.own,9,true);if(s.z&&s.z.bant)chip(x+COLW-4,y0+1,ZORLUK.etiketYazi(s.z.bant,s.z.belirsiz));cizgi(x,y0+14,COLW,.4,.75)});
        });
      }
    });
  }
  // --- the key, on its own page(s): each exam's own answers, grouped by exam
  yeni();
  tam(36,y0=>{t(M,y0+15,'Cevaplar',13,true);t(M,y0+29,o.ad+' · Öğrenci No '+o.no+' · '+o.sube,9.5,false,.2)});
  const TW=(CW-2*G)/3,SAT=10.5,PARCA=Math.max(5,Math.floor((ALT-M-70)/SAT));
  for(const {e,d} of m.denemeler){
    if(coklu)tam(24,y0=>{t(M,y0+15,adOf(e),11.5,true);cizgi(M,y0+19,CW,.8)},60);
    d.bolumler.forEach((b,i)=>{
      if(e.es.oturumlar.length>1&&(i===0||d.bolumler[i-1].oturum!==b.oturum))tam(22,y0=>{t(M,y0+15,b.oturum,11,true);cizgi(M,y0+19,olcu(b.oturum,11,true)+12,1.4)},60);
      for(let r0=0;r0<b.sorular.length;r0+=PARCA){
        const sat=b.sorular.slice(r0,r0+PARCA);
        kolonda(3,TW,22+sat.length*SAT+8,(x,yt)=>{
          t(x,yt+9,b.ders+(r0?' (devam)':''),8.5,true);
          t(x+2,yt+20,'Soru',7.5,false,.3);t(x+TW*.28,yt+20,'Senin cevabın',7.5,false,.3);t(x+TW*.68,yt+20,'Doğru cevap',7.5,false,.3);cizgi(x,yt+23,TW,.6,.5);
          sat.forEach((s,k)=>{const yy=yt+23+(k+1)*SAT;t(x+2,yy-2.5,String(s.own),8,true);t(x+TW*.28,yy-2.5,s.durum==='bos'?'Boş':s.isaret,8);t(x+TW*.68,yy-2.5,s.dogru,8);cizgi(x,yy,TW,.3,.8)});
        });
      }
    });
  }
  A.altBilgi(o.ad+' · Öğrenci No '+o.no);
  return {no:o.no,sayfalar:A.sayfalar};
}
function pdfPlan(liste,ex,olcu){
  const kisiler=liste.filter(m=>soruSayisi(m)>0).map(m=>kisiPlani(m,ex,olcu));
  return {kisiler,sayfa:kisiler.reduce((a,k)=>a+k.sayfalar.length,0)};
}
const subeAdi=s=>String(s??'').trim().split(/\s+/).pop().replace(/[çÇğĞıİöÖşŞüÜ]/gu,c=>({ç:'c',Ç:'C',ğ:'g',Ğ:'G',ı:'i',İ:'I',ö:'o',Ö:'O',ş:'s',Ş:'S',ü:'u',Ü:'U'}[c])).replace(/[^A-Za-z0-9]/gu,'');
const pdfDosyaAdi=(n,sube)=>'Yanlislar_defteri_'+n+'_deneme'+(subeAdi(sube)?'_'+subeAdi(sube):'')+'.pdf';
async function pdfBelge(L){
  const doc=await L.PDFLib.PDFDocument.create();doc.registerFontkit(L.fontkit);
  const RR=await doc.embedFont(L.rr,{subset:true}),RM=await doc.embedFont(L.rm,{subset:true});
  return {doc,RR,RM,olcu:(s,size,kalin)=>{try{return (kalin?RM:RR).widthOfTextAtSize(pdfMetin(s),size)}catch(x){return pdfMetin(s).length*size*.55}}};
}
// A crop (PNG) goes into the PDF as a JPEG: about 185 dpi at the printed size, a fraction of the bytes.
async function jpegBayt(blob){
  const bmp=await createImageBitmap(blob),cv=document.createElement('canvas');cv.width=bmp.width;cv.height=bmp.height;
  const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bmp,0,0);if(bmp.close)bmp.close();
  const j=await new Promise(r=>cv.toBlob(r,'image/jpeg',.88));cv.width=cv.height=0;
  return new Uint8Array(await j.arrayBuffer());
}
async function pdfCiz(B,L,plan,ilerle){
  const {doc,RR,RM}=B,{H}=PDF,gri=c=>Array.isArray(c)?L.PDFLib.rgb(c[0],c[1],c[2]):L.PDFLib.rgb(c,c,c),resimler=new Map();
  let n=0;
  for(const k of plan.kisiler){
    for(const p of k.sayfalar){
      const sayfa=doc.addPage([PDF.W,PDF.H]);
      for(const op of p.ops){
        if(op.t==='t'){
          const o={x:op.x,y:H-op.y,size:op.size,font:op.b?RM:RR,color:gri(op.c)};
          try{sayfa.drawText(op.s,o)}catch(x){sayfa.drawText(op.s.replace(/[^ -ɏ–—‘’“”…]/gu,'?'),o)}
        }else if(op.t==='l')sayfa.drawLine({start:{x:op.x,y:H-op.y},end:{x:op.x+op.w,y:H-op.y},thickness:op.lw,color:gri(op.c)});
        else if(op.t==='r')sayfa.drawRectangle({x:op.x,y:H-op.y-op.h,width:op.w,height:op.h,borderWidth:op.lw,borderColor:gri(op.c)});
        else if(op.t==='f')sayfa.drawRectangle({x:op.x,y:H-op.y-op.h,width:op.w,height:op.h,color:gri(op.c)});
        else if(op.t==='i'){
          let img=resimler.get(op.c);
          if(!img){img=await doc.embedJpg(await jpegBayt(op.c.blob));resimler.set(op.c,img)}
          sayfa.drawImage(img,{x:op.x,y:H-op.y-op.h,width:op.w,height:op.h});
        }
      }
    }
    n++;ilerle(n,plan.kisiler.length);await tick();
  }
}
function indir(bytes,ad){
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');
  a.href=url;a.download=ad;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function pdfIndir(sube){
  if(S.kilit)return;
  S.kilit='pdf';S.pdfOneri=null;
  const yaz=m=>{S.is=m;const el=document.getElementById('ydIs');if(el)el.textContent=m};
  try{
    const ex=kullanilan();render();
    await hazirla(true);
    yaz('PDF araçları yükleniyor…');
    const L=await SIRALAMA.kutuphane(),B=await pdfBelge(L);
    let liste=S.liste.filter(m=>soruSayisi(m)>0);
    if(sube)liste=liste.filter(m=>m.ogr.sube===sube);
    if(!liste.length)throw new Error('Yazdırılacak soru yok.');
    const plan=pdfPlan(liste,ex,B.olcu);
    if(plan.sayfa>S.pdfSinir){
      const subeler=[...new Set(liste.map(m=>m.ogr.sube))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
      const parca=subeler.length>1?subeler.map(s=>({sube:s,sayfa:pdfPlan(liste.filter(m=>m.ogr.sube===s),ex,B.olcu).sayfa})).filter(x=>x.sayfa<=S.pdfSinir):[];
      S.pdfOneri={sayfa:plan.sayfa,subeler:parca};return;
    }
    await pdfCiz(B,L,plan,(i,n)=>yaz('PDF hazırlanıyor… '+i+'/'+n+' öğrenci'));
    B.doc.setTitle('Yanlışlar defteri');
    yaz('PDF kaydediliyor…');await tick();
    indir(await B.doc.save(),pdfDosyaAdi(ex.length,sube||S.sube));
    S.sonPdf={sayfa:plan.sayfa,kisi:plan.kisiler.length};
  }catch(x){S.genel.push({dosya:'',mesaj:'PDF hazırlanamadı: '+(x.message||x)})}
  finally{S.kilit='';yaz('');render()}
}


/* ---------------------------------------------------------------- Ders öğretmenleri: fark soruları
   After an exam the rehber öğretmen hands every subject teacher the questions on which the teacher's own şubeler were well behind the
   publisher's schools ("sınav okulları": the Performans analizi's p, the share of all the network's pupils who answered the A booklet question
   right). No points and no colours on the sheet: each question carries its booklet picture and the data in words,
   "Sınav okullarında öğrencilerin %60'ı bu soruyu doğru cevapladı; şubelerinizde yalnızca %10'u.", then the correct answer, the wrong option
   the şubeler marked most, the blank share and the konu (Konu Takibi's Sınav özeti, when there).
   - The teachers and their şubeler come from the classes' timetables (Etüt planı, read by OGRETMEN_RAPOR.ogretmenler): a sheet per teacher
     and exam subject (TYT Matematik, AYT Matematik …) over the şubeler where the teacher teaches it. Without timetables: a sheet per ders
     over the whole school ("okulumuzda").
   - Our rate counts the students judged on the question's test (sayilanKural), a blank as wrong; B students through the çözüm map. A cancelled
     question is left out. Both rates are rounded to whole percents for the sentence.
   - A question is listed when the şubeler are behind beyond chance (z ≤ −1,96), N the şubeler's students judged on it, D their right answers,
     p the sınav okulları rate over M pupils (the file's "İşaretleme yapan öğrenci sayısı" of the ders). Both rates are samples, so the two are
     compared as two groups: z = (D/N − p) / √(p̄·(1 − p̄)·(1/N + 1/M)), p̄ = (D + p·M) / (N + M). With thousands of pupils this is the one-group
     test z = (D − N·p) / √(N·p·(1 − p)); on a ders few pupils take (AYT Sosyal-2: 25 in 27_AYT_ÖZEL_1), a printed 100 % of 25 is not certain
     and the test says so. Without M the one-group test is used. p and p̄ are read within 0,01 … 0,99 (two printed decimals: a printed 1,00 does
     not make one miss in thirty a gap). The gap needed follows N: about 18 points with 30 students at p = 50 %, 13 with 60. */
const Z_SINIR=1.96;
// Which questions (Seçim, the rehber's choice on screen; never printed): 'z' behind beyond chance (the default), or a fixed gap of at least that many points
// (the rounded rates' difference: 60 % against 40 % is 20 points), whatever the number of students.
const ESIKLER=[10,15,20,25,30];
const secimGecerli=v=>v==='z'||ESIKLER.includes(v);
const listelenir=x=>S.secim==='z'?x.geride:x.okullar-x.okul>=S.secim;
const perfHaritasi=e=>e.perf?new Map(e.perf.dersler.map(x=>[key(x.ad),x])):null;
// The sınav okulları rate of a question (ak: its place in the section, A booklet) and how many pupils it is over, or null without the Performans analizi's ders.
function okullarMadde(pm,eb,ak){
  const pd=pm?pm.get(key(eb.ad||'')):null,tp=pd&&pd.n===eb.n&&ak!==null&&ak!==undefined&&pd.maddeler[ak]?pd.maddeler[ak].p:null;
  return tp===null||tp===undefined||!Number.isFinite(tp)?null:{p:tp>1?tp/100:tp,n:pd.orneklem>0?pd.orneklem:null};
}
const okullarP=(pm,eb,ak)=>okullarMadde(pm,eb,ak)?.p??null;
const sinirla=x=>Math.min(.99,Math.max(.01,x));
// Behind beyond chance? D right answers of N against the rate p over M pupils (null: very many). See the note above.
function farkZ(D,N,p,M){
  if(M>0){const pb=sinirla((D+p*M)/(N+M));return (D/N-p)/Math.sqrt(pb*(1-pb)*(1/N+1/M))}
  const q=sinirla(p);return (D-N*q)/Math.sqrt(N*q*(1-q));
}
const yuz=x=>Math.round(x*100);
// One question of a section compared (q: its place in the section; m: our rates, okulMaddeleri), or null when one of the two rates is missing.
function farkSorusu(e,eb,q,m,pm){
  const a=eb.off+q+1,s=m.get(eb.test+':'+a),om=okullarMadde(pm,eb,q),tp=om?.p??null;
  if(!s||tp===null)return null;
  const okul=yuz(s.p),okullar=yuz(tp),cevap=e.rapor.anahtar.A?.[eb.bas+q]||'',yanlis=['A','B','C','D','E'].filter(x=>x!==cevap&&s.sec[x]>0).sort((x,y)=>s.sec[y]-s.sec[x]||x.localeCompare(y))[0]||null;
  const z=farkZ(s.dogru,s.n,tp,om.n);
  return {test:eb.test,a,q,okul,okullar,fark:okul-okullar,n:s.n,okullarN:om.n,dogru:s.dogru,z,geride:z<=-Z_SINIR,cevap,yanlis,yanlisPay:yanlis?yuz(s.sec[yanlis]/s.n):0,bos:yuz(s.sec['']/s.n),konu:''};
}
const sinifOf=s=>typeof OGRETMEN_RAPOR!=='undefined'?OGRETMEN_RAPOR.sinifK(s):String(s??'').trim();
// The sheets' owners: [{ogretmen, kod (the report section), siniflar}] from the timetables, or null without them.
function hedefler(){
  let l=[];try{l=typeof OGRETMEN_RAPOR!=='undefined'?OGRETMEN_RAPOR.ogretmenler():[]}catch(x){l=[]}
  const out=[];for(const o of l)for(const d of o.dersler)for(const k of d.kodlar)out.push({ogretmen:title(o.ad),kod:key(k[2]),siniflar:new Set(d.kodSinif[k[2]]||d.siniflar)});
  return out.length?out:null;
}
// The selected exams (Oturum, ders ticks) as sheets: {ogretmenli, sayfalar:[{ogretmen, ders, oturum, siniflar, denemeler:[{e, ad, tarih, n, toplam, sorular}], soru}],
// geride (sheets with a question behind beyond chance), temiz (compared, none behind), eksik (exams without a Performans analizi), sahipsiz (sections and şubeler no teacher teaches)}.
function farkModeli(){
  const H=hedefler(),gruplar=new Map(),eksik=[],sahipsiz=new Map();
  for(const e of kullanilan()){
    const pm=perfHaritasi(e);if(!pm){eksik.push(adOf(e));continue}
    const ses=oturumKume(e.es,S.oturum),k=sayilanKural(e.rapor,e.es);
    e.es.bolumler.forEach((eb,i)=>{
      const o=eb.oturum||'TYT';if(!ses.has(o)||S.kapali.has(eb.ders))return;
      const kimler=e.rapor.ogrenciler.filter(x=>k.f(x).has(i));
      const sahipler=H?H.filter(h=>h.kod===key(eb.ad||'')):[{ogretmen:null,siniflar:null}];
      if(H){const yok=[...new Set(kimler.map(x=>sinifOf(x.sube)).filter(c=>!sahipler.some(h=>h.siniflar.has(c))))];if(yok.length){const ad=dersBasligi({ders:eb.ders,oturum:o}),l=sahipsiz.get(ad)||new Set();yok.forEach(c=>l.add(c));sahipsiz.set(ad,l)}}
      for(const h of sahipler){
        const grup=h.siniflar?kimler.filter(x=>h.siniflar.has(sinifOf(x.sube))):kimler;if(!grup.length)continue;
        const m=bolumMaddeleri(e,eb,grup),sorular=[];let n=0,toplam=0;
        for(let q=0;q<eb.n;q++){const x=farkSorusu(e,eb,q,m,pm);if(!x)continue;toplam++;n=Math.max(n,x.n);if(listelenir(x))sorular.push(x)}
        if(!toplam)continue;
        for(const x of sorular)x.konu=konuBul(e.rapor,eb.ad||'',x.q);
        const gk=(h.ogretmen||'')+'|'+o+'|'+eb.ders;let g=gruplar.get(gk);
        if(!g)gruplar.set(gk,g={ogretmen:h.ogretmen,ders:eb.ders,oturum:o,sira:[o==='AYT'?1:0,i],siniflar:new Set(),denemeler:[],soru:0});
        for(const x of grup)g.siniflar.add(sinifOf(x.sube));
        g.denemeler.push({e,ad:adOf(e),tarih:e.tarih||'',n,toplam,sorular});g.soru+=sorular.length;
      }
    });
  }
  const tumu=[...gruplar.values()].map(g=>({...g,siniflar:[...g.siniflar].filter(Boolean).sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}))}))
    .sort((x,y)=>(x.ogretmen||'').localeCompare(y.ogretmen||'','tr')||x.sira[0]-y.sira[0]||x.sira[1]-y.sira[1]);
  const ogretmenler=[...new Set(tumu.map(g=>g.ogretmen).filter(Boolean))];
  if(S.ogretmen&&!ogretmenler.includes(S.ogretmen))S.ogretmen='';
  const sayfalar=tumu.filter(g=>!S.ogretmen||g.ogretmen===S.ogretmen);
  return {ogretmenli:!!H,ogretmenler,sayfalar,geride:sayfalar.filter(g=>g.soru),temiz:sayfalar.filter(g=>!g.soru),eksik,
    sahipsiz:[...sahipsiz].map(([ad,l])=>ad+' ('+[...l].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true})).join(', ')+')')};
}
const dersBasligi=g=>key(g.ders).startsWith(g.oturum)?g.ders:g.oturum+' '+g.ders;
// The Turkish possessive after a number: %60'ı, %10'u, %50'si, %100'ü (by the last word read aloud).
const BIRLER=['ı','i','si','ü','ü','i','sı','si','i','u'],ONLAR=['','u','si','u','ı','si','ı','i','i','ı'];
const ekli=n=>{n=Math.round(Math.abs(n));const ek=n===0?'ı':n%10?BIRLER[n%10]:n%100?ONLAR[(n%100)/10]:'ü';return '%'+n+'’'+ek};
const kimde=g=>g.ogretmen?'şubelerinizde':'okulumuzda';
// The data in words: one sentence, then the answers.
const farkCumle=(g,x)=>'Sınav okullarında öğrencilerin '+ekli(x.okullar)+' bu soruyu doğru cevapladı; '+kimde(g)+(x.okul?' yalnızca '+ekli(x.okul)+'.':' kimse doğru cevaplamadı.');
const farkCevaplar=x=>['Doğru cevap: '+(x.cevap||'—'),...(x.yanlis?['En çok işaretlenen yanlış: '+x.yanlis+' (%'+x.yanlisPay+')']:[]),'Boş bırakan: %'+x.bos];
const sayfaBasligi=g=>(g.ogretmen?'Bu denemede şubelerinizin':'Bu denemede öğrencilerimizin')+' sınav okullarının gerisinde kaldığı sorular';
const kimlikSatiri=g=>g.ogretmen?g.ogretmen+' · '+g.siniflar.join(', '):'Bütün okul';
const sayiSatiri=d=>d.n+' öğrenci · '+d.sorular.length+' / '+d.toplam+' soru';
function farkSoruHTML(g,e,x){
  const k=x.test+':'+x.a,c=e.crops.get(k),f=testBul(e,x.test),genis=f.kit.testler[f.t].sorular[x.a-1].genis;
  return '<figure class="yd-soru yd-fs'+(genis?' yd-genis':'')+'" data-yd-okul="'+x.okul+'" data-yd-okullar="'+x.okullar+'"><figcaption><span class="yd-fs-ad"><b>Soru '+x.a+'</b>'+(x.konu?' <span class="yd-fs-konu">'+h(x.konu)+'</span>':'')+'</span></figcaption>'+
    '<p class="yd-fs-cumle">'+h(farkCumle(g,x))+'</p><p class="yd-fs-bilgi">'+farkCevaplar(x).map(t=>'<span>'+h(t)+'</span>').join('')+'</p>'+
    '<img alt="Soru '+x.a+'" data-yd="'+h(e.kod)+'|'+k+'"'+(c?' src="'+c.url+'"':' data-bekle="1"')+'></figure>';
}
function farkSayfaHTML(g){
  const govde=g.denemeler.map(d=>'<section class="yd-deneme"><h3 class="yd-deneme-baslik">'+h(d.ad)+(tarihYaz(d.tarih)?' <span class="yd-tarih">'+tarihYaz(d.tarih)+'</span>':'')+'</h3><p class="yd-kimlik">'+h(sayiSatiri(d))+'</p>'+
    (d.sorular.length?'<div class="yd-sorular">'+d.sorular.map(x=>farkSoruHTML(g,d.e,x)).join('')+'</div>':'<p class="yd-kimlik">Bu denemede böyle soru yok.</p>')+'</section>').join('');
  return '<article class="yd-ogr yd-fd" data-yd-fd="'+h((g.ogretmen?g.ogretmen+' · ':'')+dersBasligi(g))+'"><header class="yd-ust"><h2>'+h(dersBasligi(g))+'</h2><p class="yd-kimlik"><b>'+h(kimlikSatiri(g))+'</b></p><p class="yd-kimlik">'+h(sayfaBasligi(g))+'</p>'+
    '<p class="yd-say"><b>'+g.soru+'</b> soru'+(g.denemeler.length>1?' · '+g.denemeler.length+' deneme':'')+'</p></header>'+govde+'</article>';
}
// The screen above the sheets: how the questions are picked, the sheets and their counts, those with none behind, exams that cannot be compared, şubeler without a teacher.
function farkOzetHTML(M){
  const ad=g=>(g.ogretmen?g.ogretmen+' · ':'')+dersBasligi(g),satir=[];
  if(M.geride.length)satir.push('<p class="yd-fs-ozet">'+M.geride.map(g=>'<span><b>'+h(ad(g))+'</b> '+g.soru+'</span>').join('')+'</p>');
  satir.push('<p class="yd-ozet">'+(S.secim==='z'?'Listelenen sorular: şubelerin doğru oranının, öğrenci sayısına göre tesadüfle açıklanamayacak kadar sınav okullarının altında kaldığı sorular (z ≤ −1,96).':
    'Listelenen sorular: sınav okullarında doğru cevaplayanların oranının şubelerinkinden en az '+S.secim+' puan yüksek olduğu sorular (öğrenci sayısına bakılmaksızın).')+'</p>');
  if(M.temiz.length)satir.push('<p class="yd-ozet">'+(S.secim==='z'?'Belirgin biçimde geride kalınan soru yok: ':'Bu eşikte geride kalınan soru yok: ')+h(M.temiz.map(ad).join(', '))+'</p>');
  if(M.eksik.length)satir.push('<p class="yd-uyari" role="status">Performans analizi eklenmemiş: '+h(M.eksik.join(', '))+'. Sınav okullarının oranları bu dosyadan okunur.</p>');
  if(M.sahipsiz.length&&!S.ogretmen)satir.push('<p class="yd-ozet">Ders programında öğretmeni olmayan: '+h(M.sahipsiz.join(', '))+'.</p>');
  if(!M.ogretmenli)satir.push('<p class="yd-ozet">Ders programı yok: sayfalar ders ders, bütün okul için. Öğretmenlerin kendi şubeleri Etüt planı’ndaki ders programlarından okunur.</p>');
  if(!M.sayfalar.length&&!M.eksik.length)satir.push('<p class="yd-ozet">Seçili derslerde karşılaştırılacak soru yok.</p>');
  return '<div class="yd-fs-durum">'+satir.join('')+'</div>';
}

/* The sheets as a PDF: each sheet starts a new page (a teacher's sheets stand alone), the questions in two columns. */
function dersPlani(g,olcu){
  const {M}=PDF,A=akis(olcu),{CW,COLW,MAXH,t,cizgi,sar,tam,kolonda,kisalt,parcali}=A,baslik=dersBasligi(g);
  const satirlar=[{l:sar(baslik,15,true,CW),size:15,b:true,gap:3},{l:sar(kimlikSatiri(g),10,true,CW),size:10,b:true,gap:1},{l:sar(sayfaBasligi(g),9.5,false,CW),size:9.5,gap:1},
    {l:[g.soru+' soru'+(g.denemeler.length>1?' · '+g.denemeler.length+' deneme':'')],size:11,b:true,gap:2}];
  tam(satirlar.reduce((a,x)=>a+x.l.length*(x.size+3)+x.gap,0)+8,y0=>{let yy=y0;for(const x of satirlar){for(const s of x.l){t(M,yy+x.size,s,x.size,x.b);yy+=x.size+3}yy+=x.gap}cizgi(M,yy+3,CW,1.4)});
  for(const d of g.denemeler){
    tam(34,y0=>{t(M,y0+16,kisalt(d.ad+(tarihYaz(d.tarih)?' · '+tarihYaz(d.tarih):''),12,true,CW),12,true);t(M,y0+28,sayiSatiri(d),8.5,false,.3);cizgi(M,y0+32,CW,.6,.55)},70);
    if(!d.sorular.length){tam(16,y0=>t(M,y0+11,'Bu denemede böyle soru yok.',9,false,.35));continue}
    const blok=d.sorular.map(x=>{
      const c=d.e.crops.get(x.test+':'+x.a),f=testBul(d.e,x.test),genis=f.kit.testler[f.t].sorular[x.a-1].genis,w=genis?CW:COLW;
      let pw=.82*w,ph=c&&c.w?c.h/c.w*pw:46;if(ph>MAXH){pw*=MAXH/ph;ph=MAXH}
      const cumle=sar(farkCumle(g,x),8,false,w),cevap=parcali(farkCevaplar(x),7.5,false,w);
      return {x,c,genis,w,pw,ph,cumle,cevap,hh:13+cumle.length*10+cevap.length*9.5+3+ph+9};
    }),dar=blok.filter(b=>!b.genis),denge=dar.reduce((a,b)=>a+b.hh,0)/2;
    for(const b of blok){
      const {x,c,w,pw,ph,cumle,cevap}=b;
      const ciz=(x0,yt)=>{
        t(x0,yt+9,'Soru '+x.a,9,true);
        if(x.konu){const sx=x0+olcu('Soru '+x.a,9,true)+5;t(sx,yt+9,kisalt(x.konu,8,false,w-(sx-x0)),8,false,.35)}
        let yy=yt+13;cumle.forEach(l=>{yy+=10;t(x0,yy-2,l,8,false,0)});cevap.forEach(l=>{yy+=9.5;t(x0,yy-1.5,l,7.5,false,.3)});
        const iy=yy+3;
        if(c)A.resim(c,x0,iy,pw,ph);else{A.kutu(x0,iy,pw,ph,.5,.6);t(x0+6,iy+ph/2,'Resim kesilemedi',8,false,.4)}
      };
      if(b.genis)tam(b.hh,y0=>ciz(M,y0));else kolonda(2,COLW,b.hh,ciz,dar.length===blok.length?denge:Infinity);
    }
  }
  A.altBilgi((g.ogretmen?g.ogretmen+' · ':'')+baslik);
  return {ders:baslik,ogretmen:g.ogretmen,sayfalar:A.sayfalar};
}
function farkPlan(M,olcu){const kisiler=M.geride.map(g=>dersPlani(g,olcu));return {kisiler,sayfa:kisiler.reduce((a,k)=>a+k.sayfalar.length,0)}}
const farkDosyaAdi=(ex,ogretmen,secim='z')=>'Fark_sorulari_'+(ex.length===1?subeAdi(ex[0].kod)||'1_deneme':ex.length+'_deneme')+(ogretmen?'_'+subeAdi(String(ogretmen).replace(/\s+/g,'')):'')+(secim==='z'?'':'_'+secim+'_puan')+'.pdf';
async function farkPdfIndir(){
  if(S.kilit)return;
  S.kilit='pdf';
  const yaz=m=>{S.is=m;const el=document.getElementById('ydIs');if(el)el.textContent=m};
  try{
    const ex=kullanilan();render();
    await hazirla(true);
    yaz('PDF araçları yükleniyor…');
    const L=await SIRALAMA.kutuphane(),B=await pdfBelge(L),M=S.fark;
    if(!M||!M.geride.length)throw new Error('Yazdırılacak soru yok.');
    const plan=farkPlan(M,B.olcu);
    await pdfCiz(B,L,plan,(i,n)=>yaz('PDF hazırlanıyor… '+i+'/'+n+' sayfa grubu'));
    B.doc.setTitle('Fark soruları');
    yaz('PDF kaydediliyor…');await tick();
    indir(await B.doc.save(),farkDosyaAdi(ex,S.ogretmen,S.secim));
    S.sonPdf={sayfa:plan.sayfa,kisi:plan.kisiler.length};
  }catch(x){S.genel.push({dosya:'',mesaj:'PDF hazırlanamadı: '+(x.message||x)})}
  finally{S.kilit='';yaz('');render()}
}

// Deneme karnesi publication (D.konuKarneYayin, in the notebook: the choice, never the data). A viewing teacher changes nothing.
const karneKaydet=()=>{if(typeof kaydet==='function')kaydet()};
function karneYayinla(mod){
  if(typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme())return false;
  const kodlar=siraliDenemeler().filter(e=>e.sec&&e.rapor&&e.es).map(e=>e.kod);
  if(mod==='secili'&&!kodlar.length)return false;
  D.konuKarneYayin=mod==='secili'?{mod,kodlar}:{mod:'hepsi'};karneKaydet();render('[data-yd-kk-kaldir]');return true;
}
function karneModu(mod){
  if(!['hepsi','secili'].includes(mod)||(typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme()))return;
  S.kkMod=mod;if(yayinGecerli(D.konuKarneYayin))karneYayinla(mod);else render('[data-yd-kk-mod="'+mod+'"]');
}
if(typeof document!=='undefined'&&document.addEventListener){
document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='ydDosya'){const f=[...(el.files||[])];el.value='';if(f.length)dosyalarEkle(f);return}
  if(el.dataset?.ydSec!==undefined){const e=S.denemeler.get(el.dataset.ydSec);if(e){e.sec=el.checked;S.pdfOneri=null;render('[data-yd-sec="'+el.dataset.ydSec+'"]')}return}
  if(el.dataset?.ydSecHepsi!==undefined){for(const e of S.denemeler.values())e.sec=el.checked;S.pdfOneri=null;render('[data-yd-sec-hepsi]');return}
  if(el.dataset?.ydF==='sube'){S.sube=el.value;if(S.ogr&&S.sube){const k=kisiTemel(kullanilan()).find(x=>x.no===S.ogr);if(k&&k.sube!==S.sube)S.ogr=''}S.pdfOneri=null;render('[data-yd-f="sube"]');return}
  if(el.dataset?.ydF==='ogr'){S.ogr=el.value;S.pdfOneri=null;render('[data-yd-f="ogr"]');return}
  if(el.dataset?.ydF==='oturum'){if(['TYT+AYT','TYT','AYT'].includes(el.value))S.oturum=el.value;S.pdfOneri=null;render('[data-yd-f="oturum"]');return}
  if(el.dataset?.ydF==='alan'){if(['ogr',...ALANLAR,'Tümü'].includes(el.value))S.alan=el.value;S.pdfOneri=null;render('[data-yd-f="alan"]');return}
  if(el.dataset?.ydF==='kkOgr'){S.kkOgr=el.value;render('[data-yd-f="kkOgr"]');return}
  if(el.dataset?.ydF==='ogretmen'){S.ogretmen=el.value;render('[data-yd-f="ogretmen"]');return}
  if(el.dataset?.ydF==='secim'){const v=el.value==='z'?'z':Number(el.value);if(secimGecerli(v))S.secim=v;render('[data-yd-f="secim"]');return}
  if(el.dataset?.ydF==='status'){if(['all','yanlis','bos'].includes(el.value))S.status=el.value;S.pdfOneri=null;render('[data-yd-f="status"]');return}
  if(el.dataset?.ydDers!==undefined){const ad=el.dataset.ydDers;if(el.checked)S.kapali.delete(ad);else S.kapali.add(ad);S.pdfOneri=null;render('[data-yd-ders="'+ad.replace(/"/g,'\\"')+'"]')}
});
document.addEventListener('click',ev=>{
  if(!etkin())return;const hedef=ev.target.closest?.bind(ev.target);if(!hedef)return;
  if(hedef('[data-yd-yazdir]')){yazdir();return}
  if(hedef('[data-yd-pdf]')){if(S.gorunum==='ders')farkPdfIndir();else pdfIndir();return}
  const gr=hedef('[data-yd-gorunum]');if(gr){if(['ogrenci','ders','karne'].includes(gr.dataset.ydGorunum)&&!S.kilit){S.gorunum=gr.dataset.ydGorunum;S.pdfOneri=null;render('[data-yd-gorunum="'+S.gorunum+'"]')}return}
  const km=hedef('[data-yd-kk-mod]');if(km){karneModu(km.dataset.ydKkMod);return}
  if(hedef('[data-yd-kk-yayinla]')){karneYayinla(S.kkMod==='secili'?'secili':'hepsi');return}
  if(hedef('[data-yd-kk-guncelle]')){karneYayinla('secili');return}
  if(hedef('[data-yd-kk-kaldir]')){if(confirm('Deneme karnesi öğrencilere gitmesin mi? Öğrenciler, öğrenci girişlerini yeniden yayınladığınızda karnelerini artık görmez.')){delete D.konuKarneYayin;karneKaydet();render('[data-yd-kk-yayinla]')}return}
  const ps=hedef('[data-yd-pdf-sube]');if(ps){pdfIndir(ps.dataset.ydPdfSube);return}
  const sil=hedef('[data-yd-sil]');
  if(sil){const e=S.denemeler.get(sil.dataset.ydSil);if(e&&confirm('“'+adOf(e)+'” bu cihazdan silinsin mi? Gerekirse dosyaları yeniden ekleyebilirsiniz.'))denemeSil(e.kod);return}
  if(hedef('[data-yd-hepsini-sil]')){if(confirm('Kayıtlı tüm denemeler bu cihazdan silinsin mi? Gerekirse dosyaları yeniden ekleyebilirsiniz.'))hepsiniSil();return}
  const chip=hedef('[data-yd-z]');
  if(chip){
    const k=chip.dataset.ydZ;
    if(k==='kendi')S.kendi=!S.kendi;
    else if(BANT_ANAHTAR().includes(k)){const set=new Set(S.bantlar||BANT_ANAHTAR());if(set.has(k))set.delete(k);else set.add(k);S.bantlar=set.size===5?null:set}
    S.pdfOneri=null;render('[data-yd-z="'+k+'"]');
  }
});
// Files can be dropped anywhere on the page (a file dropped outside would otherwise open in the browser and leave the page).
const dosyaSurukleme=ev=>[...(ev.dataTransfer?.types||[])].includes('Files');
document.addEventListener('dragover',ev=>{if(!etkin()||!dosyaSurukleme(ev))return;ev.preventDefault();ev.dataTransfer.dropEffect='copy';document.getElementById('ydKok').classList.add('yd-surukle')});
document.addEventListener('dragleave',ev=>{if(!etkin()||ev.relatedTarget)return;document.getElementById('ydKok')?.classList.remove('yd-surukle')});
document.addEventListener('drop',ev=>{
  if(!etkin()||!dosyaSurukleme(ev))return;
  ev.preventDefault();document.getElementById('ydKok')?.classList.remove('yd-surukle');
  dosyalarEkle([...ev.dataTransfer.files]);
});
}
const durumu=()=>S;
// Test hook: an exam from already parsed parts (no pdf.js).
function denemeKoy({kod,kitlar={},rapor=null,pairs={},ort=null,perf=null,ad='',sec=true,crops=null}){
  const e=yeniDeneme(String(kod||(rapor?raporKodu(rapor):'0')));
  for(const [ses,k] of Object.entries(kitlar)){k.onbellek=k.onbellek||new Map();k.pdf=k.pdf||null;k.oturum=k.oturum||ses;e.kitlar[ses]=k}
  e.rapor=rapor;e.ad=ad||rapor?.ad||'';e.tarih=rapor?.tarih||'';e.sec=sec;e.pairs=pairs;e.ort=ort;e.perf=perf;
  if(rapor&&kitVar(e))e.es=esle(rapor,e.kitlar);
  if(rapor)e.durum.rapor='✓ '+rapor.ogrenciler.length+' öğrenci';
  yenidenDogrula(e);e.hatalar=[];
  if(crops)for(const [k,v] of crops)e.crops.set(k,v);
  S.denemeler.set(e.kod,e);return e;
}
/* ---------------------------------------------------------------- the student's own list (no pictures)
   For the student's Yanlışlar defteri tab: the teacher's app writes, into the student's package, per exam of this device's library
   (newest first, at most YO_SINAV) the questions the student got wrong or left empty, by ders: the A booklet number, the student's
   and the correct answer, the share of this school's students who answered it right, the share across the publisher's schools
   (Performans analizi, when added) and the question's konu (Konu Takibi's sınav özeti, when there). No booklet picture leaves the
   device. */
const YO_SINAV=15,yuzde=x=>x===null||x===undefined||!Number.isFinite(x)?null:Math.round(x*100);
const OKUL_P=new WeakMap();
// One section's questions over the given students, keyed by "test:A number": {dogru, n, p, sec}. n: the students who count for it (B students through the
// çözüm map, without it A students only; a cancelled question has no entry), p = dogru / n, sec: how many marked each option ('' = blank).
function bolumMaddeleri(e,b,kimler,m=new Map()){
  const r=e.rapor,ses=b.oturum||'TYT',hm=e.harita?.testler?.[b.test]||null;
  for(let q=0;q<b.n;q++){
    const a=b.off+q+1,sec={A:0,B:0,C:0,D:0,E:0,'':0};let dogru=0,n=0;
    for(const o of kimler){const kit=o.kits?o.kits[ses]:o.kit,own=kit==='B'?(hm?hm.aToB[a]:null):a;if(own===null||own===undefined)continue;
      const g=b.bas+(own-b.off-1),cvp=r.anahtar[kit]?.[g];if(!harfOK(cvp))continue;n++;const x=o.cev[g]||'';if(x===cvp)dogru++;if(x in sec)sec[x]++}
    if(n)m.set(b.test+':'+a,{dogru,n,p:dogru/n,sec});
  }
  return m;
}
// The whole school: every section over the students judged on its test (sayilanKural). Cached per report, matched report, map and alan list.
function okulMaddeleri(e){
  const r=e.rapor,es=e.es,k=es?sayilanKural(r,es):null,c=OKUL_P.get(r);
  if(c&&c.harita===e.harita&&c.es===es&&c.imza===k?.imza)return c.m;
  const m=new Map();
  (es?.bolumler||[]).forEach((b,i)=>bolumMaddeleri(e,b,r.ogrenciler.filter(o=>k.f(o).has(i)),m));
  OKUL_P.set(r,{harita:e.harita,es,imza:k?.imza,m});return m;
}
// The share of the school's students who answered each question right, keyed by "test:A number".
function okulOranlari(e){const m=new Map();for(const [k,v] of okulMaddeleri(e))m.set(k,v.p);return m}
// Cached (examKey|dersKey -> topicName[]) index over Konu Takibi's sınav özeti so publishing
// 200 students does not decompress and revalidate D.konutakibi tens of thousands of times.
let KONU_HARITA_ONBELLEK=null;
function konuHaritasi(){
  if(typeof KONU_TAKIBI==='undefined'||D.konutakibi===undefined)return null;
  const z=D.konutakibi,okuFn=KONU_TAKIBI.oku;
  const imza=(D.rev||0)+'|'+(z&&typeof z==='object'?Object.keys(z.zorluk||{}).length+':'+Object.keys(z.maps||{}).length:'');
  if(KONU_HARITA_ONBELLEK&&KONU_HARITA_ONBELLEK.ref===z&&KONU_HARITA_ONBELLEK.imza===imza&&KONU_HARITA_ONBELLEK.okuFn===okuFn)return KONU_HARITA_ONBELLEK.map;
  const v=okuFn().veri;if(!v)return null;
  const map=new Map();
  for(const e of Object.values(v.zorluk||{})){
    if(!e||!e.ozet)continue;
    const ek=KONU_TAKIBI.ek(e.ad||'');
    for(const [c,l] of Object.entries(e.ozet)){
      if(!Array.isArray(l))continue;
      const k=ek+'|'+KONU_TAKIBI.key(c);
      let arr=map.get(k);if(!arr){arr=[];map.set(k,arr);}
      for(let i=0;i<l.length;i++)if(!arr[i]&&Array.isArray(l[i])){
        const ad=l[i].map(cd=>KONU_TAKIBI.topicFor(c,cd,v.maps)).find(Boolean);
        if(ad)arr[i]=KONU_TAKIBI.topicName(ad);
      }
    }
  }
  KONU_HARITA_ONBELLEK={ref:z,imza,okuFn,map};
  return map;
}
// The question's konu from Konu Takibi (sınav özeti of the same exam and ders; A booklet order).
function konuBul(rapor,dersAd,k){
  try{
    const m=konuHaritasi();if(!m)return '';
    const arr=m.get(KONU_TAKIBI.ek(rapor.ad||'')+'|'+KONU_TAKIBI.key(dersAd));
    return (arr&&arr[k])||'';
  }catch(x){}
  return '';
}
function ogrenciListesi(no){
  if(no===undefined||no===null||no==='')return null;
  const sinavlar=[...S.denemeler.values()].filter(e=>e.rapor&&e.es).sort((a,b)=>String(b.tarih||'').localeCompare(String(a.tarih||''))).slice(0,YO_SINAV),out=[];
  for(const e of sinavlar){
    const o=e.rapor.ogrenciler.find(x=>String(x.no)===String(no));if(!o)continue;
    const d=defterKur(e.rapor,e.es,e.harita,o,acikBolumler(e.es,o,undefined,undefined,sayilanKural(e.rapor,e.es).f));if(!d.bolumler.length)continue;
    const op=okulOranlari(e),pm=perfHaritasi(e);
    out.push({ad:adOf(e),tarih:e.tarih||'',d:d.bolumler.map(b=>{const eb=e.es.bolumler[b.i],rb=e.rapor.bolumler[eb.ri??b.i]||{};
      return [b.ders,b.oturum,b.sorular.map(s=>{const ba=s.a===null?eb:(e.es.bolumler.find(x=>x.test===eb.test&&s.a>x.off&&s.a<=x.off+x.n)||eb),rba=e.rapor.bolumler[ba.ri??e.es.bolumler.indexOf(ba)]||rb,ak=s.a===null?null:s.a-ba.off-1;
        return [s.a!==null?String(s.a):'B-'+s.own,s.isaret||'',s.dogru,yuzde(s.a!==null?op.get(eb.test+':'+s.a):null),yuzde(okullarP(pm,ba,ak)),ak===null?'':konuBul(e.rapor,rba.ad||'',ak)]})]})});
  }
  return out.length?{v:1,s:out}:null;
}
/* ---------------------------------------------------------------- Deneme karnesi (2026-11-20): every question of the student, by difficulty
   For each exam, the student's questions on the tests they are judged on (sayilanKural; Ek Felsefe never): the number in the student's own booklet,
   the konu (Konu Takibi's sınav özeti, A booklet order; B students through the çözüm map), the difficulty band this page shows (zorlukBilgi: the
   publisher's network p when the Performans analizi is added; 0 Çok kolay … 4 Çok zor) and the result (1 doğru, 0 yanlış, -1 boş). The student's
   page adds them up by deneme, ders, konu, or lists the questions, over all or some of the exams; Hafızam's "Denemeye göre ayarla" reads the konu
   totals (HARITAM). Published only when the rehber turns it on (D.konuKarneYayin: {mod: 'hepsi' | 'secili', kodlar}); it goes in the student's
   package (ogrenciPaketi → konuKarne) as
     {v: 2, t, s: [[exam name, date, [konu names], [[ders, oturum, kitapçık, [[no, konu index or -1, band or -1, result], …]], …]], …]},
   newest first, at most YO_SINAV exams and KARNE_UST characters (older exams are left out first). No picture, no answer letter, no other student. */
const KARNE_UST=150000;
// The konu of each question of one report section, by its A booklet position (Konu Takibi's sınav özeti of the same exam and ders); '' where none.
function konuDizisi(rapor,dersAd,n){
  const out=Array.from({length:n},()=>'');
  try{
    const m=konuHaritasi();if(!m)return out;
    const arr=m.get(KONU_TAKIBI.ek(rapor.ad||'')+'|'+KONU_TAKIBI.key(dersAd));
    if(arr)for(let k=0;k<n;k++)if(arr[k])out[k]=arr[k];
  }catch(x){}
  return out;
}
const BANT_NO=b=>ZORLUK.BANTLAR.findIndex(x=>x[0]===b);
// One student's karne over the given exams; null when the student sat none of them.
function konuKarnesi(no,sinavlar){
  if(no===undefined||no===null||no==='')return null;
  const liste=[...sinavlar].filter(e=>e.rapor&&e.es).sort((a,b)=>String(b.tarih||'').localeCompare(String(a.tarih||''))).slice(0,YO_SINAV),out=[];
  for(const e of liste){
    const o=e.rapor.ogrenciler.find(x=>String(x.no)===String(no));if(!o)continue;
    const kural=sayilanKural(e.rapor,e.es).f(o),za=zorlukBilgi(e),konular=[],ki=new Map(),bolumler=[];
    e.es.bolumler.forEach((b,i)=>{
      if(!kural.has(i))return;
      const ri=b.ri??i,rb=e.rapor.bolumler[ri]||{},ses=b.oturum||'TYT',kit=o.kits?o.kits[ses]:o.kit,anahtar=e.rapor.anahtar[kit];if(!anahtar)return;
      const adlar=konuDizisi(e.rapor,rb.ad||'',b.n),sorular=[];
      for(let k=0;k<b.n;k++){
        const g=b.bas+k,dogru=anahtar[g];if(!harfOK(dogru))continue;
        const own=b.off+k+1,a=kit==='A'?own:(e.harita?.testler?.[b.test]?.bToA?.[own]??null);
        const ba=a===null?b:(e.es.bolumler.find(x=>x.test===b.test&&a>x.off&&a<=x.off+x.n)||b),ai=ba.ri??e.es.bolumler.indexOf(ba),rba=e.rapor.bolumler[ai]||rb,ak=a===null?null:a-ba.off-1;
        const konu=ak===null?'':(ba===b?adlar[ak]:konuBul(e.rapor,rba.ad||'',ak));if(konu&&!ki.has(konu)){ki.set(konu,konular.length);konular.push(konu)}
        const z=za?.map.get((a!==null?ai+':A:'+(ak+1):ri+':B:'+(k+1)))||null;
        sorular.push([own,konu?ki.get(konu):-1,z&&z.bant?BANT_NO(z.bant):-1,o.cev[g]===dogru?1:o.cev[g]?0:-1]);
      }
      if(sorular.length)bolumler.push([dersAdi(rb.ad||b.ders),ses,kit||'A',sorular]);
    });
    if(bolumler.length)out.push([adOf(e),e.tarih||'',konular,bolumler]);
  }
  const bayt=s=>typeof baytBoyu==='function'?baytBoyu(s):s.length;
  while(out.length>1&&bayt(JSON.stringify(out))>KARNE_UST)out.pop();
  return out.length?{v:2,t:typeof bugunNo==='function'?bugunNo():null,s:out}:null;
}
// The exams the rehber publishes: every exam of the library, or the ones chosen when it was turned on.
function karneSinavlari(y=D.konuKarneYayin){
  const tum=siraliDenemeler().filter(e=>e.rapor&&e.es);
  return y&&y.mod==='secili'&&Array.isArray(y.kodlar)?tum.filter(e=>y.kodlar.includes(e.kod)):tum;
}
const yayinGecerli=y=>!!y&&typeof y==='object'&&(y.mod==='hepsi'||(y.mod==='secili'&&Array.isArray(y.kodlar)&&y.kodlar.length>0));
// For the package: the student's karne when the rehber publishes it, else null.
function ogrenciKarnesi(no){return typeof D!=='undefined'&&yayinGecerli(D.konuKarneYayin)?konuKarnesi(no,karneSinavlari()):null}

/* The slides, shared by the rehber's preview and the student's page. karne: the package form; secim: {sinav: Set of exam indices or null (all),
   ders: '' or "TYT Türkçe", duzey: 'deneme' | 'ders' | 'konu' (default) | 'soru'}; yer: 'ogretmen' | 'ogrenci' (whose state the controls change). */
const KARNE_DUZEY=[['deneme','Denemeler'],['ders','Dersler'],['konu','Konular'],['soru','Sorular']];
const karneGecerli=k=>!!k&&k.v===2&&Array.isArray(k.s);
const bos5=()=>ZORLUK.BANTLAR.map(()=>[0,0]);
// The questions of the chosen exams and ders: [{sinav: index, ad, tarih, ders, oturum, kit, no, konu, z, d}].
function karneSorulari(karne,secim={}){
  const out=[];if(!karneGecerli(karne))return out;
  karne.s.forEach((s,i)=>{
    if(secim.sinav&&!secim.sinav.has(i)||!Array.isArray(s)||!Array.isArray(s[3]))return;
    const konular=Array.isArray(s[2])?s[2]:[];
    for(const b of s[3]){
      if(!Array.isArray(b)||typeof b[0]!=='string'||!Array.isArray(b[3]))continue;
      const ders=String(b[1]||'')+' '+b[0];if(secim.ders&&secim.ders!==ders)continue;
      for(const q of b[3])if(Array.isArray(q)&&Number.isInteger(q[0]))out.push({sinav:i,ad:String(s[0]||'Deneme'),tarih:String(s[1]||''),ders,dersAd:b[0],oturum:String(b[1]||''),kit:String(b[2]||'A'),no:q[0],
        konu:Number.isInteger(q[1])&&q[1]>=0&&typeof konular[q[1]]==='string'?konular[q[1]]:'',z:Number.isInteger(q[2])&&q[2]>=0&&q[2]<5?q[2]:-1,d:q[3]===1?1:q[3]===0?0:-1});
    }
  });
  return out;
}
// Totals of a group of questions: per band [right, all], unknown band, all, blank, exams.
function topla(qs){
  const t={bant:bos5(),bilinmeyen:[0,0],d:0,n:0,bos:0,sinav:new Set(qs.map(q=>q.sinav)).size};
  for(const q of qs){const h=q.z>=0?t.bant[q.z]:t.bilinmeyen,dg=q.d===1?1:0;h[0]+=dg;h[1]++;t.d+=dg;t.n++;if(q.d===-1)t.bos++}
  t.kd=t.bant[0][0]+t.bant[1][0];t.kn=t.bant[0][1]+t.bant[1][1];t.zd=t.bant[3][0]+t.bant[4][0];t.zn=t.bant[3][1]+t.bant[4][1];t.b=null;
  return t;
}
// Slides of one level, in the order met (newest exam first; booklet order within).
function karneTopla(karne,secim={},duzey='konu'){
  const qs=karneSorulari(karne,secim),grup=new Map(),anahtar={deneme:q=>q.sinav,ders:q=>q.ders,konu:q=>q.konu?q.ders+'|'+q.konu:null,soru:q=>q.sinav+'|'+q.ders}[duzey]||(q=>q.konu?q.ders+'|'+q.konu:null);
  for(const q of qs){const k=anahtar(q);if(k===null)continue;let g=grup.get(k);if(!g)grup.set(k,g={q,sorular:[]});g.sorular.push(q)}
  return [...grup.values()].map(({q,sorular})=>Object.assign(topla(sorular),{ad:duzey==='deneme'?q.ad:duzey==='ders'?q.ders:duzey==='soru'?q.ders:q.konu,
    ust:duzey==='deneme'?tarihYaz(q.tarih):duzey==='ders'?'':duzey==='soru'?q.ad+(tarihYaz(q.tarih)?' · '+tarihYaz(q.tarih):''):q.ders,sorular}));
}
function karneYorumu(t){
  const sv=typeof HARITAM!=='undefined'&&HARITAM.denemeSeviyesi?HARITAM.denemeSeviyesi(t):null;
  if(sv==='guclu')return ['iyi','Zor sorularını da yapıyorsun: bu konuyu biliyorsun.'];
  if(sv==='biliyor')return ['iyi','Soruların çoğunu doğru yapıyorsun.'];
  if(sv==='temel')return ['orta','Kolay sorularını yapıyorsun; zor sorularına çalış.'];
  if(t.kn&&t.kd<t.kn/2)return ['zayif','Kolay sorularda bile zorlanıyorsun: konuyu baştan tekrar et.'];
  return ['zayif','Bu konuyu tekrar etmeye değer.'];
}
const yz=(d,n)=>n?Math.round(100*d/n):null;
function olcuHTML(ad,d,n){
  const p=yz(d,n);
  return '<div class="kk-olcu"><span class="kk-etiket">'+ad+'</span>'+(n?'<b class="kk-yuzde">%'+p+'</b><span class="kk-say">'+d+' / '+n+' doğru</span><span class="kk-cubuk" aria-hidden="true"><span style="width:'+p+'%"></span></span>'
    :'<b class="kk-yuzde kk-yok">—</b><span class="kk-say">Bu denemelerde yoktu</span>')+'</div>';
}
// The five bands, one line each (a band with no question is shown with a dash), and the questions with no band.
const bantlarHTML=t=>'<table class="kk-bantlar"><caption class="kk-gizli">Zorluğa göre doğru</caption><tbody>'+ZORLUK.BANTLAR.map(([,ad],i)=>{const [d,n]=t.bant[i],p=yz(d,n);
  return '<tr'+(n?'':' class="kk-bant-yok"')+'><th scope="row">'+ad+'</th><td class="kk-bant-cubuk"><span class="kk-cubuk" aria-hidden="true"><span style="width:'+(p||0)+'%"></span></span></td><td>'+(n?d+' / '+n:'—')+'</td><td>'+(n?'%'+p:'')+'</td></tr>'}).join('')+
  (t.bilinmeyen[1]?'<tr class="kk-bant-yok"><th scope="row">Zorluğu bilinmiyor</th><td></td><td>'+t.bilinmeyen[0]+' / '+t.bilinmeyen[1]+'</td><td></td></tr>':'')+'</tbody></table>';
const SONUC=['Yanlış','Doğru'],sonucAd=d=>d===-1?'Boş':SONUC[d];
function slaytHTML(t,i,n,duzey){
  const ad=t.ad,ust=t.ust;
  const bas='<article class="kk-slayt'+(duzey==='soru'?' kk-slayt-genis':'')+'" aria-roledescription="slayt" aria-label="'+(i+1)+' / '+n+': '+h(ad)+'">'+(ust?'<p class="kk-ders">'+h(ust)+'</p>':'')+'<h3 class="kk-konu">'+h(ad)+'</h3>';
  const tum='<p class="kk-tum">Bütün sorular: <b>'+t.d+' / '+t.n+'</b> doğru'+(t.bos?' · '+t.bos+' boş':'')+(duzey!=='deneme'&&duzey!=='soru'?' · '+t.sinav+' deneme':'')+'</p>';
  if(duzey==='soru')return bas+tum+'<div class="kk-sorular"><table class="kk-soru-tablo"><thead><tr><th scope="col">Soru</th><th scope="col">Konu</th><th scope="col">Zorluk</th><th scope="col">Sonuç</th></tr></thead><tbody>'+
    t.sorular.map(q=>'<tr class="kk-s'+(q.d===1?'d':q.d===0?'y':'b')+'"><td><b>'+q.no+'</b>'+(q.kit==='B'?' <span class="kk-kit">B</span>':'')+'</td><td>'+h(q.konu||'—')+'</td><td>'+(q.z>=0?h(ZORLUK.BANTLAR[q.z][1]):'—')+'</td><td>'+sonucAd(q.d)+'</td></tr>').join('')+'</tbody></table></div></article>';
  const [tur,yorum]=duzey==='konu'?karneYorumu(t):[null,null];
  return bas+'<div class="kk-olculer">'+olcuHTML('Kolay sorular',t.kd,t.kn)+olcuHTML('Zor sorular',t.zd,t.zn)+'</div>'+bantlarHTML(t)+tum+(yorum?'<p class="kk-yorum kk-'+tur+'">'+h(yorum)+'</p>':'')+'</article>';
}
function karneHTML(karne,secim={},yer='ogrenci'){
  if(!karneGecerli(karne)||!karne.s.length)return '';
  const sinavlar=karne.s,secili=secim.sinav&&[...secim.sinav].some(i=>i<sinavlar.length)?secim.sinav:null,duzey=KARNE_DUZEY.some(x=>x[0]===secim.duzey)?secim.duzey:'konu';
  const dersler=[...new Set(karneSorulari(karne,{sinav:secili}).map(q=>q.ders))],ders=dersler.includes(secim.ders)?secim.ders:'';
  const liste=karneTopla(karne,{sinav:secili,ders},duzey),birim={deneme:'deneme',ders:'ders',konu:'konu',soru:'ders'}[duzey];
  const cip=(v,ad,bas,veri='kk-sinav')=>'<button type="button" class="kk-cip" data-'+veri+'="'+v+'" aria-pressed="'+bas+'">'+h(ad)+'</button>';
  const secimHTML='<div class="kk-sec"><span class="kk-sec-ad" id="kkDuzeyEtiket-'+yer+'">Göster</span><div class="kk-cipler" role="group" aria-labelledby="kkDuzeyEtiket-'+yer+'">'+KARNE_DUZEY.map(([v,ad])=>cip(v,ad,v===duzey,'kk-duzey')).join('')+'</div></div>'+
    '<div class="kk-sec"><span class="kk-sec-ad" id="kkSinavEtiket-'+yer+'">Denemeler</span><div class="kk-cipler" role="group" aria-labelledby="kkSinavEtiket-'+yer+'">'+cip('hepsi','Bütün denemeler ('+sinavlar.length+')',!secili)+
    sinavlar.map((s,i)=>cip(i,String(s[0]||'Deneme')+(tarihYaz(s[1])?' · '+tarihYaz(s[1]):''),!!secili&&secili.has(i))).join('')+'</div></div>'+
    (dersler.length>1?'<label class="kk-sec">Ders<select data-kk-ders>'+'<option value="">Bütün dersler</option>'+dersler.map(d=>'<option value="'+h(d)+'"'+(d===ders?' selected':'')+'>'+h(d)+'</option>').join('')+'</select></label>':'');
  return '<section class="kk" data-kk-yer="'+yer+'"><div class="kk-bas"><h2>Deneme karnen</h2><p class="kk-alt">Denemelerin, derslerin, konuların ve tek tek soruların: çok kolaydan çok zora her zorlukta kaç sorunun doğru olduğu. Zorluk, o soruyu bütün sınav okullarında doğru yapanların oranına göredir.</p></div>'+secimHTML+
    (liste.length?'<div class="kk-gezin"><button type="button" class="kk-ok" data-kk-git="-1" aria-label="Önceki">‹</button><span class="kk-sayac" aria-live="polite">'+liste.length+' '+birim+'</span><button type="button" class="kk-ok" data-kk-git="1" aria-label="Sonraki">›</button></div>'+
      '<div class="kk-seri" tabindex="0" aria-label="Slaytlar">'+liste.map((t,i)=>slaytHTML(t,i,liste.length,duzey)).join('')+'</div>'
      :'<p class="kk-alt">'+(duzey==='konu'?'Seçilen denemelerde konusu bilinen soru yok.':'Seçilen denemelerde soru yok.')+'</p>')+'</section>';
}
// The slides' controls on either page. The state: the student's EK.kk, the rehber's S.kk; the page draws again.
function karneSecimi(yer){const st=yer==='ogretmen'?(S.kk=S.kk||{}):(EK.kk=EK.kk||{});return st}
function karneCiz(yer,odak){if(yer==='ogretmen')render(odak);else if(typeof ciz==='function'){ciz();document.querySelector('.kk '+odak)?.focus()}}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('click',ev=>{
    const el=ev.target&&ev.target.closest?ev.target.closest('[data-kk-sinav],[data-kk-git],[data-kk-duzey]'):null,kok=el&&el.closest('.kk');if(!kok)return;
    if(el.dataset.kkGit){const seri=kok.querySelector('.kk-seri'),s1=seri&&seri.querySelector('.kk-slayt');if(seri&&s1)seri.scrollBy({left:(+el.dataset.kkGit)*(s1.getBoundingClientRect().width+12),behavior:'smooth'});return}
    const yer=kok.dataset.kkYer,st=karneSecimi(yer);
    if(el.dataset.kkDuzey){if(KARNE_DUZEY.some(x=>x[0]===el.dataset.kkDuzey))st.duzey=el.dataset.kkDuzey;karneCiz(yer,'[data-kk-duzey="'+st.duzey+'"]');return}
    const v=el.dataset.kkSinav;
    if(v==='hepsi')st.sinav=null;else{const s=new Set(st.sinav||[]),i=+v;if(s.has(i))s.delete(i);else s.add(i);st.sinav=s.size?s:null}
    karneCiz(yer,'[data-kk-sinav="'+v+'"]');
  });
  document.addEventListener('change',ev=>{
    const el=ev.target,kok=el&&el.matches&&el.matches('[data-kk-ders]')?el.closest('.kk'):null;if(!kok)return;
    const yer=kok.dataset.kkYer;karneSecimi(yer).ders=el.value;karneCiz(yer,'[data-kk-ders]');
  });
}
// The rehber's view: what goes to the students, which exams, and one student's slides as the student will see them.
function karneGorunum(exU){
  const salt=typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme(),y=yayinGecerli(D.konuKarneYayin)?D.konuKarneYayin:null;
  const tum=siraliDenemeler().filter(e=>e.rapor&&e.es),secili=tum.filter(e=>e.sec);
  const mod=y?y.mod:(S.kkMod==='secili'?'secili':'hepsi'),ex=y?karneSinavlari(y):mod==='secili'?secili:tum;
  const cip=(v,ad)=>'<button type="button" class="yd-chip" data-yd-kk-mod="'+v+'" aria-pressed="'+(mod===v)+'"'+(salt||(v==='secili'&&!secili.length)?' disabled':'')+'>'+h(ad)+'</button>';
  const yayinAd=y?(y.mod==='hepsi'?'bütün denemeler':ex.map(adOf).join(', ')||'seçilen denemeler bu cihazda yok'):'';
  const fark=y&&y.mod==='secili'&&(secili.map(e=>e.kod).sort().join()!==[...y.kodlar].sort().join());
  const bulut=typeof window!=='undefined'&&window.bulut&&window.bulut.yapilandirilmis;
  const kisiler=kisiTemel(ex.filter(e=>e.es)),no=kisiler.some(k=>k.no===S.kkOgr)?S.kkOgr:(kisiler[0]?.no||'');
  const karne=no?konuKarnesi(no,ex):null;
  const durum=y?'<p class="yd-kk-durum"><b>Öğrencilere gidiyor:</b> '+h(yayinAd)+'. Öğrenciler, öğrenci girişlerini yayınladığınızda alır.</p>'
    :'<p class="yd-kk-durum">Henüz öğrencilere gitmiyor.</p>';
  const dugmeler=salt?'':'<div class="yd-arac">'+(y?(fark?'<button type="button" class="et-dugme" data-yd-kk-guncelle>Seçili denemelerle güncelle</button>':'')+'<button type="button" class="et-dugme" data-yd-kk-kaldir>Yayından kaldır</button>'
    :'<button type="button" class="et-dugme birincil" data-yd-kk-yayinla'+(ex.length?'':' disabled')+'>Öğrenciye yayınla</button>')+
    (y&&bulut?'<button type="button" class="et-dugme birincil" id="ogrenciHesapYayinla">Öğrenci girişlerini yayınla</button>':'')+'</div>';
  const ogrSel='<label class="yd-sec">Önizleme: öğrenci<select data-yd-f="kkOgr">'+kisiler.map(k=>'<option value="'+h(k.no)+'"'+(k.no===no?' selected':'')+'>'+h(k.ad+' · '+k.no)+'</option>').join('')+'</select></label>';
  return '<section class="yd-kk-yayin"><p class="yd-yardim">Her öğrenciye kendi deneme karnesi gider: her denemede, derste, konuda ve tek tek her soruda çok kolaydan çok zora her zorlukta kaç sorunun doğru olduğu. Öğrenci bunu kendi Yanlışlar defterinde slayt olarak görür; Hafızam’daki “Denemeye göre ayarla” da konulardan öğrencinin bildiklerini aklında gösterir, hiçbir konuyu düşürmez. Zorluk bu sayfadaki soru zorluğundan (performans analizi eklendiyse Türkiye geneli), konular Konu Takibi’nin sınav özetinden gelir. Soru resimleri, cevap harfleri ve başka öğrenciler gitmez.</p>'+
    '<div class="yd-sec"><span id="ydKkEtiket">Hangi denemeler</span><div class="yd-chips" role="group" aria-labelledby="ydKkEtiket">'+cip('hepsi','Bütün denemeler ('+tum.length+')')+cip('secili','Seçili denemeler ('+secili.length+')')+'</div></div>'+
    durum+dugmeler+'</section>'+
    (kisiler.length?'<div class="yd-filtre">'+ogrSel+'</div>':'')+
    (karne?karneHTML(karne,S.kk||{},'ogretmen'):'<p class="yd-bos">'+(no?'Bu öğrencinin seçilen denemelerde sorusu yok.':'Seçilen denemelerde öğrenci yok.')+'</p>');
}
return {farkModeli,konuKarnesi,ogrenciKarnesi,karneHTML,karneTopla,karneSorulari,karneSinavlari,karneYayinla,karneModu,konuDizisi,farkPlan,dersPlani,farkPdfIndir,farkDosyaAdi,farkSorusu,farkCumle,ekli,farkZ,sinavAnahtari,ESIKLER,okulMaddeleri,bolumMaddeleri,sayilanKural,ogrenciListesi,okulOranlari,dersAdi,dersOnek,kitapcikCoz,raporCoz,esle,esOturum,cozumEtiketleri,ortalamaCoz,ortalamaDogrula,performansCoz,performansMi,performansDogrula,etiketler,haritaKur,defterKur,difficultyIndex,zorlukAnaliz,filterDefter,acikBolumler,ogrAlani,oturumKume,soruKirp,
  dosyalarEkle,topluUygula,dosyaTani,pdfTuru,denemeKoy,kutuphaneKur,kutAc,sakla,geriYukle,metaOf,denemeSil,hepsiniSil,bellekiBosalt,sifirla,birlesik,kisiPlani,pdfPlan,pdfDosyaAdi,pdfIndir,boyutYaz,
  gorunum,yazdir,hazirla,durumu,key,title,kitAc,kitKapat};
})();
function gorunumYanlislar(){return YANLISLAR.gorunum()}
// The student's own Yanlışlar defteri: the list the teacher's app sent (D.yanlisListe), exam by exam and ders by ders, each question
// with the student's and the correct answer, how many in the school and across the publisher's schools answered it right, and its konu.
function gorunumYanlisListem(){
  const L=D.yanlisListe,bas='<div class="baslik"><h1>Yanlışlar defteri</h1><p>Yanlış ya da boş bıraktığın sorular. Kitapçığını açıp yeniden çöz.</p></div>';
  // Deneme karnesi: the slides first (the rehber's choice of exams; the student picks all or some of them, and deneme, ders, konu or soru, here).
  const karne=D.konuKarne?'<div class="kart yl-karne">'+YANLISLAR.karneHTML(D.konuKarne,EK.kk||{},'ogrenci')+'</div>':'';
  if(!L||L.v!==1||!Array.isArray(L.s)||!L.s.length)return bas+karne+(karne?'':'<div class="kart" style="padding:20px">Henüz liste yok. Öğretmenin deneme dosyalarını ekleyip planını yayınladığında burada görünür.</div>');
  const yz=v=>v===null||v===undefined?'—':'%'+v;
  return bas+karne+'<div class="arac"><button type="button" class="dugme" id="yanlisYazdir">Yazdır / PDF</button></div>'+L.s.map(s=>{
    const n=s.d.reduce((t,d)=>t+d[2].length,0);
    return '<section class="kart yl-sinav"><h2>'+kacis(s.ad)+' <span class="mini">'+(s.tarih?kacis(s.tarih.split('-').reverse().join('.'))+' · ':'')+n+' soru</span></h2>'+
      s.d.map(([ders,ot,l])=>'<h3>'+kacis(ders)+' <span class="mini">'+kacis(ot)+' · '+l.length+'</span></h3><table class="yl-tablo"><thead><tr><th>Soru</th><th>Senin</th><th>Doğru</th><th title="Okulundaki öğrencilerden bu soruyu doğru yapanlar">Okulunda doğru</th><th title="Sınava giren bütün okullarda bu soruyu doğru yapanlar">Sınav okullarında doğru</th><th>Konu</th></tr></thead><tbody>'+
        l.map(([no,sen,dogru,okul,tr,konu])=>'<tr><td><b>'+kacis(no)+'</b></td><td class="'+(sen?'yl-yanlis':'yl-bos')+'">'+(sen?kacis(sen):'boş')+'</td><td><b>'+kacis(dogru)+'</b></td><td>'+yz(okul)+'</td><td>'+yz(tr)+'</td><td>'+kacis(konu||'')+'</td></tr>').join('')+'</tbody></table>').join('')+'</section>';
  }).join('')+'<p class="mini">Okulunda doğru: okulundaki öğrencilerden bu soruyu doğru yapanların yüzdesi. Sınav okullarında doğru: yayınevinin bu sınava giren bütün okullardaki yüzdesi. Öğretmeninin son yayınından.</p>';
}
