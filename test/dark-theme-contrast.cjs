#!/usr/bin/env node
'use strict';
// Dark theme: neutral surfaces (no hue), both token blocks identical, WCAG AA for the text pairs, KPI numbers in the
// text colour. Reads src/report-theme.css and the copy embedded in index.html. Prints the ratios.
const fs=require('node:fs'),assert=require('node:assert/strict');
const css=fs.readFileSync('src/report-theme.css','utf8').replace(/\r\n/g,'\n'),html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
const tokens=body=>Object.fromEntries([...body.matchAll(/(--[\w-]+):([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
function blocks(src){
  const light=/:root \{([^}]*)\}/.exec(src)[1];
  const media=/@media \(prefers-color-scheme:dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/.exec(src)[1];
  const attr=/:root\[data-theme="dark"\] \{([^}]*)\}/.exec(src)[1];
  return {light:tokens(light),media:tokens(media),attr:tokens(attr)};
}
const B=blocks(css);
assert.deepEqual(B.media,B.attr,'the prefers-color-scheme and [data-theme="dark"] token blocks are identical');
const E=blocks(html.slice(html.indexOf('/* BEGIN REPORT_THEME */')));
assert.deepEqual(E.attr,B.attr,'the embedded copy matches');
const dark=B.attr,light={...B.light};
const rgb=h=>{assert(/^#[0-9a-f]{6}$/i.test(h),'hex '+h);return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16))};
const lum=h=>{const c=rgb(h).map(v=>v/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>p-q);return (y+.05)/(x+.05)};
// 1. Surfaces and lines carry no hue.
for(const k of ['--zemin','--kagit','--kagit-yuksek','--cizgi','--vurgu-yumusak','--marka-acik','--secili-zemin','--murekkep','--soluk','--alan-cizgi','--rapport-grid','--rapport-axis','--rapport-muted-chart','--rapport-heat-ink']){
  const [r,g,b]=rgb(dark[k]);assert(Math.abs(r-g)<=3&&Math.abs(g-b)<=3,k+' '+dark[k]+' is tinted');
}
// 2. AA for text pairs (4.5), and 3 for non-text borders of controls.
const pairs=[];
for(const [name,t] of [['dark',dark],['light',light]]){
  const bg=['--zemin','--kagit','--kagit-yuksek','--vurgu-yumusak'];
  for(const f of ['--murekkep','--soluk','--vurgu','--vurgu-koyu','--iyi','--uyari','--kritik','--rapport-blue','--rapport-orange','--rapport-purple','--rapport-pink','--rapport-green','--rapport-red'])
    for(const b of bg){const fg=t[f],bk=t[b];if(!fg||!bk)continue;
      // light: the secondary surfaces only hold ink and accent text
      if(name==='light'&&['--rapport-blue','--rapport-orange','--rapport-purple','--rapport-pink','--rapport-green','--rapport-red'].includes(f))continue;
      pairs.push([name,f,b,ratio(fg,bk),4.5]);}
  pairs.push([name,'--vurgu-uzeri','--vurgu',ratio(t['--vurgu-uzeri']||t['--kagit'],t['--vurgu']),4.5]);
  pairs.push([name,'--secili-yazi','--secili-zemin',ratio(t['--secili-yazi'],t['--secili-zemin']),4.5]);
  pairs.push([name,'--alan-cizgi','--kagit (border)',ratio(t['--alan-cizgi'],t['--kagit']),3]);
}
const fails=pairs.filter(p=>p[3]<p[4]);
if(process.env.VERBOSE)for(const p of pairs)console.log(p[0].padEnd(5),p[1].padEnd(22),p[2].padEnd(16),p[3].toFixed(2));
assert.deepEqual(fails.map(p=>p.slice(0,4).join(' ')),[],'contrast below the minimum');
console.log('PASS dark tokens are neutral and %d text pairs meet AA (min %s)',pairs.length,Math.min(...pairs.map(p=>p[3])).toFixed(2));
// 3. KPI numbers wear the text colour, not the accent.
for(const sel of ['.et-ozet-kart strong','.kutu .sayi','.dn-detay-bas strong'])
  assert(new RegExp(sel.replace(/[.]/g,'\\.')+'\\s*\\{[^}]*color:var\\(--murekkep\\)').test(css),sel+' uses --murekkep');
assert(!/\.dn-stats strong\s*\{[^}]*--vurgu/.test(css));
console.log('PASS KPI numbers use the text colour');
// 4. No teal-tinted dark literals are left in the screen sources.
for(const f of fs.readdirSync('src').filter(f=>f.endsWith('.css'))){const t=fs.readFileSync('src/'+f,'utf8');
  for(const bad of ['#101e20','#1a2d30','#213f3b','#344c4b','#304744','#607e75','#76938a','#afc3bd','#e8f1ed'])assert(!t.toLowerCase().includes(bad),f+' still has '+bad);}
console.log('PASS no teal-tinted dark literals in src/*.css');
