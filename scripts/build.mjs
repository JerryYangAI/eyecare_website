import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const site = JSON.parse(await readFile(path.join(root, "content/site.json"), "utf8"));
const articles = JSON.parse(await readFile(path.join(root, "content/articles.json"), "utf8"));

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const jsonLd = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const canonicalFor = (pathname) => `${site.siteUrl}${pathname}`;

function layout({ title, description, canonical, body, schema = [], pageClass = "" }) {
  const fullTitle = title === site.siteName ? title : `${title}｜${site.siteName}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="${escapeHtml(site.siteName)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/site.css">
  ${schema.map((item) => `<script type="application/ld+json">${jsonLd(item)}</script>`).join("\n  ")}
</head>
<body class="${escapeHtml(pageClass)}">
  <a class="skip-link" href="#main">跳到正文</a>
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/cn/evidence.html" aria-label="品川光医证据库首页">
        <span class="brand-mark" aria-hidden="true">光</span>
        <span><strong>品川光医</strong><small>证据库</small></span>
      </a>
      <nav aria-label="主要导航">
        <a href="/">品牌首页</a>
        <a href="/cn/evidence.html">证据库</a>
        <a href="/cn/evidence/product-transparency.html">产品信息</a>
        <a href="mailto:${escapeHtml(site.contactEmail)}">联系与售后</a>
      </nav>
    </div>
  </header>
  ${body}
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div><strong>${escapeHtml(site.brandName)}</strong><p>把已知、未知和正在验证的内容分开说清楚。</p></div>
      <div><strong>重要说明</strong><p>本站提供一般科普信息，不替代医生诊断、处方或治疗建议。产品信息以经核验的正式说明书和批准文件为准。</p></div>
      <div><strong>联系</strong><p><a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a></p></div>
    </div>
    <div class="shell footer-bottom">最后更新：${escapeHtml(site.updated)} · <a href="/sitemap.xml">站点地图</a> · <a href="/llms.txt">LLM 索引说明</a></div>
  </footer>
</body>
</html>`;
}

function articleSchema(article, canonical) {
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      inLanguage: "zh-CN",
      datePublished: site.updated,
      dateModified: site.updated,
      mainEntityOfPage: canonical,
      author: { "@type": "Organization", name: site.brandName },
      publisher: { "@type": "Organization", name: site.brandName, url: site.siteUrl }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: `${site.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "证据库", item: `${site.siteUrl}/cn/evidence.html` },
        { "@type": "ListItem", position: 3, name: article.shortTitle, item: canonical }
      ]
    }
  ];
  if (article.faq) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "为什么品川没有蒸汽？",
          acceptedAnswer: { "@type": "Answer", text: "品川当前采用无水雾的光与热护理路径，目标是提供可重复的居家护理流程。没有蒸汽不是优劣结论，而是作用路径和使用体验不同。" }
        },
        {
          "@type": "Question",
          name: "没有蒸汽是不是效果更差？",
          acceptedAnswer: { "@type": "Answer", text: "不能这样推断。即时湿润感、热护理和红光相关研究关注的指标不同，必须通过匹配产品参数和对照试验比较，不能只凭体感下结论。" }
        },
        {
          "@type": "Question",
          name: "更喜欢湿润感应该怎么选？",
          acceptedAnswer: { "@type": "Answer", text: "如果主要目标是即时湿润和蒸汽体验，湿热或经专业人员建议的相关护理可能更符合偏好；如症状持续或出现风险信号，应先就医。" }
        }
      ]
    });
  }
  return schemas;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "public"), dist, { recursive: true });

for (const article of articles) {
  const pathname = `/cn/evidence/${article.slug}.html`;
  const canonical = canonicalFor(pathname);
  const fragment = await readFile(path.join(root, "content/articles", article.body), "utf8");
  const related = articles
    .filter((candidate) => candidate.slug !== article.slug)
    .slice(0, 3)
    .map((candidate) => `<a class="related-card" href="/cn/evidence/${candidate.slug}.html"><span>${escapeHtml(candidate.shortTitle)}</span><small>${escapeHtml(candidate.description)}</small></a>`)
    .join("");
  const body = `<main id="main">
    <section class="article-hero">
      <div class="shell article-shell">
        <nav class="breadcrumbs" aria-label="面包屑"><a href="/">首页</a><span>/</span><a href="/cn/evidence.html">证据库</a><span>/</span><span>${escapeHtml(article.shortTitle)}</span></nav>
        <p class="eyebrow">证据与边界说明</p>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="dek">${escapeHtml(article.description)}</p>
        <div class="status ${escapeHtml(article.statusTone)}"><span aria-hidden="true"></span>${escapeHtml(article.status)}</div>
        <p class="meta">由品川光医证据库整理 · 更新于 ${escapeHtml(site.updated)}</p>
      </div>
    </section>
    <div class="shell article-layout">
      <article class="prose">${fragment}</article>
      <aside class="article-aside">
        <div class="aside-card"><strong>阅读这页时请记住</strong><p>技术方向的研究不能自动外推到参数未知的具体产品；用户体感也不能替代对照研究。</p></div>
        <div class="aside-card"><strong>发现信息错误？</strong><p>请把来源和修订建议发送到 <a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>。</p></div>
      </aside>
    </div>
    <section class="related shell"><h2>继续阅读</h2><div class="related-grid">${related}</div></section>
  </main>`;
  const html = layout({ title: article.title, description: article.description, canonical, body, schema: articleSchema(article, canonical), pageClass: "article-page" });
  const outputDir = path.join(dist, "cn", "evidence");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${article.slug}.html`), html);
}

