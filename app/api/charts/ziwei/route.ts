import { NextRequest, NextResponse } from "next/server";
import { runZiweiWorkflow } from "../../../../lib/ziwei-mcp-tools";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";
import { insufficientCredits, purchaseIdempotencyKey, resolvePaidAccess } from "../../../../lib/credits";
import { saveHistory } from "../../../../lib/history";

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
    name?: string;
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ status: "error", message: "出生时间、性别或分析方向无效" }, { status: 400 });
  }
  try {
    const access = body.deepReport ? await resolvePaidAccess(request) : null;
    if (access && "error" in access) return access.error;
    if (access && access.credits < PRODUCT_COSTS.ziwei_report) return insufficientCredits(access.credits, PRODUCT_COSTS.ziwei_report);
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
    const idempotencyKey = await purchaseIdempotencyKey("ziwei-report", body);
    const debited = await access!.store.debit(access!.user.id, PRODUCT_COSTS.ziwei_report, {
      kind: "report_purchase",
      referenceType: "chart_report",
      referenceId: idempotencyKey,
      idempotencyKey,
    });
    await saveHistory(access!.store, access!.user, "ziwei", body, chart, `${body.name?.trim() || "我的"} · 紫微斗数`);
    return NextResponse.json({ ...chart, creditCost: PRODUCT_COSTS.ziwei_report, creditBalance: debited.balanceAfter });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof AiReportError ? error.code : "ZIWEI_CALCULATION_FAILED", message: error instanceof Error ? error.message : "紫微命盘或报告生成失败" },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
