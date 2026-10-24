import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load platform adapters
const devto = require('../.agents/skills/koliance-multi-publisher/scripts/platforms/devto');
const wechat = require('../.agents/skills/koliance-multi-publisher/scripts/platforms/wechat');
const zhihu = require('../.agents/skills/koliance-multi-publisher/scripts/platforms/zhihu');
const xiaohongshu = require('../.agents/skills/koliance-multi-publisher/scripts/platforms/xiaohongshu');
const reddit = require('../.agents/skills/koliance-multi-publisher/scripts/platforms/reddit');

describe('Koliance Multi-Platform Publisher Unit Tests', () => {
  const articlesDir = path.resolve(__dirname, '../.agents/skills/koliance-multi-publisher/resources/articles');

  it('should verify all 5 platform article files exist and are non-empty', () => {
    const files = [
      '01_reddit.md',
      '02_zhihu.md',
      '03_devto.md',
      '04_wechat.md',
      '05_xiaohongshu.md',
    ];

    for (const f of files) {
      const p = path.join(articlesDir, f);
      expect(fs.existsSync(p)).toBe(true);
      const stat = fs.statSync(p);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });

  it('should verify zero emojis across all articles and skill scripts', () => {
    const isEmoji = (codePoint: number) => {
      return (
        (0x1F600 <= codePoint && codePoint <= 0x1F64F) ||
        (0x1F300 <= codePoint && codePoint <= 0x1F5FF) ||
        (0x1F680 <= codePoint && codePoint <= 0x1F6FF) ||
        (0x1F700 <= codePoint && codePoint <= 0x1F77F) ||
        (0x1F780 <= codePoint && codePoint <= 0x1F7FF) ||
        (0x1F800 <= codePoint && codePoint <= 0x1F8FF) ||
        (0x1F900 <= codePoint && codePoint <= 0x1F9FF) ||
        (0x1FA00 <= codePoint && codePoint <= 0x1FA6F) ||
        (0x1FA70 <= codePoint && codePoint <= 0x1FAFF) ||
        (0x2600 <= codePoint && codePoint <= 0x26FF) ||
        (0x2700 <= codePoint && codePoint <= 0x27BF)
      );
    };

    const targetDirs = [
      articlesDir,
      path.resolve(__dirname, '../.agents/skills/koliance-multi-publisher/scripts'),
      path.resolve(__dirname, '../docs/publications'),
    ];

    for (const dir of targetDirs) {
      const scanDir = (current: string) => {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.js'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (let i = 0; i < content.length; i++) {
              const codePoint = content.codePointAt(i) || 0;
              expect(isEmoji(codePoint)).toBe(false);
            }
          }
        }
      };
      scanDir(dir);
    }
  });

  it('should correctly parse Dev.to markdown frontmatter and body', () => {
    const parsed = devto.parseDevToMarkdown(path.join(articlesDir, '03_devto.md'));
    expect(parsed.title).toContain('Architecting Economic Sovereignty for Autonomous AI Agents');
    expect(parsed.tags).toContain('web3');
    expect(parsed.body.length).toBeGreaterThan(5000);
  });

  it('should correctly prepare Reddit title and content', () => {
    const parsed = reddit.prepareRedditContent(path.join(articlesDir, '01_reddit.md'));
    expect(parsed.title).toContain('Introducing Koliance');
    expect(parsed.content.length).toBeGreaterThan(4000);
  });

  it('should correctly prepare Zhihu title and content', () => {
    const parsed = zhihu.prepareZhihuContent(path.join(articlesDir, '02_zhihu.md'));
    expect(parsed.title).toContain('如何评价专为 Autonomous AI Agent');
    expect(parsed.content.length).toBeGreaterThan(4000);
  });

  it('should correctly prepare WeChat title, author, and ProseMirror HTML paragraphs', () => {
    const parsed = wechat.prepareWeChatContent(path.join(articlesDir, '04_wechat.md'));
    expect(parsed.title).toContain('当 AI 开始自己花钱');
    expect(parsed.author).toBe('Koliance团队');
    expect(parsed.htmlParagraphs).toContain('<p>');
    expect(parsed.htmlParagraphs.length).toBeGreaterThan(3000);
  });

  it('should correctly prepare Xiaohongshu title and Tiptap HTML paragraphs', () => {
    const parsed = xiaohongshu.prepareXiaohongshuContent(path.join(articlesDir, '05_xiaohongshu.md'));
    expect(parsed.title).toContain('建议收藏！给AI办一张加密Visa卡');
    expect(parsed.htmlParagraphs).toContain('<p>');
    expect(parsed.htmlParagraphs.length).toBeGreaterThan(1000);
  });

  it('should verify all 6 core questions are addressed across the publications', () => {
    const redditContent = fs.readFileSync(path.join(articlesDir, '01_reddit.md'), 'utf8');
    expect(redditContent).toContain('What Koliance Provides');
    expect(redditContent).toContain('What Problems Koliance Solves');
    expect(redditContent).toContain('Why Is Koliance Necessary');
    expect(redditContent).toContain('Key Differentiators');
    expect(redditContent).toContain('How to Use Koliance');

    const zhihuContent = fs.readFileSync(path.join(articlesDir, '02_zhihu.md'), 'utf8');
    expect(zhihuContent).toContain('维度一：Koliance 到底给用户提供了什么');
    expect(zhihuContent).toContain('维度二：它有什么用');
    expect(zhihuContent).toContain('维度三：它解决了什么本质问题');
    expect(zhihuContent).toContain('维度四：为什么必须要有 Koliance');
    expect(zhihuContent).toContain('维度五：与现有方案相比，有什么本质不同');
    expect(zhihuContent).toContain('维度六：如何实际使用与接入');
  });
});
