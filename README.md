# 品川光医 KOUSHICARE 官网

> 品川之光，温柔以待每一寸目光。

聚焦「干眼场景」的居家日常眼部护理品牌官网——温润疗愈风格，纯品牌与产品信息展示（不在站内交易），移动优先，内置 SEO 与 GEO（被大模型抓取/引用）。

## 技术 / 部署

- **静态站点**：纯 HTML/CSS/JS，无需构建，开箱即用。
- **托管**：Cloudflare Pages，绑定 `new-googles.com` 子域名（计划 `koushicare.new-googles.com`）。
- **部署方式**：
  1. 将本仓库连接到 Cloudflare Pages（Framework preset 选 `None`，Build command 留空，Output directory 填 `/`）。
  2. 或直接拖拽本目录到 Pages 上传。
- `_headers` 已配置静态资源长缓存与基础安全头。

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
└── _headers              # Cloudflare 缓存 / 安全头
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
