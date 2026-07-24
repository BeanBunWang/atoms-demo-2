import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCodeDraft,
  locateSourceFile,
  normalizeSourceFiles,
  parsePreviewConfig,
  sanitizeSafeCss,
  scopeCssSelectors,
  updateSourceFile
} from "../site/js/code-workspace.js";

const appWithConfig = (preview) => `/* ATOMS_CONFIG_START
${JSON.stringify({ preview }, null, 2)}
ATOMS_CONFIG_END */
export default function App() {
  return <main className="app">${preview.title}</main>;
}`;

test("source files normalize, locate, and update without mutating input", () => {
  const input = {
    "./src/App.jsx": appWithConfig({ title: "旧应用" }),
    "src/styles.css": { content: ".card { color: red; }", status: "added" }
  };
  const files = normalizeSourceFiles(input);
  const nextAppCode = appWithConfig({ title: "新应用" });
  const updated = updateSourceFile(files, "src/App.jsx", { content: nextAppCode });

  assert.deepEqual(files.map((file) => file.path), ["src/App.jsx", "src/styles.css"]);
  assert.equal(locateSourceFile(updated, "src/App.jsx").file.content.includes("新应用"), true);
  assert.equal(locateSourceFile(updated, "src/App.jsx").file.lines, nextAppCode.split(/\r\n|\r|\n/).length);
  assert.equal(locateSourceFile(files, "src/App.jsx").file.content.includes("旧应用"), true);
});

test("preview config is parsed from app.config.json before App.jsx markers", () => {
  const result = parsePreviewConfig([
    { path: "src/App.jsx", content: appWithConfig({ title: "App 标记" }) },
    { path: "app.config.json", content: JSON.stringify({ preview: { title: "配置文件", accent: "#246bfd" } }) }
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.preview, { title: "配置文件", accent: "#246bfd" });
  assert.equal(result.source, "app.config.json");
});

test("safe CSS sanitizer rejects active content vectors", () => {
  for (const css of [
    '@import "theme.css";',
    ".hero { background: url(https://example.com/a.png); }",
    ".hero { width: expression(alert(1)); }",
    ".hero { behavior: url(#default#VML); }",
    ".hero { color: javascript:alert(1); }"
  ]) {
    assert.equal(sanitizeSafeCss(css).ok, false);
  }
});

test("CSS selectors are scoped under generated app including nested media rules", () => {
  const result = scopeCssSelectors(`
:root { --accent: #246bfd; }
body { margin: 0; }
.hero, button:hover { color: var(--accent); }
@media (max-width: 700px) { .hero { display: block; } }
`);

  assert.equal(result.ok, true);
  assert.match(result.css, /\.generated-app\s*\{\s*--accent:/);
  assert.match(result.css, /\.generated-app\s*\{\s*margin:/);
  assert.match(result.css, /\.generated-app \.hero, \.generated-app button:hover\s*\{/);
  assert.match(result.css, /@media \(max-width: 700px\)\s*\{\.generated-app \.hero\s*\{/);
});

test("applying a valid code draft is atomic and records a new version", () => {
  const original = {
    id: "w1",
    preview: { title: "旧应用" },
    code: appWithConfig({ title: "旧应用" }),
    files: [
      { path: "src/App.jsx", content: appWithConfig({ title: "旧应用" }) },
      { path: "src/styles.css", content: ".card { color: red; }" }
    ],
    artifactRevision: 2,
    versions: [{ revision: 2, files: ["src/App.jsx"] }]
  };
  const result = applyCodeDraft(
    original,
    {
      files: [
        { path: "src/App.jsx", content: appWithConfig({ title: "新应用", accent: "#111111" }) },
        { path: "src/styles.css", content: ".card { color: blue; }" }
      ]
    },
    { now: "2026-07-24T10:00:00.000Z", source: "test" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.artifactRevision, 3);
  assert.equal(result.workspace.preview.title, "新应用");
  assert.equal(result.workspace.lastKnownGood.preview, original.preview);
  assert.equal(result.workspace.versions.length, 2);
  assert.equal(result.workspace.versions.at(-1).revision, 3);
  assert.match(locateSourceFile(result.workspace.files, "src/styles.css").file.content, /\.generated-app \.card/);
  assert.equal(original.artifactRevision, 2);
  assert.equal(original.preview.title, "旧应用");
});

test("invalid drafts return errors and preserve the exact workspace object", () => {
  const original = {
    id: "w1",
    preview: { title: "稳定版" },
    code: appWithConfig({ title: "稳定版" }),
    files: [{ path: "src/App.jsx", content: appWithConfig({ title: "稳定版" }) }],
    artifactRevision: 4,
    versions: []
  };
  const result = applyCodeDraft(original, {
    files: [
      { path: "src/App.jsx", content: "export default function App() { return null; }" },
      { path: "src/styles.css", content: ".hero { background: url(https://example.com/unsafe.png); }" }
    ]
  });

  assert.equal(result.ok, false);
  assert.equal(result.workspace, original);
  assert.equal(original.artifactRevision, 4);
  assert.match(result.errors.join(" "), /url\(\)/);
  assert.match(result.errors.join(" "), /ATOMS_CONFIG_START/);
});
