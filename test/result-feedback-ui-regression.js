#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const listeners = {};
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,dataset:{},disabled:false,
  setAttribute(k,v){this[k]=v},appendChild(){},remove(){},focus(){},closest(){return null},querySelector(){return null},querySelectorAll(){return []}});
const nodes = { ray:node(), ana:node(), stil:node(), uygulama:node(), veri:node() };
const alerts=[];
const sandbox = { console, setTimeout, clearTimeout, Blob, URL, URLSearchParams,
  location:{search:'?dev=1'}, Date, Math, JSON, Intl,
  alert(x){alerts.push(String(x))}, confirm(){return true}, prompt(){return ''},
  fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}}, sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},
  navigator:{}, window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,body:{appendChild(){}},contains(){return true},
    addEventListener(type,fn){listeners[type]=fn},getElementById(id){return nodes[id]||null},
    querySelector(){return null},querySelectorAll(){return []},createElement(){return node()}}
};
sandbox.window.document=sandbox.document;
vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
run('ciz=()=>{}; kaydet=async()=>true; D=varsayilan(); D.rol="rehber"; D.ayar.testTarih="2026-09-07"; D.ogr=[{no:1,ad:"Ada",alan:"SAY",sube:"12-A",hedef:null}]; veriyiHazirla(D); EK.ogr=0; EK.hafta=null;');
const day = run("gunNo('2026-09-07')");
function button(n){ const b=node(); b.dataset.sonucNot=String(n); b.dataset.not=String(n); b.classList={_s:false,toggle(k,v){if(k==='secili')this._s=v},contains(){return this._s},remove(){this._s=false}}; b.setAttribute=(k,v)=>{b[k]=v}; return b; }
function row(ki, deferred=false, pending=false){
  const buttons=[1,2,3,4].map(button), numeric=node(), dogru=node(), soru=node(), r=node();
  r.dataset={ki:String(ki),gun:String(day),deferred:deferred?'1':'0',deferredPending:pending?'1':'0'}; numeric.hidden=true; dogru.value=''; soru.value='12';
  r.querySelectorAll=sel=>sel.includes('sonuc-not')||sel.includes('sonucNot')?buttons:[];
  r.querySelector=sel=>sel.includes('sonuc-not.secili')||sel.includes('.sonucNot.secili')?buttons.find(b=>b.classList._s)||null:sel.includes('sonuc-sayisal')?numeric:sel.includes('sonuc-dogru')?dogru:sel.includes('sonuc-soru')?soru:null;
  const target={disabled:false,closest(sel){return sel.includes('sonuc-not')?this:sel.includes('sonuc-row')?r:null}};
  return {r,buttons,numeric,dogru,soru,target};
}
async function click(target){ return listeners.click({target}); }
const checks=[]; const check=(name, ok, msg)=>checks.push({name,ok,error:ok?'':msg});
(async()=>{
  let a=row(0), b=row(1); nodes.sonucBilgiModal=node();
  // Use the actual rating button and point closest() at its row.
  a.buttons[3].closest=sel=>sel.includes('sonuc-not')?a.buttons[3]:sel.includes('sonuc-row')?a.r:null;
  await click(a.buttons[3]);
  check('rating-click-selects-only-clicked-row', a.buttons[3].classList._s && !a.buttons[0].classList._s, 'rating selection');
  b.buttons[1].closest=sel=>sel.includes('sonuc-not')?b.buttons[1]:sel.includes('sonuc-row')?b.r:null;
  await click(b.buttons[1]);
  check('second-rating-keeps-first-draft', a.buttons[3].classList._s && b.buttons[1].classList._s, 'draft lost while switching rows');
  b.numeric.closest=sel=>sel.includes('sonuc-sayisal-ac')?b.numeric:sel.includes('sonuc-row')?b.r:null;
  await click({disabled:false,closest:sel=>sel.includes('sonuc-sayisal-ac')?b.numeric:sel.includes('sonuc-row')?b.r:null});
  check('numeric-mode-switch-keeps-first-draft', a.buttons[3].classList._s && b.numeric.hidden===false, 'mode switch');
  const blank=row(1); nodes.sonucBilgiModal.hidden=true; sandbox.document.querySelectorAll=()=>[blank.r];
  const saveTarget={id:'sonucKaydet',dataset:{sonucOgr:'0',sonucHafta:String(day)},classList:{contains(){return false}},closest(sel){return sel.includes('#sonucKaydet')?this:null}};
  await click(saveTarget);
  check('blank-row-not-scored', run('D.log.length===0'), 'blank row was scored');
  sandbox.document.querySelectorAll=()=>[a.r];
  await click(saveTarget);
  check('rating-save-has-no-fake-score', run('D.log.length===1 && D.log[0][3]===null && D.log[0][4]===null && D.log[0][5]===4'), 'rating persistence');
  const failA=row(0), failB=row(1); sandbox.document.querySelectorAll=()=>[failA.r,failB.r];
  failA.buttons[1].closest=sel=>sel.includes('sonuc-not')?failA.buttons[1]:sel.includes('sonuc-row')?failA.r:null;
  await click(failA.buttons[1]);
  run('kaydet=async()=>false');
  await click(saveTarget);
  check('save-failure-preserves-other-drafts', failA.buttons[1].classList._s && !failB.buttons.some(b=>b.classList._s), 'drafts lost after failed save');
  run('kaydet=async()=>true');
  const mixedReport = run('D.log=[[' + day + ',0,0,6,12,3],[' + (day + 1) + ',0,1,null,null,4]]; gorunumRapor()');
  check('mixed-aggregate-ignores-rating-as-zero', mixedReport.includes('%50') && !mixedReport.includes('NaN') && !mixedReport.includes('%5000'), 'mixed aggregate formatting');
  const modal=node(), opener=node(); modal.focus=()=>{modal.focused=true}; opener.focus=()=>{opener.focused=true};
  nodes.sonucBilgiModal=modal; sandbox.document.getElementById=id=>id==='sonucBilgiModal'?modal:id==='sonucBilgiAc'?opener:null;
  await click({id:'sonucBilgiAc',dataset:{},classList:{contains(){return false}},closest(){return null}});
  check('modal-opens-and-focuses', modal.hidden===false && modal.focused===true, 'modal focus');
  run('D.ogr[0].sonucBilgiOkundu=false');
  await click({id:'sonucBilgiAnladim',dataset:{},classList:{contains(){return false}},closest(sel){return sel.includes('#sonucBilgiAnladim')?this:null}});
  check('modal-ack-persisted', run('D.ogr[0].sonucBilgiOkundu===true') && modal.hidden===true && opener.focused===true, 'acknowledgment');
  run('D.rol="ogrenci"; D.islenis[3]=' + (day - 3) + '; freezeCalls=0; savedHaftayiKullanimaAl=haftayiKullanimaAl; haftayiKullanimaAl=(...args)=>{freezeCalls++;return savedHaftayiKullanimaAl(...args)}');
  const freezeDeferred=row(3,true,true); freezeDeferred.r.dataset.slot='3'; sandbox.document.querySelectorAll=()=>[freezeDeferred.r];
  await click(saveTarget);
  check('new-deferred-row-freezes-issued-plan-before-shift', run('freezeCalls===1 && D.konuAnlatilmadi.length===1'), 'issued snapshot was not preserved');
  let deferred=row(2,true,false); sandbox.document.querySelectorAll=()=>[deferred.r]; sandbox.deferredCalls=0; run('konuAnlatilmadi=(si,ki,gun)=>{deferredCalls++;return {kaydirilan:0,ilkTekrarGunu:gun+7}}');
  await click(saveTarget);
  check('already-deferred-row-does-not-revalidate-or-add-result', run('D.log.length===2 && deferredCalls===0'), 'saved deferred row was reprocessed');
  const pendingDeferred=row(3,true,true); sandbox.document.querySelectorAll=()=>[pendingDeferred.r];
  await click(saveTarget);
  check('new-deferred-row-does-not-add-result', run('D.log.length===2 && deferredCalls===1'), 'new deferred row scored or ignored');
  const failed=checks.filter(x=>!x.ok); console.log(JSON.stringify({passed:checks.length-failed.length,total:checks.length,checks},null,2)); if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
