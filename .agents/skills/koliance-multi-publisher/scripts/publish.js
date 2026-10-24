#!/usr/bin/env node
// Koliance Multi-Platform Publisher Master CLI
// Adheres strictly to AGENTS.md: zero emojis, structured logging, robust error handling

const path = require('path');
const fs = require('fs');
const { publishDevToActiveSession, publishDevToHeadless } = require('./platforms/devto');
const { publishWeChatActiveSession, publishWeChatHeadless } = require('./platforms/wechat');
const { publishZhihuActiveSession, publishZhihuHeadless } = require('./platforms/zhihu');
const { publishXiaohongshuActiveSession, publishXiaohongshuHeadless } = require('./platforms/xiaohongshu');
const { publishRedditActiveSession, publishRedditHeadless } = require('./platforms/reddit');
const { createHeadlessContext } = require('./lib/playwright_bridge');
const { exportActiveSession } = require('./lib/session_exporter');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    headless: false,
    engine: 'auto', // 'auto', 'applescript', 'playwright'
    platforms: ['devto', 'wechat', 'zhihu', 'xiaohongshu', 'reddit'],
    action: 'draft', // 'draft', 'publish', 'stage'
    parallel: true,
    articlesDir: path.resolve(__dirname, '../resources/articles'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headless') {
      config.headless = true;
      config.engine = 'playwright';
    } else if (arg === '--engine' && args[i + 1]) {
      config.engine = args[++i];
    } else if (arg === '--platforms' && args[i + 1]) {
      const val = args[++i];
      config.platforms = val === 'all' ? ['devto', 'wechat', 'zhihu', 'xiaohongshu', 'reddit'] : val.split(',').map(p => p.trim());
    } else if (arg === '--action' && args[i + 1]) {
      config.action = args[++i];
    } else if (arg === '--articles-dir' && args[i + 1]) {
      config.articlesDir = path.resolve(process.cwd(), args[++i]);
    } else if (arg === '--sequential') {
      config.parallel = false;
    } else if (arg === '--parallel') {
      config.parallel = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node publish.js [options]

Options:
  --headless                Run in headless browser mode via Playwright with preserved session state
  --engine <mode>           Execution engine: 'auto' (default), 'applescript' (active Chrome), 'playwright'
  --platforms <list>        Comma-separated platforms: devto,wechat,zhihu,xiaohongshu,reddit, or 'all'
  --action <mode>           Action mode: 'draft' (default, saves draft), 'publish', 'stage'
  --parallel                Execute platform tasks in parallel (default: true)
  --sequential              Execute platform tasks sequentially
  --articles-dir <path>     Directory containing markdown articles (default: resources/articles)
  --help, -h                Show this help message
`);
      process.exit(0);
    }
  }

  return config;
}

async function processActivePlatform(plat, config) {
  console.log(`[INFO] Processing platform: ${plat} (Action: ${config.action})...`);
  try {
    let res;
    switch (plat) {
      case 'devto':
        res = await publishDevToActiveSession(
          path.join(config.articlesDir, '03_devto.md'),
          config.action
        );
        break;
      case 'wechat':
        res = await publishWeChatActiveSession(
          path.join(config.articlesDir, '04_wechat.md'),
          config.action
        );
        break;
      case 'zhihu':
        res = await publishZhihuActiveSession(
          path.join(config.articlesDir, '02_zhihu.md'),
          config.action
        );
        break;
      case 'xiaohongshu':
        res = await publishXiaohongshuActiveSession(
          path.join(config.articlesDir, '05_xiaohongshu.md'),
          config.action
        );
        break;
      case 'reddit':
        res = await publishRedditActiveSession(
          path.join(config.articlesDir, '01_reddit.md'),
          config.action
        );
        break;
      default:
        console.log(`[WARN] Unknown platform: ${plat}`);
        return { ok: false, error: `Unknown platform: ${plat}` };
    }

    console.log(`[OK] Platform ${plat} completed: ${JSON.stringify(res)}`);
    return res;
  } catch (err) {
    console.error(`[ERROR] Failed to process ${plat}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function runActiveSessionWorkflow(config) {
  console.log('[INFO] Starting publication workflow via active Chrome session...');
  const results = {};

  if (config.parallel) {
    console.log('[INFO] Running platform tasks concurrently (Parallel Mode)...');
    const tasks = config.platforms.map(async plat => {
      const res = await processActivePlatform(plat, config);
      results[plat] = res;
    });
    await Promise.allSettled(tasks);
  } else {
    for (const plat of config.platforms) {
      results[plat] = await processActivePlatform(plat, config);
    }
  }

  return results;
}

async function processHeadlessPlatform(plat, context, config) {
  console.log(`[INFO] [Headless] Processing platform: ${plat} (Action: ${config.action})...`);
  const page = await context.newPage();
  try {
    let res;
    switch (plat) {
      case 'devto':
        res = await publishDevToHeadless(
          page,
          path.join(config.articlesDir, '03_devto.md'),
          config.action
        );
        break;
      case 'wechat':
        res = await publishWeChatHeadless(
          page,
          'https://mp.weixin.qq.com',
          path.join(config.articlesDir, '04_wechat.md'),
          config.action
        );
        break;
      case 'zhihu':
        res = await publishZhihuHeadless(
          page,
          path.join(config.articlesDir, '02_zhihu.md'),
          config.action
        );
        break;
      case 'xiaohongshu':
        res = await publishXiaohongshuHeadless(
          page,
          path.join(config.articlesDir, '05_xiaohongshu.md'),
          config.action
        );
        break;
      case 'reddit':
        res = await publishRedditHeadless(
          page,
          path.join(config.articlesDir, '01_reddit.md'),
          config.action
        );
        break;
      default:
        console.log(`[WARN] Unknown platform: ${plat}`);
        return { ok: false, error: `Unknown platform: ${plat}` };
    }

    console.log(`[OK] [Headless] Platform ${plat} completed: ${JSON.stringify(res)}`);
    return res;
  } catch (err) {
    console.error(`[ERROR] [Headless] Failed to process ${plat}: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    await page.close();
  }
}

async function runHeadlessWorkflow(config) {
  console.log('[INFO] Exporting active session state for headless execution...');
  exportActiveSession();

  console.log('[INFO] Launching Chromium in headless mode (--headless)...');
  const { browser, context } = await createHeadlessContext({ headless: true });
  const results = {};

  try {
    if (config.parallel) {
      console.log('[INFO] [Headless] Running platform tasks concurrently (Parallel Mode)...');
      const tasks = config.platforms.map(async plat => {
        const res = await processHeadlessPlatform(plat, context, config);
        results[plat] = res;
      });
      await Promise.allSettled(tasks);
    } else {
      for (const plat of config.platforms) {
        results[plat] = await processHeadlessPlatform(plat, context, config);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}

async function main() {
  const config = parseArgs();
  console.log(`[INFO] Koliance Multi-Platform Publisher starting.`);
  console.log(`[INFO] Configuration: Engine=${config.engine}, Headless=${config.headless}, Action=${config.action}`);
  console.log(`[INFO] Target Platforms: ${config.platforms.join(', ')}`);

  let results;
  if (config.headless || config.engine === 'playwright') {
    results = await runHeadlessWorkflow(config);
  } else {
    results = await runActiveSessionWorkflow(config);
  }

  console.log('\n========================================');
  console.log('[SUMMARY] Execution Results:');
  for (const [platform, status] of Object.entries(results)) {
    console.log(`  - ${platform.padEnd(12)}: ${status.ok ? '[SUCCESS]' : '[FAILED]'} ${JSON.stringify(status)}`);
  }
  console.log('========================================\n');
}

main().catch(err => {
  console.error(`[FATAL] Publisher terminated with error: ${err.message}`);
  process.exit(1);
});
