# Atoms Demo · AI App Builder

一个可运行的 Atoms-like Agent 应用构建工作台，覆盖“描述目标 → 意图识别 → 专家路由 → 计划审批 → 工具执行 → 质量验证 → 应用预览/可视编辑”的完整主线。

> 非官方项目，与 Atoms 无隶属关系。本地 Node 服务与 Cloudflare Worker 均可使用 DeepSeek V4 Flash 驱动真实 Agent runtime；生成的应用代码只展示、不执行，应用内 Publish 仍为安全模拟。

## 在线体验

- GitHub Pages（公开演示，规则降级）：<https://beanbunwang.github.io/atoms-demo/>
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

如果 4173 端口已被占用，可执行 `PORT=4174 npm start`。

`.env` 已被 Git 忽略，API Key 只由服务端读取，不会发送到浏览器或进入静态产物。

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

## 部署取舍

| 方案 | 免费额度与限制 | 服务端 Secret | 本项目结论 |
| --- | --- | --- | --- |
| GitHub Pages | 公开仓库可免费使用；软带宽上限 100 GB/月 | 不支持 | 已部署，适合稳定公开评审与无密钥降级体验 |
| Cloudflare Workers | 免费层 10 万次 Worker 请求/天；静态资源请求免费且不限量 | 支持 | 推荐用于在线真实模型；代码与限流配置已就绪 |
| Vercel Hobby | 个人非商业项目免费；包含 Functions 用量 | 支持 | 可行备选，但本项目不再增加第二套部署适配 |

资料：[Cloudflare Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Cloudflare 静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Vercel Hobby](https://vercel.com/docs/plans/hobby)、[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。

仓库默认由 GitHub Actions 发布 `site/` 到 GitHub Pages。静态站不会包含 `.env`，因此在线公开地址使用明确标识的规则降级；本地 `npm start` 使用真实 DeepSeek。

### Cloudflare 在线真实模型

`worker.mjs` 会同时提供静态站和 `/api/agent/*`，并启用同源校验、32 KB 请求上限、上下文白名单、每 IP 每分钟 6 次限流和 CSP。部署时把 Key 写入 Cloudflare Secret，禁止写入 `wrangler.jsonc`：

```bash
npx wrangler@4.36.0 login
npx wrangler@4.36.0 secret put DEEPSEEK_API_KEY
npm run deploy:cloudflare
```

当前工作环境没有已登录的 Cloudflare 账户，因此没有代替仓库所有者创建账户或上传密钥；Worker 已通过 dry-run，可在账户就绪后直接部署。

## 文档

- [交付说明](./DELIVERY_NOTES.md)
- [重构计划](./REPLAN.md)
- [设计说明](./DESIGN.md)
- [品牌与视觉来源](./BRAND_SPEC.md)
