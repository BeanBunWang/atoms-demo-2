const text = (value) => String(value ?? "");

function fingerprint(value) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pv-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function check(key, passed, message) {
  return { key, passed: Boolean(passed), message };
}

export function verifyPreviewArtifact(workspace, rendered = {}) {
  const preview = workspace?.preview || {};
  const sections = Array.isArray(preview.sections) ? preview.sections : [];
  const sectionIds = sections.map((section) => section?.id).filter(Boolean);
  const code = text(workspace?.code);
  const component = preview.appType === "calculator" ? "<Calculator" : preview.appType === "snake" ? "<SnakeGame" : "<Section";
  const checks = [
    check("schema", Boolean(preview.title && preview.subtitle && preview.appType), "标题、说明和应用类型完整"),
    check("sections", sections.length >= 3 && sectionIds.length === sections.length && new Set(sectionIds).size === sectionIds.length, "至少三个带稳定 ID 的模块"),
    check("code-sync", code.includes(text(preview.title)) && code.includes(component) && sections.every((section) => code.includes(text(section.title))), "Code 与当前 Preview schema 同步"),
    check("behavior", ["generic", "calculator", "snake"].includes(preview.appType) && (preview.appType === "generic" || code.includes(component)), "领域行为运行时已连接"),
    check("render", rendered.checked !== true || (rendered.title === preview.title && rendered.sectionCount === sections.length && rendered.appType === preview.appType), "浏览器实际渲染与 schema 一致")
  ];
  const issues = checks.filter((item) => !item.passed).map((item) => item.message);
  return {
    passed: issues.length === 0,
    status: issues.length ? "failed" : "passed",
    fingerprint: fingerprint({ preview, code }),
    checks,
    issues
  };
}

export function recordPreviewVerification(workspace, rendered = {}, source = "manual", now = new Date().toISOString()) {
  const result = { ...verifyPreviewArtifact(workspace, rendered), source, checkedAt: now, revision: workspace.artifactRevision || 0 };
  const feedback = {
    id: `feedback-${Date.parse(now) || Date.now()}`,
    type: result.passed ? "preview.passed" : "preview.failed",
    source,
    revision: result.revision,
    fingerprint: result.fingerprint,
    issues: result.issues,
    at: now
  };
  return {
    ...workspace,
    previewVerification: result,
    previewFeedback: [...(workspace.previewFeedback || []), feedback].slice(-12)
  };
}

export function buildPreviewFixPrompt(verification) {
  const issues = verification?.issues?.length ? verification.issues.join("；") : "Preview 与当前产物不一致";
  return `修复 Preview 验证问题：${issues}。保持现有功能、内容、主题和应用类型，只修改失败项。`;
}