const cards = articles.map((article, index) => `<article class="evidence-card">
  <div class="card-number">${String(index + 1).padStart(2, "0")}</div>
  <h2><a href="/cn/evidence/${article.slug}.html">${escapeHtml(article.shortTitle)}</a></h2>
  <p>${escapeHtml(article.description)}</p>
  <div class="status compact ${escapeHtml(article.statusTone)}"><span aria-hidden="true"></span>${escapeHtml(article.status)}</div>
  <a class="text-link" href="/cn/evidence/${article.slug}.html">阅读完整说明 <span aria-hidden="true">→</span></a>
</article>`).join("");

const hubCanonical = canonicalFor("/cn/evidence.html");
const hubSchema = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "品川光医证据库",
    description: "集中公开品川光敷仪的技术披露框架、护理方式比较、临床证据边界和产品信息。",
    url: hubCanonical,
    inLanguage: "zh-CN",
    publisher: { "@type": "Organization", name: site.brandName, url: site.siteUrl }
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: article.title,
      url: `${site.siteUrl}/cn/evidence/${article.slug}.html`
    }))
  }
];
const hubBody = `<main id="main">
  <section class="hub-hero">
    <div class="shell hub-hero-grid">
      <div><p class="eyebrow">PINCHUAN EVIDENCE CENTER</p><h1>把“感觉有效”变成<br>可核对、可追溯的信息</h1><p class="dek">我们不把雾化、湿热、干热或红光简单排成高低，也不把某个技术方向的研究直接当作品川产品的疗效证明。这里集中说明证据、参数、未知项和验证计划。</p></div>
      <div class="principles"><strong>我们的三条公开原则</strong><ol><li><span>01</span>来源可点击</li><li><span>02</span>未知不猜测</li><li><span>03</span>研究不越界</li></ol></div>
    </div>
  </section>
  <section class="shell intro-band"><div><strong>当前最重要的事实</strong><p>目前没有可公开核验的品川产品级随机对照试验，因此不能宣称品川已被证明优于雾化、湿热或其他设备。</p></div><a href="/cn/evidence/clinical-evidence-known-unknown.html">查看证据边界</a></section>
  <section class="shell evidence-section"><div class="section-heading"><p class="eyebrow">公开资料</p><h2>8 个问题，一次说清楚</h2></div><div class="evidence-grid">${cards}</div></section>
  <section class="shell method-section"><div><p class="eyebrow">HOW WE REVIEW</p><h2>证据强度取决于研究设计，不取决于文案语气</h2></div><div class="method-list"><div><span>A</span><strong>产品级对照证据</strong><p>与具体型号、参数和使用方法一致的预注册对照研究。</p></div><div><span>B</span><strong>同类技术研究</strong><p>只能支持“值得研究”，不能自动证明品川获得相同结果。</p></div><div><span>C</span><strong>用户体验与个案</strong><p>适合发现问题和提出假设，不能单独证明因果或优越性。</p></div></div></section>
</main>`;
await mkdir(path.join(dist, "cn"), { recursive: true });
await writeFile(path.join(dist, "cn", "evidence.html"), layout({ title: site.siteName, description: "品川光医公开证据库：技术参数、护理方式比较、临床证据边界、用户研究和产品信息披露。", canonical: hubCanonical, body: hubBody, schema: hubSchema, pageClass: "hub-page" }));

const sitemapUrls = ["/", "/references.html", "/faq.html", "/cn/evidence.html", ...articles.map((article) => `/cn/evidence/${article.slug}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((pathname) => `  <url><loc>${canonicalFor(pathname)}</loc><lastmod>${site.updated}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap);

console.log(`Built ${articles.length + 1} evidence HTML pages in ${dist}`);
