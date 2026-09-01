#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tekrarlanabilir gerçek-veriye-dayalı regresyon kontrolü.
//
// Bu proje "gerçek yedekle test et" alışkanlığıyla defalarca gerçek hata
// buldu (bkz. HANDOFF.md), ama o zamana kadar bu hep elle, sandbox'ta bir
// kerelik yapılan bir işti. Bu script aynı fikri otomatikleştirir: index.html
// içindeki asıl uygulama kodunu (herhangi bir bundler olmadan, dosyadan
// doğrudan) yükler, minimal bir tarayıcı taklidi içinde çalıştırır, ve bu
// projenin geçmişte gerçekten kırdığı davranışları doğrudan uygulamanın
// kendi fonksiyonlarına karşı sınar.
//
// Çalıştırma:   node test/regresyon-testi.js [gerçek-yedek.json]
// Yedek dosyası verilirse (Ayarlar > Yedek indir çıktısı) D o yedekle
// başlatılır ve testler gerçek veri üzerinde de koşar; verilmezse
// uygulamanın kendi varsayilan() fonksiyonuyla temiz bir durumdan başlar —
// uydurma bir senaryo değil, uygulamanın gerçek kurulum yolu.
//
// Node kullanılıyor (planda "Deno" öneriliyordu): bu sandbox'ta Deno kurulu
// değil ve gerçek geliştirme makinesinde de (HANDOFF.md) ikisi de kurulu
// değil — yani ortam paritesi açısından fark etmiyor. Node zaten bu oturumda
// kanıtlanmış durumda (bütün önceki testler onunla çalıştırıldı); kurulu
// olmayan bir araçla, hiç çalıştırmadan bir script teslim etmek bu projenin
// "doğrulanmamış düzeltme doğrulanmış sayılmaz" ilkesine ters düşerdi.
// Node de Deno gibi bundler'sız, derlemesiz çalışır — asıl koşul buydu.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX_HTML = path.join(__dirname, '..', 'index.html');
const yedekYolu = process.argv[2] || null;

function uygulamaKoduCikar(html) {
  const basla = html.indexOf('<script id="uygulama">');
  if (basla < 0) throw new Error('<script id="uygulama"> bulunamadı — index.html yapısı değişmiş olabilir.');
  const icerikBasi = html.indexOf('>', basla) + 1;
  const bitis = html.indexOf('</script>', icerikBasi);
  if (bitis < 0) throw new Error('uygulama script kapanışı bulunamadı.');
  return html.slice(icerikBasi, bitis);
}

// Gerçek bir DOM yok — sadece uygulama kodunun ÇÖKMEDEN yüklenmesi, ve
// document/window'a değen (ama bizim testlerimizin hiç tetiklemediği) genel
// kurulum/olay kodunun sessizce no-op geçmesi yeterli. Aşağıdaki hiçbir metod
// gerçek bir şey yapmıyor; sadece "var" olduklarını garanti ediyor.
function sahteEleman() {
  const el = {
    textContent: '', innerHTML: '', value: '', className: '', dataset: {}, style: {}, files: [],
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { return c; }, remove() {}, closest() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; },
  };
  return el;
}

function baglamOlustur(baslangicLocalStorage) {
  const ls = new Map(Object.entries(baslangicLocalStorage || {}));
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise,
    document: {
      getElementById(id) { return sahteEleman(); },
      createElement() { return sahteEleman(); },
      addEventListener() {}, removeEventListener() {},
      body: sahteEleman(),
      querySelectorAll() { return []; },
      querySelector() { return null; },
    },
    window: { scrollTo() {}, claude: undefined, location: { href: '' } },
    localStorage: {
      getItem: k => (ls.has(k) ? ls.get(k) : null),
      setItem: (k, v) => { ls.set(k, String(v)); },
      removeItem: k => { ls.delete(k); },
    },
    sessionStorage: {
      getItem: () => null, setItem() {}, removeItem() {},
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    alert() {}, confirm() { return true; },
    URL: { createObjectURL() { return ''; }, revokeObjectURL() {} },
    Blob: function Blob() {},
    navigator: { clipboard: { writeText: async () => {} } },
  };
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function yukle() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const kod = uygulamaKoduCikar(html);
  const ctx = baglamOlustur({});
  vm.runInContext(kod, ctx, { filename: 'index.html#uygulama' });
  return ctx;
}

// ---------------------------------------------------------------------------
let toplam = 0, basarili = 0;
const basarisizlar = [];
function kontrolEt(ad, kosul, detay) {
  toplam++;
  if (kosul) { basarili++; console.log('  PASS  ' + ad); }
  else { basarisizlar.push(ad); console.log('  FAIL  ' + ad + (detay ? ' — ' + detay : '')); }
}

