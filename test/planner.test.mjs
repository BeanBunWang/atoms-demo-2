import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  AGENTS,
  approvePlan,
  buildProgress,
  createWorkspace,
  isComposerEmpty,
  nextBuildStep,
  publishWorkspace,
  submitPrompt,
  updatePreview
} from "../site/js/planner.js";
import { STORAGE_KEY, initialState, isValidState, loadState, parseImportedState } from "../site/js/storage.js";

test("新工作区包含 Atoms 应用构建链路", () => {
  const workspace = createWorkspace(
    { title: "读书搭子", prompt: "为忙碌的上班族做一个阅读记录应用", mode: "team" },
    { id: "p1", now: "2026-01-01T00:00:00.000Z" }
  );

  assert.equal(workspace.id, "p1");
  assert.equal(workspace.phase, "plan-review");
  assert.equal(workspace.agents.length, 5);
  assert.equal(workspace.agents[0].key, "mike");
  assert.ok(workspace.plan.length >= 4);
  assert.ok(workspace.files.some((file) => file.path === "src/App.jsx"));
});

test("审批计划后才允许智能体进入构建", () => {
  const draft = createWorkspace({ title: "A", prompt: "做一个清晰的任务应用", mode: "build" });
  assert.equal(nextBuildStep(draft).phase, "plan-review");

  let workspace = approvePlan(draft, "2026-01-01T00:00:01.000Z");
  assert.equal(workspace.phase, "building");
  assert.equal(workspace.agents[1].status, "active");

  while (workspace.phase === "building") workspace = nextBuildStep(workspace, "2026-01-01T00:00:02.000Z");
  assert.equal(workspace.phase, "ready");
  assert.equal(buildProgress(workspace), 100);
});

test("追加指令会生成新的计划审批轮次", () => {
  const ready = createWorkspace({ title: "A", prompt: "做一个旅行应用", mode: "team" });
  const updated = submitPrompt(ready, "增加收藏和深色按钮", "2026-01-01T00:00:03.000Z");

  assert.equal(updated.phase, "plan-review");
  assert.match(updated.preview.subtitle, /收藏/);
  assert.equal(updated.messages.at(-1).role, "agent");
});

test("可视编辑和发布更新交付状态", () => {
  let workspace = createWorkspace({ title: "A", prompt: "做一个健康习惯应用", mode: "team" });
  workspace = approvePlan(workspace);
  while (workspace.phase === "building") workspace = nextBuildStep(workspace);
  workspace = updatePreview(workspace, { title: "微习惯", accent: "#7c5cff" });
  workspace = publishWorkspace(workspace, "2026-01-01T00:00:04.000Z");

  assert.equal(workspace.preview.title, "微习惯");
  assert.equal(workspace.preview.accent, "#7c5cff");
  assert.equal(workspace.published, true);
});

test("输入空态严格区分空白与有效内容", () => {
  assert.equal(isComposerEmpty(""), true);
  assert.equal(isComposerEmpty("   \n"), true);
  assert.equal(isComposerEmpty("做一个应用"), false);
});

test("本地状态可以安全加载与导入", () => {
  const state = initialState();
  const imported = parseImportedState(JSON.stringify(state));
  assert.equal(isValidState(imported), true);
  assert.equal(imported.activeWorkspaceId, "workspace-demo");
  assert.equal(STORAGE_KEY, "atoms-demo-workspace-v2");
  assert.throws(() => parseImportedState('{"version":1}'), /有效/);

  const brokenStorage = { getItem: () => "{broken" };
  assert.equal(loadState(brokenStorage).version, 2);
});

test("页面为 placeholder 提供显式输入态契约", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("../site/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../site/js/app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="prompt-input"[^>]+placeholder=/s);
  assert.match(css, /\.prompt-input\.has-value::placeholder/);
  assert.match(app, /classList\.toggle\("has-value"/);
});

test("所有展示智能体均有本地头像", () => {
  assert.equal(AGENTS.length, 8);
  assert.ok(AGENTS.every((agent) => agent.avatar.startsWith("./assets/agents/")));
});
