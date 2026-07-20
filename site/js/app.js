import {
  AGENTS,
  answerClarification,
  applyModelPlan,
  applyRuntimeEvent,
  applyRuntimeResult,
  approvePlan,
  beginAgentRun,
  buildProgress,
  createWorkspace,
  isComposerEmpty,
  nextBuildStep,
  publishWorkspace,
  submitPrompt,
  updatePreview
} from "./planner.js?v=13";
import { loadState, saveState } from "./storage.js?v=13";
import {
  COMPONENT_LIBRARY,
  THEME_PRESETS,
  createLibrarySection,
  initialPreviewInteraction,
  normalizeDesignTab,
  normalizePreviewInteraction,
  themePatch
} from "./viewer.js?v=13";
import { CALCULATOR_KEYS, reduceCalculator, reduceSnake } from "./interactive.js?v=13";
import { buildPreviewFixPrompt, recordPreviewVerification } from "./preview-loop.js?v=13";

let state = loadState();
const previewOnlyWorkspaceId = new URLSearchParams(location.search).get("preview");
if (previewOnlyWorkspaceId && state.workspaces.some((workspace) => workspace.id === previewOnlyWorkspaceId)) {
  state.activeWorkspaceId = previewOnlyWorkspaceId;
  document.body.classList.add("standalone-preview");
}
let buildTimer = null;
let snakeTimer = null;
let toastTimer = null;
let planningActive = false;
let modelCapability = { realModel: false, model: "local-fallback", checked: false };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  sidebar: $("#sidebar"),
  sidebarScrim: $("#sidebar-scrim"),
  projectList: $("#project-list"),
  workspaceTitle: $("#workspace-title"),
  workspaceStatus: $("#workspace-status"),
  agentStack: $("#agent-stack"),
  messageStream: $("#message-stream"),
  promptInput: $("#prompt-input"),
  sendButton: $("#send-button"),
  modeLabel: $("#mode-label"),
  modelLabel: $("#model-label"),
  modelStatus: $("#model-status"),
  appFrame: $("#app-frame"),
  generatedApp: $("#generated-app"),
  previewBrand: $("#preview-brand"),
  previewLogo: $("#preview-logo"),
  previewEyebrow: $("#preview-eyebrow"),
  previewNavPrimary: $("#preview-nav-primary"),
  previewNavSecondary: $("#preview-nav-secondary"),
  previewTitle: $("#preview-title"),
  previewSubtitle: $("#preview-subtitle"),
  previewPrimaryAction: $("#preview-primary-action"),
  previewMetricValue: $("#preview-metric-value"),
  previewMetricLabel: $("#preview-metric-label"),
  previewMetricTrend: $("#preview-metric-trend"),
  previewSections: $("#preview-sections"),
  previewAvatar: $("#preview-avatar"),
  previewProfileMenu: $("#preview-profile-menu"),
  designPreview: $("#design-preview"),
  codeView: $("#code-view"),
  codeContent: $("#code-content"),
  currentComponents: $("#current-components"),
  componentLibrary: $("#component-library"),
  themePresets: $("#theme-presets"),
  agentProgress: $("#agent-progress"),
  terminal: $("#terminal"),
  fileTree: $("#file-tree"),
  fileCount: $("#file-count"),
  buildProgress: $("#build-progress"),
  runtimeStatus: $("#runtime-status"),
  designButton: $("#design-button"),
  designHint: $("#design-hint"),
  publishButton: $("#publish-button"),
  activityPanel: $("#activity-panel"),
  conversationPanel: $("#conversation-panel"),
  mobileViewToggle: $("#mobile-view-toggle"),
  newProjectDialog: $("#new-project-dialog"),
  newProjectForm: $("#new-project-form"),
  designDialog: $("#design-dialog"),
  designForm: $("#design-form"),
  publishDialog: $("#publish-dialog"),
  publishDialogTitle: $("#publish-dialog-title"),
  publishSummary: $("#publish-summary"),
  confirmPublishButton: $("#confirm-publish-button"),
  toast: $("#toast")
};
elements.previewHealth = $("#preview-health");
elements.previewHealthLabel = $("#preview-health-label");
elements.fixPreviewButton = $("#fix-preview-button");
elements.capabilityMenu = $("#capability-menu");
elements.attachmentInput = $("#attachment-input");
elements.attachmentSummary = $("#attachment-summary");
elements.connectorSummary = $("#connector-summary");

