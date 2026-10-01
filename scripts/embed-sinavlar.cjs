// Embeds the reviewed exam topic lists so offline exports stay self-contained.
// Review data/sinav-konulari-2026.json, then run this script; --check only verifies.
const fs = require('node:fs');
const file = 'index.html';
const data = JSON.parse(fs.readFileSync('data/sinav-konulari-2026.json', 'utf8'));
const html = fs.readFileSync(file, 'utf8');
const pattern = /^const SINAV_KONULARI = .*;$/m;
if (!pattern.test(html)) throw Error('Exam topics marker missing');
const yeni = html.replace(pattern, () => 'const SINAV_KONULARI = ' + JSON.stringify(data) + ';');
if (process.argv.includes('--check')) { if (yeni !== html) throw Error('Run node scripts/embed-sinavlar.cjs'); }
else fs.writeFileSync(file, yeni);
