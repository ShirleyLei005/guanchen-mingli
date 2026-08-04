import { NextRequest, NextResponse } from "next/server";
import { answerChartQuestion, AiReportError, type EvidenceItem } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";

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

const CREDIT_COOKIE = "guanchen_test_credits";

function readCredits(request: NextRequest) {
  const value = Number(request.cookies.get(CREDIT_COOKIE)?.value);
  return Number.isInteger(value) && value >= 0 ? value : 5;
}

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
    return NextResponse.json({ status: "error", code: "INSUFFICIENT_CREDITS", message: "当前积分不足，本次提问需要 3 积分", credits }, { status: 402 });
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
    response.cookies.set(CREDIT_COOKIE, String(remainingCredits), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 暂时无法回答，请稍后重试";
    return NextResponse.json({ status: "error", code: error instanceof AiReportError ? error.code : "CHAT_FAILED", message }, { status: 500 });
  }
}
