"use strict";

const FUNCTION_NAME = "koushicare-public-information-mcp";
const TRIGGER_NAME = "public-information-http";
const REGION = "cn-hangzhou";
const METHODS = ["GET", "POST", "OPTIONS", "HEAD"];

const triggerConfig = () => JSON.stringify({
  authType: "anonymous",
  disableURLInternet: false,
  methods: METHODS
});

function buildFunctionInputs(FC, zipFile) {
  if (!zipFile) throw new Error("Function code ZIP is required");
  const shared = {
    code: new FC.InputCodeLocation({zipFile}),
    description: "品川光医只读公开信息 MCP 服务",
    runtime: "nodejs20",
    handler: "index.handler",
    cpu: 0.05,
    memorySize: 128,
    diskSize: 512,
    timeout: 15,
    instanceConcurrency: 20,
    internetAccess: true,
    disableInjectCredentials: "All"
  };

  const create = new FC.CreateFunctionInput({functionName: FUNCTION_NAME, ...shared});
  const update = new FC.UpdateFunctionInput(shared);
  create.validate();
  update.validate();
  return {create, update};
}

function buildTriggerInputs(FC) {
  const shared = {
    description: "Anonymous MCP Streamable HTTP endpoint",
    qualifier: "LATEST",
    triggerConfig: triggerConfig()
  };
  const create = new FC.CreateTriggerInput({
    ...shared,
    triggerName: TRIGGER_NAME,
    triggerType: "http"
  });
  const update = new FC.UpdateTriggerInput(shared);
  create.validate();
  update.validate();
  return {create, update};
}

function assertFunction(functionRecord) {
  if (!functionRecord || functionRecord.functionName !== FUNCTION_NAME) {
    throw new Error("Function Compute verification returned the wrong function");
  }
  if (functionRecord.runtime !== "nodejs20" || functionRecord.handler !== "index.handler") {
    throw new Error("Function Compute verification found an unexpected runtime or handler");
  }
  if (functionRecord.lastUpdateStatus && functionRecord.lastUpdateStatus !== "Successful") {
    throw new Error(`Function Compute update status is ${functionRecord.lastUpdateStatus}`);
  }
}

function assertTrigger(triggerRecord) {
  if (!triggerRecord || triggerRecord.triggerName !== TRIGGER_NAME || triggerRecord.triggerType !== "http") {
    throw new Error("Function Compute HTTP trigger verification failed");
  }
  const config = triggerRecord.triggerConfig ? JSON.parse(triggerRecord.triggerConfig) : triggerRecord.httpTrigger;
  if (config?.authType !== "anonymous") throw new Error("Function Compute HTTP trigger is not anonymous");
  const installedMethods = config?.methods || [];
  if (!METHODS.every((method) => installedMethods.includes(method))) {
    throw new Error("Function Compute HTTP trigger is missing a required method");
  }
}

module.exports = {
  FUNCTION_NAME,
  TRIGGER_NAME,
  REGION,
  METHODS,
  triggerConfig,
  buildFunctionInputs,
  buildTriggerInputs,
  assertFunction,
  assertTrigger
};
