export const MODES = {
  build: { label: "Build", description: "Alex 主导，快速完成可运行版本", agents: ["mike", "emma", "alex", "david"] },
  team: { label: "Team", description: "产品、架构、工程和数据协作", agents: ["mike", "emma", "bob", "alex", "david"] },
  race: { label: "Race", description: "两条实现路线并行比较", agents: ["mike", "emma", "bob", "alex", "adrian", "david"] },
  research: { label: "Research", description: "Iris 与 Sarah 先完成调研", agents: ["mike", "iris", "sarah", "emma", "bob"] }
};

export const AGENTS = [
  { key: "mike", name: "Mike", role: "Team Leader", avatar: "./assets/agents/mike.webp", action: "组织需求并维护交付节奏" },
  { key: "emma", name: "Emma", role: "Product Manager", avatar: "./assets/agents/emma.webp", action: "梳理用户流程与验收标准" },
  { key: "bob", name: "Bob", role: "Architect", avatar: "./assets/agents/bob.webp", action: "设计应用结构与数据边界" },
  { key: "alex", name: "Alex", role: "Engineer", avatar: "./assets/agents/alex.webp", action: "编写组件、样式与交互" },
  { key: "david", name: "David", role: "Data Analyst", avatar: "./assets/agents/david.webp", action: "验证关键指标与数据状态" },
  { key: "iris", name: "Iris", role: "Deep Researcher", avatar: "./assets/agents/iris.webp", action: "研究目标用户与竞品模式" },
  { key: "sarah", name: "Sarah", role: "SEO Specialist", avatar: "./assets/agents/sarah.webp", action: "优化页面信息结构与可发现性" },
  { key: "adrian", name: "Adrian", role: "Ads Specialist", avatar: "./assets/agents/adrian.png", action: "比较增长落地方案" }
];

const agentByKey = (key) => AGENTS.find((agent) => agent.key === key);
const uniqueId = (prefix = "workspace") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function isComposerEmpty(value) {
  return String(value ?? "").trim().length === 0;
}

function inferTitle(prompt) {
  const cleaned = String(prompt)
    .replace(/^(请|帮我|我想|给我|做一个|创建一个|开发一个|构建一个)+/g, "")
    .replace(/[，。！？,.!?].*$/s, "")
    .trim();
  return (cleaned || "新应用").slice(0, 18);
}

function buildPreview(prompt, title) {
  const text = String(prompt);
  const travel = /旅行|路线|地图|周末|景点/.test(text);
  const reading = /阅读|读书|书籍/.test(text);
  const habit = /习惯|健康|运动|打卡/.test(text);
  const accent = travel ? "#ff6b46" : reading ? "#6a63ff" : habit ? "#33a36b" : "#246bfd";
  return {
    title: title || inferTitle(text),
    eyebrow: travel ? "MAKE SPACE FOR THE WEEKEND" : reading ? "A QUIET SPACE TO READ" : habit ? "SMALL STEPS, EVERY DAY" : "BUILT AROUND YOUR DAY",
    subtitle: travel
      ? "收藏灵感，生成一条真正松弛的周末路线。"
      : reading
        ? "把想读、在读和收获，放进一个安静的空间。"
        : habit
          ? "从一个微小动作开始，让改变每天发生。"
          : /收藏/.test(text)
            ? "把喜欢的内容加入收藏，随时回到重要的灵感。"
            : `为你的想法打造清晰、可操作的第一版体验。`,
    accent,
    cardTitle: travel ? "本周精选路线" : reading ? "继续阅读" : habit ? "今日微习惯" : "今天从这里开始",
    cardMeta: travel ? "3 个地点 · 4.2 km" : reading ? "《创造知识的方法》 · 38%" : habit ? "连续 7 天 · 还差 12 分钟" : "3 项待完成 · 预计 24 分钟",
    button: /收藏/.test(text) ? "加入收藏" : travel ? "生成我的路线" : reading ? "记录进度" : habit ? "完成打卡" : "开始体验",
    navItems: travel ? ["发现", "收藏"] : reading ? ["书架", "笔记"] : habit ? ["今日", "趋势"] : ["首页", "记录"],
    visualStart: travel ? "09:30" : reading ? "CH. 04" : habit ? "DAY 01" : "START",
    visualEnd: travel ? "16:40" : reading ? "38%" : habit ? "DAY 07" : "DONE",
    visualLabel: travel ? "3 stops" : reading ? "12 pages" : habit ? "7 day streak" : "in progress",
    features: travel
      ? [
          { title: "慢一点出发", detail: "不早起，也不错过城市醒来的时刻。" },
          { title: "只选三站", detail: "留出足够空白，让偶遇真的发生。" },
          { title: "保存灵感", detail: "把喜欢的地方变成下一次出发。" }
        ]
      : reading
        ? [
            { title: "安静书架", detail: "集中保存想读、在读和读完的书。" },
            { title: "轻量记录", detail: "用一句话留下此刻最重要的想法。" },
            { title: "阅读节奏", detail: "看见进度，但不让数字制造压力。" }
          ]
        : habit
          ? [
              { title: "从小开始", detail: "把目标缩小到今天可以完成的一步。" },
              { title: "及时反馈", detail: "完成后马上看见连续行动的积累。" },
              { title: "温和提醒", detail: "在合适的时间提醒，不打断生活。" }
            ]
          : [
              { title: "清晰入口", detail: "最快一步进入今天最重要的任务。" },
              { title: "即时状态", detail: "每次操作都有明确、可信的反馈。" },
              { title: "持续积累", detail: "让零散记录逐渐形成有用的结果。" }
            ]
  };
}

