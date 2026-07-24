/**
 * 官网客服 Agent 代理（Cloudflare Pages Function）
 * POST /api/chat  { message, visitorId }
 *
 * 双协议支持，按环境变量自动选择：
 *  A) 火山方舟零代码智能体：配置 ARK_BOT_ID + ARK_API_KEY 即启用
 *     调用 {ARK_BASE_URL}/bots/chat/completions（OpenAI 兼容格式）
 *     ARK_BASE_URL 默认 https://ark.cn-beijing.volces.com/api/v3
 *  B) AgentKit 运行时：AGENT_BASE_URL + AGENT_API_KEY（SSE 流聚合，过滤思考过程）
 *
 * 出口统一经 cleanReply()：剥离思考型模型写进正文开头的自我分析前言。
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

/**
 * 剥离回答开头的"自言自语"前言。
 * 思考型模型（doubao-seed 等）常把内部计划写进正文开头，如：
 * "用户询问红光疗法是否为智商税，我将按规则提供对应资料。"
 * "我已梳理好完整排查步骤，先确认充电宝输出规格……"
 * 只在文首、且句子命中明确的"元叙述"特征时剥离，最多剥 5 句，防误伤正文。
 */
function cleanReply(text) {
  if (!text) return text;
  const original = text;
  const metaSentence = new RegExp(
    "^\\s*(?:" +
      "用户(?:询问|咨询|反馈|提出|表示)" +          // 用户询问……
      "|我将(?:按|先|从|给|结合|梳理|明确|说明)" +   // 我将按规则……
      "|我已(?:经)?(?:梳理|整理|明确|核对|获得|了解)" + // 我已梳理好……
      "|(?:按|依)(?:照)?(?:既定)?规则" +            // 按规则……
      "|规则已明确" +
      "|(?:退换货|政策)规则已明确" +
      "|针对[^。！？\\n]{0,50}(?:问题|疑问)[^。！？\\n]{0,60}(?:答复|回复|回应|资料|内容)" +
      "|接下来(?:我)?(?:会|将)" +
      "|现在我(?:将|来)" +
      "|需说明[^。！？\\n]{0,40}后续" +
    ")[^。！？\\n]{0,120}[。！？]\\s*"
  );
  for (let i = 0; i < 5; i++) {
    const m = text.match(metaSentence);
    if (!m) break;
    text = text.slice(m[0].length);
  }
  text = text.trim();
  return text || original; // 全被剥空则回退原文，宁可有前言不可无回答
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
