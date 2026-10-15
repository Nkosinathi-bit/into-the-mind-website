const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH);
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8765';
const deadline = setTimeout(() => { console.error('Browser checks timed out'); process.exit(1); }, 120000);
deadline.unref();

async function localOnly(context) {
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
}

async function checkWidth(page, label) {
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    wide: Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map(el => el.tagName + '.' + el.className)
  }));
  assert.ok(size.content <= size.viewport + 1, label + ': ' + JSON.stringify(size));
}

(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    await localOnly(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const fs = require('node:fs');
    const pages = fs.readdirSync('.').filter(file => file.endsWith('.html'));
    for (const file of pages) {
      await page.goto(base + '/' + file, {waitUntil: 'domcontentloaded'});
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('class'), 'skip-link', file);
      assert.equal(await page.locator('form input:not([disabled]),form textarea:not([disabled]),form select:not([disabled]),form button:not([disabled])').count(), 0, file);
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height:900});
        await checkWidth(page, file + ' width ' + width);
      }
      for (const src of await page.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))) {
        assert.equal((await context.request.get(new URL(src, base).toString())).status(), 200, file + ': ' + src);
      }
    }
    await page.goto(base + '/articles.html', {waitUntil:'domcontentloaded'});
    for (const link of await page.locator('.filter-button').all()) {
      const target = await link.getAttribute('href');
      assert.ok(await page.locator(target).count(), target);
    }
    console.log('PASS: all ' + pages.length + ' HTML pages, image files, keyboard skip links, inactive forms, topic targets and desktop/mobile widths.');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack); process.exit(1); });
