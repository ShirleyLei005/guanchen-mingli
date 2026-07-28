export const PRODUCT_COSTS = {
  bazi_report: 5,
  ziwei_report: 5,
  compatibility: 10,
  conversation_message: 2,
} as const;

export const CREDIT_PACKAGES = [
  { id: "light", name: "轻量体验", credits: 10, priceFen: 990 },
  { id: "deep", name: "深度探索", credits: 50, priceFen: 3900 },
  { id: "long", name: "长期使用", credits: 120, priceFen: 7900 },
] as const;

export type ReportContent = {
  summary: string;
  evidence: Array<{ fact: string; sourcePath: string }>;
  analysis: Array<{ title: string; content: string }>;
  timing: Array<{ period: string; theme: string }>;
  actions: string[];
  risks: string[];
  disclaimer: string;
};

export function debitCredits(balance: number, cost: number) {
  if (!Number.isInteger(cost) || cost <= 0) throw new Error("INVALID_COST");
  if (balance < cost) throw new Error("INSUFFICIENT_CREDITS");
  return balance - cost;
}

export function refundCredits(balance: number, cost: number) {
  if (!Number.isInteger(cost) || cost <= 0) throw new Error("INVALID_REFUND");
  return balance + cost;
}

export function containsHighRiskQuestion(input: string) {
  return /(自杀|轻生|寿命|何时死|确诊|买哪只股票|保证收益|官司一定赢|胎儿性别)/u.test(input);
}

export function safeGuidance(category: string) {
  return `这个问题涉及${category}等重要现实决策，命理解读不能替代专业意见。我们可以讨论一般性的自我观察与行动准备，但不会给出确定性结论。`;
}
