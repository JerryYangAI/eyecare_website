import test from "node:test";
import assert from "node:assert/strict";
import {onRequest, _test} from "../functions/mcp.js";

const event = (method, body) => ({request: new Request("https://eyecare-website.pages.dev/mcp", {
  method,
  headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
  body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body))
})});

test("MCP initialize returns protocol and capabilities", async () => {
  const response = await onRequest(event("POST", {jsonrpc: "2.0", id: 1, method: "initialize", params: {}}));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.protocolVersion, "2025-03-26");
  assert.equal(body.result.capabilities.tools.listChanged, false);
  assert.equal(body.result.capabilities.resources.subscribe, false);
});

test("MCP tools/list exposes only read-only tools", async () => {
  const response = await onRequest(event("POST", {jsonrpc: "2.0", id: 2, method: "tools/list"}));
  const body = await response.json();
  assert.deepEqual(body.result.tools.map((tool) => tool.name), [
    "get_product_facts",
    "get_faq",
    "compare_care_methods",
    "search_site"
  ]);
  for (const tool of body.result.tools) assert.ok(!/(buy|order|write|update|delete)/i.test(tool.name));
});

test("MCP resources/list uses official HTTPS resources", async () => {
  const response = await onRequest(event("POST", {jsonrpc: "2.0", id: 3, method: "resources/list"}));
  const body = await response.json();
  assert.equal(body.result.resources.length, 4);
  for (const resource of body.result.resources) assert.match(resource.uri, /^https:\/\/www\.koushicare\.cn\/api\/v1\//);
});

test("health, HEAD and CORS preflight are deterministic", async () => {
  const health = await onRequest(event("GET"));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "koushicare-public-information-mcp");
  assert.equal(health.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(await (await onRequest(event("HEAD"))).text(), "");
  assert.equal((await onRequest(event("OPTIONS"))).status, 204);
});

test("unknown JSON-RPC methods return a protocol error", async () => {
  const result = await _test.handleRpc({jsonrpc: "2.0", id: 7, method: "unknown"});
  assert.equal(result.error.code, -32601);
});
