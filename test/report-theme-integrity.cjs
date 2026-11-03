'use strict';
// CI validates scope and embedding; --compare-base=REV additionally audits a release baseline.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const norm=s=>s.replace(/\r\n/g,'\n'),current=norm(fs.readFileSync('index.html','utf8'));
const read=p=>norm(fs.readFileSync(p,'utf8')).trim();
const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i&&s.indexOf(a,i+1)<0,'missing or repeated '+a);return s.slice(i+a.length,j).trim()};
function onlyScreen(input,label){
 const css=input.replace(/\/\*[\s\S]*?\*\//g,'').trim();assert(/^@media\s+screen\b/i.test(css),label+' must start with @media screen');
 let depth=0,closed=-1,quoted=null,escaped=false;
 for(let i=0;i<css.length;i++){const c=css[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quoted)quoted=null;continue}if(c==='"'||c==="'"){quoted=c;continue}if(c==='{')depth++;if(c==='}'){depth--;assert(depth>=0,label+' unbalanced');if(depth===0){closed=i;break}}}
 assert(closed>=0&&depth===0&&!css.slice(closed+1).trim(),label+' must be wholly inside screen media');assert(!/@import\b/i.test(css),label+' must not load external CSS');
}
const theme=read('src/report-theme.css'),exam=read('src/denemeler.css'),examMarker='/* Personal board uses the same panel, controls and figures as the teacher board. */';
onlyScreen(theme,'report theme');const marker=exam.indexOf(examMarker);assert(marker>=0,'personal exam style marker missing');const screenStart=exam.lastIndexOf('@media screen',marker);assert(screenStart>=0,'personal board screen wrapper missing');onlyScreen(exam.slice(screenStart),'personal exam theme');
assert.equal(between(current,'/* BEGIN REPORT_THEME */','/* END REPORT_THEME */'),theme,'report CSS embed differs');
assert.equal(between(current,'/* BEGIN DENEMELER */','/* END DENEMELER */'),exam,'exam CSS embed differs');
assert.equal(between(current,'// BEGIN DENEMELER','// END DENEMELER'),read('src/denemeler.js'),'exam JS embed differs');
const arg=process.argv.slice(2).find(a=>a.startsWith('--compare-base='));
if(arg){
 const base=arg.slice('--compare-base='.length);assert(/^[\w.\/-]+$/.test(base),'invalid revision');const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024});
 const baseline=norm(git('show',base+':index.html'));
 function ignoreRenderer(s){const start=s.indexOf('function gorunumDenemeler()');if(start<0)return s;const end=s.indexOf('function denemeFormOku()',start);assert(end>start,'renderer boundary missing');return s.slice(0,start)+'/* permitted renderer */\n'+s.slice(end)}
 const scripts=s=>[...s.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].map(x=>x[0]);
 assert.deepEqual(scripts(current).map(ignoreRenderer),scripts(baseline).map(ignoreRenderer),'inline scripts changed outside approved renderer');
 const files=git('ls-tree','-r','--name-only',base,'src').trim().split('\n').filter(p=>p.endsWith('.js'));
 for(const file of files){const now=norm(fs.readFileSync(file,'utf8')),old=norm(git('show',base+':'+file));assert.equal(file==='src/denemeler.js'?ignoreRenderer(now):now,file==='src/denemeler.js'?ignoreRenderer(old):old,file+' changed outside approved renderer')}
 const style=s=>{const m=/<style id="stil">([\s\S]*?)<\/style>/i.exec(s);assert(m,'main style missing');return m[1]};
 const scrub=s=>s.replace(/\/\* BEGIN REPORT_THEME \*\/[\s\S]*?\/\* END REPORT_THEME \*\/\n?/,'').replace(/\/\* BEGIN DENEMELER \*\/[\s\S]*?\/\* END DENEMELER \*\//,'/* approved exam styles */');
 assert.equal(scrub(style(current)),scrub(style(baseline)),'original global, weekly or print styles changed');
 const oldExam=norm(git('show',base+':src/denemeler.css')).trimEnd();assert(exam.startsWith(oldExam),'original exam styles changed');onlyScreen(exam.slice(oldExam.length).trim(),'added exam CSS');
 console.log('PASS optional baseline audit against '+base);
}
console.log('PASS screen-only theme and exact embeds');
