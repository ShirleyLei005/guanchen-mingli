import { NextRequest, NextResponse } from "next/server";
import { AiReportError, generateTimingChapter, type EvidenceItem } from "../../../../lib/ai-report";
import { insufficientCredits, purchaseIdempotencyKey, resolvePaidAccess } from "../../../../lib/credits";
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
  try {
    const access = await resolvePaidAccess(request);
    if ("error" in access) return access.error;
    if (access.credits < PRODUCT_COSTS.timing_report) return insufficientCredits(access.credits, PRODUCT_COSTS.timing_report);
    const result = await generateTimingChapter({
      kind: body.kind,
      question: body.question?.trim().slice(0, 500),
      evidenceCatalog: body.evidenceCatalog,
    });
    const idempotencyKey = await purchaseIdempotencyKey("timing-report", body);
    const debited = await access.store.debit(access.user.id, PRODUCT_COSTS.timing_report, {
      kind: "report_purchase",
      referenceType: "timing_report",
      referenceId: idempotencyKey,
      idempotencyKey,
    });
    return NextResponse.json({ status: "success", ...result, creditCost: PRODUCT_COSTS.timing_report, remainingCredits: debited.balanceAfter });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      code: error instanceof AiReportError ? error.code : "TIMING_REPORT_FAILED",
      message: error instanceof Error ? error.message : "流年分析生成失败，本次未扣积分",
    }, { status: error instanceof AiReportError ? 502 : 500 });
  }
}