function activeWorkspace() {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || state.workspaces[0];
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persist() {
  saveState(state);
}

function replaceWorkspace(workspace) {
  state.workspaces = state.workspaces.map((item) => (item.id === workspace.id ? workspace : item));
  persist();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

function phaseLabel(workspace) {
  if (workspace.published) return "Published";
  return { planning: "Understanding", clarification: "Needs input", "plan-review": "Plan review", building: "Running", ready: "Ready", "verification-failed": "Preview failed" }[workspace.phase] || "Draft";
}

function renderProjects() {
  elements.projectList.innerHTML = state.workspaces
    .map(
      (workspace) => `
        <button type="button" class="project-item ${workspace.id === state.activeWorkspaceId ? "active" : ""}" data-workspace-id="${escapeHTML(workspace.id)}">
          <span class="project-thumb">${escapeHTML(workspace.title.slice(0, 1).toUpperCase())}</span>
          <span><strong>${escapeHTML(workspace.title)}</strong><small>Auto routing · ${escapeHTML(phaseLabel(workspace))}</small></span>
          <i class="project-state ${workspace.published ? "published" : escapeHTML(workspace.phase)}"></i>
        </button>`
    )
    .join("");
}

function renderHeader(workspace) {
  elements.workspaceTitle.textContent = workspace.title;
  elements.workspaceStatus.textContent = phaseLabel(workspace);
  elements.workspaceStatus.style.color = workspace.phase === "building" ? "var(--blue)" : "";
  elements.modeLabel.textContent = workspace.intent ? `${workspace.intent.type} · auto routed` : "Auto routing";
  const usedRealModel = workspace.modelSource && workspace.modelSource !== "local-fallback";
  elements.modelLabel.textContent = usedRealModel ? workspace.modelSource : modelCapability.realModel ? modelCapability.model : "Local fallback";
  elements.modelLabel.classList.toggle("connected", usedRealModel || modelCapability.realModel);
  elements.publishButton.disabled = workspace.phase !== "ready";
  elements.publishButton.innerHTML = workspace.published ? "Published <span>✓</span>" : "Publish <span>↗</span>";
  elements.agentStack.innerHTML = workspace.agents
    .slice(0, 6)
    .map((agent) => `<img src="${escapeHTML(agent.avatar)}" alt="${escapeHTML(agent.name)}" title="${escapeHTML(agent.name)} · ${escapeHTML(agent.role)}" />`)
    .join("");
}

function renderWorkingProcess(workspace) {
  const events = workspace.runtime?.events || [];
  const useful = events.filter((event) => !["run.completed", "approval.required"].includes(event.type)).slice(-14);
  const fallback = [
    { type: "phase.started", message: "I’m getting started." },
    { type: "phase.started", message: "理解目标、识别约束并判断是否需要澄清。" }
  ];
  const steps = useful.length ? useful : fallback;
  const title = workspace.runtime?.status === "running" || workspace.phase === "building" ? "Working Process" : `Processed ${steps.length} steps`;
  return `<section class="working-process">
    <div class="process-heading"><span>◉</span><strong>${escapeHTML(title)}</strong><i>⌃</i></div>
    <div class="process-timeline">${steps.map((event) => {
      const agent = AGENTS.find((item) => item.key === event.agent);
      const isTool = event.type === "tool.called" || event.type === "tool.completed";
      const text = event.message || event.type;
      return `<div class="process-step ${isTool ? "tool-step" : ""}"><span></span><div>${isTool ? `<small>${escapeHTML(agent?.name || "Agent")} · ${escapeHTML(event.tool || "tool")}</small>` : ""}<p>${escapeHTML(text)}</p></div></div>`;
    }).join("")}</div>
  </section>`;
}

function renderClarification(workspace) {
  if (workspace.phase !== "clarification" || !workspace.clarification) return "";
  const clarification = workspace.clarification;
  return `<section class="clarification-card">
    <header>${escapeHTML(clarification.question)}</header>
    <div class="clarification-options">${clarification.options.map((option, index) => `<button type="button" data-clarification-answer="${escapeHTML(option.label)}"><span>${index + 1}</span><div><strong>${escapeHTML(option.label)}</strong><small>${escapeHTML(option.description)}</small></div><i>›</i></button>`).join("")}</div>
    <footer>Reply to <b>@Alex</b> · 选择一个方向后继续规划</footer>
  </section>`;
}

function renderInlinePlan(workspace) {
  if (workspace.phase !== "plan-review") return "";
  return `<section class="plan-card inline-plan ${planningActive ? "model-loading" : ""}">
    <div class="plan-heading"><span>WORKING PLAN</span><b>${workspace.plan.length} steps</b></div>
    <div class="plan-list">${workspace.plan.map((step, index) => `<div class="plan-step"><span>${index + 1}</span><div><strong>${escapeHTML(step.title)}</strong><p>${escapeHTML(step.detail)}</p></div></div>`).join("")}</div>
    <div class="plan-actions"><button class="approve-button" data-plan-action="approve" type="button" ${planningActive ? "disabled" : ""}>${planningActive ? "DeepSeek is planning…" : "Approve plan"}</button><button class="quiet-button" data-plan-action="revise" type="button">Revise</button></div>
  </section>`;
}

function renderQuickStarts(workspace) {
  if (workspace.phase !== "ready") return "";
  return `<div class="quick-starts">${(workspace.quickStarts || []).map((prompt) => `<button type="button" data-quick-prompt="${escapeHTML(prompt)}">${escapeHTML(prompt)}</button>`).join("")}</div>`;
}

function previewSectionsFor(preview) {
  return preview.sections || [
    {
      type: "cards",
      title: preview.cardTitle || "核心功能",
      description: preview.cardMeta || "第一版体验已就绪",
      items: (preview.features || []).map((feature) => ({ title: feature.title, meta: feature.detail, value: "", status: "可用" })),
      metrics: []
    }
  ];
}

function currentPreviewInteraction() {
  if (!state.previewInteractions || typeof state.previewInteractions !== "object" || Array.isArray(state.previewInteractions)) state.previewInteractions = {};
  const workspaceId = activeWorkspace().id;
  state.previewInteractions[workspaceId] = normalizePreviewInteraction(state.previewInteractions[workspaceId], activeWorkspace().artifactRevision || 0);
  return state.previewInteractions[workspaceId];
}

function renderCalculatorWidget(preview, interaction) {
  const calculator = interaction.calculator;
  const capabilities = new Set(preview.capabilities || []);
  const visibleKeys = CALCULATOR_KEYS.filter((key) => key !== "%" || capabilities.has("percent")).filter((key) => key !== "±" || capabilities.has("sign"));
  const keys = visibleKeys.map((key) => {
    const kind = ["+", "−", "×", "÷", "="].includes(key) ? "operator" : ["C", "±", "%", "⌫"].includes(key) ? "utility" : "number";
    return `<button type="button" class="calculator-key ${kind} ${key === "0" ? "wide" : ""}" data-calculator-key="${escapeHTML(key)}">${escapeHTML(key)}</button>`;
  }).join("");
  const history = calculator.history.length
    ? calculator.history.map((item) => `<li>${escapeHTML(item)}</li>`).join("")
    : "<li>完成一次计算后会保留最近记录</li>";
  return `<section class="interactive-widget calculator-widget" aria-label="可操作计算器">
    <div class="calculator-shell">
      <header><span>LIVE CALCULATOR</span><small>${calculator.operator ? `${escapeHTML(String(calculator.accumulator))} ${escapeHTML(calculator.operator)}` : "可直接点击按键"}</small></header>
      <output class="calculator-display" aria-live="polite">${escapeHTML(calculator.display)}</output>
      <div class="calculator-keypad">${keys}</div>
    </div>
    <aside><span>RECENT</span><h3>运算历史</h3><ul>${history}</ul></aside>
  </section>`;
}

function renderSnakeWidget(interaction) {
  const game = interaction.snake;
  const snake = new Set(game.snake);
  const cells = Array.from({ length: game.boardSize * game.boardSize }, (_, index) => {
    const kind = index === game.snake[0] ? "head" : snake.has(index) ? "body" : index === game.food ? "food" : "";
    return `<i class="snake-cell ${kind}" aria-hidden="true"></i>`;
  }).join("");
  const status = { idle: "准备开始", running: "游戏中", paused: "已暂停", over: "游戏结束" }[game.status];
  const toggle = game.status === "running" ? "暂停" : game.status === "over" ? "再来一局" : "开始";
  return `<section class="interactive-widget snake-widget" tabindex="0" aria-label="可操作贪吃蛇游戏">
    <div class="snake-game-shell">
      <header><div><span>LIVE GAME</span><h3>${escapeHTML(status)}</h3></div><div><b>${game.score}</b><small>得分</small><b>${game.highScore}</b><small>最高</small></div></header>
      <div class="snake-board" style="--snake-size:${game.boardSize}" aria-label="${escapeHTML(status)}，当前得分 ${game.score}">${cells}</div>
    </div>
    <aside>
      <p>使用方向键或下方按钮控制。撞墙或碰到自己后结束。</p>
      <div class="snake-dpad">
        <button type="button" data-snake-action="up" aria-label="向上">↑</button>
        <button type="button" data-snake-action="left" aria-label="向左">←</button>
        <button type="button" data-snake-action="down" aria-label="向下">↓</button>
        <button type="button" data-snake-action="right" aria-label="向右">→</button>
      </div>
      <div class="snake-actions"><button type="button" data-snake-action="toggle">${toggle}</button><button type="button" data-snake-action="reset">重置</button></div>
    </aside>
  </section>`;
}

function renderInteractiveWidget(preview, interaction) {
  if (preview.appType === "calculator") return renderCalculatorWidget(preview, interaction);
  if (preview.appType === "snake") return renderSnakeWidget(interaction);
  return "";
}

function syncSnakeTimer() {
  const workspace = activeWorkspace();
  const running = workspace?.preview?.appType === "snake" && currentPreviewInteraction().snake.status === "running";
  if (!running && snakeTimer) {
    clearInterval(snakeTimer);
    snakeTimer = null;
  }
  if (!running || snakeTimer) return;
  snakeTimer = setInterval(() => {
    const current = activeWorkspace();
    if (!current || current.preview.appType !== "snake") return syncSnakeTimer();
    const interaction = currentPreviewInteraction();
    interaction.snake = reduceSnake(interaction.snake, "tick");
    persist();
    renderPreview(current);
  }, 220);
}

function syncViewerChrome() {
  const activeTab = normalizeDesignTab(state.activeDesignTab);
  const codeActive = state.activePanel === "code";
  $$('[data-design-tab]').forEach((button) => {
    const active = !codeActive && button.dataset.designTab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$('[data-design-pane]').forEach((pane) => {
    pane.hidden = codeActive ? pane.dataset.designPane !== "visual" : pane.dataset.designPane !== activeTab;
  });
  elements.appFrame.hidden = codeActive || activeTab !== "visual";
  elements.codeView.hidden = !codeActive;
  $$('[data-panel]').forEach((button) => {
    button.classList.toggle("active", codeActive);
    button.setAttribute("aria-pressed", String(codeActive));
  });
  $$('[data-device]').forEach((button) => {
    const active = button.dataset.device === state.device;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.designButton.setAttribute("aria-pressed", String(state.designMode));
}

function renderDesignTools(workspace) {
  const sections = previewSectionsFor(workspace.preview);
  elements.currentComponents.innerHTML = `<h3>Current structure</h3>${sections
    .map((section, index) => `<button type="button" data-focus-section="${index}"><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHTML(section.title)}</b><small>${escapeHTML(section.type)}</small></button>`)
    .join("")}`;
  elements.componentLibrary.innerHTML = COMPONENT_LIBRARY.map(
    (component) => `<article><span>${escapeHTML(component.type)}</span><h3>${escapeHTML(component.name)}</h3><p>${escapeHTML(component.description)}</p><button type="button" data-add-component="${escapeHTML(component.type)}">Add to page <b>＋</b></button></article>`
  ).join("");
  elements.themePresets.innerHTML = THEME_PRESETS.map(
    (theme) => `<button type="button" data-theme-id="${escapeHTML(theme.id)}" class="${workspace.preview.themeId === theme.id ? "active" : ""}"><i style="--swatch-accent:${escapeHTML(theme.accent)};--swatch-bg:${escapeHTML(theme.background)}"></i><span><b>${escapeHTML(theme.name)}</b><small>${escapeHTML(theme.description)}</small></span><strong>${workspace.preview.themeId === theme.id ? "Applied" : "Apply"}</strong></button>`
  ).join("");
}

function setDesignTab(tab) {
  state.activeDesignTab = normalizeDesignTab(tab);
  state.activePanel = "preview";
  persist();
  syncViewerChrome();
}

function scrollPreviewTo(location, behavior = "smooth") {
  const target = location === "home" ? elements.generatedApp : elements.previewSections.querySelector(`[data-section-index="${location}"]`);
  if (!target) return;
  const previewRect = elements.designPreview.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  elements.designPreview.scrollTo({ top: elements.designPreview.scrollTop + targetRect.top - previewRect.top - 12, behavior });
}

function renderMessages(workspace) {
  const nearBottom = elements.messageStream.scrollHeight - elements.messageStream.scrollTop - elements.messageStream.clientHeight < 80;
  elements.messageStream.innerHTML = workspace.messages
    .map((message) => {
      if (message.role === "system") {
        return `<article class="message system"><div class="message-body"><div class="message-bubble">${escapeHTML(message.text)}</div></div></article>`;
      }
      const agent = message.agent ? AGENTS.find((item) => item.key === message.agent) : null;
      const isUser = message.role === "user";
      return `<article class="message ${isUser ? "user" : "agent"}">
        <div class="message-avatar">${isUser ? "TW" : `<img src="${escapeHTML(agent?.avatar || AGENTS[0].avatar)}" alt="" />`}</div>
        <div class="message-body"><div class="message-meta"><strong>${isUser ? "You" : escapeHTML(agent?.name || "Atoms")}</strong><span>${isUser ? "" : escapeHTML(agent?.role || "Agent")}</span></div><div class="message-bubble">${escapeHTML(message.text)}</div></div>
      </article>`;
    })
    .join("") + `<article class="message agent process-message"><div class="message-avatar"><img src="${escapeHTML(AGENTS.find((agent) => agent.key === "alex")?.avatar)}" alt="" /></div><div class="message-body"><div class="message-meta"><strong>Alex</strong><span>Engineer</span></div>${renderWorkingProcess(workspace)}${renderClarification(workspace)}${renderInlinePlan(workspace)}${renderQuickStarts(workspace)}</div></article>`;
  if (nearBottom) elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

function renderPreview(workspace) {
  const preview = workspace.preview;
  const interaction = currentPreviewInteraction();
  elements.generatedApp.style.setProperty("--preview-accent", preview.accent);
  elements.generatedApp.style.setProperty("--preview-bg", preview.background || "#fffdf9");
  elements.generatedApp.dataset.template = preview.template || "landing";
  elements.generatedApp.dataset.heading = preview.headingStyle || "editorial";
  elements.generatedApp.dataset.appType = preview.appType || "generic";
  elements.previewBrand.textContent = preview.title;
  elements.previewLogo.textContent = preview.title.slice(0, 1).toUpperCase();
  elements.previewEyebrow.textContent = preview.eyebrow;
  elements.previewNavPrimary.textContent = preview.navItems?.[0] || "概览";
  elements.previewNavSecondary.textContent = preview.navItems?.[1] || "记录";
  elements.previewTitle.textContent = preview.title;
  elements.previewSubtitle.textContent = preview.subtitle;
  const action = preview.primaryAction || preview.button || "开始体验";
  const metric = preview.heroMetric || { value: preview.visualEnd || "01", label: preview.cardTitle || "当前重点", trend: preview.visualLabel || "已准备" };
  elements.previewPrimaryAction.textContent = interaction.primaryDone ? `${action} ✓` : action;
  elements.previewPrimaryAction.classList.toggle("completed", interaction.primaryDone);
  elements.previewMetricValue.textContent = metric.value;
  elements.previewMetricLabel.textContent = metric.label;
  elements.previewMetricTrend.textContent = metric.trend;
  const sections = previewSectionsFor(preview);
  elements.previewSections.innerHTML = `${renderInteractiveWidget(preview, interaction)}${sections.map(renderPreviewSection).join("")}`;
  elements.codeContent.textContent = workspace.code;
  elements.appFrame.className = `app-frame ${state.device}`;
  elements.generatedApp.classList.toggle("design-active", state.designMode);
  elements.designButton.classList.toggle("active", state.designMode);
  elements.designHint.hidden = !state.designMode;
  elements.previewNavPrimary.classList.toggle("active", interaction.activeSection === "0");
  elements.previewNavSecondary.classList.toggle("active", interaction.activeSection === "1");
  elements.previewProfileMenu.hidden = true;
  elements.previewAvatar.setAttribute("aria-expanded", "false");
  renderDesignTools(workspace);
  syncViewerChrome();
  syncSnakeTimer();
  renderPreviewHealth(workspace);
}

function renderPreviewHealth(workspace) {
  const verification = workspace.previewVerification;
  const status = verification?.status || "idle";
  elements.previewHealth.dataset.status = status;
  elements.previewHealthLabel.textContent = status === "passed"
    ? `Preview verified · revision ${verification.revision}`
    : status === "failed"
      ? `Preview failed · ${(verification.issues || []).join("；")}`
      : "Preview 尚未验证";
  elements.fixPreviewButton.hidden = status !== "failed";
}

function verifyAndPersistPreview(source = "manual") {
  const workspace = activeWorkspace();
  const rendered = {
    checked: true,
    title: elements.previewTitle.textContent,
    sectionCount: elements.previewSections.querySelectorAll(":scope > .preview-module").length,
    appType: elements.generatedApp.dataset.appType
  };
  const updated = recordPreviewVerification(workspace, rendered, source);
  replaceWorkspace(updated);
  renderPreviewHealth(updated);
  return updated.previewVerification;
}

function renderPreviewSection(section, sectionIndex) {
  const selectedItems = new Set(currentPreviewInteraction().selectedItems || []);
  const metrics = (section.metrics || []).map((metric) => `<div class="metric-tile"><span>${escapeHTML(metric.label)}</span><b>${escapeHTML(metric.value)}</b><small>${escapeHTML(metric.trend)}</small></div>`).join("");
  const items = (section.items || []).map((item, index) => {
    const itemId = `${sectionIndex}:${index}`;
    const selected = selectedItems.has(itemId);
    return `<button type="button" class="preview-item ${selected ? "selected" : ""}" data-preview-item="${itemId}" aria-pressed="${selected}"><span class="item-index">${selected ? "✓" : String(index + 1).padStart(2, "0")}</span><span><b>${escapeHTML(item.title)}</b><p>${escapeHTML(item.meta)}</p></span><aside><strong>${escapeHTML(item.value)}</strong><small>${selected ? "已选择" : escapeHTML(item.status)}</small></aside></button>`;
  }).join("");
  return `<section class="preview-module module-${escapeHTML(section.type)} editable-target" data-edit-target="section-${sectionIndex}" data-section-index="${sectionIndex}"><header><div><small>${escapeHTML(section.type)}</small><h3>${escapeHTML(section.title)}</h3></div><p>${escapeHTML(section.description)}</p></header>${metrics ? `<div class="metric-grid">${metrics}</div>` : ""}<div class="module-items">${items}</div></section>`;
}

function renderActivity(workspace) {
  const statusLabel = { done: "✓ Done", active: "● Working", waiting: "Waiting" };
  elements.agentProgress.innerHTML = workspace.agents
    .map(
      (agent) => `<div class="agent-progress-row ${escapeHTML(agent.status)}"><img src="${escapeHTML(agent.avatar)}" alt="" /><span><strong>${escapeHTML(agent.name)}</strong><small>${escapeHTML(agent.message)}</small></span><b>${statusLabel[agent.status]}</b></div>`
    )
    .join("");
  elements.terminal.innerHTML = workspace.logs
    .map((log) => `<div class="terminal-line ${escapeHTML(log.level)}"><time>${escapeHTML(log.time)}</time><span>${escapeHTML(log.text)}</span></div>`)
    .join("");
  elements.fileTree.innerHTML = `<div class="file-folder">⌄ project / src</div>${workspace.files
    .map((file) => `<div class="file-row ${escapeHTML(file.status)}"><span>${file.type === "css" ? "#" : file.type === "jsx" ? "⚛" : "◇"}</span><span>${escapeHTML(file.path)}</span><b>${file.status === "added" ? "A" : file.status === "modified" ? "M" : ""}</b></div>`)
    .join("")}`;
  elements.fileCount.textContent = workspace.files.length;
  elements.buildProgress.textContent = `${buildProgress(workspace)}%`;
  elements.runtimeStatus.textContent = workspace.runtime?.status === "running" ? `${workspace.runtime.phase} · live` : modelCapability.realModel ? modelCapability.model : "Local fallback";
  const useFiles = state.activeRail === "files";
  elements.terminal.hidden = useFiles;
  elements.fileTree.hidden = !useFiles;
  $$("[data-rail]").forEach((button) => button.classList.toggle("active", button.dataset.rail === state.activeRail));
}

function renderCapabilities(workspace) {
  const capabilities = workspace.capabilities || {};
  $$('[data-capability]').forEach((input) => { input.checked = Boolean(capabilities[input.dataset.capability]); });
  const attachments = capabilities.attachments || [];
  const connectors = capabilities.connectors || [];
  elements.attachmentSummary.textContent = attachments.length ? `${attachments.length} 个文件已加入上下文` : "添加文本上下文";
  elements.connectorSummary.textContent = connectors.length ? `${connectors.join("、")}（演示上下文）` : "选择上下文来源";
}

function render() {
  const workspace = activeWorkspace();
  if (!workspace) return;
  renderProjects();
  renderHeader(workspace);
  renderMessages(workspace);
  renderPreview(workspace);
  renderActivity(workspace);
  renderCapabilities(workspace);
  syncComposerState();
}

function syncComposerState() {
  const hasValue = !isComposerEmpty(elements.promptInput.value);
  const busy = planningActive || activeWorkspace()?.runtime?.status === "running" || activeWorkspace()?.phase === "building";
  elements.promptInput.classList.toggle("has-value", hasValue);
  elements.promptInput.dataset.empty = String(!hasValue);
  elements.sendButton.disabled = !hasValue || busy;
  elements.sendButton.setAttribute("aria-busy", String(busy));
}

function renderModelCapability() {
  elements.modelStatus.textContent = modelCapability.realModel
    ? `${modelCapability.model} 已连接`
    : modelCapability.checked
      ? "未连接服务端，使用本地降级"
      : "正在检测 DeepSeek…";
  elements.modelStatus.classList.toggle("connected", modelCapability.realModel);
}

async function detectModelCapability() {
  try {
    const response = await fetch("./api/health", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Model proxy unavailable");
    const payload = await response.json();
    modelCapability = { realModel: Boolean(payload.realModel), model: payload.model || "deepseek-v4-flash", checked: true };
  } catch {
    modelCapability = { realModel: false, model: "local-fallback", checked: true };
  }
  renderModelCapability();
  renderHeader(activeWorkspace());
  renderActivity(activeWorkspace());
}

function setModelPlanning(active) {
  planningActive = active;
  renderMessages(activeWorkspace());
}

async function hydratePlanWithModel(workspace, prompt) {
  if (!modelCapability.realModel) return false;
  const requestVersion = workspace.updatedAt;
  setModelPlanning(true);
  try {
    const response = await fetch("./api/agent/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ prompt, context: { preview: workspace.preview, mode: workspace.mode } })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "DeepSeek 暂时不可用");
    const current = state.workspaces.find((item) => item.id === workspace.id);
    if (!current || current.phase !== "plan-review" || current.prompt !== prompt || current.updatedAt !== requestVersion) return false;
    replaceWorkspace(applyModelPlan(current, payload.result, payload.model));
    render();
    showToast(`${payload.model} 已生成真实产品计划`);
    return true;
  } catch (error) {
    const current = state.workspaces.find((item) => item.id === workspace.id);
    if (current) {
      replaceWorkspace({
        ...current,
        modelSource: "local-fallback",
        logs: [...current.logs, { level: "error", text: `Model fallback: ${error.message}`, time: "now" }]
      });
      render();
    }
    showToast(`DeepSeek 请求失败，已保留本地计划：${error.message}`);
    return false;
  } finally {
    setModelPlanning(false);
  }
}

async function runLiveAgent(workspace, stage) {
  if (!modelCapability.realModel) return false;
  const started = beginAgentRun(workspace, stage);
  replaceWorkspace(started);
  render();
  try {
    const context = stage === "build"
      ? { intent: started.intent, plan: started.runtimePlan, preview: started.preview, clarificationAnswer: started.clarificationAnswer, hasExistingApp: Boolean(started.hasBuiltArtifact), artifactRevision: started.artifactRevision || 0, previewVerification: started.previewVerification, previewFeedback: started.previewFeedback }
      : { preview: started.preview, clarificationAnswer: started.clarificationAnswer, hasExistingApp: Boolean(started.hasBuiltArtifact), artifactRevision: started.artifactRevision || 0, previewVerification: started.previewVerification, previewFeedback: started.previewFeedback };
    const response = await fetch("./api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({
        stage,
        prompt: started.prompt,
        capabilities: started.capabilities,
        context
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Agent runtime 请求失败（${response.status}）`);
    }
    if (!response.body) throw new Error("Agent runtime 未返回事件流");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let failed = null;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        const current = state.workspaces.find((item) => item.id === workspace.id);
        if (!current) continue;
        if (event.type === "run.failed") failed = new Error(event.message);
        const next = event.type === "run.completed" ? applyRuntimeResult(current, event, modelCapability.model) : applyRuntimeEvent(current, event);
        replaceWorkspace(next);
        if (state.activeWorkspaceId === workspace.id) render();
      }
      if (done) break;
    }
    if (failed) throw failed;
    const current = state.workspaces.find((item) => item.id === workspace.id);
    if (stage === "build" && current?.phase === "ready" && state.activeWorkspaceId === workspace.id) verifyAndPersistPreview("agent-build");
    showToast(current?.phase === "clarification" ? "Alex 需要你补充一个关键选择" : stage === "plan" ? "意图识别与动态计划已完成" : "Agent runtime 已完成构建与验证");
    return true;
  } catch (error) {
    const current = state.workspaces.find((item) => item.id === workspace.id);
    if (current) {
      replaceWorkspace({ ...current, phase: "plan-review", runtime: { ...current.runtime, status: "failed" }, logs: [...current.logs, { level: "error", text: error.message, time: "now" }] });
      render();
    }
    showToast(`Agent runtime 失败：${error.message}`);
    return false;
  }
}

function startBuildLoop(workspaceId = activeWorkspace().id) {
  clearInterval(buildTimer);
  buildTimer = setInterval(() => {
    const workspace = state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      clearInterval(buildTimer);
      return;
    }
    if (workspace.phase !== "building") {
      clearInterval(buildTimer);
      return;
    }
    const next = nextBuildStep(workspace);
    replaceWorkspace(next);
    if (state.activeWorkspaceId === workspaceId) render();
    if (next.phase === "ready") {
      clearInterval(buildTimer);
      if (state.activeWorkspaceId === workspaceId) verifyAndPersistPreview("local-build");
      if (state.activeWorkspaceId === workspaceId) showToast("Build complete · 应用预览已更新");
    }
  }, 650);
}

function showNewProjectDialog() {
  elements.newProjectForm.reset();
  elements.newProjectDialog.showModal();
  setTimeout(() => elements.newProjectForm.elements.prompt.focus(), 50);
}

function exportWorkspace() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `atoms-demo-${activeWorkspace().id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("工作区快照已导出");
}

function openPublishDialog() {
  const workspace = activeWorkspace();
  elements.publishDialogTitle.textContent = workspace.published ? "Preview is live" : "Ready to publish";
  elements.publishSummary.innerHTML = `
    <div class="publish-row"><span>Build</span><b>${buildProgress(workspace)}% complete</b></div>
    <div class="publish-row"><span>Runtime</span><b>${escapeHTML(workspace.modelSource === "local-fallback" ? "Local fallback" : workspace.modelSource)}</b></div>
    <div class="publish-row"><span>Target</span><b>Simulated preview URL</b></div>`;
  elements.confirmPublishButton.textContent = workspace.published ? "Publish again" : "Publish demo preview";
  elements.confirmPublishButton.disabled = workspace.phase !== "ready";
  elements.publishDialog.showModal();
}

elements.promptInput.addEventListener("input", syncComposerState);
$("#composer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isComposerEmpty(elements.promptInput.value) || elements.sendButton.disabled) return;
  const updated = submitPrompt(activeWorkspace(), elements.promptInput.value);
  replaceWorkspace(updated);
  elements.promptInput.value = "";
  render();
  if (!(await runLiveAgent(updated, "plan"))) showToast("Mike 已生成本地变更计划");
});

elements.messageStream.addEventListener("click", async (event) => {
  const answer = event.target.closest("[data-clarification-answer]")?.dataset.clarificationAnswer;
  if (answer) {
    const updated = answerClarification(activeWorkspace(), answer);
    replaceWorkspace(updated);
    render();
    if (!(await runLiveAgent(updated, "plan"))) showToast("已记录选择并生成本地计划");
    return;
  }
  const action = event.target.closest("[data-plan-action]")?.dataset.planAction;
  if (action === "revise") {
    elements.promptInput.value = "请调整计划：";
    syncComposerState();
    elements.promptInput.focus();
    return;
  }
  if (action === "approve") {
    const current = activeWorkspace();
    if (modelCapability.realModel && current.runtimePlan && current.intent) return runLiveAgent(current, "build");
    const workspace = approvePlan(current);
    replaceWorkspace(workspace);
    render();
    startBuildLoop();
    return;
  }
  const quickPrompt = event.target.closest("[data-quick-prompt]")?.dataset.quickPrompt;
  if (quickPrompt) {
    elements.promptInput.value = quickPrompt;
    syncComposerState();
    $("#composer-form").requestSubmit();
  }
});

elements.projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-workspace-id]");
  if (!button) return;
  state.activeWorkspaceId = button.dataset.workspaceId;
  state.designMode = false;
  persist();
  render();
  if (activeWorkspace().phase === "building") startBuildLoop(activeWorkspace().id);
  elements.sidebar.classList.remove("open");
  elements.sidebarScrim.classList.remove("visible");
});

$("#new-project-button").addEventListener("click", showNewProjectDialog);
$("#restart-button").addEventListener("click", showNewProjectDialog);
elements.newProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.newProjectForm);
  const workspace = createWorkspace({ title: data.get("title"), prompt: data.get("prompt"), mode: "auto" });
  state.workspaces = [workspace, ...state.workspaces];
  state.activeWorkspaceId = workspace.id;
  state.designMode = false;
  persist();
  elements.newProjectDialog.close();
  render();
  if (!(await runLiveAgent(workspace, "plan"))) showToast("计划已生成，请确认后开始构建");
});

$$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$$('[data-panel]').forEach((button) =>
  button.addEventListener("click", () => {
    state.activePanel = state.activePanel === "code" ? "preview" : "code";
    if (state.activePanel === "preview") state.activeDesignTab = "visual";
    persist();
    syncViewerChrome();
    showToast(state.activePanel === "code" ? "Generated code 已打开" : "返回可交互预览");
  })
);
$("#activity-toggle").addEventListener("click", () => {
  const open = elements.activityPanel.classList.toggle("open");
  $("#activity-toggle").classList.toggle("active", open);
  $("#activity-toggle").setAttribute("aria-expanded", String(open));
});
$$('[data-device]').forEach((button) =>
  button.addEventListener("click", () => {
    state.device = button.dataset.device;
    persist();
    renderPreview(activeWorkspace());
    showToast(`已切换为${button.getAttribute("aria-label")}`);
  })
);
$$('[data-rail]').forEach((button) =>
  button.addEventListener("click", () => {
    state.activeRail = button.dataset.rail;
    persist();
    renderActivity(activeWorkspace());
  })
);

elements.designButton.addEventListener("click", () => {
  state.designMode = !state.designMode;
  state.activeDesignTab = "visual";
  state.activePanel = "preview";
  persist();
  renderPreview(activeWorkspace());
  showToast(state.designMode ? "Design mode 已开启，点击预览元素编辑" : "Design mode 已关闭");
});

$$('[data-design-tab]').forEach((button) => button.addEventListener("click", () => {
  setDesignTab(button.dataset.designTab);
  showToast(`${button.textContent.trim()} 已打开`);
}));

elements.currentComponents.addEventListener("click", (event) => {
  const index = event.target.closest("[data-focus-section]")?.dataset.focusSection;
  if (index === undefined) return;
  const interaction = currentPreviewInteraction();
  interaction.activeSection = String(index);
  setDesignTab("visual");
  renderPreview(activeWorkspace());
  requestAnimationFrame(() => scrollPreviewTo(String(index)));
  showToast("已在 Visual Editor 中定位组件");
});

elements.componentLibrary.addEventListener("click", (event) => {
  const type = event.target.closest("[data-add-component]")?.dataset.addComponent;
  if (!type) return;
  const workspace = activeWorkspace();
  const sections = previewSectionsFor(workspace.preview);
  const next = updatePreview(workspace, { sections: [...sections, createLibrarySection(type, sections.length)] });
  replaceWorkspace(next);
  state.activeDesignTab = "visual";
  state.activePanel = "preview";
  persist();
  render();
  verifyAndPersistPreview("visual-editor");
  requestAnimationFrame(() => scrollPreviewTo(String(sections.length)));
  showToast("组件已加入 Preview，并同步到 Code");
});

elements.themePresets.addEventListener("click", (event) => {
  const themeId = event.target.closest("[data-theme-id]")?.dataset.themeId;
  if (!themeId) return;
  replaceWorkspace(updatePreview(activeWorkspace(), themePatch(themeId)));
  render();
  verifyAndPersistPreview("theme-editor");
  showToast("主题已应用，并同步到工作区与 Code");
});

elements.generatedApp.addEventListener("click", (event) => {
  const editTarget = event.target.closest("[data-edit-target]");
  if (state.designMode && editTarget) {
    const preview = activeWorkspace().preview;
    const sectionIndex = Number(editTarget.dataset.editTarget.replace("section-", ""));
    const section = editTarget.dataset.editTarget.startsWith("section-") ? previewSectionsFor(preview)[sectionIndex] : null;
    elements.designForm.elements.title.value = section?.title || preview.title;
    elements.designForm.elements.subtitle.value = section?.description || preview.subtitle;
    elements.designForm.elements.accent.value = preview.accent;
    elements.designDialog.dataset.editTarget = editTarget.dataset.editTarget;
    elements.designDialog.showModal();
    return;
  }

  const calculatorKey = event.target.closest("[data-calculator-key]")?.dataset.calculatorKey;
  if (calculatorKey) {
    const interaction = currentPreviewInteraction();
    interaction.calculator = reduceCalculator(interaction.calculator, calculatorKey);
    activeWorkspace().previewFeedback = [...(activeWorkspace().previewFeedback || []), { type: "preview.interaction", source: "calculator", revision: activeWorkspace().artifactRevision || 0, action: calculatorKey, at: new Date().toISOString(), issues: [] }].slice(-12);
    persist();
    renderPreview(activeWorkspace());
    return;
  }

  const snakeAction = event.target.closest("[data-snake-action]")?.dataset.snakeAction;
  if (snakeAction) {
    const interaction = currentPreviewInteraction();
    interaction.snake = reduceSnake(interaction.snake, snakeAction);
    activeWorkspace().previewFeedback = [...(activeWorkspace().previewFeedback || []), { type: "preview.interaction", source: "snake", revision: activeWorkspace().artifactRevision || 0, action: snakeAction, at: new Date().toISOString(), issues: [] }].slice(-12);
    persist();
    renderPreview(activeWorkspace());
    requestAnimationFrame(() => elements.generatedApp.querySelector(".snake-widget")?.focus());
    return;
  }

  const command = event.target.closest("[data-preview-command]")?.dataset.previewCommand;
  if (command === "profile") {
    const open = elements.previewProfileMenu.hidden;
    elements.previewProfileMenu.hidden = !open;
    elements.previewAvatar.setAttribute("aria-expanded", String(open));
    return;
  }
  if (command === "runtime") {
    elements.activityPanel.classList.add("open");
    $("#activity-toggle").classList.add("active");
    $("#activity-toggle").setAttribute("aria-expanded", "true");
    elements.previewProfileMenu.hidden = true;
    showToast("已打开 Agent runtime 运行状态");
    return;
  }
  if (command === "reset") {
    state.previewInteractions[activeWorkspace().id] = initialPreviewInteraction(activeWorkspace().artifactRevision || 0);
    persist();
    renderPreview(activeWorkspace());
    elements.designPreview.scrollTo({ top: 0, behavior: "smooth" });
    showToast("预览内操作状态已重置");
    return;
  }
  if (["home", "primary", "secondary", "primary-action"].includes(command)) {
    const interaction = currentPreviewInteraction();
    const lastIndex = Math.max(0, previewSectionsFor(activeWorkspace().preview).length - 1);
    const target = command === "home" ? "home" : command === "secondary" ? String(Math.min(1, lastIndex)) : "0";
    interaction.activeSection = target;
    if (command === "primary-action") interaction.primaryDone = true;
    persist();
    renderPreview(activeWorkspace());
    requestAnimationFrame(() => scrollPreviewTo(target));
    showToast(command === "primary-action" ? "主操作已执行，已进入核心内容" : "已切换预览内容");
    return;
  }

  const itemId = event.target.closest("[data-preview-item]")?.dataset.previewItem;
  if (!itemId) return;
  const interaction = currentPreviewInteraction();
  const selected = new Set(interaction.selectedItems || []);
  selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId);
  interaction.selectedItems = [...selected];
  persist();
  renderPreview(activeWorkspace());
  showToast(selected.has(itemId) ? "预览项目已选择" : "预览项目已取消选择");
});
elements.generatedApp.addEventListener("keydown", (event) => {
  if (activeWorkspace().preview.appType !== "snake") return;
  const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (!direction && event.key !== " ") return;
  event.preventDefault();
  const interaction = currentPreviewInteraction();
  interaction.snake = reduceSnake(interaction.snake, direction || "toggle");
  persist();
  renderPreview(activeWorkspace());
  requestAnimationFrame(() => elements.generatedApp.querySelector(".snake-widget")?.focus());
});
elements.designForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(elements.designForm);
  const workspace = activeWorkspace();
  const target = elements.designDialog.dataset.editTarget || "hero";
  let patch = { accent: data.get("accent") };
  if (target.startsWith("section-")) {
    const sectionIndex = Number(target.replace("section-", ""));
    patch.sections = previewSectionsFor(workspace.preview).map((section, index) =>
      index === sectionIndex ? { ...section, title: data.get("title"), description: data.get("subtitle") } : section
    );
  } else {
    patch = { ...patch, title: data.get("title"), subtitle: data.get("subtitle") };
  }
  const updatedWorkspace = updatePreview(workspace, patch);
  replaceWorkspace(updatedWorkspace);
  elements.designDialog.close();
  render();
  verifyAndPersistPreview("visual-editor");
  showToast("可视编辑已同步到 Preview 与 Code");
});

elements.publishButton.addEventListener("click", openPublishDialog);
elements.confirmPublishButton.addEventListener("click", () => {
  const workspace = publishWorkspace(activeWorkspace());
  replaceWorkspace(workspace);
  elements.publishDialog.close();
  render();
  showToast("Demo preview 已发布（模拟）");
});
$("#share-button").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); showToast("当前地址已复制"); }
  catch { showToast("请从浏览器地址栏复制当前地址"); }
});
$("#attachment-button").addEventListener("click", () => {
  elements.capabilityMenu.hidden = !elements.capabilityMenu.hidden;
  $("#attachment-button").setAttribute("aria-expanded", String(!elements.capabilityMenu.hidden));
});
elements.capabilityMenu.addEventListener("change", (event) => {
  const input = event.target.closest("[data-capability]");
  if (!input) return;
  const workspace = activeWorkspace();
  replaceWorkspace({ ...workspace, capabilities: { ...workspace.capabilities, [input.dataset.capability]: input.checked } });
  if (input.dataset.capability === "deepResearch" && input.checked) showToast("Deep Research 已启用，Iris 将参与意图相关任务");
});
elements.capabilityMenu.addEventListener("click", (event) => {
  const action = event.target.closest("[data-capability-action]")?.dataset.capabilityAction;
  if (action === "attachment") elements.attachmentInput.click();
  if (action === "connectors") {
    const workspace = activeWorkspace();
    const connectors = workspace.capabilities?.connectors?.length ? [] : ["GitHub"];
    replaceWorkspace({ ...workspace, capabilities: { ...workspace.capabilities, connectors } });
    elements.connectorSummary.textContent = connectors.length ? "GitHub（演示上下文）" : "选择上下文来源";
    showToast(connectors.length ? "已添加 GitHub 演示上下文；不会访问私人仓库" : "已移除连接器上下文");
  }
});
elements.attachmentInput.addEventListener("change", async () => {
  const files = [...elements.attachmentInput.files].slice(0, 3);
  const attachments = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type || "text/plain", content: (await file.text()).slice(0, 4000) })));
  const workspace = activeWorkspace();
  replaceWorkspace({ ...workspace, capabilities: { ...workspace.capabilities, attachments } });
  elements.attachmentSummary.textContent = attachments.length ? `${attachments.length} 个文件已加入上下文` : "添加文本上下文";
  showToast(attachments.length ? "附件会参与意图识别与计划" : "未选择附件");
});
$$('[data-nav]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.nav === "home") return showNewProjectDialog();
  if (button.dataset.nav === "resources") {
    window.open("https://help.atoms.dev/zh-CN/", "_blank", "noopener,noreferrer");
    return;
  }
  elements.projectList.querySelector(".project-item")?.focus();
}));
$("#export-button").addEventListener("click", exportWorkspace);
$("#refresh-button").addEventListener("click", () => {
  state.activeDesignTab = "visual";
  state.activePanel = "preview";
  persist();
  renderPreview(activeWorkspace());
  elements.designPreview.scrollTo({ top: 0, behavior: "smooth" });
  elements.appFrame.animate([{ opacity: .35, transform: "scale(.995)" }, { opacity: 1, transform: "scale(1)" }], { duration: 280 });
  showToast("Preview 已从当前工作区状态重新渲染");
});
$("#verify-preview-button").addEventListener("click", () => {
  const result = verifyAndPersistPreview("manual");
  showToast(result.passed ? "Preview 验证通过" : "Preview 验证失败，可交给 Agent 修复");
});
elements.fixPreviewButton.addEventListener("click", () => {
  elements.promptInput.value = buildPreviewFixPrompt(activeWorkspace().previewVerification);
  syncComposerState();
  $("#composer-form").requestSubmit();
});
$("#open-preview-button").addEventListener("click", () => {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("preview", activeWorkspace().id);
  window.open(url, "_blank", "noopener,noreferrer");
});

