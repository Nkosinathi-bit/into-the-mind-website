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
      assert.equal(await page.locator('script[src="script.js"][defer]').count(), 1, file + ': shared script');
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({width, height:900});
        await checkWidth(page, file + ' width ' + width);
      }
      for (const src of await page.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))) {
        assert.equal((await context.request.get(new URL(src, base).toString())).status(), 200, file + ': ' + src);
      }
    }
    await page.goto(base + '/articles.html', {waitUntil:'domcontentloaded'});
    await page.setViewportSize({width:390, height:844});
    const visibleCards = () => page.locator('.article-card:visible').count();
    assert.equal(await visibleCards(), 8);
    for (const [topic, count] of [['Stress',2], ['Anxiety',3], ['Depression',2], ['Mindfulness',2], ['Sleep',1], ['All Topics',8]]) {
      await page.getByRole('button', {name:topic, exact:true}).click();
      assert.equal(await visibleCards(), count, topic);
      assert.equal(await page.getByRole('button', {name:topic, exact:true}).getAttribute('aria-pressed'), 'true');
    }
    await page.getByLabel('Find something to read').fill('SLEEP HYGIENE');
    assert.equal(await visibleCards(), 1);
    await page.getByRole('button', {name:'Anxiety', exact:true}).click();
    assert.equal(await visibleCards(), 0);
    assert.equal(await page.locator('#article-empty').isVisible(), true);
    await page.getByRole('button', {name:'Reset filters', exact:true}).click();
    assert.equal(await visibleCards(), 8);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'article-search');

    // Bookmarks work on cards and reading pages, and persist across reloads.
    await page.getByRole('button', {name:'Save Managing Academic Stress for later', exact:true}).click();
    await page.getByLabel('Saved only', {exact:false}).check();
    assert.equal(await visibleCards(), 1);
    await page.goto(base + '/article-anxiety.html');
    await page.getByRole('button', {name:'Save Understanding Anxiety for later', exact:true}).focus();
    await page.keyboard.press('Space');
    assert.equal(await page.getByRole('button', {name:'Remove Understanding Anxiety from saved articles', exact:true}).getAttribute('aria-pressed'), 'true');
    await page.goto(base + '/articles.html?saved=1');
    assert.equal(await visibleCards(), 2);
    await page.reload();
    assert.equal(await visibleCards(), 2);
    await page.getByRole('button', {name:'Remove Understanding Anxiety from saved articles', exact:true}).click();
    assert.equal(await visibleCards(), 1);
    await page.goto(base + '/articles.html?topic=sleep');
    assert.equal(await visibleCards(), 1);

    // All three former newsletter forms build actual reading links.
    for (const file of ['articles.html','resources.html','self-care.html']) {
      await page.goto(base + '/' + file);
      await page.getByLabel('What would you like to explore?').selectOption('sleep');
      await page.getByRole('button', {name:'Build my reading plan', exact:true}).click();
      assert.equal(await page.locator('[data-plan-result] a').getAttribute('href'), 'article-sleep-hygiene.html', file);
      assert.equal(await page.locator('[data-plan-result]').evaluate(el => el === document.activeElement), true);
      await checkWidth(page, file + ' reading plan');
    }

    // Challenge progress supports completion, persistence and undo.
    await page.getByRole('button', {name:'Mark day 1 complete', exact:true}).click();
    await page.reload();
    assert.equal(await page.locator('[data-challenge] progress').getAttribute('value'), '1');
    await page.getByRole('button', {name:'Undo day 1 completion', exact:true}).click();
    for (let day = 1; day <= 7; day++) {
      await page.getByRole('button', {name:`Mark day ${day} complete`, exact:true}).click();
    }
    assert.equal(await page.locator('[data-challenge] progress').getAttribute('value'), '7');
    assert.match(await page.locator('[data-challenge-summary]').textContent(), /7 of 7 complete/);

    // Advance a controlled clock instead of waiting a full study session.
    await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
    await page.getByLabel('Make time for').selectOption('60');
    assert.equal(await page.locator('[data-timer-display]').textContent(), '01:00');
    await page.getByRole('button', {name:'Start timer', exact:true}).click();
    await page.clock.runFor(10000);
    assert.equal(await page.locator('[data-timer-display]').textContent(), '00:50');
    await page.getByRole('button', {name:'Pause timer', exact:true}).click();
    await page.clock.runFor(5000);
    assert.equal(await page.locator('[data-timer-display]').textContent(), '00:50');
    await page.getByRole('button', {name:'Resume timer', exact:true}).click();
    await page.clock.runFor(50000);
    assert.equal(await page.locator('[data-timer-display]').textContent(), '00:00');
    assert.match(await page.locator('[data-timer-status]').textContent(), /Session complete/);
    assert.equal(await page.getByLabel('Make time for').isEnabled(), true);
    await page.getByRole('button', {name:'Start again', exact:true}).click();
    await page.getByRole('button', {name:'Reset timer', exact:true}).click();
    await page.clock.runFor(3000);
    assert.equal(await page.locator('[data-timer-display]').textContent(), '01:00');
    await page.getByLabel('Make time for').selectOption('300');
    assert.equal(await page.locator('[data-timer-display]').textContent(), '05:00');
    await page.clock.resume();

    // Drafts are validated, rendered as text and downloaded without network submission.
    await page.goto(base + '/contact.html');
    let formPosts = 0;
    page.on('request', request => { if (request.method() === 'POST') formPosts++; });
    await page.getByRole('button', {name:'Preview message', exact:true}).click();
    assert.equal(await page.locator('[data-message-preview]').isVisible(), false);
    await page.getByLabel('Full Name').fill('Student Example');
    await page.getByLabel('Email Address', {exact:false}).fill('invalid-email');
    await page.getByLabel('Subject', {exact:false}).selectOption('feedback');
    await page.getByLabel('Your Message').fill('<img src=x onerror=alert(1)> Feedback about the website.');
    await page.getByRole('button', {name:'Preview message', exact:true}).click();
    assert.equal(await page.locator('[data-message-preview]').isVisible(), false);
    await page.getByLabel('Email Address', {exact:false}).fill('student@example.com');
    await page.getByRole('button', {name:'Preview message', exact:true}).click();
    assert.equal(await page.locator('[data-message-preview]').isVisible(), true);
    assert.match(await page.locator('[data-message-preview] pre').textContent(), /Message draft — not sent/);
    assert.match(await page.locator('[data-message-preview] pre').textContent(), /<img src=x onerror=alert\(1\)>/);
    assert.equal(await page.locator('[data-message-preview] pre img').count(), 0);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', {name:'Download message (.txt)', exact:true}).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'into-the-mind-message.txt');
    assert.match(fs.readFileSync(await download.path(), 'utf8'), /student@example.com/);
    await page.getByLabel('Your Message').fill('An updated draft.');
    assert.equal(await page.locator('[data-message-preview]').isVisible(), false);
    await page.getByRole('button', {name:'Preview message', exact:true}).click();
    await page.getByRole('button', {name:'Clear form', exact:true}).click();
    assert.equal(await page.getByLabel('Full Name').inputValue(), '');
    assert.equal(await page.locator('[data-message-preview]').isVisible(), false);
    assert.equal(formPosts, 0);
    const stored = await page.evaluate(() => localStorage.getItem('into-the-mind:v1'));
    assert.ok(!stored.includes('student@example.com') && !stored.includes('Student Example'));

    // Local storage denial and malformed data must not break the tools.
    const blocked = await browser.newContext();
    await localOnly(blocked);
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Storage blocked', 'SecurityError'); }}));
    const blockedPage = await blocked.newPage();
    blockedPage.on('pageerror', error => errors.push(String(error)));
    await blockedPage.goto(base + '/articles.html');
    await blockedPage.getByRole('button', {name:'Save Managing Academic Stress for later', exact:true}).click();
    await blockedPage.getByLabel('Saved only', {exact:false}).check();
    assert.equal(await blockedPage.locator('.article-card:visible').count(), 1);
    assert.match(await blockedPage.locator('[data-storage-note]').textContent(), /could not save/);
    await blocked.close();
    const malformed = await browser.newContext();
    await localOnly(malformed);
    await malformed.addInitScript(() => localStorage.setItem('into-the-mind:v1', '{broken'));
    const malformedPage = await malformed.newPage();
    malformedPage.on('pageerror', error => errors.push(String(error)));
    await malformedPage.goto(base + '/self-care.html');
    await malformedPage.getByRole('button', {name:'Mark day 1 complete', exact:true}).click();
    assert.equal(await malformedPage.locator('[data-challenge] progress').getAttribute('value'), '1');
    await malformed.close();

    const noJs = await browser.newContext({javaScriptEnabled:false, viewport:{width:360,height:800}});
    await localOnly(noJs);
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(base + '/articles.html');
    assert.equal(await noJsPage.locator('.article-card:visible').count(), 8);
    assert.equal(await noJsPage.locator('[data-save-article]:visible').count(), 0);
    await noJsPage.goto(base + '/contact.html');
    assert.equal(await noJsPage.getByRole('button', {name:'Preview message',exact:true}).isDisabled(), true);
    await noJsPage.locator('label[for="faq1"]').click();
    assert.equal(await noJsPage.locator('#faq1').isChecked(), true);
    await noJs.close();

    console.log('PASS: all ' + pages.length + ' pages, images, skip links and four viewport widths; search/topic/saved filters; cross-page bookmarks; three reading plans; challenge persistence/undo; timer start/pause/resume/reset/completion; safe message preview/download; blocked/corrupt storage; no-JavaScript fallback.');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack); process.exit(1); });

