const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),marker='<script id="uygulama">',start=html.indexOf(marker)+marker.length,source=html.slice(start,html.indexOf('// ---------------------------------------------------------------- başlangıç',start));
const node=()=>({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}}),nodes={ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox={TextEncoder,console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document;vm.createContext(sandbox);new vm.Script(source).runInContext(sandbox);const run=s=>vm.runInContext(s,sandbox);
run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-25';D.ogr=[{no:1,ad:'Synthetic Ada',sube:'11-A',alan:'SAY',sinif:11,kap:6,off:[6],aktif:true,ogrenciBulutId:'d70ec14d-ab10-43e5-b63f-0dd990c3626b'}];EK.ogr=0;
 D.ogr[0].universiteHedef={surum:1,id:'123456789',yil:2025,alan:'SAY'};D.ogr[0].diplomaNotu=87.5;D.ogrCalismaTs=1000;packet=ogrenciCalismaPaketi();`);
// An old student build may still send universiteHedef and diplomaNotu in its work packet: they are teacher-owned now.
assert(run('packet.veri').includes('"universiteHedef"'),'fixture: the old student packet carries both fields');
run(`teacher=JSON.parse(JSON.stringify(D));teacher.rol='rehber';teacher.ogr[0].universiteHedef={surum:1,id:'987654321',yil:2025,alan:'SAY'};teacher.ogr[0].diplomaNotu=91;teacher.ogr[0].ogrCalismaTs=100;D=teacher;ogrenciCalismasiniUygula(packet,0);`);
assert.equal(run('D.ogr[0].universiteHedef.id'),'987654321','a newer student packet does not overwrite the teacher target');assert.equal(run('D.ogr[0].diplomaNotu'),91,'nor the teacher diploma notu');
assert(run('D.ogr[0].ogrCalismaTs')>=1000,'the packet itself was applied (newer clock), only the two fields are skipped');
// ...nor does a clear (null) or a different value in a newer packet, nor a student packet that lacks them.
run(`newer=JSON.parse(packet.veri);newer.ogr[0].universiteHedef=null;newer.ogr[0].diplomaNotu=null;newPacket={ts:2000,veri:JSON.stringify(newer)};ogrenciCalismasiniUygula(newPacket,0);`);
assert.equal(run('D.ogr[0].universiteHedef.id'),'987654321');assert.equal(run('D.ogr[0].diplomaNotu'),91);
run(`other=JSON.parse(packet.veri);other.ogr[0].universiteHedef={surum:1,id:'111111111',yil:2025,alan:'SAY'};other.ogr[0].diplomaNotu=60;otherPacket={ts:3000,veri:JSON.stringify(other)};ogrenciCalismasiniUygula(otherPacket,0);`);
assert.equal(run('D.ogr[0].universiteHedef.id'),'987654321');assert.equal(run('D.ogr[0].diplomaNotu'),91);
// The teacher's package to the student still carries both (old backups and the teacher-owned data round-trip).
assert.equal(run('paketiYukle(ogrenciPaketi(0)).ogr[0].universiteHedef.id'),'987654321');assert.equal(run('paketiYukle(ogrenciPaketi(0)).ogr[0].diplomaNotu'),91);
assert(!run('JSON.stringify(ogrenciPaketi(0)).includes("programs")'));
// Validation of backups stays, so old backups still load.
assert.throws(()=>run('(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].diplomaNotu=120;yedekDogrula(y)})()'),/diploma notu/i);
assert.throws(()=>run('(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].universiteHedef={id:"1"};yedekDogrula(y)})()'));
run('(()=>{const y=JSON.parse(JSON.stringify(D));yedekDogrula(y)})()');
console.log('PASS YÖK Atlas teacher-owned target and diploma notu are not overwritten by student work packets');
