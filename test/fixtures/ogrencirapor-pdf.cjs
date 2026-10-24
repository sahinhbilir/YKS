'use strict';
// Invented names and counts only. Geometry follows the school's text-based report tables.
const item=(s,x,y,w=String(s).length*4,z=8)=>({s:String(s),x,y,w,h:z,z});
function homework(){
 const p=[item('Öğrenci Ev Ödev Durum Raporu',250,530),item('Öğrenci Adı Soyadı',26,460),item(':',117,460),item('SENTETİK ADA',121,460),item('Şube / No.',26,445),item(':',117,445),item('301 12/A / 1001',121,445)];
 const cols=[235,325,415,505,595,685,775];['Toplam','Tamamladı','Eksik','Getirmedi','Geç Getirdi','Yapmadı','Gelmedi'].forEach((s,i)=>p.push(item(s,cols[i]-s.length*2,422)));
 function row(out,n,course,values,y){out.push(item(n,30,y));course.split('|').forEach((s,i)=>out.push(item(s,50,y+(course.includes('|')?(i? -5:5):0))));values.forEach((v,i)=>out.push(item(v,cols[i]-2,y,4)));}
 row(p,1,'MATEMATİK TYT',[5,3,1,0,0,0,0],400);row(p,2,'T.C. İNKILAP TARİHİ VE|ATATÜRKÇÜLÜK',[2,1,0,0,0,1,0],375);p.push(item('24 Eki 2026',700,25));
 const q=[];row(q,3,'KİMYA TYT',[4,2,0,0,0,1,1],500);q.push(item('24 Eki 2026',700,25));return {pages:[p,q],boylar:[595,595]};
}
function attendance(){
 const p=[item('301 12/A Yoklama Raporu',220,780)];for(let i=0;i<8;i++)p.push(item((i+1)+'. Ders',176+45*i,730,32));
 p.push(item('SENTETİK',34,660),item('ADA',34,650));
 const rows=[['20/10/2026',['Geldi','Gelmedi','Gelmedi','Geldi','Geldi','Geldi','','']],['21/10/2026',['Gelmedi','Gelmedi','Mazeretli','Geldi','Geldi','Geldi','','']],['22/10/2026',['Gelmedi','Gelmedi','Gelmedi','Gelmedi','','','','']]];
 rows.forEach(([d,status],j)=>{const y=710-j*50;p.push(item(d,114,y,46));status.forEach((s,i)=>{if(s)p.push(item(s,192+45*i-s.length*2,y));})});
 const q=[item('1. Ders',176,730,32),...Array.from({length:7},(_,i)=>item((i+2)+'. Ders',221+45*i,730,32)),item('SENTETİK ADA',34,700),item('23/10/2026',114,700,46)];
 ['Gecikti','Geldi','','','','','',''].forEach((s,i)=>{if(s)q.push(item(s,192+i*45-s.length*2,700));});return {pages:[p,q],boylar:[842,842]};
}
module.exports={homework,attendance};
