// Embedded in index.html by scripts/embed-denemeler.cjs. No student data belongs here.
const DENEME_DERSLER = {
  TYT: [['turkce','Türkçe',40],['tarih','Tarih',5],['cografya','Coğrafya',5],['felsefe','Felsefe',5],['din','Din Kültürü',5],['sf','Ek Felsefe (muaf)',5],['mat','Matematik',30],['geo','Geometri',10],['fizik','Fizik',7],['kimya','Kimya',7],['biyoloji','Biyoloji',6]],
  AYT: [['edebiyat','Edebiyat',24],['tarih1','Tarih-1',10],['cografya1','Coğrafya-1',6],['tarih2','Tarih-2',11],['cografya2','Coğrafya-2',11],['felsefe','Felsefe Grubu',12],['din','Din Kültürü',6],['sf','Ek Felsefe (muaf)',6],['mat','Matematik',30],['geo','Geometri',10],['fizik','Fizik',14],['kimya','Kimya',13],['biyoloji','Biyoloji',13]]
};
const DENEME_ALAN = {SAY:['mat','geo','fizik','kimya','biyoloji'],EA:['mat','geo','edebiyat','tarih1','cografya1'],'SÖZ':['edebiyat','tarih1','cografya1','tarih2','cografya2','felsefe','din','sf']};
const denemeAdAnahtari = s => String(s || '').normalize('NFKC').toLocaleUpperCase('tr-TR').replace(/\s+/g,' ').trim();
const denemeSayi = x => Number(x).toLocaleString('tr-TR',{maximumFractionDigits:2});
const denemeNet = d => d.dogru - d.yanlis / 4;
const denemeKimligi = r => [denemeAdAnahtari(r.ad),r.tarih,r.tur,r.oturum,r.brans || ''].join('|');
const denemeAlan = () => DENEME_ALAN[EK.denemeAlan] ? EK.denemeAlan : DENEME_ALAN[D.ogr[EK.ogr]?.alan] ? D.ogr[EK.ogr].alan : 'SAY';
function denemeToplam(r, alan) {
  return r.dersler.filter(d => r.tur !== 'AYT' || (DENEME_ALAN[alan || r.alan] || DENEME_ALAN.SAY).includes(d.kod)).reduce((s,d)=>s+denemeNet(d),0);
}
// Net (doğru − yanlış / 4) per minute of completion time; null until a time is entered.
const denemeHiz = (r, alan) => r.sure ? denemeToplam(r, alan) / r.sure : null;
const DENEME_METRIK = {
  net:{ad:'Net',birim:' net',eksen:'Net',adim:1},
  hiz:{ad:'Net / dakika',birim:' net/dk',eksen:'Net / dakika (net ÷ süre)',adim:.1},
  sure:{ad:'Süre (dk)',birim:' dakika',eksen:'Tamamlama süresi (dk)',adim:1},
  puan:{ad:'Yayınevi puanı',birim:' puan',eksen:'Yayınevi puanı (sonuç raporundaki)',adim:1}
};
// Net/dk applies only to branş denemeleri; TYT/AYT fall back to net and keep the choice for Branş.
const denemeHizGecerli = tur => tur === 'BRANS';
const denemeMetrik = () => !DENEME_METRIK[EK.denemeMetrik] || EK.denemeMetrik === 'hiz' && !denemeHizGecerli(EK.denemeTur || 'TYT') ? 'net' : EK.denemeMetrik;
const denemeDeger = (r, metrik, alan) => metrik==='sure' ? r.sure : metrik==='puan' ? r.puan : metrik==='hiz' ? denemeHiz(r,alan) : denemeToplam(r,alan);
function denemeDogrula(liste) {
  if (!Array.isArray(liste) || liste.length > 1500) throw new Error('Deneme listesi geçersiz veya 1500 kayıt sınırını aşıyor.');
  const ids = new Set();
  for (const r of liste) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[mp]:/.test(r.id) || r.id.length > 600 || ids.has(r.id) ||
        typeof r.ad !== 'string' || !r.ad.trim() || r.ad.length > 120 || !isoTarihGecerli(r.tarih) ||
        !['TYT','AYT','BRANS'].includes(r.tur) || !['TYT','AYT'].includes(r.oturum) ||
        (r.tur !== 'BRANS' && r.tur !== r.oturum) || !Object.hasOwn(DENEME_ALAN,r.alan) ||
        !Number.isSafeInteger(r.ts) || r.ts <= 0 || r.ts > 100000000000000 ||
        (r.silindi !== undefined && typeof r.silindi !== 'boolean') ||
        (r.sure !== null && (!Number.isFinite(r.sure) || r.sure <= 0 || r.sure > 600)) ||
        (r.puan !== null && (!Number.isFinite(r.puan) || r.puan < 0 || r.puan > 600)) ||
        !Array.isArray(r.dersler) || !r.dersler.length || r.dersler.length > 13)
      throw new Error('Geçersiz deneme kaydı.');
    ids.add(r.id);
    const kodlar = new Set();
    for (const d of r.dersler) {
      const ders = DENEME_DERSLER[r.oturum].find(x=>x[0]===d.kod);
      const max = r.tur === 'BRANS' ? 200 : ['mat','geo'].includes(d.kod) ? 40 : ders?.[2];
      if (!ders || kodlar.has(d.kod) || !Number.isInteger(d.dogru) || !Number.isInteger(d.yanlis) || d.dogru < 0 || d.yanlis < 0 || d.dogru+d.yanlis > max ||
          (d.soru !== null && (!Number.isInteger(d.soru) || d.soru < 0 || d.soru > max || d.soru < d.dogru+d.yanlis)))
        throw new Error('Denemenin doğru/yanlış/soru sayıları geçersiz.');
      kodlar.add(d.kod);
    }
    if (r.tur === 'BRANS' && (r.dersler.length !== 1 || r.brans !== r.dersler[0].kod || !r.dersler[0].soru)) throw new Error('Branş denemesinde ders ve soru sayısı gerekli.');
    if (r.tur !== 'BRANS') {
      const toplam = kodlar => r.dersler.filter(d=>kodlar.includes(d.kod)).reduce((s,d)=>s+d.dogru+d.yanlis,0);
      if (toplam(['mat','geo']) > 40 || (r.oturum==='TYT' && toplam(['tarih','cografya','felsefe','din','sf'])>20) ||
          (r.oturum==='AYT' && toplam(['tarih2','cografya2','felsefe','din','sf'])>40)) throw new Error('Testteki toplam soru sınırı aşıldı.');
    }
  }
  return liste;
}
function denemeSureDogrula(liste) {
  if (!Array.isArray(liste) || liste.length > 3000 || new Set(liste.map(x=>x?.id)).size !== liste.length || liste.some(x=>!x || typeof x.id!=='string' || !/^[mp]:/.test(x.id) || x.id.length>600 || !Number.isSafeInteger(x.ts) || x.ts<=0 || x.ts>100000000000000 || (x.sure!==null && (!Number.isFinite(x.sure) || x.sure<=0 || x.sure>600)))) throw new Error('Deneme süreleri geçersiz.');
  return liste;
}
function denemeBirlestir(a=[], b=[], sure=false) {
  const dogrula = sure ? denemeSureDogrula : denemeDogrula;
  dogrula(a); dogrula(b);
  const map = new Map();
  for (const r of [...a,...b]) {
    const eski = map.get(r.id);
    if (!eski || r.ts>eski.ts || r.ts===eski.ts && JSON.stringify(r)>JSON.stringify(eski)) map.set(r.id,r);
  }
  const sonuc=Array.from(map.values()).sort((a,b)=>a.id.localeCompare(b.id));
  dogrula(sonuc); return JSON.parse(JSON.stringify(sonuc));
}
function denemeListe(si=EK.ogr) {
  // A deleted teacher row is only a tombstone; it must not hide the student's own entry.
  const o=D.ogr[si], okul=(o?.denemeOkul || []).filter(r=>!r.silindi), okulKimlik=new Set(okul.map(denemeKimligi));
  return [...(o?.denemeler || []).filter(r=>!okulKimlik.has(denemeKimligi(r)) && !okul.some(x=>denemeAyniSonuc(x,r))),...okul].filter(r=>!r.silindi).map(r=>{
    const sure=(o.denemeSure || []).find(x=>x.id===r.id);
    // Re-imports publish school rows with sure:null, which must not hide the student's
    // time; a newer non-empty teacher correction still wins.
    return {...r,sure:sure && (sure.ts>=r.ts || r.id.startsWith('p:') && r.sure===null)?sure.sure:r.sure};
  }).sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.id.localeCompare(b.id));
}
// Question counts are fixed, so a blank section (0 D / 0 Y) is a real 0 net. Every
// student takes the whole TYT and the AYT tests of their field; an AYT course outside
// the field counts only when answered. Din Kültürü and Ek Felsefe are alternatives:
// the one answered counts, Din Kültürü when neither was.
function denemeBolumSayilir(r, kod, alan) {
  const d = r.dersler.find(x => x.kod === kod), cevap = x => x.dogru + x.yanlis > 0;
  if (!d) return false;
  if (cevap(d)) return true;
  if (kod === 'sf' || kod === 'din' && r.dersler.some(x => x.kod === 'sf' && cevap(x))) return false;
  return r.oturum === 'TYT' || (DENEME_ALAN[alan] || []).includes(kod);
}
// A TYT/AYT exam's section for one course, shown in the Branş chart next to branch
// exams with its own marker. Derived on every draw and never stored: "g:" ids fail
// denemeDogrula, so they cannot reach a notebook, packet or cloud write.
function denemeGenelBolumleri(liste, oturum, brans) {
  const ders = DENEME_DERSLER[oturum]?.find(d => d[0] === brans);
  if (!ders) return [];
  // School imports carry no field of their own; the student's field decides their AYT tests.
  const ogrAlan = D.ogr[EK.ogr]?.alan;
  return liste.filter(r => r.tur === oturum).flatMap(r => {
    const d = r.dersler.find(x => x.kod === brans);
    if (!denemeBolumSayilir(r, brans, r.id.startsWith('p:') ? ogrAlan : r.alan)) return [];
    return [{id:'g:'+r.id+'|'+brans,ad:r.ad,tarih:r.tarih,tur:'BRANS',oturum,brans,alan:r.alan,
      dersler:[{...d,soru:d.soru ?? ders[2]}],sure:null,puan:null,ts:r.ts,genel:r.tur,kaynakId:r.id}];
  });
}
function denemeBul(id) {
  const tum=denemeListe();
  if (!String(id).startsWith('g:')) return tum.find(x=>x.id===id);
  const ayrac=id.lastIndexOf('|'),kaynak=tum.find(x=>x.id===id.slice(2,ayrac));
  return kaynak ? denemeGenelBolumleri([kaynak],kaynak.oturum,id.slice(ayrac+1))[0] : undefined;
}
function denemeOkulUygula(si, veri) {
  if (veri === undefined) return false;
  if (typeof veri !== 'string' || veri.length>300000) throw new Error('Okul deneme verisi geçersiz.');
  const gelen=denemeDogrula(JSON.parse(veri));
  if(gelen.some(r=>!r.id.startsWith('p:')))throw new Error('Okul deneme kimliği geçersiz.');
  const o=D.ogr[si], yeni=denemeBirlestir(o.denemeOkul,gelen);
  if (JSON.stringify(yeni)===JSON.stringify(o.denemeOkul || [])) return false;
  o.denemeOkul=yeni; return true;
}
// School results are optional for the rest of the app. A field this client cannot read
// (newer app version or damaged data) must not block plan/result sync or login.
function denemeOkulGuvenliUygula(si, veri) {
  try { return denemeOkulUygula(si, veri); }
  catch(e) { EK.denemeDurum=(rehberMi() && D.ogr[si] ? D.ogr[si].ad+': ' : '')+'Okul deneme sonuçları alınamadı: '+(e.message || e); return false; }
}

