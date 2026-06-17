/**
 * 品川光医 · Decap CMS GitHub OAuth 代理（Cloudflare Worker）
 * ----------------------------------------------------------------
 * 作用：Decap CMS 的 GitHub 后端需要一个 OAuth 中转服务来换取访问令牌。
 * 本 Worker 实现 /auth（发起授权）与 /callback（接收回调并回传令牌）。
 *
 * 部署后在 admin/config.yml 中设置：
 *   backend:
 *     name: github
 *     base_url: https://<本worker域名>
 *     auth_endpoint: /auth
 *
 * 需要在 Worker 中配置两个机密变量（Settings → Variables）：
 *   GITHUB_CLIENT_ID      —— GitHub OAuth App 的 Client ID
 *   GITHUB_CLIENT_SECRET  —— GitHub OAuth App 的 Client Secret
 *
 * GitHub OAuth App 的 Authorization callback URL 必须填：
 *   https://<本worker域名>/callback
 */

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const SCOPE = "repo,user";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/auth") {
      return handleAuth(url, env);
    }
    if (pathname === "/callback") {
      return handleCallback(url, env);
    }
    return new Response("品川光医 CMS Auth · OK", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

function handleAuth(url, env) {
  const redirectUri = `${url.origin}/callback`;
  const authUrl = new URL(GITHUB_AUTHORIZE);
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPE);
  // 透传 Decap 传来的 state（防 CSRF）
  const state = url.searchParams.get("state") || crypto.randomUUID();
  authUrl.searchParams.set("state", state);
  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(url, env) {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const tokenRes = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await tokenRes.json();
  const result = data.access_token
    ? { token: data.access_token, provider: "github" }
    : { error: data.error || "no_token" };

  const status = data.access_token ? "success" : "error";
  // Decap 通过 postMessage 接收令牌
  const payload = `authorization:github:${status}:${JSON.stringify(result)}`;

  const html = `<!DOCTYPE html><html><body><script>
    (function () {
      function send(){
        window.opener && window.opener.postMessage(
          ${JSON.stringify(payload)},
          "*"
        );
      }
      window.addEventListener("message", function(){ send(); }, false);
      send();
      setTimeout(function(){ window.close(); }, 800);
    })();
  </script>登录完成，请返回后台…</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
