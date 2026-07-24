import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentRuntime } from "./agent/runtime.mjs";
import {
  MAX_WORKSPACE_BYTES,
  clearSessionCookie,
  createAuthService,
  createMemoryDataStore,
  createSessionCookie,
  getSessionToken
} from "./backend/auth.mjs";
import {
  buildDeepSeekRequest,
  cleanText,
  normalizeModelResult,
  requestDeepSeekJson,
  requestDeepSeekPlan,
  resolveModel
} from "./agent/model.mjs";

export {
  buildDeepSeekRequest,
  normalizeModelResult,
  requestDeepSeekJson,
  requestDeepSeekPlan,
  resolveModel
} from "./agent/model.mjs";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.join(PROJECT_ROOT, "site");
const MAX_BODY_BYTES = 32_000;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp"
};

export function parseEnv(text) {
  return String(text)
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;
      const separator = trimmed.indexOf("=");
      if (separator < 1) return values;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
      return values;
    }, {});
}

export async function loadEnvironment(env = process.env, envPath = path.join(PROJECT_ROOT, ".env")) {
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { ...fileValues, ...env };
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers["content-length"] || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("请求内容过大"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("请求 JSON 无效"), { status: 400 });
  }
}

async function handleAuthRoute({ request, response, method, pathname, auth }) {
  if (method === "POST" && pathname === "/api/auth/register") {
    const result = await auth.register(await readJsonBody(request));
    return sendJson(response, 201, { user: result.user }, { "Set-Cookie": createSessionCookie(result.session.token) });
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    const result = await auth.login(await readJsonBody(request));
    return sendJson(response, 200, { user: result.user }, { "Set-Cookie": createSessionCookie(result.session.token) });
  }
  if (method === "POST" && pathname === "/api/auth/logout") {
    await auth.logout(getSessionToken(request));
    return sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }
  if (method === "GET" && pathname === "/api/auth/session") {
    const session = await auth.getSession(getSessionToken(request));
    return sendJson(response, 200, { user: session?.user || null });
  }
  return null;
}

async function handleWorkspaceRoute({ request, response, method, pathname, auth }) {
  if (pathname !== "/api/workspaces") return null;
  const user = await auth.requireUser(request);
  if (method === "GET") return sendJson(response, 200, await auth.getWorkspaceState(user.id));
  if (method === "PUT") {
    const state = await readJsonBody(request, MAX_WORKSPACE_BYTES);
    return sendJson(response, 200, await auth.putWorkspaceState(user.id, state));
  }
  return sendJson(response, 405, { error: "Method not allowed" });
}

async function serveStatic(requestPath, response) {
  const pathname = requestPath === "/" ? "/index.html" : requestPath;
  const resolved = path.resolve(SITE_ROOT, `.${decodeURIComponent(pathname)}`);
  if (!resolved.startsWith(`${SITE_ROOT}${path.sep}`)) return sendJson(response, 403, { error: "禁止访问" });
  try {
    const info = await stat(resolved);
    const filePath = info.isDirectory() ? path.join(resolved, "index.html") : resolved;
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "Not found" });
    throw error;
  }
}

export function createAppServer({ env, fetchImpl = fetch } = {}) {
  const runtimeEnv = env || process.env;
  const auth = createAuthService(runtimeEnv.ATOMS_DATA || createMemoryDataStore());
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          realModel: Boolean(runtimeEnv.DEEPSEEK_API_KEY?.trim()),
          model: resolveModel(runtimeEnv)
        });
      }
      const authResponse = await handleAuthRoute({ request, response, method: request.method, pathname: url.pathname, auth });
      if (authResponse !== null) return authResponse;
      const workspaceResponse = await handleWorkspaceRoute({ request, response, method: request.method, pathname: url.pathname, auth });
      if (workspaceResponse !== null) return workspaceResponse;
      if (request.method === "POST" && url.pathname === "/api/agent/plan") {
        await auth.requireUser(request);
        const body = await readJsonBody(request);
        const prompt = cleanText(body.prompt, "", 500);
        if (!prompt) return sendJson(response, 400, { error: "请输入应用需求" });
        const completion = await requestDeepSeekPlan({ prompt, context: body.context, env: runtimeEnv, fetchImpl });
        return sendJson(response, 200, completion);
      }
      if (request.method === "POST" && url.pathname === "/api/agent/run") {
        await auth.requireUser(request);
        const body = await readJsonBody(request);
        const prompt = cleanText(body.prompt, "", 800);
        if (!prompt) return sendJson(response, 400, { error: "请输入应用需求" });
        response.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Accel-Buffering": "no"
        });
        const emit = (event) => response.write(`${JSON.stringify(event)}\n`);
        try {
          await runAgentRuntime({
            stage: body.stage === "build" ? "build" : "plan",
            prompt,
            context: body.context && typeof body.context === "object" ? body.context : {},
            capabilities: body.capabilities && typeof body.capabilities === "object" ? body.capabilities : {},
            complete: (messages) => requestDeepSeekJson({ messages, env: runtimeEnv, fetchImpl }),
            emit
          });
        } catch (error) {
          emit({ type: "run.failed", at: new Date().toISOString(), message: error.name === "AbortError" ? "DeepSeek 响应超时" : error.message || "Agent runtime 失败" });
        }
        return response.end();
      }
      if (request.method === "GET" || request.method === "HEAD") return serveStatic(url.pathname, response);
      return sendJson(response, 405, { error: "Method not allowed" });
    } catch (error) {
      const status = Number(error.status) || (error.name === "AbortError" ? 504 : 502);
      const message = status < 500 ? error.message : status === 504 ? "DeepSeek 响应超时" : "服务暂时不可用";
      return sendJson(response, status, { error: message });
    }
  });
}

async function main() {
  const env = await loadEnvironment();
  const port = Number(env.PORT) || 4173;
  const server = createAppServer({ env });
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`端口 ${port} 已被占用，可使用 PORT=4174 npm start 更换端口。`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
  server.listen(port, "127.0.0.1", () => {
    const model = resolveModel(env);
    const provider = env.DEEPSEEK_API_KEY?.trim() ? model : "local fallback";
    console.log(`Atoms Demo running at http://127.0.0.1:${port} (${provider})`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
