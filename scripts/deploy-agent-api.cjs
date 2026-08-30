"use strict";

const {execFileSync} = require("node:child_process");
const {mkdtempSync, readFileSync, rmSync} = require("node:fs");
const {join, resolve} = require("node:path");
const {tmpdir} = require("node:os");
const FC = require("@alicloud/fc20230330");
const OpenApi = require("@alicloud/openapi-client");
const {
  FUNCTION_NAME,
  TRIGGER_NAME,
  REGION,
  buildFunctionInputs,
  buildTriggerInputs,
  assertFunction,
  assertTrigger
} = require("./fc-deploy-lib.cjs");

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function packageFunction() {
  const source = resolve(__dirname, "../agent-api");
  const temporary = mkdtempSync(join(tmpdir(), "koushicare-fc-"));
  const archive = join(temporary, "agent-api.zip");
  try {
    execFileSync("zip", ["-q", "-X", archive, "index.js", "package.json"], {cwd: source, stdio: "inherit"});
    return readFileSync(archive).toString("base64");
  } finally {
    rmSync(temporary, {recursive: true, force: true});
  }
}

function createClient() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) throw new Error("Alibaba Cloud credentials are required");
  const config = new OpenApi.Config({accessKeyId, accessKeySecret, regionId: REGION});
  config.endpoint = `fcv3.${REGION}.aliyuncs.com`;
  return new FC.default(config);
}

async function waitForFunction(client) {
  let latest;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    latest = (await client.getFunction(FUNCTION_NAME, new FC.GetFunctionRequest({qualifier: "LATEST"}))).body;
    if (!latest.lastUpdateStatus || latest.lastUpdateStatus === "Successful") return latest;
    if (latest.lastUpdateStatus === "Failed") {
      throw new Error(`Function update failed: ${latest.lastUpdateStatusReason || "unknown reason"}`);
    }
    await sleep(2500);
  }
  throw new Error(`Function update timed out with status ${latest?.lastUpdateStatus || "unknown"}`);
}

async function deployFunction(client, zipFile) {
  const existing = await client.listFunctions(new FC.ListFunctionsRequest({
    functionName: FUNCTION_NAME,
    fcVersion: "v3",
    limit: 100
  }));
  const found = (existing.body?.functions || []).find((record) => record.functionName === FUNCTION_NAME);
  const inputs = buildFunctionInputs(FC, zipFile);
  if (found) {
    await client.updateFunction(FUNCTION_NAME, new FC.UpdateFunctionRequest({body: inputs.update}));
    console.log(`Updated Function Compute function ${FUNCTION_NAME}.`);
  } else {
    await client.createFunction(new FC.CreateFunctionRequest({body: inputs.create}));
    console.log(`Created Function Compute function ${FUNCTION_NAME}.`);
  }
  const verified = await waitForFunction(client);
  assertFunction(verified);
}

async function deployTrigger(client) {
  const existing = await client.listTriggers(FUNCTION_NAME, new FC.ListTriggersRequest({
    prefix: TRIGGER_NAME,
    limit: 100
  }));
  const found = (existing.body?.triggers || []).find((record) => record.triggerName === TRIGGER_NAME);
  const inputs = buildTriggerInputs(FC);
  if (found) {
    if (found.triggerType !== "http") throw new Error(`Refusing to replace non-HTTP trigger ${TRIGGER_NAME}`);
    await client.updateTrigger(FUNCTION_NAME, TRIGGER_NAME, new FC.UpdateTriggerRequest({body: inputs.update}));
    console.log(`Updated Function Compute trigger ${TRIGGER_NAME}.`);
  } else {
    await client.createTrigger(FUNCTION_NAME, new FC.CreateTriggerRequest({body: inputs.create}));
    console.log(`Created Function Compute trigger ${TRIGGER_NAME}.`);
  }
  const verified = (await client.getTrigger(FUNCTION_NAME, TRIGGER_NAME)).body;
  assertTrigger(verified);
}

function safeError(error) {
  const message = [error?.code, error?.statusCode, error?.message, error?.data?.Message]
    .filter(Boolean).join(" | ") || "unknown deployment error";
  return message
    .replace(/LTAI[A-Za-z0-9]+/g, "[redacted-access-key]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 800);
}

async function main() {
  const zipFile = packageFunction();
  if (process.argv.includes("--dry-run")) {
    buildFunctionInputs(FC, zipFile);
    buildTriggerInputs(FC);
    console.log(`Function Compute deployment package and SDK models verified (${Buffer.from(zipFile, "base64").length} bytes).`);
    return;
  }
  const client = createClient();
  await deployFunction(client, zipFile);
  await deployTrigger(client);
  console.log("Verified the read-only MCP function and anonymous HTTP trigger.");
}

main().catch((error) => {
  const message = safeError(error);
  console.error(`::error title=Function Compute deployment failed::${message}`);
  process.exitCode = 1;
});
