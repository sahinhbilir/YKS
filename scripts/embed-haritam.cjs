const fs=require('node:fs');
// Embeds the connected-memory map into index.html: data/hafiza-haritasi-tam.json (HARITA_VERI), src/hafiza-ag.js
// (HAFIZA_AG) and src/haritam.js (HARITAM) as one script block, and src/haritam.css, the same way as
// embed-yokatlas.cjs. Work on LF text so Windows checkouts embed and check the same bytes as CI; the file keeps its own
// line endings when written back. --check only verifies.
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'), eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);
const HARITA='data/hafiza-haritasi-tam.json', veri=JSON.stringify(JSON.parse(fs.readFileSync(HARITA,'utf8')));
const js='// '+HARITA+'\nconst HARITA_VERI = '+veri+';\n'+lf(fs.readFileSync('src/hafiza-ag.js','utf8')).trim()+'\n'+lf(fs.readFileSync('src/haritam.js','utf8')).trim();
for(const [source,open,close,anchor] of [
 [js,'// BEGIN HARITAM','// END HARITAM','// ---------------------------------------------------------------- başlangıç'],
 // the report theme must stay the last style layer (scripts/embed-report-theme.cjs), so new CSS goes before it
 [lf(fs.readFileSync('src/haritam.css','utf8')).trim(),'/* BEGIN HARITAM */','/* END HARITAM */',html.includes('/* BEGIN REPORT_THEME */')?'/* BEGIN REPORT_THEME */':'</style>']
]) {
 const block=open+'\n'+source+'\n'+close+'\n';
 if(html.includes(open)) {const a=html.indexOf(open),z=html.indexOf(close,a);if(z<0)throw new Error('Missing end marker: '+close);html=html.slice(0,a)+block+html.slice(z+close.length+1);}
 else {if(!html.includes(anchor))throw new Error('Missing embedding anchor');html=html.replace(anchor,()=>block+'\n'+anchor);}
}
if(process.argv.includes('--check')) {if(html!==lf(original))throw new Error('Run node scripts/embed-haritam.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
