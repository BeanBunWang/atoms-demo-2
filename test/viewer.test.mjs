import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  COMPONENT_LIBRARY,
  DESIGN_TABS,
  THEME_PRESETS,
  createLibrarySection,
  initialPreviewInteraction,
  normalizeDesignTab,
  normalizePreviewInteraction,
  themePatch
} from "../site/js/viewer.js";
import { createWorkspace, updatePreview } from "../site/js/planner.js";

test("Design 三个子工具均为受控功能入口", () => {
  assert.deepEqual(DESIGN_TABS, ["visual", "library", "theme"]);
  assert.equal(normalizeDesignTab("library"), "library");
  assert.equal(normalizeDesignTab("unknown"), "visual");
  assert.equal(COMPONENT_LIBRARY.length, 4);
});

test("主题预设会生成可持久化的完整 preview patch", () => {
  for (const theme of THEME_PRESETS) {
    assert.deepEqual(themePatch(theme.id), {
      accent: theme.accent,
      background: theme.background,
      headingStyle: theme.headingStyle,
      themeId: theme.id
    });
  }
  assert.equal(themePatch("missing").themeId, THEME_PRESETS[0].id);
});

test("组件库生成独立、可渲染的安全 section schema", () => {
  const first = createLibrarySection("timeline", 1);
  const second = createLibrarySection("timeline", 1);
  assert.notEqual(first, second);
  assert.equal(first.type, "timeline");
  assert.ok(Array.isArray(first.items));
  first.items[0].title = "changed";
  assert.notEqual(first.items[0].title, second.items[0].title);
});

test("Library 与 Theme 修改会完整同步到生成代码", () => {
  const workspace = createWorkspace({ title: "测试应用", prompt: "做一个任务应用", mode: "auto" });
  const stats = createLibrarySection("stats", 0);
  const withStats = updatePreview(workspace, { sections: [stats] });
  assert.match(withStats.code, /description="关键指标"|description="快速了解当前产品状态。"/);
  assert.match(withStats.code, /metrics=\{\[/);
  assert.match(withStats.code, /"已完成"/);

  const themed = updatePreview(workspace, themePatch("forest"));
  assert.match(themed.code, /data-theme="forest"/);
  assert.match(themed.code, /data-heading="studio"/);
  assert.match(themed.code, /background: "#f2f7f1"/);
});

test("刷新使用确定性的预览交互初始状态", () => {
  assert.deepEqual(initialPreviewInteraction(), { activeSection: "home", primaryDone: false, selectedItems: [] });
  assert.deepEqual(normalizePreviewInteraction("broken"), initialPreviewInteraction());
  assert.deepEqual(normalizePreviewInteraction({ activeSection: 4, primaryDone: "yes", selectedItems: ["0:0", 2] }), {
    activeSection: "home",
    primaryDone: false,
    selectedItems: ["0:0"]
  });
});

test("App Viewer 可见按钮均连接到明确命令", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../site/js/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../site/styles.css", import.meta.url), "utf8");

  for (const tab of DESIGN_TABS) assert.match(html, new RegExp(`data-design-tab="${tab}"`));
  for (const command of ["home", "primary", "secondary", "profile", "runtime", "reset", "primary-action"]) {
    assert.match(html, new RegExp(`data-preview-command="${command}"`));
  }
  assert.match(app, /elements\.componentLibrary\.addEventListener\("click"/);
  assert.match(app, /elements\.themePresets\.addEventListener\("click"/);
  assert.match(app, /state\.previewInteractions\[activeWorkspace\(\)\.id\] = initialPreviewInteraction\(\)/);
  assert.match(app, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.design-sidebar\s*\{[^}]*display:\s*flex/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.viewer-tools \.device-switcher\s*\{[^}]*display:\s*flex/);
});
