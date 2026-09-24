// Keep offline exports self-contained. Review the JSON, then run this script.
const fs = require('node:fs');
const file = 'index.html';
const data = JSON.parse(fs.readFileSync('data/curriculum-2026-2027.json', 'utf8'));
const html = fs.readFileSync(file, 'utf8');
const pattern = /^const MUFREDAT_2026 = .*;$/m;
if (!pattern.test(html)) throw Error('Curriculum marker missing');
fs.writeFileSync(file, html.replace(pattern, () => 'const MUFREDAT_2026 = ' + JSON.stringify(data) + ';'));
