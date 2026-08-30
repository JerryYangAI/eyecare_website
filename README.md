# 品川光医 KOUSHICARE 官网

> 品川之光，温柔以待每一寸目光。

聚焦「干眼场景」的居家日常眼部护理品牌官网——温润疗愈风格，纯品牌与产品信息展示（不在站内交易），移动优先，内置 SEO 与 GEO（被大模型抓取/引用）。

## 技术 / 部署

- **静态站点**：纯 HTML/CSS/JS，部署到阿里云 OSS，通过阿里云 CDN 提供 `www.koushicare.cn`。
- **公开机器接口**：`/api/`、OpenAPI、RFC 9727 API Catalog、ARD、Agent Skills、WebMCP 与 `llms.txt`。
- **只读 MCP**：通过锁定版本的阿里云官方 SDK 幂等部署到函数计算，由 `https://api.koushicare.cn/mcp` 提供；部署脚本会核验函数与匿名 HTTP 触发器，只增加 `/mcp` 路由并保留现有客服接口。
- **响应协商**：CDN EdgeScript 为首页添加发现 `Link` 头，并在客户端明确发送 `Accept: text/markdown` 时返回 `index.md`；浏览器仍默认获得 HTML。
- **DNS 发现**：阿里云 DNS 发布 `_index._agents.koushicare.cn` SVCB 记录，指向只读公开信息服务。
- **发布门禁**：推送到 `main` 后，GitHub Actions 先执行本地结构校验与单元测试，再部署，最后对生产域名执行端到端冒烟测试；任一步失败都会使流水线失败。

本地检查：

```bash
npm run qa
npm run infra:dry-run
npm run preview
```

## 目录结构

```
/
├── index.html            # 首页（单页长滚动）
├── images/               # 配图（hero、场景、原理、信任背书）
│   └── certs/            # CE/FCC/FDA/GB4706/MIC/CTI 认证缩图（首屏可点击放大）
├── videos/               # 原理视频（红光 / 热敷，已压缩 + faststart）
├── robots.txt            # 爬虫规则（含 AI 爬虫白名单）
├── sitemap.xml           # 站点地图
├── llms.txt              # 面向大模型的站点摘要（GEO）
├── .well-known/          # API、MCP、Skills 与 ARD 发现文档
├── api/                  # 只读公开信息与 OpenAPI
├── agent-api/            # 独立只读 MCP 函数
├── edge/                 # 阿里云 CDN EdgeScript
├── scripts/              # 校验、部署保护与生产冒烟测试
└── tests/                # 协议、部署合并与 WebMCP 测试
```

## SEO / GEO

- 语义化 HTML、唯一 H1、独立 title/description/keywords、canonical、Open Graph。
- 三组 schema.org 结构化数据：Organization、Product、FAQPage。
- `llms.txt` + 纯静态可爬 + 结构化 FAQ，便于豆包/Kimi/元宝/ChatGPT 等抓取与引用。

## 内容后台（CMS）— 下一步

本首页为手写静态页以保证设计精度。要让运营在网页后台编辑文案与图片，下一步将本站**模板化迁移到 Astro + Decap/Sveltia git-CMS**：内容存为 Markdown/JSON，后台编辑 → 自动构建上线。`/admin` 已预留 Decap 入口配置作为起点。

## 合规

本产品为家用眼部护理/舒缓设备，**非医疗器械**，不用于疾病诊断或治疗；红光与热敷为日常护理舒缓用途。营销文案统一使用「护眼 / 舒缓 / 日常护理」口径。

© 2026 品川光医 KOUSHICARE
