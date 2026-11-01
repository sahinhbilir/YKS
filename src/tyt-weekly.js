// Pure forecasting adapter for the existing seven-day plan and printed sheet.
// A reservation is never a completion: only ledger() reads real study records.
const TYT_WEEKLY = (() => {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const SOCIAL = ['tar', 'cog', 'fel', 'din'], SCIENCE = ['fiz', 'kim', 'bio'];
  const ORDER = ['tr', 'mat', ...SOCIAL, ...SCIENCE, 'geo'];
  const MOCKS = [0, 1, 3, 4, 5];
  const grammar = x => TYT_METOT.grammar(x);
  const info = c => TYT_METOT.info?.[c] || [({tr:'Türkçe',mat:'Matematik',tar:'Tarih',cog:'Coğrafya',fel:'Felsefe',din:'Din Kültürü',fiz:'Fizik',kim:'Kimya',bio:'Biyoloji',geo:'Geometri'})[c] || c, c==='mat'?30:c==='tr'||c==='geo'?25:SOCIAL.includes(c)?15:20];
  function ledger(si) {
    const kp = D.ogr[si].kendiPlan, m = kp.metot, today = bugunNo(), first=gunNo(m.baslangic);
    const videos = new Map(), recalls = new Map(), intros = new Map(), extras = new Map();
    for (const [id,date] of Object.entries(m.tamam || {})) {
      const day = gunNo(date); if (day <= today) extras.set(id, day);
    }
    for (const x of TYT_METOT.topics(si)) {
      const v = D.ogrIslenis?.[si]?.[x.ki];
      if (Number.isInteger(v) && v >= first && v <= today) videos.set(x.ki, v);
      else if (extras.has('v|'+x.key)) videos.set(x.ki, extras.get('v|'+x.key));
      const results = (D.log || []).filter(l => l[1] === si && l[2] === x.ki && l[0] <= today &&
        videos.has(x.ki) && l[0] >= videos.get(x.ki)+3);
      if (results.length) recalls.set(x.ki, Math.min(...results.map(l=>l[0])));
      else if (extras.has('r|'+x.key)) recalls.set(x.ki, extras.get('r|'+x.key));
      const id = 'g|'+(x.tyt?'TYT':'AYT')+'|'+(x.c||x.ders);
      const g = kp.genelTekrar?.tamam?.[(x.tyt?'TYT':'AYT')+'|'+x.ders];
      if (Number.isInteger(g) && g >= first && g <= today) intros.set(id,g);
      else if (extras.has(id)) intros.set(id,extras.get(id));
    }
    return {videos,recalls,intros,extras};
  }
  function validateSnapshot(s,konuAdedi=konuSayisi()) {
    if (!s || s.surum !== 1 || !Array.isArray(s.gunler) || s.gunler.length !== 7 ||
        !Array.isArray(s.dakikaButce) || s.dakikaButce.length !== 7 ||
        s.dakikaButce.some(n=>!Number.isFinite(n)||n<0||n>600) ||
        !Array.isArray(s.off) || s.off.some(n=>!Number.isInteger(n)||n<0||n>6) ||
        !Number.isFinite(s.kap) || s.kap<1 || s.kap>12)
      throw new Error('Haftalık TYT plan kaydı geçersiz.');
    for (const day of s.gunler) {
      if (!Array.isArray(day) || day.length > 100) throw new Error('Haftalık TYT satırları geçersiz.');
      for (const x of day) if (!x || typeof x.ad !== 'string' || x.ad.length>1000 || typeof x.metotId !== 'string' ||
          !Number.isFinite(x.soru)||x.soru<0||x.soru>600||!Number.isFinite(x.test)||x.test<0||x.test>30||
          (x.slotKi!==undefined&&(typeof x.slotKi!=='string'||x.slotKi.length>1800))||
          x.metotId.length>1800 || !Number.isFinite(x.metotDakika) || x.metotDakika<0 || x.metotDakika>600 ||
          (!x.serbest && (!Number.isInteger(x.ki)||x.ki<0||x.ki>=konuAdedi)) ||
          (x.serbest && typeof x.ki !== 'string') ||
          (x.metotVideoGun!==undefined&&!Number.isInteger(x.metotVideoGun)))
        throw new Error('Haftalık TYT çalışması geçersiz.');
    }
    return true;
  }
  function forecast(si, until) {
    const o=D.ogr[si], kp=o.kendiPlan, m=kp.metot, real=ledger(si);
    const all=TYT_METOT.topics(si), tyt=all.filter(x=>x.tyt&&x.c), ayt=all.filter(x=>!x.tyt);
    const realTYT=tyt.length>0&&tyt.every(x=>real.recalls.has(x.ki));
    const aytOpen=realTYT&&MOCKS.every(n=>real.extras.has('d|'+n));
    const pool=aytOpen?ayt:tyt, session=aytOpen?'AYT':'TYT';
    const start=Math.max(gunNo(m.baslangic),bugunNo()), exam=gunNo(D.ayar.sinav);
    const end=Math.min(exam-1,Math.max(until+3,gunNo(kp.hedef)+21,start+120));
    const days=new Map(), locked=new Set(), watched=new Map(real.videos), tested=new Map(real.recalls), intros=new Map(real.intros);
    const blocked=[], over=new Set(), topicByKi=new Map(all.map(x=>[x.ki,x]));
    // The unchanged A4 programme is a workload limit, not a reason to shrink type.
    // Reserve a row for the recall as well as the video before assigning either.
    const rowCap=Math.min(8,Math.max(1,o.kap||6)+2);
    const budget=day=>(o.off||[]).includes(haftaGunu(day))?0:
      o.dakika ? (haftaGunu(day)>=CUMARTESI?o.dakika.hs:o.dakika.hi) : m.dakika;
    const rows=day=>{if(!days.has(day))days.set(day,[]);return days.get(day);};
    const used=day=>rows(day).reduce((n,x)=>n+x.metotDakika,0);
    const put=(day,x)=>{if(day>=start&&day<exam&&!rows(day).some(y=>y.metotId===x.metotId))rows(day).push(x);};
    const extra=(id,ad,tur,min,q=0,extra={})=>({ki:'TM_'+id,serbest:true,ders:-1,dersAd:'Çalışma',ad,soru:q||min,birim:q?'':'dakika',test:1,mod:'serbest',metotId:id,metotTur:tur,metotDakika:min,...extra});
    const video=(x,day)=>({ki:x.ki,ders:konuAl(x.ki)[0],dersAd:x.ders,ad:x.ad,anlatim:true,test:1,soru:0,mod:'anlatim',R:null,
      kaynak:'Video',metotId:'v|'+x.key,metotTur:'video',metotDakika:60,
      metotKaynak:session==='TYT'?(x.c==='tr'&&grammar(x)?'https://www.youtube.com/channel/UCyohoF5P2JFvc3KLLZRwDug/videos':info(x.c)[3]):undefined});
    const recall=(x,day)=>({ki:x.ki,slotKi:'TMR_'+x.key,ders:konuAl(x.ki)[0],dersAd:x.ders,ad:x.ad,test:1,soru:info(x.c)[1],mod:'ilk',R:null,
      due:day+3,metotId:'r|'+x.key,metotTur:'recall',metotDakika:45,metotVideoGun:day,metotKosullu:!real.videos.has(x.ki)});
    // Issued rows are immutable and also reserve their future recall capacity.
    for(const [key,ov] of Object.entries(D.elle||{})) {
      const [owner,h]=key.split('|').map(Number);if(owner!==si||!ov.sabit)continue;
      for(let g=0;g<7;g++) {
        const day=h+g;if(day<start||day>end)continue;
        locked.add(day);
        for(const x of ov.metotPlan?.gunler?.[g]||[])put(day,copy(x));
      }
      for(let g=0;g<7;g++)for(const row of ov.metotPlan?.gunler?.[g]||[]) {
        const day=h+g, x=topicByKi.get(row.ki);
        if(row.metotTur==='video'&&x&&day>=start&&!real.videos.has(x.ki))watched.set(x.ki,day);
        if(row.metotTur==='overview'&&day>=start&&!intros.has(row.metotId))intros.set(row.metotId,day);
      }
    }
    // Daily habits are real rows in the same plan, not an extra rendering layer.
    for(let day=start;day<=end;day++)if(!locked.has(day)&&budget(day)>0) {
      put(day,extra('p|'+isoDan(day),'Paragraf · 20 soru','paragraph',30,20,{dersAd:'Türkçe'}));
      if(day===planHaftaSonu(si,ogrenciHaftaBasi(si,day)))
        put(day,extra('w|'+isoDan(day),'Haftanın bütün yanlış sorularını yeniden çöz','review',60));
    }
    function reserve(x,day) {
      if(tested.has(x.ki))return;
      const due=day+3,row=recall(x,day);
      if(due<start){blocked.push({...row,metotGecikti:true});return;}
      if(locked.has(due)&&!rows(due).some(y=>y.metotId===row.metotId&&y.metotVideoGun===day)) {
        blocked.push({...row,metotCakisma:true});return;
      }
      put(due,row);tested.set(x.ki,due);
      if(used(due)>budget(due))over.add(due);
    }
    pool.forEach(x=>{if(watched.has(x.ki))reserve(x,watched.get(x.ki));});
    const trIntro='g|TYT|tr';
    if(intros.has(trIntro)&&!real.extras.has('gr')) {
      const v=intros.get(trIntro),r=extra('gr','Dil bilgisi genel tekrar testi · 5 dk hatırla, notsuz çöz','overviewRecall',40,25,{dersAd:'Türkçe',metotVideoGun:v,due:v+3});
      if(v+3<start)blocked.push({...r,metotGecikti:true});else if(!locked.has(v+3))put(v+3,r);
    }
    const fraction=(xs,day)=>xs.length?xs.filter(x=>real.recalls.has(x.ki)||watched.has(x.ki)&&watched.get(x.ki)<=day).length/xs.length:1;
    const gates=day=>{
      const soc=fraction(tyt.filter(x=>x.c==='tr'&&grammar(x)),day)>=.8;
      const sci=soc&&fraction(tyt.filter(x=>SOCIAL.includes(x.c)),day)>=.5;
      const geo=sci&&fraction(tyt.filter(x=>SCIENCE.includes(x.c)),day)>=.4;
      return c=>aytOpen||c==='tr'||c==='mat'||SOCIAL.includes(c)&&soc||SCIENCE.includes(c)&&sci||c==='geo'&&geo;
    };
    const courses=[...ORDER,...new Set(pool.map(x=>x.c||x.ders))].filter((c,i,a)=>a.indexOf(c)===i);
    let finalStart=null;
    for(let day=start;day<=end;day++) {
      if(locked.has(day)||!budget(day))continue;
      // Repeated rounds deliberately allow several topics per lesson per day.
      let changed=true;
      while(changed) {
        changed=false;
        for(const c of courses) {
          if(!gates(day)(c))continue;
          const xs=pool.filter(x=>(x.c||x.ders)===c);
          if(c==='tr')xs.sort((a,b)=>Number(!grammar(a))-Number(!grammar(b)));
          const x=xs.find(x=>!watched.has(x.ki)&&!real.recalls.has(x.ki));
          if(!x)continue;
          const id='g|'+session+'|'+c;
          if(!intros.has(id)) {
            if(rows(day).length>=rowCap||used(day)+120>budget(day))continue;
            if(c==='tr'&&session==='TYT'&&(day+3>=exam||locked.has(day+3)||rows(day+3).length>=rowCap||used(day+3)+40>budget(day+3)))continue;
            put(day,extra(id,(info(c)[0]||x.ders)+' · genel son tekrar','overview',120,0,{dersAd:x.ders,metotKaynak:session==='TYT'?info(c)[2]:undefined}));
            intros.set(id,day);changed=true;
            if(c==='tr'&&session==='TYT')put(day+3,extra('gr','Dil bilgisi genel tekrar testi · 5 dk hatırla, notsuz çöz','overviewRecall',40,25,{dersAd:'Türkçe',metotVideoGun:day,due:day+3,metotKosullu:true}));
            continue;
          }
          if(intros.get(id)>day||day+3>=exam||locked.has(day+3)||rows(day).length>=rowCap||rows(day+3).length>=rowCap||used(day)+60>budget(day)||used(day+3)+45>budget(day+3))continue;
          put(day,video(x,day));watched.set(x.ki,day);reserve(x,day);changed=true;
        }
      }
      const finished=xs=>xs.length>0&&xs.every(x=>tested.has(x.ki)&&tested.get(x.ki)<day);
      const allFinished=tyt.length>0&&finished(tyt);
      if(!aytOpen&&allFinished&&finalStart===null) {
        const earliest=Math.max(start,...tyt.map(x=>tested.get(x.ki)+1));
        let candidate=earliest;
        while(candidate<=end&&MOCKS.some(n=>candidate+n>=exam||locked.has(candidate+n)||used(candidate+n)+225>budget(candidate+n)))candidate++;
        if(candidate<=end)finalStart=candidate;
      }
      if(!aytOpen&&finalStart!==null&&day>=finalStart) {
        const offset=day-finalStart;
        if(MOCKS.includes(offset)&&!real.extras.has('d|'+offset))put(day,extra('d|'+offset,'TYT genel denemesi · 165 dk + aynı gün 60 dk net ve zayıf konu analizi','mock',225,120,{dersAd:'TYT',metotKosullu:!realTYT}));
        else if(!MOCKS.includes(offset)&&used(day)+120<=budget(day))put(day,extra('weak|'+isoDan(day),'Branş denemeleri ve zayıf konulara dönüş','weak',120,0,{dersAd:'TYT',metotKosullu:!realTYT}));
        continue;
      }
      const socialDone=finished(tyt.filter(x=>SOCIAL.includes(x.c))),scienceDone=finished(tyt.filter(x=>SCIENCE.includes(x.c)));
      const branches=[];
      for(const c of ORDER)if(!(socialDone&&SOCIAL.includes(c))&&!(scienceDone&&SCIENCE.includes(c))) {
        const xs=tyt.filter(x=>x.c===c);if(finished(xs))branches.push([c,info(c)[0],info(c)[1],xs]);
      }
      if(socialDone)branches.push(['sos','Sosyal',20,tyt.filter(x=>SOCIAL.includes(x.c))]);
      if(scienceDone)branches.push(['fen','Fen',20,tyt.filter(x=>SCIENCE.includes(x.c))]);
      if((day-gunNo(m.baslangic))%3===0)for(const [c,name,q,xs] of branches)if(rows(day).length<rowCap&&used(day)+45<=budget(day))
        put(day,extra('b|'+c+'|'+isoDan(day),name+' branş denemesi','branch',45,q,{dersAd:name,metotDers:c,metotKosullu:!xs.every(x=>real.recalls.has(x.ki))}));
    }
    return {days,budget,blocked,over,real,finalStart,phase:aytOpen?'AYT':realTYT?'TYT deneme haftası':'TYT'};
  }
  function shape(si,hb,hs,ov,s,blocked=[]) {
    const gunler=copy(s.gunler).map((l,g)=>hb+g<=hs?l:[]);
    const gunYuk=gunler.map(l=>l.reduce((n,x)=>n+(x.test||1),0));
    return {gunler,devreden:0,tasan:[],toplam:gunler.reduce((n,l)=>n+l.length,0),bekleyen:blocked.filter(x=>!x.serbest).map(x=>({ki:x.ki,due:x.due,metotId:x.metotId,metotVideoGun:x.metotVideoGun})),
      testToplam:gunYuk.reduce((a,b)=>a+b,0),gunYuk,kap:s.kap,off:s.off.slice(),elle:ov,
      gunDakika:gunler.map(l=>l.reduce((n,x)=>n+x.metotDakika,0)),dakikaButce:s.dakikaButce.slice(),metot:true,metotBekleyen:blocked};
  }
  function weekly(si,hb,hs,sourceOv) {
    const o=D.ogr[si];if(o?.okul!==false||ogrenciSinavi(o)!=='YKS'||o.kendiPlan?.metot?.surum!==1)return null;
    const ov=copy(sourceOv||elleAl(si,hb));
    if(ov.sabit) {
      if(!ov.metotPlan)return null;
      validateSnapshot(ov.metotPlan);return shape(si,hb,hs,ov,ov.metotPlan);
    }
    const f=forecast(si,hs),gunler=Array.from({length:7},(_,g)=>copy(f.days.get(hb+g)||[]));
    ov.anlatim=ov.anlatim||{};ov.konuSlot=ov.konuSlot||{};ov.serbest=ov.serbest||{};
    gunler.flat().forEach(x=>{
      if(x.anlatim)ov.anlatim[x.ki]={...(ov.anlatim[x.ki]||{}),kaynak:x.kaynak,metotId:x.metotId};
      else if(x.serbest)ov.serbest[x.ki]={ad:x.ad,ders:x.dersAd,soru:x.soru,birim:x.birim,metotId:x.metotId,metotTur:x.metotTur};
      else ov.konuSlot[x.slotKi]={ki:x.ki,metotId:x.metotId};
    });
    const s={surum:1,gunler,dakikaButce:Array.from({length:7},(_,g)=>f.budget(hb+g)),off:(o.off||[]).slice(),kap:o.kap||6};
    ov.metotPlan=s;
    return shape(si,hb,hs,ov,s,f.blocked);
  }
  function actionable(si,x,gun) {
    if(!Number.isInteger(gun)||gun>bugunNo())return false;
    const real=ledger(si),topics=TYT_METOT.topics(si).filter(t=>t.tyt&&t.c);
    if(x.metotTur==='recall')return real.videos.has(x.ki)&&real.videos.get(x.ki)+3===gun;
    if(x.metotTur==='overviewRecall')return real.intros.has('g|TYT|tr')&&real.intros.get('g|TYT|tr')+3===gun;
    if(x.metotTur==='branch') {
      const group=x.metotDers==='sos'?SOCIAL:x.metotDers==='fen'?SCIENCE:[x.metotDers];
      const xs=topics.filter(t=>group.includes(t.c));
      return xs.length>0&&xs.every(t=>real.recalls.has(t.ki)&&real.recalls.get(t.ki)<gun);
    }
    if(x.metotTur==='mock'||x.metotTur==='weak') {
      if(!topics.length||!topics.every(t=>real.recalls.has(t.ki)&&real.recalls.get(t.ki)<gun))return false;
      if(x.metotTur==='weak')return true;
      const offset=Number(x.metotId.split('|')[1]),i=MOCKS.indexOf(offset);
      if(i<0)return false;
      if(i&&(!real.extras.has('d|'+MOCKS[i-1])||gun<real.extras.get('d|'+MOCKS[i-1])+(i===2?2:1)))return false;
      return !MOCKS.some(n=>n!==offset&&real.extras.get('d|'+n)===gun);
    }
    return true;
  }
  return {weekly,forecast,ledger,validateSnapshot,actionable};
})();
