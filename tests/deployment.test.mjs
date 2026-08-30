import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DNS_VALUE, edgeFunctionPayload, assertNoDnsConflict} from "../scripts/aliyun-discovery-lib.mjs";

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
