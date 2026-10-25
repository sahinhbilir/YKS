'use strict';
// Invented English result lists with the Fly Higher portrait layout. No real student data.
const word=(s,x,y,w=String(s).length*4,z=9)=>({s:String(s),x,y,w,h:z,z});
function englishResults({name='Fly Higher A1+ Level Unit Starter Test',date='05.10.2026',perPage=2,students=[
 {no:'2001',name:'SENTETİK ECE',cls:'9/A',code:'102',net:17,score:85,correct:17,wrong:3},
 {no:'2002',name:'SENTETİK UZUNADLI|FIRAT İKİNCİ',cls:'9/A',code:'102',net:6,score:30,correct:6,wrong:14,joined:true}
]}={}){
 const pages=[];
 for(let i=0;i<students.length;i+=perPage){const p=[word('DENEME SINAVI TOPLU SONUÇ LİSTESİ Öğrenci Adı Sıralı',168,820),word('Okul:',17,805,20),word('SENTETİK',40,805),word('ANADOLU LİSESİ',24,794),word('Sınav Adı:',197,794,40),word(name,240,794),word('Sınav Tarihi:',484,794,49),word(date,536,794),word('Toplam Katılımcı:',16,769,70),word(students.length,89,769,10),word('Sıra NO/İsim',15,741),word('Snf',106,741),word('İNG',296,741,13),word('Toplam',488,740),word('İNGİLİZCE',533,741),word('N',300,730,5),word('N',500,730,5),word('Puan',543,729,20)];
  students.slice(i,i+perPage).forEach((s,j)=>{const y=680-j*32,parts=s.name.split('|'),id=s.no+' / '+parts[0];if(s.joined)p.push(word((i+j+1)+' '+id,18,y,80));else p.push(word(i+j+1,20,y,5),word(id,32.6,y+5));if(parts[1])p.push(word(parts[1],32.6,y-5));
   p.push(word(s.code,105,y+5,15),word(s.cls,104,y-5,19),word(s.net.toFixed(2),291,y+5,23),word(s.correct+'/'+s.wrong,294,y-5,17),word(s.net.toFixed(2),491,y+5,23),word(s.score.toFixed(2),541,y+5,23),word('1 1 1 -',542,y-5,22));
  });pages.push(p);
 }
 return {pages,boylar:pages.map(()=>841.89)};
}
module.exports={englishResults};