function createPlan(prompt) {
  const scope = String(prompt).slice(0, 72);
  return [
    { title: "明确产品目标", detail: `围绕“${scope}”确认首要用户和单一核心任务。` },
    { title: "搭建应用结构", detail: "建立首页、核心操作卡片、结果反馈与本地状态边界。" },
    { title: "实现关键交互", detail: "完成响应式界面、空态、输入校验、状态保存和可访问反馈。" },
    { title: "验证并交付", detail: "运行静态检查与主流程回归，生成可预览的发布版本。" }
  ];
}

function createFiles(preview) {
  return [
    { path: "src/App.jsx", type: "jsx", status: "modified" },
    { path: "src/styles.css", type: "css", status: "modified" },
    { path: "src/data.js", type: "js", status: "added" },
    { path: "package.json", type: "json", status: "clean" },
    { path: "README.md", type: "md", status: "added" }
  ].map((file, index) => ({ ...file, lines: 26 + index * 17, accent: preview.accent }));
}

function createCode(preview) {
  return `export default function App() {
  return (
    <main className="app">
      <header className="hero">
        <span className="eyebrow">${preview.eyebrow}</span>
        <h1>${preview.title}</h1>
        <p>${preview.subtitle}</p>
      </header>
      <section className="feature-card">
        <h2>${preview.cardTitle}</h2>
        <p>${preview.cardMeta}</p>
        <button>${preview.button}</button>
      </section>
      <section className="features">
        ${preview.features.map((feature) => `<article><h3>${feature.title}</h3><p>${feature.detail}</p></article>`).join("\n        ")}
      </section>
    </main>
  );
}`;
}

export function createWorkspace(input, options = {}) {
  const now = options.now || new Date().toISOString();
  const prompt = String(input.prompt || "").trim();
  const title = String(input.title || inferTitle(prompt));
  const mode = MODES[input.mode] ? input.mode : "team";
  const preview = buildPreview(prompt, title);
  const selectedAgents = MODES[mode].agents.map((key, index) => ({
    ...agentByKey(key),
    status: index === 0 ? "done" : "waiting",
    message: index === 0 ? "计划已整理，等待你的确认" : "等待接力"
  }));
  return {
    id: options.id || uniqueId(),
    title,
    prompt,
    mode,
    phase: "plan-review",
    createdAt: now,
    updatedAt: now,
    published: false,
    publishedAt: null,
    modelSource: "local-fallback",
    intent: null,
    runtime: { status: "idle", phase: "idle", events: [], verification: null, replans: 0 },
    capabilities: input.capabilities || { teamMode: mode === "team", deepResearch: mode === "research", raceMode: mode === "race", attachments: [], connectors: [] },
    preview,
    code: createCode(preview),
    plan: createPlan(prompt),
    agents: selectedAgents,
    files: createFiles(preview),
    logs: [
      { level: "info", text: "Workspace initialized", time: "00:00" },
      { level: "success", text: "Mike generated an implementation plan", time: "00:01" }
    ],
    messages: [
      { id: uniqueId("msg"), role: "user", text: prompt, time: now },
      { id: uniqueId("msg"), role: "agent", agent: "mike", text: "我会先识别任务意图和约束，再安排必要专家生成可审批的执行计划。", time: now }
    ]
  };
}

