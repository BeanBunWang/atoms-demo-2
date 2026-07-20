const AGENTS = new Set(["mike", "iris", "emma", "bob", "alex", "david", "sarah", "adrian"]);
const TOOLS = new Set(["research_context", "define_product", "design_system", "compose_app", "analyze_data", "prepare_growth", "create_storyboard", "validate_artifact"]);
const TEMPLATES = new Set(["dashboard", "tracker", "catalog", "planner", "community", "landing"]);
const SECTION_TYPES = new Set(["stats", "list", "cards", "timeline", "progress", "table"]);
const APP_TYPES = new Set(["generic", "calculator", "snake"]);
const CALCULATOR_CAPABILITIES = new Set(["basic-operations", "decimal", "clear", "backspace", "history", "percent", "sign"]);
const SNAKE_CAPABILITIES = new Set(["direction-controls", "keyboard", "start-pause", "reset", "collision", "score"]);
const PREVIEW_PATCH_KEYS = ["appType", "template", "title", "eyebrow", "subtitle", "accent", "background", "navItems", "primaryAction", "heroMetric", "headingStyle", "themeId", "capabilities"];

const clean = (value, fallback = "", max = 120) => {
  const scalar = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const text = scalar.replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, max);
};
const list = (value, max) => (Array.isArray(value) ? value : []).slice(0, max);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const slug = (value, fallback = "section") => clean(value, fallback, 40)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 28) || fallback;

const defaultAgentForTool = (tool) => ({
  research_context: "iris", define_product: "emma", design_system: "bob", compose_app: "alex",
  analyze_data: "david", prepare_growth: "sarah", create_storyboard: "alex", validate_artifact: "mike"
})[tool] || "mike";

export function normalizePlan(value, intent) {
  const raw = list(value?.steps, 6);
  const fallback = intent.type === "research"
    ? [
        ["iris", "研究问题与证据边界", "research_context"], ["emma", "形成机会与产品结论", "define_product"], ["mike", "核验结论是否回答问题", "validate_artifact"]
      ]
    : intent.type === "analyze_data"
      ? [["emma", "确定指标口径", "define_product"], ["david", "构建指标与洞察视图", "analyze_data"], ["alex", "实现可交互看板", "compose_app"], ["mike", "验证口径和交互", "validate_artifact"]]
      : [["emma", "锁定核心用户流程", "define_product"], ["bob", "设计信息与组件结构", "design_system"], ["alex", "实现可运行应用", "compose_app"], ["mike", "验证需求覆盖与稳定性", "validate_artifact"]];
  const steps = (raw.length >= 3 ? raw : fallback.map(([agent, title, tool], index) => ({ id: `step-${index + 1}`, agent, title, goal: title, tool }))).map((step, index) => {
    const tool = TOOLS.has(step?.tool) ? step.tool : index === (raw.length || fallback.length) - 1 ? "validate_artifact" : "define_product";
    const agent = AGENTS.has(step?.agent) ? step.agent : defaultAgentForTool(tool);
    return {
      id: clean(step?.id, `step-${index + 1}`, 20), agent,
      title: clean(step?.title, `执行步骤 ${index + 1}`, 36),
      goal: clean(step?.goal, "完成可验证交付并同步给下一位专家。", 140), tool,
      needsApproval: Boolean(step?.needsApproval)
    };
  });
  if (steps.at(-1)?.tool !== "validate_artifact") steps.push({ id: `step-${steps.length + 1}`, agent: "mike", title: "验证交付结果", goal: "检查需求覆盖、内容相关性和关键交互。", tool: "validate_artifact", needsApproval: false });
  else steps[steps.length - 1] = { ...steps.at(-1), agent: "mike" };
  return {
    title: clean(value?.title, `${intent.domain}项目`, 36),
    summary: clean(value?.summary, `围绕${intent.audience}完成${intent.goal}`, 180),
    decision: clean(value?.decision, `按 ${intent.type} 路由必要专家，避免无关角色加入。`, 160),
    steps: steps.slice(0, 7)
  };
}

