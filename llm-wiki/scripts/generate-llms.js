#!/usr/bin/env node
/**
 * MyBatis-Plus llms.txt 生成器（爬虫版 + 本地文档）
 * 
 * 数据来源：
 * 1. baomidou.com — 爬取已渲染的 HTML 页面（MyBatis-Plus 文档），cheerio 解析转为 Markdown
 * 2. 本地 Markdown — llm-wiki/mybatis-native/ 目录（MyBatis 原生 XML Mapper 语法）
 * 
 * 生成物：llms.txt（索引）/ llms-full.txt（聚合）/ docs/（清洗版单篇）
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://baomidou.com';
const MYBATIS_DOCS_URL = 'https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html';
const OUTPUT_DIR = path.join(__dirname, '..');           // llm-wiki/
const REPO_ROOT = path.join(__dirname, '..', '..');       // 仓库根
const DOCS_DIR = path.join(REPO_ROOT, 'docs');            // 仓库根/docs/
const LOCAL_NATIVE_DIR = path.join(OUTPUT_DIR, 'mybatis-native'); // llm-wiki/mybatis-native/

// ── 侧边栏配置（分组 + 页面 slug）──
// 标题从页面 <h1> 自动提取
const SIDEBAR = [
  {
    label: '从这里开始',
    dir: 'getting-started',
    items: ['install', 'config', 'test'],
  },
  {
    label: '指南',
    dir: 'guides',
    items: [
      'wrapper', 'code-generator', 'new-code-generator',
      'auto-fill-field', 'logic-delete', 'auto-convert-enum',
      'id-generator', 'key-generator', 'auto-ddl',
      'dynamic-datasource', 'security', 'data-interface',
      'batch-operation', 'stream-query', 'type-handler',
      'sql-injector', 'p6spy',
    ],
  },
  {
    label: '插件',
    dir: 'plugins',
    items: [
      'pagination', 'optimistic-locker', 'block-attack',
      'data-change-recorder', 'data-permission', 'dynamic-table-name',
      'illegal-sql-intercept', 'tenant',
    ],
  },
  {
    label: '参考',
    dir: 'reference',
    items: [
      'annotation', 'code-generator-configuration',
      'new-code-generator-configuration', 'question', 'about-cve',
    ],
  },
  {
    label: 'MyBatis 原生',
    dir: 'mybatis-native',
    items: [
      'mapper-overview', 'crud-mapping', 'result-map',
      'dynamic-sql', 'sql-include', 'parameters', 'cache',
    ],
    source: 'local',
  },
];

// ── 工具函数 ──

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.error(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await sleep(2000 * attempt);
      else throw err;
    }
  }
}

// ── 语言推断 ──

function detectLanguage(code) {
  const trimmed = code.trim();
  if (!trimmed) return '';
  if (/<\/?(?:dependency|repositories|plugin|build|project|settings|mirror|dependencyManagement|scope|type|groupId|artifactId|version)\b/.test(trimmed)) return 'xml';
  if (/^(import |package )/m.test(trimmed)) return 'java';
  if (/^(implementation|dependencies|repositories|plugins|api)\s*[\({]/m.test(trimmed)) return 'groovy';
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/im.test(trimmed)) return 'sql';
  if (/^[\w.-]+=(.*)$/m.test(trimmed) && !trimmed.includes('{')) return 'properties';
  if (/^[\w-]+:\s/m.test(trimmed) && trimmed.includes('\n')) return 'yaml';
  if (/^#!\/(bin|usr)/.test(trimmed)) return 'bash';
  return '';
}

// ── HTML → Markdown 转换 ──

function unescapeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function processInline($el, $) {
  let result = '';
  $el.contents().each((_, node) => {
    if (node.type === 'text') {
      result += unescapeHtml(node.data);
    } else if (node.type === 'tag') {
      const tag = node.tagName;
      if (tag === 'strong' || tag === 'b') {
        result += `**${processInline($(node), $)}**`;
      } else if (tag === 'em' || tag === 'i') {
        result += `*${processInline($(node), $)}*`;
      } else if (tag === 'code') {
        result += '`' + $(node).text() + '`';
      } else if (tag === 'a') {
        const href = $(node).attr('href') || '';
        const text = $(node).text().trim();
        if (!text) return;
        // 内部锚点链接保留文字，不保留 href
        if (href.startsWith('#')) {
          result += text;
        } else {
          const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
          result += `[${text}](${fullUrl})`;
        }
      } else if (tag === 'br') {
        result += '\n';
      } else if (tag === 'span' || tag === 'div') {
        result += processInline($(node), $);
      } else if (tag === 'img') {
        const alt = $(node).attr('alt') || '';
        if (alt) result += `![${alt}](${$(node).attr('src') || ''})`;
      } else if (tag === 'sup') {
        result += `^${$(node).text()}^`;
      } else if (tag === 'sub') {
        result += `~${$(node).text()}~`;
      } else if (tag === 'mark') {
        result += `==${$(node).text()}==`;
      } else if (tag === 'del' || tag === 's') {
        result += `~~${$(node).text()}~~`;
      } else {
        result += processInline($(node), $);
      }
    }
  });
  return result.replace(/\n{3,}/g, '\n\n');
}

function processCodeBlock($figure, $) {
  const lines = [];
  $figure.find('div.ec-line').each((_, line) => {
    lines.push($(line).text());
  });

  if (lines.length === 0) {
    const preText = $figure.find('pre').text();
    if (preText.trim()) {
      lines.push(...preText.split('\n'));
    }
  }

  // 清理行尾空白，但保留缩进
  const code = lines
    .map(l => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

  if (!code) return '';

  const lang = detectLanguage(code);
  return '```' + lang + '\n' + code + '\n```\n\n';
}

function processAside($aside, $) {
  const titleEl = $aside.find('.starlight-aside__title').first();
  const title = titleEl.text().trim();
  titleEl.remove();
  $aside.find('svg').remove();

  const content = processChildren($aside, $).trim();
  const lines = content.split('\n');
  const result = lines.map(l => l.trim() ? `> ${l}` : '>').join('\n');

  if (title) {
    return `> **${title}**\n${result}\n\n`;
  }
  return `${result}\n\n`;
}

function processList($list, $, ordered) {
  let result = '';
  let idx = 1;
  $list.children('li').each((_, li) => {
    const $li = $(li);

    // 检查 li 是否包含块级内容（代码块、Tabs、图等）
    // 用白名单检测块级元素，避免把 <code>/<strong>/<a> 等行内元素误判为块级
    const BLOCK_TAGS = 'div, figure, pre, starlight-tabs, table, blockquote, details, section, aside, ol, ul';
    const $block = $li.children(BLOCK_TAGS).not('[aria-hidden]');
    const hasBlock = $block.length > 0;

    if (hasBlock) {
      // 复杂 li：先提取行内文本（第一个 p），再处理块级内容
      const $p = $li.children('p').first();
      let stepText = '';
      if ($p.length) {
        stepText = processInline($p, $).trim();
        $p.remove();
      }
      // 移除步骤序号图标
      $li.find('[aria-hidden]').remove();

      const prefix = ordered ? `${idx}. ` : '- ';
      if (stepText) result += `${prefix}${stepText}\n\n`;
      // 无行内文本时不输出空 bullet，直接输出块级内容

      // 处理剩余块级内容
      result += processChildren($li, $);
    } else {
      // 简单 li：只有行内文本
      const $nested = $li.children('ul, ol').first();
      let nestedMd = '';
      if ($nested.length) {
        $nested.remove();
        nestedMd = processList($nested, $, $nested.is('ol'));
      }

      $li.find('[aria-hidden]').remove();
      const text = processInline($li, $).trim();
      const prefix = ordered ? `${idx}. ` : '- ';
      result += `${prefix}${text}\n`;

      if (nestedMd) {
        result += nestedMd.split('\n').map(l => l ? '  ' + l : '').join('\n');
      }
    }
    idx++;
  });
  return result + '\n';
}

function processTable($table, $) {
  const rows = [];
  $table.find('tr').each((_, tr) => {
    const cells = [];
    $(tr).find('th, td').each((_, cell) => {
      cells.push(processInline($(cell), $).trim().replace(/\|/g, '\\|'));
    });
    rows.push(cells);
  });

  if (rows.length === 0) return '';

  let result = '';
  const header = rows[0];
  result += '| ' + header.join(' | ') + ' |\n';
  result += '|' + header.map(() => '---').join('|') + '|\n';
  for (let i = 1; i < rows.length; i++) {
    result += '| ' + rows[i].join(' | ') + ' |\n';
  }
  return result + '\n';
}

function processTabs($container, $) {
  // $container 是 <starlight-tabs> 元素，tablist 和 tabpanel 都在它内部
  const tabTitles = [];
  $container.find('[role="tab"]').each((_, tab) => {
    tabTitles.push($(tab).text().trim());
  });

  let result = '';
  let panelIdx = 0;

  $container.find('[role="tabpanel"]').each((_, panel) => {
    const $panel = $(panel);
    const title = tabTitles[panelIdx] || `Tab ${panelIdx + 1}`;
    result += `**${title}**\n\n`;
    result += processChildren($panel, $);
    panelIdx++;
  });

  return result;
}

function processChildren($el, $) {
  let result = '';
  const children = $el.children().toArray();

  for (const child of children) {
    const $child = $(child);
    const tag = child.tagName;

    // 跳过广告/脚本/SVG
    if ($child.hasClass('google-ads-frame') || tag === 'script' || tag === 'style' || tag === 'svg') continue;
    if ($child.hasClass('right-sidebar-container')) continue;

    if (tag === 'h1') {
      // h1 作为页面标题，在主函数中提取，body 中不重复
      continue;
    } else if (tag === 'h2') {
      result += `\n## ${$child.text().trim()}\n\n`;
    } else if (tag === 'h3') {
      result += `\n### ${$child.text().trim()}\n\n`;
    } else if (tag === 'h4') {
      result += `\n#### ${$child.text().trim()}\n\n`;
    } else if (tag === 'h5') {
      result += `\n##### ${$child.text().trim()}\n\n`;
    } else if (tag === 'h6') {
      result += `\n###### ${$child.text().trim()}\n\n`;
    } else if (tag === 'p') {
      const text = processInline($child, $).trim();
      if (text) result += text + '\n\n';
    } else if (tag === 'figure') {
      if ($child.hasClass('frame')) {
        result += processCodeBlock($child, $);
      } else {
        result += processChildren($child, $);
      }
    } else if (tag === 'aside') {
      if ($child.hasClass('starlight-aside')) {
        result += processAside($child, $);
      } else {
        result += processChildren($child, $);
      }
    } else if (tag === 'ul') {
      result += processList($child, $, false);
    } else if (tag === 'ol') {
      result += processList($child, $, true);
    } else if (tag === 'table') {
      result += processTable($child, $);
    } else if (tag === 'blockquote') {
      const text = processInline($child, $).trim();
      if (text) {
        result += text.split('\n').map(l => l.trim() ? `> ${l}` : '>').join('\n') + '\n\n';
      }
    } else if (tag === 'hr') {
      result += '---\n\n';
    } else if (tag === 'starlight-tabs') {
      // Starlight Tabs 组件：<starlight-tabs> 内含 tablist + tabpanel
      result += processTabs($child, $);
    } else if (tag === 'div') {
      if ($child.hasClass('expressive-code')) {
        // 嵌套在 expressive-code 里的 figure
        const $fig = $child.find('figure.frame').first();
        if ($fig.length) result += processCodeBlock($fig, $);
        else result += processChildren($child, $);
      } else {
        result += processChildren($child, $);
      }
    } else if (tag === 'section') {
      result += processChildren($child, $);
    } else if (tag === 'pre') {
      // 独立的 pre 块（不在 figure 内）
      const code = $child.text().replace(/^\n+/, '').replace(/\n+$/, '');
      if (code.trim()) {
        const lang = detectLanguage(code);
        result += '```' + lang + '\n' + code + '\n```\n\n';
      }
    } else if (tag === 'details') {
      // 折叠面板
      const summary = $child.find('summary').text().trim();
      $child.find('summary').remove();
      if (summary) result += `**${summary}**\n\n`;
      result += processChildren($child, $);
    } else if (tag === 'img') {
      const alt = $child.attr('alt') || '';
      const src = $child.attr('src') || '';
      if (alt || src) result += `![${alt}](${src})\n\n`;
    } else if (tag === 'br') {
      result += '\n';
    } else {
      // 其他标签：先尝试 inline 处理（保留文本节点），空则递归子元素
      const inline = processInline($child, $).trim();
      if (inline) {
        result += inline + '\n\n';
      } else {
        result += processChildren($child, $);
      }
    }
  }

  return result;
}

// ── 主转换函数 ──

function convertHtml(html) {
  const $ = cheerio.load(html);
  const $main = $('main[data-pagefind-body]');

  if (!$main.length) {
    console.error('  ❌ 未找到 main[data-pagefind-body]');
    return null;
  }

  // 提取标题
  const title = $main.find('h1').first().text().trim();

  // 清理不需要的元素
  $main.find('.right-sidebar-container').remove();
  $main.find('.google-ads-frame').remove();
  $main.find('script, style, svg, link').remove();
  $main.find('[aria-label=" advertisements"]').remove();
  $main.find('.adsbygoogle').remove();
  $main.find('.ad').remove();
  // 移除所有图片（LLM 无法渲染图片，logo/截图等对 AI 无价值）
  $main.find('img').remove();
  // 清理页脚内容（Astro Starlight 的 site-footer 在 div.not-content 内，不在 <footer> 内）
  $main.find('footer').remove();
  $main.find('.meta').remove();
  $main.find('.pagination-links').remove();
  $main.find('.sl-flex[aria-label]').remove();
  $main.find('.text-center.mt-20').remove();  // site footer 容器
  $main.find('.sl-link-card').remove();        // 底部链接卡片

  // 转换
  let body = processChildren($main, $);

  // 清理多余空行
  body = body.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  return { title, body };
}

// ── llms.txt / llms-full.txt 生成 ──

function generateIndex(allPages) {
  let llmsTxt = '';
  llmsTxt += `# MyBatis-Plus\n\n`;
  llmsTxt += `> MyBatis-Plus 是一个 MyBatis 的增强工具，在 MyBatis 的基础上只做增强不做改变，为简化开发、提高效率而生。\n\n`;
  llmsTxt += `> 关键词：CRUD · 条件构造器 · LambdaQueryWrapper · 分页插件 · 逻辑删除 · 自动填充 · 乐观锁 · 多租户 · 代码生成 · BaseMapper · IService · 动态表名 · 事务管理\n\n`;

  for (const group of SIDEBAR) {
    const pages = allPages.filter(p => p.group === group.dir);
    if (pages.length === 0) continue;

    llmsTxt += `## ${group.label}\n\n`;
    for (const page of pages) {
      llmsTxt += `- [${page.title}](docs/${group.dir}/${page.slug}.md)\n`;
    }
    llmsTxt += '\n';
  }

  return llmsTxt;
}

function generateFull(allPages) {
  let full = '';
  full += `# MyBatis-Plus 全量文档\n\n`;
  full += `> MyBatis-Plus 是一个 MyBatis 的增强工具，在 MyBatis 的基础上只做增强不做改变，为简化开发、提高效率而生。\n\n`;
  full += `> 关键词：CRUD · 条件构造器 · LambdaQueryWrapper · 分页插件 · 逻辑删除 · 自动填充 · 乐观锁 · 多租户 · 代码生成 · BaseMapper · IService · 动态表名 · 事务管理\n\n`;

  for (const group of SIDEBAR) {
    const pages = allPages.filter(p => p.group === group.dir);
    if (pages.length === 0) continue;

    full += `\n---\n\n# ${group.label}\n\n`;

    for (const page of pages) {
      full += `\n---\n\n`;
      full += `## ${page.title}\n\n`;
      full += page.body;
      full += '\n';
    }
  }

  return full;
}

// ── 本地 Markdown 读取（MyBatis 原生文档）──

function processLocalMarkdown(slug) {
  const localPath = path.join(LOCAL_NATIVE_DIR, `${slug}.md`);
  if (!fs.existsSync(localPath)) {
    throw new Error(`本地文件不存在: ${localPath}`);
  }

  const content = fs.readFileSync(localPath, 'utf-8');

  // 提取标题（第一个 # 行）
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;

  // 提取正文（去掉标题行和来源行后的内容）
  let body = content;
  // 移除第一行标题
  body = body.replace(/^# .+\n/, '');
  // 移除来源行
  body = body.replace(/^> 来源:.+\n/, '');

  return { title, body: body.trim() + '\n' };
}

// ── 主函数 ──

async function main() {
  console.log('🚀 MyBatis-Plus llms.txt 生成器（爬虫版）\n');

  // 清理 docs 目录
  if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true, force: true });
  }

  const allPages = [];
  let total = 0;
  let success = 0;
  let failed = 0;

  // 统计总页数
  for (const group of SIDEBAR) total += group.items.length;
  console.log(`📋 共 ${total} 个页面待爬取\n`);

  for (const group of SIDEBAR) {
    console.log(`\n── ${group.label} ──`);

    for (const slug of group.items) {
      const outDir = path.join(DOCS_DIR, group.dir);
      const outPath = path.join(outDir, `${slug}.md`);

      process.stdout.write(`  [${success + failed + 1}/${total}] ${group.dir}/${slug} ... `);

      try {
        let title, body, sourceUrl;

        if (group.source === 'local') {
          // 本地 Markdown 文件（MyBatis 原生文档）
          const result = processLocalMarkdown(slug);
          title = result.title;
          body = result.body;
          sourceUrl = MYBATIS_DOCS_URL;
        } else {
          // 爬取官网 HTML
          const url = `${BASE_URL}/${group.dir}/${slug}/`;
          const html = await fetchPage(url);
          const result = convertHtml(html);

          if (!result) {
            console.log('❌ 转换失败');
            failed++;
            continue;
          }

          title = result.title;
          body = result.body;
          sourceUrl = url;
        }

        // 写入单篇
        fs.mkdirSync(outDir, { recursive: true });

        let mdContent = '';
        mdContent += `# ${title}\n\n`;
        mdContent += `> 来源: ${sourceUrl}\n\n`;
        mdContent += body;

        fs.writeFileSync(outPath, mdContent, 'utf-8');

        allPages.push({
          group: group.dir,
          slug,
          title,
          body,
        });

        console.log(`✅ ${title}`);
        success++;
      } catch (err) {
        console.log(`❌ ${err.message}`);
        failed++;
      }

      // 礼貌延迟（仅爬虫模式需要）
      if (group.source !== 'local') {
        await sleep(500);
      }
    }
  }

  console.log(`\n\n📊 结果: ${success} 成功, ${failed} 失败`);

  if (allPages.length === 0) {
    console.error('❌ 没有成功爬取任何页面，终止');
    process.exit(1);
  }

  // 生成 llms.txt
  const llmsTxt = generateIndex(allPages);
  const llmsTxtPath = path.join(OUTPUT_DIR, 'llms.txt');
  fs.writeFileSync(llmsTxtPath, llmsTxt, 'utf-8');
  console.log(`\n✅ llms.txt → ${path.relative(OUTPUT_DIR, llmsTxtPath)}`);

  // 生成 llms-full.txt
  const llmsFull = generateFull(allPages);
  const llmsFullPath = path.join(OUTPUT_DIR, 'llms-full.txt');
  fs.writeFileSync(llmsFullPath, llmsFull, 'utf-8');
  console.log(`✅ llms-full.txt → ${path.relative(OUTPUT_DIR, llmsFullPath)}`);

  // 统计
  console.log(`\n📈 统计:`);
  console.log(`  单篇文档: ${allPages.length} 篇`);
  console.log(`  llms.txt: ${llmsTxt.length} bytes`);
  console.log(`  llms-full.txt: ${llmsFull.length} bytes`);
}

main().catch(err => {
  console.error('❌ 致命错误:', err);
  process.exit(1);
});
