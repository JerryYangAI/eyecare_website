# www.koushicare.cn SEO / GEO 审计与更新说明

审计日期：2026-08-29

## 当前索引状态

公开搜索未返回 `site:koushicare.cn` 的有效结果；直接访问确认官网首页、robots.txt、sitemap.xml、references.html 和 faq.html 均可访问。现状如下：

- 首页返回 200，canonical 正确指向 `https://www.koushicare.cn/`。
- robots.txt 返回 200，允许通用爬虫及主流 AI/GEO 爬虫，并正确声明 sitemap。
- sitemap.xml 返回 200，但当前只包含首页、`references.html`、`faq.html` 三个 URL，最后更新时间仍为 2026-06-29。
- 首页已包含 Organization、WebSite、Product 和 FAQPage 结构化数据。

当前主要问题：

1. sitemap 覆盖不足，无法承载新增的系统证据页面。
2. 现有 `references.html` 没有给核心研究标题提供可点击的 DOI/PubMed/期刊链接，不利于用户核验和生成式搜索引用。
3. 现有文献页包含“TFOS DEWS III 已把低强度红光作为重要护理路径”“细胞只读得懂两个光窗”“ATP 提升约 30–40%”等需要更精确来源和限定条件的表述。
4. 首页 Product JSON-LD 声明双波段、41.5℃±0.5℃及多项认证；这些字段应与当前销售型号的说明书和检测报告逐项核对。结构化数据不能比页面可见证据更激进。
5. 当前页面未形成“技术方向研究”和“品川具体产品证据”的清晰分层。

这些问题会同时损害用户信任、传统 SEO 和生成式搜索引用质量。

## 本次仓库更新

- 为每个页面输出唯一、绝对地址的 canonical。
- 输出 XML sitemap，并为全部证据页写入 `lastmod`。
- robots.txt 明确允许 Googlebot、Bingbot、OAI-SearchBot、ChatGPT-User 和 PerplexityBot。
- 新增 `llms.txt`，向生成式搜索提供证据库入口与引用边界。
- 每页包含 `Article`、`BreadcrumbList`；证据库首页包含 `CollectionPage` 和 `ItemList`。
- FAQ 页面仅对页面可见问题输出 `FAQPage` 结构化数据。
- 所有主要内容直接存在于 HTML，不依赖客户端 JavaScript 渲染。
- 对未知参数和未完成试验使用明确状态，不把推测包装成事实。

## 发布后索引检查

1. 确认 `https://www.koushicare.cn/robots.txt` 返回 200 和 `text/plain`。
2. 确认 `https://www.koushicare.cn/sitemap.xml` 返回 200，并包含全部 8 个证据页。
3. 在 Google Search Console 和 Bing Webmaster Tools 提交 sitemap。
4. 对证据库首页及 8 个文章页执行 URL 检查并请求编入索引。
5. 检查页面源代码中的 canonical 与实际最终 URL 完全一致。
6. 发布后 7、14、28 天记录抓取、索引、自然搜索曝光和生成式搜索引用情况。

## 尚未完成的外部动作

本次已完成首页、robots.txt、sitemap.xml 和文献页的线上只读检查。尚未接入 Google Search Console 或 Bing Webmaster Tools，因此“已抓取/已发现”不等于“已正式编入索引”；发布后仍需在站长平台执行 URL 检查。
