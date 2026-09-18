#!/usr/bin/env node
'use strict';

// İTÜ liseler için tanıtım programı başvurusu açıldığında Telegram'dan haber verir.
// Sayfa ASP.NET WebForms olduğu için __VIEWSTATE her istekte değişir; hash almadan
// önce bu tür oynak alanların temizlenmesi şart, yoksa her kontrol yanlış alarm üretir.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASVURU_URL = 'https://uygulama-bidb.itu.edu.tr/tanitim-ofisi/kampus-turu/';
const SAYFA_URL = 'https://tanitim.itu.edu.tr/ituye-gel/liseler-icin-tanitim-programi';
const STATE_FILE = path.join(__dirname, '..', '.watch', 'itu-tanitim.json');
const HEARTBEAT_DAYS = 20; // GitHub 60 gün işlemsiz depoda zamanlanmış akışları durduruyor.
const SNIPPET = 900;

const TARGETS = {
  basvuru: {
    url: BASVURU_URL,
    label: 'Başvuru uygulaması',
    // Tüm gövde zaten küçük; ayrıca dilimlemeye gerek yok.
    slice: null
  },
  sayfa: {
    url: SAYFA_URL,
    label: 'Tanıtım sayfası',
    slice: { from: '<div class="container subPage">', to: '<div class="col-xs-12 col-md-3">' }
  }
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  uuml: 'ü', Uuml: 'Ü', ouml: 'ö', Ouml: 'Ö', ccedil: 'ç', Ccedil: 'Ç',
  scedil: 'ş', Scedil: 'Ş', copy: '©', ndash: '–', mdash: '—', hellip: '…'
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => (name in ENTITIES ? ENTITIES[name] : whole));
}

// Her istekte değişen ama içerikle ilgisi olmayan alanlar.
function stripVolatile(html) {
  return html
    .replace(/(name|id)="(__VIEWSTATE[A-Z]*|__EVENTVALIDATION|__VIEWSTATEENCRYPTED)"[^>]*value="[^"]*"/gi,
      (whole) => whole.replace(/value="[^"]*"/i, 'value=""'))
    .replace(/(ASP\.NET_SessionId|sfvrsn|_csrf|csrf_token|nonce|cachebust|[?&]v)=[^"'&;\s]*/gi, '$1=')
    .replace(/<input[^>]*type="hidden"[^>]*>/gi, '');
}

function sliceContent(html, slice, label) {
  if (!slice) return { html, sliced: true };
  const start = html.indexOf(slice.from);
  if (start < 0) return { html, sliced: false, warning: label + ': "' + slice.from + '" bulunamadı' };
  const rest = html.slice(start + slice.from.length);
  const end = rest.indexOf(slice.to);
  if (end < 0) return { html: rest, sliced: false, warning: label + ': "' + slice.to + '" bulunamadı' };
  return { html: rest.slice(0, end), sliced: true };
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, '\n')
  )
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// Başvuru açıldığında ASP.NET sayfası gerçek form alanları basar (select2, datepicker...).
function visibleFieldCount(html) {
  const withoutHidden = html
    .replace(/<div class="aspNetHidden">[\s\S]*?<\/div>/gi, ' ')
    .replace(/<input[^>]*type="hidden"[^>]*>/gi, ' ');
  const inputs = withoutHidden.match(/<input\b[^>]*>/gi) || [];
  const others = withoutHidden.match(/<(select|textarea)\b/gi) || [];
  return inputs.length + others.length;
}

function hash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function snapshotFromHtml(key, html) {
  const target = TARGETS[key];
  const cut = sliceContent(stripVolatile(html), target.slice, target.label);
  const text = htmlToText(cut.html);
  return { key, label: target.label, url: target.url, text, hash: hash(text), fields: visibleFieldCount(cut.html), warning: cut.warning || null };
}

// Açılma sinyalleri. Tek bir işarete güvenmiyoruz; sayfa yeniden tasarlansa bile
// form alanlarının belirmesi ya da "kapalıdır" ifadesinin kaybolması yakalanır.
function detectOpen(snapshots) {
  const basvuru = snapshots.basvuru;
  const sayfa = snapshots.sayfa;
  const reasons = [];
  if (basvuru && !/kapal[ıi]/i.test(basvuru.text)) reasons.push('Başvuru uygulamasında "kapalıdır" ifadesi kayboldu');
  if (basvuru && basvuru.fields > 0) reasons.push('Başvuru formunda ' + basvuru.fields + ' alan belirdi');
  if (basvuru && /ba[şs]vuru(lar)?\s*(a[çc][ıi]l|ba[şs]la)/i.test(basvuru.text)) reasons.push('Başvuru uygulamasında "başvurular açıldı" benzeri bir ifade var');
  if (sayfa && !/planlanmakta/i.test(sayfa.text)) reasons.push('Tanıtım sayfasındaki "randevu takvimimiz planlanmaktadır" ifadesi kalktı');
  return reasons;
}

function trim(text) {
  if (!text) return '(boş)';
  return text.length > SNIPPET ? text.slice(0, SNIPPET) + '\n…' : text;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000 * i));
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'tr,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(url + ' alınamadı: ' + lastError.message);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: false })
  });
  const body = await response.text();
  if (!response.ok) throw new Error('Telegram gönderimi başarısız: HTTP ' + response.status + ' ' + body.slice(0, 200));
}

