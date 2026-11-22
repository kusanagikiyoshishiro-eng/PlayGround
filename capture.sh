#!/usr/bin/env bash
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to the evidence output directory}"
export CAPTURE_URL CAPTURE_DIR
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node --input-type=module <<'NODE'
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const output = process.env.CAPTURE_DIR;
const url = process.env.CAPTURE_URL;
const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
const require = createRequire(join(runtime, 'package.json'));
const { chromium } = require('playwright');
const config = JSON.parse(readFileSync(join(runtime, 'linux.json'), 'utf8'));
if (process.platform === 'linux') {
  const displayFile = join(runtime, 'display');
  process.env.DISPLAY ||= ':' + readFileSync(displayFile, 'utf8').trim();
}
mkdirSync(output, { recursive: true });
let browser;
let exitCode = 0;
const infrastructureFailure = error => Object.assign(error, { exitCode: 75 });
const defect = message => Object.assign(new Error(message), { exitCode: 1 });
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => { throw infrastructureFailure(error); });
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } }).catch(error => { throw infrastructureFailure(error); });
    page.setDefaultTimeout(30000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    } catch (error) {
      throw infrastructureFailure(error);
    }
    if (!response?.ok()) {
      const status = response?.status();
      if (!status || [408, 429, 500, 502, 503, 504].includes(status)) {
        throw infrastructureFailure(new Error(`Temporary navigation failure: HTTP ${status ?? 'no response'} for ${url}`));
      }
      throw defect(`Preview returned HTTP ${status} for ${url}`);
    }
    try {
      await page.locator('#game').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('#lobby.active .hero-card h1').waitFor({ state: 'visible', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
    } catch (error) {
      throw defect(`Expected game lobby did not render (${label}): ${error.message}`);
    }
    if (pageErrors.length) throw defect(`Browser runtime error (${label}): ${pageErrors.join('; ')}`);
    const rendered = await page.evaluate(() => {
      const canvas = document.querySelector('#gameCanvas');
      const heading = document.querySelector('#lobby.active .hero-card h1')?.innerText || '';
      let webgl = false;
      try { webgl = !!(canvas?.getContext('webgl2') || canvas?.getContext('webgl')); } catch {}
      return { heading, width: canvas?.width || 0, height: canvas?.height || 0, webgl };
    });
    if (!rendered.heading.includes('TOILET') || rendered.width < 100 || rendered.height < 100 || !rendered.webgl) {
      throw defect(`Game rendering check failed (${label}): ${JSON.stringify(rendered)}`);
    }
    const path = join(output, `final-${label}.png`);
    try {
      await page.screenshot({ path, fullPage: false, timeout: 30000 });
    } catch (error) {
      throw infrastructureFailure(error);
    }
    if (statSync(path).size < 1024) throw defect(`Screenshot is unexpectedly small: ${path}`);
    console.log(`Captured ${label}: ${path} (${width}x${height})`);
    await page.close().catch(error => { throw infrastructureFailure(error); });
  }
} catch (error) {
  console.error(error);
  exitCode = error.exitCode || 1;
} finally {
  if (browser) {
    try { await browser.close(); }
    catch (error) { console.error(`Browser cleanup failed: ${error.message}`); if (!exitCode) exitCode = 75; }
  }
}
process.exitCode = exitCode;
NODE
