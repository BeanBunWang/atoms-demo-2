import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("对话和 App Viewer 各自拥有受视口约束的滚动容器", async () => {
  const css = await readFile(new URL("../site/styles.css", import.meta.url), "utf8");

  assert.match(css, /html, body\s*\{[^}]*overflow:\s*hidden[^}]*overscroll-behavior:\s*none/s);
  assert.match(css, /@supports \(height:\s*100dvh\)/);
  assert.match(css, /\.app-shell\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.workspace\s*\{[^}]*grid-template-rows:\s*58px minmax\(0,\s*1fr\)[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.builder\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.conversation-panel\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.message-stream\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain[^}]*scrollbar-gutter:\s*stable/s);
  assert.match(css, /\.viewer-panel\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.design-shell\s*\{[^}]*height:\s*100%[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.design-preview\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain[^}]*scrollbar-gutter:\s*stable/s);
  assert.match(css, /:where\(\.message-stream, \.design-preview,[^)]+\)\s*\{[^}]*scrollbar-width:\s*thin/s);
});
