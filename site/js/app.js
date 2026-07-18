import {
  MODES,
  advanceProject,
  createProject,
  cycleTaskStatus,
  projectProgress,
  restartProject
} from "./planner.js";
import { initialState, loadState, parseImportedState, saveState } from "./storage.js";

let state = loadState();
let draftMode = activeProject()?.mode || "team";
let runTimer = null;
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  body: document.body,
  sidebar: $(".sidebar"),
  sidebarScrim: $("#sidebar-scrim"),
  projectList: $("#project-list"),
  projectTitle: $("#project-title"),
  projectKicker: $("#project-kicker"),
  briefInput: $("#brief-input"),
  modeSwitcher: $("#mode-switcher"),
  metricsGrid: $("#metrics-grid"),
  agentTimeline: $("#agent-timeline"),
  artifactTabs: $("#artifact-tabs"),
  artifactContent: $("#artifact-content"),
  pauseButton: $("#pause-button"),
  taskCountBadge: $("#task-count-badge"),
  kanban: $("#kanban"),
  boardProgress: $("#board-progress"),
  progressFill: $("#progress-fill"),
  deliveryChecklist: $("#delivery-checklist"),
  readinessPill: $("#readiness-pill"),
  projectDialog: $("#project-dialog"),
  projectForm: $("#project-form"),
  dialogModeOptions: $("#dialog-mode-options"),
  profileDialog: $("#profile-dialog"),
  profileForm: $("#profile-form"),
  profileAvatar: $("#profile-avatar"),
  profileName: $("#profile-name"),
  saveState: $("#save-state"),
  importInput: $("#import-input"),
  toast: $("#toast")
};

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function relativeTime(value) {
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function persist(message = "已自动保存") {
  const ok = saveState(state);
  elements.saveState.innerHTML = `<i></i> ${ok ? escapeHTML(message) : "保存失败"}`;
  elements.saveState.classList.toggle("error", !ok);
}

function updateProject(updated) {
  state.projects = state.projects.map((project) => (project.id === updated.id ? updated : project));
  persist();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

function renderProjectList() {
  elements.projectList.innerHTML = state.projects
    .map((project) => {
      const active = project.id === state.activeProjectId;
      const mode = MODES[project.mode];
      return `
        <button type="button" class="project-link ${active ? "active" : ""}" data-project-id="${escapeHTML(project.id)}">
          <span class="project-icon ${mode.accent}">${escapeHTML(project.title.slice(0, 1))}</span>
          <span><strong>${escapeHTML(project.title)}</strong><small>${escapeHTML(mode.shortLabel)} · ${relativeTime(project.updatedAt)}</small></span>
          <i class="project-status ${project.status}"></i>
        </button>`;
    })
    .join("");
}

function renderModeSwitcher() {
  elements.modeSwitcher.innerHTML = Object.entries(MODES)
    .map(
      ([key, mode]) => `
        <button type="button" class="mode-chip ${draftMode === key ? "active" : ""}" data-mode="${key}" title="${escapeHTML(mode.description)}">
          ${escapeHTML(mode.shortLabel)}
        </button>`
    )
    .join("");
}

function renderMetrics(project) {
  const doneAgents = project.agents.filter((agent) => agent.status === "done").length;
  const progress = projectProgress(project);
  const taskDone = project.tasks.filter((task) => task.status === "已完成").length;
  elements.metricsGrid.innerHTML = `
    <article><span>团队接力</span><strong>${doneAgents}<small> / ${project.agents.length}</small></strong><p>${project.status === "complete" ? "全员已交付" : "正在形成方案"}</p></article>
    <article><span>项目进度</span><strong>${progress}<small>%</small></strong><p>${taskDone} 个任务已完成</p></article>
    <article><span>执行模式</span><strong class="word-metric">${escapeHTML(MODES[project.mode].shortLabel)}</strong><p>${escapeHTML(MODES[project.mode].description)}</p></article>
  `;
}

function renderAgents(project) {
  const statusText = { done: "已交付", active: "工作中", waiting: "等待中" };
  elements.agentTimeline.innerHTML = project.agents
    .map(
      (agent, index) => `
        <article class="agent-row ${agent.status}">
          <div class="agent-order">${String(index + 1).padStart(2, "0")}</div>
          <div class="agent-avatar ${agent.tone}">${escapeHTML(agent.glyph)}</div>
          <div class="agent-copy">
            <div><strong>${escapeHTML(agent.name)}</strong><span>${escapeHTML(agent.role)}</span></div>
            <p>${escapeHTML(agent.message)}</p>
          </div>
          <span class="agent-state">${statusText[agent.status]}</span>
        </article>`
    )
    .join("");
  elements.pauseButton.textContent = project.paused ? "继续" : "暂停";
  elements.pauseButton.disabled = project.status === "complete";
}

function renderArtifacts(project) {
  const visibleAgents = project.agents.filter((agent) => agent.status !== "waiting");
  let selectedKey = state.activeArtifactByProject[project.id];
  if (!visibleAgents.some((agent) => agent.key === selectedKey)) {
    selectedKey = visibleAgents.at(-1)?.key || project.agents[0].key;
    state.activeArtifactByProject[project.id] = selectedKey;
  }

  elements.artifactTabs.innerHTML = project.agents
    .map(
      (agent) => `
        <button type="button" role="tab" data-agent-key="${agent.key}" aria-selected="${selectedKey === agent.key}" ${agent.status === "waiting" ? "disabled" : ""}>
          ${escapeHTML(agent.name)}
        </button>`
    )
    .join("");

  const agent = project.agents.find((item) => item.key === selectedKey) || project.agents[0];
  if (agent.status === "active") {
    elements.artifactContent.innerHTML = `
      <div class="artifact-loading">
        <span class="loading-orbit" aria-hidden="true"><i></i></span>
        <p class="eyebrow">${escapeHTML(agent.name)} 正在工作</p>
        <h3>正在把上下文整理成清晰的交付物</h3>
        <p>结果会在这一轮接力完成后自动出现。</p>
      </div>`;
    return;
  }

  const deliverable = agent.deliverable;
  elements.artifactContent.innerHTML = `
    <div class="artifact-meta"><span>${escapeHTML(agent.role)}</span><span>${relativeTime(project.updatedAt)}</span></div>
    <h3>${escapeHTML(deliverable.title)}</h3>
    <p class="artifact-summary">${escapeHTML(deliverable.summary)}</p>
    <div class="artifact-sections">
      ${deliverable.sections
        .map(
          ([label, text]) => `<section><span>${escapeHTML(label)}</span><p>${escapeHTML(text)}</p></section>`
        )
        .join("")}
    </div>
  `;
}

function renderBoard(project) {
  const groups = ["待开始", "进行中", "已完成"];
  const labels = { 待开始: "Backlog", 进行中: "In motion", 已完成: "Shipped" };
  elements.kanban.innerHTML = groups
    .map((status) => {
      const tasks = project.tasks.filter((task) => task.status === status);
      return `
        <section class="kanban-column" data-status="${status}">
          <div class="column-heading"><div><i></i><strong>${status}</strong><span>${labels[status]}</span></div><b>${tasks.length}</b></div>
          <div class="task-stack">
            ${tasks.length ? tasks.map(renderTask).join("") : '<div class="empty-column">这里已经清空了</div>'}
          </div>
        </section>`;
    })
    .join("");

  const progress = projectProgress(project);
  elements.boardProgress.textContent = `${progress}%`;
  elements.progressFill.style.width = `${progress}%`;
  elements.taskCountBadge.textContent = project.tasks.filter((task) => task.status !== "已完成").length;
}

function renderTask(task) {
  return `
    <article class="task-card">
      <div class="task-topline"><span class="priority ${task.priority.toLowerCase()}">${task.priority}</span><span>${escapeHTML(task.owner)}</span></div>
      <h3>${escapeHTML(task.title)}</h3>
      <button type="button" data-task-id="${escapeHTML(task.id)}" aria-label="推进任务：${escapeHTML(task.title)}">
        推进状态 <span aria-hidden="true">→</span>
      </button>
    </article>`;
}

function renderPublish(project) {
  const progress = projectProgress(project);
  const checks = [
    ["核心主流程可操作", project.status === "complete", "智能体已完成全部交付"],
    ["数据可持久化", true, "浏览器本地自动保存"],
    ["任务执行有闭环", progress === 100, `${progress}% 的任务已完成`],
    ["可导出与恢复", true, "支持 JSON 项目快照"],
    ["在线地址与源码公开", true, "GitHub Pages 自动部署"]
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  elements.deliveryChecklist.innerHTML = checks
    .map(
      ([label, ok, detail]) => `
        <div class="check-row ${ok ? "passed" : "pending"}">
          <span aria-hidden="true">${ok ? "✓" : "○"}</span>
          <div><strong>${escapeHTML(label)}</strong><small>${escapeHTML(detail)}</small></div>
          <b>${ok ? "通过" : "待完成"}</b>
        </div>`
    )
    .join("");
  elements.readinessPill.textContent = passed === checks.length ? "可以发布" : `${passed} / ${checks.length} 就绪`;
  elements.readinessPill.classList.toggle("ready", passed === checks.length);
}

function renderProfile() {
  const name = state.profile?.name || "体验者";
  elements.profileName.textContent = name;
  elements.profileAvatar.textContent = name.slice(0, 1);
  elements.profileForm.elements.name.value = name;
  elements.profileForm.elements.role.value = state.profile?.role || "";
}

function renderView() {
  $$(".view-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.view === state.activeView));
  $$(".view-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === state.activeView));
}

function renderAll({ preserveBrief = false } = {}) {
  const project = activeProject();
  if (!project) return;
  document.documentElement.dataset.theme = state.theme;
  elements.projectTitle.textContent = project.title;
  elements.projectKicker.textContent = project.status === "complete" ? "本轮交付完成" : project.paused ? "协作已暂停" : "团队正在协作";
  if (!preserveBrief) elements.briefInput.value = project.brief;
  renderProjectList();
  renderModeSwitcher();
  renderMetrics(project);
  renderAgents(project);
  renderArtifacts(project);
  renderBoard(project);
  renderPublish(project);
  renderProfile();
  renderView();
  syncRunLoop();
}

function syncRunLoop() {
  clearTimeout(runTimer);
  const project = activeProject();
  if (!project || project.status !== "running" || project.paused) return;
  runTimer = setTimeout(() => {
    const current = activeProject();
    const updated = advanceProject(current);
    updateProject(updated);
    const newlyDone = updated.agents.filter((agent) => agent.status === "done").at(-1);
    state.activeArtifactByProject[updated.id] = newlyDone?.key || updated.agents[0].key;
    renderAll();
    if (updated.status === "complete") showToast("团队接力完成，交付物已汇总");
  }, 1200);
}

function renderDialogModes() {
  elements.dialogModeOptions.innerHTML = Object.entries(MODES)
    .map(
      ([key, mode], index) => `
        <label class="mode-option">
          <input type="radio" name="mode" value="${key}" ${index === 0 ? "checked" : ""} />
          <span class="mode-option-dot ${mode.accent}"></span>
          <span><strong>${escapeHTML(mode.label)}</strong><small>${escapeHTML(mode.description)}</small></span>
          <i>✓</i>
        </label>`
    )
    .join("");
}

function openProjectDialog() {
  elements.projectForm.reset();
  const teamRadio = elements.projectForm.querySelector('input[value="team"]');
  if (teamRadio) teamRadio.checked = true;
  elements.projectDialog.showModal();
  requestAnimationFrame(() => elements.projectForm.elements.title.focus());
}

function closeSidebar() {
  elements.sidebar.classList.remove("mobile-open");
  elements.sidebarScrim.classList.remove("visible");
}

function downloadSnapshot() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `molecule-${activeProject().title.replace(/[^\w\u4e00-\u9fa5-]+/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("项目快照已下载");
}

elements.projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-id]");
  if (!button) return;
  state.activeProjectId = button.dataset.projectId;
  draftMode = activeProject().mode;
  persist();
  closeSidebar();
  renderAll();
});

elements.modeSwitcher.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  draftMode = button.dataset.mode;
  renderModeSwitcher();
});

elements.artifactTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-agent-key]");
  if (!button || button.disabled) return;
  state.activeArtifactByProject[activeProject().id] = button.dataset.agentKey;
  persist();
  renderArtifacts(activeProject());
});

elements.kanban.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-id]");
  if (!button) return;
  const project = activeProject();
  const tasks = project.tasks.map((task) =>
    task.id === button.dataset.taskId ? { ...task, status: cycleTaskStatus(task.status) } : task
  );
  updateProject({ ...project, tasks, updatedAt: new Date().toISOString() });
  renderAll({ preserveBrief: true });
  showToast("任务状态已推进");
});

$("#run-team-button").addEventListener("click", () => {
  const brief = elements.briefInput.value.trim();
  if (brief.length < 8) {
    elements.briefInput.focus();
    showToast("再多写一点目标或用户，团队会做得更好");
    return;
  }
  const restarted = restartProject(activeProject(), brief, draftMode);
  state.activeArtifactByProject[restarted.id] = restarted.agents[0].key;
  updateProject(restarted);
  renderAll();
  showToast(`${MODES[draftMode].label}已开始工作`);
});

elements.pauseButton.addEventListener("click", () => {
  const project = activeProject();
  if (project.status === "complete") return;
  updateProject({ ...project, paused: !project.paused, updatedAt: new Date().toISOString() });
  renderAll({ preserveBrief: true });
  showToast(project.paused ? "团队已继续工作" : "团队已暂停");
});

$$(".view-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    persist();
    renderView();
  });
});

$("#new-project-button").addEventListener("click", openProjectDialog);
$("#mobile-menu-button").addEventListener("click", () => {
  elements.sidebar.classList.add("mobile-open");
  elements.sidebarScrim.classList.add("visible");
});
elements.sidebarScrim.addEventListener("click", closeSidebar);

$$(".close-dialog").forEach((button) => button.addEventListener("click", () => elements.projectDialog.close()));
$$(".close-profile").forEach((button) => button.addEventListener("click", () => elements.profileDialog.close()));

elements.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.projectForm);
  const project = createProject(Object.fromEntries(formData));
  state.projects.unshift(project);
  state.activeProjectId = project.id;
  state.activeArtifactByProject[project.id] = project.agents[0].key;
  state.activeView = "studio";
  draftMode = project.mode;
  persist();
  elements.projectDialog.close();
  renderAll();
  showToast("新项目已创建，团队开始接力");
});

$("#profile-button").addEventListener("click", () => elements.profileDialog.showModal());
elements.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.profileForm);
  state.profile = { name: formData.get("name").trim(), role: formData.get("role").trim() };
  persist();
  elements.profileDialog.close();
  renderProfile();
  showToast("工作区资料已保存");
});

$("#reset-data-button").addEventListener("click", () => {
  if (!window.confirm("确定清空全部本地项目并恢复演示数据吗？")) return;
  state = initialState();
  draftMode = activeProject().mode;
  persist();
  elements.profileDialog.close();
  renderAll();
  showToast("已恢复初始工作区");
});

$("#theme-button").addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  persist();
  renderAll({ preserveBrief: true });
});

$("#export-button").addEventListener("click", downloadSnapshot);
$("#download-snapshot-button").addEventListener("click", downloadSnapshot);
$("#import-snapshot-button").addEventListener("click", () => elements.importInput.click());

elements.importInput.addEventListener("change", async () => {
  const [file] = elements.importInput.files;
  if (!file) return;
  try {
    state = parseImportedState(await file.text());
    draftMode = activeProject().mode;
    persist("导入完成");
    renderAll();
    showToast("项目快照已恢复");
  } catch (error) {
    showToast(error.message || "导入失败");
  } finally {
    elements.importInput.value = "";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  event.preventDefault();
  openProjectDialog();
});

renderDialogModes();
renderAll();
persist();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
