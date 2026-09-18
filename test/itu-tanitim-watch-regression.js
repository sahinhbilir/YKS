#!/usr/bin/env node
'use strict';

// Takip betiğinin yanlış alarm üretmemesi ve açılmayı kaçırmaması bu dosyayla güvence altında.

const fs = require('fs');
const path = require('path');
const watch = require('../tools/itu-tanitim-watch.js');

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const checks = [];
const fail = (id, detay) => { throw new Error(id + ': ' + JSON.stringify(detay)); };

const kapali = watch.snapshotFromHtml('basvuru', fixture('itu-basvuru-kapali.html'));
const kapaliIkinciIstek = watch.snapshotFromHtml('basvuru', fixture('itu-basvuru-kapali-2.html'));
const acik = watch.snapshotFromHtml('basvuru', fixture('itu-basvuru-acik.html'));
const bekleyenSayfa = watch.snapshotFromHtml('sayfa', fixture('itu-sayfa-bekliyor.html'));
const duyurulusSayfa = watch.snapshotFromHtml('sayfa', fixture('itu-sayfa-duyuru.html'));

// En kritik davranış: ASP.NET __VIEWSTATE her istekte değişir, hash değişmemeli.
if (kapali.hash !== kapaliIkinciIstek.hash)
  fail('viewstate-degisimi-yanlis-alarm-uretmemeli', { ilk: kapali.hash, ikinci: kapaliIkinciIstek.hash });
checks.push('viewstate-degisimi-yanlis-alarm-uretmez');

if (!/kapalıdır/.test(kapali.text)) fail('kapali-metin-okunamadi', kapali.text);
checks.push('kapali-sayfanin-metni-okunuyor');

if (kapali.fields !== 0) fail('kapali-sayfada-form-alani-gorunmemeli', { fields: kapali.fields });
if (acik.fields < 5) fail('acik-sayfada-form-alanlari-sayilmali', { fields: acik.fields });
checks.push('form-alanlari-yalnizca-acikken-sayiliyor');

const kapaliSebepler = watch.detectOpen({ basvuru: kapali, sayfa: bekleyenSayfa });
if (kapaliSebepler.length) fail('kapaliyken-acilma-sinyali-uretilmemeli', kapaliSebepler);
checks.push('kapaliyken-acilma-sinyali-uretilmiyor');

const acikSebepler = watch.detectOpen({ basvuru: acik, sayfa: bekleyenSayfa });
if (acikSebepler.length < 2) fail('acilma-basvuru-uygulamasindan-yakalanmali', acikSebepler);
checks.push('acilma-basvuru-uygulamasindan-yakalaniyor');

const duyuruSebepler = watch.detectOpen({ basvuru: kapali, sayfa: duyurulusSayfa });
if (!duyuruSebepler.length) fail('sayfadaki-duyuru-degisikligi-yakalanmali', duyuruSebepler);
checks.push('sayfadaki-duyuru-degisikligi-yakalaniyor');

// Sayfa dilimi tutmazsa sessizce tüm sayfayı hashlemek yerine uyarı vermeli.
const bozukDilim = watch.snapshotFromHtml('sayfa', '<html><body>yeni tasarım</body></html>');
if (!bozukDilim.warning) fail('dilim-bulunamazsa-uyari-verilmeli', bozukDilim);
checks.push('sayfa-yeniden-tasarlanirsa-uyari-veriliyor');

// Yan menü ve navigasyon hash'e karışmamalı; onlar bizden bağımsız değişiyor.
if (/ETKİNLİKLERİMİZ|yan menü/.test(bekleyenSayfa.text))
  fail('sayfa-dilimi-yalnizca-icerigi-almali', bekleyenSayfa.text);
if (!/planlanmaktadır/.test(bekleyenSayfa.text))
  fail('sayfa-dilimi-duyuru-metnini-icermeli', bekleyenSayfa.text);
checks.push('sayfa-dilimi-yalnizca-icerik-blogunu-aliyor');

// Türkçe karakterler entity olarak geliyor; çözülmezse metin okunmaz olur.
if (!/Liseler için Tanıtım Programı/.test(bekleyenSayfa.text))
  fail('html-entity-cozulmeli', bekleyenSayfa.text);
checks.push('html-entityleri-cozuluyor');

if (watch.stripVolatile('<a href="x.png?sfvrsn=12345">').includes('12345'))
  fail('oynak-sorgu-parametreleri-temizlenmeli', watch.stripVolatile('<a href="x.png?sfvrsn=12345">'));
checks.push('oynak-sorgu-parametreleri-temizleniyor');

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
