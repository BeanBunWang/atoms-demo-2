import test from "node:test";
import assert from "node:assert/strict";

import { buildDeepSeekRequest, createAppServer, normalizeModelResult, parseEnv, requestDeepSeekPlan, resolveModel } from "../server.mjs";

test(".env 解析不会改变等号后的内容", () => {
  assert.deepEqual(parseEnv("DEEPSEEK_API_KEY=abc=123\nDEEPSEEK_MODEL='deepseek-v4-flash'\n# note"), {
    DEEPSEEK_API_KEY: "abc=123",
    DEEPSEEK_MODEL: "deepseek-v4-flash"
  });
});

test("DeepSeek 请求固定使用 JSON 与非思考 Flash 模式", () => {
  const body = buildDeepSeekRequest("做一个读书应用", {}, "deepseek-v4-flash");
  assert.equal(body.model, "deepseek-v4-flash");
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match(body.messages[0].content, /只输出 JSON/);
});

test("应用固定使用 Flash，避免环境误配为 Pro", () => {
  assert.equal(resolveModel({ DEEPSEEK_MODEL: "deepseek-v4-flash" }), "deepseek-v4-flash");
  assert.equal(resolveModel({ DEEPSEEK_MODEL: "deepseek-v4-pro" }), "deepseek-v4-flash");
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
  const fakeFetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return new Response(JSON.stringify({
      model: "deepseek-v4-flash",
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
    env: { DEEPSEEK_API_KEY: "server-secret", DEEPSEEK_MODEL: "deepseek-v4-flash" },
    fetchImpl: fakeFetch
  });
  assert.equal(authorization, "Bearer server-secret");
  assert.equal(response.result.preview.title, "喝水助手");
});

test("健康检查只暴露模型可用状态", async (t) => {
  const server = createAppServer({ env: { DEEPSEEK_API_KEY: "hidden", DEEPSEEK_MODEL: "deepseek-v4-flash" } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const payload = await response.json();
  assert.deepEqual(payload, { realModel: true, model: "deepseek-v4-flash" });
  assert.equal(JSON.stringify(payload).includes("hidden"), false);
});
