import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = process.env.KHI_LOCAL_UI_ORIGIN;
assert.ok(origin && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin), 'Set a loopback KHI_LOCAL_UI_ORIGIN');
const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const modulePath = readdirSync(cache).map(entry => join(cache, entry, 'node_modules', 'playwright', 'index.mjs')).find(existsSync);
assert.ok(modulePath, 'Cached Playwright is required');
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const paths = ['/', '/discover', '/discover/demo-khi-watercolor-evening', '/drops', '/drops/demo-khi-watercolor-pass'];
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    for (const path of paths) {
      const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, path);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}px overflow at ${path}`);
      assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(Boolean), [], `${path} alert`);
      if (path === '/') {
        assert.ok(await page.locator('a[href^="/discover/demo-khi-"]').count());
        assert.ok(await page.getByRole('link', { name: /Watercolor Pass/ }).count());
      }
      if (path === '/discover') {
        assert.ok(await page.getByRole('link', { name: /Watercolor Evening/ }).count());
        assert.ok((await page.locator('body').innerText()).includes('From Rs 1,800'));
      }
      if (path === '/discover/demo-khi-watercolor-evening') {
        assert.ok(await page.getByRole('heading', { name: /Watercolor Evening/ }).count());
        assert.ok((await page.locator('body').innerText()).includes('From Rs 1,800'));
      }
      if (path === '/drops') {
        assert.ok(await page.getByRole('link', { name: /Watercolor Pass/ }).count());
        assert.ok((await page.locator('body').innerText()).includes('Rs 1,250'));
      }
      if (path === '/drops/demo-khi-watercolor-pass') {
        assert.ok(await page.getByRole('heading', { name: /Watercolor Pass/ }).count());
        assert.ok((await page.locator('body').innerText()).includes('Rs 1,250'));
      }
    }
    await page.goto(origin + '/discover?area=dha&budget=under-2000', { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('Area').inputValue(), 'dha');
    assert.equal(await page.getByLabel('Budget').inputValue(), 'under-2000');
    assert.ok(await page.getByRole('link', { name: /Watercolor Evening/ }).count());
    assert.equal(await page.getByRole('link', { name: /Table For Two/ }).count(), 0);
    await page.goto(origin + '/discover?area=dha&category=movies', { waitUntil: 'networkidle' });
    assert.ok((await page.locator('body').innerText()).includes('0 experiences found'));
    await page.goto(origin + '/discover/demo-khi-invalid-slug', { waitUntil: 'networkidle' });
    assert.ok((await page.locator('body').innerText()).includes('404'));
    await page.goto(origin + '/drops/demo-khi-invalid-slug', { waitUntil: 'networkidle' });
    assert.ok((await page.locator('body').innerText()).includes('404'));
    await page.close();
    console.log(`${width}px: five routes, prices, filter, empty result, invalid slugs, no overflow`);
  }
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('No browser console or hydration errors');
} finally {
  await browser.close();
}
