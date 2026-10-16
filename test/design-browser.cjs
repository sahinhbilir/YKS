// Synthetic student data only. Verify themes and touch navigation in a real browser.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const html = fs.readFileSync('index.html', 'utf8').replace(/<script type="module">[\s\S]*?<\/script>/, '');
const out = process.env.YKS_UI_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'yks-design-'));
fs.mkdirSync(out, {recursive:true});
const luminance = color => {
  const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255)
    .map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
const contrast = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (hi + .05) / (lo + .05);
};
async function readable(page, selector, pseudo) {
  const colors = await page.locator(selector).first().evaluate((e, pseudo) => {
    const s = getComputedStyle(e, pseudo), bg = getComputedStyle(e).backgroundColor;
    return [s.color, bg];
  }, pseudo);
  assert(contrast(...colors) >= 4.5, selector + ': ' + contrast(...colors));
}
const seed = () => {
  D = varsayilan(); D.rol = 'ogrenci'; D.ayar.testTarih = '2026-10-16';
  D.ayar.planBasi = D.ayar.donemBasi = '2026-08-31'; D.ayar.donemElle = true;
  D.ogr = [{no:1, ad:'Sentetik Öğrenci', sube:'12-A', alan:'SAY', sinif:12, kap:6,
    off:[6], aktif:true, ilkAktif:gunNo('2026-08-31'), maddeler:[], rutin:{},
    dakika:{hi:200, hs:290, deneme:false}, telafiGunKap:3, sonucBilgiOkundu:true}];
  EK = {ogr:0, sekme:'ana', hafta:null, girisAcik:{}};
  bulutYedekPlanla = () => {}; ogretmenDinlemeyiBaslat = () => {};
  kendiPlanKur(0, Object.fromEntries(kendiPlanDersleri('SAY').map(d => [d, 'bilir'])), '2026-12-21');
  ciz();
};
(async () => {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-dev-shm-usage'],
    ...(process.env.YKS_CHROMIUM ? {executablePath:process.env.YKS_CHROMIUM} : {})});
  try {
    for (const width of [320, 390, 1440]) for (const scheme of ['light','dark']) {
      const context = await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
      await context.route('**/*', r => r.request().url().startsWith('http://localhost/')
        ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost/');
      await page.locator('#ogrenciGirisAd').waitFor();
      await readable(page, '#ogrenciBulutGiris');
      await readable(page, '#ogrenciGirisAd', '::placeholder');
      const fieldColors = await page.locator('#ogrenciGirisAd').evaluate(e => {
        const s = getComputedStyle(e); return [s.borderTopColor, s.backgroundColor];
      });
      assert(contrast(...fieldColors) >= 3, 'visible input boundary');
      await page.locator('#ogrenciGirisAd').fill('Taslak kullanıcı');
      // Explicit overrides work against the OS, persist on reload, and do not redraw a form.
      for (const preference of ['dark','light','sistem']) {
        await page.locator('[data-tema]').selectOption(preference);
        assert.equal(await page.locator('#ogrenciGirisAd').inputValue(), 'Taslak kullanıcı');
        assert.equal(await page.locator('html').getAttribute('data-theme'), preference === 'sistem' ? null : preference);
        await readable(page, '#ogrenciBulutGiris');
      }
      await page.locator('[data-tema]').selectOption('dark');
      await page.reload(); await page.locator('#ogrenciGirisAd').waitFor();
      assert.equal(await page.locator('[data-tema]').inputValue(), 'dark');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.locator('[data-tema]').selectOption('sistem');
      await page.evaluate(seed);
      assert.equal(await page.locator('.ana-pano .yks-yolu').count(), 1);
      assert.equal(await page.locator('.ana-pano .dn-yol .yg-yks').count(), 1, 'full exam horizon remains');
      const more = page.locator('[aria-controls="hesapMenusu"]');
      if (width < 820) {
        assert.equal(await page.locator('#hesapMenusu').isVisible(), false);
        await more.click();
        const box = await page.locator('#hesapMenusu').boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width, 'account menu stays on screen');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#hesapMenusu').isVisible(), false);
        await more.focus(); await page.keyboard.press('Enter');
      }
      await page.locator('#hesapMenusu [data-sekme="ayarlar"]').click();
      assert.equal(await page.evaluate(() => EK.sekme), 'ayarlar');
      await page.locator('[data-tema]').selectOption(scheme === 'light' ? 'dark' : 'light');
      await page.locator('[data-tema]').selectOption('sistem');
      await page.evaluate(() => { EK.sekme = 'giris'; ciz(); });
      await page.locator('.sonuc-not').first().click();
      await readable(page, '.sonuc-not.secili');
      const save = await page.locator('#sonucKaydet').boundingBox();
      assert(save.y >= 0 && save.y + save.height <= 900, 'save is reachable without scrolling to the end');
      assert(await page.locator('#sonucKaydet').evaluate(e => {
        const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#sonucKaydet')===e;
      }), 'sticky save is not covered');
      await page.screenshot({path:path.join(out, `results-${width}-${scheme}.png`)});
      await page.evaluate(() => { D.rol='rehber'; EK.sekme='plan'; ciz(); PENCERE={g:4,s:100,arama:'',kapsam:'ogrenci'}; pencereCiz(); });
      await readable(page, '.turDugme.secili');
      await readable(page, '.kapsamDugme.secili');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      assert.deepEqual(errors, []);
      console.log('PASS design:', width, scheme);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
