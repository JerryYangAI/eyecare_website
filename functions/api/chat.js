/**
 * 官网客服 Agent 代理（Cloudflare Pages Function）
 * POST /api/chat  { message, visitorId }
 *
 * AgentKit /invoke 返回的是 SSE 流（data: {...} 逐 token 事件，ADK 事件格式），
 * 本函数在服务端聚合整条流，只把最终答案文本返回给前端：
 *  - 过滤 thought:true 的思考过程片段
 *  - 优先取 partial:false 终态事件里的完整答案；兜底拼接增量片段
 */

const FALLBACK = "不好意思，系统这会儿有点忙 🙏 您可以稍后再试，或通过页面底部的联系方式找到人工客服～";

function extractAnswer(raw) {
  let finalText = "";
  const partials = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (!m) continue;
    let ev;
    try { ev = JSON.parse(m[1]); } catch { continue; }
    const parts = (ev && ev.content && ev.content.parts) || [];
    const texts = parts
      .filter((p) => typeof p.text === "string" && p.thought !== true)
      .map((p) => p.text);
    if (ev.partial === false) {
      finalText = texts.join("");
    } else {
      partials.push(...texts);
    }
  }
  return (finalText || partials.join("")).trim();
}

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
    const raw = (await resp.text()) || "";
    // SSE 流 → 聚合最终答案；非流式纯文本 → 原样返回
    const reply = raw.includes("data:") ? extractAnswer(raw) : raw.trim();
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
