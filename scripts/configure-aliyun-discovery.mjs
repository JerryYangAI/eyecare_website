import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {
  CDN_DOMAIN, DNS_DOMAIN, DNS_RR, DNS_TYPE, DNS_VALUE, EDGE_NAME,
  edgeFunctionPayload, recordsFromResponse, configsFromResponse, assertNoDnsConflict
} from "./aliyun-discovery-lib.mjs";

const dryRun = process.argv.includes("--dry-run");

const invoke = (product, action, parameters = {}) => {
  const args = [product, action];
  for (const [key, value] of Object.entries(parameters)) args.push(`--${key}`, String(value));
  if (dryRun) {
    console.log(["aliyun", ...args].join(" "));
    return {};
  }
  return JSON.parse(execFileSync("aliyun", args, {encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]}));
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function configureEdge() {
  const current = invoke("cdn", "DescribeCdnDomainConfigs", {
    DomainName: CDN_DOMAIN,
    FunctionNames: "edge_function"
  });
  if (configsFromResponse(current).some((config) => JSON.stringify(config).includes(EDGE_NAME))) {
    console.log("CDN Agent-Ready EdgeScript is already present.");
    return;
  }

  const rule = await readFile(new URL("../edge/agent-ready.es", import.meta.url), "utf8");
  invoke("cdn", "SetCdnDomainStagingConfig", {
    DomainName: CDN_DOMAIN,
    Functions: edgeFunctionPayload(rule)
  });
  if (dryRun) {
    invoke("cdn", "PublishStagingConfigToProduction", {DomainName: CDN_DOMAIN});
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      invoke("cdn", "PublishStagingConfigToProduction", {DomainName: CDN_DOMAIN});
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 12) await sleep(5000);
    }
  }
  if (lastError) throw lastError;

  const verified = invoke("cdn", "DescribeCdnDomainConfigs", {
    DomainName: CDN_DOMAIN,
    FunctionNames: "edge_function"
  });
  if (!configsFromResponse(verified).some((config) => JSON.stringify(config).includes(EDGE_NAME))) {
    throw new Error("CDN EdgeScript verification failed");
  }
}

function configureDns() {
  const response = invoke("alidns", "DescribeDomainRecords", {
    DomainName: DNS_DOMAIN,
    RRKeyWord: DNS_RR,
    TypeKeyWord: DNS_TYPE,
    PageSize: 100
  });
  if (assertNoDnsConflict(recordsFromResponse(response)) === "present") {
    console.log("DNS-AID SVCB record is already present.");
    return;
  }
  invoke("alidns", "AddDomainRecord", {
    DomainName: DNS_DOMAIN,
    RR: DNS_RR,
    Type: DNS_TYPE,
    Value: DNS_VALUE,
    TTL: 600,
    Remark: "Koushicare Agent-Ready MCP discovery"
  });
}

await configureEdge();
configureDns();
console.log(dryRun ? "Aliyun discovery dry run complete." : "Aliyun discovery configuration verified.");