function openMessage(reasons, snapshots) {
  return [
    '🚨 İTÜ TANITIM BAŞVURUSU AÇILMIŞ OLABİLİR',
    '',
    'Sebep:',
    ...reasons.map(reason => '• ' + reason),
    '',
    'Başvuru uygulaması:',
    BASVURU_URL,
    '',
    'Tanıtım sayfası:',
    SAYFA_URL,
    '',
    'Başvuru uygulamasında şu an yazan:',
    trim(snapshots.basvuru && snapshots.basvuru.text)
  ].join('\n');
}

function changeMessage(changed, snapshots, previous) {
  const lines = ['ℹ️ İTÜ tanıtım sayfasında değişiklik var (başvuru hâlâ kapalı görünüyor)', ''];
  for (const key of changed) {
    const before = previous && previous.targets && previous.targets[key] ? previous.targets[key].text : '';
    lines.push('— ' + snapshots[key].label + ' —', 'Önce:', trim(before), '', 'Şimdi:', trim(snapshots[key].text), '');
  }
  lines.push(BASVURU_URL, SAYFA_URL);
  return lines.join('\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
    console.error('TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID tanımlı değil. Depo ayarlarından secret olarak ekleyin.');
    process.exit(1);
  }

  const previous = readState();
  const now = new Date().toISOString();
  const snapshots = {};
  let failure = null;

  try {
    for (const key of Object.keys(TARGETS)) {
      snapshots[key] = snapshotFromHtml(key, await fetchWithRetry(TARGETS[key].url));
      if (snapshots[key].warning) console.warn('UYARI ' + snapshots[key].warning);
    }
  } catch (error) {
    failure = error.message;
  }

  if (failure) {
    // Sessiz arıza en kötüsü: üst üste birkaç başarısızlıktan sonra bir kez uyarı gönder.
    const failures = ((previous && previous.failures) || 0) + 1;
    console.error('Hata (' + failures + '. kez): ' + failure);
    if (!dryRun) {
      if (failures === 6) await sendTelegram('⚠️ İTÜ tanıtım takibi 30 dakikadır sayfaya ulaşamıyor.\n\nSon hata: ' + failure + '\n\nSiteyi bir de elle açıp bakın:\n' + BASVURU_URL);
      writeState(Object.assign({}, previous || { version: 1 }, { failures, lastError: failure, checkedAt: now }));
    }
    process.exit(1);
  }

  const reasons = detectOpen(snapshots);
  const changed = Object.keys(snapshots).filter(key =>
    !previous || !previous.targets || !previous.targets[key] || previous.targets[key].hash !== snapshots[key].hash);

  const wasOpen = Boolean(previous && previous.open);
  const messages = [];
  if (!previous) {
    messages.push([
      '✅ İTÜ tanıtım başvuru takibi başladı. Her 5 dakikada bir kontrol edilecek.',
      '',
      'Şu anki durum:',
      trim(snapshots.basvuru.text),
      '',
      'Başvuru açılır açılmaz buraya bildirim gelecek.',
      BASVURU_URL
    ].join('\n'));
  } else if (reasons.length && !wasOpen) {
    messages.push(openMessage(reasons, snapshots));
  } else if (changed.length) {
    messages.push(changeMessage(changed, snapshots, previous));
  }

  if (previous && previous.failures) {
    messages.unshift('✅ İTÜ tanıtım takibi yeniden çalışıyor.');
  }

  const heartbeatAt = previous && previous.heartbeatAt ? previous.heartbeatAt : now;
  const heartbeatStale = Date.now() - Date.parse(heartbeatAt) > HEARTBEAT_DAYS * 86400000;

  const state = {
    version: 1,
    checkedAt: now,
    heartbeatAt: heartbeatStale || !previous ? now : heartbeatAt,
    open: reasons.length > 0,
    reasons,
    failures: 0,
    targets: Object.fromEntries(Object.keys(snapshots).map(key => [key, {
      url: snapshots[key].url,
      hash: snapshots[key].hash,
      fields: snapshots[key].fields,
      text: trim(snapshots[key].text)
    }]))
  };

  console.log(JSON.stringify({ open: state.open, reasons, changed, messages: messages.length, dryRun }, null, 2));
  if (dryRun) {
    for (const message of messages) console.log('\n--- gönderilecek mesaj ---\n' + message);
    return;
  }
  for (const message of messages) await sendTelegram(message);
  writeState(state);
}

module.exports = { snapshotFromHtml, detectOpen, stripVolatile, htmlToText, sliceContent, visibleFieldCount, hash, TARGETS, BASVURU_URL, SAYFA_URL };

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
