export const MODES = {
  team: {
    label: "团队模式",
    shortLabel: "团队",
    description: "完整协作，适合从 0 到 1",
    accent: "lime",
    agents: ["lead", "product", "research", "architecture", "engineer", "growth"]
  },
  engineer: {
    label: "工程师模式",
    shortLabel: "工程师",
    description: "快速落地，聚焦技术实现",
    accent: "coral",
    agents: ["lead", "architecture", "engineer"]
  },
  race: {
    label: "赛马模式",
    shortLabel: "赛马",
    description: "并行比较两条实现路线",
    accent: "violet",
    agents: ["lead", "product", "racerA", "racerB", "architecture"]
  },
  research: {
    label: "深度研究",
    shortLabel: "研究",
    description: "先验证问题，再决定方向",
    accent: "blue",
    agents: ["lead", "research", "product", "architecture"]
  }
};

const AGENTS = {
  lead: { name: "Mike", role: "团队负责人", glyph: "M", tone: "lime" },
  product: { name: "Emma", role: "产品经理", glyph: "E", tone: "coral" },
  research: { name: "Iris", role: "研究员", glyph: "I", tone: "violet" },
  architecture: { name: "Bob", role: "架构师", glyph: "B", tone: "blue" },
  engineer: { name: "Alex", role: "工程师", glyph: "A", tone: "amber" },
  growth: { name: "Sarah", role: "增长顾问", glyph: "S", tone: "pink" },
  racerA: { name: "Nova", role: "路线 A 工程师", glyph: "N", tone: "coral" },
  racerB: { name: "Echo", role: "路线 B 工程师", glyph: "E", tone: "blue" }
};

const TASK_BLUEPRINTS = [
  ["梳理首屏价值主张", "Emma", "待开始"],
  ["完成核心流程原型", "Alex", "进行中"],
  ["验证本地数据持久化", "Bob", "待开始"],
  ["补齐空状态与错误反馈", "Alex", "待开始"],
  ["完成移动端可用性检查", "Emma", "待开始"],
  ["整理发布说明与演示脚本", "Sarah", "待开始"]
];

