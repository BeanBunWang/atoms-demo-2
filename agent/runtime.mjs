import { inferIntent, intentPrompt, normalizeIntent } from "./intent.mjs";
import { artifactPrompt, planPrompt, repairPrompt } from "./prompts.mjs";
import { executeTool, normalizeArtifact, normalizePlan, validateArtifact } from "./tools.mjs";

const runId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function runAgentRuntime({ stage, prompt, context = {}, capabilities = {}, complete, emit }) {
  const id = runId();
  let sequence = 0;
  const send = (type, data = {}) => emit({ id, sequence: ++sequence, type, at: new Date().toISOString(), ...data });
  send("run.started", { stage, message: stage === "build" ? "Mike 正在读取已批准计划" : "Mike 正在理解任务" });

  let intent = context.intent;
  let plan = context.plan;
  if (stage !== "build" || !intent || !plan) {
    send("phase.started", { phase: "intent", agent: "mike", message: "识别目标、领域、用户和约束" });
    try {
      intent = normalizeIntent(await complete(intentPrompt(prompt, { ...context, capabilities })), prompt, { ...context, capabilities });
    } catch {
      intent = inferIntent(prompt, { ...context, capabilities });
      send("runtime.fallback", { phase: "intent", message: "意图模型输出异常，已使用确定性路由器" });
    }
    send("intent.classified", { phase: "intent", agent: "mike", intent, message: `${intent.type} · ${intent.domain} · 置信度 ${Math.round(intent.confidence * 100)}%` });
    if (intent.needsClarification && !context.clarificationAnswer) {
      send("clarification.required", { phase: "clarification", agent: "alex", clarification: intent.clarification, message: intent.clarification.question });
      send("run.completed", { stage: "plan", status: "awaiting_clarification", intent, clarification: intent.clarification });
      return { id, status: "awaiting_clarification", intent, clarification: intent.clarification };
    }
    const resolvedPrompt = context.clarificationAnswer
      ? `${prompt}\n用户对澄清问题的回答：${context.clarificationAnswer}`
      : prompt;
    send("phase.started", { phase: "planning", agent: "mike", tool: "task_router", message: "选择专家并生成依赖顺序" });
    plan = normalizePlan(await complete(planPrompt({ prompt: resolvedPrompt, intent, capabilities })), intent);
    send("plan.created", { phase: "planning", agent: "mike", plan, message: `已路由 ${new Set(plan.steps.map((step) => step.agent)).size} 位专家，共 ${plan.steps.length} 步` });
    send("approval.required", { phase: "approval", agent: "mike", message: "计划会改变产品范围，等待批准后再执行" });
    send("run.completed", { stage: "plan", status: "awaiting_approval", intent, plan });
    return { id, status: "awaiting_approval", intent, plan };
  }

  const activeSteps = plan.steps.filter((step) => step.tool !== "validate_artifact");
  const toolOutputs = [];
  for (const step of activeSteps) {
    send("agent.started", { phase: "execution", agent: step.agent, stepId: step.id, message: step.title });
    send("tool.called", { phase: "execution", agent: step.agent, tool: step.tool, stepId: step.id, message: step.goal });
    const output = executeTool(step, { intent, previousOutputs: toolOutputs });
    toolOutputs.push(output);
    send("tool.completed", { phase: "execution", agent: step.agent, tool: step.tool, stepId: step.id, output, message: output.summary });
  }
  send("artifact.generating", { phase: "execution", agent: "alex", tool: "compose_app", message: "按话题生成页面结构、真实文案与示例数据" });
  let artifact = normalizeArtifact(await complete(artifactPrompt({ prompt, intent, plan, capabilities, previousPreview: context.preview, toolOutputs })), intent);
  send("artifact.created", { phase: "execution", agent: "alex", artifact, message: `已生成 ${artifact.preview.template} 布局和 ${artifact.preview.sections.length} 个话题模块` });

  send("verification.started", { phase: "verification", agent: "mike", tool: "validate_artifact", message: "检查结构、话题关联、布局差异和交付文件" });
  let verification = validateArtifact(artifact, intent);
  if (!verification.passed) {
    send("replan.created", { phase: "replanning", agent: "mike", issues: verification.issues, message: `发现 ${verification.issues.length} 个问题，触发一次修复` });
    artifact = normalizeArtifact(await complete(repairPrompt({ prompt, intent, plan, artifact, issues: verification.issues })), intent);
    verification = validateArtifact(artifact, intent);
  }
  send("verification.completed", { phase: "verification", agent: "mike", verification, message: verification.passed ? "全部验证通过" : `仍有 ${verification.issues.length} 个非阻塞问题` });
  send("run.completed", { stage: "build", status: verification.passed ? "ready" : "ready_with_warnings", intent, plan, artifact, verification });
  return { id, status: verification.passed ? "ready" : "ready_with_warnings", intent, plan, artifact, verification };
}
