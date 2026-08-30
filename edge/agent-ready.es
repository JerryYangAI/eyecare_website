# 品川光医 Agent-Ready 边缘规则
# 在首页添加发现响应头，并将明确请求 Markdown 的首页访问内部改写到 /index.md。

is_home = or(eq($uri, '/'), eq($uri, '/index.html'))

if is_home {
  add_rsp_header('Link', '</.well-known/api-catalog>; rel=api-catalog, </.well-known/ai-catalog.json>; rel=ai-catalog, </.well-known/mcp/server-card.json>; rel=service-desc')
}

if and(is_home, $http_accept, match_re($http_accept, 'text/markdown', 'i')) {
  rewrite('/index.md', 'break')
  add_rsp_header('Content-Type', 'text/markdown; charset=utf-8')
  add_rsp_header('Vary', 'Accept')
  add_rsp_header('x-markdown-tokens', '1100')
}

if eq($uri, '/.well-known/api-catalog') {
  add_rsp_header('Content-Type', 'application/linkset+json; charset=utf-8')
}

if eq($uri, '/.well-known/ai-catalog.json') {
  add_rsp_header('Access-Control-Allow-Origin', '*')
}
