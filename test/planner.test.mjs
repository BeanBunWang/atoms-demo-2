import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceProject,
  createProject,
  cycleTaskStatus,
  extractKeywords,
  finishAllAgents,
  projectProgress
} from "../site/js/planner.js";
import { initialState, isValidState, parseImportedState } from "../site/js/storage.js";

test("团队模式会生成完整智能体链路和可执行任务", () => {
  const project = createProject(
    { title: "读书搭子", brief: "帮助忙碌的上班族坚持阅读并记录收获", audience: "上班族", mode: "team" },
    { id: "p1", now: "2026-01-01T00:00:00.000Z" }
  );

  assert.equal(project.id, "p1");
  assert.equal(project.agents.length, 6);
  assert.equal(project.agents[0].status, "active");
  assert.ok(project.tasks.length >= 6);
});

test("推进项目会完成当前智能体并激活下一位", () => {
  const project = createProject({ title: "A", brief: "B", audience: "C", mode: "engineer" });
  const advanced = advanceProject(project, "2026-01-01T00:00:01.000Z");

  assert.equal(advanced.agents[0].status, "done");
  assert.equal(advanced.agents[1].status, "active");
  assert.equal(advanced.status, "running");
});

test("任务状态循环与进度计算保持一致", () => {
  const project = createProject({ title: "A", brief: "B", audience: "C", mode: "team" });
  project.tasks = project.tasks.map((task) => ({ ...task, status: "已完成" }));

  assert.equal(cycleTaskStatus("待开始"), "进行中");
  assert.equal(cycleTaskStatus("进行中"), "已完成");
  assert.equal(projectProgress(project), 100);
});

test("本地状态可以导出后再安全导入", () => {
  const state = initialState();
  const imported = parseImportedState(JSON.stringify(state));

  assert.equal(isValidState(imported), true);
  assert.equal(imported.activeProjectId, "project-demo");
  assert.throws(() => parseImportedState('{"version":1}'), /有效/);
});

test("关键词去重且最终完成全部智能体", () => {
  assert.deepEqual(extractKeywords("城市 城市 周末 路线"), ["城市", "周末", "路线"]);
  const project = createProject({ title: "A", brief: "B", audience: "C", mode: "race" });
  const complete = finishAllAgents(project);
  assert.equal(complete.status, "complete");
  assert.ok(complete.agents.every((agent) => agent.status === "done"));
});
