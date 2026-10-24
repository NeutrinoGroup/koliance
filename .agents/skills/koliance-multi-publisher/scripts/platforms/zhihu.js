// Zhihu (知乎专栏/文章) Publisher Adapter
// Dual engine support: Active Chrome (AppleScript) and Headless Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab, navigateTab } = require('../lib/chrome_bridge');

const DEFAULT_ARTICLE_PATH = path.resolve(__dirname, '../../resources/articles/02_zhihu.md');
const ZHIHU_WRITE_URL = 'https://zhuanlan.zhihu.com/write';

function prepareZhihuContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let title = '如何评价专为 Autonomous AI Agent 打造的链上信任与经济主权协议 Koliance？它解决了什么本质问题？';
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  return { title, content };
}

async function publishZhihuActiveSession(articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, content } = prepareZhihuContent(articlePath);

  const fillJs = `
    (function() {
      var titleEl = document.querySelector("textarea[placeholder*='标题']");
      var editorEl = document.querySelector(".public-DraftEditor-content") || document.querySelector("[contenteditable=true]");

      if (!titleEl || !editorEl) {
        return JSON.stringify({ ok: false, notReady: true });
      }

      titleEl.value = ${JSON.stringify(title)};
      titleEl.dispatchEvent(new Event("input", { bubbles: true }));
      titleEl.dispatchEvent(new Event("change", { bubbles: true }));

      editorEl.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, ${JSON.stringify(content)});

      var actionResult = "draft_saved"; // Zhihu auto-saves draft instantly upon input
      return JSON.stringify({
        ok: true,
        action: actionResult,
        titleLen: titleEl.value.length,
        bodyLen: editorEl.innerText.length
      });
    })()
  `;

  let rawRes = executeInTab('zhuanlan.zhihu.com', fillJs);
  if (rawRes === 'ERR_TAB_NOT_FOUND') {
    // If on waiting page, navigate to write URL
    const navRes = navigateTab('zhihu.com', ZHIHU_WRITE_URL);
    if (navRes === 'ERR_TAB_NOT_FOUND') {
      throw new Error('[WARN] Zhihu tab not found. Please navigate to https://zhuanlan.zhihu.com/write in Chrome.');
    }
  } else {
    try {
      const parsed = JSON.parse(rawRes);
      if (parsed && parsed.ok) {
        return parsed;
      }
    } catch (e) {}
  }

  // Poll for editor to appear
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    rawRes = executeInTab('zhuanlan.zhihu.com', fillJs);
    if (rawRes && rawRes !== 'ERR_TAB_NOT_FOUND') {
      try {
        const parsed = JSON.parse(rawRes);
        if (parsed && parsed.ok) {
          return parsed;
        }
      } catch (e) {}
    }
  }

  throw new Error('[ERROR] Timed out waiting for Zhihu editor elements to appear');
}

async function publishZhihuHeadless(page, articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, content } = prepareZhihuContent(articlePath);
  await page.goto(ZHIHU_WRITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (page.url().includes('signin') || page.url().includes('login')) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED',
      platform: 'zhihu',
      message: 'Zhihu requires active authentication. Session state missing or expired.'
    };
  }

  try {
    await page.waitForSelector("textarea[placeholder*='标题']", { timeout: 8000 });
  } catch (e) {
    const isLogin = await page.evaluate(() => {
      return !!document.querySelector('.SignFlow, .SignContainer, input[name="username"]') ||
        document.body.innerText.includes('登录知乎') ||
        document.body.innerText.includes('注册知乎');
    }).catch(() => false);

    if (isLogin || page.url().includes('signin') || page.url().includes('login')) {
      return {
        ok: false,
        error: 'AUTH_REQUIRED',
        platform: 'zhihu',
        message: 'Zhihu requires active user session. Please run with active Chrome session engine.'
      };
    }
    return {
      ok: false,
      error: 'TIMEOUT',
      platform: 'zhihu',
      message: e.message
    };
  }

  await page.fill("textarea[placeholder*='标题']", title);

  await page.waitForSelector('.public-DraftEditor-content', { timeout: 10000 });
  await page.click('.public-DraftEditor-content');
  await page.keyboard.insertText(content);

  return {
    ok: true,
    action: 'draft_saved',
    platform: 'zhihu',
    title,
  };
}

module.exports = {
  publishZhihuActiveSession,
  publishZhihuHeadless,
  prepareZhihuContent,
  ZHIHU_WRITE_URL,
};
