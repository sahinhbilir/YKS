// Embedded in index.html by scripts/embed-etutplani.cjs. No student or teacher data belongs here.
// Etüt planı (teacher only): the school's paper "<GÜN> — ETÜT PLANI" sheet for each weekday. The
// teacher keeps each day's teachers (branş, öğretmen), writes up to four students beside each and
// prints the sheet. Kept in the teacher notebook as D.etutPlani, so it travels with the teacher's
// cloud backup; student packets are built from a field whitelist and never carry it. Nothing is
// uploaded. See docs/etut-plani.md.
const ETUTPLANI = (() => {
const SURUM=1, GUNLER=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma'], KISA=['Pzt','Sal','Çar','Per','Cum'], OGRENCI=4, EN_COK_SATIR=40;
// The paper's order; other branches follow in the order they were first written.
const BRANS_SIRA=['Matematik','Geometri','Türkçe','Edebiyat','Fizik','Kimya','Biyoloji','Tarih','Coğrafya','Felsefe','Din Kültürü','İngilizce'];
const anahtar=s=>denemeAdAnahtari(s);
const kisa=(s,n)=>String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
const buyuk=s=>String(s||'').toLocaleUpperCase('tr-TR');
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
const sayi=n=>Number(n).toLocaleString('tr-TR');

/* ---------------- notebook storage ---------------- */
// D.etutPlani = {surum, ts, gunler:[Pazartesi … Cuma: [[branş, öğretmen, [öğrenci 1 … 4]]]]}. Rows keep
// the order they were written in; the sheet groups them by branş.
const bos=()=>({surum:SURUM,ts:0,gunler:GUNLER.map(()=>[])});
const yeniSatir=(b='',o='')=>[b,o,Array(OGRENCI).fill('')];
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı etüt planı okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!Number.isSafeInteger(v.ts)||v.ts<0)hata('yapı');
  if(!Array.isArray(v.gunler)||v.gunler.length!==GUNLER.length)hata('günler');
  for(const g of v.gunler){
    if(!Array.isArray(g)||g.length>EN_COK_SATIR)hata('gün');
    for(const s of g)if(!Array.isArray(s)||s.length!==3||!metin(s[0],40)||!metin(s[1],60)||!Array.isArray(s[2])||s[2].length!==OGRENCI||!s[2].every(x=>metin(x,60)))hata('satır');
  }
  return v;
}
function oku(){
  if(D.etutPlani===undefined)return {plan:bos()};
  try{return {plan:dogrula(JSON.parse(JSON.stringify(D.etutPlani)))}}catch(e){return {plan:null,hata:e.message}}
}
// Every change goes through here: a copy is changed, checked and saved; a save that fails puts the
// previous plan back, so the page never shows what the notebook does not hold.
async function degistir(fn){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen değiştirebilir.');
  const {plan,hata}=oku();if(hata)throw new Error(hata);
  const sonuc=fn(plan);
  plan.ts=Math.max(Date.now(),plan.ts+1);dogrula(plan);
  const eski=D.etutPlani,defter=D,geri=()=>{if(defter.etutPlani!==plan)return;if(eski===undefined)delete defter.etutPlani;else defter.etutPlani=eski};
  D.etutPlani=plan;
  if(baytBoyu(JSON.stringify(D))>BULUT_YEDEK_UST_SINIR&&baytBoyu(JSON.stringify(plan))>(eski===undefined?0:baytBoyu(JSON.stringify(eski)))){geri();throw new Error('Defter bulut yedeği sınırında; plan kaydedilmedi.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; plan değişmedi.')}
  return sonuc;
}

