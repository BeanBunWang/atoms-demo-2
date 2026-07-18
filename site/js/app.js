import {
  AGENTS,
  MODES,
  applyModelPlan,
  approvePlan,
  buildProgress,
  changeMode,
  createWorkspace,
  isComposerEmpty,
  nextBuildStep,
  publishWorkspace,
  submitPrompt,
  updatePreview
} from "./planner.js";
import { initialState, loadState, saveState } from "./storage.js";

let state = loadState();
let buildTimer = null;
let toastTimer = null;
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
  planCard: $("#plan-card"),
  planList: $("#plan-list"),
  promptInput: $("#prompt-input"),
  sendButton: $("#send-button"),
  modeLabel: $("#mode-label"),
  modelLabel: $("#model-label"),
  modelStatus: $("#model-status"),
  modeButtonLabel: $("#mode-button-label"),
  modeMenu: $("#mode-menu"),
  appFrame: $("#app-frame"),
  generatedApp: $("#generated-app"),
  previewBrand: $("#preview-brand"),
  previewLogo: $("#preview-logo"),
  previewEyebrow: $("#preview-eyebrow"),
  previewNavPrimary: $("#preview-nav-primary"),
  previewNavSecondary: $("#preview-nav-secondary"),
  previewTitle: $("#preview-title"),
  previewSubtitle: $("#preview-subtitle"),
  previewCardTitle: $("#preview-card-title"),
  previewCardMeta: $("#preview-card-meta"),
  previewCta: $("#preview-cta"),
  previewVisualStart: $("#preview-visual-start"),
  previewVisualEnd: $("#preview-visual-end"),
  previewVisualLabel: $("#preview-visual-label"),
  previewFeatures: $("#preview-features"),
  codeView: $("#code-view"),
  codeContent: $("#code-content"),
  agentProgress: $("#agent-progress"),
  terminal: $("#terminal"),
  fileTree: $("#file-tree"),
  fileCount: $("#file-count"),
  buildProgress: $("#build-progress"),
  runtimeStatus: $("#runtime-status"),
  designButton: $("#design-button"),
  designHint: $("#design-hint"),
  publishButton: $("#publish-button"),
  approvePlanButton: $("#approve-plan-button"),
  conversationPanel: $("#conversation-panel"),
  mobileViewToggle: $("#mobile-view-toggle"),
  newProjectDialog: $("#new-project-dialog"),
  newProjectForm: $("#new-project-form"),
  dialogModes: $("#dialog-modes"),
  designDialog: $("#design-dialog"),
  designForm: $("#design-form"),
  publishDialog: $("#publish-dialog"),
  publishDialogTitle: $("#publish-dialog-title"),
  publishSummary: $("#publish-summary"),
  confirmPublishButton: $("#confirm-publish-button"),
  toast: $("#toast")
};

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
  return { "plan-review": "Plan review", building: "Building", ready: "Ready" }[workspace.phase] || "Draft";
}

function renderProjects() {
  elements.projectList.innerHTML = state.workspaces
    .map(
      (workspace) => `
        <button type="button" class="project-item ${workspace.id === state.activeWorkspaceId ? "active" : ""}" data-workspace-id="${escapeHTML(workspace.id)}">
          <span class="project-thumb">${escapeHTML(workspace.title.slice(0, 1).toUpperCase())}</span>
          <span><strong>${escapeHTML(workspace.title)}</strong><small>${escapeHTML(MODES[workspace.mode].label)} · ${escapeHTML(phaseLabel(workspace))}</small></span>
          <i class="project-state ${workspace.published ? "published" : escapeHTML(workspace.phase)}"></i>
        </button>`
    )
    .join("");
}

function renderHeader(workspace) {
  elements.workspaceTitle.textContent = workspace.title;
  elements.workspaceStatus.textContent = phaseLabel(workspace);
  elements.workspaceStatus.style.color = workspace.phase === "building" ? "var(--blue)" : "";
  elements.modeLabel.textContent = `${MODES[workspace.mode].label} mode`;
  const usedRealModel = workspace.modelSource && workspace.modelSource !== "local-fallback";
  elements.modelLabel.textContent = usedRealModel ? workspace.modelSource : modelCapability.realModel ? modelCapability.model : "Local fallback";
  elements.modelLabel.classList.toggle("connected", usedRealModel || modelCapability.realModel);
  elements.modeButtonLabel.textContent = MODES[workspace.mode].label;
  elements.publishButton.disabled = workspace.phase !== "ready";
  elements.publishButton.innerHTML = workspace.published ? "Published <span>✓</span>" : "Publish <span>↗</span>";
  elements.agentStack.innerHTML = workspace.agents
    .slice(0, 6)
    .map((agent) => `<img src="${escapeHTML(agent.avatar)}" alt="${escapeHTML(agent.name)}" title="${escapeHTML(agent.name)} · ${escapeHTML(agent.role)}" />`)
    .join("");
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
    .join("");
  if (nearBottom) elements.messageStream.scrollTop = elements.messageStream.scrollHeight;

  elements.planCard.hidden = workspace.phase !== "plan-review";
  elements.planList.innerHTML = workspace.plan
    .map((step, index) => `<div class="plan-step"><span>${index + 1}</span><div><strong>${escapeHTML(step.title)}</strong><p>${escapeHTML(step.detail)}</p></div></div>`)
    .join("");
}