function runtimeLog(event) {
  const labels = {
    "run.started": "Runtime started",
    "phase.started": event.message,
    "intent.classified": `Intent: ${event.intent?.type} · ${event.intent?.domain}`,
    "plan.created": event.message,
    "approval.required": "Approval gate reached",
    "agent.started": `${event.agent} started: ${event.message}`,
    "tool.called": `tool:${event.tool} · ${event.message}`,
    "tool.completed": `tool:${event.tool} · ${event.message}`,
    "artifact.generating": event.message,
    "artifact.created": event.message,
    "verification.started": event.message,
    "verification.completed": event.message,
    "replan.created": event.message,
    "runtime.fallback": event.message,
    "run.completed": `Runtime completed: ${event.status}`,
    "run.failed": event.message
  };
  return { level: event.type === "run.failed" ? "error" : event.type.includes("completed") ? "success" : "info", text: labels[event.type] || event.message || event.type, time: "now", eventType: event.type };
}

function agentsFromPlan(plan, activeAgent = null, completedAgents = []) {
  const keys = ["mike", ...plan.steps.map((step) => step.agent)].filter((key, index, all) => all.indexOf(key) === index);
  return keys.map((key) => {
    const agent = agentByKey(key);
    const done = completedAgents.includes(key);
    return { ...agent, status: done ? "done" : key === activeAgent ? "active" : "waiting", message: done ? "已完成并同步产物" : key === activeAgent ? agent.action : "等待依赖" };
  });
}

export function beginAgentRun(workspace, stage, now = new Date().toISOString()) {
  return {
    ...workspace,
    phase: stage === "build" ? "building" : "planning",
    runtime: { ...(workspace.runtime || {}), status: "running", phase: stage === "build" ? "execution" : "intent", events: [], verification: null },
    updatedAt: now,
    published: false
  };
}

export function applyRuntimeEvent(workspace, event, now = new Date().toISOString()) {
  const runtime = workspace.runtime || { events: [] };
  const events = [...(runtime.events || []), event].slice(-80);
  const completedAgents = new Set(workspace.agents.filter((agent) => agent.status === "done").map((agent) => agent.key));
  if (event.type === "tool.completed" && event.agent) completedAgents.add(event.agent);
  const plan = event.plan || workspace.runtimePlan;
  const agents = plan ? agentsFromPlan(plan, event.type === "agent.started" ? event.agent : null, [...completedAgents]) : workspace.agents;
  let phase = workspace.phase;
  if (event.type === "approval.required") phase = "plan-review";
  if (event.type === "run.failed") phase = workspace.intent ? "plan-review" : "draft";
  return {
    ...workspace,
    phase,
    runtime: {
      ...runtime,
      status: event.type === "run.failed" ? "failed" : event.type === "run.completed" ? event.status : "running",
      phase: event.phase || runtime.phase,
      events,
      verification: event.verification || runtime.verification,
      replans: (runtime.replans || 0) + (event.type === "replan.created" ? 1 : 0)
    },
    intent: event.intent || workspace.intent,
    runtimePlan: event.plan || workspace.runtimePlan,
    plan: event.plan ? event.plan.steps.map((step) => ({ title: `${agentByKey(step.agent)?.name || step.agent} · ${step.title}`, detail: step.goal, tool: step.tool })) : workspace.plan,
    agents,
    logs: [...workspace.logs, runtimeLog(event)].slice(-100),
    updatedAt: now
  };
}

