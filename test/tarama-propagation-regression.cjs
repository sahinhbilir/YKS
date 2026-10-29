const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
let html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
for(const [tag,file] of [['DENEMELER','src/denemeler.js'],['SIRALAMALAR','src/siralamalar.js']]){
 const a='// BEGIN '+tag,b='// END '+tag;html=html.slice(0,html.indexOf(a))+a+'\n'+fs.readFileSync(file,'utf8')+'\n'+html.slice(html.indexOf(b));
}
const start=html.indexOf('<script id="uygulama">')+'<script id="uygulama">'.length;
const source=html.slice(start,html.indexOf('// ---------------------------------------------------------------- başlangıç',start));
const node=()=>({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes={ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox={TextEncoder,console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document;vm.createContext(sandbox);new vm.Script(source).runInContext(sandbox);const run=x=>vm.runInContext(x,sandbox);
(async()=>{
 run(`D=varsayilan();D.rol='rehber';D.ogr=[{no:1,ad:'Ada',alan:'SAY'}];kaydet=async()=>true;
 D.siralama={surum:1,sinavlar:[{id:'one',ad:'Deneme',okul:'Okul',ts:1,T:{tarih:'18.09.2026',katilim:['','',''],kurum:null,ogr:[]},F:null,tur:'tarama'}]};
 rapor={ad:'Deneme',tarih:'2026-09-18'};row={oturum:'TYT',puan:null,dersler:[{kod:'turkce',dogru:10,yanlis:0,soru:40}]};`);
 assert.equal(run('denemePdfKaydi(rapor,row).sinavTuru'),'tarama');
 assert.equal(run("denemePdfKaydi({...rapor,tarih:'2026-09-19'},row).sinavTuru"),'genel');
 run('record=denemePdfKaydi(rapor,row);delete record.sinavTuru');assert(run('denemeDogrula([record])'));
 run("record.sinavTuru='invalid'");assert.throws(()=>run('denemeDogrula([record])'));
 run("record.sinavTuru='tarama';D.ogr[0].denemeOkul=[record]");
 await run("SIRALAMA.turDegistir('one','genel')");assert.equal(run('D.ogr[0].denemeOkul[0].sinavTuru'),'genel');assert(run('D.ogr[0].denemeYayinBekliyor'));assert(run('D.ogr[0].denemeOkul[0].ts>record.ts'));
 run('before=JSON.stringify(D);kaydet=async()=>false');await assert.rejects(run("SIRALAMA.turDegistir('one','tarama')"));assert.equal(run('JSON.stringify(D)'),run('before'));
 // Publish an old record and ensure failed transactions leave the local copy untouched.
 run(`kaydet=async()=>true;syncIdSagla=()=>{};oncedenAyir=async()=>null;bulutYuvasiCoz=async()=>({anlik:true});defterUid=()=>"teacher";sureSinirli=async p=>p;
 D.ogr[0].syncId='s';D.ogr[0].ogrenciBulutId='student';delete D.ogr[0].denemeOkul[0].sinavTuru;
 window.bulut={yapilandirilmis:true,mevcutKullanici:()=>({uid:'teacher'}),db:{},doc:()=>({}),runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({durum:'aktif',ogretmenUid:'teacher',ogrenciBulutId:'student'})}),update:(ref,data)=>{globalThis.published=data}})};`);
 await run('denemeOkulYayinla(0)');assert.equal(run('D.ogr[0].denemeOkul[0].sinavTuru'),'genel');assert.equal(run('JSON.parse(published.denemeOkul)[0].sinavTuru'),'genel');
 run(`delete D.ogr[0].denemeOkul[0].sinavTuru;beforeLocal=JSON.stringify(D.ogr[0].denemeOkul);window.bulut.runTransaction=async(db,fn)=>{await fn({get:async()=>({exists:()=>true,data:()=>({durum:'aktif',ogretmenUid:'teacher',ogrenciBulutId:'student'})}),update:()=>{}});throw Error('transaction failed')}`);
 await assert.rejects(run('denemeOkulYayinla(0)'));assert.equal(run('JSON.stringify(D.ogr[0].denemeOkul)'),run('beforeLocal'));
 console.log('PASS tarama import, validation, propagation and rollback');
})().catch(e=>{console.error(e);process.exitCode=1});