/* ---------------- sheet model ---------------- */
// Rows of one branş sit together under one grey cell, in the paper's subject order.
function gruplar(satirlar){
  const m=new Map();
  satirlar.forEach((s,i)=>{const k=anahtar(s[0]);if(!m.has(k))m.set(k,{brans:s[0],k,ilk:i,satir:[]});m.get(k).satir.push(i)});
  const sira=k=>{if(!k)return 1e6;const i=BRANS_SIRA.findIndex(b=>anahtar(b)===k);return i<0?1000:i};
  return [...m.values()].sort((a,b)=>sira(a.k)-sira(b.k)||a.ilk-b.ilk);
}
// A student written twice on one day is marked on both cells.
function ciftler(satirlar){
  const n=new Map();for(const s of satirlar)for(const a of s[2]){const k=anahtar(a);if(k)n.set(k,(n.get(k)||0)+1)}
  return new Set([...n].filter(([,c])=>c>1).map(([k])=>k));
}
const rapor=()=>typeof ETUT!=='undefined'&&ETUT.planIcin?ETUT.planIcin():null;
// The etüt report's teachers for a weekday that the day does not have yet.
function eksikler(satirlar,liste){
  const var_=new Set(satirlar.map(s=>anahtar(s[1])).filter(Boolean)),out=[];
  for(const o of liste||[]){const k=anahtar(o.ogretmen);if(k&&!var_.has(k)){var_.add(k);out.push(o)}}
  return out;
}
function bransBul(p,ogretmen){
  const k=anahtar(ogretmen);
  for(const g of p.gunler)for(const s of g)if(s[0]&&anahtar(s[1])===k)return s[0];
  const r=rapor(),o=r&&r.ogretmenler.find(x=>anahtar(x.ogretmen)===k);return o?o.brans:'';
}
function gunSec(){
  const g=EK.epGun;if(g==='hepsi'||(Number.isInteger(g)&&g>=0&&g<GUNLER.length))return g;
  const h=haftaGunu(bugunNo());return h<GUNLER.length?h:0;
}
const baslik=g=>buyuk(GUNLER[g])+' — ETÜT PLANI';

