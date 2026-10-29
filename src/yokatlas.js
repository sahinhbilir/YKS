// Public catalogue is fetched once per page session. Never attach it to D or a student packet.
const YOKATLAS = (() => {
'use strict';
const SUBJECTS = {
 tr:['Türkçe',40,'TYT:turkce',['turkce']],sos:['Sosyal Bilimler',20,'TYT:sosyal',['tarih','cografya','felsefe','din','sf']],
 mat:['Matematik',40,'TYT:matgeo',['mat','geo']],fen:['Fen Bilimleri',20,'TYT:fen',['fizik','kimya','biyoloji']],
 amat:['Matematik',40,'AYT:matgeo',['mat','geo']],fiz:['Fizik',14,'AYT:fizik',['fizik']],kim:['Kimya',13,'AYT:kimya',['kimya']],bio:['Biyoloji',13,'AYT:biyoloji',['biyoloji']],
 edb:['Edebiyat',24,'AYT:edebiyat',['edebiyat']],tar1:['Tarih-1',10,'AYT:tarih1',['tarih1']],cog1:['Coğrafya-1',6,'AYT:cografya1',['cografya1']],
 tar2:['Tarih-2',11,'AYT:tarih2',['tarih2']],cog2:['Coğrafya-2',11,'AYT:cografya2',['cografya2']],fel:['Felsefe',12,'AYT:felsefe',['felsefe']],din:['Din / Ek Felsefe',6,'AYT:din',['din','sf']]
};
const TYT=['tr','sos','mat','fen'], AYT={SAY:['amat','fiz','kim','bio'],EA:['amat','edb','tar1','cog1'],'SÖZ':['edb','tar1','cog1','tar2','cog2','fel','din']};
const CITIES={6:'Ankara',26:'Eskişehir',34:'İstanbul',35:'İzmir',41:'Kocaeli'};
let catalog=null,pending=null,error='',saving=false;
let state={owner:null,student:null,field:'SAY',city:'',kind:'',query:'',examKind:'tarama',tyt:null,ayt:null,page:0};
const num=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR',{maximumFractionDigits:2});
const norm=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const sum=(v,keys)=>keys.reduce((n,k)=>n+v[k],0);
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
function hedefDogrula(h){
 if(h===undefined||h===null)return true;
 if(!h||typeof h!=='object'||Array.isArray(h)||Object.keys(h).sort().join(',')!=='alan,id,surum,yil'||h.surum!==1||!/^\d{9}$/.test(h.id)||typeof h.id!=='string'||!Object.hasOwn(AYT,h.alan)||!Number.isInteger(h.yil)||h.yil<2020||h.yil>2100)throw new Error('Üniversite hedefi geçersiz.');
 return true;
}
function katalogDogrula(c){
 if(!c||c.schema!==1||!Number.isInteger(c.catalogYear)||!Number.isInteger(c.referenceYear)||c.referenceYear>c.catalogYear||c.referenceYear<c.catalogYear-3||!Array.isArray(c.programs)||!c.programs.length||c.programs.length>10000)throw new Error('Üniversite kataloğu geçersiz.');
 const seen=new Set();
 for(const p of c.programs){
  if(!p||typeof p.id!=='string'||!/^\d{9}$/.test(p.id)||seen.has(p.id)||!Object.hasOwn(AYT,p.field)||!Number.isInteger(p.city)||!Object.hasOwn(CITIES,p.city)||!['DEVLET','VAKIF'].includes(p.type)||p.type==='VAKIF'&&p.scholarship!==100||['university','program'].some(k=>typeof p[k]!=='string'||!p[k].trim()||p[k].length>250))throw new Error('Katalogda kapsam dışı veya geçersiz program var.');
  seen.add(p.id);
  if(p.nets!==null&&(!p.nets||p.nets.coefficient!==.12||[...TYT,...AYT[p.field]].some(k=>!finite(p.nets.values?.[k],-SUBJECTS[k][1]/4,SUBJECTS[k][1]))))throw new Error('Katalogda geçersiz net profili var.');
 }
 return c;
}
async function yukle(){
 if(catalog)return catalog;
 if(pending)return pending;
 error='';
 pending=(async()=>{
  // Same-origin public asset; no credentials, exam records or student identifiers are sent.
  const r=await fetch('data/yokatlas.json',{credentials:'omit',cache:'default'});
  if(!r.ok)throw new Error('Üniversite kataloğu yüklenemedi. İnternet bağlantısını kontrol edip yeniden deneyin.');
  const raw=await r.text();if(raw.length>5000000)throw new Error('Üniversite kataloğu boyut sınırını aşıyor.');
  catalog=katalogDogrula(JSON.parse(raw));return catalog;
 })().catch(e=>{error=e.message||'Katalog yüklenemedi.';throw e}).finally(()=>{pending=null});
 return pending;
}
// Compare only complete, full-length test coverage. Missing lessons are not zero nets.
// Legacy imports omit question counts: use published TYT/AYT section maxima only when
// all component lessons are present. A combined mathematics column needs an explicit 40.
function profil(r,oturum,field){
 if(!r||r.silindi||r.tur!==oturum||r.oturum!==oturum||!Object.hasOwn(AYT,field))return null;
 const keys=oturum==='TYT'?TYT:AYT[field],values={};
 for(const k of keys){
  const [,max,,codes]=SUBJECTS[k];
  const ds=r.dersler.filter(d=>codes.includes(d.kod)&&denemeBolumSayilir(r,d.kod,field));
  const count=ds.reduce((n,d)=>n+(d.soru??DENEME_DERSLER[oturum].find(x=>x[0]===d.kod)?.[2]??0),0);
  if(count!==max)return null;
  values[k]=ds.reduce((n,d)=>n+denemeNet(d),0);
  if(!finite(values[k],-max/4,max))return null;
 }
 return values;
}
function fark(p,values){
 if(!p.nets||!values)return null;
 const keys=[...TYT,...AYT[p.field]];
 if(keys.some(k=>!finite(values[k],-SUBJECTS[k][1]/4,SUBJECTS[k][1])))return null;
 const gaps=Object.fromEntries(keys.map(k=>[k,p.nets.values[k]-values[k]]));
 return {gaps,missing:keys.reduce((n,k)=>n+Math.max(0,gaps[k]),0),tyt:sum(p.nets.values,TYT)-sum(values,TYT),ayt:sum(p.nets.values,AYT[p.field])-sum(values,AYT[p.field])};
}
function netHedef(p){
 if(!p.nets)return null;
 const v=p.nets.values,keys=[...TYT,...AYT[p.field]];
 // Existing goals accept nonnegative nets. Clamp each subject before deriving totals.
 const g=Object.fromEntries(keys.map(k=>[k,Math.max(0,v[k])]));
 const h=Object.fromEntries(keys.map(k=>[SUBJECTS[k][2],g[k]]));
 h.TYT=sum(g,TYT);h.AYT=sum(g,AYT[p.field]);
 if(p.field==='SAY')h['AYT:fen']=g.fiz+g.kim+g.bio;
 if(p.field!=='SAY')h['AYT:edsos1']=g.edb+g.tar1+g.cog1;
 if(p.field==='SÖZ')h['AYT:sosyal2']=g.tar2+g.cog2+g.fel+g.din;
 return h;
}
async function hedefSec(id,owner=D,student=D.ogr[EK.ogr]){
 if(saving||D!==owner||D.ogr[EK.ogr]!==student||!ogrenciMi()||yalnizcaGoruntuleme()||ogrenciSinavi(student)!=='YKS')throw new Error('Bu hedefi öğrenci kendi hesabından seçebilir.');
 const p=id===null?null:catalog?.programs.find(x=>x.id===id);
 if(id!==null&&(!p||p.field!==student.alan))throw new Error('Hedef program öğrencinin alanıyla aynı olmalı.');
 const old=student.universiteHedef,oldNets=student.denemeHedef;
 const next=p?{surum:1,id:p.id,yil:catalog.referenceYear,alan:p.field}:null;
 hedefDogrula(next);saving=true;
 student.universiteHedef=next;
 const goals=p?netHedef(p):null;
 if(goals)student.denemeHedef=goals;
 try{if(!await kaydet(true))throw new Error('Hedef kaydedilemedi. Yeniden deneyin.');}
 catch(e){if(student.universiteHedef===next){if(old===undefined)delete student.universiteHedef;else student.universiteHedef=old;if(goals){if(oldNets===undefined)delete student.denemeHedef;else student.denemeHedef=oldNets}}throw e}
 finally{saving=false}
}
function prepare(){
 const student=D.ogr[EK.ogr];
 if(state.owner!==D||state.student!==student){state={owner:D,student,field:AYT[student?.alan]?student.alan:'SAY',city:'',kind:'',query:'',examKind:'tarama',tyt:null,ayt:null,page:0}}
 return student;
}
function exams(){
 const rows=denemeListe(EK.ogr).filter(r=>!r.silindi&&(state.examKind==='all'||(r.sinavTuru||denemePdfSinavTuru(r))===state.examKind)).slice().reverse();
 const t=rows.filter(r=>r.tur==='TYT'),a=rows.filter(r=>r.tur==='AYT');
 const pick=(rs,id,ot)=>id===null?rs.find(r=>profil(r,ot,state.field))||rs[0]:rs.find(r=>r.id===id);
 const tr=pick(t,state.tyt,'TYT'),ar=pick(a,state.ayt,'AYT');
 const tp=profil(tr,'TYT',state.field),ap=profil(ar,'AYT',state.field);
 return {t,a,tr,ar,tp,ap,values:tp&&ap?{...tp,...ap}:null};
}
const opt=(v,label,selected)=>'<option value="'+kacis(String(v))+'"'+(String(v)===String(selected)?' selected':'')+'>'+kacis(label)+'</option>';
function examSelect(rows,r,ot){return '<label>'+ot+' denemesi<select id="ya'+ot+'">'+opt('','Deneme seçin',r?.id||'')+rows.map(x=>opt(x.id,x.tarih.split('-').reverse().join('.')+' · '+x.ad,r?.id)).join('')+'</select></label>'}
function bars(p,x){
 if(!p.nets)return '<p class="ya-muted">Bu program için '+catalog.referenceYear+' net profili bulunmuyor.</p>';
 return '<div class="ya-legend"><span>● Öğrenci</span><span>│ Son yerleşen</span></div>'+['TYT','AYT'].map(ot=>{
  const keys=ot==='TYT'?TYT:AYT[p.field],own=ot==='TYT'?x.tp:x.ap;
  return '<h4>'+ot+(ot==='AYT'?' '+p.field:'')+' · '+(own?num(sum(own,keys)):'—')+' / '+num(sum(p.nets.values,keys))+' net</h4><div class="ya-bars">'+keys.map(k=>{
   const [label,max]=SUBJECTS[k],v=own?.[k],ref=p.nets.values[k];
   return '<div class="ya-bar-row"><span>'+label+'</span><div class="ya-track" role="img" aria-label="'+label+': öğrenci '+num(v)+', son yerleşen '+num(ref)+' net"><i style="width:'+Math.max(0,(v??0)/max*100)+'%"></i><b style="left:'+Math.max(0,ref/max*100)+'%"></b></div><span>'+num(v)+' <small>/ '+num(ref)+'</small></span></div>';
  }).join('')+'</div>';
 }).join('');
}
function programCard(p,x,selected=false){
 const d=fark(p,x.values),own=state.student,canChoose=ogrenciMi()&&!yalnizcaGoruntuleme()&&p.field===own?.alan;
 return '<details class="ya-program"'+(selected?' open':'')+'><summary><div><span class="ya-muted">'+kacis(p.university)+'</span><h3>'+kacis(p.program)+'</h3><span class="ya-meta">'+CITIES[p.city]+' · '+p.field+' · '+(p.type==='DEVLET'?'Devlet':'%100 burslu')+'</span></div><div class="ya-gap">'+(d?'<strong>'+num(d.missing)+'</strong><span>net eksiği</span>':'<span>'+(p.nets?'Net profili var':'Net profili yok')+'</span>')+'</div></summary><div class="ya-detail">'+bars(p,x)+
  '<div class="ya-facts"><span>'+catalog.referenceYear+' son yerleşen<br><b>'+num(p.points)+' puan</b></span><span>Başarı sırası<br><b>'+num(p.rank)+'</b></span><span>OBP<br><b>'+num(p.nets?.obp)+'</b></span></div>'+
  '<div class="ya-actions">'+(canChoose?'<button class="dugme '+(selected?'':'birincil')+'" data-ya-target="'+p.id+'"'+(saving?' disabled':'')+'>'+(selected?'Net hedeflerini yeniden uygula':'Hedefim olarak seç')+'</button>':'<span class="ya-muted">'+(ogrenciMi()?'Hedef seçmek için alanın '+p.field+' olmalı.':'Hedefi öğrenci kendi hesabından seçer.')+'</span>')+
  '<a href="https://yokatlas.yok.gov.tr/detay/'+p.id+'" target="_blank" rel="noopener noreferrer">YÖK Atlas ↗</a></div>'+
  '<p class="ya-muted">'+(p.nets?'Seçince TYT, AYT ve ders net hedefleri bu profille güncellenir. Eksi netler hedefte 0 alınır.':'Net profili olmadığı için mevcut net hedefleri korunur.')+'</p></div></details>';
}
function content(){
 const o=prepare();
 if(!o)return '<h1>Üniversite Hedefi</h1><p>Öğrenci seçin.</p>';
 if(ogrenciSinavi(o)!=='YKS')return '<h1>Üniversite Hedefi</h1><p>Bu bölüm YKS öğrencileri içindir.</p>';
 const chooser=rehberMi()?'<label class="ya-student">Öğrenci<select id="yaStudent">'+canliOgrenciler().map(i=>opt(i,D.ogr[i].ad+' · '+(D.ogr[i].sube||''),EK.ogr)).join('')+'</select></label>':'';
 const head='<div class="ya-heading"><div><h1>Üniversite Hedefi</h1><p class="ya-muted">Lisans · Devlet ve %100 burslu vakıf üniversiteleri</p></div>'+chooser+'</div>';
 if(!catalog){if(!pending&&!error)void yukle().then(draw,draw);return head+'<p role="status">'+(error?kacis(error):'YÖK Atlas kataloğu yükleniyor…')+'</p>'+(error?'<button class="dugme" data-ya-retry>Yeniden dene</button>':'')}
 const x=exams(),selected=catalog.programs.find(p=>p.id===o.universiteHedef?.id);
 let list=catalog.programs.filter(p=>p.field===state.field&&(!state.city||p.city===+state.city)&&(!state.kind||p.type===state.kind)&&(!state.query||norm(p.university+' '+p.program+' '+p.group).includes(norm(state.query))));
 list.sort((a,b)=>(fark(a,x.values)?.missing??Infinity)-(fark(b,x.values)?.missing??Infinity)||(a.rank??Infinity)-(b.rank??Infinity)||a.university.localeCompare(b.university,'tr')||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(list.length/20));state.page=Math.min(state.page,pages-1);
 return head+'<p class="ya-source">Katalog '+catalog.catalogYear+' · Net profilleri '+catalog.referenceYear+' · <a href="https://yokatlas.yok.gov.tr" target="_blank" rel="noopener noreferrer">YÖK Atlas</a></p>'+
 '<section class="ya-panel"><div class="ya-exams"><label>Sınav türü<select id="yaKind">'+[['tarama','Tarama'],['genel','Genel'],['all','Tümü']].map(([k,l])=>opt(k,l,state.examKind)).join('')+'</select></label>'+examSelect(x.t,x.tr,'TYT')+examSelect(x.a,x.ar,'AYT')+'</div>'+
 '<p class="ya-muted">'+(x.values?'Net eksiği, derslerde son yerleşenin altında kalan netlerin toplamıdır. Bir dersteki fazlalık diğerindeki eksiği kapatmaz.':'Karşılaştırma için 120 soruluk TYT ve seçilen alanda 80 soruluk AYT kapsamı gerekli. Eksik dersler sıfır sayılmaz.')+' Yerleşme olasılığı veya YKS puanı hesaplanmaz.</p></section>'+
 (o.universiteHedef?'<section class="ya-selected"><div class="ya-heading"><h2>Hedefim'+(o.universiteHedef.yil!==catalog.referenceYear?' · '+o.universiteHedef.yil:'')+'</h2>'+(ogrenciMi()?'<button class="dugme" data-ya-clear>Program hedefini kaldır</button>':'')+'</div>'+
  (selected?programCard(selected,{...x,ap:profil(x.ar,'AYT',selected.field),values:x.tp&&profil(x.ar,'AYT',selected.field)?{...x.tp,...profil(x.ar,'AYT',selected.field)}:null},true):'<p>Seçtiğin program ('+kacis(o.universiteHedef.id)+') güncel katalogda yok. Kaydedilmiş net hedeflerin korunuyor.</p>')+'</section>':'')+
 '<div class="ya-filters"><label>Alan<select id="yaField">'+Object.keys(AYT).map(a=>opt(a,a,state.field)).join('')+'</select></label><label>Şehir<select id="yaCity">'+opt('','Beş şehir',state.city)+Object.entries(CITIES).map(([k,l])=>opt(k,l,state.city)).join('')+'</select></label><label>Üniversite türü<select id="yaType">'+opt('','Tümü',state.kind)+opt('DEVLET','Devlet',state.kind)+opt('VAKIF','%100 burslu vakıf',state.kind)+'</select></label><label class="ya-search">Üniversite / bölüm ara<input id="yaSearch" type="search" maxlength="120" value="'+kacis(state.query)+'" placeholder="Örn. bilgisayar mühendisliği"></label></div>'+
 '<div class="ya-heading"><h2>'+num(list.length)+' program</h2><span class="ya-muted">'+(x.values?'Net eksiğine göre':'Başarı sırasına göre')+'</span></div><div class="ya-results">'+list.slice(state.page*20,(state.page+1)*20).map(p=>programCard(p,x)).join('')+(list.length?'':'<p>Bu filtrelerle program bulunamadı.</p>')+'</div>'+
 '<div class="ya-pagination"><button class="dugme" data-ya-page="-1"'+(state.page===0?' disabled':'')+'>Önceki</button><span>'+(state.page+1)+' / '+pages+'</span><button class="dugme" data-ya-page="1"'+(state.page===pages-1?' disabled':'')+'>Sonraki</button></div><p class="ya-muted">Geçmiş yerleşme koşulları ve OBP kişiye göre değişir. Programın güncel koşulları YÖK Atlas bağlantısında.</p><p id="yaStatus" role="status"></p>';
}
function draw(){if(EK.sekme==='universite'&&document.getElementById('yaKok'))document.getElementById('yaKok').innerHTML=content()}
function gorunum(){return '<div id="yaKok">'+content()+'</div>'}
document.addEventListener('change',e=>{
 if(!e.target.closest?.('#yaKok'))return;
 const id=e.target.id,v=e.target.value;
 if(id==='yaStudent'){EK.ogr=+v;draw();return}
 const map={yaField:'field',yaCity:'city',yaType:'kind',yaKind:'examKind',yaTYT:'tyt',yaAYT:'ayt'};
 if(!map[id])return;state[map[id]]=v;state.page=0;if(id==='yaKind'||id==='yaField'){state.tyt=null;state.ayt=null}draw();
});
document.addEventListener('input',e=>{
 if(e.target.id!=='yaSearch'||!e.target.closest?.('#yaKok'))return;
 const pos=e.target.selectionStart;state.query=e.target.value.slice(0,120);state.page=0;draw();const box=document.getElementById('yaSearch');box?.focus();if(pos!==null)box?.setSelectionRange(pos,pos);
});
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('#yaKok button');if(!b)return;
 if(b.hasAttribute('data-ya-retry')){error='';draw();return}
 if(b.hasAttribute('data-ya-page')){state.page+=+b.dataset.yaPage;draw();return}
 if(!b.hasAttribute('data-ya-target')&&!b.hasAttribute('data-ya-clear'))return;
 const owner=D,student=D.ogr[EK.ogr];b.disabled=true;
 try{await hedefSec(b.hasAttribute('data-ya-clear')?null:b.dataset.yaTarget,owner,student);if(D!==owner||D.ogr[EK.ogr]!==student)return;draw();const s=document.getElementById('yaStatus');if(s)s.textContent=student.universiteHedef?'Hedef kaydedildi.':'Program hedefi kaldırıldı. Net hedefleri korunuyor.'}
 catch(err){if(D!==owner||D.ogr[EK.ogr]!==student)return;const s=document.getElementById('yaStatus');if(s)s.textContent=err.message;b.disabled=false}
});
return {gorunum,yukle,profil,fark,netHedef,hedefSec,hedefDogrula,katalogDogrula};
})();
function gorunumUniversite(){return YOKATLAS.gorunum()}