export function executeTool(step, { intent, previousOutputs = [] }) {
  const shared = { domain: intent.domain, audience: intent.audience, features: intent.requestedFeatures, upstream: previousOutputs.map((output) => output.summary) };
  const outputs = {
    research_context: { summary: `已形成${intent.domain}问题假设与用户信号（模型上下文研究，非实时联网）`, hypotheses: intent.entities, caveat: "未连接实时网页数据源" },
    define_product: { summary: `已锁定${intent.audience}的核心流程与首版范围`, user: intent.audience, coreFlow: intent.requestedFeatures, acceptance: ["核心任务可完成", "关键状态有反馈"] },
    design_system: { summary: `已选择适合${intent.domain}的页面层级和组件系统`, structure: ["导航", "首要行动", "领域模块", "状态反馈"], complexity: intent.complexity },
    compose_app: { summary: `已把上游规格转换为${intent.domain}应用组件约束`, requiredModules: intent.requestedFeatures, quality: ["响应式", "空态", "可访问反馈"] },
    analyze_data: { summary: `已定义${intent.domain}的指标、状态和示例数据口径`, metrics: intent.entities.map((entity) => `${entity}状态`), guardrail: "示例数据需明确且自洽" },
    prepare_growth: { summary: `已形成面向${intent.audience}的可发现性与转化入口`, channels: ["搜索", "分享"], message: intent.goal },
    create_storyboard: { summary: `已将${intent.goal}拆成可预览的场景节奏`, scenes: intent.requestedFeatures },
    validate_artifact: { summary: "等待最终产物后执行结构与相关性验证" }
  };
  return { tool: step.tool, agent: step.agent, ...shared, ...(outputs[step.tool] || { summary: step.goal }) };
}

function normalizeItems(items, fallbackTitle) {
  const raw = list(items, 5);
  return (raw.length ? raw : [{ title: fallbackTitle, meta: "等待首条真实记录", value: "—", status: "待开始" }]).map((item, index) => ({
    title: clean(item?.title, `${fallbackTitle} ${index + 1}`, 40), meta: clean(item?.meta, "核心场景数据", 70),
    value: clean(item?.value, "—", 24), status: clean(item?.status, "进行中", 18)
  }));
}

function mergeLegacySections(previousSections, incomingSections) {
  return list(incomingSections, 5).map((section, index) => {
    const previous = previousSections.find((item) => section?.id && item.id === section.id)
      || previousSections.find((item) => section?.title && item.title === section.title)
      || previousSections[index]
      || {};
    return { ...previous, ...section, id: section?.id || previous.id };
  });
}

export function applyPreviewPatch(previousPreview, patch = {}) {
  const previous = clone(previousPreview);
  const source = patch?.set && typeof patch.set === "object" ? patch.set : patch;
  for (const key of PREVIEW_PATCH_KEYS) if (own(source, key)) previous[key] = clone(source[key]);

  if (Array.isArray(source.sections)) previous.sections = mergeLegacySections(previous.sections || [], source.sections);
  for (const operation of list(patch?.sectionOps, 8)) {
    const sections = Array.isArray(previous.sections) ? previous.sections : [];
    const index = sections.findIndex((section) => section.id === operation?.id);
    if (operation?.op === "remove" && index >= 0) sections.splice(index, 1);
    if (operation?.op === "update" && index >= 0) sections[index] = { ...sections[index], ...(operation.value || {}), id: sections[index].id };
    if (operation?.op === "add" && operation.value && typeof operation.value === "object") sections.push({ ...operation.value, id: operation.value.id || operation.id });
    previous.sections = sections;
  }
  return previous;
}