/* ---------------- page ---------------- */
let DURUM_YAZI='';
function durum(t){DURUM_YAZI=t||'';const el=document.getElementById('epDurum');if(el)el.textContent=DURUM_YAZI}
const sutunlar='<colgroup><col class="ep-k-brans"><col class="ep-k-hoca">'+'<col class="ep-k-ogr">'.repeat(OGRENCI)+'</colgroup>';
const basSatiri='<thead><tr><th scope="col">BRANŞ</th><th scope="col">ÖĞRETMEN</th>'+Array.from({length:OGRENCI},(_,k)=>'<th scope="col">ÖĞRENCİ '+(k+1)+'</th>').join('')+'</tr></thead>';
function kagit(p,g,r,salt){
  const satirlar=p.gunler[g],cift=ciftler(satirlar);let govde='';
  for(const grup of gruplar(satirlar))grup.satir.forEach((i,j)=>{const s=satirlar[i];
    govde+='<tr>'+(j===0?'<th scope="row" class="ep-brans"'+(grup.satir.length>1?' rowspan="'+grup.satir.length+'"':'')+'>'+kacis(buyuk(grup.brans))+'</th>':'')+'<td class="ep-hoca">'+kacis(s[1])+'</td>'+
      s[2].map((a,k)=>'<td class="ep-ogr"><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-k="'+k+'" value="'+kacis(a)+'" maxlength="60" list="epOgrenciler" autocomplete="off" spellcheck="false" placeholder="Öğrenci '+(k+1)+'" aria-label="'+kacis((s[1]||s[0]||GUNLER[g])+' · Öğrenci '+(k+1))+'"'+
        (cift.has(anahtar(a))?' class="ep-cift" title="Bu günde iki kez yazıldı"':'')+(salt?' readonly':'')+'></td>').join('')+'</tr>'});
  if(!satirlar.length){const oneri=r?eksikler([],r.gunler[g]):[];
    govde='<tr><td class="ep-bos" colspan="'+(2+OGRENCI)+'">'+(salt?'—':'<button type="button" class="et-dugme" data-ep-ekle="'+g+'">Öğretmen ekle</button>'+
      (oneri.length?'<button type="button" class="et-dugme" data-ep-rapor="'+g+'">Etüt raporundan ekle</button>':''))+'</td></tr>'}
  return '<section class="et-panel ep-kagit" data-ep-kagit="'+g+'"><h2 class="ep-baslik">'+kacis(baslik(g))+'</h2><div class="ep-kaydir"><table class="ep-tablo">'+sutunlar+basSatiri+'<tbody>'+govde+'</tbody></table></div></section>';
}
function duzenKagidi(p,g,r){
  const satirlar=p.gunler[g],oneri=r?eksikler(satirlar,r.gunler[g]):[];
  const govde=satirlar.map((s,i)=>'<tr><td><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-alan="0" value="'+kacis(s[0])+'" maxlength="40" list="epBranslar" autocomplete="off" aria-label="Branş"></td>'+
    '<td><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-alan="1" value="'+kacis(s[1])+'" maxlength="60" list="epOgretmenler" autocomplete="off" spellcheck="false" aria-label="Öğretmen"></td>'+
    '<td class="ep-sil"><button type="button" class="ep-x" data-ep-sil="'+g+':'+i+'" aria-label="Satırı sil" title="Satırı sil">×</button></td></tr>').join('');
  const kopya=GUNLER.map((ad,j)=>j===g||!p.gunler[j].length?'':'<option value="'+j+'">'+ad+'</option>').join('');
  return '<section class="et-panel ep-kagit" data-ep-kagit="'+g+'"><h2 class="ep-baslik">'+kacis(baslik(g))+'</h2>'+
    (satirlar.length?'<div class="ep-kaydir"><table class="ep-tablo duzen"><colgroup><col><col class="ep-k-hoca2"><col class="ep-k-sil"></colgroup><thead><tr><th scope="col">BRANŞ</th><th scope="col">ÖĞRETMEN</th><th scope="col"><span class="ep-gizli">Sil</span></th></tr></thead><tbody>'+govde+'</tbody></table></div>':'')+
    '<div class="ep-duzen-arac"><button type="button" class="et-dugme" data-ep-ekle="'+g+'">Satır ekle</button>'+
    (oneri.length?'<button type="button" class="et-dugme" data-ep-rapor="'+g+'">Etüt raporundan ekle</button>':'')+
    (kopya?'<select data-ep-kopya="'+g+'" aria-label="Başka günün öğretmenlerini ekle"><option value="">Başka günden ekle</option>'+kopya+'</select>':'')+'</div></section>';
}
function listeler(p,r){
  const tekil=(liste,an)=>{const g=new Set();return liste.filter(x=>{const k=an(x);if(!k||g.has(k))return false;g.add(k);return true})};
  const ogr=tekil((D.ogr||[]).filter(o=>o&&!o.silindi&&o.ad).map(o=>({ad:String(o.ad),sinif:o.sube||''})).concat(r?r.ogrenciler:[]),x=>anahtar(x.ad));
  const hoca=tekil(p.gunler.flat().map(s=>s[1]).concat(r?r.ogretmenler.map(o=>o.ogretmen):[]),anahtar);
  const brans=tekil(BRANS_SIRA.concat(p.gunler.flat().map(s=>s[0]),r?r.ogretmenler.map(o=>o.brans):[]),anahtar);
  const sec=(id,l)=>'<datalist id="'+id+'">'+l.join('')+'</datalist>';
  return sec('epOgrenciler',ogr.map(o=>'<option value="'+kacis(o.ad)+'"'+(o.sinif?' label="'+kacis(o.sinif)+'"':'')+'></option>'))+
    sec('epOgretmenler',hoca.map(a=>'<option value="'+kacis(a)+'"></option>'))+sec('epBranslar',brans.map(a=>'<option value="'+kacis(a)+'"></option>'));
}
const seg=(ad,deger,secenekler,etiket,ek)=>'<div class="et-seg'+(ek?' '+ek:'')+'" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,uzun])=>'<button type="button" data-ep-'+ad+'="'+v+'" aria-pressed="'+(String(v)===String(deger))+'"'+(uzun?' aria-label="'+uzun+'"':'')+'>'+yazi+'</button>').join('')+'</div>';
function icerik(){
  const {plan,hata}=oku(),salt=izleme();
  const bas='<header class="et-bas"><h1 class="et-baslik">Etüt planı</h1></header>',durumSatiri='<p id="epDurum" role="status" aria-live="polite">'+kacis(DURUM_YAZI)+'</p>';
  if(hata)return bas+'<p class="et-uyari">'+kacis(hata)+'</p>'+durumSatiri;
  const g=gunSec(),mod=!salt&&EK.epMod==='ogretmen'?'ogretmen':'ogrenci',gunler=g==='hepsi'?GUNLER.map((_,j)=>j):[g],r=rapor();
  const ogrVar=gunler.some(j=>plan.gunler[j].some(s=>s[2].some(Boolean)));
  const gunSecimi=seg('gun',g,GUNLER.map((ad,j)=>[j,'<span class="ep-tam">'+ad+'</span><span class="ep-kisa" aria-hidden="true">'+KISA[j]+'</span>',ad]).concat([['hepsi','Tümü']]),'Gün','ep-gun-sec');
  return bas+'<div class="et-arac"><button type="button" class="et-dugme birincil" id="epYazdir">Yazdır</button>'+gunSecimi+
    (salt?'':seg('mod',mod,[['ogrenci','Öğrenciler'],['ogretmen','Öğretmenler']],'Düzenle')+'<button type="button" class="et-dugme" id="epTemizle"'+(ogrVar?'':' disabled')+'>Öğrencileri sil</button>')+'</div>'+durumSatiri+
    '<div class="ep-gunler">'+gunler.map(j=>mod==='ogretmen'?duzenKagidi(plan,j,r):kagit(plan,j,r,salt)).join('')+'</div>'+listeler(plan,r)+'<div id="epBaski"></div>';
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etüt planı</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  baskiBitir();
  return '<div id="epKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('epKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}

