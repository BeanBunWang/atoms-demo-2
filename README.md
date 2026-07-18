# Atoms Demo · AI App Builder

一个可运行的 Atoms-like Agent 应用构建工作台，覆盖“描述目标 → 意图识别 → 专家路由 → 计划审批 → 工具执行 → 质量验证 → 应用预览/可视编辑”的完整主线。

> 非官方项目，与 Atoms 无隶属关系。本地服务端使用 DeepSeek V4 Flash 驱动真实 Agent runtime；生成的应用代码只展示、不执行，发布仍为安全模拟。

## 在线体验

- GitHub Pages：<https://beanbunwang.github.io/atoms-demo/>
- GitHub 源码：<https://github.com/BeanBunWang/atoms-demo>

## 使用真实 DeepSeek 运行

项目使用 Node.js 标准库，不需要安装依赖。复制环境变量模板并填写密钥：

```bash
cp .env.example .env
```

启动应用：

```bash
npm start
```

打开 <http://127.0.0.1:4173>。页面顶部显示 `deepseek-v4-flash 已连接` 时，新需求会经过真实的意图识别、动态规划、工具执行和验证流程。

`.env` 已被 Git 忽略，API Key 只由 `server.mjs` 读取，不会发送到浏览器或进入 GitHub Pages 产物。

## 无密钥静态运行

仅体验本地规则降级版本时：

```bash
python3 -m http.server 4173 -d site
```

打开 <http://localhost:4173>。GitHub Pages 在线 Demo 也使用这一降级路径，因为纯静态托管无法安全保存 API Key。

## 可操作功能

- DeepSeek V4 Flash 先识别 `build / modify / research / data / campaign / video` 意图，再按任务选择专家
- Mike 生成带依赖关系的执行计划；人工批准前不会进入构建
- Emma、Iris、Bob、Alex、David、Sarah、Adrian 按计划调用受控工具，并把产物作为下游上下文
- 结构、话题关联、布局差异和文件清单验证；失败时最多自动重规划一次
- Build / Team / Race / Research 模式，以及 Team Mode、附件、连接器上下文、Deep Research、Race Mode 能力入口
- 根据话题选择 dashboard / tracker / catalog / planner / community / landing 布局，生成不同模块和示例数据
- 在 App Viewer 中切换 Preview / Code 与桌面、平板、手机尺寸
- 开启 Design mode，点击预览元素修改标题、说明和主题色
- 查看实时意图、决策、专家状态、工具调用、验证结果、终端日志与生成文件列表
- 模拟发布、分享地址、导出工作区，并通过 localStorage 自动保存
- 响应式布局、键盘焦点、减少动态效果和离线 PWA

首次打开会加载一个完成构建的演示项目。新建项目可体验完整 Agent runtime；运行中可直接观察意图、路由、工具与验证事件。

## 验证

```bash
npm test
npm run check
```

## 部署

本仓库使用 GitHub Actions 自动发布 `site/` 到 GitHub Pages。静态站不会包含 `.env`，因此在线版使用明确标识的本地降级流程；真实 runtime 请用 `npm start`。

Cloudflare Pages 也可免费部署：导入仓库、构建命令留空、输出目录填写 `site`。`site/_headers` 已提供基础安全响应头。

## 文档

- [交付说明](./DELIVERY_NOTES.md)
- [重构计划](./REPLAN.md)
- [设计说明](./DESIGN.md)
- [品牌与视觉来源](./BRAND_SPEC.md)
