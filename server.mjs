import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { LocalMevService } from "./src/mev/localMevService.mjs";
import { LocalSolanaArbService } from "./src/solana/localSolanaArbService.mjs";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);
const root = process.cwd();
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const upstreamOrigin = process.env.UPSTREAM_ORIGIN || "https://autonomous-love-bot.replit.app";
const localMevService = new LocalMevService({ rootDir: root });
const localSolanaArbService = new LocalSolanaArbService({ rootDir: root });

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const MIME_BY_EXTENSION = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      const error = new Error(`Request body exceeds ${maxBytes} bytes`);
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

function safeResolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const cleaned = normalize(decoded).replace(/^\/+/, "");
  const absolutePath = resolve(join(root, cleaned));
  const rootPrefix = `${resolve(root)}${sep}`;

  if (absolutePath !== resolve(root) && !absolutePath.startsWith(rootPrefix)) {
    return null;
  }

  return absolutePath;
}

function hasFileExtension(pathname) {
  return extname(pathname) !== "";
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

function applyCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

function copyUpstreamHeaders(upstreamHeaders, res) {
  for (const [name, value] of upstreamHeaders.entries()) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) {
      continue;
    }
    if (lower === "content-encoding" || lower === "content-length") {
      continue;
    }
    res.setHeader(name, value);
  }
}

async function proxyApiRequest(req, res, requestUrl) {
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, upstreamOrigin);

  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value == null) {
      continue;
    }

    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === "host") {
      continue;
    }

    headers[name] = value;
  }

  const canHaveBody = !["GET", "HEAD"].includes(req.method || "GET");
  const fetchOptions = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (canHaveBody) {
    fetchOptions.body = Readable.toWeb(req);
    fetchOptions.duplex = "half";
  }

  try {
    const upstream = await fetch(upstreamUrl, fetchOptions);

    res.statusCode = upstream.status;
    copyUpstreamHeaders(upstream.headers, res);
    applyCorsHeaders(res);

    if (!upstream.body || req.method === "HEAD") {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    sendJson(res, 502, {
      error: "Failed to proxy API request",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function serveStaticFile(res, filePath, method = "GET") {
  const extension = extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension] || "application/octet-stream";
  const info = await stat(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": info.size,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
  });

  if (method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

async function handleLocalApiRequest(req, res, pathname, method) {
  await Promise.all([localMevService.ready(), localSolanaArbService.ready()]);

  if (method === "OPTIONS") {
    applyCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  applyCorsHeaders(res);

  try {
    if (pathname === "/api/local/solana/wallet/status" && method === "GET") {
      const wallet = await localSolanaArbService.refreshWalletBalance();
      sendJson(res, 200, { wallet });
      return;
    }

    if (pathname === "/api/local/solana/wallet/import" && method === "POST") {
      const body = await readJsonBody(req);
      const wallet = await localSolanaArbService.importWallet({ privateKey: body.privateKey });
      sendJson(res, 200, { success: true, wallet });
      return;
    }

    if (pathname === "/api/local/solana/wallet/clear" && method === "POST") {
      const wallet = await localSolanaArbService.clearWallet();
      sendJson(res, 200, { success: true, wallet });
      return;
    }

    if (pathname === "/api/local/solana/bot/status" && method === "GET") {
      sendJson(res, 200, localSolanaArbService.getStatus());
      return;
    }

    if (pathname === "/api/local/solana/bot/config" && method === "POST") {
      const body = await readJsonBody(req);
      const config = await localSolanaArbService.applyConfigPatch(body);
      sendJson(res, 200, { success: true, config });
      return;
    }

    if (pathname === "/api/local/solana/bot/scan" && method === "POST") {
      const body = await readJsonBody(req);
      const result = await localSolanaArbService.scanOnce({
        trigger: body.trigger || "manual",
        allowExecute: body.allowExecute !== false,
      });
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === "/api/local/solana/bot/start" && method === "POST") {
      const status = await localSolanaArbService.start();
      sendJson(res, 200, { success: true, status });
      return;
    }

    if (pathname === "/api/local/solana/bot/stop" && method === "POST") {
      const status = await localSolanaArbService.stop();
      sendJson(res, 200, { success: true, status });
      return;
    }

    if (pathname === "/api/local/wallet/status" && method === "GET") {
      sendJson(res, 200, { wallet: localMevService.walletStatus() });
      return;
    }

    if (pathname === "/api/local/wallet/import" && method === "POST") {
      const body = await readJsonBody(req);
      const wallet = await localMevService.importWallet({ privateKey: body.privateKey });
      sendJson(res, 200, { success: true, wallet });
      return;
    }

    if (pathname === "/api/local/wallet/clear" && method === "POST") {
      const wallet = await localMevService.clearWallet();
      sendJson(res, 200, { success: true, wallet });
      return;
    }

    if (pathname === "/api/local/mev/status" && method === "GET") {
      sendJson(res, 200, localMevService.getStatus());
      return;
    }

    if (pathname === "/api/local/mev/config" && method === "POST") {
      const body = await readJsonBody(req);
      const config = await localMevService.applyConfigPatch(body);
      sendJson(res, 200, { success: true, config });
      return;
    }

    if (pathname === "/api/local/mev/scan" && method === "POST") {
      const body = await readJsonBody(req);
      const result = await localMevService.scanOnce({
        trigger: body.trigger || "manual",
        allowExecute: body.allowExecute !== false,
      });
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === "/api/local/mev/start" && method === "POST") {
      const status = await localMevService.start();
      sendJson(res, 200, { success: true, status });
      return;
    }

    if (pathname === "/api/local/mev/stop" && method === "POST") {
      const status = await localMevService.stop();
      sendJson(res, 200, { success: true, status });
      return;
    }

    sendJson(res, 404, { error: "Local API route not found" });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error instanceof Error ? error.message : "Unknown local API error",
    });
  }
}

const server = createServer(async (req, res) => {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname } = requestUrl;

  if (pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      app: "anavrin-monsters-dapp",
      upstreamOrigin,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pathname.startsWith("/api/local/")) {
    await handleLocalApiRequest(req, res, pathname, method);
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (method === "OPTIONS") {
      applyCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    await proxyApiRequest(req, res, requestUrl);
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, {
      error: "Method not allowed",
      method,
    });
    return;
  }

  let filePath;
  if (pathname === "/") {
    filePath = resolve(root, "index.html");
  } else if (pathname === "/local-mev") {
    filePath = resolve(root, "local-mev.html");
  } else if (pathname === "/solana-bot") {
    filePath = resolve(root, "solana-bot.html");
  } else if (hasFileExtension(pathname)) {
    filePath = safeResolveFile(pathname);
    if (!filePath) {
      sendJson(res, 400, { error: "Invalid path" });
      return;
    }
  } else {
    filePath = resolve(root, "index.html");
  }

  if (!(await fileExists(filePath))) {
    if (!hasFileExtension(pathname)) {
      filePath = resolve(root, "index.html");
    }
  }

  try {
    await access(filePath);
    await serveStaticFile(res, filePath, method);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
});

server.listen(port, host, () => {
  console.log(`Anavrin app running at http://${host}:${port}`);
  console.log(`Proxying API traffic to ${upstreamOrigin}`);
});
