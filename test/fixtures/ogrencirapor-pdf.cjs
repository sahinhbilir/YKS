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
function grade9(){
 const p=[item('DENEME SINAVI TOPLU SONUÇ LİSTESİ',250,570),item('Okul:',10,555),item('SENTETİK OKUL',35,555),item('Sınav Adı:',300,555),item('TYT-901',345,555),item('Sınav Tarihi:',600,555),item('23.10.2026',660,555),item('NO/İsim',32,520),item('Snf',108,520)];
 const labels=['TÜR','TAR','COĞ','DİN KÜL','MAT','FİZ','KİM','BİY','Toplam'],xs=[163,244,325,406,487,568,649,730,782],dy=[[8,4],[4,0],[3,0],[2,0],[0,4],[4,0],[3,0],[2,0]];
 labels.forEach((s,i)=>{p.push(item(s,xs[i]-s.length*2,520),item('D/Y',xs[i]-6,502,12));});
 p.push(item('1',20,450),item('2001 / SENTETİK',32,454),item('ECE',32,446),item('102',105,454),item('9/A',105,446));let total=0;
 dy.forEach(([d,y],i)=>{const n=d-y/4;total+=n;p.push(item(n.toFixed(2),xs[i]-10,455,20),item(d+'/'+y,xs[i]-6,447,12));});p.push(item(total.toFixed(2),772,455,20));return {pages:[p],boylar:[595]};
}
module.exports={homework,attendance,grade9};
