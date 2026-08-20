#!/usr/bin/env node
/**
 * MyBatis-Plus Releases 同步器
 *
 * 数据来源：GitHub API — baomidou/mybatis-plus releases（最近 20 条）
 * 生成物：
 *   1. llm-wiki/releases.html — 最近更新日志页（静态，供 GitHub Pages 直接访问）
 *   2. llm-wiki/index.html — 同步更新头部版本徽章为最新 release tag
 *
 * 零依赖（Node 18+ 原生 fetch），由 deploy-pages.yml 在每次构建时调用。
 * API 失败时降级：保留旧 releases.html（存在时）或生成占位页，不阻断部署。
 */

const fs = require('fs');
const path = require('path');

const REPO = 'baomidou/mybatis-plus';
const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
const RELEASE_BASE = `https://github.com/${REPO}/releases/tag/`;

const OUTPUT_DIR = path.join(__dirname, '..'); // llm-wiki/
const RELEASES_PATH = path.join(OUTPUT_DIR, 'releases.html');
const INDEX_PATH = path.join(OUTPUT_DIR, 'index.html');

// ── 轻量 Markdown → HTML（覆盖 release body 常见语法）──

function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function mdToHtml(md) {
  if (!md || !md.trim()) return '<p class="release-empty">（无变更说明）</p>';

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let list = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (list) { html += `</${list}>\n`; list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);

    if (h2) { closeList(); html += `<h3 class="release-sub">${inlineMd(h2[1])}</h3>\n`; }
    else if (h3) { closeList(); html += `<h4 class="release-sub">${inlineMd(h3[1])}</h4>\n`; }
    else if (bullet) {
      if (list !== 'ul') { closeList(); list = 'ul'; html += '<ul>\n'; }
      html += `  <li>${inlineMd(bullet[1])}</li>\n`;
    } else if (numbered) {
      if (list !== 'ol') { closeList(); list = 'ol'; html += '<ol>\n'; }
      html += `  <li>${inlineMd(numbered[1])}</li>\n`;
    } else { closeList(); html += `<p>${inlineMd(line)}</p>\n`; }
  }
  closeList();
  return html;
}

// ── 工具 ──

