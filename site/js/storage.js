import { createDemoWorkspace } from "./planner.js?v=13";

export const STORAGE_KEY = "atoms-demo-workspace-v5";

export function initialState() {
  const workspace = createDemoWorkspace();
  return {
    version: 5,
    activeWorkspaceId: workspace.id,
    activePanel: "preview",
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
      value.version === 5 &&
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
  return {
    ...workspace,
    artifactRevision,
    lastKnownGood: workspace.lastKnownGood || null,
    pendingChange: workspace.pendingChange || null,
    previewVerification: workspace.previewVerification || null,
    previewFeedback: Array.isArray(workspace.previewFeedback) ? workspace.previewFeedback : [],
    preview: workspace.preview ? { ...workspace.preview, sections } : workspace.preview
  };
}

function migrateState(state) {
  return { ...state, workspaces: state.workspaces.map(migrateWorkspace) };
}

export function loadState(storage = globalThis.localStorage) {
  if (!storage) return initialState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? migrateState(parsed) : initialState();
  } catch {
    return initialState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
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
