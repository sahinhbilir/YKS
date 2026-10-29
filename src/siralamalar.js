// Embedded in index.html by scripts/embed-siralamalar.cjs. No student data belongs here.
// Sıralamalar (teacher only): the school's own result lists for two exams, redrawn in the
// school's layout with a green/red change box next to every net. The lists come from the
// same PDFs the teacher imports in Denemeler (or "PDF ekle" here). A compact copy is kept in
// the teacher notebook as D.siralama, so it travels with the teacher's cloud backup; student
// packets are built from a field whitelist and never carry it. Reports are drawn in the
// browser with pdf-lib; nothing is uploaded. See docs/siralamalar.md.
const SIRALAMA = (() => {
const TYT_KEYS=['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'];
const AYT_KEYS=['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY'];
const PUAN=['TYT','SAY','EA','SÖZ'];
const TESTS={'TDE-SB1':['EDB','TAR1','COĞ1'],'SB2':['TAR2','COĞ2','FELGR','DİN2','S.F2'],'MAT':['AMAT','AGEO'],'FEN':['AFİZ','AKİM','ABİY']};
const TEST_OF={};for(const t in TESTS)for(const k of TESTS[t])TEST_OF[k]=t;
const FIELDS={'SAY':['MAT','FEN'],'EA':['TDE-SB1','MAT'],'SÖZ':['TDE-SB1','SB2']};
const FCOLS={};for(const f in FIELDS)FCOLS[f]=FIELDS[f].flatMap(t=>TESTS[t]);
// Stored column order: T = "Net Sayısı Sıralı" (TYT), F = "Öğrenci Adı Sıralı" (TYT + AYT).
const SUTUN={T:TYT_KEYS,F:[...TYT_KEYS,...AYT_KEYS]};
const SURUM=1, UST_SINIR=350000, EN_COK_SINAV=40, SIRALA=['SAY','EA','SÖZ','Toplam'];

/* ---------------- numbers ---------------- */
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
// Changes round half up; printed averages use toFixed like the school's own lists.
function r2(x){const s=x<0?-1:1;return s*Math.round(Math.abs(x)*100+1e-7)/100}
const f2=x=>{const s=x.toFixed(2);return s==='-0.00'?'0.00':s};
const f1=x=>{const s=x.toFixed(1);return s==='-0.0'?'0.0':s};
function dyParts(s){if(!s||s==='-/-'||s.indexOf('/')<0)return null;const [a,b]=s.split('/');const d=parseInt(a,10),y=parseInt(b,10);return isNaN(d)||isNaN(y)?null:[d,y]}
const clsKey=c=>{const m=/^(\d+)\s*(\d+)\s*\/\s*([A-ZÇĞİÖŞÜ]+)$/u.exec(c||'');return m?[m[3],parseInt(m[1],10)]:['~',0]};
const clsShort=c=>{const m=/^(\d+)\s*(\d+)\s*\/\s*([A-ZÇĞİÖŞÜ]+)$/u.exec(c||'');return m?m[1]+'-'+m[3]:(c||'—')};

/* ---------------- PDF text → list ---------------- */
// sayfalar: pdf.js text items per page {s,x,y,w,h,z} (y from the page bottom, z = font size);
// boylar: page heights. Each grade's list prints its own lessons (9. sınıf has no Felsefe or
// Geometri, 11. sınıf AYT no S.F) in its own type size, so a lesson column is found by the label
// above its "N", and a cell is read by what it holds: the net above, D/Y below.
const NET=/^(-?\d+(\.\d+)?|-)$/;
const ETIKET_TYT={'TÜR':'TÜR','TAR':'TAR','COĞ':'COĞ','FEL':'FEL','DİN KÜL':'DİN','S.F':'S.F','MAT':'MAT','GEO':'GEO','FİZ':'FİZ','KİM':'KİM','BİY':'BİY'};
const ETIKET_AYT={'EDB':['EDB'],'TAR':['TAR1','TAR2'],'COĞ':['COĞ1','COĞ2'],'FEL GR.':['FELGR'],'DİN KÜL':['DİN2'],'S.F':['S.F2'],'MAT':['AMAT'],'GEO':['AGEO'],'FİZ':['AFİZ'],'KİM':['AKİM'],'BİY':['ABİY']};
const TUM_KEYS=[...TYT_KEYS,...AYT_KEYS];
// Lesson labels in column order → keys, in the school's order or not at all. AYT starts at EDB;
// there the first TAR and COĞ belong to TDE-SB1 and the second to SB2.
function dersAnahtarlari(etiketler){
  const keys=[];let ayt=false;
  for(const e of etiketler){
    if(e==='EDB')ayt=true;
    const k=ayt?(ETIKET_AYT[e]||[]).find(x=>!keys.includes(x)):ETIKET_TYT[e];
    if(!k)return null;keys.push(k);
  }
  return keys.length&&keys.every((k,i)=>!i||TUM_KEYS.indexOf(k)>TUM_KEYS.indexOf(keys[i-1]))?keys:null;
}
function joinItems(items){let out='',prev=null;for(const o of items){if(prev){const gap=o.x0-prev.x1;out+=(gap>Math.max(prev.size,o.size)*0.12?' ':'')}out+=o.s;prev=o}return out.replace(/\s+/g,' ').trim()}
function linesOf(items){const L=[];for(const o of items){const l=L.find(x=>Math.abs(x.cy-o.cy)<1.5);if(l)l.items.push(o);else L.push({cy:o.cy,items:[o]})}
  return L.sort((a,b)=>a.cy-b.cy).map(l=>({cy:l.cy,text:joinItems(l.items.sort((a,b)=>a.x0-b.x0))}))}
function num(s){s=(s||'').trim();if(s===''||s==='-')return null;const v=parseFloat(s);return isNaN(v)?null:v}
// Header cells: a value stands right of its label up to the next label of its row and may wrap
// onto a second line (a long school name).
const META=[['Okul:','school'],['Sınav Adı:','name'],['Sınav Tarihi:','date'],['Toplam Katılımcı:','toplam'],['Kampüs Katılımcı:','kampus'],['Kurum Katılımcı:','kurum']];
function readMeta(it,res){
  const lab=META.map(([s,k])=>[it.find(o=>o.s===s),k]),satir2=lab.slice(3).map(l=>l[0]).filter(Boolean);
  const ust=Math.min(...lab.map(l=>l[0]?l[0].cy:Infinity))-8,orta=satir2.length?Math.min(...satir2.map(o=>o.cy))-6:Infinity;
  lab.forEach(([o,k],i)=>{
    if(!o)return;const ikinci=i>=3,sonraki=lab.slice(ikinci?3:0,ikinci?6:3).map(l=>l[0]).filter(x=>x&&x.x0>o.x0).sort((a,b)=>a.x0-b.x0)[0];
    const deger=it.filter(x=>!META.some(m=>m[0]===x.s)&&x.x0>=o.x1-1&&(!sonraki||x.x0<sonraki.x0-1)&&(ikinci?Math.abs(x.cy-o.cy)<6:x.cy>ust&&x.cy<orta));
    res.meta[k]=linesOf(deger).map(l=>l.text).join(' ');
  });
}
function pdfOku(sayfalar,boylar){
  const res={format:null,keys:null,meta:{},students:{},kurum:null};
  sayfalar.forEach((items,p)=>{
    const H=boylar[p];
    const it=items.filter(i=>i&&typeof i.s==='string'&&i.s.trim()).map(i=>{const size=i.z||i.h,x0=i.x,x1=i.x+i.w,yb=H-i.y;return{s:i.s.trim(),x0,x1,cx:(x0+x1)/2,yb,cy:yb-0.34*size,size}});
    if(p===0)readMeta(it,res);
    const bas=it.find(o=>o.s==='NO/İsim');if(!bas)return;
    const Nh=it.filter(o=>o.s==='N'&&o.cy>bas.cy-3&&o.cy<bas.cy+25).sort((a,b)=>a.cx-b.cx),Ns=Nh.map(o=>o.cx);
    if(Ns.length<2)return;
    const half=Ns.map((c,i)=>Math.min(i>0?c-Ns[i-1]:60,i<Ns.length-1?Ns[i+1]-c:60)/2-0.3);
    // The last column is the total.
    const etiket=Nh.slice(0,-1).map((n,i)=>it.filter(o=>o.cy<n.cy-1&&o.cy>n.cy-20&&Math.abs(o.cx-n.cx)<half[i]).sort((a,b)=>b.cy-a.cy)[0]);
    if(etiket.some(e=>!e))return;
    const keys=dersAnahtarlari(etiket.map(e=>e.s));
    if(!keys)throw new Error('PDF’deki ders sütunları okunamadı ('+etiket.map(e=>e.s).join(', ')+').');
    if(res.keys&&res.keys.join()!==keys.join())throw new Error('PDF sayfalarının sütun düzeni farklı.');
    res.keys=keys;res.format=keys.some(k=>AYT_KEYS.includes(k))?'TYT+AYT':'TYT';
    const pc=it.filter(o=>o.s==='Puan'&&o.cy>bas.cy-3&&o.cy<bas.cy+25).map(o=>o.cx).sort((a,b)=>a-b).slice(0,4);
    const anchors=it.filter(o=>o.x1<31&&/^\d+$/.test(o.s)&&o.cy>bas.cy+3);
    // Row bands grow with the list's type size (5 pt row numbers in the 12. sınıf lists).
    const sc=anchors.length?anchors.map(o=>o.size).sort((a,b)=>a-b)[anchors.length>>1]/5:1;
    const labels=linesOf(it.filter(o=>o.x0>30&&o.x1<102&&o.cy>bas.cy+3)).filter(l=>l.text==='Kurum Ortalamaları').map(l=>({cy:l.cy,label:true}));
    const rows=anchors.concat(labels).sort((a,b)=>a.cy-b.cy);
    rows.forEach((a,ai)=>{
      const isK=!!a.label,lim=(isK?5.4:9)*sc,lo=Math.max(a.cy-lim,ai?(rows[ai-1].cy+a.cy)/2:-Infinity),hi=Math.min(a.cy+lim,ai<rows.length-1?(rows[ai+1].cy+a.cy)/2:Infinity);
      const band=it.filter(o=>o.cy>lo&&o.cy<hi);
      const row={net:{},dy:{},puan:{},rank:{}};
      keys.forEach((k,i)=>{
        const cand=band.filter(o=>Math.abs(o.cx-Ns[i])<half[i]);
        const top=cand.filter(o=>NET.test(o.s)).sort((x,y)=>x.cy-y.cy)[0];
        const low=cand.filter(o=>o.s.includes('/')).sort((x,y)=>x.cy-y.cy)[0];
        row.net[k]=top?num(top.s):null;row.dy[k]=low?low.s:null;
      });
      pc.forEach((cx,i)=>{
        const cand=band.filter(o=>Math.abs(o.cx-cx)<14.5);
        const top=cand.filter(o=>NET.test(o.s)).sort((x,y)=>x.cy-y.cy)[0];
        row.puan[PUAN[i]]=top?num(top.s):null;
        row.rank[PUAN[i]]=linesOf(cand.filter(o=>o!==top)).map(l=>l.text).join(' ');
      });
      if(isK){if(!res.kurum)res.kurum=row;return}
      const nm=linesOf(band.filter(o=>o.x0>30&&o.x0<101)).map(l=>l.text).join(' ');
      const m=/^(\d{1,12})\s*\/\s*(.+)$/u.exec(nm);if(!m)return;
      row.no=m[1];row.name=m[2].replace(/\s+/g,' ').trim();
      row.cls=linesOf(band.filter(o=>o.x0>=101&&o.x1<124)).map(l=>l.text).join(' ').replace(/\s*\/\s*/,'/').trim();
      res.students[row.no]=row;
    });
  });
  if(!res.format)throw new Error('Bu PDF okulun toplu sonuç listesi gibi görünmüyor (Net Sayısı Sıralı ya da Öğrenci Adı Sıralı).');
  if(!res.meta.name||!String(res.meta.name).trim())throw new Error('PDF’de sınav adı okunamadı.');
  if(!Object.keys(res.students).length)throw new Error('PDF’de öğrenci satırı bulunamadı.');
  return res;
}
// Compact copy for the notebook: arrays in the fixed column order of the list type.
function pdfCoz(sayfalar,boylar){
  const res=pdfOku(sayfalar,boylar),tur=res.format==='TYT+AYT'?'F':'T',K=SUTUN[tur];
  const sat=r=>({n:K.map(k=>r.net[k]??null),dy:K.map(k=>r.dy[k]??null),p:PUAN.map(k=>r.puan[k]??null)});
  const kisa=(s,n)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
  return {tur,ad:kisa(res.meta.name,120),okul:kisa(res.meta.school,200),tarih:kisa(res.meta.date,20),
    katilim:[res.meta.toplam,res.meta.kampus,res.meta.kurum].map(x=>kisa(x,80)),
    kurum:res.kurum?sat(res.kurum):null,
    ogr:Object.values(res.students).map(s=>({no:s.no,ad:kisa(s.name,120),snf:kisa(s.cls,24),...sat(s),r:PUAN.map(k=>kisa(s.rank[k],60))}))};
}

/* ---------------- notebook storage ---------------- */
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı sıralama listeleri okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n;
  const sayi=(x,a,b)=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b);
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!Array.isArray(v.sinavlar)||v.sinavlar.length>EN_COK_SINAV)hata('yapı');
  const t=v.tercih;
  if(t!==undefined&&(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).length>60||Object.entries(t).some(([k,x])=>k.length>40||!SIRALA.includes(x))))hata('sıralama tercihi');
  const ids=new Set();
  for(const s of v.sinavlar){
    if(!s||typeof s!=='object'||!metin(s.id,200)||!s.id||ids.has(s.id)||!metin(s.ad,120)||!s.ad.trim()||!metin(s.okul,200)||
       !Number.isSafeInteger(s.ts)||s.ts<=0||s.ts>100000000000000||(!s.T&&!s.F))hata('sınav');
    if(s.tarih!==undefined&&!(typeof s.tarih==='string'&&/^\d{2}\.\d{2}\.\d{4}$/.test(s.tarih)))hata('sınav tarihi');
    if(s.tur!==undefined&&!SINAV_TURLERI.includes(s.tur))hata('sınav türü');
    ids.add(s.id);
    for(const tur of ['T','F']){
      const sl=s[tur];if(sl===null||sl===undefined)continue;const K=SUTUN[tur].length;
      const satir=(r,sira)=>r&&typeof r==='object'&&Array.isArray(r.n)&&r.n.length===K&&r.n.every(x=>sayi(x,-200,200))&&
        Array.isArray(r.dy)&&r.dy.length===K&&r.dy.every(x=>x===null||metin(x,15))&&Array.isArray(r.p)&&r.p.length===4&&r.p.every(x=>sayi(x,0,1000))&&
        (!sira||Array.isArray(r.r)&&r.r.length===4&&r.r.every(x=>metin(x,60)));
      if(typeof sl!=='object'||!metin(sl.tarih,20)||!Array.isArray(sl.katilim)||sl.katilim.length!==3||!sl.katilim.every(x=>metin(x,80))||
         (sl.kurum!==null&&!satir(sl.kurum,false))||!Array.isArray(sl.ogr)||sl.ogr.length>600)hata('liste');
      const nos=new Set();
      for(const o of sl.ogr){if(!satir(o,true)||!metin(o.no,12)||!/^\d{1,12}$/.test(o.no)||nos.has(o.no)||!metin(o.ad,120)||!metin(o.snf,24))hata('öğrenci satırı');nos.add(o.no)}
    }
  }
  return v;
}
// A list this version cannot read (damaged, or written by a newer version) is shown as
// unreadable and is never overwritten; the rest of the notebook is unaffected.
// A viewing teacher (yalnızca görüntüleme) cannot save; their class sort choices stay in memory.
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
const GECICI_TERCIH={};
function oku(){
  if(D.siralama===undefined)return {veri:{surum:SURUM,sinavlar:[],tercih:izleme()?{...GECICI_TERCIH}:{}}};
  try{const v=dogrula(JSON.parse(JSON.stringify(D.siralama)));v.tercih={...(v.tercih||{}),...(izleme()?GECICI_TERCIH:{})};return {veri:v}}
  catch(e){return {veri:null,hata:e.message}}
}
const kimlik=ad=>denemeAdAnahtari(ad);
// A later copy of the same list replaces its students by number; students missing from it stay
// (a class list adds to the whole-school list).
function slotBirlestir(eski,yeni){
  if(!eski)return yeni;
  const ogr=new Map(eski.ogr.map(o=>[o.no,o]));
  for(const o of yeni.ogr){const e=ogr.get(o.no);ogr.set(o.no,e&&!o.snf.includes('/')&&e.snf.includes('/')?{...o,snf:e.snf}:o)}
  return {tarih:yeni.tarih||eski.tarih,katilim:yeni.katilim.some(Boolean)?yeni.katilim:eski.katilim,kurum:yeni.kurum||eski.kurum,
    ogr:[...ogr.values()].sort((a,b)=>a.no.localeCompare(b.no,'tr',{numeric:true}))};
}
function ekle(veri,l){
  const id=kimlik(l.ad);if(!id)throw new Error('Sınav adı okunamadı.');
  let s=veri.sinavlar.find(x=>x.id===id);
  if(!s){if(veri.sinavlar.length>=EN_COK_SINAV)throw new Error('En fazla '+EN_COK_SINAV+' sınav saklanır. Eski sınavları silip yeniden deneyin.');
    s={id,ad:l.ad,okul:l.okul,ts:Date.now(),T:null,F:null};veri.sinavlar.push(s)}
  s[l.tur]=slotBirlestir(s[l.tur],{tarih:l.tarih,katilim:l.katilim,kurum:l.kurum,ogr:l.ogr});
  s.okul=l.okul||s.okul;s.ts=Math.max(Date.now(),s.ts+1);
}
const ONBELLEK=new Map();
async function yaz(veri,once){
  dogrula(veri);
  const json=JSON.stringify(veri),bayt=baytBoyu(json);
  if(bayt>UST_SINIR)throw new Error('Sıralama listeleri '+Math.round(UST_SINIR/1000)+' KB sınırını aşıyor. Eski sınavları silip yeniden deneyin.');
  const eski=D.siralama,geri=()=>{if(eski===undefined)delete D.siralama;else D.siralama=eski};
  D.siralama=veri;
  // The lists ride in the teacher's cloud backup; they must not push it over its limit.
  if(baytBoyu(JSON.stringify(D))>DEFTER_HAM_UST_SINIR&&bayt>(once===undefined?0:baytBoyu(JSON.stringify(once)))){geri();throw new Error('Bu listeler defteri bulut yedeği sınırının üstüne çıkarır. Eski sınavları silip yeniden deneyin. Ayarlar → Defter boyutu bölümüne bakın.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; listeler değişmedi.')}
  ONBELLEK.clear();
}
async function kaydetListeler(listeler){
  if(!rehberMi())throw new Error('Yalnızca rehber öğretmen kaydedebilir.');
  const {veri,hata}=oku();if(!veri)throw new Error(hata+' Yeni liste eklenmedi.');
  const once=D.siralama;
  for(const l of listeler)ekle(veri,l);
  await yaz(veri,once);
  return listeler.map(l=>l.ad+' ('+(l.tur==='F'?'TYT + AYT':'TYT')+')');
}
// Every date an exam carries: the corrected one and the ones printed on its lists (ISO).
const sinavTarihleri=s=>[...new Set([s.tarih,s.T&&s.T.tarih,s.F&&s.F.tarih].filter(Boolean).map(t=>isoTarih(t)))].filter(Boolean);
// Deleting an exam also deletes its published copies in the students' Denemelerim unless kopyalar is false (the
// teacher may keep the results and only free the lists' room). Copies are queued for publishing: the caller
// publishes with denemeBekleyenleriYayinla. Returns how many students lost the copies.
async function sil(id,kopyalar=true){
  if(!rehberMi())return 0;
  if(izleme())throw new Error('Yalnızca rehber öğretmen silebilir.');
  const {veri,hata}=oku();if(!veri)throw new Error(hata);
  const s=veri.sinavlar.find(x=>x.id===id);
  veri.sinavlar=veri.sinavlar.filter(x=>x.id!==id);await yaz(veri,D.siralama);
  if(!s||!kopyalar)return 0;
  try{return await denemeOkulSil(s.ad,sinavTarihleri(s))}
  catch(e){throw new Error('Sınav silindi, ancak öğrencilerin kopyaları kaldırılamadı: '+e.message+' “Öğrencilere yayınlanmış sonuçlar” bölümünden kaldırabilirsiniz.')}
}
// The school results already published to students, grouped by exam name, date and session; a group is "yok" when no
// exam in the list has its name and one of its dates (a deleted exam, or one re-added under another date or spelling).
function yayinlanmisGruplar(veri){
  const liste=veri?veri.sinavlar.map(s=>({anahtar:kimlik(s.ad),tarihler:sinavTarihleri(s)})):[],gruplar=new Map();
  (D.ogr||[]).forEach((o,si)=>{
    if(!o||o.silindi)return;
    for(const r of o.denemeOkul||[]){
      if(r.silindi||!String(r.id).startsWith('p:'))continue;
      const anahtar=denemeAdAnahtari(r.ad),k=[anahtar,r.tarih,r.oturum].join('|'),g=gruplar.get(k)||{anahtar,ad:r.ad,tarih:r.tarih,oturum:r.oturum,ogrenciler:new Set()};
      g.ogrenciler.add(si);gruplar.set(k,g);
    }
  });
  return [...gruplar.values()].map(g=>({anahtar:g.anahtar,ad:g.ad,tarih:g.tarih,oturum:g.oturum,n:g.ogrenciler.size,yok:!!veri&&!liste.some(x=>x.anahtar===g.anahtar&&x.tarihler.includes(g.tarih))}))
    .sort((a,b)=>b.tarih.localeCompare(a.tarih)||a.ad.localeCompare(b.ad,'tr')||a.oturum.localeCompare(b.oturum));
}
// One group removed from the students (the same tombstones as a deleted exam).
async function yayindanKaldir(anahtar,tarih,oturum){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen kaldırabilir.');
  return denemeOkulSil(anahtar,[tarih],oturum);
}
async function tercihKaydet(sinif,alan){
  if(!SIRALA.includes(alan)||String(sinif).length>40)return;
  if(izleme()){GECICI_TERCIH[sinif]=alan;return}
  const {veri}=oku();if(!veri)return;
  veri.tercih[sinif]=alan;await yaz(veri,D.siralama);
}

