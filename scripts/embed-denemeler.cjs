const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
for(const [name,open,close,anchor] of [
 ['js','// BEGIN DENEMELER','// END DENEMELER','// ---------------------------------------------------------------- başlangıç'],
 ['css','/* BEGIN DENEMELER */','/* END DENEMELER */','</style>']
]) {
 const source=fs.readFileSync('src/denemeler.'+name,'utf8').trim();
 const block=open+'\n'+source+'\n'+close+'\n';
 if(html.includes(open)) html=html.slice(0,html.indexOf(open))+block+html.slice(html.indexOf(close)+close.length+1);
 else {if(!html.includes(anchor))throw new Error('Missing embedding anchor');html=html.replace(anchor,block+'\n'+anchor);}
}
if(process.argv.includes('--check')) {if(html!==fs.readFileSync('index.html','utf8'))throw new Error('Run node scripts/embed-denemeler.cjs');}
else fs.writeFileSync('index.html',html);
