// Embedded in index.html by scripts/embed-grafik.cjs, ahead of Etütler and the Deneme panosu: what
// their charts share.
//
// GRAFIK_CIZGI draws the chart lines, köşeli (straight between the points) or yumuşak (a monotone
// curve through the same points, which never overshoots them: counts stay at or above 0 and the 50%
// band stays in order). The choice is the viewer's, kept on the device; köşeli is the default.
const GRAFIK_CIZGI = (() => {
const ANAHTAR='yks_grafik_cizgi', r1=x=>Math.round(x*10)/10, n=p=>r1(p[0])+','+r1(p[1]);
let TUR=null;
function tur(){if(TUR===null){try{TUR=localStorage.getItem(ANAHTAR)==='yumusak'?'yumusak':'kose'}catch(e){TUR='kose'}}return TUR}
function sec(t){TUR=t==='yumusak'?'yumusak':'kose';try{localStorage.setItem(ANAHTAR,TUR)}catch(e){/* kept for this visit only */}}
// One run whose x only grows (or only shrinks): Steffen's tangents, then a cubic per segment.
function egri(p){
  const k=p.length;if(k<3)return p.slice(1).map(q=>'L'+n(q)).join('');
  const h=i=>p[i+1][0]-p[i][0],e=i=>(p[i+1][1]-p[i][1])/h(i),t=[];
  for(let i=1;i<k-1;i++){const a=e(i-1),b=e(i),o=(a*h(i)+b*h(i-1))/(h(i-1)+h(i));t[i]=(Math.sign(a)+Math.sign(b))*Math.min(Math.abs(a),Math.abs(b),.5*Math.abs(o))||0}
  t[0]=(3*e(0)-t[1])/2;t[k-1]=(3*e(k-2)-t[k-2])/2;
  let out='';for(let i=0;i<k-1;i++){const d=h(i)/3;out+='C'+r1(p[i][0]+d)+','+r1(p[i][1]+t[i]*d)+','+r1(p[i+1][0]-d)+','+r1(p[i+1][1]-t[i+1]*d)+','+n(p[i+1])}
  return out;
}
// An SVG path through pts ([x, y, …]). A vertical step or a turn back (the 50% band's far side)
// starts a new run, joined straight.
function yol(pts){
  if(!pts.length)return '';
  if(tur()!=='yumusak'||pts.length<3)return 'M'+pts.map(n).join('L');
  let out='M'+n(pts[0]),run=[pts[0]];
  for(let i=1;i<pts.length;i++){
    const p=pts[i],q=run[run.length-1],y=Math.sign(p[0]-q[0]);
    if(y===0){out+=egri(run)+'L'+n(p);run=[p];continue}
    if(run.length>1&&y!==Math.sign(run[1][0]-run[0][0])){out+=egri(run);run=[q]}
    run.push(p);
  }
  return out+egri(run);
}
const SECENEKLER=[['kose','Köşeli'],['yumusak','Yumuşak']];
return {tur,sec,yol,SECENEKLER};
})();