// The teacher corrects an exam's date (e.g. a list printed with the wrong day). It is kept apart from
// the lists, so adding the same PDF again does not bring the printed date back.
async function tarihDegistir(id,tarih){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen değiştirebilir.');
  if(!/^\d{2}\.\d{2}\.\d{4}$/.test(tarih))throw new Error('Tarih geçersiz.');
  const {veri,hata}=oku();if(!veri)throw new Error(hata);
  const s=veri.sinavlar.find(x=>x.id===id);if(!s)throw new Error('Sınav bulunamadı.');
  const eski=[...new Set([s.tarih,s.T&&s.T.tarih,s.F&&s.F.tarih].filter(Boolean))];
  s.tarih=tarih;s.ts=Math.max(Date.now(),s.ts+1);await yaz(veri,D.siralama);
  return {ad:s.ad,eski};
}
// Genel or tarama: an exam whose name says "tarama" is a tarama, any other a genel deneme. The
// teacher can set it by hand; like the date it stays apart from the lists, and '' returns to the name.
const SINAV_TURLERI=['genel','tarama'];
const addanTur=ad=>/tarama/.test(String(ad||'').toLocaleLowerCase('tr-TR'))?'tarama':'genel';
async function turDegistir(id,tur){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen değiştirebilir.');
  if(tur!==''&&!SINAV_TURLERI.includes(tur))throw new Error('Sınav türü geçersiz.');
  const {veri,hata}=oku();if(!veri)throw new Error(hata);
  const s=veri.sinavlar.find(x=>x.id===id);if(!s)throw new Error('Sınav bulunamadı.');
  if(!tur||tur===addanTur(s.ad))delete s.tur;else s.tur=tur;
  await yaz(veri,D.siralama);
}

