# Atoms Demo 交付说明

## 结论

项目已完成可运行的 Atoms 核心体验复刻，并部署为在线真实模型版本：

- 在线地址：<https://atoms-demo.beanbunwang-lab.workers.dev>
- GitHub：<https://github.com/BeanBunWang/atoms-demo-2>

用户无需选择模式，可以直接描述想法。系统识别意图；只有缺失信息会显著改变产品方向时，Alex 才提出结构化澄清。回答后 Mike 生成动态计划，用户批准后 Agent 执行受控工具，并在对话中持续反馈过程、产物和验证结果，最终更新 App Viewer。

App Viewer 已从静态结果展示升级为可交互的验收工作台：用户可以调整设备视口、检查代码和运行日志、在 Design 中修改内容/组件/主题，并直接验证生成应用的导航与关键操作。所有可见入口都有状态、内容、面板变化或明确反馈，关键 Viewer 状态随工作区保存。

## 完成程度

| 能力 | 状态 | 交付结果 |
| --- | --- | --- |
| 快速开始会话 | 已完成 | 直接输入需求，自动路由 |
| 意图识别 | 已完成 | 区分构建、修改、研究、数据、增长、视频 |
| 多轮澄清 | 已完成 | 结构化选项、同会话恢复规划 |
| 动态计划与审批 | 已完成 | 只选择必要专家，批准前停止 |
| Agent runtime | 已完成 | 真实 loop、流式事件、工具共享产物 |
| Tool use | 已完成 | 研究、产品、设计、应用组合、数据、增长、分镜、验证 |
| 执行反馈 | 已完成 | 对话内 Working Process、tool call/output、验证与重规划 |
| App Viewer 工具栏 | 已完成 | 真实刷新、三档设备尺寸、Preview/Code、Console/Files、完整独立预览 |
| Viewer 设计能力 | 已完成 | Visual Editor 按区块编辑；Library 添加受控组件；Theme 应用预置主题，均同步 Preview/Code |
| 生成应用交互 | 已完成 | 顶部导航、主 CTA、列表项目、头像菜单均可点击并产生可见反馈 |
| 状态管理 | 已完成 | 多项目、本地保存、附件、导出、分享与发布交互 |
| 在线真实模型 | 已完成 | Cloudflare Worker + DeepSeek V4 Flash + Secret + 限流 |
| 任意代码执行 | 未完成 | 当前使用安全 UI schema，不运行模型生成代码 |
| 真实连接器/后端 | 未完成 | GitHub 连接器和 Publish 为演示交互 |

## 关键取舍

- 模式不作为输入门槛，只保留为运行时内部能力提示。
- 模型负责语义判断；schema、受控工具、人工批准和验证器负责稳定性。
- 预览渲染结构化 UI schema，不在浏览器执行任意生成代码。
- DeepSeek Key 只存在于本地 `.env` 或 Cloudflare Secret，不进入仓库和前端。
- Console/Files 收入抽屉，核心执行证据放回对话，使界面更接近 Atoms 创作页。
- Viewer 内所有操作只更新受控 UI schema 或 Viewer state；不注入、不执行模型生成代码。

## App Viewer 完整交付

| 入口 | 行为 |
| --- | --- |
| Refresh | 从当前 workspace schema 重新渲染，重置临时选择与滚动，不丢失主题和内容修改 |
| Desktop / Tablet / Mobile | 切换预览宽度并持久化选择 |
| Design | 开关页面元素编辑状态；Hero 与具体区块使用对应内容填充编辑表单 |
| Visual Editor | 返回应用预览并支持定位、编辑生成区块 |
| Library | 展示当前结构，可添加 cards、stats、timeline、progress 受控组件并同步代码 |
| Theme | 应用四套预置主题，保存强调色、背景与标题风格 |
| Console / Files | 打开 Agent runtime 日志、专家进度和生成文件快照；抽屉不会遮挡工具栏 |
| Code | 在同一 Viewer 内切换生成代码，并保留当前工作区状态 |
| Open preview | 在新窗口打开包含全部区块、导航、CTA 和项目选择的当前快照 |
| 生成应用导航/CTA/项目/头像 | 页内定位、完成/选择状态、运行状态入口与重置操作 |

Viewer 内交互用于验证 UI schema 和产品流程，不代表已接入真实业务数据库；独立预览是当前工作区快照，Publish 仍为模拟发布。

## 后续扩展优先级

1. **P0：隔离代码沙箱**——安装依赖、编译/测试生成代码，把错误送回 runtime 自动修复。
2. **P1：真实发布链路**——为生成应用创建独立部署、版本、回滚和公开链接。
3. **P1：真实连接器**——接入 GitHub、Figma、Supabase OAuth，并补充权限与审计。
4. **P2：版本 Diff 与 Replay**——支持步骤对比、历史恢复和完整创建过程回放。
5. **P2：更强公开防护**——在现有限流外增加 Turnstile 或账号体系。
