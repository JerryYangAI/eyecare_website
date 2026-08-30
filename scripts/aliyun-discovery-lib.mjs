export const CDN_DOMAIN = "www.koushicare.cn";
export const DNS_DOMAIN = "koushicare.cn";
export const DNS_RR = "_index._agents";
export const DNS_TYPE = "SVCB";
export const DNS_VALUE = "1 api.koushicare.cn. alpn=\"h2\" port=443 key65480=\"/mcp\"";
export const EDGE_NAME = "koushicare_agent_ready";

export function edgeFunctionPayload(rule) {
  return JSON.stringify([{
    functionName: "edge_function",
    functionArgs: [
      {argName: "enable", argValue: "on"},
      {argName: "pri", argValue: "20"},
      {argName: "name", argValue: EDGE_NAME},
      {argName: "pos", argValue: "head"},
      {argName: "brk", argValue: "off"},
      {argName: "rule", argValue: rule}
    ]
  }]);
}

export function recordsFromResponse(response) {
  const records = response?.DomainRecords?.Record ?? response?.domainRecords?.record ?? [];
  return Array.isArray(records) ? records : [records].filter(Boolean);
}

export function configsFromResponse(response) {
  const configs = response?.DomainConfigs?.DomainConfig ?? response?.domainConfigs?.domainConfig ?? [];
  return Array.isArray(configs) ? configs : [configs].filter(Boolean);
}

export function assertNoDnsConflict(records) {
  const matching = records.filter((record) => record.RR === DNS_RR && record.Type === DNS_TYPE);
  if (matching.some((record) => record.Value === DNS_VALUE && record.Status !== "Disable")) return "present";
  if (matching.length) throw new Error(`Refusing to replace a pre-existing ${DNS_RR} ${DNS_TYPE} record`);
  return "missing";
}
