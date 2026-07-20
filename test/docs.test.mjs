import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const deliveryUrl = new URL("../交付说明.md", import.meta.url);
const architectureUrl = new URL("../架构设计.md", import.meta.url);

test("中文交付文档存在且 README 使用中文文件名", async () => {
  await Promise.all([access(deliveryUrl), access(architectureUrl)]);
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /\.\/交付说明\.md/);
  assert.match(readme, /\.\/架构设计\.md/);
  assert.doesNotMatch(readme, /DELIVERY_NOTES\.md|DESIGN\.md/);
});

test("交付说明完整覆盖评审要求和未完成边界", async () => {
  const delivery = await readFile(deliveryUrl, "utf8");
  for (const heading of ["实现方案", "技术取舍", "当前完成程度", "验证结果", "完成边界与已知问题", "后续扩展优先级"]) {
    assert.match(delivery, new RegExp(`## ${heading}`));
  }
  for (const requirement of ["真实交互", "数据持久化", "基本使用流程", "至少一个延展能力", "可测试在线链接", "实际可用而非纯 PoC"]) {
    assert.match(delivery, new RegExp(requirement));
  }
  assert.match(delivery, /任意代码执行 \| 未完成/);
  assert.match(delivery, /真实 Publish \/ 连接器 \/ 后端 \| 未完成/);
  assert.match(delivery, /计算器[\s\S]*贪吃蛇/);
  assert.match(delivery, /增量修改/);
  assert.match(delivery, /\d+ 项全部通过/);
  assert.match(delivery, /P0[\s\S]*隔离代码沙箱/);
});