function changedPreviewPaths(previousPreview, nextPreview) {
  if (!previousPreview) return ["preview"];
  const paths = [];
  for (const key of PREVIEW_PATCH_KEYS) if (JSON.stringify(previousPreview[key]) !== JSON.stringify(nextPreview[key])) paths.push(`preview.${key}`);
  const previousSections = previousPreview.sections || [];
  const nextSections = nextPreview.sections || [];
  const ids = new Set([...previousSections.map((section) => section.id), ...nextSections.map((section) => section.id)]);
  for (const id of ids) {
    const before = previousSections.find((section) => section.id === id);
    const after = nextSections.find((section) => section.id === id);
    if (JSON.stringify(before) !== JSON.stringify(after)) paths.push(`preview.sections.${id || "unknown"}`);
  }
  return paths;
}

function detectAppType(raw, intent, previousPreview) {
  const topic = [intent.goal, intent.domain, ...intent.entities, ...intent.requestedFeatures].join(" ").toLowerCase();
  if (/计算器|算术|加减乘除|calculator/.test(topic)) return "calculator";
  if (/贪吃蛇|snake/.test(topic)) return "snake";
  if (APP_TYPES.has(previousPreview?.appType) && intent.type === "modify_app") return previousPreview.appType;
  if (APP_TYPES.has(raw?.appType)) return raw.appType;
  return "generic";
}

function detectCapabilities(raw, intent, previousPreview, appType) {
  const requested = [intent.goal, intent.domain, ...intent.requestedFeatures].join(" ").toLowerCase();
  const inherited = Array.isArray(previousPreview?.capabilities) && intent.type === "modify_app" ? previousPreview.capabilities : [];
  const supplied = Array.isArray(raw?.capabilities) ? raw.capabilities : [];
  if (appType === "calculator") {
    const capabilities = new Set(["basic-operations", "decimal", "clear", "backspace", "history", ...inherited, ...supplied]);
    if (/百分比|百分号|percent|%/.test(requested)) capabilities.add("percent");
    if (/正负号|正负|sign|±/.test(requested)) capabilities.add("sign");
    return [...capabilities].filter((item) => CALCULATOR_CAPABILITIES.has(item));
  }
  if (appType === "snake") return [...new Set([...SNAKE_CAPABILITIES, ...inherited, ...supplied])].filter((item) => SNAKE_CAPABILITIES.has(item));
  return list(supplied.length ? supplied : inherited, 10).map((item) => clean(item, "", 32)).filter(Boolean);
}

