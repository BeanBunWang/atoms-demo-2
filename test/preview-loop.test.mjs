import test from "node:test";
import assert from "node:assert/strict";

import { applyRuntimeResult, createWorkspace } from "../site/js/planner.js";
import { buildPreviewFixPrompt, recordPreviewVerification, verifyPreviewArtifact } from "../site/js/preview-loop.js";

test("Preview 验证覆盖 schema、Code 同步和真实渲染", () => {
  const workspace = createWorkspace({ title: "计算器", prompt: "做一个计算器" });
  const passed = verifyPreviewArtifact(workspace, { checked: true, title: workspace.preview.title, sectionCount: 3, appType: "calculator" });
  assert.equal(passed.passed, true);
  const failed = verifyPreviewArtifact(workspace, { checked: true, title: "错误标题", sectionCount: 2, appType: "generic" });
  assert.equal(failed.passed, false);
  assert.match(buildPreviewFixPrompt(failed), /保持现有功能/);
  assert.equal(recordPreviewVerification(workspace, {}, "manual").previewFeedback.length, 1);
});

test("失败或过期的候选产物不会覆盖当前 Preview", () => {
  const workspace = { ...createWorkspace({ title: "当前版", prompt: "做一个任务应用" }), artifactRevision: 3, runBaseRevision: 3, hasBuiltArtifact: true };
  const candidate = { preview: { ...workspace.preview, title: "错误覆盖" }, files: ["src/App.jsx"], assistantMessage: "done", baseRevision: 2, nextRevision: 3 };
  const updated = applyRuntimeResult(workspace, { type: "run.completed", stage: "build", status: "ready", artifact: candidate, verification: { issues: [] } });
  assert.equal(updated.phase, "verification-failed");
  assert.equal(updated.preview.title, "当前版");
  assert.equal(updated.artifactRevision, 3);
  assert.equal(updated.candidateArtifact.preview.title, "错误覆盖");
});