function filesFromArtifact(artifact) {
  return artifact.files.map((file, index) => ({
    path: file, type: file.split(".").pop() || "txt", status: index < 3 ? "modified" : "added", lines: 30 + index * 13, accent: artifact.preview.accent
  }));
}

export function applyRuntimeResult(workspace, event, model = "deepseek-v4-flash", now = new Date().toISOString()) {
  if (event.stage === "plan") {
    const updated = applyRuntimeEvent(workspace, event, now);
    return {
      ...updated,
      title: event.plan?.title || updated.title,
      phase: "plan-review",
      modelSource: model,
      messages: [...updated.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: `${event.plan.summary} 我按意图只安排了必要专家；批准后开始执行。`, time: now, model }]
    };
  }
  const artifact = event.artifact;
  if (!artifact) return applyRuntimeEvent(workspace, event, now);
  const updated = applyRuntimeEvent(workspace, event, now);
  return {
    ...updated,
    phase: "ready",
    preview: artifact.preview,
    code: createDynamicCode(artifact.preview),
    files: filesFromArtifact(artifact),
    decisions: artifact.decisions,
    modelSource: model,
    agents: updated.agents.map((agent) => ({ ...agent, status: "done", message: "已完成并同步产物" })),
    messages: [...updated.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: artifact.assistantMessage, time: now, model }]
  };
}

function createDynamicCode(preview) {
  const sections = preview.sections.map((section) => `        <Section type="${section.type}" title="${section.title}" items={${JSON.stringify(section.items)}} />`).join("\n");
  return `// Generated by Atoms Demo Agent Runtime\nexport default function App() {\n  return (\n    <ProductShell accent="${preview.accent}" template="${preview.template}">\n      <Hero title="${preview.title}" subtitle="${preview.subtitle}" action="${preview.primaryAction}" />\n${sections}\n    </ProductShell>\n  );\n}`;
}

export function approvePlan(workspace, now = new Date().toISOString()) {
  if (workspace.phase !== "plan-review") return workspace;
  const agents = workspace.agents.map((agent, index) => ({
    ...agent,
    status: index === 0 ? "done" : index === 1 ? "active" : "waiting",
    message: index === 0 ? "计划已批准，正在协调团队" : index === 1 ? agent.action : "等待接力"
  }));
  return {
    ...workspace,
    phase: "building",
    agents,
    updatedAt: now,
    logs: [...workspace.logs, { level: "info", text: "Plan approved — build started", time: "00:02" }],
    messages: [...workspace.messages, { id: uniqueId("msg"), role: "system", text: "计划已批准，智能体团队开始构建。", time: now }]
  };
}

export function nextBuildStep(workspace, now = new Date().toISOString()) {
  if (workspace.phase !== "building") return workspace;
  const agents = workspace.agents.map((agent) => ({ ...agent }));
  const activeIndex = agents.findIndex((agent) => agent.status === "active");
  if (activeIndex === -1) return { ...workspace, phase: "ready", updatedAt: now };

  agents[activeIndex].status = "done";
  agents[activeIndex].message = "已完成并同步工作结果";
  const nextIndex = activeIndex + 1;
  if (nextIndex < agents.length) {
    agents[nextIndex].status = "active";
    agents[nextIndex].message = agents[nextIndex].action;
  }
  const finished = nextIndex >= agents.length;
  const actor = agents[activeIndex];
  return {
    ...workspace,
    agents,
    phase: finished ? "ready" : "building",
    updatedAt: now,
    logs: [
      ...workspace.logs,
      { level: "success", text: `${actor.name} completed: ${actor.action}`, time: `00:0${Math.min(activeIndex + 3, 9)}` },
      ...(finished ? [{ level: "success", text: "Build finished — preview is ready", time: "00:09" }] : [])
    ],
    messages: finished
      ? [...workspace.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: "第一版已经构建完成。你可以预览、切换设备，或打开 Design 直接修改页面。", time: now }]
      : workspace.messages
  };
}

