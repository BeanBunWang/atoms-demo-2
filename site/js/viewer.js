import { initialCalculatorState, initialSnakeState, normalizeCalculatorState, normalizeSnakeState } from "./interactive.js?v=13";

export const DESIGN_TABS = ["visual", "library", "theme"];

export const THEME_PRESETS = [
  { id: "editorial", name: "Editorial", description: "温暖纸张与衬线标题", accent: "#2f9f8f", background: "#f3f8f4", headingStyle: "editorial" },
  { id: "studio", name: "Studio", description: "冷静灰阶与工具感蓝色", accent: "#246bfd", background: "#f7f8fb", headingStyle: "studio" },
  { id: "sunset", name: "Sunset", description: "适合旅行与生活方式产品", accent: "#e9633d", background: "#fff8f2", headingStyle: "editorial" },
  { id: "forest", name: "Forest", description: "适合健康与习惯类产品", accent: "#2f7d57", background: "#f2f7f1", headingStyle: "studio" }
];

export const COMPONENT_LIBRARY = [
  { type: "cards", name: "Card collection", description: "用于入口、功能或内容集合" },
  { type: "stats", name: "Metric overview", description: "用于展示关键指标与趋势" },
  { type: "timeline", name: "Timeline", description: "用于计划、路线与阶段信息" },
  { type: "progress", name: "Progress tracker", description: "用于任务、习惯与状态推进" }
];

export function normalizeDesignTab(value) {
  return DESIGN_TABS.includes(value) ? value : "visual";
}

export function themePatch(themeId) {
  const theme = THEME_PRESETS.find((item) => item.id === themeId) || THEME_PRESETS[0];
  return { accent: theme.accent, background: theme.background, headingStyle: theme.headingStyle, themeId: theme.id };
}

export function createLibrarySection(type, index = 0) {
  const number = index + 1;
  const sections = {
    cards: {
      type: "cards",
      title: "快捷入口",
      description: "把高频动作集中到一个清晰区域。",
      metrics: [],
      items: [
        { title: "创建新记录", meta: "从空白开始", value: "", status: "可用" },
        { title: "查看最近内容", meta: "继续上次进度", value: "", status: "可用" }
      ]
    },
    stats: {
      type: "stats",
      title: "关键指标",
      description: "快速了解当前产品状态。",
      metrics: [
        { label: "已完成", value: String(number * 4), trend: "+2 本周" },
        { label: "进行中", value: String(number + 1), trend: "稳定" }
      ],
      items: []
    },
    timeline: {
      type: "timeline",
      title: "执行时间线",
      description: "按顺序组织接下来的关键步骤。",
      metrics: [],
      items: [
        { title: "准备", meta: "确认目标与输入", value: "01", status: "完成" },
        { title: "执行", meta: "推进核心任务", value: "02", status: "进行中" }
      ]
    },
    progress: {
      type: "progress",
      title: "进度追踪",
      description: "让完成情况和下一步保持可见。",
      metrics: [{ label: "当前进度", value: `${Math.min(95, 45 + number * 10)}%`, trend: "持续推进" }],
      items: [
        { title: "核心流程", meta: "主要体验已可用", value: "", status: "已完成" },
        { title: "体验优化", meta: "处理反馈与边界", value: "", status: "待处理" }
      ]
    }
  };
  return { id: `section-${Date.now().toString(36)}-${number}`, ...structuredClone(sections[type] || sections.cards) };
}

export function initialPreviewInteraction(revision = 0) {
  return {
    revision,
    activeSection: "home",
    primaryDone: false,
    selectedItems: [],
    calculator: initialCalculatorState(),
    snake: initialSnakeState()
  };
}

export function normalizePreviewInteraction(value, revision = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Number(value.revision || 0) !== Number(revision || 0)) return initialPreviewInteraction(revision);
  return {
    revision,
    activeSection: typeof value.activeSection === "string" ? value.activeSection : "home",
    primaryDone: value.primaryDone === true,
    selectedItems: Array.isArray(value.selectedItems) ? value.selectedItems.filter((item) => typeof item === "string").slice(0, 100) : [],
    calculator: normalizeCalculatorState(value.calculator),
    snake: normalizeSnakeState(value.snake)
  };
}