/* ---------------- print ---------------- */
// The printed sheet is plain text in the paper's layout: black header row, grey branş cells, empty
// cells left for handwriting. One weekday per A4 page; days without teachers are left out.
function baskiHtml(p,gunler){
  return gunler.filter(g=>p.gunler[g].length).map(g=>{const satirlar=p.gunler[g];let govde='';
    for(const grup of gruplar(satirlar))grup.satir.forEach((i,j)=>{const s=satirlar[i];
      govde+='<tr>'+(j===0?'<th scope="row"'+(grup.satir.length>1?' rowspan="'+grup.satir.length+'"':'')+'>'+kacis(buyuk(grup.brans))+'</th>':'')+'<td>'+kacis(s[1])+'</td>'+s[2].map(a=>'<td>'+kacis(a)+'</td>').join('')+'</tr>'});
    return '<section class="ep-sayfa"><h1>'+kacis(baslik(g))+'</h1><table>'+sutunlar+basSatiri+'<tbody>'+govde+'</tbody></table></section>'}).join('');
}
function baskiBitir(){
  if(typeof document==='undefined'||!document.body)return;
  document.body.classList?.remove('ep-yazdir');document.getElementById('epSayfaStili')?.remove();
}
// Also run from the browser's own print command (beforeprint), so Ctrl+P prints the sheets too.
function baskiHazirla(){
  const {plan}=oku(),kutu=document.getElementById('epBaski');if(!plan||!kutu)return false;
  const g=gunSec(),html=baskiHtml(plan,g==='hepsi'?GUNLER.map((_,j)=>j):[g]);if(!html)return false;
  kutu.innerHTML=html;
  // The app's own print pages are landscape; this sheet is portrait, like the school's paper.
  const stil=document.createElement('style');stil.id='epSayfaStili';stil.textContent='@media print{@page{size:A4 portrait;margin:12mm}}';
  baskiBitir();document.head.appendChild(stil);document.body.classList.add('ep-yazdir');
  window.addEventListener('afterprint',baskiBitir,{once:true});
  return true;
}
function yazdir(){
  if(!baskiHazirla()){durum('Yazdırılacak öğretmen yok.');return false}
  try{if(typeof window.print!=='function')throw new Error('print');window.print();return true}
  catch(e){baskiBitir();durum('Yazdırma açılamadı.');return false}
}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeprint',()=>{if(etkin()&&!document.body.classList.contains('ep-yazdir'))baskiHazirla()});

