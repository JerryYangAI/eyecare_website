import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {extname, join, normalize} from "node:path";
import {fileURLToPath} from "node:url";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"]
]);

const linkHeader = [
  "</.well-known/api-catalog>; rel=api-catalog",
  "</.well-known/ai-catalog.json>; rel=ai-catalog",
  "</.well-known/mcp/server-card.json>; rel=service-desc"
].join(", ");

const safePath = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  const normalized = normalize(clean || "index.html");
  if (normalized.startsWith("..")) throw new Error("invalid path");
  return join(root, normalized);
};

export async function renderPreview({url: requestUrl = "/", headers: requestHeaders = {}, method = "GET"} = {}) {
    const requestedUrl = new URL(requestUrl, "http://localhost");
    try {
      const url = requestedUrl;
      const isHome = url.pathname === "/" || url.pathname === "/index.html";
      const wantsMarkdown = /(^|,)\s*text\/markdown(?:\s*;|\s*,|$)/i.test(requestHeaders.accept || "");
      let pathname = isHome && wantsMarkdown ? "/index.md" : url.pathname;
      let file = safePath(pathname);

      if (url.pathname.endsWith("/") && url.pathname !== "/") file = join(file, "index.html");
      try {
        if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      } catch {
        // readFile below returns the canonical 404 response.
      }

      const body = await readFile(file);
      const extension = extname(file).toLowerCase();
      let contentType = mime.get(extension) || "application/octet-stream";
      if (url.pathname === "/.well-known/api-catalog") contentType = "application/linkset+json; charset=utf-8";

      const headers = {"Content-Type": contentType, "Cache-Control": "no-cache"};
      if (isHome) headers.Link = linkHeader;
      if (wantsMarkdown && isHome) {
        headers.Vary = "Accept";
        headers["x-markdown-tokens"] = "1100";
      }
      if (url.pathname === "/.well-known/ai-catalog.json") headers["Access-Control-Allow-Origin"] = "*";
      return {statusCode: 200, headers, body: method === "HEAD" ? Buffer.alloc(0) : body};
    } catch {
      // Videos are managed as existing OSS objects rather than Git blobs. Redirecting
      // only in local preview lets browser QA exercise the real, verified assets.
      if (/^\/videos\/(?:redlight|heat|factory|reviews-[1-4])\.mp4$/.test(requestedUrl.pathname)) {
        return {
          statusCode: 302,
          headers: {Location: `https://www.koushicare.cn${requestedUrl.pathname}`, "Cache-Control": "no-cache"},
          body: Buffer.alloc(0)
        };
      }
      return {
        statusCode: 404,
        headers: {"Content-Type": "application/json; charset=utf-8"},
        body: Buffer.from(JSON.stringify({error: "not_found"}))
      };
    }
}

export function createPreviewServer() {
  return createServer(async (request, response) => {
    const rendered = await renderPreview({url: request.url, headers: request.headers, method: request.method});
    response.statusCode = rendered.statusCode;
    for (const [name, value] of Object.entries(rendered.headers)) response.setHeader(name, value);
    response.end(rendered.body);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createPreviewServer().listen(port, "127.0.0.1", () => {
    console.log(`Koushicare preview: http://127.0.0.1:${port}`);
  });
}
