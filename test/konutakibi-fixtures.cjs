// Synthetic only. Geometry follows the supported publisher report, no school data.
const student={name:'SENTETİK ÖĞRENCİ',no:'9001',cls:'205 12/A'};
const row=(code,name,c)=>({code,name,c});
const block=(rows,kind='outcome',course='TÜRKÇE-T',s=student)=>({student:{...s},course,kind,rows});
const reports=[
 {ad:'SENTETİK-1',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[4,2,1,1]),row('T.12.3.1','Cümlenin anlamını yorumlar.',[5,5,0,0])])]},
 {ad:'SENTETİK-2',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[2,2,0,0]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[4,4,0,0])])]},
 {ad:'SENTETİK-3',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[10,0,6,4]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[3,3,0,0])])]},
 {ad:'SENTETİK-4',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[6,6,0,0]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[4,4,0,0])])]},
];
function pages({topic=false,continuation=false,corrupt=false,code='T.12.1.1'}={}){
 const item=(s,x,y,w=String(s).length*4,z=9)=>({s:String(s),x,y,w,z,h:z});
 const metadata=[item(topic?'KAZANIM KARNESİ-KONU':'KAZANIM KARNESİ',230,819),item('Ad Soyad',163,802,47.5),item(student.name,213,802,95),item('No',314,802,13.7),item(student.no,333,802,23),item('Kitapçık',363,802),item('Sınav Adı',163,788,47.5),item('SENTETİK-1',213,788),item('Sınıf',317,788,23),item(student.cls,348,788),item('Kademe',438,788)];
 const header=[item('TÜRKÇE-T',19,754),...['Toplam','Doğru','Yanlış','Boş'].map((s,i)=>item(s,364+48*i-12,754,24))];
 const nums=(c,y)=>c.map((n,i)=>item(n,364+48*i-3,y,6));
 const r1=[item(topic?'Sözcükte Anlam':code+' - Sözcüğün anlamını',18,742,190,7),...(!topic?[item('yorumlar.',18,734,36,7)]:[]),...nums([4,2,1,1],738)];
 const r2=[item(topic?'Cümlede Anlam':'T.12.3.1 - Cümlenin anlamını yorumlar.',18,continuation?805:724,200,7),...nums([2,1,0,1],continuation?802:722)];
 const totalY=continuation?788:708,total=[item('Toplam - TÜRKÇE-T',220,totalY,120),...nums([6,corrupt?4:3,1,2],totalY)];
 return continuation?[[...metadata,...header,...r1],[...r2,...total]]:[[...metadata,...header,...r1,...r2,...total]];
}
module.exports={student,row,block,reports,pages};
