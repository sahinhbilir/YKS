// Rolling, completion-driven study track for YKS students without school.
const TYT_METOT=(()=>{
'use strict';
const INFO={
 tr:['Türkçe',25,'https://www.youtube.com/watch?v=yQAQoIk9GzI','https://www.youtube.com/playlist?list=PLVsjxq1KrcgxND0PpnzXxr5gYRTaKEKWC'],
 mat:['Matematik',30,'https://www.youtube.com/watch?v=taQxSST2haM','https://www.youtube.com/playlist?list=PLVoSZ0D0CB3oqLwG6l_p6CceuLyagc5yM'],
 tar:['Tarih',15,'https://www.youtube.com/watch?v=0Us1bLOTR6o','https://www.youtube.com/playlist?list=PLRbyTgiOSh9nqSw97n5L-ywijENKVkvgs'],
 cog:['Coğrafya',15,'https://www.youtube.com/watch?v=6gd_HQhY14c','https://www.youtube.com/playlist?list=PLnBnugScc-7LUk8uedC4Vwx2iumUJ3LO5'],
 fel:['Felsefe',15,'https://www.youtube.com/watch?v=5kcLcw2-fFo','https://www.youtube.com/playlist?list=PL4P7Q5QUoe-i6-grEhF-xFieFIrh-TepB'],
 din:['Din Kültürü',15,'https://www.youtube.com/watch?v=90psHEJxloU','https://www.youtube.com/playlist?list=PLBbyBioVuslkT9hAgj7hFdaToR9fEuDlt'],
 fiz:['Fizik',20,'https://www.youtube.com/watch?v=yv07PXQ5b64','https://www.youtube.com/playlist?list=PLhhV4F6NB0-uEPdZncMf_qb0tSKyBM-Lf'],
 kim:['Kimya',20,'https://www.youtube.com/watch?v=aa6YNGqGdQo','https://www.youtube.com/watch?v=PSWtyR8C7h4'],
 bio:['Biyoloji',20,'https://www.youtube.com/watch?v=nSjznSFDMQs','https://www.youtube.com/playlist?list=PLLFjYcKh-t8Qg7GpZmjxPJI1kYr7P9W52'],
 geo:['Geometri',25,'https://www.youtube.com/watch?v=tgQfoNXtYc0','https://www.youtube.com/playlist?list=PLVoSZ0D0CB3ovGqsyyKyl129FIZEXQm60']
};
const eligible=()=>ogrenciMi()&&D?.ogr?.length===1&&D.ogr[0].okul===false&&ogrenciSinavi(D.ogr[0])==='YKS';
const active=()=>eligible()&&D.ogr[0].kendiPlan?.metot?.surum===1;
const key=x=>encodeURIComponent(x.ders+'|'+x.ad);
const grammar=x=>/dil bilg|ses bilg|sözcükte yapı|sözcük yap|sözcük tür|isim|sıfat|zamir|zarf|edat|bağlaç|ünlem|fiil|çatı|cümlenin [öo][ğg]e|cümle tür|cümle bilg|yazım|noktalama|anlatım bozuk/.test(x.ad.toLocaleLowerCase('tr'));
function course(s){s=s.toLocaleLowerCase('tr');return /geometri/.test(s)?'geo':/matematik/.test(s)?'mat':/türkçe/.test(s)?'tr':/tarih/.test(s)?'tar':/coğraf/.test(s)?'cog':/felsefe/.test(s)?'fel':/din/.test(s)?'din':/fizik/.test(s)?'fiz':/kimya/.test(s)?'kim':/biyoloji/.test(s)?'bio':null}
function topics(si=0){return D.ogr[si].kendiPlan.sira.map(ki=>({ki,ders:konuDersAdi(ki),ad:konuAl(ki)[3]})).map(x=>({...x,c:course(x.ders),tyt:konuSinavTuru(x.ki)==='AYT'?false:tytPlanKonusuMu(x.ders,x.ad),key:key(x)})).sort((a,b)=>a.c==='tr'&&b.c==='tr'?Number(!grammar(a))-Number(!grammar(b)):0)}
function validate(m){
 if(m?.baslangiclar!==undefined&&(!m.baslangiclar||typeof m.baslangiclar!=='object'||Array.isArray(m.baslangiclar)||Object.entries(m.baslangiclar).some(([c,d])=>!Object.hasOwn(INFO,c)||!isoTarihGecerli(d)||d<m.baslangic)))throw new Error('Ders başlangıç günleri geçersiz.');
 if(!m||m.surum!==1||!isoTarihGecerli(m.baslangic)||!Number.isInteger(m.dakika)||m.dakika<120||m.dakika>600||!m.tamam||typeof m.tamam!=='object'||Array.isArray(m.tamam)||Object.keys(m.tamam).length>10000||Object.entries(m.tamam).some(([k,v])=>k.length>1600||!isoTarihGecerli(v)||v<m.baslangic))throw new Error('TYT çalışma yöntemi kaydı geçersiz.');
 for(const [id,date] of Object.entries(m.tamam)){
  if(!/^(?:[vrgpbw]\|.+|weak\|.+|d\|[01345]|gr)$/.test(id))throw new Error('Çalışma kimliği geçersiz.');
  try{decodeURIComponent(id)}catch(e){throw new Error('Çalışma kimliği kodlaması geçersiz.')}
  if(id.startsWith('r|')&&(!m.tamam['v|'+id.slice(2)]||gunNo(date)<gunNo(m.tamam['v|'+id.slice(2)])+3))throw new Error('Hatırlama testi video gününden en az üç gün sonra olmalı.');
 }
 const mocks=[0,1,3,4,5];
 for(let i=1;i<mocks.length;i++)if(m.tamam['d|'+mocks[i]]&&(!m.tamam['d|'+mocks[i-1]]||gunNo(m.tamam['d|'+mocks[i]])<gunNo(m.tamam['d|'+mocks[i-1]])+(i===2?2:1)))throw new Error('Genel deneme sırası veya dinlenme günü geçersiz.');
 return true;
}
let saving=false;
async function write(fn){
 if(!eligible()||yalnizcaGoruntuleme()||saving)throw new Error('Çalışma planı şu anda değiştirilemiyor.');
 const owner=D,o=D.ogr[0],old=o.kendiPlan;saving=true;
 const next=JSON.parse(JSON.stringify(old));o.kendiPlan=next;
 try{fn(o.kendiPlan);validate(o.kendiPlan.metot);if(!await kaydet(true))throw new Error('Plan kaydedilemedi. Yeniden deneyin.')}
 catch(e){if(o.kendiPlan===next)o.kendiPlan=old;throw e}finally{saving=false}
 if(D===owner)ciz();
}
async function start(){
 if(!eligible()||!D.ogr[0].kendiPlan)throw new Error('Önce kendi YKS planını oluştur.');
 const input=document.getElementById('tmButce'),minutes=Number(input?.value||480),hb=buHafta(0),ov=elleAl(0,hb);
 // A blank automatically frozen placeholder has never delivered work. Release only that
 // current-week placeholder; a paper containing any rows or results stays untouched.
 const blank=!D.ogr[0].kendiPlan.metot&&ov.sabit&&ov.ogrenciOtomatik&&!ov.metotPlan&&
  Array.isArray(ov.plan?.slotlar)&&ov.plan.slotlar.length===7&&ov.plan.slotlar.every(a=>Array.isArray(a)&&a.length===0)&&
  !Object.keys(ov.yer||{}).length&&!Object.keys(ov.anlatim||{}).length&&!Object.keys(ov.serbest||{}).length&&
  !Object.keys(ov.konuSlot||{}).length&&!haftaSonucSayisi(0,hb);
 const owner=D,old=blank?JSON.parse(JSON.stringify(ov)):null;
 if(blank){delete ov.sabit;delete ov.plan;delete ov.ogrenciOtomatik;}
 try{await write(kp=>{if(kp.metot)return;kp.metot={surum:1,baslangic:isoDan(bugunNo()),dakika:minutes,tamam:{}};});}
 catch(e){if(old&&D===owner)D.elle['0|'+hb]=old;throw e;}
}
function model(day=bugunNo()){
 const m=D.ogr[0].kendiPlan.metot,date=isoDan(day),done=Object.fromEntries(Object.entries(m.tamam).filter(([,d])=>d<=date)),all=topics(),tyt=all.filter(x=>x.tyt&&x.c),ayt=all.filter(x=>!x.tyt);
 const watched=x=>!!done['v|'+x.key],tested=x=>!!done['r|'+x.key];
 const finished=xs=>xs.length>0&&xs.every(tested),fraction=xs=>xs.length?xs.filter(watched).length/xs.length:1;
 const grammarTopics=tyt.filter(x=>x.c==='tr'&&grammar(x));
 const social=['tar','cog','fel','din'],science=['fiz','kim','bio'];
 const tytDone=finished(tyt),lastRecall=tytDone?Math.max(...tyt.map(x=>gunNo(done['r|'+x.key]))):null;
 const offsets=[0,1,3,4,5],weekDone=tytDone&&offsets.every(n=>done['d|'+n]);
 const phase=!tytDone?'TYT':!weekDone?'TYT deneme haftası':'AYT';
 const pool=phase==='AYT'?ayt:tyt,ot=phase==='AYT'?'AYT':'TYT';
 let tasks=[];
 const add=t=>tasks.push(t);
 const task=(id,title,kind,minutes,extra={})=>({id,title,kind,minutes,...extra});
 // Recall dates are derived exclusively from the recorded video day, across week/month boundaries.
 for(const x of all){const v=done['v|'+x.key];if((x.tyt||phase==='AYT')&&v&&!tested(x)&&gunNo(v)+3<=day)add(task('r|'+x.key,x.ad,'Hatırlama testi',45,{course:INFO[x.c]?.[0]||x.ders,questions:INFO[x.c]?.[1]||25,due:gunNo(v)+3,video:gunNo(v),x}))}
 // The document's exceptional grammar overview recall, separate from topic recalls.
 if(done['g|TYT|tr']&&!done['gr']&&gunNo(done['g|TYT|tr'])+3<=day)add(task('gr','Dil bilgisi genel tekrarı','Hatırlama testi',40,{questions:25,due:gunNo(done['g|TYT|tr'])+3}));
 const habits=[task('p|'+date,'Paragraf','Günlük alışkanlık',30,{questions:20})];
 for(let g=gunNo(m.baslangic)+6;g<=day&&g<gunNo(m.baslangic)+730;g+=7)if(!done['w|'+isoDan(g)])habits.push(task('w|'+isoDan(g),'Haftanın bütün yanlış sorularını yeniden çöz','Haftalık tekrar',60));
 tasks.push(...habits);
 if(phase==='TYT deneme haftası'){
  const next=offsets.find(n=>!done['d|'+n]);
  const ix=offsets.indexOf(next),previous=ix>0?done['d|'+offsets[ix-1]]:null,earliest=Math.max(lastRecall+1+next,previous?gunNo(previous)+(ix===2?2:1):0);
  if(day>=earliest){
   // A delayed mock never causes two general mocks to be squeezed into the same day.
   if(!offsets.some(n=>done['d|'+n]===date))add(task('d|'+next,'TYT genel denemesi · netler ve zayıf konuların analizi','Deneme + analiz',225,{questions:120}));
  }else add(task('weak|'+date,'Branş denemeleri ve zayıf konulara dönüş','Zayıf konu çalışması',120));
 }
 const gates={tr:true,mat:true,tar:fraction(grammarTopics)>=.8,cog:fraction(grammarTopics)>=.8,fel:fraction(grammarTopics)>=.8,din:fraction(grammarTopics)>=.8,fiz:fraction(tyt.filter(x=>social.includes(x.c)))>=.8,kim:fraction(tyt.filter(x=>social.includes(x.c)))>=.8,bio:fraction(tyt.filter(x=>social.includes(x.c)))>=.8,geo:fraction(tyt.filter(x=>science.includes(x.c)))>=.8};
 // Group branches replace their individual lessons once every constituent has finished recall.
 const socialDone=social.every(c=>finished(tyt.filter(x=>x.c===c))),scienceDone=science.every(c=>finished(tyt.filter(x=>x.c===c)));
 const branches=[];
 if(phase==='TYT')for(const c of Object.keys(INFO)){
  if((socialDone&&social.includes(c))||(scienceDone&&science.includes(c)))continue;
  if(finished(tyt.filter(x=>x.c===c)))branches.push([c,INFO[c][0],INFO[c][1]]);
 }
 if(socialDone&&phase==='TYT')branches.push(['sos','Sosyal',20]);if(scienceDone&&phase==='TYT')branches.push(['fen','Fen',20]);
 if((day-gunNo(m.baslangic))%3===0)for(const [c,name,q] of branches)add(task('b|'+c+'|'+date,name+' branş denemesi','Branş denemesi',45,{questions:q}));
 const todayDone=Object.entries(done).filter(([,v])=>v===date),completedMinutes=todayDone.reduce((n,[id])=>n+(id.startsWith('g|')||id.startsWith('weak|')?120:id.startsWith('v|')?60:id.startsWith('r|')||id.startsWith('b|')?45:id==='gr'?40:id.startsWith('p|')?30:id.startsWith('d|')?225:60),0);
 let used=completedMinutes;
 tasks=tasks.filter(t=>!done[t.id]);for(const t of tasks)used+=t.minutes;
 if(phase!=='TYT deneme haftası'){
  const groups=[...new Set(pool.map(x=>x.c||x.ders))];
  for(const c of groups){
   if(phase==='TYT'&&!gates[c])continue;
   const xs=pool.filter(x=>(x.c||x.ders)===c);
   if(c==='tr')xs.sort((a,b)=>Number(!grammar(a))-Number(!grammar(b)));
   const next=xs.find(x=>!watched(x));if(!next)continue;
   // One topic video per lesson/day; Türkçe and mathematics can progress in parallel.
   if(xs.some(x=>done['v|'+x.key]===date))continue;
   const g='g|'+ot+'|'+c,overview=!done[g],minutes=overview?120:60;
   const futureLoad=all.filter(x=>done['v|'+x.key]===date&&!tested(x)).length*45+45+30;
   if(used+minutes>m.dakika||(!overview&&futureLoad>m.dakika))continue;
   const resource=ot==='TYT'?(c==='tr'&&!overview&&grammar(next)?'https://www.youtube.com/channel/UCyohoF5P2JFvc3KLLZRwDug/videos':INFO[c]?.[overview?2:3]):null;
   add(task(overview?g:'v|'+next.key,overview?(INFO[c]?.[0]||next.ders)+' · genel son tekrar':next.ad,overview?'Genel son tekrar':'Konu videosu',minutes,{resource,course:INFO[c]?.[0]||next.ders,x:overview?null:next}));used+=minutes;
  }
 }
 return {phase,tasks,tyt,ayt,done,completedMinutes,used,budget:m.dakika,over:used>m.dakika,complete:weekDone&&ayt.length===0,progress:tyt.filter(tested).length,total:tyt.length};
}
function intro(){return '<section class="kart" style="padding:20px;margin-bottom:18px"><h2>TYT önce · 3 gün sonra hatırlama</h2><p>Türkçe ve Matematik birlikte başlar. Dil bilgisi ilerleyince Sosyal, ardından Fen ve Geometri açılır. AYT, TYT ve deneme haftasından sonra gelir.</p><label>Günlük çalışma bütçesi <input id="tmButce" type="number" min="120" max="600" step="30" value="480"> dakika</label><p class="mini">Başlangıç bugündür. Önceki plan ve sonuçların korunur. Video süreleri planlama tahminidir.</p><button class="dugme birincil" id="tmStart">Bu yöntemle çalışmaya başla</button></section>'}
function view(){
 const v=model(),date=isoDan(bugunNo()),m=D.ogr[0].kendiPlan.metot;
 return '<div id="tmKok"><div class="baslik"><h1>'+v.phase+' çalışma planım</h1><p>'+ggyy(bugunNo())+' · '+v.progress+'/'+v.total+' TYT konusu hatırlandı</p></div><progress max="'+v.total+'" value="'+v.progress+'" style="width:100%"></progress><div class="kart" style="padding:20px;margin:16px 0"><b>'+v.completedMinutes+' / '+v.budget+' dakika tamamlandı</b><p>Video günü: notlar ve öğretmenin örnekleri. Konu testi: gerçek izleme tarihinden tam 3 gün sonra.</p><p class="mini">Hatırlama testi: 5 dakika boş kâğıda hatırla → notsuz soruları çöz → yanlışların ilgili video bölümüne dön. Tahmini süreler kullanılır.</p>'+(v.over?'<p role="status">Bekleyen testler bütçeyi aşıyor. Yeni videolar açılmadı; geciken testlerin asıl tarihleri aşağıda.</p>':'')+'</div>'+v.tasks.map(t=>'<section class="kart tm-task" style="padding:18px;margin-bottom:12px"><span class="mini">'+kacis(t.kind)+(t.course?' · '+kacis(t.course):'')+'</span><h2>'+kacis(t.title)+'</h2><p>'+t.minutes+' dk'+(t.questions?' · '+t.questions+' soru':'')+(t.due!==undefined?' · Test tarihi '+ggyy(t.due)+(t.due<bugunNo()?' · Gecikti':''):'')+(t.video!==undefined?' · Video '+ggyy(t.video):'')+'</p><div class="arac">'+(t.resource?'<a class="dugme" href="'+t.resource+'" target="_blank" rel="noopener">Video kaynağı</a>':'')+'<button class="dugme birincil" data-tm-done="'+kacis(t.id)+'">Tamamladım</button></div></section>').join('')+'<details class="kart" style="padding:18px"><summary>Yaklaşan hatırlama testleri ve bugünkü kayıtlar</summary>'+topics().filter(x=>m.tamam['v|'+x.key]&&!m.tamam['r|'+x.key]&&gunNo(m.tamam['v|'+x.key])+3>bugunNo()).map(x=>'<p>'+ggyy(gunNo(m.tamam['v|'+x.key])+3)+' · '+kacis(x.ad)+'</p>').join('')+Object.entries(m.tamam).filter(([,d])=>d===date).map(([id])=>'<p>'+kacis(decodeURIComponent(id.replace(/^[^|]+\|/,'')))+' <button class="dugme" data-tm-undo="'+kacis(id)+'">Geri al</button></p>').join('')+'</details><p class="mini">Genel tekrarlar konu testlerine ek bir test üretmez; ilk dil bilgisi tekrarı istisnadır. Genel denemeler: 165 dk sınav + 60 dk aynı gün analiz.</p><button class="dugme" data-sekme="denemeler">Deneme sonuçlarımı gir</button></div>';
}
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('#tmStart,[data-tm-done],[data-tm-undo]');if(!b)return;
 try{
  if(b.id==='tmStart'){await start();return}
  const id=b.dataset.tmDone||b.dataset.tmUndo;
  if(!active())return;
  await write(kp=>{
   if(b.dataset.tmUndo){
    const r=id.startsWith('v|')?'r|'+id.slice(2):null;
    if(r&&kp.metot.tamam[r])throw new Error('Önce bu konunun hatırlama testini geri al.');
    delete kp.metot.tamam[id];return;
   }
   if(!model().tasks.some(t=>t.id===id))throw new Error('Plan değişti. Güncel çalışmayı seç.');
   kp.metot.tamam[id]=isoDan(bugunNo());
  });
 }catch(err){bilgiVer(err.message)}
});
function settings(si=0){
 const m=D.ogr[si]?.kendiPlan?.metot;if(!m)return '';
 return '<details style="margin-top:14px"><summary>Ders başlangıç günleri</summary><p class="mini">Boş tarih otomatik planlanır. Genel tekrar gününde o dersin konu videosu verilmez. Tamamlanmış veya çıktısı alınmış haftalar korunur.</p><div class="arac"><label>Fen başlangıcı <input type="date" id="tmFenStart" min="'+m.baslangic+'"></label><button type="button" class="dugme" data-tm-group="fiz,kim,bio" data-input="tmFenStart">Fen derslerine uygula</button><label>Sosyal başlangıcı <input type="date" id="tmSosStart" min="'+m.baslangic+'"></label><button type="button" class="dugme" data-tm-group="tar,cog,fel,din" data-input="tmSosStart">Sosyal derslerine uygula</button></div><div class="kp-dersler">'+Object.entries(INFO).map(([c,a])=>'<label class="etiket">'+a[0]+'<br><input type="date" class="tmStartDate" data-course="'+c+'" min="'+m.baslangic+'" value="'+(m.baslangiclar?.[c]||'')+'"></label>').join('')+'</div><button type="button" class="dugme" id="tmStartsSave">Başlangıçları kaydet</button></details>';
}
async function setStarts(dates){
 if(!active()||saving||yalnizcaGoruntuleme())throw new Error('Çalışma başlangıçları şu anda değiştirilemiyor.');
 const owner=D,o=D.ogr[0],oldElle={...(D.elle||{})},oldDraft=D.ogrTaslak,removed=[];
 // Only automatic, unused, unprinted method sheets may be rebuilt by this explicit edit.
 for(const [key,ov] of Object.entries(D.elle||{})){
  const [si,hb]=key.split('|').map(Number);if(si!==0||hb<buHafta(0)||!ov.ogrenciOtomatik||!ov.metotPlan)continue;
  const hs=planHaftaSonu(0,hb),inWeek=g=>g>=hb&&g<=hs;
  const printed=ov.metotBaski||(o.etkinlik?.kayit||[]).some(r=>r.tur==='pdf'&&r.hafta===hb);
  const completed=(D.log||[]).some(l=>l[1]===0&&inWeek(l[0]))||Object.values(D.ogrIslenis?.[0]||{}).some(inWeek)||Object.values(o.kendiPlan.metot.tamam||{}).some(d=>inWeek(gunNo(d)));
  if(!printed&&!completed){removed.push(key);delete D.elle[key]}
 }
 D.ogrTaslak={...(D.ogrTaslak||{})};for(const key of Object.keys(D.ogrTaslak))if(+key.split('|')[0]===0&&+key.split('|')[1]>=buHafta(0))delete D.ogrTaslak[key];
 try{await write(kp=>{kp.metot.baslangiclar={...dates}})}
 catch(e){if(D===owner){for(const key of removed)D.elle[key]=oldElle[key];D.ogrTaslak=oldDraft}throw e}
}
document.addEventListener('click',async e=>{
 const group=e.target.closest?.('[data-tm-group]');if(group){const value=document.getElementById(group.dataset.input)?.value||'';document.querySelectorAll('.tmStartDate').forEach(el=>{if(group.dataset.tmGroup.split(',').includes(el.dataset.course))el.value=value});return}
 if(e.target.id!=='tmStartsSave')return;
 try{const dates={};document.querySelectorAll('.tmStartDate').forEach(el=>{if(el.value)dates[el.dataset.course]=el.value});await setStarts(dates);bilgiVer('Başlangıç günleri kaydedildi. Kullanılmamış haftalar yeniden hazırlandı.')}catch(err){bilgiVer(err.message)}
});
document.addEventListener('click',async e=>{if(e.target.id!=='tmBudget'||!active())return;try{await write(kp=>{kp.metot.dakika=Number(document.getElementById('tmButce').value)})}catch(err){bilgiVer(err.message)}});
return {info:INFO,grammar,eligible,active,validate,start,model,view,intro,topics,settings,setStarts};
})();
