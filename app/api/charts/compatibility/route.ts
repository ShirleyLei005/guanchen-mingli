import { NextRequest, NextResponse } from "next/server";
import { generateCompatibility, type CompatibilityMode } from "../../../../lib/chart-engines";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";
import { PRODUCT_COSTS } from "../../../../lib/domain";
import { insufficientCredits, purchaseIdempotencyKey, resolvePaidAccess } from "../../../../lib/credits";
import { saveHistory } from "../../../../lib/history";

type BirthPayload = {
  name?: string;
  trueSolarTime?: string;
  gender?: "female" | "male";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      mode?: CompatibilityMode;
      first?: BirthPayload;
      second?: BirthPayload;
      topics?: string[];
      notes?: string;
      deepReport?: boolean;
    };
    if (!body.first?.trueSolarTime || !body.second?.trueSolarTime) {
      return NextResponse.json({ error: "MISSING_BIRTH_DATA" }, { status: 400 });
    }
    const access = body.deepReport ? await resolvePaidAccess(request) : null;
    if (access && "error" in access) return access.error;
    if (access && access.credits < PRODUCT_COSTS.compatibility) return insufficientCredits(access.credits, PRODUCT_COSTS.compatibility);
    const mode: CompatibilityMode = body.mode === "ziwei" ? "ziwei" : "bazi";
    const result = await generateCompatibility({
      mode,
      first: {
        name: body.first.name?.trim().slice(0, 30),
        trueSolarTime: body.first.trueSolarTime,
        gender: body.first.gender === "male" ? "male" : "female",
        topics: body.topics ?? [],
      },
      second: {
        name: body.second.name?.trim().slice(0, 30),
        trueSolarTime: body.second.trueSolarTime,
        gender: body.second.gender === "male" ? "male" : "female",
        topics: body.topics ?? [],
      },
      topics: body.topics ?? [],
    });
    if (body.deepReport) {
      const firstName = result.profiles[0]?.label || "第一方";
      const secondName = result.profiles[1]?.label || "第二方";
      result.aiReport = relabelReport(await generateDeepReport({
        kind: "compatibility",
        chart: result,
        topics: body.topics ?? [],
        question: [`分析对象：${firstName}与${secondName}。`, body.notes?.slice(0, 500)].filter(Boolean).join(" "),
      }), firstName, secondName);
    }
    if (!body.deepReport) return NextResponse.json(result);
    const idempotencyKey = await purchaseIdempotencyKey("compatibility-report", body);
    const debited = await access!.store.debit(access!.user.id, PRODUCT_COSTS.compatibility, {
      kind: "report_purchase",
      referenceType: "compatibility_report",
      referenceId: idempotencyKey,
      idempotencyKey,
    });
    await saveHistory(access!.store, access!.user, "compatibility", body, result, `${body.first.name?.trim() || "第一方"} × ${body.second.name?.trim() || "第二方"} · 双人合盘`);
    return NextResponse.json({ ...result, creditCost: PRODUCT_COSTS.compatibility, creditBalance: debited.balanceAfter });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof AiReportError ? error.code : "COMPATIBILITY_FAILED",
        message: error instanceof Error ? error.message : "合盘或报告生成失败",
      },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}

function relabelReport<T>(value: T, firstName: string, secondName: string): T {
  if (typeof value === "string") return value.replaceAll("第一方", firstName).replaceAll("第二方", secondName) as T;
  if (Array.isArray(value)) return value.map((item) => relabelReport(item, firstName, secondName)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, relabelReport(item, firstName, secondName)])) as T;
  }
  return value;
}
