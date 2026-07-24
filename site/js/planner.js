export const MODES = {
  auto: { label: "Auto", description: "根据意图自动选择最少必要专家", agents: ["mike", "emma", "bob", "alex", "david"] },
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
  const appType = /计算器|算术|加减乘除/.test(text) ? "calculator" : /贪吃蛇|snake/i.test(text) ? "snake" : "generic";
  const travel = /旅行|路线|地图|周末|景点/.test(text);
  const reading = /阅读|读书|书籍/.test(text);
  const habit = /习惯|健康|运动|打卡/.test(text);
  const accent = travel ? "#ff6b46" : reading ? "#6a63ff" : habit ? "#33a36b" : "#246bfd";
  const features = travel
    ? [{ title: "慢一点出发", detail: "不早起，也不错过城市醒来的时刻。" }, { title: "只选三站", detail: "留出足够空白，让偶遇真的发生。" }, { title: "保存灵感", detail: "把喜欢的地方变成下一次出发。" }]
    : reading
      ? [{ title: "安静书架", detail: "集中保存想读、在读和读完的书。" }, { title: "轻量记录", detail: "用一句话留下此刻最重要的想法。" }, { title: "阅读节奏", detail: "看见进度，但不让数字制造压力。" }]
      : habit
        ? [{ title: "从小开始", detail: "把目标缩小到今天可以完成的一步。" }, { title: "及时反馈", detail: "完成后马上看见连续行动的积累。" }, { title: "温和提醒", detail: "在合适的时间提醒，不打断生活。" }]
        : [{ title: "清晰入口", detail: "最快一步进入今天最重要的任务。" }, { title: "即时状态", detail: "每次操作都有明确、可信的反馈。" }, { title: "持续积累", detail: "让零散记录逐渐形成有用的结果。" }];
  const result = {
    appType,
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
    features,
    capabilities: appType === "calculator" ? ["basic-operations", "decimal", "clear", "backspace", "history"] : appType === "snake" ? ["keyboard-controls", "score", "pause", "reset"] : [],
    sections: features.map((feature, index) => ({ id: `section-${index + 1}`, type: "cards", title: feature.title, description: feature.detail, items: [], metrics: [] }))
  };
  return result;
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
    { path: "src/app.config.json", type: "json", status: "modified" },
    { path: "src/data.js", type: "js", status: "added" },
    { path: "README.md", type: "md", status: "added" }
  ].map((file, index) => ({ ...file, lines: 26 + index * 17, accent: preview.accent }));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function safeJson(value, spaces = 2) {
  return JSON.stringify(value, null, spaces)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createCode(preview) {
  const interactive = preview.appType === "calculator"
    ? "      <Calculator onCalculate={saveHistory} />"
    : preview.appType === "snake"
      ? "      <SnakeGame keyboard controls score persistence />"
      : "";
  return `// Generated by Atoms Demo Agent Runtime
const ATOMS_PREVIEW_CONFIG = /* ATOMS_CONFIG_START */
${safeJson(preview)}
/* ATOMS_CONFIG_END */;

export default function App() {
  return (
    <main className="app" data-theme="${preview.themeId || "custom"}" data-heading="${preview.headingStyle || "editorial"}" style={{ "--accent": "${preview.accent}", background: "${preview.background || "#fffdf9"}" }}>
      <header className="hero">
        <span className="eyebrow">${preview.eyebrow}</span>
        <h1>${preview.title}</h1>
        <p>${preview.subtitle}</p>
      </header>
${interactive}
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

function createStylesSource(preview) {
  return `:root {
  --atoms-accent: ${preview.accent};
  --atoms-background: ${preview.background || "#fffdf9"};
  --atoms-text: #191b22;
  --atoms-muted: #646b78;
}

.app,
.app-shell {
  min-height: 100vh;
  color: var(--atoms-text);
  background: var(--atoms-background);
}

.hero,
.feature-card,
.section-card {
  border-color: color-mix(in srgb, var(--atoms-accent) 22%, transparent);
}

button,
.hero__action {
  background: var(--atoms-accent);
}
`;
}

function normalizeSourceFiles(preview, sourceFiles = [], code = createDynamicCode(preview)) {
  const required = [
    { path: "src/App.jsx", language: "jsx", content: code },
    { path: "src/styles.css", language: "css", content: createStylesSource(preview) },
    { path: "src/app.config.json", language: "json", content: `${safeJson({ schemaVersion: 2, preview })}\n` }
  ];
  const incoming = (Array.isArray(sourceFiles) ? sourceFiles : [])
    .filter((file) => file?.path && typeof file.content === "string" && !required.some((requiredFile) => requiredFile.path === file.path))
    .map((file) => ({ path: String(file.path).slice(0, 96), language: String(file.language || file.path.split(".").pop() || "text").slice(0, 24), content: file.content.slice(0, 24000) }));
  return [...required, ...incoming];
}

function snapshotWorkspace(workspace, revision = workspace.artifactRevision || 0, now = workspace.updatedAt || new Date().toISOString(), source = "workspace") {
  const preview = clone(workspace.preview);
  const code = workspace.code || createDynamicCode(preview);
  const files = clone(workspace.files || createFiles(preview));
  const sourceFiles = normalizeSourceFiles(preview, workspace.sourceFiles, code);
  return { revision: Math.max(0, Number(revision) || 0), source, createdAt: now, preview, code, files, sourceFiles };
}

function appendVersion(versions, snapshot) {
  const current = Array.isArray(versions) ? versions : [];
  const withoutSameRevision = current.filter((version) => version.revision !== snapshot.revision);
  return [...withoutSameRevision, snapshot].sort((a, b) => a.revision - b.revision).slice(-20);
}

function commitWorkspaceRevision(workspace, { preview, code, files, sourceFiles, now, source = "workspace", nextRevision } = {}) {
  const baseRevision = Math.max(0, Number(workspace.artifactRevision) || 0);
  const revision = Math.max(baseRevision + 1, Number(nextRevision) || baseRevision + 1);
  const nextPreview = preview || workspace.preview;
  const nextCode = code || createDynamicCode(nextPreview);
  const nextFiles = files || createFiles(nextPreview);
  const nextSourceFiles = normalizeSourceFiles(nextPreview, sourceFiles, nextCode);
  const existingVersions = Array.isArray(workspace.versions) ? workspace.versions : [];
  const versionsWithBase = existingVersions.some((version) => version.revision === baseRevision)
    ? existingVersions
    : appendVersion(existingVersions, snapshotWorkspace(workspace, baseRevision, workspace.updatedAt || now, "baseline"));
  const nextSnapshot = { revision, source, createdAt: now, preview: clone(nextPreview), code: nextCode, files: clone(nextFiles), sourceFiles: clone(nextSourceFiles) };
  const previousSnapshot = snapshotWorkspace(workspace, baseRevision, workspace.updatedAt || now, "previous");
  return {
    ...workspace,
    preview: nextPreview,
    code: nextCode,
    files: nextFiles,
    sourceFiles: nextSourceFiles,
    artifactRevision: revision,
    versions: appendVersion(versionsWithBase, nextSnapshot),
    lastKnownGood: previousSnapshot,
    updatedAt: now,
    published: false
  };
}

export function ensureWorkspaceSourceFiles(workspace, now = new Date().toISOString()) {
  const preview = workspace.preview || buildPreview(workspace.prompt || workspace.title || "新应用", workspace.title || "新应用");
  const existingCode = workspace.code || "";
  const code = existingCode.includes("ATOMS_CONFIG_START") && existingCode.includes("ATOMS_CONFIG_END")
    ? existingCode
    : createDynamicCode(preview);
  const files = workspace.files || createFiles(preview);
  const sourceFiles = normalizeSourceFiles(preview, workspace.sourceFiles, code);
  const revision = Math.max(0, Number(workspace.artifactRevision) || (workspace.hasBuiltArtifact ? 1 : 0));
  const normalizedWorkspace = { ...workspace, preview, code, files, sourceFiles, artifactRevision: revision };
  const versions = (Array.isArray(workspace.versions) ? workspace.versions : [])
    .map((version) => {
      const versionPreview = version.preview || preview;
      const versionCode = version.code?.includes("ATOMS_CONFIG_START") && version.code?.includes("ATOMS_CONFIG_END")
        ? version.code
        : createDynamicCode(versionPreview);
      const versionFiles = version.files || createFiles(versionPreview);
      return {
        revision: Math.max(0, Number(version.revision) || 0),
        createdAt: version.createdAt || now,
        source: version.source || "migration",
        preview: clone(versionPreview),
        sourceFiles: normalizeSourceFiles(versionPreview, version.sourceFiles, versionCode),
        code: versionCode,
        files: clone(versionFiles)
      };
    });
  const withCurrent = versions.some((version) => version.revision === revision)
    ? versions
    : appendVersion(versions, snapshotWorkspace(normalizedWorkspace, revision, workspace.updatedAt || now, "migration"));
  return { ...normalizedWorkspace, versions: withCurrent };
}

export function rollbackWorkspaceVersion(workspace, revision, now = new Date().toISOString()) {
  const targetRevision = Math.max(0, Number(revision) || 0);
  const target = (workspace.versions || []).find((version) => version.revision === targetRevision);
  if (!target) return workspace;
  return {
    ...commitWorkspaceRevision(workspace, {
      preview: clone(target.preview),
      code: target.code,
      files: clone(target.files),
      sourceFiles: clone(target.sourceFiles),
      now,
      source: `rollback:${targetRevision}`
    }),
    phase: "ready",
    hasBuiltArtifact: true,
    logs: [...(workspace.logs || []), { level: "success", text: `Rolled back to revision ${targetRevision}`, time: "now" }]
  };
}

export function createWorkspace(input, options = {}) {
  const now = options.now || new Date().toISOString();
  const prompt = String(input.prompt || "").trim();
  const title = String(input.title || inferTitle(prompt));
  const mode = MODES[input.mode] ? input.mode : "auto";
  const preview = buildPreview(prompt, title);
  const selectedAgents = MODES[mode].agents.map((key, index) => ({
    ...agentByKey(key),
    status: index === 0 ? "done" : "waiting",
    message: index === 0 ? "计划已整理，等待你的确认" : "等待接力"
  }));
  const code = createDynamicCode(preview);
  const files = createFiles(preview);
  const sourceFiles = normalizeSourceFiles(preview, [], code);
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
    hasBuiltArtifact: false,
    artifactRevision: 0,
    versions: [{ revision: 0, source: "initial", createdAt: now, preview: clone(preview), code, files: clone(files), sourceFiles: clone(sourceFiles) }],
    lastKnownGood: null,
    pendingChange: null,
    previewVerification: null,
    previewFeedback: [],
    intent: null,
    runtime: { status: "idle", phase: "idle", events: [], verification: null, replans: 0 },
    capabilities: input.capabilities || { teamMode: true, deepResearch: false, raceMode: false, attachments: [], connectors: [] },
    clarification: null,
    clarificationAnswer: null,
    quickStarts: ["Add user profiles", "Add progress tracking", "Add social sharing"],
    preview,
    code,
    plan: createPlan(prompt),
    agents: selectedAgents,
    files,
    sourceFiles,
    logs: [
      { level: "info", text: "Workspace initialized", time: "00:00" },
      { level: "success", text: "Mike generated an implementation plan", time: "00:01" }
    ],
    messages: [
      { id: uniqueId("msg"), role: "user", text: prompt, time: now },
      { id: uniqueId("msg"), role: "agent", agent: "alex", text: "I’m getting started. 我会先理解目标；只有方向会明显分叉时才向你澄清，然后生成可审批计划。", time: now }
    ]
  };
}

function runtimeLog(event) {
  const labels = {
    "run.started": "Runtime started",
    "phase.started": event.message,
    "intent.classified": `Intent: ${event.intent?.type} · ${event.intent?.domain}`,
    "clarification.required": event.message,
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
    published: false,
    runBaseRevision: workspace.artifactRevision || 0
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
  if (event.type === "clarification.required") phase = "clarification";
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
    clarification: event.clarification || workspace.clarification,
    runtimePlan: event.plan || workspace.runtimePlan,
    plan: event.plan ? event.plan.steps.map((step) => ({ title: `${agentByKey(step.agent)?.name || step.agent} · ${step.title}`, detail: step.goal, tool: step.tool })) : workspace.plan,
    agents,
    logs: [...workspace.logs, runtimeLog(event)].slice(-100),
    updatedAt: now
  };
}

function filesFromArtifact(artifact) {
  const paths = artifact.sourceFiles?.length ? artifact.sourceFiles.map((file) => file.path) : artifact.files;
  return paths.map((file, index) => ({
    path: file, type: file.split(".").pop() || "txt", status: index < 3 ? "modified" : "added", lines: 30 + index * 13, accent: artifact.preview.accent
  }));
}

export function applyRuntimeResult(workspace, event, model = "deepseek-v4-flash", now = new Date().toISOString()) {
  if (event.stage === "plan") {
    const updated = applyRuntimeEvent(workspace, event, now);
    if (event.status === "awaiting_clarification") {
      return {
        ...updated,
        phase: "clarification",
        modelSource: model,
        clarification: event.clarification || updated.clarification
      };
    }
    return {
      ...updated,
      title: event.plan?.title || updated.title,
      phase: "plan-review",
      modelSource: model,
      clarification: null,
      messages: [...updated.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: `${event.plan.summary} 我按意图只安排了必要专家；批准后开始执行。`, time: now, model }]
    };
  }
  const artifact = event.artifact;
  if (!artifact) return applyRuntimeEvent(workspace, event, now);
  const updated = applyRuntimeEvent(workspace, event, now);
  const expectedRevision = workspace.runBaseRevision ?? workspace.artifactRevision ?? 0;
  const failed = event.status === "failed_verification" || artifact.baseRevision !== expectedRevision;
  if (failed) {
    const issues = event.verification?.issues || (artifact.baseRevision !== expectedRevision ? ["产物基线已变更，本次结果已拒绝"] : ["Preview 验证未通过"]);
    return {
      ...updated,
      phase: "verification-failed",
      candidateArtifact: artifact,
      pendingChange: workspace.pendingChange,
      previewVerification: { status: "failed", passed: false, issues, revision: workspace.artifactRevision || 0, checkedAt: now, source: "agent-runtime" },
      messages: [...updated.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: `本次修改未通过验证，已保留上一个可用版本：${issues.join("；")}`, time: now, model }]
    };
  }
  const files = filesFromArtifact(artifact);
  const appSource = artifact.sourceFiles?.find((file) => file.path === "src/App.jsx")?.content;
  const committed = commitWorkspaceRevision(updated, {
    preview: artifact.preview,
    code: appSource || createDynamicCode(artifact.preview),
    files,
    sourceFiles: artifact.sourceFiles,
    now,
    source: "agent-runtime",
    nextRevision: artifact.nextRevision
  });
  return {
    ...committed,
    phase: "ready",
    decisions: artifact.decisions,
    hasBuiltArtifact: true,
    pendingChange: null,
    candidateArtifact: null,
    modelSource: model,
    agents: updated.agents.map((agent) => ({ ...agent, status: "done", message: "已完成并同步产物" })),
    messages: [...updated.messages, { id: uniqueId("msg"), role: "agent", agent: "mike", text: artifact.assistantMessage, time: now, model }]
  };
}

export function answerClarification(workspace, answer, now = new Date().toISOString()) {
  const text = String(answer || "").trim().slice(0, 240);
  if (workspace.phase !== "clarification" || !text) return workspace;
  return {
    ...workspace,
    phase: "planning",
    clarificationAnswer: text,
    clarification: null,
    updatedAt: now,
    messages: [...workspace.messages, { id: uniqueId("msg"), role: "user", text, time: now }]
  };
}

function createDynamicCode(preview) {
  const interactive = preview.appType === "calculator"
    ? "      <Calculator onCalculate={saveHistory} />"
    : preview.appType === "snake"
      ? "      <SnakeGame keyboard controls score persistence />"
      : "";
  const sections = (preview.sections || [])
    .map(
      (section) =>
        `        <Section type="${section.type}" title="${section.title}" description="${section.description || ""}" metrics={${JSON.stringify(section.metrics || [])}} items={${JSON.stringify(section.items || [])}} />`
    )
    .join("\n");
  return `// Generated by Atoms Demo Agent Runtime
const ATOMS_PREVIEW_CONFIG = /* ATOMS_CONFIG_START */
${safeJson(preview)}
/* ATOMS_CONFIG_END */;

export default function App() {
  return (
    <ProductShell data-theme="${preview.themeId || "custom"}" data-heading="${preview.headingStyle || "editorial"}" style={{ background: "${preview.background || "#fffdf9"}" }} accent="${preview.accent}" background="${preview.background || "#fffdf9"}" heading="${preview.headingStyle || "editorial"}" template="${preview.template || "landing"}">
      <Hero title="${preview.title}" subtitle="${preview.subtitle}" action="${preview.primaryAction || preview.button || "开始体验"}" />
${interactive}
${sections}
    </ProductShell>
  );
}`;
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
  if (activeIndex === -1) return { ...workspace, phase: "ready", hasBuiltArtifact: true, updatedAt: now };

  agents[activeIndex].status = "done";
  agents[activeIndex].message = "已完成并同步工作结果";
  const nextIndex = activeIndex + 1;
  if (nextIndex < agents.length) {
    agents[nextIndex].status = "active";
    agents[nextIndex].message = agents[nextIndex].action;
  }
  const finished = nextIndex >= agents.length;
  const actor = agents[activeIndex];
  const locallyUpdated = finished ? applyLocalArtifactChange(workspace, now) : workspace;
  return {
    ...locallyUpdated,
    agents,
    phase: finished ? "ready" : "building",
    hasBuiltArtifact: workspace.hasBuiltArtifact || finished,
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
  const code = preview.sections ? createDynamicCode(preview) : createCode(preview);
  return {
    ...commitWorkspaceRevision(workspace, { preview, code, now, source: "visual-edit" }),
    updatedAt: now,
    published: false,
    logs: [...workspace.logs, { level: "info", text: "Visual edit applied to preview", time: "now" }]
  };
}

export function applyModelPlan(workspace, modelResult, model = "deepseek-v4-flash", now = new Date().toISOString()) {
  const preview = { ...workspace.preview, ...modelResult.preview };
  const code = preview.sections ? createDynamicCode(preview) : createCode(preview);
  const committed = commitWorkspaceRevision(workspace, {
    preview,
    code,
    sourceFiles: modelResult.sourceFiles,
    now,
    source: model
  });
  return {
    ...committed,
    plan: modelResult.plan,
    modelSource: model,
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
    plan: createPlan(text),
    intent: null,
    runtimePlan: null,
    runtime: { status: "idle", phase: "idle", events: [], verification: null, replans: 0 },
    clarification: null,
    clarificationAnswer: null,
    pendingChange: { prompt: text, baseRevision: workspace.artifactRevision || 0, submittedAt: now },
    agents,
    updatedAt: now,
    messages: [
      ...workspace.messages,
      { id: uniqueId("msg"), role: "user", text, time: now },
      { id: uniqueId("msg"), role: "agent", agent: "mike", text: "收到。我已经生成这次变更的执行计划，请先确认范围。", time: now }
    ]
  };
}

function applyLocalArtifactChange(workspace, now) {
  const preview = { ...workspace.preview, capabilities: [...(workspace.preview.capabilities || [])], sections: [...(workspace.preview.sections || [])] };
  const prompt = workspace.pendingChange?.prompt || workspace.prompt;
  if (preview.appType === "calculator") {
    if (/百分比|percent|%/i.test(prompt) && !preview.capabilities.includes("percent")) preview.capabilities.push("percent");
    if (/正负号|正负|sign|±/i.test(prompt) && !preview.capabilities.includes("sign")) preview.capabilities.push("sign");
  }
  if (/暗色|深色|dark/i.test(prompt)) Object.assign(preview, { themeId: "midnight", background: "#10131a", accent: "#78a6ff" });
  if (/绿色|森林|green/i.test(prompt)) Object.assign(preview, { themeId: "forest", background: "#f3f8f2", accent: "#2f7d4a" });
  const changed = JSON.stringify(preview) !== JSON.stringify(workspace.preview) || !workspace.hasBuiltArtifact;
  return changed ? {
    ...commitWorkspaceRevision(workspace, { preview, code: createDynamicCode(preview), now, source: "local-fallback" }),
    pendingChange: null
  } : workspace;
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
  return createWorkspace(
    { title: "健身 app", prompt: "做一个健身 app", mode: "auto" },
    { id: "workspace-demo", now: "2026-07-18T08:00:00.000Z" }
  );
}
