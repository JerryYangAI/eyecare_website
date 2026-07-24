/**
 * 官网客服 Agent 代理（Cloudflare Pages Function）
 * POST /api/chat  { message, visitorId }
 *
 * 双协议支持，按环境变量自动选择：
 *  A) 火山方舟零代码智能体：配置 ARK_BOT_ID + ARK_API_KEY 即启用
 *  B) AgentKit 运行时：AGENT_BASE_URL + AGENT_API_KEY（SSE 流聚合，过滤思考过程）
 *
 * 出口统一经 cleanReply()：
 *  1) 优先识别"【最终回复】"分隔符（提示词协议），只取标记之后的内容；
 *  2) 无标记时回退启发式：剥离文首的"用户询问…/我将…"式元叙述句。
 */

const FALLBACK = "不好意思，系统这会儿有点忙 🙏 您可以稍后再试，或通过页面底部的联系方式找到人工客服～";
const REPLY_MARK = "【最终回复】";

// 简易会话记忆：按 visitorId 维护最近几轮对话（实例内存，冷启动即清空，够用）
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

function cleanReply(text) {
  if (!text) return text;
  const original = text;

  // 1) 分隔符协议：取最后一个【最终回复】之后的内容
  const i = text.lastIndexOf(REPLY_MARK);
  if (i !== -1) {
    const after = text.slice(i + REPLY_MARK.length).trim();
    if (after) return after;
  }

  // 2) 启发式回退：剥离文首连续的元叙述句（最多5句，剥空则还原）
  const metaSentence = new RegExp(
    "^\\s*(?:" +
      "用户(?:询问|咨询|反馈|提出|表示|说)" +
      "|我将(?:按|先|从|给|结合|梳理|明确|说明)" +
      "|我已(?:经)?(?:梳理|整理|明确|核对|获得|了解)" +
      "|我需要(?:按照?规则|先|确认)" +
      "|(?:按|依)(?:照)?(?:既定)?规则" +
      "|规则(?:里|中)?(?:已明确|说|要求)" +
      "|让我(?:先|来|按|组织)" +
      "|好的，我来组织" +
      "|知识库中已经?有" +
      "|针对[^。！？\\n]{0,50}(?:问题|疑问)[^。！？\\n]{0,60}(?:答复|回复|回应|资料|内容)" +
      "|接下来(?:我)?(?:会|将)" +
      "|现在我(?:将|来)" +
    ")[^。！？\\n]{0,120}[。！？：]\\s*"
  );
  for (let k = 0; k < 5; k++) {
    const m = text.match(metaSentence);
    if (!m) break;
    text = text.slice(m[0].length);
  }
  text = text.trim();
  return text || original;
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
    return json({ visitorId, reply: cleanReply(reply) || FALLBACK });
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
