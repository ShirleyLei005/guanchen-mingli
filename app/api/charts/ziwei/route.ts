import { NextRequest, NextResponse } from "next/server";
import { runZiweiWorkflow } from "../../../../lib/ziwei-mcp-tools";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";
import { insufficientCredits, readCredits, setCreditCookie } from "../../../../lib/credits";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    trueSolarTime?: string;
    gender?: "female" | "male";
    topics?: string[];
    notes?: string;
    calendar?: "solar" | "lunar";
    timezone?: string;
    location?: {
      province?: string;
      city?: string;
      longitude?: number;
      latitude?: number;
    };
    deepReport?: boolean;
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ status: "error", message: "出生时间、性别或分析方向无效" }, { status: 400 });
  }
  const credits = readCredits(request);
  if (body.deepReport && credits < PRODUCT_COSTS.ziwei_report) return insufficientCredits(credits, PRODUCT_COSTS.ziwei_report);
  try {
    const chart = await runZiweiWorkflow({
      birthDate: body.trueSolarTime.slice(0, 10),
      birthTime: body.trueSolarTime.slice(11, 16),
      trueSolarTime: body.trueSolarTime,
      gender: body.gender!,
      topics: body.topics.slice(0, 3),
      question: body.notes?.slice(0, 500),
      calendar: body.calendar ?? "solar",
      timezone: body.timezone ?? "Asia/Shanghai",
      location: body.location ?? {
        province: "北京市",
        city: "北京市",
        longitude: 116.4,
        latitude: 39.9,
      },
    });
    if (body.deepReport) chart.aiReport = await generateDeepReport({
      kind: "ziwei",
      chart,
      topics: body.topics.slice(0, 3),
      question: body.notes?.slice(0, 500),
    });
    if (!body.deepReport) return NextResponse.json(chart);
    const remainingCredits = credits - PRODUCT_COSTS.ziwei_report;
    return setCreditCookie(NextResponse.json({ ...chart, creditCost: PRODUCT_COSTS.ziwei_report, creditBalance: remainingCredits }), remainingCredits);
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof AiReportError ? error.code : "ZIWEI_CALCULATION_FAILED", message: error instanceof Error ? error.message : "紫微命盘或报告生成失败" },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
