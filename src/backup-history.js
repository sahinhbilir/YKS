// Bounded, self-contained snapshot slots; uses the existing owner-protected history collection.
const BACKUP_HISTORY=(()=>{
 'use strict';
 const INDEX='_v2-index',caps={day:30,month:12,operation:10,start:1};
 const blank=()=>({version:2,seq:0,entries:[]});
 const slot=(kind,n)=>'_v2-'+({day:'d',month:'m',operation:'r',start:'s'}[kind])+String(n).padStart(2,'0');
 const known=new Set(Object.entries(caps).flatMap(([k,n])=>Array.from({length:n},(_,i)=>slot(k,i))));
 const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 function validate(v){
  const fail=()=>{throw new Error('Bulut yedek dizini doğrulanamadı; mevcut yedeklerin üzerine yazılmadı.');};
  if(!v||v.version!==2||!Number.isSafeInteger(v.seq)||v.seq<0||!Array.isArray(v.entries)||v.entries.length>53)fail();
  const ids=new Set();
  for(const e of v.entries){
   if(!e||!Object.hasOwn(caps,e.kind)||!known.has(e.slot)||!Array.from({length:caps[e.kind]},(_,i)=>slot(e.kind,i)).includes(e.slot)||ids.has(e.slot)||!iso(e.gun)||!Number.isSafeInteger(e.ts)||e.ts<1||e.ts>v.seq||!Number.isSafeInteger(e.boyut)||e.boyut<1||e.boyut>900000||typeof e.sha!=='string'||!/^[a-f0-9]{64}$/.test(e.sha)||typeof e.kaynak!=='string'||e.kaynak.length>100||!Number.isSafeInteger(e.ogrenciSayisi)||e.ogrenciSayisi<0||!Number.isSafeInteger(e.sonucSayisi)||e.sonucSayisi<0)fail();
   ids.add(e.slot);
  }
  return v;
 }
 function parse(doc){if(!doc)return blank();try{return validate(JSON.parse(doc.veri))}catch(e){throw new Error('Bulut yedek dizini okunamadı; mevcut yedeklerin üzerine yazılmadı.')}}
 function plan(input,requests,now){
  validate(input);const out=JSON.parse(JSON.stringify(input)),writes=[];
  for(const request of requests){
   const {kind}=request;if(!Object.hasOwn(caps,kind))throw new Error('Yedek türü geçersiz.');
   const choices=Array.from({length:caps[kind]},(_,i)=>slot(kind,i)),same=out.entries.find(e=>e.kind===kind&&(kind==='day'?e.gun===request.gun:kind==='month'?e.gun.slice(0,7)===request.gun.slice(0,7):kind==='start'?true:false));
   const target=same?.slot||choices.find(id=>!out.entries.some(e=>e.slot===id))||out.entries.filter(e=>e.kind===kind).sort((a,b)=>a.ts-b.ts)[0].slot;
   const ts=Math.max(now,out.seq+1),entry={kind,slot:target,gun:request.gun,ts,boyut:request.boyut,sha:request.sha,kaynak:request.kaynak,ogrenciSayisi:request.ogrenciSayisi,sonucSayisi:request.sonucSayisi};
   out.entries=out.entries.filter(e=>e.slot!==target);out.entries.push(entry);out.seq=ts;
   writes.push({entry,document:{veri:request.veri,ts,surum:1,boyut:request.boyut,ogrenciSayisi:request.ogrenciSayisi,sonucSayisi:request.sonucSayisi}});
  }
  validate(out);return {index:out,writes};
 }
 const token=e=>e.slot+'~'+e.ts+'~'+e.sha;
 function lookup(v,id){validate(v);return v.entries.find(e=>token(e)===id)||null;}
 const indexDocument=v=>({veri:JSON.stringify(validate(v)),ts:v.seq,surum:1,boyut:new TextEncoder().encode(JSON.stringify(v)).length,ogrenciSayisi:0,sonucSayisi:0});
 const reserved=id=>typeof id==='string'&&id.startsWith('_v2-');
 return {INDEX,caps,blank,validate,parse,plan,token,lookup,indexDocument,reserved};
})();