$("#mobile-menu").addEventListener("click", () => {
  elements.sidebar.classList.add("open");
  elements.sidebarScrim.classList.add("visible");
});
elements.mobileViewToggle.addEventListener("click", () => {
  const previewOpen = elements.conversationPanel.classList.toggle("preview-mobile");
  elements.mobileViewToggle.textContent = previewOpen ? "Chat" : "Preview";
});
elements.sidebarScrim.addEventListener("click", () => {
  elements.sidebar.classList.remove("open");
  elements.sidebarScrim.classList.remove("visible");
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".capability-wrap")) elements.capabilityMenu.hidden = true;
  if (!event.target.closest(".generated-nav nav")) {
    elements.previewProfileMenu.hidden = true;
    elements.previewAvatar.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    elements.activityPanel.classList.remove("open");
    $("#activity-toggle").classList.remove("active");
    $("#activity-toggle").setAttribute("aria-expanded", "false");
    elements.previewProfileMenu.hidden = true;
    elements.previewAvatar.setAttribute("aria-expanded", "false");
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !elements.sendButton.disabled) $("#composer-form").requestSubmit();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const localDevelopment = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    if (localDevelopment) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return;
    }
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
renderModelCapability();
if (activeWorkspace().phase === "building") startBuildLoop(activeWorkspace().id);
detectModelCapability();
