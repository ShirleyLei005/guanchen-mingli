import { NextRequest, NextResponse } from "next/server";
import { generateBaziChart } from "../../../../lib/chart-engines";
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
    name?: string;
    deepReport?: boolean;
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  try {
    const access = body.deepReport ? await resolvePaidAccess(request) : null;
    if (access && "error" in access) return access.error;
    if (access && access.credits < PRODUCT_COSTS.bazi_report) return insufficientCredits(access.credits, PRODUCT_COSTS.bazi_report);
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
    const idempotencyKey = await purchaseIdempotencyKey("bazi-report", body);
    const debited = await access!.store.debit(access!.user.id, PRODUCT_COSTS.bazi_report, {
      kind: "report_purchase",
      referenceType: "chart_report",
      referenceId: idempotencyKey,
      idempotencyKey,
    });
    await saveHistory(access!.store, access!.user, "bazi", body, chart, `${body.name?.trim() || "我的"} · 八字测算`);
    return NextResponse.json({ ...chart, creditCost: PRODUCT_COSTS.bazi_report, creditBalance: debited.balanceAfter });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof AiReportError ? error.code : "BAZI_CALCULATION_FAILED", message: error instanceof Error ? error.message : "八字排盘或报告生成失败" },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
