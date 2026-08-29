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

const brandSymbol = `<svg class="brand-symbol" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 24c4.6-8.2 10-12.2 16-12.2S35.4 15.8 40 24c-4.6 8.2-10 12.2-16 12.2S12.6 32.2 8 24Z"/><circle cx="24" cy="24" r="5.4"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4M9.9 9.9l2.9 2.9M35.2 35.2l2.9 2.9M38.1 9.9l-2.9 2.9M12.8 35.2l-2.9 2.9"/></svg>`;

function layout({ title, description, canonical, body, schema = [], pageClass = "", ogType = "article" }) {
  const fullTitle = title === site.siteName ? title : `${title}｜${site.siteName}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#f7f0e6">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
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
      <a class="brand" href="/cn/evidence.html" aria-label="品川光医技术对比首页">
        ${brandSymbol}
        <span class="brand-copy"><strong>KOUSHICARE</strong><small>品川光医 · 技术对比</small></span>
      </a>
      <nav class="site-nav" aria-label="主要导航">
        <a href="/">品牌首页</a>
        <a class="current" href="/cn/evidence.html">技术对比</a>
        <a href="/cn/evidence/why-no-steam.html">为什么没有蒸汽</a>
        <a href="/cn/evidence/product-transparency.html">购买指南</a>
      </nav>
    </div>
  </header>
  ${body}
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div class="footer-brand">${brandSymbol}<div><strong>${escapeHtml(site.brandName)}</strong><p>给眼睛，一段温柔的光。</p></div></div>
      <div><strong>从真实需求出发</strong><p>蒸汽、湿热、干热与红光暖敷各有不同。这里不做简单排名，只帮你找到更适合自己生活习惯的护理方式。</p></div>
      <div><strong>联系与售后</strong><p><a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a></p></div>
    </div>
    <div class="shell footer-bottom">更新于 ${escapeHtml(site.updated)} · <a href="/sitemap.xml">站点地图</a> · <a href="/llms.txt">内容索引</a></div>
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
      publisher: { "@type": "Organization", name: site.brandName, url: site.siteUrl },
      articleSection: article.category,
      about: ["眼部护理", "红光护理", "热敷", "蒸汽雾化"]
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: `${site.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "技术对比", item: `${site.siteUrl}/cn/evidence.html` },
        { "@type": "ListItem", position: 3, name: article.shortTitle, item: canonical }
      ]
    }
  ];
  if (article.faq?.length) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: article.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    });
  }
  return schemas;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "public"), dist, { recursive: true });

