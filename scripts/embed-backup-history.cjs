const fs=require('node:fs'),lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'),eol=original.includes('\r\n')?'\r\n':'\n';let html=lf(original);
const open='// BEGIN BACKUP_HISTORY',close='// END BACKUP_HISTORY',anchor='// ---------------------------------------------------------------- başlangıç';
const block=open+'\n'+lf(fs.readFileSync('src/backup-history.js','utf8')).trim()+'\n'+close+'\n';
if(html.includes(open))html=html.slice(0,html.indexOf(open))+block+html.slice(html.indexOf(close)+close.length+1);
else {if(!html.includes(anchor))throw Error('Missing embedding anchor');html=html.replace(anchor,block+'\n'+anchor);}
if(process.argv.includes('--check')){if(html!==lf(original))throw Error('Run node scripts/embed-backup-history.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
