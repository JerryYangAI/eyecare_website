import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const site = JSON.parse(await readFile(path.join(root, "content/site.json"), "utf8"));

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else files.push(full);
  }
  return files;
}

const files = await collect(dist);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const failures = [];

function outputForHref(href) {
  const pathname = href.split("#")[0].split("?")[0];
  if (!pathname || pathname === "/") return null;
  if (pathname.endsWith("/")) return path.join(dist, pathname, "index.html");
  if (path.extname(pathname)) return path.join(dist, pathname);
  return path.join(dist, pathname, "index.html");
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const canonicalCount = (html.match(/rel="canonical"/g) || []).length;
  if (canonicalCount !== 1) failures.push(`${file}: canonical count ${canonicalCount}`);
  if (!html.includes("<meta name=\"description\"")) failures.push(`${file}: missing meta description`);
  const h1Count = (html.match(/<h1>/g) || []).length;
  if (h1Count !== 1) failures.push(`${file}: h1 count ${h1Count}`);
  if (/noindex/i.test(html)) failures.push(`${file}: contains noindex`);
  if (!html.includes("application/ld+json") && !file.endsWith("404.html")) failures.push(`${file}: missing JSON-LD`);
  if (file.includes(`${path.sep}cn${path.sep}evidence${path.sep}`) && !html.includes('class="answer-line"')) failures.push(`${file}: missing direct answer line`);
  if (file.includes(`${path.sep}cn${path.sep}evidence${path.sep}`) && !html.includes('"@type":"FAQPage"')) failures.push(`${file}: missing FAQ schema`);
  for (const forbidden of ["证据库", "待企业核验", "原始测试文件", "正式研究样本量 0", "一般信息，不能替代"]) {
    if (html.includes(forbidden)) failures.push(`${file}: contains consumer-facing internal phrase: ${forbidden}`);
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); }
    catch (error) { failures.push(`${file}: invalid JSON-LD (${error.message})`); }
  }
  const internalHrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1]);
  for (const href of internalHrefs) {
    const target = outputForHref(href);
    if (target && !files.includes(target)) failures.push(`${file}: broken internal href ${href}`);
  }
}

const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${site.siteUrl}/sitemap.xml`)) failures.push("robots.txt: sitemap mismatch");
if (!robots.includes("OAI-SearchBot")) failures.push("robots.txt: OAI-SearchBot missing");

const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
if (!sitemap.includes(`${site.siteUrl}/cn/evidence.html`)) failures.push("sitemap.xml: evidence hub missing");

const llms = await readFile(path.join(dist, "llms.txt"), "utf8");
if (!llms.includes("## 技术对比与选择指南")) failures.push("llms.txt: technology comparison section missing");
if (llms.includes("证据库")) failures.push("llms.txt: old evidence-library naming remains");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} HTML files, robots.txt and sitemap.xml`);
