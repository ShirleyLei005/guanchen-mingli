import { NextRequest, NextResponse } from "next/server";
import { generateBaziChart } from "../../../../lib/chart-engines";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";

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
    return NextResponse.json(chart);
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof AiReportError ? error.code : "BAZI_CALCULATION_FAILED", message: error instanceof Error ? error.message : "八字排盘或报告生成失败" },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
