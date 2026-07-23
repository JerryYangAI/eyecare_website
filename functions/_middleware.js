/**
 * 全站注入聊天挂件：对所有 HTML 响应用 HTMLRewriter 在 </body> 前追加脚本标签。
 * 优点：不需修改任何现有页面，未来新增页面也自动生效；非 HTML 请求直接透传。
 */
export async function onRequest(context) {
  const response = await context.next();
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;
  return new HTMLRewriter()
    .on("body", {
      element(el) {
        el.append('<script src="/chat-widget.js" defer></script>', { html: true });
      },
    })
    .transform(response);
}
