const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const source = html.slice(start, boot);

const listeners = {};
const nodes = {
  ray: { innerHTML: '' }, ana: { innerHTML: '' },
  stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' }
};
const element = () => ({
  style: {}, hidden: false, textContent: '', innerHTML: '', value: '', checked: false,
  classList: { contains() { return false; }, add() {}, remove() {} }, dataset: {},
  setAttribute() {}, appendChild() {}, click() {}, remove() {}, focus() {}, select() {},
  getClientRects() { return [1]; }, closest() { return null; }
});
const sandbox = {
  console, setTimeout, clearTimeout, Blob, URL, URLSearchParams,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert() {}, confirm() { return true; }, prompt() { return ''; },
  fetch: async () => ({ ok: false }),
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollTo() {}, open() { return null; }, addEventListener() {} },
  document: {
    activeElement: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '.oRutin' ? (nodes.__routines || []) : []; },
    createElement() { return element(); },
    body: { appendChild() {}, insertAdjacentHTML(_where, markup) { this.lastHTML = markup; } }
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(source, { filename: target }).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function studentState(extra) {
  sandbox.__extra = extra || '';
  run(`
    D = varsayilan(); D.rol = 'ogrenci'; D.ayar.testTarih = '2026-09-14';
    D.ogr = [{ no:1, ad:'Ada', alan:'SAY', sube:'benim', kap:6, off:[6], hedef:null,
      aktif:true, ilkAktif:bugunNo(), maddeler:[], rutin:{once:'',ara:'',sonra:''} }];
    EK.ogr = 0; EK.hafta = null; EK.sekme = 'plan';
  ` + (extra || ''));
}

