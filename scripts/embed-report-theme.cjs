const fs=require('node:fs');
// Last screen-only layer: leave the old print cascade and report SVG untouched.
const lf=s=>s.replace(/\r\n/g,'\n');
const original=fs.readFileSync('index.html','utf8'),eol=original.includes('\r\n')?'\r\n':'\n';
let html=lf(original);
const open='/* BEGIN REPORT_THEME */',close='/* END REPORT_THEME */';
const source=lf(fs.readFileSync('src/report-theme.css','utf8')).trim();
const block=open+'\n'+source+'\n'+close+'\n';
if(html.includes(open)){const a=html.indexOf(open),z=html.indexOf(close,a);if(z<0)throw new Error('Missing end marker: '+close);html=html.slice(0,a)+html.slice(z+close.length+1);}
const anchor=html.indexOf('</style>');
if(anchor<0)throw new Error('Missing main style embedding anchor');
html=html.slice(0,anchor)+block+html.slice(anchor);
if(process.argv.includes('--check')){if(html!==lf(original))throw new Error('Run node scripts/embed-report-theme.cjs');}
else fs.writeFileSync('index.html',eol==='\n'?html:html.replace(/\n/g,eol));
