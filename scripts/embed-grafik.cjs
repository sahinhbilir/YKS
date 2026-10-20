const fs=require('node:fs');
// Embeds src/grafik.js and src/grafik.css into index.html, the same way as embed-etutplani.cjs. The
// script goes before Etütler, whose charts (and the Deneme panosu's) use it as they load. Work on LF
// text so Windows checkouts embed and check the same bytes as CI; the file keeps its own line endings
// when written back. --check only verifies.
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'), eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);
for(const [name,open,close,anchor] of [
 ['js','// BEGIN GRAFIK','// END GRAFIK','// BEGIN ETUTLER'],
 ['css','/* BEGIN GRAFIK */','/* END GRAFIK */','</style>']
]) {
 const source=lf(fs.readFileSync('src/grafik.'+name,'utf8')).trim();
 const block=open+'\n'+source+'\n'+close+'\n';
 if(html.includes(open)) html=html.slice(0,html.indexOf(open))+block+html.slice(html.indexOf(close)+close.length+1);
 else {if(!html.includes(anchor))throw new Error('Missing embedding anchor');html=html.replace(anchor,block+'\n'+anchor);}
}
if(process.argv.includes('--check')) {if(html!==lf(original))throw new Error('Run node scripts/embed-grafik.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
