// Session Exporter & Persistence Manager for Headless Mode
// Extracts active session cookies & storage state to enable headless execution via Playwright

const fs = require('fs');
const path = require('path');
const { executeInTab } = require('./chrome_bridge');

const STORAGE_STATE_PATH = path.resolve(__dirname, '../../resources/storageState.json');

/**
 * Extracts cookies and localStorage from matching open browser tabs
 * and compiles them into a Playwright-compatible storageState object.
 */
function exportActiveSession() {
  const platforms = [
    { name: 'devto', pattern: 'dev.to', origin: 'https://dev.to', domain: 'dev.to' },
    { name: 'wechat', pattern: 'mp.weixin.qq.com', origin: 'https://mp.weixin.qq.com', domain: 'mp.weixin.qq.com' },
    { name: 'zhihu', pattern: 'zhihu.com', origin: 'https://zhuanlan.zhihu.com', domain: 'zhuanlan.zhihu.com' },
    { name: 'xiaohongshu', pattern: 'creator.xiaohongshu.com', origin: 'https://creator.xiaohongshu.com', domain: 'creator.xiaohongshu.com' },
    { name: 'reddit', pattern: 'reddit.com', origin: 'https://www.reddit.com', domain: 'www.reddit.com' },
  ];

  let state = {
    cookies: [],
    origins: [],
  };

  // Load existing storage state if available to merge
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
      if (Array.isArray(existing.cookies)) state.cookies = existing.cookies;
      if (Array.isArray(existing.origins)) state.origins = existing.origins;
    } catch (e) {}
  }

  for (const plat of platforms) {
    try {
      const raw = executeInTab(plat.pattern, `
        (function() {
          var cookies = document.cookie ? document.cookie.split(';').map(function(c) {
            var parts = c.trim().split('=');
            return {
              name: parts[0],
              value: parts.slice(1).join('='),
              domain: window.location.hostname,
              path: '/',
              expires: -1,
              httpOnly: false,
              secure: window.location.protocol === 'https:',
              sameSite: 'Lax'
            };
          }).filter(function(c) { return c.name && c.value; }) : [];
          
          var local = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            local.push({ name: k, value: localStorage.getItem(k) });
          }

          return JSON.stringify({ cookies: cookies, localStorage: local });
        })()
      `);

      if (raw && raw !== 'ERR_TAB_NOT_FOUND') {
        const parsed = JSON.parse(raw);
        if (parsed.cookies && parsed.cookies.length > 0) {
          // Remove old cookies for this domain and replace with fresh ones
          state.cookies = state.cookies.filter(c => !c.domain.includes(plat.name));
          state.cookies.push(...parsed.cookies);
        }
        if (parsed.localStorage && parsed.localStorage.length > 0) {
          state.origins = state.origins.filter(o => !o.origin.includes(plat.name));
          state.origins.push({
            origin: plat.origin,
            localStorage: parsed.localStorage,
          });
        }
      }
    } catch (err) {
      // Tab might not be open or accessible; preserve existing
    }
  }

  // Ensure storageState directory exists
  const dir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  return STORAGE_STATE_PATH;
}

function getStorageStatePath() {
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    return STORAGE_STATE_PATH;
  }
  return exportActiveSession();
}

module.exports = {
  exportActiveSession,
  getStorageStatePath,
  STORAGE_STATE_PATH,
};