function renderPreview(workspace) {
  const preview = workspace.preview;
  elements.generatedApp.style.setProperty("--preview-accent", preview.accent);
  elements.previewBrand.textContent = preview.title;
  elements.previewLogo.textContent = preview.title.slice(0, 1).toUpperCase();
  elements.previewEyebrow.textContent = preview.eyebrow;
  elements.previewNavPrimary.textContent = preview.navItems[0];
  elements.previewNavSecondary.textContent = preview.navItems[1];
  elements.previewTitle.textContent = preview.title;
  elements.previewSubtitle.textContent = preview.subtitle;
  elements.previewCardTitle.textContent = preview.cardTitle;
  elements.previewCardMeta.textContent = preview.cardMeta;
  elements.previewCta.innerHTML = `${escapeHTML(preview.button)} <span>→</span>`;
  elements.previewVisualStart.textContent = preview.visualStart;
  elements.previewVisualEnd.textContent = preview.visualEnd;
  elements.previewVisualLabel.textContent = preview.visualLabel;
  elements.previewFeatures.innerHTML = preview.features
    .slice(0, 3)
    .map((feature, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><h4>${escapeHTML(feature.title)}</h4><p>${escapeHTML(feature.detail)}</p></article>`)
    .join("");
  elements.codeContent.textContent = workspace.code;
  elements.appFrame.className = `app-frame ${state.device}`;
  elements.generatedApp.classList.toggle("design-active", state.designMode);
  elements.designButton.classList.toggle("active", state.designMode);
  elements.designHint.hidden = !state.designMode;
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
  elements.runtimeStatus.textContent = modelCapability.realModel ? modelCapability.model : "Local fallback";
  const useFiles = state.activeRail === "files";
  elements.terminal.hidden = useFiles;
  elements.fileTree.hidden = !useFiles;
  $$("[data-rail]").forEach((button) => button.classList.toggle("active", button.dataset.rail === state.activeRail));
}

function renderModeMenus(workspace) {
  const icons = { build: "⚒", team: "◎", race: "↯", research: "⌕" };
  elements.modeMenu.innerHTML = Object.entries(MODES)
    .map(
      ([key, mode]) => `<button type="button" class="mode-option ${workspace.mode === key ? "active" : ""}" data-mode="${key}"><span>${icons[key]}</span><span><strong>${mode.label}</strong><small>${mode.description}</small></span><b>${workspace.mode === key ? "✓" : ""}</b></button>`
    )
    .join("");
  elements.dialogModes.innerHTML = Object.entries(MODES)
    .map(
      ([key, mode], index) => `<label class="dialog-mode"><input type="radio" name="mode" value="${key}" ${index === 1 ? "checked" : ""} /><span><strong>${mode.label}</strong><small>${mode.description}</small></span></label>`
    )
    .join("");
}

function render() {
  const workspace = activeWorkspace();
  if (!workspace) return;
  renderProjects();
  renderHeader(workspace);
  renderMessages(workspace);
  renderPreview(workspace);
  renderActivity(workspace);
  renderModeMenus(workspace);
  syncComposerState();
}

function syncComposerState() {
  const hasValue = !isComposerEmpty(elements.promptInput.value);
  elements.promptInput.classList.toggle("has-value", hasValue);
  elements.promptInput.dataset.empty = String(!hasValue);
  elements.sendButton.disabled = !hasValue;
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
  elements.planCard.classList.toggle("model-loading", active);
  elements.approvePlanButton.disabled = active;
  elements.approvePlanButton.textContent = active ? "DeepSeek is planning…" : "Approve & build";
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
    <div class="publish-row"><span>Runtime</span><b>Static local demo</b></div>
    <div class="publish-row"><span>Target</span><b>Simulated preview URL</b></div>`;
  elements.confirmPublishButton.textContent = workspace.published ? "Publish again" : "Publish demo preview";
  elements.confirmPublishButton.disabled = workspace.phase !== "ready";
  elements.publishDialog.showModal();
}

function standalonePreview(workspace) {
  const p = workspace.preview;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(p.title)}</title><style>body{margin:0;background:#fffdf9;color:#222;font-family:system-ui}main{max-width:760px;margin:auto;padding:10vh 24px}small{color:${escapeHTML(p.accent)};font-weight:800;letter-spacing:.15em}h1{font:500 clamp(48px,9vw,88px)/.95 Georgia;margin:16px 0}p{max-width:520px;color:#777;line-height:1.7}.card{margin-top:52px;padding:38px;border:1px solid #e7ded4;background:#fff}button{margin-top:20px;padding:12px 18px;border:0;background:${escapeHTML(p.accent)};color:white}</style><main><small>ATOM DEMO PREVIEW</small><h1>${escapeHTML(p.title)}</h1><p>${escapeHTML(p.subtitle)}</p><div class="card"><h2>${escapeHTML(p.cardTitle)}</h2><p>${escapeHTML(p.cardMeta)}</p><button>${escapeHTML(p.button)} →</button></div></main>`;
}

elements.promptInput.addEventListener("input", syncComposerState);
$("#composer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isComposerEmpty(elements.promptInput.value)) return;
  const updated = submitPrompt(activeWorkspace(), elements.promptInput.value);
  replaceWorkspace(updated);
  elements.promptInput.value = "";
  render();
  if (!(await hydratePlanWithModel(updated, updated.prompt))) showToast("Mike 已生成本地变更计划");
});

$("#approve-plan-button").addEventListener("click", () => {
  const workspace = approvePlan(activeWorkspace());
  replaceWorkspace(workspace);
  render();
  startBuildLoop();
});

$("#revise-plan-button").addEventListener("click", () => {
  elements.promptInput.value = "请调整计划：";
  syncComposerState();
  elements.promptInput.focus();
});

$("#mode-button").addEventListener("click", () => {
  elements.modeMenu.hidden = !elements.modeMenu.hidden;
});
elements.modeMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  const updated = changeMode(activeWorkspace(), button.dataset.mode);
  replaceWorkspace(updated);
  elements.modeMenu.hidden = true;
  render();
  showToast(`已切换到 ${MODES[button.dataset.mode].label} mode`);
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
  const workspace = createWorkspace({ title: data.get("title"), prompt: data.get("prompt"), mode: data.get("mode") });
  state.workspaces = [workspace, ...state.workspaces];
  state.activeWorkspaceId = workspace.id;
  state.designMode = false;
  persist();
  elements.newProjectDialog.close();
  render();
  if (!(await hydratePlanWithModel(workspace, workspace.prompt))) showToast("计划已生成，请确认后开始构建");
});

