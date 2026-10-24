// Playwright Headless Automation Bridge
// Supports headless execution ('使用headless无头模式操作浏览器') with preserved session state

const { chromium } = require('@playwright/test');
const { getStorageStatePath } = require('./session_exporter');
const fs = require('fs');

async function createHeadlessContext(options = {}) {
  const storageState = getStorageStatePath();
  const contextOptions = {
    headless: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    ...options,
  };

  if (fs.existsSync(storageState)) {
    try {
      const stateContent = JSON.parse(fs.readFileSync(storageState, 'utf8'));
      if (stateContent.cookies && stateContent.cookies.length > 0) {
        contextOptions.storageState = storageState;
      }
    } catch (e) {
      // Ignore malformed storageState
    }
  }

  // Detect installed system Chrome binary across platforms
  let executablePath = options.executablePath;
  if (!executablePath) {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  }

  const launchOptions = {
    headless: options.headless !== undefined ? options.headless : true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

module.exports = {
  createHeadlessContext,
};