// GRAFIK_OLCUM: measuring on the charts, as on Google Finance: press on a chart and drag. Two markers
// snap to data points, the range between them is shaded, the rest fades, and a readout at the top gives
// the change from the earlier point to the later one. Meanwhile every other chart and mini graph on the
// page shades the same dates, and a card's mini graph shows its own change. It is only for looking: on
// release (or Esc) everything returns to normal and nothing is saved. A press that moves less than
// 4 px stays a click; on a touch screen measuring starts after a 300 ms hold so the page still scrolls.
// The Seç handles ([data-tutamak]) keep their own dragging.
const GRAFIK_OLCUM = (() => {
const ESIK=4, BEKLE=300, KAYMA=8;
// One entry per page (src/etutler.js, src/denemepano.js), see kur().
const sayfalar=[];
let O=null, BEKLEYEN=null, YUT=0, ESC=false;

// a = {secici, kok, etkin(), bilgi(kutu), yakin(kutu,clientX), ipucuGizle(kutu), hap(v,yazi), fmt(v)}.
// bilgi(kutu) describes one drawn chart, or null when it has nothing to measure: {xs, deger, ys,
// donem, uzunluk, birim, fmt, etiket(i), ad, renk}. xs are the points' x in the SVG's own units, deger the
// measured values (null = no point), ys their y for the dots (or null), donem each point's period
// start and uzunluk how many of those a point covers (days: 7 for a week, 1 for a day; exams: 1);
// ad names the measured line and renk colours its dots (both optional).
// Mini graphs carry the same as data-olc-donem, data-olc-uzunluk and data-olc-v.
function kur(a){sayfalar.push(a)}
const r1=x=>Math.round(x*10)/10;
const var_=v=>v!==null&&v!==undefined;
const isaretli=(v,fmt)=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v));
const yuzde=p=>(p>0?'+':p<0?'−':'')+'%'+Math.abs(p).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
// The nearest point that has a value.
function yer(b,i){
  if(i<0||!b.xs.length)return -1;i=Math.min(i,b.xs.length-1);if(var_(b.deger[i]))return i;
  for(let d=1;d<b.xs.length;d++){if(i-d>=0&&var_(b.deger[i-d]))return i-d;if(i+d<b.xs.length&&var_(b.deger[i+d]))return i+d}
  return -1;
}
// The plot's top and bottom are the hover rule's (.et-kural); left and right half a step past the ends.
function sinir(svg,xs){
  const k=svg.querySelector('.et-kural'),vb=svg.viewBox.baseVal,adim=xs.length>1?xs[1]-xs[0]:vb.width/2;
  return {ust:k?Number(k.getAttribute('y1')):0,alt:k?Number(k.getAttribute('y2')):vb.height,L:Math.max(0,xs[0]-adim/2),R:xs[xs.length-1]+adim/2,adim};
}
// Shading between xa and xb, the plot outside it faded. Drawn last, so it lies over the lines.
function ortu(svg,xa,xb,L,R,ust,alt,sinif){
  let g=svg.querySelector(':scope > g.olc-ortu');if(!g){g=document.createElementNS('http://www.w3.org/2000/svg','g');svg.appendChild(g)}
  g.setAttribute('class','olc-ortu'+(sinif?' '+sinif:''));
  const r=(c,a,b)=>b-a>0?'<rect class="'+c+'" x="'+r1(a)+'" y="'+r1(ust)+'" width="'+r1(b-a)+'" height="'+r1(alt-ust)+'"/>':'';
  g.innerHTML=r('olc-solgun',L,xa)+r('olc-alan',xa,xb)+r('olc-solgun',xb,R);
  return g;
}
// The indices of a chart whose periods meet bas … bit.
function aralik(donem,uzunluk,bas,bit){
  let a=-1,b=-1;donem.forEach((p,i)=>{if(p<=bit&&p+uzunluk-1>=bas){if(a<0)a=i;b=i}});return a<0?null:[a,b];
}
function temizle(kok){
  if(!kok)return;
  kok.querySelectorAll('g.olc-ortu,.olc-yazi,.olc-mini').forEach(e=>e.remove());
  kok.querySelectorAll('.olcuyor').forEach(e=>e.classList.remove('olcuyor'));
}
function ciz(){
  const {kutu,a,b,i0,i1}=O,svg=kutu.querySelector('svg');if(!svg)return;
  // Earlier to later, whichever way the pointer went. The range is tinted by the change's direction.
  const [p,q]=i0<=i1?[i0,i1]:[i1,i0],va=b.deger[p],vb=b.deger[q],d=vb-va,s=sinir(svg,b.xs);
  // One point is only its marker; the plot fades once there is a range.
  const g=p===q?ortu(svg,s.L,s.L,s.L,s.L,s.ust,s.alt,'olc-ana'):ortu(svg,b.xs[p],b.xs[q],s.L,s.R,s.ust,s.alt,'olc-ana '+(d>0?'yukari':d<0?'asagi':'esit'));
  for(const i of i0===i1?[i0]:[i0,i1]){
    g.insertAdjacentHTML('beforeend','<line class="olc-cizgi" x1="'+r1(b.xs[i])+'" x2="'+r1(b.xs[i])+'" y1="'+r1(s.ust)+'" y2="'+r1(s.alt)+'"/>'+
      (b.ys&&var_(b.ys[i])?'<circle class="olc-nokta" cx="'+r1(b.xs[i])+'" cy="'+r1(b.ys[i])+'" r="4.5"'+(b.renk?' style="fill:'+b.renk+'"':'')+'/>':''));
  }
  if(!O.suruklendi)return;
  // A start of 0 has no percentage; a negative one (a net below zero) is measured from its size.
  let el=kutu.querySelector(':scope > .olc-yazi');if(!el){el=document.createElement('div');el.className='olc-yazi';el.setAttribute('role','status');kutu.appendChild(el)}
  el.innerHTML=(b.ad?'<span class="olc-ad">'+kacis(b.ad)+'</span> · ':'')+kacis(b.etiket(p))+(p===q?'':' → '+kacis(b.etiket(q)))+' · <b>'+kacis(b.fmt(va))+(p===q?'':' → '+kacis(b.fmt(vb)))+'</b> '+kacis(b.birim)+
    (p===q?'':' '+a.hap(d,isaretli(d,b.fmt)+(va?' ('+yuzde(d/Math.abs(va)*100)+')':'')));
  ayna(b.donem[p],b.donem[q]+b.uzunluk-1);
}
// The same dates on every other chart and mini graph of the page; a card's mini graph adds its change.
function ayna(bas,bit){
  const {kutu,a}=O,kok=kutu.closest(a.kok);if(!kok)return;
  kok.querySelectorAll(a.secici).forEach(k=>{
    if(k===kutu)return;const b=a.bilgi(k),svg=k.querySelector('svg');if(!b||!b.xs.length||!svg)return;
    const ar=aralik(b.donem,b.uzunluk,bas,bit),s=sinir(svg,b.xs);
    if(!ar){ortu(svg,s.L,s.L,s.L,s.R,s.ust,s.alt);return}
    const [p,q]=ar;ortu(svg,p===q?b.xs[p]-s.adim/4:b.xs[p],p===q?b.xs[p]+s.adim/4:b.xs[q],s.L,s.R,s.ust,s.alt);
  });
  kok.querySelectorAll('svg[data-olc-donem]').forEach(svg=>{
    const donem=svg.dataset.olcDonem.split(',').map(Number),n=donem.length,vb=svg.viewBox.baseVal,G=vb.width,Y=vb.height;
    const x=i=>2+(G-6)*(n>1?i/(n-1):.5),ar=aralik(donem,Number(svg.dataset.olcUzunluk)||1,bas,bit),h=n>1?(G-6)/(n-1)/2:G/2;
    if(ar)ortu(svg,x(ar[0])-(ar[0]===ar[1]?h:0),x(ar[1])+(ar[0]===ar[1]?h:0),0,G,0,Y);else ortu(svg,0,0,0,G,0,Y);
    // A card's mini graph (in .et-kucuk-kutu) also shows its change over the range.
    const kutucuk=svg.parentNode;if(!svg.dataset.olcV||!kutucuk||!kutucuk.classList||!kutucuk.classList.contains('et-kucuk-kutu'))return;
    const ic=ar?svg.dataset.olcV.split(',').slice(ar[0],ar[1]+1).map(t=>t===''?null:Number(t)).filter(var_):[];
    let el=kutucuk.querySelector(':scope > .olc-mini');
    if(ic.length<2){if(el)el.remove();return}
    if(!el){el=document.createElement('span');el.className='olc-mini';kutucuk.appendChild(el)}
    const d=ic[ic.length-1]-ic[0];el.innerHTML=a.hap(d,isaretli(d,a.fmt));
  });
}
function basla(kutu,a,clientX,id,dokunma){
  const b=a.bilgi(kutu);if(!b||!b.xs.length)return;
  const i=yer(b,a.yakin(kutu,clientX));if(i<0)return;
  O={kutu,a,b,i0:i,i1:i,x0:clientX,id,suruklendi:false,dokunma};
  if(dokunma)surukle();
  ciz();
}
// From here on it is a measurement: the tooltip goes (a highlighted line stays), the pointer stays with the chart.
function surukle(){
  O.suruklendi=true;O.a.ipucuGizle(O.kutu);O.kutu.classList.add('olcuyor');
  try{if(O.id!==undefined)O.kutu.setPointerCapture(O.id)}catch(e){/* the pointer is already gone */}
}
function bitir(){
  if(BEKLEYEN){clearTimeout(BEKLEYEN.t);BEKLEYEN=null}
  if(!O)return;const {kutu,a}=O;temizle(kutu.closest(a.kok)||kutu);O=null;
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('pointerdown',ev=>{
    YUT=0;ESC=false;
    if(O||ev.button>0||!ev.isPrimary)return;
    const t=ev.target;if(!t.closest||t.closest('[data-tutamak]'))return;
    for(const a of sayfalar){
      if(!a.etkin())continue;const kutu=t.closest(a.secici);if(!kutu)continue;
      if(ev.pointerType==='touch'){
        const x=ev.clientX,y=ev.clientY,id=ev.pointerId;
        BEKLEYEN={x,y,t:setTimeout(()=>{BEKLEYEN=null;if(kutu.isConnected)basla(kutu,a,x,id,true)},BEKLE)};
      }else basla(kutu,a,ev.clientX,ev.pointerId,false);
      return;
    }
  });
  document.addEventListener('pointermove',ev=>{
    if(BEKLEYEN&&Math.hypot(ev.clientX-BEKLEYEN.x,ev.clientY-BEKLEYEN.y)>KAYMA){clearTimeout(BEKLEYEN.t);BEKLEYEN=null}
    if(!O||ev.pointerId!==O.id)return;
    if(!O.suruklendi){if(Math.abs(ev.clientX-O.x0)<ESIK)return;surukle()}
    const i=yer(O.b,O.a.yakin(O.kutu,ev.clientX));if(i<0||i===O.i1&&O.kutu.querySelector(':scope > .olc-yazi'))return;
    O.i1=i;ciz();
  });
  document.addEventListener('pointerup',()=>{
    if(BEKLEYEN){clearTimeout(BEKLEYEN.t);BEKLEYEN=null}
    if(ESC||O&&O.suruklendi)YUT=Date.now()+600;ESC=false;bitir();
  });
  document.addEventListener('pointercancel',bitir);
  // The click that ends a drag is not a click on the chart.
  document.addEventListener('click',ev=>{if(YUT&&Date.now()<YUT){YUT=0;ev.stopPropagation();ev.preventDefault()}},true);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&(O||BEKLEYEN)){ESC=!!O;bitir()}},true);
  // While a touch measures, the page does not scroll and no context menu opens.
  document.addEventListener('touchmove',ev=>{if(O&&O.dokunma&&ev.cancelable)ev.preventDefault()},{passive:false});
  document.addEventListener('contextmenu',ev=>{if(O||BEKLEYEN)ev.preventDefault()});
}
// True while a range is being dragged: the pages leave their hover readouts alone.
const olcuyor=()=>!!(O&&O.suruklendi);
return {kur,olcuyor,iptal:bitir,aralik,yer,get durum(){return O?{i0:O.i0,i1:O.i1,suruklendi:O.suruklendi}:null}};
})();
