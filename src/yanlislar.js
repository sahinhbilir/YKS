// Teacher-only "Yanlışlar defteri". Embedded by scripts/embed-yanlislar.cjs. See docs/yanlislar-defteri.md.
// Three files of one exam are read in the browser and printed as one defter per student. Nothing from them is stored:
// not in localStorage, not in the notebook D, not in Firestore, and nothing is sent anywhere. No personal data belongs in this file.
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
const KOD=/^\d{4}-\d{2}-[A-Z]+\/(.+)-\d{3,5}$/u;
const KODTAM=/^\d{4}-\d{2}-([A-Z]+)\/.+-(\d{3,5})$/u;
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
    const c=p.items.find(x=>KOD.test(x.s)&&x.y>p.h-70);p.kod=c?KOD.exec(c.s)[1]:null;p.kodItem=c||null;p.tam=c?KODTAM.exec(c.s):null;
    if(!p.kod)return;const last=runs.at(-1);
    if(last&&last.kod===p.kod&&last.son===i-1)last.son=i;
    else{if(runs.some(r=>r.kod===p.kod))fail('Test sayfaları kesintili ('+p.kod+').');runs.push({kod:p.kod,ilk:i,son:i})}
  });
  if(!runs.length)fail('Bu PDF bir soru kitapçığına benzemiyor (sayfa üst bilgisi bulunamadı).');
  // The session (TYT / AYT) and the exam number come from the header code of the pages: "2026-27-TYT/TÜR-1203".
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
    let ad='';
    for(const row of pre.values())for(const v of row.values()){const m=/S[ıi]nav\s*:\s*([^|]+)/iu.exec(v);if(m&&!ad)ad=clean(m[1])}
    return {oturum,bolumler,T:bas,anahtar,ogrenciler,ad};
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
  return {ad,sinavNo:sayiOf(ad)||'',oturumlar:parcalar.map(p=>p.oturum),bolumler,T:toplam,anahtar,ogrenciler};
}

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
    if(kit.sinav&&rapor.sinavNo&&kit.sinav!==rapor.sinavNo)fail(ses+' soru kitapçığı '+kit.sinav+' numaralı sınava ait, cevap raporu '+rapor.sinavNo+' numaralı sınav ('+rapor.ad+').');
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
// A student has one booklet per session (kits: {TYT:'A', AYT:'B'}); sections of a session the student did not sit are left out.
// i = the section's index in the report, k = the question's position in the section (own booklet), ak = the same for the A booklet.
function defterKur(rapor,es,harita,ogr,acik){
  const say=i=>{const b=es.bolumler[i];return ogr.cev.slice(b.bas,b.bas+b.n).filter(Boolean).length};
  const atla=new Set();
  for(const [d,f] of es.ciftler||(es.cift?[es.cift]:[])){const sd=say(d),sf=say(f);if(sd===0&&sf>0)atla.add(d);if(sf===0&&sd>0)atla.add(f)}
  const bolumler=[];let yanlis=0,bos=0;
  es.bolumler.forEach((b,i)=>{
    const ses=b.oturum||ogr.oturumlar?.[0]||'TYT';
    if(atla.has(i)||(acik&&!acik.has(i))||(ogr.oturumlar&&!ogr.oturumlar.includes(ses)))return;
    const kit=ogr.kits?ogr.kits[ses]:ogr.kit,anahtar=rapor.anahtar[kit],sorular=[];
    for(let k=0;k<b.n;k++){
      const g=b.bas+k,isaret=ogr.cev[g],dogru=anahtar[g];
      if(!harfOK(dogru)||isaret===dogru)continue;
      const own=b.off+k+1,a=kit==='A'?own:(harita?.testler[b.test]?.bToA[own]??null);
      sorular.push({test:b.test,i:b.ri??i,k,ak:a===null?null:a-b.off-1,own,a,b:kit==='B'?own:null,isaret,dogru,durum:isaret?'yanlis':'bos'});
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
const ORT_BASLIK=/^(\d{1,3}-[A-Z]+-\d{3,5})\s*,\s*(.+?)\s+Dersi\s+Net\s+S[ıi]ral[ıi]\s+Liste\s*_\s*(\d{1,3})\s*Soru\s*_/iu;
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
  const no=(/(\d{3,5})$/u.exec(ort.kod)||[])[1];
  if(rapor.sinavNo&&no!==rapor.sinavNo)fail('Sınav kodları uyuşmuyor: ders ortalamaları dosyası '+ort.kod+' sınavına ait, cevap raporu '+(rapor.ad||rapor.sinavNo)+' sınavı.');
  const map=new Map(ort.dersler.map(d=>[key(d.ad),d]));let eslesen=0;
  for(const b of rapor.bolumler){
    const d=map.get(key(b.ad));if(!d)continue;
    if(d.n!==b.n)fail('Soru sayıları uyuşmuyor: '+b.ad+' için cevap raporunda '+b.n+', ders ortalamaları dosyasında ('+ort.kod+') '+d.n+' soru var.');
    eslesen++;
  }
  if(!eslesen)fail('Cevap raporundaki derslerin hiçbiri dosyada ('+ort.kod+') bulunamadı.');
  return map;
}
/* ---------------------------------------------------------------- Soru zorluğu ve madde kalitesi (src/zorluk.js)
   Computed here, in memory, from the report's own answers: correct = 1, wrong or blank = 0. With a valid A <-> B map the A and B students are pooled on
   A numbering; without it each booklet is analysed on its own numbers. Whoever left the whole section blank did not take it. A cancelled question
   (a key that is not A-E) is left out of the totals. dis = the school's Madde Analizi (difficultyIndex) for the optional rank correlation. */
function zorlukAnaliz(rapor,es,harita,dis,ort){
  const ortMap=ort?new Map(ort.dersler.map(d=>[key(d.ad),d])):null;
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
      const od=ortMap?ortMap.get(key(b.ad)):null;
      if(od&&od.n===b.n)ZORLUK.capala(a,od.genel,od.n);
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
const zAnahtar=s=>s.i+':'+(s.a!==null?'A:'+(s.ak+1):'B:'+(s.k+1));
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
/* ---------------------------------------------------------------- Screen and print. State lives only in this page's memory. */
const OLCEK=2,BOSLUK=8;
const S={kitlar:{},kitDurum:{},rapor:null,es:null,pairs:{},cozum:{},cozDurum:{},harita:null,ort:null,durum:{kit:'',rapor:'',coz:'',ort:''},hata:{kit:'',rapor:'',coz:'',ort:''},sube:'',ogr:'',status:'all',bantlar:null,kendi:false,kapali:new Set(),crops:new Map(),jeton:0,hazir:Promise.resolve(),ilerleme:'',mesgul:'',zOnbellek:null};
const h=s=>kacis(String(s??''));
const rehber=()=>typeof rehberMi==='function'&&rehberMi();
const etkin=()=>EK.sekme==='yanlislar'&&rehber()&&!!document.getElementById('ydKok');
function kitapBirak(kit){if(kit?.pdf){try{kit.pdf.destroy()}catch(e){}}}
function resimleriBirak(){for(const c of S.crops.values())try{URL.revokeObjectURL(c.url)}catch(e){}S.crops=new Map()}
const kitVar=()=>Object.keys(S.kitlar).length>0;
// The booklet of a (merged) test number: its session's kit and the test's number inside that kit.
function testBul(t){for(const [ses,[a,b]] of Object.entries(S.es.aralik))if(t>=a&&t<b)return {kit:S.kitlar[ses],t:t-a,ses};return null}
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
const adet=kit=>kit.testler.reduce((a,t)=>a+t.soru,0);
const kitDurumYaz=()=>{S.durum.kit=Object.entries(S.kitlar).sort((a,b)=>(a[0]==='AYT')-(b[0]==='AYT')).map(([ses,k])=>S.kitDurum[ses]).join('\n')};
const cozDurumYaz=()=>{S.durum.coz=Object.keys(S.cozum).sort((a,b)=>(a==='AYT')-(b==='AYT')).map(ses=>S.cozDurum[ses]).join('\n')};
// The çözüm maps of the sessions as one table indexed by the merged test number (null where a session has none).
function haritaBirlestir(){
  const ks=Object.keys(S.cozum);
  if(!ks.length||!S.es){S.harita=null;return}
  const testler=Array(S.es.testler.length).fill(null);let adet=0;
  for(const ses of ks){const [a]=S.es.aralik[ses];S.cozum[ses].testler.forEach((t,i)=>{testler[a+i]=t});adet+=S.cozum[ses].adet}
  S.harita={testler,adet};
}
// A new file is accepted only if it fits the others; otherwise nothing changes except the message.
async function yukle(tur,file){
  S.hata[tur]='';
  try{
    if(tur==='kit'){
      const {pages,pdf}=await pdfOku(file,true);let kit;
      try{kit=kitapcikCoz(pages)}catch(e){await pdf.destroy();throw e}
      kit.pdf=pdf;kit.onbellek=new Map();kit.sayfa=pages.length;kit.ofset=pages.map(p=>[p.ox,p.oy]);
      const ses=kit.oturum||(S.rapor?.oturumlar.length===1?S.rapor.oturumlar[0]:'TYT');kit.oturum=ses;
      const kitlar={...S.kitlar,[ses]:kit};
      let es=null;if(S.rapor){try{es=esle(S.rapor,kitlar)}catch(e){await pdf.destroy();throw new Error(e.message+' Soru kitapçığı eklenmedi.')}}
      kitapBirak(S.kitlar[ses]);resimleriBirak();S.kitlar=kitlar;S.es=es;S.kitDurum[ses]='✓ '+ses+' · '+kit.sayfa+' sayfa · '+adet(kit)+' soru';kitDurumYaz();
      yenidenDogrula();
    }else if(tur==='rapor'){
      if(file.size>15*1024*1024)throw new Error('Excel dosyası en fazla 15 MB olabilir.');
      const rapor=await raporCoz(new Uint8Array(await file.arrayBuffer()));
      let es=null;if(kitVar()){try{es=esle(rapor,S.kitlar)}catch(e){throw new Error(e.message+' Cevap raporu eklenmedi.')}}
      S.rapor=rapor;S.es=es;S.sube='';S.ogr='';S.kapali=new Set();S.zOnbellek=null;S.durum.rapor='✓ '+rapor.ogrenciler.length+' öğrenci'+(rapor.ad?' · '+rapor.ad:'')+(rapor.oturumlar.length>1?' · '+rapor.oturumlar.join(' + '):'');
      yenidenDogrula();
    }else if(tur==='ort'){
      if(!S.rapor)throw new Error('Önce cevap raporunu yükleyin.');
      const ort=ortalamaCoz((await pdfOku(file,false)).pages);ortalamaDogrula(ort,S.rapor);
      S.ort=ort;S.zOnbellek=null;S.durum.ort='✓ '+ort.dersler.length+' ders · genel ortalama';
    }else{
      if(!kitVar()||!S.rapor||!S.es)throw new Error('Önce soru kitapçığını ve cevap raporunu yükleyin.');
      const {pages}=await pdfOku(file,false),pairs=cozumEtiketleri(pages);
      // The file belongs to the session whose question count it matches (TYT 120, AYT 160 …); the first that validates takes it.
      const adaylar=S.es.oturumlar.filter(ses=>esOturum(S.es,ses).testler.reduce((a,b)=>a+b,0)===pairs.length);
      let ilk=null,bulundu=null;
      for(const ses of adaylar.length?adaylar:S.es.oturumlar.slice(0,1)){
        try{bulundu={ses,harita:haritaKur(pairs,esOturum(S.es,ses),S.rapor)};break}catch(e){ilk=ilk||e}
      }
      if(!bulundu)throw ilk;
      S.pairs[bulundu.ses]=pairs;S.cozum[bulundu.ses]=bulundu.harita;S.cozDurum[bulundu.ses]='✓ '+bulundu.ses+' · '+bulundu.harita.adet+' soru eşleşmesi';
      haritaBirlestir();cozDurumYaz();
    }
  }catch(e){S.hata[tur]=e.message}
}
// The çözüm files are checked against whatever booklets and report are current; one that no longer fits is dropped.
function yenidenDogrula(){
  if(S.ort){try{ortalamaDogrula(S.ort,S.rapor)}catch(e){S.hata.ort=e.message;S.ort=null;S.durum.ort='';S.zOnbellek=null}}
  for(const ses of Object.keys(S.pairs)){
    try{if(!S.es||!S.es.aralik[ses])throw new Error('');S.cozum[ses]=haritaKur(S.pairs[ses],esOturum(S.es,ses),S.rapor);S.cozDurum[ses]='✓ '+ses+' · '+S.cozum[ses].adet+' soru eşleşmesi'}
    catch(e){if(e.message)S.hata.coz=e.message;delete S.pairs[ses];delete S.cozum[ses];delete S.cozDurum[ses]}
  }
  haritaBirlestir();cozDurumYaz();
}
const ogrenciler=()=>S.rapor.ogrenciler.filter(o=>(!S.sube||o.sube===S.sube)&&(!S.ogr||String(o.id)===S.ogr)).sort((a,b)=>a.sube.localeCompare(b.sube,'tr',{numeric:true})||a.ad.localeCompare(b.ad,'tr'));
// The school's own per-question success rates (Konu Takibi → Madde Analizi) of the same exam, only for the rank correlation in the section line.
const difficultySources=()=>Object.entries(D?.konutakibi?.zorluk||{}).filter(([,e])=>e?.madde);
function selectedDifficulty(){const matches=difficultySources().filter(([,e])=>key(e.ad)===key(S.rapor?.ad));return matches.length===1?matches[0][1]:null}
const difficultyContext=()=>difficultyIndex(S.rapor,S.es,selectedDifficulty());
function zorlukBilgi(){
  if(!S.rapor)return null;
  const kaynak=S.es?selectedDifficulty():null,c=S.zOnbellek;
  if(c&&c.rapor===S.rapor&&c.es===S.es&&c.harita===S.harita&&c.kaynak===kaynak&&c.ort===S.ort)return c.v;
  const dis=S.es&&kaynak?difficultyIndex(S.rapor,S.es,kaynak):null;
  const v=zorlukAnaliz(S.rapor,S.es,S.harita,dis&&dis.map.size?dis:null,S.ort);S.zOnbellek={rapor:S.rapor,es:S.es,harita:S.harita,kaynak,ort:S.ort,v};return v;
}
// Kendi seviyesi: the student's tier in the ders (within the grade) picks a window of difficulty bands (ZORLUK.kademePenceresi), added to the chips; without a tier, the Orta band.
function kendiSeviyesi(ogr,b){
  const kd=typeof KADEME!=='undefined'?KADEME.kodDers(S.rapor.bolumler[b.ri].ad):null,t=kd?KADEME.kademeBilgi(ogr.no,kd.oturum,kd.kod):null;
  return ZORLUK.kademePenceresi(t?t.kademe:null,t?t.H:null).map(i=>ZORLUK.BANTLAR[i][0]);
}
const defterler=()=>{
  const za=zorlukBilgi(),acik=new Set(S.es.bolumler.map((b,i)=>i).filter(i=>!S.kapali.has(i)));
  return ogrenciler().map(o=>filterDefter(defterKur(S.rapor,S.es,S.harita,o,acik),{status:S.status,bantlar:S.bantlar,kendi:S.kendi?kendiSeviyesi:null},za));
};

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
  let n=0;const kitlar=S.kitlar;
  for(const [t,no] of liste){
    if(my!==S.jeton||kitlar!==S.kitlar)return;
    const k=t+':'+no;
    if(!S.crops.has(k)){try{const f=testBul(t);S.crops.set(k,await soruKirp(f.kit,f.t,no))}catch(e){S.hata.kit='Soru '+no+' kesilemedi: '+e.message;break}}
    n++;S.ilerleme=n<liste.length?'Sorular hazırlanıyor… '+n+'/'+liste.length:'';
    if(my!==S.jeton)return;
    for(const img of document.querySelectorAll('img[data-yd="'+k+'"]')){const c=S.crops.get(k);if(c){img.src=c.url;img.removeAttribute('data-bekle')}}
    const st=document.getElementById('ydIlerleme');if(st)st.textContent=S.ilerleme;
  }
}
function hazirla(){
  if(!kitVar()||!S.rapor||!S.es||typeof document==='undefined')return S.hazir;
  const my=++S.jeton,gerek=new Map();
  for(const d of defterler())for(const b of d.bolumler)if(b.gorsel)for(const s of b.sorular){const k=s.test+':'+s.a;if(!S.crops.has(k)&&!gerek.has(k))gerek.set(k,[s.test,s.a])}
  const sayfa=x=>{const f=testBul(x[0]);return f.kit.testler[f.t].sorular[x[1]-1].parcalar[0].p};
  const liste=[...gerek.values()].sort((x,y)=>testBul(x[0]).ses===testBul(y[0]).ses?sayfa(x)-sayfa(y)||x[0]-y[0]||x[1]-y[1]:x[0]-y[0]);
  S.hazir=S.hazir.then(()=>calis(my,liste)).catch(()=>{});
  return S.hazir;
}

/* Markup */
// A small label next to the question: "Zor", or "Zor?" where the band is not certain. A question without a label shows nothing.
const zHap=z=>z&&z.bant?'<span class="yd-zorluk yd-z-'+z.bant+(z.belirsiz?' yd-belirsiz':'')+(z.dusuk?' yd-dusuk':'')+'"'+(z.dusuk?' title="Güvenilirlik düşük"':'')+'>'+h(ZORLUK.etiketYazi(z.bant,z.belirsiz))+'</span>':'';
function soruHTML(s,gorsel){
  const etiket='Soru '+(s.a??s.own),ek=s.b!==null&&s.a!==null?' (B kitapçığında '+s.b+')':'',hap=zHap(s.z);
  if(!gorsel)return '<li class="yd-satir"><b>Soru '+s.own+'</b>'+hap+'</li>';
  const c=S.crops.get(s.test+':'+s.a),genis=testBul(s.test).kit.testler[testBul(s.test).t].sorular[s.a-1].genis;
  return '<figure class="yd-soru'+(genis?' yd-genis':'')+'"><figcaption><span><b>'+etiket+'</b>'+ek+'</span>'+hap+'</figcaption><img alt="'+etiket+'" data-yd="'+s.test+':'+s.a+'"'+(c?' src="'+c.url+'"':' data-bekle="1"')+'></figure>';
}
// The last page: the student's own answers next to the key, one small table per ders (the student's own question numbers).
const cevapTablosu=b=>'<table class="yd-cevap"><caption>'+h(b.ders)+'</caption><thead><tr><th scope="col">Soru</th><th scope="col">Senin cevabın</th><th scope="col">Doğru cevap</th></tr></thead><tbody>'+
  b.sorular.map(s=>'<tr><td>'+s.own+'</td><td>'+(s.durum==='bos'?'Boş':h(s.isaret))+'</td><td>'+h(s.dogru)+'</td></tr>').join('')+'</tbody></table>';
function ogrHTML(d){
  const o=d.ogr,toplam=d.bolumler.reduce((a,b)=>a+b.sorular.length,0);
  const kimlik='Öğrenci No <b>'+h(o.no)+'</b> · '+h(o.sube)+(S.rapor.ad?' · '+h(S.rapor.ad):'');
  const sayi='<b>'+d.yanlis+'</b> yanlış · <b>'+d.bos+'</b> boş';
  const ust='<header class="yd-ust"><h2>'+h(o.ad)+'</h2><p class="yd-kimlik">'+kimlik+'</p><p class="yd-say">'+sayi+'</p>'+(d.filterText?'<p class="yd-kimlik">'+h(d.filterText)+'</p>':'')+'</header>';
  if(!toplam)return '<article class="yd-ogr yd-yok" data-yd-ogr="'+o.id+'">'+ust+'<p class="yd-not">'+(d.filtreli?'Seçilen filtrelerde soru yok.':'Yanlış veya boş soru yok.')+'</p></article>';
  const dersler=d.bolumler.map(b=>'<section class="yd-ders"><h3>'+h(b.ders)+' <span>'+b.sorular.length+'</span></h3>'+(b.gorsel?'<div class="yd-sorular">'+b.sorular.map(s=>soruHTML(s,true)).join('')+'</div>':'<ul class="yd-liste">'+b.sorular.map(s=>soruHTML(s,false)).join('')+'</ul>')+'</section>').join('');
  const notlar=[...new Set(d.bolumler.filter(b=>!b.gorsel).map(b=>b.kit))];
  const not=notlar.length?'<p class="yd-not">'+notlar.join(', ')+' kitapçığı: sorular kendi kitapçığından çözülecek</p>':'';
  const cevap='<section class="yd-anahtar"><h2>Cevaplar</h2><p class="yd-kimlik">'+h(o.ad)+' · '+kimlik+'</p><div class="yd-cevaplar">'+d.bolumler.map(cevapTablosu).join('')+'</div></section>';
  return '<article class="yd-ogr" data-yd-ogr="'+o.id+'">'+ust+not+dersler+cevap+'</article>';
}
const durumSatiri=(tur,ad,id)=>'<div class="yd-dosya"><label class="et-dugme'+(S.durum[tur]?'':' birincil')+'">'+ad+'<input id="'+id+'" type="file" accept="'+(tur==='rapor'?'.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf,.pdf')+'"'+(tur==='kit'||tur==='coz'?' multiple':'')+' class="yd-file"'+(S.mesgul?' disabled':'')+'></label><span class="yd-durum">'+(S.mesgul===tur?'Okunuyor…':S.durum[tur].split('\n').map(h).join('<br>'))+'</span>'+(S.hata[tur]?'<span class="yd-hata" role="alert">'+h(S.hata[tur])+'</span>':'')+'</div>';
const f2=v=>ZORLUK.sayi(v);
// Madde kalitesi: on screen only (not printed). One compact table per ders and booklet group; the row of a flagged question is marked.
function analizHTML(za){
  const gruplar=za.bolumler.flatMap(b=>b.gruplar.map(g=>({b,g})));
  if(!gruplar.length)return '';
  const satir=(m,capa)=>'<tr'+(m.bayrak.length?' class="yd-isaretli"':'')+'><td>'+(m.i+1)+'</td>'+(m.iptal?'<td colspan="'+(capa?5:4)+'">İptal</td>':'<td>'+f2(m.p)+'</td><td>'+f2(m.rel)+'</td><td>'+f2(m.rit)+'</td>'+(capa?'<td>'+(m.bant?h(ZORLUK.etiketYazi(m.bant,m.belirsiz)):'—')+'</td>':'')+'<td>'+h(m.bayrak.join(' · '))+'</td>')+'</tr>';
  return '<section class="yd-analiz"><h2>Madde kalitesi</h2>'+gruplar.map(({b,g})=>'<details class="yd-kalite"><summary>'+h(g.satir)+'</summary><div class="et-kaydir"><table class="et-tablo" aria-label="Madde kalitesi · '+h(b.ders)+'"><thead><tr><th scope="col">Soru</th><th scope="col">p</th><th scope="col">b</th><th scope="col">r<sub>it</sub></th>'+(g.a.capa?'<th scope="col">Genele göre</th>':'')+'<th scope="col">İşaret</th></tr></thead><tbody>'+
    g.a.maddeler.map(m=>satir(m,!!g.a.capa)).join('')+'</tbody></table></div></details>').join('')+'</section>';
}
const chipHtml=(k,ad,secili)=>'<button type="button" class="yd-chip" data-yd-z="'+k+'" aria-pressed="'+secili+'">'+h(ad)+'</button>';
function content(){
  const top='<div class="yd-bas et-bas"><h1 class="et-baslik">Yanlışlar defteri</h1></div><div class="yd-dosyalar">'+durumSatiri('kit','Soru kitapçığı (A)','ydKit')+durumSatiri('rapor','Cevap raporu','ydRapor')+durumSatiri('coz','Çözüm kitapçığı','ydCoz')+durumSatiri('ort','Ders ortalamaları (isteğe bağlı)','ydOrt')+'</div>';
  if(!kitVar()||!S.rapor||!S.es)return top;
  const subeler=[...new Set(S.rapor.ogrenciler.map(o=>o.sube))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  const inSube=S.rapor.ogrenciler.filter(o=>!S.sube||o.sube===S.sube).sort((a,b)=>a.ad.localeCompare(b.ad,'tr'));
  const opt=(v,t,sec)=>'<option value="'+h(v)+'"'+(sec?' selected':'')+'>'+h(t)+'</option>';
  const sel=(label,f,opts)=>'<label class="yd-sec">'+label+'<select data-yd-f="'+f+'">'+opts+'</select></label>';
  const list=defterler(),soru=list.reduce((a,d)=>a+d.bolumler.reduce((x,b)=>x+b.sorular.length,0),0);
  const secili=k=>!S.bantlar||S.bantlar.has(k);
  const chips='<div class="yd-sec yd-zsec"><span id="ydZorlukEtiket">Zorluk</span><div class="yd-chips" role="group" aria-labelledby="ydZorlukEtiket">'+ZORLUK.BANTLAR.map(([k,ad])=>chipHtml(k,ad,secili(k))).join('')+chipHtml('kendi','Kendi seviyesi',S.kendi)+'</div></div>';
  const filtre='<div class="yd-filtre">'+sel('Şube','sube',opt('','Tüm şubeler',!S.sube)+subeler.map(s=>opt(s,s,s===S.sube)).join(''))+sel('Öğrenci','ogr',opt('','Tüm öğrenciler ('+inSube.length+')',!S.ogr)+inSube.map(o=>opt(o.id,o.ad+' · '+o.no,String(o.id)===S.ogr)).join(''))+
    sel('Soru durumu','status',[['all','Yanlış ve boş'],['yanlis','Yalnızca yanlış'],['bos','Yalnızca boş']].map(([v,l])=>opt(v,l,S.status===v)).join(''))+chips+'</div>';
  const dersler='<div class="yd-dersler" role="group" aria-label="Dersler">'+S.es.bolumler.map((b,i)=>'<label><input type="checkbox" data-yd-ders="'+i+'"'+(S.kapali.has(i)?'':' checked')+'>'+h(b.ders)+'</label>').join('')+'</div>';
  const arac='<div class="yd-arac"><button type="button" class="et-dugme birincil" data-yd-yazdir'+(soru?'':' disabled')+'>Yazdır</button><span class="yd-ozet">'+list.length+' öğrenci · '+soru+' soru</span><span id="ydIlerleme" class="yd-ozet" role="status">'+h(S.ilerleme)+'</span></div>';
  return top+filtre+dersler+arac+analizHTML(zorlukBilgi())+'<div class="yd-baski" id="ydBaski">'+list.map(ogrHTML).join('')+'</div>';
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
async function dosyaYukle(tur,files){
  if(S.mesgul)return;S.mesgul=tur;render();
  try{for(const f of files)await yukle(tur,f)}finally{S.mesgul='';render()}
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
  const dosya={ydKit:'kit',ydRapor:'rapor',ydCoz:'coz',ydOrt:'ort'}[el.id];
  if(dosya){const f=[...(el.files||[])];el.value='';if(f.length)dosyaYukle(dosya,f);return}
  if(el.dataset?.ydF==='sube'){S.sube=el.value;if(S.ogr&&S.rapor.ogrenciler.find(o=>String(o.id)===S.ogr)?.sube!==S.sube&&S.sube)S.ogr='';render('[data-yd-f="sube"]');return}
  if(el.dataset?.ydF==='ogr'){S.ogr=el.value;render('[data-yd-f="ogr"]');return}
  if(el.dataset?.ydF==='status'){if(['all','yanlis','bos'].includes(el.value))S.status=el.value;render('[data-yd-f="status"]');return}
  if(el.dataset?.ydDers!==undefined){const i=+el.dataset.ydDers;if(el.checked)S.kapali.delete(i);else S.kapali.add(i);render('[data-yd-ders="'+i+'"]')}
});
document.addEventListener('click',ev=>{
  if(!etkin())return;
  if(ev.target.closest?.('[data-yd-yazdir]')){yazdir();return}
  const chip=ev.target.closest?.('[data-yd-z]');
  if(chip){
    const k=chip.dataset.ydZ;
    if(k==='kendi')S.kendi=!S.kendi;
    else if(BANT_ANAHTAR().includes(k)){const set=new Set(S.bantlar||BANT_ANAHTAR());if(set.has(k))set.delete(k);else set.add(k);S.bantlar=set.size===5?null:set}
    render('[data-yd-z="'+k+'"]');
  }
});
const durumu=()=>S;
return {dersAdi,dersOnek,kitapcikCoz,raporCoz,esle,esOturum,cozumEtiketleri,ortalamaCoz,ortalamaDogrula,haritaKur,defterKur,difficultyIndex,zorlukAnaliz,filterDefter,soruKirp,yukle,gorunum,yazdir,hazirla,durumu,key,title};
})();
function gorunumYanlislar(){return YANLISLAR.gorunum()}
