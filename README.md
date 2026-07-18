# Atoms Demo · AI App Builder

一个可运行的 Atoms-like Demo，聚焦“描述应用 → AI 生成计划 → 审批 → 智能体构建 → 应用预览/可视编辑 → 发布”的完整产品主线。

> 非官方项目，与 Atoms 无隶属关系。本地服务端使用 DeepSeek V4 Flash 生成真实产品计划；智能体接力、代码运行和发布仍为安全模拟。

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

打开 <http://127.0.0.1:4173>。页面顶部显示 `deepseek-v4-flash 已连接` 时，新的应用需求和变更指令会调用真实模型。

`.env` 已被 Git 忽略，API Key 只由 `server.mjs` 读取，不会发送到浏览器或进入 GitHub Pages 产物。

## 无密钥静态运行

仅体验本地规则降级版本时：

```bash
python3 -m http.server 4173 -d site
```

打开 <http://localhost:4173>。GitHub Pages 在线 Demo 也使用这一降级路径，因为纯静态托管无法安全保存 API Key。

## 可操作功能

- 使用 DeepSeek V4 Flash 生成应用计划、预览文案和产品规格
- 输入新的应用需求或变更指令，选择 Build / Team / Race / Research 模式
- 查看 Mike 生成的实施计划，并在批准后启动智能体接力构建
- 在 App Viewer 中切换 Preview / Code 与桌面、平板、手机尺寸
- 开启 Design mode，点击预览元素修改标题、说明和主题色
- 查看智能体状态、终端日志与生成文件列表
- 模拟发布、分享地址、导出工作区，并通过 localStorage 自动保存
- 响应式布局、键盘焦点、减少动态效果和离线 PWA

首次打开会加载一个完成构建的演示项目。新建项目可体验真实模型生成、计划审批与构建流程。

## 验证

```bash
npm test
npm run check
```

## 部署

本仓库使用 GitHub Actions 自动发布 `site/` 到 GitHub Pages。该在线版本不会包含 `.env`，因此自动显示并使用本地规则降级。

Cloudflare Pages 也可免费部署：导入仓库、构建命令留空、输出目录填写 `site`。`site/_headers` 已提供基础安全响应头。

## 文档

- [交付说明](./DELIVERY_NOTES.md)
- [重构计划](./REPLAN.md)
- [设计说明](./DESIGN.md)
- [品牌与视觉来源](./BRAND_SPEC.md)
