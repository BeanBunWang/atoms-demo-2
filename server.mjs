import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentRuntime } from "./agent/runtime.mjs";

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.join(PROJECT_ROOT, "site");
const DEFAULT_MODEL = "deepseek-v4-flash";
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

export function resolveModel(env) {
  const configured = env.DEEPSEEK_MODEL?.trim();
  return configured === DEFAULT_MODEL ? configured : DEFAULT_MODEL;
}

function cleanText(value, fallback, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maxLength);
}

export function normalizeModelResult(value) {
  if (!value || typeof value !== "object") throw new Error("模型未返回有效对象");
  const rawPlan = Array.isArray(value.plan) ? value.plan.slice(0, 5) : [];
  if (rawPlan.length < 4) throw new Error("模型计划步骤不足");
  const accent = /^#[0-9a-f]{6}$/i.test(value.preview?.accent || "") ? value.preview.accent : "#246bfd";
  const fallbackFeatures = [
    { title: "清晰入口", detail: "快速进入最重要的使用场景。" },
    { title: "即时反馈", detail: "每次操作都有明确的状态反馈。" },
    { title: "持续积累", detail: "让每次记录形成长期价值。" }
  ];
  const rawFeatures = Array.isArray(value.preview?.features) && value.preview.features.length >= 3
    ? value.preview.features.slice(0, 3)
    : fallbackFeatures;
  const rawNavItems = Array.isArray(value.preview?.navItems) ? value.preview.navItems.slice(0, 2) : [];
  return {
    title: cleanText(value.title, "新应用", 36),
    assistantMessage: cleanText(value.assistantMessage, "我已经根据需求生成了实施计划，请确认后开始构建。", 180),
    plan: rawPlan.map((step, index) => ({
      title: cleanText(step?.title, `实施步骤 ${index + 1}`, 28),
      detail: cleanText(step?.detail, "完成该阶段的核心交付并验证结果。", 120)
    })),
    preview: {
      title: cleanText(value.preview?.title, value.title || "新应用", 36),
      subtitle: cleanText(value.preview?.subtitle, "把想法变成清晰、可操作的产品体验。", 120),
      cardTitle: cleanText(value.preview?.cardTitle, "核心功能", 36),
      cardMeta: cleanText(value.preview?.cardMeta, "第一版体验已就绪", 60),
      button: cleanText(value.preview?.button, "开始体验", 20),
      accent,
      eyebrow: cleanText(value.preview?.eyebrow, "BUILT AROUND YOUR DAY", 36).toUpperCase(),
      navItems: [cleanText(rawNavItems[0], "首页", 8), cleanText(rawNavItems[1], "记录", 8)],
      visualStart: cleanText(value.preview?.visualStart, "START", 12),
      visualEnd: cleanText(value.preview?.visualEnd, "DONE", 12),
      visualLabel: cleanText(value.preview?.visualLabel, "in progress", 18),
      features: rawFeatures.map((feature, index) => ({
        title: cleanText(feature?.title, fallbackFeatures[index].title, 18),
        detail: cleanText(feature?.detail, fallbackFeatures[index].detail, 60)
      }))
    }
  };
}

function parseModelContent(content) {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return normalizeModelResult(JSON.parse(cleaned));
}

export function buildDeepSeekRequest(prompt, context = {}, model = DEFAULT_MODEL) {
  const current = context.preview || {};
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是 Atoms 应用构建团队的负责人 Mike。请把用户需求转成一份可执行的产品计划和应用预览规格。",
          "只输出 JSON，不要 Markdown。结构必须是：",
          '{"title":"项目名","assistantMessage":"给用户的简短说明","plan":[{"title":"步骤标题","detail":"可验证的交付"}],"preview":{"title":"应用标题","subtitle":"一句价值说明","cardTitle":"核心卡片标题","cardMeta":"简短状态信息","button":"按钮文案","accent":"#RRGGBB","eyebrow":"简短英文场景标语","navItems":["导航一","导航二"],"visualStart":"场景起点数据","visualEnd":"场景终点数据","visualLabel":"场景状态","features":[{"title":"功能标题","detail":"具体价值"}]}}',
          "plan 必须包含 4 个步骤，分别覆盖产品目标、信息结构、关键交互、验证交付。",
          "preview.features 必须包含 3 项，所有预览内容必须与用户场景一致，不得残留旅行、阅读等无关模板词。",
          "内容使用简体中文，避免空泛 AI 话术，按钮不超过 8 个汉字。"
        ].join("\n")
      },
      {
        role: "user",
        content: `用户需求：${prompt}\n当前应用：${JSON.stringify({ title: current.title, subtitle: current.subtitle, cardTitle: current.cardTitle })}`
      }
    ],
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    max_tokens: 1000,
    stream: false
  };
}

export async function requestDeepSeekPlan({ prompt, context, env, fetchImpl = fetch }) {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = resolveModel(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildDeepSeekRequest(prompt, context, model)),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `DeepSeek 请求失败 (${response.status})`);
    const result = parseModelContent(payload.choices?.[0]?.message?.content);
    return { result, model: payload.model || model, usage: payload.usage || null };
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonContent(content) {
  const cleaned = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function requestDeepSeekJson({ messages, env, fetchImpl = fetch, maxTokens = 2200 }) {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = resolveModel(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: messages.system }, { role: "user", content: messages.user }],
        thinking: { type: "disabled" }, response_format: { type: "json_object" }, max_tokens: maxTokens, stream: false
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `DeepSeek 请求失败 (${response.status})`);
    return parseJsonContent(payload.choices?.[0]?.message?.content);
  } finally {
    clearTimeout(timer);
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          realModel: Boolean(runtimeEnv.DEEPSEEK_API_KEY?.trim()),
          model: resolveModel(runtimeEnv)
        });
      }
      if (request.method === "POST" && url.pathname === "/api/agent/plan") {
        const body = await readJsonBody(request);
        const prompt = cleanText(body.prompt, "", 500);
        if (!prompt) return sendJson(response, 400, { error: "请输入应用需求" });
        const completion = await requestDeepSeekPlan({ prompt, context: body.context, env: runtimeEnv, fetchImpl });
        return sendJson(response, 200, completion);
      }
      if (request.method === "POST" && url.pathname === "/api/agent/run") {
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
      const timeout = error.name === "AbortError";
      return sendJson(response, timeout ? 504 : 502, { error: timeout ? "DeepSeek 响应超时" : error.message || "服务暂时不可用" });
    }
  });
}

async function main() {
  const env = await loadEnvironment();
  const port = Number(env.PORT) || 4173;
  const server = createAppServer({ env });
  server.listen(port, "127.0.0.1", () => {
    const model = resolveModel(env);
    const provider = env.DEEPSEEK_API_KEY?.trim() ? model : "local fallback";
    console.log(`Atoms Demo running at http://127.0.0.1:${port} (${provider})`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
