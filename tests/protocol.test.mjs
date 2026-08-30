import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {renderPreview} from "../scripts/preview-server.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("API catalog is an RFC 9727 linkset with docs, schema and status", async () => {
  const catalog = await readJson(".well-known/api-catalog");
  assert.ok(Array.isArray(catalog.linkset) && catalog.linkset.length >= 1);
  const api = catalog.linkset[0];
  assert.match(api.anchor, /^https:\/\//);
  assert.match(api["service-desc"][0].href, /openapi\.json$/);
  assert.match(api["service-doc"][0].href, /llms-full\.txt$/);
  assert.match(api.status[0].href, /status\.json$/);
  assert.equal(catalog.linkset[1].anchor, "https://eyecare-website.pages.dev/mcp");
});

test("OpenAPI publishes only GET operations and maps to committed files", async () => {
  const spec = await readJson("api/openapi.json");
  assert.equal(spec.openapi, "3.1.0");
  for (const [path, operations] of Object.entries(spec.paths)) {
    assert.deepEqual(Object.keys(operations), ["get"]);
    const file = new URL(`../api${path}`, import.meta.url);
    await readFile(file);
  }
});

test("Agent Skills digests match every published artifact", async () => {
  const index = await readJson(".well-known/agent-skills/index.json");
  assert.equal(index.$schema, "https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  assert.equal(index.skills.length, 3);
  for (const skill of index.skills) {
    const relative = new URL(skill.url).pathname.replace(/^\//, "");
    const body = await readFile(new URL(`../${relative}`, import.meta.url));
    assert.equal(skill.digest, `sha256:${createHash("sha256").update(body).digest("hex")}`);
    assert.match(skill.name, /^[a-z0-9-]+$/);
  }
});

test("ARD entries use stable identifiers, exact url/data choice and representative queries", async () => {
  const catalog = await readJson(".well-known/ai-catalog.json");
  assert.ok(catalog.specVersion);
  assert.match(catalog.host.identifier, /^did:web:/);
  assert.ok(catalog.entries.length >= 1);
  for (const entry of catalog.entries) {
    assert.match(entry.identifier, /^urn:air:www\.koushicare\.cn:/);
    assert.equal(Number(Boolean(entry.url)) + Number(Boolean(entry.data)), 1);
    assert.ok(entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 5);
  }
});

test("MCP Server Card describes the tested read-only server", async () => {
  const card = await readJson(".well-known/mcp/server-card.json");
  assert.equal(card.transport.type, "streamable-http");
  assert.equal(card.transport.endpoint, card.url);
  assert.equal(card.url, "https://eyecare-website.pages.dev/mcp");
  assert.equal(card.capabilities.tools, true);
  assert.equal(card.capabilities.resources, true);
  assert.equal(card.capabilities.prompts, false);
});

test("local edge preview negotiates Markdown and publishes discovery headers", async () => {
  const html = await renderPreview({url: "/"});
  assert.match(html.headers["Content-Type"], /^text\/html/);
  assert.match(html.headers.Link, /rel=api-catalog/);

  const markdown = await renderPreview({url: "/", headers: {accept: "text/markdown"}});
  assert.match(markdown.headers["Content-Type"], /^text\/markdown/);
  assert.equal(markdown.headers.Vary, "Accept");
  assert.ok(Number(markdown.headers["x-markdown-tokens"]) > 0);
  assert.match(markdown.body.toString("utf8"), /^# 品川光医/m);

  const apiCatalog = await renderPreview({url: "/.well-known/api-catalog"});
  assert.match(apiCatalog.headers["Content-Type"], /^application\/linkset\+json/);

  const ard = await renderPreview({url: "/.well-known/ai-catalog.json"});
  assert.equal(ard.headers["Access-Control-Allow-Origin"], "*");
});
