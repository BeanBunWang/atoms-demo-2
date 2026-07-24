import { createDemoWorkspace } from "./planner.js?v=15";

export const STORAGE_KEY = "atoms-demo-workspace-v6";
export const LEGACY_STORAGE_KEY = "atoms-demo-workspace-v5";

export function initialState() {
  const workspace = createDemoWorkspace();
  return {
    version: 6,
    activeWorkspaceId: workspace.id,
    activeView: "home",
    activePanel: "preview",
    activeCodeFile: "src/App.jsx",
    activeRail: "terminal",
    activeDesignTab: "visual",
    device: "desktop",
    designMode: false,
    previewInteractions: {},
    sidebarOpen: false,
    workspaces: [workspace]
  };
}

export function isValidState(value) {
  return Boolean(
    value &&
      [5, 6].includes(value.version) &&
      typeof value.activeWorkspaceId === "string" &&
      Array.isArray(value.workspaces) &&
      value.workspaces.length > 0 &&
      value.workspaces.every(
        (workspace) =>
          workspace?.id &&
          workspace?.title &&
          Array.isArray(workspace.agents) &&
          Array.isArray(workspace.messages) &&
          Array.isArray(workspace.files)
      )
  );
}

function migrateWorkspace(workspace) {
  const sections = Array.isArray(workspace.preview?.sections)
    ? workspace.preview.sections.map((section, index) => ({ ...section, id: section.id || `section-${index + 1}` }))
    : workspace.preview?.sections;
  const artifactRevision = Math.max(0, Number(workspace.artifactRevision) || (workspace.hasBuiltArtifact ? 1 : 0));
  const interrupted = workspace.runtime?.status === "running" || workspace.phase === "building" || workspace.phase === "planning";
  const messages = Array.isArray(workspace.messages) ? [...workspace.messages] : [];
  if (interrupted) {
    messages.push({
      id: `msg-recovered-${workspace.id}`,
      role: "system",
      text: "上一次运行在页面关闭时中断，已保留最近可用版本。你可以重新发送指令继续。",
      time: new Date().toISOString()
    });
  }
  return {
    ...workspace,
    phase: interrupted ? (workspace.hasBuiltArtifact ? "ready" : "plan-review") : workspace.phase,
    artifactRevision,
    lastKnownGood: workspace.lastKnownGood || null,
    pendingChange: workspace.pendingChange || null,
    previewVerification: workspace.previewVerification || null,
    previewFeedback: Array.isArray(workspace.previewFeedback) ? workspace.previewFeedback : [],
    preview: workspace.preview ? { ...workspace.preview, sections } : workspace.preview,
    messages,
    runtime: interrupted
      ? { ...(workspace.runtime || {}), status: "interrupted", phase: "idle", events: [...(workspace.runtime?.events || []), { type: "run.interrupted", message: "页面关闭导致运行中断" }].slice(-80) }
      : workspace.runtime
  };
}

function migrateState(state) {
  return {
    ...state,
    version: 6,
    activeView: ["home", "builder"].includes(state.activeView) ? state.activeView : "home",
    activePanel: state.activePanel === "code" ? "code" : "preview",
    activeCodeFile: state.activeCodeFile || "src/App.jsx",
    workspaces: state.workspaces.map(migrateWorkspace)
  };
}

export function loadState(storage = globalThis.localStorage, key = STORAGE_KEY, legacyKey = LEGACY_STORAGE_KEY) {
  if (!storage) return initialState();
  try {
    const raw = storage.getItem(key) || (legacyKey ? storage.getItem(legacyKey) : null);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? migrateState(parsed) : initialState();
  } catch {
    return initialState();
  }
}

export function saveState(state, storage = globalThis.localStorage, key = STORAGE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function parseImportedState(text) {
  const parsed = JSON.parse(text);
  if (!isValidState(parsed)) throw new Error("这不是有效的 Atoms Demo 工作区快照");
  return migrateState(parsed);
}
