// Optional local browser check. Requires a running app at localhost:3000 and cached Playwright.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const runner = readdirSync(cache).map((entry) => join(cache, entry, 'node_modules', 'playwright', 'index.mjs')).find(existsSync);
assert.ok(runner, 'Playwright is not cached. Run npx.cmd --yes --package=playwright -- playwright --version first.');
const { chromium } = await import(pathToFileURL(runner).href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const appErrors = [];
  page.on('pageerror', (error) => appErrors.push(error.message));
  await page.goto('http://localhost:3000/');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).isVisible(), true);
  assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible(), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByLabel('When').selectOption('weekend');
  await page.waitForURL('**/?when=weekend');
  await page.getByLabel('Budget').selectOption('under-2000');
  await page.waitForURL('**/?when=weekend&budget=under-2000');
  await page.goBack();
  assert.equal(await page.getByLabel('Budget').inputValue(), '');
  assert.equal(await page.getByLabel('When').inputValue(), 'weekend');
  await page.goForward();
  assert.equal(await page.getByLabel('Budget').inputValue(), 'under-2000');
  await page.reload();
  assert.equal(await page.getByLabel('When').inputValue(), 'weekend');
  assert.equal(await page.getByLabel('Budget').inputValue(), 'under-2000');
  await page.getByRole('button', { name: 'Explore Karachi' }).click();
  await page.waitForURL('**/discover?when=weekend&budget=under-2000');
  await page.goto('http://localhost:3000/discover?when=invalid&budget=under-2000');
  await page.waitForURL('**/discover?budget=under-2000');
  assert.equal(await page.getByLabel('When').inputValue(), '');
  assert.equal(await page.getByLabel('Budget').inputValue(), 'under-2000');
  assert.deepEqual(appErrors, []);
  console.log('PASS responsive landmarks, no horizontal overflow, filter URL persistence, Back/Forward, reload, CTA and malformed parameter normalization');
} finally {
  await browser.close();
}
