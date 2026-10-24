// Dev.to Publisher Adapter
// Dual engine support: Active Chrome (AppleScript) and Headless Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab, navigateTab } = require('../lib/chrome_bridge');

const DEFAULT_ARTICLE_PATH = path.resolve(__dirname, '../../resources/articles/03_devto.md');
const DEVTO_NEW_URL = 'https://dev.to/new';

function parseDevToMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) {
    const rawFront = match[1];
    const body = match[2].trim();
    const titleMatch = rawFront.match(/title:\s*(.*)/);
    const tagsMatch = rawFront.match(/tags:\s*(.*)/);
    return {
      title: titleMatch ? titleMatch[1].trim() : 'Koliance Architecture',
      tags: tagsMatch ? tagsMatch[1].trim() : 'web3, ai, typescript, solidity',
      body,
    };
  }
  return {
    title: 'Architecting Economic Sovereignty for Autonomous AI Agents on Monad Parallel EVM',
    tags: 'web3, ai, typescript, solidity',
    body: content,
  };
}

async function publishDevToActiveSession(articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const article = parseDevToMarkdown(articlePath);

  const fillJs = `
    (function() {
      var titleEl = document.querySelector("#article-form-title");
      var bodyEl = document.querySelector("#article_body_markdown");
      var tagEl = document.querySelector("#tag-input");
      if (!titleEl || !bodyEl) {
        return JSON.stringify({ ok: false, notReady: true });
      }

      titleEl.value = ${JSON.stringify(article.title)};
      titleEl.dispatchEvent(new Event("input", { bubbles: true }));

      bodyEl.value = ${JSON.stringify(article.body)};
      bodyEl.dispatchEvent(new Event("input", { bubbles: true }));

      if (tagEl) {
        tagEl.value = ${JSON.stringify(article.tags)};
        tagEl.dispatchEvent(new Event("input", { bubbles: true }));
      }

      var actionResult = "staged";
      if (${JSON.stringify(action)} === "publish") {
        var pubBtn = document.querySelector(".c-btn--primary");
        if (pubBtn) {
          pubBtn.click();
          actionResult = "published";
        }
      } else if (${JSON.stringify(action)} === "draft") {
        var draftBtn = document.querySelector(".c-btn--secondary");
        if (draftBtn) {
          draftBtn.click();
          actionResult = "draft_saved";
        }
      }

      return JSON.stringify({
        ok: true,
        action: actionResult,
        titleLen: titleEl.value.length,
        bodyLen: bodyEl.value.length
      });
    })()
  `;

  // First try direct execution in dev.to tab
  let rawRes = executeInTab('dev.to', fillJs);
  if (rawRes === 'ERR_TAB_NOT_FOUND') {
    throw new Error('[WARN] Dev.to editor tab not found. Please navigate to https://dev.to/new in Chrome.');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawRes);
  } catch (e) {
    // Malformed response
  }

  // If not on editor (e.g. preview or article page), navigate to DEVTO_NEW_URL and poll
  if (!parsed || !parsed.ok) {
    navigateTab('dev.to', DEVTO_NEW_URL);
    // Poll for editor to load
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 800));
      rawRes = executeInTab('dev.to', fillJs);
      if (rawRes && rawRes !== 'ERR_TAB_NOT_FOUND') {
        try {
          parsed = JSON.parse(rawRes);
          if (parsed && parsed.ok) {
            return parsed;
          }
        } catch (e) {}
      }
    }
    throw new Error('[ERROR] Timed out waiting for Dev.to editor inputs to appear after navigation');
  }

  return parsed;
}

async function publishDevToHeadless(page, articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const article = parseDevToMarkdown(articlePath);
  await page.goto(DEVTO_NEW_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (page.url().includes('/enter') || page.url().includes('sign_in')) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED',
      platform: 'devto',
      message: 'Dev.to requires active authentication. Session state missing or expired.'
    };
  }

  try {
    await page.waitForSelector('#article-form-title', { timeout: 8000 });
  } catch (e) {
    const isLogin = await page.evaluate(() => {
      return !!document.querySelector('#user_email, input[type=email], a[href*="enter"], button[data-tracking-id="nav_login"]') ||
        document.body.innerText.includes('Join the DEV Community') ||
        document.body.innerText.includes('Sign in');
    }).catch(() => false);

    if (isLogin || page.url().includes('/enter') || page.url().includes('sign_in')) {
      return {
        ok: false,
        error: 'AUTH_REQUIRED',
        platform: 'devto',
        message: 'Dev.to requires active user session. Please run with active Chrome session engine.'
      };
    }
    return {
      ok: false,
      error: 'TIMEOUT',
      platform: 'devto',
      message: e.message
    };
  }

  await page.fill('#article-form-title', article.title);
  await page.waitForSelector('#article_body_markdown', { timeout: 10000 });
  await page.fill('#article_body_markdown', article.body);

  if (article.tags) {
    const tagEl = await page.$('#tag-input');
    if (tagEl) {
      await page.fill('#tag-input', article.tags);
    }
  }

  let actionResult = 'staged';
  if (action === 'publish') {
    const pubBtn = await page.$('.c-btn--primary');
    if (pubBtn) {
      await pubBtn.click();
      actionResult = 'published';
    }
  } else if (action === 'draft') {
    const draftBtn = await page.$('.c-btn--secondary');
    if (draftBtn) {
      await draftBtn.click();
      actionResult = 'draft_saved';
    }
  }

  return {
    ok: true,
    action: actionResult,
    platform: 'devto',
    title: article.title,
  };
}

module.exports = {
  publishDevToActiveSession,
  publishDevToHeadless,
  parseDevToMarkdown,
  DEVTO_NEW_URL,
};
