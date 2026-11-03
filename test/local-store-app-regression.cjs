'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const prefix=fs.readFileSync('test/cloud-sync-resilience.js','utf8').split('// ---------------------------------------------------------------- test koşucusu')[0].replace(/^#![^\n]*\n/,'');
const load=new Function('require','process',prefix+'\nreturn loadAppSandbox;')(require,{argv:['node','test','index.html']});
(async()=>{
 const a=load(),{run,sandbox}=a;run("D=varsayilan();D.rol='rehber';D.ogr=[{ad:'Original',no:1,sube:'12-A',alan:'SAY'}];EK.ogr=0;EK.sekme='ayarlar';");
 await run('LOCAL_STORE.ready()');assert.equal(run('LOCAL_STORE.mode()'),'localStorage');
 const prior=run('JSON.stringify(D)'),input=JSON.parse(prior);input.ogr[0].ad='Imported';sandbox.input=JSON.stringify(input);
 sandbox.localStorage.setItem=()=>{throw Error('quota')};assert.equal(await run('metindenYukle(input)'),null);assert.equal(run('JSON.stringify(D)'),prior);assert.equal(run('EK.sekme'),'ayarlar');
 const stored={};sandbox.localStorage.setItem=(k,v)=>{stored[k]=v};sandbox.localStorage.getItem=k=>stored[k]??null;
 assert.match(await run('metindenYukle(input)'),/Yedek yüklendi/);assert.equal(run('D.ogr[0].ad'),'Imported');assert.equal(JSON.parse(stored.yks_veri).ogr[0].ad,'Imported');
 console.log('PASS no-IDB restore failure rollback and successful durable import');
})().catch(e=>{console.error(e);process.exitCode=1});
