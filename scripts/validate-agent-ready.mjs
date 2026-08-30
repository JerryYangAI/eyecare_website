import {createHash} from "node:crypto";
import {access, readFile, readdir} from "node:fs/promises";
import {extname, join, relative} from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const checks = [];
const ok = (condition, message) => condition ? checks.push(message) : failures.push(message);
const exists = async (path) => access(join(root, path)).then(() => true, () => false);
const json = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

const required = [
  "robots.txt", "sitemap.xml", "index.html", "index.md", "webmcp.js",
  ".well-known/api-catalog", ".well-known/mcp/server-card.json",
  ".well-known/agent-skills/index.json", ".well-known/ai-catalog.json",
  "api/openapi.json", "api/status.json", "agent-api/index.js",
  "edge/agent-ready.es", ".github/workflows/deploy-oss.yml"
];
for (const path of required) ok(await exists(path), `required artifact: ${path}`);

for (const path of [".well-known/api-catalog", ".well-known/mcp/server-card.json", ".well-known/agent-skills/index.json", ".well-known/ai-catalog.json", "api/openapi.json"]) {
  try { await json(path); checks.push(`valid JSON: ${path}`); }
  catch (error) { failures.push(`invalid JSON ${path}: ${error.message}`); }
}

const robots = await readFile(join(root, "robots.txt"), "utf8");
ok(/Sitemap:\s*https:\/\/www\.koushicare\.cn\/sitemap\.xml/i.test(robots), "robots publishes sitemap");
ok(/Agentmap:\s*https:\/\/www\.koushicare\.cn\/\.well-known\/ai-catalog\.json/i.test(robots), "robots publishes ARD agent map");
for (const bot of ["GPTBot", "ChatGPT-User", "Google-Extended", "ClaudeBot", "PerplexityBot"]) ok(robots.includes(bot), `robots allows ${bot}`);

const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>https:\/\/www\.koushicare\.cn\/(.*?)<\/loc>/g)].map((match) => decodeURIComponent(match[1]));
for (const loc of locs) {
  const local = !loc || loc.endsWith("/") ? join(loc, "index.html") : loc;
  ok(await exists(local), `sitemap target exists: /${loc}`);
}

const skills = await json(".well-known/agent-skills/index.json");
ok(skills.$schema === "https://schemas.agentskills.io/discovery/0.2.0/schema.json", "Agent Skills schema is pinned");
for (const skill of skills.skills || []) {
  const path = new URL(skill.url).pathname.slice(1);
  const body = await readFile(join(root, path));
  const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  ok(skill.digest === digest, `Agent Skill digest matches: ${skill.name}`);
}

const forbidden = ["auth.md", ".well-known/openid-configuration", ".well-known/oauth-authorization-server", ".well-known/oauth-protected-resource"];
for (const path of forbidden) ok(!(await exists(path)), `no fictitious authentication artifact: ${path}`);

const edge = await readFile(join(root, "edge/agent-ready.es"), "utf8");
ok(edge.includes("add_rsp_header('Link'"), "EdgeScript publishes Link discovery header");
ok(edge.includes("rewrite('/index.md', 'break')"), "EdgeScript negotiates homepage Markdown");
ok(!/[\"`]/.test(edge), "EdgeScript uses supported single-quoted string syntax");

const webmcp = await readFile(join(root, "webmcp.js"), "utf8");
ok(webmcp.includes("navigator.modelContext"), "WebMCP uses navigator.modelContext");
ok(webmcp.includes("registerTool"), "WebMCP registers tools imperatively");
ok(!/\b(?:POST|PUT|PATCH|DELETE)\b/.test(webmcp), "WebMCP exposes no write requests");

const workflow = await readFile(join(root, ".github/workflows/deploy-oss.yml"), "utf8");
for (const marker of ["npm run qa", "Deploy read-only MCP", "Configure Link, Markdown and DNS-AID discovery", "Production smoke test"]) {
  ok(workflow.includes(marker), `deployment gate exists: ${marker}`);
}

const htmlFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if ([".git", ".gstack"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extname(entry.name) === ".html") htmlFiles.push(path);
  }
}
await walk(root);
const knownRemoteOnly = new Set(["videos/redlight.mp4", "videos/heat.mp4", "videos/factory.mp4", "videos/reviews-1.mp4", "videos/reviews-2.mp4", "videos/reviews-3.mp4", "videos/reviews-4.mp4"]);
for (const file of htmlFiles) {
  const body = await readFile(file, "utf8");
  for (const match of body.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
    const raw = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/.test(raw)) continue;
    const fromRoot = raw.startsWith("/");
    const candidate = fromRoot ? raw.slice(1) : join(relative(root, join(file, "..")), raw);
    const normalized = candidate.endsWith("/") ? join(candidate, "index.html") : candidate;
    if (knownRemoteOnly.has(normalized)) continue;
    ok(await exists(normalized), `local reference exists: ${relative(root, file)} -> ${raw}`);
  }
}

if (failures.length) {
  console.error(`Agent-Ready validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Agent-Ready validation passed: ${checks.length} checks.`);
