import { normalizeIntent } from "./agent/intent.mjs";
import { cleanText, requestDeepSeekJson, requestDeepSeekPlan, resolveModel } from "./agent/model.mjs";
import { runAgentRuntime } from "./agent/runtime.mjs";
import { normalizeArtifact, normalizePlan } from "./agent/tools.mjs";
import {
  MAX_WORKSPACE_BYTES,
  clearSessionCookie,
  createAuthService,
  createMemoryDataStore,
  createSessionCookie,
  getSessionToken
} from "./backend/auth.mjs";

const MAX_BODY_BYTES = 32_000;
const encoder = new TextEncoder();

const securityHeaders = {
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex"
};

function jsonResponse(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: { ...securityHeaders, "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function validateSameOriginRequest(request) {
  const origin = request.headers.get("Origin");
  const targetOrigin = new URL(request.url).origin;
  if (origin && origin !== targetOrigin) return jsonResponse({ error: "禁止跨站调用" }, 403);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return jsonResponse({ error: "禁止跨站调用" }, 403);
  return null;
}

function validateApiRequest(request) {
  const sameOriginRejected = validateSameOriginRequest(request);
  if (sameOriginRejected) return sameOriginRejected;
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

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw Object.assign(new Error("请求内容过大"), { status: 413 });
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
  const recentMessages = (Array.isArray(rawContext.recentMessages) ? rawContext.recentMessages : []).slice(-10).map((message) => ({
    role: ["user", "agent", "system"].includes(message?.role) ? message.role : "user",
    agent: cleanText(message?.agent, "", 24) || undefined,
    text: cleanText(message?.text, "", 500)
  })).filter((message) => message.text);
  const sourceFiles = (Array.isArray(rawContext.sourceFiles) ? rawContext.sourceFiles : []).slice(0, 5).map((file) => ({
    path: cleanText(file?.path, "", 96),
    language: cleanText(file?.language || file?.type, "text", 24),
    content: typeof file?.content === "string" ? file.content.slice(0, 5000) : ""
  })).filter((file) => file.path && file.content);
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
      recentMessages,
      sourceFiles,
      hasExistingApp: Boolean(rawContext.hasExistingApp),
      clarificationAnswer: cleanText(rawContext.clarificationAnswer, "", 240) || undefined
    }
  };
}

async function prepareApiRequest(request) {
  const rejected = validateApiRequest(request);
  return rejected;
}

async function handlePlan(request, env, fetchImpl, auth) {
  const rejected = await prepareApiRequest(request);
  if (rejected) return rejected;
  await auth.requireUser(request);
  const limited = await enforceRateLimit(request, env);
  if (limited) return limited;
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

async function handleRun(request, env, fetchImpl, executionContext, auth) {
  const rejected = await prepareApiRequest(request);
  if (rejected) return rejected;
  await auth.requireUser(request);
  const limited = await enforceRateLimit(request, env);
  if (limited) return limited;
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

async function handleAuthRoute(request, auth) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const rejected = validateApiRequest(request);
    if (rejected) return rejected;
    const result = await auth.register(await readJsonBody(request));
    return jsonResponse({ user: result.user }, 201, { "Set-Cookie": createSessionCookie(result.session.token) });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const rejected = validateApiRequest(request);
    if (rejected) return rejected;
    const result = await auth.login(await readJsonBody(request));
    return jsonResponse({ user: result.user }, 200, { "Set-Cookie": createSessionCookie(result.session.token) });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const rejected = validateSameOriginRequest(request);
    if (rejected) return rejected;
    await auth.logout(getSessionToken(request));
    return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }
  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await auth.getSession(getSessionToken(request));
    return jsonResponse({ user: session?.user || null });
  }
  return null;
}

async function handleWorkspaceRoute(request, auth) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/workspaces") return null;
  const user = await auth.requireUser(request);
  if (request.method === "GET") return jsonResponse(await auth.getWorkspaceState(user.id));
  if (request.method === "PUT") {
    const rejected = validateApiRequest(request);
    if (rejected) return rejected;
    const state = await readJsonBody(request, MAX_WORKSPACE_BYTES);
    return jsonResponse(await auth.putWorkspaceState(user.id, state));
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

export function createWorker({ fetchImpl = fetch } = {}) {
  const memoryDataStore = createMemoryDataStore();
  return {
    async fetch(request, env, executionContext) {
      const url = new URL(request.url);
      const auth = createAuthService(env.ATOMS_DATA || memoryDataStore, { passwordPepper: env.AUTH_PEPPER });
      try {
        if (request.method === "GET" && url.pathname === "/api/health") {
          return jsonResponse({ realModel: Boolean(env.DEEPSEEK_API_KEY?.trim()), model: resolveModel(env) });
        }
        const authResponse = await handleAuthRoute(request, auth);
        if (authResponse) return authResponse;
        const workspaceResponse = await handleWorkspaceRoute(request, auth);
        if (workspaceResponse) return workspaceResponse;
        if (request.method === "POST" && url.pathname === "/api/agent/plan") {
          return await handlePlan(request, env, fetchImpl, auth);
        }
        if (request.method === "POST" && url.pathname === "/api/agent/run") {
          return await handleRun(request, env, fetchImpl, executionContext, auth);
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
