const CONFIG_START = "ATOMS_CONFIG_START";
const CONFIG_END = "ATOMS_CONFIG_END";
const GENERATED_SCOPE = ".generated-app";
const DANGEROUS_CSS_PATTERNS = [
  { pattern: /@import\b/i, message: "CSS cannot use @import" },
  { pattern: /url\s*\(/i, message: "CSS cannot use url()" },
  { pattern: /expression\s*\(/i, message: "CSS cannot use expression()" },
  { pattern: /\bbehavior\s*:/i, message: "CSS cannot use behavior" },
  { pattern: /javascript\s*:/i, message: "CSS cannot reference javascript:" }
];

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function inferType(path) {
  const extension = String(path).split(".").pop()?.toLowerCase() || "txt";
  return extension === "jsx" || extension === "tsx" ? "jsx" : extension;
}

function lineCount(content) {
  const text = String(content ?? "");
  return text ? text.split(/\r\n|\r|\n/).length : 0;
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function normalizeFile(path, value) {
  const source = asPlainObject(value) ? value : { content: value };
  const normalizedPath = normalizePath(source.path || path);
  if (!normalizedPath) return null;
  const hasContent = source.content !== undefined || source.source !== undefined || source.code !== undefined;
  const content = String(source.content ?? source.source ?? source.code ?? "");
  return {
    ...source,
    path: normalizedPath,
    type: source.type || source.language || inferType(normalizedPath),
    language: source.language || source.type || inferType(normalizedPath),
    status: source.status || "modified",
    content,
    lines: hasContent ? lineCount(content) : Math.max(0, Number(source.lines) || 0)
  };
}

export function normalizeSourceFiles(input = []) {
  const files = Array.isArray(input)
    ? input.map((file) => normalizeFile(file?.path, file))
    : asPlainObject(input)
      ? Object.entries(input).map(([path, value]) => normalizeFile(path, value))
      : [];

  const byPath = new Map();
  for (const file of files) {
    if (file) byPath.set(file.path, file);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function locateSourceFile(files, path) {
  const normalizedPath = normalizePath(path);
  const normalizedFiles = normalizeSourceFiles(files);
  const index = normalizedFiles.findIndex((file) => file.path === normalizedPath);
  return index === -1 ? null : { file: normalizedFiles[index], index };
}

export function updateSourceFile(files, path, patch) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) throw new Error("File path is required");
  const normalizedFiles = normalizeSourceFiles(files);
  const index = normalizedFiles.findIndex((file) => file.path === normalizedPath);
  const current = index === -1 ? normalizeFile(normalizedPath, { path: normalizedPath }) : normalizedFiles[index];
  const nextPatch = typeof patch === "function" ? patch(current) : patch;
  const next = normalizeFile(normalizedPath, { ...current, ...(asPlainObject(nextPatch) ? nextPatch : { content: nextPatch }) });
  const result = index === -1 ? [...normalizedFiles, next] : normalizedFiles.map((file, fileIndex) => (fileIndex === index ? next : file));
  return normalizeSourceFiles(result);
}

function parseJsonConfig(raw, source) {
  try {
    const parsed = JSON.parse(raw);
    const preview = asPlainObject(parsed.preview) ? parsed.preview : parsed;
    if (!asPlainObject(preview)) return { ok: false, errors: [`${source} must contain a preview object`] };
    return { ok: true, preview, source };
  } catch (error) {
    return { ok: false, errors: [`${source} contains invalid JSON: ${error.message}`] };
  }
}

function extractAppConfig(content) {
  const marker = String(content || "").match(/ATOMS_CONFIG_START(?:\s*\*\/)?\s*([\s\S]*?)\s*(?:\/\*\s*)?ATOMS_CONFIG_END/);
  return marker?.[1]?.trim() || "";
}

export function parsePreviewConfig(files, preferredPath = "") {
  const normalizedFiles = normalizeSourceFiles(files);
  const appConfig = normalizedFiles.find((file) => file.path === "app.config.json" || file.path.endsWith("/app.config.json"));
  const app = normalizedFiles.find((file) => file.path === "src/App.jsx" || file.path.endsWith("/App.jsx"));
  if (/App\.jsx$/.test(preferredPath) && app) {
    const raw = extractAppConfig(app.content);
    if (!raw) return { ok: false, errors: [`src/App.jsx must include ${CONFIG_START}/${CONFIG_END} JSON markers`] };
    return parseJsonConfig(raw, "src/App.jsx");
  }
  if (appConfig) return parseJsonConfig(appConfig.content, "app.config.json");
  if (!app) return { ok: false, errors: ["Missing src/App.jsx or app.config.json"] };
  const raw = extractAppConfig(app.content);
  if (!raw) return { ok: false, errors: [`src/App.jsx must include ${CONFIG_START}/${CONFIG_END} JSON markers`] };
  return parseJsonConfig(raw, "src/App.jsx");
}

export function sanitizeSafeCss(css = "") {
  const text = String(css ?? "");
  const errors = DANGEROUS_CSS_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ message }) => message);
  if (errors.length) return { ok: false, css: "", errors };
  return { ok: true, css: text.trim(), errors: [] };
}