export function makeId(prefix = "item") {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function normalizeBrief(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function extractKeywords(brief = "") {
  const clean = normalizeBrief(brief)
    .replace(/[，。！？、；：,.!?;:()（）]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  return [...new Set(clean)].slice(0, 5);
}

function shortBrief(brief) {
  const clean = normalizeBrief(brief);
  if (!clean) return "把模糊想法整理成清晰、可验证的产品";
  return clean.length > 76 ? `${clean.slice(0, 76)}…` : clean;
}

function createDeliverable(agentKey, context) {
  const { title, brief, audience, mode } = context;
  const keywords = extractKeywords(brief);
  const keywordText = keywords.length ? keywords.join("、") : "清晰、可用、可验证";
  const common = { title, audience, brief: shortBrief(brief), keywords: keywordText };

  const deliverables = {
    lead: {
      title: "任务简报",
      summary: `已把「${title}」拆成一条可以逐步验证的交付链。`,
      sections: [
        ["北极星", `让${audience}能够更顺畅地完成：${common.brief}`],
        ["本轮边界", "先保证完整主流程可用，再扩展自动化与分享能力。"],
        ["协作原则", "每个智能体只交付一个可检查结果，避免用篇幅代替进展。"]
      ]
    },
    product: {
      title: "产品定义",
      summary: `核心体验围绕「${keywordText}」建立，先解决一个高频、明确的问题。`,
      sections: [
        ["目标用户", audience],
        ["核心任务", common.brief],
        ["成功信号", "用户能在首次使用中完成主流程，并愿意保存或分享结果。"]
      ]
    },
    research: {
      title: "验证清单",
      summary: "把高风险假设提前，先验证需求与可理解性，再投入复杂实现。",
      sections: [
        ["关键假设", `${audience}确实需要更低摩擦的方式处理「${keywords[0] || "当前任务"}」。`],
        ["最小验证", "邀请 3 位目标用户完成一次主流程，记录停顿、误解和放弃点。"],
        ["风险提示", "不要用更多功能掩盖价值不清；隐私、空状态和数据恢复需要可见。"]
      ]
    },
    architecture: {
      title: "系统蓝图",
      summary: "采用浏览器优先的轻量架构，让 Demo 零配置运行并可渐进增强。",
      sections: [
        ["体验层", "响应式单页工作台：项目、协作记录、任务和发布中心。"],
        ["领域层", "纯函数生成规划结果；事件驱动地推进智能体与任务状态。"],
        ["数据层", "localStorage 自动保存 + JSON 导入导出；可替换为云端数据库。"]
      ]
    },
    engineer: {
      title: "工程计划",
      summary: "先锁定可用主流程，再完善响应式、离线和可访问性。",
      sections: [
        ["切片 01", "完成创建项目、模式选择与可恢复的运行状态。"],
        ["切片 02", "打通交付物和任务板，确保每次操作都即时反馈。"],
        ["切片 03", "完成 PWA、导入导出、键盘操作与部署验证。"]
      ]
    },
    growth: {
      title: "发布策略",
      summary: "用一个清晰的真实场景展示价值，而不是罗列功能。",
      sections: [
        ["演示钩子", `从“${shortBrief(brief).slice(0, 38)}”开始，现场展示团队如何接力。`],
        ["可信证据", "刷新页面保留进度、移动端可用、源码和在线链接公开。"],
        ["下一步", "收集首轮体验反馈，用完成率和交付耗时决定迭代优先级。"]
      ]
    },
    racerA: {
      title: "路线 A · 轻量验证",
      summary: "用无后端的可交互原型最快验证价值，部署与维护成本最低。",
      sections: [
        ["方案", "原生 Web + 浏览器持久化 + 静态托管。"],
        ["优势", "发布快、零密钥、公开评审稳定。"],
        ["代价", "暂不支持跨设备同步与多人协作。"]
      ]
    },
    racerB: {
      title: "路线 B · 云端协作",
      summary: "加入认证与在线数据库，为多人和跨设备场景预留空间。",
      sections: [
        ["方案", "响应式前端 + Supabase 认证与数据表。"],
        ["优势", "支持共享、实时同步和后续服务端能力。"],
        ["代价", "首次配置和错误面更大，不适合最短验证周期。"]
      ]
    }
  };

  const result = deliverables[agentKey] || deliverables.lead;
  if (mode === "race" && agentKey === "architecture") {
    result.summary = "结论：先采用路线 A 验证核心价值，在出现跨设备需求后再迁移路线 B。";
  }
  return result;
}

export function createProject(input, options = {}) {
  const title = normalizeBrief(input.title) || "未命名项目";
  const brief = normalizeBrief(input.brief);
  const audience = normalizeBrief(input.audience) || "希望更高效完成任务的用户";
  const mode = MODES[input.mode] ? input.mode : "team";
  const id = options.id || makeId("project");
  const now = options.now || new Date().toISOString();
  const context = { title, brief, audience, mode };
  const agents = MODES[mode].agents.map((key, index) => ({
    id: makeId("agent"),
    key,
    ...AGENTS[key],
    status: index === 0 ? "active" : "waiting",
    message: index === 0 ? "正在拆解任务与协作边界…" : "等待上游信息",
    deliverable: createDeliverable(key, context)
  }));

  const tasks = TASK_BLUEPRINTS.map(([taskTitle, owner, status], index) => ({
    id: makeId("task"),
    title: index === 0 ? `明确「${title}」的首屏承诺` : taskTitle,
    owner,
    status,
    priority: index < 2 ? "P0" : index < 4 ? "P1" : "P2"
  }));

  return {
    id,
    title,
    brief,
    audience,
    mode,
    createdAt: now,
    updatedAt: now,
    status: "running",
    paused: false,
    agents,
    tasks
  };
}

export function advanceProject(project, now = new Date().toISOString()) {
  if (!project || project.paused || project.status === "complete") return project;
  const agents = project.agents.map((agent) => ({ ...agent }));
  const activeIndex = agents.findIndex((agent) => agent.status === "active");

  if (activeIndex === -1) {
    return { ...project, agents, status: "complete", updatedAt: now };
  }

  agents[activeIndex].status = "done";
  agents[activeIndex].message = "交付完成，已同步给下一位队友";

  const nextIndex = activeIndex + 1;
  if (nextIndex < agents.length) {
    agents[nextIndex].status = "active";
    agents[nextIndex].message = "正在吸收上下文并形成交付物…";
  }

  return {
    ...project,
    agents,
    status: nextIndex < agents.length ? "running" : "complete",
    updatedAt: now
  };
}

export function restartProject(project, brief, mode = project.mode) {
  const refreshed = createProject(
    { title: project.title, audience: project.audience, brief, mode },
    { id: project.id, now: new Date().toISOString() }
  );
  return { ...refreshed, createdAt: project.createdAt };
}

export function projectProgress(project) {
  if (!project?.tasks?.length) return 0;
  const completed = project.tasks.filter((task) => task.status === "已完成").length;
  return Math.round((completed / project.tasks.length) * 100);
}

export function cycleTaskStatus(status) {
  const order = ["待开始", "进行中", "已完成"];
  const index = order.indexOf(status);
  return order[(index + 1) % order.length];
}

export function finishAllAgents(project) {
  return {
    ...project,
    status: "complete",
    paused: false,
    agents: project.agents.map((agent) => ({ ...agent, status: "done", message: "交付完成，已同步到项目空间" })),
    updatedAt: new Date().toISOString()
  };
}

export function createDemoProject() {
  const project = createProject(
    {
      title: "周末漫游地图",
      brief: "为工作繁忙的城市青年生成一条松弛、好拍照、不过度赶路的周末路线，并能保存自己的行程进度。",
      audience: "想轻松安排短途出行的上班族",
      mode: "team"
    },
    { id: "project-demo", now: "2026-07-18T08:00:00.000Z" }
  );
  const complete = finishAllAgents(project);
  complete.tasks = complete.tasks.map((task, index) => ({
    ...task,
    status: index < 2 ? "已完成" : index < 4 ? "进行中" : "待开始"
  }));
  return complete;
}
