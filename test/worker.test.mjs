import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryDataStore } from "../backend/auth.mjs";
import { createWorker } from "../worker.mjs";

function testEnv(overrides = {}) {
  return {
    DEEPSEEK_API_KEY: "server-secret",
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    ASSETS: { fetch: async () => new Response("asset") },
    AGENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ATOMS_DATA: createMemoryDataStore(),
    ...overrides
  };
}

async function authCookie(worker, env) {
  const response = await worker.fetch(new Request("https://atoms.example/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://atoms.example" },
    body: JSON.stringify({ email: `agent-${crypto.randomUUID()}@example.com`, password: "correct-password" })
  }), env);
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}

test("Worker 健康检查不暴露服务端密钥", async () => {
  const response = await createWorker().fetch(new Request("https://atoms.example/api/health"), testEnv());
  const payload = await response.json();
  assert.deepEqual(payload, { realModel: true, model: "deepseek-v4-flash" });
  assert.equal(JSON.stringify(payload).includes("server-secret"), false);
});

test("Worker 拒绝跨站与超大 Agent 请求", async () => {
  const worker = createWorker();
  const env = testEnv();
  const crossSite = await worker.fetch(new Request("https://atoms.example/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ prompt: "做一个应用" })
  }), env);
  assert.equal(crossSite.status, 403);

  const cookie = await authCookie(worker, env);
  const tooLarge = await worker.fetch(new Request("https://atoms.example/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": "40000", Cookie: cookie },
    body: JSON.stringify({ prompt: "做一个应用" })
  }), env);
  assert.equal(tooLarge.status, 413);
});

test("Worker 按 IP 限制公开模型请求", async () => {
  const worker = createWorker();
  const env = testEnv({ AGENT_RATE_LIMITER: { limit: async ({ key }) => ({ success: key !== "203.0.113.7" }) } });
  const cookie = await authCookie(worker, env);
  const response = await worker.fetch(new Request("https://atoms.example/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7", Cookie: cookie },
    body: JSON.stringify({ prompt: "做一个应用" })
  }), env);
  assert.equal(response.status, 429);
});

test("Worker 以 NDJSON 输出真实意图、计划和审批事件", async () => {
  const fakeFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const system = request.messages[0].content;
    const content = system.includes("意图路由器")
      ? { type: "build_app", goal: "构建宠物提醒", domain: "宠物健康", audience: "养宠人", entities: ["宠物"], requestedFeatures: ["疫苗提醒"], confidence: .9 }
      : { title: "宠护日历", summary: "管理宠物健康提醒", steps: [
          { id: "1", agent: "emma", title: "定义产品", goal: "确认提醒流程", tool: "define_product" },
          { id: "2", agent: "alex", title: "实现应用", goal: "生成页面", tool: "compose_app" },
          { id: "3", agent: "mike", title: "验证交付", goal: "检查结果", tool: "validate_artifact" }
        ] };
    return new Response(JSON.stringify({ model: "deepseek-v4-flash", choices: [{ message: { content: JSON.stringify(content) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const worker = createWorker({ fetchImpl: fakeFetch });
  const env = testEnv();
  const cookie = await authCookie(worker, env);
  const response = await worker.fetch(new Request("https://atoms.example/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://atoms.example", Cookie: cookie },
    body: JSON.stringify({ stage: "plan", prompt: "做一个宠物疫苗提醒应用" })
  }), env, { waitUntil() {} });
  assert.match(response.headers.get("content-type"), /application\/x-ndjson/);
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  assert.ok(events.some((event) => event.type === "intent.classified"));
  assert.ok(events.some((event) => event.type === "plan.created"));
  assert.equal(events.at(-1).status, "awaiting_approval");
});