export function normalizeArtifact(value, intent, { previousPreview, baseRevision = 0 } = {}) {
  const updating = intent.type === "modify_app" && previousPreview;
  const candidate = updating ? applyPreviewPatch(previousPreview, value?.patch || value?.preview || {}) : value?.preview || {};
  const raw = candidate;
  const appType = detectAppType(raw, intent, previousPreview);
  const capabilities = detectCapabilities(raw, intent, previousPreview, appType);
  const accent = /^#[0-9a-f]{6}$/i.test(raw.accent || "") ? raw.accent : "#6558f5";
  const background = /^#[0-9a-f]{6}$/i.test(raw.background || "") ? raw.background : "#f7f5f1";
  const navItems = list(raw.navItems, 4).map((item) => clean(item, "", 10)).filter(Boolean);
  let sections = list(raw.sections, 5).map((section, index) => ({
    id: clean(section?.id, `${slug(section?.title || intent.entities[index] || intent.domain)}-${index + 1}`, 40),
    type: SECTION_TYPES.has(section?.type) ? section.type : index ? "list" : "stats",
    title: clean(section?.title, `${intent.domain}模块 ${index + 1}`, 40),
    description: clean(section?.description, `服务于${intent.audience}的核心工作。`, 100),
    items: normalizeItems(section?.items, intent.entities[index] || intent.domain),
    metrics: list(section?.metrics, 4).map((metric) => ({ label: clean(metric?.label, "指标", 24), value: clean(metric?.value, "—", 24), trend: clean(metric?.trend, "", 22) }))
  }));
  if (sections.length < 3) {
    sections = [
      { id: "status-1", type: "stats", title: "关键状态", description: `快速看清${intent.domain}当前进展。`, items: normalizeItems([], intent.domain), metrics: [{ label: "已完成", value: "0", trend: "从第一步开始" }] },
      { id: "actions-2", type: "list", title: "下一步行动", description: intent.goal, items: normalizeItems([], intent.requestedFeatures[0] || "核心任务"), metrics: [] },
      { id: "progress-3", type: "progress", title: "目标进度", description: `围绕${intent.audience}持续积累结果。`, items: normalizeItems([], intent.entities[0] || "阶段目标"), metrics: [] }
    ];
  }
  const preview = {
    appType,
    capabilities,
    template: TEMPLATES.has(raw.template) ? raw.template : intent.type === "analyze_data" ? "dashboard" : intent.type === "research" ? "catalog" : "tracker",
    title: clean(raw.title, `${intent.domain}助手`, 36), eyebrow: clean(raw.eyebrow, intent.domain, 40).toUpperCase(),
    subtitle: clean(raw.subtitle, intent.goal, 140), accent, background,
    navItems: navItems.length ? navItems : ["概览", "任务", "洞察"],
    primaryAction: clean(raw.primaryAction, intent.requestedFeatures[0] || "开始使用", 18),
    heroMetric: { value: clean(raw.heroMetric?.value, "01", 20), label: clean(raw.heroMetric?.label, "当前重点", 28), trend: clean(raw.heroMetric?.trend, "已准备", 30) },
    headingStyle: ["editorial", "studio"].includes(raw.headingStyle) ? raw.headingStyle : previousPreview?.headingStyle,
    themeId: clean(raw.themeId, previousPreview?.themeId || "", 24) || undefined,
    sections
  };
  return {
    assistantMessage: clean(value?.assistantMessage, `已根据“${intent.goal}”完成第一版，并通过运行验证。`, 220),
    preview,
    schemaVersion: 2,
    operation: updating ? "update" : "create",
    baseRevision: Math.max(0, Number(baseRevision) || 0),
    nextRevision: Math.max(0, Number(baseRevision) || 0) + 1,
    changedPaths: changedPreviewPaths(previousPreview, preview),
    decisions: list(value?.decisions, 4).map((item) => clean(item, "围绕核心任务控制首版范围。", 120)),
    files: (list(value?.files, 7).length ? list(value?.files, 7) : ["src/App.jsx", "src/components/Overview.jsx", "src/styles.css", "src/data.js", "README.md"]).map((item) => clean(item, "src/App.jsx", 70))
  };
}

export function createDeterministicArtifactUpdate(intent, { previousPreview, baseRevision = 0 } = {}) {
  if (!previousPreview) return normalizeArtifact({}, intent, { baseRevision });
  const capabilityUpdate = normalizeArtifact({ patch: { set: {} }, assistantMessage: `已稳定应用“${intent.goal}”所需的行为能力。` }, intent, { previousPreview, baseRevision });
  if (capabilityUpdate.changedPaths.length) return capabilityUpdate;

  const theme = /深色|暗色/.test(intent.goal)
    ? { background: "#17181c", accent: "#7c8cff", themeId: "midnight", headingStyle: "studio" }
    : /绿色|森林/.test(intent.goal)
      ? { background: "#f3f8f2", accent: "#2f7d52", themeId: "forest" }
      : null;
  const lastSection = previousPreview.sections?.at(-1);
  const featureValue = {
    type: "cards",
    title: clean(intent.requestedFeatures[0], clean(intent.goal, "新增功能", 32), 32),
    description: clean(intent.goal, "按本轮需求新增的可验证能力。", 100),
    items: [{ title: clean(intent.goal, "新增能力", 40), meta: "本轮增量修改", value: "已加入", status: "可验证" }]
  };
  const patch = theme
    ? { set: theme }
    : {
        sectionOps: [{
          op: previousPreview.sections?.length >= 5 ? "update" : "add",
          id: previousPreview.sections?.length >= 5 ? lastSection?.id : `change-${slug(intent.goal, "feature")}`,
          value: featureValue
        }]
      };
  return normalizeArtifact({ patch, assistantMessage: `已以确定性补丁应用“${intent.goal}”，未覆盖原有产物。` }, intent, { previousPreview, baseRevision });
}