$$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$$('[data-panel]').forEach((button) =>
  button.addEventListener("click", () => {
    state.activePanel = button.dataset.panel;
    persist();
    $$('[data-panel]').forEach((item) => item.classList.toggle("active", item.dataset.panel === state.activePanel));
    elements.appFrame.hidden = state.activePanel !== "preview";
    elements.codeView.hidden = state.activePanel !== "code";
  })
);
$$('[data-device]').forEach((button) =>
  button.addEventListener("click", () => {
    state.device = button.dataset.device;
    persist();
    $$('[data-device]').forEach((item) => item.classList.toggle("active", item.dataset.device === state.device));
    renderPreview(activeWorkspace());
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
  persist();
  renderPreview(activeWorkspace());
  showToast(state.designMode ? "Design mode 已开启，点击预览元素编辑" : "Design mode 已关闭");
});
elements.generatedApp.addEventListener("click", (event) => {
  if (!state.designMode || !event.target.closest("[data-edit-target]")) return;
  const preview = activeWorkspace().preview;
  elements.designForm.elements.title.value = preview.title;
  elements.designForm.elements.subtitle.value = preview.subtitle;
  elements.designForm.elements.accent.value = preview.accent;
  elements.designDialog.showModal();
});
elements.designForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(elements.designForm);
  const workspace = updatePreview(activeWorkspace(), { title: data.get("title"), subtitle: data.get("subtitle"), accent: data.get("accent") });
  replaceWorkspace(workspace);
  elements.designDialog.close();
  render();
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
$("#attachment-button").addEventListener("click", () => showToast("静态 Demo 暂不上传文件；生产版应接入安全文件存储"));
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
  elements.appFrame.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 260 });
  showToast("Preview refreshed");
});
$("#open-preview-button").addEventListener("click", () => {
  const blob = new Blob([standalonePreview(activeWorkspace())], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  if (!event.target.closest(".mode-menu-wrap")) elements.modeMenu.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") elements.modeMenu.hidden = true;
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
$$('[data-panel]').forEach((item) => item.classList.toggle("active", item.dataset.panel === state.activePanel));
elements.appFrame.hidden = state.activePanel !== "preview";
elements.codeView.hidden = state.activePanel !== "code";
$$('[data-device]').forEach((item) => item.classList.toggle("active", item.dataset.device === state.device));
if (activeWorkspace().phase === "building") startBuildLoop(activeWorkspace().id);
detectModelCapability();
