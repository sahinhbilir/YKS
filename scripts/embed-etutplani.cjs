const fs=require('node:fs');
// Embeds src/etutplani.js and src/etutplani.css into index.html, the same way as
// embed-siralamalar.cjs. Work on LF text so Windows checkouts embed and check the same bytes
// as CI; the file keeps its own line endings when written back. --check only verifies.
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'), eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);
for(const [name,open,close,anchor] of [
 ['js','// BEGIN ETUTPLANI','// END ETUTPLANI','// ---------------------------------------------------------------- başlangıç'],
 ['css','/* BEGIN ETUTPLANI */','/* END ETUTPLANI */','</style>']
]) {
 const source=lf(fs.readFileSync('src/etutplani.'+name,'utf8')).trim();
 const block=open+'\n'+source+'\n'+close+'\n';
 if(html.includes(open)) html=html.slice(0,html.indexOf(open))+block+html.slice(html.indexOf(close)+close.length+1);
 else {if(!html.includes(anchor))throw new Error('Missing embedding anchor');html=html.replace(anchor,block+'\n'+anchor);}
}
if(process.argv.includes('--check')) {if(html!==lf(original))throw new Error('Run node scripts/embed-etutplani.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