export function validateArtifact(artifact, intent, { previousPreview, baseRevision } = {}) {
  const issues = [];
  const preview = artifact?.preview;
  if (!preview || !TEMPLATES.has(preview.template)) issues.push("缺少有效的页面模板");
  if (!APP_TYPES.has(preview?.appType)) issues.push("缺少有效的应用交互类型");
  if (!preview?.sections || preview.sections.length < 3) issues.push("页面模块不足 3 个");
  if (new Set(preview?.sections?.map((section) => section.id)).size !== preview?.sections?.length) issues.push("页面模块缺少稳定且唯一的 ID");
  if (new Set(preview?.sections?.map((section) => section.type)).size < 2) issues.push("页面结构过于单一");
  const serialized = JSON.stringify(preview || {}).toLowerCase();
  const visibleContent = JSON.stringify({ title: preview?.title, eyebrow: preview?.eyebrow, subtitle: preview?.subtitle, primaryAction: preview?.primaryAction, sections: preview?.sections }).toLowerCase();
  if (intent.domain === "计算器" && !/计算器|calculator/.test(visibleContent)) issues.push("计算器产物缺少领域文案锚点");
  if (intent.domain === "休闲游戏" && !/贪吃蛇|snake|游戏/.test(visibleContent)) issues.push("游戏产物缺少领域文案锚点");
  const relevantTerms = [intent.domain, ...intent.entities, ...intent.requestedFeatures].filter((term) => String(term).length >= 2);
  if (relevantTerms.length && !relevantTerms.some((term) => serialized.includes(String(term).toLowerCase()))) issues.push("页面内容与识别出的领域缺少直接关联");
  if (!artifact?.files?.length) issues.push("缺少实现文件清单");
  const requestedAppType = detectAppType({}, intent);
  if (requestedAppType !== "generic" && preview?.appType !== requestedAppType) issues.push(`应用交互类型应为 ${requestedAppType}`);
  const changedPaths = changedPreviewPaths(previousPreview, preview);
  if (intent.type === "modify_app" && previousPreview && changedPaths.length === 0) issues.push("增量修改没有产生任何可见或行为变化");
  if (intent.type === "modify_app" && previousPreview && !/改成|替换为|变成.*应用/.test(intent.goal) && preview?.appType !== previousPreview.appType) issues.push("增量修改意外改变了应用类型");
  if (baseRevision !== undefined && artifact.baseRevision !== baseRevision) issues.push("产物基线版本与当前工作区不一致");
  return { passed: issues.length === 0, issues, changedPaths, checks: ["schema", "topic-relevance", "layout-diversity", "behavior-contract", "incremental-scope", "revision", "deliverables"] };
}

export function createCodeArtifact(preview) {
  const interactive = preview.appType === "calculator"
    ? `      <Calculator capabilities={${JSON.stringify(preview.capabilities || [])}} onCalculate={saveHistory} />`
    : preview.appType === "snake"
      ? `      <SnakeGame capabilities={${JSON.stringify(preview.capabilities || [])}} />`
      : "";
  const sections = preview.sections.map((section) => `        <Section type="${section.type}" title="${section.title}" items={${JSON.stringify(section.items)}} />`).join("\n");
  return `// Generated by the Atoms Demo runtime\nexport default function App() {\n  return (\n    <AppShell theme={{ accent: "${preview.accent}", background: "${preview.background}" }}>\n      <Hero eyebrow="${preview.eyebrow}" title="${preview.title}" subtitle="${preview.subtitle}" action="${preview.primaryAction}" />\n${interactive}\n      <main>\n${sections}\n      </main>\n    </AppShell>\n  );\n}`;
}
