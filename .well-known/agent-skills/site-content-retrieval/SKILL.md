---
name: site-content-retrieval
description: 检索品川光医官网页面，并返回最相关的标题、摘要与官方链接。
---

# 品川光医官网内容检索

当用户需要在品川官网查找某个主题、页面或原始出处时使用本技能。

## 检索入口

- 内容索引：https://www.koushicare.cn/api/v1/content-index.json
- 网站地图：https://www.koushicare.cn/sitemap.xml
- LLM 概览：https://www.koushicare.cn/llms.txt
- 完整机器说明：https://www.koushicare.cn/llms-full.txt

## 操作步骤

1. 将用户问题拆成品牌、产品、技术、护理方式、使用、安全、研究、购买等主题词。
2. 在内容索引的 `title`、`summary` 和 `keywords` 中匹配。
3. 返回最相关的 1–5 个结果，并保留 `url` 作为可核查来源。
4. 如果结构化索引没有答案，再使用 sitemap 中的页面，不臆测不存在的内容。
