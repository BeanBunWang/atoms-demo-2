import test from "node:test";
import assert from "node:assert/strict";

import { buildDeepSeekRequest, createAppServer, normalizeModelResult, parseEnv, requestDeepSeekPlan, resolveModel } from "../server.mjs";

async function createAuthCookie(baseUrl, email = `server-${crypto.randomUUID()}@example.com`) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct-password" })
  });
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}

test(".env 解析不会改变等号后的内容", () => {
  assert.deepEqual(parseEnv("DEEPSEEK_API_KEY=abc=123\nDEEPSEEK_MODEL='deepseek-v4-pro'\n# note"), {
    DEEPSEEK_API_KEY: "abc=123",
    DEEPSEEK_MODEL: "deepseek-v4-pro"
  });
});

test("DeepSeek 请求固定使用 JSON 与 Pro 思考模式", () => {
  const body = buildDeepSeekRequest("做一个读书应用", {}, "deepseek-v4-pro");
  assert.equal(body.model, "deepseek-v4-pro");
  assert.deepEqual(body.thinking, { type: "enabled" });
  assert.equal(body.reasoning_effort, "high");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match(body.messages[0].content, /只输出 JSON/);
});

test("应用固定使用 Pro，避免环境误配为 Flash", () => {
  assert.equal(resolveModel({ DEEPSEEK_MODEL: "deepseek-v4-pro" }), "deepseek-v4-pro");
  assert.equal(resolveModel({ DEEPSEEK_MODEL: "deepseek-v4-flash" }), "deepseek-v4-pro");
});

test("模型结构会被校验和裁剪", () => {
  const result = normalizeModelResult({
    title: "阅读空间",
    assistantMessage: "计划已生成",
    plan: Array.from({ length: 5 }, (_, index) => ({ title: `步骤 ${index + 1}`, detail: "完成交付" })),
    preview: { title: "阅读空间", accent: "not-a-color" }
  });
  assert.equal(result.plan.length, 5);
  assert.equal(result.preview.accent, "#246bfd");
  assert.equal(result.preview.features.length, 3);
  assert.equal(result.preview.navItems.length, 2);
  assert.throws(() => normalizeModelResult({ plan: [] }), /步骤不足/);
});

test("真实请求使用服务端密钥且返回规范化结果", async () => {
  let authorization;
  let requestBody;
  const fakeFetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "deepseek-v4-pro",
      choices: [{ message: { content: JSON.stringify({
        title: "喝水助手",
        assistantMessage: "计划已生成",
        plan: Array.from({ length: 4 }, (_, index) => ({ title: `步骤 ${index + 1}`, detail: "完成交付" })),
        preview: { title: "喝水助手", subtitle: "保持水分", cardTitle: "今日饮水", cardMeta: "3 / 8 杯", button: "记录一杯", accent: "#33a36b" }
      }) } }],
      usage: { total_tokens: 120 }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const response = await requestDeepSeekPlan({
    prompt: "做一个喝水应用",
    context: {},
    env: { DEEPSEEK_API_KEY: "server-secret", DEEPSEEK_MODEL: "deepseek-v4-pro" },
    fetchImpl: fakeFetch
  });
  assert.equal(authorization, "Bearer server-secret");
  assert.equal(requestBody.model, "deepseek-v4-pro");
  assert.deepEqual(requestBody.thinking, { type: "enabled" });
  assert.equal(requestBody.reasoning_effort, "high");
  assert.equal(response.result.preview.title, "喝水助手");
});

test("思考模式偶发空 JSON 时会自动重试一次", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    const content = calls === 1
      ? ""
      : JSON.stringify({
          title: "订单看板",
          assistantMessage: "计划已生成",
          plan: Array.from({ length: 4 }, (_, index) => ({ title: `步骤 ${index + 1}`, detail: "完成交付" })),
          preview: { title: "订单看板", subtitle: "减少漏单", cardTitle: "待制作", cardMeta: "3 单", button: "查看订单", accent: "#246bfd" }
        });
    return new Response(JSON.stringify({ model: "deepseek-v4-pro", choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const response = await requestDeepSeekPlan({
    prompt: "做一个订单看板",
    context: {},
    env: { DEEPSEEK_API_KEY: "server-secret", DEEPSEEK_MODEL: "deepseek-v4-pro" },
    fetchImpl: fakeFetch
  });
  assert.equal(calls, 2);
  assert.equal(response.result.title, "订单看板");
});

test("健康检查只暴露模型可用状态", async (t) => {
  const server = createAppServer({ env: { DEEPSEEK_API_KEY: "hidden", DEEPSEEK_MODEL: "deepseek-v4-pro" } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const payload = await response.json();
  assert.deepEqual(payload, { realModel: true, model: "deepseek-v4-pro" });
  assert.equal(JSON.stringify(payload).includes("hidden"), false);
});

test("无效 JSON 返回稳定的客户端错误", async (t) => {
  const server = createAppServer({ env: { DEEPSEEK_API_KEY: "hidden" } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await createAuthCookie(baseUrl);
  const response = await fetch(`${baseUrl}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: "{broken"
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "请求 JSON 无效" });
});

test("Agent endpoint 以 NDJSON 输出意图、计划与审批事件", async (t) => {
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
    return new Response(JSON.stringify({ model: "deepseek-v4-pro", choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const server = createAppServer({ env: { DEEPSEEK_API_KEY: "hidden" }, fetchImpl: fakeFetch });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await createAuthCookie(baseUrl);
  const response = await fetch(`${baseUrl}/api/agent/run`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ stage: "plan", prompt: "做一个宠物疫苗提醒应用" })
  });
  assert.match(response.headers.get("content-type"), /application\/x-ndjson/);
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  assert.ok(events.some((event) => event.type === "intent.classified"));
  assert.ok(events.some((event) => event.type === "plan.created"));
  assert.equal(events.at(-1).status, "awaiting_approval");
});
