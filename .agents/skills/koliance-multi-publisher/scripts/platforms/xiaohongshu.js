// Xiaohongshu (小红书创作服务平台) Publisher Adapter
// Dual engine support: Active Chrome (AppleScript) and Headless Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab } = require('../lib/chrome_bridge');

const DEFAULT_ARTICLE_PATH = path.resolve(__dirname, '../../resources/articles/05_xiaohongshu.md');
const XHS_PUBLISH_URL = 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch';

function prepareXiaohongshuContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let title = '建议收藏！给AI办一张加密Visa卡：3分钟搞懂Koliance';
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  // Format paragraphs for tiptap editor
  const htmlParagraphs = content
    .split('\n\n')
    .map(para => {
      para = para.trim();
      if (!para) return '';
      if (para.startsWith('# ')) {
        return `<p><strong>${para.slice(2)}</strong></p>`;
      } else if (para.startsWith('## ') || para.startsWith('### ') || para.startsWith('#### ')) {
        return `<p><strong>${para.replace(/^#+\s+/, '')}</strong></p>`;
      } else {
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
      }
    })
    .filter(Boolean)
    .join('');

  return { title, htmlParagraphs, rawContent: content };
}

async function publishXiaohongshuActiveSession(articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, htmlParagraphs } = prepareXiaohongshuContent(articlePath);

  const fillJs = `
    (function() {
      var titleEl = document.querySelector("textarea.d-text") || document.querySelector("textarea[placeholder*='标题']");
      var prose = document.querySelector(".tiptap.ProseMirror") || document.querySelector("[contenteditable=true]");

      // Case 1: Editor is visible
      if (titleEl && prose) {
        titleEl.value = ${JSON.stringify(title)};
        titleEl.dispatchEvent(new Event("input", { bubbles: true }));
        titleEl.dispatchEvent(new Event("change", { bubbles: true }));

        prose.innerHTML = ${JSON.stringify(htmlParagraphs)};
        prose.dispatchEvent(new Event("input", { bubbles: true }));

        var actionResult = "staged";
        if (${JSON.stringify(action)} === "draft") {
          var saveBtn = document.querySelector(".save-btn");
          if (saveBtn) {
            saveBtn.click();
            actionResult = "draft_saved";
          }
        }

        return JSON.stringify({
          ok: true,
          action: actionResult,
          titleLen: titleEl.value.length,
          bodyLen: prose.innerText.length
        });
      }

      // Case 2: On draft list view after save
      var draftItem = Array.from(document.querySelectorAll("span, div, button")).find(function(el) {
        return el.innerText && el.innerText.trim() === "编辑";
      });
      if (draftItem) {
        draftItem.click();
        return JSON.stringify({ ok: false, openedDraft: true });
      }

      // Case 3: On overview view before editor
      var triggerBtn = Array.from(document.querySelectorAll("button, div, span")).find(function(el) {
        var t = el.innerText ? el.innerText.trim() : "";
        return t === "新的创作" || t === "写长文";
      });
      if (triggerBtn) {
        triggerBtn.click();
        return JSON.stringify({ ok: false, triggered: true });
      }

      return JSON.stringify({ ok: false, error: "Xiaohongshu navigation elements not found" });
    })()
  `;

  let rawRes = executeInTab('creator.xiaohongshu.com', fillJs);
  if (rawRes === 'ERR_TAB_NOT_FOUND') {
    throw new Error('[WARN] Xiaohongshu creator tab not found. Please navigate to https://creator.xiaohongshu.com in Chrome.');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawRes);
  } catch (e) {}

  if (parsed && parsed.ok) {
    return parsed;
  }

  // Poll for editor to open and fill
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    rawRes = executeInTab('creator.xiaohongshu.com', fillJs);
    if (rawRes && rawRes !== 'ERR_TAB_NOT_FOUND') {
      try {
        parsed = JSON.parse(rawRes);
        if (parsed && parsed.ok) {
          return parsed;
        }
      } catch (e) {}
    }
  }

  throw new Error('[ERROR] Timed out waiting for Xiaohongshu editor to initialize');
}

async function publishXiaohongshuHeadless(page, articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, htmlParagraphs } = prepareXiaohongshuContent(articlePath);
  await page.goto(XHS_PUBLISH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (page.url().includes('login') || page.url().includes('passport')) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED',
      platform: 'xiaohongshu',
      message: 'Xiaohongshu requires creator authentication. Session state missing or expired.'
    };
  }

  // Look for long article tab
  const longTab = await page.$("xpath=//*[text()='写长文']");
  if (longTab) {
    await longTab.click();
    await page.waitForTimeout(1500);
  }

  const newPostBtn = await page.$("xpath=//*[text()='新的创作']");
  if (newPostBtn) {
    await newPostBtn.click();
    await page.waitForTimeout(1500);
  }

  try {
    await page.waitForSelector("textarea[placeholder*='标题']", { timeout: 8000 });
  } catch (e) {
    const isLogin = await page.evaluate(() => {
      return !!document.querySelector('.login-box, .qrcode-img, input[placeholder*="手机号"]') ||
        document.body.innerText.includes('登录后开启创作') ||
        document.body.innerText.includes('扫码登录');
    }).catch(() => false);

    if (isLogin || page.url().includes('login') || page.url().includes('passport')) {
      return {
        ok: false,
        error: 'AUTH_REQUIRED',
        platform: 'xiaohongshu',
        message: 'Xiaohongshu requires active creator session. Please run with active Chrome session engine.'
      };
    }
    return {
      ok: false,
      error: 'TIMEOUT',
      platform: 'xiaohongshu',
      message: e.message
    };
  }

  await page.fill("textarea[placeholder*='标题']", title);

  await page.waitForSelector('.tiptap.ProseMirror', { timeout: 10000 });
  await page.evaluate(html => {
    const prose = document.querySelector('.tiptap.ProseMirror');
    if (prose) {
      prose.innerHTML = html;
      prose.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, htmlParagraphs);

  let actionResult = 'staged';
  if (action === 'draft') {
    const saveBtn = await page.$('.save-btn');
    if (saveBtn) {
      await saveBtn.click();
      actionResult = 'draft_saved';
    }
  }

  return {
    ok: true,
    action: actionResult,
    platform: 'xiaohongshu',
    title,
  };
}

module.exports = {
  publishXiaohongshuActiveSession,
  publishXiaohongshuHeadless,
  prepareXiaohongshuContent,
  XHS_PUBLISH_URL,
};
