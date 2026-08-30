import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {mergeMcpRoutes} from "../scripts/fc-route-lib.mjs";
import {DNS_VALUE, edgeFunctionPayload, assertNoDnsConflict} from "../scripts/aliyun-discovery-lib.mjs";

const require = createRequire(import.meta.url);
const FC = require("@alicloud/fc20230330");
const {
  FUNCTION_NAME, TRIGGER_NAME, METHODS,
  buildFunctionInputs, buildTriggerInputs, assertFunction, assertTrigger
} = require("../scripts/fc-deploy-lib.cjs");

test("Function Compute route merge preserves chat catch-all and inserts MCP first", () => {
  const rewriteConfig = {equalRules: [{match: "/legacy", replacement: "/index.html"}]};
  const routes = mergeMcpRoutes([{path: "/*", functionName: "existing-chat-proxy", qualifier: "LATEST", methods: ["GET", "POST"], rewriteConfig}]);
  assert.deepEqual(routes.map((route) => route.path), ["/mcp", "/mcp/*", "/*"]);
  assert.equal(routes[2].functionName, "existing-chat-proxy");
  assert.equal(routes[2].rewriteConfig, rewriteConfig);
});

test("Function Compute route merge fails closed on an occupied MCP route", () => {
  assert.throws(() => mergeMcpRoutes([{path: "/mcp", functionName: "unknown-function"}]), /Refusing to replace/);
});

test("DNS deployment is idempotent and fails closed on conflict", () => {
  assert.equal(assertNoDnsConflict([{RR: "_index._agents", Type: "SVCB", Value: DNS_VALUE, Status: "Enable"}]), "present");
  assert.equal(assertNoDnsConflict([]), "missing");
  assert.throws(() => assertNoDnsConflict([{RR: "_index._agents", Type: "SVCB", Value: "1 other.example. alpn=\"h2\"", Status: "Enable"}]), /Refusing to replace/);
});

test("CDN payload contains the reviewed EdgeScript and stable managed name", async () => {
  const rule = await readFile(new URL("../edge/agent-ready.es", import.meta.url), "utf8");
  const payload = JSON.parse(edgeFunctionPayload(rule));
  assert.equal(payload[0].functionName, "edge_function");
  const args = Object.fromEntries(payload[0].functionArgs.map(({argName, argValue}) => [argName, argValue]));
  assert.equal(args.name, "koushicare_agent_ready");
  assert.equal(args.rule, rule);
  assert.equal(args.enable, "on");
});

test("Function Compute SDK deployment payloads validate against the pinned official models", () => {
  const functionInputs = buildFunctionInputs(FC, "UEsDBAoAAAAA");
  assert.equal(functionInputs.create.functionName, FUNCTION_NAME);
  assert.equal(functionInputs.create.runtime, "nodejs20");
  assert.equal(functionInputs.update.disableInjectCredentials, "All");

  const triggerInputs = buildTriggerInputs(FC);
  assert.equal(triggerInputs.create.triggerName, TRIGGER_NAME);
  assert.equal(triggerInputs.create.triggerType, "http");
  assert.deepEqual(JSON.parse(triggerInputs.create.triggerConfig).methods, METHODS);
});

test("Function Compute post-deploy verification rejects unsafe cloud state", () => {
  assert.doesNotThrow(() => assertFunction({
    functionName: FUNCTION_NAME,
    runtime: "nodejs20",
    handler: "index.handler",
    lastUpdateStatus: "Successful"
  }));
  assert.throws(() => assertFunction({functionName: FUNCTION_NAME, runtime: "nodejs18", handler: "index.handler"}), /runtime/);

  assert.doesNotThrow(() => assertTrigger({
    triggerName: TRIGGER_NAME,
    triggerType: "http",
    triggerConfig: JSON.stringify({authType: "anonymous", methods: METHODS})
  }));
  assert.throws(() => assertTrigger({
    triggerName: TRIGGER_NAME,
    triggerType: "http",
    triggerConfig: JSON.stringify({authType: "function", methods: METHODS})
  }), /not anonymous/);
});
