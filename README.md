# Molecule · Atoms Demo

一个基于 Atoms「自然语言发起 → 多智能体协作 → 编辑 → 发布/分享」体验设计的可运行 Demo。

## 在线体验

- GitHub Pages：<https://beanbunwang.github.io/atoms-demo/>
- 源代码：<https://github.com/BeanBunWang/atoms-demo>

## 本地运行

无需安装依赖：

```bash
python3 -m http.server 4173 -d site
```

打开 <http://localhost:4173>。

## 功能

- 创建项目并选择团队、工程师、赛马或研究模式
- 查看多智能体协作过程与结构化交付物
- 推进任务看板，数据自动保存到浏览器本地
- 发布检查、JSON 导入导出、离线 PWA 支持
- 响应式布局、深浅主题与减少动态效果支持

首次打开会加载一个演示项目；所有修改只保存在当前浏览器，不会上传个人数据。可通过右下角「清空本地数据」恢复初始状态。

## 验证

```bash
node --test
```

## 部署

本仓库通过 GitHub Actions 自动发布 `site/` 到 GitHub Pages。

Cloudflare Pages 也可免费部署：导入本仓库，将构建命令留空，输出目录设置为 `site`。`site/_headers` 已包含适用于 Cloudflare Pages 的基础安全响应头。

## 技术取舍

- 使用原生 HTML/CSS/JavaScript，零运行时依赖，降低部署与维护复杂度。
- 使用 `localStorage` 满足单用户 Demo 的数据持久化，避免在线体验依赖 API Key 或付费数据库。
- 智能体输出由可测试的本地规则引擎生成，保证公开 Demo 随时可用；生产版可在 `site/js/planner.js` 边界替换为真实模型服务。

详细设计见 [DESIGN.md](./DESIGN.md)。
