/* 品川护理顾问 · 悬浮聊天挂件（自包含，无依赖） */
(function () {
  if (window.__pcChatLoaded) return;
  window.__pcChatLoaded = true;

  var css = [
    "#pc-chat-btn{position:fixed;right:24px;bottom:24px;background:#d97757;color:#fff;padding:12px 18px;border-radius:999px;cursor:pointer;font:600 14px/1.4 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9998;border:none;}",
    "#pc-chat-box{position:fixed;right:24px;bottom:24px;width:360px;max-width:92vw;height:520px;max-height:80vh;background:#faf9f5;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;z-index:9999;font:14px/1.6 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;}",
    "#pc-chat-head{background:#141413;color:#faf9f5;padding:12px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center;}",
    "#pc-chat-close{cursor:pointer;padding:0 6px;font-size:18px;}",
    "#pc-chat-msgs{flex:1;overflow-y:auto;padding:14px;}",
    ".pc-m{margin:8px 0;max-width:85%;padding:9px 13px;border-radius:12px;white-space:pre-wrap;word-break:break-word;}",
    ".pc-user{background:#d97757;color:#fff;margin-left:auto;}",
    ".pc-bot{background:#fff;border:1px solid #e8e6dc;}",
    "#pc-chat-note{padding:4px 12px 0;font-size:11px;color:#a09e94;text-align:center;}",
    "#pc-chat-inputbar{display:flex;gap:8px;padding:10px;border-top:1px solid #e8e6dc;background:#fff;}",
    "#pc-chat-input{flex:1;border:1px solid #e8e6dc;border-radius:8px;padding:9px 12px;outline:none;font-size:14px;}",
    "#pc-chat-send{background:#d97757;color:#fff;border:none;border-radius:8px;padding:0 16px;cursor:pointer;}",
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.innerHTML =
    '<button id="pc-chat-btn">💬 咨询护理顾问</button>' +
    '<div id="pc-chat-box">' +
    '<div id="pc-chat-head"><span>品川护理顾问</span><span id="pc-chat-close">×</span></div>' +
    '<div id="pc-chat-msgs"></div>' +
    '<div id="pc-chat-note">AI 助手回答仅供参考，不能替代医生诊断</div>' +
    '<div id="pc-chat-inputbar"><input id="pc-chat-input" placeholder="干眼、使用方法、售后…都可以问" />' +
    '<button id="pc-chat-send">发送</button></div></div>';
  document.body.appendChild(root);

  var btn = document.getElementById("pc-chat-btn"),
    box = document.getElementById("pc-chat-box"),
    msgs = document.getElementById("pc-chat-msgs"),
    inp = document.getElementById("pc-chat-input");

  var vid = localStorage.getItem("pc_vid");
  if (!vid) {
    vid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("pc_vid", vid);
  }

  /* 轻量 Markdown 渲染：先转义 HTML 防注入，再转换常用记号 */
  function pcMd(s) {
    s = String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");            // --- 分隔线去掉
    s = s.replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>");      // # 标题 → 加粗
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");    // **加粗**
    s = s.replace(/`([^`]+)`/g, "$1");                     // `代码` 去反引号
    s = s.replace(/^&gt;\s?/gm, "");                      // > 引用符号去掉
    s = s.replace(/^\s*[-*]\s+/gm, "• ");          // - 列表 → •
    s = s.replace(/\n{3,}/g, "\n\n");                   // 压缩多余空行
    return s;
  }

  function add(cls, text) {
    var d = document.createElement("div");
    d.className = "pc-m " + cls;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  btn.onclick = function () {
    box.style.display = "flex";
    btn.style.display = "none";
    if (!msgs.children.length)
      add("pc-bot", "你好呀，我是品川护理顾问 🙋 干眼护理、产品使用、售后问题都可以直接问我～");
  };
  document.getElementById("pc-chat-close").onclick = function () {
    box.style.display = "none";
    btn.style.display = "block";
  };

  var busy = false;
  function send() {
    var t = inp.value.trim();
    if (!t || busy) return;
    inp.value = "";
    add("pc-user", t);
    var w = add("pc-bot", "正在输入…");
    busy = true;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: t, visitorId: vid }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.reply) { w.innerHTML = pcMd(j.reply); } else { w.textContent = "网络有点问题，请稍后再试～"; } msgs.scrollTop = msgs.scrollHeight; })
      .catch(function () { w.textContent = "网络有点问题，请稍后再试～"; })
      .finally(function () { busy = false; });
  }
  document.getElementById("pc-chat-send").onclick = send;
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();
