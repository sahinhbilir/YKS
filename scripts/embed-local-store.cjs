const fs=require('node:fs');
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'),eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);const open='// BEGIN LOCAL_STORE',close='// END LOCAL_STORE',anchor='// ---------------------------------------------------------------- başlangıç';
const block=open+'\n'+lf(fs.readFileSync('src/local-store.js','utf8')).trim()+'\n'+close+'\n';
if(html.includes(open)){const a=html.indexOf(open),z=html.indexOf(close,a);if(z<0)throw new Error('Missing end marker: '+close);html=html.slice(0,a)+block+html.slice(z+close.length+1);}
else {if(!html.includes(anchor))throw Error('Missing embedding anchor');html=html.replace(anchor,()=>block+'\n'+anchor);}
if(process.argv.includes('--check')){if(html!==lf(original))throw Error('Run node scripts/embed-local-store.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