export function buildProgress(workspace) {
  if (!workspace?.agents?.length) return 0;
  return Math.round((workspace.agents.filter((agent) => agent.status === "done").length / workspace.agents.length) * 100);
}

export function updatePreview(workspace, patch, now = new Date().toISOString()) {
  const preview = { ...workspace.preview, ...patch };
  return {
    ...workspace,
    preview,
    code: preview.sections ? createDynamicCode(preview) : createCode(preview),
    updatedAt: now,
    published: false,
    logs: [...workspace.logs, { level: "info", text: "Visual edit applied to preview", time: "now" }]
  };
}

export function applyModelPlan(workspace, modelResult, model = "deepseek-v4-flash", now = new Date().toISOString()) {
  const preview = { ...workspace.preview, ...modelResult.preview };
  return {
    ...workspace,
    plan: modelResult.plan,
    preview,
    code: createCode(preview),
    modelSource: model,
    updatedAt: now,
    messages: [
      ...workspace.messages,
      {
        id: uniqueId("msg"),
        role: "agent",
        agent: "mike",
        text: modelResult.assistantMessage,
        time: now,
        model
      }
    ],
    logs: [...workspace.logs, { level: "success", text: `${model} generated the product plan`, time: "now" }]
  };
}

export function submitPrompt(workspace, prompt, now = new Date().toISOString()) {
  if (isComposerEmpty(prompt)) return workspace;
  const text = String(prompt).trim();
  const preview = buildPreview(text, workspace.preview.title);
  const updatedPreview = { ...workspace.preview, subtitle: preview.subtitle, button: preview.button };
  const agents = workspace.agents.map((agent, index) => ({
    ...agent,
    status: index === 0 ? "done" : "waiting",
    message: index === 0 ? "变更计划已整理，等待确认" : "等待接力"
  }));
  return {
    ...workspace,
    prompt: text,
    phase: "plan-review",
    published: false,
    preview: updatedPreview,
    code: createCode(updatedPreview),
    plan: createPlan(text),
    agents,
    updatedAt: now,
    messages: [
      ...workspace.messages,
      { id: uniqueId("msg"), role: "user", text, time: now },
      { id: uniqueId("msg"), role: "agent", agent: "mike", text: "收到。我已经生成这次变更的执行计划，请先确认范围。", time: now }
    ]
  };
}

export function changeMode(workspace, mode, now = new Date().toISOString()) {
  if (!MODES[mode] || workspace.phase === "building") return workspace;
  const agents = MODES[mode].agents.map((key, index) => ({
    ...agentByKey(key),
    status: index === 0 ? "done" : "waiting",
    message: index === 0 ? "计划已整理，等待你的确认" : "等待接力"
  }));
  return {
    ...workspace,
    mode,
    agents,
    phase: "plan-review",
    published: false,
    intent: null,
    runtimePlan: null,
    capabilities: { ...(workspace.capabilities || {}), teamMode: mode === "team", deepResearch: mode === "research", raceMode: mode === "race" },
    runtime: { status: "idle", phase: "idle", events: [], verification: null, replans: 0 },
    updatedAt: now
  };
}

export function publishWorkspace(workspace, now = new Date().toISOString()) {
  if (workspace.phase !== "ready") return workspace;
  return {
    ...workspace,
    published: true,
    publishedAt: now,
    updatedAt: now,
    logs: [...workspace.logs, { level: "success", text: "Demo published to a simulated preview URL", time: "now" }]
  };
}

export function createDemoWorkspace() {
  let workspace = createWorkspace(
    {
      title: "周末漫游",
      prompt: "做一个周末城市漫游应用，让用户收藏灵感地点并生成一条松弛、好拍照的路线",
      mode: "team"
    },
    { id: "workspace-demo", now: "2026-07-18T08:00:00.000Z" }
  );
  workspace = approvePlan(workspace, "2026-07-18T08:00:02.000Z");
  while (workspace.phase === "building") workspace = nextBuildStep(workspace, "2026-07-18T08:00:09.000Z");
  return workspace;
}