// Parse by PDF coordinates, never by a flattened token sequence: absent AYT nets
// must not shift TYT values, totals or YKS points into another subject.
function denemePdfCoz(sayfalar) {
  const rapor={ad:'',tarih:'',satirlar:[],uyarilar:[]};
  const merkez=t=>t.x+t.w/2;
  for (const [pi,items] of sayfalar.entries()) {
    const alan = etiket => {
      const t=items.find(x=>x.s===etiket);
      return t && items.filter(x=>x.x>t.x+t.w && Math.abs(x.y-t.y)<1).sort((a,b)=>a.x-b.x)[0]?.s;
    };
    const ad=alan('Sınav Adı:'), tarih=alan('Sınav Tarihi:'), m=tarih?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!ad || !m) throw new Error('Sınav adı/tarihi okunamadı. Metin içeren toplu sonuç PDF’si kullanın.');
    const iso=m[3]+'-'+m[2]+'-'+m[1];
    if (!isoTarihGecerli(iso) || rapor.ad && (rapor.ad!==ad || rapor.tarih!==iso)) throw new Error('PDF sayfalarında sınav bilgisi tutarsız.');
    rapor.ad=ad;rapor.tarih=iso;
    const dy=items.filter(x=>x.s==='D/Y').sort((a,b)=>a.x-b.x), birlesik=dy.length===25;
    if (![12,25].includes(dy.length)) throw new Error('Bu PDF sütun düzeni desteklenmiyor (TYT veya TYT+AYT toplu sonuç listesi bekleniyor).');
    const isim=items.find(x=>x.s==='NO/İsim'), sinif=items.find(x=>x.s==='Snf');
    if(!isim || !sinif)throw new Error('Öğrenci kimlik sütunları okunamadı.');
    const sutunlar=[...DENEME_DERSLER.TYT,...(birlesik?DENEME_DERSLER.AYT:[])];
    const beklenen=['TÜR','TAR','COĞ','FEL','DİN KÜL','S.F','MAT','GEO','FİZ','KİM','BİY',...(birlesik?['EDB','TAR','COĞ','TAR','COĞ','FEL GR.','DİN KÜL','S.F','MAT','GEO','FİZ','KİM','BİY']:[])];
    dy.slice(0,-1).forEach((t,i)=>{
      if(!items.some(x=>x.s===beklenen[i] && Math.abs(merkez(x)-merkez(t))<3 && x.y>t.y && x.y<t.y+26))throw new Error('PDF ders başlıkları beklenen sırada değil.');
    });
    const ranks=items.filter(x=>x.x<isim.x && x.y<dy[0].y && /^\d+$/.test(x.s)).sort((a,b)=>b.y-a.y);
    if(!ranks.length)throw new Error('PDF’de öğrenci satırı bulunamadı.');
    for(let ri=0;ri<ranks.length;ri++) {
      const rank=ranks[ri], ust=ri?(ranks[ri-1].y+rank.y)/2:rank.y+8, alt=ri+1<ranks.length?(rank.y+ranks[ri+1].y)/2:rank.y-9;
      const row=items.filter(x=>x.y<ust && x.y>alt), names=row.filter(x=>x.x>=isim.x-1 && x.x<sinif.x-12).sort((a,b)=>b.y-a.y||a.x-b.x);
      const nm=names.map(x=>x.s).join(' ').match(/^(\d+)\s*\/\s*(.+)$/);
      if(!nm)throw new Error('Sayfa '+(pi+1)+', sıra '+rank.s+': öğrenci adı/numarası okunamadı.');
      const cell=i=>row.filter(x=>Math.abs(merkez(x)-merkez(dy[i]))<Math.min(7,(i?merkez(dy[i])-merkez(dy[i-1]):20)/3));
      const dersler=sutunlar.map((d,i)=>{
        const c=cell(i), pairs=c.filter(x=>/^\d+\s*\/\s*\d+$/.test(x.s));
        if(pairs.length!==1)throw new Error('Sayfa '+(pi+1)+', sıra '+rank.s+': '+d[1]+' D/Y okunamadı.');
        const [dogru,yanlis]=pairs[0].s.split('/').map(Number), nets=c.filter(x=>/^-?\d+[.,]\d+$/.test(x.s));
        if(nets.length>1 || nets.length && Math.abs(Number(nets[0].s.replace(',','.'))-(dogru-yanlis/4))>0.011)throw new Error('PDF neti ile doğru/yanlış sayısı uyuşmuyor.');
        return {kod:d[0],dogru,yanlis,soru:null,netVar:!!nets.length};
      });
      const total=cell(dy.length-1).find(x=>/^-?\d+[.,]\d+$/.test(x.s));
      if(!total || Math.abs(Number(total.s.replace(',','.'))-dersler.reduce((s,d)=>s+denemeNet(d),0))>0.011)throw new Error('PDF toplam net kontrolü başarısız; hiçbir sonuç aktarılmadı.');
      for(const oturum of birlesik?['TYT','AYT']:['TYT']) {
        const bolum=oturum==='TYT'?dersler.slice(0,11):dersler.slice(11);
        // Missing session is printed as 0/0 in every column with no decimal nets.
        if(!bolum.some(x=>x.netVar || x.dogru || x.yanlis))continue;
        // The score is the first decimal column right of the total net, not the first text item.
        const puan=!birlesik ? row.filter(x=>x.x>dy.at(-1).x+12 && /^\d+[.,]\d+$/.test(x.s)).sort((a,b)=>a.x-b.x).map(x=>Number(x.s.replace(',','.')))[0] ?? null : null;
        rapor.satirlar.push({no:Number(nm[1]),ad:nm[2].trim(),oturum,puan,dersler:bolum.map(({netVar,...d})=>d),sayfa:pi+1});
      }
    }
  }
  if (!rapor.satirlar.length) throw new Error('PDF’de aktarılabilir sonuç yok.');
  return rapor;
}
let DENEME_PDF_MODUL;
async function denemePdfOku(file) {
  if(file.size>15*1024*1024)throw new Error('PDF en fazla 15 MB olabilir.');
  if(!DENEME_PDF_MODUL) DENEME_PDF_MODUL=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs').catch(e=>{DENEME_PDF_MODUL=null;throw new Error('PDF okuyucu yüklenemedi. İnternet bağlantısını kontrol edin.');});
  const pdfjs=await DENEME_PDF_MODUL;
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  try {
    const pdf=await task.promise;
    if(pdf.numPages>100)throw new Error('PDF en fazla 100 sayfa olabilir.');
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++) {
      const page=await pdf.getPage(n), text=await page.getTextContent();
      pages.push(text.items.filter(x=>x.str?.trim()).map(x=>({s:x.str.trim(),x:x.transform[4],y:x.transform[5],w:x.width,h:x.height})));
      page.cleanup();
    }
    return {...denemePdfCoz(pages),dosya:file.name};
  } finally { await task.destroy(); }
}
const denemeHedefKimligi = o => o ? [o.ogrenciBulutId || '',o.no,denemeAdAnahtari(o.ad),o.sube].join('|') : '';
function denemeOgrenciEsle(row) {
  const aday=D.ogr.map((o,i)=>({o,i})).filter(({o})=>!o.silindi && Number(o.no)===row.no && denemeAdAnahtari(o.ad)===denemeAdAnahtari(row.ad));
  return aday.length===1?aday[0].i:-1;
}
function denemePdfKaydi(rapor,row) {
  const r={id:'p:'+encodeURIComponent([denemeAdAnahtari(rapor.ad),rapor.tarih,row.oturum].join('|')),ad:rapor.ad,tarih:rapor.tarih,tur:row.oturum,oturum:row.oturum,brans:'',alan:'SAY',dersler:row.dersler,sure:null,puan:row.puan,ts:Date.now()};
  denemeDogrula([r]);return r;
}
function denemeAyniSonuc(a,b) {
  return denemeAdAnahtari(a.ad)===denemeAdAnahtari(b.ad) && a.oturum===b.oturum && a.tur===b.tur &&
    JSON.stringify(a.dersler.map(d=>[d.kod,d.dogru,d.yanlis]).sort())===JSON.stringify(b.dersler.map(d=>[d.kod,d.dogru,d.yanlis]).sort());
}
let DENEME_IMPORT=null, DENEME_FORM=null, DENEME_ISLEM=false;
// Checks one preview row against the target's school results and earlier rows of the
// same selection. Deleted results are reported as deleted, not as duplicates, and are
// not re-added unless the teacher selects them.
function denemeImportSatiri(rapor,row,oncekiSatirlar=[]) {
  const r=denemePdfKaydi(rapor,row),mevcut=D.ogr[row.si]?.denemeOkul || [],eslesir=x=>x.id===r.id || denemeAyniSonuc(x,r);
  const ayni=[...mevcut.filter(x=>!x.silindi),...oncekiSatirlar].find(eslesir), silinen=!ayni && mevcut.some(x=>x.silindi && eslesir(x));
  row.hedefKimlik=denemeHedefKimligi(D.ogr[row.si]);
  row.uyari=ayni ? (denemeAyniSonuc(ayni,r)?'Tekrar sonuç; varsayılan olarak atlanır ('+ayni.tarih+').':'Mevcut sonuç değişecek; kontrol edip seçin.') :
    silinen ? 'Bu sonuç daha önce silindi; yeniden eklemek için seçin.' : row.si<0?'Numara + ad eşleşmedi; öğrenci seçin.':'';
  row.secili=row.si>=0 && !ayni && !silinen;
  return r;
}
function denemeImportHazirla(raporlar) {
  // TYT-only reports carry the actual TYT date; combined reports repeat that session.
  raporlar.sort((a,b)=>Number(a.satirlar.some(r=>r.oturum==='AYT'))-Number(b.satirlar.some(r=>r.oturum==='AYT')));
  const gorulen=new Map();
  for(const rapor of raporlar)for(const row of rapor.satirlar) {
    row.si=denemeOgrenciEsle(row);
    const key=row.no+'|'+denemeAdAnahtari(row.ad), r=denemeImportSatiri(rapor,row,gorulen.get(key)||[]);
    gorulen.set(key,[...(gorulen.get(key)||[]),r]);
  }
  return raporlar;
}
// A manual target change re-runs the duplicate/deletion checks for the new student.
function denemeImportHedefDegistir(pi,ri,si) {
  const row=DENEME_IMPORT[pi].satirlar[ri];row.si=si;
  const onceki=DENEME_IMPORT.flatMap(p=>p.satirlar.filter(x=>x!==row && x.secili && x.si===si).map(x=>denemePdfKaydi(p,x)));
  denemeImportSatiri(DENEME_IMPORT[pi],row,onceki);
}

