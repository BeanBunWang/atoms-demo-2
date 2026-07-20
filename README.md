# Atoms Demo · AI App Builder

一个可运行的 Atoms-like 应用构建器。重点不是模式切换，而是完整 Agent 闭环：

`自然语言 → 意图识别 → 必要时澄清 → 动态计划 → 人工批准 → Agent/工具执行 → 验证修复 → App Viewer`

> 非官方项目，与 Atoms 无隶属关系。生成的应用代码只展示、不执行；应用内 Publish 为产品交互模拟。

## 在线体验

- Cloudflare（真实 DeepSeek）：<https://atoms-demo.beanbunwang-lab.workers.dev>
- GitHub：<https://github.com/BeanBunWang/atoms-demo-2>

## 本地运行

项目仅使用 Node.js 标准库，无需安装依赖：

```bash
cp .env.example .env
npm start
```

打开 <http://127.0.0.1:4173>。模型默认固定为 `deepseek-v4-flash`；`.env` 已被 Git 忽略，API Key 只在服务端读取。

没有密钥时也可运行确定性降级版本：

```bash
python3 -m http.server 4173 -d site
```

## 核心能力

- 直接输入需求，不要求先选 Build / Team / Race / Research
- 识别构建、修改、研究、数据分析、增长和视频类意图
- 仅在关键方向缺失时展示结构化澄清，回答后在同一会话继续
- Mike 根据意图选择必要专家和受控工具，审批前不会执行
- 对话内展示 Working Process、Agent、tool call、tool output、验证与重规划
- 根据话题生成 dashboard / tracker / catalog / planner / community / landing 页面；计算器与贪吃蛇具备专属可操作运行时
- App Viewer 提供可操作的验收工作台：真实刷新、桌面/平板/手机尺寸、Preview/Code、Console/Files 和完整独立预览
- Design 的 Visual Editor 可按 Hero/区块编辑内容与强调色，Library 可添加受控组件，Theme 可应用预置主题；结果同步到 Preview、Code 和本地工作区
- 计算器支持四则运算、百分比、正负号和历史；贪吃蛇支持方向、开始/暂停、碰撞和计分；通用应用的导航、CTA、列表和头像菜单也有真实反馈
- 同一会话可继续提出修改；每轮重新识别意图和计划，同时保留已有应用类型、主题与产物
- 增量修改使用 `baseRevision -> patch -> verify -> commit`；过期或验证失败的候选产物不会覆盖上一个可用版本
- Preview 可手动验证 schema、Code 同步和实际 DOM；失败项可通过 `Fix with Agent` 回灌修复链路
- 支持附件上下文、本地多项目保存、导出、分享和发布状态
- Cloudflare Worker 提供同源校验、32 KB 上限、上下文白名单和每 IP 限流

> App Viewer 与完整预览复用安全 UI schema 和领域交互 runtime，不执行模型生成的任意代码；Publish 仍是演示状态，不会创建真实云资源。

## 验证

```bash
npm test
npm run check
npx wrangler@4.36.0 deploy --dry-run
```

## 部署

Cloudflare Workers 免费层适合本项目：能同时托管静态资源和保存服务端 Secret；免费层包含每日 Worker 请求额度，静态资源请求不计入 Worker 请求额度。部署命令：

```bash
npx wrangler@4.36.0 login
npx wrangler@4.36.0 secret put DEEPSEEK_API_KEY
npm run deploy:cloudflare
```

资料：[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Atoms Help Center](https://help.atoms.dev/zh-CN/)。

## 文档

- [交付说明](./交付说明.md)
- [架构设计](./架构设计.md)
- [品牌与视觉来源](./BRAND_SPEC.md)
