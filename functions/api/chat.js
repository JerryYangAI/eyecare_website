/**
 * 官网客服 Agent 代理（Cloudflare Pages Function）
 * POST /api/chat  { message, visitorId }
 *
 * 双协议支持，按环境变量自动选择：
 *  A) 火山方舟零代码智能体（推荐）：配置 ARK_BOT_ID + ARK_API_KEY 即启用
 *     调用 {ARK_BASE_URL}/bots/chat/completions（OpenAI 兼容格式）
 *     ARK_BASE_URL 默认 https://ark.cn-beijing.volces.com/api/v3
 *     ⚠️ 以方舟控制台应用详情"API调用"页展示的实际 endpoint 为准，不同可通过 ARK_BASE_URL 覆盖
 *  B) AgentKit 运行时（兜底）：AGENT_BASE_URL + AGENT_API_KEY（SSE 流聚合，过滤思考过程）
 */

const FALLBACK = "不好意思，系统这会儿有点忙 🙏 您可以稍后再试，或通过页面底部的联系方式找到人工客服～";

// 简易会话记忆：方舟 bot API 无服务端会话，这里按 visitorId 维护最近几轮对话（实例内存，冷启动即清空，够用）
const historyStore = new Map();
const MAX_TURNS = 6;

function getHistory(vid) {
  return historyStore.get(vid) || [];
}
function pushHistory(vid, userMsg, botMsg) {
  const h = getHistory(vid);
  h.push({ role: "user", content: userMsg }, { role: "assistant", content: botMsg });
  historyStore.set(vid, h.slice(-MAX_TURNS * 2));
}

async function askArk(env, message, visitorId) {
  const base = (env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
  const resp = await fetch(base + "/bots/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.ARK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.ARK_BOT_ID,
      messages: [...getHistory(visitorId), { role: "user", content: message }],
    }),
  });
  if (!resp.ok) throw new Error("ark status " + resp.status + " " + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  const reply = (data?.choices?.[0]?.message?.content || "").trim();
  if (reply) pushHistory(visitorId, message, reply);
  return reply;
}

function extractAgentkitAnswer(raw) {
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
    if (ev.partial === false) finalText = texts.join("");
    else partials.push(...texts);
  }
  return (finalText || partials.join("")).trim();
}

async function askAgentkit(env, message, visitorId) {
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
  if (!resp.ok) throw new Error("agentkit status " + resp.status);
  const raw = (await resp.text()) || "";
  return raw.includes("data:") ? extractAgentkitAnswer(raw) : raw.trim();
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

  try {
    let reply = "";
    if (env.ARK_BOT_ID && env.ARK_API_KEY) {
      reply = await askArk(env, message, visitorId);
    } else if (env.AGENT_BASE_URL && env.AGENT_API_KEY) {
      reply = await askAgentkit(env, message, visitorId);
    } else {
      console.error("[api/chat] no agent backend configured");
    }
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
