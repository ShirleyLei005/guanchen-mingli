import { NextRequest, NextResponse } from "next/server";
import { generateBaziChart } from "../../../../lib/chart-engines";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";
import { insufficientCredits, readCredits, setCreditCookie } from "../../../../lib/credits";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    trueSolarTime?: string;
    gender?: "female" | "male";
    topics?: string[];
    notes?: string;
    deepReport?: boolean;
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const credits = readCredits(request);
  if (body.deepReport && credits < PRODUCT_COSTS.bazi_report) return insufficientCredits(credits, PRODUCT_COSTS.bazi_report);
  try {
    const chart = await generateBaziChart({
      trueSolarTime: body.trueSolarTime,
      gender: body.gender!,
      topics: body.topics.slice(0, 3),
      question: body.notes?.slice(0, 500),
    });
    if (body.deepReport) chart.aiReport = await generateDeepReport({
      kind: "bazi",
      chart,
      topics: body.topics.slice(0, 3),
      question: body.notes?.slice(0, 500),
    });
    if (!body.deepReport) return NextResponse.json(chart);
    const remainingCredits = credits - PRODUCT_COSTS.bazi_report;
    return setCreditCookie(NextResponse.json({ ...chart, creditCost: PRODUCT_COSTS.bazi_report, creditBalance: remainingCredits }), remainingCredits);
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof AiReportError ? error.code : "BAZI_CALCULATION_FAILED", message: error instanceof Error ? error.message : "八字排盘或报告生成失败" },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
