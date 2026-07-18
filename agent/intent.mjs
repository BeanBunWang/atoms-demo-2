const INTENT_TYPES = new Set(["build_app", "modify_app", "research", "analyze_data", "campaign", "create_video"]);

const clean = (value, fallback = "", max = 160) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, max);
};

const list = (value, fallback = [], max = 8) => {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map((item) => clean(item, "", 48)).filter(Boolean))].slice(0, max);
};

const defaultClarification = (domain) => ({
  question: `为了把${domain === "通用产品" ? "这个想法" : domain}做成可用的第一版，你最想先解决哪个场景？`,
  multiple: false,
  options: [
    { label: "先做核心流程", value: "优先完成一个可从头走到尾的核心流程", description: "范围最小，最快得到可验证版本" },
    { label: "先做数据看板", value: "优先完成数据记录、统计和反馈", description: "适合追踪进度和结果" },
    { label: "先做用户体系", value: "优先完成用户档案、登录和个性化", description: "适合需要长期保存数据的产品" }
  ]
});

function normalizeClarification(value, fallback) {
  const source = value && typeof value === "object" ? value : fallback;
  const options = (Array.isArray(source.options) ? source.options : fallback.options)
    .slice(0, 4)
    .map((option, index) => ({
      label: clean(option?.label, fallback.options[index]?.label || `选项 ${index + 1}`, 36),
      value: clean(option?.value, option?.label || fallback.options[index]?.value, 120),
      description: clean(option?.description, fallback.options[index]?.description || "", 100)
    }));
  return {
    question: clean(source.question, fallback.question, 180),
    multiple: Boolean(source.multiple),
    options: options.length >= 2 ? options : fallback.options
  };
}

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
  const needsClarification = type === "build_app" && text.length < 14 && !/登录|支付|数据库|记录|提醒|分享|搜索|管理|看板|路线|课程|商城/.test(text);
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
    rationale: `识别为${type}，核心领域是${domain}。`,
    needsClarification,
    clarification: defaultClarification(domain)
  };
}

export function normalizeIntent(value, prompt, context = {}) {
  const fallback = inferIntent(prompt, context);
  const confidence = Number(value?.confidence);
  const needsClarification = typeof value?.needsClarification === "boolean" ? value.needsClarification : fallback.needsClarification;
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
    rationale: clean(value?.rationale, fallback.rationale, 140),
    needsClarification,
    clarification: normalizeClarification(value?.clarification, fallback.clarification)
  };
}

export const intentPrompt = (prompt, context = {}) => ({
  system: [
    "你是 Atoms 的意图路由器。先理解用户真正要完成的工作，再决定后续 Agent 团队。",
    "只输出 JSON：type(build_app|modify_app|research|analyze_data|campaign|create_video), goal, domain, audience, entities[], requestedFeatures[], constraints[], complexity(low|medium|high), confidence(0-1), rationale, needsClarification, clarification。",
    "clarification 结构为 {question,multiple,options:[{label,value,description}]}，给 2-4 个具体、互斥且可直接选择的答案。",
    "仅当缺少的信息会显著改变产品方向时 needsClarification=true；需求已包含明确用户、场景或核心功能时直接规划，不要机械追问。",
    "不要把所有请求都判为 build_app；结合动词、已有应用上下文、附件和可选能力判断。"
  ].join("\n"),
  user: `用户输入：${prompt}\n运行上下文：${JSON.stringify(context)}`
});