/* ---------------- exam model ---------------- */
function acSlot(sl,K){
  const row=r=>{const o={net:{},dy:{},puan:{},rank:{}};K.forEach((k,i)=>{o.net[k]=r.n[i];o.dy[k]=r.dy[i]});PUAN.forEach((k,i)=>{o.puan[k]=r.p[i];o.rank[k]=r.r?r.r[i]:''});return o};
  const students={};for(const s of sl.ogr)students[s.no]={...row(s),no:s.no,name:s.ad,cls:s.snf};
  return {students,kurum:sl.kurum?row(sl.kurum):null,meta:{date:sl.tarih,toplam:sl.katilim[0],kampus:sl.katilim[1],kurum:sl.katilim[2]}};
}
function part(str,which){if(!str)return '';const m=new RegExp(which+':\\s*([^|]+)').exec(str);return m?m[1].trim():(str.includes('|')?'':str)}
const hasTYT=s=>TYT_KEYS.some(k=>s.net[k]!=null);
const hasAYT=s=>AYT_KEYS.some(k=>s.net[k]!=null);
function attempted(s,t){let n=0;for(const k of TESTS[t]){const p=dyParts(s.dy[k]);if(p)n+=p[0]+p[1]}return n>0}
const took=(s,f)=>!!s&&hasAYT(s)&&FIELDS[f].every(t=>attempted(s,t));
const fnet=(s,f)=>FCOLS[f].reduce((a,k)=>a+(s.net[k]||0),0);
function dySum(s,keys){let d=0,y=0,any=false;for(const k of keys){const p=dyParts(s.dy[k]);if(p){d+=p[0];y+=p[1];any=true}}return any?d+'/'+y:'-/-'}
const tytTotal=s=>TYT_KEYS.reduce((a,k)=>a+(s.net[k]||0),0);
const aytTotal=s=>AYT_KEYS.reduce((a,k)=>a+(s.net[k]||0),0);
function dyMean(rows,k){const P=rows.map(r=>dyParts(r.dy[k])).filter(Boolean);return P.length?f1(mean(P.map(p=>p[0])))+'/'+f1(mean(P.map(p=>p[1]))):'-/-'}
// The lessons a stored list printed: a column the list does not have has no D/Y in any row.
const sutunlar=(sl,K)=>K.filter((k,i)=>sl.kurum&&sl.kurum.dy[i]!==null||sl.ogr.some(o=>o.dy[i]!==null));
// The grade of a class ("301 12/A" → 12) and of an exam (the grade most of its students are in).
const duzey=c=>{const m=/(\d{1,2})\s*\/\s*[A-ZÇĞİÖŞÜ]+$/u.exec(String(c||'').trim());return m?parseInt(m[1],10):null};
function sinavDuzeyi(students){const say=new Map();for(const s of students){const d=duzey(s.cls);if(d)say.set(d,(say.get(d)||0)+1)}
  return [...say].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0]?.[0]??null}
