"use strict";

const {pathToFileURL} = require("node:url");
const {resolve} = require("node:path");

const DOMAIN = "api.koushicare.cn";
const REGION = "cn-hangzhou";

async function main() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) throw new Error("Alibaba Cloud credentials are required");

  const FC = require("@alicloud/fc20230330");
  const OpenApi = require("@alicloud/openapi-client");
  const {mergeMcpRoutes, routeConstants} = await import(pathToFileURL(resolve(__dirname, "fc-route-lib.mjs")));

  const config = new OpenApi.Config({accessKeyId, accessKeySecret, regionId: REGION});
  config.endpoint = `fcv3.${REGION}.aliyuncs.com`;
  const client = new FC.default(config);

  const before = await client.getCustomDomain(DOMAIN);
  const existingRoutes = before.body?.routeConfig?.routes || [];
  const routes = mergeMcpRoutes(existingRoutes);

  const request = new FC.UpdateCustomDomainRequest({
    body: new FC.UpdateCustomDomainInput({
      routeConfig: new FC.RouteConfig({
        routes: routes.map((route) => new FC.PathConfig(route))
      })
    })
  });
  await client.updateCustomDomain(DOMAIN, request);

  const after = await client.getCustomDomain(DOMAIN);
  const installed = after.body?.routeConfig?.routes || [];
  for (const path of routeConstants.MANAGED_PATHS) {
    const route = installed.find((candidate) => candidate.path === path);
    if (!route || route.functionName !== routeConstants.MANAGED_FUNCTION) {
      throw new Error(`Verification failed for Function Compute route ${path}`);
    }
  }
  console.log(`Verified ${DOMAIN} MCP routes; preserved ${existingRoutes.length} existing route(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
