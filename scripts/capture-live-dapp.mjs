import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://koliance.oodai.space';
const OUT_DIR = path.resolve('video/public/textures/live');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const PAGES = [
  { name: 'home', path: '/', waitMs: 4000 },
  { name: 'console', path: '/console', waitMs: 4000 },
  { name: 'agentcard', path: '/agentcard', waitMs: 4000 },
  { name: 'market', path: '/market', waitMs: 4000 },
  { name: 'perp', path: '/perp', waitMs: 4000 },
];

async function run() {
  console.log('[capture] Launching browser to capture live DApp from', BASE_URL);
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  for (const p of PAGES) {
    const url = `${BASE_URL}${p.path}`;
    console.log(`[capture] Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for React hydration & fonts
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(p.waitMs || 3000);

      const filePath = path.join(OUT_DIR, `${p.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`[capture] Saved ${p.name} viewport screenshot to ${filePath}`);

      // Scroll a bit to trigger lazy components if any, then capture full page
      const fullPath = path.join(OUT_DIR, `${p.name}_full.png`);
      await page.screenshot({ path: fullPath, fullPage: true });
      console.log(`[capture] Saved ${p.name}_full screenshot to ${fullPath}`);
    } catch (err) {
      console.error(`[capture] Error on ${p.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('[capture] All captures completed successfully!');
}

run().catch(console.error);
