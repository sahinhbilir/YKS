'use strict';
// A fresh synthetic origin only. No site storage or account data is accessed.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.YKS_CHROMIUM,args:['--no-sandbox']});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic capacity test</title>'}));
  await page.goto('http://synthetic-capacity.local/');
  const result=await page.evaluate(()=>{
   const raw=JSON.stringify({synthetic:'a'.repeat(2499900)}),rows=[];
   for(let n=1;n<=5;n++)try{localStorage.setItem('synthetic-snapshot-'+n,raw);rows.push({copy:n,ok:true})}catch(e){rows.push({copy:n,ok:false,error:e.name});break}
   return {origin:location.origin,snapshotUtf8Bytes:new TextEncoder().encode(raw).length,snapshotCharacters:raw.length,rows,firstSnapshotPreserved:localStorage.getItem('synthetic-snapshot-1')===raw};
  });
  assert(result.rows[0].ok);assert(result.firstSnapshotPreserved);assert(result.rows.some(x=>!x.ok));
  const si=process.argv.indexOf('--snapshot');
  if(si>=0){
   const json=fs.readFileSync(process.argv[si+1],'utf8'),appHtml=fs.readFileSync('index.html','utf8').replace(/<script type="module">[\s\S]*?<\/script>/,'');
   const appContext=await browser.newContext(),appPage=await appContext.newPage();
   await appPage.route('**/*',r=>r.request().url()==='http://synthetic-capacity.local/app'?r.fulfill({contentType:'text/html',body:appHtml}):r.abort());
   await appPage.goto('http://synthetic-capacity.local/app');await appPage.locator('#rolRehber').waitFor();
   result.projectedYear=await appPage.evaluate(async json=>{
    D=JSON.parse(json);yedekDogrula(D);const encoded=await bulutVeriKodla(json),decoded=await bulutVeriCoz(encoded),rows=[];
    for(const key of ['yks_veri','synthetic-before-import','synthetic-before-restore'])try{localStorage.setItem(key,json);rows.push({key,ok:true})}catch(e){rows.push({key,ok:false,error:e.name})}
    return {rawBytes:new TextEncoder().encode(json).length,storedBytes:new TextEncoder().encode(encoded).length,codecRoundTrip:decoded===json,rows};
   },json);
   assert(result.projectedYear.codecRoundTrip);assert(result.projectedYear.rows[0].ok);await appContext.close();
  }
  const oi=process.argv.indexOf('--out');if(oi>=0)fs.writeFileSync(process.argv[oi+1],JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