// Only the teacher writes this independent field. Students' result packets can
// neither erase imported exams nor forge a teacher result. Transactions merge
// individual IDs, so retries/other teacher tabs do not duplicate the import.
async function denemeOkulYayinla(si) {
  if(!rehberMi())throw new Error('Yalnızca rehber öğretmen yayınlayabilir.');
  const b=window.bulut,u=b?.mevcutKullanici(),defter=D,o=D.ogr[si];
  if(!b?.yapilandirilmis || !u || u.isAnonymous)throw new Error('Öğretmen Google hesabınızla buluta bağlanın.');
  syncIdSagla(si);
  if(!await kaydet(true))throw new Error('Öğrenci bağlantısı cihaza kaydedilemedi.');
  const ayir=await oncedenAyir(si);
  if(ayir?.tur==='hata')throw new Error(ayir.mesaj);
  const coz=await bulutYuvasiCoz(si);
  if(coz.hata || !coz.anlik)throw new Error(coz.hata || 'Öğrenci bulut bağlantısı yok.');
  const syncId=o.syncId,ref=b.doc(b.db,'ogrenciler',syncId); let birlesen;
  await sureSinirli(b.runTransaction(b.db,async tx=>{
    const s=await tx.get(ref),v=s.exists()?s.data():null;
    if(D!==defter || !rehberMi() || b.mevcutKullanici()?.uid!==u.uid || o.syncId!==syncId)throw new Error('Oturum değişti.');
    if(!v || v.durum!=='aktif' || v.ogretmenUid!==u.uid || v.ogrenciBulutId!==o.ogrenciBulutId)throw new Error('Öğrenci bağlantısı eşleşmedi.');
    birlesen=denemeBirlestir(v.denemeOkul?JSON.parse(v.denemeOkul):[],o.denemeOkul || []);
    const veri=JSON.stringify(birlesen);
    if(baytBoyu(veri)>300000 || baytBoyu(JSON.stringify({...v,denemeOkul:veri}))>BULUT_YEDEK_UST_SINIR)throw new Error('Deneme geçmişi sunucu sınırını aşıyor.');
    tx.update(ref,{denemeOkul:veri});
  }),BULUT_YAZMA_ZAMAN_ASIMI,'Denemeler sunucuya zamanında ulaşmadı. Yeniden yayınlamayı deneyin.');
  if(D!==defter || !rehberMi())throw new Error('Oturum değişti.');
  o.denemeOkul=denemeBirlestir(o.denemeOkul,birlesen);
  o.denemeYayinBekliyor=false;
}
let DENEME_DINLEYICI=null,DENEME_DINLEME_ANAHTAR='',DENEME_DINLEME_DEFTER=null;
function denemeDinlemeyiDurdur() { if(DENEME_DINLEYICI)DENEME_DINLEYICI();DENEME_DINLEYICI=null;DENEME_DINLEME_ANAHTAR='';DENEME_DINLEME_DEFTER=null; }
function denemeDinlemeyiBaslat() {
  const b=window.bulut,u=b?.mevcutKullanici?.(),o=D?.ogr?.[0];
  if(CIKIS_DURUMU || !ogrenciMi() || !o?.syncId || !b?.yapilandirilmis || !u || typeof b.onSnapshot!=='function'){denemeDinlemeyiDurdur();return;}
  const key=u.uid+'|'+o.syncId;
  if(DENEME_DINLEME_ANAHTAR===key && DENEME_DINLEME_DEFTER===D)return;
  denemeDinlemeyiDurdur();DENEME_DINLEME_ANAHTAR=key;DENEME_DINLEME_DEFTER=D;const defter=D;
  DENEME_DINLEYICI=b.onSnapshot(b.doc(b.db,'ogrenciler',o.syncId),s=>{
    if(D!==defter || !ogrenciMi() || CIKIS_DURUMU || b.mevcutKullanici()?.uid!==u.uid || !s.exists() || s.metadata?.hasPendingWrites)return;
    const v=s.data();if(v.durum!=='aktif' || v.bagliUid!==u.uid || v.ogrenciBulutId!==o.ogrenciBulutId)return;
    try { if(denemeOkulUygula(0,v.denemeOkul)){
      // Receiving teacher data is not a student edit. Advancing ogrCalismaTs here
      // would let an idle device overwrite another device's newer working plan.
      localStorage.setItem('yks_veri',JSON.stringify(D));
      if(EK.sekme==='denemeler' && !DENEME_FORM)ciz();
    } }
    catch(e){EK.denemeDurum='Okul sonuçları alınamadı: '+e.message;}
  },e=>{denemeDinlemeyiDurdur();EK.denemeDurum='Okul sonuçları alınamadı; bağlantı yenilendiğinde tekrar denenecek. '+(e.message||e);});
}