/* ---------------- events ---------------- */
const etkin=()=>EK.sekme==='etutplani'&&rehberMi();
const hucre=(g,r,alan)=>document.querySelector('input[data-ep-g="'+g+'"][data-ep-r="'+r+'"][data-ep-alan="'+alan+'"]');
function ciftIsaretle(g){
  const kutular=[...document.querySelectorAll('input[data-ep-k][data-ep-g="'+g+'"]')],n=new Map();
  for(const i of kutular){const k=anahtar(i.value);if(k)n.set(k,(n.get(k)||0)+1)}
  for(const i of kutular){const c=(n.get(anahtar(i.value))||0)>1;i.classList.toggle('ep-cift',c);if(c)i.title='Bu günde iki kez yazıldı';else i.removeAttribute('title')}
}
async function ekle(g,liste,yazi){
  const n=await degistir(p=>{const l=eksikler(p.gunler[g],liste);if(p.gunler[g].length+l.length>EN_COK_SATIR)throw new Error('Bir günde en fazla '+EN_COK_SATIR+' satır olur.');
    for(const o of l)p.gunler[g].push(yeniSatir(kisa(o.brans,40),kisa(o.ogretmen,60)));return l.length});
  durum(n?yazi+': '+sayi(n)+' öğretmen eklendi.':'Eklenecek yeni öğretmen yok.');
}
// Leaving the teacher view drops rows with nothing written in them.
async function bosSatirlariAt(){
  const {plan}=oku();if(!plan||!plan.gunler.some(g=>g.some(s=>!s[0]&&!s[1]&&!s[2].some(Boolean))))return;
  await degistir(p=>{p.gunler=p.gunler.map(g=>g.filter(s=>s[0]||s[1]||s[2].some(Boolean)))});
}
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-ep-gun],[data-ep-mod],[data-ep-ekle],[data-ep-rapor],[data-ep-sil],#epYazdir,#epTemizle');if(!el||el.disabled)return;
  try{
    if(el.id==='epYazdir'){yazdir();return}
    if(el.dataset.epGun!==undefined){const v=el.dataset.epGun;EK.epGun=v==='hepsi'?v:Number(v);durum('');yenidenCiz('[data-ep-gun="'+v+'"]');return}
    if(el.dataset.epMod){const v=el.dataset.epMod;if(v!=='ogretmen'&&EK.epMod==='ogretmen')await bosSatirlariAt();EK.epMod=v;durum('');yenidenCiz('[data-ep-mod="'+v+'"]');return}
    if(el.dataset.epEkle!==undefined){const g=Number(el.dataset.epEkle);
      const i=await degistir(p=>{if(p.gunler[g].length>=EN_COK_SATIR)throw new Error('Bir günde en fazla '+EN_COK_SATIR+' satır olur.');p.gunler[g].push(yeniSatir());return p.gunler[g].length-1});
      EK.epMod='ogretmen';durum('');yenidenCiz('input[data-ep-g="'+g+'"][data-ep-r="'+i+'"][data-ep-alan="0"]');return}
    if(el.dataset.epRapor!==undefined){const g=Number(el.dataset.epRapor),r=rapor();if(!r)return;await ekle(g,r.gunler[g],'Etüt raporundan');yenidenCiz();return}
    if(el.dataset.epSil){const [g,i]=el.dataset.epSil.split(':').map(Number),{plan}=oku(),s=plan&&plan.gunler[g][i];if(!s)return;
      if(s[2].some(Boolean)&&!confirm('Bu satırdaki öğrenci adları da silinsin mi?'))return;
      await degistir(p=>{p.gunler[g].splice(i,1)});durum('');yenidenCiz();return}
    if(el.id==='epTemizle'){const g=gunSec(),gunler=g==='hepsi'?GUNLER.map((_,j)=>j):[g];
      if(!confirm(g==='hepsi'?'Bütün günlerin öğrenci adları silinsin mi? Öğretmenler kalır.':GUNLER[g]+' günündeki öğrenci adları silinsin mi? Öğretmenler kalır.'))return;
      await degistir(p=>{for(const j of gunler)for(const s of p.gunler[j])s[2]=s[2].map(()=>'')});durum('Öğrenci adları silindi.');yenidenCiz();return}
  }catch(e){durum(e.message);yenidenCiz()}
});
document.addEventListener('input',ev=>{if(etkin()&&ev.target.dataset?.epK!==undefined)ciftIsaretle(ev.target.dataset.epG)});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target;
  try{
    if(el.dataset?.epKopya!==undefined){const g=Number(el.dataset.epKopya),j=Number(el.value);if(el.value===''||!(j>=0&&j<GUNLER.length))return;
      const {plan}=oku();await ekle(g,plan.gunler[j].map(s=>({brans:s[0],ogretmen:s[1]})).filter(o=>o.ogretmen),GUNLER[j]+' gününden');yenidenCiz();return}
    if(el.dataset?.epR===undefined)return;
    const g=Number(el.dataset.epG),r=Number(el.dataset.epR),k=el.dataset.epK,alan=el.dataset.epAlan,deger=kisa(el.value,alan==='0'?40:60);
    let brans='';
    await degistir(p=>{const s=p.gunler[g]&&p.gunler[g][r];if(!s)throw new Error('Plan değişti; sayfa yenilendi.');
      if(k!==undefined)s[2][Number(k)]=deger;
      else{s[Number(alan)]=deger;if(alan==='1'&&deger&&!s[0]){brans=kisa(bransBul(p,deger),40);s[0]=brans}}});
    if(el.value!==deger)el.value=deger;
    const b=brans&&hucre(g,r,0);if(b)b.value=brans;
    if(k!==undefined)ciftIsaretle(g);
  }catch(e){durum(e.message);yenidenCiz()}
});
return {dogrula,oku,degistir,gruplar,ciftler,eksikler,bransBul,ekle,bosSatirlariAt,gunSec,baskiHtml,yazdir,icerik,gorunum,GUNLER,OGRENCI,EN_COK_SATIR,BRANS_SIRA};
})();
function gorunumEtutPlani(){return ETUTPLANI.gorunum()}
