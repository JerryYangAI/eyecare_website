import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

test("WebMCP registers four read-only public information tools", async () => {
  const source = await readFile(new URL("../webmcp.js", import.meta.url), "utf8");
  const registered = [];
  const context = {
    document: {modelContext: {registerTool(tool, options) { registered.push({tool, options}); }}},
    navigator: {},
    window: {addEventListener() {}},
    AbortController,
    fetch: async () => ({ok: true, json: async () => ({records: []})})
  };
  vm.runInNewContext(source, context);
  assert.equal(registered.length, 4);
  assert.deepEqual(registered.map(({tool}) => tool.name), [
    "get_koushicare_product_facts",
    "compare_eye_care_methods",
    "search_koushicare_site",
    "get_koushicare_faq"
  ]);
  for (const {tool, options} of registered) {
    assert.equal(typeof tool.execute, "function");
    assert.ok(options.signal instanceof AbortSignal);
    assert.doesNotMatch(tool.name, /buy|order|write|update|delete/i);
  }
});

test("WebMCP supports legacy provideContext readiness scanners", async () => {
  const source = await readFile(new URL("../webmcp.js", import.meta.url), "utf8");
  let provided;
  const context = {
    document: {},
    navigator: {modelContext: {provideContext(value) { provided = value; }}},
    window: {addEventListener() {}},
    AbortController,
    fetch: async () => ({ok: true, json: async () => ({records: []})})
  };
  vm.runInNewContext(source, context);
  assert.equal(provided.tools.length, 4);
  assert.deepEqual(Array.from(provided.tools, (tool) => tool.name), [
    "get_koushicare_product_facts",
    "compare_eye_care_methods",
    "search_koushicare_site",
    "get_koushicare_faq"
  ]);
});