function denemeDetay(r) {
  if(r.genel){
    const d=r.dersler[0],ders=DENEME_DERSLER[r.oturum].find(x=>x[0]===d.kod)[1];
    return '<div class="dn-detay-bas"><div><b>'+kacis(r.ad)+'</b><div class="mini">'+kacis(r.tarih)+' · <span class="dn-genel-rozet">'+r.genel+' denemesinden</span> · '+kacis(ders)+' bölümü</div></div><strong>'+denemeSayi(denemeNet(d))+' net</strong></div>'+
      '<p class="mini">'+d.dogru+' D / '+d.yanlis+' Y / '+(d.soru-d.dogru-d.yanlis)+' B · '+d.soru+' soru. Süre ve yayınevi puanı bütün denemeye ait olduğu için bu bölümde gösterilmez; değiştirmek için denemenin kendisini aç.</p>'+
      '<div class="arac"><button class="dugme" data-dn-kaynak="'+kacis(r.kaynakId)+'">'+r.genel+' denemesini aç</button></div>';
  }
  const alan=denemeAlan(),hiz=denemeHiz(r,alan);
  return '<div class="dn-detay-bas"><div><b>'+kacis(r.ad)+'</b><div class="mini">'+kacis(r.tarih)+' · '+(r.id.startsWith('p:')?'Öğretmen aktarımı':'Elle girildi')+'</div></div><strong>'+denemeSayi(denemeToplam(r,alan))+' net</strong></div>'+
    '<div class="dn-ozet mini"><span>Süre: '+(r.sure===null?'Girilmedi':denemeSayi(r.sure)+' dk')+'</span>'+(denemeHizGecerli(r.tur)?'<span>Net/dk: '+(hiz===null?'süre girilince hesaplanır':denemeSayi(hiz))+'</span>':'')+(r.puan!==null?'<span>Yayınevi puanı: '+denemeSayi(r.puan)+'</span>':'')+'</div>'+
    // In a TYT/AYT exam each course opens its own progress chart under Branş denemeleri.
    '<div class="dn-ders-detay">'+r.dersler.map(d=>{const ad=DENEME_DERSLER[r.oturum].find(x=>x[0]===d.kod)[1],ic='<span>'+kacis(ad)+'</span><b>'+denemeSayi(denemeNet(d))+'</b><small>'+d.dogru+' D / '+d.yanlis+' Y'+(d.soru===null?'':' / '+(d.soru-d.dogru-d.yanlis)+' B')+'</small>';
      return r.tur==='BRANS'?'<div>'+ic+'</div>':'<button type="button" data-dn-brans-git="'+r.oturum+':'+d.kod+'" data-dn-kaynak-id="'+kacis(r.id)+'" aria-label="'+kacis(ad+': '+denemeSayi(denemeNet(d))+' net, '+d.dogru+' doğru, '+d.yanlis+' yanlış. '+ad+' gelişimini Branş denemelerinde gör')+'">'+ic+'<small class="dn-git">Ders gelişimi →</small></button>';}).join('')+'</div>'+
    '<div class="arac">'+(ogrenciMi() || r.id.startsWith('p:')?'<button class="dugme" data-dn-sure="'+kacis(r.id)+'">Süreyi gir / düzelt</button>':'')+((r.id.startsWith('p:')?rehberMi():ogrenciMi())?'<button class="dugme" data-dn-edit="'+kacis(r.id)+'">Düzenle</button><button class="dugme" data-dn-sil="'+kacis(r.id)+'">Sil</button>':'')+'</div>';
}
function denemeGrafik(liste) {
  if(!liste.length)return '<div class="dn-bos"><b>Henüz deneme yok</b><p>İlk sonucunu eklediğinde gelişimin burada görünecek.</p></div>';
  const alan=denemeAlan(),metrik=denemeMetrik(),m=DENEME_METRIK[metrik],val=r=>denemeDeger(r,metrik,alan);
  const points=liste.filter(r=>val(r)!==null),eksik=liste.length-points.length;
  if(!points.length)return '<div class="dn-bos">'+(metrik==='puan'?'Bu grafik için yayınevi puanı gerekli. Denemeyi düzenleyip sonuç raporundaki puanı ekleyin.':'Bu grafik için tamamlama süresi gerekli. Denemenin ayrıntısında “Süreyi gir / düzelt” ile süre ekleyin.')+'</div>';
  // Net/dk values are around 0–1, so the minimum axis span follows the metric.
  const width=Math.max(320,Math.min(900,(document.getElementById('ana')?.clientWidth||960)-56)),height=280,left=50,right=22,top=24,bottom=38,values=points.map(val),lo=Math.min(0,...values),hi=Math.max(...values,m.adim),pad=Math.max((hi-lo)*.12,m.adim),min=lo<0?lo-pad:0,max=hi+pad;
  const dates=points.map(r=>gunNo(r.tarih)),first=Math.min(...dates),last=Math.max(...dates),x=i=>first===last?(points.length===1?width/2:left+i*(width-left-right)/(points.length-1)):left+(dates[i]-first)*(width-left-right)/(last-first),y=v=>height-bottom-(v-min)*(height-top-bottom)/(max-min);
  const coords=points.map((r,i)=>{const same=dates.map((d,j)=>d===dates[i]?j:-1).filter(j=>j>=0),offset=first===last?0:(same.indexOf(i)-(same.length-1)/2)*Math.min(8,24/Math.max(1,same.length-1));return [Math.max(left,Math.min(width-right,x(i)+offset)),y(val(r))];}),line=coords.map(p=>p.join(',')).join(' '),ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  // Borsa grafiği gibi: her çizgi parçası, vardığı denemenin önceki (en fazla) 4 denemenin ortalamasına
  // göre; her nokta bir önceki denemeye göre renklenir. Süre grafiğinde kısalma iyileşmedir.
  const iyiYon=metrik==='sure'?-1:1,yon=(a,b)=>Math.abs(a-b)<.005?'esit':(a-b)*iyiYon>0?'yukari':'asagi';
  const ort4=i=>{const once=values.slice(Math.max(0,i-4),i);return once.reduce((s,v)=>s+v,0)/once.length;};
  const fark=d=>(d>0?'+':'')+denemeSayi(d)+m.birim;
  const egilim=i=>i?' · önceki denemeye göre '+fark(values[i]-values[i-1])+' · önceki '+Math.min(i,4)+' deneme ortalaması '+denemeSayi(ort4(i))+m.birim:' · ilk deneme';
  const parcalar=coords.slice(1).map((p,j)=>'<line x1="'+coords[j][0]+'" y1="'+coords[j][1]+'" x2="'+p[0]+'" y2="'+p[1]+'" class="dn-seg '+yon(values[j+1],ort4(j+1))+'"/>').join('');
  const ortCizgi=points.length>2?'<polyline points="'+coords.slice(1).map((p,j)=>p[0]+','+y(ort4(j+1))).join(' ')+'" class="dn-ort"/>':'';
  return '<div class="dn-chart"><svg viewBox="0 0 '+width+' '+height+'" role="group" aria-label="Deneme gelişim grafiği. Noktaları seçerek sonuçları inceleyin.">'+
    ticks.map(t=>'<line x1="'+left+'" y1="'+y(t)+'" x2="'+(width-right)+'" y2="'+y(t)+'" class="dn-grid"/><text x="'+(left-8)+'" y="'+(y(t)+4)+'" text-anchor="end">'+denemeSayi(t)+'</text>').join('')+
    '<polygon points="'+left+','+(height-bottom)+' '+line+' '+coords.at(-1)[0]+','+(height-bottom)+'" class="dn-area"/>'+ortCizgi+parcalar+
    points.map((r,i)=>{const kaynak=r.genel?' · '+r.genel+' denemesinden':'';return '<circle class="dn-dot '+(i?yon(values[i],values[i-1]):'esit')+(r.genel?' genel':'')+'" tabindex="0" role="button" aria-label="'+kacis(r.ad+kaynak+' '+r.tarih+' '+denemeSayi(val(r))+m.birim+egilim(i))+'" data-dn-dot="'+kacis(r.id)+'" cx="'+coords[i][0]+'" cy="'+coords[i][1]+'" r="6"><title>'+kacis(r.ad+kaynak+' · '+r.tarih+' · '+denemeSayi(val(r))+m.birim+egilim(i))+'</title></circle>';}).join('')+
    '<text x="'+left+'" y="'+(height-10)+'">'+points[0].tarih+'</text><text x="'+(width-right)+'" y="'+(height-10)+'" text-anchor="end">'+(points.length>1?points.at(-1).tarih:'')+'</text></svg><p class="mini">Tarih → · '+m.eksen+' · Noktaya gel, dokun veya klavyeyle seç.'+
    (points.length>1?' Çizgi yeşil: önceki 4 denemenin ortalamasının üstünde (kesikli çizgi), kırmızı: altında, gri: eşit. Nokta yeşil: bir önceki denemeden '+(metrik==='sure'?'kısa':'yüksek')+', kırmızı: '+(metrik==='sure'?'uzun':'düşük')+'.':'')+
    (points.some(r=>r.genel)?' İçi boş nokta: TYT/AYT denemesindeki bu dersin bölümü; dolu nokta: branş denemesi.':'')+
    (metrik==='hiz'?' Net = doğru − yanlış / 4; net/dk = net ÷ tamamlama süresi.':'')+(eksik?' '+eksik+' deneme '+(metrik==='puan'?'yayınevi puanı':'süre')+' girilmediği için grafikte yok.':'')+'</p></div>';
}
// Haftalar haritasının yanındaki deneme gelişimi. Üstteki seçim TYT, AYT ya da bir branştır
// (EK.denemeYol, EK.denemeYolBrans = "TYT:mat"). Eksenler baştan sabittir: x dönem başından
// YKS tarihine, y 0’dan seçimin soru sayısına (TYT 120, AYT 80, branşta o dersin soruları).
// Her yeni deneme kendi tarihine düşer, çizgi zamanla YKS’ye doğru uzar. Branşta TYT/AYT
// denemelerinin o dersteki bölümleri içi boş noktadır. Hedef net her seçim için ayrıdır
// (o.denemeHedef = {TYT, AYT, "TYT:mat", …}); eski tek sayı TYT hedefidir.
const DENEME_AY = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const DENEME_YOL_UST = {TYT:120,AYT:80};
// Branş listesi: TYT’nin bütün dersleri ve öğrencinin alanındaki AYT dersleri (Ek Felsefe hariç).
function denemeYolBranslari(o) {
  const alan=DENEME_ALAN[o?.alan]?o.alan:'SAY';
  return [['TYT',DENEME_DERSLER.TYT.filter(d=>d[0]!=='sf')],['AYT',DENEME_DERSLER.AYT.filter(d=>d[0]!=='sf' && DENEME_ALAN[alan].includes(d[0]))]];
}
function denemeYolSecimi(o) {
  const tur=['TYT','AYT','BRANS'].includes(EK.denemeYol)?EK.denemeYol:'TYT';
  if(tur!=='BRANS')return {tur,anahtar:tur,ust:DENEME_YOL_UST[tur],ad:tur};
  const liste=denemeYolBranslari(o),[oturum,kod]=String(EK.denemeYolBrans || '').split(':');
  const grup=liste.find(g=>g[0]===oturum),ders=grup?.[1].find(d=>d[0]===kod) || liste[0][1].find(d=>d[0]==='mat');
  const ot=grup && grup[1].includes(ders)?oturum:'TYT';
  return {tur,anahtar:ot+':'+ders[0],oturum:ot,kod:ders[0],ust:ders[2],ad:ot+' '+ders[1]};
}
function denemeHedefOku(o,anahtar) {
  const h=o?.denemeHedef,v=typeof h==='number'?(anahtar==='TYT'?h:undefined):h && typeof h==='object'?h[anahtar]:undefined;
  return Number.isFinite(v)?v:null;
}
// Sayılar 4–7 aralığa bölünür; üst sınır adımın katına yuvarlanır (7 soru → 0–7, 13 → 0–14).
function denemeYolEksen(ust,enAz,enCok) {
  const tepe=Math.max(ust,enCok),adim=[1,2,4,5,10,20,25,50].find(a=>tepe/a<=7) || 100;
  return {adim,ust:Math.ceil(tepe/adim)*adim,alt:Math.min(0,Math.floor(enAz/adim)*adim)};
}
function denemeYolVerisi(si) {
  const o=D.ogr[si];if(!o)return null;
  const bas=pazartesi(gunNo(D.ayar.donemBasi)),son=gunNo(D.ayar.sinav);
  if(!Number.isFinite(bas) || !Number.isFinite(son) || son<=bas)return null;
  const alan=DENEME_ALAN[o.alan]?o.alan:'SAY',tum=denemeListe(si),secim=denemeYolSecimi(o);
  let liste;
  if(secim.tur==='TYT')liste=tum.filter(r=>r.tur==='TYT');
  else if(secim.tur==='AYT')liste=tum.filter(r=>r.tur==='AYT' && (r.id.startsWith('p:') || r.alan===alan));
  else liste=[...tum.filter(r=>r.tur==='BRANS' && r.oturum===secim.oturum && r.brans===secim.kod),...denemeGenelBolumleri(tum,secim.oturum,secim.kod)];
  let noktalar=liste.map(r=>({r,g:gunNo(r.tarih),v:denemeToplam(r,alan)}));
  const once=noktalar.filter(n=>n.g<bas).length;
  noktalar=noktalar.filter(n=>n.g>=bas && n.g<=son).sort((a,b)=>a.g-b.g||a.r.id.localeCompare(b.r.id));
  const hedef=denemeHedefOku(o,secim.anahtar),degerler=noktalar.map(n=>n.v);
  return {o,bas,son,secim,noktalar,once,hedef,eksen:denemeYolEksen(secim.ust,Math.min(0,...degerler),Math.max(hedef ?? 0,...degerler))};
}
// W×H, kartta kalan alanın kendisidir (ölçek s ile); yazılar böylece her ekranda aynı boyda
// kalır, büyük ekranda biraz irileşir. Ölçü yoksa (test, yazdırma) 480×270 çizilir.
function denemeYolSvg(v,H=270,W=480) {
  const {bas,son,secim,noktalar,hedef,eksen}=v,{alt,ust,adim:yAdim}=eksen;
  const L=34,R=16,T=14,B=30;
  const x=g=>L+(g-bas)/(son-bas)*(W-L-R),y=v=>H-B-(v-alt)/(ust-alt)*(H-T-B),r1=n=>Math.round(n*10)/10;
  // Ay başları x ekseninde; etiketler en az ~55 birim aralıklı kalsın diye seyreltilir.
  const aylar=[];for(let [yil,ay]=isoDan(bas).split('-').map(Number);;){ay++;if(ay>12){ay=1;yil++;}const g=gunNo(yil+'-'+String(ay).padStart(2,'0')+'-01');if(g>=son)break;aylar.push([g,DENEME_AY[ay-1]]);}
  const adim=Math.max(1,Math.ceil(aylar.length/Math.max(2,Math.floor((W-L-R)/55)))),bugun=bugunNo();
  const ticks=[];for(let t=alt;t<=ust;t+=yAdim)ticks.push(t);
  let svg='<svg viewBox="0 0 '+r1(W)+' '+r1(H)+'" role="group" aria-label="'+kacis(secim.ad)+' deneme gelişimi: dönem başından YKS’ye kadar">'+
    ticks.map(t=>'<line class="yg-izgara" x1="'+L+'" x2="'+r1(W-R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text x="'+(L-6)+'" y="'+r1(y(t)+4)+'" text-anchor="end">'+denemeSayi(t)+'</text>').join('')+
    aylar.filter((_,i)=>i%adim===0).map(([g,ad])=>'<text x="'+r1(x(g))+'" y="'+r1(H-10)+'" text-anchor="middle">'+ad+'</text>').join('')+
    '<line class="yg-eksen" x1="'+L+'" x2="'+r1(W-R)+'" y1="'+r1(y(alt))+'" y2="'+r1(y(alt))+'"/>'+
    (bugun>bas && bugun<son?'<line class="yg-bugun" x1="'+r1(x(bugun))+'" x2="'+r1(x(bugun))+'" y1="'+T+'" y2="'+r1(H-B)+'"/><text class="yg-bugun-yazi" x="'+r1(x(bugun))+'" y="'+(T+10)+'" text-anchor="middle">Bugün</text>':'')+
    '<line class="yg-yks" x1="'+r1(x(son))+'" x2="'+r1(x(son))+'" y1="'+T+'" y2="'+r1(H-B)+'"/><text class="yg-yks-yazi" x="'+r1(x(son)-4)+'" y="'+(T+10)+'" text-anchor="end">★ YKS</text>'+
    (hedef===null?'':'<line class="yg-hedef" x1="'+L+'" x2="'+r1(x(son))+'" y1="'+r1(y(hedef))+'" y2="'+r1(y(hedef))+'"/><text class="yg-hedef-yazi" x="'+(L+6)+'" y="'+r1(y(hedef)-5)+'">Hedef '+denemeSayi(hedef)+'</text>');
  const sinif='yg-'+(secim.tur==='BRANS'?'BRANS':secim.tur);
  if(noktalar.length>1)svg+='<polyline class="yg-cizgi '+sinif+'" points="'+noktalar.map(n=>r1(x(n.g))+','+r1(y(n.v))).join(' ')+'"/>';
  svg+=noktalar.map(n=>{const etiket=secim.ad+' · '+n.r.ad+(n.r.genel?' ('+n.r.genel+' denemesinden)':'')+' · '+n.r.tarih+' · '+denemeSayi(n.v)+' net';
    return '<circle class="yg-nokta '+sinif+(n.r.genel?' genel':'')+'" cx="'+r1(x(n.g))+'" cy="'+r1(y(n.v))+'" r="5" tabindex="0" role="button" data-dn-yol="'+kacis(n.r.id)+'" aria-label="'+kacis(etiket+'. Denemelerim’de aç')+'"><title>'+kacis(etiket)+'</title></circle>';}).join('');
  if(!noktalar.length)svg+='<text class="yg-bos" x="'+r1((L+W-R)/2)+'" y="'+r1(H/2)+'" text-anchor="middle">Henüz '+kacis(secim.ad)+' denemesi yok</text>';
  return svg+'</svg>';
}
// Grafik kartı haritayla aynı boydadır; çizim, kartta kalan alanın ölçüsüne göre yeniden kurulur.
let DENEME_YOL_ZAMAN=null;
function denemeYolSigdir() {
  const alan=document.querySelector && document.querySelector('.dn-yol .yg-alan');
  if(!alan || !alan.clientWidth || !alan.clientHeight)return;
  const s=Math.max(1,Math.min(1.35,alan.clientWidth/520)),W=Math.round(Math.max(300,alan.clientWidth/s)),H=Math.round(Math.max(200,Math.min(700,alan.clientHeight*W/alan.clientWidth)));
  if(Math.abs(W-Number(alan.dataset.w))<4 && Math.abs(H-Number(alan.dataset.h))<4)return;
  const v=denemeYolVerisi(Number(alan.dataset.si));if(!v)return;
  alan.dataset.w=String(W);alan.dataset.h=String(H);alan.innerHTML=denemeYolSvg(v,H,W);
}
function denemeYolSigdirPlanla() {
  if(typeof window==='undefined' || !window.requestAnimationFrame)return;
  window.cancelAnimationFrame(DENEME_YOL_ZAMAN);DENEME_YOL_ZAMAN=window.requestAnimationFrame(denemeYolSigdir);
}
if(typeof window!=='undefined' && window.addEventListener)window.addEventListener('resize',denemeYolSigdirPlanla);
function denemeYolGrafigi(si=EK.ogr) {
  const v=denemeYolVerisi(si);if(!v)return '';
  const {bas,secim,noktalar,once,hedef}=v,hedefUst=secim.ust;
  denemeYolSigdirPlanla();
  const secici='<div class="yg-secim" role="group" aria-label="Grafikte göster">'+[['TYT','TYT'],['AYT','AYT'],['BRANS','Branş']].map(([k,ad])=>
    '<button type="button" class="'+(secim.tur===k?'secili':'')+'" aria-pressed="'+(secim.tur===k)+'" data-dn-yol-sec="'+k+'">'+ad+'</button>').join('')+'</div>'+
    (secim.tur==='BRANS'?'<label class="yg-brans">Ders <select id="dnYolBrans">'+denemeYolBranslari(v.o).map(([ot,l])=>'<optgroup label="'+ot+'">'+
      l.map(d=>'<option value="'+ot+':'+d[0]+'"'+(secim.anahtar===ot+':'+d[0]?' selected':'')+'>'+kacis(d[1])+'</option>').join('')+'</optgroup>').join('')+'</select></label>':'');
  return '<section class="kart dn-yol" aria-label="Deneme gelişimi"><div class="dn-yol-bas">'+secici+'</div>'+
    '<div class="yg-alan" data-si="'+si+'" data-w="480" data-h="270">'+denemeYolSvg(v)+'</div>'+
    '<p class="mini yg-lejant">'+(!noktalar.length?'Sonuç ekledikçe noktalar YKS’ye doğru ilerler.':secim.tur!=='BRANS'?'<span class="yg-'+secim.tur+'">'+secim.ad+' net</span>':
      // Branşta dolu nokta branş denemesi, içi boş nokta TYT/AYT denemesindeki o dersin bölümüdür.
      '<b>'+kacis(secim.ad)+' net:</b> '+[noktalar.some(n=>!n.r.genel)?'<span class="yg-BRANS">branş denemesi</span>':'',
        noktalar.some(n=>n.r.genel)?'<span class="yg-genel">'+secim.oturum+' denemesinden</span>':''].filter(Boolean).join(' '))+
    (once?' · '+once+' deneme dönem başından ('+ggyy(bas)+') önce; Denemelerim’de görünür.':'')+'</p>'+
    (ogrenciMi()?'<label class="yg-hedef-sec">Hedef belirle <input type="number" id="dnHedef" data-anahtar="'+secim.anahtar+'" min="0" max="'+hedefUst+'" step="1" inputmode="numeric" value="'+(hedef===null?'':hedef)+'" placeholder="—" aria-label="'+kacis(secim.ad)+' hedef net (0–'+hedefUst+')"> net <small>'+kacis(secim.ad)+'</small></label>':'')+'</section>';
}
function denemeFormHtml() {
  const f=DENEME_FORM;if(!f || f.si!==EK.ogr)return '';
  const r=f.kayit,sec=(v,x)=>v===x?' selected':'';
  const dersler=DENEME_DERSLER[r.oturum].filter(d=>r.tur==='BRANS'?d[0]===r.brans:r.tur!=='AYT'||DENEME_ALAN[r.alan].includes(d[0])||r.dersler.some(x=>x.kod===d[0]));
  return '<div class="ortu" id="dnOrtu"><form id="dnForm" class="pencere dn-pencere" role="dialog" aria-modal="true" aria-labelledby="dnFormBaslik"><div class="dn-pencere-ust"><h2 id="dnFormBaslik">'+(f.edit?'Denemeyi düzenle':'Deneme ekle')+'</h2><button type="button" class="kapat" id="dnKapat" aria-label="Kapat">×</button></div><div class="dn-pencere-govde"><div class="dn-form-grid">'+
    '<label>Deneme adı<input id="dnAd" required maxlength="120" value="'+kacis(r.ad)+'" placeholder="Yayın / deneme adı"></label><label>Tarih<input id="dnTarih" type="date" required value="'+r.tarih+'" max="'+isoDan(etkinlikBugun())+'"></label>'+
    '<label>Tür<select id="dnTur">'+['TYT','AYT','BRANS'].map(t=>'<option value="'+t+'"'+sec(r.tur,t)+'>'+(t==='BRANS'?'Branş denemesi':t)+'</option>').join('')+'</select></label>'+
    (r.tur==='BRANS'?'<label>Oturum<select id="dnOturum"><option'+sec(r.oturum,'TYT')+'>TYT</option><option'+sec(r.oturum,'AYT')+'>AYT</option></select></label><label>Branş<select id="dnBrans">'+DENEME_DERSLER[r.oturum].map(d=>'<option value="'+d[0]+'"'+sec(r.brans,d[0])+'>'+d[1]+'</option>').join('')+'</select></label>':'')+
    (r.tur==='AYT'?'<label>Alan<select id="dnAlan">'+Object.keys(DENEME_ALAN).map(a=>'<option'+sec(r.alan,a)+'>'+a+'</option>').join('')+'</select></label>':'')+
    '<label>Tamamlama süresi (dk)<input id="dnSure" type="number" min="0.1" max="600" step="0.1" value="'+(r.sure??'')+'" placeholder="İsteğe bağlı"></label><label>Yayınevi puanı<input id="dnPuan" type="number" min="0" max="600" step="0.01" value="'+(r.puan??'')+'" placeholder="İsteğe bağlı · sonuç raporundaki puan"></label></div>'+
    '<p class="mini">Net = doğru − yanlış / 4. Matematik ve geometri ayrı girilir; toplamı 40 soruyu geçemez. Ek felsefe yalnızca Din Kültürü muafiyeti içindir.</p><div class="dn-entry"><div class="dn-entry-row dn-entry-head"><b>Ders</b><b>Soru</b><b>Doğru</b><b>Yanlış</b><b>Net</b></div>'+
    dersler.map(d=>{const v=r.dersler.find(x=>x.kod===d[0])||{soru:d[2],dogru:0,yanlis:0};return '<div class="dn-entry-row" data-dn-ders="'+d[0]+'"><label>'+d[1]+'</label>'+['soru','dogru','yanlis'].map(k=>'<input aria-label="'+d[1]+' '+k+'" data-dn-value="'+k+'" type="number" min="0" max="200" step="1" required value="'+(v[k]??d[2])+'">').join('')+'<output>'+denemeSayi(denemeNet(v))+'</output></div>';}).join('')+'</div><p id="dnFormHata" role="alert"></p></div><div class="arac dn-pencere-alt"><button class="dugme birincil" type="submit">Denemeyi kaydet</button><button class="dugme" type="button" id="dnVazgec">Vazgeç</button></div></form></div>';
}
function denemeImportHtml() {
  if(!DENEME_IMPORT || !rehberMi())return '';
  return '<section class="kart dn-panel"><h2>Aktarmadan önce kontrol et</h2><p class="mini">Numara ve ad birlikte eşleştirilir. Tekrar sonuçlar işaretlenmez. Tarih farklı olsa da aynı adlı ve aynı D/Y sonuçlu sınav tekrar kabul edilir; gerekiyorsa elle seçebilirsiniz. PDF’de süre yoktur.</p>'+
    DENEME_IMPORT.map((p,pi)=>'<div class="dn-import"><b>'+kacis(p.dosya || p.ad)+'</b><div class="arac"><label>Sınav adı <input data-dn-rapor="'+pi+'" data-alan="ad" maxlength="120" value="'+kacis(p.ad)+'"></label><label>Tarih <input type="date" data-dn-rapor="'+pi+'" data-alan="tarih" value="'+p.tarih+'"></label></div><div class="dn-scroll"><table><thead><tr><th>Aktar</th><th>PDF öğrencisi</th><th>Hedef öğrenci</th><th>Oturum</th><th>Net</th><th>Kontrol</th></tr></thead><tbody>'+p.satirlar.map((r,ri)=>'<tr><td><input type="checkbox" aria-label="'+kacis(r.ad+' '+r.oturum+' aktar')+'" data-dn-import="'+pi+':'+ri+'"'+(r.secili?' checked':'')+'></td><td>'+r.no+' · '+kacis(r.ad)+'</td><td><select aria-label="Hedef öğrenci" data-dn-match="'+pi+':'+ri+'"><option value="-1">Eşleşmedi</option>'+canliOgrenciler().map(si=>'<option value="'+si+'"'+(si===r.si?' selected':'')+'>'+kacis(D.ogr[si].no+' · '+D.ogr[si].ad)+'</option>').join('')+'</select></td><td>'+r.oturum+'</td><td>'+denemeSayi(denemeToplam(denemePdfKaydi(p,r),D.ogr[r.si]?.alan || 'SAY'))+'</td><td>'+kacis(r.uyari || 'Hazır')+'</td></tr>').join('')+'</tbody></table></div></div>').join('')+
    '<p class="mini">AYT neti öğrencinin alanına göre hesaplanır; bütün ders ayrıntıları saklanır. Birleşik rapordaki YKS puanı, AYT puanı olarak alınmaz.</p><div class="arac"><button class="dugme birincil" id="dnImportKaydet">Seçilen sonuçları kaydet ve yayınla</button><button class="dugme" id="dnImportIptal">Vazgeç</button></div></section>';
}
function gorunumDenemeler() {
  const tur=EK.denemeTur || 'TYT',oturum=EK.denemeOturum || 'TYT',brans=EK.denemeBrans || DENEME_DERSLER[oturum][0][0],alan=denemeAlan(),tum=denemeListe();
  const metrik=denemeMetrik(),genelAcik=tur==='BRANS' && EK.denemeGenel!==false,genelVar=genelAcik && metrik==='net';
  let liste=tum.filter(r=>r.tur===tur && (tur!=='BRANS'||r.oturum===oturum && r.brans===brans));
  if(tur==='AYT')liste=liste.filter(r=>r.id.startsWith('p:') || r.alan===alan);
  // Süre and publisher score belong to the whole TYT/AYT exam, so sections join the net chart only.
  if(genelVar)liste=[...liste,...denemeGenelBolumleri(tum,oturum,brans)].sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.id.localeCompare(b.id));
  if(EK.denemeBas)liste=liste.filter(r=>r.tarih>=EK.denemeBas);if(EK.denemeSon)liste=liste.filter(r=>r.tarih<=EK.denemeSon);
  const son=liste.at(-1),selected=liste.find(r=>r.id===EK.denemeSecili)||son,genelSayi=liste.filter(r=>r.genel).length;
  // With the net/dk chart selected the summary follows it, over exams that have a time.
  const hizVar=denemeHizGecerli(tur),hizOzet=metrik==='hiz',ozet=hizOzet?liste.map(r=>denemeHiz(r,alan)).filter(v=>v!==null):liste.map(r=>denemeToplam(r,alan)),birim=hizOzet?' net/dk':' net';
  return '<div class="baslik"><h1>Denemeler</h1><p>'+kacis(D.ogr[EK.ogr].ad)+' · Netini ve süreni birlikte takip et.</p></div>'+(rehberMi()?'<div class="arac">'+ogrSecici()+'<label class="dugme">PDF’den toplu aktar<input type="file" id="dnPdf" accept="application/pdf,.pdf" multiple hidden></label><button class="dugme" id="dnYayinla">Bekleyen sonuçları yayınla</button></div>':'')+
    '<p id="dnDurum" role="status" aria-live="polite">'+kacis(EK.denemeDurum || '')+'</p>'+denemeImportHtml()+
    '<div class="dn-tabs" role="group" aria-label="Deneme türü">'+['TYT','AYT','BRANS'].map(t=>'<button class="dugme '+(tur===t?'birincil':'')+'" aria-pressed="'+(tur===t)+'" data-dn-tur="'+t+'">'+(t==='BRANS'?'Branş denemeleri':t)+'</button>').join('')+'<button class="dugme birincil dn-ekle" id="dnEkle">+ Deneme ekle</button></div>'+
    '<div class="arac dn-filters" role="group" aria-label="Grafik ve geçmiş filtresi"><span class="dn-filtre-baslik">Grafik ve geçmiş filtresi</span>'+(tur==='BRANS'?'<label>Oturum<select id="dnFiltreOturum"><option'+(oturum==='TYT'?' selected':'')+'>TYT</option><option'+(oturum==='AYT'?' selected':'')+'>AYT</option></select></label><label>Branş<select id="dnFiltreBrans">'+DENEME_DERSLER[oturum].map(d=>'<option value="'+d[0]+'"'+(brans===d[0]?' selected':'')+'>'+d[1]+'</option>').join('')+'</select></label>':'')+(tur==='AYT'?'<label>Alan<select id="dnFiltreAlan">'+Object.keys(DENEME_ALAN).map(a=>'<option'+(alan===a?' selected':'')+'>'+a+'</option>').join('')+'</select></label>':'')+
    (tur==='BRANS'?'<label>TYT/AYT bölümleri<span class="dn-genel-sec"><input type="checkbox" id="dnGenel"'+(genelAcik?' checked':'')+'> Göster</span></label>':'')+
    '<label>Grafikte göster<select id="dnMetrik">'+Object.entries(DENEME_METRIK).filter(([k])=>k!=='hiz' || hizVar).map(([k,v])=>'<option value="'+k+'"'+(metrik===k?' selected':'')+'>'+v.ad+'</option>').join('')+'</select></label><label>Şu tarihten<input type="date" id="dnBas" value="'+(EK.denemeBas||'')+'"></label><label>Şu tarihe kadar<input type="date" id="dnSon" value="'+(EK.denemeSon||'')+'"></label>'+(EK.denemeBas || EK.denemeSon?'<button class="dugme" id="dnFiltreTemizle">Tarihleri temizle</button>':'')+'</div>'+
    (genelAcik && metrik!=='net'?'<p class="mini">TYT/AYT denemelerindeki bölümler yalnızca Net grafiğinde gösterilir; süre ve yayınevi puanı bütün denemeye aittir.</p>':'')+
    '<div class="dn-stats"><div><span>'+(hizOzet?'Süreli deneme':'Deneme'+(genelSayi?' (TYT/AYT’den '+genelSayi+')':''))+'</span><strong>'+ozet.length+'</strong></div><div><span>Son'+birim+'</span><strong>'+(ozet.length?denemeSayi(ozet.at(-1)):'—')+'</strong></div><div><span>En yüksek'+birim+'</span><strong>'+(ozet.length?denemeSayi(Math.max(...ozet)):'—')+'</strong></div><div><span>Ortalama'+(hizOzet?birim:'')+'</span><strong>'+(ozet.length?denemeSayi(ozet.reduce((a,b)=>a+b,0)/ozet.length):'—')+'</strong></div></div>'+
    '<section class="kart dn-panel">'+denemeGrafik(liste)+'<div id="dnDetay" aria-live="polite">'+(selected?denemeDetay(selected):'')+'</div></section>'+
    '<section class="kart dn-panel"><h2>Deneme geçmişi</h2><div class="dn-scroll"><table class="dn-history"><thead><tr><th>Tarih / deneme</th><th>Net</th><th>Süre</th>'+(hizVar?'<th>Net/dk</th>':'')+'<th></th></tr></thead><tbody>'+liste.slice().reverse().map(r=>'<tr><td>'+r.tarih+'<br><b>'+kacis(r.ad)+'</b>'+(r.tur==='BRANS'?' · '+r.dersler[0].soru+' soru':'')+(r.genel?' <span class="dn-genel-rozet">'+r.genel+' denemesinden</span>':'')+'</td><td>'+denemeSayi(denemeToplam(r,alan))+'</td><td>'+(r.sure===null?'—':denemeSayi(r.sure)+' dk')+'</td>'+(hizVar?'<td>'+(r.sure===null?'—':denemeSayi(denemeHiz(r,alan)))+'</td>':'')+'<td><button class="dugme" data-dn-dot="'+kacis(r.id)+'">Ayrıntı</button></td></tr>').join('')+'</tbody></table></div></section>'+denemeFormHtml();
}
function denemeFormOku() {
  const r=DENEME_FORM.kayit,get=id=>document.getElementById(id)?.value;
  return {...r,ad:get('dnAd').trim(),tarih:get('dnTarih'),sure:get('dnSure')===''?null:Number(get('dnSure')),puan:get('dnPuan')===''?null:Number(get('dnPuan')),dersler:Array.from(document.querySelectorAll('[data-dn-ders]')).map(el=>({kod:el.dataset.dnDers,...Object.fromEntries(Array.from(el.querySelectorAll('input')).map(x=>[x.dataset.dnValue,Number(x.value)]))}))};
}
async function denemeYerelKaydet(si,alan,yeni) {
  const o=D.ogr[si],eski=o[alan];o[alan]=yeni;
  if(!await kaydet(true)){o[alan]=eski;throw new Error('Cihaza kaydedilemedi. Değişiklik uygulanmadı; yeniden deneyin.');}
}
function denemeDurum(m) { EK.denemeDurum=m;const el=document.getElementById('dnDurum');if(el)el.textContent=m; }
// Call after the change is saved on this device: a failed publish leaves it queued, not lost.
async function denemeYayinlaVeyaBeklet(si) {
  D.ogr[si].denemeYayinBekliyor=true;await kaydet(true);
  try{await denemeOkulYayinla(si);await kaydet(true);}
  catch(e){denemeDurum('Cihazda kayıtlı; yayın bekliyor: '+e.message);}
}
// Ana sayfadaki gelişim noktası: o denemeyi Denemelerim’de, kendi sekmesinde seçili açar.
// Branş noktası (branş denemesi ya da TYT/AYT bölümü) Branş denemelerinde o dersle açılır.
function denemeYolAc(id) {
  const r=denemeBul(id);if(!r)return;
  EK.sekme='denemeler';EK.denemeTur=r.tur;EK.denemeSecili=r.id;DENEME_FORM=null;
  if(r.tur==='BRANS'){EK.denemeOturum=r.oturum;EK.denemeBrans=r.brans;if(r.genel){EK.denemeGenel=true;EK.denemeMetrik='net';}}
  ciz();
}
function denemeNoktaSec(id) {const r=denemeBul(id),el=document.getElementById('dnDetay');if(r && el){EK.denemeSecili=id;el.innerHTML=denemeDetay(r);} }
document.addEventListener('pointerover',ev=>{const el=ev.target.closest?.('[data-dn-dot]');if(el)denemeNoktaSec(el.dataset.dnDot);});
document.addEventListener('focusin',ev=>{const el=ev.target.closest?.('[data-dn-dot]');if(el)denemeNoktaSec(el.dataset.dnDot);});
document.addEventListener('keydown',ev=>{const el=ev.target.closest?.('circle[data-dn-dot]');if(el && ['Enter',' '].includes(ev.key)){ev.preventDefault();denemeNoktaSec(el.dataset.dnDot);} });
document.addEventListener('keydown',ev=>{const el=ev.target.closest?.('circle[data-dn-yol]');if(el && ['Enter',' '].includes(ev.key)){ev.preventDefault();denemeYolAc(el.dataset.dnYol);} });
document.addEventListener('keydown',ev=>{if(ev.key==='Escape' && DENEME_FORM && !DENEME_ISLEM && document.getElementById('dnOrtu')){ev.preventDefault();DENEME_FORM=null;ciz();}});
document.addEventListener('input',ev=>{const row=ev.target.closest?.('[data-dn-ders]');if(row){const get=k=>Number(row.querySelector('[data-dn-value="'+k+'"]').value);row.querySelector('output').textContent=denemeSayi(get('dogru')-get('yanlis')/4);} });
document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='dnForm')return;ev.preventDefault();if(DENEME_ISLEM)return;DENEME_ISLEM=true;
  try {
    if(!DENEME_FORM || DENEME_FORM.si!==EK.ogr)throw new Error('Öğrenci değişti; formu yeniden açın.');
    const si=EK.ogr,defter=D;
    const r={...denemeFormOku(),ts:Math.max(Date.now(),DENEME_FORM.kayit.ts+1,(D.ogr[si].denemeSure||[]).find(x=>x.id===DENEME_FORM.kayit.id)?.ts+1||0)};
    if(r.tarih>isoDan(etkinlikBugun()))throw new Error('Gelecekteki bir tarihe sonuç girilemez.');denemeDogrula([r]);
    const alan=r.id.startsWith('p:')?'denemeOkul':'denemeler';
    if(alan==='denemeOkul' && !rehberMi())throw new Error('Öğretmen sonucu değiştirilemez.');
    await denemeYerelKaydet(si,alan,denemeBirlestir(D.ogr[si][alan],[r]));
    if(D!==defter)throw new Error('Oturum değişti.');
    if(alan==='denemeOkul')await denemeYayinlaVeyaBeklet(si);
    if(D!==defter)return;
    DENEME_FORM=null;EK.denemeSecili=r.id;ciz();bilgiVer('Deneme kaydedildi.');
  } catch(e){const el=document.getElementById('dnFormHata');if(el)el.textContent=e.message;else denemeDurum(e.message);}
  finally{DENEME_ISLEM=false;}
});
document.addEventListener('click',async ev=>{
  const el=ev.target.closest?.('button,[data-dn-dot],[data-dn-yol]');if(!el)return;
  if(el.dataset.dnDot){denemeNoktaSec(el.dataset.dnDot);return;}
  if(el.dataset.dnYol){denemeYolAc(el.dataset.dnYol);return;}
  if(el.dataset.dnYolSec){EK.denemeYol=el.dataset.dnYolSec;ciz();document.querySelector('[data-dn-yol-sec="'+EK.denemeYol+'"]')?.focus();return;}
  if(el.dataset.dnTur){EK.denemeTur=el.dataset.dnTur;DENEME_FORM=null;ciz();return;}
  if(el.dataset.dnKaynak){
    const r=denemeListe().find(x=>x.id===el.dataset.dnKaynak);if(!r)return;
    EK.denemeTur=r.tur;EK.denemeSecili=r.id;if(r.tur==='AYT' && !r.id.startsWith('p:'))EK.denemeAlan=r.alan;ciz();return;
  }
  if(el.dataset.dnBransGit){
    const [oturum,kod]=el.dataset.dnBransGit.split(':');if(!DENEME_DERSLER[oturum]?.some(d=>d[0]===kod))return;
    EK.denemeTur='BRANS';EK.denemeOturum=oturum;EK.denemeBrans=kod;EK.denemeGenel=true;EK.denemeMetrik='net';
    EK.denemeSecili='g:'+el.dataset.dnKaynakId+'|'+kod;ciz();return;
  }
  if(el.id==='dnVazgec' || el.id==='dnKapat'){DENEME_FORM=null;ciz();return;}
  if(el.id==='dnFiltreTemizle'){EK.denemeBas='';EK.denemeSon='';ciz();return;}
  if(el.id==='dnImportIptal'){DENEME_IMPORT=null;ciz();return;}
  if((el.id==='dnEkle' || el.dataset.dnEdit) && !DENEME_ISLEM){
    const tur=EK.denemeTur||'TYT',oturum=tur==='BRANS'?(EK.denemeOturum||'TYT'):tur;
    const kayit=el.dataset.dnEdit?denemeListe().find(r=>r.id===el.dataset.dnEdit):{id:(rehberMi()?'p:manual-':'m:')+crypto.randomUUID(),ad:'',tarih:isoDan(etkinlikBugun()),tur,oturum,brans:tur==='BRANS'?(EK.denemeBrans||DENEME_DERSLER[oturum][0][0]):'',alan:denemeAlan(),dersler:[],sure:null,puan:null,ts:Date.now()};
    if(!kayit || el.dataset.dnEdit && !(kayit.id.startsWith('p:')?rehberMi():ogrenciMi()))return;
    DENEME_FORM={si:EK.ogr,edit:!!el.dataset.dnEdit,kayit:JSON.parse(JSON.stringify(kayit))};ciz();document.getElementById('dnAd')?.focus();return;
  }
  if(DENEME_ISLEM)return;
  if(el.dataset.dnSure || el.dataset.dnSil){
    const id=el.dataset.dnSure||el.dataset.dnSil,r=denemeListe().find(x=>x.id===id);if(!r)return;
    try {
      if(el.dataset.dnSure){
        const v=prompt('Tamamlama süresi (dakika). Bilinmiyorsa boş bırakın.',r.sure??'');if(v===null)return;
        const sure=v.trim()===''?null:Number(v.replace(',','.')),entry={id,sure,ts:Math.max(Date.now(),r.ts+1,(D.ogr[EK.ogr].denemeSure||[]).find(x=>x.id===id)?.ts+1||0)};
        denemeSureDogrula([entry]);
        if(rehberMi()) {
          if(!id.startsWith('p:'))throw new Error('Öğrencinin kendi girdiği süreyi öğrenci güncelleyebilir.');
          const si=EK.ogr;await denemeYerelKaydet(si,'denemeOkul',denemeBirlestir(D.ogr[si].denemeOkul,[{...r,sure,ts:Math.max(entry.ts,r.ts+1)}]));
          await denemeYayinlaVeyaBeklet(si);
        } else await denemeYerelKaydet(EK.ogr,'denemeSure',denemeBirlestir(D.ogr[EK.ogr].denemeSure,[entry],true));
      } else {
        if(!(id.startsWith('p:')?rehberMi():ogrenciMi()))return;if(!confirm(r.ad+' denemesini silmek istiyor musunuz?'))return;
        const alan=id.startsWith('p:')?'denemeOkul':'denemeler';await denemeYerelKaydet(EK.ogr,alan,denemeBirlestir(D.ogr[EK.ogr][alan],[{...r,silindi:true,ts:Math.max(Date.now(),r.ts+1)}]));
        if(alan==='denemeOkul')await denemeYayinlaVeyaBeklet(EK.ogr);
      }ciz();
    }catch(e){denemeDurum(e.message);}return;
  }
  if(el.id==='dnImportKaydet' || el.id==='dnYayinla'){
    if(!rehberMi())return;DENEME_ISLEM=true;el.disabled=true;const defter=D;
    try {
      if(el.id==='dnImportKaydet'){
        const staged=new Map();
        for(const p of DENEME_IMPORT || [])for(const row of p.satirlar.filter(r=>r.secili)){
          if(!D.ogr[row.si] || D.ogr[row.si].silindi)throw new Error('Seçilen her satıra hedef öğrenci atayın.');
          if(row.hedefKimlik!==denemeHedefKimligi(D.ogr[row.si]))throw new Error('Öğrenci listesi değişti. PDF’yi yeniden seçip eşleşmeleri kontrol edin.');
          const r=denemePdfKaydi(p,row),old=staged.get(row.si)||D.ogr[row.si].denemeOkul||[],same=old.find(x=>x.id===r.id);
          if(same)r.ts=Math.max(r.ts,same.ts+1);staged.set(row.si,denemeBirlestir(old,[r]));
        }
        if(!staged.size)throw new Error('Aktarılacak sonuç seçilmedi.');
        const once=JSON.stringify(D.ogr);
        for(const [si,list] of staged){D.ogr[si].denemeOkul=list;D.ogr[si].denemeYayinBekliyor=true;}
        if(!await kaydet(true)){D.ogr=JSON.parse(once);throw new Error('Cihaza kayıt başarısız; aktarım uygulanmadı.');}
        DENEME_IMPORT=null;
      }
      const bekleyen=D.ogr.map((o,i)=>({o,i})).filter(x=>!x.o.silindi && x.o.denemeYayinBekliyor);let tamam=0;const errors=[];
      for(const {o,i} of bekleyen){if(D!==defter || !rehberMi())throw new Error('Oturum değişti.');denemeDurum('Yayınlanıyor: '+(tamam+errors.length+1)+' / '+bekleyen.length);try{await denemeOkulYayinla(i);tamam++;}catch(e){errors.push(o.ad+': '+e.message);}}
      if(!await kaydet(true))throw new Error('Yayın durumu cihaza kaydedilemedi; tekrar deneyin.');
      denemeDurum(tamam+' öğrenciye yayınlandı.'+(errors.length?' '+errors.length+' öğrenci cihazda kayıtlı, yayın bekliyor. '+errors.join(' · '):' Öğrenciler sonuçlarını otomatik görecek.'));ciz();
    }catch(e){denemeDurum(e.message);}finally{DENEME_ISLEM=false;el.disabled=false;}return;
  }
});
document.addEventListener('change',async ev=>{
  const el=ev.target,id=el.id;
  if(id==='dnPdf'){
    if(!rehberMi() || DENEME_ISLEM)return;const files=Array.from(el.files||[]);if(!files.length)return;
    if(files.length>10){denemeDurum('Bir defada en fazla 10 PDF seçin.');return;}
    DENEME_ISLEM=true;el.disabled=true;const defter=D;
    try{const raporlar=[];for(const file of files){denemeDurum('PDF okunuyor: '+file.name);raporlar.push(await denemePdfOku(file));}if(D!==defter || !rehberMi())throw new Error('Oturum değişti.');DENEME_IMPORT=denemeImportHazirla(raporlar);denemeDurum('Önizleme hazır; henüz sonuç kaydedilmedi.');ciz();}
    catch(e){denemeDurum('PDF aktarılamadı: '+e.message);}finally{DENEME_ISLEM=false;el.disabled=false;el.value='';}return;
  }
  if((el.dataset?.dnImport || el.dataset?.dnMatch) && DENEME_IMPORT){
    const [p,r]=(el.dataset.dnImport||el.dataset.dnMatch).split(':').map(Number),row=DENEME_IMPORT[p]?.satirlar[r];if(!row)return;
    if(el.dataset.dnImport)row.secili=el.checked;
    else{try{denemeImportHedefDegistir(p,r,Number(el.value));}catch(e){row.secili=false;denemeDurum(e.message);}ciz();}
    return;
  }
  if(el.dataset?.dnRapor!==undefined){DENEME_IMPORT[Number(el.dataset.dnRapor)][el.dataset.alan]=el.value;return;}
  if(id==='dnGenel'){EK.denemeGenel=el.checked;ciz();return;}
  if(id==='dnYolBrans'){EK.denemeYolBrans=el.value;ciz();document.getElementById('dnYolBrans')?.focus();return;}
  if(id==='dnHedef' && ogrenciMi()){
    const o=D.ogr[EK.ogr],k=el.dataset.anahtar,ust=Number(el.max),v=el.value.trim(),hedef=v===''?null:Math.round(Number(v));
    if(!/^(TYT|AYT)(:[a-z0-9]+)?$/.test(k || ''))return;
    if(hedef!==null && !(hedef>=0 && hedef<=ust)){denemeDurum('Hedef 0 ile '+ust+' net arasında olmalı.');el.value=denemeHedefOku(o,k)??'';return;}
    // Tek sayı TYT hedefidir. Yalnızca TYT hedefi varken sayı olarak kalır (önceki sürüm yalnızca
    // sayıyı tanır); başka bir seçimin hedefi eklenince seçim başına hedeflere dönüşür.
    const eski=o.denemeHedef,yeni=typeof eski==='number'?{TYT:eski}:{...(eski && typeof eski==='object'?eski:{})};
    if(hedef===null)delete yeni[k];else yeni[k]=hedef;
    const ks=Object.keys(yeni);
    if(!ks.length)delete o.denemeHedef;else o.denemeHedef=ks.length===1 && ks[0]==='TYT'?yeni.TYT:yeni;
    if(!await kaydet(true)){if(eski===undefined)delete o.denemeHedef;else o.denemeHedef=eski;}
    ciz();return;
  }
  const filters={dnFiltreOturum:'denemeOturum',dnFiltreBrans:'denemeBrans',dnFiltreAlan:'denemeAlan',dnMetrik:'denemeMetrik',dnBas:'denemeBas',dnSon:'denemeSon'};
  if(filters[id]){EK[filters[id]]=el.value;if(id==='dnFiltreOturum')EK.denemeBrans=DENEME_DERSLER[el.value][0][0];ciz();return;}
  if(['dnTur','dnOturum','dnBrans','dnAlan'].includes(id) && DENEME_FORM){
    const r=denemeFormOku();
    if(id==='dnTur'){r.tur=el.value;r.oturum=el.value==='BRANS'?r.oturum:el.value;r.dersler=[];r.brans=r.tur==='BRANS'?DENEME_DERSLER[r.oturum][0][0]:'';}
    if(id==='dnOturum'){r.oturum=el.value;r.brans=DENEME_DERSLER[r.oturum][0][0];r.dersler=[];}
    if(id==='dnBrans'){r.brans=el.value;r.dersler=[];}
    if(id==='dnAlan'){r.alan=el.value;r.dersler=r.dersler.filter(x=>DENEME_ALAN[r.alan].includes(x.kod));}
    // Redrawing the popup would otherwise drop focus from the select just changed.
    DENEME_FORM.kayit=r;ciz();document.getElementById(id)?.focus();
  }
});
