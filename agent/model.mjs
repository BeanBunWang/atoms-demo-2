const DEFAULT_MODEL = "deepseek-v4-pro";

export function resolveModel(env) {
  const configured = env.DEEPSEEK_MODEL?.trim();
  return configured === DEFAULT_MODEL ? configured : DEFAULT_MODEL;
}

export function cleanText(value, fallback, maxLength) {
  const scalar = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const text = scalar.replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maxLength);
}

export function normalizeModelResult(value) {
  if (!value || typeof value !== "object") throw new Error("模型未返回有效对象");
  const rawPlan = Array.isArray(value.plan) ? value.plan.slice(0, 5) : [];
  if (rawPlan.length < 4) throw new Error("模型计划步骤不足");
  const accent = /^#[0-9a-f]{6}$/i.test(value.preview?.accent || "") ? value.preview.accent : "#246bfd";
  const fallbackFeatures = [
    { title: "清晰入口", detail: "快速进入最重要的使用场景。" },
    { title: "即时反馈", detail: "每次操作都有明确的状态反馈。" },
    { title: "持续积累", detail: "让每次记录形成长期价值。" }
  ];
  const rawFeatures = Array.isArray(value.preview?.features) && value.preview.features.length >= 3
    ? value.preview.features.slice(0, 3)
    : fallbackFeatures;
  const rawNavItems = Array.isArray(value.preview?.navItems) ? value.preview.navItems.slice(0, 2) : [];
  return {
    title: cleanText(value.title, "新应用", 36),
    assistantMessage: cleanText(value.assistantMessage, "我已经根据需求生成了实施计划，请确认后开始构建。", 180),
    plan: rawPlan.map((step, index) => ({
      title: cleanText(step?.title, `实施步骤 ${index + 1}`, 28),
      detail: cleanText(step?.detail, "完成该阶段的核心交付并验证结果。", 120)
    })),
    preview: {
      title: cleanText(value.preview?.title, value.title || "新应用", 36),
      subtitle: cleanText(value.preview?.subtitle, "把想法变成清晰、可操作的产品体验。", 120),
      cardTitle: cleanText(value.preview?.cardTitle, "核心功能", 36),
      cardMeta: cleanText(value.preview?.cardMeta, "第一版体验已就绪", 60),
      button: cleanText(value.preview?.button, "开始体验", 20),
      accent,
      eyebrow: cleanText(value.preview?.eyebrow, "BUILT AROUND YOUR DAY", 36).toUpperCase(),
      navItems: [cleanText(rawNavItems[0], "首页", 8), cleanText(rawNavItems[1], "记录", 8)],
      visualStart: cleanText(value.preview?.visualStart, "START", 12),
      visualEnd: cleanText(value.preview?.visualEnd, "DONE", 12),
      visualLabel: cleanText(value.preview?.visualLabel, "in progress", 18),
      features: rawFeatures.map((feature, index) => ({
        title: cleanText(feature?.title, fallbackFeatures[index].title, 18),
        detail: cleanText(feature?.detail, fallbackFeatures[index].detail, 60)
      }))
    }
  };
}

function parseJsonContent(content) {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function parseModelContent(content) {
  return normalizeModelResult(parseJsonContent(content));
}

export function buildDeepSeekRequest(prompt, context = {}, model = DEFAULT_MODEL) {
  const current = context.preview || {};
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是 Atoms 应用构建团队的负责人 Mike。请把用户需求转成一份可执行的产品计划和应用预览规格。",
          "只输出 JSON，不要 Markdown。结构必须是：",
          '{"title":"项目名","assistantMessage":"给用户的简短说明","plan":[{"title":"步骤标题","detail":"可验证的交付"}],"preview":{"title":"应用标题","subtitle":"一句价值说明","cardTitle":"核心卡片标题","cardMeta":"简短状态信息","button":"按钮文案","accent":"#RRGGBB","eyebrow":"简短英文场景标语","navItems":["导航一","导航二"],"visualStart":"场景起点数据","visualEnd":"场景终点数据","visualLabel":"场景状态","features":[{"title":"功能标题","detail":"具体价值"}]}}',
          "plan 必须包含 4 个步骤，分别覆盖产品目标、信息结构、关键交互、验证交付。",
          "preview.features 必须包含 3 项，所有预览内容必须与用户场景一致，不得残留旅行、阅读等无关模板词。",
          "内容使用简体中文，避免空泛 AI 话术，按钮不超过 8 个汉字。"
        ].join("\n")
      },
      {
        role: "user",
        content: `用户需求：${prompt}\n当前应用：${JSON.stringify({ title: current.title, subtitle: current.subtitle, cardTitle: current.cardTitle })}`
      }
    ],
    thinking: { type: "enabled" },
    reasoning_effort: "high",
    response_format: { type: "json_object" },
    max_tokens: 2400,
    stream: false
  };
}

async function requestCompletion({ messages, env, fetchImpl, maxTokens }) {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = resolveModel(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: messages.system }, { role: "user", content: messages.user }],
        thinking: { type: "enabled" },
        reasoning_effort: "high",
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        stream: false
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("模型服务暂时不可用");
    return { content: payload.choices?.[0]?.message?.content, model: payload.model || model, usage: payload.usage || null };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestDeepSeekPlan({ prompt, context, env, fetchImpl = fetch }) {
  const current = context?.preview || {};
  const request = buildDeepSeekRequest(prompt, context, resolveModel(env));
  const completion = await requestCompletion({
    messages: { system: request.messages[0].content, user: `用户需求：${prompt}\n当前应用：${JSON.stringify({ title: current.title, subtitle: current.subtitle, cardTitle: current.cardTitle })}` },
    env,
    fetchImpl,
    maxTokens: request.max_tokens
  });
  return { result: parseModelContent(completion.content), model: completion.model, usage: completion.usage };
}

export async function requestDeepSeekJson({ messages, env, fetchImpl = fetch, maxTokens = 6000 }) {
  const completion = await requestCompletion({ messages, env, fetchImpl, maxTokens });
  return parseJsonContent(completion.content);
}
