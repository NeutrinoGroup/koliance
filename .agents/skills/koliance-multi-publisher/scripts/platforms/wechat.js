// WeChat Official Account (微信公众号) Publisher Adapter
// Dual engine support: Active Chrome (AppleScript) and Headless Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab } = require('../lib/chrome_bridge');

const DEFAULT_ARTICLE_PATH = path.resolve(__dirname, '../../resources/articles/04_wechat.md');

function prepareWeChatContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let title = '当 AI 开始自己花钱：深入拆解 Monad 生态首个智能体经济主权协议 Koliance';
  let author = 'Koliance团队';

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  // Convert to semantic HTML paragraphs for WeChat ProseMirror
  const htmlParagraphs = content
    .split('\n\n')
    .map(para => {
      para = para.trim();
      if (!para) return '';
      if (para.startsWith('# ')) {
        return `<h1>${para.slice(2)}</h1>`;
      } else if (para.startsWith('## ') || para.startsWith('### ')) {
        return `<h3>${para.replace(/^###?\s+/, '')}</h3>`;
      } else if (para.startsWith('> ')) {
        return `<blockquote>${para.slice(2)}</blockquote>`;
      } else {
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
      }
    })
    .filter(Boolean)
    .join('');

  return { title, author, htmlParagraphs, rawContent: content };
}

async function publishWeChatActiveSession(articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, author, htmlParagraphs } = prepareWeChatContent(articlePath);

  const jsCode = `
    (function() {
      var titleEl = document.querySelector("#title");
      var authorEl = document.querySelector("#author");
      var prose = document.querySelector(".ProseMirror[contenteditable=true]");

      if (!titleEl || !prose) {
        return JSON.stringify({ ok: false, error: "WeChat MP editor elements not found" });
      }

      titleEl.value = ${JSON.stringify(title)};
      titleEl.dispatchEvent(new Event("input", { bubbles: true }));
      titleEl.dispatchEvent(new Event("change", { bubbles: true }));

      if (authorEl) {
        authorEl.value = ${JSON.stringify(author)};
        authorEl.dispatchEvent(new Event("input", { bubbles: true }));
      }

      prose.innerHTML = ${JSON.stringify(htmlParagraphs)};
      prose.dispatchEvent(new Event("input", { bubbles: true }));

      var actionResult = "staged";
      if (${JSON.stringify(action)} === "draft") {
        var draftBtn = document.querySelector("#js_submit");
        if (draftBtn) {
          draftBtn.click();
          actionResult = "draft_saved";
        }
      } else if (${JSON.stringify(action)} === "publish") {
        var sendBtn = document.querySelector("#js_send");
        if (sendBtn) {
          sendBtn.click();
          actionResult = "publish_triggered";
        }
      }

      return JSON.stringify({
        ok: true,
        action: actionResult,
        titleLen: titleEl.value.length,
        bodyLen: prose.innerText.length
      });
    })()
  `;

  const rawRes = executeInTab('mp.weixin.qq.com', jsCode);
  if (rawRes === 'ERR_TAB_NOT_FOUND') {
    throw new Error('[WARN] WeChat MP editor tab not found. Please navigate to your editor page in Chrome.');
  }

  return JSON.parse(rawRes);
}

async function publishWeChatHeadless(page, targetUrl, articlePath = DEFAULT_ARTICLE_PATH, action = 'draft') {
  const { title, author, htmlParagraphs } = prepareWeChatContent(articlePath);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (page.url().includes('login') || page.url().includes('loginpage')) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED',
      platform: 'wechat',
      message: 'WeChat Official Account requires active QR/SMS authentication. Session state missing or expired.'
    };
  }

  try {
    await page.waitForSelector('#title', { timeout: 8000 });
  } catch (e) {
    const isLogin = await page.evaluate(() => {
      return !!document.querySelector('.login__type__container, .qrcode, .login_frame') ||
        document.body.innerText.includes('微信公众平台') && document.body.innerText.includes('登录');
    }).catch(() => false);

    if (isLogin || page.url().includes('login') || page.url().includes('loginpage')) {
      return {
        ok: false,
        error: 'AUTH_REQUIRED',
        platform: 'wechat',
        message: 'WeChat Official Account requires active QR/SMS authentication. Please run with active Chrome session engine.'
      };
    }
    return {
      ok: false,
      error: 'TIMEOUT',
      platform: 'wechat',
      message: e.message
    };
  }

  await page.fill('#title', title);

  const authorEl = await page.$('#author');
  if (authorEl) {
    await page.fill('#author', author);
  }

  await page.waitForSelector('.ProseMirror[contenteditable=true]', { timeout: 10000 });
  await page.evaluate(html => {
    const prose = document.querySelector('.ProseMirror[contenteditable=true]');
    if (prose) {
      prose.innerHTML = html;
      prose.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, htmlParagraphs);

  let actionResult = 'staged';
  if (action === 'draft') {
    const draftBtn = await page.$('#js_submit');
    if (draftBtn) {
      await draftBtn.click();
      actionResult = 'draft_saved';
    }
  }

  return {
    ok: true,
    action: actionResult,
    platform: 'wechat',
    title,
  };
}

module.exports = {
  publishWeChatActiveSession,
  publishWeChatHeadless,
  prepareWeChatContent,
};
