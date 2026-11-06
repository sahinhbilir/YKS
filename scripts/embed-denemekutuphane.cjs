const fs=require('node:fs');
// Embeds src/denemekutuphane.js (the device-only exam library of the Yanlışlar defteri) into index.html, the same way as
// embed-yanlislar.cjs. Work on LF text so Windows checkouts embed and check the same bytes
// as CI; the file keeps its own line endings when written back. --check only verifies.
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'), eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);
for(const [file,open,close,anchor] of [
 ['denemekutuphane.js','// BEGIN DENEMEKUTUPHANE','// END DENEMEKUTUPHANE','// ---------------------------------------------------------------- başlangıç']
]) {
 const source=lf(fs.readFileSync('src/'+file,'utf8')).trim();
 const block=open+'\n'+source+'\n'+close+'\n';
 if(html.includes(open)) html=html.slice(0,html.indexOf(open))+block+html.slice(html.indexOf(close)+close.length+1);
 else {if(!html.includes(anchor))throw new Error('Missing embedding anchor');html=html.replace(anchor,()=>block+'\n'+anchor);}
}
if(process.argv.includes('--check')) {if(html!==lf(original))throw new Error('Run node scripts/embed-denemekutuphane.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
