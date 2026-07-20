import { normalizeIntent } from "./agent/intent.mjs";
import { cleanText, requestDeepSeekJson, requestDeepSeekPlan, resolveModel } from "./agent/model.mjs";
import { runAgentRuntime } from "./agent/runtime.mjs";
import { normalizeArtifact, normalizePlan } from "./agent/tools.mjs";

const MAX_BODY_BYTES = 32_000;
const encoder = new TextEncoder();

const securityHeaders = {
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex"
};

function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { ...securityHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function validateApiRequest(request) {
  const origin = request.headers.get("Origin");
  const targetOrigin = new URL(request.url).origin;
  if (origin && origin !== targetOrigin) return jsonResponse({ error: "禁止跨站调用" }, 403);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return jsonResponse({ error: "禁止跨站调用" }, 403);
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) return jsonResponse({ error: "请求必须使用 JSON" }, 415);
  return null;
}

async function enforceRateLimit(request, env) {
  if (!env.AGENT_RATE_LIMITER?.limit) return null;
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  const result = await env.AGENT_RATE_LIMITER.limit({ key });
  return result.success ? null : jsonResponse({ error: "请求过于频繁，请稍后再试" }, 429);
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  try {
    return JSON.parse(new TextDecoder().decode(buffer) || "{}");
  } catch {
    throw Object.assign(new Error("请求 JSON 无效"), { status: 400 });
  }
}

const sanitizeList = (value, limit, itemLimit) => (Array.isArray(value) ? value : [])
  .slice(0, limit)
  .map((item) => cleanText(item, "", itemLimit))
  .filter(Boolean);

function sanitizeCapabilities(value) {
  const capabilities = value && typeof value === "object" ? value : {};
  return {
    teamMode: Boolean(capabilities.teamMode),
    deepResearch: Boolean(capabilities.deepResearch),
    raceMode: Boolean(capabilities.raceMode),
    connectors: sanitizeList(capabilities.connectors, 4, 40),
    attachments: (Array.isArray(capabilities.attachments) ? capabilities.attachments : []).slice(0, 3).map((attachment) => ({
      name: cleanText(attachment?.name, "附件", 80),
      type: cleanText(attachment?.type, "text/plain", 60),
      content: cleanText(attachment?.content, "", 2000)
    }))
  };
}

function sanitizeRunBody(raw) {
  const prompt = cleanText(raw?.prompt, "", 800);
  const capabilities = sanitizeCapabilities(raw?.capabilities);
  const rawContext = raw?.context && typeof raw.context === "object" ? raw.context : {};
  const intentContext = { capabilities, hasExistingApp: Boolean(rawContext.hasExistingApp) };
  const intent = rawContext.intent ? normalizeIntent(rawContext.intent, prompt, intentContext) : undefined;
  const plan = intent && rawContext.plan ? normalizePlan(rawContext.plan, intent) : undefined;
  const contextIntent = intent || normalizeIntent({ type: rawContext.hasExistingApp ? "modify_app" : "build_app" }, prompt, intentContext);
  const baseRevision = Math.max(0, Math.floor(Number(rawContext.artifactRevision) || 0));
  const preview = rawContext.preview
    ? normalizeArtifact({ preview: rawContext.preview, files: ["src/App.jsx"] }, contextIntent, { baseRevision }).preview
    : undefined;
  const previewVerification = rawContext.previewVerification && typeof rawContext.previewVerification === "object"
    ? { status: rawContext.previewVerification.status === "passed" ? "passed" : "failed", issues: sanitizeList(rawContext.previewVerification.issues, 6, 120), revision: Math.max(0, Math.floor(Number(rawContext.previewVerification.revision) || 0)) }
    : undefined;
  const previewFeedback = (Array.isArray(rawContext.previewFeedback) ? rawContext.previewFeedback : []).slice(-8).map((item) => ({
    type: cleanText(item?.type, "preview.feedback", 40),
    source: cleanText(item?.source, "preview", 40),
    revision: Math.max(0, Math.floor(Number(item?.revision) || 0)),
    issues: sanitizeList(item?.issues, 4, 100)
  }));
  return {
    stage: raw?.stage === "build" ? "build" : "plan",
    prompt,
    capabilities,
    context: {
      intent,
      plan,
      preview,
      artifactRevision: baseRevision,
      previewVerification,
      previewFeedback,
      hasExistingApp: Boolean(rawContext.hasExistingApp),
      clarificationAnswer: cleanText(rawContext.clarificationAnswer, "", 240) || undefined
    }
  };
}

async function prepareApiRequest(request, env) {
  const rejected = validateApiRequest(request);
  return rejected || await enforceRateLimit(request, env);
}

async function handlePlan(request, env, fetchImpl) {
  const rejected = await prepareApiRequest(request, env);
  if (rejected) return rejected;
  const raw = await readJsonBody(request);
  const prompt = cleanText(raw?.prompt, "", 500);
  if (!prompt) return jsonResponse({ error: "请输入应用需求" }, 400);
  const completion = await requestDeepSeekPlan({
    prompt,
    context: { preview: raw?.context?.preview && typeof raw.context.preview === "object" ? raw.context.preview : undefined },
    env,
    fetchImpl
  });
  return jsonResponse(completion);
}

async function handleRun(request, env, fetchImpl, executionContext) {
  const rejected = await prepareApiRequest(request, env);
  if (rejected) return rejected;
  const body = sanitizeRunBody(await readJsonBody(request));
  if (!body.prompt) return jsonResponse({ error: "请输入应用需求" }, 400);

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const emit = (event) => writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
  const run = runAgentRuntime({
    ...body,
    complete: (messages) => requestDeepSeekJson({ messages, env, fetchImpl }),
    emit
  }).catch(() => emit({ type: "run.failed", at: new Date().toISOString(), message: "Agent runtime 暂时不可用" }))
    .finally(() => writer.close());
  executionContext?.waitUntil?.(run);

  return new Response(stream.readable, {
    headers: {
      ...securityHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

export function createWorker({ fetchImpl = fetch } = {}) {
  return {
    async fetch(request, env, executionContext) {
      const url = new URL(request.url);
      try {
        if (request.method === "GET" && url.pathname === "/api/health") {
          return jsonResponse({ realModel: Boolean(env.DEEPSEEK_API_KEY?.trim()), model: resolveModel(env) });
        }
        if (request.method === "POST" && url.pathname === "/api/agent/plan") {
          return await handlePlan(request, env, fetchImpl);
        }
        if (request.method === "POST" && url.pathname === "/api/agent/run") {
          return await handleRun(request, env, fetchImpl, executionContext);
        }
        if (url.pathname.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
        return env.ASSETS.fetch(request);
      } catch (error) {
        const status = Number(error?.status) || (error?.name === "AbortError" ? 504 : 502);
        return jsonResponse({ error: status < 500 ? error.message : "模型服务暂时不可用" }, status);
      }
    }
  };
}

export default createWorker();
