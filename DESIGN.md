# Atoms Demo 设计与架构

## 产品主线

界面围绕“对话 + App Viewer”组织，而不是围绕模式组织。项目列表、Console 和 Files 均为次级入口；意图、澄清、计划、工具执行和验证统一出现在对话时间线中。

## Agent runtime

```text
用户输入
  ↓
意图识别 ── 信息不足 ──→ 结构化澄清 ──→ 恢复规划
  ↓
动态专家/工具计划
  ↓
人工批准
  ↓
按依赖执行受控工具 → 共享结构化产物
  ↓
生成应用 UI schema
  ↓
验证 ── 失败 ──→ 单次重规划/修复
  ↓
App Viewer + Working Process
```

模块边界：

- `agent/intent.mjs`：意图、置信度、澄清判断与问题结构
- `agent/runtime.mjs`：阶段、审批、Agent loop、工具调度、验证与事件流
- `agent/tools.mjs`：受控工具、计划/产物规范化、质量验证
- `agent/model.mjs`：DeepSeek Flash 请求，供 Node 和 Cloudflare 复用
- `server.mjs` / `worker.mjs`：本地与 Cloudflare 运行边界
- `site/js/`：工作区状态、对话过程、App Viewer 和可视编辑

## 稳定性与安全

- 模型输出必须通过 schema 规范化和长度限制。
- 所有工具是本地受控函数，不接受模型提供的任意命令。
- 计划审批是执行边界；产物校验失败最多自动修复一次。
- Cloudflare API 只接受同源 JSON 请求，限制大小、上下文字段和调用频率。
- 浏览器只接收规范化事件和产物，永远拿不到 DeepSeek Key。

## 当前边界

本项目复刻的是 Atoms 产品体验和 Agent 内核，不是云 IDE：没有隔离代码沙箱、真实数据库/Auth、OAuth 连接器、生成应用的独立部署和完整版本回放。这些能力应在下一阶段沿现有 runtime 事件与产物边界扩展，而不是把任意执行能力塞进前端。
