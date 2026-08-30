const PUBLIC_ORIGIN = "https://www.koushicare.cn";
const PROTOCOL_VERSION = "2025-03-26";

const endpoints = {
  product: `${PUBLIC_ORIGIN}/api/v1/product.json`,
  faq: `${PUBLIC_ORIGIN}/api/v1/faq.json`,
  comparisons: `${PUBLIC_ORIGIN}/api/v1/comparisons.json`,
  content: `${PUBLIC_ORIGIN}/api/v1/content-index.json`
};

const tools = [
  {name: "get_product_facts", description: "获取品川光医公开的产品事实与使用边界。", inputSchema: {type: "object", properties: {}, additionalProperties: false}},
  {name: "get_faq", description: "获取品川光医官网常见问题。", inputSchema: {type: "object", properties: {}, additionalProperties: false}},
  {name: "compare_care_methods", description: "获取蒸汽、湿热、干热与红光恒温热敷的公开对比。", inputSchema: {type: "object", properties: {}, additionalProperties: false}},
  {name: "search_site", description: "检索品川光医官网公开内容索引。", inputSchema: {type: "object", properties: {query: {type: "string", minLength: 1, maxLength: 120}}, required: ["query"], additionalProperties: false}}
];

const resources = Object.entries(endpoints).map(([name, uri]) => ({
  uri,
  name: `koushicare-${name}`,
  description: `品川光医公开信息：${name}`,
  mimeType: "application/json"
}));

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD"
};

const reply = (body, status = 200) => new Response(body === "" ? null : JSON.stringify(body), {
  status,
  headers: responseHeaders
});

const rpcResult = (id, result) => ({jsonrpc: "2.0", id, result});
const rpcError = (id, code, message) => ({jsonrpc: "2.0", id: id ?? null, error: {code, message}});

async function fetchPublicJson(url) {
  const response = await fetch(url, {headers: {Accept: "application/json"}});
  if (!response.ok) throw new Error(`public data returned ${response.status}`);
  return response.json();
}

async function callTool(name, args = {}) {
  let data;
  if (name === "get_product_facts") data = await fetchPublicJson(endpoints.product);
  else if (name === "get_faq") data = await fetchPublicJson(endpoints.faq);
  else if (name === "compare_care_methods") data = await fetchPublicJson(endpoints.comparisons);
  else if (name === "search_site") {
    const query = String(args.query || "").trim();
    if (!query) throw new Error("query is required");
    const index = await fetchPublicJson(endpoints.content);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    data = {
      query,
      matches: index.records.filter((record) => {
        const haystack = [record.title, record.summary, ...(record.keywords || [])].join(" ").toLowerCase();
        return terms.some((term) => haystack.includes(term));
      }).slice(0, 5)
    };
  } else throw new Error(`unknown tool: ${name}`);
  return {content: [{type: "text", text: JSON.stringify(data, null, 2)}]};
}

async function handleRpc(message) {
  const {id, method, params = {}} = message || {};
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {tools: {listChanged: false}, resources: {subscribe: false, listChanged: false}},
      serverInfo: {name: "koushicare-public-information", version: "1.0.0"},
      instructions: "只读查询品川光医官网已公开的产品、FAQ、护理方式对比与站内内容。"
    });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, {tools});
  if (method === "tools/call") return rpcResult(id, await callTool(params.name, params.arguments));
  if (method === "resources/list") return rpcResult(id, {resources});
  if (method === "resources/read") {
    if (!Object.values(endpoints).includes(params.uri)) return rpcError(id, -32002, "Resource not found");
    const data = await fetchPublicJson(params.uri);
    return rpcResult(id, {contents: [{uri: params.uri, mimeType: "application/json", text: JSON.stringify(data, null, 2)}]});
  }
  if (method?.startsWith("notifications/")) return null;
  return rpcError(id, -32601, "Method not found");
}

export async function onRequest({request}) {
  if (request.method === "OPTIONS") return reply("", 204);
  if (request.method === "HEAD") return reply("");
  if (request.method === "GET") {
    return reply({
      ok: true,
      service: "koushicare-public-information-mcp",
      protocol: "MCP Streamable HTTP",
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {tools: true, resources: true}
    });
  }
  if (request.method !== "POST") return reply({error: "method_not_allowed"}, 405);

  let payload;
  try { payload = await request.json(); }
  catch { return reply(rpcError(null, -32700, "Parse error"), 400); }

  try {
    if (Array.isArray(payload)) {
      const results = (await Promise.all(payload.map(handleRpc))).filter(Boolean);
      return results.length ? reply(results) : reply("", 202);
    }
    const result = await handleRpc(payload);
    return result ? reply(result) : reply("", 202);
  } catch (error) {
    return reply(rpcError(payload?.id, -32000, error.message || "Tool execution failed"));
  }
}

export const _test = {handleRpc, callTool, tools, resources};