// The TYT view of an exam is its "Net Sayısı Sıralı" list when there is one, else the TYT part
// of "Öğrenci Adı Sıralı"; AYT always comes from "Öğrenci Adı Sıralı". Each view keeps the
// lessons its list printed (dersler).
function model(x){
  const T=x.T?acSlot(x.T,SUTUN.T):null,F=x.F?acSlot(x.F,SUTUN.F):null,e={id:x.id,ts:x.ts,name:x.ad,school:x.okul,T:!!T,F:!!F,tur:x.tur||addanTur(x.ad),turElle:!!x.tur};
  const fd=x.F?sutunlar(x.F,SUTUN.F):[];
  if(T){e.tyt={...T,dersler:sutunlar(x.T,TYT_KEYS)};if(F)for(const no in T.students){const s=T.students[no],g=F.students[no];if(g&&!/\//.test(s.cls||'')&&/\//.test(g.cls||''))s.cls=g.cls}}
  else if(F){const m=F.meta;e.tyt={students:F.students,kurum:F.kurum,meta:{date:m.date,toplam:part(m.toplam,'TYT'),kampus:part(m.kampus,'TYT'),kurum:part(m.kurum,'TYT')},dersler:fd.filter(k=>TYT_KEYS.includes(k))}}
  else e.tyt=null;
  if(F){const m=F.meta;e.ayt={students:F.students,kurum:F.kurum,meta:{date:m.date,toplam:part(m.toplam,'AYT'),kampus:part(m.kampus,'AYT'),kurum:part(m.kurum,'AYT')},dersler:fd.filter(k=>AYT_KEYS.includes(k))}}else e.ayt=null;
  e.listeDers={T:x.T?sutunlar(x.T,TYT_KEYS).length:0,F:fd.length};
  e.sinif=sinavDuzeyi([...(e.tyt?Object.values(e.tyt.students):[]),...(e.ayt?Object.values(e.ayt.students):[])]);
  e.hasTYT=!!e.tyt&&Object.values(e.tyt.students).some(hasTYT);
  e.hasAYT=!!e.ayt&&Object.values(e.ayt.students).some(hasAYT);
  e.nTYT=e.tyt?Object.values(e.tyt.students).filter(hasTYT).length:0;
  e.nAYT=e.ayt?Object.values(e.ayt.students).filter(hasAYT).length:0;
  // A date the teacher corrected (x.tarih) wins over the dates printed on the lists.
  e.pdfDates=[...new Set([x.T&&x.T.tarih,x.F&&x.F.tarih].filter(Boolean))];e.dates=x.tarih?[x.tarih]:e.pdfDates;
  const d=(e.dates[0]||'');e.sortKey=d.split('.').reverse().join('')+'|'+x.ad;
  return e;
}
// A list is named by the school's title when it has the 12. sınıf lessons, else by its lesson count.
const listeAdlari=e=>[e.T?'TYT · '+(e.listeDers.T===TYT_KEYS.length?'Net Sayısı Sıralı':e.listeDers.T+' ders'):'',
  e.F?'TYT + AYT · '+(e.listeDers.F===TUM_KEYS.length?'Öğrenci Adı Sıralı':e.listeDers.F+' ders'):''].filter(Boolean);
const modeller=veri=>veri.sinavlar.map(model).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
function classGroups(students){const m={};for(const s of students)(m[s.cls||'—']=m[s.cls||'—']||[]).push(s);
  return Object.keys(m).sort((a,b)=>{const A=clsKey(a),B=clsKey(b);return A[0].localeCompare(B[0],'tr')||A[1]-B[1]}).map(c=>[c,m[c]])}
function defaultSort(students){const c={SAY:0,EA:0,'SÖZ':0};for(const s of students)for(const f in c)if(took(s,f))c[f]++;
  return Object.keys(c).reduce((a,b)=>c[b]>c[a]?b:a,'SAY')}

/* ---------------- report rows ---------------- */
// A lesson compares only when both lists printed it (a list without the lesson has no D/Y for it).
const ikisinde=(a,b,k)=>a.dy[k]!=null&&b.dy[k]!=null;
function tytRows(cur,prev,list){
  return list.map(s=>{const p=prev?prev.students[s.no]:null,pv=p&&hasTYT(p)?p:null,delta={};
    for(const k of TYT_KEYS)delta[k]=pv&&ikisinde(s,pv,k)?(s.net[k]||0)-(pv.net[k]||0):null;
    return {s,delta,total:tytTotal(s),dyT:dySum(s,TYT_KEYS)}}).sort((a,b)=>b.total-a.total||a.s.name.localeCompare(b.s.name,'tr'));
}
function tytAvg(cur,prev,label,rows){
  const o={label,net:{},dy:{},delta:{},puan:{}};
  if(!rows){const K=cur.kurum,PK=prev?prev.kurum:null;
    for(const k of TYT_KEYS){o.net[k]=K?K.net[k]:null;o.dy[k]=K?K.dy[k]:'-/-';o.delta[k]=(K&&PK&&K.net[k]!=null&&PK.net[k]!=null)?K.net[k]-PK.net[k]:null}
    for(const k of PUAN)o.puan[k]=K?K.puan[k]:null;return o}
  const S=rows.map(r=>r.s),prevS=prev?S.map(s=>prev.students[s.no]).filter(p=>p&&hasTYT(p)):[];
  for(const k of TYT_KEYS){const ps=prevS.filter(p=>p.dy[k]!=null);o.net[k]=mean(S.map(s=>s.net[k]||0));o.dy[k]=dyMean(S,k);o.delta[k]=ps.length&&S.some(s=>s.dy[k]!=null)?o.net[k]-mean(ps.map(p=>p.net[k]||0)):null}
  const tp=S.map(s=>s.puan.TYT).filter(v=>v!=null);o.puan.TYT=tp.length?mean(tp):null;return o;
}
// An AYT test compares only when it was answered in both exams. A field net needs both of the
// field's tests in the current exam; its change is the sum of its branch changes.
function aytRow(s,prev){
  const p=prev?prev.students[s.no]:null,pv=p&&hasAYT(p)?p:null,delta={};
  for(const k of AYT_KEYS){const t=TEST_OF[k];delta[k]=(pv&&ikisinde(s,pv,k)&&attempted(pv,t)&&attempted(s,t))?(s.net[k]||0)-(pv.net[k]||0):null}
  const field={};
  for(const f in FIELDS){if(took(s,f)){const ds=FCOLS[f].filter(k=>delta[k]!=null).map(k=>r2(delta[k]));field[f]={net:fnet(s,f),dy:dySum(s,FCOLS[f]),delta:ds.length?r2(ds.reduce((a,b)=>a+b,0)):null}}
    else field[f]={net:null,dy:'-/-',delta:null}}
  return {s,delta,field,total:aytTotal(s),dyT:dySum(s,AYT_KEYS)};
}
// Kurum and Şube field values are the sums of the printed branch values (of the lessons the list has).
function fromBranches(o,keys=AYT_KEYS){
  const out={};
  for(const f in FIELDS){const ks=FCOLS[f].filter(k=>keys.includes(k));
    if(ks.some(k=>o.net[k]==null)){out[f]={net:null,dy:'-/-',delta:null};continue}
    const n=ks.reduce((a,k)=>a+parseFloat(f2(o.net[k])),0);let D=0,Y=0,okDY=true;
    for(const k of ks){const p=(o.dy[k]||'').split('/').map(parseFloat);if(p.length!==2||p.some(isNaN)){okDY=false;break}D+=p[0];Y+=p[1]}
    const ds=ks.filter(k=>o.delta[k]!=null).map(k=>r2(o.delta[k]));
    out[f]={net:n,dy:okDY?D.toFixed(1)+'/'+Y.toFixed(1):'-/-',delta:ds.length?r2(ds.reduce((a,b)=>a+b,0)):null}}
  return out;
}
function aytKurum(cur,prev){
  const K=cur.kurum,PK=prev?prev.kurum:null,o={label:'Kurum Ortalamaları',net:{},dy:{},delta:{},puan:{}};
  for(const k of AYT_KEYS){o.net[k]=K?K.net[k]:null;o.dy[k]=K?K.dy[k]:'-/-';o.delta[k]=(K&&PK&&K.net[k]!=null&&PK.net[k]!=null)?K.net[k]-PK.net[k]:null}
  for(const k of PUAN)o.puan[k]=K?K.puan[k]:null;
  o.field=fromBranches(o,cur.dersler);return o;
}
function aytSube(rows,prev,keys){
  const S=rows.map(r=>r.s),PS=prev?S.map(s=>prev.students[s.no]).filter(p=>p&&hasAYT(p)):[],o={label:'Şube Ortalamaları',net:{},dy:{},delta:{},puan:{}};
  for(const k of AYT_KEYS){const ps=PS.filter(p=>p.dy[k]!=null);o.net[k]=mean(S.map(s=>s.net[k]||0));o.dy[k]=dyMean(S,k);o.delta[k]=ps.length&&S.some(s=>s.dy[k]!=null)?o.net[k]-mean(ps.map(p=>p.net[k]||0)):null}
  o.field=fromBranches(o,keys);return o;
}
function aytSirala(rows,f){
  if(f==='Toplam')rows.sort((a,b)=>b.total-a.total);
  else rows.sort((a,b)=>((a.field[f].net==null)-(b.field[f].net==null))||((b.field[f].net||0)-(a.field[f].net||0))||(b.total-a.total));
  return rows;
}

/* ---------------- in-site ranking ---------------- */
// One row per student of the current exam: net, change, % change and the gap closed (log):
// ln((max − önceki + 1) / (max − şimdiki + 1)). Closing the gap near full net counts more; the +1
// keeps a full net finite. % needs a positive earlier net. Missing values sort last.
const SIRA_OLCUT=[['net','Net'],['artis','Net artışı'],['yuzde','% artış'],['fark','Kapanan fark (log)']];
const SIRA_UST={TYT:120,SAY:80,EA:80,'SÖZ':80,Toplam:160};
// Ders ders sıralama ("TYT:MAT", "AYT:EDB"): o dersin neti; tam net dersin soru sayısıdır.
const SIRA_DERS={TYT:[['TÜR','Türkçe',40],['TAR','Tarih',5],['COĞ','Coğrafya',5],['FEL','Felsefe',5],['DİN','Din Kültürü',5],['MAT','Matematik',30],['GEO','Geometri',10],['FİZ','Fizik',7],['KİM','Kimya',7],['BİY','Biyoloji',6]],
  AYT:[['EDB','Edebiyat',24],['TAR1','Tarih-1',10],['COĞ1','Coğrafya-1',6],['TAR2','Tarih-2',11],['COĞ2','Coğrafya-2',11],['FELGR','Felsefe Grubu',12],['DİN2','Din Kültürü',6],['AMAT','Matematik',30],['AGEO','Geometri',10],['AFİZ','Fizik',14],['AKİM','Kimya',13],['ABİY','Biyoloji',13]]};
// The exams' tests next to the lessons ("TYT:G-FEN"): the sum of their lessons' nets.
const SIRA_GRUP={TYT:[['G-SOS','Sosyal Bilimler',20,['TAR','COĞ','FEL','DİN','S.F']],['G-MAT','Matematik + Geometri',40,['MAT','GEO']],['G-FEN','Fen Bilimleri',20,['FİZ','KİM','BİY']]],
  AYT:[['G-TDE','Edebiyat–Sosyal 1',40,TESTS['TDE-SB1']],['G-SB2','Sosyal 2',40,TESTS.SB2],['G-MAT','Matematik + Geometri',40,TESTS.MAT],['G-FEN','Fen Bilimleri',40,TESTS.FEN]]};
const siraDersi=alan=>{const [o,k]=String(alan).split(':');return k&&SIRA_DERS[o]?SIRA_DERS[o].find(d=>d[0]===k)||SIRA_GRUP[o].find(d=>d[0]===k)||null:null};
const siraTyt=alan=>alan==='TYT'||String(alan).startsWith('TYT:');
const siraUst=alan=>{const d=siraDersi(alan);return d?d[2]:SIRA_UST[alan]};
const siraGecerli=(alan,tur)=>tur==='TYT'?alan==='TYT'||!!(siraTyt(alan)&&siraDersi(alan)):SIRALA.includes(alan)||!!(String(alan).startsWith('AYT:')&&siraDersi(alan));
function siraNet(s,alan){
  if(!s)return null;
  const d=siraDersi(alan);
  // A TYT course counts when the student took TYT; an AYT course when its test was answered.
  if(d&&d[3]){if(d[3].every(k=>s.net[k]==null))return null;const t=d[3].reduce((a,k)=>a+(s.net[k]??0),0);return siraTyt(alan)?(hasTYT(s)?r2(t):null):(hasAYT(s)&&attempted(s,TEST_OF[d[3][0]])?r2(t):null)}
  if(d)return siraTyt(alan)?(hasTYT(s)&&s.net[d[0]]!=null?r2(s.net[d[0]]):null):(hasAYT(s)&&attempted(s,TEST_OF[d[0]])&&s.net[d[0]]!=null?r2(s.net[d[0]]):null);
  if(alan==='TYT')return hasTYT(s)?r2(tytTotal(s)):null;
  if(alan==='Toplam')return hasAYT(s)?r2(aytTotal(s)):null;
  return took(s,alan)?r2(fnet(s,alan)):null;
}
// Average rows: school and each class. As in the reports' Şube box, the change is the current
// average minus the same students' earlier average.
function siraOrtalama(ad,rows,ust){
  if(!rows.length)return null;
  const simdi=mean(rows.map(r=>r.simdi)),oncekiler=rows.filter(r=>r.once!==null),once=oncekiler.length?mean(oncekiler.map(r=>r.once)):null,artis=once===null?null:r2(simdi-once);
  return {ad,n:rows.length,simdi,once,artis,yuzde:once!==null&&once>0?artis/once*100:null,fark:once===null?null:Math.log((ust-once+1)/(ust-simdi+1))};
}
// Full net of a ranking: the lesson's question count, or more when a grade's exam asks more (a 9. sınıf
// Tarih can have 7 questions), so the gap closed stays defined.
const siraTavan=(alan,rows)=>Math.max(siraUst(alan),...rows.flatMap(r=>[r.simdi,r.once]).filter(v=>v!==null));
function siraSatirlari(cur,prev,alan,olcut){
  const tyt=siraTyt(alan),L=tyt?cur&&cur.tyt:cur&&cur.ayt,P=prev?(tyt?prev.tyt:prev.ayt):null;
  if(!L)return [];
  const rows=Object.values(L.students).map(s=>{
    const simdi=siraNet(s,alan);if(simdi===null)return null;
    const once=P?siraNet(P.students[s.no],alan):null,artis=once===null?null:r2(simdi-once);
    return {s,simdi,once,artis,yuzde:once!==null&&once>0?artis/once*100:null};
  }).filter(Boolean),ust=siraTavan(alan,rows);
  for(const r of rows)r.fark=r.once===null?null:Math.log((ust-r.once+1)/(ust-r.simdi+1));
  const k=siraAnahtari(olcut);
  rows.sort((a,b)=>((a[k]===null)-(b[k]===null))||((b[k]||0)-(a[k]||0))||(b.simdi-a.simdi)||a.s.name.localeCompare(b.s.name,'tr'));
  return siraNumarala(rows,olcut);
}
const siraAnahtari=olcut=>SIRA_OLCUT.some(o=>o[0]===olcut)&&olcut!=='net'?olcut:'simdi';
// Equal values share a rank (1, 2, 2, 4); rows without a value have none.
function siraNumarala(rows,olcut){
  const k=siraAnahtari(olcut);
  rows.forEach((r,i)=>{const v=r[k];r.sira=v===null?null:i&&rows[i-1][k]!==null&&Math.abs(rows[i-1][k]-v)<1e-9?rows[i-1].sira:i+1});
  return rows;
}

/* ---------------- change boxes ---------------- */
const GREEN_L=[0.91,0.97,0.92],GREEN_D=[0.1,0.56,0.26],RED_L=[0.995,0.92,0.92],RED_D=[0.8,0.13,0.16];
const GREY_FILL=[0.925,0.932,0.94],GREY_STROKE=[0.7,0.73,0.77],GREY_TXT=[0.34,0.37,0.41],GREEN_TXT=[0.04,0.29,0.13],RED_TXT=[0.45,0.06,0.08];
function deltaStyle(d){
  if(d==null)return {s:'N/A',fill:GREY_FILL,stroke:GREY_STROKE,tc:GREY_TXT};
  const r=r2(d);if(r===0)return {s:'0.00',fill:GREY_FILL,stroke:GREY_STROKE,tc:GREY_TXT};
  const t=Math.pow(Math.min(Math.abs(r)/16,1),0.6),[L,Dk]=r>0?[GREEN_L,GREEN_D]:[RED_L,RED_D];
  const fill=L.map((l,i)=>l+(Dk[i]-l)*t),stroke=fill.map(c=>c*0.85);
  return {s:(r>0?'+':'')+r.toFixed(2),fill,stroke,tc:t>=0.65?[1,1,1]:(r>0?GREEN_TXT:RED_TXT)};
}

/* ---------------- libraries ---------------- */
// Pinned files with integrity checks; loaded only when a report is drawn.
const KAYNAK={
  pdfLib:['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js','sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI'],
  fontkit:['https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js','sha384-2p6U+1mmqF10USehFeRiyG2ESG9FwIqN+jxULn5w9jjQIihSn9Pt13dVCn/Hawjn'],
  rr:['https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.woff','9ae9d6545d7d7d823f8a94010db77c1a0ff71e371e8bb158df1cb98395162507'],
  rm:['https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Medium.woff','4112fbc996a10ba2f5be2077f92be5eb143e24061a24f7c99825066ecc5b8a51']
};
let KUTUPHANE=null;
function betik([src,sri],hazir){
  if(hazir())return Promise.resolve();
  return new Promise((ok,red)=>{const s=document.createElement('script');s.src=src;s.integrity=sri;s.crossOrigin='anonymous';s.onload=()=>hazir()?ok():red(new Error(src));s.onerror=()=>red(new Error(src));document.head.appendChild(s)});
}
async function yaziTipi([src,sha]){
  const r=await fetch(src);if(!r.ok)throw new Error(src);
  const b=new Uint8Array(await r.arrayBuffer()),h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
  if(h!==sha)throw new Error(src);return b;
}
function kutuphane(){
  if(!KUTUPHANE)KUTUPHANE=(async()=>{
    await betik(KAYNAK.pdfLib,()=>!!window.PDFLib);await betik(KAYNAK.fontkit,()=>!!window.fontkit);
    const [rr,rm]=await Promise.all([yaziTipi(KAYNAK.rr),yaziTipi(KAYNAK.rm)]);
    return {PDFLib:window.PDFLib,fontkit:window.fontkit,rr,rm};
  })().catch(e=>{KUTUPHANE=null;console.error(e);throw new Error('PDF araçları yüklenemedi. İnternet bağlantısını kontrol edip yeniden deneyin.')});
  return KUTUPHANE;
}

/* ---------------- PDF drawing (the school's layout) ---------------- */
const W=841.89,H=595.28,X0=12.15,X1=829.74,LAV=[0.9333,0.898,1],KBLUE=[0.902,0.953,1];
async function newDoc(L){
  const doc=await L.PDFLib.PDFDocument.create();doc.registerFontkit(L.fontkit);
  return {L,doc,RR:await doc.embedFont(L.rr,{subset:true}),RM:await doc.embedFont(L.rm,{subset:true}),HB:await doc.embedFont(L.PDFLib.StandardFonts.HelveticaBold)};
}
function kit(K,page){
  const c=a=>K.L.PDFLib.rgb(a[0],a[1],a[2]);
  const k={
    rect(x,y,w,h,fill,stroke=[0,0,0],lw=0.3){const o={x,y:H-y-h,width:w,height:h};if(fill)o.color=c(fill);if(stroke){o.borderColor=c(stroke);o.borderWidth=lw}else o.borderWidth=0;page.drawRectangle(o)},
    text(x,yb,s,font,size,align='c',w=0,color=[0,0,0]){s=String(s);if(!s)return;const tw=font.widthOfTextAtSize(s,size);let xx=x;if(align==='c')xx=x+(w-tw)/2;else if(align==='r')xx=x+w-tw;page.drawText(s,{x:xx,y:H-yb,size,font,color:c(color)})},
    width:(s,font,size)=>font.widthOfTextAtSize(String(s),size),
    box(bx,y0,y1,d){const st=deltaStyle(d);page.drawRectangle({x:bx,y:H-y1,width:16.1,height:y1-y0,color:c(st.fill),borderColor:c(st.stroke),borderWidth:0.22});
      const tw=K.HB.widthOfTextAtSize(st.s,4.25);page.drawText(st.s,{x:bx+(16.1-tw)/2,y:H-((y0+y1)/2+0.35*4.25),size:4.25,font:K.HB,color:c(st.tc)})},
    infoRows(y,rows,splits){for(const row of rows){row.forEach(([a,b],i)=>{const x0=splits[i],w=splits[i+1]-splits[i];k.rect(x0,y,w,14.847);const aw=k.width(a,K.RM,9),bw=k.width(b,K.RR,9),sx=x0+(w-aw-bw)/2;k.text(sx,y+10.5,a,K.RM,9,'l');k.text(sx+aw,y+10.5,b,K.RR,9,'l')});y+=14.847}return y},
    name(x,w,yb1,yb2,ybOne,s,font){const max=w-3;if(k.width(s,font,5)<=max){k.text(x+0.45,ybOne,s,font,5,'l');return}
      const parts=s.split(' ');let l1='';while(parts.length&&k.width((l1+' '+parts[0]).trim(),font,5)<=max)l1=(l1+' '+parts.shift()).trim();k.text(x+0.45,yb1,l1,font,5,'l');k.text(x+0.45,yb2,parts.join(' '),font,5,'l')},
    cls(x,w,yb1,yb2,s,font){const i=s.indexOf('/');if(i<0){k.text(x,(yb1+yb2)/2,s,font,5,'c',w);return}k.text(x,yb1,s.slice(0,i+1),font,5,'c',w);k.text(x,yb2,s.slice(i+1),font,5,'c',w)}
  };
  return k;
}
// Columns of a TYT page: the 12. sınıf list's widths. A list with fewer lessons or scores (9. and
// 10. sınıf print only the TYT score) spreads its lessons over the width left.
function tytX(keys,puan){
  const X={sira:[12.15,20.3],name:[32.45,70.3],snf:[102.75,20.3]},son=X1-puan.length*29.941-20.366,w=+((son-123.05)/keys.length).toFixed(4);
  let x=123.05;for(const k of keys){X[k]=[x,w];x+=w}
  X.top=[son,20.366];puan.forEach((k,i)=>X[k]=[son+20.366+i*29.941,29.941]);
  return X;
}
// The scores a list printed: TYT always, SAY/EA/SÖZ when a student has one.
const puanlari=list=>PUAN.filter((p,i)=>!i||list.some(s=>s.puan[p]!=null));
const TYT_GROUPS=[['TÜR',['TÜR']],['SOS BİL',['TAR','COĞ','FEL','DİN','S.F']],['TEM MAT',['MAT','GEO']],['FEN BİL',['FİZ','KİM','BİY']]];
const TYT_LABEL={'TÜR':'TÜR','TAR':'TAR','COĞ':'COĞ','FEL':'FEL','DİN':'DİN KÜL','S.F':'S.F','MAT':'MAT','GEO':'GEO','FİZ':'FİZ','KİM':'KİM','BİY':'BİY'};
function drawTYTPage(K,page,cur,rows,avgs,startNo,keys,puan){
  const k=kit(K,page),X=tytX(keys,puan),m=cur.tyt.meta||{};
  k.rect(X0,10.15,X1-X0,16.019);k.text(X0,21.58,'DENEME SINAVI TOPLU SONUÇ LİSTESİ Net Sayısı Sıralı',K.RM,10,'c',X1-X0);
  k.infoRows(26.169,[[['Okul: ',cur.school],['Sınav Adı: ',cur.name],['Sınav Tarihi: ',m.date||'']],[['Toplam Katılımcı: ',m.toplam||''],['Kampüs Katılımcı: ',m.kampus||''],['Kurum Katılımcı: ',m.kurum||'']]],[X0,277.566,586.599,X1]);
  const gy=55.862,gh=14.363;k.rect(X0,gy,X1-X0,gh);
  for(const key of ['sira','name','snf','top',...puan])k.rect(X[key][0],gy,X[key][1],gh);
  for(const [g,gk] of TYT_GROUPS){const ks=gk.filter(x=>keys.includes(x));if(!ks.length)continue;const x0=X[ks[0]][0],x1=X[ks.at(-1)][0]+X[ks.at(-1)][1];k.rect(x0,gy,x1-x0,gh);k.text(x0,64.75,g,K.RR,5,'c',x1-x0)}
  const hy=70.225,hh=9.331,sh=12.605;
  k.rect(X.sira[0],hy,X.sira[1],hh+sh);k.text(X.sira[0],76.94,'Sıra',K.RR,6,'c',X.sira[1]);
  k.rect(X.name[0],hy,X.name[1],hh+sh);k.text(X.name[0]+0.15,76.94,'NO/İsim',K.RR,6,'l');
  k.rect(X.snf[0],hy,X.snf[1],hh+sh);k.text(X.snf[0],76.94,'Snf',K.RR,6,'c',X.snf[1]);
  for(const key of keys){const [x,w]=X[key];k.rect(x,hy,w,hh);k.text(x,76.43,TYT_LABEL[key],K.RR,key==='TÜR'?5:4.5,'c',w);
    k.rect(x,hy+hh,w,sh);k.text(x,85.4,'N',K.RR,4.5,'c',w);k.text(x,90.6,'D/Y',K.RR,4.5,'c',w)}
  k.rect(X.top[0],hy,X.top[1],hh);k.text(X.top[0],77.94,'Toplam',K.RR,6,'c',X.top[1]);k.rect(X.top[0],hy+hh,X.top[1],sh);k.text(X.top[0],85.4,'N',K.RR,4.5,'c',X.top[1]);k.text(X.top[0],90.6,'D/Y',K.RR,4.5,'c',X.top[1]);
  for(const key of puan){const [x,w]=X[key];k.rect(x,hy,w,hh);k.text(x,76.94,key==='TYT'?'TYT':'YKS-'+key,K.RR,6,'c',w);k.rect(x,hy+hh,w,sh);k.text(x,85.27,'Puan',K.RR,6,'c',w);k.text(x,90.91,'Şb. Kr. Km. Gn.',K.RR,4.5,'c',w)}
  let y=92.161;
  for(const a of avgs){const rh=10.847;k.rect(X0,y,X1-X0,rh,KBLUE,null);
    for(const key in X)k.rect(X[key][0],y,X[key][1],rh);
    k.text(X.name[0],y+7.13,a.label,K.RR,5,'c',X.name[1]);
    for(const key of keys){const [x,w]=X[key];k.text(x,y+4.79,a.net[key]==null?'-':f2(a.net[key]),K.RR,5,'c',w);k.text(x,y+9.72,a.dy[key]||'-/-',K.RR,4,'c',w);k.box(x+w-17.7515,y+4.79-4.389,y+4.79+0.971,a.delta[key])}
    k.text(X.top[0],y+4.79,'-',K.RR,5,'c',X.top[1]);k.text(X.top[0],y+9.72,'-/-',K.RR,4,'c',X.top[1]);
    for(const key of puan){const [x,w]=X[key],v=a.puan[key];k.text(x,y+7.13,v==null?'-':f2(v),K.RR,5,'c',w)}
    y+=rh}
  const rh=16.019;
  rows.forEach((r,i)=>{const s=r.s;if(i%2===0)k.rect(X0,y,X1-X0,rh,LAV,null);for(const key in X)k.rect(X[key][0],y,X[key][1],rh);
    k.text(X.sira[0],y+9.71,String(startNo+i),K.RR,5,'c',X.sira[1]);
    k.name(X.name[0],X.name[1],y+6.79,y+12.65,y+9.71,s.no+' / '+s.name,K.RR);
    k.cls(X.snf[0],X.snf[1],y+6.79,y+12.65,s.cls||'',K.RR);
    for(const key of keys){const [x,w]=X[key];k.text(x,y+7.37,s.net[key]==null?'-':f2(s.net[key]),K.RR,5,'c',w);k.text(x,y+12.3,s.dy[key]||'-/-',K.RR,4,'c',w);k.box(x+w-17.7515,y+7.37-4.389,y+7.37+0.971,r.delta[key])}
    k.text(X.top[0],y+7.37,f2(r.total),K.RR,5,'c',X.top[1]);k.text(X.top[0],y+12.3,r.dyT,K.RR,4,'c',X.top[1]);
    for(const key of puan){const [x,w]=X[key],v=s.puan[key];k.text(x,y+7.08,v==null?'-':f2(v),K.RR,5,'c',w);k.text(x,y+12.47,s.rank[key]||'',K.RR,4.5,'c',w)}
    y+=rh});
}
async function buildTYT(L,cur,prev,mode){
  const K=await newDoc(L),CT=cur.tyt,PT=prev.tyt,list=Object.values(CT.students).filter(hasTYT),keys=CT.dersler||TYT_KEYS,puan=puanlari(list);
  const all=tytRows(CT,PT,list),kur=tytAvg(CT,PT,'Kurum Ortalamaları',null);
  const groups=mode==='toplu'?[[null,all]]:classGroups(all.map(r=>r.s)).map(([c,ss])=>[c,all.filter(r=>ss.includes(r.s))]);
  for(const [,rows] of groups){
    const avgs=mode==='toplu'?[kur]:[kur,tytAvg(CT,PT,'Şube Ortalamaları',rows)];
    const per=Math.floor((H-6-(92.161+avgs.length*10.847))/16.019);
    for(let i=0;i<rows.length||i===0;i+=per){drawTYTPage(K,K.doc.addPage([W,H]),cur,rows.slice(i,i+per),avgs,i+1,keys,puan);if(!rows.length)break}
  }
  return K.doc.save();
}
const AYT_GROUPS=[['TÜR DİL VE EDE - SOS BİL',[['EDB','EDB'],['TAR1','TAR'],['COĞ1','COĞ']]],['SOS BİL',[['TAR2','TAR'],['COĞ2','COĞ'],['FELGR','FEL GR.'],['DİN2','DİN KÜL'],['S.F2','S.F']]],['İLE MAT',[['AMAT','MAT'],['AGEO','GEO']]],['FEN BİL',[['AFİZ','FİZ'],['AKİM','KİM'],['ABİY','BİY']]]];
// Columns of an AYT page: the AYT lessons the list printed share the width the fixed columns leave.
function aytX(keys){
  const cw={sira:20.3,name:70.3,snf:20.3,top:30,fld:38,puan:33},fixed=cw.sira+cw.name+cw.snf+cw.top+3*cw.fld+3*cw.puan,NW=(X1-X0-fixed)/keys.length,AX={};
  let x=X0;for(const [k,w] of [['sira',cw.sira],['name',cw.name],['snf',cw.snf],...keys.map(k=>[k,NW]),['top',cw.top],['fSAY',cw.fld],['fEA',cw.fld],['fSÖZ',cw.fld],['SAY',cw.puan],['EA',cw.puan],['SÖZ',cw.puan]]){AX[k]=[x,w];x+=w}
  return AX;
}
function drawAYTPage(K,page,cur,rows,avgs,title,startNo){
  const k=kit(K,page),m=cur.ayt.meta||{},keys=cur.ayt.dersler||AYT_KEYS,AX=aytX(keys),gruplar=AYT_GROUPS.map(([g,cols])=>[g,cols.filter(c=>keys.includes(c[0]))]).filter(g=>g[1].length);
  const cell=(key,y,rh,net,dy,d)=>{const [x,w]=AX[key],area=w-17.75,top=y+rh/2-5.2;k.text(x,top+4.6,net==null?'-':f2(net),K.RR,5,'c',area);k.text(x,top+9.6,dy||'-/-',K.RR,4,'c',area);k.box(x+w-1.65-16.1,top+0.25,top+5.61,d)};
  let y=10.15;k.rect(X0,y,X1-X0,16.02);k.text(X0,y+11.3,title,K.RM,10,'c',X1-X0);y+=16.02;
  y=k.infoRows(y,[[['Okul: ',cur.school],['Sınav Adı: ',cur.name],['Sınav Tarihi: ',m.date||'']],[['Toplam Katılımcı: ','AYT: '+(m.toplam||'')],['Kampüs Katılımcı: ','AYT: '+(m.kampus||'')],['Kurum Katılımcı: ','AYT: '+(m.kurum||'')]]],[X0,X0+(X1-X0)*0.325,X0+(X1-X0)*0.645,X1]);
  const gh=14.36;k.rect(X0,y,X1-X0,gh);
  for(const [g,cols] of gruplar){const x0=AX[cols[0][0]][0],last=AX[cols[cols.length-1][0]],x1=last[0]+last[1];k.rect(x0,y,x1-x0,gh);k.text(x0,y+8.6,g,K.RR,5,'c',x1-x0)}
  for(const key of ['sira','name','snf','top','fSAY','fEA','fSÖZ','SAY','EA','SÖZ'])k.rect(AX[key][0],y,AX[key][1],gh);
  y+=gh;const hh=14.37;
  for(const [key,lab] of [['sira','Sıra'],['name','NO/İsim'],['snf','Snf']]){k.rect(AX[key][0],y,AX[key][1],hh);if(key==='name')k.text(AX[key][0]+2,y+9,lab,K.RR,6,'l');else k.text(AX[key][0],y+9,lab,K.RR,6,'c',AX[key][1])}
  for(const [,cols] of gruplar)for(const [key,lab] of cols){k.rect(AX[key][0],y,AX[key][1],hh);k.text(AX[key][0],y+8.8,lab,K.RR,4.5,'c',AX[key][1])}
  for(const [key,lab] of [['top','Toplam'],['fSAY','SAY Net'],['fEA','EA Net'],['fSÖZ','SÖZ Net'],['SAY','YKS-SAY'],['EA','YKS-EA'],['SÖZ','YKS-SÖZ']]){k.rect(AX[key][0],y,AX[key][1],hh);k.text(AX[key][0],y+9,lab,K.RR,6,'c',AX[key][1])}
  y+=hh;const sh=17.88;
  for(const key of ['sira','name','snf'])k.rect(AX[key][0],y,AX[key][1],sh);
  for(const key of [...keys,'top','fSAY','fEA','fSÖZ']){k.rect(AX[key][0],y,AX[key][1],sh);k.text(AX[key][0],y+6.3,'N',K.RR,4.5,'c',AX[key][1]);k.text(AX[key][0],y+11.6,'D/Y',K.RR,4.5,'c',AX[key][1])}
  for(const key of ['SAY','EA','SÖZ']){k.rect(AX[key][0],y,AX[key][1],sh);k.text(AX[key][0],y+7,'Puan',K.RR,6,'c',AX[key][1]);k.text(AX[key][0],y+12.8,'Şb. Kr. Km. Gn.',K.RR,4.5,'c',AX[key][1])}
  y+=sh;
  for(const a of avgs){const rh=10.85;k.rect(X0,y,X1-X0,rh,KBLUE,null);for(const key in AX)k.rect(AX[key][0],y,AX[key][1],rh);
    k.text(AX.name[0],y+6.9,a.label,K.RR,5,'c',AX.name[1]);
    for(const key of keys){const [x,w]=AX[key],area=w-17.75;k.text(x,y+4.9,a.net[key]==null?'-':f2(a.net[key]),K.RR,5,'c',area);k.text(x,y+9.2,a.dy[key]||'-/-',K.RR,4,'c',area);k.box(x+w-1.65-16.1,y+0.33,y+5.69,a.delta[key])}
    k.text(AX.top[0],y+4.9,'-',K.RR,5,'c',AX.top[1]);k.text(AX.top[0],y+9.2,'-/-',K.RR,4,'c',AX.top[1]);
    for(const f of ['SAY','EA','SÖZ']){const [x,w]=AX['f'+f],area=w-17.75,fv=a.field[f];k.text(x,y+4.9,fv.net==null?'-':f2(fv.net),K.RR,5,'c',area);k.text(x,y+9.2,fv.dy,K.RR,4,'c',area);k.box(x+w-1.65-16.1,y+0.33,y+5.69,fv.delta)}
    for(const key of ['SAY','EA','SÖZ']){const v=a.label.startsWith('Kurum')?a.puan[key]:null;k.text(AX[key][0],y+7,v==null?'-':f2(v),K.RR,5,'c',AX[key][1])}
    y+=rh}
  const rh=16.02;
  rows.forEach((r,i)=>{const s=r.s;if(i%2===0)k.rect(X0,y,X1-X0,rh,LAV,null);for(const key in AX)k.rect(AX[key][0],y,AX[key][1],rh);
    k.text(AX.sira[0],y+rh/2+1.8,String(startNo+i),K.RR,5,'c',AX.sira[1]);
    k.name(AX.name[0]+0.55,AX.name[1],y+rh/2-0.6,y+rh/2+4.6,y+rh/2+1.8,s.no+' / '+s.name,K.RR);
    k.cls(AX.snf[0],AX.snf[1],y+rh/2-0.6,y+rh/2+4.6,s.cls||'',K.RR);
    for(const key of keys)cell(key,y,rh,s.net[key],s.dy[key],r.delta[key]);
    k.text(AX.top[0],y+rh/2-0.6,f2(r.total),K.RR,5,'c',AX.top[1]);k.text(AX.top[0],y+rh/2+4.4,r.dyT,K.RR,4,'c',AX.top[1]);
    for(const f of ['SAY','EA','SÖZ']){const fv=r.field[f];cell('f'+f,y,rh,fv.net,fv.dy,fv.delta)}
    for(const key of ['SAY','EA','SÖZ']){const v=s.puan[key];k.text(AX[key][0],y+rh/2-0.6,v==null?'-':f2(v),K.RR,5,'c',AX[key][1]);k.text(AX[key][0],y+rh/2+4.6,s.rank[key]||'',K.RR,4.5,'c',AX[key][1])}
    y+=rh});
}
// Pages of one AYT report: [rows, average rows, title]; Toplu by AYT total, Sınıf by the
// field picked for each class (default: the field most of the class took).
function aytSayfalari(cur,prev,mode,tercih){
  const CA=cur.ayt,PA=prev.ayt,list=Object.values(CA.students).filter(hasAYT),rows=list.map(s=>aytRow(s,PA)),kur=aytKurum(CA,PA);
  const genel='DENEME SINAVI TOPLU SONUÇ LİSTESİ AYT Net Sayısı Sıralı';
  if(mode==='toplu')return [[rows.sort((a,b)=>b.total-a.total||a.s.name.localeCompare(b.s.name,'tr')),[kur],genel]];
  return classGroups(list).map(([c,ss])=>{const f=SIRALA.includes(tercih[c])?tercih[c]:defaultSort(ss),cr=aytSirala(rows.filter(r=>ss.includes(r.s)),f);
    return [cr,[kur,aytSube(cr,PA,CA.dersler)],f==='Toplam'?genel:'DENEME SINAVI TOPLU SONUÇ LİSTESİ AYT '+f+' Net Sayısı Sıralı']});
}
async function buildAYT(L,cur,prev,mode,tercih){
  const K=await newDoc(L);
  for(const [rws,avgs,title] of aytSayfalari(cur,prev,mode,tercih)){
    const top=10.15+16.02+2*14.847+14.36+14.37+17.88+avgs.length*10.85,per=Math.floor((H-6-top)/16.02);
    for(let i=0;i<rws.length;i+=per)drawAYTPage(K,K.doc.addPage([W,H]),cur,rws.slice(i,i+per),avgs,title,i+1);
  }
  return K.doc.save();
}

/* ---------------- reports ---------------- */
const dosyaAdi=s=>String(s).replace(/[\\/:*?"<>|]+/g,'-').trim();
const RAPORLAR=[
  {id:'tyt-toplu',ad:'TYT · Toplu',aciklama:'Tüm öğrenciler, toplam nete göre sıralı',gerek:'TYT',dosya:c=>c.name+'_Toplu.pdf',yap:(L,c,p)=>buildTYT(L,c,p,'toplu')},
  {id:'tyt-sinif',ad:'TYT · Sınıf',aciklama:'Her şube ayrı sayfada, şube ortalamalarıyla',gerek:'TYT',dosya:c=>c.name+'_Sınıf.pdf',yap:(L,c,p)=>buildTYT(L,c,p,'sinif')},
  {id:'ayt-toplu',ad:'AYT · Toplu',aciklama:'Tüm AYT öğrencileri; SAY, EA ve SÖZ netleriyle',gerek:'AYT',dosya:c=>c.name+'_AYT_Toplu.pdf',yap:(L,c,p,t)=>buildAYT(L,c,p,'toplu',t)},
  {id:'ayt-sinif',ad:'AYT · Sınıf',aciklama:'Her şube ayrı sayfada, seçtiğiniz nete göre sıralı',gerek:'AYT',dosya:c=>c.name+'_AYT_Sınıf.pdf',yap:(L,c,p,t)=>buildAYT(L,c,p,'sinif',t),sirala:true}
];
function neden(R,cur,prev){
  if(!cur||!prev)return cur&&cur.sinif?'Karşılaştırmak için '+cur.sinif+'. sınıfların ikinci bir sınavı gerekir.':'Karşılaştırmak için iki sınav gerekir.';
  if(R.gerek==='TYT'){if(!cur.hasTYT)return 'Şimdiki sınavda TYT sonucu yok.';if(!prev.hasTYT)return 'Önceki sınavda TYT sonucu yok.';}
  else{if(!cur.hasAYT&&!cur.F&&cur.sinif<11)return 'Bu sınavda AYT yok.';if(!cur.hasAYT)return 'Şimdiki sınavın Öğrenci Adı Sıralı (TYT + AYT) listesini ekleyin.';if(!prev.hasAYT)return 'Önceki sınavın Öğrenci Adı Sıralı (TYT + AYT) listesini ekleyin.';}
  return '';
}
// Grades are never compared with each other: the previous exam is one of the current exam's grade,
// by default the latest before it. The Deneme panosu passes its own pair (cift: {simdi, onceki}
// exam ids) so its reports compare the exams it shows.
const ayniDuzey=(ms,cur)=>cur?ms.filter(m=>m!==cur&&m.sinif===cur.sinif):[];
function secim(ms,cift){
  const istek=cift||{simdi:EK.srSimdiki,onceki:EK.srOnceki},cur=ms.find(m=>m.id===istek.simdi)||ms.at(-1)||null,es=ayniDuzey(ms,cur);
  const i=ms.indexOf(cur),prev=es.find(m=>m.id===istek.onceki)||es.filter(m=>ms.indexOf(m)<i).at(-1)||es[0]||null;
  return {cur,prev};
}
async function raporBaytlari(id,cift){
  const {veri,hata}=oku();if(!veri)throw new Error(hata);
  const {cur,prev}=secim(modeller(veri),cift),R=RAPORLAR.find(r=>r.id===id),neden_=R&&neden(R,cur,prev);
  if(!R||neden_)throw new Error(neden_||'Rapor bulunamadı.');
  // Exam timestamps change with every stored list, so a notebook replaced from the cloud never reuses an old PDF.
  const anahtar=[R.id,prev.id,prev.ts,cur.id,cur.ts,R.sirala?JSON.stringify(veri.tercih):''].join('|');
  if(!ONBELLEK.has(anahtar)){const L=await kutuphane();ONBELLEK.set(anahtar,await R.yap(L,cur,prev,veri.tercih))}
  return {R,cur,prev,bytes:ONBELLEK.get(anahtar)};
}
async function hepsiBaytlari(cift){
  const {veri}=oku(),{cur,prev}=secim(modeller(veri||{sinavlar:[]}),cift),hazir=RAPORLAR.filter(R=>!neden(R,cur,prev));
  if(!hazir.length)throw new Error('Karşılaştırmak için iki sınav gerekir.');
  const L=await kutuphane(),out=await L.PDFLib.PDFDocument.create();
  for(const R of hazir){const {bytes}=await raporBaytlari(R.id,cift),src=await L.PDFLib.PDFDocument.load(bytes);for(const p of await out.copyPages(src,src.getPageIndices()))out.addPage(p)}
  return {cur,bytes:await out.save()};
}

/* ---------------- view ---------------- */
let DURUM='',ISLEM=false,ONIZLEME=null,ONIZLEME_CIFT=null,ONIZLEME_IS=0;
// Reports, preview and the date fields also work on the teacher's Deneme panosu (Denemeler).
const sayfada=()=>rehberMi()&&(EK.sekme==='siralamalar'||EK.sekme==='denemeler'&&!!document.getElementById('dpKok'));
function durum(m){DURUM=m;const el=document.getElementById('srDurum');if(el)el.textContent=m}
const isoTarihYaz=t=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t||'');return m?m[3]+'.'+m[2]+'.'+m[1]:(t||'')};
const isoTarih=t=>{const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t||'');return m?m[3]+'-'+m[2]+'-'+m[1]:''};
function tarihHucresi(e,salt){
  const d=e.dates[0]||'',duzeltildi=e.pdfDates.length&&e.pdfDates.join()!==e.dates.join();
  const not=duzeltildi?'<div class="mini">PDF’de: '+kacis(e.pdfDates.join(' · '))+'</div>':'';
  if(salt)return kacis(e.dates.join(' · '))+not;
  return '<input type="date" class="sr-tarih" data-sr-tarih="'+kacis(e.id)+'" value="'+isoTarih(d)+'" max="'+isoDan(etkinlikBugun())+'" aria-label="'+kacis(e.name+' tarihi')+'">'+not;
}
// Notebook student for a list row (same number and name), so the name opens the student's view.
function defterOgrencisi(){
  const m=new Map();(D.ogr||[]).forEach((o,i)=>{if(o&&!o.silindi&&o.no)m.set(Number(o.no)+'|'+denemeAdAnahtari(o.ad),i)});
  return s=>m.get(Number(s.no)+'|'+denemeAdAnahtari(s.name));
}
const fIsaret=(x,n=2,ek='')=>x===null?'—':(x>0?'+':'')+(n===2?f2(x):x.toFixed(n))+ek;
function siraBolumu(cur,prev){
  if(!cur)return '';
  const tur=EK.srSiraTur==='AYT'&&cur.ayt?'AYT':'TYT',aytOgr=cur.ayt?Object.values(cur.ayt.students).filter(hasAYT):[];
  // Only the lessons the current exam's list printed are offered, and the tests with two of them.
  const liste=tur==='TYT'?cur.tyt:cur.ayt,dersler=liste&&liste.dersler||(tur==='TYT'?TYT_KEYS:AYT_KEYS),dersVar=d=>(d[3]||[d[0]]).filter(k=>dersler.includes(k)).length>(d[3]?1:0);
  const alan=siraGecerli(EK.srSiraNet,tur)&&(!siraDersi(EK.srSiraNet)||dersVar(siraDersi(EK.srSiraNet)))?EK.srSiraNet:tur==='TYT'?'TYT':defaultSort(aytOgr);
  const olcut=prev&&SIRA_OLCUT.some(o=>o[0]===EK.srSiraOlcut)?EK.srSiraOlcut:'net';
  const tum=siraSatirlari(cur,prev,alan,olcut),siniflar=classGroups(tum.map(r=>r.s)).map(c=>c[0]);
  const sube=siniflar.includes(EK.srSiraSube)?EK.srSiraSube:'',rows=sube?siraNumarala(tum.filter(r=>(r.s.cls||'—')===sube),olcut):tum;
  const ust=siraTavan(alan,tum),ortalamalar=[siraOrtalama('Okul',tum,ust),...siniflar.filter(c=>!sube||c===sube).map(c=>siraOrtalama(clsShort(c),tum.filter(r=>(r.s.cls||'—')===c),ust))].filter(Boolean);
  const netSecenek=(k,ad)=>'<option value="'+kacis(k)+'"'+(k===alan?' selected':'')+'>'+kacis(ad)+'</option>';
  const netSec='<label>Net <select id="srSiraNet">'+(tur==='TYT'?netSecenek('TYT','TYT toplam'):'<optgroup label="Alan">'+SIRALA.map(f=>netSecenek(f,f==='Toplam'?'AYT toplam':f)).join('')+'</optgroup>')+
    '<optgroup label="Ders">'+SIRA_DERS[tur].filter(dersVar).map(d=>netSecenek(tur+':'+d[0],d[1])).join('')+'</optgroup><optgroup label="Toplam">'+SIRA_GRUP[tur].filter(dersVar).map(d=>netSecenek(tur+':'+d[0],d[1])).join('')+'</optgroup></select></label>';
  const sec=(ad,ozn,liste,secili)=>'<div class="yg-secim" role="group" aria-label="'+ad+'">'+liste.map(([k,etiket])=>'<button type="button" class="'+(k===secili?'secili':'')+'" aria-pressed="'+(k===secili)+'" data-'+ozn+'="'+kacis(k)+'">'+kacis(etiket)+'</button>').join('')+'</div>';
  const kim=defterOgrencisi(),secili=siraAnahtari(olcut),kolon=prev?['once','simdi','artis','yuzde','fark']:['simdi'];
  const bas={once:'Önceki',simdi:prev?'Şimdiki':'Net',artis:'Net artışı',yuzde:'% artış',fark:'Kapanan fark (log)'};
  const hucre=(r,k)=>{const v=r[k],renk=k==='artis'||k==='yuzde'||k==='fark'?(v>0?' sr-art':v<0?' sr-azal':''):'';
    const yazi=k==='simdi'?'<b>'+f2(v)+'</b>':k==='once'?(v===null?'—':f2(v)):k==='artis'?fIsaret(v):k==='yuzde'?fIsaret(v,1,'%'):fIsaret(v,3);
    return '<td class="k-'+k+(k===secili?' secili':'')+renk+'">'+yazi+'</td>'};
  // On a phone the table keeps #, name, current net and the chosen change (CSS hides the rest).
  return '<section class="kart sr-panel sr-siralama" aria-labelledby="srSiraBaslik"><div class="sr-onizleme-bas"><h2 id="srSiraBaslik">Sıralama</h2><span class="mini">'+
      kacis((prev?prev.name+' → ':'')+cur.name)+' · '+rows.length+' öğrenci</span></div>'+
    '<div class="arac sr-sira-secim">'+sec('Oturum','sr-sira-tur',[['TYT','TYT']].concat(cur.hasAYT?[['AYT','AYT']]:[]),tur)+
      netSec+
      (prev?sec('Sırala','sr-sira-olcut',SIRA_OLCUT,olcut):'')+
      (siniflar.length>1?'<label>Şube <select id="srSiraSube"><option value="">Tümü</option>'+siniflar.map(c=>'<option value="'+kacis(c)+'"'+(c===sube?' selected':'')+'>'+kacis(clsShort(c))+'</option>').join('')+'</select></label>':'')+'</div>'+
    (rows.length?'<div class="dn-scroll"><table class="sr-sira-tablo olcut-'+olcut+'"><thead><tr><th scope="col">#</th><th scope="col">Öğrenci</th><th scope="col" class="k-sube">Şube</th>'+
      kolon.map(k=>'<th scope="col" class="k-'+k+(k===secili?' secili':'')+'">'+bas[k]+'</th>').join('')+'</tr></thead><tbody>'+
      ortalamalar.map((o,i)=>'<tr class="sr-ort'+(i===ortalamalar.length-1?' son':'')+'"><td></td><td><b>'+kacis(o.ad)+' ortalaması</b> <span class="mini">'+o.n+' öğrenci</span></td><td class="k-sube"></td>'+
        kolon.map(k=>hucre(o,k)).join('')+'</tr>').join('')+
      rows.map(r=>{const si=kim(r.s);return '<tr><td>'+(r.sira===null?'—':r.sira)+'</td><td><span class="mini">'+kacis(r.s.no)+'</span> '+
        (si===undefined?kacis(r.s.name):ogrAdDugmesi(si,r.s.name))+'</td><td class="k-sube">'+kacis(clsShort(r.s.cls))+'</td>'+kolon.map(k=>hucre(r,k)).join('')+'</tr>'}).join('')+
      '</tbody></table></div>':'<p class="mini">Bu seçimde öğrenci yok.</p>')+'</section>';
}
function gorunum(){
  const bas='<div class="baslik"><h1>Sıralamalar</h1><p>Okul sonuç listeleri, bir önceki sınava göre değişim kutularıyla</p></div>';
  if(!rehberMi())return bas+'<p>Bu sayfa rehber öğretmen içindir.</p>';
  const {veri,hata}=oku(),ms=veri?modeller(veri):[],{cur,prev}=secim(ms);
  const salt=izleme();
  const tablo=!veri?'<p class="sr-uyari">'+kacis(hata)+'</p>':!ms.length?'<div class="sr-bos"><b>Henüz sonuç listesi yok</b>'+(salt?'':'<p>Denemeler’de “Dosyadan toplu aktar” ile aktardığınız okul listeleri burada da saklanır. Daha önceki sınavlar için “PDF ekle”yi kullanın.</p>')+'</div>':
    '<div class="dn-scroll"><table class="sr-sinavlar"><thead><tr><th>Sınav</th><th>Tarih</th><th>Listeler</th><th>Öğrenci</th><th></th></tr></thead><tbody>'+
    ms.slice().reverse().map(e=>'<tr><td><b>'+kacis(e.name)+'</b>'+(e.school?'<div class="mini">'+kacis(e.school)+'</div>':'')+'</td><td>'+tarihHucresi(e,salt)+'</td><td>'+
      listeAdlari(e).map(kacis).join('<br>')+'</td><td>'+(e.sinif?e.sinif+'. sınıf · ':'')+'TYT '+e.nTYT+(e.F?' · AYT '+e.nAYT:'')+' öğrenci</td><td>'+(salt?'':'<button class="dugme mini" data-sr-sil="'+kacis(e.id)+'" aria-label="'+kacis(e.name+' listelerini sil')+'">Sil</button>')+'</td></tr>').join('')+'</tbody></table></div>';
  const yayinlar=veri&&!salt?yayinlanmisGruplar(veri):[],yayinBolumu=yayinlar.some(g=>g.yok)?'<section class="kart sr-panel" id="srYayin"><h2>Öğrencilere yayınlanmış sonuçlar</h2><div class="dn-scroll"><table class="sr-sinavlar sr-yayin"><thead><tr><th>Sınav</th><th>Tarih</th><th>Oturum</th><th>Öğrenci</th><th></th></tr></thead><tbody>'+
    yayinlar.map(g=>'<tr'+(g.yok?' class="sr-yok"':'')+'><td><b>'+kacis(g.ad)+'</b></td><td>'+kacis(isoTarihYaz(g.tarih))+'</td><td>'+g.oturum+'</td><td>'+g.n+' öğrenci</td><td>'+
      (g.yok?'<span class="sr-yok-etiket">Listede yok</span> <button class="dugme mini" data-sr-yayin-kaldir="'+kacis([g.anahtar,g.tarih,g.oturum].join('|'))+'" aria-label="'+kacis(g.ad+' '+isoTarihYaz(g.tarih)+' '+g.oturum+' sonuçlarını öğrencilerden kaldır')+'">Öğrencilerden kaldır</button>':'<span class="mini">Listede</span>')+'</td></tr>').join('')+'</tbody></table></div></section>':'';
  const duzeyler=new Set(ms.map(e=>e.sinif)).size>1,oncekiler=ayniDuzey(ms,cur);
  const opt=(sel,l=ms)=>l.slice().reverse().map(e=>'<option value="'+kacis(e.id)+'"'+(sel&&e.id===sel.id?' selected':'')+'>'+kacis(e.name+(duzeyler&&e.sinif?' · '+e.sinif+'. sınıf':'')+(e.dates[0]?' · '+e.dates[0]:''))+'</option>').join('');
  const raporlar=RAPORLAR.map(R=>{
    const why=neden(R,cur,prev);let sirala='';
    if(R.sirala&&!why)sirala='<div class="sr-sirala" role="group" aria-label="AYT şube sıralaması">'+classGroups(Object.values(cur.ayt.students).filter(hasAYT)).map(([c,ss],i)=>{const v=SIRALA.includes(veri.tercih[c])?veri.tercih[c]:defaultSort(ss);
      return '<label>'+kacis(clsShort(c))+' sıralaması<select data-sr-sinif="'+kacis(c)+'" id="srSinif'+i+'">'+SIRALA.map(o=>'<option value="'+o+'"'+(o===v?' selected':'')+'>'+(o==='Toplam'?'AYT toplam':o+' net')+'</option>').join('')+'</select></label>'}).join('')+'</div>';
    return '<div class="sr-rapor'+(ONIZLEME===R.id?' secili':'')+'"><div class="sr-rapor-ad"><b>'+R.ad+'</b><span class="mini">'+(why?kacis(why):R.aciklama)+'</span></div>'+
      '<div class="sr-rapor-dugmeler"><button class="dugme" data-sr-onizle="'+R.id+'"'+(why?' disabled':'')+'>Önizle</button><button class="dugme birincil" data-sr-indir="'+R.id+'"'+(why?' disabled':'')+'>PDF indir</button></div>'+sirala+'</div>';
  }).join('');
  const herhangi=RAPORLAR.some(R=>!neden(R,cur,prev));
  return bas+(salt?'':'<div class="arac"><label class="dugme">PDF ekle<input type="file" id="srPdf" accept="'+yzDosyaKabul()+'" multiple hidden></label></div>')+
    '<p id="srDurum" role="status" aria-live="polite">'+kacis(DURUM)+'</p>'+
    '<section class="kart sr-panel"><h2>Sınavlar</h2>'+tablo+'</section>'+yayinBolumu+
    (ms.length?'<section class="kart sr-panel"><h2>Karşılaştır</h2><div class="arac sr-secim"><label>Önceki sınav<select id="srOnceki"'+(oncekiler.length?'':' disabled')+'>'+(oncekiler.length?opt(prev,oncekiler):'<option>İkinci sınavı ekleyin</option>')+'</select></label><span class="sr-ok" aria-hidden="true">→</span><label>Şimdiki sınav<select id="srSimdiki">'+opt(cur)+'</select></label></div>'+
      '<div class="sr-raporlar">'+raporlar+'</div><div class="arac sr-hepsi"><button class="dugme" id="srHepsi"'+(herhangi?'':' disabled')+'>Hepsini tek PDF’te indir</button></div></section>'+
      siraBolumu(cur,prev)+
      '<section class="kart sr-panel sr-onizleme" aria-labelledby="srOnizlemeBaslik"><div class="sr-onizleme-bas"><h2 id="srOnizlemeBaslik">Önizleme</h2><span class="mini" id="srOnizlemeAlt">Bir raporda “Önizle”ye basın.</span></div><div id="srSayfalar" class="sr-sayfalar"></div></section>':'');
}
async function onizle(id,cift){
  const is=++ONIZLEME_IS;ONIZLEME=id;ONIZLEME_CIFT=cift||null;
  document.querySelectorAll('.sr-rapor').forEach(el=>el.classList.toggle('secili',!!el.querySelector('[data-sr-onizle="'+id+'"]')));
  // A message already shown (e.g. a corrected date) comes back once the preview is drawn.
  const onceki=DURUM==='Rapor hazırlanıyor…'?'':DURUM;durum('Rapor hazırlanıyor…');
  try{
    const {R,cur,prev,bytes}=await raporBaytlari(id,cift),pdfjs=await denemePdfjs();
    const task=pdfjs.getDocument({data:bytes.slice(0),isEvalSupported:false});
    try{
      const pdf=await task.promise,host=document.getElementById('srSayfalar');if(is!==ONIZLEME_IS||!host)return;
      host.innerHTML='';
      document.getElementById('srOnizlemeBaslik').textContent=R.ad;
      document.getElementById('srOnizlemeAlt').textContent=prev.name+' → '+cur.name+' · '+pdf.numPages+' sayfa';
      const olcek=Math.min(2.5,Math.max(1.25,(host.clientWidth||900)*(window.devicePixelRatio||1)/W));
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),vp=page.getViewport({scale:olcek}),cv=document.createElement('canvas');
        cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);cv.setAttribute('role','img');cv.setAttribute('aria-label',R.ad+', sayfa '+n);
        if(is!==ONIZLEME_IS)return;host.appendChild(cv);await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;page.cleanup();
      }
    }finally{await task.destroy()}
    if(is===ONIZLEME_IS)durum(onceki);
  }catch(e){if(is===ONIZLEME_IS)durum('Rapor hazırlanamadı: '+e.message)}
}
function yenidenCiz(){ciz();if(ONIZLEME&&document.querySelector('[data-sr-onizle="'+ONIZLEME+'"]:not([disabled])'))onizle(ONIZLEME,ONIZLEME_CIFT);else ONIZLEME=null}
async function kaydetVeIndir(ad,bytes){
  const tamam=await indir(dosyaAdi(ad),bytes,'pdf');
  durum(tamam?'İndirildi: '+dosyaAdi(ad):'');
}
// The school's lists by coordinates; any other file through Gemini when it is available. A list
// saved here gets no preview, so an AI list is taken only when the file confirms every row's net.
async function listeOku(file){
  const yz=typeof YZ==='object'&&YZ.hazir(),tur=typeof YZ==='object'?YZ.tur(file):'pdf';
  if(tur!=='pdf'){if(!yz)throw new Error('bu dosya yalnızca yapay zekâ ile okunabilir; şu an bulut bağlantısı yok.');durum(file.name+': yapay zekâ ile okunuyor…');return YZ.siralamaOku(file)}
  try{const {pages,boylar}=await denemePdfSayfalari(file);return pdfCoz(pages,boylar)}
  catch(e){
    if(!yz)throw e;
    durum(file.name+': okulun liste düzeni değil; yapay zekâ ile okunuyor…');
    try{return await YZ.siralamaOku(file)}catch(e2){throw new Error(e.message+' Yapay zekâ ile: '+e2.message)}
  }
}
async function pdfEkle(files){
  const okunan=[],hatalar=[],defter=D;
  for(const file of files){
    durum('Okunuyor: '+file.name);
    try{okunan.push(await listeOku(file))}catch(e){hatalar.push(file.name+': '+e.message)}
  }
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  const eklenen=okunan.length?await kaydetListeler(okunan):[];
  return (eklenen.length?'Kaydedildi: '+eklenen.join(', ')+'.':'Liste eklenmedi.')+(hatalar.length?' Okunamayan: '+hatalar.join(' · '):'');
}
document.addEventListener('click',async ev=>{
  const el=ev.target.closest?.('button');if(!el||!sayfada())return;
  const kutu=el.closest('[data-sr-simdi]'),cift=kutu?{simdi:kutu.dataset.srSimdi,onceki:kutu.dataset.srOnceki}:undefined;
  if(el.dataset.srOnizle){onizle(el.dataset.srOnizle,cift);return}
  if(el.dataset.srSiraTur||el.dataset.srSiraOlcut){
    const [k,v]=el.dataset.srSiraTur?['srSiraTur',el.dataset.srSiraTur]:['srSiraOlcut',el.dataset.srSiraOlcut];
    EK[k]=v;yenidenCiz();document.querySelector('[data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+v+'"]')?.focus();return}
  if(ISLEM||!(el.dataset.srIndir||el.dataset.srSil||el.dataset.srYayinKaldir||el.id==='srHepsi'))return;
  ISLEM=true;el.disabled=true;
  try{
    if(el.dataset.srIndir){durum('Rapor hazırlanıyor…');const {R,cur,bytes}=await raporBaytlari(el.dataset.srIndir,cift);await kaydetVeIndir(R.dosya(cur),bytes.slice(0))}
    else if(el.id==='srHepsi'){durum('Raporlar hazırlanıyor…');const {cur,bytes}=await hepsiBaytlari(cift);await kaydetVeIndir(cur.name+'_Sıralamalar.pdf',bytes)}
    else if(el.dataset.srYayinKaldir){
      const {veri}=oku(),g=yayinlanmisGruplar(veri).find(x=>x.yok&&[x.anahtar,x.tarih,x.oturum].join('|')===el.dataset.srYayinKaldir);if(!g)return;
      if(!confirm(g.ad+' ('+isoTarihYaz(g.tarih)+', '+g.oturum+') sonuçları '+g.n+' öğrencinin Denemelerim sayfasından kaldırılsın mı?'))return;
      const n=await yayindanKaldir(g.anahtar,g.tarih,g.oturum);
      durum(g.ad+' sonuçları '+n+' öğrenciden kaldırıldı; yayınlanıyor…');yenidenCiz();
      let mesaj=g.ad+' sonuçları '+n+' öğrenciden kaldırıldı.';
      try{mesaj+=' '+await denemeBekleyenleriYayinla(durum)}catch(e){mesaj+=' Yayınlanamadı, cihazda kayıtlı ve yayın bekliyor: '+e.message}
      durum(mesaj);yenidenCiz()}
    else{const {veri}=oku(),s=veri&&veri.sinavlar.find(x=>x.id===el.dataset.srSil);if(!s)return;
      if(!confirm(s.ad+' sınavının sıralama listeleri silinsin mi?'))return;
      const kopyalar=confirm('Öğrencilerin Denemelerim sayfasındaki '+s.ad+' sonuçları da kaldırılsın mı?\n\nTamam: kaldır · İptal: sonuçlar öğrencilerde kalsın');
      let mesaj=s.ad+' silindi.'+(kopyalar?'':' Öğrencilerdeki sonuçlar korundu.');
      try{
        const n=await sil(s.id,kopyalar);
        if(n){durum(mesaj+' '+n+' öğrencinin sonucu kaldırıldı; yayınlanıyor…');yenidenCiz();mesaj+=' '+n+' öğrencinin sonucu kaldırıldı.';
          try{mesaj+=' '+await denemeBekleyenleriYayinla(durum)}catch(e){mesaj+=' Yayınlanamadı, cihazda kayıtlı ve yayın bekliyor: '+e.message}}
      }catch(e){mesaj=e.message}
      durum(mesaj);yenidenCiz()}
  }catch(e){durum(e.message)}
  finally{ISLEM=false;el.disabled=false}
});
document.addEventListener('change',async ev=>{
  const el=ev.target;if(!sayfada())return;
  if(el.id==='srPdf'){
    const files=Array.from(el.files||[]);el.value='';if(!files.length||ISLEM)return;
    if(files.length>10){durum('Bir defada en fazla 10 PDF seçin.');return}
    ISLEM=true;try{durum(await pdfEkle(files))}catch(e){durum('PDF eklenemedi: '+e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='srSiraSube'||el.id==='srSiraNet'){EK[el.id]=el.value;yenidenCiz();document.getElementById(el.id)?.focus();return}
  if(el.dataset&&el.dataset.srTarih!==undefined){
    const {veri}=oku(),s=veri&&veri.sinavlar.find(x=>x.id===el.dataset.srTarih),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(el.value||'');
    if(!s||!m||ISLEM||izleme()){yenidenCiz();return}
    const yeni=m[3]+'.'+m[2]+'.'+m[1];
    if(!confirm(s.ad+' sınavının tarihi '+yeni+' olsun mu? Öğrencilerin bu sınavdaki sonuçları da bu tarihe taşınır.')){yenidenCiz();return}
    ISLEM=true;
    try{
      const r=await tarihDegistir(s.id,yeni);let mesaj=r.ad+' tarihi '+yeni+' oldu.';
      const n=await denemeOkulTarihTasi(r.ad,r.eski.map(isoTarih),el.value);
      if(n){durum(mesaj+' '+n+' öğrencinin sonucu taşındı; yayınlanıyor…');mesaj+=' '+n+' öğrencinin sonucu taşındı. '+await denemeBekleyenleriYayinla(durum)}
      durum(mesaj);
    }catch(e){durum('Tarih değiştirilemedi: '+e.message)}
    finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='srOnceki'||el.id==='srSimdiki'){EK[el.id==='srOnceki'?'srOnceki':'srSimdiki']=el.value;if(el.id==='srSimdiki'&&EK.srOnceki===el.value)EK.srOnceki=null;yenidenCiz();return}
  if(el.dataset&&el.dataset.srSinif!==undefined){
    const id=el.id;try{await tercihKaydet(el.dataset.srSinif,el.value)}catch(e){durum(e.message)}
    yenidenCiz();document.getElementById(id)?.focus();
  }
});
return {kutuphane,tarihHucresi,listeAdlari,ayniDuzey,dersAnahtarlari,TYT_KEYS,AYT_KEYS,SIRALA,clsShort,turDegistir,addanTur,SINAV_TURLERI,hasTYT,hasAYT,took,fnet,tytTotal,aytTotal,FCOLS,SIRA_DERS,SIRA_GRUP,SIRA_UST,pdfOku,pdfCoz,dogrula,oku,ekle,kaydetListeler,sil,yayinlanmisGruplar,yayindanKaldir,sinavTarihleri,tercihKaydet,tarihDegistir,siraSatirlari,siraNumarala,siraOrtalama,siraBolumu,model,modeller,secim,neden,tytRows,tytAvg,aytRow,aytKurum,aytSube,aytSayfalari,fromBranches,deltaStyle,classGroups,defaultSort,raporBaytlari,hepsiBaytlari,gorunum,RAPORLAR,KAYNAK,UST_SINIR,
  get onbellek(){return ONBELLEK},get durumYazisi(){return DURUM}};
})();
function siralamaPdfCoz(sayfalar,boylar){return SIRALAMA.pdfCoz(sayfalar,boylar)}
function siralamaKaydet(listeler){return SIRALAMA.kaydetListeler(listeler)}
function gorunumSiralamalar(){return SIRALAMA.gorunum()}
