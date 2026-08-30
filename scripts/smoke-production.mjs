const origin = process.env.SITE_ORIGIN || "https://www.koushicare.cn";
const deadline = Date.now() + Number(process.env.SMOKE_TIMEOUT_MS || 300000);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function eventually(label, check) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      await check();
      console.log(`PASS ${label}`);
      return;
    } catch (error) {
      lastError = error;
      await sleep(10000);
    }
  }
  throw new Error(`${label}: ${lastError?.message || "timed out"}`);
}

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

await eventually("homepage discovery Link header", async () => {
  const response = await fetch(`${origin}/`, {headers: {"Cache-Control": "no-cache"}});
  expect(response.ok, `homepage returned ${response.status}`);
  expect(response.headers.get("link")?.includes("rel=api-catalog"), "api-catalog Link relation is missing");
  expect(response.headers.get("content-type")?.startsWith("text/html"), "browser response is not HTML");
});

await eventually("Markdown content negotiation", async () => {
  const response = await fetch(`${origin}/`, {headers: {Accept: "text/markdown", "Cache-Control": "no-cache"}});
  expect(response.ok, `Markdown response returned ${response.status}`);
  expect(response.headers.get("content-type")?.startsWith("text/markdown"), "Markdown content type is missing");
  expect((await response.text()).startsWith("# 品川光医"), "Markdown body is not the canonical homepage Markdown");
});

await eventually("API catalog and ARD discovery", async () => {
  const catalog = await fetch(`${origin}/.well-known/api-catalog`, {headers: {"Cache-Control": "no-cache"}});
  expect(catalog.ok, `API catalog returned ${catalog.status}`);
  expect(catalog.headers.get("content-type")?.startsWith("application/linkset+json"), "API catalog MIME type is incorrect");
  const ard = await fetch(`${origin}/.well-known/ai-catalog.json`, {headers: {"Cache-Control": "no-cache"}});
  expect(ard.ok, `ARD returned ${ard.status}`);
  expect(ard.headers.get("access-control-allow-origin") === "*", "ARD CORS header is missing");
});

await eventually("Agent Skills and MCP Server Card", async () => {
  for (const path of ["/.well-known/agent-skills/index.json", "/.well-known/mcp/server-card.json"]) {
    const response = await fetch(`${origin}${path}`, {headers: {"Cache-Control": "no-cache"}});
    expect(response.ok, `${path} returned ${response.status}`);
    await response.json();
  }
});

await eventually("MCP Streamable HTTP initialize", async () => {
  const response = await fetch("https://eyecare-website.pages.dev/mcp", {
    method: "POST",
    headers: {"Content-Type": "application/json", Accept: "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "initialize", params: {}})
  });
  expect(response.ok, `MCP returned ${response.status}`);
  const body = await response.json();
  expect(body.result?.serverInfo?.name === "koushicare-public-information", "MCP initialize response is not from the managed service");
});

await eventually("DNS-AID SVCB discovery", async () => {
  const response = await fetch("https://cloudflare-dns.com/dns-query?name=_index._agents.koushicare.cn&type=SVCB&do=1", {
    headers: {Accept: "application/dns-json", "Cache-Control": "no-cache"}
  });
  expect(response.ok, `DNS-over-HTTPS returned ${response.status}`);
  const body = await response.json();
  expect((body.Answer || []).some((answer) => answer.type === 64), "public resolver has not received the SVCB record");
});

console.log("Production Agent-Ready smoke test passed.");