// 统一用 UTC 显示，保证 CI（UTC）与本地（东八区）渲染结果一致
function formatDate(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

async function fetchReleases() {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'mybatis-plus-doc-sync', 'Accept': 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('unexpected payload');
  return data;
}

function buildPage(releases, syncedAt) {
  const cards = releases.map((r, i) => {
    const tag = r.tag_name || r.name || 'v?';
    const date = formatDate(r.published_at);
    const badge = i === 0 ? '<span class="release-badge">最新</span>' : '';
    return `
      <article class="release-card">
        <div class="release-head">
          <span class="release-tag">${tag}</span>${badge}
          <span class="release-date">${date}</span>
        </div>
        <div class="release-body">
          ${mdToHtml(r.body)}
        </div>
        <a class="release-link" href="${RELEASE_BASE}${tag}" target="_blank" rel="noopener">查看完整发布说明 ↗</a>
      </article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="favicon.ico" type="image/x-icon">
  <title>MyBatis-Plus 最近更新 — 官方 Releases 日志</title>
  <meta name="description" content="MyBatis-Plus 官方 GitHub Releases 版本发布日志，随 CI 自动同步。">
  <style>
    :root {
      --accent: #409EFF;
      --accent-dark: #337ecc;
      --accent-light: #ecf5ff;
      --text: #2c3e50;
      --text-secondary: #666;
      --text-muted: #999;
      --bg: #f8f9fa;
      --card-bg: #fff;
      --border: #eaecef;
      --radius: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .header { text-align: center; padding: 60px 20px 32px; }
    .header .logo { width: 64px; height: 64px; margin-bottom: 14px; border-radius: 12px; }
    .header h1 { font-size: 32px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
    .header .subtitle { margin-top: 8px; font-size: 15px; color: var(--text-secondary); }

    .main { width: 100%; max-width: 680px; padding: 0 20px; }

    .back-home {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 16px;
      font-size: 14px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.2s;
    }
    .back-home:hover { color: var(--accent); }

    .synced { text-align: center; font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

    .release-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px 26px;
      margin-bottom: 16px;
    }
    .release-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .release-tag {
      font-size: 17px;
      font-weight: 700;
      color: var(--accent);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    .release-badge {
      font-size: 12px; font-weight: 600;
      color: #fff; background: var(--accent);
      padding: 2px 8px; border-radius: 4px;
    }
    .release-date {
      margin-left: auto;
      font-size: 13px;
      color: var(--text-muted);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    .release-body { font-size: 14px; color: var(--text-secondary); line-height: 1.75; }
    .release-body p { margin-bottom: 8px; }
    .release-body p:last-child { margin-bottom: 0; }
    .release-body ul, .release-body ol { padding-left: 22px; margin-bottom: 8px; }
    .release-body ul:last-child, .release-body ol:last-child { margin-bottom: 0; }
    .release-body li { margin-bottom: 3px; }
    .release-body code {
      font-size: 13px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 5px;
    }
    .release-body a { color: var(--accent); text-decoration: none; }
    .release-body a:hover { text-decoration: underline; }
    .release-sub { font-size: 14px; color: var(--text); margin: 10px 0 6px; }
    .release-empty { color: var(--text-muted); }
    .release-link {
      display: inline-block;
      margin-top: 12px;
      font-size: 13px;
      color: var(--accent);
      text-decoration: none;
    }
    .release-link:hover { text-decoration: underline; }

    .footer { margin-top: auto; padding: 40px 20px; text-align: center; font-size: 13px; color: var(--text-muted); }
    .footer a { color: var(--text-muted); text-decoration: none; }
    .footer a:hover { color: var(--accent); }
  </style>
</head>
<body>
  <header class="header">
    <img class="logo" src="favicon.ico" alt="MyBatis-Plus">
    <h1>最近更新</h1>
    <p class="subtitle">MyBatis-Plus 官方 Releases 版本日志 — 随 GitHub 自动同步</p>
  </header>

  <main class="main">
    <a class="back-home" href="index.html">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      返回 LLM Wiki 首页
    </a>

    <p class="synced">最近同步：${syncedAt}</p>

    ${cards}
  </main>

  <footer class="footer">
    Powered by <a href="https://llmstxt.org/" target="_blank">llms.txt 协议</a>
    · 由 <a href="https://github.com/BaixuanZhu" target="_blank">BaixuanZhu</a> 维护
    · 数据来自 <a href="https://github.com/baomidou/mybatis-plus" target="_blank">baomidou/mybatis-plus Releases</a>
  </footer>
</body>
</html>
`;
}

function updateIndexVersion(latestTag) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.warn(`  ⚠ 未找到 index.html，跳过版本徽章更新`);
    return;
  }
  const html = fs.readFileSync(INDEX_PATH, 'utf-8');
  const regex = /(<span class="version">)v[^<]*(<\/span>)/;
  if (!regex.test(html)) {
    console.warn('  ⚠ index.html 未匹配到版本徽章，跳过');
    return;
  }
  const updated = html.replace(regex, `$1${latestTag}$2`);
  fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
  console.log(`  ✅ 版本徽章 → ${latestTag}`);
}

// ── 主流程 ──

async function main() {
  console.log('🚀 MyBatis-Plus Releases 同步器\n');

  let releases;
  try {
    releases = await fetchReleases();
    console.log(`  ✅ 拉取 ${releases.length} 条 release`);
  } catch (err) {
    console.error(`  ❌ API 拉取失败: ${err.message}`);
    if (fs.existsSync(RELEASES_PATH)) {
      console.log('  ⚠ 保留既有 releases.html，本次跳过更新');
      return;
    }
    console.log('  ⚠ 无既有页面，生成占位页避免部署失败');
    releases = [];
  }

  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  const syncedAt = `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())} ${p(now.getUTCHours())}:${p(now.getUTCMinutes())} UTC`;

  const page = buildPage(releases, syncedAt);
  fs.writeFileSync(RELEASES_PATH, page, 'utf-8');
  console.log(`  ✅ releases.html → ${path.relative(OUTPUT_DIR, RELEASES_PATH)} (${page.length} bytes)`);

  const latestTag = releases[0] && (releases[0].tag_name || releases[0].name);
  if (latestTag) {
    updateIndexVersion(latestTag);
  } else {
    console.warn('  ⚠ 无 release 数据，跳过版本徽章更新');
  }
}

main().catch(err => {
  console.error('❌ 致命错误:', err);
  process.exit(1);
});