function splitSelectors(selectorText) {
  const selectors = [];
  let current = "";
  let depth = 0;
  for (const char of selectorText) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function scopeSelector(selector) {
  if (!selector || selector.startsWith(GENERATED_SCOPE)) return selector;
  if (selector.startsWith(":root")) return selector.replace(/^:root\b/, GENERATED_SCOPE);
  if (/^(html|body)\b/i.test(selector)) return selector.replace(/^(html|body)\b/i, GENERATED_SCOPE);
  return `${GENERATED_SCOPE} ${selector}`;
}

function findBlockEnd(css, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function scopeCssBlock(css) {
  let output = "";
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf("{", cursor);
    if (open === -1) {
      output += css.slice(cursor);
      break;
    }
    const selector = css.slice(cursor, open).trim();
    const close = findBlockEnd(css, open);
    if (close === -1) {
      output += css.slice(cursor);
      break;
    }
    const body = css.slice(open + 1, close);
    if (selector.startsWith("@")) {
      if (/^@(media|supports|container|layer)\b/i.test(selector)) {
        output += `${selector} {${scopeCssBlock(body)}}`;
      } else {
        output += `${selector} {${body}}`;
      }
    } else {
      const scoped = splitSelectors(selector).map(scopeSelector).join(", ");
      output += `${scoped} {${body}}`;
    }
    cursor = close + 1;
  }
  return output;
}

export function scopeCssSelectors(css = "") {
  const safe = sanitizeSafeCss(css);
  if (!safe.ok) return safe;
  return { ok: true, css: scopeCssBlock(safe.css), errors: [] };
}

function collectDraftFiles(draft) {
  if (Array.isArray(draft)) return draft;
  if (!asPlainObject(draft)) return [];
  if (draft.files) return draft.files;
  if (draft.sourceFiles) return draft.sourceFiles;
  return draft;
}

function mergeDraftFiles(currentFiles, draftFiles) {
  return normalizeSourceFiles(draftFiles).reduce((files, file) => updateSourceFile(files, file.path, file), currentFiles);
}

function validateFiles(files) {
  const errors = [];
  let nextFiles = files;
  for (const file of files) {
    if (file.path.endsWith(".css")) {
      const scoped = scopeCssSelectors(file.content);
      if (!scoped.ok) {
        errors.push(...scoped.errors.map((error) => `${file.path}: ${error}`));
      } else {
        nextFiles = updateSourceFile(nextFiles, file.path, { ...file, content: scoped.css, lines: lineCount(scoped.css) });
      }
    }
  }
  return { ok: errors.length === 0, files: nextFiles, errors };
}

function syncPreviewSources(files, preview, preferredPath) {
  let next = files;
  const configPath = files.find((file) => file.path === "app.config.json" || file.path.endsWith("/app.config.json"))?.path || "src/app.config.json";
  next = updateSourceFile(next, configPath, {
    language: "json",
    content: `${JSON.stringify({ schemaVersion: 2, preview }, null, 2)}\n`
  });
  if (!/App\.jsx$/.test(preferredPath)) {
    const app = next.find((file) => file.path === "src/App.jsx" || file.path.endsWith("/App.jsx"));
    if (app) {
      const start = app.content.indexOf(CONFIG_START);
      const end = app.content.indexOf(CONFIG_END, start + CONFIG_START.length);
      if (start >= 0 && end > start) {
        const before = app.content.slice(0, start + CONFIG_START.length);
        const after = app.content.slice(end);
        next = updateSourceFile(next, app.path, { content: `${before}\n${JSON.stringify(preview, null, 2)}\n${after}` });
      }
    }
  }
  return next;
}

function workspaceFiles(workspace) {
  const fromFiles = normalizeSourceFiles(workspace?.sourceFiles || workspace?.files || []);
  const app = locateSourceFile(fromFiles, "src/App.jsx")?.file;
  if (workspace?.code && (!app || !app.content)) {
    return updateSourceFile(fromFiles, "src/App.jsx", { type: "jsx", status: "modified", content: workspace.code });
  }
  return fromFiles;
}

export function applyCodeDraft(workspace, draft, options = {}) {
  const baseFiles = workspaceFiles(workspace);
  const draftFiles = normalizeSourceFiles(collectDraftFiles(draft));
  const mergedFiles = mergeDraftFiles(baseFiles, draftFiles);
  const validation = validateFiles(mergedFiles);
  const previewResult = parsePreviewConfig(validation.files, draftFiles[0]?.path);
  const errors = [...validation.errors, ...(previewResult.ok ? [] : previewResult.errors)];
  if (errors.length) return { ok: false, workspace, errors };
  const synchronizedFiles = syncPreviewSources(validation.files, previewResult.preview, draftFiles[0]?.path || "");

  const now = options.now || new Date().toISOString();
  const currentRevision = Math.max(0, Number(workspace?.artifactRevision) || 0);
  const nextRevision = currentRevision + 1;
  const appFile = locateSourceFile(synchronizedFiles, "src/App.jsx")?.file;
  const version = {
    revision: nextRevision,
    createdAt: now,
    source: options.source || "code-draft",
    files: synchronizedFiles.map((file) => file.path),
    preview: previewResult.preview,
    code: appFile?.content ?? workspace?.code ?? "",
    sourceFiles: synchronizedFiles
  };
  const nextWorkspace = {
    ...workspace,
    preview: previewResult.preview,
    code: appFile?.content ?? workspace?.code ?? "",
    files: synchronizedFiles,
    sourceFiles: synchronizedFiles,
    hasBuiltArtifact: true,
    artifactRevision: nextRevision,
    lastKnownGood: {
      preview: workspace?.preview || null,
      code: workspace?.code || "",
      files: workspaceFiles(workspace),
      revision: currentRevision
    },
    versions: [...(Array.isArray(workspace?.versions) ? workspace.versions : []), version],
    pendingChange: null,
    candidateArtifact: null,
    previewVerification: null,
    updatedAt: now,
    published: false
  };
  return { ok: true, workspace: nextWorkspace, preview: previewResult.preview, revision: nextRevision, changedFiles: synchronizedFiles.map((file) => file.path), errors: [] };
}
