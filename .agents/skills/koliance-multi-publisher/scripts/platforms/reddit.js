// Reddit Publisher Adapter
// Dual engine support: Active Chrome (AppleScript) and Headless Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab, navigateTab } = require('../lib/chrome_bridge');

const DEFAULT_ARTICLE_PATH = path.resolve(__dirname, '../../resources/articles/01_reddit.md');
const REDDIT_SUBMIT_URL = 'https://www.reddit.com/submit';

function prepareRedditContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let title = 'Introducing Koliance: How We Built an On-Chain Trust & Economic Sovereignty Layer for Autonomous AI Agents on Monad (10k TPS)';
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith('# Title:')) {
      title = line.replace(/^#\s*Title:\s*/, '').trim();
      break;
    }
  }

  return { title, content };
}

async function publishRedditActiveSession(articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, content } = prepareRedditContent(articlePath);

  const fillJs = `
    (function() {
      var titleWrapper = document.querySelector("faceplate-textarea-input");
      var titleEl = titleWrapper && titleWrapper.shadowRoot ? titleWrapper.shadowRoot.querySelector("textarea") : null;
      var composer = document.querySelector("shreddit-composer");
      var editor = composer ? composer.querySelector("[contenteditable=true]") : null;

      if (!titleEl && !editor) {
        return JSON.stringify({ ok: false, notReady: true });
      }

      if (titleEl) {
        titleEl.value = ${JSON.stringify(title)};
        titleEl.dispatchEvent(new Event("input", { bubbles: true }));
        titleEl.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (editor) {
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, ${JSON.stringify(content)});
      }

      var actionResult = "staged";
      if (${JSON.stringify(action)} === "publish") {
        var postBtn = Array.from(document.querySelectorAll("button")).find(function(b) {
          return b.innerText && b.innerText.trim().toLowerCase() === "post";
        });
        if (postBtn && !postBtn.disabled) {
          postBtn.click();
          actionResult = "published";
        }
      }

      return JSON.stringify({
        ok: true,
        action: actionResult,
        titleLen: titleEl ? titleEl.value.length : 0,
        bodyLen: editor ? editor.textContent.length : 0
      });
    })()
  `;

  let rawRes = executeInTab('reddit.com/submit', fillJs);
  if (rawRes === 'ERR_TAB_NOT_FOUND') {
    // If on search or other page, navigate to submit
    const navRes = navigateTab('reddit.com', REDDIT_SUBMIT_URL);
    if (navRes === 'ERR_TAB_NOT_FOUND') {
      throw new Error('[WARN] Reddit tab not found. Please navigate to https://www.reddit.com/submit in Chrome.');
    }
  } else {
    try {
      const parsed = JSON.parse(rawRes);
      if (parsed && parsed.ok) {
        return parsed;
      }
    } catch (e) {}
  }

  // Poll for submit elements to appear
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    rawRes = executeInTab('reddit.com/submit', fillJs);
    if (rawRes && rawRes !== 'ERR_TAB_NOT_FOUND') {
      try {
        const parsed = JSON.parse(rawRes);
        if (parsed && parsed.ok) {
          return parsed;
        }
      } catch (e) {}
    }
  }

  throw new Error('[ERROR] Timed out waiting for Reddit submit elements to appear');
}

async function publishRedditHeadless(page, articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, content } = prepareRedditContent(articlePath);
  await page.goto(REDDIT_SUBMIT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (page.url().includes('login') || page.url().includes('register')) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED',
      platform: 'reddit',
      message: 'Reddit requires active authentication. Session state missing or expired.'
    };
  }

  try {
    await page.waitForSelector('faceplate-textarea-input', { timeout: 8000 });
  } catch (e) {
    const isLogin = await page.evaluate(() => {
      return !!document.querySelector('auth-flow-modal, a[href*="login"], faceplate-tracker[source="auth"]') ||
        document.body.innerText.includes('Log In') ||
        document.body.innerText.includes('Sign Up');
    }).catch(() => false);

    if (isLogin || page.url().includes('login') || page.url().includes('register')) {
      return {
        ok: false,
        error: 'AUTH_REQUIRED',
        platform: 'reddit',
        message: 'Reddit requires active user session. Please run with active Chrome session engine.'
      };
    }
    return {
      ok: false,
      error: 'TIMEOUT',
      platform: 'reddit',
      message: e.message
    };
  }

  const titleWrapper = await page.$('faceplate-textarea-input');
  if (titleWrapper) {
    await titleWrapper.evaluate((el, t) => {
      const inner = el.shadowRoot ? el.shadowRoot.querySelector('textarea') : null;
      if (inner) {
        inner.value = t;
        inner.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, title);
  }

  await page.waitForSelector('shreddit-composer [contenteditable=true]', { timeout: 10000 });
  await page.click('shreddit-composer [contenteditable=true]');
  await page.keyboard.insertText(content);

  return {
    ok: true,
    action: 'staged',
    platform: 'reddit',
    title,
  };
}

module.exports = {
  publishRedditActiveSession,
  publishRedditHeadless,
  prepareRedditContent,
  REDDIT_SUBMIT_URL,
};
