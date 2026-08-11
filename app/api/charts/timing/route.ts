import { NextRequest, NextResponse } from "next/server";
import { AiReportError, generateTimingChapter, type EvidenceItem } from "../../../../lib/ai-report";
import { insufficientCredits, readCredits, setCreditCookie } from "../../../../lib/credits";
import { PRODUCT_COSTS } from "../../../../lib/domain";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    kind?: "bazi" | "ziwei";
    question?: string;
    evidenceCatalog?: EvidenceItem[];
  } | null;
  if (!body?.kind || !["bazi", "ziwei"].includes(body.kind) || !Array.isArray(body.evidenceCatalog) || !body.evidenceCatalog.length) {
    return NextResponse.json({ status: "error", message: "当前命盘缺少可用于流年分析的依据" }, { status: 400 });
  }
  const credits = readCredits(request);
  if (credits < PRODUCT_COSTS.timing_report) return insufficientCredits(credits, PRODUCT_COSTS.timing_report);
  try {
    const result = await generateTimingChapter({
      kind: body.kind,
      question: body.question?.trim().slice(0, 500),
      evidenceCatalog: body.evidenceCatalog,
    });
    const remainingCredits = credits - PRODUCT_COSTS.timing_report;
    return setCreditCookie(NextResponse.json({ status: "success", ...result, creditCost: PRODUCT_COSTS.timing_report, remainingCredits }), remainingCredits);
  } catch (error) {
    return NextResponse.json({
      status: "error",
      code: error instanceof AiReportError ? error.code : "TIMING_REPORT_FAILED",
      message: error instanceof Error ? error.message : "流年分析生成失败，本次未扣积分",
    }, { status: error instanceof AiReportError ? 502 : 500 });
  }
}
