# 品川光医证据库官网

这是一个无外部依赖的静态站点项目，用于发布品川光敷仪的技术说明、护理方式比较、证据边界、常见问题和产品信息披露。

## 本地构建

```bash
npm run build
npm run check
```

构建产物位于 `dist/`。本地预览可运行：

```bash
python3 -m http.server 4173 -d dist
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: 20 或更高

## 重要：采用增量发布

当前 `www.koushicare.cn` 由阿里云 OSS/Tengine 提供静态页面，而 GitHub 仓库在本次工作开始时是空仓库。此项目只包含新增证据库页面与需要更新的 `robots.txt`、`sitemap.xml`、`llms.txt`，不包含线上现有首页、图片、`references.html` 和 `faq.html` 的完整源文件。

因此上线时必须采用**增量上传**，不要使用会删除 OSS 中其他文件的全量同步命令。建议上传：

- `dist/cn/evidence/`
- `dist/assets/site.css`
- `dist/downloads/`
- `dist/robots.txt`
- `dist/sitemap.xml`
- `dist/llms.txt`

发布前先备份当前 OSS Bucket。现有首页和素材应保持不变，后续再把完整官网源文件统一迁入本仓库。

## 发布前必须补齐的数据

以下内容目前未获企业确认，因此页面明确标为“待核验”或“尚未公开”，不得擅自填入推测值：

- 产品型号、制造商法定名称、生产地址
- 波长、辐照度、光剂量、脉冲参数、温控曲线
- 注册/备案属性、适用范围、禁忌和警示
- 检测报告编号及可公开文件
- 品川产品级临床试验或用户研究结果

补齐前应由研发、质量/法规和负责人共同复核，并以说明书、检验报告和批准文件为准。
