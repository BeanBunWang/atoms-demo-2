import { createDemoProject } from "./planner.js";

export const STORAGE_KEY = "molecule-workspace-v1";

export function initialState() {
  const demo = createDemoProject();
  return {
    version: 1,
    theme: "light",
    activeView: "studio",
    activeProjectId: demo.id,
    activeArtifactByProject: { [demo.id]: "lead" },
    profile: { name: "体验者", role: "独立创造者" },
    projects: [demo]
  };
}

export function isValidState(value) {
  return Boolean(
    value &&
      value.version === 1 &&
      Array.isArray(value.projects) &&
      value.projects.every((project) => project?.id && project?.title && Array.isArray(project.agents) && Array.isArray(project.tasks))
  );
}

export function loadState(storage = globalThis.localStorage) {
  if (!storage) return initialState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : initialState();
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
  if (!isValidState(parsed)) throw new Error("这不是有效的 Molecule 项目快照");
  return parsed;
}
