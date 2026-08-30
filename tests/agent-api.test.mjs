import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {handler, _test} = require("../agent-api/index.js");

const event = (method, body = "", path = "/mcp") => Buffer.from(JSON.stringify({
  version: "v1",
  rawPath: path,
  body: typeof body === "string" ? body : JSON.stringify(body),
  isBase64Encoded: false,
  headers: {Accept: "application/json"},
  requestContext: {http: {method, path}}
}));

test("MCP initialize returns protocol and capabilities", async () => {
  const response = await handler(event("POST", {jsonrpc: "2.0", id: 1, method: "initialize", params: {}}));
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.result.protocolVersion, "2025-03-26");
  assert.equal(body.result.capabilities.tools.listChanged, false);
  assert.equal(body.result.capabilities.resources.subscribe, false);
});

test("MCP tools/list exposes only read-only tools", async () => {
  const response = await handler(event("POST", {jsonrpc: "2.0", id: 2, method: "tools/list"}));
  const body = JSON.parse(response.body);
  assert.deepEqual(body.result.tools.map((tool) => tool.name), [
    "get_product_facts",
    "get_faq",
    "compare_care_methods",
    "search_site"
  ]);
  for (const tool of body.result.tools) assert.ok(!/(buy|order|write|update|delete)/i.test(tool.name));
});

test("MCP resources/list uses official HTTPS resources", async () => {
  const response = await handler(event("POST", {jsonrpc: "2.0", id: 3, method: "resources/list"}));
  const body = JSON.parse(response.body);
  assert.equal(body.result.resources.length, 4);
  for (const resource of body.result.resources) assert.match(resource.uri, /^https:\/\/www\.koushicare\.cn\/api\/v1\//);
});

test("health, HEAD and CORS preflight are deterministic", async () => {
  const health = await handler(event("GET"));
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).service, "koushicare-public-information-mcp");
  assert.equal(health.headers["Access-Control-Allow-Origin"], "*");
  assert.equal((await handler(event("HEAD"))).body, "");
  assert.equal((await handler(event("OPTIONS"))).statusCode, 204);
});

test("unknown JSON-RPC methods return a protocol error", async () => {
  const result = await _test.handleRpc({jsonrpc: "2.0", id: 7, method: "unknown"});
  assert.equal(result.error.code, -32601);
});