(async () => {
  studentState();
  const roleView = run(`(() => {
    EK.sekme = 'anlasma'; cizIc();
    return { tabs: SEKMELER(), section: document.getElementById('ana').innerHTML, selected: EK.sekme };
  })()`);
  assert(roleView.tabs.some(x => x[0] === 'anlasma'), 'Öğrenci anlaşma sekmesine ulaşamıyor.');
  assert(roleView.selected === 'anlasma', 'Öğrenci anlaşma sekmesinden plana yönlendirildi.');
  assert(roleView.section.includes('id="oMaddeler"') && roleView.section.includes('class="oRutin"'),
    'Öğrencinin kişisel madde/rutin alanları yok.');
  assert(!roleView.section.includes('id="aBaslik"') && !roleView.section.includes('id="aGiris"') &&
    !roleView.section.includes('id="aMaddeler"'), 'Sınıfın ortak alanları öğrenciye açıldı.');

  run(`D.anlasma.baslik='Öğretmen başlığı'; D.anlasma.giris='Ortak giriş'; D.anlasma.maddeler=['Ortak madde'];`);
  nodes.aAktif = Object.assign(element(), { id: 'aAktif', checked: false });
  nodes.oMaddeler = Object.assign(element(), { id: 'oMaddeler', value: 'Kendi sözüm\n\nİkinci söz' });
  nodes.__routines = [
    Object.assign(element(), { dataset: { alan:'once' }, value:'Masayı hazırla' }),
    Object.assign(element(), { dataset: { alan:'ara' }, value:'Su iç' }),
    Object.assign(element(), { dataset: { alan:'sonra' }, value:'Özet çıkar' })
  ];
  const saveTarget = Object.assign(element(), {
    id: 'anlasmaKaydet',
    closest(selector) { return selector.indexOf('#anlasmaKaydet') >= 0 ? this : null; }
  });
  await listeners.click[0]({ target: saveTarget });
  const savedAgreement = run(`({ a:JSON.parse(JSON.stringify(D.anlasma)), o:JSON.parse(JSON.stringify(D.ogr[0])) })`);
  assert(savedAgreement.a.baslik === 'Öğretmen başlığı' && savedAgreement.a.giris === 'Ortak giriş' &&
    savedAgreement.a.maddeler.join('|') === 'Ortak madde', 'Öğrenci sınıfın ortak anlaşmasını değiştirdi.');
  assert(savedAgreement.a.aktif === false, 'Öğrencinin çıktı bölümü tercihi kaydedilmedi.');
  assert(savedAgreement.o.maddeler.join('|') === 'Kendi sözüm|İkinci söz' &&
    savedAgreement.o.rutin.once === 'Masayı hazırla' && savedAgreement.o.rutin.ara === 'Su iç' &&
    savedAgreement.o.rutin.sonra === 'Özet çıkar', 'Öğrencinin kişisel anlaşma/rutini kaydedilmedi.');

  studentState(`
    const hb0 = gunNo('2026-09-07');
    D.islenis[0] = hb0 - D.ayar.ilk;
    EK.hafta = hb0;
  `);
  const beforeRecovery = run(`(() => {
    const hb=gunNo('2026-09-07'), p=planHesapla(0,hb), view=gorunumPlan();
    return {empty:p.toplam===0 && p.kayitYok, hasButton:view.includes('id="duzenleAc"')};
  })()`);
  assert(beforeRecovery.empty && beforeRecovery.hasButton, 'Kayıtsız geçmiş hafta öğrenci için kurtarılabilir değil.');
  const recovered = run(`(() => {
    const hb=gunNo('2026-09-07');
    if (!duzenlemeBaslat(0,hb)) return {error:'start'};
    const p=planHesapla(0,hb), first=p.gunler.flat()[0];
    if (!first) return {error:'no reconstructed item'};
    const ov=elleAl(0,hb,true); ov.soru[planSlotAnahtari(first)]=37;
    const banner=gorunumPlan();
    const saved=duzenlemeyiAnlikOlarakKaydet();
    D.islenis[1]=hb-D.ayar.ilk;
    const after=planHesapla(0,hb), items=after.gunler.flat();
    return {saved, banner, stable:items.length===1 && items[0].soru===37,
      snapshot:!!after.elle.sabit && !!after.elle.plan && !after.kayitYok};
  })()`);
  assert(!recovered.error && recovered.banner.includes('id="duzenleBitir"') &&
    recovered.banner.includes('id="duzenleVazgec"'), 'Düzenleme kaydet/vazgeç akışı görünmüyor.');
  assert(recovered.saved.toplam > 0 && recovered.stable && recovered.snapshot,
    'Onarılan geçmiş hafta tam plan anlığı olarak saklanmadı.');

  studentState(`
    const hb1=gunNo('2026-09-07'), key='0|'+hb1;
    D.elle={};
    D.elle[key]={ek:[],sil:[],yer:{},soru:{0:24},degisim:{},konuSlot:{}};
    globalThis.__beforeEdit=JSON.stringify(D.elle[key]); EK.hafta=hb1;
  `);
  const discard = run(`(() => {
    const hb=gunNo('2026-09-07'), key='0|'+hb;
    duzenlemeBaslat(0,hb); D.elle[key].soru[0]=99; D.elle[key].sil.push(0);
    const r=duzenlemeVazgec();
    return {r, restored:JSON.stringify(D.elle[key])===globalThis.__beforeEdit,
      cleared:duzenlemeKaydi()===null && D.duzenleYedek===undefined};
  })()`);
  assert(discard.restored && discard.cleared, 'Vazgeç önceki elle düzenini tam geri yüklemedi.');

  studentState(`EK.hafta=gunNo('2026-09-07');`);
  const discardNew = run(`(() => {
    const hb=gunNo('2026-09-07'), key='0|'+hb; duzenlemeBaslat(0,hb);
    elleAl(0,hb,true).serbest={S1:{ad:'Geçici',ders:'',soru:10}};
    duzenlemeVazgec();
    return !D.elle || !Object.prototype.hasOwnProperty.call(D.elle,key);
  })()`);
  assert(discardNew, 'Vazgeç yeni oluşturulan hafta kaydını kaldırmadı.');

  studentState(`EK.hafta=gunNo('2026-09-07');`);
  const emptySnapshot = run(`(() => {
    const hb=gunNo('2026-09-07'); duzenlemeBaslat(0,hb);
    const r=duzenlemeyiAnlikOlarakKaydet(), p=planHesapla(0,hb);
    return {count:r.toplam, saved:!!p.elle.sabit && !!p.elle.plan && !p.kayitYok, visible:p.toplam};
  })()`);
  assert(emptySnapshot.count === 0 && emptySnapshot.saved && emptySnapshot.visible === 0,
    'Bilinçli boş geçmiş hafta tarihsel kayıt olarak saklanmadı.');

  run(`
    D=varsayilan(); D.rol='rehber'; D.ayar.testTarih='2026-09-14';
    D.ogr=[
      {no:1,ad:'Bir',alan:'SAY',sube:'A',kap:6,off:[],aktif:true,maddeler:[],rutin:{}},
      {no:2,ad:'İki',alan:'SAY',sube:'A',kap:6,off:[],aktif:true,maddeler:[],rutin:{}}
    ]; EK.ogr=1; EK.hafta=gunNo('2026-09-07'); duzenlemeBaslat(1,EK.hafta); EK.ogr=0;
  `);
  const binding = run(`({ wrong:duzenlemeAcik(gunNo('2026-09-07'),0), right:duzenlemeAcik(gunNo('2026-09-07'),1),
    banner:gorunumPlan() })`);
  assert(!binding.wrong && binding.right && binding.banner.includes('id="duzenleneneDon"'),
    'Düzenleme oturumu tek öğrenciye bağlanmadı.');
  const isolatedScope = run(`(() => { EK.ogr=1; EK.hafta=gunNo('2026-09-07'); PENCERE={kapsam:'hepsi'}; return hedefOgrenciler(); })()`);
  assert(isolatedScope.length === 1 && isolatedScope[0] === 1,
    'Geçmiş hafta düzenlemesi başka öğrencilere toplu değişiklik uygulayabiliyor.');

  studentState(`
    const hb3=gunNo('2026-09-07'); EK.hafta=hb3; duzenlemeBaslat(0,hb3);
    D.log=[[hb3,0,0,8,10,3,Date.now()]];
  `);
  const resultLock = run(`(() => {
    let error=''; try { duzenlemeyiAnlikOlarakKaydet(); } catch(e) { error=e.message; }
    const stillOpen=!!duzenlemeKaydi(); duzenlemeVazgec();
    return {error,stillOpen,resultStillThere:D.log.length===1};
  })()`);
  assert(/sonucu girildi/.test(resultLock.error) && resultLock.stillOpen && resultLock.resultStillThere,
    'Sonuç girildikten sonra plan kaydı yanlışlıkla değiştirildi veya sonuç geri alındı.');

  studentState(`
    const hb2=gunNo('2026-09-07'); D.ayar.testTarih='2026-09-07'; D.islenis[0]=hb2-D.ayar.ilk;
    EK.hafta=hb2; haftayiSabitle(0,hb2); D.ayar.testTarih='2026-09-14'; duzenlemeBaslat(0,hb2);
  `);
  const frozenEdit = run(`(() => {
    const hb=gunNo('2026-09-07'), p=planHesapla(0,hb), source=p.gunler.flat()[0];
    if (!source) return false;
    let from=null; p.gunler.forEach((list,g)=>list.forEach((x,s)=>{if(x===source)from={g,s};}));
    return tasi(0,hb,from,{g:(from.g+1)%7,s:0});
  })()`);
  assert(frozenEdit, 'Açık düzenleme kipinde sabit geçmiş plan taşınamıyor.');

  studentState(`
    const hb4=haftaBasi(); EK.hafta=hb4;
    D.log=[[hb4,0,0,6,10,2,Date.now()]];
  `);
  const outsidePlanResult = run(`(() => {
    const hb=haftaBasi(), locked=gorunumGiris();
    EK.girisAcik['0:'+hb]=true;
    const editing=gorunumGiris();
    return {locked,editing};
  })()`);
  assert(outsidePlanResult.locked.includes('Plan dışında kaydedilmiş sonuçlar') &&
    outsidePlanResult.locked.includes('data-girisduzenle="1"') &&
    outsidePlanResult.locked.includes('6/10'),
    'Yüklü planda karşılığı kalmayan sonuç Sonuç girişi ekranında görünmüyor.');
  assert(outsidePlanResult.editing.includes('class="gDogru"') &&
    outsidePlanResult.editing.includes('value="6"') && outsidePlanResult.editing.includes('value="10"'),
    'Plan dışı korunmuş sonuç mevcut düzenleme akışına açılamıyor.');

  console.log(JSON.stringify({ passed: 24, checks: [
    'student-agreement-tab', 'student-route-reachable', 'personal-fields-visible', 'teacher-fields-hidden',
    'teacher-agreement-isolated', 'student-output-toggle', 'student-items-save', 'student-routines-save',
    'past-unissued-empty', 'past-recovery-button', 'edit-banner-actions', 'reconstructed-plan-saved',
    'snapshot-immutable', 'discard-restores-existing', 'discard-removes-new', 'edit-state-cleared',
    'empty-snapshot-supported', 'edit-bound-to-student', 'other-student-return-banner',
    'edit-scope-isolated', 'result-locks-snapshot', 'result-survives-discard', 'frozen-plan-editable',
    'outside-plan-result-remains-editable'
  ] }, null, 2));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
