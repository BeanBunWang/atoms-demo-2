export const planPrompt = ({ prompt, intent, capabilities, context = {} }) => ({
  system: [
    "你是 Atoms 团队负责人 Mike。根据已识别意图生成最小但完整的执行图，并只输出 JSON。",
    "JSON 结构：{title, summary, decision, steps:[{id,agent,title,goal,tool,needsApproval}]}。",
    "agent 只能是 mike, iris, emma, bob, alex, david, sarah, adrian。tool 只能是 research_context, define_product, design_system, compose_app, analyze_data, prepare_growth, create_storyboard, validate_artifact。",
    "必须由 Mike 协调，但只路由真正需要的专家；不要固定全员出场。build/modify 至少包含 Emma 或 Bob、Alex、validate_artifact；研究优先 Iris；数据优先 David；增长优先 Sarah/Adrian。",
    "步骤 3-6 个，顺序体现上游产物如何成为下游输入。最后一步必须验证。中文、具体、可验收。"
  ].join("\n"),
  user: `原始需求：${prompt}\n意图：${JSON.stringify(intent)}\n能力选项：${JSON.stringify(capabilities)}\n当前产物版本：${Number(context.artifactRevision) || 0}\n最近对话：${JSON.stringify((context.recentMessages || []).slice(-10))}\n当前应用基线：${JSON.stringify(context.preview || null)}\n当前源码文件：${JSON.stringify((context.sourceFiles || []).map((file) => ({ path: file.path, content: String(file.content || "").slice(0, 6000) })).slice(0, 5))}\n最近 Preview 验证：${JSON.stringify(context.previewVerification || null)}\n最近 Preview 反馈：${JSON.stringify((context.previewFeedback || []).slice(-5))}`
});

export const artifactPrompt = ({ prompt, intent, plan, capabilities, previousPreview, previousSourceFiles, toolOutputs, baseRevision }) => ({
  system: [
    "你是被 Mike 调度的 Atoms 产品交付团队。生成与当前话题强相关、可直接渲染的应用产物，只输出 JSON。",
    "结构：{assistantMessage,preview:{appType,template,title,eyebrow,subtitle,accent,background,navItems,primaryAction,heroMetric,sections},decisions,files}。",
    "appType 只能是 generic、calculator、snake。计算器必须使用 calculator，贪吃蛇必须使用 snake，其他应用使用 generic。修改任务默认保持已有 appType，除非用户明确要求改成另一类应用。",
    "template 从 dashboard,tracker,catalog,planner,community,landing 中选最符合任务的一个，不能总用同一种。",
    "heroMetric={value,label,trend}。sections 为 3-5 项，每项结构 {type,title,description,items,metrics}；type 从 stats,list,cards,timeline,progress,table 中选，至少使用 2 种不同 type。",
    "items 每项 {title,meta,value,status}；metrics 每项 {label,value,trend}。所有数据、标题、状态、动作必须来自用户话题，禁止旅行/阅读等模板残留。",
    "decisions 是 2-4 条具体取舍。files 是 3-7 个与实现匹配的路径。不要输出 sourceFiles 或重复 preview JSON；runtime 会从已验证 preview 生成 src/App.jsx、src/styles.css、src/app.config.json，避免响应过长导致代码截断。",
    "颜色必须为 #RRGGBB。中文简洁。",
    "示例日期必须以当前日期为基准，不要生成已经过期的提醒。",
    "修改任务把已有预览视为基线，只实现本轮明确增量，保留未被要求改变的标题、主题、模块和应用类型。",
    "修改任务必须输出 patch 而不是完整 preview：{assistantMessage,patch:{set:{可选顶层字段},sectionOps:[{op:add|update|remove,id,value}]},decisions,files}。只能修改本轮需求涉及的字段；section update/remove 必须使用已有稳定 id。",
    "新建任务仍输出完整 preview。capabilities 用于声明真实行为：计算器可包含 basic-operations,decimal,clear,backspace,history,percent,sign；贪吃蛇可包含 direction-controls,keyboard,start-pause,reset,collision,score。"
  ].join("\n"),
  user: `当前日期：${new Date().toISOString().slice(0, 10)}\n需求：${prompt}\n意图：${JSON.stringify(intent)}\n已批准计划：${JSON.stringify(plan)}\n专家工具共享产物：${JSON.stringify(toolOutputs)}\n能力：${JSON.stringify(capabilities)}\n基线版本：${Number(baseRevision) || 0}\n已有预览（修改任务时作为不可变基线）：${JSON.stringify(previousPreview || null)}\n已有源码（修改时保留未涉及文件）：${JSON.stringify((previousSourceFiles || []).map((file) => ({ path: file.path, content: String(file.content || "").slice(0, 8000) })).slice(0, 5))}`
});

export const repairPrompt = ({ prompt, intent, plan, artifact, issues }) => ({
  system: "你是 Atoms 质量修复器。根据验证问题修正应用产物，只输出完整 JSON，结构必须与输入 artifact 完全一致。不要解释。",
  user: `需求：${prompt}\n意图：${JSON.stringify(intent)}\n计划：${JSON.stringify(plan)}\n验证问题：${JSON.stringify(issues)}\n待修复产物：${JSON.stringify(artifact)}`
});
