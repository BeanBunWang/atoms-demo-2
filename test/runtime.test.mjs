import test from "node:test";
import assert from "node:assert/strict";

import { inferIntent, normalizeIntent } from "../agent/intent.mjs";
import { runAgentRuntime } from "../agent/runtime.mjs";
import { normalizeArtifact, normalizePlan, validateArtifact } from "../agent/tools.mjs";

test("意图路由会区分构建、研究和数据分析", () => {
  assert.equal(inferIntent("做一个宠物疫苗提醒应用").type, "build_app");
  assert.equal(inferIntent("研究宠物保险市场和主要竞品").type, "research");
  assert.equal(inferIntent("分析销售漏斗并生成看板").type, "analyze_data");
  assert.equal(normalizeIntent({ type: "unknown" }, "优化现有应用", { hasExistingApp: true }).type, "modify_app");
});

test("计划按意图选择专家并确保最后验证", () => {
  const intent = inferIntent("分析销售漏斗并生成看板");
  const plan = normalizePlan({ title: "销售洞察", steps: [
    { id: "1", agent: "david", title: "定义漏斗", goal: "统一口径", tool: "analyze_data" },
    { id: "2", agent: "alex", title: "实现看板", goal: "生成页面", tool: "compose_app" }
  ] }, intent);
  assert.equal(plan.steps.at(-1).tool, "validate_artifact");
  assert.ok(plan.steps.some((step) => step.agent === "david"));
  assert.ok(plan.steps.some((step) => step.agent === "alex"));
});

test("产物校验要求话题相关和页面结构多样", () => {
  const intent = inferIntent("做一个宠物疫苗提醒应用");
  const artifact = normalizeArtifact({ preview: {
    template: "tracker", title: "宠护日历", subtitle: "宠物疫苗记录与提醒", accent: "#7357ff", background: "#f7f4ff",
    sections: [
      { type: "timeline", title: "疫苗时间线", items: [{ title: "狂犬疫苗", meta: "7 月 30 日", status: "待接种" }] },
      { type: "cards", title: "宠物档案", items: [{ title: "团子", meta: "英短 · 2 岁", status: "健康" }] },
      { type: "progress", title: "年度计划", items: [{ title: "免疫进度", meta: "已完成 3 项", value: "75%" }] }
    ]
  }, files: ["src/App.jsx"] }, intent);
  assert.equal(validateArtifact(artifact, intent).passed, true);
});

test("模型对象字段不会泄漏为 object Object 文案", () => {
  const intent = inferIntent("做一个宠物疫苗提醒应用");
  const artifact = normalizeArtifact({ preview: {
    template: "tracker",
    title: "宠护日历",
    subtitle: "宠物疫苗记录与提醒",
    navItems: [{ label: "概览" }, { label: "提醒" }],
    primaryAction: { label: "添加提醒" },
    sections: [
      { type: "timeline", title: "疫苗时间线", items: [{ title: "狂犬疫苗" }] },
      { type: "cards", title: "宠物档案", items: [{ title: "团子" }] },
      { type: "progress", title: "免疫进度", items: [{ title: "年度计划" }] }
    ]
  } }, intent);
  assert.deepEqual(artifact.preview.navItems, ["概览", "任务", "洞察"]);
  assert.equal(typeof artifact.preview.primaryAction, "string");
  assert.doesNotMatch(JSON.stringify(artifact), /\[object Object\]/);
});

test("runtime 先计划审批，再执行工具、生成产物并验证", async () => {
  const events = [];
  const responses = [
    { type: "build_app", goal: "构建宠物疫苗提醒", domain: "宠物健康", audience: "养宠人", entities: ["宠物", "疫苗"], requestedFeatures: ["疫苗提醒"], confidence: .94 },
    { title: "宠护日历", summary: "管理宠物免疫", steps: [
      { id: "p1", agent: "emma", title: "定义流程", goal: "整理免疫场景", tool: "define_product" },
      { id: "p2", agent: "alex", title: "构建应用", goal: "实现提醒页面", tool: "compose_app" },
      { id: "p3", agent: "mike", title: "验证", goal: "检查交付", tool: "validate_artifact" }
    ] },
    { assistantMessage: "宠物疫苗提醒已完成", preview: { template: "tracker", title: "宠护日历", subtitle: "宠物疫苗记录与提醒", sections: [
      { type: "timeline", title: "疫苗时间线", items: [{ title: "狂犬疫苗", meta: "下次接种", status: "待接种" }] },
      { type: "cards", title: "宠物档案", items: [{ title: "团子", meta: "2 岁", status: "健康" }] },
      { type: "progress", title: "免疫进度", items: [{ title: "年度计划", meta: "3/4", value: "75%" }] }
    ] }, files: ["src/App.jsx", "src/data.js"] }
  ];
  const complete = async () => responses.shift();
  const planRun = await runAgentRuntime({ stage: "plan", prompt: "做一个宠物疫苗提醒应用", complete, emit: (event) => events.push(event) });
  assert.equal(planRun.status, "awaiting_approval");
  assert.ok(events.some((event) => event.type === "intent.classified"));
  assert.ok(events.some((event) => event.type === "approval.required"));

  const buildEvents = [];
  const buildRun = await runAgentRuntime({ stage: "build", prompt: "做一个宠物疫苗提醒应用", context: { intent: planRun.intent, plan: planRun.plan }, complete, emit: (event) => buildEvents.push(event) });
  assert.equal(buildRun.status, "ready");
  assert.ok(buildEvents.some((event) => event.type === "tool.called"));
  assert.ok(buildEvents.some((event) => event.type === "verification.completed"));
});