(async () => {
  console.log('index.html içindeki uygulama kodu yükleniyor (bundler yok, doğrudan dosyadan)...');
  const ctx = yukle();
  // Boot IIFE (dosyanın sonundaki kendiliğinden çalışan async fonksiyon) kendi
  // durumunu kurmaya çalışır; testlerimiz D'yi kendi elleriyle kuracağı için
  // ona bağımlı değiliz, ama çökmediğini görmek için bir tık bekliyoruz.
  await new Promise(r => setTimeout(r, 20));

  const kurulumKodu = yedekYolu
    ? 'D = ' + JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(yedekYolu), 'utf8'))) + ';'
    : 'D = varsayilan(); D.rol = "ogrenci"; D.ogr = [{ no:1, ad:"Test", alan:"SAY", sube:"benim", ' +
      'kap:6, off:[6], hedef:null, aktif:true, ilkAktif:bugunNo(), maddeler:[], rutin:{once:"",ara:"",sonra:""} }]; ' +
      'D.konuPlani["benim"] = JSON.parse(JSON.stringify(VARSAYILAN_KONU_PLANI.SAY));';
  const taze = () => vm.runInContext(kurulumKodu, ctx);
  taze();
  console.log(yedekYolu ? ('Gerçek yedek yüklendi: ' + yedekYolu) : 'Gerçek yedek verilmedi — uygulamanın kendi varsayilan()/kurulum yoluyla temiz durumdan başlanıyor.');
  console.log('');

  // === 1) donemBasi/donemElle, çoklu "yeniden başlatma" simülasyonunda ===
  console.log('1) donemBasi / donemElle — tekrarlanan donemHizala() çağrılarında (yeniden başlatma simülasyonu)');
  {
    // Pozitif: elle=true iken donemHizala() dokunmamalı, kaç kere çağrılırsa çağrılsın.
    vm.runInContext(
      'donemBasiniAyarla(isoDan(pazartesi(bugunNo() + 200)), true);', ctx); // gelecekte, bilinçli seçim
    const oncekiDonem = vm.runInContext('D.ayar.donemBasi', ctx);
    for (let i = 0; i < 5; i++) vm.runInContext('donemHizala();', ctx);
    const sonrakiDonem = vm.runInContext('D.ayar.donemBasi', ctx);
    const elleHali = vm.runInContext('D.ayar.donemElle', ctx);
    kontrolEt('elle=true iken 5 kez donemHizala() sonrası donemBasi değişmedi',
      oncekiDonem === sonrakiDonem && elleHali === true,
      'once=' + oncekiDonem + ' sonra=' + sonrakiDonem);

    // Negatif kontrol: elle=false VE aralık dışıysa donemHizala() GERÇEKTEN düzeltmeli —
    // yoksa yukarıdaki "değişmedi" testi mekanizmanın çalışmadığından değil, hiçbir şeyin
    // hiçbir zaman tetiklenmediğinden geçiyor olabilir. Bu ayrımı kanıtlar.
    vm.runInContext('D.ayar.donemBasi = isoDan(bugunNo() - 5000); D.ayar.donemElle = false;', ctx);
    const dusukDonem = vm.runInContext('D.ayar.donemBasi', ctx);
    vm.runInContext('donemHizala();', ctx);
    const duzeltilenDonem = vm.runInContext('D.ayar.donemBasi', ctx);
    kontrolEt('elle=false VE aralık dışıyken donemHizala() gerçekten düzeltiyor (mekanizma canlı)',
      dusukDonem !== duzeltilenDonem,
      'once=' + dusukDonem + ' sonra=' + duzeltilenDonem);
  }

  // === 2) planHesapla girdilerini değiştirmiyor ===
  console.log('\n2) planHesapla(si, hb) — girdiyi (D) değiştirmiyor');
  {
    taze();   // önceki bölümün D üzerindeki değişikliklerinden bağımsız, temiz başlangıç
    vm.runInContext(
      'donemBasiniAyarla(isoDan(pazartesi(bugunNo())), true); ' +
      'D.islenis[0] = bugunNo() - 30; D.islenis[1] = bugunNo() - 20; D.islenis[2] = bugunNo() - 10;', ctx);
    const oncesi = vm.runInContext('JSON.stringify(D)', ctx);
    vm.runInContext('planHesapla(0, buHafta());', ctx);
    const sonrasi = vm.runInContext('JSON.stringify(D)', ctx);
    kontrolEt('planHesapla çağrısından sonra D aynı (JSON karşılaştırması)', oncesi === sonrasi);
  }

  // === 3) telafi yerleşimi: iki bağımsız günlük kapasite şeridi taşmıyor ===
  console.log('\n3) haftayiTelafiEt + planHesapla — test ve konu-anlatımı şeritleri kendi günlük sınırlarını aşmıyor');
  {
    taze();   // önceki bölümün D üzerindeki değişikliklerinden bağımsız, temiz başlangıç
    vm.runInContext(
      'D.ogr[0].kap = 2; D.ayar.telafiGunKap = 1; ' +                 // küçük sınırlar, taşma kolay görülsün
      'donemBasiniAyarla(isoDan(pazartesi(bugunNo() - 21)), true); ' + // üç hafta önce başlamış gibi
      'const hb0 = buHafta() - 7; ' +                                 // telafi edilecek hafta (geçen hafta)
      // devreden çok sayıda test: eski haftalardan kalan (kart) konular — ki'ler
      // gerçek konuAl(ki) çözümlemesiyle uyumlu olsun diye D.ekKonular'a push edilip
      // dönen KATALOG.length+indeks kullanılıyor, uydurma sayılar değil.
      'for (let i = 0; i < 12; i++) { ' +
      '  D.ekKonular.push([1, 9, "test", "Konu " + i, 0, "", 0, 1]); ' +
      '  const ki = KATALOG.length + D.ekKonular.length - 1; ' +
      '  D.kart["0:" + ki] = { s: 3, d: 5, son: bugunNo() - 10, due: bugunNo() - 3, n: 1, y: 60 }; ' +
      '} ' +
      // hb0 haftasının hiç işlenmemiş yeni konuları: telafide konu anlatımına dönüşecekler.
      // İşleniş tarihi hb0 haftasının İÇİNDE olmalı ki haftayiTelafiEt onları "ilkBuHafta"
      // (o hafta ilk kez işlenmiş, henüz kartı yok) olarak görsün.
      'for (let i = 0; i < 8; i++) { ' +
      '  D.ekKonular.push([1, 9, "test", "Yeni Konu " + i, 0, "", 0, 1]); ' +
      '  const ki = KATALOG.length + D.ekKonular.length - 1; ' +
      '  D.islenis[ki] = hb0; ' +
      '} ' +
      'const r = haftayiTelafiEt(0, hb0, "gelmedi_cozmedi"); ' +
      'globalThis.__telafiSonuc = r;', ctx);
    const telafiSonuc = vm.runInContext('__telafiSonuc', ctx);
    console.log('   telafi sonucu:', JSON.stringify(telafiSonuc));

    // Etkilenen haftaları (bu ve sonraki birkaç hafta) tarayıp her gün için iki
    // kapasiteyi de kontrol et.
    const asimVar = vm.runInContext(`
      (() => {
        const kap = D.ogr[0].kap, anlatimSiniri = D.ayar.telafiGunKap;
        let asim = null;
        for (let k = -1; k <= 3; k++) {
          const hb = buHafta() + k * 7;
          const p = planHesapla(0, hb);
          for (let g = 0; g < 7; g++) {
            // Sabitlenmiş (pin) öğeler kapasite kontrolünden muaftır -- kâğıtta neyse o
            // kalır, sonradan kap düşürülse bile. Kontrol yalnızca YENİ yerleştirilen
            // (pin olmayan) öğelerin kapasiteyi aşmadığını doğrulamalı; aksi hâlde gerçek
            // bir yedekte önceden dondurulmuş bir haftaya karşı çalıştırıldığında yanlış
            // pozitif verir (sabitlenmiş yük, sonradan değişen kap ile karşılaştırılır).
            const dizi = p.gunler[g].filter(y => !y.pin);
            const testYuku = dizi.reduce((a, y) => a + (y.anlatim ? 0 : (y.test || 1)), 0);
            const anlatimYuku = dizi.filter(y => y.anlatim).length;
            if (testYuku > kap) asim = { tip: 'test', hb, g, yuk: testYuku, sinir: kap };
            if (anlatimYuku > anlatimSiniri) asim = { tip: 'anlatim', hb, g, yuk: anlatimYuku, sinir: anlatimSiniri };
          }
        }
        return asim;
      })()
    `, ctx);
    kontrolEt('hiçbir günde test yükü kap sınırını aşmıyor, hiçbir günde anlatım sayısı telafiGunKap sınırını aşmıyor',
      asimVar === null, asimVar ? JSON.stringify(asimVar) : '');
  }

  console.log('\n' + basarili + '/' + toplam + ' kontrol geçti.');
  if (basarisizlar.length) {
    console.log('Başarısız: ' + basarisizlar.join(', '));
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('Harness hatası:', e); process.exit(1); });
