import { NextRequest, NextResponse } from "next/server";
import { answerChartQuestion, AiReportError, type EvidenceItem } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";
import { insufficientCredits, readCredits, setCreditCookie } from "../../../../lib/credits";

type ChatBody = {
  kind?: "bazi" | "ziwei" | "compatibility";
  question?: string;
  report?: {
    title?: string;
    directAnswer?: string;
    coreConclusions?: Array<{ title?: string; conclusion?: string; evidenceRefs?: string[] }>;
    evidenceCatalog?: EvidenceItem[];
  };
  history?: Array<{ role: "user" | "assistant"; text: string }>;
};

export async function GET(request: NextRequest) {
  return NextResponse.json({ credits: readCredits(request), messageCost: PRODUCT_COSTS.conversation_message });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as ChatBody | null;
  if (!body?.kind || !["bazi", "ziwei", "compatibility"].includes(body.kind) || !body.question?.trim() || !body.report) {
    return NextResponse.json({ status: "error", message: "命盘或问题内容不完整" }, { status: 400 });
  }
  const credits = readCredits(request);
  if (credits < PRODUCT_COSTS.conversation_message) {
    return insufficientCredits(credits, PRODUCT_COSTS.conversation_message);
  }
  try {
    const reply = await answerChartQuestion({
      kind: body.kind,
      question: body.question.trim(),
      report: body.report,
      history: Array.isArray(body.history) ? body.history : [],
    });
    const remainingCredits = credits - PRODUCT_COSTS.conversation_message;
    const response = NextResponse.json({ status: "success", ...reply, creditCost: PRODUCT_COSTS.conversation_message, remainingCredits });
    return setCreditCookie(response, remainingCredits);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 暂时无法回答，请稍后重试";
    return NextResponse.json({ status: "error", code: error instanceof AiReportError ? error.code : "CHAT_FAILED", message }, { status: 500 });
  }
}
