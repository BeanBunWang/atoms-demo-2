const INTENT_TYPES = new Set(["build_app", "modify_app", "research", "analyze_data", "campaign", "create_video"]);

const clean = (value, fallback = "", max = 160) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, max);
};

const list = (value, fallback = [], max = 8) => {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map((item) => clean(item, "", 48)).filter(Boolean))].slice(0, max);
};

export function inferIntent(prompt, context = {}) {
  const text = clean(prompt, "构建一个新应用", 600);
  const type = /调研|研究|竞品|市场/.test(text)
    ? "research"
    : /分析|报表|数据|指标|看板/.test(text)
      ? "analyze_data"
      : /广告|投放|营销|增长/.test(text)
        ? "campaign"
        : /视频|分镜|短片/.test(text)
          ? "create_video"
          : context?.hasExistingApp || /修改|增加|调整|优化|改成/.test(text)
            ? "modify_app"
            : "build_app";
  const domain = /宠物/.test(text) ? "宠物服务" : /销售|CRM|客户/.test(text) ? "销售管理" : /阅读|书/.test(text) ? "阅读" : /旅行|路线|景点/.test(text) ? "旅行" : /健康|运动|习惯/.test(text) ? "健康习惯" : /社区|社交/.test(text) ? "社区" : "通用产品";
  return {
    type,
    goal: text,
    domain,
    audience: "目标场景中的实际使用者",
    entities: list(text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,10}/g), [domain], 5),
    requestedFeatures: list(text.split(/[，、；;。]/).filter((part) => /收藏|记录|生成|管理|分析|分享|提醒|搜索|筛选|预约|发布|上传/.test(part)), ["完成核心任务", "查看结果反馈"], 6),
    constraints: list(context?.capabilities?.attachments?.map((item) => `参考附件：${item.name}`), [], 4),
    complexity: text.length > 120 || /登录|支付|数据库|实时|协作/.test(text) ? "high" : text.length > 45 ? "medium" : "low",
    confidence: 0.68,
    rationale: `识别为${type}，核心领域是${domain}。`
  };
}

export function normalizeIntent(value, prompt, context = {}) {
  const fallback = inferIntent(prompt, context);
  const confidence = Number(value?.confidence);
  return {
    type: INTENT_TYPES.has(value?.type) ? value.type : fallback.type,
    goal: clean(value?.goal, fallback.goal, 220),
    domain: clean(value?.domain, fallback.domain, 40),
    audience: clean(value?.audience, fallback.audience, 80),
    entities: list(value?.entities, fallback.entities, 7),
    requestedFeatures: list(value?.requestedFeatures, fallback.requestedFeatures, 8),
    constraints: list(value?.constraints, fallback.constraints, 6),
    complexity: ["low", "medium", "high"].includes(value?.complexity) ? value.complexity : fallback.complexity,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : fallback.confidence,
    rationale: clean(value?.rationale, fallback.rationale, 140)
  };
}

export const intentPrompt = (prompt, context = {}) => ({
  system: [
    "你是 Atoms 的意图路由器。先理解用户真正要完成的工作，再决定后续 Agent 团队。",
    "只输出 JSON：type(build_app|modify_app|research|analyze_data|campaign|create_video), goal, domain, audience, entities[], requestedFeatures[], constraints[], complexity(low|medium|high), confidence(0-1), rationale。",
    "不要把所有请求都判为 build_app；结合动词、已有应用上下文、附件和所选能力判断。"
  ].join("\n"),
  user: `用户输入：${prompt}\n运行上下文：${JSON.stringify(context)}`
});