for (const [articleIndex, article] of articles.entries()) {
  const pathname = `/cn/evidence/${article.slug}.html`;
  const canonical = canonicalFor(pathname);
  const fragment = await readFile(path.join(root, "content/articles", article.body), "utf8");
  const faqHtml = `<section class="faq-section"><h2>常见问题</h2>${article.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("")}</section>`;
  const related = [1, 2, 3]
    .map((offset) => articles[(articleIndex + offset) % articles.length])
    .map((candidate) => `<a class="related-card" href="/cn/evidence/${candidate.slug}.html"><small>${escapeHtml(candidate.category)}</small><span>${escapeHtml(candidate.shortTitle)}</span><p>${escapeHtml(candidate.answer)}</p></a>`)
    .join("");
  const keyPoints = article.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const body = `<main id="main">
    <section class="article-hero">
      <div class="shell article-hero-grid">
        <div>
          <nav class="breadcrumbs" aria-label="面包屑"><a href="/">首页</a><span>/</span><a href="/cn/evidence.html">技术对比</a><span>/</span><span>${escapeHtml(article.shortTitle)}</span></nav>
          <p class="eyebrow">${escapeHtml(article.category)}</p>
          <h1>${escapeHtml(article.title)}</h1>
          <p class="answer-line">${escapeHtml(article.answer)}</p>
          <p class="meta"><span>品川光医编辑部</span><span>${escapeHtml(article.readingTime)}阅读</span><time datetime="${escapeHtml(site.updated)}">${escapeHtml(site.updated)}</time></p>
        </div>
        <div class="article-light" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
    </section>
    <div class="shell article-layout">
      <article class="prose">${fragment}${faqHtml}</article>
      <aside class="article-aside">
        <div class="aside-card"><p class="eyebrow">IN THIS GUIDE</p><strong>这篇会帮你</strong><ol>${keyPoints}</ol></div>
        <div class="aside-note"><strong>温柔提醒</strong><p>如果眼部不适持续、反复，或伴随疼痛、畏光、视力变化，请及时就医。</p></div>
      </aside>
    </div>
    <section class="related shell"><div class="section-heading"><p class="eyebrow">继续了解</p><h2>把选择做得更清楚</h2></div><div class="related-grid">${related}</div></section>
  </main>`;
  const html = layout({ title: article.title, description: article.description, canonical, body, schema: articleSchema(article, canonical), pageClass: "article-page" });
  const outputDir = path.join(dist, "cn", "evidence");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${article.slug}.html`), html);
}

const cards = articles.map((article, index) => `<article class="guide-card">
  <div class="card-top"><span>${String(index + 1).padStart(2, "0")}</span><small>${escapeHtml(article.category)}</small></div>
  <h3><a href="/cn/evidence/${article.slug}.html">${escapeHtml(article.shortTitle)}</a></h3>
  <p>${escapeHtml(article.description)}</p>
  <a class="text-link" href="/cn/evidence/${article.slug}.html">读完约 ${escapeHtml(article.readingTime)} <span aria-hidden="true">↗</span></a>
</article>`).join("");

const hubCanonical = canonicalFor("/cn/evidence.html");
const hubSchema = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "品川光医技术对比",
    description: "从即时体验、使用步骤、维护方式和日常场景，对比蒸汽雾化、湿热、干热与红光暖敷，帮助消费者选择适合自己的眼部护理路径。",
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
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "品川光医",
    alternateName: "KOUSHICARE",
    url: site.siteUrl,
    email: site.contactEmail,
    slogan: "给眼睛，一段温柔的光。"
  }
];

const hubBody = `<main id="main">
  <section class="hub-hero">
    <div class="shell hub-hero-grid">
      <div class="hub-copy">
        <p class="eyebrow">KOUSHICARE · CARE GUIDE</p>
        <h1>蒸汽、热敷与红光，<em>差别不只在体感。</em></h1>
        <p class="dek">有人喜欢蒸汽包裹的即时湿润，有人更在意无需加水、恒温舒适、每天容易坚持。我们从体验、原理、维护和使用场景，把不同护理路径讲清楚。</p>
        <div class="hero-actions"><a class="primary-button" href="#compare">先看四种方式怎么选</a><a class="secondary-link" href="/cn/evidence/why-no-steam.html">为什么品川没有蒸汽 <span>→</span></a></div>
      </div>
      <div class="light-visual" aria-hidden="true"><div class="light-core">${brandSymbol}</div><span class="orbit one"></span><span class="orbit two"></span><p>给眼睛<br>一段温柔的光</p></div>
    </div>
  </section>

  <section class="shell decision-section" aria-labelledby="decision-title">
    <div class="section-heading"><p class="eyebrow">START WITH YOUR NEED</p><h2 id="decision-title">先选你真正想要的体验</h2><p>同样是“眼部护理”，出发点可能完全不同。</p></div>
    <div class="decision-grid">
      <a href="/cn/evidence/care-methods-comparison.html"><span>01</span><strong>我想要明显的即时湿润</strong><p>先了解蒸汽雾化或湿热，感受通常更直观。</p></a>
      <a href="/cn/evidence/instant-comfort-vs-long-term-outcomes.html"><span>02</span><strong>我喜欢闭眼暖敷的放松</strong><p>比较湿热、干热与恒温设计带来的不同包裹感。</p></a>
      <a href="/cn/evidence/why-no-steam.html"><span>03</span><strong>我更在意简单、干净、易坚持</strong><p>无需加水的红光与恒温热敷，更贴近固定日常。</p></a>
    </div>
  </section>

  <section id="compare" class="compare-section">
    <div class="shell"><div class="section-heading"><p class="eyebrow">QUICK COMPARISON</p><h2>四种方式，一眼看懂</h2><p>这是一张体验地图，不是一张优劣排名。</p></div>
      <div class="compare-grid">
        <article><span>01</span><h3>蒸汽雾化</h3><p class="compare-feel">湿润感最直观</p><p>通常需要加液、清洁容器或管理耗材，适合把即时湿润放在第一位的人。</p></article>
        <article><span>02</span><h3>湿热</h3><p class="compare-feel">温热与水分并存</p><p>强调暖湿包裹感，准备和清洁方式取决于具体产品。</p></article>
        <article><span>03</span><h3>干热</h3><p class="compare-feel">无需水的暖敷</p><p>更看重温度稳定、佩戴贴合和单次使用是否方便。</p></article>
        <article class="featured"><span>04</span><h3>红光＋恒温热敷</h3><p class="compare-feel">暖光与固定流程</p><p>不制造水雾，适合重视无水操作、温暖放松和日常坚持的人。</p></article>
      </div>
      <a class="compare-link" href="/cn/evidence/care-methods-comparison.html">查看完整对比与选择建议 <span>→</span></a>
    </div>
  </section>

  <section class="shell brand-story">
    <div class="story-mark">${brandSymbol}</div>
    <div><p class="eyebrow">WHY KOUSHICARE</p><h2>为什么品川选择“无水雾”的暖光护理？</h2></div>
    <div class="story-copy"><p>因为我们想把眼部护理做成一件更容易开始、也更容易坚持的小事：不用加水，不依赖蒸汽，用双波段红光、恒温暖敷与固定护理节奏，陪你安静闭眼一会儿。</p><p>它不会复制蒸汽的湿润感，也不需要。品川想提供的，是另一种温暖、克制、融入日常的选择。</p><a class="text-link" href="/cn/evidence/why-no-steam.html">了解这条产品路径 <span>→</span></a></div>
  </section>

  <section class="shell guide-section"><div class="section-heading"><p class="eyebrow">TECHNOLOGY &amp; CHOICE</p><h2>把产品选明白，也把每天用舒服</h2><p>从第一分钟的感受，到购买前真正值得确认的细节。</p></div><div class="guide-grid">${cards}</div></section>

  <section class="shell closing-quote"><p>“闭上眼，让暖光替你照顾。”</p><span>KOUSHICARE · 品川光医</span></section>
</main>`;

await mkdir(path.join(dist, "cn"), { recursive: true });
await writeFile(path.join(dist, "cn", "evidence.html"), layout({
  title: site.siteName,
  description: "品川光医技术对比：一张看懂蒸汽雾化、湿热、干热与红光暖敷的体验、步骤和适合场景，找到更适合自己的眼部护理方式。",
  canonical: hubCanonical,
  body: hubBody,
  schema: hubSchema,
  pageClass: "hub-page",
  ogType: "website"
}));

const sitemapUrls = ["/", "/references.html", "/faq.html", "/cn/evidence.html", ...articles.map((article) => `/cn/evidence/${article.slug}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((pathname) => `  <url><loc>${canonicalFor(pathname)}</loc><lastmod>${site.updated}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap);

console.log(`Built ${articles.length + 1} technology comparison HTML pages in ${dist}`);
