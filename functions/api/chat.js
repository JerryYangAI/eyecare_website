/**
 * 官网客服 Agent 代理（Cloudflare Pages Function）
 * POST /api/chat  { message, visitorId }
 * 服务端调用火山引擎 AgentKit：POST {AGENT_BASE_URL}/invoke，
 * Bearer API Key，user_id/session_id 头维持多轮记忆，body 为 {"prompt": "..."}。
 * API Key 仅存在 Pages 环境变量（AGENT_BASE_URL / AGENT_API_KEY），永不下发前端。
 */

const FALLBACK = "不好意思，系统这会儿有点忙 🙏 您可以稍后再试，或通过页面底部的联系方式找到人工客服～";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const message = String(body.message || "").trim().slice(0, 2000);
  const visitorId = String(body.visitorId || crypto.randomUUID()).slice(0, 48);

  if (!message) return json({ visitorId, reply: "" });
  if (!env.AGENT_BASE_URL || !env.AGENT_API_KEY) {
    console.error("[api/chat] AGENT_BASE_URL / AGENT_API_KEY not configured");
    return json({ visitorId, reply: FALLBACK });
  }

  try {
    const resp = await fetch(env.AGENT_BASE_URL.replace(/\/$/, "") + "/invoke", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.AGENT_API_KEY,
        "Content-Type": "application/json",
        user_id: "web-" + visitorId,
        session_id: "web-" + visitorId,
      },
      body: JSON.stringify({ prompt: message }),
    });
    if (!resp.ok) throw new Error("agent status " + resp.status);
    const reply = (await resp.text()).trim();
    return json({ visitorId, reply: reply || FALLBACK });
  } catch (err) {
    console.error("[api/chat] agent error:", err);
    return json({ visitorId, reply: FALLBACK });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
